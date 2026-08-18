from __future__ import annotations

import argparse
import csv
import re
from collections import Counter
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path

from scripts.common.data_paths import (
    EXTRACTED_CURRICULUM_DIR,
)


REVIEW_SIMILARITY_THRESHOLD = 0.78

OUTPUT_COLUMNS = [
    "candidate_code",
    "candidate_name",
    "candidate_grade",
    "candidate_semester",
    "candidate_completion_type",
    "candidate_credits",
    "candidate_prefix",
    "classification",
    "match_type",
    "anchor_codes",
    "anchor_names",
    "anchor_grades",
    "similarity",
    "reason",
]


@dataclass
class Course:
    grade: int
    semester: int
    course_name: str
    course_code: str
    completion_type: str
    credits: float


@dataclass
class AnalysisRow:
    candidate: Course
    classification: str
    match_type: str
    anchors: list[Course]
    similarity: float | None
    reason: str


def course_prefix(
    course_code: str,
) -> str:
    match = re.match(
        r"^[A-Z]+",
        course_code,
    )

    if match is None:
        return ""

    return match.group(0)


def normalize_course_name(
    course_name: str,
) -> str:
    normalized = (
        course_name
        .strip()
        .lower()
    )

    normalized = re.sub(
        r"[\s\-_/·ㆍ:;,.()\[\]{}]+",
        "",
        normalized,
    )

    return normalized


def split_terminal_number(
    course_name: str,
) -> tuple[
    str,
    str | None,
]:
    normalized = (
        normalize_course_name(
            course_name
        )
    )

    match = re.fullmatch(
        r"(.+?)(\d+)",
        normalized,
    )

    if match is None:
        return (
            normalized,
            None,
        )

    return (
        match.group(1),
        match.group(2),
    )


def family_match(
    anchor_name: str,
    candidate_name: str,
) -> bool:
    (
        anchor_base,
        anchor_number,
    ) = split_terminal_number(
        anchor_name
    )

    (
        candidate_base,
        candidate_number,
    ) = split_terminal_number(
        candidate_name
    )

    if (
        anchor_base
        != candidate_base
    ):
        return False

    if (
        anchor_number
        is None
        and candidate_number
        is None
    ):
        return False

    return (
        anchor_number is None
        or candidate_number is None
    )


def similarity_score(
    left: str,
    right: str,
) -> float:
    left_normalized = (
        normalize_course_name(
            left
        )
    )

    right_normalized = (
        normalize_course_name(
            right
        )
    )

    if (
        not left_normalized
        or not right_normalized
    ):
        return 0.0

    return SequenceMatcher(
        None,
        left_normalized,
        right_normalized,
    ).ratio()


def read_courses(
    path: Path,
) -> list[Course]:
    courses: list[Course] = []

    with path.open(
        "r",
        encoding="utf-8-sig",
        newline="",
    ) as file:
        reader = csv.DictReader(
            file
        )

        for row in reader:
            courses.append(
                Course(
                    grade=int(
                        row["grade"]
                    ),
                    semester=int(
                        row["semester"]
                    ),
                    course_name=(
                        row[
                            "course_name"
                        ].strip()
                    ),
                    course_code=(
                        row[
                            "course_code"
                        ].strip()
                    ),
                    completion_type=(
                        row[
                            "completion_type"
                        ].strip()
                    ),
                    credits=float(
                        row["credits"]
                    ),
                )
            )

    return courses


def find_exact_matches(
    candidate: Course,
    anchors: list[Course],
) -> list[Course]:
    candidate_name = (
        normalize_course_name(
            candidate.course_name
        )
    )

    return [
        anchor
        for anchor in anchors
        if (
            normalize_course_name(
                anchor.course_name
            )
            == candidate_name
        )
    ]


def find_family_matches(
    candidate: Course,
    anchors: list[Course],
) -> list[Course]:
    return [
        anchor
        for anchor in anchors
        if family_match(
            anchor.course_name,
            candidate.course_name,
        )
    ]


def find_review_matches(
    candidate: Course,
    anchors: list[Course],
) -> tuple[
    list[Course],
    float | None,
]:
    scored: list[
        tuple[
            float,
            Course,
        ]
    ] = []

    for anchor in anchors:
        score = similarity_score(
            anchor.course_name,
            candidate.course_name,
        )

        if (
            score
            < REVIEW_SIMILARITY_THRESHOLD
        ):
            continue

        scored.append(
            (
                score,
                anchor,
            )
        )

    if not scored:
        return (
            [],
            None,
        )

    scored.sort(
        key=lambda item: (
            -item[0],
            item[1].grade,
            item[1].semester,
            item[1].course_code,
        )
    )

    best_score = (
        scored[0][0]
    )

    best_matches = [
        anchor
        for (
            score,
            anchor,
        ) in scored
        if (
            abs(
                score
                - best_score
            )
            < 0.000001
        )
    ]

    return (
        best_matches,
        best_score,
    )


def analyze_candidate(
    candidate: Course,
    anchors: list[Course],
) -> AnalysisRow:
    exact_matches = (
        find_exact_matches(
            candidate,
            anchors,
        )
    )

    if exact_matches:
        return AnalysisRow(
            candidate=candidate,
            classification=(
                "PEET_COLLISION_EXACT"
            ),
            match_type="exact",
            anchors=exact_matches,
            similarity=1.0,
            reason=(
                "1~2학년 수능세대 anchor와 "
                "교과목명이 정규화 후 동일함."
            ),
        )

    family_matches = (
        find_family_matches(
            candidate,
            anchors,
        )
    )

    if family_matches:
        return AnalysisRow(
            candidate=candidate,
            classification=(
                "PEET_COLLISION_FAMILY"
            ),
            match_type="family",
            anchors=family_matches,
            similarity=None,
            reason=(
                "1~2학년 수능세대 anchor와 "
                "같은 과목명 계열이며, "
                "한쪽에만 말단 번호가 존재함."
            ),
        )

    (
        review_matches,
        review_similarity,
    ) = find_review_matches(
        candidate,
        anchors,
    )

    if review_matches:
        return AnalysisRow(
            candidate=candidate,
            classification=(
                "REVIEW_SIMILAR"
            ),
            match_type="similar",
            anchors=review_matches,
            similarity=(
                review_similarity
            ),
            reason=(
                "1~2학년 수능세대 anchor와 "
                "명칭 유사도가 높지만 "
                "자동 세대 판정 근거로는 "
                "충분하지 않음."
            ),
        )

    return AnalysisRow(
        candidate=candidate,
        classification=(
            "UNRESOLVED"
        ),
        match_type="",
        anchors=[],
        similarity=None,
        reason=(
            "1~2학년 수능세대 anchor와 "
            "직접적인 명칭 충돌을 "
            "찾지 못함."
        ),
    )


def analyze_courses(
    courses: list[Course],
) -> tuple[
    list[Course],
    list[AnalysisRow],
]:
    anchors = [
        course
        for course in courses
        if course.grade in {
            1,
            2,
        }
    ]

    candidates = [
        course
        for course in courses
        if course.grade in {
            3,
            4,
            5,
            6,
        }
    ]

    analysis_rows = [
        analyze_candidate(
            candidate,
            anchors,
        )
        for candidate in candidates
    ]

    return (
        anchors,
        analysis_rows,
    )


def join_course_codes(
    courses: list[Course],
) -> str:
    return ";".join(
        course.course_code
        for course in courses
    )


def join_course_names(
    courses: list[Course],
) -> str:
    return ";".join(
        course.course_name
        for course in courses
    )


def join_course_grades(
    courses: list[Course],
) -> str:
    return ";".join(
        (
            f"{course.grade}-"
            f"{course.semester}"
        )
        for course in courses
    )


def write_analysis_csv(
    output_path: Path,
    rows: list[AnalysisRow],
) -> None:
    with output_path.open(
        "w",
        encoding="utf-8-sig",
        newline="",
    ) as file:
        writer = csv.DictWriter(
            file,
            fieldnames=(
                OUTPUT_COLUMNS
            ),
        )

        writer.writeheader()

        for row in rows:
            candidate = (
                row.candidate
            )

            writer.writerow(
                {
                    "candidate_code": (
                        candidate.course_code
                    ),
                    "candidate_name": (
                        candidate.course_name
                    ),
                    "candidate_grade": (
                        candidate.grade
                    ),
                    "candidate_semester": (
                        candidate.semester
                    ),
                    (
                        "candidate_"
                        "completion_type"
                    ): (
                        candidate
                        .completion_type
                    ),
                    "candidate_credits": (
                        f"{candidate.credits:g}"
                    ),
                    "candidate_prefix": (
                        course_prefix(
                            candidate.course_code
                        )
                    ),
                    "classification": (
                        row.classification
                    ),
                    "match_type": (
                        row.match_type
                    ),
                    "anchor_codes": (
                        join_course_codes(
                            row.anchors
                        )
                    ),
                    "anchor_names": (
                        join_course_names(
                            row.anchors
                        )
                    ),
                    "anchor_grades": (
                        join_course_grades(
                            row.anchors
                        )
                    ),
                    "similarity": (
                        ""
                        if (
                            row.similarity
                            is None
                        )
                        else (
                            f"{row.similarity:.3f}"
                        )
                    ),
                    "reason": (
                        row.reason
                    ),
                }
            )


def format_course(
    course: Course,
) -> str:
    return (
        f"{course.course_code} | "
        f"{course.grade}-"
        f"{course.semester} | "
        f"{course.completion_type} | "
        f"{course.credits:g} | "
        f"{course.course_name}"
    )


def write_report(
    output_path: Path,
    year: int,
    courses: list[Course],
    anchors: list[Course],
    rows: list[AnalysisRow],
) -> None:
    classification_counts = Counter(
        row.classification
        for row in rows
    )

    anchor_prefix_counts = Counter(
        course_prefix(
            anchor.course_code
        )
        for anchor in anchors
    )

    candidate_prefix_counts = Counter(
        course_prefix(
            row.candidate.course_code
        )
        for row in rows
    )

    lines = [
        (
            "Curriculum generation "
            "analysis report"
        ),
        "=====================================",
        "",
        f"academic year: {year}",
        (
            "source rows: "
            f"{len(courses)}"
        ),
        (
            "six-year anchors "
            "(grade 1-2): "
            f"{len(anchors)}"
        ),
        (
            "grade 3-6 candidates: "
            f"{len(rows)}"
        ),
        "",
        "Classification summary",
        "----------------------",
        (
            "PEET_COLLISION_EXACT: "
            f"{classification_counts.get('PEET_COLLISION_EXACT', 0)}"
        ),
        (
            "PEET_COLLISION_FAMILY: "
            f"{classification_counts.get('PEET_COLLISION_FAMILY', 0)}"
        ),
        (
            "REVIEW_SIMILAR: "
            f"{classification_counts.get('REVIEW_SIMILAR', 0)}"
        ),
        (
            "UNRESOLVED: "
            f"{classification_counts.get('UNRESOLVED', 0)}"
        ),
        "",
        "Anchor code prefixes",
        "--------------------",
    ]

    for (
        prefix,
        count,
    ) in sorted(
        anchor_prefix_counts.items()
    ):
        lines.append(
            f"{prefix}: {count}"
        )

    lines.extend(
        [
            "",
            "Grade 3-6 code prefixes",
            "-----------------------",
        ]
    )

    for (
        prefix,
        count,
    ) in sorted(
        candidate_prefix_counts.items()
    ):
        lines.append(
            f"{prefix}: {count}"
        )

    lines.extend(
        [
            "",
            "Six-year anchors",
            "----------------",
        ]
    )

    for anchor in sorted(
        anchors,
        key=lambda course: (
            course.grade,
            course.semester,
            course.course_code,
        ),
    ):
        lines.append(
            format_course(
                anchor
            )
        )

    for classification in [
        "PEET_COLLISION_EXACT",
        "PEET_COLLISION_FAMILY",
        "REVIEW_SIMILAR",
    ]:
        matching_rows = [
            row
            for row in rows
            if (
                row.classification
                == classification
            )
        ]

        if not matching_rows:
            continue

        lines.extend(
            [
                "",
                classification,
                "-" * len(
                    classification
                ),
            ]
        )

        for row in matching_rows:
            lines.append(
                format_course(
                    row.candidate
                )
            )

            for anchor in row.anchors:
                lines.append(
                    (
                        "  <-> "
                        + format_course(
                            anchor
                        )
                    )
                )

            if (
                row.similarity
                is not None
            ):
                lines.append(
                    (
                        "  similarity: "
                        f"{row.similarity:.3f}"
                    )
                )

            lines.append(
                (
                    "  reason: "
                    f"{row.reason}"
                )
            )

    unresolved_rows = [
        row
        for row in rows
        if (
            row.classification
            == "UNRESOLVED"
        )
    ]

    lines.extend(
        [
            "",
            "UNRESOLVED",
            "----------",
        ]
    )

    for row in unresolved_rows:
        lines.append(
            format_course(
                row.candidate
            )
        )

    lines.append(
        ""
    )

    output_path.write_text(
        "\n".join(
            lines
        ),
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "1~2학년 과목을 "
            "수능세대 anchor로 사용하여 "
            "3~6학년의 PEET 교육과정 "
            "충돌 후보를 분석합니다."
        )
    )

    parser.add_argument(
        "--year",
        type=int,
        required=True,
    )

    args = parser.parse_args()

    input_dir = (
        EXTRACTED_CURRICULUM_DIR
        / str(args.year)
    )

    input_path = (
        input_dir
        / "courses.csv"
    )

    if not input_path.exists():
        raise FileNotFoundError(
            (
                "extracted curriculum "
                "파일이 없습니다: "
                f"{input_path}"
            )
        )

    courses = read_courses(
        input_path
    )

    (
        anchors,
        analysis_rows,
    ) = analyze_courses(
        courses
    )

    if not anchors:
        raise ValueError(
            (
                "1~2학년 수능세대 "
                "anchor를 찾지 못했습니다."
            )
        )

    csv_path = (
        input_dir
        / "generation_analysis.csv"
    )

    report_path = (
        input_dir
        / "generation_analysis_report.txt"
    )

    write_analysis_csv(
        csv_path,
        analysis_rows,
    )

    write_report(
        report_path,
        args.year,
        courses,
        anchors,
        analysis_rows,
    )

    classification_counts = Counter(
        row.classification
        for row in analysis_rows
    )

    print()
    print(
        "Curriculum generation analysis"
    )
    print(
        "------------------------------"
    )
    print(
        f"year: {args.year}"
    )
    print(
        f"source rows: {len(courses)}"
    )
    print(
        "six-year anchors: "
        f"{len(anchors)}"
    )
    print(
        "grade 3-6 candidates: "
        f"{len(analysis_rows)}"
    )
    print(
        "exact collisions: "
        f"{classification_counts.get('PEET_COLLISION_EXACT', 0)}"
    )
    print(
        "family collisions: "
        f"{classification_counts.get('PEET_COLLISION_FAMILY', 0)}"
    )
    print(
        "review similar: "
        f"{classification_counts.get('REVIEW_SIMILAR', 0)}"
    )
    print(
        "unresolved: "
        f"{classification_counts.get('UNRESOLVED', 0)}"
    )
    print(
        f"csv:    {csv_path}"
    )
    print(
        f"report: {report_path}"
    )


if __name__ == "__main__":
    main()
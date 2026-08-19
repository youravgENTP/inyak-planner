from __future__ import annotations

import csv
import re
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

from scripts.common.data_paths import (
    CURRICULUM_COMPARISON_DIR,
    EXTRACTED_CURRICULUM_DIR,
    EXTRACTED_CURRICULUM_FLOWCHARTS_DIR,
)


SUPPORTED_YEARS = [
    2022,
    2023,
    2024,
    2025,
    2026,
]

PROGRAM_YEARS = [
    4,
    6,
]

OUTPUT_COLUMNS = [
    "academic_year",
    "grade",
    "semester",
    "pdf_course_name",
    "pdf_course_code",
    "pdf_completion_type",
    "pdf_credits",
    "4year_source_available",
    "4year_exact_same_position",
    "4year_near_same_position",
    "4year_near_match_name",
    "4year_near_match_type",
    "4year_near_edit_distance",
    "4year_near_candidate_count",
    "4year_near_candidates",
    "6year_source_available",
    "6year_exact_same_position",
    "6year_near_same_position",
    "6year_near_match_name",
    "6year_near_match_type",
    "6year_near_edit_distance",
    "6year_near_candidate_count",
    "6year_near_candidates",
    "near_evidence_summary",
    "near_one_sided_generation",
    "review_status",
]


@dataclass(frozen=True)
class Course:
    grade: int
    semester: int
    course_name: str
    course_code: str = ""
    completion_type: str = ""
    credits: str = ""


@dataclass(frozen=True)
class NearCandidate:
    course_name: str
    match_type: str
    edit_distance: int


def curriculum_path(
    year: int,
) -> Path:
    return (
        EXTRACTED_CURRICULUM_DIR
        / str(year)
        / "courses.csv"
    )


def flowchart_path(
    year: int,
    program_years: int,
) -> Path:
    return (
        EXTRACTED_CURRICULUM_FLOWCHARTS_DIR
        / str(year)
        / f"{program_years}year_courses.csv"
    )


def output_directory() -> Path:
    return CURRICULUM_COMPARISON_DIR


def output_csv_path() -> Path:
    return (
        output_directory()
        / "curriculum_near_name_audit.csv"
    )


def output_report_path() -> Path:
    return (
        output_directory()
        / "curriculum_near_name_audit_report.txt"
    )


def read_csv_rows(
    path: Path,
) -> list[dict[str, str]]:
    with path.open(
        "r",
        encoding="utf-8-sig",
        newline="",
    ) as file:
        return list(
            csv.DictReader(
                file
            )
        )


def exact_normalize(
    text: str,
) -> str:
    return re.sub(
        r"\s+",
        "",
        text.strip(),
    )


def soft_normalize(
    text: str,
) -> str:
    normalized = exact_normalize(
        text
    )

    normalized = re.sub(
        r"[·ㆍ∙.,:;()（）\[\]{}\-_/\\]",
        "",
        normalized,
    )

    return normalized


def digit_signature(
    text: str,
) -> tuple[str, ...]:
    return tuple(
        re.findall(
            r"\d+",
            soft_normalize(
                text
            ),
        )
    )


def levenshtein_distance(
    left: str,
    right: str,
) -> int:
    if left == right:
        return 0

    if not left:
        return len(
            right
        )

    if not right:
        return len(
            left
        )

    if abs(
        len(left)
        - len(right)
    ) > 1:
        return 2

    previous = list(
        range(
            len(right)
            + 1
        )
    )

    for left_index, left_char in enumerate(
        left,
        start=1,
    ):
        current = [
            left_index
        ]

        row_minimum = left_index

        for right_index, right_char in enumerate(
            right,
            start=1,
        ):
            insertion = (
                current[
                    right_index - 1
                ]
                + 1
            )

            deletion = (
                previous[
                    right_index
                ]
                + 1
            )

            substitution = (
                previous[
                    right_index - 1
                ]
                + (
                    0
                    if left_char
                    == right_char
                    else 1
                )
            )

            value = min(
                insertion,
                deletion,
                substitution,
            )

            current.append(
                value
            )

            row_minimum = min(
                row_minimum,
                value,
            )

        if row_minimum > 1:
            return 2

        previous = current

    return previous[-1]


def available_years() -> list[int]:
    return [
        year
        for year in SUPPORTED_YEARS
        if curriculum_path(
            year
        ).exists()
    ]


def load_pdf_courses(
    year: int,
) -> list[Course]:
    rows = read_csv_rows(
        curriculum_path(
            year
        )
    )

    return [
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
                row.get(
                    "course_code",
                    "",
                ).strip()
            ),
            completion_type=(
                row.get(
                    "completion_type",
                    "",
                ).strip()
            ),
            credits=(
                row.get(
                    "credits",
                    "",
                ).strip()
            ),
        )
        for row in rows
    ]


def load_flowchart_courses(
    year: int,
    program_years: int,
) -> list[Course]:
    path = flowchart_path(
        year,
        program_years,
    )

    if not path.exists():
        return []

    rows = read_csv_rows(
        path
    )

    courses: list[Course] = []

    seen: set[
        tuple[
            int,
            int,
            str,
        ]
    ] = set()

    for row in rows:
        course = Course(
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
        )

        key = (
            course.grade,
            course.semester,
            exact_normalize(
                course.course_name
            ),
        )

        if key in seen:
            continue

        seen.add(
            key
        )

        courses.append(
            course
        )

    return courses


def build_position_index(
    courses: list[Course],
) -> dict[
    tuple[
        int,
        int,
    ],
    list[Course],
]:
    index: dict[
        tuple[
            int,
            int,
        ],
        list[Course],
    ] = defaultdict(
        list
    )

    for course in courses:
        index[
            (
                course.grade,
                course.semester,
            )
        ].append(
            course
        )

    return dict(
        index
    )


def exact_same_position(
    pdf_course: Course,
    flowchart_courses: list[Course],
) -> bool:
    pdf_name = exact_normalize(
        pdf_course.course_name
    )

    return any(
        (
            candidate.grade
            == pdf_course.grade
            and candidate.semester
            == pdf_course.semester
            and exact_normalize(
                candidate.course_name
            )
            == pdf_name
        )
        for candidate in flowchart_courses
    )


def find_near_candidates(
    pdf_course: Course,
    position_courses: list[Course],
) -> list[NearCandidate]:
    pdf_exact = exact_normalize(
        pdf_course.course_name
    )

    pdf_soft = soft_normalize(
        pdf_course.course_name
    )

    pdf_digits = digit_signature(
        pdf_course.course_name
    )

    candidates: list[
        NearCandidate
    ] = []

    seen_names: set[str] = set()

    for candidate in position_courses:
        candidate_exact = (
            exact_normalize(
                candidate.course_name
            )
        )

        if candidate_exact == pdf_exact:
            continue

        candidate_soft = (
            soft_normalize(
                candidate.course_name
            )
        )

        if (
            digit_signature(
                candidate.course_name
            )
            != pdf_digits
        ):
            continue

        if candidate_soft == pdf_soft:
            match_type = (
                "punctuation_normalized"
            )

            distance = 0

        else:
            distance = (
                levenshtein_distance(
                    pdf_soft,
                    candidate_soft,
                )
            )

            if distance != 1:
                continue

            match_type = (
                "edit_distance_1"
            )

        name_key = (
            exact_normalize(
                candidate.course_name
            )
        )

        if name_key in seen_names:
            continue

        seen_names.add(
            name_key
        )

        candidates.append(
            NearCandidate(
                course_name=(
                    candidate.course_name
                ),
                match_type=(
                    match_type
                ),
                edit_distance=(
                    distance
                ),
            )
        )

    return sorted(
        candidates,
        key=lambda item: (
            item.edit_distance,
            exact_normalize(
                item.course_name
            ),
        ),
    )


def candidate_names(
    candidates: list[
        NearCandidate
    ],
) -> str:
    return ";".join(
        candidate.course_name
        for candidate in candidates
    )


def match_fields(
    candidates: list[
        NearCandidate
    ],
) -> tuple[
    str,
    str,
    str,
    str,
]:
    if len(
        candidates
    ) != 1:
        return (
            "no",
            "",
            "",
            "",
        )

    candidate = (
        candidates[0]
    )

    return (
        "yes",
        candidate.course_name,
        candidate.match_type,
        str(
            candidate.edit_distance
        ),
    )


def analyze_year(
    year: int,
) -> list[
    dict[str, str]
]:
    pdf_courses = load_pdf_courses(
        year
    )

    flowcharts = {
        program_years: (
            load_flowchart_courses(
                year,
                program_years,
            )
        )
        for program_years in PROGRAM_YEARS
    }

    position_indexes = {
        program_years: (
            build_position_index(
                flowcharts[
                    program_years
                ]
            )
        )
        for program_years in PROGRAM_YEARS
    }

    source_available = {
        program_years: (
            flowchart_path(
                year,
                program_years,
            ).exists()
        )
        for program_years in PROGRAM_YEARS
    }

    output_rows: list[
        dict[str, str]
    ] = []

    for pdf_course in pdf_courses:
        exact_matches: dict[
            int,
            bool,
        ] = {}

        candidates_by_program: dict[
            int,
            list[
                NearCandidate
            ],
        ] = {}

        for program_years in (
            PROGRAM_YEARS
        ):
            exact_match = (
                exact_same_position(
                    pdf_course,
                    flowcharts[
                        program_years
                    ],
                )
                if source_available[
                    program_years
                ]
                else False
            )

            exact_matches[
                program_years
            ] = exact_match

            if (
                source_available[
                    program_years
                ]
                and not exact_match
            ):
                candidates = (
                    find_near_candidates(
                        pdf_course,
                        position_indexes[
                            program_years
                        ].get(
                            (
                                pdf_course.grade,
                                pdf_course.semester,
                            ),
                            [],
                        ),
                    )
                )

            else:
                candidates = []

            candidates_by_program[
                program_years
            ] = candidates

        (
            near_4year,
            near_4year_name,
            near_4year_type,
            near_4year_distance,
        ) = match_fields(
            candidates_by_program[
                4
            ]
        )

        (
            near_6year,
            near_6year_name,
            near_6year_type,
            near_6year_distance,
        ) = match_fields(
            candidates_by_program[
                6
            ]
        )

        if (
            exact_matches[4]
            or exact_matches[6]
        ):
            evidence_summary = (
                "exact_evidence_already_exists"
            )

        elif (
            near_4year == "yes"
            and near_6year == "yes"
        ):
            evidence_summary = (
                "near_match_both"
            )

        elif near_4year == "yes":
            evidence_summary = (
                "near_match_4year"
            )

        elif near_6year == "yes":
            evidence_summary = (
                "near_match_6year"
            )

        elif (
            candidates_by_program[4]
            or candidates_by_program[6]
        ):
            evidence_summary = (
                "multiple_near_candidates"
            )

        else:
            evidence_summary = (
                "no_near_match"
            )

        both_sources_available = (
            source_available[4]
            and source_available[6]
        )

        if (
            both_sources_available
            and not exact_matches[4]
            and not exact_matches[6]
            and near_4year == "yes"
            and near_6year == "no"
            and len(
                candidates_by_program[6]
            )
            == 0
        ):
            near_one_sided = (
                "four_year"
            )

        elif (
            both_sources_available
            and not exact_matches[4]
            and not exact_matches[6]
            and near_6year == "yes"
            and near_4year == "no"
            and len(
                candidates_by_program[4]
            )
            == 0
        ):
            near_one_sided = (
                "six_year"
            )

        else:
            near_one_sided = ""

        total_candidates = (
            len(
                candidates_by_program[4]
            )
            + len(
                candidates_by_program[6]
            )
        )

        if near_one_sided:
            review_status = (
                "one_sided_candidate"
            )

        elif (
            near_4year == "yes"
            or near_6year == "yes"
        ):
            review_status = (
                "near_match_candidate"
            )

        elif total_candidates > 0:
            review_status = (
                "multiple_candidates"
            )

        else:
            review_status = (
                "no_candidate"
            )

        output_rows.append(
            {
                "academic_year": (
                    str(
                        year
                    )
                ),
                "grade": (
                    str(
                        pdf_course.grade
                    )
                ),
                "semester": (
                    str(
                        pdf_course.semester
                    )
                ),
                "pdf_course_name": (
                    pdf_course.course_name
                ),
                "pdf_course_code": (
                    pdf_course.course_code
                ),
                "pdf_completion_type": (
                    pdf_course.completion_type
                ),
                "pdf_credits": (
                    pdf_course.credits
                ),
                "4year_source_available": (
                    "yes"
                    if source_available[4]
                    else "no"
                ),
                "4year_exact_same_position": (
                    "yes"
                    if exact_matches[4]
                    else "no"
                ),
                "4year_near_same_position": (
                    near_4year
                ),
                "4year_near_match_name": (
                    near_4year_name
                ),
                "4year_near_match_type": (
                    near_4year_type
                ),
                "4year_near_edit_distance": (
                    near_4year_distance
                ),
                "4year_near_candidate_count": (
                    str(
                        len(
                            candidates_by_program[
                                4
                            ]
                        )
                    )
                ),
                "4year_near_candidates": (
                    candidate_names(
                        candidates_by_program[
                            4
                        ]
                    )
                ),
                "6year_source_available": (
                    "yes"
                    if source_available[6]
                    else "no"
                ),
                "6year_exact_same_position": (
                    "yes"
                    if exact_matches[6]
                    else "no"
                ),
                "6year_near_same_position": (
                    near_6year
                ),
                "6year_near_match_name": (
                    near_6year_name
                ),
                "6year_near_match_type": (
                    near_6year_type
                ),
                "6year_near_edit_distance": (
                    near_6year_distance
                ),
                "6year_near_candidate_count": (
                    str(
                        len(
                            candidates_by_program[
                                6
                            ]
                        )
                    )
                ),
                "6year_near_candidates": (
                    candidate_names(
                        candidates_by_program[
                            6
                        ]
                    )
                ),
                "near_evidence_summary": (
                    evidence_summary
                ),
                "near_one_sided_generation": (
                    near_one_sided
                ),
                "review_status": (
                    review_status
                ),
            }
        )

    return output_rows


def write_csv(
    path: Path,
    rows: list[
        dict[str, str]
    ],
) -> None:
    path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with path.open(
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

        writer.writerows(
            rows
        )


def write_report(
    path: Path,
    rows: list[
        dict[str, str]
    ],
) -> None:
    by_year: dict[
        int,
        list[
            dict[str, str]
        ],
    ] = defaultdict(
        list
    )

    for row in rows:
        by_year[
            int(
                row[
                    "academic_year"
                ]
            )
        ].append(
            row
        )

    candidate_rows = [
        row
        for row in rows
        if row[
            "review_status"
        ]
        in {
            "one_sided_candidate",
            "near_match_candidate",
            "multiple_candidates",
        }
    ]

    one_sided_rows = [
        row
        for row in rows
        if row[
            "review_status"
        ]
        == "one_sided_candidate"
    ]

    lines = [
        "Curriculum near-name match audit",
        "=============================================",
        "",
        (
            "rows analyzed: "
            f"{len(rows)}"
        ),
        (
            "rows with any near candidate: "
            f"{len(candidate_rows)}"
        ),
        (
            "near one-sided candidates: "
            f"{len(one_sided_rows)}"
        ),
    ]

    for year in sorted(
        by_year
    ):
        year_rows = (
            by_year[
                year
            ]
        )

        counts: dict[
            str,
            int,
        ] = defaultdict(
            int
        )

        for row in year_rows:
            counts[
                row[
                    "review_status"
                ]
            ] += 1

        lines.extend(
            [
                "",
                str(
                    year
                ),
                "----",
                (
                    "rows: "
                    f"{len(year_rows)}"
                ),
                (
                    "one_sided_candidate: "
                    f"{counts['one_sided_candidate']}"
                ),
                (
                    "near_match_candidate: "
                    f"{counts['near_match_candidate']}"
                ),
                (
                    "multiple_candidates: "
                    f"{counts['multiple_candidates']}"
                ),
            ]
        )

    lines.extend(
        [
            "",
            "ONE-SIDED CANDIDATES",
            "--------------------",
            (
                "count: "
                f"{len(one_sided_rows)}"
            ),
        ]
    )

    for row in one_sided_rows:
        generation = (
            row[
                "near_one_sided_generation"
            ]
        )

        if generation == "four_year":
            matched_name = (
                row[
                    "4year_near_match_name"
                ]
            )

            match_type = (
                row[
                    "4year_near_match_type"
                ]
            )

            distance = (
                row[
                    "4year_near_edit_distance"
                ]
            )

        else:
            matched_name = (
                row[
                    "6year_near_match_name"
                ]
            )

            match_type = (
                row[
                    "6year_near_match_type"
                ]
            )

            distance = (
                row[
                    "6year_near_edit_distance"
                ]
            )

        lines.append(
            (
                f"{row['academic_year']} "
                f"| {row['grade']}-"
                f"{row['semester']} "
                f"| {row['pdf_course_code']} "
                f"| {row['pdf_course_name']} "
                f"-> {matched_name} "
                f"| generation={generation} "
                f"| type={match_type} "
                f"| distance={distance}"
            )
        )

    other_candidates = [
        row
        for row in candidate_rows
        if row[
            "review_status"
        ]
        != "one_sided_candidate"
    ]

    lines.extend(
        [
            "",
            "OTHER NEAR-MATCH CANDIDATES",
            "---------------------------",
            (
                "count: "
                f"{len(other_candidates)}"
            ),
        ]
    )

    for row in other_candidates:
        lines.append(
            (
                f"{row['academic_year']} "
                f"| {row['grade']}-"
                f"{row['semester']} "
                f"| {row['pdf_course_code']} "
                f"| {row['pdf_course_name']} "
                f"| 4year="
                f"{row['4year_near_candidates'] or '-'} "
                f"| 6year="
                f"{row['6year_near_candidates'] or '-'} "
                f"| status="
                f"{row['review_status']}"
            )
        )

    lines.extend(
        [
            "",
            "Rules",
            "-----",
            (
                "1. Existing exact same-position "
                "matching is not changed."
            ),
            (
                "2. Near-name matching is attempted "
                "only when exact same-position "
                "matching fails for that flowchart."
            ),
            (
                "3. Near-name candidates must be in "
                "the same grade and semester."
            ),
            (
                "4. Whitespace and selected "
                "punctuation differences are ignored "
                "for near-name comparison."
            ),
            (
                "5. Otherwise the normalized names "
                "must have Levenshtein distance 1."
            ),
            (
                "6. Numeric signatures must match "
                "exactly, preventing matches such as "
                "course vs course1 or course4 vs "
                "course5."
            ),
            (
                "7. A near match is accepted only "
                "when exactly one candidate exists "
                "within that flowchart position."
            ),
            (
                "8. near_one_sided_generation is "
                "produced only when both 4-year and "
                "6-year flowchart sources exist."
            ),
            (
                "9. This is diagnostic output only; "
                "it does not change generation "
                "evidence or baseline data."
            ),
            "",
        ]
    )

    path.write_text(
        "\n".join(
            lines
        ),
        encoding="utf-8",
    )


def main() -> None:
    years = available_years()

    if not years:
        raise RuntimeError(
            "분석 가능한 courses.csv가 없습니다."
        )

    rows: list[
        dict[str, str]
    ] = []

    for year in years:
        rows.extend(
            analyze_year(
                year
            )
        )

    csv_path = (
        output_csv_path()
    )

    report_path = (
        output_report_path()
    )

    write_csv(
        csv_path,
        rows,
    )

    write_report(
        report_path,
        rows,
    )

    print()
    print(
        "Curriculum near-name audit"
    )
    print(
        "--------------------------"
    )
    print(
        "source years: "
        + ", ".join(
            str(
                year
            )
            for year in years
        )
    )
    print(
        f"rows:   {len(rows)}"
    )
    print(
        f"audit:  {csv_path}"
    )
    print(
        f"report: {report_path}"
    )


if __name__ == "__main__":
    main()
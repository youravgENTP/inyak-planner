from __future__ import annotations

import argparse
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

GENERATION_FOUR_YEAR = "four_year"
GENERATION_SIX_YEAR = "six_year"
GENERATION_CONFLICT = "conflict"
GENERATION_UNRESOLVED = "unresolved"

EVIDENCE_GRADE_1_2 = "grade_1_2_rule"
EVIDENCE_UNIQUE_4YEAR = "unique_4year_flowchart_match"
EVIDENCE_UNIQUE_6YEAR = "unique_6year_flowchart_match"

OUTPUT_COLUMNS = [
    "course_code",
    "course_names",
    "years_seen",
    "grades_seen",
    "semesters_seen",
    "four_year_anchor_years",
    "six_year_anchor_years",
    "grade_1_2_years",
    "four_year_evidence_count",
    "six_year_evidence_count",
    "anchor_generation",
    "evidence_summary",
]


@dataclass(frozen=True)
class PdfCourse:
    academic_year: int
    grade: int
    semester: int
    course_name: str
    course_code: str


@dataclass(frozen=True)
class FlowchartCourse:
    academic_year: int
    program_years: int
    grade: int
    semester: int
    course_name: str


@dataclass
class CodeEvidence:
    course_code: str
    course_names: set[str]
    years_seen: set[int]
    grades_seen: set[int]
    semesters_seen: set[int]
    four_year_anchor_years: set[int]
    six_year_anchor_years: set[int]
    grade_1_2_years: set[int]


def normalize_course_name(
    course_name: str,
) -> str:
    return re.sub(
        r"\s+",
        "",
        course_name.strip(),
    )


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
        / "curriculum_generation_anchors.csv"
    )


def output_report_path() -> Path:
    return (
        output_directory()
        / "curriculum_generation_anchors_report.txt"
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


def available_years() -> list[int]:
    years: list[int] = []

    for year in SUPPORTED_YEARS:
        if curriculum_path(
            year
        ).exists():
            years.append(
                year
            )

    return years


def load_pdf_courses(
    year: int,
) -> list[PdfCourse]:
    path = curriculum_path(
        year
    )

    rows = read_csv_rows(
        path
    )

    courses: list[
        PdfCourse
    ] = []

    for row in rows:
        course_code = (
            row.get(
                "course_code",
                "",
            ).strip()
        )

        if not course_code:
            continue

        courses.append(
            PdfCourse(
                academic_year=year,
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
                course_code=course_code,
            )
        )

    return courses


def load_flowchart_courses(
    year: int,
    program_years: int,
) -> list[FlowchartCourse]:
    path = flowchart_path(
        year,
        program_years,
    )

    if not path.exists():
        return []

    rows = read_csv_rows(
        path
    )

    courses: list[
        FlowchartCourse
    ] = []

    seen: set[
        tuple[
            int,
            int,
            str,
        ]
    ] = set()

    for row in rows:
        grade = int(
            row["grade"]
        )

        semester = int(
            row["semester"]
        )

        course_name = (
            row[
                "course_name"
            ].strip()
        )

        key = (
            grade,
            semester,
            normalize_course_name(
                course_name
            ),
        )

        if key in seen:
            continue

        seen.add(
            key
        )

        courses.append(
            FlowchartCourse(
                academic_year=year,
                program_years=(
                    program_years
                ),
                grade=grade,
                semester=semester,
                course_name=course_name,
            )
        )

    return courses


def build_pdf_position_index(
    courses: list[PdfCourse],
) -> dict[
    tuple[
        int,
        int,
        str,
    ],
    list[PdfCourse],
]:
    index: dict[
        tuple[
            int,
            int,
            str,
        ],
        list[PdfCourse],
    ] = defaultdict(
        list
    )

    for course in courses:
        key = (
            course.grade,
            course.semester,
            normalize_course_name(
                course.course_name
            ),
        )

        index[
            key
        ].append(
            course
        )

    return dict(
        index
    )


def get_or_create_evidence(
    evidence_by_code: dict[
        str,
        CodeEvidence,
    ],
    course_code: str,
) -> CodeEvidence:
    if course_code not in (
        evidence_by_code
    ):
        evidence_by_code[
            course_code
        ] = CodeEvidence(
            course_code=course_code,
            course_names=set(),
            years_seen=set(),
            grades_seen=set(),
            semesters_seen=set(),
            four_year_anchor_years=set(),
            six_year_anchor_years=set(),
            grade_1_2_years=set(),
        )

    return evidence_by_code[
        course_code
    ]


def register_pdf_observations(
    evidence_by_code: dict[
        str,
        CodeEvidence,
    ],
    pdf_courses: list[PdfCourse],
) -> None:
    for course in pdf_courses:
        evidence = (
            get_or_create_evidence(
                evidence_by_code,
                course.course_code,
            )
        )

        evidence.course_names.add(
            course.course_name
        )

        evidence.years_seen.add(
            course.academic_year
        )

        evidence.grades_seen.add(
            course.grade
        )

        evidence.semesters_seen.add(
            course.semester
        )

        if course.grade in {
            1,
            2,
        }:
            evidence.grade_1_2_years.add(
                course.academic_year
            )


def register_unique_flowchart_anchors(
    evidence_by_code: dict[
        str,
        CodeEvidence,
    ],
    year: int,
    program_years: int,
    pdf_index: dict[
        tuple[
            int,
            int,
            str,
        ],
        list[PdfCourse],
    ],
    flowchart_courses: list[
        FlowchartCourse
    ],
) -> None:
    for flowchart_course in (
        flowchart_courses
    ):
        key = (
            flowchart_course.grade,
            flowchart_course.semester,
            normalize_course_name(
                flowchart_course.course_name
            ),
        )

        candidates = (
            pdf_index.get(
                key,
                [],
            )
        )

        if len(
            candidates
        ) != 1:
            continue

        candidate = (
            candidates[0]
        )

        evidence = (
            get_or_create_evidence(
                evidence_by_code,
                candidate.course_code,
            )
        )

        if program_years == 4:
            evidence.four_year_anchor_years.add(
                year
            )

        elif program_years == 6:
            evidence.six_year_anchor_years.add(
                year
            )


def classify_generation(
    evidence: CodeEvidence,
) -> str:
    has_four_year = bool(
        evidence.four_year_anchor_years
    )

    has_six_year = bool(
        evidence.six_year_anchor_years
        or evidence.grade_1_2_years
    )

    if (
        has_four_year
        and has_six_year
    ):
        return (
            GENERATION_CONFLICT
        )

    if has_four_year:
        return (
            GENERATION_FOUR_YEAR
        )

    if has_six_year:
        return (
            GENERATION_SIX_YEAR
        )

    return (
        GENERATION_UNRESOLVED
    )


def join_ints(
    values: set[int],
) -> str:
    return ";".join(
        str(
            value
        )
        for value in sorted(
            values
        )
    )


def join_strings(
    values: set[str],
) -> str:
    return ";".join(
        sorted(
            values
        )
    )


def build_evidence_summary(
    evidence: CodeEvidence,
) -> str:
    parts: list[str] = []

    if evidence.grade_1_2_years:
        parts.append(
            (
                f"{EVIDENCE_GRADE_1_2}:"
                f"{join_ints(evidence.grade_1_2_years)}"
            )
        )

    if (
        evidence.four_year_anchor_years
    ):
        parts.append(
            (
                f"{EVIDENCE_UNIQUE_4YEAR}:"
                f"{join_ints(evidence.four_year_anchor_years)}"
            )
        )

    if (
        evidence.six_year_anchor_years
    ):
        parts.append(
            (
                f"{EVIDENCE_UNIQUE_6YEAR}:"
                f"{join_ints(evidence.six_year_anchor_years)}"
            )
        )

    return ";".join(
        parts
    )


def build_output_rows(
    evidence_by_code: dict[
        str,
        CodeEvidence,
    ],
) -> list[
    dict[str, str]
]:
    rows: list[
        dict[str, str]
    ] = []

    for course_code in sorted(
        evidence_by_code
    ):
        evidence = (
            evidence_by_code[
                course_code
            ]
        )

        four_count = len(
            evidence.four_year_anchor_years
        )

        six_count = (
            len(
                evidence.six_year_anchor_years
            )
            + len(
                evidence.grade_1_2_years
            )
        )

        rows.append(
            {
                "course_code": (
                    course_code
                ),
                "course_names": (
                    join_strings(
                        evidence.course_names
                    )
                ),
                "years_seen": (
                    join_ints(
                        evidence.years_seen
                    )
                ),
                "grades_seen": (
                    join_ints(
                        evidence.grades_seen
                    )
                ),
                "semesters_seen": (
                    join_ints(
                        evidence.semesters_seen
                    )
                ),
                "four_year_anchor_years": (
                    join_ints(
                        evidence.four_year_anchor_years
                    )
                ),
                "six_year_anchor_years": (
                    join_ints(
                        evidence.six_year_anchor_years
                    )
                ),
                "grade_1_2_years": (
                    join_ints(
                        evidence.grade_1_2_years
                    )
                ),
                "four_year_evidence_count": (
                    str(
                        four_count
                    )
                ),
                "six_year_evidence_count": (
                    str(
                        six_count
                    )
                ),
                "anchor_generation": (
                    classify_generation(
                        evidence
                    )
                ),
                "evidence_summary": (
                    build_evidence_summary(
                        evidence
                    )
                ),
            }
        )

    return rows


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
    years: list[int],
) -> None:
    by_generation: dict[
        str,
        list[
            dict[str, str]
        ],
    ] = defaultdict(
        list
    )

    for row in rows:
        by_generation[
            row[
                "anchor_generation"
            ]
        ].append(
            row
        )

    lines = [
        (
            "Curriculum generation "
            "anchor report"
        ),
        "=============================================",
        "",
        (
            "source years: "
            + ", ".join(
                str(
                    year
                )
                for year in years
            )
        ),
        (
            "course codes observed: "
            f"{len(rows)}"
        ),
        "",
        "Generation summary",
        "------------------",
        (
            "four_year: "
            f"{len(by_generation[GENERATION_FOUR_YEAR])}"
        ),
        (
            "six_year: "
            f"{len(by_generation[GENERATION_SIX_YEAR])}"
        ),
        (
            "conflict: "
            f"{len(by_generation[GENERATION_CONFLICT])}"
        ),
        (
            "unresolved: "
            f"{len(by_generation[GENERATION_UNRESOLVED])}"
        ),
    ]

    for generation in [
        GENERATION_CONFLICT,
        GENERATION_UNRESOLVED,
    ]:
        generation_rows = (
            by_generation[
                generation
            ]
        )

        lines.extend(
            [
                "",
                generation.upper(),
                "-" * len(
                    generation
                ),
                (
                    "count: "
                    f"{len(generation_rows)}"
                ),
            ]
        )

        for row in generation_rows:
            lines.append(
                (
                    f"{row['course_code']} "
                    f"| {row['course_names']} "
                    f"| years="
                    f"{row['years_seen']} "
                    f"| four="
                    f"{row['four_year_anchor_years'] or '-'} "
                    f"| six="
                    f"{row['six_year_anchor_years'] or '-'} "
                    f"| grade1-2="
                    f"{row['grade_1_2_years'] or '-'}"
                )
            )

    lines.extend(
        [
            "",
            "Rules",
            "-----",
            (
                "1. Grade 1-2 PDF rows are "
                "six-year evidence."
            ),
            (
                "2. A flowchart direct anchor is "
                "created only when exactly one PDF "
                "row matches the normalized course "
                "name, grade, and semester."
            ),
            (
                "3. Whitespace is the only "
                "course-name normalization."
            ),
            (
                "4. Course-code prefixes are not "
                "used as generation evidence."
            ),
            (
                "5. Evidence is propagated across "
                "years only through the exact same "
                "course_code."
            ),
            (
                "6. Evidence for both generations "
                "produces conflict; it is not "
                "automatically resolved."
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


def analyze(
    years: list[int],
) -> None:
    evidence_by_code: dict[
        str,
        CodeEvidence,
    ] = {}

    for year in years:
        pdf_courses = (
            load_pdf_courses(
                year
            )
        )

        register_pdf_observations(
            evidence_by_code,
            pdf_courses,
        )

        pdf_index = (
            build_pdf_position_index(
                pdf_courses
            )
        )

        for program_years in (
            PROGRAM_YEARS
        ):
            flowchart_courses = (
                load_flowchart_courses(
                    year,
                    program_years,
                )
            )

            if not flowchart_courses:
                continue

            register_unique_flowchart_anchors(
                evidence_by_code=(
                    evidence_by_code
                ),
                year=year,
                program_years=(
                    program_years
                ),
                pdf_index=pdf_index,
                flowchart_courses=(
                    flowchart_courses
                ),
            )

    rows = build_output_rows(
        evidence_by_code
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
        years,
    )

    print()
    print(
        "Curriculum generation anchors"
    )
    print(
        "-----------------------------"
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
        f"course codes: {len(rows)}"
    )
    print(
        f"anchors: {csv_path}"
    )
    print(
        f"report:  {report_path}"
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "PDF 교육과정과 이수체계도 "
            "직접 매칭을 이용해 course-code "
            "세대 anchor를 생성합니다."
        )
    )

    parser.add_argument(
        "--years",
        nargs="*",
        type=int,
        choices=SUPPORTED_YEARS,
        help=(
            "분석할 학년도. 생략하면 "
            "courses.csv가 실제 존재하는 "
            "연도만 자동 사용합니다."
        ),
    )

    args = parser.parse_args()

    if args.years:
        missing = [
            year
            for year in args.years
            if not curriculum_path(
                year
            ).exists()
        ]

        if missing:
            raise FileNotFoundError(
                (
                    "courses.csv가 없는 학년도: "
                    + ", ".join(
                        str(
                            year
                        )
                        for year in missing
                    )
                )
            )

        years = sorted(
            set(
                args.years
            )
        )

    else:
        years = (
            available_years()
        )

    if not years:
        raise RuntimeError(
            (
                "분석 가능한 curriculum "
                "courses.csv가 없습니다."
            )
        )

    analyze(
        years
    )


if __name__ == "__main__":
    main()
from __future__ import annotations

import csv
import re
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

from scripts.common.data_paths import (
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
    "course_name",
    "course_code",
    "completion_type",
    "credits",
    "pdf_position_group_size",
    "in_4year_flowchart",
    "in_6year_flowchart",
    "grade_1_2_rule",
    "direct_4year_evidence",
    "direct_6year_evidence",
    "generation_evidence",
    "evidence_reason",
    "near_generation_evidence",
    "near_match_name",
    "near_match_type",
    "near_edit_distance",
]


@dataclass(frozen=True)
class PdfCourse:
    academic_year: int
    grade: int
    semester: int
    course_name: str
    course_code: str
    completion_type: str
    credits: str


@dataclass(frozen=True)
class FlowchartKey:
    grade: int
    semester: int
    normalized_name: str


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
    return (
        EXTRACTED_CURRICULUM_FLOWCHARTS_DIR
        / "comparison"
    )


def output_csv_path() -> Path:
    return (
        output_directory()
        / "curriculum_generation_row_evidence.csv"
    )


def output_report_path() -> Path:
    return (
        output_directory()
        / "curriculum_generation_row_evidence_report.txt"
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
    return [
        year
        for year in SUPPORTED_YEARS
        if curriculum_path(
            year
        ).exists()
    ]


def load_pdf_courses(
    year: int,
) -> list[PdfCourse]:
    rows = read_csv_rows(
        curriculum_path(
            year
        )
    )

    courses: list[
        PdfCourse
    ] = []

    for row in rows:
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
        )

    return courses


def load_flowchart_keys(
    year: int,
    program_years: int,
) -> set[FlowchartKey]:
    path = flowchart_path(
        year,
        program_years,
    )

    if not path.exists():
        return set()

    rows = read_csv_rows(
        path
    )

    keys: set[
        FlowchartKey
    ] = set()

    for row in rows:
        keys.add(
            FlowchartKey(
                grade=int(
                    row["grade"]
                ),
                semester=int(
                    row["semester"]
                ),
                normalized_name=(
                    normalize_course_name(
                        row[
                            "course_name"
                        ]
                    )
                ),
            )
        )

    return keys


def near_audit_path() -> Path:
    return (
        output_directory()
        / "curriculum_near_name_audit.csv"
    )


def near_evidence_key(
    course: PdfCourse,
) -> tuple[
    int,
    int,
    int,
    str,
    str,
]:
    return (
        course.academic_year,
        course.grade,
        course.semester,
        course.course_code,
        normalize_course_name(
            course.course_name
        ),
    )


def load_near_evidence_index(
    year: int,
) -> dict[
    tuple[
        int,
        int,
        int,
        str,
        str,
    ],
    dict[str, str],
]:
    path = near_audit_path()

    if not path.exists():
        raise FileNotFoundError(
            "near-name audit 결과가 없습니다: "
            f"{path}\n"
            "먼저 다음 명령을 실행하세요:\n"
            "python -m "
            "scripts.curriculum."
            "audit_curriculum_near_name_matches"
        )

    rows = read_csv_rows(
        path
    )

    index: dict[
        tuple[
            int,
            int,
            int,
            str,
            str,
        ],
        dict[str, str],
    ] = {}

    for row in rows:
        row_year = int(
            row["academic_year"]
        )

        if row_year != year:
            continue

        key = (
            row_year,
            int(
                row["grade"]
            ),
            int(
                row["semester"]
            ),
            row.get(
                "pdf_course_code",
                "",
            ).strip(),
            normalize_course_name(
                row[
                    "pdf_course_name"
                ]
            ),
        )

        index[
            key
        ] = row

    return index


def course_key(
    course: PdfCourse,
) -> FlowchartKey:
    return FlowchartKey(
        grade=course.grade,
        semester=course.semester,
        normalized_name=(
            normalize_course_name(
                course.course_name
            )
        ),
    )


def build_pdf_groups(
    courses: list[PdfCourse],
) -> dict[
    FlowchartKey,
    list[PdfCourse],
]:
    groups: dict[
        FlowchartKey,
        list[PdfCourse],
    ] = defaultdict(
        list
    )

    for course in courses:
        groups[
            course_key(
                course
            )
        ].append(
            course
        )

    return dict(
        groups
    )


def classify_row(
    course: PdfCourse,
    group_size: int,
    in_4year: bool,
    in_6year: bool,
) -> tuple[
    str,
    str,
    bool,
    bool,
    bool,
]:
    grade_1_2_rule = (
        course.grade
        in {
            1,
            2,
        }
    )

    direct_4year = (
        in_4year
        and group_size == 1
    )

    direct_6year = (
        in_6year
        and group_size == 1
    )

    if grade_1_2_rule:
        return (
            "six_year",
            "grade_1_2_rule",
            grade_1_2_rule,
            direct_4year,
            direct_6year,
        )

    if (
        direct_4year
        and direct_6year
    ):
        return (
            "both",
            (
                "unique_pdf_row_matches_"
                "both_flowcharts"
            ),
            grade_1_2_rule,
            direct_4year,
            direct_6year,
        )

    if direct_4year:
        return (
            "four_year",
            (
                "unique_pdf_row_matches_"
                "4year_flowchart"
            ),
            grade_1_2_rule,
            direct_4year,
            direct_6year,
        )

    if direct_6year:
        return (
            "six_year",
            (
                "unique_pdf_row_matches_"
                "6year_flowchart"
            ),
            grade_1_2_rule,
            direct_4year,
            direct_6year,
        )

    if (
        group_size > 1
        and in_4year
        and in_6year
    ):
        return (
            "ambiguous",
            (
                "multiple_pdf_rows_match_"
                "both_flowcharts"
            ),
            grade_1_2_rule,
            direct_4year,
            direct_6year,
        )

    if (
        group_size > 1
        and in_4year
    ):
        return (
            "ambiguous",
            (
                "multiple_pdf_rows_match_"
                "4year_flowchart"
            ),
            grade_1_2_rule,
            direct_4year,
            direct_6year,
        )

    if (
        group_size > 1
        and in_6year
    ):
        return (
            "ambiguous",
            (
                "multiple_pdf_rows_match_"
                "6year_flowchart"
            ),
            grade_1_2_rule,
            direct_4year,
            direct_6year,
        )

    return (
        "unresolved",
        "no_direct_flowchart_evidence",
        grade_1_2_rule,
        direct_4year,
        direct_6year,
    )


def analyze_year(
    year: int,
) -> list[
    dict[str, str]
]:
    courses = load_pdf_courses(
        year
    )

    groups = build_pdf_groups(
        courses
    )

    keys_4year = (
        load_flowchart_keys(
            year,
            4,
        )
    )

    keys_6year = (
        load_flowchart_keys(
            year,
            6,
        )
    )

    near_evidence_index = (
        load_near_evidence_index(
            year
        )
    )

    output_rows: list[
        dict[str, str]
    ] = []

    for course in courses:
        key = course_key(
            course
        )

        group_size = len(
            groups[
                key
            ]
        )

        in_4year = (
            key
            in keys_4year
        )

        in_6year = (
            key
            in keys_6year
        )

        near_evidence = (
            near_evidence_index.get(
                near_evidence_key(
                    course
                )
            )
        )

        (
            generation,
            reason,
            grade_1_2_rule,
            direct_4year,
            direct_6year,
        ) = classify_row(
            course=course,
            group_size=group_size,
            in_4year=in_4year,
            in_6year=in_6year,
        )

        near_generation = ""
        near_match_name = ""
        near_match_type = ""
        near_edit_distance = ""

        if near_evidence:
            near_generation = (
                near_evidence.get(
                    "near_one_sided_generation",
                    "",
                ).strip()
            )

            if near_generation == "four_year":
                near_match_name = (
                    near_evidence.get(
                        "4year_near_match_name",
                        "",
                    ).strip()
                )
                near_match_type = (
                    near_evidence.get(
                        "4year_near_match_type",
                        "",
                    ).strip()
                )
                near_edit_distance = (
                    near_evidence.get(
                        "4year_near_edit_distance",
                        "",
                    ).strip()
                )

            elif near_generation == "six_year":
                near_match_name = (
                    near_evidence.get(
                        "6year_near_match_name",
                        "",
                    ).strip()
                )
                near_match_type = (
                    near_evidence.get(
                        "6year_near_match_type",
                        "",
                    ).strip()
                )
                near_edit_distance = (
                    near_evidence.get(
                        "6year_near_edit_distance",
                        "",
                    ).strip()
                )

        if (
            generation == "unresolved"
            and group_size == 1
            and near_generation
            in {
                "four_year",
                "six_year",
            }
        ):
            generation = (
                near_generation
            )

            reason = (
                "unique_pdf_row_matches_"
                f"{near_generation.replace('_', '')}_"
                "flowchart_near_name"
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
                        course.grade
                    )
                ),
                "semester": (
                    str(
                        course.semester
                    )
                ),
                "course_name": (
                    course.course_name
                ),
                "course_code": (
                    course.course_code
                ),
                "completion_type": (
                    course.completion_type
                ),
                "credits": (
                    course.credits
                ),
                "pdf_position_group_size": (
                    str(
                        group_size
                    )
                ),
                "in_4year_flowchart": (
                    "yes"
                    if in_4year
                    else "no"
                ),
                "in_6year_flowchart": (
                    "yes"
                    if in_6year
                    else "no"
                ),
                "grade_1_2_rule": (
                    "yes"
                    if grade_1_2_rule
                    else "no"
                ),
                "direct_4year_evidence": (
                    "yes"
                    if direct_4year
                    else "no"
                ),
                "direct_6year_evidence": (
                    "yes"
                    if direct_6year
                    else "no"
                ),
                "generation_evidence": (
                    generation
                ),
                "evidence_reason": (
                    reason
                ),
                "near_generation_evidence": (
                    near_generation
                ),
                "near_match_name": (
                    near_match_name
                ),
                "near_match_type": (
                    near_match_type
                ),
                "near_edit_distance": (
                    near_edit_distance
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
    years: list[int],
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

    lines = [
        (
            "Curriculum generation "
            "row-evidence report"
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
            "PDF rows analyzed: "
            f"{len(rows)}"
        ),
    ]

    for year in years:
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
                    "generation_evidence"
                ]
            ] += 1

        lines.extend(
            [
                "",
                f"{year}",
                "----",
                (
                    "rows: "
                    f"{len(year_rows)}"
                ),
                (
                    "four_year: "
                    f"{counts['four_year']}"
                ),
                (
                    "six_year: "
                    f"{counts['six_year']}"
                ),
                (
                    "both: "
                    f"{counts['both']}"
                ),
                (
                    "ambiguous: "
                    f"{counts['ambiguous']}"
                ),
                (
                    "unresolved: "
                    f"{counts['unresolved']}"
                ),
            ]
        )

    ambiguous_rows = [
        row
        for row in rows
        if row[
            "generation_evidence"
        ]
        == "ambiguous"
    ]

    lines.extend(
        [
            "",
            "AMBIGUOUS ROWS",
            "--------------",
            (
                "count: "
                f"{len(ambiguous_rows)}"
            ),
        ]
    )

    for row in ambiguous_rows:
        lines.append(
            (
                f"{row['academic_year']} "
                f"| {row['grade']}-"
                f"{row['semester']} "
                f"| {row['course_code']} "
                f"| {row['course_name']} "
                f"| group="
                f"{row['pdf_position_group_size']} "
                f"| 4year="
                f"{row['in_4year_flowchart']} "
                f"| 6year="
                f"{row['in_6year_flowchart']}"
            )
        )

    unresolved_rows = [
        row
        for row in rows
        if row[
            "generation_evidence"
        ]
        == "unresolved"
    ]

    lines.extend(
        [
            "",
            "UNRESOLVED ROWS",
            "---------------",
            (
                "count: "
                f"{len(unresolved_rows)}"
            ),
        ]
    )

    for row in unresolved_rows:
        lines.append(
            (
                f"{row['academic_year']} "
                f"| {row['grade']}-"
                f"{row['semester']} "
                f"| {row['course_code']} "
                f"| {row['course_name']}"
            )
        )

    lines.extend(
        [
            "",
            "Rules",
            "-----",
            (
                "1. Generation evidence is "
                "attached to each PDF row, "
                "not globally to course_code."
            ),
            (
                "2. Grade 1-2 rows are "
                "six-year by domain rule."
            ),
            (
                "3. A flowchart is direct "
                "generation evidence only when "
                "exactly one PDF row shares "
                "the same normalized name, "
                "grade, and semester."
            ),
            (
                "4. If multiple PDF rows share "
                "one flowchart position, those "
                "rows remain ambiguous."
            ),
            (
                "5. A row directly present in "
                "both flowcharts is classified "
                "as both, not forced into one "
                "generation."
            ),
            (
                "6. No course-code prefix "
                "heuristic is used."
            ),
            (
                "7. No generation evidence is "
                "propagated across academic years."
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
            (
                "분석 가능한 curriculum "
                "courses.csv가 없습니다."
            )
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
        years,
    )

    print()
    print(
        "Curriculum generation row evidence"
    )
    print(
        "----------------------------------"
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
        f"PDF rows: {len(rows)}"
    )
    print(
        f"evidence: {csv_path}"
    )
    print(
        f"report:   {report_path}"
    )


if __name__ == "__main__":
    main()
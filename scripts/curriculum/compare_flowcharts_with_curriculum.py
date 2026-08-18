from __future__ import annotations

import argparse
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
    "pdf_grade",
    "pdf_semester",
    "pdf_course_name",
    "pdf_course_code",
    "pdf_completion_type",
    "pdf_credits",
    "4year_same_position",
    "4year_same_name_elsewhere",
    "4year_positions",
    "6year_same_position",
    "6year_same_name_elsewhere",
    "6year_positions",
    "evidence_summary",
]


@dataclass(frozen=True)
class CoursePosition:
    grade: int
    semester: int
    course_name: str


@dataclass
class FlowchartIndex:
    path: Path
    rows: list[CoursePosition]
    by_name: dict[
        str,
        list[CoursePosition],
    ]
    by_position_and_name: set[
        tuple[
            int,
            int,
            str,
        ]
    ]


def normalize_course_name(
    course_name: str,
) -> str:
    return re.sub(
        r"\s+",
        "",
        course_name.strip(),
    )


def pdf_courses_path(
    year: int,
) -> Path:
    return (
        EXTRACTED_CURRICULUM_DIR
        / str(year)
        / "courses.csv"
    )


def flowchart_courses_path(
    year: int,
    program_years: int,
) -> Path:
    return (
        EXTRACTED_CURRICULUM_FLOWCHARTS_DIR
        / str(year)
        / f"{program_years}year_courses.csv"
    )


def comparison_output_dir() -> Path:
    return (
        EXTRACTED_CURRICULUM_FLOWCHARTS_DIR
        / "comparison"
    )


def comparison_csv_path(
    year: int,
) -> Path:
    return (
        comparison_output_dir()
        / f"{year}_pdf_flowchart_comparison.csv"
    )


def comparison_report_path(
    year: int,
) -> Path:
    return (
        comparison_output_dir()
        / f"{year}_pdf_flowchart_comparison_report.txt"
    )


def read_csv_rows(
    path: Path,
) -> list[dict[str, str]]:
    if not path.exists():
        raise FileNotFoundError(
            f"파일이 없습니다: {path}"
        )

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


def load_flowchart_index(
    path: Path,
) -> FlowchartIndex:
    raw_rows = read_csv_rows(
        path
    )

    rows: list[
        CoursePosition
    ] = []

    by_name: dict[
        str,
        list[CoursePosition],
    ] = defaultdict(
        list
    )

    by_position_and_name: set[
        tuple[
            int,
            int,
            str,
        ]
    ] = set()

    for row in raw_rows:
        course = CoursePosition(
            grade=int(
                row["grade"]
            ),
            semester=int(
                row["semester"]
            ),
            course_name=(
                row["course_name"].strip()
            ),
        )

        normalized_name = (
            normalize_course_name(
                course.course_name
            )
        )

        rows.append(
            course
        )

        by_name[
            normalized_name
        ].append(
            course
        )

        by_position_and_name.add(
            (
                course.grade,
                course.semester,
                normalized_name,
            )
        )

    return FlowchartIndex(
        path=path,
        rows=rows,
        by_name=dict(
            by_name
        ),
        by_position_and_name=(
            by_position_and_name
        ),
    )


def available_flowcharts(
    year: int,
) -> dict[
    int,
    FlowchartIndex,
]:
    indexes: dict[
        int,
        FlowchartIndex,
    ] = {}

    for program_years in (
        PROGRAM_YEARS
    ):
        path = (
            flowchart_courses_path(
                year,
                program_years,
            )
        )

        if not path.exists():
            continue

        indexes[
            program_years
        ] = load_flowchart_index(
            path
        )

    return indexes


def position_text(
    positions: list[
        CoursePosition
    ],
) -> str:
    unique_positions = sorted(
        {
            (
                position.grade,
                position.semester,
            )
            for position in positions
        }
    )

    return ";".join(
        (
            f"{grade}-{semester}"
        )
        for (
            grade,
            semester,
        ) in unique_positions
    )


def evidence_for_program(
    grade: int,
    semester: int,
    course_name: str,
    index: FlowchartIndex | None,
) -> dict[str, str]:
    if index is None:
        return {
            "same_position": "",
            "same_name_elsewhere": "",
            "positions": "",
        }

    normalized_name = (
        normalize_course_name(
            course_name
        )
    )

    same_position = (
        (
            grade,
            semester,
            normalized_name,
        )
        in index.by_position_and_name
    )

    name_matches = (
        index.by_name.get(
            normalized_name,
            [],
        )
    )

    elsewhere = (
        bool(
            name_matches
        )
        and not same_position
    )

    return {
        "same_position": (
            "yes"
            if same_position
            else "no"
        ),
        "same_name_elsewhere": (
            "yes"
            if elsewhere
            else "no"
        ),
        "positions": (
            position_text(
                name_matches
            )
        ),
    }


def evidence_summary(
    evidence_4year: dict[
        str,
        str,
    ],
    evidence_6year: dict[
        str,
        str,
    ],
) -> str:
    same_4 = (
        evidence_4year[
            "same_position"
        ]
        == "yes"
    )

    same_6 = (
        evidence_6year[
            "same_position"
        ]
        == "yes"
    )

    elsewhere_4 = (
        evidence_4year[
            "same_name_elsewhere"
        ]
        == "yes"
    )

    elsewhere_6 = (
        evidence_6year[
            "same_name_elsewhere"
        ]
        == "yes"
    )

    if same_4 and same_6:
        return (
            "same_position_both"
        )

    if same_4:
        return (
            "same_position_4year"
        )

    if same_6:
        return (
            "same_position_6year"
        )

    if (
        elsewhere_4
        and elsewhere_6
    ):
        return (
            "name_elsewhere_both"
        )

    if elsewhere_4:
        return (
            "name_elsewhere_4year"
        )

    if elsewhere_6:
        return (
            "name_elsewhere_6year"
        )

    return "no_flowchart_match"


def build_comparison_rows(
    year: int,
    pdf_rows: list[
        dict[str, str]
    ],
    flowcharts: dict[
        int,
        FlowchartIndex,
    ],
) -> list[
    dict[str, str]
]:
    output_rows: list[
        dict[str, str]
    ] = []

    index_4year = (
        flowcharts.get(
            4
        )
    )

    index_6year = (
        flowcharts.get(
            6
        )
    )

    for row in pdf_rows:
        grade = int(
            row["grade"]
        )

        semester = int(
            row["semester"]
        )

        course_name = (
            row["course_name"].strip()
        )

        evidence_4year = (
            evidence_for_program(
                grade,
                semester,
                course_name,
                index_4year,
            )
        )

        evidence_6year = (
            evidence_for_program(
                grade,
                semester,
                course_name,
                index_6year,
            )
        )

        output_rows.append(
            {
                "academic_year": (
                    str(year)
                ),
                "pdf_grade": (
                    str(grade)
                ),
                "pdf_semester": (
                    str(semester)
                ),
                "pdf_course_name": (
                    course_name
                ),
                "pdf_course_code": (
                    row.get(
                        "course_code",
                        "",
                    )
                ),
                "pdf_completion_type": (
                    row.get(
                        "completion_type",
                        "",
                    )
                ),
                "pdf_credits": (
                    row.get(
                        "credits",
                        "",
                    )
                ),
                "4year_same_position": (
                    evidence_4year[
                        "same_position"
                    ]
                ),
                (
                    "4year_"
                    "same_name_elsewhere"
                ): (
                    evidence_4year[
                        "same_name_elsewhere"
                    ]
                ),
                "4year_positions": (
                    evidence_4year[
                        "positions"
                    ]
                ),
                "6year_same_position": (
                    evidence_6year[
                        "same_position"
                    ]
                ),
                (
                    "6year_"
                    "same_name_elsewhere"
                ): (
                    evidence_6year[
                        "same_name_elsewhere"
                    ]
                ),
                "6year_positions": (
                    evidence_6year[
                        "positions"
                    ]
                ),
                "evidence_summary": (
                    evidence_summary(
                        evidence_4year,
                        evidence_6year,
                    )
                ),
            }
        )

    return output_rows


def write_comparison_csv(
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
            fieldnames=OUTPUT_COLUMNS,
        )

        writer.writeheader()
        writer.writerows(
            rows
        )


def normalized_pdf_keys(
    pdf_rows: list[
        dict[str, str]
    ],
) -> set[
    tuple[
        int,
        int,
        str,
    ]
]:
    return {
        (
            int(
                row["grade"]
            ),
            int(
                row["semester"]
            ),
            normalize_course_name(
                row["course_name"]
            ),
        )
        for row in pdf_rows
    }


def flowchart_only_rows(
    pdf_rows: list[
        dict[str, str]
    ],
    index: FlowchartIndex,
) -> list[
    CoursePosition
]:
    pdf_keys = (
        normalized_pdf_keys(
            pdf_rows
        )
    )

    unmatched: list[
        CoursePosition
    ] = []

    seen: set[
        tuple[
            int,
            int,
            str,
        ]
    ] = set()

    for course in index.rows:
        key = (
            course.grade,
            course.semester,
            normalize_course_name(
                course.course_name
            ),
        )

        if key in pdf_keys:
            continue

        if key in seen:
            continue

        seen.add(
            key
        )

        unmatched.append(
            course
        )

    return unmatched


def write_report(
    path: Path,
    year: int,
    comparison_rows: list[
        dict[str, str]
    ],
    pdf_rows: list[
        dict[str, str]
    ],
    flowcharts: dict[
        int,
        FlowchartIndex,
    ],
) -> None:
    summary_counts: dict[
        str,
        int,
    ] = defaultdict(
        int
    )

    for row in comparison_rows:
        summary_counts[
            row[
                "evidence_summary"
            ]
        ] += 1

    lines = [
        (
            "Curriculum PDF / flowchart "
            "comparison report"
        ),
        "=============================================",
        "",
        f"academic year: {year}",
        (
            "PDF course rows: "
            f"{len(pdf_rows)}"
        ),
        (
            "available flowcharts: "
            + (
                ", ".join(
                    (
                        f"{program_years}year"
                    )
                    for program_years
                    in sorted(
                        flowcharts
                    )
                )
                or "none"
            )
        ),
        "",
        "PDF row evidence summary",
        "------------------------",
    ]

    summary_order = [
        "same_position_both",
        "same_position_4year",
        "same_position_6year",
        "name_elsewhere_both",
        "name_elsewhere_4year",
        "name_elsewhere_6year",
        "no_flowchart_match",
    ]

    for key in summary_order:
        lines.append(
            (
                f"{key}: "
                f"{summary_counts.get(key, 0)}"
            )
        )

    for program_years in sorted(
        flowcharts
    ):
        index = (
            flowcharts[
                program_years
            ]
        )

        flowchart_only = (
            flowchart_only_rows(
                pdf_rows,
                index,
            )
        )

        lines.extend(
            [
                "",
                (
                    f"{program_years}year "
                    "flowchart rows missing "
                    "from PDF at same position"
                ),
                "----------------------------------------",
                (
                    "count: "
                    f"{len(flowchart_only)}"
                ),
            ]
        )

        for course in flowchart_only:
            lines.append(
                (
                    f"{course.grade}-"
                    f"{course.semester} "
                    f"| {course.course_name}"
                )
            )

    review_rows = [
        row
        for row in comparison_rows
        if row[
            "evidence_summary"
        ]
        in {
            "name_elsewhere_both",
            "name_elsewhere_4year",
            "name_elsewhere_6year",
            "no_flowchart_match",
        }
    ]

    lines.extend(
        [
            "",
            "PDF rows requiring review",
            "-------------------------",
            (
                "count: "
                f"{len(review_rows)}"
            ),
        ]
    )

    for row in review_rows:
        lines.append(
            (
                f"{row['pdf_grade']}-"
                f"{row['pdf_semester']} "
                f"| {row['pdf_course_name']} "
                f"| {row['pdf_course_code']} "
                f"| {row['evidence_summary']} "
                f"| 4year="
                f"{row['4year_positions'] or '-'} "
                f"| 6year="
                f"{row['6year_positions'] or '-'}"
            )
        )

    lines.extend(
        [
            "",
            "Notes",
            "-----",
            (
                "Course-name normalization removes "
                "whitespace only."
            ),
            (
                "No fuzzy matching, prefix matching, "
                "or automatic course-name correction "
                "is performed."
            ),
            (
                "same_position means the normalized "
                "course name, grade, and semester "
                "all match."
            ),
            (
                "same_name_elsewhere means the same "
                "normalized name exists in that "
                "flowchart, but not at the PDF "
                "grade/semester."
            ),
            (
                "Flowchart duplicate boxes are "
                "preserved in source CSVs but "
                "deduplicated in the missing-from-PDF "
                "review section."
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


def compare_year(
    year: int,
) -> None:
    pdf_path = (
        pdf_courses_path(
            year
        )
    )

    pdf_rows = read_csv_rows(
        pdf_path
    )

    flowcharts = (
        available_flowcharts(
            year
        )
    )

    if not flowcharts:
        raise RuntimeError(
            (
                f"{year}: 비교 가능한 "
                "이수체계도 CSV가 없습니다."
            )
        )

    comparison_rows = (
        build_comparison_rows(
            year,
            pdf_rows,
            flowcharts,
        )
    )

    csv_path = (
        comparison_csv_path(
            year
        )
    )

    report_path = (
        comparison_report_path(
            year
        )
    )

    write_comparison_csv(
        csv_path,
        comparison_rows,
    )

    write_report(
        report_path,
        year,
        comparison_rows,
        pdf_rows,
        flowcharts,
    )

    print()
    print(
        f"===== {year} ====="
    )
    print(
        f"PDF rows: {len(pdf_rows)}"
    )
    print(
        "flowcharts: "
        + ", ".join(
            (
                f"{program_years}year"
            )
            for program_years
            in sorted(
                flowcharts
            )
        )
    )
    print(
        f"comparison: {csv_path}"
    )
    print(
        f"report:     {report_path}"
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "PDF에서 추출한 교육과정 "
            "courses.csv와 교과이수체계도 "
            "CSV를 비교합니다."
        )
    )

    parser.add_argument(
        "--year",
        type=int,
        choices=SUPPORTED_YEARS,
        help=(
            "특정 학년도만 비교합니다. "
            "생략하면 2022~2026을 "
            "모두 비교합니다."
        ),
    )

    args = parser.parse_args()

    years = (
        [
            args.year
        ]
        if args.year
        is not None
        else SUPPORTED_YEARS
    )

    for year in years:
        compare_year(
            year
        )


if __name__ == "__main__":
    main()
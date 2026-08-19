
import argparse
import csv
import re
from collections import Counter, defaultdict
from pathlib import Path

from scripts.common.data_paths import (
    CURRICULUM_BASELINE_DIR,
    CURRICULUM_REVIEW_DIR,
    EXTRACTED_CURRICULUM_FLOWCHARTS_DIR,
)


OUTPUT_COLUMNS = [
    "entry_year",
    "status",
    "course_name",
    "normalized_course_name",
    "baseline_grade",
    "baseline_semester",
    "baseline_course_code",
    "baseline_completion_type",
    "baseline_credits",
    "flowchart_grade",
    "flowchart_semester",
    "flowchart_course_name",
    "reason",
]


STATUS_ORDER = {
    "FLOWCHART_ONLY": 0,
    "POSITION_MISMATCH": 1,
    "BASELINE_ONLY": 2,
    "MATCH": 3,
}


def baseline_directory() -> Path:
    return (
        CURRICULUM_BASELINE_DIR
        / "curriculum"
    )


def output_directory() -> Path:
    return (
        CURRICULUM_REVIEW_DIR
        / "baseline_flowchart_audit"
    )


def baseline_path(
    year: int,
) -> Path:
    return (
        baseline_directory()
        / f"curriculum_{year}.csv"
    )


def flowchart_path(
    year: int,
) -> Path:
    return (
        EXTRACTED_CURRICULUM_FLOWCHARTS_DIR
        / str(year)
        / "6year_courses.csv"
    )


def output_csv_path() -> Path:
    return (
        output_directory()
        / "baseline_flowchart_audit.csv"
    )


def output_report_path() -> Path:
    return (
        output_directory()
        / "baseline_flowchart_audit_report.txt"
    )


def normalize_course_name(
    value: str,
) -> str:
    """
    보수적 이름 정규화.

    현재는 모든 공백만 제거한다.

    예:
      약학기 초화학1
      약학기초화학1

    위 두 이름은 동일하게 비교한다.

    fuzzy matching은 하지 않는다.
    """

    return re.sub(
        r"\s+",
        "",
        value.strip(),
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


def write_csv(
    path: Path,
    rows: list[dict[str, str]],
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


def available_baseline_years() -> list[int]:
    years: list[int] = []

    for path in baseline_directory().glob(
        "curriculum_*.csv"
    ):
        match = re.fullmatch(
            r"curriculum_(\d{4})\.csv",
            path.name,
        )

        if not match:
            continue

        years.append(
            int(
                match.group(1)
            )
        )

    return sorted(
        years
    )


def unique_flowchart_rows(
    rows: list[dict[str, str]],
) -> list[dict[str, str]]:
    """
    이수체계도 OCR 결과에 동일한
    과목명/학년/학기 행이 중복되어 있어도
    audit 결과에서는 한 번만 취급한다.
    """

    seen: set[
        tuple[str, str, str]
    ] = set()

    result: list[
        dict[str, str]
    ] = []

    for row in rows:
        key = (
            normalize_course_name(
                row.get(
                    "course_name",
                    "",
                )
            ),
            row.get(
                "grade",
                "",
            ).strip(),
            row.get(
                "semester",
                "",
            ).strip(),
        )

        if not key[0]:
            continue

        if key in seen:
            continue

        seen.add(
            key
        )

        result.append(
            row
        )

    return result


def build_flowchart_name_index(
    rows: list[dict[str, str]],
) -> dict[
    str,
    list[dict[str, str]],
]:
    index: dict[
        str,
        list[dict[str, str]],
    ] = defaultdict(
        list
    )

    for row in rows:
        normalized_name = (
            normalize_course_name(
                row.get(
                    "course_name",
                    "",
                )
            )
        )

        if not normalized_name:
            continue

        index[
            normalized_name
        ].append(
            row
        )

    return dict(
        index
    )


def blank_output_row() -> dict[str, str]:
    return {
        column: ""
        for column
        in OUTPUT_COLUMNS
    }


def audit_year(
    year: int,
) -> list[dict[str, str]]:
    baseline_file = (
        baseline_path(
            year
        )
    )

    flowchart_file = (
        flowchart_path(
            year
        )
    )

    if not baseline_file.exists():
        raise FileNotFoundError(
            f"Baseline not found: "
            f"{baseline_file}"
        )

    if not flowchart_file.exists():
        raise FileNotFoundError(
            f"6-year flowchart not found: "
            f"{flowchart_file}"
        )

    baseline_rows = (
        read_csv_rows(
            baseline_file
        )
    )

    flowchart_rows = (
        unique_flowchart_rows(
            read_csv_rows(
                flowchart_file
            )
        )
    )

    flowchart_name_index = (
        build_flowchart_name_index(
            flowchart_rows
        )
    )

    matched_flowchart_keys: set[
        tuple[str, str, str]
    ] = set()

    output_rows: list[
        dict[str, str]
    ] = []

    for baseline_row in baseline_rows:
        course_name = (
            baseline_row.get(
                "course_name",
                "",
            ).strip()
        )

        normalized_name = (
            normalize_course_name(
                course_name
            )
        )

        baseline_grade = (
            baseline_row.get(
                "grade",
                "",
            ).strip()
        )

        baseline_semester = (
            baseline_row.get(
                "semester",
                "",
            ).strip()
        )

        candidates = (
            flowchart_name_index.get(
                normalized_name,
                [],
            )
        )

        same_position_candidates = [
            row
            for row in candidates
            if (
                row.get(
                    "grade",
                    "",
                ).strip()
                == baseline_grade
                and row.get(
                    "semester",
                    "",
                ).strip()
                == baseline_semester
            )
        ]

        if same_position_candidates:
            flowchart_row = (
                same_position_candidates[0]
            )

            matched_flowchart_keys.add(
                (
                    normalized_name,
                    baseline_grade,
                    baseline_semester,
                )
            )

            output = (
                blank_output_row()
            )

            output.update(
                {
                    "entry_year": str(year),
                    "status": "MATCH",
                    "course_name": course_name,
                    "normalized_course_name": normalized_name,
                    "baseline_grade": baseline_grade,
                    "baseline_semester": baseline_semester,
                    "baseline_course_code": baseline_row.get(
                        "course_code",
                        "",
                    ).strip(),
                    "baseline_completion_type": baseline_row.get(
                        "completion_type",
                        "",
                    ).strip(),
                    "baseline_credits": baseline_row.get(
                        "credits",
                        "",
                    ).strip(),
                    "flowchart_grade": flowchart_row.get(
                        "grade",
                        "",
                    ).strip(),
                    "flowchart_semester": flowchart_row.get(
                        "semester",
                        "",
                    ).strip(),
                    "flowchart_course_name": flowchart_row.get(
                        "course_name",
                        "",
                    ).strip(),
                    "reason": (
                        "same_name_same_position"
                    ),
                }
            )

            output_rows.append(
                output
            )

            continue

        if candidates:
            positions = sorted(
                {
                    (
                        row.get(
                            "grade",
                            "",
                        ).strip(),
                        row.get(
                            "semester",
                            "",
                        ).strip(),
                    )
                    for row
                    in candidates
                }
            )

            for candidate in candidates:
                matched_flowchart_keys.add(
                    (
                        normalized_name,
                        candidate.get(
                            "grade",
                            "",
                        ).strip(),
                        candidate.get(
                            "semester",
                            "",
                        ).strip(),
                    )
                )

            output = (
                blank_output_row()
            )

            output.update(
                {
                    "entry_year": str(year),
                    "status": "POSITION_MISMATCH",
                    "course_name": course_name,
                    "normalized_course_name": normalized_name,
                    "baseline_grade": baseline_grade,
                    "baseline_semester": baseline_semester,
                    "baseline_course_code": baseline_row.get(
                        "course_code",
                        "",
                    ).strip(),
                    "baseline_completion_type": baseline_row.get(
                        "completion_type",
                        "",
                    ).strip(),
                    "baseline_credits": baseline_row.get(
                        "credits",
                        "",
                    ).strip(),
                    "flowchart_grade": ";".join(
                        grade
                        for grade, _
                        in positions
                    ),
                    "flowchart_semester": ";".join(
                        semester
                        for _, semester
                        in positions
                    ),
                    "flowchart_course_name": ";".join(
                        sorted(
                            {
                                row.get(
                                    "course_name",
                                    "",
                                ).strip()
                                for row
                                in candidates
                            }
                        )
                    ),
                    "reason": (
                        "same_name_different_position"
                    ),
                }
            )

            output_rows.append(
                output
            )

            continue

        output = (
            blank_output_row()
        )

        output.update(
            {
                "entry_year": str(year),
                "status": "BASELINE_ONLY",
                "course_name": course_name,
                "normalized_course_name": normalized_name,
                "baseline_grade": baseline_grade,
                "baseline_semester": baseline_semester,
                "baseline_course_code": baseline_row.get(
                    "course_code",
                    "",
                ).strip(),
                "baseline_completion_type": baseline_row.get(
                    "completion_type",
                    "",
                ).strip(),
                "baseline_credits": baseline_row.get(
                    "credits",
                    "",
                ).strip(),
                "reason": (
                    "course_not_present_in_"
                    "6year_flowchart"
                ),
            }
        )

        output_rows.append(
            output
        )

    for flowchart_row in flowchart_rows:
        normalized_name = (
            normalize_course_name(
                flowchart_row.get(
                    "course_name",
                    "",
                )
            )
        )

        grade = (
            flowchart_row.get(
                "grade",
                "",
            ).strip()
        )

        semester = (
            flowchart_row.get(
                "semester",
                "",
            ).strip()
        )

        key = (
            normalized_name,
            grade,
            semester,
        )

        if key in matched_flowchart_keys:
            continue

        output = (
            blank_output_row()
        )

        output.update(
            {
                "entry_year": str(year),
                "status": "FLOWCHART_ONLY",
                "course_name": flowchart_row.get(
                    "course_name",
                    "",
                ).strip(),
                "normalized_course_name": normalized_name,
                "flowchart_grade": grade,
                "flowchart_semester": semester,
                "flowchart_course_name": flowchart_row.get(
                    "course_name",
                    "",
                ).strip(),
                "reason": (
                    "6year_flowchart_course_not_"
                    "present_in_baseline"
                ),
            }
        )

        output_rows.append(
            output
        )

    return output_rows


def sort_output_rows(
    rows: list[dict[str, str]],
) -> list[dict[str, str]]:
    def numeric_value(
        value: str,
    ) -> int:
        try:
            return int(
                value
            )
        except ValueError:
            return 99

    return sorted(
        rows,
        key=lambda row: (
            int(
                row[
                    "entry_year"
                ]
            ),
            STATUS_ORDER.get(
                row[
                    "status"
                ],
                99,
            ),
            numeric_value(
                row[
                    "baseline_grade"
                ]
                or row[
                    "flowchart_grade"
                ]
            ),
            numeric_value(
                row[
                    "baseline_semester"
                ]
                or row[
                    "flowchart_semester"
                ]
            ),
            row[
                "normalized_course_name"
            ],
        ),
    )


def write_report(
    path: Path,
    rows: list[dict[str, str]],
    years: list[int],
) -> None:
    path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    rows_by_year: dict[
        int,
        list[dict[str, str]],
    ] = defaultdict(
        list
    )

    for row in rows:
        rows_by_year[
            int(
                row[
                    "entry_year"
                ]
            )
        ].append(
            row
        )

    lines: list[str] = [
        "Baseline vs 6-year curriculum flowchart audit",
        "=" * 48,
        "",
        "Comparison rules:",
        "- baseline = historical entry-year curriculum",
        "- flowchart absence does NOT prove a baseline error",
        "- FLOWCHART_ONLY is a possible baseline omission",
        "- POSITION_MISMATCH requires review",
        "- course names are compared after whitespace removal only",
        "- no fuzzy matching is used",
        "",
    ]

    for year in years:
        year_rows = (
            rows_by_year.get(
                year,
                [],
            )
        )

        counts = Counter(
            row[
                "status"
            ]
            for row
            in year_rows
        )

        lines.extend(
            [
                str(year),
                "-" * 48,
                f"MATCH: {counts['MATCH']}",
                (
                    "POSITION_MISMATCH: "
                    f"{counts['POSITION_MISMATCH']}"
                ),
                (
                    "BASELINE_ONLY: "
                    f"{counts['BASELINE_ONLY']}"
                ),
                (
                    "FLOWCHART_ONLY: "
                    f"{counts['FLOWCHART_ONLY']}"
                ),
                "",
            ]
        )

        for status in [
            "FLOWCHART_ONLY",
            "POSITION_MISMATCH",
        ]:
            problem_rows = [
                row
                for row in year_rows
                if row[
                    "status"
                ]
                == status
            ]

            lines.append(
                status
            )

            if not problem_rows:
                lines.append(
                    "(none)"
                )
                lines.append(
                    ""
                )
                continue

            for row in problem_rows:
                if (
                    status
                    == "FLOWCHART_ONLY"
                ):
                    lines.append(
                        (
                            f"- "
                            f"{row['flowchart_grade']}-"
                            f"{row['flowchart_semester']} "
                            f"{row['flowchart_course_name']}"
                        )
                    )

                else:
                    lines.append(
                        (
                            f"- {row['course_name']} | "
                            f"baseline="
                            f"{row['baseline_grade']}-"
                            f"{row['baseline_semester']} | "
                            f"flowchart="
                            f"{row['flowchart_grade']}-"
                            f"{row['flowchart_semester']}"
                        )
                    )

            lines.append(
                ""
            )

    with path.open(
        "w",
        encoding="utf-8",
    ) as file:
        file.write(
            "\n".join(
                lines
            )
        )

        file.write(
            "\n"
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Audit historical curriculum baselines "
            "against same-year 6-year curriculum flowcharts."
        )
    )

    parser.add_argument(
        "--years",
        nargs="+",
        type=int,
        help=(
            "Years to audit. "
            "If omitted, all available baseline years are used."
        ),
    )

    return parser.parse_args()


def main() -> None:
    args = (
        parse_args()
    )

    years = (
        sorted(
            set(
                args.years
            )
        )
        if args.years
        else available_baseline_years()
    )

    if not years:
        raise SystemExit(
            "No baseline years found."
        )

    all_rows: list[
        dict[str, str]
    ] = []

    for year in years:
        print(
            f"[audit] {year}"
        )

        rows = (
            audit_year(
                year
            )
        )

        all_rows.extend(
            rows
        )

    all_rows = (
        sort_output_rows(
            all_rows
        )
    )

    write_csv(
        output_csv_path(),
        all_rows,
    )

    write_report(
        output_report_path(),
        all_rows,
        years,
    )

    print()
    print(
        f"CSV: {output_csv_path()}"
    )
    print(
        f"Report: {output_report_path()}"
    )

    counts = Counter(
        row[
            "status"
        ]
        for row
        in all_rows
    )

    print()
    print(
        f"MATCH: {counts['MATCH']}"
    )
    print(
        "POSITION_MISMATCH: "
        f"{counts['POSITION_MISMATCH']}"
    )
    print(
        "BASELINE_ONLY: "
        f"{counts['BASELINE_ONLY']}"
    )
    print(
        "FLOWCHART_ONLY: "
        f"{counts['FLOWCHART_ONLY']}"
    )


if __name__ == "__main__":
    main()
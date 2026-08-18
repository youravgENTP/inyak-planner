from __future__ import annotations

import csv
import re
from collections import defaultdict
from pathlib import Path

from scripts.common.data_paths import (
    EXTRACTED_CURRICULUM_DIR,
    EXTRACTED_CURRICULUM_FLOWCHARTS_DIR,
)


TARGET_YEARS = [
    2022,
    2023,
    2024,
]

COURSE_COLUMNS = [
    "entry_year",
    "grade",
    "semester",
    "course_name",
    "course_code",
    "completion_type",
    "credits",
    "notes",
    "change_group",
    "change_type",
    "change_role",
    "change_effective_year",
    "change_note",
    "previous_credits",
    "previous_completion_type",
    "previous_grade",
    "previous_semester",
    "attribute_change_effective_year",
    "attribute_change_note",
]

EXCLUDED_COLUMNS = (
    COURSE_COLUMNS
    + [
        "decision_status",
        "provisional_generation",
        "decision_reason",
        "generation_evidence",
        "generation_evidence_reason",
        "lineage_candidate",
        "lineage_pair_status",
        "lineage_reason",
        "continuity_candidate",
        "continuity_strength",
        "continuity_status",
        "continuity_reason",
        "official_relation",
        "relation_types",
        "relation_counterpart_codes",
        "relation_counterpart_names",
    ]
)


def comparison_directory() -> Path:
    return (
        EXTRACTED_CURRICULUM_FLOWCHARTS_DIR
        / "comparison"
    )


def decisions_path() -> Path:
    return (
        comparison_directory()
        / "curriculum_generation_decisions.csv"
    )


def preview_directory() -> Path:
    return (
        comparison_directory()
        / "curriculum_generation_baseline_preview"
    )


def preview_report_path() -> Path:
    return (
        preview_directory()
        / "baseline_preview_report.txt"
    )


def source_courses_path(
    year: int,
) -> Path:
    return (
        EXTRACTED_CURRICULUM_DIR
        / str(year)
        / "courses.csv"
    )


def year_preview_directory(
    year: int,
) -> Path:
    return (
        preview_directory()
        / str(year)
    )


def four_year_path(
    year: int,
) -> Path:
    return (
        year_preview_directory(year)
        / "four_year_courses.csv"
    )


def six_year_path(
    year: int,
) -> Path:
    return (
        year_preview_directory(year)
        / "six_year_courses.csv"
    )


def excluded_path(
    year: int,
) -> Path:
    return (
        year_preview_directory(year)
        / "excluded_courses.csv"
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
            csv.DictReader(file)
        )


def normalize_course_name(
    text: str,
) -> str:
    return re.sub(
        r"\s+",
        "",
        text.strip(),
    )


def decision_key(
    year: int,
    row: dict[str, str],
) -> tuple[
    int,
    int,
    int,
    str,
    str,
]:
    return (
        year,
        int(row["grade"]),
        int(row["semester"]),
        row.get(
            "course_code",
            "",
        ).strip(),
        normalize_course_name(
            row.get(
                "course_name",
                "",
            )
        ),
    )


def build_decision_index(
    rows: list[dict[str, str]],
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
        year = int(
            row["academic_year"]
        )

        if year not in TARGET_YEARS:
            continue

        key = decision_key(
            year,
            row,
        )

        if key in index:
            raise RuntimeError(
                "decision key 중복: "
                f"{key}"
            )

        index[key] = row

    return index


def validate_course_schema(
    path: Path,
) -> None:
    with path.open(
        "r",
        encoding="utf-8-sig",
        newline="",
    ) as file:
        reader = csv.DictReader(file)

        actual = (
            reader.fieldnames
            or []
        )

    if actual != COURSE_COLUMNS:
        raise RuntimeError(
            "courses.csv 스키마가 "
            "예상한 19개 컬럼과 다릅니다.\n"
            f"path: {path}\n"
            f"expected: {COURSE_COLUMNS}\n"
            f"actual:   {actual}"
        )


def copy_course_columns(
    row: dict[str, str],
) -> dict[str, str]:
    return {
        column: row.get(
            column,
            "",
        )
        for column in COURSE_COLUMNS
    }


def make_excluded_row(
    course: dict[str, str],
    decision: dict[str, str] | None,
    reason_override: str = "",
) -> dict[str, str]:
    output = {
        column: course.get(
            column,
            "",
        )
        for column in COURSE_COLUMNS
    }

    diagnostic_columns = [
        "decision_status",
        "provisional_generation",
        "decision_reason",
        "generation_evidence",
        "generation_evidence_reason",
        "lineage_candidate",
        "lineage_pair_status",
        "lineage_reason",
        "continuity_candidate",
        "continuity_strength",
        "continuity_status",
        "continuity_reason",
        "official_relation",
        "relation_types",
        "relation_counterpart_codes",
        "relation_counterpart_names",
    ]

    for column in diagnostic_columns:
        output[column] = (
            decision.get(
                column,
                "",
            )
            if decision
            else ""
        )

    if reason_override:
        output[
            "decision_reason"
        ] = reason_override

    return output


def write_csv(
    path: Path,
    fieldnames: list[str],
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
            fieldnames=fieldnames,
        )

        writer.writeheader()
        writer.writerows(rows)


def credit_total(
    rows: list[dict[str, str]],
) -> float:
    total = 0.0

    for row in rows:
        value = (
            row.get(
                "credits",
                "",
            ).strip()
        )

        if not value:
            continue

        total += float(value)

    return total


def format_credits(
    value: float,
) -> str:
    if value.is_integer():
        return str(
            int(value)
        )

    return (
        f"{value:g}"
    )


def is_includable(
    decision: dict[str, str],
) -> bool:
    status = (
        decision.get(
            "decision_status",
            "",
        ).strip()
    )

    generation = (
        decision.get(
            "provisional_generation",
            "",
        ).strip()
    )

    return (
        status
        in {
            "confirmed",
            "probable",
        }
        and generation
        in {
            "four_year",
            "six_year",
            "both",
        }
    )


def analyze_year(
    year: int,
    decision_index: dict[
        tuple[
            int,
            int,
            int,
            str,
            str,
        ],
        dict[str, str],
    ],
) -> tuple[
    list[dict[str, str]],
    list[dict[str, str]],
    list[dict[str, str]],
]:
    source_path = (
        source_courses_path(year)
    )

    validate_course_schema(
        source_path
    )

    source_rows = read_csv_rows(
        source_path
    )

    four_year_rows: list[
        dict[str, str]
    ] = []

    six_year_rows: list[
        dict[str, str]
    ] = []

    excluded_rows: list[
        dict[str, str]
    ] = []

    matched_decision_keys: set[
        tuple[
            int,
            int,
            int,
            str,
            str,
        ]
    ] = set()

    for course in source_rows:
        key = decision_key(
            year,
            course,
        )

        decision = (
            decision_index.get(
                key
            )
        )

        if decision is None:
            excluded_rows.append(
                make_excluded_row(
                    course=course,
                    decision=None,
                    reason_override=(
                        "missing_generation_decision"
                    ),
                )
            )
            continue

        matched_decision_keys.add(
            key
        )

        if not is_includable(
            decision
        ):
            excluded_rows.append(
                make_excluded_row(
                    course=course,
                    decision=decision,
                )
            )
            continue

        generation = (
            decision[
                "provisional_generation"
            ].strip()
        )

        clean_course = (
            copy_course_columns(
                course
            )
        )

        if generation in {
            "four_year",
            "both",
        }:
            four_year_rows.append(
                clean_course.copy()
            )

        if generation in {
            "six_year",
            "both",
        }:
            six_year_rows.append(
                clean_course.copy()
            )

    expected_decision_keys = {
        key
        for key in decision_index
        if key[0] == year
    }

    unmatched_decisions = (
        expected_decision_keys
        - matched_decision_keys
    )

    if unmatched_decisions:
        formatted = "\n".join(
            str(key)
            for key
            in sorted(
                unmatched_decisions
            )
        )

        raise RuntimeError(
            "decision에는 있지만 원본 "
            "courses.csv에서 찾지 못한 행이 있습니다:\n"
            f"{formatted}"
        )

    return (
        four_year_rows,
        six_year_rows,
        excluded_rows,
    )


def write_report(
    path: Path,
    results: dict[
        int,
        tuple[
            list[dict[str, str]],
            list[dict[str, str]],
            list[dict[str, str]],
        ],
    ],
) -> None:
    lines = [
        (
            "Curriculum generation "
            "baseline preview report"
        ),
        "=============================================",
        "",
        (
            "This is a diagnostic preview only."
        ),
        (
            "No data/baseline, seed, or DB data "
            "is modified."
        ),
        "",
    ]

    total_four_rows = 0
    total_six_rows = 0
    total_excluded_rows = 0

    for year in TARGET_YEARS:
        (
            four_year_rows,
            six_year_rows,
            excluded_rows,
        ) = results[year]

        four_credits = credit_total(
            four_year_rows
        )

        six_credits = credit_total(
            six_year_rows
        )

        excluded_credits = (
            credit_total(
                excluded_rows
            )
        )

        total_four_rows += len(
            four_year_rows
        )

        total_six_rows += len(
            six_year_rows
        )

        total_excluded_rows += len(
            excluded_rows
        )

        status_counts: dict[
            str,
            int,
        ] = defaultdict(int)

        for row in excluded_rows:
            status = (
                row.get(
                    "decision_status",
                    "",
                ).strip()
                or "missing_decision"
            )

            status_counts[
                status
            ] += 1

        lines.extend(
            [
                str(year),
                "----",
                (
                    "four_year: "
                    f"{len(four_year_rows)} rows, "
                    f"{format_credits(four_credits)} credits"
                ),
                (
                    "six_year: "
                    f"{len(six_year_rows)} rows, "
                    f"{format_credits(six_credits)} credits"
                ),
                (
                    "excluded: "
                    f"{len(excluded_rows)} rows, "
                    f"{format_credits(excluded_credits)} credits"
                ),
                (
                    "excluded paired_unknown: "
                    f"{status_counts['paired_unknown']}"
                ),
                (
                    "excluded conflict: "
                    f"{status_counts['conflict']}"
                ),
                (
                    "excluded unresolved: "
                    f"{status_counts['unresolved']}"
                ),
                (
                    "excluded missing_decision: "
                    f"{status_counts['missing_decision']}"
                ),
                "",
            ]
        )

    lines.extend(
        [
            "TOTAL",
            "-----",
            (
                "four_year preview rows: "
                f"{total_four_rows}"
            ),
            (
                "six_year preview rows: "
                f"{total_six_rows}"
            ),
            (
                "excluded source rows: "
                f"{total_excluded_rows}"
            ),
            "",
            "Inclusion rules",
            "---------------",
            (
                "1. confirmed four_year -> "
                "four-year preview."
            ),
            (
                "2. confirmed six_year -> "
                "six-year preview."
            ),
            (
                "3. confirmed both -> "
                "both previews."
            ),
            (
                "4. probable rows are included only "
                "in their provisional generation."
            ),
            (
                "5. paired_unknown, conflict, and "
                "unresolved rows are excluded."
            ),
            (
                "6. No opposite-generation partner "
                "is inferred from a probable row."
            ),
            (
                "7. Included preview CSVs retain "
                "the exact 19-column extracted "
                "courses.csv schema."
            ),
            (
                "8. entry_year is not populated or "
                "changed by this preview."
            ),
            "",
        ]
    )

    path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    path.write_text(
        "\n".join(lines),
        encoding="utf-8",
    )


def validate_sources() -> None:
    required = [
        decisions_path(),
    ]

    required.extend(
        source_courses_path(year)
        for year in TARGET_YEARS
    )

    missing = [
        path
        for path in required
        if not path.exists()
    ]

    if missing:
        formatted = "\n".join(
            f"  - {path}"
            for path in missing
        )

        raise FileNotFoundError(
            "필요한 파일이 없습니다:\n"
            f"{formatted}"
        )


def main() -> None:
    validate_sources()

    decisions = read_csv_rows(
        decisions_path()
    )

    decision_index = (
        build_decision_index(
            decisions
        )
    )

    results: dict[
        int,
        tuple[
            list[dict[str, str]],
            list[dict[str, str]],
            list[dict[str, str]],
        ],
    ] = {}

    for year in TARGET_YEARS:
        (
            four_year_rows,
            six_year_rows,
            excluded_rows,
        ) = analyze_year(
            year=year,
            decision_index=(
                decision_index
            ),
        )

        results[year] = (
            four_year_rows,
            six_year_rows,
            excluded_rows,
        )

        write_csv(
            four_year_path(year),
            COURSE_COLUMNS,
            four_year_rows,
        )

        write_csv(
            six_year_path(year),
            COURSE_COLUMNS,
            six_year_rows,
        )

        write_csv(
            excluded_path(year),
            EXCLUDED_COLUMNS,
            excluded_rows,
        )

    write_report(
        preview_report_path(),
        results,
    )

    print()
    print(
        "Curriculum generation "
        "baseline preview"
    )
    print(
        "--------------------------------------"
    )

    for year in TARGET_YEARS:
        (
            four_year_rows,
            six_year_rows,
            excluded_rows,
        ) = results[year]

        print(
            f"{year}: "
            f"four={len(four_year_rows)}, "
            f"six={len(six_year_rows)}, "
            f"excluded={len(excluded_rows)}"
        )

    print()
    print(
        f"preview: {preview_directory()}"
    )
    print(
        f"report:  {preview_report_path()}"
    )


if __name__ == "__main__":
    main()
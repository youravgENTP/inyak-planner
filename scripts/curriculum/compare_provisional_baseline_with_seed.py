from __future__ import annotations

import csv
import re
from collections import Counter
from pathlib import Path

from scripts.common.data_paths import (
    CURRICULUM_SEED_DIR,
    EXTRACTED_CURRICULUM_FLOWCHARTS_DIR,
)


TARGET_YEARS = [
    2022,
    2023,
    2024,
]

CORE_COLUMNS = [
    "grade",
    "semester",
    "course_name",
    "course_code",
    "completion_type",
    "credits",
]

DIFF_COLUMNS = [
    "academic_year",
    "diff_type",
    "course_code",
    "baseline_grade",
    "seed_grade",
    "baseline_semester",
    "seed_semester",
    "baseline_course_name",
    "seed_course_name",
    "baseline_completion_type",
    "seed_completion_type",
    "baseline_credits",
    "seed_credits",
    "changed_fields",
]


def comparison_directory() -> Path:
    return (
        EXTRACTED_CURRICULUM_FLOWCHARTS_DIR
        / "comparison"
    )


def provisional_baseline_directory() -> Path:
    return (
        comparison_directory()
        / "curriculum_provisional_baseline"
    )


def baseline_path(
    year: int,
) -> Path:
    return (
        provisional_baseline_directory()
        / f"curriculum_{year}.csv"
    )


def seed_path(
    year: int,
) -> Path:
    return (
        CURRICULUM_SEED_DIR
        / f"curriculum_{year}.csv"
    )


def output_directory() -> Path:
    return (
        comparison_directory()
        / "provisional_baseline_seed_diff"
    )


def diff_csv_path() -> Path:
    return (
        output_directory()
        / "provisional_baseline_seed_diff.csv"
    )


def report_path() -> Path:
    return (
        output_directory()
        / "provisional_baseline_seed_diff_report.txt"
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


def normalize_name(
    text: str,
) -> str:
    return re.sub(
        r"\s+",
        "",
        text.strip(),
    )


def normalize_credit(
    value: str,
) -> str:
    value = value.strip()

    if not value:
        return ""

    number = float(value)

    if number.is_integer():
        return str(
            int(number)
        )

    return f"{number:g}"


def normalized_core(
    row: dict[str, str],
) -> dict[str, str]:
    return {
        "grade": (
            row.get(
                "grade",
                "",
            ).strip()
        ),
        "semester": (
            row.get(
                "semester",
                "",
            ).strip()
        ),
        "course_name": (
            normalize_name(
                row.get(
                    "course_name",
                    "",
                )
            )
        ),
        "course_code": (
            row.get(
                "course_code",
                "",
            ).strip()
        ),
        "completion_type": (
            row.get(
                "completion_type",
                "",
            ).strip()
        ),
        "credits": (
            normalize_credit(
                row.get(
                    "credits",
                    "",
                )
            )
        ),
    }


def build_code_index(
    rows: list[dict[str, str]],
    label: str,
    year: int,
) -> dict[str, dict[str, str]]:
    index = {}

    for row in rows:
        code = (
            row.get(
                "course_code",
                "",
            ).strip()
        )

        if not code:
            raise RuntimeError(
                f"{label} {year}: "
                "빈 course_code가 있습니다: "
                f"{row}"
            )

        if code in index:
            raise RuntimeError(
                f"{label} {year}: "
                "course_code가 중복됩니다: "
                f"{code}"
            )

        index[code] = row

    return index


def changed_fields(
    baseline: dict[str, str],
    seed: dict[str, str],
) -> list[str]:
    baseline_core = (
        normalized_core(
            baseline
        )
    )

    seed_core = (
        normalized_core(
            seed
        )
    )

    return [
        column
        for column
        in CORE_COLUMNS
        if baseline_core[column]
        != seed_core[column]
    ]


def make_diff_row(
    year: int,
    diff_type: str,
    baseline: dict[str, str] | None,
    seed: dict[str, str] | None,
    fields: list[str] | None = None,
) -> dict[str, str]:
    baseline = baseline or {}
    seed = seed or {}

    return {
        "academic_year": str(
            year
        ),
        "diff_type": (
            diff_type
        ),
        "course_code": (
            baseline.get(
                "course_code",
                "",
            ).strip()
            or seed.get(
                "course_code",
                "",
            ).strip()
        ),
        "baseline_grade": (
            baseline.get(
                "grade",
                "",
            )
        ),
        "seed_grade": (
            seed.get(
                "grade",
                "",
            )
        ),
        "baseline_semester": (
            baseline.get(
                "semester",
                "",
            )
        ),
        "seed_semester": (
            seed.get(
                "semester",
                "",
            )
        ),
        "baseline_course_name": (
            baseline.get(
                "course_name",
                "",
            )
        ),
        "seed_course_name": (
            seed.get(
                "course_name",
                "",
            )
        ),
        "baseline_completion_type": (
            baseline.get(
                "completion_type",
                "",
            )
        ),
        "seed_completion_type": (
            seed.get(
                "completion_type",
                "",
            )
        ),
        "baseline_credits": (
            baseline.get(
                "credits",
                "",
            )
        ),
        "seed_credits": (
            seed.get(
                "credits",
                "",
            )
        ),
        "changed_fields": (
            ";".join(
                fields or []
            )
        ),
    }


def compare_year(
    year: int,
) -> tuple[
    list[dict[str, str]],
    dict[str, int],
]:
    baseline_rows = (
        read_csv_rows(
            baseline_path(year)
        )
    )

    seed_rows = (
        read_csv_rows(
            seed_path(year)
        )
    )

    baseline_index = (
        build_code_index(
            baseline_rows,
            "baseline",
            year,
        )
    )

    seed_index = (
        build_code_index(
            seed_rows,
            "seed",
            year,
        )
    )

    baseline_codes = set(
        baseline_index
    )

    seed_codes = set(
        seed_index
    )

    common_codes = (
        baseline_codes
        & seed_codes
    )

    diff_rows = []

    exact_match_count = 0
    changed_count = 0

    for code in sorted(
        common_codes
    ):
        baseline = (
            baseline_index[
                code
            ]
        )

        seed = (
            seed_index[
                code
            ]
        )

        fields = changed_fields(
            baseline,
            seed,
        )

        if not fields:
            exact_match_count += 1
            continue

        changed_count += 1

        diff_rows.append(
            make_diff_row(
                year=year,
                diff_type="changed",
                baseline=baseline,
                seed=seed,
                fields=fields,
            )
        )

    baseline_only_codes = (
        baseline_codes
        - seed_codes
    )

    for code in sorted(
        baseline_only_codes
    ):
        diff_rows.append(
            make_diff_row(
                year=year,
                diff_type="baseline_only",
                baseline=(
                    baseline_index[
                        code
                    ]
                ),
                seed=None,
            )
        )

    seed_only_codes = (
        seed_codes
        - baseline_codes
    )

    for code in sorted(
        seed_only_codes
    ):
        diff_rows.append(
            make_diff_row(
                year=year,
                diff_type="seed_only",
                baseline=None,
                seed=(
                    seed_index[
                        code
                    ]
                ),
            )
        )

    stats = {
        "baseline_rows": (
            len(
                baseline_rows
            )
        ),
        "seed_rows": (
            len(
                seed_rows
            )
        ),
        "exact_match": (
            exact_match_count
        ),
        "changed": (
            changed_count
        ),
        "baseline_only": (
            len(
                baseline_only_codes
            )
        ),
        "seed_only": (
            len(
                seed_only_codes
            )
        ),
    }

    return (
        diff_rows,
        stats,
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
            fieldnames=DIFF_COLUMNS,
        )

        writer.writeheader()
        writer.writerows(
            rows
        )


def build_report(
    all_diff_rows: list[
        dict[str, str]
    ],
    stats_by_year: dict[
        int,
        dict[str, int],
    ],
) -> str:
    lines = [
        (
            "Provisional baseline vs seed diff"
        ),
        "=============================================",
        "",
        (
            "Compared curriculum identity/core attributes only:"
        ),
        (
            "grade, semester, course_name, course_code, "
            "completion_type, credits"
        ),
        "",
        (
            "notes and change metadata are intentionally ignored."
        ),
        "",
    ]

    for year in TARGET_YEARS:
        stats = (
            stats_by_year[
                year
            ]
        )

        lines.extend(
            [
                str(year),
                "----",
                (
                    "baseline rows: "
                    f"{stats['baseline_rows']}"
                ),
                (
                    "seed rows: "
                    f"{stats['seed_rows']}"
                ),
                (
                    "exact core matches: "
                    f"{stats['exact_match']}"
                ),
                (
                    "changed same-code rows: "
                    f"{stats['changed']}"
                ),
                (
                    "baseline only: "
                    f"{stats['baseline_only']}"
                ),
                (
                    "seed only: "
                    f"{stats['seed_only']}"
                ),
                "",
            ]
        )

    diff_type_counts = Counter(
        row["diff_type"]
        for row
        in all_diff_rows
    )

    lines.extend(
        [
            "TOTAL DIFFERENCES",
            "-----------------",
            (
                "changed: "
                f"{diff_type_counts['changed']}"
            ),
            (
                "baseline_only: "
                f"{diff_type_counts['baseline_only']}"
            ),
            (
                "seed_only: "
                f"{diff_type_counts['seed_only']}"
            ),
            "",
            "DETAILS",
            "-------",
        ]
    )

    for row in all_diff_rows:
        if (
            row["diff_type"]
            == "changed"
        ):
            lines.append(
                (
                    f"{row['academic_year']} "
                    f"| CHANGED "
                    f"| {row['course_code']} "
                    f"| "
                    f"{row['baseline_course_name']} "
                    f"-> "
                    f"{row['seed_course_name']} "
                    f"| fields="
                    f"{row['changed_fields']}"
                )
            )

        elif (
            row["diff_type"]
            == "baseline_only"
        ):
            lines.append(
                (
                    f"{row['academic_year']} "
                    f"| BASELINE_ONLY "
                    f"| {row['course_code']} "
                    f"| "
                    f"{row['baseline_course_name']}"
                )
            )

        elif (
            row["diff_type"]
            == "seed_only"
        ):
            lines.append(
                (
                    f"{row['academic_year']} "
                    f"| SEED_ONLY "
                    f"| {row['course_code']} "
                    f"| "
                    f"{row['seed_course_name']}"
                )
            )

    lines.extend(
        [
            "",
            "Rules",
            "-----",
            (
                "1. Same course_code is treated as the same "
                "course identity for this diagnostic."
            ),
            (
                "2. Whitespace differences in course_name "
                "and numeric formatting differences in credits "
                "are normalized."
            ),
            (
                "3. notes and historical change metadata "
                "are not compared."
            ),
            (
                "4. No seed, baseline, extracted data, "
                "or database data is modified."
            ),
            "",
        ]
    )

    return "\n".join(
        lines
    )


def main() -> None:
    all_diff_rows = []
    stats_by_year = {}

    for year in TARGET_YEARS:
        baseline = (
            baseline_path(
                year
            )
        )

        seed = (
            seed_path(
                year
            )
        )

        if not baseline.exists():
            raise FileNotFoundError(
                baseline
            )

        if not seed.exists():
            raise FileNotFoundError(
                seed
            )

        (
            diff_rows,
            stats,
        ) = compare_year(
            year
        )

        all_diff_rows.extend(
            diff_rows
        )

        stats_by_year[
            year
        ] = stats

    output_directory().mkdir(
        parents=True,
        exist_ok=True,
    )

    write_csv(
        diff_csv_path(),
        all_diff_rows,
    )

    report = build_report(
        all_diff_rows,
        stats_by_year,
    )

    report_path().write_text(
        report,
        encoding="utf-8",
    )

    print()
    print(
        "Provisional baseline vs seed diff"
    )
    print(
        "---------------------------------"
    )

    for year in TARGET_YEARS:
        stats = (
            stats_by_year[
                year
            ]
        )

        print(
            f"{year}: "
            f"baseline={stats['baseline_rows']}, "
            f"seed={stats['seed_rows']}, "
            f"exact={stats['exact_match']}, "
            f"changed={stats['changed']}, "
            f"baseline_only={stats['baseline_only']}, "
            f"seed_only={stats['seed_only']}"
        )

    print()
    print(
        f"report: {report_path()}"
    )


if __name__ == "__main__":
    main()
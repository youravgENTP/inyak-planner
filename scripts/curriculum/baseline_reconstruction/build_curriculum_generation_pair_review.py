from __future__ import annotations

import csv
import re
from collections import Counter, defaultdict
from pathlib import Path

from scripts.common.data_paths import (
    EXTRACTED_CURRICULUM_FLOWCHARTS_DIR,
)


OUTPUT_COLUMNS = [
    "academic_year",
    "grade",
    "semester",
    "course_name",

    "group_size",

    "row_1_code",
    "row_1_status",
    "row_1_generation",
    "row_1_reason",
    "row_1_lineage",
    "row_1_relation",

    "row_2_code",
    "row_2_status",
    "row_2_generation",
    "row_2_reason",
    "row_2_lineage",
    "row_2_relation",

    "resolved_rows",
    "paired_unknown_rows",

    "group_status",
    "group_reason",
]


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


def output_csv_path() -> Path:
    return (
        comparison_directory()
        / "curriculum_generation_pair_review.csv"
    )


def output_report_path() -> Path:
    return (
        comparison_directory()
        / "curriculum_generation_pair_review_report.txt"
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


def group_key(
    row: dict[str, str],
) -> tuple[
    int,
    int,
    int,
    str,
]:
    return (
        int(row["academic_year"]),
        int(row["grade"]),
        int(row["semester"]),
        normalize_course_name(
            row["course_name"]
        ),
    )


def is_original_ambiguous_row(
    row: dict[str, str],
) -> bool:
    return (
        row.get(
            "generation_evidence",
            "",
        ).strip()
        == "ambiguous"
    )


def build_groups(
    rows: list[dict[str, str]],
) -> dict[
    tuple[
        int,
        int,
        int,
        str,
    ],
    list[dict[str, str]],
]:
    groups: dict[
        tuple[
            int,
            int,
            int,
            str,
        ],
        list[dict[str, str]],
    ] = defaultdict(list)

    for row in rows:
        if not is_original_ambiguous_row(
            row
        ):
            continue

        groups[
            group_key(row)
        ].append(row)

    return dict(groups)


def row_generation(
    row: dict[str, str],
) -> str:
    return (
        row.get(
            "provisional_generation",
            "",
        ).strip()
    )


def classify_group(
    rows: list[dict[str, str]],
) -> tuple[
    str,
    str,
]:
    statuses = [
        row.get(
            "decision_status",
            "",
        ).strip()
        for row in rows
    ]

    generations = [
        row_generation(row)
        for row in rows
        if row_generation(row)
    ]

    paired_unknown_count = (
        statuses.count(
            "paired_unknown"
        )
    )

    resolved_count = sum(
        status
        in {
            "confirmed",
            "probable",
        }
        for status in statuses
    )

    if (
        len(rows) == 2
        and resolved_count == 1
        and paired_unknown_count == 1
    ):
        return (
            "partially_resolved",
            (
                "one_row_has_generation_"
                "evidence_partner_remains_unknown"
            ),
        )

    if (
        len(rows) == 2
        and paired_unknown_count == 2
    ):
        return (
            "fully_unresolved",
            (
                "both_rows_remain_"
                "paired_unknown"
            ),
        )

    if (
        len(rows) == 2
        and resolved_count == 2
    ):
        if len(set(generations)) == 2:
            return (
                "resolved_split",
                (
                    "both_rows_resolved_to_"
                    "different_generations"
                ),
            )

        return (
            "resolved_same_generation",
            (
                "both_rows_resolved_to_"
                "same_generation"
            ),
        )

    return (
        "review",
        (
            "unexpected_group_state"
        ),
    )


def row_value(
    row: dict[str, str] | None,
    column: str,
) -> str:
    if row is None:
        return ""

    return row.get(
        column,
        "",
    ).strip()


def analyze(
    rows: list[dict[str, str]],
) -> list[dict[str, str]]:
    groups = build_groups(rows)

    output_rows: list[
        dict[str, str]
    ] = []

    for key in sorted(groups):
        year, grade, semester, _ = key

        items = sorted(
            groups[key],
            key=lambda row: (
                row.get(
                    "course_code",
                    "",
                )
            ),
        )

        if len(items) > 2:
            raise RuntimeError(
                "예상보다 큰 ambiguous group: "
                f"{key} / {len(items)} rows"
            )

        row_1 = (
            items[0]
            if len(items) >= 1
            else None
        )

        row_2 = (
            items[1]
            if len(items) >= 2
            else None
        )

        (
            group_status,
            group_reason,
        ) = classify_group(items)

        statuses = [
            row.get(
                "decision_status",
                "",
            ).strip()
            for row in items
        ]

        resolved_rows = sum(
            status
            in {
                "confirmed",
                "probable",
            }
            for status in statuses
        )

        paired_unknown_rows = (
            statuses.count(
                "paired_unknown"
            )
        )

        output_rows.append(
            {
                "academic_year": str(year),
                "grade": str(grade),
                "semester": str(semester),
                "course_name": (
                    row_value(
                        row_1,
                        "course_name",
                    )
                ),

                "group_size": (
                    str(len(items))
                ),

                "row_1_code": (
                    row_value(
                        row_1,
                        "course_code",
                    )
                ),
                "row_1_status": (
                    row_value(
                        row_1,
                        "decision_status",
                    )
                ),
                "row_1_generation": (
                    row_value(
                        row_1,
                        "provisional_generation",
                    )
                ),
                "row_1_reason": (
                    row_value(
                        row_1,
                        "decision_reason",
                    )
                ),
                "row_1_lineage": (
                    row_value(
                        row_1,
                        "lineage_candidate",
                    )
                ),
                "row_1_relation": (
                    row_value(
                        row_1,
                        "official_relation",
                    )
                ),

                "row_2_code": (
                    row_value(
                        row_2,
                        "course_code",
                    )
                ),
                "row_2_status": (
                    row_value(
                        row_2,
                        "decision_status",
                    )
                ),
                "row_2_generation": (
                    row_value(
                        row_2,
                        "provisional_generation",
                    )
                ),
                "row_2_reason": (
                    row_value(
                        row_2,
                        "decision_reason",
                    )
                ),
                "row_2_lineage": (
                    row_value(
                        row_2,
                        "lineage_candidate",
                    )
                ),
                "row_2_relation": (
                    row_value(
                        row_2,
                        "official_relation",
                    )
                ),

                "resolved_rows": (
                    str(resolved_rows)
                ),
                "paired_unknown_rows": (
                    str(
                        paired_unknown_rows
                    )
                ),

                "group_status": (
                    group_status
                ),
                "group_reason": (
                    group_reason
                ),
            }
        )

    return output_rows


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
        writer.writerows(rows)


def write_report(
    path: Path,
    rows: list[dict[str, str]],
) -> None:
    status_counts = Counter(
        row["group_status"]
        for row in rows
    )

    year_counts: dict[
        str,
        Counter,
    ] = defaultdict(Counter)

    for row in rows:
        year_counts[
            row["academic_year"]
        ][
            row["group_status"]
        ] += 1

    lines = [
        (
            "Curriculum generation "
            "pair review"
        ),
        "=============================================",
        "",
        (
            f"ambiguous groups: {len(rows)}"
        ),
        "",
        "Group status",
        "------------",
        (
            "partially_resolved: "
            f"{status_counts['partially_resolved']}"
        ),
        (
            "fully_unresolved: "
            f"{status_counts['fully_unresolved']}"
        ),
        (
            "resolved_split: "
            f"{status_counts['resolved_split']}"
        ),
        (
            "resolved_same_generation: "
            f"{status_counts['resolved_same_generation']}"
        ),
        (
            "review: "
            f"{status_counts['review']}"
        ),
        "",
        "By year",
        "-------",
    ]

    for year in sorted(year_counts):
        counts = year_counts[year]

        lines.append(
            (
                f"{year}: "
                f"partial="
                f"{counts['partially_resolved']}, "
                f"full_unknown="
                f"{counts['fully_unresolved']}, "
                f"split="
                f"{counts['resolved_split']}, "
                f"same="
                f"{counts['resolved_same_generation']}, "
                f"review="
                f"{counts['review']}"
            )
        )

    lines.extend(
        [
            "",
            "PARTIALLY RESOLVED",
            "------------------",
        ]
    )

    for row in rows:
        if (
            row["group_status"]
            != "partially_resolved"
        ):
            continue

        lines.append(
            (
                f"{row['academic_year']} "
                f"| {row['grade']}-"
                f"{row['semester']} "
                f"| {row['course_name']}"
            )
        )

        lines.append(
            (
                f"  {row['row_1_code']} "
                f"| status={row['row_1_status']} "
                f"| generation="
                f"{row['row_1_generation'] or '-'} "
                f"| lineage="
                f"{row['row_1_lineage'] or '-'}"
            )
        )

        lines.append(
            (
                f"  {row['row_2_code']} "
                f"| status={row['row_2_status']} "
                f"| generation="
                f"{row['row_2_generation'] or '-'} "
                f"| lineage="
                f"{row['row_2_lineage'] or '-'}"
            )
        )

    lines.extend(
        [
            "",
            "FULLY UNRESOLVED",
            "----------------",
        ]
    )

    for row in rows:
        if (
            row["group_status"]
            != "fully_unresolved"
        ):
            continue

        lines.append(
            (
                f"{row['academic_year']} "
                f"| {row['grade']}-"
                f"{row['semester']} "
                f"| {row['course_name']} "
                f"| {row['row_1_code']} "
                f"/ {row['row_2_code']}"
            )
        )

    lines.extend(
        [
            "",
            "Rules",
            "-----",
            (
                "1. Groups are reconstructed from "
                "rows whose original generation "
                "evidence is ambiguous."
            ),
            (
                "2. A probable row remains probable; "
                "its partner is not assigned the "
                "opposite generation."
            ),
            (
                "3. partially_resolved means exactly "
                "one row is confirmed/probable and "
                "the partner remains paired_unknown."
            ),
            (
                "4. fully_unresolved means both rows "
                "remain paired_unknown."
            ),
            (
                "5. This report does not change "
                "decision, preview, baseline, seed, "
                "or database data."
            ),
            "",
        ]
    )

    path.write_text(
        "\n".join(lines),
        encoding="utf-8",
    )


def main() -> None:
    source = decisions_path()

    if not source.exists():
        raise FileNotFoundError(
            "generation decisions가 없습니다: "
            f"{source}"
        )

    decisions = read_csv_rows(
        source
    )

    rows = analyze(
        decisions
    )

    write_csv(
        output_csv_path(),
        rows,
    )

    write_report(
        output_report_path(),
        rows,
    )

    print()
    print(
        "Curriculum generation pair review"
    )
    print(
        "---------------------------------"
    )
    print(
        f"groups: {len(rows)}"
    )
    print(
        f"csv:    {output_csv_path()}"
    )
    print(
        f"report: {output_report_path()}"
    )


if __name__ == "__main__":
    main()
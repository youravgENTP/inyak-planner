from __future__ import annotations

import csv
import re
from collections import defaultdict
from pathlib import Path

from scripts.common.data_paths import (
    EXTRACTED_CURRICULUM_FLOWCHARTS_DIR,
)


TARGET_YEARS = [
    2022,
    2023,
    2024,
]

OUTPUT_COLUMNS = [
    "academic_year",
    "grade",
    "semester",
    "course_name",
    "course_code",
    "completion_type",
    "credits",

    "original_decision_status",
    "original_generation",

    "scenario_a_generation",
    "scenario_a_reason",

    "scenario_b_generation",
    "scenario_b_reason",
]


def comparison_dir() -> Path:
    return (
        EXTRACTED_CURRICULUM_FLOWCHARTS_DIR
        / "comparison"
    )


def decisions_path() -> Path:
    return (
        comparison_dir()
        / "curriculum_generation_decisions.csv"
    )


def backward_support_path() -> Path:
    return (
        comparison_dir()
        / "curriculum_generation_pair_backward_support_audit.csv"
    )


def output_csv_path() -> Path:
    return (
        comparison_dir()
        / "curriculum_generation_provisional_totals.csv"
    )


def output_report_path() -> Path:
    return (
        comparison_dir()
        / "curriculum_generation_provisional_totals_report.txt"
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


def row_key(
    row: dict[str, str],
) -> tuple[
    int,
    int,
    int,
    str,
    str,
]:
    return (
        int(row["academic_year"]),
        int(row["grade"]),
        int(row["semester"]),
        row["course_code"].strip(),
        normalize_name(
            row["course_name"]
        ),
    )


def backward_key(
    row: dict[str, str],
) -> tuple[
    int,
    int,
    int,
    str,
    str,
]:
    return (
        int(row["target_year"]),
        int(row["grade"]),
        int(row["semester"]),
        row["course_code"].strip(),
        normalize_name(
            row["course_name"]
        ),
    )


def build_backward_index(
    rows: list[dict[str, str]],
) -> dict[
    tuple[
        int,
        int,
        int,
        str,
        str,
    ],
    str,
]:
    index = {}

    for row in rows:
        key = backward_key(row)

        generation = row[
            "backward_support_candidate"
        ].strip()

        if key in index:
            if index[key] != generation:
                raise RuntimeError(
                    "backward support conflict: "
                    f"{key}"
                )

        index[key] = generation

    return index


def scenario_a_generation(
    row: dict[str, str],
    backward_index: dict,
) -> tuple[str, str]:
    status = row[
        "decision_status"
    ].strip()

    generation = row[
        "provisional_generation"
    ].strip()

    if (
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
    ):
        return (
            generation,
            f"original_{status}",
        )

    key = row_key(row)

    if key in backward_index:
        return (
            backward_index[key],
            "backward_support_review_only",
        )

    return (
        "",
        "",
    )


def ambiguous_group_key(
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
        normalize_name(
            row["course_name"]
        ),
    )


def build_scenario_b(
    decision_rows: list[dict[str, str]],
    scenario_a: dict[
        tuple[
            int,
            int,
            int,
            str,
            str,
        ],
        tuple[str, str],
    ],
) -> dict[
    tuple[
        int,
        int,
        int,
        str,
        str,
    ],
    tuple[str, str],
]:
    result = dict(
        scenario_a
    )

    groups: dict[
        tuple[
            int,
            int,
            int,
            str,
        ],
        list[dict[str, str]],
    ] = defaultdict(list)

    for row in decision_rows:
        if (
            row[
                "generation_evidence"
            ].strip()
            != "ambiguous"
        ):
            continue

        groups[
            ambiguous_group_key(row)
        ].append(row)

    for group_rows in groups.values():
        if len(group_rows) != 2:
            continue

        assigned = []

        unassigned = []

        for row in group_rows:
            key = row_key(row)

            generation = (
                result.get(
                    key,
                    ("", ""),
                )[0]
            )

            if generation:
                assigned.append(
                    (
                        row,
                        generation,
                    )
                )
            else:
                unassigned.append(
                    row
                )

        if (
            len(assigned) != 1
            or len(unassigned) != 1
        ):
            continue

        (
            assigned_row,
            assigned_generation,
        ) = assigned[0]

        if assigned_generation == "six_year":
            inferred_generation = (
                "four_year"
            )
        elif (
            assigned_generation
            == "four_year"
        ):
            inferred_generation = (
                "six_year"
            )
        else:
            continue

        target = unassigned[0]
        target_key = row_key(
            target
        )

        result[
            target_key
        ] = (
            inferred_generation,
            (
                "derived_opposite_partner_"
                "assumption"
            ),
        )

    return result


def credit(
    row: dict[str, str],
) -> float:
    value = (
        row.get(
            "credits",
            "",
        ).strip()
    )

    if not value:
        return 0.0

    return float(value)


def format_credit(
    value: float,
) -> str:
    if value.is_integer():
        return str(
            int(value)
        )

    return f"{value:g}"


def summarize(
    rows: list[dict[str, str]],
    generation_column: str,
) -> dict[
    int,
    dict[
        str,
        dict[
            str,
            float,
        ],
    ],
]:
    result = defaultdict(
        lambda: defaultdict(
            lambda: {
                "rows": 0,
                "credits": 0.0,
                "required_credits": 0.0,
                "elective_credits": 0.0,
            }
        )
    )

    for row in rows:
        year = int(
            row["academic_year"]
        )

        generation = row[
            generation_column
        ].strip()

        if not generation:
            continue

        targets = (
            [
                "four_year",
                "six_year",
            ]
            if generation == "both"
            else [
                generation
            ]
        )

        for target in targets:
            bucket = result[
                year
            ][
                target
            ]

            value = credit(row)

            bucket[
                "rows"
            ] += 1

            bucket[
                "credits"
            ] += value

            completion = (
                row[
                    "completion_type"
                ].strip()
            )

            if completion == "전필":
                bucket[
                    "required_credits"
                ] += value

            elif completion == "전선":
                bucket[
                    "elective_credits"
                ] += value

    return result


def main() -> None:
    if not decisions_path().exists():
        raise FileNotFoundError(
            decisions_path()
        )

    if not backward_support_path().exists():
        raise FileNotFoundError(
            backward_support_path()
        )

    decision_rows = read_csv_rows(
        decisions_path()
    )

    decision_rows = [
        row
        for row in decision_rows
        if int(
            row["academic_year"]
        )
        in TARGET_YEARS
    ]

    backward_rows = read_csv_rows(
        backward_support_path()
    )

    backward_index = (
        build_backward_index(
            backward_rows
        )
    )

    scenario_a = {}

    for row in decision_rows:
        scenario_a[
            row_key(row)
        ] = (
            scenario_a_generation(
                row,
                backward_index,
            )
        )

    scenario_b = build_scenario_b(
        decision_rows,
        scenario_a,
    )

    output_rows = []

    for row in decision_rows:
        key = row_key(row)

        (
            a_generation,
            a_reason,
        ) = scenario_a[
            key
        ]

        (
            b_generation,
            b_reason,
        ) = scenario_b[
            key
        ]

        output_rows.append(
            {
                "academic_year": (
                    row[
                        "academic_year"
                    ]
                ),
                "grade": (
                    row["grade"]
                ),
                "semester": (
                    row["semester"]
                ),
                "course_name": (
                    row[
                        "course_name"
                    ]
                ),
                "course_code": (
                    row[
                        "course_code"
                    ]
                ),
                "completion_type": (
                    row[
                        "completion_type"
                    ]
                ),
                "credits": (
                    row["credits"]
                ),

                "original_decision_status": (
                    row[
                        "decision_status"
                    ]
                ),
                "original_generation": (
                    row[
                        "provisional_generation"
                    ]
                ),

                "scenario_a_generation": (
                    a_generation
                ),
                "scenario_a_reason": (
                    a_reason
                ),

                "scenario_b_generation": (
                    b_generation
                ),
                "scenario_b_reason": (
                    b_reason
                ),
            }
        )

    with output_csv_path().open(
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
            output_rows
        )

    summary_a = summarize(
        output_rows,
        "scenario_a_generation",
    )

    summary_b = summarize(
        output_rows,
        "scenario_b_generation",
    )

    lines = [
        (
            "Curriculum generation "
            "provisional totals"
        ),
        "=============================================",
        "",
        (
            "Scenario A = confirmed + probable "
            "+ backward support"
        ),
        (
            "Scenario B = Scenario A + opposite "
            "partner closure assumption"
        ),
        "",
    ]

    for year in TARGET_YEARS:
        lines.extend(
            [
                str(year),
                "----",
            ]
        )

        for scenario_name, summary in [
            (
                "A",
                summary_a,
            ),
            (
                "B",
                summary_b,
            ),
        ]:
            lines.append(
                f"Scenario {scenario_name}"
            )

            for generation in [
                "four_year",
                "six_year",
            ]:
                bucket = (
                    summary[
                        year
                    ][
                        generation
                    ]
                )

                lines.append(
                    (
                        f"  {generation}: "
                        f"{bucket['rows']} rows, "
                        f"{format_credit(bucket['credits'])} credits "
                        f"(전필 "
                        f"{format_credit(bucket['required_credits'])}, "
                        f"전선 "
                        f"{format_credit(bucket['elective_credits'])})"
                    )
                )

        lines.append("")

    unassigned_a = [
        row
        for row in output_rows
        if not row[
            "scenario_a_generation"
        ]
    ]

    unassigned_b = [
        row
        for row in output_rows
        if not row[
            "scenario_b_generation"
        ]
    ]

    lines.extend(
        [
            "UNASSIGNED",
            "----------",
            (
                "Scenario A: "
                f"{len(unassigned_a)} rows, "
                f"{format_credit(sum(credit(r) for r in unassigned_a))} credits"
            ),
            (
                "Scenario B: "
                f"{len(unassigned_b)} rows, "
                f"{format_credit(sum(credit(r) for r in unassigned_b))} credits"
            ),
            "",
            "Scenario B remaining rows",
            "-------------------------",
        ]
    )

    for row in unassigned_b:
        lines.append(
            (
                f"{row['academic_year']} "
                f"| {row['grade']}-{row['semester']} "
                f"| {row['course_code']} "
                f"| {row['course_name']} "
                f"| {row['credits']} credits "
                f"| status="
                f"{row['original_decision_status']}"
            )
        )

    output_report_path().write_text(
        "\n".join(lines),
        encoding="utf-8",
    )

    print(
        output_report_path()
    )


if __name__ == "__main__":
    main()
from __future__ import annotations

import csv
import re
from collections import Counter, defaultdict
from pathlib import Path

from scripts.common.data_paths import (
    EXTRACTED_CURRICULUM_FLOWCHARTS_DIR,
)


OUTPUT_COLUMNS = [
    "grade",
    "semester",
    "normalized_course_name",
    "display_course_name",
    "pair_codes",

    "years_present",

    "code_1",
    "code_1_2022_status",
    "code_1_2022_generation",
    "code_1_2023_status",
    "code_1_2023_generation",
    "code_1_2024_status",
    "code_1_2024_generation",

    "code_2",
    "code_2_2022_status",
    "code_2_2022_generation",
    "code_2_2023_status",
    "code_2_2023_generation",
    "code_2_2024_status",
    "code_2_2024_generation",

    "resolved_member_count",
    "resolved_member_codes",
    "resolved_generations",

    "continuity_pattern",
    "review_priority",
    "continuity_note",
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
        / "curriculum_generation_pair_continuity_audit.csv"
    )


def output_report_path() -> Path:
    return (
        comparison_directory()
        / "curriculum_generation_pair_continuity_audit_report.txt"
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


def is_original_ambiguous(
    row: dict[str, str],
) -> bool:
    return (
        row.get(
            "generation_evidence",
            "",
        ).strip()
        == "ambiguous"
    )


def build_year_groups(
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
        if not is_original_ambiguous(row):
            continue

        key = (
            int(row["academic_year"]),
            int(row["grade"]),
            int(row["semester"]),
            normalize_course_name(
                row["course_name"]
            ),
        )

        groups[key].append(row)

    return dict(groups)


def build_pair_histories(
    rows: list[dict[str, str]],
) -> dict[
    tuple[
        int,
        int,
        str,
        tuple[str, ...],
    ],
    dict[
        int,
        list[dict[str, str]],
    ],
]:
    year_groups = build_year_groups(
        rows
    )

    histories: dict[
        tuple[
            int,
            int,
            str,
            tuple[str, ...],
        ],
        dict[
            int,
            list[dict[str, str]],
        ],
    ] = defaultdict(dict)

    for (
        year,
        grade,
        semester,
        normalized_name,
    ), items in year_groups.items():

        codes = tuple(
            sorted(
                {
                    row.get(
                        "course_code",
                        "",
                    ).strip()
                    for row in items
                    if row.get(
                        "course_code",
                        "",
                    ).strip()
                }
            )
        )

        if len(codes) != 2:
            continue

        history_key = (
            grade,
            semester,
            normalized_name,
            codes,
        )

        histories[
            history_key
        ][year] = items

    return dict(histories)


def get_row_for_code(
    rows: list[dict[str, str]] | None,
    code: str,
) -> dict[str, str] | None:
    if not rows:
        return None

    matches = [
        row
        for row in rows
        if row.get(
            "course_code",
            "",
        ).strip()
        == code
    ]

    if len(matches) > 1:
        raise RuntimeError(
            "같은 pair/year에서 동일 code가 "
            f"중복됩니다: {code}"
        )

    if not matches:
        return None

    return matches[0]


def status_of(
    row: dict[str, str] | None,
) -> str:
    if row is None:
        return ""

    return row.get(
        "decision_status",
        "",
    ).strip()


def generation_of(
    row: dict[str, str] | None,
) -> str:
    if row is None:
        return ""

    return row.get(
        "provisional_generation",
        "",
    ).strip()


def classify_pattern(
    years: dict[
        int,
        list[dict[str, str]],
    ],
    codes: tuple[str, str],
) -> tuple[
    str,
    str,
    str,
]:
    resolved_by_code: dict[
        str,
        list[
            tuple[
                int,
                str,
                str,
            ]
        ],
    ] = defaultdict(list)

    for year, rows in years.items():
        for code in codes:
            row = get_row_for_code(
                rows,
                code,
            )

            if row is None:
                continue

            status = status_of(row)
            generation = generation_of(row)

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
                }
            ):
                resolved_by_code[
                    code
                ].append(
                    (
                        year,
                        generation,
                        status,
                    )
                )

    if not resolved_by_code:
        return (
            "never_resolved",
            "high",
            (
                "pair repeats across years but "
                "neither member has independent "
                "generation resolution"
            ),
        )

    generations = {
        generation
        for evidence
        in resolved_by_code.values()
        for (
            _,
            generation,
            _,
        )
        in evidence
    }

    if len(generations) > 1:
        return (
            "cross_year_conflict",
            "high",
            (
                "resolved pair-member evidence "
                "contains multiple generations"
            ),
        )

    if len(resolved_by_code) == 1:
        resolved_code = next(
            iter(
                resolved_by_code
            )
        )

        evidence = (
            resolved_by_code[
                resolved_code
            ]
        )

        statuses = {
            status
            for (
                _,
                _,
                status,
            )
            in evidence
        }

        if "confirmed" in statuses:
            return (
                "one_member_resolved_confirmed",
                "medium",
                (
                    "one member has confirmed "
                    "generation in at least one year; "
                    "do not infer partner generation"
                ),
            )

        return (
            "one_member_resolved_probable_only",
            "medium",
            (
                "one member is resolved only through "
                "probable evidence; useful for review "
                "but not safe for propagation"
            ),
        )

    return (
        "both_members_have_resolution",
        "high",
        (
            "both pair members have some resolved "
            "generation evidence; inspect manually"
        ),
    )


def analyze(
    decisions: list[dict[str, str]],
) -> list[dict[str, str]]:
    histories = build_pair_histories(
        decisions
    )

    output: list[
        dict[str, str]
    ] = []

    for key in sorted(histories):
        (
            grade,
            semester,
            normalized_name,
            codes,
        ) = key

        if len(codes) != 2:
            continue

        code_1, code_2 = codes

        years = histories[key]

        display_name = ""

        for year in sorted(years):
            if years[year]:
                display_name = (
                    years[year][0].get(
                        "course_name",
                        "",
                    )
                )
                break

        resolved_member_codes: set[
            str
        ] = set()

        resolved_generations: set[
            str
        ] = set()

        for year_rows in years.values():
            for code in codes:
                row = get_row_for_code(
                    year_rows,
                    code,
                )

                if row is None:
                    continue

                status = status_of(row)
                generation = generation_of(row)

                if (
                    status
                    in {
                        "confirmed",
                        "probable",
                    }
                    and generation
                ):
                    resolved_member_codes.add(
                        code
                    )
                    resolved_generations.add(
                        generation
                    )

        (
            pattern,
            priority,
            note,
        ) = classify_pattern(
            years,
            (
                code_1,
                code_2,
            ),
        )

        row_out = {
            "grade": str(grade),
            "semester": str(semester),
            "normalized_course_name": (
                normalized_name
            ),
            "display_course_name": (
                display_name
            ),
            "pair_codes": (
                f"{code_1};{code_2}"
            ),

            "years_present": (
                ";".join(
                    str(year)
                    for year
                    in sorted(years)
                )
            ),

            "code_1": code_1,
            "code_2": code_2,

            "resolved_member_count": (
                str(
                    len(
                        resolved_member_codes
                    )
                )
            ),
            "resolved_member_codes": (
                ";".join(
                    sorted(
                        resolved_member_codes
                    )
                )
            ),
            "resolved_generations": (
                ";".join(
                    sorted(
                        resolved_generations
                    )
                )
            ),

            "continuity_pattern": (
                pattern
            ),
            "review_priority": (
                priority
            ),
            "continuity_note": (
                note
            ),
        }

        for code_index, code in [
            (
                1,
                code_1,
            ),
            (
                2,
                code_2,
            ),
        ]:
            for year in [
                2022,
                2023,
                2024,
            ]:
                row = get_row_for_code(
                    years.get(year),
                    code,
                )

                row_out[
                    f"code_{code_index}_{year}_status"
                ] = status_of(
                    row
                )

                row_out[
                    f"code_{code_index}_{year}_generation"
                ] = generation_of(
                    row
                )

        output.append(
            row_out
        )

    return output


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


def write_report(
    path: Path,
    rows: list[dict[str, str]],
) -> None:
    pattern_counts = Counter(
        row[
            "continuity_pattern"
        ]
        for row in rows
    )

    lines = [
        (
            "Curriculum generation "
            "pair continuity audit"
        ),
        "=============================================",
        "",
        (
            f"pair histories: {len(rows)}"
        ),
        "",
        "Patterns",
        "--------",
    ]

    for pattern, count in sorted(
        pattern_counts.items()
    ):
        lines.append(
            f"{pattern}: {count}"
        )

    lines.extend(
        [
            "",
            "PAIR HISTORIES",
            "--------------",
        ]
    )

    for row in rows:
        lines.append(
            (
                f"{row['display_course_name']} "
                f"| pair={row['pair_codes']} "
                f"| years={row['years_present']} "
                f"| pattern="
                f"{row['continuity_pattern']}"
            )
        )

        for code_index in [
            1,
            2,
        ]:
            code = row[
                f"code_{code_index}"
            ]

            states: list[str] = []

            for year in [
                2022,
                2023,
                2024,
            ]:
                status = row[
                    f"code_{code_index}_{year}_status"
                ]

                generation = row[
                    f"code_{code_index}_{year}_generation"
                ]

                if not status:
                    continue

                states.append(
                    (
                        f"{year}:"
                        f"{status}"
                        f"/{generation or '-'}"
                    )
                )

            lines.append(
                (
                    f"  {code} | "
                    + " | ".join(
                        states
                    )
                )
            )

    lines.extend(
        [
            "",
            "Rules",
            "-----",
            (
                "1. This audit follows exact pair "
                "identity: same grade, semester, "
                "normalized course name, and same "
                "two course codes."
            ),
            (
                "2. It does not infer that the "
                "partner of a six-year row is "
                "four-year, or vice versa."
            ),
            (
                "3. confirmed and probable are shown "
                "only as existing evidence."
            ),
            (
                "4. probable evidence is not "
                "propagated backward or forward."
            ),
            (
                "5. No decisions, preview, baseline, "
                "seed, or database rows are changed."
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
        "Curriculum generation "
        "pair continuity audit"
    )
    print(
        "--------------------------------------"
    )
    print(
        f"pair histories: {len(rows)}"
    )
    print(
        f"csv:    {output_csv_path()}"
    )
    print(
        f"report: {output_report_path()}"
    )


if __name__ == "__main__":
    main()
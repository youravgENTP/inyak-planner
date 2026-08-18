from __future__ import annotations

import csv
import re
from collections import Counter
from pathlib import Path

from scripts.common.data_paths import (
    EXTRACTED_CURRICULUM_FLOWCHARTS_DIR,
)


MAX_BACKWARD_YEARS = 2

OUTPUT_COLUMNS = [
    "target_year",
    "grade",
    "semester",
    "course_name",
    "course_code",

    "target_status",
    "target_generation_evidence",

    "pair_codes",

    "source_year",
    "source_course_code",
    "source_status",
    "source_generation",
    "source_decision_reason",
    "source_lineage_candidate",

    "year_distance",

    "backward_support_candidate",
    "backward_support_strength",
    "backward_support_status",
    "backward_support_reason",
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
        / "curriculum_generation_pair_backward_support_audit.csv"
    )


def output_report_path() -> Path:
    return (
        comparison_directory()
        / "curriculum_generation_pair_backward_support_audit_report.txt"
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


def build_ambiguous_groups(
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
    ] = {}

    for row in rows:
        if not is_original_ambiguous(
            row
        ):
            continue

        key = group_key(
            row
        )

        groups.setdefault(
            key,
            [],
        ).append(
            row
        )

    return groups


def pair_codes(
    rows: list[dict[str, str]],
) -> tuple[str, ...]:
    return tuple(
        sorted(
            {
                row.get(
                    "course_code",
                    "",
                ).strip()
                for row in rows
                if row.get(
                    "course_code",
                    "",
                ).strip()
            }
        )
    )


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
    groups = build_ambiguous_groups(
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
    ] = {}

    for (
        year,
        grade,
        semester,
        normalized_name,
    ), group_rows in groups.items():

        codes = pair_codes(
            group_rows
        )

        if len(codes) != 2:
            continue

        key = (
            grade,
            semester,
            normalized_name,
            codes,
        )

        histories.setdefault(
            key,
            {},
        )[year] = group_rows

    return histories


def find_code_row(
    rows: list[dict[str, str]] | None,
    course_code: str,
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
        == course_code
    ]

    if len(matches) > 1:
        raise RuntimeError(
            "동일 pair/year에서 같은 code가 "
            f"두 번 이상 존재합니다: {course_code}"
        )

    if not matches:
        return None

    return matches[0]


def is_probable_source(
    row: dict[str, str],
) -> bool:
    status = (
        row.get(
            "decision_status",
            "",
        ).strip()
    )

    generation = (
        row.get(
            "provisional_generation",
            "",
        ).strip()
    )

    return (
        status == "probable"
        and generation
        in {
            "four_year",
            "six_year",
        }
    )


def is_backward_target(
    row: dict[str, str],
) -> bool:
    return (
        row.get(
            "decision_status",
            "",
        ).strip()
        == "paired_unknown"
    )


def strength_for_distance(
    distance: int,
) -> str:
    if distance == 1:
        return "adjacent_year"

    if distance == 2:
        return "two_year"

    raise ValueError(
        f"지원하지 않는 distance: {distance}"
    )


def analyze(
    decisions: list[dict[str, str]],
) -> list[dict[str, str]]:
    histories = build_pair_histories(
        decisions
    )

    output_rows: list[
        dict[str, str]
    ] = []

    seen: set[
        tuple[
            int,
            str,
            int,
            str,
        ]
    ] = set()

    for (
        grade,
        semester,
        _normalized_name,
        codes,
    ), years in histories.items():

        code_1, code_2 = codes

        for source_year in sorted(
            years
        ):
            source_rows = years[
                source_year
            ]

            for course_code in codes:
                source_row = find_code_row(
                    source_rows,
                    course_code,
                )

                if source_row is None:
                    continue

                if not is_probable_source(
                    source_row
                ):
                    continue

                source_generation = (
                    source_row.get(
                        "provisional_generation",
                        "",
                    ).strip()
                )

                for distance in range(
                    1,
                    MAX_BACKWARD_YEARS + 1,
                ):
                    target_year = (
                        source_year
                        - distance
                    )

                    target_rows = (
                        years.get(
                            target_year
                        )
                    )

                    if not target_rows:
                        continue

                    target_row = find_code_row(
                        target_rows,
                        course_code,
                    )

                    if target_row is None:
                        continue

                    if not is_backward_target(
                        target_row
                    ):
                        continue

                    dedup_key = (
                        target_year,
                        course_code,
                        source_year,
                        source_generation,
                    )

                    if dedup_key in seen:
                        continue

                    seen.add(
                        dedup_key
                    )

                    output_rows.append(
                        {
                            "target_year": (
                                str(
                                    target_year
                                )
                            ),
                            "grade": (
                                str(
                                    grade
                                )
                            ),
                            "semester": (
                                str(
                                    semester
                                )
                            ),
                            "course_name": (
                                target_row.get(
                                    "course_name",
                                    "",
                                )
                            ),
                            "course_code": (
                                course_code
                            ),

                            "target_status": (
                                target_row.get(
                                    "decision_status",
                                    "",
                                )
                            ),
                            "target_generation_evidence": (
                                target_row.get(
                                    "generation_evidence",
                                    "",
                                )
                            ),

                            "pair_codes": (
                                f"{code_1};{code_2}"
                            ),

                            "source_year": (
                                str(
                                    source_year
                                )
                            ),
                            "source_course_code": (
                                course_code
                            ),
                            "source_status": (
                                source_row.get(
                                    "decision_status",
                                    "",
                                )
                            ),
                            "source_generation": (
                                source_generation
                            ),
                            "source_decision_reason": (
                                source_row.get(
                                    "decision_reason",
                                    "",
                                )
                            ),
                            "source_lineage_candidate": (
                                source_row.get(
                                    "lineage_candidate",
                                    "",
                                )
                            ),

                            "year_distance": (
                                str(
                                    distance
                                )
                            ),

                            "backward_support_candidate": (
                                source_generation
                            ),
                            "backward_support_strength": (
                                strength_for_distance(
                                    distance
                                )
                            ),
                            "backward_support_status": (
                                "review_only"
                            ),
                            "backward_support_reason": (
                                "same_pair_same_code_"
                                "later_probable_generation"
                            ),
                        }
                    )

    output_rows.sort(
        key=lambda row: (
            int(
                row[
                    "target_year"
                ]
            ),
            int(
                row[
                    "grade"
                ]
            ),
            int(
                row[
                    "semester"
                ]
            ),
            row[
                "course_name"
            ],
            row[
                "course_code"
            ],
            int(
                row[
                    "source_year"
                ]
            ),
        )
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
        writer.writerows(
            rows
        )


def write_report(
    path: Path,
    rows: list[dict[str, str]],
) -> None:
    by_generation = Counter(
        row[
            "backward_support_candidate"
        ]
        for row in rows
    )

    by_distance = Counter(
        row[
            "year_distance"
        ]
        for row in rows
    )

    by_target_year = Counter(
        row[
            "target_year"
        ]
        for row in rows
    )

    unique_target_rows = {
        (
            row[
                "target_year"
            ],
            row[
                "course_code"
            ],
            row[
                "course_name"
            ],
        )
        for row in rows
    }

    lines = [
        (
            "Curriculum generation "
            "pair backward support audit"
        ),
        "=============================================",
        "",
        (
            "support rows: "
            f"{len(rows)}"
        ),
        (
            "unique target rows: "
            f"{len(unique_target_rows)}"
        ),
        "",
        "Candidate generation",
        "--------------------",
        (
            "four_year: "
            f"{by_generation['four_year']}"
        ),
        (
            "six_year: "
            f"{by_generation['six_year']}"
        ),
        "",
        "Distance",
        "--------",
        (
            "1 year backward: "
            f"{by_distance['1']}"
        ),
        (
            "2 years backward: "
            f"{by_distance['2']}"
        ),
        "",
        "Target year",
        "-----------",
    ]

    for year in sorted(
        by_target_year
    ):
        lines.append(
            (
                f"{year}: "
                f"{by_target_year[year]}"
            )
        )

    lines.extend(
        [
            "",
            "BACKWARD SUPPORT CANDIDATES",
            "---------------------------",
        ]
    )

    for row in rows:
        lines.append(
            (
                f"{row['target_year']} "
                f"| {row['grade']}-"
                f"{row['semester']} "
                f"| {row['course_code']} "
                f"| {row['course_name']} "
                f"| candidate="
                f"{row['backward_support_candidate']} "
                f"| from="
                f"{row['source_year']} "
                f"| distance="
                f"{row['year_distance']} "
                f"| strength="
                f"{row['backward_support_strength']}"
            )
        )

    lines.extend(
        [
            "",
            "Rules",
            "-----",
            (
                "1. Only original ambiguous "
                "two-code pair groups are inspected."
            ),
            (
                "2. The pair identity must remain "
                "exactly the same: grade, semester, "
                "normalized course name, and both "
                "course codes."
            ),
            (
                "3. The same course code member is "
                "followed backward; code prefixes "
                "are never interpreted."
            ),
            (
                "4. Only a later row whose current "
                "decision status is probable and "
                "whose provisional generation is "
                "four_year or six_year may act as "
                "a support source."
            ),
            (
                "5. Only earlier rows that remain "
                "paired_unknown are emitted."
            ),
            (
                "6. Support is limited to one or "
                "two years backward."
            ),
            (
                "7. A backward-support candidate is "
                "review-only. It does not become "
                "confirmed or probable."
            ),
            (
                "8. The opposite member of the pair "
                "is never assigned the opposite "
                "generation."
            ),
            (
                "9. No recursive propagation is "
                "performed. A backward-support row "
                "can never become a source."
            ),
            (
                "10. Decisions, preview, baseline, "
                "seed, and database data are not "
                "modified."
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
        "Curriculum generation "
        "pair backward support audit"
    )
    print(
        "--------------------------------------"
    )
    print(
        f"support rows: {len(rows)}"
    )
    print(
        f"csv:    {csv_path}"
    )
    print(
        f"report: {report_path}"
    )


if __name__ == "__main__":
    main()
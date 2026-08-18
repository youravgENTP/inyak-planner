from __future__ import annotations

import csv
from collections import defaultdict
from pathlib import Path

from scripts.common.data_paths import (
    EXTRACTED_CURRICULUM_FLOWCHARTS_DIR,
)


SUPPORTED_GENERATIONS = {
    "four_year",
    "six_year",
}

OUTPUT_COLUMNS = [
    "academic_year",
    "grade",
    "semester",
    "course_name",
    "course_code",
    "completion_type",
    "credits",
    "current_generation",
    "previous_1_year",
    "previous_1_generation",
    "previous_1_reason",
    "previous_2_year",
    "previous_2_generation",
    "previous_2_reason",
    "next_1_year",
    "next_1_generation",
    "next_1_reason",
    "next_2_year",
    "next_2_generation",
    "next_2_reason",
    "supporting_four_years",
    "supporting_six_years",
    "continuity_candidate",
    "continuity_strength",
    "continuity_status",
    "continuity_reason",
]


def comparison_directory() -> Path:
    return (
        EXTRACTED_CURRICULUM_FLOWCHARTS_DIR
        / "comparison"
    )


def row_evidence_path() -> Path:
    return (
        comparison_directory()
        / "curriculum_generation_row_evidence.csv"
    )


def output_csv_path() -> Path:
    return (
        comparison_directory()
        / "curriculum_generation_continuity_audit.csv"
    )


def output_report_path() -> Path:
    return (
        comparison_directory()
        / "curriculum_generation_continuity_audit_report.txt"
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


def generation_for_rows(
    rows: list[dict[str, str]],
) -> tuple[str, str]:
    """
    같은 course_code가 같은 연도에 여러 행 존재하는 경우를
    안전하게 하나의 연도 evidence로 요약한다.

    반환:
      generation:
        four_year
        six_year
        conflict
        ""
      reason:
        해당 evidence_reason들을 세미콜론으로 연결
    """

    generations = {
        row.get(
            "generation_evidence",
            "",
        ).strip()
        for row in rows
        if row.get(
            "generation_evidence",
            "",
        ).strip()
        in SUPPORTED_GENERATIONS
    }

    reasons = sorted(
        {
            row.get(
                "evidence_reason",
                "",
            ).strip()
            for row in rows
            if row.get(
                "generation_evidence",
                "",
            ).strip()
            in SUPPORTED_GENERATIONS
            and row.get(
                "evidence_reason",
                "",
            ).strip()
        }
    )

    if len(
        generations
    ) > 1:
        return (
            "conflict",
            ";".join(
                reasons
            ),
        )

    if len(
        generations
    ) == 1:
        return (
            next(
                iter(
                    generations
                )
            ),
            ";".join(
                reasons
            ),
        )

    return (
        "",
        "",
    )


def build_code_year_index(
    rows: list[dict[str, str]],
) -> dict[
    str,
    dict[
        int,
        list[
            dict[str, str]
        ],
    ],
]:
    index: dict[
        str,
        dict[
            int,
            list[
                dict[str, str]
            ],
        ],
    ] = defaultdict(
        lambda: defaultdict(
            list
        )
    )

    for row in rows:
        course_code = (
            row.get(
                "course_code",
                "",
            ).strip()
        )

        if not course_code:
            continue

        year = int(
            row[
                "academic_year"
            ]
        )

        index[
            course_code
        ][
            year
        ].append(
            row
        )

    return {
        code: dict(
            years
        )
        for code, years
        in index.items()
    }


def evidence_at_year(
    code_year_index: dict[
        str,
        dict[
            int,
            list[
                dict[str, str]
            ],
        ],
    ],
    course_code: str,
    year: int,
) -> tuple[str, str]:
    rows = (
        code_year_index
        .get(
            course_code,
            {},
        )
        .get(
            year,
            [],
        )
    )

    return generation_for_rows(
        rows
    )


def year_text(
    generation: str,
    year: int,
) -> str:
    if not generation:
        return ""

    return str(
        year
    )


def joined_years(
    years: list[int],
) -> str:
    return ";".join(
        str(
            year
        )
        for year in years
    )


def classify_continuity(
    target_year: int,
    previous_1: str,
    previous_2: str,
    next_1: str,
    next_2: str,
) -> tuple[
    str,
    str,
    str,
    str,
]:
    """
    전역 course-code 분류가 아니라,
    target year 주변 최대 2년만 본다.

    strongest:
      immediate_neighbors_consensus
        바로 전/후 연도가 같은 generation

      two_year_backward_consensus
        직전 2개 연도가 같은 generation

      two_year_forward_consensus
        직후 2개 연도가 같은 generation

    moderate:
      one_adjacent_year
        바로 붙은 한 연도만 generation evidence 보유

    conflict:
      ±2년 범위에 four/six가 모두 존재

    none:
      근접 generation evidence 없음
    """

    observations = [
        previous_2,
        previous_1,
        next_1,
        next_2,
    ]

    supported = {
        generation
        for generation in observations
        if generation
        in SUPPORTED_GENERATIONS
    }

    if (
        "conflict"
        in observations
    ):
        return (
            "",
            "",
            "conflict",
            (
                "same_code_has_conflicting_"
                "generation_within_year"
            ),
        )

    if len(
        supported
    ) > 1:
        return (
            "",
            "",
            "conflict",
            (
                "four_year_and_six_year_"
                "both_present_within_"
                "two_year_window"
            ),
        )

    if not supported:
        return (
            "",
            "",
            "no_evidence",
            (
                "no_same_code_generation_"
                "evidence_within_two_year_window"
            ),
        )

    generation = next(
        iter(
            supported
        )
    )

    if (
        previous_1 == generation
        and next_1 == generation
    ):
        return (
            generation,
            "strong",
            "candidate",
            (
                "immediate_neighbors_consensus"
            ),
        )

    if (
        previous_1 == generation
        and previous_2 == generation
    ):
        return (
            generation,
            "strong",
            "candidate",
            (
                "two_year_backward_consensus"
            ),
        )

    if (
        next_1 == generation
        and next_2 == generation
    ):
        return (
            generation,
            "strong",
            "candidate",
            (
                "two_year_forward_consensus"
            ),
        )

    if previous_1 == generation:
        return (
            generation,
            "moderate",
            "candidate",
            (
                "previous_adjacent_year_support"
            ),
        )

    if next_1 == generation:
        return (
            generation,
            "moderate",
            "candidate",
            (
                "next_adjacent_year_support"
            ),
        )

    return (
        "",
        "",
        "weak_only",
        (
            "generation_evidence_exists_only_"
            "two_years_away"
        ),
    )


def analyze(
    rows: list[dict[str, str]],
) -> list[dict[str, str]]:
    code_year_index = (
        build_code_year_index(
            rows
        )
    )

    unresolved_rows = [
        row
        for row in rows
        if row.get(
            "generation_evidence",
            "",
        ).strip()
        == "unresolved"
    ]

    output_rows: list[
        dict[str, str]
    ] = []

    for row in unresolved_rows:
        year = int(
            row[
                "academic_year"
            ]
        )

        course_code = (
            row.get(
                "course_code",
                "",
            ).strip()
        )

        if course_code:
            (
                previous_1,
                previous_1_reason,
            ) = evidence_at_year(
                code_year_index,
                course_code,
                year - 1,
            )

            (
                previous_2,
                previous_2_reason,
            ) = evidence_at_year(
                code_year_index,
                course_code,
                year - 2,
            )

            (
                next_1,
                next_1_reason,
            ) = evidence_at_year(
                code_year_index,
                course_code,
                year + 1,
            )

            (
                next_2,
                next_2_reason,
            ) = evidence_at_year(
                code_year_index,
                course_code,
                year + 2,
            )

        else:
            previous_1 = ""
            previous_1_reason = ""
            previous_2 = ""
            previous_2_reason = ""
            next_1 = ""
            next_1_reason = ""
            next_2 = ""
            next_2_reason = ""

        (
            candidate,
            strength,
            status,
            reason,
        ) = classify_continuity(
            target_year=year,
            previous_1=previous_1,
            previous_2=previous_2,
            next_1=next_1,
            next_2=next_2,
        )

        four_years: list[
            int
        ] = []

        six_years: list[
            int
        ] = []

        for offset, generation in [
            (
                -2,
                previous_2,
            ),
            (
                -1,
                previous_1,
            ),
            (
                1,
                next_1,
            ),
            (
                2,
                next_2,
            ),
        ]:
            if generation == "four_year":
                four_years.append(
                    year
                    + offset
                )

            elif generation == "six_year":
                six_years.append(
                    year
                    + offset
                )

        output_rows.append(
            {
                "academic_year": (
                    str(
                        year
                    )
                ),
                "grade": (
                    row.get(
                        "grade",
                        "",
                    )
                ),
                "semester": (
                    row.get(
                        "semester",
                        "",
                    )
                ),
                "course_name": (
                    row.get(
                        "course_name",
                        "",
                    )
                ),
                "course_code": (
                    course_code
                ),
                "completion_type": (
                    row.get(
                        "completion_type",
                        "",
                    )
                ),
                "credits": (
                    row.get(
                        "credits",
                        "",
                    )
                ),
                "current_generation": (
                    "unresolved"
                ),
                "previous_1_year": (
                    year_text(
                        previous_1,
                        year - 1,
                    )
                ),
                "previous_1_generation": (
                    previous_1
                ),
                "previous_1_reason": (
                    previous_1_reason
                ),
                "previous_2_year": (
                    year_text(
                        previous_2,
                        year - 2,
                    )
                ),
                "previous_2_generation": (
                    previous_2
                ),
                "previous_2_reason": (
                    previous_2_reason
                ),
                "next_1_year": (
                    year_text(
                        next_1,
                        year + 1,
                    )
                ),
                "next_1_generation": (
                    next_1
                ),
                "next_1_reason": (
                    next_1_reason
                ),
                "next_2_year": (
                    year_text(
                        next_2,
                        year + 2,
                    )
                ),
                "next_2_generation": (
                    next_2
                ),
                "next_2_reason": (
                    next_2_reason
                ),
                "supporting_four_years": (
                    joined_years(
                        four_years
                    )
                ),
                "supporting_six_years": (
                    joined_years(
                        six_years
                    )
                ),
                "continuity_candidate": (
                    candidate
                ),
                "continuity_strength": (
                    strength
                ),
                "continuity_status": (
                    status
                ),
                "continuity_reason": (
                    reason
                ),
            }
        )

    return output_rows


def write_report(
    path: Path,
    rows: list[dict[str, str]],
) -> None:
    status_counts: dict[
        str,
        int,
    ] = defaultdict(
        int
    )

    strength_counts: dict[
        str,
        int,
    ] = defaultdict(
        int
    )

    generation_counts: dict[
        str,
        int,
    ] = defaultdict(
        int
    )

    for row in rows:
        status_counts[
            row[
                "continuity_status"
            ]
        ] += 1

        if row[
            "continuity_strength"
        ]:
            strength_counts[
                row[
                    "continuity_strength"
                ]
            ] += 1

        if row[
            "continuity_candidate"
        ]:
            generation_counts[
                row[
                    "continuity_candidate"
                ]
            ] += 1

    strong_rows = [
        row
        for row in rows
        if row[
            "continuity_status"
        ]
        == "candidate"
        and row[
            "continuity_strength"
        ]
        == "strong"
    ]

    moderate_rows = [
        row
        for row in rows
        if row[
            "continuity_status"
        ]
        == "candidate"
        and row[
            "continuity_strength"
        ]
        == "moderate"
    ]

    conflict_rows = [
        row
        for row in rows
        if row[
            "continuity_status"
        ]
        == "conflict"
    ]

    lines = [
        (
            "Curriculum generation "
            "continuity audit"
        ),
        "=============================================",
        "",
        (
            "unresolved rows analyzed: "
            f"{len(rows)}"
        ),
        "",
        "Candidate summary",
        "-----------------",
        (
            "four_year: "
            f"{generation_counts['four_year']}"
        ),
        (
            "six_year: "
            f"{generation_counts['six_year']}"
        ),
        (
            "strong: "
            f"{strength_counts['strong']}"
        ),
        (
            "moderate: "
            f"{strength_counts['moderate']}"
        ),
        (
            "conflict: "
            f"{status_counts['conflict']}"
        ),
        (
            "weak_only: "
            f"{status_counts['weak_only']}"
        ),
        (
            "no_evidence: "
            f"{status_counts['no_evidence']}"
        ),
        "",
        "STRONG CANDIDATES",
        "-----------------",
        (
            "count: "
            f"{len(strong_rows)}"
        ),
    ]

    for row in strong_rows:
        lines.append(
            (
                f"{row['academic_year']} "
                f"| {row['grade']}-"
                f"{row['semester']} "
                f"| {row['course_code']} "
                f"| {row['course_name']} "
                f"| candidate="
                f"{row['continuity_candidate']} "
                f"| reason="
                f"{row['continuity_reason']} "
                f"| four_years="
                f"{row['supporting_four_years'] or '-'} "
                f"| six_years="
                f"{row['supporting_six_years'] or '-'}"
            )
        )

    lines.extend(
        [
            "",
            "MODERATE CANDIDATES",
            "-------------------",
            (
                "count: "
                f"{len(moderate_rows)}"
            ),
        ]
    )

    for row in moderate_rows:
        lines.append(
            (
                f"{row['academic_year']} "
                f"| {row['grade']}-"
                f"{row['semester']} "
                f"| {row['course_code']} "
                f"| {row['course_name']} "
                f"| candidate="
                f"{row['continuity_candidate']} "
                f"| reason="
                f"{row['continuity_reason']} "
                f"| four_years="
                f"{row['supporting_four_years'] or '-'} "
                f"| six_years="
                f"{row['supporting_six_years'] or '-'}"
            )
        )

    lines.extend(
        [
            "",
            "CONFLICTS",
            "---------",
            (
                "count: "
                f"{len(conflict_rows)}"
            ),
        ]
    )

    for row in conflict_rows:
        lines.append(
            (
                f"{row['academic_year']} "
                f"| {row['grade']}-"
                f"{row['semester']} "
                f"| {row['course_code']} "
                f"| {row['course_name']} "
                f"| reason="
                f"{row['continuity_reason']} "
                f"| four_years="
                f"{row['supporting_four_years'] or '-'} "
                f"| six_years="
                f"{row['supporting_six_years'] or '-'}"
            )
        )

    lines.extend(
        [
            "",
            "Rules",
            "-----",
            (
                "1. Only rows currently classified "
                "as unresolved are analyzed."
            ),
            (
                "2. Course codes are never assigned "
                "a global generation."
            ),
            (
                "3. Only the same course code within "
                "two academic years before or after "
                "the target row is inspected."
            ),
            (
                "4. four_year and six_year row "
                "evidence may support continuity; "
                "ambiguous, unresolved, and both do "
                "not."
            ),
            (
                "5. If four-year and six-year "
                "evidence both occur within the "
                "two-year window, the result is "
                "conflict."
            ),
            (
                "6. Strong evidence requires either "
                "both immediate neighbors to agree "
                "or two consecutive years on one "
                "side to agree."
            ),
            (
                "7. One immediately adjacent year "
                "alone is reported only as a "
                "moderate candidate."
            ),
            (
                "8. Evidence existing only two years "
                "away is not assigned a generation "
                "candidate."
            ),
            (
                "9. This audit does not modify row "
                "generation evidence, lineage, "
                "baseline, seed, or database data."
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
    source_path = (
        row_evidence_path()
    )

    if not source_path.exists():
        raise FileNotFoundError(
            "row evidence가 없습니다: "
            f"{source_path}\n"
            "먼저 다음 명령을 실행하세요:\n"
            "python -m "
            "scripts.curriculum."
            "analyze_curriculum_generation_rows"
        )

    source_rows = read_csv_rows(
        source_path
    )

    output_rows = analyze(
        source_rows
    )

    csv_path = (
        output_csv_path()
    )

    report_path = (
        output_report_path()
    )

    write_csv(
        csv_path,
        output_rows,
    )

    write_report(
        report_path,
        output_rows,
    )

    print()
    print(
        "Curriculum generation continuity audit"
    )
    print(
        "--------------------------------------"
    )
    print(
        f"unresolved rows: {len(output_rows)}"
    )
    print(
        f"audit:  {csv_path}"
    )
    print(
        f"report: {report_path}"
    )


if __name__ == "__main__":
    main()
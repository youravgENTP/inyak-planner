from __future__ import annotations

import csv
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

from scripts.common.data_paths import (
    CURRICULUM_RECONCILED_DIR,
    EXTRACTED_CURRICULUM_DIR,
)


SUPPORTED_GENERATIONS = {
    "four_year",
    "six_year",
}

SUPPORTED_RELATION_TYPES = {
    "substitute",
    "equivalent",
}

OUTPUT_COLUMNS = [
    "academic_year",
    "grade",
    "semester",
    "course_name",
    "course_code",
    "decision_status",

    "relation_found",
    "relation_type",
    "relation_role",
    "relation_source_years",
    "relation_designation_year",

    "counterpart_code",
    "counterpart_name",

    "counterpart_same_year_generation",
    "counterpart_same_year_status",

    "counterpart_previous_year_generation",
    "counterpart_previous_year_status",

    "counterpart_next_year_generation",
    "counterpart_next_year_status",

    "supporting_four_years",
    "supporting_six_years",

    "relation_candidate",
    "relation_status",
    "relation_strength",
    "relation_reason",
]


@dataclass(frozen=True)
class Relation:
    source_years: tuple[int, ...]
    relation_type: str

    old_course_code: str
    old_course_name: str

    new_course_code: str
    new_course_name: str

    designation_year: str
    needs_review: str


def comparison_directory() -> Path:
    return CURRICULUM_RECONCILED_DIR


def decisions_path() -> Path:
    return (
        comparison_directory()
        / "curriculum_generation_decisions.csv"
    )


def output_csv_path() -> Path:
    return (
        comparison_directory()
        / "curriculum_generation_relation_audit.csv"
    )


def output_report_path() -> Path:
    return (
        comparison_directory()
        / "curriculum_generation_relation_audit_report.txt"
    )


def relation_path(
    year: int,
) -> Path:
    return (
        EXTRACTED_CURRICULUM_DIR
        / str(year)
        / "course_relations.csv"
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


def available_relation_years() -> list[int]:
    years: list[int] = []

    if not EXTRACTED_CURRICULUM_DIR.exists():
        return years

    for child in (
        EXTRACTED_CURRICULUM_DIR.iterdir()
    ):
        if not child.is_dir():
            continue

        try:
            year = int(
                child.name
            )
        except ValueError:
            continue

        if relation_path(
            year
        ).exists():
            years.append(
                year
            )

    return sorted(
        years
    )

def load_relations() -> list[Relation]:
    grouped: dict[
        tuple[
            str,
            str,
            str,
            str,
        ],
        dict[str, object],
    ] = {}

    for year in available_relation_years():
        rows = read_csv_rows(
            relation_path(
                year
            )
        )

        for row in rows:
            relation_type = (
                row.get(
                    "relation_type",
                    "",
                ).strip()
            )

            if relation_type not in (
                SUPPORTED_RELATION_TYPES
            ):
                continue

            old_code = (
                row.get(
                    "old_course_code",
                    "",
                ).strip()
            )

            new_code = (
                row.get(
                    "new_course_code",
                    "",
                ).strip()
            )

            if (
                not old_code
                or not new_code
            ):
                continue

            designation_year = (
                row.get(
                    "designation_year",
                    "",
                ).strip()
            )

            key = (
                relation_type,
                old_code,
                new_code,
                designation_year,
            )

            if key not in grouped:
                grouped[key] = {
                    "source_years": set(),
                    "relation_type": (
                        relation_type
                    ),
                    "old_course_code": (
                        old_code
                    ),
                    "old_course_name": (
                        row.get(
                            "old_course_name",
                            "",
                        ).strip()
                    ),
                    "new_course_code": (
                        new_code
                    ),
                    "new_course_name": (
                        row.get(
                            "new_course_name",
                            "",
                        ).strip()
                    ),
                    "designation_year": (
                        designation_year
                    ),
                    "needs_review_values": set(),
                }

            grouped[
                key
            ][
                "source_years"
            ].add(
                year
            )

            needs_review = (
                row.get(
                    "needs_review",
                    "",
                ).strip()
            )

            if needs_review:
                grouped[
                    key
                ][
                    "needs_review_values"
                ].add(
                    needs_review
                )

    relations: list[
        Relation
    ] = []

    for item in grouped.values():
        source_years = tuple(
            sorted(
                item[
                    "source_years"
                ]
            )
        )

        needs_review_values = (
            item[
                "needs_review_values"
            ]
        )

        needs_review = (
            "yes"
            if "yes"
            in needs_review_values
            else "no"
        )

        relations.append(
            Relation(
                source_years=(
                    source_years
                ),
                relation_type=(
                    str(
                        item[
                            "relation_type"
                        ]
                    )
                ),
                old_course_code=(
                    str(
                        item[
                            "old_course_code"
                        ]
                    )
                ),
                old_course_name=(
                    str(
                        item[
                            "old_course_name"
                        ]
                    )
                ),
                new_course_code=(
                    str(
                        item[
                            "new_course_code"
                        ]
                    )
                ),
                new_course_name=(
                    str(
                        item[
                            "new_course_name"
                        ]
                    )
                ),
                designation_year=(
                    str(
                        item[
                            "designation_year"
                        ]
                    )
                ),
                needs_review=(
                    needs_review
                ),
            )
        )

    return relations


def build_confirmed_index(
    rows: list[dict[str, str]],
) -> dict[
    tuple[
        int,
        str,
    ],
    set[str],
]:
    index: dict[
        tuple[
            int,
            str,
        ],
        set[str],
    ] = defaultdict(
        set
    )

    for row in rows:
        if (
            row.get(
                "decision_status",
                "",
            ).strip()
            != "confirmed"
        ):
            continue

        generation = (
            row.get(
                "provisional_generation",
                "",
            ).strip()
        )

        if generation not in (
            SUPPORTED_GENERATIONS
        ):
            continue

        code = (
            row.get(
                "course_code",
                "",
            ).strip()
        )

        if not code:
            continue

        year = int(
            row[
                "academic_year"
            ]
        )

        index[
            (
                year,
                code,
            )
        ].add(
            generation
        )

    return dict(
        index
    )


def generation_at(
    index: dict[
        tuple[
            int,
            str,
        ],
        set[str],
    ],
    year: int,
    code: str,
) -> tuple[
    str,
    str,
]:
    generations = index.get(
        (
            year,
            code,
        ),
        set(),
    )

    if not generations:
        return (
            "",
            "none",
        )

    if len(
        generations
    ) > 1:
        return (
            "conflict",
            "conflict",
        )

    generation = next(
        iter(
            generations
        )
    )

    return (
        generation,
        "confirmed",
    )


def applicable_relations(
    course_code: str,
    relations: list[Relation],
) -> list[
    tuple[
        Relation,
        str,
        str,
        str,
    ]
]:
    """
    반환:
      relation
      target_role
      counterpart_code
      counterpart_name

    substitute:
      old -> new 방향만 generation propagation 허용.
      즉 target이 new일 때 old를 evidence로 본다.

    equivalent:
      양방향 허용.
    """

    results: list[
        tuple[
            Relation,
            str,
            str,
            str,
        ]
    ] = []

    for relation in relations:
        if (
            relation.relation_type
            == "substitute"
        ):
            if (
                course_code
                != relation.new_course_code
            ):
                continue

            results.append(
                (
                    relation,
                    "new",
                    relation.old_course_code,
                    relation.old_course_name,
                )
            )

            continue

        if (
            relation.relation_type
            == "equivalent"
        ):
            if (
                course_code
                == relation.old_course_code
            ):
                results.append(
                    (
                        relation,
                        "old",
                        relation.new_course_code,
                        relation.new_course_name,
                    )
                )

            elif (
                course_code
                == relation.new_course_code
            ):
                results.append(
                    (
                        relation,
                        "new",
                        relation.old_course_code,
                        relation.old_course_name,
                    )
                )

    return results


def classify_relation_evidence(
    same_generation: str,
    previous_generation: str,
    next_generation: str,
) -> tuple[
    str,
    str,
    str,
    str,
]:
    observations = [
        same_generation,
        previous_generation,
        next_generation,
    ]

    if (
        "conflict"
        in observations
    ):
        return (
            "",
            "conflict",
            "",
            (
                "counterpart_has_"
                "within_year_conflict"
            ),
        )

    supported = {
        generation
        for generation in observations
        if generation
        in SUPPORTED_GENERATIONS
    }

    if len(
        supported
    ) > 1:
        return (
            "",
            "conflict",
            "",
            (
                "counterpart_supports_"
                "both_generations_within_"
                "one_year_window"
            ),
        )

    if not supported:
        return (
            "",
            "no_evidence",
            "",
            (
                "no_confirmed_counterpart_"
                "generation_within_"
                "one_year_window"
            ),
        )

    generation = next(
        iter(
            supported
        )
    )

    if (
        same_generation
        == generation
    ):
        return (
            generation,
            "candidate",
            "strong",
            (
                "confirmed_counterpart_"
                "same_year"
            ),
        )

    if (
        previous_generation
        == generation
        and next_generation
        == generation
    ):
        return (
            generation,
            "candidate",
            "strong",
            (
                "confirmed_counterpart_"
                "adjacent_year_consensus"
            ),
        )

    return (
        generation,
        "candidate",
        "moderate",
        (
            "confirmed_counterpart_"
            "single_adjacent_year"
        ),
    )


def analyze_relation(
    target: dict[str, str],
    relation: Relation,
    target_role: str,
    counterpart_code: str,
    counterpart_name: str,
    confirmed_index: dict[
        tuple[
            int,
            str,
        ],
        set[str],
    ],
) -> dict[str, str]:
    year = int(
        target[
            "academic_year"
        ]
    )

    (
        same_generation,
        same_status,
    ) = generation_at(
        confirmed_index,
        year,
        counterpart_code,
    )

    (
        previous_generation,
        previous_status,
    ) = generation_at(
        confirmed_index,
        year - 1,
        counterpart_code,
    )

    (
        next_generation,
        next_status,
    ) = generation_at(
        confirmed_index,
        year + 1,
        counterpart_code,
    )

    (
        candidate,
        relation_status,
        strength,
        reason,
    ) = classify_relation_evidence(
        same_generation=(
            same_generation
        ),
        previous_generation=(
            previous_generation
        ),
        next_generation=(
            next_generation
        ),
    )

    four_years: list[str] = []
    six_years: list[str] = []

    for evidence_year, generation in [
        (
            year - 1,
            previous_generation,
        ),
        (
            year,
            same_generation,
        ),
        (
            year + 1,
            next_generation,
        ),
    ]:
        if generation == "four_year":
            four_years.append(
                str(
                    evidence_year
                )
            )

        elif generation == "six_year":
            six_years.append(
                str(
                    evidence_year
                )
            )

    return {
        "academic_year": (
            target[
                "academic_year"
            ]
        ),
        "grade": (
            target.get(
                "grade",
                "",
            )
        ),
        "semester": (
            target.get(
                "semester",
                "",
            )
        ),
        "course_name": (
            target.get(
                "course_name",
                "",
            )
        ),
        "course_code": (
            target.get(
                "course_code",
                "",
            )
        ),
        "decision_status": (
            target.get(
                "decision_status",
                "",
            )
        ),

        "relation_found": (
            "yes"
        ),
        "relation_type": (
            relation.relation_type
        ),
        "relation_role": (
            target_role
        ),
        "relation_source_years": (
            ";".join(
                str(
                    year
                )
                for year
                in relation.source_years
            )
        ),
        "relation_designation_year": (
            relation.designation_year
        ),

        "counterpart_code": (
            counterpart_code
        ),
        "counterpart_name": (
            counterpart_name
        ),

        "counterpart_same_year_generation": (
            same_generation
        ),
        "counterpart_same_year_status": (
            same_status
        ),

        "counterpart_previous_year_generation": (
            previous_generation
        ),
        "counterpart_previous_year_status": (
            previous_status
        ),

        "counterpart_next_year_generation": (
            next_generation
        ),
        "counterpart_next_year_status": (
            next_status
        ),

        "supporting_four_years": (
            ";".join(
                four_years
            )
        ),
        "supporting_six_years": (
            ";".join(
                six_years
            )
        ),

        "relation_candidate": (
            candidate
        ),
        "relation_status": (
            relation_status
        ),
        "relation_strength": (
            strength
        ),
        "relation_reason": (
            reason
        ),
    }


def empty_relation_row(
    target: dict[str, str],
) -> dict[str, str]:
    row = {
        column: ""
        for column in OUTPUT_COLUMNS
    }

    row.update(
        {
            "academic_year": (
                target[
                    "academic_year"
                ]
            ),
            "grade": (
                target.get(
                    "grade",
                    "",
                )
            ),
            "semester": (
                target.get(
                    "semester",
                    "",
                )
            ),
            "course_name": (
                target.get(
                    "course_name",
                    "",
                )
            ),
            "course_code": (
                target.get(
                    "course_code",
                    "",
                )
            ),
            "decision_status": (
                target.get(
                    "decision_status",
                    "",
                )
            ),
            "relation_found": (
                "no"
            ),
            "relation_status": (
                "no_relation"
            ),
            "relation_reason": (
                "no_applicable_official_relation"
            ),
        }
    )

    return row


def analyze(
    decisions: list[dict[str, str]],
    relations: list[Relation],
) -> list[dict[str, str]]:
    confirmed_index = (
        build_confirmed_index(
            decisions
        )
    )

    unresolved_rows = [
        row
        for row in decisions
        if row.get(
            "decision_status",
            "",
        ).strip()
        == "unresolved"
    ]

    output_rows: list[
        dict[str, str]
    ] = []

    for target in unresolved_rows:
        course_code = (
            target.get(
                "course_code",
                "",
            ).strip()
        )

        if not course_code:
            output_rows.append(
                empty_relation_row(
                    target
                )
            )
            continue

        matches = (
            applicable_relations(
                course_code,
                relations,
            )
        )

        if not matches:
            output_rows.append(
                empty_relation_row(
                    target
                )
            )
            continue

        for (
            relation,
            target_role,
            counterpart_code,
            counterpart_name,
        ) in matches:
            output_rows.append(
                analyze_relation(
                    target=target,
                    relation=relation,
                    target_role=target_role,
                    counterpart_code=(
                        counterpart_code
                    ),
                    counterpart_name=(
                        counterpart_name
                    ),
                    confirmed_index=(
                        confirmed_index
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

    candidate_counts: dict[
        str,
        int,
    ] = defaultdict(
        int
    )

    for row in rows:
        status_counts[
            row[
                "relation_status"
            ]
        ] += 1

        if row[
            "relation_strength"
        ]:
            strength_counts[
                row[
                    "relation_strength"
                ]
            ] += 1

        if row[
            "relation_candidate"
        ]:
            candidate_counts[
                row[
                    "relation_candidate"
                ]
            ] += 1

    candidate_rows = [
        row
        for row in rows
        if row[
            "relation_status"
        ]
        == "candidate"
    ]

    conflict_rows = [
        row
        for row in rows
        if row[
            "relation_status"
        ]
        == "conflict"
    ]

    no_evidence_rows = [
        row
        for row in rows
        if row[
            "relation_status"
        ]
        in {
            "no_relation",
            "no_evidence",
        }
    ]

    lines = [
        (
            "Curriculum generation "
            "relation audit"
        ),
        "=============================================",
        "",
        (
            "relation audit rows: "
            f"{len(rows)}"
        ),
        "",
        "Candidate summary",
        "-----------------",
        (
            "four_year: "
            f"{candidate_counts['four_year']}"
        ),
        (
            "six_year: "
            f"{candidate_counts['six_year']}"
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
            "no_relation: "
            f"{status_counts['no_relation']}"
        ),
        (
            "no_evidence: "
            f"{status_counts['no_evidence']}"
        ),
        "",
        "CANDIDATES",
        "----------",
        (
            "count: "
            f"{len(candidate_rows)}"
        ),
    ]

    for row in candidate_rows:
        lines.append(
            (
                f"{row['academic_year']} "
                f"| {row['grade']}-"
                f"{row['semester']} "
                f"| {row['course_code']} "
                f"| {row['course_name']} "
                f"| relation="
                f"{row['relation_type']} "
                f"| counterpart="
                f"{row['counterpart_code']} "
                f"{row['counterpart_name']} "
                f"| candidate="
                f"{row['relation_candidate']} "
                f"| strength="
                f"{row['relation_strength']} "
                f"| reason="
                f"{row['relation_reason']}"
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
                f"| {row['course_code']} "
                f"| {row['course_name']} "
                f"| counterpart="
                f"{row['counterpart_code']} "
                f"| four_years="
                f"{row['supporting_four_years'] or '-'} "
                f"| six_years="
                f"{row['supporting_six_years'] or '-'}"
            )
        )

    lines.extend(
        [
            "",
            "NO USABLE RELATION EVIDENCE",
            "---------------------------",
            (
                "count: "
                f"{len(no_evidence_rows)}"
            ),
        ]
    )

    for row in no_evidence_rows:
        lines.append(
            (
                f"{row['academic_year']} "
                f"| {row['grade']}-"
                f"{row['semester']} "
                f"| {row['course_code']} "
                f"| {row['course_name']} "
                f"| status="
                f"{row['relation_status']}"
            )
        )

    lines.extend(
        [
            "",
            "Rules",
            "-----",
            (
                "1. Only currently unresolved "
                "decision rows are audited."
            ),
            (
                "2. Only confirmed counterpart "
                "generation evidence is used."
            ),
            (
                "3. substitute relations propagate "
                "only in the official old -> new "
                "direction."
            ),
            (
                "4. equivalent relations may be "
                "inspected in either direction."
            ),
            (
                "5. Only counterpart evidence from "
                "the same year or one adjacent year "
                "is inspected."
            ),
            (
                "6. Same-year confirmed counterpart "
                "evidence is strong."
            ),
            (
                "7. Matching confirmed evidence on "
                "both adjacent years is strong."
            ),
            (
                "8. A single adjacent confirmed year "
                "is moderate."
            ),
            (
                "9. four-year and six-year support "
                "together is conflict."
            ),
            (
                "10. No 2-hop relation propagation "
                "is performed."
            ),
            (
                "11. This audit does not modify "
                "decisions, baseline, seed, or DB."
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
        decisions_path()
    )

    if not source_path.exists():
        raise FileNotFoundError(
            "generation decision table이 없습니다: "
            f"{source_path}\n"
            "먼저 다음 명령을 실행하세요:\n"
            "python -m "
            "scripts.curriculum."
            "build_curriculum_generation_decisions"
        )

    decisions = read_csv_rows(
        source_path
    )

    relations = load_relations()

    output_rows = analyze(
        decisions,
        relations,
    )

    csv_path = output_csv_path()
    report_path = output_report_path()

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
        "Curriculum generation relation audit"
    )
    print(
        "------------------------------------"
    )
    print(
        f"official relations: {len(relations)}"
    )
    print(
        f"audit rows:         {len(output_rows)}"
    )
    print(
        f"csv:    {csv_path}"
    )
    print(
        f"report: {report_path}"
    )


if __name__ == "__main__":
    main()
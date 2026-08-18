from __future__ import annotations

import csv
import re
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

from scripts.common.data_paths import (
    EXTRACTED_CURRICULUM_DIR,
    EXTRACTED_CURRICULUM_FLOWCHARTS_DIR,
)


OUTPUT_COLUMNS = [
    "academic_year",
    "grade",
    "semester",
    "course_name",
    "course_code",
    "completion_type",
    "credits",

    # Direct row evidence
    "generation_evidence",
    "generation_evidence_reason",
    "in_4year_flowchart",
    "in_6year_flowchart",
    "grade_1_2_rule",
    "direct_4year_evidence",
    "direct_6year_evidence",
    "pdf_position_group_size",

    # Ambiguous partner / lineage evidence
    "partner_codes",
    "lineage_candidate",
    "lineage_pair_status",
    "lineage_reason",
    "previous_year",
    "previous_generation",
    "next_year",
    "next_generation",

    # courses.csv change metadata
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

    # Official relation evidence for this code
    "relation_as_old",
    "relation_as_new",
    "relation_types",
    "relation_counterpart_codes",
    "relation_counterpart_names",
    "relation_designation_years",
    "relation_source_years",
    "relation_needs_review",

    # Relation directly connecting ambiguous partners
    "partner_relation_found",
    "partner_relation_types",
    "partner_relation_counterparts",
    "partner_relation_designation_years",
    "partner_relation_source_years",

    # Diagnostic summary only
    "evidence_flags",
    "review_priority",
]


@dataclass(frozen=True)
class Relation:
    source_year: int
    relation_type: str
    old_course_code: str
    old_course_name: str
    new_course_code: str
    new_course_name: str
    designation_year: str
    needs_review: str
    review_reason: str


def normalize_course_name(
    course_name: str,
) -> str:
    return re.sub(
        r"\s+",
        "",
        course_name.strip(),
    )


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


def lineage_path() -> Path:
    return (
        comparison_directory()
        / "curriculum_generation_lineage.csv"
    )


def output_csv_path() -> Path:
    return (
        comparison_directory()
        / "curriculum_generation_evidence_bundle.csv"
    )


def output_report_path() -> Path:
    return (
        comparison_directory()
        / "curriculum_generation_evidence_bundle_report.txt"
    )


def curriculum_path(
    year: int,
) -> Path:
    return (
        EXTRACTED_CURRICULUM_DIR
        / str(year)
        / "courses.csv"
    )


def relations_path(
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


def optional_csv_rows(
    path: Path,
) -> list[dict[str, str]]:
    if not path.exists():
        return []

    return read_csv_rows(
        path
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
        int(
            row["academic_year"]
        ),
        int(
            row["grade"]
        ),
        int(
            row["semester"]
        ),
        row.get(
            "course_code",
            "",
        ).strip(),
        normalize_course_name(
            row["course_name"]
        ),
    )


def course_metadata_key(
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
        int(
            row["grade"]
        ),
        int(
            row["semester"]
        ),
        row.get(
            "course_code",
            "",
        ).strip(),
        normalize_course_name(
            row["course_name"]
        ),
    )


def load_lineage_index() -> dict[
    tuple[
        int,
        int,
        int,
        str,
        str,
    ],
    dict[str, str],
]:
    rows = optional_csv_rows(
        lineage_path()
    )

    return {
        row_key(
            row
        ): row
        for row in rows
    }


def load_course_metadata(
    years: set[int],
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

    for year in sorted(
        years
    ):
        path = curriculum_path(
            year
        )

        if not path.exists():
            continue

        for row in read_csv_rows(
            path
        ):
            key = course_metadata_key(
                year,
                row,
            )

            if key not in index:
                index[
                    key
                ] = row

    return index


def load_relations(
    years: set[int],
) -> list[Relation]:
    relations: list[
        Relation
    ] = []

    seen: set[
        tuple[
            str,
            str,
            str,
            str,
            str,
            str,
        ]
    ] = set()

    for year in sorted(
        years
    ):
        path = relations_path(
            year
        )

        if not path.exists():
            continue

        for row in read_csv_rows(
            path
        ):
            relation = Relation(
                source_year=year,
                relation_type=(
                    row.get(
                        "relation_type",
                        "",
                    ).strip()
                ),
                old_course_code=(
                    row.get(
                        "old_course_code",
                        "",
                    ).strip()
                ),
                old_course_name=(
                    row.get(
                        "old_course_name",
                        "",
                    ).strip()
                ),
                new_course_code=(
                    row.get(
                        "new_course_code",
                        "",
                    ).strip()
                ),
                new_course_name=(
                    row.get(
                        "new_course_name",
                        "",
                    ).strip()
                ),
                designation_year=(
                    row.get(
                        "designation_year",
                        "",
                    ).strip()
                ),
                needs_review=(
                    row.get(
                        "needs_review",
                        "",
                    ).strip()
                ),
                review_reason=(
                    row.get(
                        "review_reason",
                        "",
                    ).strip()
                ),
            )

            dedupe_key = (
                relation.relation_type,
                relation.old_course_code,
                relation.new_course_code,
                relation.designation_year,
                relation.old_course_name,
                relation.new_course_name,
            )

            if dedupe_key in seen:
                continue

            seen.add(
                dedupe_key
            )

            relations.append(
                relation
            )

    return relations


def build_relation_index(
    relations: list[Relation],
) -> dict[
    str,
    list[Relation],
]:
    index: dict[
        str,
        list[Relation],
    ] = defaultdict(
        list
    )

    for relation in relations:
        if relation.old_course_code:
            index[
                relation.old_course_code
            ].append(
                relation
            )

        if relation.new_course_code:
            index[
                relation.new_course_code
            ].append(
                relation
            )

    return dict(
        index
    )


def split_codes(
    value: str,
) -> list[str]:
    return [
        item.strip()
        for item in value.split(
            ";"
        )
        if item.strip()
    ]


def unique_join(
    values: list[str],
) -> str:
    return ";".join(
        sorted(
            {
                value
                for value in values
                if value
            }
        )
    )


def relation_role_counts(
    course_code: str,
    relations: list[Relation],
) -> tuple[int, int]:
    as_old = sum(
        relation.old_course_code
        == course_code
        for relation in relations
    )

    as_new = sum(
        relation.new_course_code
        == course_code
        for relation in relations
    )

    return (
        as_old,
        as_new,
    )


def counterpart_for(
    course_code: str,
    relation: Relation,
) -> tuple[str, str]:
    if (
        relation.old_course_code
        == course_code
    ):
        return (
            relation.new_course_code,
            relation.new_course_name,
        )

    return (
        relation.old_course_code,
        relation.old_course_name,
    )


def partner_relations(
    course_code: str,
    partner_codes: list[str],
    relations: list[Relation],
) -> list[Relation]:
    partner_set = set(
        partner_codes
    )

    output: list[
        Relation
    ] = []

    for relation in relations:
        pair = {
            relation.old_course_code,
            relation.new_course_code,
        }

        if (
            course_code
            in pair
            and bool(
                pair
                & partner_set
            )
        ):
            output.append(
                relation
            )

    return output


def evidence_flags(
    row: dict[str, str],
    lineage: dict[str, str] | None,
    metadata: dict[str, str] | None,
    relations: list[Relation],
    linked_partner_relations: list[
        Relation
    ],
) -> list[str]:
    flags: list[str] = []

    generation = row[
        "generation_evidence"
    ].strip()

    if generation in {
        "four_year",
        "six_year",
        "both",
    }:
        flags.append(
            "direct_generation_evidence"
        )

    if (
        row.get(
            "grade_1_2_rule",
            "",
        )
        == "yes"
    ):
        flags.append(
            "grade_1_2_rule"
        )

    if generation == "ambiguous":
        flags.append(
            "ambiguous_position"
        )

    if generation == "unresolved":
        flags.append(
            "no_direct_generation"
        )

    if lineage:
        candidate = lineage.get(
            "row_lineage_candidate",
            "",
        )

        if candidate in {
            "four_year",
            "six_year",
        }:
            flags.append(
                f"lineage_{candidate}"
            )

        pair_status = lineage.get(
            "pair_status",
            "",
        )

        if (
            pair_status
            and pair_status
            != "unresolved"
        ):
            flags.append(
                f"lineage_pair_{pair_status}"
            )

    if metadata:
        if metadata.get(
            "change_group",
            "",
        ).strip():
            flags.append(
                "course_change_group"
            )

        if metadata.get(
            "change_type",
            "",
        ).strip():
            flags.append(
                "course_change_type"
            )

        if metadata.get(
            "change_role",
            "",
        ).strip():
            flags.append(
                "course_change_role"
            )

        if metadata.get(
            "previous_grade",
            "",
        ).strip():
            flags.append(
                "previous_position_metadata"
            )

        if (
            metadata.get(
                "previous_credits",
                "",
            ).strip()
            or metadata.get(
                "previous_completion_type",
                "",
            ).strip()
        ):
            flags.append(
                "previous_attribute_metadata"
            )

    if relations:
        flags.append(
            "official_course_relation"
        )

    if linked_partner_relations:
        flags.append(
            "official_partner_relation"
        )

    if any(
        relation.needs_review.lower()
        == "yes"
        for relation in relations
    ):
        flags.append(
            "relation_needs_review"
        )

    return flags


def review_priority(
    row: dict[str, str],
    flags: list[str],
) -> str:
    generation = row[
        "generation_evidence"
    ].strip()

    if (
        generation
        == "ambiguous"
        and "official_partner_relation"
        in flags
    ):
        return "high"

    if (
        generation
        == "ambiguous"
        and any(
            flag.startswith(
                "lineage_"
            )
            for flag in flags
        )
    ):
        return "high"

    if (
        generation
        == "unresolved"
        and (
            "official_course_relation"
            in flags
            or "course_change_group"
            in flags
            or "course_change_role"
            in flags
        )
    ):
        return "high"

    if generation in {
        "ambiguous",
        "unresolved",
    }:
        return "medium"

    return "low"


def metadata_value(
    metadata: dict[str, str] | None,
    key: str,
) -> str:
    if not metadata:
        return ""

    return metadata.get(
        key,
        "",
    ).strip()


def lineage_value(
    lineage: dict[str, str] | None,
    key: str,
) -> str:
    if not lineage:
        return ""

    return lineage.get(
        key,
        "",
    ).strip()


def build_output_rows() -> list[
    dict[str, str]
]:
    row_evidence = read_csv_rows(
        row_evidence_path()
    )

    years = {
        int(
            row["academic_year"]
        )
        for row in row_evidence
    }

    lineage_index = (
        load_lineage_index()
    )

    metadata_index = (
        load_course_metadata(
            years
        )
    )

    all_relations = load_relations(
        years
    )

    relation_index = (
        build_relation_index(
            all_relations
        )
    )

    output_rows: list[
        dict[str, str]
    ] = []

    for row in row_evidence:
        key = row_key(
            row
        )

        course_code = row.get(
            "course_code",
            "",
        ).strip()

        lineage = (
            lineage_index.get(
                key
            )
        )

        metadata = (
            metadata_index.get(
                key
            )
        )

        relations = (
            relation_index.get(
                course_code,
                [],
            )
        )

        partner_codes = split_codes(
            lineage_value(
                lineage,
                "partner_codes",
            )
        )

        linked_partner_relations = (
            partner_relations(
                course_code,
                partner_codes,
                relations,
            )
        )

        (
            relation_as_old,
            relation_as_new,
        ) = relation_role_counts(
            course_code,
            relations,
        )

        counterparts = [
            counterpart_for(
                course_code,
                relation,
            )
            for relation in relations
        ]

        flags = evidence_flags(
            row=row,
            lineage=lineage,
            metadata=metadata,
            relations=relations,
            linked_partner_relations=(
                linked_partner_relations
            ),
        )

        partner_relation_counterparts: list[
            str
        ] = []

        for relation in (
            linked_partner_relations
        ):
            counterpart_code, _ = (
                counterpart_for(
                    course_code,
                    relation,
                )
            )

            partner_relation_counterparts.append(
                counterpart_code
            )

        output_rows.append(
            {
                "academic_year": (
                    row[
                        "academic_year"
                    ]
                ),
                "grade": row["grade"],
                "semester": (
                    row[
                        "semester"
                    ]
                ),
                "course_name": (
                    row[
                        "course_name"
                    ]
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

                "generation_evidence": (
                    row[
                        "generation_evidence"
                    ]
                ),
                (
                    "generation_evidence_reason"
                ): (
                    row.get(
                        "evidence_reason",
                        "",
                    )
                ),
                "in_4year_flowchart": (
                    row.get(
                        "in_4year_flowchart",
                        "",
                    )
                ),
                "in_6year_flowchart": (
                    row.get(
                        "in_6year_flowchart",
                        "",
                    )
                ),
                "grade_1_2_rule": (
                    row.get(
                        "grade_1_2_rule",
                        "",
                    )
                ),
                "direct_4year_evidence": (
                    row.get(
                        "direct_4year_evidence",
                        "",
                    )
                ),
                "direct_6year_evidence": (
                    row.get(
                        "direct_6year_evidence",
                        "",
                    )
                ),
                "pdf_position_group_size": (
                    row.get(
                        "pdf_position_group_size",
                        "",
                    )
                ),

                "partner_codes": (
                    lineage_value(
                        lineage,
                        "partner_codes",
                    )
                ),
                "lineage_candidate": (
                    lineage_value(
                        lineage,
                        "row_lineage_candidate",
                    )
                ),
                "lineage_pair_status": (
                    lineage_value(
                        lineage,
                        "pair_status",
                    )
                ),
                "lineage_reason": (
                    lineage_value(
                        lineage,
                        "lineage_reason",
                    )
                ),
                "previous_year": (
                    lineage_value(
                        lineage,
                        "previous_year",
                    )
                ),
                "previous_generation": (
                    lineage_value(
                        lineage,
                        "previous_generation",
                    )
                ),
                "next_year": (
                    lineage_value(
                        lineage,
                        "next_year",
                    )
                ),
                "next_generation": (
                    lineage_value(
                        lineage,
                        "next_generation",
                    )
                ),

                "change_group": (
                    metadata_value(
                        metadata,
                        "change_group",
                    )
                ),
                "change_type": (
                    metadata_value(
                        metadata,
                        "change_type",
                    )
                ),
                "change_role": (
                    metadata_value(
                        metadata,
                        "change_role",
                    )
                ),
                "change_effective_year": (
                    metadata_value(
                        metadata,
                        "change_effective_year",
                    )
                ),
                "change_note": (
                    metadata_value(
                        metadata,
                        "change_note",
                    )
                ),
                "previous_credits": (
                    metadata_value(
                        metadata,
                        "previous_credits",
                    )
                ),
                (
                    "previous_completion_type"
                ): (
                    metadata_value(
                        metadata,
                        "previous_completion_type",
                    )
                ),
                "previous_grade": (
                    metadata_value(
                        metadata,
                        "previous_grade",
                    )
                ),
                "previous_semester": (
                    metadata_value(
                        metadata,
                        "previous_semester",
                    )
                ),
                (
                    "attribute_change_effective_year"
                ): (
                    metadata_value(
                        metadata,
                        (
                            "attribute_change_"
                            "effective_year"
                        ),
                    )
                ),
                "attribute_change_note": (
                    metadata_value(
                        metadata,
                        "attribute_change_note",
                    )
                ),

                "relation_as_old": (
                    str(
                        relation_as_old
                    )
                ),
                "relation_as_new": (
                    str(
                        relation_as_new
                    )
                ),
                "relation_types": (
                    unique_join(
                        [
                            relation.relation_type
                            for relation
                            in relations
                        ]
                    )
                ),
                "relation_counterpart_codes": (
                    unique_join(
                        [
                            code
                            for (
                                code,
                                _
                            )
                            in counterparts
                        ]
                    )
                ),
                "relation_counterpart_names": (
                    unique_join(
                        [
                            name
                            for (
                                _,
                                name,
                            )
                            in counterparts
                        ]
                    )
                ),
                "relation_designation_years": (
                    unique_join(
                        [
                            relation.designation_year
                            for relation
                            in relations
                        ]
                    )
                ),
                "relation_source_years": (
                    unique_join(
                        [
                            str(
                                relation.source_year
                            )
                            for relation
                            in relations
                        ]
                    )
                ),
                "relation_needs_review": (
                    "yes"
                    if any(
                        relation.needs_review.lower()
                        == "yes"
                        for relation in relations
                    )
                    else (
                        "no"
                        if relations
                        else ""
                    )
                ),

                "partner_relation_found": (
                    "yes"
                    if linked_partner_relations
                    else "no"
                ),
                "partner_relation_types": (
                    unique_join(
                        [
                            relation.relation_type
                            for relation
                            in linked_partner_relations
                        ]
                    )
                ),
                (
                    "partner_relation_counterparts"
                ): (
                    unique_join(
                        partner_relation_counterparts
                    )
                ),
                (
                    "partner_relation_designation_years"
                ): (
                    unique_join(
                        [
                            relation.designation_year
                            for relation
                            in linked_partner_relations
                        ]
                    )
                ),
                (
                    "partner_relation_source_years"
                ): (
                    unique_join(
                        [
                            str(
                                relation.source_year
                            )
                            for relation
                            in linked_partner_relations
                        ]
                    )
                ),

                "evidence_flags": (
                    ";".join(
                        flags
                    )
                ),
                "review_priority": (
                    review_priority(
                        row,
                        flags,
                    )
                ),
            }
        )

    return output_rows


def write_csv(
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
            fieldnames=(
                OUTPUT_COLUMNS
            ),
        )

        writer.writeheader()

        writer.writerows(
            rows
        )


def group_key(
    row: dict[str, str],
) -> tuple[
    str,
    str,
    str,
    str,
]:
    return (
        row[
            "academic_year"
        ],
        row[
            "grade"
        ],
        row[
            "semester"
        ],
        normalize_course_name(
            row[
                "course_name"
            ]
        ),
    )


def write_report(
    path: Path,
    rows: list[
        dict[str, str]
    ],
) -> None:
    generation_counts: dict[
        str,
        int,
    ] = defaultdict(
        int
    )

    priority_counts: dict[
        str,
        int,
    ] = defaultdict(
        int
    )

    for row in rows:
        generation_counts[
            row[
                "generation_evidence"
            ]
        ] += 1

        priority_counts[
            row[
                "review_priority"
            ]
        ] += 1

    ambiguous_rows = [
        row
        for row in rows
        if row[
            "generation_evidence"
        ]
        == "ambiguous"
    ]

    ambiguous_groups: dict[
        tuple[
            str,
            str,
            str,
            str,
        ],
        list[
            dict[str, str]
        ],
    ] = defaultdict(
        list
    )

    for row in ambiguous_rows:
        ambiguous_groups[
            group_key(
                row
            )
        ].append(
            row
        )

    partner_relation_groups = [
        group
        for group in ambiguous_groups.values()
        if any(
            row[
                "partner_relation_found"
            ]
            == "yes"
            for row in group
        )
    ]

    change_metadata_groups = [
        group
        for group in ambiguous_groups.values()
        if any(
            (
                row["change_group"]
                or row["change_type"]
                or row["change_role"]
                or row["change_effective_year"]
            )
            for row in group
        )
    ]

    official_relation_rows = [
        row
        for row in rows
        if (
            int(
                row[
                    "relation_as_old"
                ]
            )
            + int(
                row[
                    "relation_as_new"
                ]
            )
        )
        > 0
    ]

    high_priority_rows = [
        row
        for row in rows
        if row[
            "review_priority"
        ]
        == "high"
    ]

    lines = [
        (
            "Curriculum generation "
            "evidence bundle report"
        ),
        "=============================================",
        "",
        (
            "rows analyzed: "
            f"{len(rows)}"
        ),
        "",
        "Generation evidence",
        "-------------------",
        (
            "four_year: "
            f"{generation_counts['four_year']}"
        ),
        (
            "six_year: "
            f"{generation_counts['six_year']}"
        ),
        (
            "both: "
            f"{generation_counts['both']}"
        ),
        (
            "ambiguous: "
            f"{generation_counts['ambiguous']}"
        ),
        (
            "unresolved: "
            f"{generation_counts['unresolved']}"
        ),
        "",
        "Integrated evidence",
        "-------------------",
        (
            "ambiguous groups: "
            f"{len(ambiguous_groups)}"
        ),
        (
            "ambiguous groups with direct "
            "partner relation: "
            f"{len(partner_relation_groups)}"
        ),
        (
            "ambiguous groups with courses.csv "
            "change metadata: "
            f"{len(change_metadata_groups)}"
        ),
        (
            "rows with official course relation: "
            f"{len(official_relation_rows)}"
        ),
        "",
        "Review priority",
        "---------------",
        (
            "high: "
            f"{priority_counts['high']}"
        ),
        (
            "medium: "
            f"{priority_counts['medium']}"
        ),
        (
            "low: "
            f"{priority_counts['low']}"
        ),
        "",
        "AMBIGUOUS GROUPS WITH PARTNER RELATION",
        "--------------------------------------",
        (
            "count: "
            f"{len(partner_relation_groups)}"
        ),
    ]

    for group in partner_relation_groups:
        first = group[0]

        lines.append(
            (
                f"{first['academic_year']} "
                f"| {first['grade']}-"
                f"{first['semester']} "
                f"| {first['course_name']}"
            )
        )

        for row in group:
            lines.append(
                (
                    "  "
                    f"{row['course_code']} "
                    f"| partner="
                    f"{row['partner_codes'] or '-'} "
                    f"| relation="
                    f"{row['partner_relation_types'] or '-'} "
                    f"| designation="
                    f"{row['partner_relation_designation_years'] or '-'} "
                    f"| lineage="
                    f"{row['lineage_candidate'] or '-'}"
                )
            )

    lines.extend(
        [
            "",
            "AMBIGUOUS GROUPS WITH CHANGE METADATA",
            "-------------------------------------",
            (
                "count: "
                f"{len(change_metadata_groups)}"
            ),
        ]
    )

    for group in change_metadata_groups:
        first = group[0]

        lines.append(
            (
                f"{first['academic_year']} "
                f"| {first['grade']}-"
                f"{first['semester']} "
                f"| {first['course_name']}"
            )
        )

        for row in group:
            lines.append(
                (
                    "  "
                    f"{row['course_code']} "
                    f"| group="
                    f"{row['change_group'] or '-'} "
                    f"| type="
                    f"{row['change_type'] or '-'} "
                    f"| role="
                    f"{row['change_role'] or '-'} "
                    f"| effective="
                    f"{row['change_effective_year'] or '-'}"
                )
            )

    lines.extend(
        [
            "",
            "HIGH PRIORITY ROWS",
            "------------------",
            (
                "count: "
                f"{len(high_priority_rows)}"
            ),
        ]
    )

    for row in high_priority_rows:
        lines.append(
            (
                f"{row['academic_year']} "
                f"| {row['grade']}-"
                f"{row['semester']} "
                f"| {row['course_code']} "
                f"| {row['course_name']} "
                f"| generation="
                f"{row['generation_evidence']} "
                f"| flags="
                f"{row['evidence_flags']}"
            )
        )

    lines.extend(
        [
            "",
            "Interpretation rules",
            "--------------------",
            (
                "1. This script collects evidence "
                "only. It does not assign a final "
                "curriculum generation."
            ),
            (
                "2. Flowchart evidence and the "
                "grade 1-2 rule remain the only "
                "current direct generation evidence."
            ),
            (
                "3. Lineage evidence is retained as "
                "a candidate, not a final assignment."
            ),
            (
                "4. substitute is directional and "
                "is preserved exactly as old -> new."
            ),
            (
                "5. equivalent relations are recorded "
                "as official relations but do not by "
                "themselves determine generation."
            ),
            (
                "6. A relation directly connecting "
                "two ambiguous partner codes is "
                "highlighted for manual review."
            ),
            (
                "7. Course-code prefixes are not "
                "used anywhere in this analysis."
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
    rows = build_output_rows()

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
        "Curriculum generation evidence bundle"
    )
    print(
        "-------------------------------------"
    )
    print(
        f"rows:   {len(rows)}"
    )
    print(
        f"bundle: {csv_path}"
    )
    print(
        f"report: {report_path}"
    )


if __name__ == "__main__":
    main()
from __future__ import annotations

import csv
import re
from collections import defaultdict
from pathlib import Path

from scripts.common.data_paths import (
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

    "generation_evidence",
    "generation_evidence_reason",
    "direct_4year_evidence",
    "direct_6year_evidence",
    "grade_1_2_rule",

    "near_generation_evidence",

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

    "decision_status",
    "provisional_generation",
    "decision_reason",
]


def comparison_directory() -> Path:
    return (
        EXTRACTED_CURRICULUM_FLOWCHARTS_DIR
        / "comparison"
    )


def evidence_bundle_path() -> Path:
    return (
        comparison_directory()
        / "curriculum_generation_evidence_bundle.csv"
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


def continuity_path() -> Path:
    return (
        comparison_directory()
        / "curriculum_generation_continuity_audit.csv"
    )


def output_csv_path() -> Path:
    return (
        comparison_directory()
        / "curriculum_generation_decisions.csv"
    )


def output_report_path() -> Path:
    return (
        comparison_directory()
        / "curriculum_generation_decisions_report.txt"
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


def normalize_course_name(
    course_name: str,
) -> str:
    return re.sub(
        r"\s+",
        "",
        course_name.strip(),
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
            row.get(
                "course_name",
                "",
            )
        ),
    )


def build_index(
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
        key = row_key(
            row
        )

        if key in index:
            raise RuntimeError(
                "decision join key가 중복됩니다: "
                f"{key}"
            )

        index[
            key
        ] = row

    return index


def yes(
    value: str,
) -> bool:
    return (
        value.strip().lower()
        == "yes"
    )


def official_relation_exists(
    row: dict[str, str],
) -> bool:
    relation_types = (
        row.get(
            "relation_types",
            "",
        ).strip()
    )

    relation_as_old = (
        row.get(
            "relation_as_old",
            "",
        ).strip()
    )

    relation_as_new = (
        row.get(
            "relation_as_new",
            "",
        ).strip()
    )

    return bool(
        relation_types
        or relation_as_old
        not in {
            "",
            "0",
        }
        or relation_as_new
        not in {
            "",
            "0",
        }
    )


def classify_decision(
    generation_evidence: str,
    lineage_candidate: str,
    lineage_pair_status: str,
    continuity_candidate: str,
    continuity_strength: str,
    continuity_status: str,
) -> tuple[
    str,
    str,
    str,
]:
    """
    Evidence hierarchy:

    confirmed
      Existing row-level generation evidence:
      four_year / six_year / both.
      This includes exact flowchart evidence,
      grade 1-2 rule, and approved near-name evidence.

    probable
      1. strong continuity for an otherwise unresolved row
      2. one-sided lineage candidate for an ambiguous row

    paired_unknown
      ambiguous duplicate-position row without usable
      row-level lineage generation evidence

    conflict
      continuity explicitly finds nearby four/six conflict

    unresolved
      insufficient evidence
    """

    generation_evidence = (
        generation_evidence.strip()
    )

    lineage_candidate = (
        lineage_candidate.strip()
    )

    lineage_pair_status = (
        lineage_pair_status.strip()
    )

    continuity_candidate = (
        continuity_candidate.strip()
    )

    continuity_strength = (
        continuity_strength.strip()
    )

    continuity_status = (
        continuity_status.strip()
    )

    if generation_evidence in {
        "four_year",
        "six_year",
        "both",
    }:
        return (
            "confirmed",
            generation_evidence,
            (
                "row_generation_evidence"
            ),
        )

    if continuity_status == "conflict":
        return (
            "conflict",
            "",
            (
                "continuity_generation_conflict"
            ),
        )

    if (
        generation_evidence
        == "unresolved"
        and continuity_strength
        == "strong"
        and continuity_candidate
        in {
            "four_year",
            "six_year",
        }
    ):
        return (
            "probable",
            continuity_candidate,
            (
                "strong_same_code_"
                "continuity_evidence"
            ),
        )

    if (
        generation_evidence
        == "ambiguous"
        and lineage_candidate
        in {
            "four_year",
            "six_year",
        }
    ):
        return (
            "probable",
            lineage_candidate,
            (
                "ambiguous_pair_"
                "one_sided_lineage_evidence"
            ),
        )

    if generation_evidence == "ambiguous":
        return (
            "paired_unknown",
            "",
            (
                "ambiguous_duplicate_pair_"
                "without_row_level_resolution"
            ),
        )

    return (
        "unresolved",
        "",
        (
            "insufficient_generation_evidence"
        ),
    )


def analyze() -> list[dict[str, str]]:
    bundle_rows = read_csv_rows(
        evidence_bundle_path()
    )

    row_evidence_rows = read_csv_rows(
        row_evidence_path()
    )

    lineage_rows = read_csv_rows(
        lineage_path()
    )

    continuity_rows = read_csv_rows(
        continuity_path()
    )

    row_evidence_index = build_index(
        row_evidence_rows
    )

    lineage_index = build_index(
        lineage_rows
    )

    continuity_index = build_index(
        continuity_rows
    )

    output_rows: list[
        dict[str, str]
    ] = []

    for bundle_row in bundle_rows:
        key = row_key(
            bundle_row
        )

        row_evidence = (
            row_evidence_index.get(
                key,
                {},
            )
        )

        lineage = (
            lineage_index.get(
                key,
                {},
            )
        )

        continuity = (
            continuity_index.get(
                key,
                {},
            )
        )

        generation_evidence = (
            bundle_row.get(
                "generation_evidence",
                "",
            ).strip()
        )

        lineage_candidate = (
            lineage.get(
                "row_lineage_candidate",
                "",
            ).strip()
        )

        lineage_pair_status = (
            lineage.get(
                "pair_status",
                "",
            ).strip()
        )

        continuity_candidate = (
            continuity.get(
                "continuity_candidate",
                "",
            ).strip()
        )

        continuity_strength = (
            continuity.get(
                "continuity_strength",
                "",
            ).strip()
        )

        continuity_status = (
            continuity.get(
                "continuity_status",
                "",
            ).strip()
        )

        (
            decision_status,
            provisional_generation,
            decision_reason,
        ) = classify_decision(
            generation_evidence=(
                generation_evidence
            ),
            lineage_candidate=(
                lineage_candidate
            ),
            lineage_pair_status=(
                lineage_pair_status
            ),
            continuity_candidate=(
                continuity_candidate
            ),
            continuity_strength=(
                continuity_strength
            ),
            continuity_status=(
                continuity_status
            ),
        )

        output_rows.append(
            {
                "academic_year": (
                    bundle_row[
                        "academic_year"
                    ]
                ),
                "grade": (
                    bundle_row[
                        "grade"
                    ]
                ),
                "semester": (
                    bundle_row[
                        "semester"
                    ]
                ),
                "course_name": (
                    bundle_row[
                        "course_name"
                    ]
                ),
                "course_code": (
                    bundle_row.get(
                        "course_code",
                        "",
                    )
                ),
                "completion_type": (
                    bundle_row.get(
                        "completion_type",
                        "",
                    )
                ),
                "credits": (
                    bundle_row.get(
                        "credits",
                        "",
                    )
                ),

                "generation_evidence": (
                    generation_evidence
                ),
                "generation_evidence_reason": (
                    bundle_row.get(
                        "generation_evidence_reason",
                        "",
                    )
                ),
                "direct_4year_evidence": (
                    bundle_row.get(
                        "direct_4year_evidence",
                        "",
                    )
                ),
                "direct_6year_evidence": (
                    bundle_row.get(
                        "direct_6year_evidence",
                        "",
                    )
                ),
                "grade_1_2_rule": (
                    bundle_row.get(
                        "grade_1_2_rule",
                        "",
                    )
                ),

                "near_generation_evidence": (
                    row_evidence.get(
                        "near_generation_evidence",
                        "",
                    )
                ),

                "lineage_candidate": (
                    lineage_candidate
                ),
                "lineage_pair_status": (
                    lineage_pair_status
                ),
                "lineage_reason": (
                    lineage.get(
                        "lineage_reason",
                        "",
                    )
                ),

                "continuity_candidate": (
                    continuity_candidate
                ),
                "continuity_strength": (
                    continuity_strength
                ),
                "continuity_status": (
                    continuity_status
                ),
                "continuity_reason": (
                    continuity.get(
                        "continuity_reason",
                        "",
                    )
                ),

                "official_relation": (
                    "yes"
                    if official_relation_exists(
                        bundle_row
                    )
                    else "no"
                ),
                "relation_types": (
                    bundle_row.get(
                        "relation_types",
                        "",
                    )
                ),
                "relation_counterpart_codes": (
                    bundle_row.get(
                        "relation_counterpart_codes",
                        "",
                    )
                ),
                "relation_counterpart_names": (
                    bundle_row.get(
                        "relation_counterpart_names",
                        "",
                    )
                ),

                "decision_status": (
                    decision_status
                ),
                "provisional_generation": (
                    provisional_generation
                ),
                "decision_reason": (
                    decision_reason
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

    generation_counts: dict[
        str,
        int,
    ] = defaultdict(
        int
    )

    for row in rows:
        status_counts[
            row[
                "decision_status"
            ]
        ] += 1

        if row[
            "provisional_generation"
        ]:
            generation_counts[
                row[
                    "provisional_generation"
                ]
            ] += 1

    conflict_rows = [
        row
        for row in rows
        if row[
            "decision_status"
        ]
        == "conflict"
    ]

    probable_rows = [
        row
        for row in rows
        if row[
            "decision_status"
        ]
        == "probable"
    ]

    paired_unknown_rows = [
        row
        for row in rows
        if row[
            "decision_status"
        ]
        == "paired_unknown"
    ]

    unresolved_rows = [
        row
        for row in rows
        if row[
            "decision_status"
        ]
        == "unresolved"
    ]

    lines = [
        (
            "Curriculum generation "
            "decision report"
        ),
        "=============================================",
        "",
        (
            "rows analyzed: "
            f"{len(rows)}"
        ),
        "",
        "Decision status",
        "---------------",
        (
            "confirmed: "
            f"{status_counts['confirmed']}"
        ),
        (
            "probable: "
            f"{status_counts['probable']}"
        ),
        (
            "paired_unknown: "
            f"{status_counts['paired_unknown']}"
        ),
        (
            "conflict: "
            f"{status_counts['conflict']}"
        ),
        (
            "unresolved: "
            f"{status_counts['unresolved']}"
        ),
        "",
        "Provisional generation",
        "----------------------",
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
        "",
        "PROBABLE",
        "--------",
        (
            "count: "
            f"{len(probable_rows)}"
        ),
    ]

    for row in probable_rows:
        lines.append(
            (
                f"{row['academic_year']} "
                f"| {row['grade']}-"
                f"{row['semester']} "
                f"| {row['course_code']} "
                f"| {row['course_name']} "
                f"| generation="
                f"{row['provisional_generation']} "
                f"| reason="
                f"{row['decision_reason']}"
            )
        )

    lines.extend(
        [
            "",
            "CONFLICT",
            "--------",
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
                f"| continuity="
                f"{row['continuity_reason']}"
            )
        )

    lines.extend(
        [
            "",
            "PAIRED UNKNOWN",
            "--------------",
            (
                "count: "
                f"{len(paired_unknown_rows)}"
            ),
        ]
    )

    for row in paired_unknown_rows:
        lines.append(
            (
                f"{row['academic_year']} "
                f"| {row['grade']}-"
                f"{row['semester']} "
                f"| {row['course_code']} "
                f"| {row['course_name']} "
                f"| lineage="
                f"{row['lineage_candidate'] or '-'}"
            )
        )

    lines.extend(
        [
            "",
            "UNRESOLVED",
            "----------",
            (
                "count: "
                f"{len(unresolved_rows)}"
            ),
        ]
    )

    for row in unresolved_rows:
        lines.append(
            (
                f"{row['academic_year']} "
                f"| {row['grade']}-"
                f"{row['semester']} "
                f"| {row['course_code']} "
                f"| {row['course_name']} "
                f"| continuity="
                f"{row['continuity_status'] or '-'} "
                f"| relation="
                f"{row['official_relation']}"
            )
        )

    lines.extend(
        [
            "",
            "Rules",
            "-----",
            (
                "1. confirmed means row-level "
                "generation evidence already exists."
            ),
            (
                "2. Exact flowchart evidence, "
                "grade 1-2 evidence, and approved "
                "near-name evidence remain confirmed."
            ),
            (
                "3. Strong continuity evidence is "
                "probable, not confirmed."
            ),
            (
                "4. One-sided lineage evidence for "
                "an ambiguous row is probable, "
                "not confirmed."
            ),
            (
                "5. An ambiguous duplicate row "
                "without row-level resolution remains "
                "paired_unknown."
            ),
            (
                "6. Explicit continuity disagreement "
                "between four-year and six-year "
                "evidence is conflict."
            ),
            (
                "7. Moderate continuity evidence does "
                "not assign a provisional generation."
            ),
            (
                "8. Official equivalent/substitute "
                "relations are retained as evidence "
                "but do not assign generation here."
            ),
            (
                "9. No course-code prefix is used."
            ),
            (
                "10. This table is still diagnostic. "
                "It does not modify baseline, seed, "
                "or database data."
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


def validate_sources() -> None:
    required_paths = [
        evidence_bundle_path(),
        row_evidence_path(),
        lineage_path(),
        continuity_path(),
    ]

    missing = [
        path
        for path in required_paths
        if not path.exists()
    ]

    if not missing:
        return

    formatted = "\n".join(
        f"  - {path}"
        for path in missing
    )

    raise FileNotFoundError(
        "필요한 generation evidence 파일이 없습니다:\n"
        f"{formatted}"
    )


def main() -> None:
    validate_sources()

    rows = analyze()

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
        "Curriculum generation decisions"
    )
    print(
        "-------------------------------"
    )
    print(
        f"rows:   {len(rows)}"
    )
    print(
        f"csv:    {csv_path}"
    )
    print(
        f"report: {report_path}"
    )


if __name__ == "__main__":
    main()
from __future__ import annotations

import csv
from collections import Counter
from pathlib import Path

from scripts.common.data_paths import (
    EXTRACTED_CURRICULUM_FLOWCHARTS_DIR,
)


OUTPUT_COLUMNS = [
    "academic_year",
    "promotion_status",
    "reconciliation_classification",
    "confidence",
    "source_kind",
    "course_name",
    "baseline_code",
    "seed_code",
    "baseline_grade",
    "seed_grade",
    "baseline_semester",
    "seed_semester",
    "baseline_completion_type",
    "seed_completion_type",
    "baseline_credits",
    "seed_credits",
    "changed_fields",
    "evidence",
    "promotion_reason",
]


def comparison_directory() -> Path:
    return (
        EXTRACTED_CURRICULUM_FLOWCHARTS_DIR
        / "comparison"
    )


def reconciliation_path() -> Path:
    return (
        comparison_directory()
        / "seed_reconciliation"
        / "seed_reconciliation_classification.csv"
    )


def output_directory() -> Path:
    return (
        comparison_directory()
        / "baseline_promotion_review"
    )


def output_csv_path() -> Path:
    return (
        output_directory()
        / "baseline_promotion_review.csv"
    )


def report_path() -> Path:
    return (
        output_directory()
        / "baseline_promotion_review_report.txt"
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


def classify_promotion_status(
    row: dict[str, str],
) -> tuple[str, str]:
    classification = (
        row.get(
            "classification",
            "",
        ).strip()
    )

    source_kind = (
        row.get(
            "source_kind",
            "",
        ).strip()
    )

    baseline_code = (
        row.get(
            "baseline_code",
            "",
        ).strip()
    )

    seed_code = (
        row.get(
            "seed_code",
            "",
        ).strip()
    )

    if (
        classification
        == "seed_wrong_or_suspect_code"
    ):
        return (
            "baseline_supported_seed_issue",
            (
                "Baseline code has stronger independent "
                "offering evidence; discrepancy belongs "
                "to seed review."
            ),
        )

    if (
        classification
        == "seed_missing_course"
    ):
        return (
            "baseline_supported_seed_issue",
            (
                "Baseline course has independent offering "
                "support and is missing from seed."
            ),
        )

    if (
        classification
        == "legitimate_post_baseline_transition"
    ):
        return (
            "baseline_supported_transition",
            (
                "Evidence supports preservation of the "
                "historical baseline while seed represents "
                "a later code or attribute state."
            ),
        )

    if (
        classification
        == "needs_manual_mapping"
    ):
        if (
            source_kind
            == "seed_only"
            and not baseline_code
        ):
            return (
                "seed_only_review",
                (
                    "No baseline row is being challenged "
                    "directly. The seed-only course requires "
                    "separate provenance review."
                ),
            )

        if baseline_code:
            return (
                "baseline_review_required",
                (
                    "The unresolved discrepancy directly "
                    "involves an included provisional "
                    "baseline row."
                ),
            )

        if (
            source_kind
            in {
                "baseline_only",
                "same_code_changed",
                "code_pair",
            }
        ):
            return (
                "baseline_review_required",
                (
                    "The unresolved discrepancy may affect "
                    "baseline course identity or historical "
                    "attributes."
                ),
            )

        return (
            "seed_only_review",
            (
                "No direct provisional-baseline identity "
                "challenge was found."
            ),
        )

    return (
        "baseline_review_required",
        (
            "Unknown reconciliation classification; "
            "manual review required before promotion."
        ),
    )


def make_output_row(
    row: dict[str, str],
) -> dict[str, str]:
    (
        status,
        reason,
    ) = classify_promotion_status(
        row
    )

    return {
        "academic_year": (
            row.get(
                "academic_year",
                "",
            )
        ),
        "promotion_status": (
            status
        ),
        "reconciliation_classification": (
            row.get(
                "classification",
                "",
            )
        ),
        "confidence": (
            row.get(
                "confidence",
                "",
            )
        ),
        "source_kind": (
            row.get(
                "source_kind",
                "",
            )
        ),
        "course_name": (
            row.get(
                "course_name",
                "",
            )
        ),
        "baseline_code": (
            row.get(
                "baseline_code",
                "",
            )
        ),
        "seed_code": (
            row.get(
                "seed_code",
                "",
            )
        ),
        "baseline_grade": (
            row.get(
                "baseline_grade",
                "",
            )
        ),
        "seed_grade": (
            row.get(
                "seed_grade",
                "",
            )
        ),
        "baseline_semester": (
            row.get(
                "baseline_semester",
                "",
            )
        ),
        "seed_semester": (
            row.get(
                "seed_semester",
                "",
            )
        ),
        "baseline_completion_type": (
            row.get(
                "baseline_completion_type",
                "",
            )
        ),
        "seed_completion_type": (
            row.get(
                "seed_completion_type",
                "",
            )
        ),
        "baseline_credits": (
            row.get(
                "baseline_credits",
                "",
            )
        ),
        "seed_credits": (
            row.get(
                "seed_credits",
                "",
            )
        ),
        "changed_fields": (
            row.get(
                "changed_fields",
                "",
            )
        ),
        "evidence": (
            row.get(
                "evidence",
                "",
            )
        ),
        "promotion_reason": (
            reason
        ),
    }


def sort_key(
    row: dict[str, str],
) -> tuple:
    status_order = {
        "baseline_review_required": 0,
        "baseline_supported_seed_issue": 1,
        "baseline_supported_transition": 2,
        "seed_only_review": 3,
    }

    return (
        status_order.get(
            row["promotion_status"],
            99,
        ),
        int(
            row["academic_year"]
        ),
        row["course_name"],
        row["baseline_code"],
        row["seed_code"],
    )


def build_report(
    rows: list[dict[str, str]],
) -> str:
    counts = Counter(
        row[
            "promotion_status"
        ]
        for row in rows
    )

    lines = [
        "Baseline promotion review",
        "=============================================",
        "",
        (
            "Purpose: separate unresolved baseline "
            "questions from seed-only reconciliation work."
        ),
        "",
        "SUMMARY",
        "-------",
    ]

    statuses = [
        "baseline_review_required",
        "baseline_supported_seed_issue",
        "baseline_supported_transition",
        "seed_only_review",
    ]

    for status in statuses:
        lines.append(
            f"{status}: {counts[status]}"
        )

    lines.extend(
        [
            "",
            "BASELINE REVIEW REQUIRED",
            "------------------------",
        ]
    )

    blockers = [
        row
        for row in rows
        if row[
            "promotion_status"
        ]
        == "baseline_review_required"
    ]

    if not blockers:
        lines.append(
            "(none)"
        )

    for row in blockers:
        baseline_code = (
            row[
                "baseline_code"
            ]
            or "-"
        )

        seed_code = (
            row[
                "seed_code"
            ]
            or "-"
        )

        lines.append(
            (
                f"{row['academic_year']} "
                f"| {row['course_name']} "
                f"| baseline={baseline_code} "
                f"| seed={seed_code} "
                f"| source={row['source_kind']} "
                f"| confidence={row['confidence']}"
            )
        )

        lines.append(
            (
                "    evidence: "
                f"{row['evidence']}"
            )
        )

    lines.extend(
        [
            "",
            "NON-BLOCKING BASELINE EVIDENCE",
            "------------------------------",
        ]
    )

    for row in rows:
        if row[
            "promotion_status"
        ] not in {
            "baseline_supported_seed_issue",
            "baseline_supported_transition",
        }:
            continue

        lines.append(
            (
                f"{row['academic_year']} "
                f"| {row['course_name']} "
                f"| {row['promotion_status']}"
            )
        )

    lines.extend(
        [
            "",
            "SEED-ONLY REVIEW",
            "----------------",
        ]
    )

    seed_only = [
        row
        for row in rows
        if row[
            "promotion_status"
        ]
        == "seed_only_review"
    ]

    if not seed_only:
        lines.append(
            "(none)"
        )

    for row in seed_only:
        seed_code = (
            row[
                "seed_code"
            ]
            or "-"
        )

        lines.append(
            (
                f"{row['academic_year']} "
                f"| {row['course_name']} "
                f"| seed={seed_code}"
            )
        )

    lines.extend(
        [
            "",
            "Interpretation",
            "--------------",
            (
                "1. Only baseline_review_required rows "
                "are treated as potential blockers to "
                "promoting the provisional baseline."
            ),
            (
                "2. baseline_supported_seed_issue rows "
                "strengthen or preserve the baseline and "
                "belong to later seed cleanup."
            ),
            (
                "3. baseline_supported_transition rows "
                "represent later operational state and do "
                "not alter the immutable historical baseline."
            ),
            (
                "4. seed_only_review rows are not assumed "
                "to belong to or be absent from the cohort "
                "baseline without additional evidence."
            ),
            (
                "5. No data files or databases are modified."
            ),
            "",
        ]
    )

    return "\n".join(
        lines
    )


def main() -> None:
    source = (
        reconciliation_path()
    )

    if not source.exists():
        raise FileNotFoundError(
            source
        )

    input_rows = read_csv_rows(
        source
    )

    output_rows = [
        make_output_row(
            row
        )
        for row in input_rows
    ]

    output_rows.sort(
        key=sort_key
    )

    output_directory().mkdir(
        parents=True,
        exist_ok=True,
    )

    write_csv(
        output_csv_path(),
        output_rows,
    )

    report = build_report(
        output_rows
    )

    report_path().write_text(
        report,
        encoding="utf-8",
    )

    counts = Counter(
        row[
            "promotion_status"
        ]
        for row in output_rows
    )

    print()
    print(
        "Baseline promotion review"
    )
    print(
        "-------------------------"
    )

    for status in [
        "baseline_review_required",
        "baseline_supported_seed_issue",
        "baseline_supported_transition",
        "seed_only_review",
    ]:
        print(
            f"{status}: "
            f"{counts[status]}"
        )

    print()
    print(
        f"report: {report_path()}"
    )


if __name__ == "__main__":
    main()
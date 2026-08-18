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

OUTPUT_COLUMNS = [
    "academic_year",
    "classification",
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
    "db_signal",
    "baseline_db_terms",
    "seed_db_terms",
    "exact_name_db_codes",
    "attribute_change_effective_year",
    "evidence",
    "recommended_action",
]


def comparison_directory() -> Path:
    return (
        EXTRACTED_CURRICULUM_FLOWCHARTS_DIR
        / "comparison"
    )


def diff_path() -> Path:
    return (
        comparison_directory()
        / "provisional_baseline_seed_diff"
        / "provisional_baseline_seed_diff.csv"
    )


def pair_audit_directory() -> Path:
    return (
        comparison_directory()
        / "provisional_baseline_seed_code_pair_audit"
    )


def pair_candidates_path() -> Path:
    return (
        pair_audit_directory()
        / "code_pair_candidates.csv"
    )


def unpaired_path() -> Path:
    return (
        pair_audit_directory()
        / "unpaired_differences.csv"
    )


def output_directory() -> Path:
    return (
        comparison_directory()
        / "seed_reconciliation"
    )


def output_csv_path() -> Path:
    return (
        output_directory()
        / "seed_reconciliation_classification.csv"
    )


def report_path() -> Path:
    return (
        output_directory()
        / "seed_reconciliation_report.txt"
    )


def seed_path(
    year: int,
) -> Path:
    return (
        CURRICULUM_SEED_DIR
        / f"curriculum_{year}.csv"
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


def normalize_name(
    text: str,
) -> str:
    return re.sub(
        r"\s+",
        "",
        text.strip(),
    )


def split_codes(
    value: str,
) -> set[str]:
    return {
        item.strip()
        for item
        in value.split(";")
        if item.strip()
    }


def first_db_year(
    db_terms: str,
) -> int | None:
    years = []

    for term in db_terms.split(";"):
        term = term.strip()

        if not term:
            continue

        match = re.match(
            r"^(\d{4})-[12]$",
            term,
        )

        if match:
            years.append(
                int(
                    match.group(1)
                )
            )

    if not years:
        return None

    return min(
        years
    )


def seed_metadata_index() -> dict[
    tuple[int, str],
    dict[str, str],
]:
    index = {}

    for year in TARGET_YEARS:
        path = seed_path(
            year
        )

        if not path.exists():
            raise FileNotFoundError(
                path
            )

        rows = read_csv_rows(
            path
        )

        for row in rows:
            code = (
                row.get(
                    "course_code",
                    "",
                ).strip()
            )

            if not code:
                continue

            key = (
                year,
                code,
            )

            if key in index:
                # 동일 코드가 seed 안에서 여러 행이라면
                # 자동 metadata 판정을 하지 않는다.
                index[key] = {}
                continue

            index[key] = row

    return index


def make_output_row(
    *,
    academic_year: int,
    classification: str,
    confidence: str,
    source_kind: str,
    course_name: str = "",
    baseline_code: str = "",
    seed_code: str = "",
    baseline_grade: str = "",
    seed_grade: str = "",
    baseline_semester: str = "",
    seed_semester: str = "",
    baseline_completion_type: str = "",
    seed_completion_type: str = "",
    baseline_credits: str = "",
    seed_credits: str = "",
    changed_fields: str = "",
    db_signal: str = "",
    baseline_db_terms: str = "",
    seed_db_terms: str = "",
    exact_name_db_codes: str = "",
    attribute_change_effective_year: str = "",
    evidence: str = "",
    recommended_action: str = "",
) -> dict[str, str]:
    return {
        "academic_year": str(
            academic_year
        ),
        "classification": (
            classification
        ),
        "confidence": (
            confidence
        ),
        "source_kind": (
            source_kind
        ),
        "course_name": (
            course_name
        ),
        "baseline_code": (
            baseline_code
        ),
        "seed_code": (
            seed_code
        ),
        "baseline_grade": (
            baseline_grade
        ),
        "seed_grade": (
            seed_grade
        ),
        "baseline_semester": (
            baseline_semester
        ),
        "seed_semester": (
            seed_semester
        ),
        "baseline_completion_type": (
            baseline_completion_type
        ),
        "seed_completion_type": (
            seed_completion_type
        ),
        "baseline_credits": (
            baseline_credits
        ),
        "seed_credits": (
            seed_credits
        ),
        "changed_fields": (
            changed_fields
        ),
        "db_signal": (
            db_signal
        ),
        "baseline_db_terms": (
            baseline_db_terms
        ),
        "seed_db_terms": (
            seed_db_terms
        ),
        "exact_name_db_codes": (
            exact_name_db_codes
        ),
        "attribute_change_effective_year": (
            attribute_change_effective_year
        ),
        "evidence": (
            evidence
        ),
        "recommended_action": (
            recommended_action
        ),
    }


def classify_pair_candidates(
    rows: list[dict[str, str]],
) -> list[dict[str, str]]:
    output = []

    for row in rows:
        year = int(
            row[
                "academic_year"
            ]
        )

        signal = (
            row.get(
                "chronology_signal",
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
            signal
            == "baseline_code_only_in_db"
        ):
            classification = (
                "seed_wrong_or_suspect_code"
            )

            confidence = "high"

            evidence = (
                "baseline_code_has_actual_offering_history;"
                "seed_code_has_no_actual_offering_history;"
                "same_name_unique_pair"
            )

            action = (
                "Review seed representative course_code. "
                "Do not change baseline."
            )

        elif (
            signal
            == "baseline_then_seed"
        ):
            classification = (
                "legitimate_post_baseline_transition"
            )

            confidence = "high"

            evidence = (
                "baseline_code_was_offered_first;"
                "seed_code_was_offered_only_later;"
                "same_name_unique_pair"
            )

            action = (
                "Preserve historical baseline code; "
                "keep later operational seed code if "
                "change metadata is recorded."
            )

        elif (
            signal
            == "seed_code_only_in_db"
        ):
            classification = (
                "needs_manual_mapping"
            )

            confidence = "high"

            evidence = (
                "baseline_plan_code_has_no_offering_history;"
                "seed_code_has_actual_offering_history;"
                "cannot_infer_historical_identity_from_name_alone"
            )

            action = (
                "Review planned curriculum code versus "
                "actual operational code. "
                "Do not automatically replace baseline code."
            )

        elif (
            signal
            == "seed_code_missing"
        ):
            classification = (
                "needs_manual_mapping"
            )

            confidence = "high"

            evidence = (
                "seed_course_code_is_blank;"
                "same_name_pair_exists"
            )

            action = (
                "Leave seed code blank until independent "
                "code evidence is confirmed."
            )

        else:
            classification = (
                "needs_manual_mapping"
            )

            confidence = "medium"

            evidence = (
                f"unresolved_pair_chronology:{signal}"
            )

            action = (
                "Manual review required."
            )

        output.append(
            make_output_row(
                academic_year=year,
                classification=(
                    classification
                ),
                confidence=confidence,
                source_kind=(
                    "code_pair"
                ),
                course_name=(
                    row.get(
                        "course_name",
                        "",
                    )
                ),
                baseline_code=(
                    baseline_code
                ),
                seed_code=(
                    seed_code
                ),
                baseline_grade=(
                    row.get(
                        "baseline_grade",
                        "",
                    )
                ),
                seed_grade=(
                    row.get(
                        "seed_grade",
                        "",
                    )
                ),
                baseline_semester=(
                    row.get(
                        "baseline_semester",
                        "",
                    )
                ),
                seed_semester=(
                    row.get(
                        "seed_semester",
                        "",
                    )
                ),
                baseline_completion_type=(
                    row.get(
                        "baseline_completion_type",
                        "",
                    )
                ),
                seed_completion_type=(
                    row.get(
                        "seed_completion_type",
                        "",
                    )
                ),
                baseline_credits=(
                    row.get(
                        "baseline_credits",
                        "",
                    )
                ),
                seed_credits=(
                    row.get(
                        "seed_credits",
                        "",
                    )
                ),
                db_signal=signal,
                baseline_db_terms=(
                    row.get(
                        "baseline_db_terms",
                        "",
                    )
                ),
                seed_db_terms=(
                    row.get(
                        "seed_db_terms",
                        "",
                    )
                ),
                exact_name_db_codes=(
                    row.get(
                        "seed_name_db_codes",
                        "",
                    )
                ),
                evidence=evidence,
                recommended_action=(
                    action
                ),
            )
        )

    return output


def classify_unpaired(
    rows: list[dict[str, str]],
) -> list[dict[str, str]]:
    output = []

    for row in rows:
        year = int(
            row[
                "academic_year"
            ]
        )

        side = (
            row.get(
                "side",
                "",
            ).strip()
        )

        code = (
            row.get(
                "course_code",
                "",
            ).strip()
        )

        name = (
            row.get(
                "course_name",
                "",
            ).strip()
        )

        db_terms = (
            row.get(
                "db_terms",
                "",
            ).strip()
        )

        exact_codes = (
            split_codes(
                row.get(
                    "exact_name_db_codes",
                    "",
                )
            )
        )

        if side == "baseline":
            if (
                code
                and db_terms
                and (
                    not exact_codes
                    or exact_codes
                    == {code}
                )
            ):
                classification = (
                    "seed_missing_course"
                )

                confidence = "high"

                evidence = (
                    "baseline_course_has_actual_offering_history;"
                    "no_alternative_exact_name_code;"
                    "course_absent_from_seed"
                )

                action = (
                    "Review adding this course to seed. "
                    "Preserve baseline."
                )

            else:
                classification = (
                    "needs_manual_mapping"
                )

                confidence = "medium"

                evidence = (
                    "baseline_only_row_requires_identity_review"
                )

                if len(
                    exact_codes
                ) > 1:
                    evidence += (
                        ";multiple_exact_name_db_codes"
                    )

                if not db_terms:
                    evidence += (
                        ";no_actual_offering_history"
                    )

                action = (
                    "Manual mapping review required."
                )

            output.append(
                make_output_row(
                    academic_year=year,
                    classification=(
                        classification
                    ),
                    confidence=confidence,
                    source_kind=(
                        "baseline_only"
                    ),
                    course_name=name,
                    baseline_code=code,
                    baseline_grade=(
                        row.get(
                            "grade",
                            "",
                        )
                    ),
                    baseline_semester=(
                        row.get(
                            "semester",
                            "",
                        )
                    ),
                    baseline_completion_type=(
                        row.get(
                            "completion_type",
                            "",
                        )
                    ),
                    baseline_credits=(
                        row.get(
                            "credits",
                            "",
                        )
                    ),
                    baseline_db_terms=(
                        db_terms
                    ),
                    exact_name_db_codes=(
                        row.get(
                            "exact_name_db_codes",
                            "",
                        )
                    ),
                    evidence=evidence,
                    recommended_action=(
                        action
                    ),
                )
            )

            continue

        if side == "seed":
            first_year = (
                first_db_year(
                    db_terms
                )
            )

            if not code:
                classification = (
                    "needs_manual_mapping"
                )

                confidence = "high"

                evidence = (
                    "seed_course_code_is_blank"
                )

                action = (
                    "Do not assign a code automatically."
                )

            elif (
                first_year is not None
                and first_year > year
            ):
                classification = (
                    "legitimate_post_baseline_transition"
                )

                confidence = "medium"

                evidence = (
                    "seed_only_course_first_actual_offering_"
                    f"after_entry_year:{first_year}"
                )

                action = (
                    "Likely later curriculum addition. "
                    "Keep out of immutable baseline; "
                    "review change metadata in seed."
                )

            else:
                classification = (
                    "needs_manual_mapping"
                )

                confidence = "medium"

                if first_year is None:
                    evidence = (
                        "seed_only_course_has_no_actual_"
                        "offering_history"
                    )
                else:
                    evidence = (
                        "seed_only_course_existed_by_or_before_"
                        f"entry_year:{first_year}"
                    )

                action = (
                    "Manual curriculum-change review required."
                )

            output.append(
                make_output_row(
                    academic_year=year,
                    classification=(
                        classification
                    ),
                    confidence=confidence,
                    source_kind=(
                        "seed_only"
                    ),
                    course_name=name,
                    seed_code=code,
                    seed_grade=(
                        row.get(
                            "grade",
                            "",
                        )
                    ),
                    seed_semester=(
                        row.get(
                            "semester",
                            "",
                        )
                    ),
                    seed_completion_type=(
                        row.get(
                            "completion_type",
                            "",
                        )
                    ),
                    seed_credits=(
                        row.get(
                            "credits",
                            "",
                        )
                    ),
                    seed_db_terms=(
                        db_terms
                    ),
                    exact_name_db_codes=(
                        row.get(
                            "exact_name_db_codes",
                            "",
                        )
                    ),
                    evidence=evidence,
                    recommended_action=(
                        action
                    ),
                )
            )

    return output



def previous_value_matches(
    baseline_value: str | None,
    previous_value: str | None,
) -> bool:
    baseline_value = (
        str(
            baseline_value
            or ""
        ).strip()
    )

    previous_value = (
        str(
            previous_value
            or ""
        ).strip()
    )

    if not baseline_value:
        return False

    if not previous_value:
        return False

    try:
        return (
            float(
                baseline_value
            )
            == float(
                previous_value
            )
        )
    except ValueError:
        return (
            baseline_value
            == previous_value
        )


def classify_changed_rows(
    diff_rows: list[dict[str, str]],
    metadata_index: dict[
        tuple[int, str],
        dict[str, str],
    ],
) -> list[dict[str, str]]:
    output = []

    previous_column = {
        "grade": (
            "previous_grade"
        ),
        "semester": (
            "previous_semester"
        ),
        "completion_type": (
            "previous_completion_type"
        ),
        "credits": (
            "previous_credits"
        ),
    }

    for row in diff_rows:
        if (
            row.get(
                "diff_type",
                "",
            )
            != "changed"
        ):
            continue

        year = int(
            row[
                "academic_year"
            ]
        )

        code = (
            row.get(
                "course_code",
                "",
            ).strip()
        )

        metadata = (
            metadata_index.get(
                (
                    year,
                    code,
                ),
                {},
            )
        )

        changed = [
            value
            for value
            in row.get(
                "changed_fields",
                "",
            ).split(";")
            if value
        ]

        supported_fields = []
        unsupported_fields = []

        for field in changed:
            if field == "course_name":
                unsupported_fields.append(
                    field
                )
                continue

            previous = (
                previous_column.get(
                    field
                )
            )

            if previous is None:
                unsupported_fields.append(
                    field
                )
                continue

            baseline_value = (
                row.get(
                    f"baseline_{field}",
                    "",
                )
            )

            previous_value = (
                metadata.get(
                    previous,
                    "",
                )
            )

            if previous_value_matches(
                baseline_value,
                previous_value,
            ):
                supported_fields.append(
                    field
                )
            else:
                unsupported_fields.append(
                    field
                )

        effective_year = (
            str(
                metadata.get(
                    "attribute_change_effective_year",
                    "",
                )
                or ""
            ).strip()
        )

        if (
            changed
            and not unsupported_fields
            and effective_year
        ):
            classification = (
                "legitimate_post_baseline_transition"
            )

            confidence = "high"

            evidence = (
                "seed_attribute_change_metadata_matches_"
                "all_baseline_previous_values;"
                f"effective_year={effective_year}"
            )

            action = (
                "Preserve baseline attributes and keep "
                "current seed attributes with change metadata."
            )

        else:
            classification = (
                "needs_manual_mapping"
            )

            confidence = "medium"

            evidence_parts = [
                (
                    "same_course_code_core_attributes_differ"
                ),
            ]

            if supported_fields:
                evidence_parts.append(
                    "supported_previous_fields="
                    + ",".join(
                        supported_fields
                    )
                )

            if unsupported_fields:
                evidence_parts.append(
                    "unsupported_fields="
                    + ",".join(
                        unsupported_fields
                    )
                )

            if not effective_year:
                evidence_parts.append(
                    "no_attribute_change_effective_year"
                )

            evidence = ";".join(
                evidence_parts
            )

            action = (
                "Review historical versus current "
                "course attributes before changing either side."
            )

        output.append(
            make_output_row(
                academic_year=year,
                classification=(
                    classification
                ),
                confidence=confidence,
                source_kind=(
                    "same_code_changed"
                ),
                course_name=(
                    row.get(
                        "baseline_course_name",
                        "",
                    )
                    or row.get(
                        "seed_course_name",
                        "",
                    )
                ),
                baseline_code=code,
                seed_code=code,
                baseline_grade=(
                    row.get(
                        "baseline_grade",
                        "",
                    )
                ),
                seed_grade=(
                    row.get(
                        "seed_grade",
                        "",
                    )
                ),
                baseline_semester=(
                    row.get(
                        "baseline_semester",
                        "",
                    )
                ),
                seed_semester=(
                    row.get(
                        "seed_semester",
                        "",
                    )
                ),
                baseline_completion_type=(
                    row.get(
                        "baseline_completion_type",
                        "",
                    )
                ),
                seed_completion_type=(
                    row.get(
                        "seed_completion_type",
                        "",
                    )
                ),
                baseline_credits=(
                    row.get(
                        "baseline_credits",
                        "",
                    )
                ),
                seed_credits=(
                    row.get(
                        "seed_credits",
                        "",
                    )
                ),
                changed_fields=(
                    row.get(
                        "changed_fields",
                        "",
                    )
                ),
                attribute_change_effective_year=(
                    effective_year
                ),
                evidence=evidence,
                recommended_action=(
                    action
                ),
            )
        )

    return output


def sort_key(
    row: dict[str, str],
) -> tuple:
    order = {
        "seed_wrong_or_suspect_code": 0,
        "seed_missing_course": 1,
        "needs_manual_mapping": 2,
        "legitimate_post_baseline_transition": 3,
    }

    return (
        order.get(
            row[
                "classification"
            ],
            99,
        ),
        int(
            row[
                "academic_year"
            ]
        ),
        row[
            "course_name"
        ],
        row[
            "baseline_code"
        ],
        row[
            "seed_code"
        ],
    )


def build_report(
    rows: list[dict[str, str]],
) -> str:
    counts = Counter(
        row[
            "classification"
        ]
        for row in rows
    )

    confidence_counts = Counter(
        (
            row[
                "classification"
            ],
            row[
                "confidence"
            ],
        )
        for row in rows
    )

    lines = [
        "Seed reconciliation classification",
        "=============================================",
        "",
        (
            "This is a diagnostic classification only."
        ),
        (
            "No baseline, seed, extracted source, or "
            "database data is modified."
        ),
        "",
        "SUMMARY",
        "-------",
    ]

    for classification in [
        "seed_wrong_or_suspect_code",
        "seed_missing_course",
        "needs_manual_mapping",
        "legitimate_post_baseline_transition",
    ]:
        lines.append(
            (
                f"{classification}: "
                f"{counts[classification]}"
                " "
                f"(high="
                f"{confidence_counts[(classification, 'high')]}, "
                f"medium="
                f"{confidence_counts[(classification, 'medium')]})"
            )
        )

    lines.extend(
        [
            "",
            "DETAILS",
            "-------",
        ]
    )

    current = None

    for row in rows:
        classification = (
            row[
                "classification"
            ]
        )

        if classification != current:
            current = classification

            lines.extend(
                [
                    "",
                    classification,
                    "-" * len(
                        classification
                    ),
                ]
            )

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
                f"| confidence="
                f"{row['confidence']} "
                f"| source="
                f"{row['source_kind']}"
            )
        )

        lines.append(
            (
                "    evidence: "
                f"{row['evidence']}"
            )
        )

        lines.append(
            (
                "    action: "
                f"{row['recommended_action']}"
            )
        )

    lines.extend(
        [
            "",
            "Interpretation",
            "--------------",
            (
                "1. seed_wrong_or_suspect_code is a "
                "seed review candidate, not an automatic fix."
            ),
            (
                "2. seed_missing_course means the baseline "
                "course has independent actual-offering support "
                "and no exact-name alternative code was found."
            ),
            (
                "3. legitimate_post_baseline_transition should "
                "remain outside the immutable historical baseline."
            ),
            (
                "4. needs_manual_mapping must not be changed "
                "automatically."
            ),
            (
                "5. No ADA/ADB prefix rule is used."
            ),
            "",
        ]
    )

    return "\n".join(
        lines
    )


def main() -> None:
    required_paths = [
        diff_path(),
        pair_candidates_path(),
        unpaired_path(),
    ]

    for path in required_paths:
        if not path.exists():
            raise FileNotFoundError(
                path
            )

    diff_rows = read_csv_rows(
        diff_path()
    )

    pair_rows = read_csv_rows(
        pair_candidates_path()
    )

    unpaired_rows = read_csv_rows(
        unpaired_path()
    )

    metadata_index = (
        seed_metadata_index()
    )

    output_rows = []

    output_rows.extend(
        classify_pair_candidates(
            pair_rows
        )
    )

    output_rows.extend(
        classify_unpaired(
            unpaired_rows
        )
    )

    output_rows.extend(
        classify_changed_rows(
            diff_rows,
            metadata_index,
        )
    )

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

    print()
    print(
        "Seed reconciliation classification"
    )
    print(
        "----------------------------------"
    )

    counts = Counter(
        row[
            "classification"
        ]
        for row in output_rows
    )

    for classification in [
        "seed_wrong_or_suspect_code",
        "seed_missing_course",
        "needs_manual_mapping",
        "legitimate_post_baseline_transition",
    ]:
        print(
            f"{classification}: "
            f"{counts[classification]}"
        )

    print()
    print(
        f"report: {report_path()}"
    )


if __name__ == "__main__":
    main()
from __future__ import annotations

import csv
import re
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

from scripts.common.data_paths import (
    EXTRACTED_CURRICULUM_DIR,
    EXTRACTED_CURRICULUM_FLOWCHARTS_DIR,
)


TARGET_YEARS = [
    2022,
    2023,
    2024,
]

EXPECTED_REQUIRED_CREDITS = {
    2022: 118.0,
    2023: 118.0,
    2024: 118.0,
}

COURSE_COLUMNS = [
    "entry_year",
    "grade",
    "semester",
    "course_name",
    "course_code",
    "completion_type",
    "credits",
    "notes",
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
]

PROVISIONAL_TOTAL_COLUMNS = [
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

AUDIT_COLUMNS = [
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
    "manual_override",
    "manual_override_reason",
    "final_action",
    "final_generation",
    "final_reason",
    "baseline_included",
]


@dataclass(frozen=True)
class ManualOverride:
    academic_year: int
    grade: int
    semester: int
    course_code: str
    course_name: str
    action: str
    expected_before: str
    reason: str


MANUAL_OVERRIDES = [
    ManualOverride(
        academic_year=2022,
        grade=4,
        semester=2,
        course_code="ADB067",
        course_name="약학실험5",
        action="include_six_year",
        expected_before="",
        reason=(
            "manual_required_credit_total_constraint:"
            "six_year_required_117_plus_ADB067_1_equals_118"
        ),
    ),
    ManualOverride(
        academic_year=2023,
        grade=4,
        semester=2,
        course_code="ADB067",
        course_name="약학실험5",
        action="include_six_year",
        expected_before="",
        reason=(
            "manual_required_credit_total_constraint:"
            "six_year_required_117_plus_ADB067_1_equals_118"
        ),
    ),
    ManualOverride(
        academic_year=2024,
        grade=4,
        semester=2,
        course_code="ADB067",
        course_name="약학실험5",
        action="include_six_year",
        expected_before="",
        reason=(
            "manual_cross_year_continuity_and_"
            "required_credit_total_constraint"
        ),
    ),
    ManualOverride(
        academic_year=2024,
        grade=3,
        semester=1,
        course_code="ADB028",
        course_name="의약품합성학1",
        action="exclude_from_cohort",
        expected_before="six_year",
        reason=(
            "manual_curriculum_change:"
            "pharmaceutical_synthesis_1_2_replaced_by_ADA198"
        ),
    ),
    ManualOverride(
        academic_year=2024,
        grade=3,
        semester=2,
        course_code="ADB038",
        course_name="의약품합성학2",
        action="exclude_from_cohort",
        expected_before="six_year",
        reason=(
            "manual_curriculum_change:"
            "pharmaceutical_synthesis_1_2_replaced_by_ADA198"
        ),
    ),
    ManualOverride(
        academic_year=2024,
        grade=5,
        semester=1,
        course_code="ADB070",
        course_name="항암약물요법",
        action="exclude_from_cohort",
        expected_before="six_year",
        reason=(
            "manual_actual_offering_history_and_"
            "required_credit_total_constraint:"
            "ADB070_not_offered_2022_2026_and_"
            "ADB103_offered_from_2024"
        ),
    ),
]


def comparison_directory() -> Path:
    return (
        EXTRACTED_CURRICULUM_FLOWCHARTS_DIR
        / "comparison"
    )


def provisional_totals_path() -> Path:
    return (
        comparison_directory()
        / "curriculum_generation_provisional_totals.csv"
    )


def output_directory() -> Path:
    return (
        comparison_directory()
        / "curriculum_provisional_baseline"
    )


def baseline_path(
    year: int,
) -> Path:
    return (
        output_directory()
        / f"curriculum_{year}.csv"
    )


def audit_path() -> Path:
    return (
        output_directory()
        / "provisional_baseline_assignment_audit.csv"
    )


def excluded_path() -> Path:
    return (
        output_directory()
        / "provisional_baseline_excluded_courses.csv"
    )


def report_path() -> Path:
    return (
        output_directory()
        / "provisional_baseline_report.txt"
    )


def source_courses_path(
    year: int,
) -> Path:
    return (
        EXTRACTED_CURRICULUM_DIR
        / str(year)
        / "courses.csv"
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


def read_fieldnames(
    path: Path,
) -> list[str]:
    with path.open(
        "r",
        encoding="utf-8-sig",
        newline="",
    ) as file:
        reader = csv.DictReader(
            file
        )

        return (
            reader.fieldnames
            or []
        )


def validate_schema(
    path: Path,
    expected: list[str],
) -> None:
    actual = read_fieldnames(
        path
    )

    if actual != expected:
        raise RuntimeError(
            "CSV 스키마가 예상과 다릅니다.\n"
            f"path: {path}\n"
            f"expected: {expected}\n"
            f"actual:   {actual}"
        )


def normalize_course_name(
    text: str,
) -> str:
    return re.sub(
        r"\s+",
        "",
        text.strip(),
    )


def source_key(
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
        int(row["grade"]),
        int(row["semester"]),
        row["course_code"].strip(),
        normalize_course_name(
            row["course_name"]
        ),
    )


def provisional_key(
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
        normalize_course_name(
            row["course_name"]
        ),
    )


def override_key(
    override: ManualOverride,
) -> tuple[
    int,
    int,
    int,
    str,
    str,
]:
    return (
        override.academic_year,
        override.grade,
        override.semester,
        override.course_code,
        normalize_course_name(
            override.course_name
        ),
    )


def build_unique_index(
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
    index = {}

    for row in rows:
        year = int(
            row["academic_year"]
        )

        if year not in TARGET_YEARS:
            continue

        key = provisional_key(
            row
        )

        if key in index:
            raise RuntimeError(
                "provisional totals key 중복: "
                f"{key}"
            )

        index[key] = row

    return index


def build_override_index() -> dict:
    index = {}

    for override in MANUAL_OVERRIDES:
        key = override_key(
            override
        )

        if key in index:
            raise RuntimeError(
                "manual override key 중복: "
                f"{key}"
            )

        index[key] = override

    return index


def copy_course_for_baseline(
    year: int,
    source: dict[str, str],
) -> dict[str, str]:
    output = {
        column: source.get(
            column,
            "",
        )
        for column in COURSE_COLUMNS
    }

    # extracted 단계에서는 publication year와
    # entry year를 동일시하지 않았기 때문에 비워 두었다.
    # 이 파일은 해석이 완료된 cohort baseline이므로
    # 여기에서 처음 entry_year를 부여한다.
    output["entry_year"] = str(
        year
    )

    return output


def parse_credit(
    row: dict[str, str],
) -> float:
    value = row.get(
        "credits",
        "",
    ).strip()

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


def base_assignment(
    provisional: dict[str, str],
) -> tuple[str, str, str]:
    generation = provisional.get(
        "scenario_b_generation",
        "",
    ).strip()

    reason = provisional.get(
        "scenario_b_reason",
        "",
    ).strip()

    if generation in {
        "six_year",
        "both",
    }:
        return (
            "include",
            "six_year",
            (
                reason
                or "scenario_b_six_year"
            ),
        )

    if generation == "four_year":
        return (
            "exclude",
            "four_year",
            (
                reason
                or "scenario_b_four_year"
            ),
        )

    return (
        "exclude",
        "",
        (
            reason
            or "scenario_b_unassigned"
        ),
    )


def apply_manual_override(
    base_action: str,
    base_generation: str,
    base_reason: str,
    override: ManualOverride,
    provisional: dict[str, str],
) -> tuple[str, str, str]:
    before = provisional.get(
        "scenario_b_generation",
        "",
    ).strip()

    if (
        before
        != override.expected_before
    ):
        raise RuntimeError(
            "manual override의 예상 이전 상태와 "
            "현재 Scenario B 상태가 다릅니다.\n"
            f"course: {override.academic_year} "
            f"{override.course_code} "
            f"{override.course_name}\n"
            f"expected_before: "
            f"{override.expected_before!r}\n"
            f"actual_before:   "
            f"{before!r}"
        )

    if (
        override.action
        == "include_six_year"
    ):
        return (
            "include",
            "six_year",
            override.reason,
        )

    if (
        override.action
        == "exclude_from_cohort"
    ):
        return (
            "exclude",
            "",
            override.reason,
        )

    raise RuntimeError(
        "알 수 없는 manual override action: "
        f"{override.action}"
    )


def make_audit_row(
    year: int,
    source: dict[str, str],
    provisional: dict[str, str],
    override: ManualOverride,
    final_action: str,
    final_generation: str,
    final_reason: str,
) -> dict[str, str]:
    return {
        "academic_year": str(
            year
        ),
        "grade": source["grade"],
        "semester": source[
            "semester"
        ],
        "course_name": source[
            "course_name"
        ],
        "course_code": source[
            "course_code"
        ],
        "completion_type": source[
            "completion_type"
        ],
        "credits": source[
            "credits"
        ],
        "original_decision_status": (
            provisional.get(
                "original_decision_status",
                "",
            )
        ),
        "original_generation": (
            provisional.get(
                "original_generation",
                "",
            )
        ),
        "scenario_a_generation": (
            provisional.get(
                "scenario_a_generation",
                "",
            )
        ),
        "scenario_a_reason": (
            provisional.get(
                "scenario_a_reason",
                "",
            )
        ),
        "scenario_b_generation": (
            provisional.get(
                "scenario_b_generation",
                "",
            )
        ),
        "scenario_b_reason": (
            provisional.get(
                "scenario_b_reason",
                "",
            )
        ),
        "manual_override": (
            override.action
            if override
            else ""
        ),
        "manual_override_reason": (
            override.reason
            if override
            else ""
        ),
        "final_action": (
            final_action
        ),
        "final_generation": (
            final_generation
        ),
        "final_reason": (
            final_reason
        ),
        "baseline_included": (
            "yes"
            if final_action
            == "include"
            else "no"
        ),
    }


def write_csv(
    path: Path,
    fieldnames: list[str],
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
            fieldnames=fieldnames,
        )

        writer.writeheader()
        writer.writerows(
            rows
        )


def required_credit_total(
    rows: list[dict[str, str]],
) -> float:
    return sum(
        parse_credit(row)
        for row in rows
        if row.get(
            "completion_type",
            "",
        ).strip()
        == "전필"
    )


def elective_credit_total(
    rows: list[dict[str, str]],
) -> float:
    return sum(
        parse_credit(row)
        for row in rows
        if row.get(
            "completion_type",
            "",
        ).strip()
        == "전선"
    )


def total_credit(
    rows: list[dict[str, str]],
) -> float:
    return sum(
        parse_credit(row)
        for row in rows
    )


def validate_required_credits(
    results: dict[
        int,
        list[dict[str, str]],
    ],
) -> None:
    for year in TARGET_YEARS:
        actual = (
            required_credit_total(
                results[year]
            )
        )

        expected = (
            EXPECTED_REQUIRED_CREDITS[
                year
            ]
        )

        if actual != expected:
            raise RuntimeError(
                "잠정 baseline 전필 합계가 "
                "기대값과 다릅니다.\n"
                f"year: {year}\n"
                f"expected: "
                f"{format_credit(expected)}\n"
                f"actual:   "
                f"{format_credit(actual)}"
            )


def codes_in_rows(
    rows: list[dict[str, str]],
) -> set[str]:
    return {
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


def validate_manual_guards(
    results: dict[
        int,
        list[dict[str, str]],
    ],
    audit_rows: list[
        dict[str, str]
    ],
) -> None:
    included_by_year = {
        year: codes_in_rows(
            results[year]
        )
        for year in TARGET_YEARS
    }

    for year in TARGET_YEARS:
        if (
            "ADB067"
            not in included_by_year[
                year
            ]
        ):
            raise RuntimeError(
                f"{year} ADB067이 "
                "잠정 baseline에 없습니다."
            )

    required_2024_included = {
        "ADA198",
        "ADB103",
    }

    missing = (
        required_2024_included
        - included_by_year[2024]
    )

    if missing:
        raise RuntimeError(
            "2024 baseline에 반드시 "
            "포함되어야 할 코드가 없습니다: "
            f"{sorted(missing)}"
        )

    required_2024_excluded = {
        "ADB028",
        "ADB038",
        "ADB070",
    }

    wrongly_included = (
        required_2024_excluded
        & included_by_year[2024]
    )

    if wrongly_included:
        raise RuntimeError(
            "2024 baseline에서 제외하기로 한 "
            "코드가 포함되어 있습니다: "
            f"{sorted(wrongly_included)}"
        )

    matched_override_rows = {
        (
            int(row["academic_year"]),
            row["course_code"],
        )
        for row in audit_rows
        if row[
            "manual_override"
        ]
    }

    expected_override_rows = {
        (
            override.academic_year,
            override.course_code,
        )
        for override
        in MANUAL_OVERRIDES
    }

    if (
        matched_override_rows
        != expected_override_rows
    ):
        raise RuntimeError(
            "manual override 적용 행 집합이 "
            "예상과 다릅니다.\n"
            f"expected: "
            f"{sorted(expected_override_rows)}\n"
            f"actual:   "
            f"{sorted(matched_override_rows)}"
        )


def build_report(
    results: dict[
        int,
        list[dict[str, str]],
    ],
    source_rows_by_year: dict[
        int,
        list[dict[str, str]],
    ],
    audit_rows: list[
        dict[str, str]
    ],
) -> str:
    lines = [
        (
            "Curriculum provisional "
            "cohort baseline report"
        ),
        "=============================================",
        "",
        (
            "This is a provisional cohort "
            "baseline, not the final immutable baseline."
        ),
        (
            "Target: six-year pharmacy cohorts "
            "entering in 2022, 2023, and 2024."
        ),
        "",
        (
            "Elective-credit totals are descriptive only."
        ),
        (
            "They are NOT validated against the "
            "79-credit graduation minimum."
        ),
        (
            "Only required-major credits are used "
            "as a hard total constraint."
        ),
        "",
    ]

    for year in TARGET_YEARS:
        source_rows = (
            source_rows_by_year[
                year
            ]
        )

        baseline_rows = (
            results[
                year
            ]
        )

        excluded_count = (
            len(source_rows)
            - len(baseline_rows)
        )

        lines.extend(
            [
                str(year),
                "----",
                (
                    "source rows: "
                    f"{len(source_rows)}"
                ),
                (
                    "baseline rows: "
                    f"{len(baseline_rows)}"
                ),
                (
                    "excluded source rows: "
                    f"{excluded_count}"
                ),
                (
                    "baseline total credits: "
                    f"{format_credit(total_credit(baseline_rows))}"
                ),
                (
                    "baseline 전필 credits: "
                    f"{format_credit(required_credit_total(baseline_rows))}"
                ),
                (
                    "baseline 전선 credits: "
                    f"{format_credit(elective_credit_total(baseline_rows))}"
                    " (descriptive only)"
                ),
                "",
            ]
        )

    lines.extend(
        [
            "MANUAL OVERRIDES",
            "----------------",
        ]
    )

    for override in MANUAL_OVERRIDES:
        lines.append(
            (
                f"{override.academic_year} "
                f"| {override.grade}-"
                f"{override.semester} "
                f"| {override.course_code} "
                f"| {override.course_name} "
                f"| {override.action} "
                f"| {override.reason}"
            )
        )

    lines.extend(
        [
            "",
            "FINAL EXCLUSION STATUS",
            "----------------------",
        ]
    )

    excluded_audit = [
        row
        for row in audit_rows
        if row[
            "baseline_included"
        ]
        == "no"
    ]

    status_counts = Counter(
        (
            row[
                "original_decision_status"
            ]
            or "unknown"
        )
        for row
        in excluded_audit
    )

    for status in sorted(
        status_counts
    ):
        lines.append(
            (
                f"{status}: "
                f"{status_counts[status]}"
            )
        )

    lines.extend(
        [
            "",
            "Rules",
            "-----",
            (
                "1. Scenario B six_year or both "
                "is included in the cohort baseline."
            ),
            (
                "2. Scenario B four_year is excluded."
            ),
            (
                "3. Scenario B unassigned rows remain excluded "
                "unless a reviewed manual override exists."
            ),
            (
                "4. Backward-support and pair-closure evidence "
                "are inherited from the already-reviewed "
                "Scenario B artifact."
            ),
            (
                "5. ADB067 약학실험5 is manually included "
                "for 2022-2024."
            ),
            (
                "6. 2024 ADB028 and ADB038 are excluded "
                "because 의약품합성학1/2 were replaced by "
                "integrated ADA198 의약품합성학."
            ),
            (
                "7. 2024 ADB070 is excluded based on reviewed "
                "actual offering history plus the required-credit "
                "total constraint; ADB103 remains included."
            ),
            (
                "8. 2022-2024 전필 must each total exactly "
                "118 credits or this script fails."
            ),
            (
                "9. The 79-credit elective requirement is a "
                "minimum graduation requirement, not a total "
                "curriculum-credit constraint."
            ),
            (
                "10. Source extracted CSVs, decision artifacts, "
                "seed data, data/baseline, and databases are "
                "not modified."
            ),
            (
                "11. Output curriculum CSVs retain the exact "
                "19-column curriculum schema."
            ),
            (
                "12. entry_year is populated only here because "
                "this stage creates interpreted cohort snapshots."
            ),
            "",
        ]
    )

    return "\n".join(
        lines
    )


def main() -> None:
    provisional_path = (
        provisional_totals_path()
    )

    if not provisional_path.exists():
        raise FileNotFoundError(
            "provisional totals CSV가 없습니다. "
            "먼저 다음 스크립트를 실행하세요:\n"
            "python -m "
            "scripts.curriculum."
            "build_curriculum_generation_provisional_totals\n"
            f"path: {provisional_path}"
        )

    validate_schema(
        provisional_path,
        PROVISIONAL_TOTAL_COLUMNS,
    )

    provisional_rows = read_csv_rows(
        provisional_path
    )

    provisional_index = (
        build_unique_index(
            provisional_rows
        )
    )

    overrides = (
        build_override_index()
    )

    source_rows_by_year = {}
    results = {}
    audit_rows = []

    matched_provisional_keys = set()
    matched_override_keys = set()

    for year in TARGET_YEARS:
        source_path = (
            source_courses_path(
                year
            )
        )

        if not source_path.exists():
            raise FileNotFoundError(
                source_path
            )

        validate_schema(
            source_path,
            COURSE_COLUMNS,
        )

        source_rows = read_csv_rows(
            source_path
        )

        source_rows_by_year[
            year
        ] = source_rows

        baseline_rows = []

        for source in source_rows:
            key = source_key(
                year,
                source,
            )

            provisional = (
                provisional_index.get(
                    key
                )
            )

            if provisional is None:
                raise RuntimeError(
                    "원본 courses.csv 행에 대응하는 "
                    "provisional totals 행이 없습니다:\n"
                    f"{key}"
                )

            matched_provisional_keys.add(
                key
            )

            (
                final_action,
                final_generation,
                final_reason,
            ) = base_assignment(
                provisional
            )

            override = (
                overrides.get(
                    key
                )
            )

            if override is not None:
                matched_override_keys.add(
                    key
                )

                (
                    final_action,
                    final_generation,
                    final_reason,
                ) = apply_manual_override(
                    final_action,
                    final_generation,
                    final_reason,
                    override,
                    provisional,
                )

            audit_row = make_audit_row(
                year=year,
                source=source,
                provisional=provisional,
                override=override,
                final_action=final_action,
                final_generation=final_generation,
                final_reason=final_reason,
            )

            audit_rows.append(
                audit_row
            )

            if final_action == "include":
                if (
                    final_generation
                    != "six_year"
                ):
                    raise RuntimeError(
                        "cohort baseline에 포함되는 행의 "
                        "final_generation은 six_year여야 합니다:\n"
                        f"{key} -> {final_generation}"
                    )

                baseline_rows.append(
                    copy_course_for_baseline(
                        year,
                        source,
                    )
                )

        results[
            year
        ] = baseline_rows

    expected_provisional_keys = {
        key
        for key
        in provisional_index
        if key[0]
        in TARGET_YEARS
    }

    unmatched_provisional = (
        expected_provisional_keys
        - matched_provisional_keys
    )

    if unmatched_provisional:
        raise RuntimeError(
            "provisional totals에는 있지만 "
            "원본 extracted courses에서 "
            "찾지 못한 행이 있습니다:\n"
            + "\n".join(
                str(key)
                for key
                in sorted(
                    unmatched_provisional
                )
            )
        )

    expected_override_keys = set(
        overrides
    )

    unmatched_overrides = (
        expected_override_keys
        - matched_override_keys
    )

    if unmatched_overrides:
        raise RuntimeError(
            "적용되지 않은 manual override가 있습니다:\n"
            + "\n".join(
                str(key)
                for key
                in sorted(
                    unmatched_overrides
                )
            )
        )

    validate_required_credits(
        results
    )

    validate_manual_guards(
        results,
        audit_rows,
    )

    output_directory().mkdir(
        parents=True,
        exist_ok=True,
    )

    for year in TARGET_YEARS:
        write_csv(
            baseline_path(year),
            COURSE_COLUMNS,
            results[year],
        )

    write_csv(
        audit_path(),
        AUDIT_COLUMNS,
        audit_rows,
    )

    excluded_rows = [
        row
        for row in audit_rows
        if row[
            "baseline_included"
        ]
        == "no"
    ]

    write_csv(
        excluded_path(),
        AUDIT_COLUMNS,
        excluded_rows,
    )

    report = build_report(
        results=results,
        source_rows_by_year=(
            source_rows_by_year
        ),
        audit_rows=audit_rows,
    )

    report_path().write_text(
        report,
        encoding="utf-8",
    )

    print()
    print(
        "Curriculum provisional cohort baseline"
    )
    print(
        "--------------------------------------"
    )

    for year in TARGET_YEARS:
        rows = results[
            year
        ]

        print(
            f"{year}: "
            f"{len(rows)} rows, "
            f"{format_credit(total_credit(rows))} credits "
            f"(전필 "
            f"{format_credit(required_credit_total(rows))}, "
            f"전선 "
            f"{format_credit(elective_credit_total(rows))})"
        )

    print()
    print(
        f"output: {output_directory()}"
    )
    print(
        f"report: {report_path()}"
    )


if __name__ == "__main__":
    main()
from __future__ import annotations

import argparse
import csv
import re
from dataclasses import dataclass
from pathlib import Path

from scripts.common.data_paths import (
    CURRICULUM_SEED_DIR,
    EXTRACTED_CURRICULUM_FLOWCHARTS_DIR,
    PROJECT_ROOT,
)


REQUIRED_TYPE = "전필"

SUPPORTED_YEARS = [
    2022,
    2023,
    2024,
]


# 자동 비교만으로 안전하게 연결할 수 없는,
# 사람이 이미 검토하여 확정한 전환 관계만 여기에 둔다.
#
# 절대로 코드 prefix(ADA/ADB)나 이름 유사도로 생성하지 않는다.
MANUAL_TRANSITIONS = {
    2024: [
        {
            "label": (
                "신경정신계 및 신장 질환 약물치료학"
            ),
            "baseline_codes": [
                "ADB062",
            ],
            "seed_codes": [
                "ADB104",
                "ADB108",
            ],
            "note": (
                "2024학번에서는 기존 전필 3학점 과목 대신 "
                "정신신경계 질환 약물치료학과 "
                "신장질환 약물치료학이 각각 전선 2학점으로 "
                "편성된 것으로 검토됨."
            ),
        },
    ],
}


@dataclass
class Contribution:
    label: str
    before_rows: list[dict[str, str]]
    after_rows: list[dict[str, str]]
    impact: float
    source: str
    note: str = ""


def baseline_directory() -> Path:
    return (
        PROJECT_ROOT
        / "data"
        / "baseline"
        / "curriculum"
    )


def baseline_path(
    year: int,
) -> Path:
    return (
        baseline_directory()
        / f"curriculum_{year}.csv"
    )


def seed_path(
    year: int,
) -> Path:
    return (
        CURRICULUM_SEED_DIR
        / f"curriculum_{year}.csv"
    )


def output_directory() -> Path:
    return (
        EXTRACTED_CURRICULUM_FLOWCHARTS_DIR
        / "comparison"
        / "required_credit_change_report"
    )


def output_path(
    year: int,
) -> Path:
    return (
        output_directory()
        / f"required_credit_change_report_{year}.txt"
    )


def read_csv_rows(
    path: Path,
) -> list[dict[str, str]]:
    if not path.exists():
        raise FileNotFoundError(
            f"파일을 찾을 수 없습니다: {path}"
        )

    with path.open(
        "r",
        encoding="utf-8-sig",
        newline="",
    ) as file:
        return list(
            csv.DictReader(file)
        )


def normalize_name(
    value: str,
) -> str:
    return re.sub(
        r"\s+",
        "",
        value.strip(),
    )


def parse_credit(
    value: str,
) -> float:
    value = value.strip()

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


def course_code(
    row: dict[str, str],
) -> str:
    return (
        row.get(
            "course_code",
            "",
        ).strip()
    )


def course_name(
    row: dict[str, str],
) -> str:
    return (
        row.get(
            "course_name",
            "",
        ).strip()
    )


def completion_type(
    row: dict[str, str],
) -> str:
    return (
        row.get(
            "completion_type",
            "",
        ).strip()
    )


def credit(
    row: dict[str, str],
) -> float:
    return parse_credit(
        row.get(
            "credits",
            "",
        )
    )


def required_credit(
    row: dict[str, str],
) -> float:
    if (
        completion_type(row)
        != REQUIRED_TYPE
    ):
        return 0.0

    return credit(row)


def is_legacy(
    row: dict[str, str],
) -> bool:
    return (
        row.get(
            "change_role",
            "",
        ).strip()
        == "legacy"
    )


def current_seed_rows(
    rows: list[dict[str, str]],
) -> list[dict[str, str]]:
    return [
        row
        for row in rows
        if not is_legacy(row)
    ]


def total_required_credits(
    rows: list[dict[str, str]],
) -> float:
    return sum(
        required_credit(row)
        for row in rows
    )


def build_unique_code_index(
    rows: list[dict[str, str]],
    label: str,
) -> dict[str, dict[str, str]]:
    index: dict[
        str,
        dict[str, str],
    ] = {}

    for row in rows:
        code = course_code(row)

        if not code:
            continue

        if code in index:
            raise RuntimeError(
                f"{label}: course_code가 중복됩니다: "
                f"{code}"
            )

        index[code] = row

    return index


def rows_required_total(
    rows: list[dict[str, str]],
) -> float:
    return sum(
        required_credit(row)
        for row in rows
    )


def row_signature(
    row: dict[str, str],
) -> tuple[str, str]:
    return (
        course_code(row),
        normalize_name(
            course_name(row)
        ),
    )


def format_course_state(
    row: dict[str, str],
    include_name: bool = True,
) -> str:
    name = course_name(row)
    ctype = completion_type(row)
    credits = credit(row)

    credit_text = (
        f"{format_credit(credits)}학점"
        if credits
        else "학점 미확정"
    )

    state = " ".join(
        part
        for part in [
            ctype,
            credit_text,
        ]
        if part
    )

    if not include_name:
        return state

    if state:
        return f"{name} {state}"

    return name


def contribution_line(
    contribution: Contribution,
) -> str:
    before_rows = (
        contribution.before_rows
    )
    after_rows = (
        contribution.after_rows
    )

    impact_text = (
        f"+{format_credit(contribution.impact)}"
        if contribution.impact > 0
        else format_credit(
            contribution.impact
        )
    )

    if (
        len(before_rows) == 1
        and len(after_rows) == 1
    ):
        before = before_rows[0]
        after = after_rows[0]

        same_name = (
            normalize_name(
                course_name(before)
            )
            == normalize_name(
                course_name(after)
            )
        )

        if same_name:
            before_type = (
                completion_type(before)
            )
            after_type = (
                completion_type(after)
            )

            before_credit = credit(before)
            after_credit = credit(after)

            if (
                before_type
                == after_type
            ):
                return (
                    f"{contribution.label}: "
                    f"{before_type} "
                    f"{format_credit(before_credit)}"
                    f" → "
                    f"{format_credit(after_credit)}학점 "
                    f"({impact_text})"
                )

            return (
                f"{contribution.label}: "
                f"{before_type} "
                f"{format_credit(before_credit)}"
                f" → "
                f"{after_type} "
                f"{format_credit(after_credit)}학점 "
                f"({impact_text})"
            )

    before_text = " + ".join(
        format_course_state(
            row,
            include_name=(
                normalize_name(
                    course_name(row)
                )
                != normalize_name(
                    contribution.label
                )
            ),
        )
        for row in before_rows
    )

    after_text = " + ".join(
        format_course_state(row)
        for row in after_rows
    )

    return (
        f"{contribution.label}: "
        f"{before_text}"
        f" → "
        f"{after_text} "
        f"({impact_text})"
    )


def find_seed_change_groups(
    rows: list[dict[str, str]],
) -> dict[
    str,
    list[dict[str, str]],
]:
    groups: dict[
        str,
        list[dict[str, str]],
    ] = {}

    for row in rows:
        group = (
            row.get(
                "change_group",
                "",
            ).strip()
        )

        if not group:
            continue

        groups.setdefault(
            group,
            [],
        ).append(row)

    return groups


def collect_manual_transition(
    year: int,
    transition: dict[str, object],
    baseline_by_code: dict[
        str,
        dict[str, str],
    ],
    seed_by_code: dict[
        str,
        dict[str, str],
    ],
) -> Contribution:
    baseline_codes = list(
        transition[
            "baseline_codes"
        ]
    )
    seed_codes = list(
        transition[
            "seed_codes"
        ]
    )

    missing_baseline = [
        code
        for code in baseline_codes
        if code not in baseline_by_code
    ]

    if missing_baseline:
        raise RuntimeError(
            f"{year} 수동 전환의 baseline code가 "
            f"없습니다: {missing_baseline}"
        )

    missing_seed = [
        code
        for code in seed_codes
        if code not in seed_by_code
    ]

    if missing_seed:
        raise RuntimeError(
            f"{year} 수동 전환의 seed code가 "
            f"없습니다: {missing_seed}"
        )

    before_rows = [
        baseline_by_code[code]
        for code in baseline_codes
    ]

    after_rows = [
        seed_by_code[code]
        for code in seed_codes
    ]

    impact = (
        rows_required_total(
            after_rows
        )
        - rows_required_total(
            before_rows
        )
    )

    return Contribution(
        label=str(
            transition["label"]
        ),
        before_rows=before_rows,
        after_rows=after_rows,
        impact=impact,
        source="manual_transition",
        note=str(
            transition.get(
                "note",
                "",
            )
        ),
    )


def build_report(
    year: int,
) -> tuple[
    str,
    float,
    float,
    float,
]:
    baseline_rows = read_csv_rows(
        baseline_path(year)
    )

    seed_rows = read_csv_rows(
        seed_path(year)
    )

    current_rows = current_seed_rows(
        seed_rows
    )

    baseline_total = (
        total_required_credits(
            baseline_rows
        )
    )

    current_total = (
        total_required_credits(
            current_rows
        )
    )

    expected_delta = (
        current_total
        - baseline_total
    )

    baseline_by_code = (
        build_unique_code_index(
            baseline_rows,
            f"baseline {year}",
        )
    )

    seed_by_code = (
        build_unique_code_index(
            current_rows,
            f"current seed {year}",
        )
    )

    handled_baseline: set[
        tuple[str, str]
    ] = set()

    handled_seed: set[
        tuple[str, str]
    ] = set()

    contributions: list[
        Contribution
    ] = []

    # -------------------------------------------------
    # 1. 사람이 검토하여 명시적으로 등록한 전환
    # -------------------------------------------------

    for transition in (
        MANUAL_TRANSITIONS.get(
            year,
            [],
        )
    ):
        contribution = (
            collect_manual_transition(
                year=year,
                transition=transition,
                baseline_by_code=(
                    baseline_by_code
                ),
                seed_by_code=(
                    seed_by_code
                ),
            )
        )

        contributions.append(
            contribution
        )

        for row in (
            contribution.before_rows
        ):
            handled_baseline.add(
                row_signature(row)
            )

        for row in (
            contribution.after_rows
        ):
            handled_seed.add(
                row_signature(row)
            )

    # -------------------------------------------------
    # 2. seed change_group에 legacy/current가
    #    함께 있는 명시적 변경
    # -------------------------------------------------

    groups = find_seed_change_groups(
        seed_rows
    )

    for group_name, group_rows in (
        groups.items()
    ):
        legacy_rows = [
            row
            for row in group_rows
            if (
                row.get(
                    "change_role",
                    "",
                ).strip()
                == "legacy"
            )
        ]

        group_current_rows = [
            row
            for row in group_rows
            if (
                row.get(
                    "change_role",
                    "",
                ).strip()
                == "current"
            )
        ]

        if (
            not legacy_rows
            or not group_current_rows
        ):
            continue

        matched_baseline_rows = []

        for legacy_row in legacy_rows:
            code = course_code(
                legacy_row
            )

            baseline_row = (
                baseline_by_code.get(
                    code
                )
            )

            if baseline_row is None:
                continue

            if (
                row_signature(
                    baseline_row
                )
                in handled_baseline
            ):
                continue

            matched_baseline_rows.append(
                baseline_row
            )

        if not matched_baseline_rows:
            continue

        usable_current_rows = [
            row
            for row in group_current_rows
            if (
                row_signature(row)
                not in handled_seed
            )
        ]

        if not usable_current_rows:
            continue

        impact = (
            rows_required_total(
                usable_current_rows
            )
            - rows_required_total(
                matched_baseline_rows
            )
        )

        contribution = Contribution(
            label=course_name(
                matched_baseline_rows[0]
            ),
            before_rows=(
                matched_baseline_rows
            ),
            after_rows=(
                usable_current_rows
            ),
            impact=impact,
            source=(
                f"change_group:{group_name}"
            ),
        )

        contributions.append(
            contribution
        )

        for row in (
            matched_baseline_rows
        ):
            handled_baseline.add(
                row_signature(row)
            )

        for row in (
            usable_current_rows
        ):
            handled_seed.add(
                row_signature(row)
            )

    # -------------------------------------------------
    # 3. 같은 course_code의 속성 변화
    # -------------------------------------------------

    for code, baseline_row in (
        baseline_by_code.items()
    ):
        if (
            row_signature(
                baseline_row
            )
            in handled_baseline
        ):
            continue

        seed_row = seed_by_code.get(
            code
        )

        if seed_row is None:
            continue

        if (
            row_signature(seed_row)
            in handled_seed
        ):
            continue

        baseline_required = (
            required_credit(
                baseline_row
            )
        )

        seed_required = (
            required_credit(
                seed_row
            )
        )

        impact = (
            seed_required
            - baseline_required
        )

        if impact != 0:
            contributions.append(
                Contribution(
                    label=course_name(
                        seed_row
                    ),
                    before_rows=[
                        baseline_row,
                    ],
                    after_rows=[
                        seed_row,
                    ],
                    impact=impact,
                    source="same_code",
                )
            )

        handled_baseline.add(
            row_signature(
                baseline_row
            )
        )

        handled_seed.add(
            row_signature(
                seed_row
            )
        )

    # -------------------------------------------------
    # 4. 코드만 바뀌었지만 이름이 정확히 같은
    #    1:1 항목 연결
    #
    # 이름은 자동 관계 추론의 권위로 쓰지 않는다.
    # 여기서는 단지 동일 이름의 유일한 1:1 row를
    # 비교 보고서에서 중복 제거하기 위한 보조 연결이다.
    # -------------------------------------------------

    remaining_baseline = [
        row
        for row in baseline_rows
        if (
            row_signature(row)
            not in handled_baseline
        )
    ]

    remaining_seed = [
        row
        for row in current_rows
        if (
            row_signature(row)
            not in handled_seed
        )
    ]

    baseline_name_index: dict[
        str,
        list[dict[str, str]],
    ] = {}

    seed_name_index: dict[
        str,
        list[dict[str, str]],
    ] = {}

    for row in remaining_baseline:
        baseline_name_index.setdefault(
            normalize_name(
                course_name(row)
            ),
            [],
        ).append(row)

    for row in remaining_seed:
        seed_name_index.setdefault(
            normalize_name(
                course_name(row)
            ),
            [],
        ).append(row)

    common_names = (
        set(
            baseline_name_index
        )
        & set(
            seed_name_index
        )
    )

    for name_key in common_names:
        baseline_matches = (
            baseline_name_index[
                name_key
            ]
        )

        seed_matches = (
            seed_name_index[
                name_key
            ]
        )

        if (
            len(baseline_matches) != 1
            or len(seed_matches) != 1
        ):
            continue

        before = baseline_matches[0]
        after = seed_matches[0]

        if (
            row_signature(before)
            in handled_baseline
            or row_signature(after)
            in handled_seed
        ):
            continue

        impact = (
            required_credit(after)
            - required_credit(before)
        )

        if impact != 0:
            contributions.append(
                Contribution(
                    label=course_name(
                        after
                    ),
                    before_rows=[
                        before,
                    ],
                    after_rows=[
                        after,
                    ],
                    impact=impact,
                    source="unique_exact_name",
                )
            )

        handled_baseline.add(
            row_signature(before)
        )

        handled_seed.add(
            row_signature(after)
        )

    # -------------------------------------------------
    # 5. 산술 검증
    # -------------------------------------------------

    nonzero_contributions = [
        item
        for item in contributions
        if item.impact != 0
    ]

    calculated_delta = sum(
        item.impact
        for item in nonzero_contributions
    )

    residual = (
        expected_delta
        - calculated_delta
    )

    unresolved_baseline_required = [
        row
        for row in baseline_rows
        if (
            required_credit(row) > 0
            and row_signature(row)
            not in handled_baseline
        )
    ]

    unresolved_seed_required = [
        row
        for row in current_rows
        if (
            required_credit(row) > 0
            and row_signature(row)
            not in handled_seed
        )
    ]

    # -------------------------------------------------
    # 6. 사용자가 바로 메일/엑셀에 옮길 수 있는
    #    간단한 report 생성
    # -------------------------------------------------

    lines = [
        (
            f"{year}학번 전공필수 "
            "과목 학점 합계 변화"
        ),
        (
            f"{format_credit(baseline_total)}학점"
            f" → "
            f"{format_credit(current_total)}학점"
        ),
        "",
    ]

    for contribution in sorted(
        nonzero_contributions,
        key=lambda item: (
            item.before_rows[0].get(
                "grade",
                "",
            )
            if item.before_rows
            else "",
            item.before_rows[0].get(
                "semester",
                "",
            )
            if item.before_rows
            else "",
            item.label,
        ),
    ):
        lines.append(
            contribution_line(
                contribution
            )
        )

    lines.append("")

    if calculated_delta > 0:
        delta_text = (
            f"+ {format_credit(calculated_delta)}"
        )
    elif calculated_delta < 0:
        delta_text = (
            f"- {format_credit(abs(calculated_delta))}"
        )
    else:
        delta_text = "+ 0"

    lines.append(
        "합계: "
        f"{format_credit(baseline_total)} "
        f"{delta_text} "
        f"= "
        f"{format_credit(baseline_total + calculated_delta)}"
        "학점"
    )

    lines.append("")

    if residual == 0:
        lines.append(
            "검증: PASS "
            "(과목별 전필 증감 합계와 "
            "현재 seed 전필 합계가 일치)"
        )
    else:
        lines.append(
            "검증: REVIEW REQUIRED"
        )
        lines.append(
            "설명되지 않은 전필 학점 차이: "
            f"{format_credit(residual)}학점"
        )

    if unresolved_baseline_required:
        lines.append("")
        lines.append(
            "[미해결 baseline 전필]"
        )

        for row in (
            unresolved_baseline_required
        ):
            lines.append(
                "- "
                f"{course_name(row)} "
                f"({course_code(row) or '코드 없음'}, "
                f"{format_credit(required_credit(row))}학점)"
            )

    if unresolved_seed_required:
        lines.append("")
        lines.append(
            "[미해결 current seed 전필]"
        )

        for row in (
            unresolved_seed_required
        ):
            lines.append(
                "- "
                f"{course_name(row)} "
                f"({course_code(row) or '코드 없음'}, "
                f"{format_credit(required_credit(row))}학점)"
            )

    report = "\n".join(
        lines
    )

    return (
        report,
        baseline_total,
        current_total,
        residual,
    )


def write_report(
    year: int,
) -> None:
    (
        report,
        baseline_total,
        current_total,
        residual,
    ) = build_report(year)

    output_directory().mkdir(
        parents=True,
        exist_ok=True,
    )

    path = output_path(
        year
    )

    path.write_text(
        report + "\n",
        encoding="utf-8",
    )

    print(report)
    print()
    print(f"report: {path}")

    if residual != 0:
        raise SystemExit(
            f"{year}: 전필 변화가 완전히 "
            "reconcile되지 않았습니다."
        )

    print(
        f"{year}: "
        f"{format_credit(baseline_total)}"
        " → "
        f"{format_credit(current_total)} "
        "PASS"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Historical curriculum baseline과 "
            "현재 seed를 비교하여 전공필수 학점 "
            "변화 report를 생성합니다."
        )
    )

    parser.add_argument(
        "--year",
        type=int,
        default=2024,
        choices=SUPPORTED_YEARS,
        help=(
            "대상 학번. 기본값: 2024"
        ),
    )

    parser.add_argument(
        "--all",
        action="store_true",
        help=(
            "지원되는 모든 학번 report 생성"
        ),
    )

    return parser.parse_args()


def main() -> None:
    args = parse_args()

    years = (
        SUPPORTED_YEARS
        if args.all
        else [
            args.year,
        ]
    )

    for index, year in enumerate(
        years
    ):
        if index:
            print()
            print(
                "=" * 72
            )
            print()

        write_report(
            year
        )


if __name__ == "__main__":
    main()
from __future__ import annotations

import csv
import re
from pathlib import Path

from scripts.common.data_paths import (
    EXTRACTED_CURRICULUM_FLOWCHARTS_DIR,
)


YEARS = [
    2022,
    2023,
    2024,
]


def report_directory() -> Path:
    return (
        EXTRACTED_CURRICULUM_FLOWCHARTS_DIR
        / "comparison"
        / "required_credit_change_report"
    )


def report_path(
    year: int,
) -> Path:
    return (
        report_directory()
        / f"required_credit_change_report_{year}.txt"
    )


def output_path() -> Path:
    return (
        report_directory()
        / "전공필수_학점변화_학과문의용.csv"
    )


def read_report(
    year: int,
) -> str:
    path = report_path(year)

    if not path.exists():
        raise FileNotFoundError(
            f"report가 없습니다: {path}\n"
            "먼저 아래 명령을 실행하세요:\n"
            "python -m "
            "scripts.curriculum.seed_reconciliation."
            "build_required_credit_change_report --all"
        )

    return path.read_text(
        encoding="utf-8",
    )


def parse_report(
    year: int,
    text: str,
) -> dict[str, object]:
    lines = [
        line.strip()
        for line in text.splitlines()
        if line.strip()
    ]

    total_match = re.fullmatch(
        r"([0-9.]+)학점\s*→\s*([0-9.]+)학점",
        lines[1],
    )

    if not total_match:
        raise RuntimeError(
            f"{year}학번 총학점 행을 읽을 수 없습니다: "
            f"{lines[1]}"
        )

    before_total = float(
        total_match.group(1)
    )

    after_total = float(
        total_match.group(2)
    )

    changes = []
    validation = ""

    for line in lines[2:]:
        if line.startswith("합계:"):
            continue

        if line.startswith("검증:"):
            validation = line
            continue

        if (
            ":" not in line
            or "→" not in line
        ):
            continue

        changes.append(
            parse_change_line(line)
        )

    if not validation.startswith(
        "검증: PASS"
    ):
        raise RuntimeError(
            f"{year}학번 report가 PASS 상태가 아닙니다: "
            f"{validation}"
        )

    return {
        "year": year,
        "before_total": before_total,
        "after_total": after_total,
        "delta": (
            after_total
            - before_total
        ),
        "changes": changes,
    }


def parse_change_line(
    line: str,
) -> dict[str, object]:
    label, rest = line.split(
        ":",
        1,
    )

    rest = rest.strip()

    impact_match = re.search(
        r"\(([+-]?[0-9.]+)\)$",
        rest,
    )

    if not impact_match:
        raise RuntimeError(
            f"전필 영향 값을 읽을 수 없습니다: {line}"
        )

    impact = float(
        impact_match.group(1)
    )

    transition = (
        rest[
            :impact_match.start()
        ]
        .strip()
    )

    before_text, after_text = (
        transition.split(
            "→",
            1,
        )
    )

    return {
        "course": label.strip(),
        "before": before_text.strip(),
        "after": after_text.strip(),
        "impact": impact,
    }


def format_number(
    value: float,
) -> str:
    if value.is_integer():
        return str(
            int(value)
        )

    return f"{value:g}"


def format_impact(
    value: float,
) -> str:
    if value > 0:
        return (
            f"+{format_number(value)}학점"
        )

    return (
        f"{format_number(value)}학점"
    )


def build_rows(
    reports: list[dict[str, object]],
) -> list[list[str]]:
    rows: list[list[str]] = []

    rows.append([
        "학번별 전공필수 학점 변화",
        "",
        "",
        "",
        "",
    ])

    rows.append([
        "",
        "",
        "",
        "",
        "",
    ])

    rows.append([
        "학번",
        "기존 전필",
        "변경 후",
        "순변화",
        "",
    ])

    for report in reports:
        delta = float(
            report["delta"]
        )

        rows.append([
            f'{report["year"]}학번',
            (
                f'{format_number(float(report["before_total"]))}'
                "학점"
            ),
            (
                f'{format_number(float(report["after_total"]))}'
                "학점"
            ),
            format_impact(delta),
            "",
        ])

    rows.append([
        "",
        "",
        "",
        "",
        "",
    ])

    for report in reports:
        year = int(
            report["year"]
        )

        before_total = float(
            report["before_total"]
        )

        after_total = float(
            report["after_total"]
        )

        delta = float(
            report["delta"]
        )

        rows.append([
            f"{year}학번",
            (
                f"{format_number(before_total)}학점"
                " → "
                f"{format_number(after_total)}학점"
            ),
            "",
            "",
            "",
        ])

        rows.append([
            "변경 과목",
            "변경 전",
            "→",
            "변경 후",
            "전필 영향",
        ])

        for change in report[
            "changes"
        ]:
            rows.append([
                str(
                    change["course"]
                ),
                str(
                    change["before"]
                ),
                "→",
                str(
                    change["after"]
                ),
                format_impact(
                    float(
                        change["impact"]
                    )
                ),
            ])

        rows.append([
            "합계",
            (
                f"{format_number(before_total)}학점"
            ),
            "+",
            (
                f"{format_number(delta)}학점"
            ),
            (
                f"= {format_number(after_total)}학점"
            ),
        ])

        rows.append([
            "",
            "",
            "",
            "",
            "",
        ])

    return rows


def main() -> None:
    reports = []

    for year in YEARS:
        reports.append(
            parse_report(
                year,
                read_report(year),
            )
        )

    rows = build_rows(
        reports
    )

    target = output_path()

    target.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    # utf-8-sig:
    # Excel에서 한글이 깨지지 않도록 BOM 포함 UTF-8로 저장.
    with target.open(
        "w",
        encoding="utf-8-sig",
        newline="",
    ) as file:
        writer = csv.writer(
            file
        )

        writer.writerows(
            rows
        )

    print(
        "학과 문의용 CSV 생성 완료"
    )

    print(
        f"output: {target}"
    )


if __name__ == "__main__":
    main()
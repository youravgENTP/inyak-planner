from __future__ import annotations

import argparse
import csv
import hashlib
import shutil
from decimal import Decimal
from pathlib import Path

from scripts.common.data_paths import (
    EXTRACTED_CURRICULUM_FLOWCHARTS_DIR,
    PROJECT_ROOT,
)


TARGET_YEARS = [
    2022,
    2023,
    2024,
]

EXPECTED_ROWS = {
    2022: 93,
    2023: 95,
    2024: 99,
}

EXPECTED_TOTAL_CREDITS = {
    2022: Decimal("216"),
    2023: Decimal("220"),
    2024: Decimal("227"),
}

EXPECTED_REQUIRED_CREDITS = {
    2022: Decimal("118"),
    2023: Decimal("118"),
    2024: Decimal("118"),
}

EXPECTED_ELECTIVE_CREDITS = {
    2022: Decimal("98"),
    2023: Decimal("102"),
    2024: Decimal("109"),
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

MANIFEST_COLUMNS = [
    "entry_year",
    "source_path",
    "target_path",
    "rows",
    "total_credits",
    "required_credits",
    "elective_credits",
    "sha256",
]


def comparison_directory() -> Path:
    return (
        EXTRACTED_CURRICULUM_FLOWCHARTS_DIR
        / "comparison"
    )


def provisional_directory() -> Path:
    return (
        comparison_directory()
        / "curriculum_provisional_baseline"
    )


def source_path(
    year: int,
) -> Path:
    return (
        provisional_directory()
        / f"curriculum_{year}.csv"
    )


def baseline_directory() -> Path:
    return (
        PROJECT_ROOT
        / "data"
        / "baseline"
        / "curriculum"
    )


def target_path(
    year: int,
) -> Path:
    return (
        baseline_directory()
        / f"curriculum_{year}.csv"
    )


def manifest_path() -> Path:
    return (
        baseline_directory()
        / "baseline_manifest.csv"
    )


def report_path() -> Path:
    return (
        baseline_directory()
        / "baseline_promotion_report.txt"
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

        return list(
            reader.fieldnames
            or []
        )


def sha256_file(
    path: Path,
) -> str:
    digest = hashlib.sha256()

    with path.open(
        "rb"
    ) as file:
        while True:
            chunk = file.read(
                1024 * 1024
            )

            if not chunk:
                break

            digest.update(
                chunk
            )

    return digest.hexdigest()


def credit_value(
    value: str,
    *,
    year: int,
    row_number: int,
    course_name: str,
) -> Decimal:
    value = (
        value
        or ""
    ).strip()

    if not value:
        raise RuntimeError(
            f"{year}: 학점이 비어 있습니다. "
            f"row={row_number}, "
            f"course={course_name}"
        )

    try:
        return Decimal(
            value
        )
    except Exception as exc:
        raise RuntimeError(
            f"{year}: 학점 형식이 잘못되었습니다. "
            f"row={row_number}, "
            f"course={course_name}, "
            f"credits={value}"
        ) from exc


def validate_schema(
    path: Path,
    year: int,
) -> None:
    fieldnames = (
        read_fieldnames(
            path
        )
    )

    if fieldnames != COURSE_COLUMNS:
        raise RuntimeError(
            f"{year}: baseline schema가 예상과 다릅니다.\n"
            f"expected={COURSE_COLUMNS}\n"
            f"actual={fieldnames}"
        )


def validate_rows(
    rows: list[dict[str, str]],
    year: int,
) -> dict[str, object]:
    expected_rows = (
        EXPECTED_ROWS[
            year
        ]
    )

    if len(rows) != expected_rows:
        raise RuntimeError(
            f"{year}: 행 수 불일치. "
            f"expected={expected_rows}, "
            f"actual={len(rows)}"
        )

    total_credits = Decimal(
        "0"
    )

    required_credits = Decimal(
        "0"
    )

    elective_credits = Decimal(
        "0"
    )

    identities = set()

    for index, row in enumerate(
        rows,
        start=2,
    ):
        entry_year = (
            row.get(
                "entry_year",
                "",
            )
            or ""
        ).strip()

        if entry_year != str(year):
            raise RuntimeError(
                f"{year}: entry_year 불일치. "
                f"row={index}, "
                f"value={entry_year}"
            )

        grade = (
            row.get(
                "grade",
                "",
            )
            or ""
        ).strip()

        semester = (
            row.get(
                "semester",
                "",
            )
            or ""
        ).strip()

        course_name = (
            row.get(
                "course_name",
                "",
            )
            or ""
        ).strip()

        course_code = (
            row.get(
                "course_code",
                "",
            )
            or ""
        ).strip()

        completion_type = (
            row.get(
                "completion_type",
                "",
            )
            or ""
        ).strip()

        change_role = (
            row.get(
                "change_role",
                "",
            )
            or ""
        ).strip()

        if not course_name:
            raise RuntimeError(
                f"{year}: 과목명이 비어 있습니다. "
                f"row={index}"
            )

        if grade not in {
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
        }:
            raise RuntimeError(
                f"{year}: 잘못된 grade. "
                f"row={index}, "
                f"value={grade}"
            )

        if semester not in {
            "1",
            "2",
        }:
            raise RuntimeError(
                f"{year}: 잘못된 semester. "
                f"row={index}, "
                f"value={semester}"
            )

        if completion_type not in {
            "전필",
            "전선",
        }:
            raise RuntimeError(
                f"{year}: 잘못된 completion_type. "
                f"row={index}, "
                f"value={completion_type}"
            )

        # Historical baseline에서는 변경관리 metadata가
        # 아직 부여되지 않은 공란도 정상이다.
        # 값이 존재하는 경우에만 허용값을 검증한다.
        if (
            change_role
            and change_role not in {
                "current",
                "legacy",
            }
        ):
            raise RuntimeError(
                f"{year}: 잘못된 change_role. "
                f"row={index}, "
                f"value={change_role}"
            )

        identity = (
            grade,
            semester,
            course_name,
            course_code,
            change_role,
        )

        if identity in identities:
            raise RuntimeError(
                f"{year}: 중복 baseline identity. "
                f"{identity}"
            )

        identities.add(
            identity
        )

        credits = credit_value(
            row.get(
                "credits",
                "",
            ),
            year=year,
            row_number=index,
            course_name=course_name,
        )

        total_credits += (
            credits
        )

        if completion_type == "전필":
            required_credits += (
                credits
            )
        else:
            elective_credits += (
                credits
            )

    if (
        total_credits
        != EXPECTED_TOTAL_CREDITS[
            year
        ]
    ):
        raise RuntimeError(
            f"{year}: 총 학점 불일치. "
            f"expected="
            f"{EXPECTED_TOTAL_CREDITS[year]}, "
            f"actual={total_credits}"
        )

    if (
        required_credits
        != EXPECTED_REQUIRED_CREDITS[
            year
        ]
    ):
        raise RuntimeError(
            f"{year}: 전필 학점 불일치. "
            f"expected="
            f"{EXPECTED_REQUIRED_CREDITS[year]}, "
            f"actual={required_credits}"
        )

    if (
        elective_credits
        != EXPECTED_ELECTIVE_CREDITS[
            year
        ]
    ):
        raise RuntimeError(
            f"{year}: 전선 개설학점 불일치. "
            f"expected="
            f"{EXPECTED_ELECTIVE_CREDITS[year]}, "
            f"actual={elective_credits}"
        )

    return {
        "rows": len(
            rows
        ),
        "total_credits": (
            total_credits
        ),
        "required_credits": (
            required_credits
        ),
        "elective_credits": (
            elective_credits
        ),
    }


def validate_source(
    year: int,
) -> dict[str, object]:
    path = source_path(
        year
    )

    if not path.exists():
        raise FileNotFoundError(
            path
        )

    validate_schema(
        path,
        year,
    )

    rows = read_csv_rows(
        path
    )

    stats = validate_rows(
        rows,
        year,
    )

    stats[
        "source_path"
    ] = path

    stats[
        "sha256"
    ] = sha256_file(
        path
    )

    return stats


def validate_existing_target(
    year: int,
    source_sha256: str,
) -> str:
    target = target_path(
        year
    )

    if not target.exists():
        return "absent"

    target_sha256 = (
        sha256_file(
            target
        )
    )

    if (
        target_sha256
        == source_sha256
    ):
        return "identical"

    raise RuntimeError(
        f"{year}: 기존 baseline 파일이 "
        "provisional과 다릅니다.\n"
        f"target={target}\n"
        "자동 overwrite하지 않습니다."
    )


def write_manifest(
    records: list[dict[str, str]],
) -> None:
    path = manifest_path()

    with path.open(
        "w",
        encoding="utf-8-sig",
        newline="",
    ) as file:
        writer = csv.DictWriter(
            file,
            fieldnames=MANIFEST_COLUMNS,
        )

        writer.writeheader()
        writer.writerows(
            records
        )


def build_report(
    records: list[dict[str, str]],
    *,
    applied: bool,
) -> str:
    lines = [
        "Curriculum baseline promotion",
        "=============================================",
        "",
        (
            "mode: APPLY"
            if applied
            else "mode: DRY RUN"
        ),
        "",
        (
            "Target cohort baseline is immutable "
            "historical entry-year data."
        ),
        "",
    ]

    for record in records:
        lines.extend(
            [
                (
                    f"{record['entry_year']}"
                ),
                "----",
                (
                    f"rows: "
                    f"{record['rows']}"
                ),
                (
                    f"total credits: "
                    f"{record['total_credits']}"
                ),
                (
                    f"required credits: "
                    f"{record['required_credits']}"
                ),
                (
                    f"elective listed credits: "
                    f"{record['elective_credits']}"
                ),
                (
                    f"sha256: "
                    f"{record['sha256']}"
                ),
                (
                    f"target state before apply: "
                    f"{record['target_state']}"
                ),
                "",
            ]
        )

    lines.extend(
        [
            "Guards",
            "------",
            (
                "1. Exact 19-column schema required."
            ),
            (
                "2. entry_year must equal cohort year "
                "for every row."
            ),
            (
                "3. Expected row counts are enforced."
            ),
            (
                "4. Major-required credits must equal "
                "118 for 2022-2024."
            ),
            (
                "5. Total listed credits and elective "
                "listed credits are checked."
            ),
            (
                "6. Existing non-identical baseline files "
                "are never overwritten."
            ),
            (
                "7. Promoted files are byte-identical "
                "copies of provisional files."
            ),
            "",
        ]
    )

    if applied:
        lines.append(
            "Promotion completed successfully."
        )
    else:
        lines.append(
            "Dry run passed. Re-run with --apply "
            "to promote."
        )

    lines.append(
        ""
    )

    return "\n".join(
        lines
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Validate and promote provisional "
            "curriculum cohort baselines."
        )
    )

    parser.add_argument(
        "--apply",
        action="store_true",
        help=(
            "Copy validated provisional files into "
            "data/baseline/curriculum."
        ),
    )

    args = parser.parse_args()

    records = []

    for year in TARGET_YEARS:
        stats = validate_source(
            year
        )

        source = stats[
            "source_path"
        ]

        source_sha256 = str(
            stats[
                "sha256"
            ]
        )

        target_state = (
            validate_existing_target(
                year,
                source_sha256,
            )
        )

        records.append(
            {
                "entry_year": str(
                    year
                ),
                "source_path": str(
                    source.relative_to(
                        PROJECT_ROOT
                    )
                ),
                "target_path": str(
                    target_path(
                        year
                    ).relative_to(
                        PROJECT_ROOT
                    )
                ),
                "rows": str(
                    stats[
                        "rows"
                    ]
                ),
                "total_credits": str(
                    stats[
                        "total_credits"
                    ]
                ),
                "required_credits": str(
                    stats[
                        "required_credits"
                    ]
                ),
                "elective_credits": str(
                    stats[
                        "elective_credits"
                    ]
                ),
                "sha256": (
                    source_sha256
                ),
                "target_state": (
                    target_state
                ),
            }
        )

    print()
    print(
        "Curriculum baseline promotion"
    )
    print(
        "-----------------------------"
    )

    for record in records:
        print(
            f"{record['entry_year']}: "
            f"{record['rows']} rows, "
            f"전필 {record['required_credits']}, "
            f"전선 {record['elective_credits']}, "
            f"target={record['target_state']}"
        )

    if not args.apply:
        print()
        print(
            "DRY RUN PASS"
        )
        print(
            "No baseline files were modified."
        )
        print()
        print(
            "Apply with:"
        )
        print(
            "python -m "
            "scripts.curriculum."
            "promote_curriculum_baseline "
            "--apply"
        )
        return

    baseline_directory().mkdir(
        parents=True,
        exist_ok=True,
    )

    for year in TARGET_YEARS:
        source = source_path(
            year
        )

        target = target_path(
            year
        )

        if target.exists():
            # 위에서 이미 source와 SHA-256 동일성을
            # 검증했으므로 그대로 둔다.
            continue

        shutil.copyfile(
            source,
            target,
        )

        if (
            sha256_file(
                source
            )
            != sha256_file(
                target
            )
        ):
            raise RuntimeError(
                f"{year}: promotion 후 "
                "SHA-256 검증 실패"
            )

    manifest_records = []

    for record in records:
        manifest_records.append(
            {
                column: record[
                    column
                ]
                for column
                in MANIFEST_COLUMNS
            }
        )

    write_manifest(
        manifest_records
    )

    report = build_report(
        records,
        applied=True,
    )

    report_path().write_text(
        report,
        encoding="utf-8",
    )

    print()
    print(
        "APPLY PASS"
    )
    print(
        f"baseline: "
        f"{baseline_directory()}"
    )
    print(
        f"manifest: "
        f"{manifest_path()}"
    )
    print(
        f"report: "
        f"{report_path()}"
    )


if __name__ == "__main__":
    main()
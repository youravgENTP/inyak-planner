from __future__ import annotations

from scripts.common.data_paths import (
    DATABASE_PATH,
    GRADUATION_REQUIREMENTS_PATH,
)

import csv
import sqlite3
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]

CSV_PATH = GRADUATION_REQUIREMENTS_PATH

SCHEMA_PATH = (
    PROJECT_ROOT
    / "scripts"
    / "schema.sql"
)


UPSERT_SQL = """
INSERT INTO graduation_requirements (
    entry_year,
    major_required_credits,
    major_elective_credits,
    notes
)
VALUES (?, ?, ?, ?)
ON CONFLICT (entry_year)
DO UPDATE SET
    major_required_credits =
        excluded.major_required_credits,
    major_elective_credits =
        excluded.major_elective_credits,
    notes = excluded.notes,
    updated_at = CURRENT_TIMESTAMP
"""


def parse_required_int(
    value: str | None,
    field_name: str,
) -> int:
    if value is None:
        raise ValueError(
            f"{field_name} 값이 없습니다."
        )

    normalized_value = value.strip()

    if not normalized_value:
        raise ValueError(
            f"{field_name} 값이 비어 있습니다."
        )

    try:
        return int(normalized_value)
    except ValueError as exc:
        raise ValueError(
            f"{field_name} 값이 정수가 아닙니다: "
            f"{normalized_value}"
        ) from exc


def parse_required_float(
    value: str | None,
    field_name: str,
) -> float:
    if value is None:
        raise ValueError(
            f"{field_name} 값이 없습니다."
        )

    normalized_value = value.strip()

    if not normalized_value:
        raise ValueError(
            f"{field_name} 값이 비어 있습니다."
        )

    try:
        parsed_value = float(
            normalized_value
        )
    except ValueError as exc:
        raise ValueError(
            f"{field_name} 값이 숫자가 아닙니다: "
            f"{normalized_value}"
        ) from exc

    if parsed_value < 0:
        raise ValueError(
            f"{field_name} 값은 0 이상이어야 합니다: "
            f"{normalized_value}"
        )

    return parsed_value


def normalize_note(
    value: str | None,
) -> str | None:
    if value is None:
        return None

    normalized_value = value.strip()

    return normalized_value or None


def load_rows() -> list[
    tuple[int, float, float, str | None]
]:
    with CSV_PATH.open(
        "r",
        encoding="utf-8-sig",
        newline="",
    ) as csv_file:
        reader = csv.DictReader(csv_file)

        expected_fields = {
            "entry_year",
            "major_required_credits",
            "major_elective_credits",
            "notes",
        }

        actual_fields = set(
            reader.fieldnames or []
        )

        if actual_fields != expected_fields:
            raise ValueError(
                "CSV 헤더가 예상 형식과 다릅니다.\n"
                f"예상: {sorted(expected_fields)}\n"
                f"실제: {sorted(actual_fields)}"
            )

        rows = []

        seen_entry_years: set[int] = set()

        for row_number, row in enumerate(
            reader,
            start=2,
        ):
            entry_year = parse_required_int(
                row.get("entry_year"),
                f"{row_number}행 entry_year",
            )

            if entry_year in seen_entry_years:
                raise ValueError(
                    f"{row_number}행: "
                    f"{entry_year}학번이 중복되어 있습니다."
                )

            seen_entry_years.add(entry_year)

            major_required_credits = (
                parse_required_float(
                    row.get(
                        "major_required_credits"
                    ),
                    (
                        f"{row_number}행 "
                        "major_required_credits"
                    ),
                )
            )

            major_elective_credits = (
                parse_required_float(
                    row.get(
                        "major_elective_credits"
                    ),
                    (
                        f"{row_number}행 "
                        "major_elective_credits"
                    ),
                )
            )

            notes = normalize_note(
                row.get("notes")
            )

            rows.append(
                (
                    entry_year,
                    major_required_credits,
                    major_elective_credits,
                    notes,
                )
            )

    return rows


def main() -> None:
    if not CSV_PATH.is_file():
        raise FileNotFoundError(
            f"CSV 파일을 찾을 수 없습니다: "
            f"{CSV_PATH}"
        )

    DATABASE_PATH.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    rows = load_rows()

    connection = sqlite3.connect(
        DATABASE_PATH
    )

    try:
        connection.execute(
            "PRAGMA foreign_keys = ON"
        )

        connection.executescript(
            SCHEMA_PATH.read_text(
                encoding="utf-8"
            )
        )

        connection.executemany(
            UPSERT_SQL,
            rows,
        )

        connection.commit()
    finally:
        connection.close()

    print(
        "졸업요건 적재 완료: "
        f"{len(rows)}개 학번"
    )

    print(
        f"SQLite DB: {DATABASE_PATH}"
    )


if __name__ == "__main__":
    main()
from __future__ import annotations

import sqlite3
from pathlib import Path


from scripts.common.data_paths import (
    DATABASE_PATH,
)


DB_PATH = DATABASE_PATH


ATTRIBUTE_COLUMNS = {
    "previous_credits": (
        "REAL"
    ),
    "previous_completion_type": (
        "TEXT "
        "CHECK ("
        "previous_completion_type IS NULL "
        "OR previous_completion_type "
        "IN ('전필', '전선')"
        ")"
    ),
    "previous_grade": (
        "INTEGER "
        "CHECK ("
        "previous_grade IS NULL "
        "OR previous_grade BETWEEN 1 AND 6"
        ")"
    ),
    "previous_semester": (
        "INTEGER "
        "CHECK ("
        "previous_semester IS NULL "
        "OR previous_semester IN (1, 2)"
        ")"
    ),
    "attribute_change_effective_year": (
        "INTEGER "
        "CHECK ("
        "attribute_change_effective_year IS NULL "
        "OR attribute_change_effective_year "
        "BETWEEN 2000 AND 2100"
        ")"
    ),
    "attribute_change_note": (
        "TEXT"
    ),
}


def get_existing_columns(
    connection: sqlite3.Connection,
) -> set[str]:
    rows = connection.execute(
        """
        PRAGMA table_info(curriculum_courses)
        """
    ).fetchall()

    return {
        str(row[1])
        for row in rows
    }


def main() -> None:
    if not DB_PATH.is_file():
        raise SystemExit(
            "DB 파일을 찾을 수 없습니다: "
            f"{DB_PATH}"
        )

    with sqlite3.connect(DB_PATH) as connection:
        existing_columns = get_existing_columns(
            connection
        )

        added_columns: list[str] = []

        for (
            column_name,
            column_definition,
        ) in ATTRIBUTE_COLUMNS.items():
            if column_name in existing_columns:
                print(
                    f"이미 존재: {column_name}"
                )
                continue

            connection.execute(
                f"""
                ALTER TABLE curriculum_courses
                ADD COLUMN {column_name}
                {column_definition}
                """
            )

            added_columns.append(
                column_name
            )

            print(
                f"추가 완료: {column_name}"
            )

        connection.commit()

        final_columns = get_existing_columns(
            connection
        )

    missing_columns = (
        set(ATTRIBUTE_COLUMNS)
        - final_columns
    )

    if missing_columns:
        raise SystemExit(
            "Migration 후에도 컬럼이 없습니다: "
            + ", ".join(
                sorted(missing_columns)
            )
        )

    print()
    print(
        "SQLite curriculum attribute "
        "change migration 완료"
    )
    print(
        f"새로 추가된 컬럼: "
        f"{len(added_columns)}개"
    )
    print(f"DB: {DB_PATH}")


if __name__ == "__main__":
    main()
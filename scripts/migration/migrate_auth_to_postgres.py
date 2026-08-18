from __future__ import annotations

import os
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import UUID

import psycopg
from psycopg import sql


from scripts.common.data_paths import (
    AUTH_DATABASE_PATH,
)


# sessions는 의도적으로 이전하지 않는다.
TABLES_TO_MIGRATE = [
    "users",
    "user_course_records",
    "user_special_semesters",
]


TABLE_COLUMNS = {
    "users": [
        "id",
        "username",
        "username_normalized",
        "password_hash",
        "profile_image_filename",
        "entry_year",
        "student_type",
        "created_at",
        "updated_at",
    ],
    "user_course_records": [
        "id",
        "user_id",
        "curriculum_course_id",
        "lecture_id",
        "general_education_requirement_id",
        "general_education_area_id",
        "academic_year",
        "grade",
        "semester",
        "term",
        "course_name",
        "course_code",
        "completion_type",
        "credits",
        "status",
        "letter_grade",
        "is_retake",
        "note",
        "created_at",
        "updated_at",
    ],
    "user_special_semesters": [
        "id",
        "user_id",
        "grade",
        "semester",
        "term",
        "created_at",
        "updated_at",
    ],
}


UUID_COLUMNS = {
    "users": {
        "id",
    },
    "user_course_records": {
        "id",
        "user_id",
    },
    "user_special_semesters": {
        "id",
        "user_id",
    },
}


TIMESTAMP_COLUMNS = {
    "users": {
        "created_at",
        "updated_at",
    },
    "user_course_records": {
        "created_at",
        "updated_at",
    },
    "user_special_semesters": {
        "created_at",
        "updated_at",
    },
}


def get_database_url() -> str:
    database_url = os.environ.get(
        "DATABASE_URL",
        "",
    ).strip()

    if not database_url:
        raise RuntimeError(
            "DATABASE_URL 환경변수가 없습니다."
        )

    return database_url


def connect_sqlite() -> sqlite3.Connection:
    if not AUTH_DATABASE_PATH.is_file():
        raise FileNotFoundError(
            "auth.db를 찾을 수 없습니다: "
            f"{AUTH_DATABASE_PATH}"
        )

    connection = sqlite3.connect(
        AUTH_DATABASE_PATH
    )

    connection.row_factory = sqlite3.Row
    connection.execute(
        "PRAGMA foreign_keys = ON"
    )

    return connection


def parse_uuid(
    value: Any,
) -> UUID | None:
    if value is None:
        return None

    return UUID(
        str(value)
    )


def parse_timestamp(
    value: Any,
) -> datetime | None:
    if value is None:
        return None

    text = str(value).strip()

    if text.endswith("Z"):
        text = (
            text[:-1]
            + "+00:00"
        )

    parsed = datetime.fromisoformat(
        text
    )

    if parsed.tzinfo is None:
        parsed = parsed.replace(
            tzinfo=timezone.utc
        )

    return parsed


def normalize_value(
    table_name: str,
    column_name: str,
    value: Any,
) -> Any:
    if (
        column_name
        in UUID_COLUMNS.get(
            table_name,
            set(),
        )
    ):
        return parse_uuid(
            value
        )

    if (
        column_name
        in TIMESTAMP_COLUMNS.get(
            table_name,
            set(),
        )
    ):
        return parse_timestamp(
            value
        )

    if (
        table_name
        == "user_course_records"
        and column_name
        == "is_retake"
    ):
        return bool(
            value
        )

    return value


def get_source_columns(
    connection: sqlite3.Connection,
    table_name: str,
) -> set[str]:
    rows = connection.execute(
        f"""
        PRAGMA table_info(
            {table_name}
        )
        """
    ).fetchall()

    return {
        str(row["name"])
        for row in rows
    }


def validate_source_schema(
    connection: sqlite3.Connection,
) -> None:
    for table_name in TABLES_TO_MIGRATE:
        actual_columns = get_source_columns(
            connection,
            table_name,
        )

        expected_columns = set(
            TABLE_COLUMNS[
                table_name
            ]
        )

        missing_columns = (
            expected_columns
            - actual_columns
        )

        if missing_columns:
            missing = ", ".join(
                sorted(
                    missing_columns
                )
            )

            raise RuntimeError(
                f"{table_name}에 필요한 "
                f"컬럼이 없습니다: {missing}"
            )


def get_source_count(
    connection: sqlite3.Connection,
    table_name: str,
) -> int:
    row = connection.execute(
        f"""
        SELECT COUNT(*)
        FROM {table_name}
        """
    ).fetchone()

    return int(
        row[0]
    )


def print_source_summary(
    connection: sqlite3.Connection,
) -> None:
    print()
    print(
        "SQLite source:"
    )
    print(
        f"  {AUTH_DATABASE_PATH}"
    )
    print()

    for table_name in [
        "users",
        "sessions",
        "user_course_records",
        "user_special_semesters",
    ]:
        count = get_source_count(
            connection,
            table_name,
        )

        suffix = ""

        if table_name == "sessions":
            suffix = "  [SKIP]"

        print(
            f"  {table_name}: "
            f"{count} rows"
            f"{suffix}"
        )

    print()


def ensure_destination_is_empty(
    connection: psycopg.Connection[Any],
) -> None:
    non_empty_tables: list[
        tuple[str, int]
    ] = []

    with connection.cursor() as cursor:
        for table_name in TABLES_TO_MIGRATE:
            query = sql.SQL(
                """
                SELECT COUNT(*)
                FROM public.{}
                """
            ).format(
                sql.Identifier(
                    table_name
                )
            )

            cursor.execute(
                query
            )

            row = cursor.fetchone()

            if row is None:
                raise RuntimeError(
                    f"{table_name} 행 수를 "
                    "확인하지 못했습니다."
                )

            count = int(
                row[0]
            )

            if count > 0:
                non_empty_tables.append(
                    (
                        table_name,
                        count,
                    )
                )

    if not non_empty_tables:
        return

    details = "\n".join(
        f"  - {table}: {count} rows"
        for table, count
        in non_empty_tables
    )

    raise RuntimeError(
        "Supabase 사용자 테이블에 이미 "
        "데이터가 있습니다.\n"
        "중복 이전을 방지하기 위해 "
        "중단합니다.\n\n"
        f"{details}"
    )


def read_rows(
    connection: sqlite3.Connection,
    table_name: str,
) -> list[tuple[Any, ...]]:
    columns = TABLE_COLUMNS[
        table_name
    ]

    column_sql = ", ".join(
        columns
    )

    rows = connection.execute(
        f"""
        SELECT
            {column_sql}
        FROM {table_name}
        """
    ).fetchall()

    result: list[
        tuple[Any, ...]
    ] = []

    for row in rows:
        result.append(
            tuple(
                normalize_value(
                    table_name,
                    column_name,
                    row[column_name],
                )
                for column_name
                in columns
            )
        )

    return result


def validate_user_links(
    connection: sqlite3.Connection,
) -> None:
    """
    이수 기록과 특별학기가 존재하지 않는
    사용자 ID를 참조하지 않는지 확인한다.
    """
    user_ids = {
        str(row["id"])
        for row in connection.execute(
            """
            SELECT id
            FROM users
            """
        ).fetchall()
    }

    checks = [
        "user_course_records",
        "user_special_semesters",
    ]

    for table_name in checks:
        rows = connection.execute(
            f"""
            SELECT DISTINCT user_id
            FROM {table_name}
            """
        ).fetchall()

        missing_user_ids = {
            str(row["user_id"])
            for row in rows
            if str(
                row["user_id"]
            ) not in user_ids
        }

        if missing_user_ids:
            raise RuntimeError(
                f"{table_name}에 존재하지 않는 "
                "user_id 참조가 있습니다."
            )


def insert_table(
    sqlite_connection: sqlite3.Connection,
    postgres_connection: psycopg.Connection[Any],
    table_name: str,
) -> int:
    columns = TABLE_COLUMNS[
        table_name
    ]

    rows = read_rows(
        sqlite_connection,
        table_name,
    )

    if not rows:
        print(
            f"[SKIP] {table_name}: "
            "0 rows"
        )

        return 0

    query = sql.SQL(
        """
        INSERT INTO public.{} ({})
        VALUES ({})
        """
    ).format(
        sql.Identifier(
            table_name
        ),
        sql.SQL(", ").join(
            sql.Identifier(
                column
            )
            for column in columns
        ),
        sql.SQL(", ").join(
            sql.Placeholder()
            for _ in columns
        ),
    )

    with postgres_connection.cursor() as cursor:
        cursor.executemany(
            query,
            rows,
        )

    print(
        f"[OK] {table_name}: "
        f"{len(rows)} rows"
    )

    return len(
        rows
    )


def migrate() -> None:
    database_url = get_database_url()

    print(
        "Inyak Planner auth.db "
        "→ PostgreSQL migration"
    )

    with connect_sqlite() as sqlite_connection:
        validate_source_schema(
            sqlite_connection
        )

        validate_user_links(
            sqlite_connection
        )

        print_source_summary(
            sqlite_connection
        )

        print(
            "Supabase PostgreSQL에 "
            "연결하는 중..."
        )

        with psycopg.connect(
            database_url
        ) as postgres_connection:
            ensure_destination_is_empty(
                postgres_connection
            )

            print(
                "대상 사용자 테이블이 비어 있는 것을 "
                "확인했습니다."
            )
            print()

            total_rows = 0

            try:
                # users를 먼저 넣어야
                # 나머지 user_id FK가 유효하다.
                for table_name in TABLES_TO_MIGRATE:
                    total_rows += insert_table(
                        sqlite_connection,
                        postgres_connection,
                        table_name,
                    )

                postgres_connection.commit()

            except Exception:
                postgres_connection.rollback()
                raise

    print()
    print(
        "Authentication data migration completed."
    )
    print(
        f"Total rows copied: "
        f"{total_rows}"
    )
    print(
        "Existing login sessions were "
        "intentionally not migrated."
    )


def main() -> None:
    try:
        migrate()

    except Exception as error:
        print()
        print(
            "Migration failed:",
            file=sys.stderr,
        )
        print(
            str(error),
            file=sys.stderr,
        )

        sys.exit(1)


if __name__ == "__main__":
    main()
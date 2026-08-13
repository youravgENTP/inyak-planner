from __future__ import annotations

import os
import sqlite3
import sys
from pathlib import Path
from typing import Any

import psycopg
from psycopg import sql


PROJECT_ROOT = Path(
    __file__
).resolve().parents[1]

SQLITE_DATABASE_PATH = (
    PROJECT_ROOT
    / "data"
    / "db"
    / "inyak.db"
)


TABLES = [
    "courses",
    "curriculum_courses",
    "graduation_requirements",
    "general_education_requirements",
    "general_education_areas",
]


EXPECTED_COLUMNS = {
    "courses": [
        "id",
        "academic_year",
        "semester",
        "track",
        "course_code",
        "course_name",
        "section",
        "completion_type",
        "credits",
        "professor",
        "department",
        "recommended_year",
        "grading_method",
        "competency_type",
        "schedule_and_room",
        "first_collected_at",
        "last_collected_at",
    ],
    "curriculum_courses": [
        "id",
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
    ],
    "graduation_requirements": [
        "id",
        "entry_year",
        "major_required_credits",
        "major_elective_credits",
        "notes",
    ],
    "general_education_requirements": [
        "id",
        "entry_year",
        "category",
        "minimum_credits",
        "minimum_area_count",
        "notes",
        "display_order",
    ],
    "general_education_areas": [
        "id",
        "requirement_id",
        "area_name",
        "minimum_credits",
        "is_required",
        "notes",
        "display_order",
    ],
}


def connect_sqlite() -> sqlite3.Connection:
    """로컬 Inyak SQLite DB에 연결한다."""
    if not SQLITE_DATABASE_PATH.is_file():
        raise FileNotFoundError(
            "SQLite DB를 찾을 수 없습니다: "
            f"{SQLITE_DATABASE_PATH}"
        )

    connection = sqlite3.connect(
        SQLITE_DATABASE_PATH
    )

    connection.row_factory = sqlite3.Row

    return connection


def get_database_url() -> str:
    """환경변수에서 PostgreSQL 연결 문자열을 읽는다."""
    database_url = os.environ.get(
        "DATABASE_URL",
        "",
    ).strip()

    if not database_url:
        raise RuntimeError(
            "DATABASE_URL 환경변수가 없습니다.\n"
            "Supabase Session pooler URI를 "
            "DATABASE_URL에 설정해 주세요."
        )

    return database_url


def get_sqlite_table_columns(
    connection: sqlite3.Connection,
    table_name: str,
) -> list[str]:
    """SQLite 테이블의 실제 컬럼 목록을 반환한다."""
    rows = connection.execute(
        f"PRAGMA table_info({table_name})"
    ).fetchall()

    return [
        str(row["name"])
        for row in rows
    ]


def get_columns_to_copy(
    connection: sqlite3.Connection,
    table_name: str,
) -> list[str]:
    """
    PostgreSQL 대상으로 정의된 컬럼 중
    실제 SQLite에 존재하는 컬럼만 선택한다.
    """
    source_columns = set(
        get_sqlite_table_columns(
            connection,
            table_name,
        )
    )

    if not source_columns:
        raise RuntimeError(
            f"SQLite에 {table_name} "
            "테이블이 없습니다."
        )

    expected_columns = (
        EXPECTED_COLUMNS[table_name]
    )

    columns = [
        column
        for column in expected_columns
        if column in source_columns
    ]

    if "id" not in columns:
        raise RuntimeError(
            f"{table_name} 테이블에 "
            "id 컬럼이 없습니다."
        )

    return columns


def normalize_value(
    table_name: str,
    column_name: str,
    value: Any,
) -> Any:
    """
    SQLite와 PostgreSQL의 타입 차이가 있는 값을
    PostgreSQL에 맞게 변환한다.
    """
    if (
        table_name
        == "general_education_areas"
        and column_name == "is_required"
        and value is not None
    ):
        return bool(value)

    return value


def read_rows(
    connection: sqlite3.Connection,
    table_name: str,
    columns: list[str],
) -> list[tuple[Any, ...]]:
    """SQLite 테이블 데이터를 읽는다."""
    column_sql = ", ".join(
        columns
    )

    rows = connection.execute(
        f"""
        SELECT
            {column_sql}
        FROM {table_name}
        ORDER BY id
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


def ensure_destination_is_empty(
    postgres_connection: psycopg.Connection[Any],
) -> None:
    """
    실수로 같은 DB에 migration을 두 번 실행하지 않도록
    대상 테이블이 비어 있는지 확인한다.
    """
    non_empty_tables: list[
        tuple[str, int]
    ] = []

    with postgres_connection.cursor() as cursor:
        for table_name in TABLES:
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

            cursor.execute(query)

            count = int(
                cursor.fetchone()[0]
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
        (
            f"  - {table_name}: "
            f"{count} rows"
        )
        for (
            table_name,
            count,
        )
        in non_empty_tables
    )

    raise RuntimeError(
        "Supabase 대상 테이블에 이미 "
        "데이터가 있습니다.\n"
        "중복 migration을 막기 위해 "
        "작업을 중단합니다.\n\n"
        f"{details}"
    )


def insert_table(
    sqlite_connection: sqlite3.Connection,
    postgres_connection: psycopg.Connection[Any],
    table_name: str,
) -> int:
    """한 SQLite 테이블을 PostgreSQL로 복사한다."""
    columns = get_columns_to_copy(
        sqlite_connection,
        table_name,
    )

    rows = read_rows(
        sqlite_connection,
        table_name,
        columns,
    )

    if not rows:
        print(
            f"[SKIP] {table_name}: "
            "0 rows"
        )

        return 0

    insert_query = sql.SQL(
        """
        INSERT INTO public.{} ({})
        VALUES ({})
        """
    ).format(
        sql.Identifier(
            table_name
        ),
        sql.SQL(", ").join(
            sql.Identifier(column)
            for column in columns
        ),
        sql.SQL(", ").join(
            sql.Placeholder()
            for _ in columns
        ),
    )

    with postgres_connection.cursor() as cursor:
        cursor.executemany(
            insert_query,
            rows,
        )

    print(
        f"[OK] {table_name}: "
        f"{len(rows)} rows"
    )

    return len(rows)


def reset_identity_sequence(
    postgres_connection: psycopg.Connection[Any],
    table_name: str,
) -> None:
    """
    기존 SQLite id를 직접 넣은 뒤
    PostgreSQL identity sequence를 최대 id 다음으로 맞춘다.
    """
    with postgres_connection.cursor() as cursor:
        query = sql.SQL(
            """
            SELECT MAX(id)
            FROM public.{}
            """
        ).format(
            sql.Identifier(
                table_name
            )
        )

        cursor.execute(query)

        maximum_id = (
            cursor.fetchone()[0]
        )

        if maximum_id is None:
            return

        cursor.execute(
            """
            SELECT setval(
                pg_get_serial_sequence(
                    %s,
                    'id'
                ),
                %s,
                true
            )
            """,
            (
                f"public.{table_name}",
                maximum_id,
            ),
        )


def print_source_summary(
    sqlite_connection: sqlite3.Connection,
) -> None:
    """migration 전에 SQLite 원본 행 수를 출력한다."""
    print()
    print(
        "SQLite source:"
    )
    print(
        f"  {SQLITE_DATABASE_PATH}"
    )
    print()

    for table_name in TABLES:
        count = int(
            sqlite_connection.execute(
                f"""
                SELECT COUNT(*)
                FROM {table_name}
                """
            ).fetchone()[0]
        )

        print(
            f"  {table_name}: "
            f"{count} rows"
        )

    print()


def migrate() -> None:
    """공용 SQLite 데이터를 Supabase PostgreSQL로 이전한다."""
    database_url = get_database_url()

    print(
        "Inyak Planner SQLite "
        "→ PostgreSQL migration"
    )

    with connect_sqlite() as sqlite_connection:
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
                "대상 테이블이 비어 있는 것을 "
                "확인했습니다."
            )
            print()

            total_rows = 0

            try:
                for table_name in TABLES:
                    total_rows += (
                        insert_table(
                            sqlite_connection,
                            postgres_connection,
                            table_name,
                        )
                    )

                for table_name in TABLES:
                    reset_identity_sequence(
                        postgres_connection,
                        table_name,
                    )

                postgres_connection.commit()

            except Exception:
                postgres_connection.rollback()
                raise

    print()
    print(
        "Migration completed."
    )
    print(
        f"Total rows copied: "
        f"{total_rows}"
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
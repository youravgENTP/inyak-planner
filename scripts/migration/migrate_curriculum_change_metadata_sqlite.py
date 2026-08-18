from __future__ import annotations

import sqlite3
from pathlib import Path


from scripts.common.data_paths import (
    DATABASE_PATH,
)


DB_PATH = DATABASE_PATH


def main() -> None:
    if not DB_PATH.is_file():
        raise SystemExit(
            f"DB 파일을 찾을 수 없습니다: "
            f"{DB_PATH}"
        )

    with sqlite3.connect(DB_PATH) as connection:
        connection.execute(
            "PRAGMA foreign_keys = OFF"
        )

        before_count = connection.execute(
            """
            SELECT COUNT(*)
            FROM curriculum_courses
            """
        ).fetchone()[0]

        connection.execute(
            """
            DROP TABLE IF EXISTS
            curriculum_courses_rebuild
            """
        )

        connection.execute(
            """
            CREATE TABLE
            curriculum_courses_rebuild (
                id INTEGER PRIMARY KEY,

                entry_year INTEGER NOT NULL,

                grade INTEGER NOT NULL
                    CHECK (
                        grade BETWEEN 1 AND 6
                    ),

                semester INTEGER NOT NULL
                    CHECK (
                        semester IN (1, 2)
                    ),

                course_name TEXT NOT NULL,

                course_code TEXT,

                completion_type TEXT NOT NULL
                    CHECK (
                        completion_type
                        IN ('전필', '전선')
                    ),

                credits REAL,

                notes TEXT,

                change_group TEXT,

                change_type TEXT
                    CHECK (
                        change_type IS NULL
                        OR change_type IN (
                            '1:1',
                            '1:N',
                            'N:1',
                            'N:M'
                        )
                    ),

                change_role TEXT NOT NULL
                    DEFAULT 'current'
                    CHECK (
                        change_role IN (
                            'current',
                            'legacy'
                        )
                    ),

                change_effective_year INTEGER
                    CHECK (
                        change_effective_year
                            IS NULL
                        OR change_effective_year
                            BETWEEN 2000 AND 2100
                    ),

                change_note TEXT,

                created_at TEXT NOT NULL
                    DEFAULT CURRENT_TIMESTAMP,

                updated_at TEXT NOT NULL
                    DEFAULT CURRENT_TIMESTAMP,

                UNIQUE (
                    entry_year,
                    grade,
                    semester,
                    course_name,
                    course_code,
                    change_role
                )
            )
            """
        )

        connection.execute(
            """
            INSERT INTO
            curriculum_courses_rebuild (
                id,
                entry_year,
                grade,
                semester,
                course_name,
                course_code,
                completion_type,
                credits,
                notes,
                change_group,
                change_type,
                change_role,
                change_effective_year,
                change_note,
                created_at,
                updated_at
            )
            SELECT
                id,
                entry_year,
                grade,
                semester,
                course_name,
                course_code,
                completion_type,
                credits,
                notes,
                change_group,
                change_type,
                change_role,
                change_effective_year,
                change_note,
                created_at,
                updated_at
            FROM curriculum_courses
            """
        )

        connection.execute(
            """
            DROP TABLE curriculum_courses
            """
        )

        connection.execute(
            """
            ALTER TABLE
                curriculum_courses_rebuild
            RENAME TO curriculum_courses
            """
        )

        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS
            idx_curriculum_courses_entry_year
            ON curriculum_courses (
                entry_year,
                grade,
                semester
            )
            """
        )

        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS
            idx_curriculum_courses_code
            ON curriculum_courses (
                course_code
            )
            """
        )

        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS
            idx_curriculum_courses_change_group
            ON curriculum_courses (
                entry_year,
                change_group
            )
            """
        )

        after_count = connection.execute(
            """
            SELECT COUNT(*)
            FROM curriculum_courses
            """
        ).fetchone()[0]

        connection.commit()

        connection.execute(
            "PRAGMA foreign_keys = ON"
        )

    if before_count != after_count:
        raise SystemExit(
            "Migration 후 curriculum_courses "
            "행 수가 달라졌습니다: "
            f"{before_count} -> {after_count}"
        )

    print(
        "SQLite curriculum_courses "
        "migration 완료"
    )
    print(
        f"행 수: {before_count} -> "
        f"{after_count}"
    )
    print(f"DB: {DB_PATH}")


if __name__ == "__main__":
    main()
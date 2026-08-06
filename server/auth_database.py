from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4


PROJECT_ROOT = Path(
    __file__
).resolve().parents[1]

AUTH_DATABASE_PATH = (
    PROJECT_ROOT
    / "data"
    / "db"
    / "auth.db"
)


def connect_auth_database() -> sqlite3.Connection:
    """회원과 세션 정보를 저장하는 인증 DB에 연결한다."""
    AUTH_DATABASE_PATH.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    connection = sqlite3.connect(
        AUTH_DATABASE_PATH
    )
    connection.row_factory = sqlite3.Row
    connection.execute(
        "PRAGMA foreign_keys = ON"
    )

    return connection


def get_current_time() -> str:
    """현재 UTC 시각을 ISO 문자열로 반환한다."""
    return datetime.now(
        timezone.utc
    ).isoformat()


def ensure_user_profile_columns() -> None:
    """
    기존 users 테이블에 사용자 프로필 컬럼이 없으면 추가한다.

    SQLite의 CREATE TABLE IF NOT EXISTS는 기존 테이블의
    컬럼을 자동으로 변경하지 않으므로 별도 마이그레이션이 필요하다.
    """
    with connect_auth_database() as connection:
        columns = connection.execute(
            """
            PRAGMA table_info(users)
            """
        ).fetchall()

        column_names = {
            column["name"]
            for column in columns
        }

        columns_to_add = {
            "profile_image_filename": "TEXT",
            "entry_year": "INTEGER",
            "student_type": "TEXT",
        }

        for (
            column_name,
            column_type,
        ) in columns_to_add.items():
            if column_name in column_names:
                continue

            connection.execute(
                f"""
                ALTER TABLE users
                ADD COLUMN
                    {column_name} {column_type}
                """
            )

def create_auth_tables() -> None:
    """회원, 로그인 세션, 개인 이수 기록 테이블을 생성한다."""
    with connect_auth_database() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                username_normalized TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                profile_image_filename TEXT,
                entry_year INTEGER,
                student_type TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                token_hash TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                FOREIGN KEY (user_id)
                    REFERENCES users(id)
                    ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS user_course_records (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,

                curriculum_course_id INTEGER,
                lecture_id INTEGER,

                academic_year INTEGER,
                semester INTEGER,

                course_name TEXT NOT NULL,
                course_code TEXT,
                completion_type TEXT NOT NULL,
                credits REAL NOT NULL,

                status TEXT NOT NULL,
                letter_grade TEXT,
                is_retake INTEGER NOT NULL DEFAULT 0,
                note TEXT,

                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,

                FOREIGN KEY (user_id)
                    REFERENCES users(id)
                    ON DELETE CASCADE,

                CHECK (
                    academic_year IS NULL
                    OR academic_year BETWEEN 2000 AND 2100
                ),

                CHECK (
                    semester IS NULL
                    OR semester IN (1, 2)
                ),

                CHECK (
                    completion_type IN (
                        '전필',
                        '전선',
                        '교양',
                        '기타'
                    )
                ),

                CHECK (
                    status IN (
                        'planned',
                        'in_progress',
                        'completed',
                        'substituted'
                    )
                ),

                CHECK (credits >= 0),

                CHECK (is_retake IN (0, 1))
            );

            CREATE INDEX IF NOT EXISTS
                idx_sessions_user_id
            ON sessions(user_id);

            CREATE INDEX IF NOT EXISTS
                idx_sessions_expires_at
            ON sessions(expires_at);

            CREATE INDEX IF NOT EXISTS
                idx_user_course_records_user_id
            ON user_course_records(user_id);

            CREATE INDEX IF NOT EXISTS
                idx_user_course_records_user_semester
            ON user_course_records(
                user_id,
                academic_year,
                semester
            );

            CREATE INDEX IF NOT EXISTS
                idx_user_course_records_curriculum_course
            ON user_course_records(
                user_id,
                curriculum_course_id
            );
            """
        )

    ensure_user_profile_columns()


def normalize_username(
    username: str,
) -> str:
    """사용자 ID 비교를 위해 공백과 대소문자를 정리한다."""
    return username.strip().casefold()


def create_user(
    *,
    username: str,
    password_hash: str,
) -> dict[str, Any]:
    """새 사용자를 인증 DB에 저장한다."""
    user_id = str(uuid4())
    normalized_username = normalize_username(
        username
    )
    current_time = get_current_time()

    try:
        with connect_auth_database() as connection:
            connection.execute(
                """
                INSERT INTO users (
                    id,
                    username,
                    username_normalized,
                    password_hash,
                    profile_image_filename,
                    entry_year,
                    student_type,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    username.strip(),
                    normalized_username,
                    password_hash,
                    None,
                    None,
                    None,
                    current_time,
                    current_time,
                ),
            )
    except sqlite3.IntegrityError as error:
        raise ValueError(
            "이미 사용 중인 사용자 ID입니다."
        ) from error

    return {
        "id": user_id,
        "username": username.strip(),
        "profile_image_filename": None,
        "entry_year": None,
        "student_type" : None,
        "created_at": current_time,
        "updated_at": current_time,
    }


def get_user_by_username(
    username: str,
) -> dict[str, Any] | None:
    """사용자 ID로 회원 정보를 조회한다."""
    normalized_username = normalize_username(
        username
    )

    with connect_auth_database() as connection:
        row = connection.execute(
            """
            SELECT
                id,
                username,
                username_normalized,
                password_hash,
                profile_image_filename,
                entry_year,
                student_type,
                created_at,
                updated_at
            FROM users
            WHERE username_normalized = ?
            """,
            (normalized_username,),
        ).fetchone()

    if row is None:
        return None

    return dict(row)


def get_user_by_id(
    user_id: str,
) -> dict[str, Any] | None:
    """사용자 고유 ID로 회원 정보를 조회한다."""
    with connect_auth_database() as connection:
        row = connection.execute(
            """
            SELECT
                id,
                username,
                username_normalized,
                password_hash,
                profile_image_filename,
                entry_year,
                student_type,
                created_at,
                updated_at
            FROM users
            WHERE id = ?
            """,
            (user_id,),
        ).fetchone()

    if row is None:
        return None

    return dict(row)


def update_user_password(
    *,
    user_id: str,
    password_hash: str,
) -> bool:
    """사용자의 비밀번호 해시를 변경한다."""
    current_time = get_current_time()

    with connect_auth_database() as connection:
        cursor = connection.execute(
            """
            UPDATE users
            SET
                password_hash = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (
                password_hash,
                current_time,
                user_id,
            ),
        )

    return cursor.rowcount > 0


def update_profile_image_filename(
    *,
    user_id: str,
    profile_image_filename: str | None,
) -> bool:
    """사용자의 프로필 이미지 파일명을 변경한다."""
    current_time = get_current_time()

    with connect_auth_database() as connection:
        cursor = connection.execute(
            """
            UPDATE users
            SET
                profile_image_filename = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (
                profile_image_filename,
                current_time,
                user_id,
            ),
        )

    return cursor.rowcount > 0


def update_user_academic_profile(
    *,
    user_id: str,
    entry_year: int | None,
    student_type: str | None,
) -> bool:
    """사용자의 입학 학번과 학생 유형을 변경한다."""
    current_time = get_current_time()

    with connect_auth_database() as connection:
        cursor = connection.execute(
            """
            UPDATE users
            SET
                entry_year = ?,
                student_type = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (
                entry_year,
                student_type,
                current_time,
                user_id,
            ),
        )

    return cursor.rowcount > 0

def create_user_course_record(
    *,
    user_id: str,
    curriculum_course_id: int | None,
    lecture_id: int | None,
    academic_year: int | None,
    semester: int | None,
    course_name: str,
    course_code: str | None,
    completion_type: str,
    credits: float,
    status: str,
    letter_grade: str | None,
    is_retake: bool,
    note: str | None,
) -> dict[str, Any]:
    """사용자의 과목 이수 기록을 생성한다."""
    record_id = str(uuid4())
    current_time = get_current_time()

    with connect_auth_database() as connection:
        connection.execute(
            """
            INSERT INTO user_course_records (
                id,
                user_id,
                curriculum_course_id,
                lecture_id,
                academic_year,
                semester,
                course_name,
                course_code,
                completion_type,
                credits,
                status,
                letter_grade,
                is_retake,
                note,
                created_at,
                updated_at
            )
            VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?
            )
            """,
            (
                record_id,
                user_id,
                curriculum_course_id,
                lecture_id,
                academic_year,
                semester,
                course_name.strip(),
                (
                    course_code.strip()
                    if course_code is not None
                    else None
                ),
                completion_type,
                credits,
                status,
                letter_grade,
                int(is_retake),
                (
                    note.strip()
                    if note is not None
                    else None
                ),
                current_time,
                current_time,
            ),
        )

    return {
        "id": record_id,
        "user_id": user_id,
        "curriculum_course_id":
            curriculum_course_id,
        "lecture_id": lecture_id,
        "academic_year": academic_year,
        "semester": semester,
        "course_name": course_name.strip(),
        "course_code": (
            course_code.strip()
            if course_code is not None
            else None
        ),
        "completion_type": completion_type,
        "credits": credits,
        "status": status,
        "letter_grade": letter_grade,
        "is_retake": is_retake,
        "note": (
            note.strip()
            if note is not None
            else None
        ),
        "created_at": current_time,
        "updated_at": current_time,
    }


def get_user_course_records(
    *,
    user_id: str,
) -> list[dict[str, Any]]:
    """사용자에게 저장된 모든 과목 이수 기록을 조회한다."""
    with connect_auth_database() as connection:
        rows = connection.execute(
            """
            SELECT
                id,
                user_id,
                curriculum_course_id,
                lecture_id,
                academic_year,
                semester,
                course_name,
                course_code,
                completion_type,
                credits,
                status,
                letter_grade,
                is_retake,
                note,
                created_at,
                updated_at
            FROM user_course_records
            WHERE user_id = ?
            ORDER BY
                CASE
                    WHEN academic_year IS NULL
                    THEN 1
                    ELSE 0
                END,
                academic_year,
                semester,
                course_name
            """,
            (user_id,),
        ).fetchall()

    records: list[dict[str, Any]] = []

    for row in rows:
        record = dict(row)
        record["is_retake"] = bool(
            record["is_retake"]
        )
        records.append(record)

    return records


def update_user_course_record(
    *,
    record_id: str,
    user_id: str,
    curriculum_course_id: int | None,
    lecture_id: int | None,
    academic_year: int | None,
    semester: int | None,
    course_name: str,
    course_code: str | None,
    completion_type: str,
    credits: float,
    status: str,
    letter_grade: str | None,
    is_retake: bool,
    note: str | None,
) -> dict[str, Any] | None:
    """사용자 소유의 과목 이수 기록을 변경한다."""
    current_time = get_current_time()

    with connect_auth_database() as connection:
        cursor = connection.execute(
            """
            UPDATE user_course_records
            SET
                curriculum_course_id = ?,
                lecture_id = ?,
                academic_year = ?,
                semester = ?,
                course_name = ?,
                course_code = ?,
                completion_type = ?,
                credits = ?,
                status = ?,
                letter_grade = ?,
                is_retake = ?,
                note = ?,
                updated_at = ?
            WHERE id = ?
              AND user_id = ?
            """,
            (
                curriculum_course_id,
                lecture_id,
                academic_year,
                semester,
                course_name.strip(),
                (
                    course_code.strip()
                    if course_code is not None
                    else None
                ),
                completion_type,
                credits,
                status,
                letter_grade,
                int(is_retake),
                (
                    note.strip()
                    if note is not None
                    else None
                ),
                current_time,
                record_id,
                user_id,
            ),
        )

        if cursor.rowcount == 0:
            return None

        row = connection.execute(
            """
            SELECT
                id,
                user_id,
                curriculum_course_id,
                lecture_id,
                academic_year,
                semester,
                course_name,
                course_code,
                completion_type,
                credits,
                status,
                letter_grade,
                is_retake,
                note,
                created_at,
                updated_at
            FROM user_course_records
            WHERE id = ?
              AND user_id = ?
            """,
            (
                record_id,
                user_id,
            ),
        ).fetchone()

    if row is None:
        return None

    record = dict(row)
    record["is_retake"] = bool(
        record["is_retake"]
    )

    return record


def delete_user_course_record(
    *,
    record_id: str,
    user_id: str,
) -> bool:
    """사용자 소유의 과목 이수 기록을 삭제한다."""
    with connect_auth_database() as connection:
        cursor = connection.execute(
            """
            DELETE FROM user_course_records
            WHERE id = ?
              AND user_id = ?
            """,
            (
                record_id,
                user_id,
            ),
        )

    return cursor.rowcount > 0
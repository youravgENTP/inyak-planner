from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from server.database import connect_database


def get_current_time() -> str:
    """현재 UTC 시각을 ISO 문자열로 반환한다."""
    return datetime.now(timezone.utc).isoformat()


def ensure_profile_image_column() -> None:
    """
    기존 users 테이블에 프로필 이미지 컬럼이 없으면 추가한다.

    SQLite의 CREATE TABLE IF NOT EXISTS는 기존 테이블의
    컬럼을 자동으로 변경하지 않으므로 별도 마이그레이션이 필요하다.
    """
    with connect_database() as connection:
        columns = connection.execute(
            """
            PRAGMA table_info(users)
            """
        ).fetchall()

        column_names = {
            column["name"]
            for column in columns
        }

        if (
            "profile_image_filename"
            not in column_names
        ):
            connection.execute(
                """
                ALTER TABLE users
                ADD COLUMN
                    profile_image_filename TEXT
                """
            )


def create_auth_tables() -> None:
    """회원과 로그인 세션에 필요한 테이블을 생성한다."""
    with connect_database() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                username_normalized TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                profile_image_filename TEXT,
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

            CREATE INDEX IF NOT EXISTS
                idx_sessions_user_id
            ON sessions(user_id);

            CREATE INDEX IF NOT EXISTS
                idx_sessions_expires_at
            ON sessions(expires_at);
            """
        )

    ensure_profile_image_column()


def normalize_username(username: str) -> str:
    """사용자 ID 비교를 위해 공백과 대소문자를 정리한다."""
    return username.strip().casefold()


def create_user(
    *,
    username: str,
    password_hash: str,
) -> dict[str, Any]:
    """새 사용자를 DB에 저장한다."""
    user_id = str(uuid4())
    normalized_username = normalize_username(
        username
    )
    current_time = get_current_time()

    try:
        with connect_database() as connection:
            connection.execute(
                """
                INSERT INTO users (
                    id,
                    username,
                    username_normalized,
                    password_hash,
                    profile_image_filename,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    username.strip(),
                    normalized_username,
                    password_hash,
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

    with connect_database() as connection:
        row = connection.execute(
            """
            SELECT
                id,
                username,
                username_normalized,
                password_hash,
                profile_image_filename,
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
    with connect_database() as connection:
        row = connection.execute(
            """
            SELECT
                id,
                username,
                username_normalized,
                password_hash,
                profile_image_filename,
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

    with connect_database() as connection:
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

    with connect_database() as connection:
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
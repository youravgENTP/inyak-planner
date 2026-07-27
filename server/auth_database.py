from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from server.database import connect_database


def get_current_time() -> str:
    """현재 UTC 시각을 ISO 문자열로 반환한다."""
    return datetime.now(timezone.utc).isoformat()


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
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    username.strip(),
                    normalized_username,
                    password_hash,
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
        "created_at": current_time,
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
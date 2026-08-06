from __future__ import annotations

import hashlib
import secrets
from datetime import (
    datetime,
    timedelta,
    timezone,
)
from typing import Any
from uuid import uuid4

from server.auth_database import (
    connect_auth_database,
)


SESSION_DURATION_DAYS = 7


def get_current_time() -> datetime:
    """현재 UTC 시각을 반환한다."""
    return datetime.now(timezone.utc)


def hash_session_token(
    session_token: str,
) -> str:
    """세션 토큰을 SHA-256 해시로 변환한다."""
    return hashlib.sha256(
        session_token.encode("utf-8")
    ).hexdigest()


def create_session(
    user_id: str,
) -> str:
    """
    새 로그인 세션을 생성한다.

    반환되는 원본 토큰은 브라우저 쿠키에 저장하고,
    DB에는 토큰의 해시만 저장한다.
    """
    session_id = str(uuid4())
    session_token = secrets.token_urlsafe(32)
    token_hash = hash_session_token(
        session_token
    )

    created_at = get_current_time()
    expires_at = (
        created_at
        + timedelta(
            days=SESSION_DURATION_DAYS
        )
    )

    with connect_auth_database() as connection:
        connection.execute(
            """
            INSERT INTO sessions (
                id,
                user_id,
                token_hash,
                created_at,
                expires_at
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                session_id,
                user_id,
                token_hash,
                created_at.isoformat(),
                expires_at.isoformat(),
            ),
        )

    return session_token


def get_user_by_session_token(
    session_token: str,
) -> dict[str, Any] | None:
    """유효한 세션 토큰으로 로그인 사용자를 조회한다."""
    token_hash = hash_session_token(
        session_token
    )
    current_time = get_current_time().isoformat()

    with connect_auth_database() as connection:
        row = connection.execute(
            """
            SELECT
                users.id,
                users.username,
                users.password_hash,
                users.profile_image_filename,
                users.entry_year,
                users.student_type,
                users.created_at,
                users.updated_at
            FROM sessions
            JOIN users
                ON users.id = sessions.user_id
            WHERE sessions.token_hash = ?
              AND sessions.expires_at > ?
            """,
            (
                token_hash,
                current_time,
            ),
        ).fetchone()

    if row is None:
        return None

    return dict(row)


def delete_session(
    session_token: str,
) -> None:
    """세션 토큰에 해당하는 로그인 세션을 삭제한다."""
    token_hash = hash_session_token(
        session_token
    )

    with connect_auth_database() as connection:
        connection.execute(
            """
            DELETE FROM sessions
            WHERE token_hash = ?
            """,
            (token_hash,),
        )
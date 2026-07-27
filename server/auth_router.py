from __future__ import annotations

from typing import Any, Optional

from fastapi import (
    APIRouter,
    Cookie,
    HTTPException,
    Response,
    status,
)
from pydantic import BaseModel, Field

from server.auth_database import (
    create_auth_tables,
    create_user,
    get_user_by_username,
)
from server.security import (
    hash_password,
    verify_password,
)
from server.session_service import (
    create_session,
    delete_session,
    get_user_by_session_token,
)


SESSION_COOKIE_NAME = "inyak_session"

router = APIRouter(
    prefix="/api/auth",
    tags=["auth"],
)


class RegisterRequest(BaseModel):
    username: str = Field(
        min_length=3,
        max_length=30,
    )
    password: str = Field(
        min_length=8,
        max_length=128,
    )


class LoginRequest(BaseModel):
    username: str = Field(
        min_length=1,
        max_length=30,
    )
    password: str = Field(
        min_length=1,
        max_length=128,
    )


def set_session_cookie(
    response: Response,
    session_token: str,
) -> None:
    """
    로그인 세션 토큰을 브라우저 쿠키에 저장한다.

    현재는 localhost의 HTTP 개발 환경이므로
    secure=False를 사용한다.
    """
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        max_age=60 * 60 * 24 * 7,
        httponly=True,
        secure=False,
        samesite="lax",
        path="/",
    )


def get_public_user(
    user: dict[str, Any],
) -> dict[str, Any]:
    """비밀번호 해시를 제외한 사용자 정보만 반환한다."""
    return {
        "id": user["id"],
        "username": user["username"],
        "created_at": user["created_at"],
    }


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
)
def register(
    request: RegisterRequest,
    response: Response,
) -> dict[str, Any]:
    """새 계정을 만들고 바로 로그인한다."""
    username = request.username.strip()

    if not username:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="사용자 ID를 입력해 주세요.",
        )

    create_auth_tables()

    try:
        user = create_user(
            username=username,
            password_hash=hash_password(
                request.password
            ),
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 사용 중인 사용자 ID입니다.",
        ) from error

    session_token = create_session(
        user["id"]
    )

    set_session_cookie(
        response,
        session_token,
    )

    return {
        "user": get_public_user(user),
    }


@router.post("/login")
def login(
    request: LoginRequest,
    response: Response,
) -> dict[str, Any]:
    """사용자 ID와 비밀번호를 확인하고 로그인한다."""
    create_auth_tables()

    user = get_user_by_username(
        request.username
    )

    login_failed = (
        user is None
        or not verify_password(
            request.password,
            user["password_hash"],
        )
    )

    if login_failed:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "사용자 ID 또는 비밀번호가 "
                "올바르지 않습니다."
            ),
        )

    session_token = create_session(
        user["id"]
    )

    set_session_cookie(
        response,
        session_token,
    )

    return {
        "user": get_public_user(user),
    }


@router.get("/me")
def read_current_user(
    session_token: Optional[str] = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
) -> dict[str, Any]:
    """현재 브라우저에 로그인된 사용자를 반환한다."""
    if session_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="로그인이 필요합니다.",
        )

    user = get_user_by_session_token(
        session_token
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="로그인 세션이 유효하지 않습니다.",
        )

    return {
        "user": get_public_user(user),
    }


@router.post("/logout")
def logout(
    response: Response,
    session_token: Optional[str] = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
) -> dict[str, str]:
    """현재 로그인 세션을 삭제한다."""
    if session_token is not None:
        delete_session(session_token)

    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=False,
        samesite="lax",
    )

    return {
        "message": "로그아웃되었습니다.",
    }
from __future__ import annotations

import os
from uuid import uuid4

from typing import (
    Any, 
    Literal, 
    Optional,
)

from fastapi import (
    APIRouter,
    Cookie,
    File,
    HTTPException,
    Response,
    UploadFile,
    status,
)

from pydantic import BaseModel, Field

from server.auth_database import (
    create_auth_tables,
    create_user,
    get_user_by_id,
    get_user_by_username,
    update_profile_image_filename,
    update_user_academic_profile,
    update_user_password,
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

from server.storage_service import (
    delete_profile_image as delete_profile_image_from_storage,
    upload_profile_image as upload_profile_image_to_storage,
)


SESSION_COOKIE_NAME = "inyak_session"

MAX_PROFILE_IMAGE_BYTES = (
    5 * 1024 * 1024
)


def get_profile_image_extension(
    image_bytes: bytes,
) -> str | None:
    """파일 내용으로 허용 이미지 형식을 판별한다."""
    if image_bytes.startswith(
        b"\x89PNG\r\n\x1a\n"
    ):
        return "png"

    if image_bytes.startswith(
        b"\xff\xd8\xff"
    ):
        return "jpg"

    if (
        len(image_bytes) >= 12
        and image_bytes[0:4] == b"RIFF"
        and image_bytes[8:12] == b"WEBP"
    ):
        return "webp"

    return None



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


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(
        min_length=1,
        max_length=128,
    )
    new_password: str = Field(
        min_length=8,
        max_length=128,
    )

class AcademicProfileRequest(BaseModel):
    entry_year: int = Field(
        ge=2000,
        le=2100,
    )
    student_type: Literal[
        "regular",
        "transfer",
    ]

def set_session_cookie(
    response: Response,
    session_token: str,
) -> None:
    """
    로그인 세션 토큰을 브라우저 쿠키에 저장한다.

    현재는 localhost의 HTTP 개발 환경이므로
    secure=False를 사용한다.
    """
    is_production = (
        os.environ.get(
            "APP_ENV",
            "development",
        ).lower()
        == "production"
    )

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        max_age=60 * 60 * 24 * 7,
        httponly=True,
        secure=is_production,
        samesite=(
            "none"
            if is_production
            else "lax"
        ),
        path="/",
    )


def get_public_user(
    user: dict[str, Any],
) -> dict[str, Any]:
    """비밀번호 해시를 제외한 사용자 정보만 반환한다."""
    return {
        "id": user["id"],
        "username": user["username"],
        "profile_image_filename": (
            user.get(
                "profile_image_filename"
            )
        ),
        "entry_year": user.get(
            "entry_year"
        ),
        "student_type": user.get(
            "student_type"
        ),
        "created_at": user["created_at"],
    }


def require_authenticated_user(
    session_token: Optional[str],
) -> dict[str, Any]:
    """세션 쿠키를 확인하고 로그인된 사용자를 반환한다."""
    create_auth_tables()
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

    return user


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
            status_code=(
                status.HTTP_422_UNPROCESSABLE_ENTITY
            ),
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
    user = require_authenticated_user(
        session_token
    )

    return {
        "user": get_public_user(user),
    }

@router.post("/profile-image")
async def upload_profile_image(
    image: UploadFile = File(...),
    session_token: Optional[str] = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
) -> dict[str, Any]:
    """현재 사용자의 프로필 이미지를 업로드한다."""
    user = require_authenticated_user(
        session_token
    )

    image_bytes = await image.read(
        MAX_PROFILE_IMAGE_BYTES + 1
    )

    if len(image_bytes) == 0:
        raise HTTPException(
            status_code=(
                status.HTTP_422_UNPROCESSABLE_ENTITY
            ),
            detail="이미지 파일이 비어 있습니다.",
        )

    if (
        len(image_bytes) >
        MAX_PROFILE_IMAGE_BYTES
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
            ),
            detail=(
                "프로필 이미지는 "
                "5MB 이하만 업로드할 수 있습니다."
            ),
        )

    extension = get_profile_image_extension(
        image_bytes
    )

    if extension is None:
        raise HTTPException(
            status_code=(
                status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
            ),
            detail=(
                "JPEG, PNG, WebP 이미지만 "
                "업로드할 수 있습니다."
            ),
        )

    new_filename = (
        f"{uuid4().hex}.{extension}"
    )

    content_types = {
        "jpg": "image/jpeg",
        "png": "image/png",
        "webp": "image/webp",
    }

    content_type = content_types[
        extension
    ]

    try:
        upload_profile_image_to_storage(
            filename=new_filename,
            image_bytes=image_bytes,
            content_type=content_type,
        )
    except Exception as error:
        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "프로필 이미지를 저장하지 "
                "못했습니다."
            ),
        ) from error

    old_filename = user.get(
        "profile_image_filename"
    )

    image_was_updated = (
        update_profile_image_filename(
            user_id=user["id"],
            profile_image_filename=(
                new_filename
            ),
        )
    )

    if not image_was_updated:
        try:
            delete_profile_image_from_storage(
                new_filename
            )
        except Exception:
            pass

        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "프로필 이미지 정보를 "
                "저장하지 못했습니다."
            ),
        )

    if old_filename is not None:
        try:
            delete_profile_image_from_storage(
                old_filename
            )
        except Exception:
            pass

    updated_user = get_user_by_id(
        user["id"]
    )

    if updated_user is None:
        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "변경된 사용자 정보를 "
                "불러오지 못했습니다."
            ),
        )

    return {
        "user": get_public_user(
            updated_user
        ),
    }

@router.patch("/profile")
def update_academic_profile(
    request: AcademicProfileRequest,
    session_token: Optional[str] = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
) -> dict[str, Any]:
    """현재 사용자의 입학 학번과 학생 유형을 변경한다."""
    user = require_authenticated_user(
        session_token
    )

    profile_was_updated = (
        update_user_academic_profile(
            user_id=user["id"],
            entry_year=request.entry_year,
            student_type=request.student_type,
        )
    )

    if not profile_was_updated:
        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail="학업정보를 변경하지 못했습니다.",
        )

    updated_user = get_user_by_id(
        user["id"]
    )

    if updated_user is None:
        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "변경된 사용자 정보를 "
                "불러오지 못했습니다."
            ),
        )

    return {
        "user": get_public_user(
            updated_user
        ),
    }

@router.post("/password")
def change_password(
    request: ChangePasswordRequest,
    session_token: Optional[str] = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
) -> dict[str, str]:
    """현재 비밀번호를 확인하고 새 비밀번호로 변경한다."""
    user = require_authenticated_user(
        session_token
    )

    current_password_is_valid = (
        verify_password(
            request.current_password,
            user["password_hash"],
        )
    )

    if not current_password_is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="현재 비밀번호가 올바르지 않습니다.",
        )

    if request.new_password == "":
        raise HTTPException(
            status_code=(
                status.HTTP_422_UNPROCESSABLE_ENTITY
            ),
            detail="새 비밀번호를 입력해 주세요.",
        )

    password_was_updated = (
        update_user_password(
            user_id=user["id"],
            password_hash=hash_password(
                request.new_password
            ),
        )
    )

    if not password_was_updated:
        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail="비밀번호를 변경하지 못했습니다.",
        )

    return {
        "message": "비밀번호가 변경되었습니다.",
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
    create_auth_tables()

    if session_token is not None:
        delete_session(session_token)
            
    is_production = (
        os.environ.get(
            "APP_ENV",
            "development",
        ).lower()
        == "production"
    )

    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
        secure=is_production,
        samesite=(
            "none"
            if is_production
            else "lax"
        ),
    )

    return {
        "message": "로그아웃되었습니다.",
    }
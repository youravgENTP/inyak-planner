from __future__ import annotations

from typing import (
    Any,
    Optional,
)

from fastapi import (
    APIRouter,
    Cookie,
    HTTPException,
    status,
)
from pydantic import BaseModel, Field

from server.auth_database import (
    create_user_saved_timetable,
    delete_user_saved_timetable,
    get_user_saved_timetables,
    update_user_saved_timetable,
)
from server.auth_router import (
    SESSION_COOKIE_NAME,
    require_authenticated_user,
)


router = APIRouter(
    prefix="/api/timetables",
    tags=["timetables"],
)


class TimetableRequest(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=100,
    )
    academic_year: int = Field(
        ge=2000,
        le=2100,
    )
    semester: int = Field(
        ge=1,
        le=2,
    )
    lecture_ids: list[int] = Field(
        default_factory=list,
    )


def normalize_request(
    request: TimetableRequest,
) -> dict[str, Any]:
    """시간표 요청값을 DB 저장 형식으로 정리한다."""
    return {
        "name": request.name.strip(),
        "academic_year":
            request.academic_year,
        "semester":
            request.semester,
        "lecture_ids": list(
            dict.fromkeys(
                request.lecture_ids
            )
        ),
    }


@router.get("")
def read_timetables(
    session_token: Optional[str] = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
) -> dict[str, Any]:
    """현재 사용자의 저장 시간표 목록을 반환한다."""
    user = require_authenticated_user(
        session_token
    )

    timetables = get_user_saved_timetables(
        user_id=user["id"],
    )

    return {
        "count": len(timetables),
        "timetables": timetables,
    }


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
)
def create_timetable(
    request: TimetableRequest,
    session_token: Optional[str] = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
) -> dict[str, Any]:
    """현재 사용자에게 새 시간표를 생성한다."""
    user = require_authenticated_user(
        session_token
    )

    timetable = create_user_saved_timetable(
        user_id=user["id"],
        **normalize_request(request),
    )

    return {
        "timetable": timetable,
    }


@router.put("/{timetable_id}")
def update_timetable(
    timetable_id: str,
    request: TimetableRequest,
    session_token: Optional[str] = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
) -> dict[str, Any]:
    """현재 사용자 소유의 시간표를 변경한다."""
    user = require_authenticated_user(
        session_token
    )

    timetable = update_user_saved_timetable(
        timetable_id=timetable_id,
        user_id=user["id"],
        **normalize_request(request),
    )

    if timetable is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="변경할 시간표를 찾을 수 없습니다.",
        )

    return {
        "timetable": timetable,
    }


@router.delete("/{timetable_id}")
def delete_timetable(
    timetable_id: str,
    session_token: Optional[str] = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
) -> dict[str, str]:
    """현재 사용자 소유의 시간표를 삭제한다."""
    user = require_authenticated_user(
        session_token
    )

    deleted = delete_user_saved_timetable(
        timetable_id=timetable_id,
        user_id=user["id"],
    )

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="삭제할 시간표를 찾을 수 없습니다.",
        )

    return {
        "message": "시간표가 삭제되었습니다.",
    }
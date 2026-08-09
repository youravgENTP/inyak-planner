from __future__ import annotations

from typing import (
    Any,
    Literal,
    Optional,
)

from fastapi import (
    APIRouter,
    Cookie,
    HTTPException,
    status,
)

from pydantic import (
    BaseModel,
    Field,
)

from server.auth_database import (
    create_user_special_semester,
    delete_user_special_semester,
    get_user_special_semesters,
)

from server.auth_router import (
    SESSION_COOKIE_NAME,
    require_authenticated_user,
)


router = APIRouter(
    prefix="/api/special-semesters",
    tags=["special-semesters"],
)


SpecialSemesterTerm = Literal[
    "summer",
    "winter",
]


class SpecialSemesterRequest(BaseModel):
    grade: int = Field(
        ge=1,
        le=6,
    )

    term: SpecialSemesterTerm


def get_semester_for_term(
    term: SpecialSemesterTerm,
) -> int:
    """
    특별학기의 기준 semester를 반환한다.

    summer는 1학기 뒤,
    winter는 2학기 뒤에 위치한다.
    """
    return (
        1
        if term == "summer"
        else 2
    )


@router.get("")
def read_special_semesters(
    session_token: Optional[str] = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
) -> dict[str, Any]:
    """현재 사용자의 특별학기 목록을 반환한다."""
    user = require_authenticated_user(
        session_token
    )

    semesters = get_user_special_semesters(
        user_id=user["id"],
    )

    return {
        "count": len(semesters),
        "semesters": semesters,
    }


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
)
def create_special_semester(
    request: SpecialSemesterRequest,
    session_token: Optional[str] = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
) -> dict[str, Any]:
    """현재 사용자에게 특별학기를 추가한다."""
    user = require_authenticated_user(
        session_token
    )

    semester = get_semester_for_term(
        request.term
    )

    try:
        special_semester = (
            create_user_special_semester(
                user_id=user["id"],
                grade=request.grade,
                semester=semester,
                term=request.term,
            )
        )
    except ValueError as error:
        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=str(error),
        ) from error

    return {
        "semester": special_semester,
    }


@router.delete(
    "/{special_semester_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_special_semester(
    special_semester_id: str,
    session_token: Optional[str] = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
) -> None:
    """
    특별학기와 해당 학기의 모든 과목 기록을 삭제한다.
    """
    user = require_authenticated_user(
        session_token
    )

    deleted = delete_user_special_semester(
        special_semester_id=(
            special_semester_id
        ),
        user_id=user["id"],
    )

    if not deleted:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail=(
                "삭제할 특별학기를 "
                "찾을 수 없습니다."
            ),
        )
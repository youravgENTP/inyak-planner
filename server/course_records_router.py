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
from pydantic import BaseModel, Field

from server.auth_database import (
    create_user_course_record,
    delete_user_course_record,
    get_user_course_records,
    update_user_course_record,
)
from server.auth_router import (
    SESSION_COOKIE_NAME,
    require_authenticated_user,
)


router = APIRouter(
    prefix="/api/course-records",
    tags=["course-records"],
)


CompletionType = Literal[
    "전필",
    "전선",
    "교양",
    "기타",
]

CourseRecordStatus = Literal[
    "planned",
    "in_progress",
    "completed",
    "substituted",
]


class CourseRecordRequest(BaseModel):
    curriculum_course_id: Optional[int] = Field(
        default=None,
        ge=1,
    )
    lecture_id: Optional[int] = Field(
        default=None,
        ge=1,
    )
    academic_year: Optional[int] = Field(
        default=None,
        ge=2000,
        le=2100,
    )
    semester: Optional[int] = Field(
        default=None,
        ge=1,
        le=2,
    )
    course_name: str = Field(
        min_length=1,
        max_length=100,
    )
    course_code: Optional[str] = Field(
        default=None,
        max_length=30,
    )
    completion_type: CompletionType
    credits: float = Field(
        ge=0,
        le=30,
    )
    status: CourseRecordStatus
    letter_grade: Optional[str] = Field(
        default=None,
        max_length=10,
    )
    is_retake: bool = False
    note: Optional[str] = Field(
        default=None,
        max_length=500,
    )

def normalize_optional_text(
    value: str | None,
) -> str | None:
    """선택 입력 문자열의 양끝 공백과 빈 문자열을 정리한다."""
    if value is None:
        return None

    normalized_value = value.strip()

    if normalized_value == "":
        return None

    return normalized_value


def get_request_values(
    request: CourseRecordRequest,
) -> dict[str, Any]:
    """요청 데이터를 DB 함수에 전달할 형태로 정리한다."""
    return {
        "curriculum_course_id":
            request.curriculum_course_id,
        "lecture_id": request.lecture_id,
        "academic_year": request.academic_year,
        "semester": request.semester,
        "course_name": request.course_name.strip(),
        "course_code": normalize_optional_text(
            request.course_code
        ),
        "completion_type":
            request.completion_type,
        "credits": request.credits,
        "status": request.status,
        "letter_grade": normalize_optional_text(
            request.letter_grade
        ),
        "is_retake": request.is_retake,
        "note": normalize_optional_text(
            request.note
        ),
    }


@router.get("")
def read_course_records(
    session_token: Optional[str] = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
) -> dict[str, Any]:
    """현재 사용자의 모든 과목 이수 기록을 반환한다."""
    user = require_authenticated_user(
        session_token
    )

    records = get_user_course_records(
        user_id=user["id"],
    )

    return {
        "count": len(records),
        "records": records,
    }


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
)
def create_course_record(
    request: CourseRecordRequest,
    session_token: Optional[str] = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
) -> dict[str, Any]:
    """현재 사용자에게 새 과목 이수 기록을 생성한다."""
    user = require_authenticated_user(
        session_token
    )

    record = create_user_course_record(
        user_id=user["id"],
        **get_request_values(request),
    )

    return {
        "record": record,
    }


@router.put("/{record_id}")
def update_course_record(
    record_id: str,
    request: CourseRecordRequest,
    session_token: Optional[str] = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
) -> dict[str, Any]:
    """현재 사용자 소유의 과목 이수 기록을 변경한다."""
    user = require_authenticated_user(
        session_token
    )

    record = update_user_course_record(
        record_id=record_id,
        user_id=user["id"],
        **get_request_values(request),
    )

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "변경할 과목 이수 기록을 "
                "찾을 수 없습니다."
            ),
        )

    return {
        "record": record,
    }


@router.delete("/{record_id}")
def delete_course_record(
    record_id: str,
    session_token: Optional[str] = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
) -> dict[str, str]:
    """현재 사용자 소유의 과목 이수 기록을 삭제한다."""
    user = require_authenticated_user(
        session_token
    )

    record_was_deleted = (
        delete_user_course_record(
            record_id=record_id,
            user_id=user["id"],
        )
    )

    if not record_was_deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "삭제할 과목 이수 기록을 "
                "찾을 수 없습니다."
            ),
        )

    return {
        "message": "과목 이수 기록이 삭제되었습니다.",
    }
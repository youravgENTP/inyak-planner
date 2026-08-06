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

from server.database import (
    get_curriculum_course_by_id,
    get_general_education_link,
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
    general_education_requirement_id: Optional[int] = (
        Field(
            default=None,
            ge=1,
        )
    )
    general_education_area_id: Optional[int] = Field(
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
    value: Optional[str],
) -> Optional[str]:
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
        "lecture_id":
            request.lecture_id,
        "general_education_requirement_id":
            request.general_education_requirement_id,
        "general_education_area_id":
            request.general_education_area_id,
        "academic_year":
            request.academic_year,
        "semester":
            request.semester,
        "course_name":
            request.course_name.strip(),
        "course_code":
            normalize_optional_text(
                request.course_code
            ),
        "completion_type":
            request.completion_type,
        "credits":
            request.credits,
        "status":
            request.status,
        "letter_grade":
            normalize_optional_text(
                request.letter_grade
            ),
        "is_retake":
            request.is_retake,
        "note":
            normalize_optional_text(
                request.note
            ),
    }

def validate_course_record_request(
    *,
    request: CourseRecordRequest,
    user: dict[str, Any],
) -> None:
    """과목 종류와 공식 교육과정 연결값의 일관성을 확인한다."""
    entry_year = user.get("entry_year")
    student_type = user.get("student_type")

    if entry_year is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "과목 기록을 저장하려면 "
                "회원정보에서 입학 학번을 "
                "먼저 설정해야 합니다."
            ),
        )

    if (
        request.status == "substituted"
        and student_type != "transfer"
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "대체 인정 기록은 편입생만 "
                "등록할 수 있습니다."
            ),
        )

    if request.completion_type in (
        "전필",
        "전선",
    ):
        if (
            request.general_education_requirement_id
            is not None
            or request.general_education_area_id
            is not None
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "전공 과목에는 교양요건 또는 "
                    "교양영역을 연결할 수 없습니다."
                ),
            )

        if (
            request.status == "substituted"
            and request.curriculum_course_id
            is None
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "전공 대체 인정 과목은 "
                    "대응하는 공식 교육과정 과목을 "
                    "선택해야 합니다."
                ),
            )

        if request.curriculum_course_id is None:
            return

        curriculum_course = (
            get_curriculum_course_by_id(
                request.curriculum_course_id
            )
        )

        if curriculum_course is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "선택한 공식 교육과정 과목을 "
                    "찾을 수 없습니다."
                ),
            )

        if (
            curriculum_course["entry_year"]
            != entry_year
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "선택한 과목은 현재 사용자의 "
                    "학번 교육과정에 속하지 않습니다."
                ),
            )

        if (
            curriculum_course["completion_type"]
            != request.completion_type
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "선택한 공식 과목의 이수구분과 "
                    "저장하려는 이수구분이 다릅니다."
                ),
            )

        return

    if request.completion_type == "교양":
        if request.curriculum_course_id is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "교양 과목에는 전공 교육과정 "
                    "과목을 연결할 수 없습니다."
                ),
            )

        if (
            request.general_education_requirement_id
            is None
            or request.general_education_area_id
            is None
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "교양 과목은 교양요건과 "
                    "세부 영역을 모두 선택해야 합니다."
                ),
            )

        general_education_link = (
            get_general_education_link(
                requirement_id=(
                    request
                    .general_education_requirement_id
                ),
                area_id=(
                    request
                    .general_education_area_id
                ),
            )
        )

        if general_education_link is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "선택한 교양영역이 해당 "
                    "교양요건에 속하지 않습니다."
                ),
            )

        if (
            general_education_link["entry_year"]
            != entry_year
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "선택한 교양요건은 현재 사용자의 "
                    "학번 기준과 다릅니다."
                ),
            )

        return

    if (
        request.curriculum_course_id is not None
        or request
        .general_education_requirement_id
        is not None
        or request.general_education_area_id
        is not None
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "기타 과목에는 전공 또는 교양 "
                "공식 요건을 연결할 수 없습니다."
            ),
        )

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

    validate_course_record_request(
        request=request,
        user=user,
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

    validate_course_record_request(
        request=request,
        user=user,
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
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

from server.grade_crypto import (
    decrypt_letter_grade,
    encrypt_letter_grade,
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


AcademicTerm = Literal[
    "spring",
    "summer",
    "fall",
    "winter",
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
    grade: Optional[int] = Field(
    default=None,
    ge=1,
    le=6,
    )
    semester: Optional[int] = Field(
        default=None,
        ge=1,
        le=2,
    )
    term: Optional[AcademicTerm] = None
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

    # 브라우저에서 입력한 성적.
    # DB 저장 직전에 서버에서 암호화한다.
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
    """
    요청 데이터를 DB 함수에 전달할 형태로 정리한다.

    성적이 전달된 경우에는 서버에서
    AES-GCM으로 암호화하고,
    DB에는 평문 성적을 저장하지 않는다.
    """
    term = request.term

    if term is None:
        if request.semester == 1:
            term = "spring"
        elif request.semester == 2:
            term = "fall"

    letter_grade = normalize_optional_text(
        request.letter_grade
    )

    letter_grade_ciphertext = None
    letter_grade_iv = None
    letter_grade_crypto_version = None

    if letter_grade is not None:
        encrypted_grade = (
            encrypt_letter_grade(
                letter_grade
            )
        )

        letter_grade_ciphertext = str(
            encrypted_grade[
                "ciphertext"
            ]
        )

        letter_grade_iv = str(
            encrypted_grade["iv"]
        )

        letter_grade_crypto_version = int(
            encrypted_grade[
                "crypto_version"
            ]
        )

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
        "grade":
            request.grade,
        "semester":
            request.semester,
        "term":
            term,
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
        "letter_grade_ciphertext":
            letter_grade_ciphertext,
        "letter_grade_iv":
            letter_grade_iv,
        "letter_grade_crypto_version":
            letter_grade_crypto_version,
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
    """
    개인 수강기록과 공식 졸업요건 연결값의
    일관성을 확인한다.

    일반 수강기록은 공식 교육과정 또는
    교양요건과 직접 연결하지 않는다. 
    "사용자의 수강기록-공식 교육과정 연결"은
    개인이수현황확인 페이지에서 하는 것이지,
    수강 기록을 입력하는 기능에서는 
    어떤 학년도의 어떤 학기에 무슨 과목을 들었는지를
    정확하게 기록하는 것에 중점을 둔다.

    공식 요건 ID는 대체 인정 등 명시적인
    연결이 필요한 경우에만 사용한다.
    """

    entry_year = user.get("entry_year")
    student_type = user.get(
        "student_type"
    )

    if (
        request.status == "substituted"
        and student_type != "transfer"
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
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
            request
            .general_education_requirement_id
            is not None
            or request
            .general_education_area_id
            is not None
        ):
            raise HTTPException(
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                ),
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
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                ),
                detail=(
                    "전공 대체 인정 과목은 "
                    "대응하는 공식 교육과정 과목을 "
                    "선택해야 합니다."
                ),
            )

        if (
            request.curriculum_course_id
            is None
        ):
            return

        if entry_year is None:
            raise HTTPException(
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                ),
                detail=(
                    "공식 교육과정 과목을 "
                    "연결하려면 입학 학번이 "
                    "설정되어 있어야 합니다."
                ),
            )

        curriculum_course = (
            get_curriculum_course_by_id(
                request.curriculum_course_id
            )
        )

        if curriculum_course is None:
            raise HTTPException(
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                ),
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
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                ),
                detail=(
                    "선택한 과목은 현재 사용자의 "
                    "학번 교육과정에 속하지 않습니다."
                ),
            )

        if (
            curriculum_course[
                "completion_type"
            ]
            != request.completion_type
        ):
            raise HTTPException(
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                ),
                detail=(
                    "선택한 공식 과목의 "
                    "이수구분과 저장하려는 "
                    "이수구분이 다릅니다."
                ),
            )

        return

    if (
        request.completion_type
        == "교양"
    ):
        if (
            request.curriculum_course_id
            is not None
        ):
            raise HTTPException(
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                ),
                detail=(
                    "교양 과목에는 전공 교육과정 "
                    "과목을 연결할 수 없습니다."
                ),
            )

        requirement_id = (
            request
            .general_education_requirement_id
        )

        area_id = (
            request
            .general_education_area_id
        )

        if (
            requirement_id is None
            and area_id is None
        ):
            return

        if (
            requirement_id is None
            or area_id is None
        ):
            raise HTTPException(
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                ),
                detail=(
                    "교양요건을 직접 연결하는 경우 "
                    "교양요건과 세부 영역을 "
                    "모두 지정해야 합니다."
                ),
            )

        if entry_year is None:
            raise HTTPException(
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                ),
                detail=(
                    "교양 졸업요건을 직접 "
                    "연결하려면 입학 학번이 "
                    "설정되어 있어야 합니다."
                ),
            )

        general_education_link = (
            get_general_education_link(
                requirement_id=(
                    requirement_id
                ),
                area_id=area_id,
            )
        )

        if (
            general_education_link
            is None
        ):
            raise HTTPException(
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                ),
                detail=(
                    "선택한 교양영역이 해당 "
                    "교양요건에 속하지 않습니다."
                ),
            )

        if (
            general_education_link[
                "entry_year"
            ]
            != entry_year
        ):
            raise HTTPException(
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                ),
                detail=(
                    "선택한 교양요건은 "
                    "현재 사용자의 학번 기준과 "
                    "다릅니다."
                ),
            )

        return

    if (
        request.curriculum_course_id
        is not None
        or request
        .general_education_requirement_id
        is not None
        or request
        .general_education_area_id
        is not None
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=(
                "기타 과목에는 전공 또는 교양 "
                "공식 요건을 연결할 수 없습니다."
            ),
        )

def serialize_course_record(
    record: dict[str, Any],
) -> dict[str, Any]:
    """
    DB 수강기록을 API 응답 형태로 변환한다.

    성적이 없는 기록은 letter_grade를
    None으로 반환한다.

    version 2 암호화 성적은 서버에서
    복호화한 뒤 평문 성적만 API 응답에 포함한다.
    """
    response_record = dict(record)

    response_record["letter_grade"] = None

    crypto_version = (
        response_record.get(
            "letter_grade_crypto_version"
        )
    )

    if crypto_version is None:
        return response_record

    if crypto_version != 2:
        raise RuntimeError(
            "지원하지 않는 성적 암호화 "
            "버전입니다."
        )

    ciphertext = response_record.get(
        "letter_grade_ciphertext"
    )

    iv = response_record.get(
        "letter_grade_iv"
    )

    if (
        not isinstance(ciphertext, str)
        or not isinstance(iv, str)
    ):
        raise RuntimeError(
            "서버 암호화 성적 데이터가 "
            "올바르지 않습니다."
        )

    letter_grade = decrypt_letter_grade(
        ciphertext=ciphertext,
        iv=iv,
        crypto_version=crypto_version,
    )

    response_record["letter_grade"] = (
        letter_grade
    )

    response_record[
        "letter_grade_ciphertext"
    ] = None

    response_record[
        "letter_grade_iv"
    ] = None

    response_record[
        "letter_grade_crypto_version"
    ] = None

    return response_record

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
        "records": [
            serialize_course_record(
                record
            )
            for record in records
        ],
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
        "record": 
            serialize_course_record(
                record
            ),
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
        "record": 
            serialize_course_record(
                record
            ),
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
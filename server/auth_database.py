from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

import psycopg
from psycopg.rows import dict_row


def get_database_url() -> str:
    """환경변수에서 PostgreSQL 연결 문자열을 읽는다."""
    database_url = os.environ.get(
        "DATABASE_URL",
        "",
    ).strip()

    if not database_url:
        raise RuntimeError(
            "DATABASE_URL 환경변수가 설정되어 있지 않습니다."
        )

    return database_url


def connect_auth_database() -> psycopg.Connection:
    """Supabase PostgreSQL 인증 데이터베이스에 연결한다."""
    return psycopg.connect(
        get_database_url(),
        row_factory=dict_row,
    )


def normalize_database_row(
    row: dict[str, Any],
) -> dict[str, Any]:
    """
    PostgreSQL 전용 타입을 기존 SQLite API 형식에 맞춘다.
    """
    result = dict(row)

    for key, value in result.items():
        if isinstance(value, UUID):
            result[key] = str(value)

        elif isinstance(value, datetime):
            result[key] = value.isoformat()

    return result


def get_current_time() -> str:
    """현재 UTC 시각을 ISO 문자열로 반환한다."""
    return datetime.now(
        timezone.utc
    ).isoformat()


def create_auth_tables() -> None:
    """
    인증 테이블은 SQL migration으로 관리하므로
    런타임에서는 별도 생성 작업을 하지 않는다.
    """
    return None

def normalize_username(
    username: str,
) -> str:
    """사용자 ID 비교를 위해 공백과 대소문자를 정리한다."""
    return username.strip().casefold()


def create_user(
    *,
    username: str,
    password_hash: str,
) -> dict[str, Any]:
    """새 사용자를 인증 DB에 저장한다."""
    user_id = str(uuid4())
    normalized_username = normalize_username(
        username
    )
    current_time = get_current_time()

    try:
        with connect_auth_database() as connection:
            connection.execute(
                """
                INSERT INTO users (
                    id,
                    username,
                    username_normalized,
                    password_hash,
                    profile_image_filename,
                    entry_year,
                    student_type,
                    created_at,
                    updated_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    user_id,
                    username.strip(),
                    normalized_username,
                    password_hash,
                    None,
                    None,
                    None,
                    current_time,
                    current_time,
                ),
            )
    except psycopg.IntegrityError as error:
        raise ValueError(
            "이미 사용 중인 사용자 ID입니다."
        ) from error

    return {
        "id": user_id,
        "username": username.strip(),
        "profile_image_filename": None,
        "entry_year": None,
        "student_type" : None,
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

    with connect_auth_database() as connection:
        row = connection.execute(
            """
            SELECT
                id,
                username,
                username_normalized,
                password_hash,
                profile_image_filename,
                entry_year,
                student_type,
                created_at,
                updated_at
            FROM users
            WHERE username_normalized = %s
            """,
            (normalized_username,),
        ).fetchone()

    if row is None:
        return None

    return normalize_database_row(row)


def get_user_by_id(
    user_id: str,
) -> dict[str, Any] | None:
    """사용자 고유 ID로 회원 정보를 조회한다."""
    with connect_auth_database() as connection:
        row = connection.execute(
            """
            SELECT
                id,
                username,
                username_normalized,
                password_hash,
                profile_image_filename,
                entry_year,
                student_type,
                created_at,
                updated_at
            FROM users
            WHERE id = %s
            """,
            (user_id,),
        ).fetchone()

    if row is None:
        return None

    return normalize_database_row(row)


def update_user_password(
    *,
    user_id: str,
    password_hash: str,
) -> bool:
    """사용자의 비밀번호 해시를 변경한다."""
    current_time = get_current_time()

    with connect_auth_database() as connection:
        cursor = connection.execute(
            """
            UPDATE users
            SET
                password_hash = %s,
                updated_at = %s
            WHERE id = %s
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

    with connect_auth_database() as connection:
        cursor = connection.execute(
            """
            UPDATE users
            SET
                profile_image_filename = %s,
                updated_at = %s
            WHERE id = %s
            """,
            (
                profile_image_filename,
                current_time,
                user_id,
            ),
        )

    return cursor.rowcount > 0


def update_user_academic_profile(
    *,
    user_id: str,
    entry_year: int | None,
    student_type: str | None,
) -> bool:
    """사용자의 입학 학번과 학생 유형을 변경한다."""
    current_time = get_current_time()

    with connect_auth_database() as connection:
        cursor = connection.execute(
            """
            UPDATE users
            SET
                entry_year = %s,
                student_type = %s,
                updated_at = %s
            WHERE id = %s
            """,
            (
                entry_year,
                student_type,
                current_time,
                user_id,
            ),
        )

    return cursor.rowcount > 0


def create_user_special_semester(
    *,
    user_id: str,
    grade: int,
    semester: int,
    term: str,
) -> dict[str, Any]:
    """사용자의 특별학기를 생성한다."""
    special_semester_id = str(uuid4())
    current_time = get_current_time()

    try:
        with connect_auth_database() as connection:
            connection.execute(
                """
                INSERT INTO user_special_semesters (
                    id,
                    user_id,
                    grade,
                    semester,
                    term,
                    created_at,
                    updated_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    special_semester_id,
                    user_id,
                    grade,
                    semester,
                    term,
                    current_time,
                    current_time,
                ),
            )
    except psycopg.IntegrityError as error:
        raise ValueError(
            "이미 추가된 특별학기입니다."
        ) from error

    return {
        "id":
            special_semester_id,
        "user_id":
            user_id,
        "grade":
            grade,
        "semester":
            semester,
        "term":
            term,
        "created_at":
            current_time,
        "updated_at":
            current_time,
    }


def get_user_special_semesters(
    *,
    user_id: str,
) -> list[dict[str, Any]]:
    """사용자의 특별학기 목록을 조회한다."""
    with connect_auth_database() as connection:
        rows = connection.execute(
            """
            SELECT
                id,
                user_id,
                grade,
                semester,
                term,
                created_at,
                updated_at
            FROM user_special_semesters
            WHERE user_id = %s
            ORDER BY
                grade ASC,
                CASE term
                    WHEN 'summer' THEN 1
                    WHEN 'winter' THEN 2
                    ELSE 3
                END ASC
            """,
            (user_id,),
        ).fetchall()

    return [
        normalize_database_row(row)
        for row in rows
    ]


def delete_user_special_semester(
    *,
    special_semester_id: str,
    user_id: str,
) -> bool:
    """
    특별학기와 해당 학기의 과목 기록을 함께 삭제한다.
    """
    with connect_auth_database() as connection:
        semester_row = connection.execute(
            """
            SELECT
                grade,
                term
            FROM user_special_semesters
            WHERE
                id = %s
                AND user_id = %s
            """,
            (
                special_semester_id,
                user_id,
            ),
        ).fetchone()

        if semester_row is None:
            return False

        connection.execute(
            """
            DELETE FROM user_course_records
            WHERE
                user_id = %s
                AND grade = %s
                AND term = %s
            """,
            (
                user_id,
                semester_row["grade"],
                semester_row["term"],
            ),
        )

        cursor = connection.execute(
            """
            DELETE FROM user_special_semesters
            WHERE
                id = %s
                AND user_id = %s
            """,
            (
                special_semester_id,
                user_id,
            ),
        )

    return cursor.rowcount > 0


##
def create_user_course_record(
    *,
    user_id: str,
    curriculum_course_id: int | None,
    lecture_id: int | None,
    general_education_requirement_id: int | None,
    general_education_area_id: int | None,
    academic_year: int | None,
    grade: int | None,
    semester: int | None,
    term: str | None,
    course_name: str,
    course_code: str | None,
    completion_type: str,
    credits: float,
    status: str,
    letter_grade_ciphertext: str | None,
    letter_grade_iv: str | None,
    letter_grade_crypto_version: int | None,
    is_retake: bool,
    note: str | None,
) -> dict[str, Any]:
    """사용자의 과목 이수 기록을 생성한다."""
    record_id = str(uuid4())
    current_time = get_current_time()

    with connect_auth_database() as connection:
        connection.execute(
            """
            INSERT INTO user_course_records (
                id,
                user_id,
                curriculum_course_id,
                lecture_id,
                general_education_requirement_id,
                general_education_area_id,
                academic_year,
                grade,
                semester,
                term,
                course_name,
                course_code,
                completion_type,
                credits,
                status,
                letter_grade_ciphertext,
                letter_grade_iv,
                letter_grade_crypto_version,
                is_retake,
                note,
                created_at,
                updated_at
            )
            VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s
            )
            """,
            (
                record_id,
                user_id,
                curriculum_course_id,
                lecture_id,
                general_education_requirement_id,
                general_education_area_id,
                academic_year,
                grade,
                semester,
                term,
                course_name.strip(),
                (
                    course_code.strip()
                    if course_code is not None
                    else None
                ),
                completion_type,
                credits,
                status,
                letter_grade_ciphertext,
                letter_grade_iv,
                letter_grade_crypto_version,
                is_retake,
                (
                    note.strip()
                    if note is not None
                    else None
                ),
                current_time,
                current_time,
            ),
        )

    return {
        "id": record_id,
        "user_id": user_id,
        "curriculum_course_id":
            curriculum_course_id,
        "lecture_id":
            lecture_id,
        "general_education_requirement_id":
            general_education_requirement_id,
        "general_education_area_id":
            general_education_area_id,
        "academic_year":
            academic_year,
        "grade":
            grade,
        "semester":
            semester,
        "term":
            term,
        "course_name":
            course_name.strip(),
        "course_code": (
            course_code.strip()
            if course_code is not None
            else None
        ),
        "completion_type":
            completion_type,
        "credits":
            credits,
        "status":
            status,
        "letter_grade_ciphertext":
            letter_grade_ciphertext,
        "letter_grade_iv":
            letter_grade_iv,
        "letter_grade_crypto_version":
            letter_grade_crypto_version,
        "is_retake":
            is_retake,
        "note": (
            note.strip()
            if note is not None
            else None
        ),
        "created_at":
            current_time,
        "updated_at":
            current_time,
    }


def get_user_course_records(
    *,
    user_id: str,
) -> list[dict[str, Any]]:
    """사용자에게 저장된 모든 과목 이수 기록을 조회한다."""
    with connect_auth_database() as connection:
        rows = connection.execute(
            """
            SELECT
                id,
                user_id,
                curriculum_course_id,
                lecture_id,
                general_education_requirement_id,
                general_education_area_id,
                academic_year,
                grade,
                semester,
                term,
                course_name,
                course_code,
                completion_type,
                credits,
                status,
                letter_grade_ciphertext,
                letter_grade_iv,
                letter_grade_crypto_version,
                is_retake,
                note,
                created_at,
                updated_at
            FROM user_course_records
            WHERE user_id = %s
            ORDER BY
                CASE
                    WHEN grade IS NULL
                    THEN 1
                    ELSE 0
                END,
                grade,
                semester,
                course_name
            """,
            (user_id,),
        ).fetchall()

    records: list[dict[str, Any]] = []

    for row in rows:
        record = normalize_database_row(row)
        record["is_retake"] = bool(
            record["is_retake"]
        )
        records.append(record)

    return records


def update_user_course_record(
    *,
    record_id: str,
    user_id: str,
    curriculum_course_id: int | None,
    lecture_id: int | None,
    general_education_requirement_id: int | None,
    general_education_area_id: int | None,
    academic_year: int | None,
    grade: int | None,
    semester: int | None,
    term: str | None,
    course_name: str,
    course_code: str | None,
    completion_type: str,
    credits: float,
    status: str,
    letter_grade_ciphertext: str | None,
    letter_grade_iv: str | None,
    letter_grade_crypto_version: int | None,
    is_retake: bool,
    note: str | None,
) -> dict[str, Any] | None:
    """사용자 소유의 과목 이수 기록을 변경한다."""
    current_time = get_current_time()

    with connect_auth_database() as connection:
        cursor = connection.execute(
            """
            UPDATE user_course_records
            SET
                curriculum_course_id = %s,
                lecture_id = %s,
                general_education_requirement_id = %s,
                general_education_area_id = %s,
                academic_year = %s,
                grade = %s,
                semester = %s,
                term =%s,
                course_name = %s,
                course_code = %s,
                completion_type = %s,
                credits = %s,
                status = %s,
                letter_grade_ciphertext = %s,
                letter_grade_iv = %s,
                letter_grade_crypto_version = %s,
                is_retake = %s,
                note = %s,
                updated_at = %s
            WHERE id = %s
              AND user_id = %s
            """,
            (
                curriculum_course_id,
                lecture_id,
                general_education_requirement_id,
                general_education_area_id,
                academic_year,
                grade,
                semester,
                term,
                course_name.strip(),
                (
                    course_code.strip()
                    if course_code is not None
                    else None
                ),
                completion_type,
                credits,
                status,
                letter_grade_ciphertext,
                letter_grade_iv,
                letter_grade_crypto_version,
                is_retake,
                (
                    note.strip()
                    if note is not None
                    else None
                ),
                current_time,
                record_id,
                user_id,
            ),
        )

        if cursor.rowcount == 0:
            return None

        row = connection.execute(
            """
            SELECT
                id,
                user_id,
                curriculum_course_id,
                lecture_id,
                general_education_requirement_id,
                general_education_area_id,
                academic_year,
                grade,
                semester,
                term,
                course_name,
                course_code,
                completion_type,
                credits,
                status,
                letter_grade_ciphertext,
                letter_grade_iv,
                letter_grade_crypto_version,
                is_retake,
                note,
                created_at,
                updated_at
            FROM user_course_records
            WHERE id = %s
              AND user_id = %s
            """,
            (
                record_id,
                user_id,
            ),
        ).fetchone()

    if row is None:
        return None

    record = normalize_database_row(row)
    record["is_retake"] = bool(
        record["is_retake"]
    )

    return record
##

def delete_user_course_record(
    
    *,
    record_id: str,
    user_id: str,
) -> bool:
    """사용자 소유의 과목 이수 기록을 삭제한다."""
    with connect_auth_database() as connection:
        cursor = connection.execute(
            """
            DELETE FROM user_course_records
            WHERE id = %s
              AND user_id = %s
            """,
            (
                record_id,
                user_id,
            ),
        )

    return cursor.rowcount > 0


def create_user_saved_timetable(
    *,
    user_id: str,
    name: str,
    academic_year: int,
    semester: int,
    lecture_ids: list[int],
) -> dict[str, Any]:
    """사용자의 시간표를 생성한다."""
    timetable_id = str(uuid4())
    current_time = get_current_time()

    normalized_lecture_ids = list(
        dict.fromkeys(lecture_ids)
    )

    with connect_auth_database() as connection:
        connection.execute(
            """
            INSERT INTO user_saved_timetables (
                id,
                user_id,
                name,
                academic_year,
                semester,
                lecture_ids,
                created_at,
                updated_at
            )
            VALUES (
                %s, %s, %s, %s,
                %s, %s, %s, %s
            )
            """,
            (
                timetable_id,
                user_id,
                name.strip(),
                academic_year,
                semester,
                normalized_lecture_ids,
                current_time,
                current_time,
            ),
        )

    return {
        "id": timetable_id,
        "user_id": user_id,
        "name": name.strip(),
        "academic_year": academic_year,
        "semester": semester,
        "lecture_ids": normalized_lecture_ids,
        "created_at": current_time,
        "updated_at": current_time,
    }


def get_user_saved_timetables(
    *,
    user_id: str,
) -> list[dict[str, Any]]:
    """사용자의 모든 저장 시간표를 조회한다."""
    with connect_auth_database() as connection:
        rows = connection.execute(
            """
            SELECT
                id,
                user_id,
                name,
                academic_year,
                semester,
                lecture_ids,
                created_at,
                updated_at
            FROM user_saved_timetables
            WHERE user_id = %s
            ORDER BY
                academic_year DESC,
                semester DESC,
                created_at ASC
            """,
            (user_id,),
        ).fetchall()

    return [
        normalize_database_row(row)
        for row in rows
    ]


def update_user_saved_timetable(
    *,
    timetable_id: str,
    user_id: str,
    name: str,
    academic_year: int,
    semester: int,
    lecture_ids: list[int],
) -> dict[str, Any] | None:
    """사용자 소유의 저장 시간표를 변경한다."""
    current_time = get_current_time()

    normalized_lecture_ids = list(
        dict.fromkeys(lecture_ids)
    )

    with connect_auth_database() as connection:
        cursor = connection.execute(
            """
            UPDATE user_saved_timetables
            SET
                name = %s,
                academic_year = %s,
                semester = %s,
                lecture_ids = %s,
                updated_at = %s
            WHERE
                id = %s
                AND user_id = %s
            """,
            (
                name.strip(),
                academic_year,
                semester,
                normalized_lecture_ids,
                current_time,
                timetable_id,
                user_id,
            ),
        )

        if cursor.rowcount == 0:
            return None

        row = connection.execute(
            """
            SELECT
                id,
                user_id,
                name,
                academic_year,
                semester,
                lecture_ids,
                created_at,
                updated_at
            FROM user_saved_timetables
            WHERE
                id = %s
                AND user_id = %s
            """,
            (
                timetable_id,
                user_id,
            ),
        ).fetchone()

    if row is None:
        return None

    return normalize_database_row(row)


def delete_user_saved_timetable(
    *,
    timetable_id: str,
    user_id: str,
) -> bool:
    """사용자 소유의 저장 시간표를 삭제한다."""
    with connect_auth_database() as connection:
        cursor = connection.execute(
            """
            DELETE FROM user_saved_timetables
            WHERE
                id = %s
                AND user_id = %s
            """,
            (
                timetable_id,
                user_id,
            ),
        )

    return cursor.rowcount > 0
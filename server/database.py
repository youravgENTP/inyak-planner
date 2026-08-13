from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

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


def connect_database() -> psycopg.Connection:
    """Supabase PostgreSQL 데이터베이스에 연결한다."""
    return psycopg.connect(
        get_database_url(),
        row_factory=dict_row,
    )

def get_lectures(
    *,
    academic_year: Optional[int] = None,
    semester: Optional[int] = None,
    query: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """조건에 맞는 강의 목록을 데이터베이스에서 조회한다."""
    conditions: List[str] = []
    parameters: List[object] = []

    if academic_year is not None:
        conditions.append("academic_year = %s")
        parameters.append(academic_year)

    if semester is not None:
        conditions.append("semester = %s")
        parameters.append(semester)

    if query:
        normalized_query = query.strip()

        if normalized_query:
            conditions.append(
                """
                (
                    course_code LIKE %s
                    OR course_name LIKE %s
                    OR professor LIKE %s
                    OR department LIKE %s
                )
                """
            )

            search_pattern = f"%{normalized_query}%"

            parameters.extend(
                [
                    search_pattern,
                    search_pattern,
                    search_pattern,
                    search_pattern,
                ]
            )

    where_clause = ""

    if conditions:
        where_clause = "WHERE " + " AND ".join(conditions)

    sql = f"""
        SELECT
            id,
            academic_year,
            semester,
            track,
            course_code,
            course_name,
            section,
            completion_type,
            credits,
            professor,
            department,
            recommended_year,
            grading_method,
            competency_type,
            schedule_and_room
        FROM courses
        {where_clause}
        ORDER BY
            course_code,
            CASE
                WHEN section ~ '^[0-9]+$'
                THEN section::INTEGER
                ELSE 999999
            END,
            section
    """

    with connect_database() as connection:
        rows = connection.execute(sql, parameters).fetchall()

    return [dict(row) for row in rows]


def get_lecture_by_id(
    lecture_id: int,
) -> Optional[Dict[str, Any]]:
    """ID가 일치하는 강의 하나를 조회한다."""
    with connect_database() as connection:
        row = connection.execute(
            """
            SELECT
                id,
                academic_year,
                semester,
                track,
                course_code,
                course_name,
                section,
                completion_type,
                credits,
                professor,
                department,
                recommended_year,
                grading_method,
                competency_type,
                schedule_and_room
            FROM courses
            WHERE id = %s
            """,
            (lecture_id,),
        ).fetchone()

    if row is None:
        return None

    return dict(row)

def get_lectures_by_ids(
    lecture_ids: List[int],
) -> List[Dict[str, Any]]:
    """여러 강의 ID에 해당하는 강의를 한 번에 조회한다."""
    if not lecture_ids:
        return []

    unique_lecture_ids = list(
        dict.fromkeys(lecture_ids)
    )

    placeholders = ", ".join(
        "%s" for _ in unique_lecture_ids
    )

    sql = f"""
        SELECT
            id,
            academic_year,
            semester,
            track,
            course_code,
            course_name,
            section,
            completion_type,
            credits,
            professor,
            department,
            recommended_year,
            grading_method,
            competency_type,
            schedule_and_room
        FROM courses
        WHERE id IN ({placeholders})
    """

    with connect_database() as connection:
        rows = connection.execute(
            sql,
            unique_lecture_ids,
        ).fetchall()

    lecture_map = {
        row["id"]: dict(row)
        for row in rows
    }

    return [
        lecture_map[lecture_id]
        for lecture_id in unique_lecture_ids
        if lecture_id in lecture_map
    ]

def get_curriculum_courses(
    *,
    entry_year: int,
) -> List[Dict[str, Any]]:
    """입학연도에 해당하는 교육과정 과목을 조회한다."""
    with connect_database() as connection:
        rows = connection.execute(
            """
            SELECT
                id,
                entry_year,
                grade,
                semester,
                course_name,
                course_code,
                completion_type,
                credits,
                notes,
                change_group,
                change_type,
                change_role,
                change_effective_year,
                change_note,
                previous_credits,
                previous_completion_type,
                previous_grade,
                previous_semester,
                attribute_change_effective_year,
                attribute_change_note
            FROM curriculum_courses
            WHERE entry_year = %s
            ORDER BY
                grade,
                semester,
                CASE completion_type
                    WHEN '전필' THEN 1
                    WHEN '전선' THEN 2
                    ELSE 3
                END,
                CASE change_role
                    WHEN 'current' THEN 1
                    WHEN 'legacy' THEN 2
                    ELSE 3
                END,
                course_name
            """,
            (entry_year,),
        ).fetchall()

    return [
        dict(row)
        for row in rows
    ]


def get_graduation_requirements(
    *,
    entry_year: int,
) -> Optional[Dict[str, Any]]:
    """입학연도에 해당하는 전공 졸업요건을 조회한다."""
    with connect_database() as connection:
        row = connection.execute(
            """
            SELECT
                entry_year,
                major_required_credits,
                major_elective_credits,
                notes
            FROM graduation_requirements
            WHERE entry_year = %s
            """,
            (entry_year,),
        ).fetchone()

    if row is None:
        return None

    return dict(row)


def get_general_education_requirements(
    *,
    entry_year: int,
) -> List[Dict[str, Any]]:
    """입학연도에 해당하는 교양 졸업요건을 조회한다."""
    with connect_database() as connection:
        requirement_rows = connection.execute(
            """
            SELECT
                id,
                entry_year,
                category,
                minimum_credits,
                minimum_area_count,
                notes,
                display_order
            FROM general_education_requirements
            WHERE entry_year = %s
            ORDER BY display_order
            """,
            (entry_year,),
        ).fetchall()

        area_rows = connection.execute(
            """
            SELECT
                area.id,
                area.requirement_id,
                area.area_name,
                area.minimum_credits,
                area.is_required,
                area.notes,
                area.display_order
            FROM general_education_areas
            AS area
            JOIN general_education_requirements
            AS requirement
                ON requirement.id =
                   area.requirement_id
            WHERE requirement.entry_year = %s
            ORDER BY
                requirement.display_order,
                area.display_order
            """,
            (entry_year,),
        ).fetchall()


    areas_by_requirement_id: Dict[
        int,
        List[Dict[str, Any]],
    ] = {}

    for area_row in area_rows:
        requirement_id = int(
            area_row["requirement_id"]
        )

        area = {
            "id": area_row["id"],
            "area_name": area_row["area_name"],
            "minimum_credits": (
                area_row["minimum_credits"]
            ),
            "is_required": bool(
                area_row["is_required"]
            ),
            "notes": area_row["notes"],
            "display_order": (
                area_row["display_order"]
            ),
        }

        areas_by_requirement_id.setdefault(
            requirement_id,
            [],
        ).append(area)

    requirements: List[
        Dict[str, Any]
    ] = []

    for requirement_row in requirement_rows:
        requirement_id = int(
            requirement_row["id"]
        )

        requirements.append(
            {
                "id": requirement_id,
                "entry_year": (
                    requirement_row["entry_year"]
                ),
                "category": (
                    requirement_row["category"]
                ),
                "minimum_credits": (
                    requirement_row[
                        "minimum_credits"
                    ]
                ),
                "minimum_area_count": (
                    requirement_row[
                        "minimum_area_count"
                    ]
                ),
                "notes": requirement_row["notes"],
                "display_order": (
                    requirement_row[
                        "display_order"
                    ]
                ),
                "areas": (
                    areas_by_requirement_id.get(
                        requirement_id,
                        [],
                    )
                ),
            }
        )

    return requirements

def get_curriculum_course_by_id(
    curriculum_course_id: int,
) -> Optional[Dict[str, Any]]:
    """ID가 일치하는 공식 교육과정 과목 하나를 조회한다."""
    with connect_database() as connection:
        row = connection.execute(
            """
            SELECT
                id,
                entry_year,
                grade,
                semester,
                course_name,
                course_code,
                completion_type,
                credits,
                notes,
                change_group,
                change_type,
                change_role,
                change_effective_year,
                change_note
            FROM curriculum_courses
            WHERE id = %s
            """,
            (curriculum_course_id,),
        ).fetchone()

    if row is None:
        return None

    return dict(row)


def get_general_education_link(
    *,
    requirement_id: int,
    area_id: int,
) -> Optional[Dict[str, Any]]:
    """
    교양 영역과 상위 졸업요건의 연결 정보를 조회한다.
    """
    with connect_database() as connection:
        row = connection.execute(
            """
            SELECT
                requirement.id
                    AS requirement_id,
                requirement.entry_year,
                requirement.category,
                area.id AS area_id,
                area.area_name
            FROM general_education_areas
            AS area
            JOIN general_education_requirements
            AS requirement
                ON requirement.id =
                   area.requirement_id
            WHERE
                requirement.id = %s
                AND area.id = %s
            """,
            (
                requirement_id,
                area_id,
            ),
        ).fetchone()

    if row is None:
        return None

    return dict(row)
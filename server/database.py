from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATABASE_PATH = PROJECT_ROOT / "data" / "db" / "inyak.db"


def connect_database() -> sqlite3.Connection:
    """inyak SQLite 데이터베이스에 연결한다."""
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")

    return connection


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
        conditions.append("academic_year = ?")
        parameters.append(academic_year)

    if semester is not None:
        conditions.append("semester = ?")
        parameters.append(semester)

    if query:
        normalized_query = query.strip()

        if normalized_query:
            conditions.append(
                """
                (
                    course_code LIKE ?
                    OR course_name LIKE ?
                    OR professor LIKE ?
                    OR department LIKE ?
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
            CAST(section AS INTEGER),
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
            WHERE id = ?
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
        "?" for _ in unique_lecture_ids
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
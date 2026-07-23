"""
SQLite storage for collected lecture-list rows.
수집된 정보를 SQL 테이블로 정리하는 코드
"""

from __future__ import annotations

import re
import sqlite3
from collections.abc import Mapping, Sequence
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB_PATH = PROJECT_ROOT / "data" / "db" / "inyak.db"
SCHEMA_PATH = PROJECT_ROOT / "scripts" / "schema.sql"

REGULAR_TRACK_VALUE = "1"
DEPARTMENT_WITH_YEAR = re.compile(r"^(?P<department>.*?)(?:\((?P<year>\d+)\))?$")

UPSERT_COURSE_SQL = """
INSERT INTO courses (
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
    competency_type
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT (
    academic_year,
    semester,
    track,
    course_code,
    section
)
DO UPDATE SET
    course_name = excluded.course_name,
    completion_type = excluded.completion_type,
    credits = excluded.credits,
    professor = excluded.professor,
    department = excluded.department,
    recommended_year = excluded.recommended_year,
    grading_method = excluded.grading_method,
    competency_type = excluded.competency_type,
    last_collected_at = CURRENT_TIMESTAMP
"""

def connect_database(
    db_path: Path = DEFAULT_DB_PATH,
) -> sqlite3.Connection:
    """Database를 열고 필요시 schema를 생성한다."""
    db_path.parent.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.executescript(
        SCHEMA_PATH.read_text(encoding="utf-8")
    )

    return connection

def split_department_and_year(value : object) -> tuple[str | None, int | None]:
    """'약학과(학년)'으로 크롤링된 정보를 (약학과, 학년)으로 분리)"""
    text = _clean_text(value)
    if not text:
        return None, None
    
    match = DEPARTMENT_WITH_YEAR.fullmatch(text)
    if match is None:
        return text, None

    department = match.group("department").strip() or None
    year_text = match.group("year")
    recommended_year = int(year_text) if year_text else None
    
    return department, recommended_year

def normalize_course(
    row: Mapping[str, object],
    *,
    track : str = REGULAR_TRACK_VALUE,
    ) -> tuple[object, ...]:
    """UPSERT로 삽입할 행으로 portal 행 정보 변환"""
    department, recommended_year = split_department_and_year(row.get("개설학과"))

    academic_year = _required_int(row.get("학년도"), "학년도")
    semester = _required_int(row.get("학기"), "학기")
    course_code = _required_text(row.get("교과목"), "교과목")
    course_name = _required_text(row.get("교과목명"), "교과목명")
    section = _required_text(row.get("분반"), "분반")

    return (
        academic_year,
        semester,
        str(track),
        course_code,
        course_name,
        section,
        _clean_text(row.get("이수구분")),
        _optional_float(row.get("학점")),
        _clean_text(row.get("담당교수")),
        department,
        recommended_year,
        _clean_text(row.get("등급패스") or row.get("성적부여방법")),
        _clean_text(row.get("역량구분")),
    )

def save_courses(
    rows: Sequence[Mapping[str, object]],
    *,
    db_path: Path = DEFAULT_DB_PATH,
    track: str = REGULAR_TRACK_VALUE,
) -> int:
    """Insert new courses and update matching courses in one transaction."""
    normalized = [normalize_course(row, track=track) for row in rows]

    with connect_database(db_path) as connection:
        connection.executemany(UPSERT_COURSE_SQL, normalized)

    return len(normalized)

def update_schedule_and_room(
    connection: sqlite3.Connection,
    *,
    academic_year: int,
    semester: int,
    track: str,
    course_code: str,
    section: str,
    schedule_and_room: str | None,
) -> None:
    cursor = connection.execute(
        """
        UPDATE courses
        SET schedule_and_room = ?,
            last_collected_at = CURRENT_TIMESTAMP
        WHERE academic_year = ?
          AND semester = ?
          AND track = ?
          AND course_code = ?
          AND section = ?
        """,
        (
            schedule_and_room,
            academic_year,
            semester,
            str(track),
            course_code,
            section,
        ),
    )

    if cursor.rowcount == 0:
        raise LookupError(
            "시간·강의실을 업데이트할 강좌를 찾지 못했습니다: "
            f"{academic_year}-{semester}, track={track}, "
            f"{course_code}-{section}"
        )

# Internal utility functions

def _clean_text(value : object) -> str | None:
    """str 양옆의 공백 제거"""
    if value is None:
        return None
    text = str(value).strip()
    return text or None

def _required_text(value : object, field_name : str) -> str:
    text = _clean_text(value)
    if text is None:
        raise ValueError(f"{field_name} 값이 비어 있습니다.")
    return text

def _required_int(value: object, field_name: str) -> int:
    text = _required_text(value, field_name)

    try:
        return(int(text))
    except ValueError as exc:
        raise ValueError(f"{field_name} 값이 정수가 아닙니다: {text}") from exc
    
def _optional_float(value: object) -> float | None:
    text = _clean_text(value)
    if text is None:
        return None
    try :
        return float(text)
    except ValueError as exc:
        raise ValueError(f"학점 값이 숫자가 아닙니다: {text}") from exc
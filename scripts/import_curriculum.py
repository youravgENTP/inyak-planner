"""Import cohort curriculum data into inyak.db.

Run from the project root:

    python scripts/import_curriculum.py data/seed/curriculum_2024.csv

The import replaces only the curriculum rows for the entry year contained
in the CSV. It never modifies the crawled `courses` table.
"""

from __future__ import annotations

import argparse
import csv
import sqlite3
from dataclasses import dataclass
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DB_PATH = PROJECT_ROOT / "data" / "db" / "inyak.db"

REQUIRED_COLUMNS = {
    "entry_year",
    "grade",
    "semester",
    "course_name",
    "course_code",
    "completion_type",
    "credits",
    "notes",
}


@dataclass(frozen=True)
class CurriculumCourse:
    entry_year: int
    grade: int
    semester: int
    course_name: str
    course_code: str | None
    completion_type: str
    credits: float | None
    notes: str | None


def clean_optional_text(value: str | None) -> str | None:
    if value is None:
        return None

    cleaned = value.strip()
    return cleaned or None


def parse_optional_float(value: str | None) -> float | None:
    cleaned = clean_optional_text(value)
    if cleaned is None:
        return None

    try:
        return float(cleaned)
    except ValueError as exc:
        raise ValueError(f"학점이 숫자가 아닙니다: {cleaned}") from exc


def parse_row(
    row: dict[str, str],
    *,
    row_number: int,
) -> CurriculumCourse:
    try:
        entry_year = int(row["entry_year"])
        grade = int(row["grade"])
        semester = int(row["semester"])
    except ValueError as exc:
        raise ValueError(
            f"{row_number}행의 entry_year, grade, semester를 확인하세요."
        ) from exc

    course_name = row["course_name"].strip()
    completion_type = row["completion_type"].strip()

    if not course_name:
        raise ValueError(f"{row_number}행의 course_name이 비어 있습니다.")

    if not 1 <= grade <= 6:
        raise ValueError(f"{row_number}행의 학년 범위가 잘못됐습니다: {grade}")

    if semester not in (1, 2):
        raise ValueError(
            f"{row_number}행의 학기는 1 또는 2여야 합니다: {semester}"
        )

    if completion_type not in {"전필", "전선"}:
        raise ValueError(
            f"{row_number}행의 이수구분이 잘못됐습니다: "
            f"{completion_type}"
        )

    return CurriculumCourse(
        entry_year=entry_year,
        grade=grade,
        semester=semester,
        course_name=course_name,
        course_code=clean_optional_text(row["course_code"]),
        completion_type=completion_type,
        credits=parse_optional_float(row["credits"]),
        notes=clean_optional_text(row["notes"]),
    )


def load_csv(csv_path: Path) -> list[CurriculumCourse]:
    with csv_path.open(
        "r",
        encoding="utf-8-sig",
        newline="",
    ) as file:
        reader = csv.DictReader(file)

        if reader.fieldnames is None:
            raise ValueError("CSV 헤더가 없습니다.")

        actual_columns = set(reader.fieldnames)
        missing_columns = REQUIRED_COLUMNS - actual_columns

        if missing_columns:
            missing_text = ", ".join(sorted(missing_columns))
            raise ValueError(f"CSV 필수 칼럼이 없습니다: {missing_text}")

        courses = [
            parse_row(row, row_number=index)
            for index, row in enumerate(reader, start=2)
        ]

    if not courses:
        raise ValueError("CSV에 교육과정 행이 없습니다.")

    entry_years = {course.entry_year for course in courses}
    if len(entry_years) != 1:
        raise ValueError(
            "한 번에 하나의 입학년도만 import할 수 있습니다: "
            f"{sorted(entry_years)}"
        )

    duplicate_keys: set[tuple[int, int, str]] = set()
    seen_keys: set[tuple[int, int, str]] = set()

    for course in courses:
        key = (
            course.grade,
            course.semester,
            course.course_name,
        )

        if key in seen_keys:
            duplicate_keys.add(key)

        seen_keys.add(key)

    if duplicate_keys:
        raise ValueError(
            "중복 교육과정 과목이 있습니다: "
            f"{sorted(duplicate_keys)}"
        )

    return courses


def import_courses(
    courses: list[CurriculumCourse],
    *,
    db_path: Path,
) -> None:
    entry_year = courses[0].entry_year

    insert_sql = """
    INSERT INTO curriculum_courses (
        entry_year,
        grade,
        semester,
        course_name,
        course_code,
        completion_type,
        credits,
        notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """

    rows = [
        (
            course.entry_year,
            course.grade,
            course.semester,
            course.course_name,
            course.course_code,
            course.completion_type,
            course.credits,
            course.notes,
        )
        for course in courses
    ]

    with sqlite3.connect(db_path) as connection:
        connection.execute("PRAGMA foreign_keys = ON")

        table_exists = connection.execute(
            """
            SELECT 1
            FROM sqlite_master
            WHERE type = 'table'
              AND name = 'curriculum_courses'
            """
        ).fetchone()

        if table_exists is None:
            raise RuntimeError(
                "curriculum_courses 테이블이 없습니다. "
                "먼저 scripts/schema.sql을 적용하세요."
            )

        # 해당 학번 데이터만 교체합니다.
        # courses 테이블에는 영향을 주지 않습니다.
        connection.execute(
            """
            DELETE FROM curriculum_courses
            WHERE entry_year = ?
            """,
            (entry_year,),
        )

        connection.executemany(insert_sql, rows)


def print_summary(
    courses: list[CurriculumCourse],
    *,
    db_path: Path,
) -> None:
    entry_year = courses[0].entry_year

    with sqlite3.connect(db_path) as connection:
        summary = connection.execute(
            """
            SELECT
                COUNT(*) AS course_count,
                SUM(
                    CASE
                        WHEN completion_type = '전필'
                        THEN COALESCE(credits, 0)
                        ELSE 0
                    END
                ) AS required_credits,
                SUM(
                    CASE
                        WHEN completion_type = '전선'
                        THEN COALESCE(credits, 0)
                        ELSE 0
                    END
                ) AS elective_credits,
                SUM(
                    CASE
                        WHEN course_code IS NULL
                        THEN 1
                        ELSE 0
                    END
                ) AS missing_code_count
            FROM curriculum_courses
            WHERE entry_year = ?
            """,
            (entry_year,),
        ).fetchone()

    print()
    print(f"{entry_year}학번 교육과정 import 완료")
    print(f"과목 수: {summary[0]}개")
    print(f"전필 학점: {summary[1]:g}")
    print(f"전선 개설학점: {summary[2]:g}")
    print(f"대표 학정번호 미지정: {summary[3]}개")
    print(f"DB: {db_path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="학번별 교육과정 CSV를 inyak.db에 저장합니다."
    )
    parser.add_argument(
        "csv_path",
        type=Path,
        help="교육과정 CSV 경로",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    csv_path = args.csv_path.expanduser().resolve()
    if not csv_path.is_file():
        raise SystemExit(f"CSV 파일을 찾을 수 없습니다: {csv_path}")

    if not DB_PATH.is_file():
        raise SystemExit(f"DB 파일을 찾을 수 없습니다: {DB_PATH}")

    try:
        courses = load_csv(csv_path)
        import_courses(courses, db_path=DB_PATH)
        print_summary(courses, db_path=DB_PATH)
    except (ValueError, RuntimeError, sqlite3.Error) as error:
        raise SystemExit(f"Import 실패: {error}") from error


if __name__ == "__main__":
    main()
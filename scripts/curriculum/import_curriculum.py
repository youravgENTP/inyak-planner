"""Import cohort curriculum data into inyak.db.

Run from the project root:

    python scripts/import_curriculum.py data/seed/curriculum/curriculum_2024.csv

The import replaces only the curriculum rows for the entry year contained
in the CSV. It never modifies the crawled `courses` table.
"""

from __future__ import annotations

import argparse
import csv
import sqlite3
from dataclasses import dataclass
from pathlib import Path


from scripts.common.data_paths import (
    DATABASE_PATH,
)


DB_PATH = DATABASE_PATH

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

    change_group: str | None
    change_type: str | None
    change_role: str
    change_effective_year: int | None
    change_note: str | None

    previous_credits: float | None
    previous_completion_type: str | None
    previous_grade: int | None
    previous_semester: int | None
    attribute_change_effective_year: int | None
    attribute_change_note: str | None


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
            f"{row_number}행의 entry_year, "
            "grade, semester를 확인하세요."
        ) from exc

    course_name = row["course_name"].strip()
    completion_type = (
        row["completion_type"].strip()
    )

    change_group = clean_optional_text(
        row.get("change_group")
    )

    change_type = clean_optional_text(
        row.get("change_type")
    )

    change_role = (
        clean_optional_text(
            row.get("change_role")
        )
        or "current"
    )

    change_effective_year_text = (
        clean_optional_text(
            row.get(
                "change_effective_year"
            )
        )
    )

    change_effective_year = None

    if change_effective_year_text is not None:
        try:
            change_effective_year = int(
                change_effective_year_text
            )
        except ValueError as exc:
            raise ValueError(
                f"{row_number}행의 "
                "change_effective_year가 "
                "정수가 아닙니다: "
                f"{change_effective_year_text}"
            ) from exc

    change_note = clean_optional_text(
        row.get("change_note")
    )

    previous_credits = parse_optional_float(
        row.get("previous_credits")
    )

    previous_completion_type = (
        clean_optional_text(
            row.get(
                "previous_completion_type"
            )
        )
    )

    previous_grade_text = clean_optional_text(
        row.get("previous_grade")
    )

    previous_grade = None

    if previous_grade_text is not None:
        try:
            previous_grade = int(
                previous_grade_text
            )
        except ValueError as exc:
            raise ValueError(
                f"{row_number}행의 "
                "previous_grade가 "
                "정수가 아닙니다: "
                f"{previous_grade_text}"
            ) from exc

    previous_semester_text = (
        clean_optional_text(
            row.get("previous_semester")
        )
    )

    previous_semester = None

    if previous_semester_text is not None:
        try:
            previous_semester = int(
                previous_semester_text
            )
        except ValueError as exc:
            raise ValueError(
                f"{row_number}행의 "
                "previous_semester가 "
                "정수가 아닙니다: "
                f"{previous_semester_text}"
            ) from exc

    attribute_change_effective_year_text = (
        clean_optional_text(
            row.get(
                "attribute_change_effective_year"
            )
        )
    )

    attribute_change_effective_year = None

    if (
        attribute_change_effective_year_text
        is not None
    ):
        try:
            attribute_change_effective_year = int(
                attribute_change_effective_year_text
            )
        except ValueError as exc:
            raise ValueError(
                f"{row_number}행의 "
                "attribute_change_effective_year가 "
                "정수가 아닙니다: "
                f"{attribute_change_effective_year_text}"
            ) from exc

    attribute_change_note = clean_optional_text(
        row.get("attribute_change_note")
    )

    if not course_name:
        raise ValueError(
            f"{row_number}행의 "
            "course_name이 비어 있습니다."
        )

    if not 1 <= grade <= 6:
        raise ValueError(
            f"{row_number}행의 학년 범위가 "
            f"잘못됐습니다: {grade}"
        )

    if semester not in (1, 2):
        raise ValueError(
            f"{row_number}행의 학기는 "
            f"1 또는 2여야 합니다: {semester}"
        )

    if completion_type not in {
        "전필",
        "전선",
    }:
        raise ValueError(
            f"{row_number}행의 이수구분이 "
            f"잘못됐습니다: {completion_type}"
        )

    if change_role not in {
        "current",
        "legacy",
    }:
        raise ValueError(
            f"{row_number}행의 change_role이 "
            f"잘못됐습니다: {change_role}"
        )

    if (
        change_type is not None
        and change_type not in {
            "1:1",
            "1:N",
            "N:1",
            "N:M",
        }
    ):
        raise ValueError(
            f"{row_number}행의 change_type이 "
            f"잘못됐습니다: {change_type}"
        )

    if change_group is None:
        if change_type is not None:
            raise ValueError(
                f"{row_number}행은 "
                "change_group 없이 "
                "change_type을 지정할 수 없습니다."
            )

        if change_role != "current":
            raise ValueError(
                f"{row_number}행의 일반 과목은 "
                "change_role=current여야 합니다."
            )

        if (
            change_effective_year is not None
            or change_note is not None
        ):
            raise ValueError(
                f"{row_number}행은 "
                "change_group 없이 변경 메타데이터를 "
                "지정할 수 없습니다."
            )

    else:
        if change_type is None:
            raise ValueError(
                f"{row_number}행은 "
                "change_group이 있으므로 "
                "change_type도 필요합니다."
            )

    if (
        change_effective_year is not None
        and not (
            2000
            <= change_effective_year
            <= 2100
        )
    ):
        raise ValueError(
            f"{row_number}행의 "
            "change_effective_year 범위가 "
            f"잘못됐습니다: "
            f"{change_effective_year}"
        )

    if (
        previous_completion_type is not None
        and previous_completion_type not in {
            "전필",
            "전선",
        }
    ):
        raise ValueError(
            f"{row_number}행의 "
            "previous_completion_type이 "
            "잘못됐습니다: "
            f"{previous_completion_type}"
        )

    if (
        previous_grade is not None
        and not 1 <= previous_grade <= 6
    ):
        raise ValueError(
            f"{row_number}행의 "
            "previous_grade 범위가 "
            f"잘못됐습니다: {previous_grade}"
        )

    if (
        previous_semester is not None
        and previous_semester not in (1, 2)
    ):
        raise ValueError(
            f"{row_number}행의 "
            "previous_semester는 "
            "1 또는 2여야 합니다: "
            f"{previous_semester}"
        )

    if (
        attribute_change_effective_year
        is not None
        and not (
            2000
            <= attribute_change_effective_year
            <= 2100
        )
    ):
        raise ValueError(
            f"{row_number}행의 "
            "attribute_change_effective_year "
            "범위가 잘못됐습니다: "
            f"{attribute_change_effective_year}"
        )

    has_previous_attribute = any(
        value is not None
        for value in (
            previous_credits,
            previous_completion_type,
            previous_grade,
            previous_semester,
        )
    )

    has_attribute_metadata = (
        attribute_change_effective_year
        is not None
        or attribute_change_note is not None
    )

    if (
        has_attribute_metadata
        and not has_previous_attribute
    ):
        raise ValueError(
            f"{row_number}행은 이전 속성 없이 "
            "attribute change metadata를 "
            "지정할 수 없습니다."
        )

    return CurriculumCourse(
        entry_year=entry_year,
        grade=grade,
        semester=semester,
        course_name=course_name,
        course_code=clean_optional_text(
            row["course_code"]
        ),
        completion_type=completion_type,
        credits=parse_optional_float(
            row["credits"]
        ),
        notes=clean_optional_text(
            row["notes"]
        ),
        change_group=change_group,
        change_type=change_type,
        change_role=change_role,
        change_effective_year=(
            change_effective_year
        ),
        change_note=change_note,
        previous_credits=previous_credits,
        previous_completion_type=(
            previous_completion_type
        ),
        previous_grade=previous_grade,
        previous_semester=previous_semester,
        attribute_change_effective_year=(
            attribute_change_effective_year
        ),
        attribute_change_note=(
            attribute_change_note
        ),
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

    duplicate_keys: set[
        tuple[
            int,
            int,
            str,
            str | None,
            str,
        ]
    ] = set()

    seen_keys: set[
        tuple[
            int,
            int,
            str,
            str | None,
            str,
        ]
    ] = set()

    for course in courses:
        key = (
            course.grade,
            course.semester,
            course.course_name,
            course.course_code,
            course.change_role,
        )

        if key in seen_keys:
            duplicate_keys.add(key)

        seen_keys.add(key)

    if duplicate_keys:
        raise ValueError(
            "중복 교육과정 과목이 있습니다: "
            f"{sorted(duplicate_keys)}"
        )

    change_groups: dict[
        str,
        list[CurriculumCourse],
    ] = {}

    for course in courses:
        if course.change_group is None:
            continue

        change_groups.setdefault(
            course.change_group,
            [],
        ).append(course)

    for (
        change_group,
        group_courses,
    ) in change_groups.items():
        change_types = {
            course.change_type
            for course in group_courses
        }

        if len(change_types) != 1:
            raise ValueError(
                f"변경 그룹 {change_group}의 "
                "change_type이 서로 다릅니다."
            )

        change_type = next(
            iter(change_types)
        )

        legacy_count = sum(
            course.change_role == "legacy"
            for course in group_courses
        )

        current_count = sum(
            course.change_role == "current"
            for course in group_courses
        )

        expected_shape = {
            "1:1": (
                legacy_count == 1
                and current_count == 1
            ),
            "1:N": (
                legacy_count == 1
                and current_count >= 2
            ),
            "N:1": (
                legacy_count >= 2
                and current_count == 1
            ),
            "N:M": (
                legacy_count >= 2
                and current_count >= 2
            ),
        }

        if not expected_shape.get(
            change_type,
            False,
        ):
            raise ValueError(
                f"변경 그룹 {change_group}의 "
                f"{change_type} 구성이 "
                "올바르지 않습니다. "
                f"legacy={legacy_count}, "
                f"current={current_count}"
            )

        effective_years = {
            course.change_effective_year
            for course in group_courses
        }

        if len(effective_years) != 1:
            raise ValueError(
                f"변경 그룹 {change_group}의 "
                "change_effective_year가 "
                "서로 다릅니다."
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
    )
    VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?
    )
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
            course.change_group,
            course.change_type,
            course.change_role,
            course.change_effective_year,
            course.change_note,
            course.previous_credits,
            course.previous_completion_type,
            course.previous_grade,
            course.previous_semester,
            course.attribute_change_effective_year,
            course.attribute_change_note,
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

# legacy 과목은 현재 과목 수와 전필·전선 학점 합계에서 제외

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
                COUNT(*) AS total_row_count,

                SUM(
                    CASE
                        WHEN change_role = 'current'
                        THEN 1
                        ELSE 0
                    END
                ) AS current_course_count,

                SUM(
                    CASE
                        WHEN change_role = 'legacy'
                        THEN 1
                        ELSE 0
                    END
                ) AS legacy_course_count,

                SUM(
                    CASE
                        WHEN
                            change_role = 'current'
                            AND completion_type = '전필'
                        THEN COALESCE(credits, 0)
                        ELSE 0
                    END
                ) AS required_credits,

                SUM(
                    CASE
                        WHEN
                            change_role = 'current'
                            AND completion_type = '전선'
                        THEN COALESCE(credits, 0)
                        ELSE 0
                    END
                ) AS elective_credits,

                SUM(
                    CASE
                        WHEN
                            change_role = 'current'
                            AND course_code IS NULL
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
    print(f"전체 행: {summary[0]}개")
    print(f"현재 과목: {summary[1]}개")
    print(f"변경 전 과목: {summary[2]}개")
    print(f"현재 전필 학점: {summary[3]:g}")
    print(
        f"현재 전선 개설학점: "
        f"{summary[4]:g}"
    )
    print(
        f"현재 과목 중 대표 학정번호 미지정: "
        f"{summary[5]}개"
    )
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
"""Insert a new curriculum cohort into PostgreSQL.

This script is intentionally insert-only.

It refuses to modify a cohort that already has rows in
PostgreSQL so that existing curriculum_course_id values are
not accidentally invalidated.

Run a dry run first:

    python scripts/import_curriculum_postgres.py \
        data/seed/curriculum_2022.csv \
        --project-ref PROJECT_REF

Then apply:

    python scripts/import_curriculum_postgres.py \
        data/seed/curriculum_2022.csv \
        --project-ref PROJECT_REF \
        --apply
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path
from urllib.parse import urlparse

import psycopg

from import_curriculum import (
    CurriculumCourse,
    load_csv,
)


INSERT_SQL = """
INSERT INTO public.curriculum_courses (
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
)
VALUES (
    %s, %s, %s, %s, %s,
    %s, %s, %s, %s, %s,
    %s, %s, %s
)
"""


REQUIRED_POSTGRES_COLUMNS = {
    "entry_year",
    "grade",
    "semester",
    "course_name",
    "course_code",
    "completion_type",
    "credits",
    "notes",
    "change_group",
    "change_type",
    "change_role",
    "change_effective_year",
    "change_note",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "새 학번 교육과정 CSV를 "
            "PostgreSQL에 신규 삽입합니다."
        )
    )

    parser.add_argument(
        "csv_path",
        type=Path,
        help="교육과정 CSV 경로",
    )

    parser.add_argument(
        "--project-ref",
        required=True,
        help=(
            "접속하려는 Supabase project ref. "
            "DATABASE_URL 검증에 사용합니다."
        ),
    )

    parser.add_argument(
        "--apply",
        action="store_true",
        help=(
            "실제로 DB에 반영합니다. "
            "생략하면 dry run만 수행합니다."
        ),
    )

    return parser.parse_args()


def get_database_url() -> str:
    database_url = os.environ.get(
        "DATABASE_URL",
        "",
    ).strip()

    if not database_url:
        raise RuntimeError(
            "DATABASE_URL 환경변수가 "
            "설정되어 있지 않습니다."
        )

    return database_url


def verify_project_ref(
    database_url: str,
    project_ref: str,
) -> None:
    normalized_project_ref = (
        project_ref.strip()
    )

    if not normalized_project_ref:
        raise ValueError(
            "project ref가 비어 있습니다."
        )

    if normalized_project_ref not in database_url:
        parsed_url = urlparse(database_url)

        raise RuntimeError(
            "DATABASE_URL이 지정한 Supabase "
            "project ref와 일치하지 않습니다.\n"
            f"요청 project ref: "
            f"{normalized_project_ref}\n"
            f"접속 host: "
            f"{parsed_url.hostname or '확인 불가'}\n"
            "다른 DB에 쓰는 것을 막기 위해 "
            "작업을 중단합니다."
        )


def verify_postgres_schema(
    connection: psycopg.Connection,
) -> None:
    rows = connection.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name =
              'curriculum_courses'
        """
    ).fetchall()

    actual_columns = {
        row[0]
        for row in rows
    }

    missing_columns = (
        REQUIRED_POSTGRES_COLUMNS
        - actual_columns
    )

    if missing_columns:
        raise RuntimeError(
            "PostgreSQL curriculum_courses에 "
            "필요한 컬럼이 없습니다: "
            f"{sorted(missing_columns)}"
        )


def summarize_courses(
    courses: list[CurriculumCourse],
) -> tuple[
    int,
    int,
    int,
    float,
    float,
]:
    current_courses = [
        course
        for course in courses
        if course.change_role == "current"
    ]

    legacy_courses = [
        course
        for course in courses
        if course.change_role == "legacy"
    ]

    required_credits = sum(
        course.credits or 0
        for course in current_courses
        if course.completion_type == "전필"
    )

    elective_credits = sum(
        course.credits or 0
        for course in current_courses
        if course.completion_type == "전선"
    )

    return (
        len(courses),
        len(current_courses),
        len(legacy_courses),
        required_credits,
        elective_credits,
    )


def create_insert_rows(
    courses: list[CurriculumCourse],
) -> list[tuple[object, ...]]:
    return [
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
        )
        for course in courses
    ]


def main() -> None:
    args = parse_args()

    csv_path = args.csv_path.resolve()

    if not csv_path.is_file():
        raise FileNotFoundError(
            f"CSV 파일을 찾을 수 없습니다: "
            f"{csv_path}"
        )

    courses = load_csv(csv_path)

    entry_year = courses[0].entry_year

    database_url = get_database_url()

    verify_project_ref(
        database_url,
        args.project_ref,
    )

    (
        total_count,
        current_count,
        legacy_count,
        required_credits,
        elective_credits,
    ) = summarize_courses(courses)

    parsed_url = urlparse(database_url)

    print()
    print("PostgreSQL curriculum import 계획")
    print(
        f"접속 host: "
        f"{parsed_url.hostname or '확인 불가'}"
    )
    print(f"대상 학번: {entry_year}")
    print(f"전체 행: {total_count}개")
    print(f"현재 과목: {current_count}개")
    print(f"변경 전 과목: {legacy_count}개")
    print(
        f"현재 전필 학점: "
        f"{required_credits:g}"
    )
    print(
        f"현재 전선 개설학점: "
        f"{elective_credits:g}"
    )

    with psycopg.connect(
        database_url,
    ) as connection:
        verify_postgres_schema(
            connection
        )

        existing_count = (
            connection.execute(
                """
                SELECT COUNT(*)
                FROM public.curriculum_courses
                WHERE entry_year = %s
                """,
                (entry_year,),
            ).fetchone()[0]
        )

        print(
            f"DB 기존 {entry_year}학번 행: "
            f"{existing_count}개"
        )

        if existing_count != 0:
            raise RuntimeError(
                f"PostgreSQL에 이미 "
                f"{entry_year}학번 교육과정이 "
                f"{existing_count}개 있습니다.\n"
                "이 스크립트는 신규 학번 "
                "insert 전용이므로 "
                "기존 데이터를 수정하지 않습니다."
            )

        if not args.apply:
            print()
            print(
                "DRY RUN 완료: "
                "DB에는 아무것도 쓰지 않았습니다."
            )
            print(
                "내용이 맞으면 --apply를 붙여 "
                "다시 실행하세요."
            )
            return

        with connection.cursor() as cursor:
            cursor.executemany(
                INSERT_SQL,
                create_insert_rows(courses),
            )

        inserted_count = (
            connection.execute(
                """
                SELECT COUNT(*)
                FROM public.curriculum_courses
                WHERE entry_year = %s
                """,
                (entry_year,),
            ).fetchone()[0]
        )

        if inserted_count != total_count:
            raise RuntimeError(
                "삽입 후 행 수가 예상과 다릅니다: "
                f"예상 {total_count}, "
                f"실제 {inserted_count}"
            )

    print()
    print(
        f"{entry_year}학번 PostgreSQL "
        "import 완료"
    )
    print(
        f"삽입 행: {total_count}개"
    )


if __name__ == "__main__":
    main()
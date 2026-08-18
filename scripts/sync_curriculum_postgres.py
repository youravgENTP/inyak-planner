"""Safely sync an existing curriculum cohort to PostgreSQL.

Existing curriculum row IDs are preserved whenever the course
already exists in PostgreSQL.

The script:
- updates matching existing rows in place
- inserts newly added rows
- refuses to delete PostgreSQL rows
- refuses ambiguous duplicate course codes
- runs as a dry run unless --apply is specified

Example:

    python scripts/sync_curriculum_postgres.py \
        data/seed/curriculum/curriculum_2023.csv \
        --project-ref PROJECT_REF

Apply:

    python scripts/sync_curriculum_postgres.py \
        data/seed/curriculum/curriculum_2023.csv \
        --project-ref PROJECT_REF \
        --apply
"""

from __future__ import annotations

import argparse
from dataclasses import asdict
from pathlib import Path
from typing import Any

import psycopg

from import_curriculum import (
    CurriculumCourse,
    load_csv,
)

from import_curriculum_postgres import (
    get_database_url,
    verify_postgres_schema,
    verify_project_ref,
)


SELECT_EXISTING_SQL = """
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
FROM public.curriculum_courses
WHERE entry_year = %s
ORDER BY id
"""


UPDATE_SQL = """
UPDATE public.curriculum_courses
SET
    grade = %s,
    semester = %s,
    course_name = %s,
    course_code = %s,
    completion_type = %s,
    credits = %s,
    notes = %s,
    change_group = %s,
    change_type = %s,
    change_role = %s,
    change_effective_year = %s,
    change_note = %s,
    previous_credits = %s,
    previous_completion_type = %s,
    previous_grade = %s,
    previous_semester = %s,
    attribute_change_effective_year = %s,
    attribute_change_note = %s
WHERE id = %s
"""


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
    change_note,
    previous_credits,
    previous_completion_type,
    previous_grade,
    previous_semester,
    attribute_change_effective_year,
    attribute_change_note
)
VALUES (
    %s, %s, %s, %s, %s,
    %s, %s, %s, %s, %s,
    %s, %s, %s, %s, %s,
    %s, %s, %s, %s
)
"""


COMPARISON_FIELDS = (
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
    "previous_credits",
    "previous_completion_type",
    "previous_grade",
    "previous_semester",
    "attribute_change_effective_year",
    "attribute_change_note",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "기존 학번 교육과정을 PostgreSQL에 "
            "ID 보존 방식으로 동기화합니다."
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


def normalize_course_code(
    course_code: str | None,
) -> str | None:
    if course_code is None:
        return None

    normalized = course_code.strip().upper()

    return normalized or None


def normalize_course_name(
    course_name: str,
) -> str:
    return " ".join(
        course_name.split()
    ).casefold()


def csv_key(
    course: CurriculumCourse,
) -> tuple[object, ...]:
    course_code = normalize_course_code(
        course.course_code
    )

    if course_code is not None:
        return (
            "course_code",
            course_code,
        )

    return (
        "fallback",
        course.grade,
        course.semester,
        normalize_course_name(
            course.course_name
        ),
    )


def db_key(
    row: dict[str, Any],
) -> tuple[object, ...]:
    course_code = normalize_course_code(
        row["course_code"]
    )

    if course_code is not None:
        return (
            "course_code",
            course_code,
        )

    return (
        "fallback",
        row["grade"],
        row["semester"],
        normalize_course_name(
            row["course_name"]
        ),
    )


def build_unique_csv_map(
    courses: list[CurriculumCourse],
) -> dict[
    tuple[object, ...],
    CurriculumCourse,
]:
    result: dict[
        tuple[object, ...],
        CurriculumCourse,
    ] = {}

    for course in courses:
        key = csv_key(course)

        if key in result:
            raise RuntimeError(
                "CSV에서 PostgreSQL sync 키가 "
                "중복됩니다: "
                f"{key}"
            )

        result[key] = course

    return result


def build_unique_db_map(
    rows: list[dict[str, Any]],
    courses: list[CurriculumCourse],
) -> dict[
    tuple[object, ...],
    dict[str, Any],
]:
    result: dict[
        tuple[object, ...],
        dict[str, Any],
    ] = {}

    for row in rows:
        key = db_key(row)

        # 기존 DB에는 학정번호가 없지만
        # CSV에 새로 학정번호가 확인된 경우,
        # 학년·학기·과목명이 정확히 일치하는
        # 단 하나의 과목에 한해 같은 행으로
        # 간주하여 기존 ID를 보존한다.
        if key[0] == "fallback":
            matches = [
                course
                for course in courses
                if (
                    course.grade
                    == row["grade"]
                    and course.semester
                    == row["semester"]
                    and normalize_course_name(
                        course.course_name
                    )
                    == normalize_course_name(
                        row["course_name"]
                    )
                )
            ]

            if len(matches) > 1:
                raise RuntimeError(
                    "학정번호가 없는 PostgreSQL "
                    "기존 행과 일치하는 CSV 과목이 "
                    "여러 개입니다: "
                    f"{key}"
                )

            if len(matches) == 1:
                matched_key = csv_key(
                    matches[0]
                )

                if (
                    matched_key[0]
                    == "course_code"
                ):
                    key = matched_key

        if key in result:
            raise RuntimeError(
                "PostgreSQL에서 sync 키가 "
                "중복됩니다: "
                f"{key}"
            )

        result[key] = row

    return result

def course_to_dict(
    course: CurriculumCourse,
) -> dict[str, Any]:
    return asdict(course)


def row_needs_update(
    existing: dict[str, Any],
    desired: CurriculumCourse,
) -> bool:
    desired_dict = course_to_dict(
        desired
    )

    return any(
        existing[field]
        != desired_dict[field]
        for field in COMPARISON_FIELDS
    )


def create_update_values(
    course: CurriculumCourse,
    row_id: int,
) -> tuple[object, ...]:
    return (
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
        row_id,
    )

def create_insert_values(
    course: CurriculumCourse,
) -> tuple[object, ...]:
    return (
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

def summarize_csv(
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
    ) = summarize_csv(courses)

    print()
    print("PostgreSQL curriculum sync 계획")
    print(f"대상 학번: {entry_year}")
    print(f"CSV 전체 행: {total_count}개")
    print(
        f"CSV 현재 과목: "
        f"{current_count}개"
    )
    print(
        f"CSV 변경 전 과목: "
        f"{legacy_count}개"
    )
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
        row_factory=psycopg.rows.dict_row,
    ) as connection:
        verify_postgres_schema(
            connection
        )

        existing_rows = [
            dict(row)
            for row in connection.execute(
                SELECT_EXISTING_SQL,
                (entry_year,),
            ).fetchall()
        ]

        if not existing_rows:
            raise RuntimeError(
                f"PostgreSQL에 {entry_year}학번 "
                "교육과정이 없습니다.\n"
                "신규 학번은 "
                "import_curriculum_postgres.py를 "
                "사용하세요."
            )

        csv_map = build_unique_csv_map(
            courses
        )

        db_map = build_unique_db_map(
            existing_rows,
            courses,
        )

        missing_from_csv = (
            db_map.keys()
            - csv_map.keys()
        )

        if missing_from_csv:
            raise RuntimeError(
                "PostgreSQL 기존 행 중 CSV에서 "
                "사라진 과목이 있습니다.\n"
                "이 sync 스크립트는 삭제를 "
                "자동 수행하지 않습니다.\n"
                f"누락 키: "
                f"{sorted(missing_from_csv)}"
            )

        update_plan: list[
            tuple[
                dict[str, Any],
                CurriculumCourse,
            ]
        ] = []

        insert_plan: list[
            CurriculumCourse
        ] = []

        unchanged_count = 0

        for key, desired in csv_map.items():
            existing = db_map.get(key)

            if existing is None:
                insert_plan.append(
                    desired
                )
                continue

            if row_needs_update(
                existing,
                desired,
            ):
                update_plan.append(
                    (
                        existing,
                        desired,
                    )
                )
            else:
                unchanged_count += 1

        print()
        print(
            f"DB 기존 행: "
            f"{len(existing_rows)}개"
        )
        print(
            f"변경 없음: "
            f"{unchanged_count}개"
        )
        print(
            f"기존 ID 유지 업데이트: "
            f"{len(update_plan)}개"
        )
        print(
            f"신규 삽입: "
            f"{len(insert_plan)}개"
        )
        print("삭제: 0개")

        if update_plan:
            print()
            print("업데이트 예정:")
            for (
                existing,
                desired,
            ) in update_plan:
                print(
                    "  "
                    f"id={existing['id']} "
                    f"{existing['course_code']} "
                    f"{existing['course_name']} "
                    f"{existing['change_role']} "
                    "-> "
                    f"{desired.change_role}"
                )

        if insert_plan:
            print()
            print("신규 삽입 예정:")
            for course in insert_plan:
                print(
                    "  "
                    f"{course.course_code} "
                    f"{course.course_name} "
                    f"[{course.change_role}]"
                )

        if not args.apply:
            connection.rollback()

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
            for (
                existing,
                desired,
            ) in update_plan:
                cursor.execute(
                    UPDATE_SQL,
                    create_update_values(
                        desired,
                        existing["id"],
                    ),
                )

            for course in insert_plan:
                cursor.execute(
                    INSERT_SQL,
                    create_insert_values(
                        course
                    ),
                )

        final_rows = [
            dict(row)
            for row in connection.execute(
                SELECT_EXISTING_SQL,
                (entry_year,),
            ).fetchall()
        ]

        if len(final_rows) != total_count:
            raise RuntimeError(
                "sync 후 PostgreSQL 행 수가 "
                "CSV와 다릅니다: "
                f"CSV={total_count}, "
                f"DB={len(final_rows)}"
            )

        final_current_count = sum(
            row["change_role"]
            == "current"
            for row in final_rows
        )

        final_legacy_count = sum(
            row["change_role"]
            == "legacy"
            for row in final_rows
        )

        if (
            final_current_count
            != current_count
            or final_legacy_count
            != legacy_count
        ):
            raise RuntimeError(
                "sync 후 current/legacy 수가 "
                "CSV와 다릅니다.\n"
                f"CSV current={current_count}, "
                f"legacy={legacy_count}\n"
                f"DB current="
                f"{final_current_count}, "
                f"legacy="
                f"{final_legacy_count}"
            )

    print()
    print(
        f"{entry_year}학번 PostgreSQL "
        "sync 완료"
    )
    print(
        f"기존 ID 유지 업데이트: "
        f"{len(update_plan)}개"
    )
    print(
        f"신규 삽입: "
        f"{len(insert_plan)}개"
    )


if __name__ == "__main__":
    main()
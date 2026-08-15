"""Import curriculum cohort data into PostgreSQL.

By default, the script only inserts a cohort that does not
already exist.

Use --replace explicitly when an existing cohort should be
replaced. Actual writes require --apply.

Run a dry run first:

    python scripts/import_curriculum_postgres.py \
        data/seed/curriculum_2024.csv \
        --project-ref PROJECT_REF \
        --replace

Then apply:

    python scripts/import_curriculum_postgres.py \
        data/seed/curriculum_2024.csv \
        --project-ref PROJECT_REF \
        --replace \
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

UPDATE_SQL = """
UPDATE public.curriculum_courses
SET
    entry_year = %s,
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
    "previous_credits",
    "previous_completion_type",
    "previous_grade",
    "previous_semester",
    "attribute_change_effective_year",
    "attribute_change_note",
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
        "--replace",
        action="store_true",
        help=(
            "해당 학번 데이터가 이미 있으면 "
            "기존 행을 삭제하고 교체합니다."
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
        (
            row["column_name"]
            if isinstance(row, dict)
            else row[0]
        )
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
            course.previous_credits,
            course.previous_completion_type,
            course.previous_grade,
            course.previous_semester,
            course.attribute_change_effective_year,
            course.attribute_change_note,
        )
        for course in courses
    ]

def normalize_course_code(
    course_code: str | None,
) -> str | None:
    if course_code is None:
        return None

    normalized = course_code.strip()

    return normalized or None


def plan_course_replace(
    connection: psycopg.Connection,
    courses: list[CurriculumCourse],
    entry_year: int,
) -> tuple[
    list[tuple[int, CurriculumCourse]],
    list[CurriculumCourse],
    list[int],
]:
    """
    기존 curriculum_courses의 id를 가능한 한
    그대로 유지하면서 CSV와 동기화할 계획을 만듭니다.

    매칭 우선순위:
    1. 동일 course_code
    2. 동일 course_name + change_role

    어느 쪽으로도 안전하게 대응되지 않는 CSV 과목만
    새 행으로 INSERT합니다.
    """

    rows = connection.execute(
        """
        SELECT
            id,
            course_name,
            course_code,
            change_role
        FROM public.curriculum_courses
        WHERE entry_year = %s
        ORDER BY id
        """,
        (entry_year,),
    ).fetchall()

    existing_rows: list[
        tuple[int, str, str | None, str]
    ] = [
        (
            int(row[0]),
            str(row[1]),
            normalize_course_code(
                row[2]
            ),
            str(row[3]),
        )
        for row in rows
    ]

    # CSV 내부에서 같은 학정번호가 여러 과목에
    # 사용되면 자동 매칭하기 위험하므로 중단합니다.
    incoming_codes = [
        normalize_course_code(
            course.course_code
        )
        for course in courses
        if normalize_course_code(
            course.course_code
        ) is not None
    ]

    duplicate_incoming_codes = {
        course_code
        for course_code in incoming_codes
        if incoming_codes.count(
            course_code
        ) > 1
    }

    if duplicate_incoming_codes:
        raise RuntimeError(
            "CSV에 중복 course_code가 있어 "
            "기존 ID를 안전하게 보존할 수 없습니다: "
            f"{sorted(duplicate_incoming_codes)}"
        )

    # 기존 DB의 course_code가 유일한 경우에만
    # 자동 매칭 대상으로 사용합니다.
    existing_ids_by_code: dict[
        str,
        list[int],
    ] = {}

    for (
        existing_id,
        _course_name,
        course_code,
        _change_role,
    ) in existing_rows:
        if course_code is None:
            continue

        existing_ids_by_code.setdefault(
            course_code,
            [],
        ).append(existing_id)

    unique_existing_id_by_code = {
        course_code: ids[0]
        for course_code, ids
        in existing_ids_by_code.items()
        if len(ids) == 1
    }

    # 학정번호가 바뀌었더라도
    # 과목명 + 역할이 유일하게 일치하면
    # 같은 과목으로 판단해 ID를 유지합니다.
    existing_ids_by_name_role: dict[
        tuple[str, str],
        list[int],
    ] = {}

    for (
        existing_id,
        course_name,
        _course_code,
        change_role,
    ) in existing_rows:
        key = (
            course_name.strip(),
            change_role,
        )

        existing_ids_by_name_role.setdefault(
            key,
            [],
        ).append(existing_id)

    unique_existing_id_by_name_role = {
        key: ids[0]
        for key, ids
        in existing_ids_by_name_role.items()
        if len(ids) == 1
    }

    update_pairs: list[
        tuple[int, CurriculumCourse]
    ] = []

    insert_courses: list[
        CurriculumCourse
    ] = []

    used_existing_ids: set[int] = set()

    for course in courses:
        existing_id: int | None = None

        course_code = normalize_course_code(
            course.course_code
        )

        if course_code is not None:
            candidate_id = (
                unique_existing_id_by_code.get(
                    course_code
                )
            )

            if (
                candidate_id is not None
                and candidate_id
                not in used_existing_ids
            ):
                existing_id = candidate_id

        if existing_id is None:
            fallback_key = (
                course.course_name.strip(),
                course.change_role,
            )

            candidate_id = (
                unique_existing_id_by_name_role.get(
                    fallback_key
                )
            )

            if (
                candidate_id is not None
                and candidate_id
                not in used_existing_ids
            ):
                existing_id = candidate_id

        if existing_id is None:
            insert_courses.append(
                course
            )
            continue

        used_existing_ids.add(
            existing_id
        )

        update_pairs.append(
            (
                existing_id,
                course,
            )
        )

    delete_ids = [
        existing_id
        for (
            existing_id,
            _course_name,
            _course_code,
            _change_role,
        ) in existing_rows
        if existing_id
        not in used_existing_ids
    ]

    return (
        update_pairs,
        insert_courses,
        delete_ids,
    )


def ensure_delete_ids_are_unreferenced(
    connection: psycopg.Connection,
    delete_ids: list[int],
) -> None:
    """
    CSV에서 사라진 curriculum row를 삭제하기 전에
    사용자 기록이 해당 id를 참조하고 있지 않은지 확인합니다.

    참조 중이면 DELETE하지 않고 전체 작업을 중단합니다.
    """

    if not delete_ids:
        return

    user_records_table = (
        connection.execute(
            """
            SELECT to_regclass(
                'public.user_course_records'
            )
            """
        ).fetchone()[0]
    )

    if user_records_table is None:
        return

    referenced_rows = (
        connection.execute(
            """
            SELECT
                curriculum_course_id,
                COUNT(*)
            FROM public.user_course_records
            WHERE curriculum_course_id
                = ANY(%s)
            GROUP BY curriculum_course_id
            ORDER BY curriculum_course_id
            """,
            (delete_ids,),
        ).fetchall()
    )

    if not referenced_rows:
        return

    details = ", ".join(
        (
            f"id={row[0]} "
            f"({row[1]}개 사용자 기록)"
        )
        for row in referenced_rows
    )

    raise RuntimeError(
        "CSV에서 삭제될 교육과정 과목을 "
        "사용자 기록이 참조하고 있습니다.\n"
        "고아 curriculum_course_id 생성을 막기 위해 "
        "작업을 중단합니다.\n"
        f"참조 중인 과목: {details}"
    )


def apply_course_replace(
    connection: psycopg.Connection,
    update_pairs: list[
        tuple[int, CurriculumCourse]
    ],
    insert_courses: list[
        CurriculumCourse
    ],
    delete_ids: list[int],
) -> None:
    with connection.cursor() as cursor:
        if update_pairs:
            update_rows = [
                (
                    *create_insert_rows(
                        [course]
                    )[0],
                    existing_id,
                )
                for (
                    existing_id,
                    course,
                ) in update_pairs
            ]

            cursor.executemany(
                UPDATE_SQL,
                update_rows,
            )

        if delete_ids:
            cursor.execute(
                """
                DELETE
                FROM public.curriculum_courses
                WHERE id = ANY(%s)
                """,
                (delete_ids,),
            )

        if insert_courses:
            cursor.executemany(
                INSERT_SQL,
                create_insert_rows(
                    insert_courses
                ),
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

        if (
            existing_count != 0
            and not args.replace
        ):
            raise RuntimeError(
                f"PostgreSQL에 이미 "
                f"{entry_year}학번 교육과정이 "
                f"{existing_count}개 있습니다.\n"
                "기존 학번을 교체하려면 "
                "--replace를 지정하세요."
            )

        update_pairs: list[
            tuple[
                int,
                CurriculumCourse,
            ]
        ] = []

        insert_courses: list[
            CurriculumCourse
        ] = courses

        delete_ids: list[int] = []

        if (
            existing_count != 0
            and args.replace
        ):
            (
                update_pairs,
                insert_courses,
                delete_ids,
            ) = plan_course_replace(
                connection,
                courses,
                entry_year,
            )

            ensure_delete_ids_are_unreferenced(
                connection,
                delete_ids,
            )

            print()
            print(
                "기존 ID 보존 동기화 계획"
            )
            print(
                f"  UPDATE: "
                f"{len(update_pairs)}개"
            )
            print(
                f"  INSERT: "
                f"{len(insert_courses)}개"
            )
            print(
                f"  DELETE: "
                f"{len(delete_ids)}개"
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

        if (
            existing_count != 0
            and args.replace
        ):
            apply_course_replace(
                connection,
                update_pairs,
                insert_courses,
                delete_ids,
            )

        else:
            with connection.cursor() as cursor:
                cursor.executemany(
                    INSERT_SQL,
                    create_insert_rows(
                        courses
                    ),
                )

        final_count = (
            connection.execute(
                """
                SELECT COUNT(*)
                FROM public.curriculum_courses
                WHERE entry_year = %s
                """,
                (entry_year,),
            ).fetchone()[0]
        )

        if final_count != total_count:
            raise RuntimeError(
                "동기화 후 행 수가 예상과 다릅니다: "
                f"예상 {total_count}, "
                f"실제 {final_count}"
            )

    print()
    print(
        f"{entry_year}학번 PostgreSQL "
        "import 완료"
    )
    print(
        f"최종 행: {total_count}개"
    )


if __name__ == "__main__":
    main()
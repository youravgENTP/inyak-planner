from __future__ import annotations

import sqlite3
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]

DATABASE_PATH = (
    PROJECT_ROOT
    / "data"
    / "db"
    / "inyak.db"
)


def connect_database() -> sqlite3.Connection:
    connection = sqlite3.connect(
        DATABASE_PATH
    )

    connection.row_factory = sqlite3.Row

    return connection


def load_curriculum_courses(
    connection: sqlite3.Connection,
) -> list[sqlite3.Row]:
    return connection.execute(
        """
        SELECT
            id,
            entry_year,
            grade,
            semester,
            course_code,
            course_name,
            credits
        FROM curriculum_courses
        ORDER BY
            entry_year,
            grade,
            semester,
            course_name
        """
    ).fetchall()


def load_available_terms(
    connection: sqlite3.Connection,
) -> set[tuple[int, int]]:
    rows = connection.execute(
        """
        SELECT DISTINCT
            academic_year,
            semester
        FROM courses
        ORDER BY
            academic_year,
            semester
        """
    ).fetchall()

    return {
        (
            row["academic_year"],
            row["semester"],
        )
        for row in rows
    }

def get_actual_academic_year(
    entry_year: int,
    grade: int,
) -> int:
    return entry_year + grade - 1

def find_actual_course_credits(
    connection: sqlite3.Connection,
    *,
    academic_year: int,
    semester: int,
    course_code: str | None,
) -> list[float]:
    if not course_code:
        return []

    rows = connection.execute(
        """
        SELECT DISTINCT
            credits
        FROM courses
        WHERE
            academic_year = ?
            AND semester = ?
            AND course_code = ?
            AND credits IS NOT NULL
        ORDER BY credits
        """,
        (
            academic_year,
            semester,
            course_code,
        ),
    ).fetchall()

    return [
        float(row["credits"])
        for row in rows
    ]

def find_name_candidates(
    connection: sqlite3.Connection,
    *,
    academic_year: int,
    semester: int,
    course_name: str,
) -> list[sqlite3.Row]:
    rows = connection.execute(
        """
        SELECT DISTINCT
            course_code,
            course_name,
            credits
        FROM courses
        WHERE
            academic_year = ?
            AND semester = ?
            AND (
                course_name = ?
                OR course_name LIKE ?
                OR ? LIKE '%' || course_name || '%'
            )
        ORDER BY
            course_name,
            course_code
        """,
        (
            academic_year,
            semester,
            course_name,
            f"%{course_name}%",
            course_name,
        ),
    ).fetchall()

    return rows


def find_year_name_candidates(
    connection: sqlite3.Connection,
    *,
    academic_year: int,
    course_name: str,
) -> list[sqlite3.Row]:
    rows = connection.execute(
        """
        SELECT DISTINCT
            semester,
            course_code,
            course_name,
            credits
        FROM courses
        WHERE
            academic_year = ?
            AND (
                course_name = ?
                OR course_name LIKE ?
                OR ? LIKE '%' || course_name || '%'
            )
        ORDER BY
            semester,
            course_name,
            course_code
        """,
        (
            academic_year,
            course_name,
            f"%{course_name}%",
            course_name,
        ),
    ).fetchall()

    return rows

def main() -> None:
    with connect_database() as connection:
        curriculum_courses = (
            load_curriculum_courses(
                connection
            )
        )

        available_terms = (
            load_available_terms(
                connection
            )
        )

        verifiable_count = 0
        unavailable_count = 0

        matched_count = 0
        mismatch_count = 0
        not_found_count = 0
        conflict_count = 0

        for course in curriculum_courses:
            actual_year = (
                get_actual_academic_year(
                    course["entry_year"],
                    course["grade"],
                )
            )

            actual_term = (
                actual_year,
                course["semester"],
            )

            if actual_term not in available_terms:
                unavailable_count += 1
                continue

            verifiable_count += 1

            actual_credits = (
                find_actual_course_credits(
                    connection,
                    academic_year=actual_year,
                    semester=course["semester"],
                    course_code=course["course_code"],
                )
            )

            curriculum_credits = (
                course["credits"]
            )

            if not actual_credits:
                not_found_count += 1

                name_candidates = (
                    find_name_candidates(
                        connection,
                        academic_year=actual_year,
                        semester=course["semester"],
                        course_name=course["course_name"],
                    )
                )

                year_name_candidates = (
                    find_year_name_candidates(
                        connection,
                        academic_year=actual_year,
                        course_name=course["course_name"],
                    )
                )

                other_semester_candidates = [
                    candidate
                    for candidate in year_name_candidates
                    if (
                        candidate["semester"]
                        != course["semester"]
                    )
                ]

                print()
                print(
                    "[NOT_FOUND]",
                    course["entry_year"],
                    f'{course["grade"]}-{course["semester"]}',
                    course["course_code"],
                    course["course_name"],
                    "교육과정:",
                    curriculum_credits,
                    f"실제 학기: {actual_year}-{course['semester']}",
                )

                if name_candidates:
                    print(
                        "  같은 학기 이름 기준 후보:"
                    )

                    for candidate in name_candidates:
                        print(
                            "   -",
                            candidate["course_code"],
                            candidate["course_name"],
                            f'{candidate["credits"]}학점',
                        )
                else:
                    print(
                        "  같은 학기 이름 기준 후보 없음"
                    )

                if other_semester_candidates:
                    print(
                        "  같은 학년도 다른 학기 후보:"
                    )

                    for candidate in (
                        other_semester_candidates
                    ):
                        print(
                            "   -",
                            f'{actual_year}-{candidate["semester"]}',
                            candidate["course_code"],
                            candidate["course_name"],
                            f'{candidate["credits"]}학점',
                        )
                else:
                    print(
                        "  같은 학년도 다른 학기 후보 없음"
                    )

                continue



            if len(actual_credits) > 1:
                conflict_count += 1

                print(
                    "[SECTION_CREDIT_CONFLICT]",
                    course["entry_year"],
                    f'{course["grade"]}-{course["semester"]}',
                    course["course_code"],
                    course["course_name"],
                    "교육과정:",
                    curriculum_credits,
                    "실제:",
                    actual_credits,
                )

                continue

            actual_credit = actual_credits[0]

            if (
                curriculum_credits is not None
                and float(curriculum_credits)
                == actual_credit
            ):
                matched_count += 1

            else:
                mismatch_count += 1

                print(
                    "[CREDIT_MISMATCH]",
                    course["entry_year"],
                    f'{course["grade"]}-{course["semester"]}',
                    course["course_code"],
                    course["course_name"],
                    "교육과정:",
                    curriculum_credits,
                    "실제:",
                    actual_credit,
                    f"({actual_year}-{course['semester']})",
                )

    print()
    print("=== 검증 결과 ===")

    print(
        "교육과정 과목 수:",
        len(curriculum_courses),
    )

    print(
        "현재 검증 가능:",
        verifiable_count,
    )

    print(
        "아직 검증 불가:",
        unavailable_count,
    )

    print(
        "학점 일치:",
        matched_count,
    )

    print(
        "학점 불일치:",
        mismatch_count,
    )

    print(
        "학정번호로 찾지 못함:",
        not_found_count,
    )

    print(
        "분반 간 학점 충돌:",
        conflict_count,
    )


if __name__ == "__main__":
    main()
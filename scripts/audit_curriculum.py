from __future__ import annotations
import re
import sqlite3
from pathlib import Path

from import_curriculum import (
    CurriculumCourse,
    load_csv,
)


PROJECT_ROOT = Path(__file__).resolve().parents[1]

SEED_DIR = (
    PROJECT_ROOT
    / "data"
    / "seed"
)

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


def load_curriculum_courses() -> list[CurriculumCourse]:
    csv_paths = sorted(
        SEED_DIR.glob(
            "curriculum_*.csv"
        )
    )

    if not csv_paths:
        raise RuntimeError(
            "교육과정 seed CSV를 찾을 수 없습니다: "
            f"{SEED_DIR}"
        )

    curriculum_courses: list[
        CurriculumCourse
    ] = []

    print(
        "교육과정 seed CSV:"
    )

    for csv_path in csv_paths:
        courses = load_csv(
            csv_path
        )

        curriculum_courses.extend(
            courses
        )

        entry_year = (
            courses[0].entry_year
        )

        print(
            " -",
            csv_path.name,
            f"({entry_year}학번, "
            f"{len(courses)}행)",
        )

    return curriculum_courses

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


def get_expected_grade(
    entry_year: int,
    academic_year: int,
) -> int:
    return academic_year - entry_year + 1


def normalize_course_code(
    course_code: str | None,
) -> str | None:
    if course_code is None:
        return None

    normalized = course_code.strip().upper()

    return normalized or None


def normalize_course_name(
    course_name: str | None,
) -> str:
    if course_name is None:
        return ""

    return re.sub(
        r"\s+",
        "",
        course_name.strip(),
    )


def get_course_code_prefix(
    course_code: str | None,
) -> str | None:
    normalized = normalize_course_code(
        course_code
    )

    if normalized is None:
        return None

    match = re.match(
        r"^[A-Z]+",
        normalized,
    )

    if match is None:
        return None

    return match.group(0)


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


def audit_curriculum_to_offerings(
    connection: sqlite3.Connection,
    curriculum_courses: list[sqlite3.Row],
    available_terms: set[tuple[int, int]],
) -> None:
    """
    정방향 검사.

    교육과정에 기록된 과목이
    해당 학생이 실제 그 학년에 도달하는 연도/학기에
    courses에 올바르게 존재하는지 확인한다.
    """

    verifiable_count = 0
    unavailable_count = 0

    matched_count = 0
    mismatch_count = 0
    not_found_count = 0
    conflict_count = 0

    print()
    print(
        "========================================"
    )
    print(
        "A. 교육과정 -> 실제 개설 이력"
    )
    print(
        "========================================"
    )

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
                for candidate
                in year_name_candidates
                if (
                    candidate["semester"]
                    != course["semester"]
                )
            ]

            print()
            print(
                "[NOT_FOUND]",
                course["entry_year"],
                (
                    f'{course["grade"]}-'
                    f'{course["semester"]}'
                ),
                course["course_code"],
                course["course_name"],
                "교육과정:",
                curriculum_credits,
                (
                    "실제 학기: "
                    f"{actual_year}-"
                    f'{course["semester"]}'
                ),
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
                        (
                            f'{candidate["credits"]}'
                            "학점"
                        ),
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
                        (
                            f'{actual_year}-'
                            f'{candidate["semester"]}'
                        ),
                        candidate["course_code"],
                        candidate["course_name"],
                        (
                            f'{candidate["credits"]}'
                            "학점"
                        ),
                    )
            else:
                print(
                    "  같은 학년도 다른 학기 후보 없음"
                )

            continue

        if len(actual_credits) > 1:
            conflict_count += 1

            print()
            print(
                "[SECTION_CREDIT_CONFLICT]",
                course["entry_year"],
                (
                    f'{course["grade"]}-'
                    f'{course["semester"]}'
                ),
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

            print()
            print(
                "[CREDIT_MISMATCH]",
                course["entry_year"],
                (
                    f'{course["grade"]}-'
                    f'{course["semester"]}'
                ),
                course["course_code"],
                course["course_name"],
                "교육과정:",
                curriculum_credits,
                "실제:",
                actual_credit,
                (
                    f"({actual_year}-"
                    f'{course["semester"]})'
                ),
            )

    print()
    print(
        "--- 정방향 검증 결과 ---"
    )
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


def get_curriculum_prefixes(
    curriculum_courses: list[sqlite3.Row],
) -> set[str]:
    prefixes: set[str] = set()

    for course in curriculum_courses:
        prefix = get_course_code_prefix(
            course["course_code"]
        )

        if prefix is not None:
            prefixes.add(prefix)

    return prefixes


def load_relevant_offerings(
    connection: sqlite3.Connection,
    curriculum_prefixes: set[str],
) -> list[sqlite3.Row]:
    """
    교육과정에 등장하는 학정번호 prefix와 같은
    실제 개설 과목만 역방향 audit 대상으로 삼는다.

    현재 데이터라면 ADA / ADB 계열이 자연스럽게
    대상이 된다.
    """

    rows = connection.execute(
        """
        SELECT DISTINCT
            academic_year,
            semester,
            course_code,
            course_name,
            credits
        FROM courses
        WHERE course_code IS NOT NULL
        ORDER BY
            academic_year,
            semester,
            course_code,
            course_name,
            credits
        """
    ).fetchall()

    relevant_rows: list[sqlite3.Row] = []

    for row in rows:
        prefix = get_course_code_prefix(
            row["course_code"]
        )

        if (
            prefix is not None
            and prefix in curriculum_prefixes
        ):
            relevant_rows.append(row)

    return relevant_rows


def get_active_cohorts(
    curriculum_courses: list[sqlite3.Row],
    *,
    academic_year: int,
) -> list[tuple[int, int]]:
    """
    해당 실제 학년도에 1~6학년에 해당하는
    교육과정 cohort만 반환한다.

    반환:
        [(entry_year, expected_grade), ...]
    """

    entry_years = sorted(
        {
            int(course["entry_year"])
            for course in curriculum_courses
        }
    )

    active_cohorts: list[
        tuple[int, int]
    ] = []

    for entry_year in entry_years:
        grade = get_expected_grade(
            entry_year,
            academic_year,
        )

        if 1 <= grade <= 6:
            active_cohorts.append(
                (
                    entry_year,
                    grade,
                )
            )

    return active_cohorts


def exact_reverse_matches(
    curriculum_courses: list[sqlite3.Row],
    *,
    entry_year: int,
    grade: int,
    semester: int,
    course_code: str,
) -> list[sqlite3.Row]:
    normalized_code = normalize_course_code(
        course_code
    )

    return [
        course
        for course in curriculum_courses
        if (
            int(course["entry_year"])
            == entry_year
            and int(course["grade"])
            == grade
            and int(course["semester"])
            == semester
            and normalize_course_code(
                course["course_code"]
            )
            == normalized_code
        )
    ]


def same_code_other_position_matches(
    curriculum_courses: list[sqlite3.Row],
    *,
    entry_year: int,
    grade: int,
    semester: int,
    course_code: str,
) -> list[sqlite3.Row]:
    normalized_code = normalize_course_code(
        course_code
    )

    return [
        course
        for course in curriculum_courses
        if (
            int(course["entry_year"])
            == entry_year
            and normalize_course_code(
                course["course_code"]
            )
            == normalized_code
            and (
                int(course["grade"])
                != grade
                or int(course["semester"])
                != semester
            )
        )
    ]


def same_name_expected_position_matches(
    curriculum_courses: list[sqlite3.Row],
    *,
    entry_year: int,
    grade: int,
    semester: int,
    course_name: str,
    course_code: str,
) -> list[sqlite3.Row]:
    normalized_name = normalize_course_name(
        course_name
    )

    normalized_code = normalize_course_code(
        course_code
    )

    if not normalized_name:
        return []

    return [
        course
        for course in curriculum_courses
        if (
            int(course["entry_year"])
            == entry_year
            and int(course["grade"])
            == grade
            and int(course["semester"])
            == semester
            and normalize_course_name(
                course["course_name"]
            )
            == normalized_name
            and normalize_course_code(
                course["course_code"]
            )
            != normalized_code
        )
    ]


def same_name_any_position_matches(
    curriculum_courses: list[sqlite3.Row],
    *,
    entry_year: int,
    course_name: str,
    course_code: str,
) -> list[sqlite3.Row]:
    normalized_name = normalize_course_name(
        course_name
    )

    normalized_code = normalize_course_code(
        course_code
    )

    if not normalized_name:
        return []

    return [
        course
        for course in curriculum_courses
        if (
            int(course["entry_year"])
            == entry_year
            and normalize_course_name(
                course["course_name"]
            )
            == normalized_name
            and normalize_course_code(
                course["course_code"]
            )
            != normalized_code
        )
    ]


def print_curriculum_candidate(
    *,
    entry_year: int,
    course: sqlite3.Row,
) -> None:
    print(
        "   -",
        (
            f"{entry_year}학번 "
            f'{course["grade"]}-'
            f'{course["semester"]}'
        ),
        course["course_code"],
        course["course_name"],
        (
            f'{course["credits"]}'
            "학점"
        ),
        (
            f'role={course["change_role"]}'
            if course["change_role"]
            else ""
        ),
    )


def audit_offerings_to_curriculum(
    connection: sqlite3.Connection,
    curriculum_courses: list[sqlite3.Row],
) -> None:
    """
    역방향 검사.

    실제 개설된 전공계열 과목이 해당 연도에
    재학 중인 어느 cohort의 교육과정으로
    설명 가능한지 확인한다.
    """

    curriculum_prefixes = (
        get_curriculum_prefixes(
            curriculum_courses
        )
    )

    offerings = load_relevant_offerings(
        connection,
        curriculum_prefixes,
    )

    mapped_count = 0
    moved_candidate_count = 0
    code_changed_candidate_count = 0
    unmapped_count = 0

    print()
    print(
        "========================================"
    )
    print(
        "B. 실제 개설 이력 -> 교육과정"
    )
    print(
        "========================================"
    )

    print(
        "검사 학정번호 prefix:",
        ", ".join(
            sorted(curriculum_prefixes)
        ),
    )

    for offering in offerings:
        academic_year = int(
            offering["academic_year"]
        )

        semester = int(
            offering["semester"]
        )

        course_code = (
            offering["course_code"]
        )

        course_name = (
            offering["course_name"]
        )

        active_cohorts = (
            get_active_cohorts(
                curriculum_courses,
                academic_year=academic_year,
            )
        )

        if not active_cohorts:
            continue

        exact_matches: list[
            tuple[int, sqlite3.Row]
        ] = []

        moved_matches: list[
            tuple[int, sqlite3.Row]
        ] = []

        code_changed_matches: list[
            tuple[int, sqlite3.Row]
        ] = []

        name_other_position_matches: list[
            tuple[int, sqlite3.Row]
        ] = []

        for (
            entry_year,
            expected_grade,
        ) in active_cohorts:
            exact = exact_reverse_matches(
                curriculum_courses,
                entry_year=entry_year,
                grade=expected_grade,
                semester=semester,
                course_code=course_code,
            )

            for course in exact:
                exact_matches.append(
                    (
                        entry_year,
                        course,
                    )
                )

            moved = (
                same_code_other_position_matches(
                    curriculum_courses,
                    entry_year=entry_year,
                    grade=expected_grade,
                    semester=semester,
                    course_code=course_code,
                )
            )

            for course in moved:
                moved_matches.append(
                    (
                        entry_year,
                        course,
                    )
                )

            changed = (
                same_name_expected_position_matches(
                    curriculum_courses,
                    entry_year=entry_year,
                    grade=expected_grade,
                    semester=semester,
                    course_name=course_name,
                    course_code=course_code,
                )
            )

            for course in changed:
                code_changed_matches.append(
                    (
                        entry_year,
                        course,
                    )
                )

            other_name = (
                same_name_any_position_matches(
                    curriculum_courses,
                    entry_year=entry_year,
                    course_name=course_name,
                    course_code=course_code,
                )
            )

            for course in other_name:
                name_other_position_matches.append(
                    (
                        entry_year,
                        course,
                    )
                )

        if exact_matches:
            mapped_count += 1
            continue

        if moved_matches:
            moved_candidate_count += 1

            print()
            print(
                "[TERM_OR_GRADE_MOVED_CANDIDATE]",
                (
                    f"{academic_year}-"
                    f"{semester}"
                ),
                course_code,
                course_name,
                (
                    f'{offering["credits"]}'
                    "학점"
                ),
            )

            print(
                "  동일 학정번호 교육과정 후보:"
            )

            for (
                entry_year,
                candidate,
            ) in moved_matches:
                print_curriculum_candidate(
                    entry_year=entry_year,
                    course=candidate,
                )

            continue

        if code_changed_matches:
            code_changed_candidate_count += 1

            print()
            print(
                "[CODE_CHANGED_CANDIDATE]",
                (
                    f"{academic_year}-"
                    f"{semester}"
                ),
                course_code,
                course_name,
                (
                    f'{offering["credits"]}'
                    "학점"
                ),
            )

            print(
                "  같은 학년·학기 동일명 후보:"
            )

            for (
                entry_year,
                candidate,
            ) in code_changed_matches:
                print_curriculum_candidate(
                    entry_year=entry_year,
                    course=candidate,
                )

            continue

        if name_other_position_matches:
            moved_candidate_count += 1

            print()
            print(
                "[CODE_AND_POSITION_CHANGED_CANDIDATE]",
                (
                    f"{academic_year}-"
                    f"{semester}"
                ),
                course_code,
                course_name,
                (
                    f'{offering["credits"]}'
                    "학점"
                ),
            )

            print(
                "  동일명 교육과정 후보:"
            )

            for (
                entry_year,
                candidate,
            ) in name_other_position_matches:
                print_curriculum_candidate(
                    entry_year=entry_year,
                    course=candidate,
                )

            continue

        unmapped_count += 1

        print()
        print(
            "[UNMAPPED_OFFERING]",
            (
                f"{academic_year}-"
                f"{semester}"
            ),
            course_code,
            course_name,
            (
                f'{offering["credits"]}'
                "학점"
            ),
        )

        print(
            "  해당 학년도 재학 cohort의 "
            "교육과정에서 대응 후보 없음"
        )

    print()
    print(
        "--- 역방향 검증 결과 ---"
    )

    print(
        "검사 대상 실제 개설 과목:",
        len(offerings),
    )

    print(
        "교육과정 정확 대응:",
        mapped_count,
    )

    print(
        "학년/학기 이동 후보:",
        moved_candidate_count,
    )

    print(
        "학정번호 변경 후보:",
        code_changed_candidate_count,
    )

    print(
        "교육과정 미매핑:",
        unmapped_count,
    )


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

        audit_curriculum_to_offerings(
            connection,
            curriculum_courses,
            available_terms,
        )

        audit_offerings_to_curriculum(
            connection,
            curriculum_courses,
        )


if __name__ == "__main__":
    main()
from __future__ import annotations

import argparse
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


# ============================================================
# 교육과정 seed CSV
# ============================================================

def load_curriculum_courses(
    entry_year: int | None = None,
) -> list[CurriculumCourse]:
    if entry_year is None:
        csv_paths = sorted(
            SEED_DIR.glob(
                "curriculum_*.csv"
            )
        )
    else:
        csv_path = (
            SEED_DIR
            / f"curriculum_{entry_year}.csv"
        )

        if not csv_path.exists():
            raise RuntimeError(
                "해당 학번의 교육과정 seed CSV를 "
                "찾을 수 없습니다: "
                f"{csv_path}"
            )

        csv_paths = [
            csv_path
        ]

    if not csv_paths:
        raise RuntimeError(
            "교육과정 seed CSV를 찾을 수 없습니다: "
            f"{SEED_DIR}"
        )

    curriculum_courses: list[
        CurriculumCourse
    ] = []

    print("교육과정 seed CSV:")

    for csv_path in csv_paths:
        courses = load_csv(
            csv_path
        )

        curriculum_courses.extend(
            courses
        )

        loaded_entry_year = (
            courses[0].entry_year
        )

        print(
            " -",
            csv_path.name,
            (
                f"({loaded_entry_year}학번, "
                f"{len(courses)}행)"
            ),
        )

    print(
        "교육과정 총 행:",
        len(curriculum_courses),
    )

    return curriculum_courses


# ============================================================
# 실제 개설 이력
# ============================================================


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
            int(row["academic_year"]),
            int(row["semester"]),
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

    normalized = (
        course_code
        .strip()
        .upper()
    )

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
    recommended_year: int,
    course_code: str | None,
) -> list[float]:
    course_code = normalize_course_code(
        course_code
    )

    if course_code is None:
        return []

    rows = connection.execute(
        """
        SELECT DISTINCT
            credits
        FROM courses
        WHERE
            academic_year = ?
            AND semester = ?
            AND recommended_year = ?
            AND UPPER(TRIM(course_code)) = ?
            AND credits IS NOT NULL
        ORDER BY credits
        """,
        (
            academic_year,
            semester,
            recommended_year,
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
    recommended_year: int,
    course_name: str,
) -> list[sqlite3.Row]:
    return connection.execute(
        """
        SELECT DISTINCT
            course_code,
            course_name,
            credits
        FROM courses
        WHERE
            academic_year = ?
            AND semester = ?
            AND recommended_year = ?
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
            recommended_year,
            course_name,
            f"%{course_name}%",
            course_name,
        ),
    ).fetchall()


def find_year_name_candidates(
    connection: sqlite3.Connection,
    *,
    academic_year: int,
    recommended_year: int,
    course_name: str,
) -> list[sqlite3.Row]:
    return connection.execute(
        """
        SELECT DISTINCT
            semester,
            course_code,
            course_name,
            credits
        FROM courses
        WHERE
            academic_year = ?
            AND recommended_year = ?
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
            recommended_year,
            course_name,
            f"%{course_name}%",
            course_name,
        ),
    ).fetchall()

def find_other_grade_code_candidates(
    connection: sqlite3.Connection,
    *,
    academic_year: int,
    expected_grade: int,
    course_code: str | None,
) -> list[sqlite3.Row]:
    course_code = normalize_course_code(
        course_code
    )

    if course_code is None:
        return []

    return connection.execute(
        """
        SELECT DISTINCT
            semester,
            recommended_year,
            course_code,
            course_name,
            credits,
            completion_type
        FROM courses
        WHERE
            academic_year = ?
            AND recommended_year IS NOT NULL
            AND recommended_year != ?
            AND UPPER(TRIM(course_code)) = ?
        ORDER BY
            recommended_year,
            semester,
            course_name,
            credits
        """,
        (
            academic_year,
            expected_grade,
            course_code,
        ),
    ).fetchall()


# ============================================================
# A. 교육과정 -> 실제 개설 이력
# ============================================================


def audit_curriculum_to_offerings(
    connection: sqlite3.Connection,
    curriculum_courses: list[CurriculumCourse],
    available_terms: set[tuple[int, int]],
) -> None:
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
                course.entry_year,
                course.grade,
            )
        )

        actual_term = (
            actual_year,
            course.semester,
        )

        if actual_term not in available_terms:
            unavailable_count += 1
            continue

        verifiable_count += 1

        actual_credits = (
            find_actual_course_credits(
                connection,
                academic_year=actual_year,
                semester=course.semester,
                recommended_year=course.grade,
                course_code=course.course_code,
            )
        )

        curriculum_credits = (
            course.credits
        )

        if not actual_credits:
            not_found_count += 1

            name_candidates = (
                find_name_candidates(
                    connection,
                    academic_year=actual_year,
                    semester=course.semester,
                    recommended_year=course.grade,
                    course_name=course.course_name,
                )
            )

            year_name_candidates = (
                find_year_name_candidates(
                    connection,
                    academic_year=actual_year,
                    recommended_year=course.grade,
                    course_name=course.course_name,
                )
            )

            other_semester_candidates = [
                candidate
                for candidate
                in year_name_candidates
                if (
                    int(candidate["semester"])
                    != course.semester
                )
            ]

            print()
            print(
                "[NOT_FOUND]",
                course.entry_year,
                (
                    f"{course.grade}-"
                    f"{course.semester}"
                ),
                course.course_code,
                course.course_name,
                "교육과정:",
                curriculum_credits,
                (
                    "실제 학기: "
                    f"{actual_year}-"
                    f"{course.semester}"
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
                            f"{actual_year}-"
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

            other_grade_candidates = (
                find_other_grade_code_candidates(
                    connection,
                    academic_year=actual_year,
                    expected_grade=course.grade,
                    course_code=course.course_code,
                )
            )

            if other_grade_candidates:
                print(
                    "  다른 권장학년 동일 학정번호 개설:"
                )

                for candidate in (
                    other_grade_candidates
                ):
                    print(
                        "   -",
                        (
                            f"{actual_year}-"
                            f'{candidate["semester"]}'
                        ),
                        (
                            f'{candidate["recommended_year"]}'
                            "학년"
                        ),
                        candidate["course_code"],
                        candidate["course_name"],
                        (
                            f'{candidate["credits"]}'
                            "학점"
                        ),
                        (
                            candidate["completion_type"]
                            or ""
                        ),
                    )
            else:
                print(
                    "  다른 권장학년 동일 학정번호 개설 없음"
                )

            continue

        if len(actual_credits) > 1:
            conflict_count += 1

            print()
            print(
                "[SECTION_CREDIT_CONFLICT]",
                course.entry_year,
                (
                    f"{course.grade}-"
                    f"{course.semester}"
                ),
                course.course_code,
                course.course_name,
                "교육과정:",
                curriculum_credits,
                "실제:",
                actual_credits,
            )

            continue

        actual_credit = (
            actual_credits[0]
        )

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
                course.entry_year,
                (
                    f"{course.grade}-"
                    f"{course.semester}"
                ),
                course.course_code,
                course.course_name,
                "교육과정:",
                curriculum_credits,
                "실제:",
                actual_credit,
                (
                    f"({actual_year}-"
                    f"{course.semester})"
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


# ============================================================
# B. 실제 개설 이력 -> 교육과정
# ============================================================


def get_curriculum_prefixes(
    curriculum_courses: list[CurriculumCourse],
) -> set[str]:
    prefixes: set[str] = set()

    for course in curriculum_courses:
        prefix = get_course_code_prefix(
            course.course_code
        )

        if prefix is not None:
            prefixes.add(prefix)

    return prefixes

def load_relevant_offerings(
    connection: sqlite3.Connection,
    curriculum_prefixes: set[str],
) -> list[sqlite3.Row]:
    rows = connection.execute(
        """
        SELECT DISTINCT
            academic_year,
            semester,
            course_code,
            course_name,
            credits,
            completion_type,
            recommended_year
        FROM courses
        WHERE
            course_code IS NOT NULL
            AND recommended_year IS NOT NULL
        ORDER BY
            academic_year,
            semester,
            recommended_year,
            course_code,
            course_name,
            credits
        """
    ).fetchall()

    relevant_rows: list[
        sqlite3.Row
    ] = []

    for row in rows:
        prefix = get_course_code_prefix(
            row["course_code"]
        )

        if (
            prefix is not None
            and prefix in curriculum_prefixes
        ):
            relevant_rows.append(
                row
            )

    return relevant_rows


def get_active_cohorts(
    curriculum_courses: list[CurriculumCourse],
    *,
    academic_year: int,
) -> list[tuple[int, int]]:
    entry_years = sorted(
        {
            course.entry_year
            for course
            in curriculum_courses
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
    curriculum_courses: list[CurriculumCourse],
    *,
    entry_year: int,
    grade: int,
    semester: int,
    course_code: str,
) -> list[CurriculumCourse]:
    normalized_code = (
        normalize_course_code(
            course_code
        )
    )

    return [
        course
        for course in curriculum_courses
        if (
            course.entry_year
            == entry_year
            and course.grade
            == grade
            and course.semester
            == semester
            and normalize_course_code(
                course.course_code
            )
            == normalized_code
        )
    ]


def same_code_other_position_matches(
    curriculum_courses: list[CurriculumCourse],
    *,
    entry_year: int,
    grade: int,
    semester: int,
    course_code: str,
) -> list[CurriculumCourse]:
    normalized_code = (
        normalize_course_code(
            course_code
        )
    )

    return [
        course
        for course in curriculum_courses
        if (
            course.entry_year
            == entry_year
            and normalize_course_code(
                course.course_code
            )
            == normalized_code
            and (
                course.grade != grade
                or course.semester
                != semester
            )
        )
    ]


def same_name_expected_position_matches(
    curriculum_courses: list[CurriculumCourse],
    *,
    entry_year: int,
    grade: int,
    semester: int,
    course_name: str,
    course_code: str,
) -> list[CurriculumCourse]:
    normalized_name = (
        normalize_course_name(
            course_name
        )
    )

    normalized_code = (
        normalize_course_code(
            course_code
        )
    )

    if not normalized_name:
        return []

    return [
        course
        for course in curriculum_courses
        if (
            course.entry_year
            == entry_year
            and course.grade
            == grade
            and course.semester
            == semester
            and normalize_course_name(
                course.course_name
            )
            == normalized_name
            and normalize_course_code(
                course.course_code
            )
            != normalized_code
        )
    ]


def same_name_any_position_matches(
    curriculum_courses: list[CurriculumCourse],
    *,
    entry_year: int,
    course_name: str,
    course_code: str,
) -> list[CurriculumCourse]:
    normalized_name = (
        normalize_course_name(
            course_name
        )
    )

    normalized_code = (
        normalize_course_code(
            course_code
        )
    )

    if not normalized_name:
        return []

    return [
        course
        for course in curriculum_courses
        if (
            course.entry_year
            == entry_year
            and normalize_course_name(
                course.course_name
            )
            == normalized_name
            and normalize_course_code(
                course.course_code
            )
            != normalized_code
        )
    ]


def print_curriculum_candidate(
    *,
    entry_year: int,
    course: CurriculumCourse,
) -> None:
    print(
        "   -",
        (
            f"{entry_year}학번 "
            f"{course.grade}-"
            f"{course.semester}"
        ),
        course.course_code,
        course.course_name,
        (
            f"{course.credits}"
            "학점"
        ),
        (
            f"role={course.change_role}"
            if course.change_role
            else ""
        ),
    )

def get_attribute_changes(
    *,
    candidate: CurriculumCourse,
    actual_grade: int,
    actual_semester: int,
    actual_credits: float | None,
    actual_completion_type: str | None,
) -> list[str]:
    changes: list[str] = []

    if candidate.grade != actual_grade:
        changes.append(
            "grade: "
            f"{candidate.grade} → "
            f"{actual_grade}"
        )

    if candidate.semester != actual_semester:
        changes.append(
            "semester: "
            f"{candidate.semester} → "
            f"{actual_semester}"
        )

    curriculum_credits = (
        candidate.credits
    )

    credits_changed = False

    if (
        curriculum_credits is None
        and actual_credits is not None
    ):
        credits_changed = True

    elif (
        curriculum_credits is not None
        and actual_credits is None
    ):
        credits_changed = True

    elif (
        curriculum_credits is not None
        and actual_credits is not None
        and float(curriculum_credits)
        != float(actual_credits)
    ):
        credits_changed = True

    if credits_changed:
        changes.append(
            "credits: "
            f"{curriculum_credits} → "
            f"{actual_credits}"
        )

    if (
        candidate.completion_type
        != actual_completion_type
    ):
        changes.append(
            "completion_type: "
            f"{candidate.completion_type} → "
            f"{actual_completion_type}"
        )

    return changes


def audit_offerings_to_curriculum(
    connection: sqlite3.Connection,
    curriculum_courses: list[CurriculumCourse],
) -> None:
    curriculum_prefixes = (
        get_curriculum_prefixes(
            curriculum_courses
        )
    )

    offerings = (
        load_relevant_offerings(
            connection,
            curriculum_prefixes,
        )
    )

    audited_count = 0
    mapped_count = 0
    attribute_changed_count = 0
    moved_candidate_count = 0
    code_changed_candidate_count = 0
    code_and_position_changed_count = 0
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
            sorted(
                curriculum_prefixes
            )
        ),
    )

    for offering in offerings:
        academic_year = int(
            offering["academic_year"]
        )

        semester = int(
            offering["semester"]
        )

        course_code = str(
            offering["course_code"]
        )

        course_name = str(
            offering["course_name"]
        )

        recommended_year = int(
            offering["recommended_year"]
        )

        active_cohorts = [
            (
                entry_year,
                expected_grade,
            )
            for (
                entry_year,
                expected_grade,
            ) in get_active_cohorts(
                curriculum_courses,
                academic_year=academic_year,
            )
            if (
                expected_grade
                == recommended_year
            )
        ]

        if not active_cohorts:
            continue

        audited_count += 1

        exact_matches: list[
            tuple[
                int,
                CurriculumCourse,
            ]
        ] = []

        moved_matches: list[
            tuple[
                int,
                CurriculumCourse,
            ]
        ] = []

        code_changed_matches: list[
            tuple[
                int,
                CurriculumCourse,
            ]
        ] = []

        name_other_position_matches: list[
            tuple[
                int,
                CurriculumCourse,
            ]
        ] = []

        for (
            entry_year,
            expected_grade,
        ) in active_cohorts:
            exact = (
                exact_reverse_matches(
                    curriculum_courses,
                    entry_year=entry_year,
                    grade=expected_grade,
                    semester=semester,
                    course_code=course_code,
                )
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

        # 학정번호·학년·학기가 모두 같아도
        # 학점이나 이수구분이 달라졌을 수 있다.
        if exact_matches:
            exact_attribute_changes: list[
                tuple[
                    int,
                    CurriculumCourse,
                    list[str],
                ]
            ] = []

            has_fully_exact_match = False

            for (
                entry_year,
                candidate,
            ) in exact_matches:
                changes = (
                    get_attribute_changes(
                        candidate=candidate,
                        actual_grade=recommended_year,
                        actual_semester=semester,
                        actual_credits=offering["credits"],
                        actual_completion_type=(
                            offering["completion_type"]
                        ),
                    )
                )

                if changes:
                    exact_attribute_changes.append(
                        (
                            entry_year,
                            candidate,
                            changes,
                        )
                    )
                else:
                    has_fully_exact_match = True

            if has_fully_exact_match:
                mapped_count += 1
                continue

            attribute_changed_count += 1

            print()
            print(
                "[ATTRIBUTE_CHANGED_CANDIDATE]",
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

            for (
                entry_year,
                candidate,
                changes,
            ) in exact_attribute_changes:
                print(
                    "  교육과정 후보:"
                )

                print_curriculum_candidate(
                    entry_year=entry_year,
                    course=candidate,
                )

                print(
                    "  변경:"
                )

                for change in changes:
                    print(
                        "   -",
                        change,
                    )

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

            for (
                entry_year,
                candidate,
            ) in moved_matches:
                changes = (
                    get_attribute_changes(
                        candidate=candidate,
                        actual_grade=recommended_year,
                        actual_semester=semester,
                        actual_credits=offering["credits"],
                        actual_completion_type=(
                            offering["completion_type"]
                        ),
                    )
                )

                print(
                    "  교육과정 후보:"
                )

                print_curriculum_candidate(
                    entry_year=entry_year,
                    course=candidate,
                )

                print(
                    "  변경:"
                )

                for change in changes:
                    print(
                        "   -",
                        change,
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
            code_and_position_changed_count += 1

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
        audited_count,
    )
    print(
        "교육과정 정확 대응:",
        mapped_count,
    )
    print(
        "속성 변경 후보:",
        attribute_changed_count,
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
        "학정번호+위치 변경 후보:",
        code_and_position_changed_count,
    )
    print(
        "교육과정 미매핑:",
        unmapped_count,
    )


# ============================================================
# Main
# ============================================================

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "교육과정 seed CSV와 실제 개설 이력을 "
            "양방향으로 검증합니다."
        )
    )

    parser.add_argument(
        "--entry-year",
        type=int,
        help=(
            "특정 입학년도만 검증합니다. "
            "예: --entry-year 2023. "
            "생략하면 모든 curriculum_*.csv를 검증합니다."
        ),
    )

    return parser.parse_args()


def main() -> None:
    args = parse_args()

    curriculum_courses = (
        load_curriculum_courses(
            entry_year=args.entry_year,
        )
    )

    if args.entry_year is None:
        print(
            "검증 범위: 전체 학번"
        )
    else:
        print(
            "검증 범위:",
            f"{args.entry_year}학번"
        )

    with connect_database() as connection:
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
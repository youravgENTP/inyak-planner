"""Build the 2024 cohort curriculum seed CSV.

Run from the project root:

    python scripts/build_curriculum_2024_seed.py

This script:

1. Defines the 97 courses in the 2024 cohort curriculum.
2. Looks up actual offering history from data/db/inyak.db.
3. Uses the most recently offered matching course code as the representative code.
4. Records older codes and naming differences in notes.
5. Writes data/seed/curriculum/curriculum_2024.csv.
6. Verifies that required credits total 116.
"""

from __future__ import annotations

from data_paths import (
    DATABASE_PATH,
    curriculum_seed_path,
)

import csv
import re
import sqlite3
from dataclasses import dataclass
from pathlib import Path


DB_PATH = DATABASE_PATH
OUTPUT_PATH = curriculum_seed_path(2024)

ENTRY_YEAR = 2024
EXPECTED_COURSE_COUNT = 97
EXPECTED_REQUIRED_CREDITS = 116.0


@dataclass(frozen=True)
class CurriculumCourse:
    grade: int
    semester: int
    course_name: str
    completion_type: str
    credits: float | None


@dataclass(frozen=True)
class Offering:
    academic_year: int
    semester: int
    course_code: str
    course_name: str


COURSES = [
    # 1학년 1학기
    CurriculumCourse(1, 1, "해부생리학1", "전선", 2),
    CurriculumCourse(1, 1, "약학기초생물학1", "전선", 3),
    CurriculumCourse(1, 1, "약학기초화학1", "전선", 3),

    # 1학년 2학기
    CurriculumCourse(1, 2, "해부생리학2", "전선", 2),
    CurriculumCourse(1, 2, "약학기초생물학2", "전선", 3),
    CurriculumCourse(1, 2, "약학기초화학2", "전선", 3),

    # 2학년 1학기
    CurriculumCourse(2, 1, "병태생리학1", "전선", 2),
    CurriculumCourse(2, 1, "약품생화학1", "전필", 3),
    CurriculumCourse(2, 1, "약학실험1", "전필", 2),
    CurriculumCourse(2, 1, "약용식물학", "전필", 2),
    CurriculumCourse(2, 1, "약화학1", "전필", 3),
    CurriculumCourse(2, 1, "의약품분석학1", "전필", 2),
    CurriculumCourse(2, 1, "물리약학1", "전필", 3),
    CurriculumCourse(2, 1, "약학통계", "전필", 2),

    # 2학년 2학기
    CurriculumCourse(2, 2, "병태생리학2", "전선", 2),
    CurriculumCourse(2, 2, "약학실험2", "전필", 2),
    CurriculumCourse(2, 2, "약품생화학2", "전필", 2),
    CurriculumCourse(2, 2, "의약분자생물학", "전선", 2),
    CurriculumCourse(2, 2, "약품면역학", "전필", 2),
    CurriculumCourse(2, 2, "약화학2", "전선", 3),
    CurriculumCourse(2, 2, "의약품분석학2", "전필", 2),
    CurriculumCourse(2, 2, "의약품개발사", "전선", 2),
    CurriculumCourse(2, 2, "물리약학2", "전필", 2),

    # 3학년 1학기
    CurriculumCourse(3, 1, "약물학1", "전필", 3),
    CurriculumCourse(3, 1, "약품미생물학", "전필", 3),
    CurriculumCourse(3, 1, "약물유전체학", "전선", 3),
    CurriculumCourse(3, 1, "생약학1", "전필", 2),
    CurriculumCourse(3, 1, "자원생약학", "전선", 2),
    CurriculumCourse(3, 1, "약학실험3", "전필", 2),
    CurriculumCourse(3, 1, "의약품기기분석학1", "전필", 2),
    CurriculumCourse(3, 1, "제제과학1", "전필", 3),
    CurriculumCourse(3, 1, "보건사회약학", "전필", 3),

    # 3학년 2학기
    CurriculumCourse(3, 2, "약물학2", "전필", 3),
    CurriculumCourse(3, 2, "약학용어", "전필", 1),
    CurriculumCourse(3, 2, "감염성미생물학", "전필", 2),
    CurriculumCourse(3, 2, "임상면역학", "전선", 1),
    CurriculumCourse(3, 2, "독성학", "전선", 3),
    CurriculumCourse(3, 2, "생약학2", "전필", 2),
    CurriculumCourse(3, 2, "약학실험4", "전필", 2),
    CurriculumCourse(3, 2, "의약품합성학", "전필", 2),
    CurriculumCourse(3, 2, "의약품기기분석학2", "전필", 2),
    CurriculumCourse(3, 2, "법화학", "전선", 2),
    CurriculumCourse(3, 2, "제제과학2", "전필", 3),
    CurriculumCourse(3, 2, "약사커뮤니케이션", "전선", 2),

    # 4학년 1학기
    CurriculumCourse(
        4,
        1,
        "내분비계 및 류마티스 질환 약물치료학",
        "전선",
        2,
    ),
    CurriculumCourse(4, 1, "조제학", "전선", None),
    CurriculumCourse(4, 1, "방제학", "전선", None),
    CurriculumCourse(4, 1, "감염질환을 위한 항생물질학", "전필", 2),
    CurriculumCourse(4, 1, "임상미생물학", "전선", 2),
    CurriculumCourse(4, 1, "예방약학1", "전필", 3),
    CurriculumCourse(4, 1, "나노약학", "전선", 2),

    # 사용자 확정값
    CurriculumCourse(4, 1, "의약화학1", "전필", 2),

    CurriculumCourse(4, 1, "천연물의약품학", "전선", 2),
    CurriculumCourse(4, 1, "제제과학 실험", "전필", 2),
    CurriculumCourse(4, 1, "향장품학", "전선", 2),

    # 4학년 2학기
    CurriculumCourse(4, 2, "감염성 질환 약물치료학", "전필", 2),
    CurriculumCourse(
        4,
        2,
        "호흡기계 및 소화기계 질환 약물치료학",
        "전선",
        2,
    ),
    CurriculumCourse(
        4,
        2,
        "심혈관계질환 및 약물치료학",
        "전선",
        3,
    ),
    CurriculumCourse(4, 2, "바이오의약품학", "전선", 2),
    CurriculumCourse(4, 2, "예방약학2", "전필", 2),
    CurriculumCourse(4, 2, "임상영양학", "전선", 2),
    CurriculumCourse(4, 2, "의약품설계학", "전선", 3),

    # 사용자 확정값
    CurriculumCourse(4, 2, "의약화학2", "전선", 2),

    CurriculumCourse(4, 2, "바이오의약품 분석", "전선", 2),
    CurriculumCourse(4, 2, "생물약제학", "전선", 2),
    CurriculumCourse(4, 2, "약물동태학", "전선", 3),
    CurriculumCourse(4, 2, "보건의약관계법규", "전필", 2),
    CurriculumCourse(4, 2, "약사윤리", "전선", 1),

    # 5학년 1학기
    CurriculumCourse(5, 1, "지역약국 예비실무실습", "전필", 2),
    CurriculumCourse(5, 1, "항암약물요법1", "전필", 2),
    CurriculumCourse(
        5,
        1,
        "신경정신계 질환 약물치료학",
        "전선",
        2,
    ),
    CurriculumCourse(5, 1, "신장질환 약물치료학", "전선", 2),
    CurriculumCourse(5, 1, "일반의약품학", "전선", 3),
    CurriculumCourse(5, 1, "약물신호전달학", "전선", 2),
    CurriculumCourse(5, 1, "의약품제조관리학", "전선", 3),
    CurriculumCourse(5, 1, "약업경영학", "전선", 2),
    CurriculumCourse(5, 1, "의약정보학과 경제성평가", "전필", 2),

    # 5학년 2학기
    CurriculumCourse(5, 2, "임상약학해설", "전필", 1),
    CurriculumCourse(5, 2, "항암약물요법2", "전선", 2),
    CurriculumCourse(5, 2, "의료기관약국예비실습", "전필", 2),
    CurriculumCourse(5, 2, "의약품허가", "전선", 3),
    CurriculumCourse(5, 2, "신약개발정보학", "전선", 2),
    CurriculumCourse(5, 2, "종양생물학", "전선", 2),
    CurriculumCourse(5, 2, "동물용의약품학", "전선", 1),
    CurriculumCourse(5, 2, "건강기능식품학", "전선", 2),
    CurriculumCourse(5, 2, "한약제제학", "전필", 2),
    CurriculumCourse(5, 2, "약전 및 품질관리학", "전선", 3),
    CurriculumCourse(5, 2, "약무행정실무필수실습", "전필", 1),

    # 6학년 1학기
    CurriculumCourse(6, 1, "지역약국 필수실무실습1", "전필", 2),
    CurriculumCourse(
        6,
        1,
        "의료기관약국 필수실무실습1",
        "전필",
        3,
    ),
    CurriculumCourse(
        6,
        1,
        "의료기관약국 필수실무실습2",
        "전필",
        2,
    ),
    CurriculumCourse(
        6,
        1,
        "의료기관약국 필수실무실습3",
        "전필",
        3,
    ),
    CurriculumCourse(
        6,
        1,
        "의료기관약국 필수실무실습4",
        "전필",
        2,
    ),
    CurriculumCourse(6, 1, "제약산업 필수실무실습", "전필", 2),

    # 6학년 2학기
    CurriculumCourse(6, 2, "지역약국 필수실무실습2", "전필", 3),
    CurriculumCourse(6, 2, "심화실습1", "전필", 5),
    CurriculumCourse(6, 2, "심화실습2", "전필", 5),
]


# 교육과정표 이름과 수강편람 이름이 다른 경우에 사용할 별칭입니다.
ALIASES = {
    "내분비계 및 류마티스 질환 약물치료학": [
        "내분비계 및 류마티스 질환 약물치료",
        "내분비 류마티스 질환 약물치료",
    ],
    "심혈관계질환 및 약물치료학": [
        "심혈관계 질환 약물치료학",
        "심혈관계질환 약물치료학",
    ],
    "신경정신계 질환 약물치료학": [
        "신경정신계질환 약물치료학",
    ],
    "신장질환 약물치료학": [
        "신장질환약물치료학",
    ],
    "약사커뮤니케이션": [
        "약사 커뮤니케이션",
    ],
    "의료기관약국예비실습": [
        "의료기관약국 예비실습",
        "의료기관약국 예비실무실습",
    ],
    "제제과학 실험": [
        "제제과학실험",
    ],
    "지역약국 필수실무실습1": [
        "지역약국 필수실무실습 1",
    ],
    "지역약국 필수실무실습2": [
        "지역약국 필수실무실습 2",
    ],
    "의료기관약국 필수실무실습1": [
        "의료기관약국 필수실무실습 1",
    ],
    "의료기관약국 필수실무실습2": [
        "의료기관약국 필수실무실습 2",
    ],
    "의료기관약국 필수실무실습3": [
        "의료기관약국 필수실무실습 3",
    ],
    "의료기관약국 필수실무실습4": [
        "의료기관약국 필수실무실습 4",
    ],
    "심화실습1": [
        "심화실습 1",
    ],
    "심화실습2": [
        "심화실습 2",
    ],
    "약화학1": [
        "약화학 1",
    ],
    "약화학2": [
        "약화학 2",
    ],
    "의약화학1": [
        "의약화학 1",
    ],
    "의약화학2": [
        "의약화학 2",
    ],
}


SPECIAL_NOTES = {
    "조제학": (
        "2024학번 이수체계도상 4학년 1학기 과목. "
        "동일 학년·학기의 교육과정표 행은 확인되지 않음. "
        "학점은 추가 확인 필요."
    ),

    "방제학": (
        "2024학번 이수체계도상 4학년 1학기 전선 과목. "
        "학점은 추가 확인 필요. "
        "2022-1~2026-2 수강편람에서 동일하거나 유사한 과목명과 "
        "학정번호를 확인하지 못함."
    ),


    "독성학": (
        "2024학번 교육과정에서는 독성학 단일 과목, 전선 3학점으로 기록. "
        "2026학년도 수강편람에서는 독성학1(ADA234, 2학점)과 "
        "독성학2(ADA235, 2학점)가 각각 개설됨. "
        "단일 과목의 코드 변경이 아니라 과목 분리로 보이며, "
        "2024학번 독성학과의 대체·인정 관계는 미확정."
    ),

    "의약화학1": (
        "사용자 확정: 2024학번 기준 전필 2학점. "
        "대표 학정번호는 가장 최근 개설 이력을 사용."
    ),
    "의약화학2": (
        "사용자 확정: 2024학번 기준 전선 2학점. "
        "대표 학정번호는 가장 최근 개설 이력을 사용."
    ),
    "약물동태학": (
        "2024학번 기준 전선 3학점으로 확정. "
        "과거 교육과정표에는 2학점 코드도 존재함."
    ),
    "동물용의약품학": (
        "2024학번 기준 전선 1학점으로 확정. "
        "다른 연도 교육과정에는 2학점 행도 존재함."
    ),

    "종양생물학": (
        "2024학번 이수체계도상 5학년 2학기 전선 2학점. "
        "2022-1~2026-2 수강편람에서 동일 과목명 개설 이력은 확인되지 않음. "
        "2026-2에 혈액종양약물치료학(ADA238, 전선 2학점)이 개설됐으나, "
        "종양생물학과 동일·대체 과목이라는 근거는 확인되지 않음."
    ),

    "심혈관계질환 및 약물치료학": (
        "실제 개설명은 심혈관계 질환 약물치료학."
    ),

    "나노약학": (
        "2024학번 이수체계도상 4학년 1학기 전선 2학점. "
        "2022-1~2026-2 현재 수집된 수강편람 데이터에서는 "
        "동일하거나 유사한 과목명과 학정번호를 확인하지 못함."
    ),

    "약물신호전달학": (
        "2024학번 이수체계도상 5학년 1학기 전선 2학점. "
        "2022-1~2026-2 수강편람에서 동일하거나 유사한 과목명과 "
        "학정번호를 확인하지 못함."
    ),

    "의약품허가": (
        "2024학번 이수체계도상 5학년 2학기 전선 3학점. "
        "2022-1~2026-2 수강편람에서 동일하거나 유사한 과목명과 "
        "학정번호를 확인하지 못함."
    ),

    "신약개발정보학": (
        "2024학번 이수체계도상 5학년 2학기 전선 2학점. "
        "2022-1~2026-2 수강편람에서 동일하거나 유사한 과목명과 "
        "학정번호를 확인하지 못함."
    ),

}


def normalize_course_name(value: str) -> str:
    """Normalize spacing and punctuation for course-name comparison."""

    normalized = value.strip().lower()

    # 공백, 괄호, 가운데점, 하이픈 등의 표기 차이를 제거합니다.
    normalized = re.sub(r"[\s·ㆍ()\[\]{}\-_/]", "", normalized)

    return normalized


def load_offerings(connection: sqlite3.Connection) -> list[Offering]:
    rows = connection.execute(
        """
        SELECT DISTINCT
            academic_year,
            semester,
            course_code,
            course_name
        FROM courses
        WHERE course_code IS NOT NULL
          AND TRIM(course_code) != ''
          AND course_name IS NOT NULL
          AND TRIM(course_name) != ''
        ORDER BY
            academic_year DESC,
            semester DESC,
            course_code DESC
        """
    ).fetchall()

    return [
        Offering(
            academic_year=row[0],
            semester=row[1],
            course_code=row[2].strip(),
            course_name=row[3].strip(),
        )
        for row in rows
    ]


def find_matching_offerings(
    course: CurriculumCourse,
    offerings: list[Offering],
) -> list[Offering]:
    possible_names = [course.course_name]
    possible_names.extend(ALIASES.get(course.course_name, []))

    normalized_names = {
        normalize_course_name(name)
        for name in possible_names
    }

    matches = [
        offering
        for offering in offerings
        if normalize_course_name(offering.course_name) in normalized_names
    ]

    # 최신 학년도·학기부터 정렬합니다.
    matches.sort(
        key=lambda item: (
            item.academic_year,
            item.semester,
            item.course_code,
        ),
        reverse=True,
    )

    return matches


def choose_representative_code(
    matches: list[Offering],
) -> str | None:
    if not matches:
        return None

    # 정렬상 첫 행이 가장 최근 개설 이력입니다.
    return matches[0].course_code


def build_history_note(
    course: CurriculumCourse,
    matches: list[Offering],
) -> str | None:
    note_parts: list[str] = []

    special_note = SPECIAL_NOTES.get(course.course_name)
    if special_note:
        note_parts.append(special_note)

    if not matches:
        note_parts.append(
            "2022-1~2026-2 수강편람 데이터에서 일치하는 개설 이력을 "
            "확인하지 못함."
        )
        return " ".join(note_parts)

    latest = matches[0]

    note_parts.append(
        f"대표 학정번호 {latest.course_code}: "
        f"{latest.academic_year}-{latest.semester} 개설 이력 기준."
    )

    if normalize_course_name(latest.course_name) != normalize_course_name(
        course.course_name
    ):
        note_parts.append(
            f"실제 최근 개설명은 '{latest.course_name}'."
        )

    # 코드별 가장 최근 관측 시점만 남깁니다.
    latest_by_code: dict[str, Offering] = {}

    for match in matches:
        if match.course_code not in latest_by_code:
            latest_by_code[match.course_code] = match

    previous_codes = [
        offering
        for code, offering in latest_by_code.items()
        if code != latest.course_code
    ]

    previous_codes.sort(
        key=lambda item: (
            item.academic_year,
            item.semester,
            item.course_code,
        ),
        reverse=True,
    )

    if previous_codes:
        history_text = ", ".join(
            f"{item.course_code}"
            f"({item.academic_year}-{item.semester}, {item.course_name})"
            for item in previous_codes
        )

        note_parts.append(f"이전 확인 코드: {history_text}.")

    return " ".join(note_parts) or None


def validate_courses() -> None:
    if len(COURSES) != EXPECTED_COURSE_COUNT:
        raise ValueError(
            f"과목 수 오류: {len(COURSES)}개 "
            f"(예상 {EXPECTED_COURSE_COUNT}개)"
        )

    required_credits = sum(
        course.credits or 0
        for course in COURSES
        if course.completion_type == "전필"
    )

    if required_credits != EXPECTED_REQUIRED_CREDITS:
        raise ValueError(
            f"전필 학점 오류: {required_credits:g}학점 "
            f"(예상 {EXPECTED_REQUIRED_CREDITS:g}학점)"
        )

    duplicate_keys: set[tuple[int, int, str]] = set()
    seen_keys: set[tuple[int, int, str]] = set()

    for course in COURSES:
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
            f"중복 과목이 있습니다: {sorted(duplicate_keys)}"
        )


def write_csv(
    offerings: list[Offering],
) -> tuple[int, list[str]]:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    missing_codes: list[str] = []

    with OUTPUT_PATH.open(
        "w",
        encoding="utf-8-sig",
        newline="",
    ) as file:
        writer = csv.DictWriter(
            file,
            fieldnames=[
                "entry_year",
                "grade",
                "semester",
                "course_name",
                "course_code",
                "completion_type",
                "credits",
                "notes",
            ],
        )

        writer.writeheader()

        for course in COURSES:
            matches = find_matching_offerings(course, offerings)
            representative_code = choose_representative_code(matches)
            notes = build_history_note(course, matches)

            if representative_code is None:
                missing_codes.append(course.course_name)

            writer.writerow(
                {
                    "entry_year": ENTRY_YEAR,
                    "grade": course.grade,
                    "semester": course.semester,
                    "course_name": course.course_name,
                    "course_code": representative_code or "",
                    "completion_type": course.completion_type,
                    "credits": (
                        ""
                        if course.credits is None
                        else f"{course.credits:g}"
                    ),
                    "notes": notes or "",
                }
            )

    return len(COURSES), missing_codes


def main() -> None:
    if not DB_PATH.is_file():
        raise SystemExit(f"DB 파일을 찾을 수 없습니다: {DB_PATH}")

    validate_courses()

    try:
        with sqlite3.connect(DB_PATH) as connection:
            offerings = load_offerings(connection)
    except sqlite3.Error as error:
        raise SystemExit(f"DB 조회 실패: {error}") from error

    row_count, missing_codes = write_csv(offerings)

    required_credits = sum(
        course.credits or 0
        for course in COURSES
        if course.completion_type == "전필"
    )

    elective_known_credits = sum(
        course.credits or 0
        for course in COURSES
        if course.completion_type == "전선"
    )

    print()
    print("2024학번 교육과정 seed 생성 완료")
    print(f"출력 파일: {OUTPUT_PATH}")
    print(f"과목 수: {row_count}개")
    print(f"전필 학점: {required_credits:g}")
    print(f"학점이 확인된 전선 합계: {elective_known_credits:g}")
    print(f"대표 학정번호 미지정: {len(missing_codes)}개")

    if missing_codes:
        print()
        print("대표 학정번호 미지정 과목:")

        for course_name in missing_codes:
            print(f"- {course_name}")


if __name__ == "__main__":
    main()
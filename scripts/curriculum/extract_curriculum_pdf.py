from __future__ import annotations

import argparse
import csv
import re
from dataclasses import dataclass
from pathlib import Path

import fitz


from scripts.common.data_paths import (
    EXTRACTED_CURRICULUM_DIR,
    RAW_CURRICULUM_PDFS_DIR,
)


RAW_CURRICULUM_DIR = RAW_CURRICULUM_PDFS_DIR

COURSE_CODE_RE = re.compile(r"^(ADA|ADB)\d{3}$")
GRADE_SEMESTER_RE = re.compile(r"^([1-6])-([12])$")

OUTPUT_COLUMNS = [
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
]


@dataclass
class CourseRow:
    page: int
    grade: int
    semester: int
    completion_type: str
    course_code: str
    course_name: str
    credits: float


@dataclass
class ValidationResult:
    total_rows: int
    valid_course_codes: int
    invalid_course_codes: list[str]
    invalid_grades: list[str]
    invalid_semesters: list[str]
    invalid_completion_types: list[str]
    missing_course_names: list[str]
    invalid_credits: list[str]
    missing_source_pages: list[str]
    duplicate_rows: list[str]

    @property
    def passed(self) -> bool:
        return not any(
            [
                self.invalid_course_codes,
                self.invalid_grades,
                self.invalid_semesters,
                self.invalid_completion_types,
                self.missing_course_names,
                self.invalid_credits,
                self.missing_source_pages,
                self.duplicate_rows,
            ]
        )


def find_pdf(year: int) -> Path:
    year_dir = RAW_CURRICULUM_DIR / str(year)
    pdfs = sorted(year_dir.glob("*.pdf"))

    if len(pdfs) != 1:
        raise RuntimeError(
            f"{year}학년도 PDF가 정확히 1개여야 합니다: "
            f"{pdfs}"
        )

    return pdfs[0]


def group_words_into_lines(
    page: fitz.Page,
    y_tolerance: float = 2.0,
) -> list[list[tuple]]:
    words = page.get_text("words")

    words = sorted(
        words,
        key=lambda word: (
            round(word[1] / y_tolerance),
            word[0],
        ),
    )

    lines: list[list[tuple]] = []

    for word in words:
        if not lines:
            lines.append([word])
            continue

        current_line = lines[-1]

        current_y = sum(
            item[1]
            for item in current_line
        ) / len(current_line)

        if abs(word[1] - current_y) <= y_tolerance:
            current_line.append(word)
        else:
            lines.append([word])

    for line in lines:
        line.sort(key=lambda word: word[0])

    return lines


def line_text(line: list[tuple]) -> str:
    return " ".join(
        word[4].strip()
        for word in line
        if word[4].strip()
    )


def find_code_index(
    line: list[tuple],
) -> int | None:
    for index, word in enumerate(line):
        text = word[4].strip()

        if COURSE_CODE_RE.fullmatch(text):
            return index

    return None


def extract_grade_semester(
    line: list[tuple],
) -> tuple[int, int] | None:
    for word in line:
        text = word[4].strip()

        match = GRADE_SEMESTER_RE.fullmatch(text)

        if match:
            return (
                int(match.group(1)),
                int(match.group(2)),
            )

    return None


def extract_completion_type(
    line: list[tuple],
) -> str | None:
    for word in line:
        text = word[4].strip()

        if text in {"전필", "전선"}:
            return text

    return None


def parse_credit(
    line: list[tuple],
    code_index: int,
) -> float | None:
    for word in line:
        x0 = word[0]
        text = word[4].strip()

        # 2024 PDF의 '학점' 열
        if not (400 <= x0 < 430):
            continue

        try:
            return float(text)
        except ValueError:
            continue

    return None

def extract_course_name(
    line: list[tuple],
    code_index: int,
) -> str:
    candidates: list[str] = []

    for word in line:
        x0 = word[0]
        text = word[4].strip()

        if not text:
            continue

        # 2024 PDF 기준:
        # 주전공능력 열은 약 x=145~205
        # 교과목명 열은 약 x=213~400
        if 210 <= x0 < 400:
            candidates.append(text)

    return " ".join(candidates).strip()


def extract_courses(
    document: fitz.Document,
    start_page: int,
    end_page: int,
) -> tuple[list[CourseRow], list[str]]:
    rows: list[CourseRow] = []
    warnings: list[str] = []

    current_grade: int | None = None
    current_semester: int | None = None

    for page_number in range(
        start_page,
        end_page + 1,
    ):
        page = document[page_number - 1]

        lines = group_words_into_lines(page)

        for line in lines:
            code_index = find_code_index(line)

            if code_index is None:
                continue

            code = line[code_index][4].strip()

            grade_semester = extract_grade_semester(
                line
            )

            if grade_semester is not None:
                current_grade, current_semester = (
                    grade_semester
                )

            completion_type = (
                extract_completion_type(line)
            )

            course_name = extract_course_name(
                line,
                code_index,
            )

            credits = parse_credit(
                line,
                code_index,
            )

            problems: list[str] = []

            if current_grade is None:
                problems.append(
                    "학년을 결정할 수 없음"
                )

            if current_semester is None:
                problems.append(
                    "학기를 결정할 수 없음"
                )

            if completion_type is None:
                problems.append(
                    "이수구분을 결정할 수 없음"
                )

            if not course_name:
                problems.append(
                    "교과목명이 비어 있음"
                )

            if credits is None:
                problems.append(
                    "학점을 결정할 수 없음"
                )

            if problems:
                warnings.append(
                    f"page {page_number} / "
                    f"{code}: "
                    + ", ".join(problems)
                    + " / "
                    + line_text(line)
                )
                continue

            rows.append(
                CourseRow(
                    page=page_number,
                    grade=current_grade,
                    semester=current_semester,
                    completion_type=completion_type,
                    course_code=code,
                    course_name=course_name,
                    credits=credits,
                )
            )

    return rows, warnings


def validate_courses(
    rows: list[CourseRow],
) -> ValidationResult:
    invalid_course_codes: list[str] = []
    invalid_grades: list[str] = []
    invalid_semesters: list[str] = []
    invalid_completion_types: list[str] = []
    missing_course_names: list[str] = []
    invalid_credits: list[str] = []
    missing_source_pages: list[str] = []
    duplicate_rows: list[str] = []

    seen_rows: set[
        tuple[
            int,
            int,
            int,
            str,
            str,
            str,
            float,
        ]
    ] = set()

    valid_course_codes = 0

    for row in rows:
        identifier = (
            f"page {row.page} / "
            f"{row.course_code}"
        )

        if COURSE_CODE_RE.fullmatch(
            row.course_code
        ):
            valid_course_codes += 1
        else:
            invalid_course_codes.append(
                identifier
            )

        if row.grade not in range(1, 7):
            invalid_grades.append(
                identifier
            )

        if row.semester not in {1, 2}:
            invalid_semesters.append(
                identifier
            )

        if row.completion_type not in {
            "전필",
            "전선",
        }:
            invalid_completion_types.append(
                identifier
            )

        if not row.course_name.strip():
            missing_course_names.append(
                identifier
            )

        if (
            not isinstance(
                row.credits,
                (int, float),
            )
            or row.credits < 0
        ):
            invalid_credits.append(
                identifier
            )

        if row.page <= 0:
            missing_source_pages.append(
                identifier
            )

        row_key = (
            row.page,
            row.grade,
            row.semester,
            row.completion_type,
            row.course_code,
            row.course_name,
            row.credits,
        )

        if row_key in seen_rows:
            duplicate_rows.append(
                identifier
            )
        else:
            seen_rows.add(row_key)

    return ValidationResult(
        total_rows=len(rows),
        valid_course_codes=valid_course_codes,
        invalid_course_codes=(
            invalid_course_codes
        ),
        invalid_grades=invalid_grades,
        invalid_semesters=invalid_semesters,
        invalid_completion_types=(
            invalid_completion_types
        ),
        missing_course_names=(
            missing_course_names
        ),
        invalid_credits=invalid_credits,
        missing_source_pages=(
            missing_source_pages
        ),
        duplicate_rows=duplicate_rows,
    )


def count_rows_by_page(
    rows: list[CourseRow],
) -> dict[int, int]:
    counts: dict[int, int] = {}

    for row in rows:
        counts[row.page] = (
            counts.get(row.page, 0) + 1
        )

    return counts

def write_courses_csv(
    year: int,
    pdf_path: Path,
    rows: list[CourseRow],
) -> Path:
    output_dir = (
        EXTRACTED_CURRICULUM_DIR
        / str(year)
    )

    output_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    output_path = (
        output_dir
        / "courses.csv"
    )

    with output_path.open(
        "w",
        encoding="utf-8-sig",
        newline="",
    ) as file:
        writer = csv.DictWriter(
            file,
            fieldnames=OUTPUT_COLUMNS,
        )

        writer.writeheader()

        for row in rows:
            writer.writerow(
                {
                    "entry_year": "",
                    "grade": row.grade,
                    "semester": row.semester,
                    "course_name": row.course_name,
                    "course_code": row.course_code,
                    "completion_type": (
                        row.completion_type
                    ),
                    "credits": (
                        f"{row.credits:g}"
                    ),
                    "notes": (
                        f"source={pdf_path.name}; "
                        f"page={row.page}"
                    ),
                    "change_group": "",
                    "change_type": "",
                    "change_role": "",
                    "change_effective_year": "",
                    "change_note": "",
                    "previous_credits": "",
                    "previous_completion_type": "",
                    "previous_grade": "",
                    "previous_semester": "",
                    "attribute_change_effective_year": "",
                    "attribute_change_note": "",
                }
            )

    return output_path


def write_report(
    year: int,
    pdf_path: Path,
    start_page: int,
    end_page: int,
    rows: list[CourseRow],
    warnings: list[str],
    validation: ValidationResult,
) -> Path:
    output_dir = (
        EXTRACTED_CURRICULUM_DIR
        / str(year)
    )

    output_path = (
        output_dir
        / "extraction_report.txt"
    )

    page_counts = count_rows_by_page(
        rows
    )

    total_credits = sum(
        row.credits
        for row in rows
    )

    required_credits = sum(
        row.credits
        for row in rows
        if row.completion_type == "전필"
    )

    elective_credits = sum(
        row.credits
        for row in rows
        if row.completion_type == "전선"
    )

    lines = [
        "Curriculum extraction report",
        "============================",
        "",
        f"academic year: {year}",
        f"source PDF: {pdf_path.name}",
        (
            "course table pages: "
            f"{start_page}-{end_page}"
        ),
        "",
        "Extraction",
        "----------",
        (
            "course rows extracted: "
            f"{len(rows)}"
        ),
        (
            "parser warnings: "
            f"{len(warnings)}"
        ),
        "",
        "Validation",
        "----------",
        (
            "rows: "
            f"{validation.total_rows}"
        ),
        (
            "valid course codes: "
            f"{validation.valid_course_codes}"
        ),
        (
            "invalid course codes: "
            f"{len(validation.invalid_course_codes)}"
        ),
        (
            "invalid grades: "
            f"{len(validation.invalid_grades)}"
        ),
        (
            "invalid semesters: "
            f"{len(validation.invalid_semesters)}"
        ),
        (
            "invalid completion types: "
            f"{len(validation.invalid_completion_types)}"
        ),
        (
            "missing course names: "
            f"{len(validation.missing_course_names)}"
        ),
        (
            "invalid credits: "
            f"{len(validation.invalid_credits)}"
        ),
        (
            "missing source pages: "
            f"{len(validation.missing_source_pages)}"
        ),
        (
            "duplicate extracted rows: "
            f"{len(validation.duplicate_rows)}"
        ),
        "",
        "Rows by page",
        "------------",
    ]

    for page_number in range(
        start_page,
        end_page + 1,
    ):
        lines.append(
            f"page {page_number}: "
            f"{page_counts.get(page_number, 0)}"
        )

    lines.extend(
        [
            "",
            "Credit summary",
            "--------------",
            (
                "all extracted credits: "
                f"{total_credits:g}"
            ),
            (
                "required credits: "
                f"{required_credits:g}"
            ),
            (
                "elective credits: "
                f"{elective_credits:g}"
            ),
            "",
            (
                "RESULT: "
                + (
                    "PASS"
                    if (
                        validation.passed
                        and not warnings
                    )
                    else "REVIEW REQUIRED"
                )
            ),
            "",
        ]
    )

    problem_groups = [
        (
            "Parser warnings",
            warnings,
        ),
        (
            "Invalid course codes",
            validation.invalid_course_codes,
        ),
        (
            "Invalid grades",
            validation.invalid_grades,
        ),
        (
            "Invalid semesters",
            validation.invalid_semesters,
        ),
        (
            "Invalid completion types",
            validation.invalid_completion_types,
        ),
        (
            "Missing course names",
            validation.missing_course_names,
        ),
        (
            "Invalid credits",
            validation.invalid_credits,
        ),
        (
            "Missing source pages",
            validation.missing_source_pages,
        ),
        (
            "Duplicate extracted rows",
            validation.duplicate_rows,
        ),
    ]

    for title, problems in problem_groups:
        if not problems:
            continue

        lines.append(title)
        lines.append(
            "-" * len(title)
        )

        for problem in problems:
            lines.append(problem)

        lines.append("")

    output_path.write_text(
        "\n".join(lines),
        encoding="utf-8",
    )

    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "약학과 교육과정 PDF에서 "
            "교과목 표를 추출합니다."
        )
    )

    parser.add_argument(
        "--year",
        type=int,
        required=True,
    )

    parser.add_argument(
        "--course-pages",
        default="4-15",
        help=(
            "교과목 표 PDF 페이지 범위 "
            "(예: 4-15)"
        ),
    )

    args = parser.parse_args()

    match = re.fullmatch(
        r"(\d+)-(\d+)",
        args.course_pages,
    )

    if match is None:
        raise ValueError(
            "--course-pages 형식은 "
            "예: 4-15 이어야 합니다."
        )

    start_page = int(match.group(1))
    end_page = int(match.group(2))

    pdf_path = find_pdf(args.year)

    document = fitz.open(pdf_path)

    rows, warnings = extract_courses(
        document,
        start_page,
        end_page,
    )

    validation = validate_courses(rows)

    csv_path = write_courses_csv(
        args.year,
        pdf_path,
        rows,
    )

    report_path = write_report(
        args.year,
        pdf_path,
        start_page,
        end_page,
        rows,
        warnings,
        validation,
    )

    print()
    print("Curriculum extraction")
    print("---------------------")
    print(f"year: {args.year}")
    print(
        f"course pages: "
        f"{start_page}-{end_page}"
    )
    print(
        f"rows extracted: {len(rows)}"
    )
    print(
        f"warnings: {len(warnings)}"
    )
    print(
        "validation: "
        + (
            "PASS"
            if (
                validation.passed
                and not warnings
            )
            else "REVIEW REQUIRED"
        )
    )
    print(f"courses: {csv_path}")
    print(f"report:  {report_path}")


if __name__ == "__main__":
    main()
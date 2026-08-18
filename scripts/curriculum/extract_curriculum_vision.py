from __future__ import annotations

import argparse
import csv
import re
import tempfile
from dataclasses import dataclass
from pathlib import Path

import fitz

from scripts.common.curriculum_vision import (
    VisionObservation,
    find_curriculum_pdf,
    recognize_image,
    render_page,
)
from scripts.common.data_paths import (
    EXTRACTED_CURRICULUM_DIR,
)


COURSE_CODE_RE = re.compile(
    r"\b(?:ADA|ADB)\d{3}\b"
)

GRADE_SEMESTER_RE = re.compile(
    r"\b([1-6])-([12])\b"
)

HANGUL_RE = re.compile(
    r"[가-힣]"
)

FLOAT_RE = re.compile(
    r"(?<!\d)(\d+(?:\.\d+)?)(?!\d)"
)

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
class CourseAnchor:
    y: float
    code: str


@dataclass
class CourseRow:
    page: int
    grade: int
    semester: int
    completion_type: str
    course_code: str
    course_name: str
    credits: float
    ocr_confidence: float


@dataclass
class ValidationResult:
    total_rows: int
    invalid_course_codes: list[str]
    invalid_grades: list[str]
    invalid_semesters: list[str]
    invalid_completion_types: list[str]
    missing_course_names: list[str]
    invalid_credits: list[str]
    duplicate_rows: list[str]
    low_confidence_rows: list[str]

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
                self.duplicate_rows,
                self.low_confidence_rows,
            ]
        )


def parse_page_range(
    value: str,
) -> tuple[
    int,
    int,
]:
    match = re.fullmatch(
        r"(\d+)-(\d+)",
        value,
    )

    if match is None:
        raise ValueError(
            "페이지 범위는 "
            "예: 3-12 형식이어야 합니다."
        )

    start_page = int(
        match.group(1)
    )
    end_page = int(
        match.group(2)
    )

    if start_page > end_page:
        raise ValueError(
            "시작 페이지가 "
            "끝 페이지보다 클 수 없습니다."
        )

    return (
        start_page,
        end_page,
    )


def clean_text(
    text: str,
) -> str:
    text = text.strip()

    text = re.sub(
        r"\s+",
        " ",
        text,
    )

    return text


def extract_code(
    text: str,
) -> str | None:
    match = COURSE_CODE_RE.search(
        text
    )

    if match is None:
        return None

    return match.group(0)


def find_course_anchors(
    observations: list[
        VisionObservation
    ],
) -> list[
    CourseAnchor
]:
    anchors: list[
        CourseAnchor
    ] = []

    seen: set[
        tuple[
            float,
            str,
        ]
    ] = set()

    for (
        y,
        x,
        text,
        confidence,
    ) in observations:
        code = extract_code(
            text
        )

        if code is None:
            continue

        key = (
            round(y, 4),
            code,
        )

        if key in seen:
            continue

        seen.add(key)

        anchors.append(
            CourseAnchor(
                y=y,
                code=code,
            )
        )

    anchors.sort(
        key=lambda item: -item.y
    )

    return anchors


def get_row_observations(
    observations: list[
        VisionObservation
    ],
    anchor_y: float,
    previous_y: float | None,
    next_y: float | None,
) -> list[
    VisionObservation
]:
    if previous_y is None:
        if next_y is None:
            upper = (
                anchor_y
                + 0.02
            )
        else:
            upper = (
                anchor_y
                + (
                    anchor_y
                    - next_y
                ) / 2
            )
    else:
        upper = (
            previous_y
            + anchor_y
        ) / 2

    if next_y is None:
        if previous_y is None:
            lower = (
                anchor_y
                - 0.02
            )
        else:
            lower = (
                anchor_y
                - (
                    previous_y
                    - anchor_y
                ) / 2
            )
    else:
        lower = (
            anchor_y
            + next_y
        ) / 2

    result: list[
        VisionObservation
    ] = []

    for observation in observations:
        y = observation[0]

        if lower <= y < upper:
            result.append(
                observation
            )

    result.sort(
        key=lambda item: (
            -item[0],
            item[1],
        )
    )

    return result


def extract_grade_semester(
    observations: list[
        VisionObservation
    ],
) -> tuple[
    int,
    int,
] | None:
    for (
        y,
        x,
        text,
        confidence,
    ) in observations:
        if x >= 0.12:
            continue

        match = (
            GRADE_SEMESTER_RE.search(
                text
            )
        )

        if match is None:
            continue

        return (
            int(match.group(1)),
            int(match.group(2)),
        )

    return None


def extract_completion_type(
    observations: list[
        VisionObservation
    ],
) -> str | None:
    for (
        y,
        x,
        text,
        confidence,
    ) in observations:
        cleaned = clean_text(
            text
        )

        if "전필" in cleaned:
            return "전필"

        if "전선" in cleaned:
            return "전선"

    return None


def extract_course_name(
    observations: list[
        VisionObservation
    ],
) -> str:
    competency_phrases = [
        "문제 해결 능력",
        "문제 해결 능",
        "전문 연구 능력",
        "전문 연구 능",
        "융복합 능력",
        "융복합 능",
        "실험 수행 능력",
        "실험 수행 능",
        "의사 전달 능력",
        "의사 전달 능",
    ]

    candidates: list[
        tuple[
            int,
            float,
            float,
            str,
        ]
    ] = []

    for (
        y,
        x,
        text,
        confidence,
    ) in observations:
        cleaned = clean_text(
            text
        )

        if not cleaned:
            continue

        if x >= 0.67:
            continue

        cleaned = re.sub(
            r"\b(?:전필|전선)\b",
            " ",
            cleaned,
        )

        cleaned = COURSE_CODE_RE.sub(
            " ",
            cleaned,
        )

        cleaned = GRADE_SEMESTER_RE.sub(
            " ",
            cleaned,
        )

        for phrase in competency_phrases:
            cleaned = cleaned.replace(
                phrase,
                " ",
            )

        cleaned = re.sub(
            r"^\s*력\s*$",
            "",
            cleaned,
        )

        cleaned = re.sub(
            r"^[•·ㆍ/\-\s]+",
            "",
            cleaned,
        )

        cleaned = re.sub(
            r"\s+",
            " ",
            cleaned,
        ).strip()

        if not cleaned:
            continue

        if not HANGUL_RE.search(
            cleaned
        ):
            continue

        if cleaned in {
            "전필",
            "전선",
            "능",
            "능력",
            "력",
        }:
            continue

        hangul_count = len(
            HANGUL_RE.findall(
                cleaned
            )
        )

        position_score = (
            2
            if x >= 0.32
            else 1
        )

        score = (
            hangul_count
            + position_score
        )

        candidates.append(
            (
                score,
                y,
                x,
                cleaned,
            )
        )

    if not candidates:
        return ""

    candidates.sort(
        key=lambda item: (
            -item[0],
            -item[1],
            item[2],
        )
    )

    return candidates[0][3]


def extract_credit_from_vision(
    observations: list[
        VisionObservation
    ],
) -> float | None:
    candidates: list[
        tuple[
            float,
            float,
        ]
    ] = []

    for (
        y,
        x,
        text,
        confidence,
    ) in observations:
        if not (
            0.64
            <= x
            <= 0.75
        ):
            continue

        matches = FLOAT_RE.findall(
            text
        )

        for match in matches:
            try:
                value = float(
                    match
                )
            except ValueError:
                continue

            if not (
                0
                <= value
                <= 10
            ):
                continue

            candidates.append(
                (
                    x,
                    value,
                )
            )

    if not candidates:
        return None

    candidates.sort(
        key=lambda item: item[0]
    )

    return candidates[0][1]


def extract_credit_from_pdf(
    page: fitz.Page,
    anchor_y: float,
    previous_y: float | None,
    next_y: float | None,
) -> float | None:
    page_height = (
        page.rect.height
    )

    anchor_pdf_y = (
        (
            1.0
            - anchor_y
        )
        * page_height
    )

    if previous_y is None:
        upper_vision_y = (
            anchor_y
            + 0.02
            if next_y is None
            else (
                anchor_y
                + (
                    anchor_y
                    - next_y
                ) / 2
            )
        )
    else:
        upper_vision_y = (
            previous_y
            + anchor_y
        ) / 2

    if next_y is None:
        lower_vision_y = (
            anchor_y
            - 0.02
            if previous_y is None
            else (
                anchor_y
                - (
                    previous_y
                    - anchor_y
                ) / 2
            )
        )
    else:
        lower_vision_y = (
            anchor_y
            + next_y
        ) / 2

    row_top = (
        (
            1.0
            - upper_vision_y
        )
        * page_height
    )

    row_bottom = (
        (
            1.0
            - lower_vision_y
        )
        * page_height
    )

    candidates: list[
        tuple[
            float,
            float,
        ]
    ] = []

    for word in page.get_text(
        "words"
    ):
        x0 = float(
            word[0]
        )
        y0 = float(
            word[1]
        )
        text = str(
            word[4]
        ).strip()

        if not (
            row_top
            <= y0
            <= row_bottom
        ):
            continue

        if not (
            390
            <= x0
            <= 440
        ):
            continue

        try:
            value = float(
                text
            )
        except ValueError:
            continue

        if not (
            0
            <= value
            <= 10
        ):
            continue

        distance = abs(
            y0
            - anchor_pdf_y
        )

        candidates.append(
            (
                distance,
                value,
            )
        )

    if not candidates:
        return None

    candidates.sort(
        key=lambda item: item[0]
    )

    return candidates[0][1]


def extract_row_confidence(
    observations: list[
        VisionObservation
    ],
) -> float:
    relevant = sorted(
        confidence
        for (
            y,
            x,
            text,
            confidence,
        ) in observations
        if (
            x < 0.75
            and text.strip()
        )
    )

    if not relevant:
        return 0.0

    middle = (
        len(relevant)
        // 2
    )

    if (
        len(relevant)
        % 2
        == 1
    ):
        return relevant[
            middle
        ]

    return (
        relevant[
            middle - 1
        ]
        + relevant[
            middle
        ]
    ) / 2

def extract_page_rows(
    page: fitz.Page,
    page_number: int,
    observations: list[
        VisionObservation
    ],
    current_grade: int | None,
    current_semester: int | None,
) -> tuple[
    list[
        CourseRow
    ],
    list[
        str
    ],
    int | None,
    int | None,
]:
    rows: list[
        CourseRow
    ] = []

    warnings: list[
        str
    ] = []

    anchors = find_course_anchors(
        observations
    )

    for index, anchor in enumerate(
        anchors
    ):
        previous_y = (
            anchors[
                index - 1
            ].y
            if index > 0
            else None
        )

        next_y = (
            anchors[
                index + 1
            ].y
            if (
                index + 1
                < len(anchors)
            )
            else None
        )

        row_observations = (
            get_row_observations(
                observations,
                anchor.y,
                previous_y,
                next_y,
            )
        )

        grade_semester = (
            extract_grade_semester(
                row_observations
            )
        )

        if grade_semester is not None:
            (
                current_grade,
                current_semester,
            ) = grade_semester

        completion_type = (
            extract_completion_type(
                row_observations
            )
        )

        course_name = (
            extract_course_name(
                row_observations
            )
        )

        vision_credit = (
            extract_credit_from_vision(
                row_observations
            )
        )

        pdf_credit = (
            extract_credit_from_pdf(
                page,
                anchor.y,
                previous_y,
                next_y,
            )
        )

        problems: list[
            str
        ] = []

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

        credit: float | None = None

        if pdf_credit is not None:
            credit = pdf_credit

        elif vision_credit is not None:
            credit = vision_credit

        else:
            problems.append(
                "학점을 결정할 수 없음"
            )

        confidence = (
            extract_row_confidence(
                row_observations
            )
        )

        if problems:
            warnings.append(
                f"page {page_number} / "
                f"{anchor.code}: "
                + ", ".join(
                    problems
                )
            )

            continue

        assert (
            current_grade
            is not None
        )
        assert (
            current_semester
            is not None
        )
        assert (
            completion_type
            is not None
        )
        assert (
            credit
            is not None
        )

        rows.append(
            CourseRow(
                page=page_number,
                grade=current_grade,
                semester=current_semester,
                completion_type=(
                    completion_type
                ),
                course_code=anchor.code,
                course_name=course_name,
                credits=credit,
                ocr_confidence=(
                    confidence
                ),
            )
        )

    return (
        rows,
        warnings,
        current_grade,
        current_semester,
    )


def extract_courses(
    document: fitz.Document,
    start_page: int,
    end_page: int,
) -> tuple[
    list[
        CourseRow
    ],
    list[
        str
    ],
    dict[
        int,
        int,
    ],
]:
    rows: list[
        CourseRow
    ] = []

    warnings: list[
        str
    ] = []

    anchor_counts: dict[
        int,
        int
    ] = {}

    current_grade: int | None = None
    current_semester: int | None = None

    with tempfile.TemporaryDirectory() as temp:
        temp_dir = Path(
            temp
        )

        for page_number in range(
            start_page,
            end_page + 1,
        ):
            page = document[
                page_number - 1
            ]

            image_path = (
                temp_dir
                / (
                    f"page_"
                    f"{page_number}.png"
                )
            )

            render_page(
                page,
                image_path,
            )

            observations = (
                recognize_image(
                    image_path
                )
            )

            anchors = (
                find_course_anchors(
                    observations
                )
            )

            anchor_counts[
                page_number
            ] = len(
                anchors
            )

            (
                page_rows,
                page_warnings,
                current_grade,
                current_semester,
            ) = extract_page_rows(
                page,
                page_number,
                observations,
                current_grade,
                current_semester,
            )

            rows.extend(
                page_rows
            )

            warnings.extend(
                page_warnings
            )

    return (
        rows,
        warnings,
        anchor_counts,
    )


def validate_courses(
    rows: list[
        CourseRow
    ],
) -> ValidationResult:
    invalid_course_codes: list[
        str
    ] = []

    invalid_grades: list[
        str
    ] = []

    invalid_semesters: list[
        str
    ] = []

    invalid_completion_types: list[
        str
    ] = []

    missing_course_names: list[
        str
    ] = []

    invalid_credits: list[
        str
    ] = []

    duplicate_rows: list[
        str
    ] = []

    low_confidence_rows: list[
        str
    ] = []

    seen_rows: set[
        tuple[
            int,
            int,
            int,
            str,
            str,
        ]
    ] = set()

    for row in rows:
        identifier = (
            f"page {row.page} / "
            f"{row.course_code}"
        )

        if not COURSE_CODE_RE.fullmatch(
            row.course_code
        ):
            invalid_course_codes.append(
                identifier
            )

        if row.grade not in range(
            1,
            7,
        ):
            invalid_grades.append(
                identifier
            )

        if row.semester not in {
            1,
            2,
        }:
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

        if not (
            0
            <= row.credits
            <= 10
        ):
            invalid_credits.append(
                identifier
            )

        if (
            row.ocr_confidence
            < 0.50
        ):
            low_confidence_rows.append(
                (
                    f"{identifier}: "
                    f"{row.ocr_confidence:.3f}"
                )
            )

        row_key = (
            row.page,
            row.grade,
            row.semester,
            row.completion_type,
            row.course_code,
        )

        if row_key in seen_rows:
            duplicate_rows.append(
                identifier
            )
        else:
            seen_rows.add(
                row_key
            )

    return ValidationResult(
        total_rows=len(
            rows
        ),
        invalid_course_codes=(
            invalid_course_codes
        ),
        invalid_grades=(
            invalid_grades
        ),
        invalid_semesters=(
            invalid_semesters
        ),
        invalid_completion_types=(
            invalid_completion_types
        ),
        missing_course_names=(
            missing_course_names
        ),
        invalid_credits=(
            invalid_credits
        ),
        duplicate_rows=(
            duplicate_rows
        ),
        low_confidence_rows=(
            low_confidence_rows
        ),
    )


def count_rows_by_page(
    rows: list[
        CourseRow
    ],
) -> dict[
    int,
    int,
]:
    counts: dict[
        int,
        int
    ] = {}

    for row in rows:
        counts[
            row.page
        ] = (
            counts.get(
                row.page,
                0,
            )
            + 1
        )

    return counts


def write_courses_csv(
    year: int,
    pdf_path: Path,
    rows: list[
        CourseRow
    ],
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
            fieldnames=(
                OUTPUT_COLUMNS
            ),
        )

        writer.writeheader()

        for row in rows:
            writer.writerow(
                {
                    "entry_year": "",
                    "grade": (
                        row.grade
                    ),
                    "semester": (
                        row.semester
                    ),
                    "course_name": (
                        row.course_name
                    ),
                    "course_code": (
                        row.course_code
                    ),
                    "completion_type": (
                        row.completion_type
                    ),
                    "credits": (
                        f"{row.credits:g}"
                    ),
                    "notes": (
                        f"source={pdf_path.name}; "
                        f"page={row.page}; "
                        "extractor=vision"
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
    rows: list[
        CourseRow
    ],
    warnings: list[
        str
    ],
    anchor_counts: dict[
        int,
        int
    ],
    validation: ValidationResult,
) -> Path:
    output_dir = (
        EXTRACTED_CURRICULUM_DIR
        / str(year)
    )

    output_path = (
        output_dir
        / "vision_extraction_report.txt"
    )

    row_counts = count_rows_by_page(
        rows
    )

    total_anchors = sum(
        anchor_counts.values()
    )

    total_credits = sum(
        row.credits
        for row in rows
    )

    required_credits = sum(
        row.credits
        for row in rows
        if (
            row.completion_type
            == "전필"
        )
    )

    elective_credits = sum(
        row.credits
        for row in rows
        if (
            row.completion_type
            == "전선"
        )
    )

    lines = [
        "Vision curriculum extraction report",
        "===================================",
        "",
        f"academic year: {year}",
        (
            f"source PDF: "
            f"{pdf_path.name}"
        ),
        (
            "course table pages: "
            f"{start_page}-{end_page}"
        ),
        "",
        "Extraction",
        "----------",
        (
            "Vision course anchors: "
            f"{total_anchors}"
        ),
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
            "duplicate rows: "
            f"{len(validation.duplicate_rows)}"
        ),
        (
            "low confidence rows: "
            f"{len(validation.low_confidence_rows)}"
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
            (
                f"page {page_number}: "
                f"anchors="
                f"{anchor_counts.get(page_number, 0)}, "
                f"rows="
                f"{row_counts.get(page_number, 0)}"
            )
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
                        and (
                            total_anchors
                            == len(rows)
                        )
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
            "Duplicate rows",
            validation.duplicate_rows,
        ),
        (
            "Low confidence rows",
            validation.low_confidence_rows,
        ),
    ]

    for (
        title,
        problems,
    ) in problem_groups:
        if not problems:
            continue

        lines.append(
            title
        )

        lines.append(
            "-" * len(
                title
            )
        )

        for problem in problems:
            lines.append(
                problem
            )

        lines.append(
            ""
        )

    output_path.write_text(
        "\n".join(
            lines
        ),
        encoding="utf-8",
    )

    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "macOS Vision OCR을 사용하여 "
            "교육과정 PDF의 교과목 표를 "
            "추출합니다."
        )
    )

    parser.add_argument(
        "--year",
        type=int,
        required=True,
    )

    parser.add_argument(
        "--course-pages",
        default="3-12",
        help=(
            "교과목 표 PDF 페이지 범위 "
            "(예: 3-12)"
        ),
    )

    args = parser.parse_args()

    (
        start_page,
        end_page,
    ) = parse_page_range(
        args.course_pages
    )

    pdf_path = (
        find_curriculum_pdf(
            args.year
        )
    )

    document = fitz.open(
        pdf_path
    )

    try:
        if end_page > (
            document.page_count
        ):
            raise ValueError(
                f"PDF는 "
                f"{document.page_count}페이지인데 "
                f"{end_page}페이지를 "
                "요청했습니다."
            )

        (
            rows,
            warnings,
            anchor_counts,
        ) = extract_courses(
            document,
            start_page,
            end_page,
        )
    finally:
        document.close()

    validation = (
        validate_courses(
            rows
        )
    )

    csv_path = (
        write_courses_csv(
            args.year,
            pdf_path,
            rows,
        )
    )

    report_path = (
        write_report(
            args.year,
            pdf_path,
            start_page,
            end_page,
            rows,
            warnings,
            anchor_counts,
            validation,
        )
    )

    total_anchors = sum(
        anchor_counts.values()
    )

    print()
    print(
        "Vision curriculum extraction"
    )
    print(
        "----------------------------"
    )
    print(
        f"year: {args.year}"
    )
    print(
        "course pages: "
        f"{start_page}-{end_page}"
    )
    print(
        "Vision anchors: "
        f"{total_anchors}"
    )
    print(
        "rows extracted: "
        f"{len(rows)}"
    )
    print(
        "warnings: "
        f"{len(warnings)}"
    )
    print(
        "validation: "
        + (
            "PASS"
            if (
                validation.passed
                and not warnings
                and (
                    total_anchors
                    == len(rows)
                )
            )
            else "REVIEW REQUIRED"
        )
    )
    print(
        f"courses: {csv_path}"
    )
    print(
        f"report:  {report_path}"
    )


if __name__ == "__main__":
    main()
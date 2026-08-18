from __future__ import annotations

import argparse
import csv
import re
from dataclasses import dataclass
from pathlib import Path

import fitz


PROJECT_ROOT = Path(__file__).resolve().parents[1]

RAW_CURRICULUM_DIR = (
    PROJECT_ROOT
    / "data"
    / "raw"
    / "curriculum_pdfs"
)

EXTRACTED_CURRICULUM_DIR = (
    PROJECT_ROOT
    / "data"
    / "extracted"
    / "curriculum"
)

COURSE_CODE_RE = re.compile(
    r"^[A-Z]{3}\d{3}$"
)

YEAR_RE = re.compile(
    r"^(19|20)\d{2}$"
)

RELATION_COLUMNS = [
    "relation_type",
    "old_course_code",
    "old_course_name",
    "new_course_code",
    "new_course_name",
    "designation_year",
    "cross_designation",
    "source_file",
    "source_page",
    "source_row",
    "needs_review",
    "review_reason",
]


@dataclass
class RelationRow:
    relation_type: str
    old_course_code: str
    old_course_name: str
    new_course_code: str
    new_course_name: str
    designation_year: int
    cross_designation: str
    source_page: int
    source_row: int
    needs_review: bool = False
    review_reason: str = ""


def find_pdf(
    year: int,
) -> Path:
    year_dir = (
        RAW_CURRICULUM_DIR
        / str(year)
    )

    pdfs = sorted(
        year_dir.glob("*.pdf")
    )

    if len(pdfs) != 1:
        raise RuntimeError(
            f"{year}학년도 PDF가 "
            f"정확히 1개여야 합니다: "
            f"{pdfs}"
        )

    return pdfs[0]


def parse_page_range(
    value: str,
) -> tuple[int, int]:
    match = re.fullmatch(
        r"(\d+)-(\d+)",
        value,
    )

    if match is None:
        raise ValueError(
            "페이지 범위는 "
            "예: 16-17 형식이어야 합니다."
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


def get_heading_positions(
    page: fitz.Page,
) -> list[tuple[float, str]]:
    positions: list[tuple[float, str]] = []

    for word in page.get_text("words"):
        text = word[4].strip()

        if "대체교과목" in text:
            positions.append(
                (
                    word[1],
                    "substitute",
                )
            )

        if "동일교과목" in text:
            positions.append(
                (
                    word[1],
                    "equivalent",
                )
            )

    positions.sort(
        key=lambda item: item[0]
    )

    return positions


def get_old_code_words(
    page: fitz.Page,
    y_start: float,
    y_end: float,
) -> list[tuple]:
    words = page.get_text("words")

    result = []

    for word in words:
        x0 = word[0]
        y0 = word[1]
        text = word[4].strip()

        if not (
            y_start <= y0 < y_end
        ):
            continue

        if not (
            70 <= x0 < 130
        ):
            continue

        if not COURSE_CODE_RE.fullmatch(
            text
        ):
            continue

        result.append(word)

    result.sort(
        key=lambda word: word[1]
    )

    return result


def words_in_region(
    words: list[tuple],
    x_start: float,
    x_end: float,
    y_start: float,
    y_end: float,
) -> list[tuple]:
    result = []

    for word in words:
        x0 = word[0]
        y0 = word[1]

        if not (
            x_start <= x0 < x_end
        ):
            continue

        if not (
            y_start <= y0 < y_end
        ):
            continue

        text = word[4].strip()

        if not text:
            continue

        result.append(word)

    result.sort(
        key=lambda word: (
            word[1],
            word[0],
        )
    )

    return result


def region_text(
    words: list[tuple],
    x_start: float,
    x_end: float,
    y_start: float,
    y_end: float,
) -> str:
    selected = words_in_region(
        words,
        x_start,
        x_end,
        y_start,
        y_end,
    )

    return " ".join(
        word[4].strip()
        for word in selected
    ).strip()


def get_single_code(
    words: list[tuple],
    x_start: float,
    x_end: float,
    y_start: float,
    y_end: float,
) -> str | None:
    selected = words_in_region(
        words,
        x_start,
        x_end,
        y_start,
        y_end,
    )

    codes = [
        word[4].strip()
        for word in selected
        if COURSE_CODE_RE.fullmatch(
            word[4].strip()
        )
    ]

    if len(codes) != 1:
        return None

    return codes[0]


def get_designation_year(
    words: list[tuple],
    y_start: float,
    y_end: float,
) -> int | None:
    selected = words_in_region(
        words,
        435,
        495,
        y_start,
        y_end,
    )

    years = [
        word[4].strip()
        for word in selected
        if YEAR_RE.fullmatch(
            word[4].strip()
        )
    ]

    if len(years) != 1:
        return None

    return int(years[0])


def has_cross_designation(
    words: list[tuple],
    y_start: float,
    y_end: float,
) -> bool:
    selected = words_in_region(
        words,
        500,
        560,
        y_start,
        y_end,
    )

    return any(
        word[4].strip() == "○"
        for word in selected
    )


def get_source_row_number(
    words: list[tuple],
    y_start: float,
    y_end: float,
) -> int | None:
    selected = words_in_region(
        words,
        40,
        70,
        y_start,
        y_end,
    )

    values = []

    for word in selected:
        text = word[4].strip()

        if not text.isdigit():
            continue

        value = int(text)

        if 1 <= value <= 200:
            values.append(value)

    if len(values) != 1:
        return None

    return values[0]


def normalize_name(
    value: str,
) -> str:
    return re.sub(
        r"\s+",
        " ",
        value,
    ).strip()


def parse_relation_row(
    words: list[tuple],
    relation_type: str,
    page_number: int,
    row_top: float,
    row_bottom: float,
) -> RelationRow | None:
    old_code = get_single_code(
        words,
        70,
        130,
        row_top,
        row_bottom,
    )

    new_code = get_single_code(
        words,
        255,
        315,
        row_top,
        row_bottom,
    )

    old_name = normalize_name(
        region_text(
            words,
            130,
            255,
            row_top,
            row_bottom,
        )
    )

    new_name = normalize_name(
        region_text(
            words,
            315,
            435,
            row_top,
            row_bottom,
        )
    )

    designation_year = (
        get_designation_year(
            words,
            row_top,
            row_bottom,
        )
    )

    source_row = (
        get_source_row_number(
            words,
            row_top,
            row_bottom,
        )
    )

    problems: list[str] = []

    if old_code is None:
        problems.append(
            "구 교과목 코드를 "
            "정확히 1개 검출하지 못함"
        )

    if new_code is None:
        problems.append(
            "신규 교과목 코드를 "
            "정확히 1개 검출하지 못함"
        )

    if not old_name:
        problems.append(
            "구 교과목명이 비어 있음"
        )

    if not new_name:
        problems.append(
            "신규 교과목명이 비어 있음"
        )

    if designation_year is None:
        problems.append(
            "지정 학년도를 "
            "정확히 검출하지 못함"
        )

    if source_row is None:
        problems.append(
            "원본 표 순번을 "
            "정확히 검출하지 못함"
        )

    if old_code is None or new_code is None:
        return None

    cross_designation = ""

    if has_cross_designation(
        words,
        row_top,
        row_bottom,
    ):
        if relation_type == "substitute":
            cross_designation = (
                "equivalent"
            )
        elif relation_type == "equivalent":
            cross_designation = (
                "substitute"
            )

    return RelationRow(
        relation_type=relation_type,
        old_course_code=old_code,
        old_course_name=old_name,
        new_course_code=new_code,
        new_course_name=new_name,
        designation_year=(
            designation_year or 0
        ),
        cross_designation=(
            cross_designation
        ),
        source_page=page_number,
        source_row=(
            source_row or 0
        ),
        needs_review=bool(problems),
        review_reason="; ".join(
            problems
        ),
    )


def extract_section(
    page: fitz.Page,
    page_number: int,
    relation_type: str,
    y_start: float,
    y_end: float,
) -> list[RelationRow]:
    words = page.get_text(
        "words"
    )

    old_code_words = get_old_code_words(
        page,
        y_start,
        y_end,
    )

    rows: list[RelationRow] = []

    if not old_code_words:
        return rows

    code_ys = [
        word[1]
        for word in old_code_words
    ]

    for index, code_word in enumerate(
        old_code_words
    ):
        code_y = code_word[1]

        if index == 0:
            row_top = y_start
        else:
            previous_y = (
                code_ys[index - 1]
            )

            row_top = (
                previous_y + code_y
            ) / 2

        if index == (
            len(old_code_words) - 1
        ):
            row_bottom = y_end
        else:
            next_y = (
                code_ys[index + 1]
            )

            row_bottom = (
                code_y + next_y
            ) / 2

        row = parse_relation_row(
            words,
            relation_type,
            page_number,
            row_top,
            row_bottom,
        )

        if row is not None:
            rows.append(row)

    return rows


def extract_relations(
    document: fitz.Document,
    start_page: int,
    end_page: int,
) -> list[RelationRow]:
    rows: list[RelationRow] = []

    current_relation_type: str | None = None

    for page_number in range(
        start_page,
        end_page + 1,
    ):
        page = document[
            page_number - 1
        ]

        headings = get_heading_positions(
            page
        )

        sections: list[
            tuple[
                str,
                float,
                float,
            ]
        ] = []

        if headings:
            for index, (
                heading_y,
                relation_type,
            ) in enumerate(headings):
                section_start = (
                    heading_y + 25
                )

                if (
                    index + 1
                    < len(headings)
                ):
                    section_end = (
                        headings[
                            index + 1
                        ][0]
                        - 5
                    )
                else:
                    section_end = (
                        page.rect.height
                    )

                sections.append(
                    (
                        relation_type,
                        section_start,
                        section_end,
                    )
                )

                current_relation_type = (
                    relation_type
                )

        elif current_relation_type:
            sections.append(
                (
                    current_relation_type,
                    80,
                    page.rect.height,
                )
            )

        else:
            raise RuntimeError(
                f"page {page_number}: "
                "relation 표 종류를 "
                "결정할 수 없습니다."
            )

        for (
            relation_type,
            section_start,
            section_end,
        ) in sections:
            rows.extend(
                extract_section(
                    page,
                    page_number,
                    relation_type,
                    section_start,
                    section_end,
                )
            )

    return rows


def validate_relations(
    rows: list[RelationRow],
) -> list[str]:
    problems: list[str] = []

    for row in rows:
        identifier = (
            f"page {row.source_page} "
            f"row {row.source_row}: "
            f"{row.old_course_code} -> "
            f"{row.new_course_code}"
        )

        if row.relation_type not in {
            "substitute",
            "equivalent",
        }:
            problems.append(
                f"{identifier}: "
                "잘못된 relation_type"
            )

        if not COURSE_CODE_RE.fullmatch(
            row.old_course_code
        ):
            problems.append(
                f"{identifier}: "
                "잘못된 구 교과목 코드"
            )

        if not COURSE_CODE_RE.fullmatch(
            row.new_course_code
        ):
            problems.append(
                f"{identifier}: "
                "잘못된 신규 교과목 코드"
            )

        if not row.old_course_name:
            problems.append(
                f"{identifier}: "
                "구 교과목명 없음"
            )

        if not row.new_course_name:
            problems.append(
                f"{identifier}: "
                "신규 교과목명 없음"
            )

        if not (
            1900
            <= row.designation_year
            <= 2100
        ):
            problems.append(
                f"{identifier}: "
                "지정 학년도 이상"
            )

        if row.source_row <= 0:
            problems.append(
                f"{identifier}: "
                "source_row 없음"
            )

        if row.needs_review:
            problems.append(
                f"{identifier}: "
                f"{row.review_reason}"
            )

    seen_exact: set[
        tuple[
            str,
            str,
            str,
            int,
        ]
    ] = set()

    for row in rows:
        key = (
            row.relation_type,
            row.old_course_code,
            row.new_course_code,
            row.designation_year,
        )

        if key in seen_exact:
            problems.append(
                "exact duplicate relation: "
                f"{key}"
            )
        else:
            seen_exact.add(key)

    return problems


def write_relations_csv(
    year: int,
    pdf_path: Path,
    rows: list[RelationRow],
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
        / "course_relations.csv"
    )

    with output_path.open(
        "w",
        encoding="utf-8-sig",
        newline="",
    ) as file:
        writer = csv.DictWriter(
            file,
            fieldnames=(
                RELATION_COLUMNS
            ),
        )

        writer.writeheader()

        for row in rows:
            writer.writerow(
                {
                    "relation_type": (
                        row.relation_type
                    ),
                    "old_course_code": (
                        row.old_course_code
                    ),
                    "old_course_name": (
                        row.old_course_name
                    ),
                    "new_course_code": (
                        row.new_course_code
                    ),
                    "new_course_name": (
                        row.new_course_name
                    ),
                    "designation_year": (
                        row.designation_year
                    ),
                    "cross_designation": (
                        row.cross_designation
                    ),
                    "source_file": (
                        pdf_path.name
                    ),
                    "source_page": (
                        row.source_page
                    ),
                    "source_row": (
                        row.source_row
                    ),
                    "needs_review": (
                        "yes"
                        if row.needs_review
                        else "no"
                    ),
                    "review_reason": (
                        row.review_reason
                    ),
                }
            )

    return output_path


def write_report(
    year: int,
    pdf_path: Path,
    start_page: int,
    end_page: int,
    rows: list[RelationRow],
    problems: list[str],
) -> Path:
    output_dir = (
        EXTRACTED_CURRICULUM_DIR
        / str(year)
    )

    output_path = (
        output_dir
        / "relation_extraction_report.txt"
    )

    substitute_rows = [
        row
        for row in rows
        if row.relation_type
        == "substitute"
    ]

    equivalent_rows = [
        row
        for row in rows
        if row.relation_type
        == "equivalent"
    ]

    cross_designated = [
        row
        for row in rows
        if row.cross_designation
    ]

    review_rows = [
        row
        for row in rows
        if row.needs_review
    ]

    lines = [
        "Course relation extraction report",
        "=================================",
        "",
        f"academic year: {year}",
        f"source PDF: {pdf_path.name}",
        (
            "relation pages: "
            f"{start_page}-{end_page}"
        ),
        "",
        "Extraction",
        "----------",
        (
            "total relations: "
            f"{len(rows)}"
        ),
        (
            "substitute relations: "
            f"{len(substitute_rows)}"
        ),
        (
            "equivalent relations: "
            f"{len(equivalent_rows)}"
        ),
        (
            "cross-designated relations: "
            f"{len(cross_designated)}"
        ),
        (
            "rows needing review: "
            f"{len(review_rows)}"
        ),
        (
            "validation problems: "
            f"{len(problems)}"
        ),
        "",
        (
            "RESULT: "
            + (
                "PASS"
                if not problems
                else "REVIEW REQUIRED"
            )
        ),
        "",
    ]

    if problems:
        lines.extend(
            [
                "Problems",
                "--------",
            ]
        )

        for problem in problems:
            lines.append(
                problem
            )

        lines.append("")

    lines.extend(
        [
            "Relations",
            "---------",
        ]
    )

    for row in rows:
        cross = (
            f" + {row.cross_designation}"
            if row.cross_designation
            else ""
        )

        lines.append(
            f"{row.relation_type}{cross}: "
            f"{row.old_course_code} "
            f"{row.old_course_name} "
            f"-> "
            f"{row.new_course_code} "
            f"{row.new_course_name} "
            f"({row.designation_year}) "
            f"[page {row.source_page}, "
            f"row {row.source_row}]"
        )

    output_path.write_text(
        "\n".join(lines) + "\n",
        encoding="utf-8",
    )

    return output_path



def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "약학과 교육과정 PDF에서 "
            "동일/대체교과목 관계를 "
            "추출합니다."
        )
    )

    parser.add_argument(
        "--year",
        type=int,
        required=True,
        help=(
            "학년도 "
            "(예: 2024)"
        ),
    )

    parser.add_argument(
        "--pages",
        default="16-17",
        help=(
            "relation 표 페이지 범위 "
            "(예: 16-17)"
        ),
    )

    args = parser.parse_args()

    start_page, end_page = (
        parse_page_range(
            args.pages
        )
    )

    pdf_path = find_pdf(
        args.year
    )

    document = fitz.open(
        pdf_path
    )

    if end_page > document.page_count:
        raise ValueError(
            f"PDF는 "
            f"{document.page_count}페이지인데 "
            f"{end_page}페이지를 "
            "요청했습니다."
        )

    rows = extract_relations(
        document,
        start_page,
        end_page,
    )

    problems = validate_relations(
        rows
    )

    csv_path = write_relations_csv(
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
        problems,
    )

    substitute_count = sum(
        1
        for row in rows
        if row.relation_type
        == "substitute"
    )

    equivalent_count = sum(
        1
        for row in rows
        if row.relation_type
        == "equivalent"
    )

    print()
    print(
        "Course relation extraction"
    )
    print(
        "--------------------------"
    )
    print(
        f"year: {args.year}"
    )
    print(
        f"pages: "
        f"{start_page}-{end_page}"
    )
    print(
        f"relations: {len(rows)}"
    )
    print(
        f"substitute: "
        f"{substitute_count}"
    )
    print(
        f"equivalent: "
        f"{equivalent_count}"
    )
    print(
        f"problems: {len(problems)}"
    )
    print(
        "validation: "
        + (
            "PASS"
            if not problems
            else "REVIEW REQUIRED"
        )
    )
    print(
        f"relations: {csv_path}"
    )
    print(
        f"report:    {report_path}"
    )


if __name__ == "__main__":
    main()

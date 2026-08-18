from __future__ import annotations

import argparse
import re
from pathlib import Path

import fitz


PROJECT_ROOT = Path(__file__).resolve().parents[2]

RAW_CURRICULUM_DIR = (
    PROJECT_ROOT
    / "data"
    / "raw"
    / "curriculum_pdfs"
)

COURSE_CODE_RE = re.compile(
    r"^(ADA|ADB)\d{3}$"
)


def find_pdf(year: int) -> Path:
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


def print_code_context(
    page: fitz.Page,
    page_number: int,
) -> None:
    words = page.get_text(
        "words"
    )

    code_words = [
        word
        for word in words
        if COURSE_CODE_RE.fullmatch(
            word[4].strip()
        )
    ]

    print()
    print(
        f"PAGE {page_number}"
    )
    print(
        "=" * 72
    )

    print(
        f"course-code tokens: "
        f"{len(code_words)}"
    )
    print()

    for code_word in code_words:
        code_x0 = code_word[0]
        code_y0 = code_word[1]
        code = code_word[4].strip()

        nearby_words = []

        for word in words:
            x0 = word[0]
            y0 = word[1]

            if abs(
                y0 - code_y0
            ) > 4:
                continue

            if not (
                code_x0 - 180
                <= x0
                <= code_x0 + 420
            ):
                continue

            nearby_words.append(
                word
            )

        nearby_words.sort(
            key=lambda word: word[0]
        )

        context = " | ".join(
            (
                f"{word[4].strip()}"
                f"@x={word[0]:.1f}"
            )
            for word in nearby_words
            if word[4].strip()
        )

        print(
            f"{code}@"
            f"x={code_x0:.1f}, "
            f"y={code_y0:.1f}"
        )
        print(
            f"  {context}"
        )


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "동일/대체교과목 표의 "
            "교과목 코드와 주변 텍스트 "
            "좌표를 확인합니다."
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
            f"요청했습니다."
        )

    print()
    print(
        "Course relation PDF probe"
    )
    print(
        "-------------------------"
    )
    print(
        f"year: {args.year}"
    )
    print(
        f"file: {pdf_path}"
    )
    print(
        f"pages: "
        f"{start_page}-{end_page}"
    )

    for page_number in range(
        start_page,
        end_page + 1,
    ):
        page = document[
            page_number - 1
        ]

        print_code_context(
            page,
            page_number,
        )


if __name__ == "__main__":
    main()
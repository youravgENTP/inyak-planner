from __future__ import annotations

import argparse
import re
from pathlib import Path

import fitz


PROJECT_ROOT = Path(__file__).resolve().parents[1]

RAW_CURRICULUM_DIR = (
    PROJECT_ROOT
    / "data"
    / "raw"
    / "curriculum_pdfs"
)

COURSE_CODE_RE = re.compile(r"^(ADA|ADB)\d{3}$")


def find_pdf(year: int) -> Path:
    year_dir = RAW_CURRICULUM_DIR / str(year)

    pdfs = sorted(year_dir.glob("*.pdf"))

    if len(pdfs) != 1:
        raise RuntimeError(
            f"{year}학년도 PDF가 정확히 1개여야 합니다: "
            f"{pdfs}"
        )

    return pdfs[0]


def inspect_page(
    page: fitz.Page,
    page_number: int,
) -> list[str]:
    words = page.get_text("words")

    course_codes: list[str] = []

    for word in words:
        text = word[4].strip()

        if COURSE_CODE_RE.fullmatch(text):
            course_codes.append(text)

    print(
        f"page {page_number:>2}: "
        f"{len(course_codes):>2} course-code tokens"
    )

    if course_codes:
        print(
            "       "
            + ", ".join(course_codes)
        )

    return course_codes


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "학년도별 약학과 교육과정 PDF의 "
            "텍스트 레이어와 교과목 코드 검출 상태를 확인합니다."
        )
    )

    parser.add_argument(
        "--year",
        type=int,
        required=True,
        help="학년도 (예: 2024)",
    )

    args = parser.parse_args()

    pdf_path = find_pdf(args.year)

    print()
    print("Curriculum PDF probe")
    print("--------------------")
    print(f"year: {args.year}")
    print(f"file: {pdf_path}")
    print()

    document = fitz.open(pdf_path)

    total_codes = 0
    pages_with_codes = 0

    for index, page in enumerate(
        document,
        start=1,
    ):
        codes = inspect_page(
            page,
            index,
        )

        if codes:
            pages_with_codes += 1
            total_codes += len(codes)

    print()
    print("--------------------")
    print(
        f"pages: {document.page_count}"
    )
    print(
        f"pages with course codes: "
        f"{pages_with_codes}"
    )
    print(
        f"course-code tokens found: "
        f"{total_codes}"
    )


if __name__ == "__main__":
    main()
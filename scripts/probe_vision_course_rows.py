from __future__ import annotations

import argparse
import re
import tempfile
from pathlib import Path

import fitz

from probe_vision_ocr import recognize_image


PROJECT_ROOT = Path(__file__).resolve().parents[1]

RAW_CURRICULUM_DIR = (
    PROJECT_ROOT
    / "data"
    / "raw"
    / "curriculum_pdfs"
)

COURSE_CODE_RE = re.compile(
    r"^(ADA|ADB)\d{3}$"
)

HANGUL_RE = re.compile(
    r"[가-힣]"
)


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


def find_course_code_words(
    page: fitz.Page,
) -> list[tuple]:
    words = page.get_text(
        "words"
    )

    result = []

    for word in words:
        text = word[4].strip()

        if COURSE_CODE_RE.fullmatch(
            text
        ):
            result.append(word)

    result.sort(
        key=lambda word: word[1]
    )

    return result


def render_crop(
    page: fitz.Page,
    clip: fitz.Rect,
    output_path: Path,
) -> None:
    matrix = fitz.Matrix(
        4.0,
        4.0,
    )

    pixmap = page.get_pixmap(
        matrix=matrix,
        clip=clip,
        alpha=False,
    )

    pixmap.save(
        output_path
    )


def clean_ocr_text(
    value: str,
) -> str:
    value = value.strip()

    value = re.sub(
        r"^[•·ㆍ\-\s]+",
        "",
        value,
    )

    value = re.sub(
        r"\s+",
        " ",
        value,
    )

    return value.strip()


def recognize_completion_type(
    page: fitz.Page,
    row_top: float,
    row_bottom: float,
    temp_dir: Path,
    index: int,
) -> str:
    clip = fitz.Rect(
        page.rect.width * 0.115,
        row_top,
        page.rect.width * 0.155,
        row_bottom,
    )

    image_path = (
        temp_dir
        / f"completion_{index}.png"
    )

    render_crop(
        page,
        clip,
        image_path,
    )

    results = recognize_image(
        image_path
    )

    texts = [
        clean_ocr_text(text)
        for _, _, text, _
        in results
    ]

    for text in texts:
        if "전필" in text:
            return "전필"

        if "전선" in text:
            return "전선"

    return "?"


def recognize_course_name(
    page: fitz.Page,
    row_top: float,
    row_bottom: float,
    temp_dir: Path,
    index: int,
) -> str:
    clip = fitz.Rect(
        page.rect.width * 0.325,
        row_top,
        page.rect.width * 0.675,
        row_bottom,
    )

    image_path = (
        temp_dir
        / f"name_{index}.png"
    )

    render_crop(
        page,
        clip,
        image_path,
    )

    results = recognize_image(
        image_path
    )

    korean_lines = []

    for (
        y,
        x,
        text,
        confidence,
    ) in results:
        cleaned = clean_ocr_text(
            text
        )

        if not cleaned:
            continue

        if not HANGUL_RE.search(
            cleaned
        ):
            continue

        korean_lines.append(
            (
                y,
                x,
                cleaned,
                confidence,
            )
        )

    korean_lines.sort(
        key=lambda item: (
            -item[0],
            item[1],
        )
    )

    return " ".join(
        item[2]
        for item in korean_lines
    ).strip()


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "PyMuPDF 교과목 코드 위치를 "
            "anchor로 삼아 Vision OCR로 "
            "이수구분과 교과목명을 확인합니다."
        )
    )

    parser.add_argument(
        "--year",
        type=int,
        required=True,
    )

    parser.add_argument(
        "--page",
        type=int,
        required=True,
    )

    args = parser.parse_args()

    pdf_path = find_pdf(
        args.year
    )

    document = fitz.open(
        pdf_path
    )

    page = document[
        args.page - 1
    ]

    code_words = (
        find_course_code_words(
            page
        )
    )

    print()
    print(
        "Vision course-row probe"
    )
    print(
        "-----------------------"
    )
    print(
        f"year: {args.year}"
    )
    print(
        f"page: {args.page}"
    )
    print(
        f"course rows: "
        f"{len(code_words)}"
    )
    print()

    if not code_words:
        return

    code_ys = [
        (
            word[1]
            + word[3]
        ) / 2
        for word in code_words
    ]

    with tempfile.TemporaryDirectory() as temp:
        temp_dir = Path(
            temp
        )

        for index, word in enumerate(
            code_words
        ):
            code = word[4].strip()

            center_y = (
                word[1]
                + word[3]
            ) / 2

            if index == 0:
                next_y = (
                    code_ys[index + 1]
                )

                spacing = (
                    next_y
                    - center_y
                )

                row_top = (
                    center_y
                    - spacing / 2
                )
            else:
                previous_y = (
                    code_ys[index - 1]
                )

                row_top = (
                    previous_y
                    + center_y
                ) / 2

            if index == (
                len(code_words) - 1
            ):
                previous_y = (
                    code_ys[index - 1]
                )

                spacing = (
                    center_y
                    - previous_y
                )

                row_bottom = (
                    center_y
                    + spacing / 2
                )
            else:
                next_y = (
                    code_ys[index + 1]
                )

                row_bottom = (
                    center_y
                    + next_y
                ) / 2

            completion_type = (
                recognize_completion_type(
                    page,
                    row_top,
                    row_bottom,
                    temp_dir,
                    index,
                )
            )

            course_name = (
                recognize_course_name(
                    page,
                    row_top,
                    row_bottom,
                    temp_dir,
                    index,
                )
            )

            print(
                f"{code} | "
                f"{completion_type} | "
                f"{course_name}"
            )


if __name__ == "__main__":
    main()
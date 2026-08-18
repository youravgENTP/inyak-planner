from __future__ import annotations

import argparse
import tempfile
from pathlib import Path

import fitz

from scripts.common.curriculum_vision import (
    find_curriculum_pdf,
    recognize_image,
    render_page,
)


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "macOS Vision OCR로 "
            "교육과정 PDF 한 페이지의 "
            "한글 인식 상태를 확인합니다."
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

    pdf_path = find_curriculum_pdf(
        args.year
    )

    document = fitz.open(
        pdf_path
    )

    try:
        if not (
            1
            <= args.page
            <= document.page_count
        ):
            raise ValueError(
                "PDF 페이지 범위는 "
                f"1-{document.page_count}입니다."
            )

        page = document[
            args.page - 1
        ]

        with tempfile.TemporaryDirectory() as temp_dir:
            image_path = (
                Path(temp_dir)
                / "page.png"
            )

            render_page(
                page,
                image_path,
            )

            results = recognize_image(
                image_path
            )
    finally:
        document.close()

    print()
    print(
        "Vision OCR probe"
    )
    print(
        "----------------"
    )
    print(
        f"year: {args.year}"
    )
    print(
        f"page: {args.page}"
    )
    print(
        "recognized blocks: "
        f"{len(results)}"
    )
    print()

    for (
        y,
        x,
        text,
        confidence,
    ) in results:
        print(
            f"y={y:0.4f} "
            f"x={x:0.4f} "
            f"conf={confidence:0.3f} "
            f"| {text}"
        )


if __name__ == "__main__":
    main()
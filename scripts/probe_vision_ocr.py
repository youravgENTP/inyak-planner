from __future__ import annotations

import argparse
import tempfile
from pathlib import Path

import fitz
import Quartz
import Vision
from Foundation import NSURL


PROJECT_ROOT = Path(__file__).resolve().parents[1]

RAW_CURRICULUM_DIR = (
    PROJECT_ROOT
    / "data"
    / "raw"
    / "curriculum_pdfs"
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


def render_page(
    page: fitz.Page,
    output_path: Path,
) -> None:
    matrix = fitz.Matrix(
        3.0,
        3.0,
    )

    pixmap = page.get_pixmap(
        matrix=matrix,
        alpha=False,
    )

    pixmap.save(
        output_path
    )


def recognize_image(
    image_path: Path,
) -> list[
    tuple[
        float,
        float,
        str,
        float,
    ]
]:
    image_url = NSURL.fileURLWithPath_(
        str(image_path)
    )

    image_source = (
        Quartz.CGImageSourceCreateWithURL(
            image_url,
            None,
        )
    )

    if image_source is None:
        raise RuntimeError(
            "CGImageSource를 "
            "생성할 수 없습니다."
        )

    cg_image = (
        Quartz.CGImageSourceCreateImageAtIndex(
            image_source,
            0,
            None,
        )
    )

    if cg_image is None:
        raise RuntimeError(
            "CGImage를 "
            "생성할 수 없습니다."
        )

    request = (
        Vision.VNRecognizeTextRequest.alloc()
        .init()
    )

    request.setRecognitionLevel_(
        Vision.VNRequestTextRecognitionLevelAccurate
    )

    request.setRecognitionLanguages_(
        [
            "ko-KR",
            "en-US",
        ]
    )

    request.setUsesLanguageCorrection_(
        True
    )

    handler = (
        Vision.VNImageRequestHandler.alloc()
        .initWithCGImage_options_(
            cg_image,
            None,
        )
    )

    success, error = (
        handler.performRequests_error_(
            [request],
            None,
        )
    )

    if not success:
        raise RuntimeError(
            f"Vision OCR 실패: {error}"
        )

    results = []

    observations = (
        request.results()
        or []
    )

    for observation in observations:
        candidates = (
            observation.topCandidates_(
                1
            )
        )

        if not candidates:
            continue

        candidate = candidates[0]

        text = str(
            candidate.string()
        ).strip()

        if not text:
            continue

        confidence = float(
            candidate.confidence()
        )

        box = (
            observation.boundingBox()
        )

        results.append(
            (
                float(box.origin.y),
                float(box.origin.x),
                text,
                confidence,
            )
        )

    results.sort(
        key=lambda item: (
            -item[0],
            item[1],
        )
    )

    return results


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

    pdf_path = find_pdf(
        args.year
    )

    document = fitz.open(
        pdf_path
    )

    if not (
        1
        <= args.page
        <= document.page_count
    ):
        raise ValueError(
            f"PDF 페이지 범위는 "
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
        f"recognized blocks: "
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
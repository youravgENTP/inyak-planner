from __future__ import annotations

from pathlib import Path
from typing import TypeAlias

import fitz

from scripts.common.data_paths import (
    RAW_CURRICULUM_PDFS_DIR,
)


VisionObservation: TypeAlias = tuple[
    float,
    float,
    str,
    float,
]


def find_curriculum_pdf(
    year: int,
) -> Path:
    year_dir = (
        RAW_CURRICULUM_PDFS_DIR
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
    scale: float = 3.0,
) -> None:
    matrix = fitz.Matrix(
        scale,
        scale,
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
) -> list[VisionObservation]:
    try:
        import Quartz
        import Vision
        from Foundation import NSURL
    except ImportError as exc:
        raise RuntimeError(
            "macOS Vision OCR를 사용할 수 없습니다. "
            "PyObjC의 Quartz, Vision, Foundation "
            "모듈이 필요합니다."
        ) from exc

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

    results: list[
        VisionObservation
    ] = []

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
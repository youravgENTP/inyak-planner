from __future__ import annotations

import argparse
import tempfile
from dataclasses import dataclass
from pathlib import Path

import cv2

from scripts.common.curriculum_flowchart_vision import (
    find_curriculum_flowchart_image,
)
from scripts.common.curriculum_vision import (
    recognize_image,
)


MIN_BOX_WIDTH_RATIO = 0.045
MAX_BOX_WIDTH_RATIO = 0.095

MIN_BOX_HEIGHT_RATIO = 0.018
MAX_BOX_HEIGHT_RATIO = 0.075

MIN_BOX_AREA_RATIO = 0.0008
MAX_BOX_AREA_RATIO = 0.008

COURSE_AREA_TOP_RATIO = 0.86
COURSE_AREA_BOTTOM_RATIO = 0.04

DUPLICATE_IOU_THRESHOLD = 0.80

CROP_PADDING_RATIO = 0.006


@dataclass
class Box:
    x: int
    y: int
    width: int
    height: int


@dataclass
class NormalizedBox:
    x: float
    y: float
    width: float
    height: float


def intersection_over_union(
    left: Box,
    right: Box,
) -> float:
    left_x2 = (
        left.x
        + left.width
    )

    left_y2 = (
        left.y
        + left.height
    )

    right_x2 = (
        right.x
        + right.width
    )

    right_y2 = (
        right.y
        + right.height
    )

    intersection_x1 = max(
        left.x,
        right.x,
    )

    intersection_y1 = max(
        left.y,
        right.y,
    )

    intersection_x2 = min(
        left_x2,
        right_x2,
    )

    intersection_y2 = min(
        left_y2,
        right_y2,
    )

    intersection_width = max(
        0,
        (
            intersection_x2
            - intersection_x1
        ),
    )

    intersection_height = max(
        0,
        (
            intersection_y2
            - intersection_y1
        ),
    )

    intersection_area = (
        intersection_width
        * intersection_height
    )

    if intersection_area == 0:
        return 0.0

    left_area = (
        left.width
        * left.height
    )

    right_area = (
        right.width
        * right.height
    )

    union_area = (
        left_area
        + right_area
        - intersection_area
    )

    if union_area <= 0:
        return 0.0

    return (
        intersection_area
        / union_area
    )


def deduplicate_boxes(
    boxes: list[Box],
) -> list[Box]:
    ordered = sorted(
        boxes,
        key=lambda box: (
            -(
                box.width
                * box.height
            ),
            box.y,
            box.x,
        ),
    )

    kept: list[Box] = []

    for box in ordered:
        duplicate = any(
            intersection_over_union(
                box,
                existing,
            )
            >= DUPLICATE_IOU_THRESHOLD
            for existing in kept
        )

        if duplicate:
            continue

        kept.append(
            box
        )

    kept.sort(
        key=lambda box: (
            box.x,
            box.y,
        )
    )

    return kept


def detect_course_boxes(
    image_path: Path,
) -> tuple[
    list[Box],
    int,
    int,
]:
    image = cv2.imread(
        str(image_path)
    )

    if image is None:
        raise RuntimeError(
            (
                "이미지를 읽을 수 없습니다: "
                f"{image_path}"
            )
        )

    image_height, image_width = (
        image.shape[:2]
    )

    gray = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2GRAY,
    )

    blurred = cv2.GaussianBlur(
        gray,
        (
            3,
            3,
        ),
        0,
    )

    threshold = cv2.adaptiveThreshold(
        blurred,
        255,
        (
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C
        ),
        cv2.THRESH_BINARY_INV,
        31,
        9,
    )

    contours, _ = cv2.findContours(
        threshold,
        cv2.RETR_LIST,
        cv2.CHAIN_APPROX_SIMPLE,
    )

    image_area = (
        image_width
        * image_height
    )

    candidates: list[Box] = []

    for contour in contours:
        (
            x,
            y,
            width,
            height,
        ) = cv2.boundingRect(
            contour
        )

        width_ratio = (
            width
            / image_width
        )

        height_ratio = (
            height
            / image_height
        )

        area_ratio = (
            (
                width
                * height
            )
            / image_area
        )

        normalized_top = (
            1.0
            - (
                y
                / image_height
            )
        )

        normalized_bottom = (
            1.0
            - (
                (
                    y
                    + height
                )
                / image_height
            )
        )

        if (
            width_ratio
            < MIN_BOX_WIDTH_RATIO
            or width_ratio
            > MAX_BOX_WIDTH_RATIO
        ):
            continue

        if (
            height_ratio
            < MIN_BOX_HEIGHT_RATIO
            or height_ratio
            > MAX_BOX_HEIGHT_RATIO
        ):
            continue

        if (
            area_ratio
            < MIN_BOX_AREA_RATIO
            or area_ratio
            > MAX_BOX_AREA_RATIO
        ):
            continue

        if (
            normalized_top
            > COURSE_AREA_TOP_RATIO
        ):
            continue

        if (
            normalized_bottom
            < COURSE_AREA_BOTTOM_RATIO
        ):
            continue

        candidates.append(
            Box(
                x=x,
                y=y,
                width=width,
                height=height,
            )
        )

    boxes = (
        deduplicate_boxes(
            candidates
        )
    )

    return (
        boxes,
        image_width,
        image_height,
    )


def normalize_box(
    box: Box,
    image_width: int,
    image_height: int,
) -> NormalizedBox:
    return NormalizedBox(
        x=(
            box.x
            / image_width
        ),
        y=(
            1.0
            - (
                (
                    box.y
                    + box.height
                )
                / image_height
            )
        ),
        width=(
            box.width
            / image_width
        ),
        height=(
            box.height
            / image_height
        ),
    )


def crop_box(
    image_path: Path,
    box: Box,
    output_path: Path,
) -> None:
    image = cv2.imread(
        str(image_path)
    )

    if image is None:
        raise RuntimeError(
            (
                "이미지를 읽을 수 없습니다: "
                f"{image_path}"
            )
        )

    image_height, image_width = (
        image.shape[:2]
    )

    padding = int(
        round(
            image_width
            * CROP_PADDING_RATIO
        )
    )

    x1 = max(
        0,
        box.x - padding,
    )

    y1 = max(
        0,
        box.y - padding,
    )

    x2 = min(
        image_width,
        (
            box.x
            + box.width
            + padding
        ),
    )

    y2 = min(
        image_height,
        (
            box.y
            + box.height
            + padding
        ),
    )

    crop = image[
        y1:y2,
        x1:x2,
    ]

    success = cv2.imwrite(
        str(output_path),
        crop,
    )

    if not success:
        raise RuntimeError(
            (
                "crop 이미지를 "
                "저장할 수 없습니다: "
                f"{output_path}"
            )
        )


def recognize_box_text(
    crop_path: Path,
) -> tuple[
    str,
    float,
]:
    observations = (
        recognize_image(
            crop_path
        )
    )

    if not observations:
        return (
            "",
            0.0,
        )

    ordered = sorted(
        observations,
        key=lambda item: (
            -item[0],
            item[1],
        ),
    )

    texts = [
        item[2].strip()
        for item in ordered
        if item[2].strip()
    ]

    confidences = [
        item[3]
        for item in ordered
        if item[2].strip()
    ]

    if not texts:
        return (
            "",
            0.0,
        )

    text = "".join(
        texts
    )

    confidence = (
        sum(
            confidences
        )
        / len(confidences)
    )

    return (
        text,
        confidence,
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "교과이수체계도의 "
            "교과목 사각형 box를 검출하고 "
            "box별 Vision OCR 결과를 "
            "확인합니다."
        )
    )

    parser.add_argument(
        "--year",
        type=int,
        required=True,
    )

    parser.add_argument(
        "--program-years",
        type=int,
        choices=[
            4,
            6,
        ],
        required=True,
    )

    parser.add_argument(
        "--save-crops",
        action="store_true",
    )

    args = parser.parse_args()

    image_path = (
        find_curriculum_flowchart_image(
            args.year,
            args.program_years,
        )
    )

    (
        boxes,
        image_width,
        image_height,
    ) = detect_course_boxes(
        image_path
    )

    print()
    print(
        "Curriculum flowchart box probe"
    )
    print(
        "------------------------------"
    )
    print(
        f"year: {args.year}"
    )
    print(
        "program years: "
        f"{args.program_years}"
    )
    print(
        f"source: {image_path}"
    )
    print(
        "image size: "
        f"{image_width}x{image_height}"
    )
    print(
        "detected boxes: "
        f"{len(boxes)}"
    )
    print()

    if args.save_crops:
        crop_dir = (
            Path("/tmp")
            / (
                "curriculum_flowchart_"
                f"{args.year}_"
                f"{args.program_years}year_"
                "crops"
            )
        )

        crop_dir.mkdir(
            parents=True,
            exist_ok=True,
        )

        print(
            f"crop dir: {crop_dir}"
        )
        print()

        temp_context = None
        working_dir = crop_dir
    else:
        temp_context = (
            tempfile.TemporaryDirectory()
        )

        working_dir = Path(
            temp_context.name
        )

    try:
        for (
            index,
            box,
        ) in enumerate(
            boxes,
            start=1,
        ):
            normalized = (
                normalize_box(
                    box,
                    image_width,
                    image_height,
                )
            )

            crop_path = (
                working_dir
                / (
                    f"box_{index:03d}.png"
                )
            )

            crop_box(
                image_path,
                box,
                crop_path,
            )

            (
                text,
                confidence,
            ) = recognize_box_text(
                crop_path
            )

            print(
                f"{index:03d} "
                f"x={normalized.x:0.4f} "
                f"y={normalized.y:0.4f} "
                f"w={normalized.width:0.4f} "
                f"h={normalized.height:0.4f} "
                f"conf={confidence:0.3f} "
                f"| {text}"
            )
    finally:
        if (
            temp_context
            is not None
        ):
            temp_context.cleanup()


if __name__ == "__main__":
    main()
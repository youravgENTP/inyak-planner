from __future__ import annotations

import argparse
import re
import tempfile
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from scripts.common.curriculum_flowchart_vision import (
    find_curriculum_flowchart_image,
)
from scripts.common.curriculum_vision import (
    recognize_image,
)


WHITE_MIN = 245

COURSE_AREA_TOP_RATIO = 0.85
COURSE_AREA_BOTTOM_RATIO = 0.04

MIN_WIDTH_RATIO = 0.040
MAX_WIDTH_RATIO = 0.090

MIN_HEIGHT_RATIO = 0.010
MAX_HEIGHT_RATIO = 0.060

MIN_AREA_RATIO = 0.00045
MAX_AREA_RATIO = 0.0045

CROP_PADDING_X_RATIO = 0.006
CROP_PADDING_Y_RATIO = 0.006

SEMESTER_HEADER_RE = re.compile(
    r"^[12]\s*학\s*기$"
)

MAX_COLUMN_DISTANCE = 0.060


@dataclass
class SemesterColumn:
    grade: int
    semester: int
    x: float


@dataclass
class WhiteBox:
    x: int
    y: int
    width: int
    height: int
    area: int


@dataclass
class NormalizedBox:
    x: float
    y: float
    width: float
    height: float
    center_x: float
    center_y: float


def normalize_header_text(
    text: str,
) -> str:
    return re.sub(
        r"\s+",
        "",
        text,
    )


def find_semester_columns(
    image_path: Path,
    program_years: int,
) -> list[SemesterColumn]:
    observations = recognize_image(
        image_path
    )

    headers: list[
        tuple[
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
        if not (
            0.82
            <= y
            <= 0.90
        ):
            continue

        normalized = (
            normalize_header_text(
                text
            )
        )

        if not SEMESTER_HEADER_RE.fullmatch(
            normalized
        ):
            continue

        headers.append(
            (
                x,
                normalized,
            )
        )

    headers.sort(
        key=lambda item: item[0]
    )

    expected = (
        program_years
        * 2
    )

    if len(headers) != expected:
        raise RuntimeError(
            (
                "학기 헤더를 정확히 "
                f"{expected}개 찾지 못했습니다: "
                f"{headers}"
            )
        )

    columns: list[
        SemesterColumn
    ] = []

    for (
        index,
        (
            x,
            text,
        ),
    ) in enumerate(
        headers
    ):
        columns.append(
            SemesterColumn(
                grade=(
                    index // 2
                    + 1
                ),
                semester=(
                    index % 2
                    + 1
                ),
                x=x,
            )
        )

    return columns


def nearest_column(
    center_x: float,
    columns: list[SemesterColumn],
) -> tuple[
    SemesterColumn,
    float,
]:
    column = min(
        columns,
        key=lambda item: abs(
            item.x
            - center_x
        ),
    )

    distance = abs(
        column.x
        - center_x
    )

    return (
        column,
        distance,
    )

def build_white_mask(
    image: np.ndarray,
) -> np.ndarray:
    lower = np.array(
        [
            WHITE_MIN,
            WHITE_MIN,
            WHITE_MIN,
        ],
        dtype=np.uint8,
    )

    upper = np.array(
        [
            255,
            255,
            255,
        ],
        dtype=np.uint8,
    )

    return cv2.inRange(
        image,
        lower,
        upper,
    )
def detect_white_boxes(
    image_path: Path,
) -> tuple[
    list[WhiteBox],
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

    image_area = (
        image_width
        * image_height
    )

    mask = build_white_mask(
        image
    )

    (
        component_count,
        labels,
        stats,
        centroids,
    ) = cv2.connectedComponentsWithStats(
        mask,
        connectivity=8,
    )

    boxes: list[
        WhiteBox
    ] = []

    for component_id in range(
        1,
        component_count,
    ):
        x = int(
            stats[
                component_id,
                cv2.CC_STAT_LEFT,
            ]
        )

        y = int(
            stats[
                component_id,
                cv2.CC_STAT_TOP,
            ]
        )

        width = int(
            stats[
                component_id,
                cv2.CC_STAT_WIDTH,
            ]
        )

        height = int(
            stats[
                component_id,
                cv2.CC_STAT_HEIGHT,
            ]
        )

        area = int(
            stats[
                component_id,
                cv2.CC_STAT_AREA,
            ]
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
            area
            / image_area
        )

        top_y = (
            1.0
            - (
                y
                / image_height
            )
        )

        bottom_y = (
            1.0
            - (
                (
                    y
                    + height
                )
                / image_height
            )
        )

        if not (
            MIN_WIDTH_RATIO
            <= width_ratio
            <= MAX_WIDTH_RATIO
        ):
            continue

        if not (
            MIN_HEIGHT_RATIO
            <= height_ratio
            <= MAX_HEIGHT_RATIO
        ):
            continue

        if not (
            MIN_AREA_RATIO
            <= area_ratio
            <= MAX_AREA_RATIO
        ):
            continue

        if (
            top_y
            > COURSE_AREA_TOP_RATIO
        ):
            continue

        if (
            bottom_y
            < COURSE_AREA_BOTTOM_RATIO
        ):
            continue

        boxes.append(
            WhiteBox(
                x=x,
                y=y,
                width=width,
                height=height,
                area=area,
            )
        )

    boxes.sort(
        key=lambda box: (
            box.x,
            box.y,
        )
    )

    return (
        boxes,
        image_width,
        image_height,
    )


def normalize_box(
    box: WhiteBox,
    image_width: int,
    image_height: int,
) -> NormalizedBox:
    x = (
        box.x
        / image_width
    )

    y = (
        1.0
        - (
            (
                box.y
                + box.height
            )
            / image_height
        )
    )

    width = (
        box.width
        / image_width
    )

    height = (
        box.height
        / image_height
    )

    return NormalizedBox(
        x=x,
        y=y,
        width=width,
        height=height,
        center_x=(
            x
            + width / 2
        ),
        center_y=(
            y
            + height / 2
        ),
    )


def crop_box(
    image_path: Path,
    box: WhiteBox,
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

    padding_x = int(
        round(
            image_width
            * CROP_PADDING_X_RATIO
        )
    )

    padding_y = int(
        round(
            image_height
            * CROP_PADDING_Y_RATIO
        )
    )

    x1 = max(
        0,
        box.x - padding_x,
    )

    y1 = max(
        0,
        box.y - padding_y,
    )

    x2 = min(
        image_width,
        (
            box.x
            + box.width
            + padding_x
        ),
    )

    y2 = min(
        image_height,
        (
            box.y
            + box.height
            + padding_y
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
                "crop 저장 실패: "
                f"{output_path}"
            )
        )


def clean_ocr_text(
    text: str,
) -> str:
    text = text.strip()

    text = re.sub(
        r"^[\[\](){}|:;•·ㆍ/\-\\\s]+",
        "",
        text,
    )

    text = re.sub(
        r"\s+",
        " ",
        text,
    )

    return text.strip()


def recognize_box(
    crop_path: Path,
) -> tuple[
    str,
    float,
]:
    observations = recognize_image(
        crop_path
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

    texts: list[str] = []
    confidences: list[float] = []

    for (
        y,
        x,
        text,
        confidence,
    ) in ordered:
        cleaned = clean_ocr_text(
            text
        )

        if not cleaned:
            continue

        texts.append(
            cleaned
        )

        confidences.append(
            confidence
        )

    if not texts:
        return (
            "",
            0.0,
        )

    return (
        "".join(
            texts
        ),
        (
            sum(
                confidences
            )
            / len(
                confidences
            )
        ),
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "교과이수체계도의 "
            "순백색 과목 박스 내부를 "
            "검출하고 OCR 결과를 "
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

    columns = (
        find_semester_columns(
            image_path,
            args.program_years,
        )
    )

    (
        boxes,
        image_width,
        image_height,
    ) = detect_white_boxes(
        image_path
    )

    print()
    print(
        "Curriculum flowchart white-box probe"
    )
    print(
        "------------------------------------"
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
        "detected white boxes: "
        f"{len(boxes)}"
    )
    print()

    print(
        "Semester columns"
    )
    print(
        "----------------"
    )

    for column in columns:
        print(
            f"{column.grade}-"
            f"{column.semester} "
            f"x={column.x:0.4f}"
        )

    print()

    if args.save_crops:
        working_dir = (
            Path("/tmp")
            / (
                "curriculum_flowchart_"
                f"{args.year}_"
                f"{args.program_years}year_"
                "white_boxes"
            )
        )

        working_dir.mkdir(
            parents=True,
            exist_ok=True,
        )

        temp_context = None

        print(
            f"crop dir: {working_dir}"
        )
        print()
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

            (
                column,
                column_distance,
            ) = nearest_column(
                normalized.center_x,
                columns,
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
            ) = recognize_box(
                crop_path
            )

            assignment = (
                (
                    f"{column.grade}-"
                    f"{column.semester}"
                )
                if (
                    column_distance
                    <= MAX_COLUMN_DISTANCE
                )
                else "?"
            )

            print(
                f"{index:03d} "
                f"{assignment} "
                f"x={normalized.x:0.4f} "
                f"cx={normalized.center_x:0.4f} "
                f"y={normalized.y:0.4f} "
                f"w={normalized.width:0.4f} "
                f"h={normalized.height:0.4f} "
                f"d={column_distance:0.4f} "
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
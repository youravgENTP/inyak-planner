from __future__ import annotations

from pathlib import Path

from scripts.common.curriculum_vision import (
    VisionObservation,
    recognize_image,
)
from scripts.common.data_paths import (
    RAW_CURRICULUM_FLOWCHARTS_DIR,
)


FLOWCHART_IMAGE_SUFFIXES = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
}


def validate_program_years(
    program_years: int,
) -> None:
    if program_years not in {
        4,
        6,
    }:
        raise ValueError(
            "program-years는 "
            "4 또는 6이어야 합니다."
        )


def flowchart_source_dir(
    year: int,
    program_years: int,
) -> Path:
    validate_program_years(
        program_years
    )

    return (
        RAW_CURRICULUM_FLOWCHARTS_DIR
        / str(year)
        / f"{program_years}year"
    )


def find_curriculum_flowchart_image(
    year: int,
    program_years: int,
) -> Path:
    source_dir = (
        flowchart_source_dir(
            year,
            program_years,
        )
    )

    if not source_dir.exists():
        raise FileNotFoundError(
            (
                "교과이수체계도 디렉터리가 "
                "없습니다: "
                f"{source_dir}"
            )
        )

    images = sorted(
        path
        for path in source_dir.iterdir()
        if (
            path.is_file()
            and path.suffix.lower()
            in FLOWCHART_IMAGE_SUFFIXES
        )
    )

    if len(images) != 1:
        raise RuntimeError(
            (
                f"{year}학년도 "
                f"{program_years}년제 "
                "교과이수체계도 이미지가 "
                "정확히 1개여야 합니다: "
                f"{images}"
            )
        )

    return images[0]


def recognize_curriculum_flowchart(
    year: int,
    program_years: int,
) -> tuple[
    Path,
    list[VisionObservation],
]:
    image_path = (
        find_curriculum_flowchart_image(
            year,
            program_years,
        )
    )

    observations = recognize_image(
        image_path
    )

    return (
        image_path,
        observations,
    )
from __future__ import annotations

import argparse

from scripts.common.curriculum_flowchart_vision import (
    recognize_curriculum_flowchart,
)


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "macOS Vision OCR로 "
            "교과이수체계도 이미지의 "
            "텍스트와 좌표를 확인합니다."
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

    args = parser.parse_args()

    (
        image_path,
        observations,
    ) = recognize_curriculum_flowchart(
        args.year,
        args.program_years,
    )

    print()
    print(
        "Curriculum flowchart Vision probe"
    )
    print(
        "---------------------------------"
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
        "recognized blocks: "
        f"{len(observations)}"
    )
    print()

    for (
        y,
        x,
        text,
        confidence,
    ) in observations:
        print(
            f"y={y:0.4f} "
            f"x={x:0.4f} "
            f"conf={confidence:0.3f} "
            f"| {text}"
        )


if __name__ == "__main__":
    main()
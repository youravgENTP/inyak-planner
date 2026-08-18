from __future__ import annotations

import argparse
import re
from dataclasses import dataclass

from scripts.common.curriculum_flowchart_vision import (
    recognize_curriculum_flowchart,
)


SEMESTER_HEADER_RE = re.compile(
    r"^[12]\s*학\s*기$"
)

COURSE_Y_MAX = 0.85
COURSE_Y_MIN = 0.05

MAX_COLUMN_DISTANCE = 0.055

MULTILINE_Y_GAP = 0.022

MAX_MULTILINE_X_GAP = 0.035


@dataclass
class SemesterColumn:
    grade: int
    semester: int
    x: float


@dataclass
class CourseTextBlock:
    y: float
    x: float
    text: str
    confidence: float
    grade: int
    semester: int


def normalize_header_text(
    text: str,
) -> str:
    return re.sub(
        r"\s+",
        "",
        text,
    )


def normalize_course_text(
    text: str,
) -> str:
    cleaned = text.strip()

    cleaned = re.sub(
        r"^[\[\](){}|:;•·ㆍ/\-\\\s]+",
        "",
        cleaned,
    )

    cleaned = re.sub(
        r"\s+",
        " ",
        cleaned,
    )

    return cleaned.strip()


def find_semester_columns(
    observations: list[
        tuple[
            float,
            float,
            str,
            float,
        ]
    ],
    program_years: int,
) -> list[SemesterColumn]:
    semester_headers: list[
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

        if (
            not SEMESTER_HEADER_RE.fullmatch(
                normalized
            )
        ):
            continue

        semester_headers.append(
            (
                x,
                normalized,
            )
        )

    semester_headers.sort(
        key=lambda item: item[0]
    )

    expected_count = (
        program_years
        * 2
    )

    if (
        len(semester_headers)
        != expected_count
    ):
        raise RuntimeError(
            (
                "학기 헤더 수가 "
                "예상과 다릅니다: "
                f"expected={expected_count}, "
                f"actual={len(semester_headers)}, "
                f"headers={semester_headers}"
            )
        )

    columns: list[
        SemesterColumn
    ] = []

    for (
        index,
        (
            x,
            header_text,
        ),
    ) in enumerate(
        semester_headers
    ):
        grade = (
            index // 2
            + 1
        )

        semester = (
            index % 2
            + 1
        )

        columns.append(
            SemesterColumn(
                grade=grade,
                semester=semester,
                x=x,
            )
        )

    return columns


def nearest_column(
    x: float,
    columns: list[SemesterColumn],
) -> tuple[
    SemesterColumn,
    float,
]:
    column = min(
        columns,
        key=lambda item: abs(
            item.x - x
        ),
    )

    distance = abs(
        column.x
        - x
    )

    return (
        column,
        distance,
    )


def is_non_course_text(
    text: str,
) -> bool:
    normalized = (
        normalize_header_text(
            text
        )
    )

    if not normalized:
        return True

    if (
        "교육과정이수체계도"
        in normalized
    ):
        return True

    if re.fullmatch(
        r"[1-6]학년",
        normalized,
    ):
        return True

    if SEMESTER_HEADER_RE.fullmatch(
        normalized
    ):
        return True

    return False


def assign_blocks(
    observations: list[
        tuple[
            float,
            float,
            str,
            float,
        ]
    ],
    columns: list[SemesterColumn],
) -> list[CourseTextBlock]:
    blocks: list[
        CourseTextBlock
    ] = []

    for (
        y,
        x,
        text,
        confidence,
    ) in observations:
        if not (
            COURSE_Y_MIN
            <= y
            <= COURSE_Y_MAX
        ):
            continue

        if is_non_course_text(
            text
        ):
            continue

        cleaned_text = (
            normalize_course_text(
                text
            )
        )

        if not cleaned_text:
            continue

        (
            column,
            distance,
        ) = nearest_column(
            x,
            columns,
        )

        if (
            distance
            > MAX_COLUMN_DISTANCE
        ):
            continue

        blocks.append(
            CourseTextBlock(
                y=y,
                x=x,
                text=cleaned_text,
                confidence=confidence,
                grade=column.grade,
                semester=column.semester,
            )
        )

    return blocks


def should_merge(
    upper: CourseTextBlock,
    lower: CourseTextBlock,
) -> bool:
    if (
        upper.grade
        != lower.grade
        or upper.semester
        != lower.semester
    ):
        return False

    y_gap = (
        upper.y
        - lower.y
    )

    if not (
        0
        < y_gap
        <= MULTILINE_Y_GAP
    ):
        return False

    if (
        abs(
            upper.x
            - lower.x
        )
        > MAX_MULTILINE_X_GAP
    ):
        return False

    return True


def group_blocks(
    blocks: list[CourseTextBlock],
) -> list[
    list[CourseTextBlock]
]:
    ordered = sorted(
        blocks,
        key=lambda block: (
            block.grade,
            block.semester,
            -block.y,
            block.x,
        ),
    )

    groups: list[
        list[CourseTextBlock]
    ] = []

    for block in ordered:
        if not groups:
            groups.append(
                [block]
            )
            continue

        current_group = (
            groups[-1]
        )

        previous = (
            current_group[-1]
        )

        if should_merge(
            previous,
            block,
        ):
            current_group.append(
                block
            )
        else:
            groups.append(
                [block]
            )

    return groups


def merged_text(
    group: list[CourseTextBlock],
) -> str:
    return "".join(
        block.text
        for block in group
    )


def mean_confidence(
    group: list[CourseTextBlock],
) -> float:
    return (
        sum(
            block.confidence
            for block in group
        )
        / len(group)
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "교과이수체계도 OCR 결과를 "
            "학년·학기 열에 배정하고 "
            "여러 줄 과목명 후보를 "
            "그룹화하여 확인합니다."
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

    columns = (
        find_semester_columns(
            observations,
            args.program_years,
        )
    )

    blocks = assign_blocks(
        observations,
        columns,
    )

    groups = group_blocks(
        blocks
    )

    print()
    print(
        "Curriculum flowchart course probe"
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
        "OCR blocks: "
        f"{len(observations)}"
    )
    print(
        "candidate blocks: "
        f"{len(blocks)}"
    )
    print(
        "candidate groups: "
        f"{len(groups)}"
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
    print(
        "Grouped course candidates"
    )
    print(
        "-------------------------"
    )

    for group in groups:
        first = group[0]

        print(
            f"{first.grade}-"
            f"{first.semester} "
            f"y={first.y:0.4f} "
            f"conf={mean_confidence(group):0.3f} "
            f"| {merged_text(group)}"
        )

        if (
            len(group)
            > 1
        ):
            for block in group:
                print(
                    "    "
                    f"y={block.y:0.4f} "
                    f"x={block.x:0.4f} "
                    f"| {block.text}"
                )


if __name__ == "__main__":
    main()
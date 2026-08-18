from __future__ import annotations

import argparse
import re
import tempfile
from pathlib import Path

import fitz

from scripts.common.curriculum_vision import (
    VisionObservation,
    find_curriculum_pdf,
    recognize_image,
    render_page,
)


COURSE_CODE_RE = re.compile(
    r"\b(?:ADA|ADB)\d{3}\b"
)

GRADE_SEMESTER_RE = re.compile(
    r"\b([1-6])-([12])\b"
)

HANGUL_RE = re.compile(
    r"[가-힣]"
)


def clean_text(
    text: str,
) -> str:
    text = text.strip()

    text = re.sub(
        r"\s+",
        " ",
        text,
    )

    return text


def extract_code(
    text: str,
) -> str | None:
    match = COURSE_CODE_RE.search(
        text
    )

    if match is None:
        return None

    return match.group(0)


def find_course_anchors(
    observations: list[
        VisionObservation
    ],
) -> list[
    tuple[
        float,
        str,
    ]
]:
    anchors: list[
        tuple[
            float,
            str,
        ]
    ] = []

    seen: set[
        tuple[
            float,
            str,
        ]
    ] = set()

    for (
        y,
        x,
        text,
        confidence,
    ) in observations:
        code = extract_code(
            text
        )

        if code is None:
            continue

        key = (
            round(y, 4),
            code,
        )

        if key in seen:
            continue

        seen.add(key)

        anchors.append(
            (
                y,
                code,
            )
        )

    anchors.sort(
        key=lambda item: -item[0]
    )

    return anchors


def get_row_observations(
    observations: list[
        VisionObservation
    ],
    anchor_y: float,
    previous_y: float | None,
    next_y: float | None,
) -> list[
    VisionObservation
]:
    if previous_y is None:
        if next_y is None:
            upper = (
                anchor_y
                + 0.02
            )
        else:
            upper = (
                anchor_y
                + (
                    anchor_y
                    - next_y
                ) / 2
            )
    else:
        upper = (
            previous_y
            + anchor_y
        ) / 2

    if next_y is None:
        if previous_y is None:
            lower = (
                anchor_y
                - 0.02
            )
        else:
            lower = (
                anchor_y
                - (
                    previous_y
                    - anchor_y
                ) / 2
            )
    else:
        lower = (
            anchor_y
            + next_y
        ) / 2

    result: list[
        VisionObservation
    ] = []

    for observation in observations:
        y = observation[0]

        if lower <= y < upper:
            result.append(
                observation
            )

    result.sort(
        key=lambda item: (
            -item[0],
            item[1],
        )
    )

    return result


def extract_completion_type(
    observations: list[
        VisionObservation
    ],
) -> str:
    for (
        y,
        x,
        text,
        confidence,
    ) in observations:
        cleaned = clean_text(
            text
        )

        if "전필" in cleaned:
            return "전필"

        if "전선" in cleaned:
            return "전선"

    return "?"


def extract_course_name(
    observations: list[
        VisionObservation
    ],
) -> str:
    competency_phrases = [
        "문제 해결 능력",
        "문제 해결 능",
        "전문 연구 능력",
        "전문 연구 능",
        "융복합 능력",
        "융복합 능",
        "실험 수행 능력",
        "실험 수행 능",
        "의사 전달 능력",
        "의사 전달 능",
    ]

    candidates: list[
        tuple[
            int,
            float,
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
        cleaned = clean_text(
            text
        )

        if not cleaned:
            continue

        if x >= 0.67:
            continue

        cleaned = re.sub(
            r"\b(?:전필|전선)\b",
            " ",
            cleaned,
        )

        cleaned = COURSE_CODE_RE.sub(
            " ",
            cleaned,
        )

        for phrase in competency_phrases:
            cleaned = cleaned.replace(
                phrase,
                " ",
            )

        cleaned = re.sub(
            r"^\s*력\s*$",
            "",
            cleaned,
        )

        cleaned = re.sub(
            r"^[•·ㆍ/\-\s]+",
            "",
            cleaned,
        )

        cleaned = re.sub(
            r"\s+",
            " ",
            cleaned,
        ).strip()

        if not cleaned:
            continue

        if not HANGUL_RE.search(
            cleaned
        ):
            continue

        if cleaned in {
            "전필",
            "전선",
            "능",
            "능력",
            "력",
        }:
            continue

        hangul_count = len(
            HANGUL_RE.findall(
                cleaned
            )
        )

        position_score = (
            2
            if x >= 0.32
            else 1
        )

        score = (
            hangul_count
            + position_score
        )

        candidates.append(
            (
                score,
                y,
                x,
                cleaned,
            )
        )

    if not candidates:
        return ""

    candidates.sort(
        key=lambda item: (
            -item[0],
            -item[1],
            item[2],
        )
    )

    return candidates[0][3]


def extract_grade_semester(
    observations: list[
        VisionObservation
    ],
) -> tuple[
    int,
    int,
] | None:
    for (
        y,
        x,
        text,
        confidence,
    ) in observations:
        if x >= 0.12:
            continue

        match = (
            GRADE_SEMESTER_RE.search(
                text
            )
        )

        if match is None:
            continue

        return (
            int(match.group(1)),
            int(match.group(2)),
        )

    return None


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "전체 페이지 Vision OCR 결과에서 "
            "교과목 코드를 anchor로 삼아 "
            "교육과정 행을 재구성합니다."
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

        with tempfile.TemporaryDirectory() as temp:
            image_path = (
                Path(temp)
                / "page.png"
            )

            render_page(
                page,
                image_path,
            )

            observations = recognize_image(
                image_path
            )
    finally:
        document.close()

    anchors = find_course_anchors(
        observations
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
        "Vision course anchors: "
        f"{len(anchors)}"
    )
    print()

    current_grade: int | None = None
    current_semester: int | None = None

    for index, (
        anchor_y,
        code,
    ) in enumerate(
        anchors
    ):
        previous_y = (
            anchors[index - 1][0]
            if index > 0
            else None
        )

        next_y = (
            anchors[index + 1][0]
            if (
                index + 1
                < len(anchors)
            )
            else None
        )

        row_observations = (
            get_row_observations(
                observations,
                anchor_y,
                previous_y,
                next_y,
            )
        )

        grade_semester = (
            extract_grade_semester(
                row_observations
            )
        )

        if grade_semester is not None:
            (
                current_grade,
                current_semester,
            ) = grade_semester

        completion_type = (
            extract_completion_type(
                row_observations
            )
        )

        course_name = (
            extract_course_name(
                row_observations
            )
        )

        grade_semester_text = (
            (
                f"{current_grade}-"
                f"{current_semester}"
            )
            if (
                current_grade is not None
                and current_semester is not None
            )
            else "?"
        )

        print(
            f"{grade_semester_text} | "
            f"{code} | "
            f"{completion_type} | "
            f"{course_name}"
        )


if __name__ == "__main__":
    main()
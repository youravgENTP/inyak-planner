from __future__ import annotations

import argparse
import re
import tempfile
from pathlib import Path

import fitz

from scripts.probes.probe_vision_ocr import (
    recognize_image,
    render_page,
)


from scripts.common.data_paths import (
    RAW_CURRICULUM_PDFS_DIR,
)


RAW_CURRICULUM_DIR = RAW_CURRICULUM_PDFS_DIR

COURSE_CODE_RE = re.compile(
    r"\b(?:ADA|ADB)\d{3}\b"
)

GRADE_SEMESTER_RE = re.compile(
    r"\b([1-6])-([12])\b"
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
        tuple[
            float,
            float,
            str,
            float,
        ]
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
        tuple[
            float,
            float,
            str,
            float,
        ]
    ],
    anchor_y: float,
    previous_y: float | None,
    next_y: float | None,
) -> list[
    tuple[
        float,
        float,
        str,
        float,
    ]
]:
    if previous_y is None:
        if next_y is None:
            upper = anchor_y + 0.02
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
            lower = anchor_y - 0.02
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

    result = []

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
        tuple[
            float,
            float,
            str,
            float,
        ]
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
        tuple[
            float,
            float,
            str,
            float,
        ]
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

        # 이수구분 제거
        cleaned = re.sub(
            r"\b(?:전필|전선)\b",
            " ",
            cleaned,
        )

        # 교과목 코드 제거
        cleaned = COURSE_CODE_RE.sub(
            " ",
            cleaned,
        )

        # 주전공능력 문구 제거
        for phrase in competency_phrases:
            cleaned = cleaned.replace(
                phrase,
                " ",
            )

        # OCR에서 능력의 마지막 '력'이
        # 별도 block으로 떨어지는 경우 제거
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

        # 남아 있는 표 구조용 단어는 제외
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

        # 교과목명 열에 가까울수록 우선.
        # 다만 Vision이 여러 셀을 합친 block도
        # 허용하기 위해 x=0.12부터 본다.
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
        tuple[
            float,
            float,
            str,
            float,
        ]
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

    pdf_path = find_pdf(
        args.year
    )

    document = fitz.open(
        pdf_path
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

        observations = (
            recognize_image(
                image_path
            )
        )

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
        f"Vision course anchors: "
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
            if index + 1 < len(anchors)
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
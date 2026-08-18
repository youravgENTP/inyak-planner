from __future__ import annotations

import argparse
import csv
from collections import Counter
from pathlib import Path

from scripts.common.curriculum_flowchart_vision import (
    FlowchartCourse,
    extract_flowchart_courses,
)
from scripts.common.data_paths import (
    EXTRACTED_CURRICULUM_FLOWCHARTS_DIR,
)


OUTPUT_COLUMNS = [
    "academic_year",
    "program_years",
    "grade",
    "semester",
    "course_name",
    "source_file",
    "box_x",
    "box_y",
    "box_width",
    "box_height",
    "confidence",
]


def output_directory(
    year: int,
) -> Path:
    return (
        EXTRACTED_CURRICULUM_FLOWCHARTS_DIR
        / str(year)
    )


def courses_output_path(
    year: int,
    program_years: int,
) -> Path:
    return (
        output_directory(
            year
        )
        / (
            f"{program_years}year_courses.csv"
        )
    )


def report_output_path(
    year: int,
    program_years: int,
) -> Path:
    return (
        output_directory(
            year
        )
        / (
            f"{program_years}year_extraction_report.txt"
        )
    )


def write_courses_csv(
    path: Path,
    year: int,
    program_years: int,
    source_file: str,
    courses: list[FlowchartCourse],
) -> None:
    with path.open(
        "w",
        encoding="utf-8-sig",
        newline="",
    ) as file:
        writer = csv.DictWriter(
            file,
            fieldnames=OUTPUT_COLUMNS,
        )

        writer.writeheader()

        for course in courses:
            writer.writerow(
                {
                    "academic_year": year,
                    "program_years": (
                        program_years
                    ),
                    "grade": (
                        course.grade
                    ),
                    "semester": (
                        course.semester
                    ),
                    "course_name": (
                        course.course_name
                    ),
                    "source_file": (
                        source_file
                    ),
                    "box_x": (
                        f"{course.box_x:.6f}"
                    ),
                    "box_y": (
                        f"{course.box_y:.6f}"
                    ),
                    "box_width": (
                        f"{course.box_width:.6f}"
                    ),
                    "box_height": (
                        f"{course.box_height:.6f}"
                    ),
                    "confidence": (
                        f"{course.confidence:.3f}"
                    ),
                }
            )


def find_duplicate_rows(
    courses: list[FlowchartCourse],
) -> list[
    tuple[
        int,
        int,
        str,
        int,
    ]
]:
    counts = Counter(
        (
            course.grade,
            course.semester,
            course.course_name,
        )
        for course in courses
    )

    duplicates: list[
        tuple[
            int,
            int,
            str,
            int,
        ]
    ] = []

    for (
        (
            grade,
            semester,
            course_name,
        ),
        count,
    ) in sorted(
        counts.items()
    ):
        if count <= 1:
            continue

        duplicates.append(
            (
                grade,
                semester,
                course_name,
                count,
            )
        )

    return duplicates


def write_report(
    path: Path,
    year: int,
    program_years: int,
    source_file: str,
    detected_boxes: int,
    courses: list[FlowchartCourse],
) -> None:
    semester_counts = Counter(
        (
            course.grade,
            course.semester,
        )
        for course in courses
    )

    duplicates = (
        find_duplicate_rows(
            courses
        )
    )

    low_confidence = [
        course
        for course in courses
        if (
            course.confidence
            < 0.5
        )
    ]

    result = (
        "PASS"
        if (
            detected_boxes > 0
            and len(courses) > 0
            and detected_boxes
            == len(courses)
        )
        else "FAIL"
    )

    lines = [
        (
            "Curriculum flowchart "
            "Vision extraction report"
        ),
        "=============================================",
        "",
        f"academic year: {year}",
        (
            "program years: "
            f"{program_years}"
        ),
        (
            "source image: "
            f"{source_file}"
        ),
        "",
        "Extraction",
        "----------",
        (
            "detected white boxes: "
            f"{detected_boxes}"
        ),
        (
            "course rows extracted: "
            f"{len(courses)}"
        ),
        (
            "low confidence rows: "
            f"{len(low_confidence)}"
        ),
        (
            "duplicate position/name rows: "
            f"{len(duplicates)}"
        ),
        "",
        "Rows by semester",
        "----------------",
    ]

    starting_grade = (
        1
        if program_years == 6
        else 3
    )

    for grade in range(
        starting_grade,
        7,
    ):
        for semester in [
            1,
            2,
        ]:
            lines.append(
                (
                    f"{grade}-{semester}: "
                    f"{semester_counts.get((grade, semester), 0)}"
                )
            )

    if duplicates:
        lines.extend(
            [
                "",
                "Duplicate position/name rows",
                "----------------------------",
            ]
        )

        for (
            grade,
            semester,
            course_name,
            count,
        ) in duplicates:
            lines.append(
                (
                    f"{grade}-{semester} "
                    f"| {course_name} "
                    f"| count={count}"
                )
            )

    if low_confidence:
        lines.extend(
            [
                "",
                "Low confidence rows",
                "-------------------",
            ]
        )

        for course in low_confidence:
            lines.append(
                (
                    f"{course.grade}-"
                    f"{course.semester} "
                    f"| {course.course_name} "
                    f"| confidence="
                    f"{course.confidence:.3f}"
                )
            )

    lines.extend(
        [
            "",
            "Notes",
            "-----",
            (
                "Duplicate rows are preserved "
                "because the source flowchart "
                "may show the same course in "
                "multiple prerequisite groups."
            ),
            (
                "Course names are OCR results "
                "from the flowchart itself and "
                "are not corrected from seed or "
                "curriculum course data."
            ),
            "",
            f"RESULT: {result}",
            "",
        ]
    )

    path.write_text(
        "\n".join(
            lines
        ),
        encoding="utf-8",
    )



def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "교과이수체계도 이미지에서 "
            "흰색 과목 박스를 검출하고 "
            "Vision OCR로 과목명과 "
            "학년·학기를 추출합니다."
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
        columns,
        courses,
        detected_boxes,
    ) = extract_flowchart_courses(
        args.year,
        args.program_years,
    )

    output_dir = (
        output_directory(
            args.year
        )
    )

    output_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    courses_path = (
        courses_output_path(
            args.year,
            args.program_years,
        )
    )

    report_path = (
        report_output_path(
            args.year,
            args.program_years,
        )
    )

    write_courses_csv(
        courses_path,
        args.year,
        args.program_years,
        image_path.name,
        courses,
    )

    write_report(
        report_path,
        args.year,
        args.program_years,
        image_path.name,
        detected_boxes,
        courses,
    )

    print()
    print(
        "Curriculum flowchart "
        "Vision extraction"
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
        "semester columns: "
        f"{len(columns)}"
    )
    print(
        "detected white boxes: "
        f"{detected_boxes}"
    )
    print(
        "rows extracted: "
        f"{len(courses)}"
    )
    print(
        f"courses: {courses_path}"
    )
    print(
        f"report:  {report_path}"
    )


if __name__ == "__main__":
    main()
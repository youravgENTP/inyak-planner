"""Collect pharmacy courses and their syllabus XML/PDF files.

This is the production entry point. ``portal_probe.py`` keeps the portal
inspection and lecture-list helpers; this module coordinates the complete
collection workflow.
"""

from __future__ import annotations

import argparse
import sqlite3
from collections.abc import Mapping
from pathlib import Path
from urllib.parse import urlencode

from playwright.sync_api import APIRequestContext, sync_playwright

from lecture_db import (
    DEFAULT_DB_PATH,
    REGULAR_TRACK_VALUE,
    connect_database,
    save_courses,
    update_schedule_and_room,
)
from portal_client import (
    PHARMACY_DEPARTMENT_VALUE,
    PORTAL_URL,
    PROFILE_DIR,
    SemesterTarget,
    build_semester_targets,
    collect_one_semester,
    get_available_regular_semesters,
    get_lecture_frame,
    save_csv,
)

from syllabus_parser import extract_schedule_and_room


PROJECT_ROOT = Path(__file__).resolve().parents[1]
LECTURE_LIST_DIR = PROJECT_ROOT / "data" / "raw" / "lectures"
SYLLABUS_DIR = PROJECT_ROOT / "data" / "raw" / "syllabi"

SYLLABUS_XML_ENDPOINT = (
    "https://navi.inje.ac.kr/MRD/Subject/SubjB0011R_XML.aspx"
)
REPORT_SERVICE_URL = (
    "https://reporttool.inje.ac.kr/ReportingServer/service"
)
REPORT_DOWNLOAD_URL = (
    "https://reporttool.inje.ac.kr/ReportingServer/download"
)
REPORT_TEMPLATE_URL = (
    "https://navi.inje.ac.kr/MRD/Subject/SubjB0011R_02.mrd"
)

SYSTEM_CODE = "01"
LANGUAGE_VALUE = "1"
DEFAULT_COMPETENCY_VALUE = "2"


def required_course_value(
    course: Mapping[str, object],
    field_name: str,
) -> str:
    """Read a required, non-empty value from one collected course row."""
    value = course.get(field_name)
    if value is None or not str(value).strip():
        raise ValueError(f"강좌의 {field_name} 값이 비어 있습니다: {course}")
    return str(value).strip()


def build_syllabus_xml_url(
    *,
    academic_year: int,
    semester: int,
    track: str,
    course_code: str,
    section: str,
    competency_value: str = DEFAULT_COMPETENCY_VALUE,
) -> str:
    """Build the syllabus XML URL for one course without hardcoded identity."""
    query = urlencode(
        {
            "SYS_CD": SYSTEM_CODE,
            "YY": academic_year,
            "SMST": semester,
            "TR": track,
            "SUBJ": course_code,
            "BUNBAN": section,
            "LAN": LANGUAGE_VALUE,
            "CAP": competency_value,
            "ID": "",
            "AGIN": "A",
        }
    )
    return f"{SYLLABUS_XML_ENDPOINT}?{query}"


def download_xml(
    request: APIRequestContext,
    *,
    xml_url: str,
    output_path: Path,
) -> None:
    """Download one syllabus XML file."""
    response = request.get(xml_url)
    if not response.ok:
        raise RuntimeError(
            f"XML 다운로드 실패: HTTP {response.status} ({xml_url})"
        )

    xml_text = response.text()
    if not xml_text.lstrip().startswith("<"):
        preview = xml_text[:200].replace("\n", " ")
        raise RuntimeError(f"XML이 아닌 응답을 받았습니다: {preview}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(xml_text, encoding="utf-8")


def download_pdf(
    request: APIRequestContext,
    *,
    xml_url: str,
    output_path: Path,
) -> None:
    """Ask Crownix to render one syllabus and download the resulting PDF."""
    create_response = request.post(
        REPORT_SERVICE_URL,
        headers={
            "Accept": "*/*",
            "Content-Type": (
                "application/x-www-form-urlencoded; charset=UTF-8"
            ),
            "Origin": "https://navi.inje.ac.kr",
            "Referer": "https://navi.inje.ac.kr/",
        },
        form={
            "opcode": "500",
            "mrd_path": REPORT_TEMPLATE_URL,
            "mrd_param": f"/rfn [{xml_url}]",
            "export_type": "pdf",
            "protocol": "sync",
        },
    )
    create_text = create_response.text().strip()

    if not create_response.ok:
        raise RuntimeError(
            "PDF 생성 요청 실패: "
            f"HTTP {create_response.status} / {create_text}"
        )
    if not create_text.startswith("1|"):
        raise RuntimeError(f"Crownix PDF 생성 실패: {create_text}")

    temporary_path = create_text.split("|", 1)[1].strip()
    if not temporary_path.lower().endswith(".pdf"):
        raise RuntimeError(f"잘못된 임시 PDF 경로: {temporary_path}")

    download_response = request.get(
        REPORT_DOWNLOAD_URL,
        params={
            "filename": temporary_path,
            "delete": "true",
            "attatchment": "true",
        },
    )
    pdf_bytes = download_response.body()

    if not download_response.ok:
        raise RuntimeError(
            f"PDF 다운로드 실패: HTTP {download_response.status}"
        )
    if not pdf_bytes.startswith(b"%PDF"):
        preview = pdf_bytes[:200].decode("utf-8", errors="replace")
        raise RuntimeError(f"다운로드된 파일이 PDF가 아닙니다: {preview}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(pdf_bytes)


def collect_course_files(
    request: APIRequestContext,
    *,
    course: Mapping[str, object],
    target: SemesterTarget,
    track: str,
    connection: sqlite3.Connection,
    competency_value: str = DEFAULT_COMPETENCY_VALUE,
) -> tuple[Path, Path]:
    """Download XML/PDF for one course and store its schedule in SQLite."""
    course_code = required_course_value(course, "교과목")
    section = required_course_value(course, "분반")
    output_dir = SYLLABUS_DIR / str(target.year) / str(target.semester)
    file_stem = f"{course_code}-{section}"
    xml_path = output_dir / f"{file_stem}.xml"
    pdf_path = output_dir / f"{file_stem}.pdf"

    xml_url = build_syllabus_xml_url(
        academic_year=target.year,
        semester=target.semester,
        track=track,
        course_code=course_code,
        section=section,
        competency_value=competency_value,
    )
    download_xml(request, xml_url=xml_url, output_path=xml_path)
    schedule_and_room = extract_schedule_and_room(xml_path)
    download_pdf(request, xml_url=xml_url, output_path=pdf_path)

    update_schedule_and_room(
        connection,
        academic_year=target.year,
        semester=target.semester,
        track=track,
        course_code=course_code,
        section=section,
        schedule_and_room=schedule_and_room,
    )
    connection.commit()
    return xml_path, pdf_path


def collect_targets(
    page,
    *,
    targets: list[SemesterTarget],
    department_value: str = PHARMACY_DEPARTMENT_VALUE,
    track: str = REGULAR_TRACK_VALUE,
    skip_missing: bool = False,
) -> int:
    """Collect course rows, XML, PDF, and schedule text for all targets."""
    available = get_available_regular_semesters(get_lecture_frame(page))
    missing = [
        target for target in targets if target.portal_value not in available
    ]
    if missing and not skip_missing:
        labels = ", ".join(target.label for target in missing)
        raise ValueError(f"포털에 존재하지 않는 학기가 포함되어 있습니다: {labels}")

    valid_targets = [
        target for target in targets if target.portal_value in available
    ]
    collected_count = 0

    with connect_database(DEFAULT_DB_PATH) as connection:
        for target_index, target in enumerate(valid_targets, start=1):
            print(
                f"[{target_index}/{len(valid_targets)}] "
                f"{target.label} 강좌 목록 조회"
            )
            courses = collect_one_semester(
                page,
                target,
                department_value=department_value,
            )
            save_csv(LECTURE_LIST_DIR / f"{target.slug}.csv", courses)
            save_courses(courses, db_path=DEFAULT_DB_PATH, track=track)

            for course_index, course in enumerate(courses, start=1):
                course_code = required_course_value(course, "교과목")
                section = required_course_value(course, "분반")
                print(
                    f"  [{course_index}/{len(courses)}] "
                    f"{course_code}-{section} XML·PDF 저장"
                )
                collect_course_files(
                    page.context.request,
                    course=course,
                    target=target,
                    track=track,
                    connection=connection,
                )

            collected_count += len(courses)
            print(f"  {len(courses)}개 강좌 수집 완료")

    return collected_count


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="인제대학교 약학과 강좌와 수업계획서를 수집합니다."
    )
    parser.add_argument(
        "--years",
        type=int,
        nargs="+",
        required=True,
        help="예: --years 2024 2025 2026",
    )
    parser.add_argument(
        "--semesters",
        type=int,
        nargs="+",
        choices=(1, 2),
        required=True,
        help="예: --semesters 1 2",
    )
    parser.add_argument(
        "--skip-missing",
        action="store_true",
        help="포털에 없는 요청 학기를 건너뜁니다.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    targets = build_semester_targets(args.years, args.semesters)
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as playwright:
        context = playwright.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE_DIR),
            headless=False,
            viewport={"width": 1440, "height": 1000},
        )
        page = context.pages[0]
        page.goto(PORTAL_URL, wait_until="domcontentloaded")

        print("로그인이 필요하면 브라우저에서 직접 로그인해 주세요.")
        input("수업계획서 화면이 완전히 나타나면 Enter를 누르세요: ")

        count = collect_targets(
            page,
            targets=targets,
            skip_missing=args.skip_missing,
        )
        print(f"\n총 {count}개 강좌와 수업계획서 수집 완료")
        print(f"SQLite DB: {DEFAULT_DB_PATH}")
        print(f"XML·PDF: {SYLLABUS_DIR}")
        input("브라우저를 닫으려면 Enter를 누르세요: ")
        context.close()


if __name__ == "__main__":
    main()

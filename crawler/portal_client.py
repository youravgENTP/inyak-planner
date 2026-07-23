"""Shared client helpers for the Inje University lecture portal.

This module contains reusable portal interaction code only.  Executable
workflows belong in ``portal_probe.py`` and ``course_collector.py``.
"""

from __future__ import annotations

import csv
import re
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from playwright.sync_api import Frame, Page, TimeoutError


PORTAL_URL = "https://my.inje.ac.kr/artifact/viewer/1304?k=1304"
LECTURE_FRAME_URL = "navi.inje.ac.kr/AllUsers/Lecture.aspx"

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PROFILE_DIR = PROJECT_ROOT / "crawler" / "browser-profile"

SEMESTER_SELECTOR = "#mainContent_ddl학년도"
TRACK_SELECTOR = "#mainContent_ddl수업트랙"
DEPARTMENT_SELECTOR = "#mainContent_ddl소속"
LANGUAGE_SELECTOR = "#mainContent_ddl작성언어"
SUBJECT_NAME_SELECTOR = "#mainContent_txt교과목명"
SEARCH_BUTTON_SELECTOR = "#mainContent_btn조회"
RESULT_TABLE_SELECTOR = "table.table.table-bordered"

UNDERGRADUATE_CODE = "01"
REGULAR_TRACK_VALUE = "1"
PHARMACY_DEPARTMENT_VALUE = "01995"
KOREAN_LANGUAGE_VALUE = "1"


@dataclass(frozen=True, order=True)
class SemesterTarget:
    year: int
    semester: int

    @property
    def portal_value(self) -> str:
        return f"{UNDERGRADUATE_CODE}_{self.year}_{self.semester}"

    @property
    def label(self) -> str:
        return f"{self.year}학년도 {self.semester}학기 [학부]"

    @property
    def slug(self) -> str:
        return f"{self.year}-{self.semester}"


def build_semester_targets(
    years: Iterable[int],
    semesters: Iterable[int],
) -> list[SemesterTarget]:
    """Build validated undergraduate regular-semester targets."""
    normalized_years = sorted({int(year) for year in years})
    normalized_semesters = sorted({int(semester) for semester in semesters})

    if not normalized_years:
        raise ValueError("years에는 최소 한 개의 연도가 필요합니다.")
    if not normalized_semesters:
        raise ValueError("semesters에는 최소 한 개의 학기가 필요합니다.")

    invalid = [
        semester
        for semester in normalized_semesters
        if semester not in {1, 2}
    ]
    if invalid:
        raise ValueError(f"정규학기는 1 또는 2만 지정할 수 있습니다: {invalid}")

    return [
        SemesterTarget(year, semester)
        for year in normalized_years
        for semester in normalized_semesters
    ]


def get_lecture_frame(page: Page, timeout_ms: int = 30_000) -> Frame:
    """Wait for and return the Lecture.aspx iframe."""
    page.wait_for_function(
        """needle => Array.from(document.querySelectorAll("iframe"))
            .some(frame => frame.src.includes(needle))""",
        arg=LECTURE_FRAME_URL,
        timeout=timeout_ms,
    )

    for frame in page.frames:
        if LECTURE_FRAME_URL in frame.url:
            return frame

    raise RuntimeError("수업계획서 iframe을 찾지 못했습니다.")


def get_available_regular_semesters(frame: Frame) -> dict[str, str]:
    """Return undergraduate first/second semesters from the dropdown."""
    options: list[dict[str, str]] = frame.locator(
        f"{SEMESTER_SELECTOR} option"
    ).evaluate_all(
        """options => options.map(option => ({
            value: option.value,
            label: option.textContent.trim()
        }))"""
    )

    regular_value = re.compile(r"^01_\d{4}_[12]$")
    return {
        option["value"]: option["label"]
        for option in options
        if regular_value.fullmatch(option["value"])
    }


def _postback(page: Page, action: Any, timeout_ms: int = 30_000) -> None:
    """Run an action that causes a Lecture.aspx ASP.NET POST response."""
    try:
        with page.expect_response(
            lambda response: (
                LECTURE_FRAME_URL in response.url
                and response.request.method == "POST"
            ),
            timeout=timeout_ms,
        ):
            action()
    except TimeoutError as exc:
        raise RuntimeError(
            "포털의 화면 갱신 응답을 기다리다 시간이 초과되었습니다."
        ) from exc


def _select_semester(page: Page, target: SemesterTarget) -> Frame:
    frame = get_lecture_frame(page)
    current_value = frame.locator(SEMESTER_SELECTOR).input_value()

    if current_value != target.portal_value:
        _postback(
            page,
            lambda: frame.locator(SEMESTER_SELECTOR).select_option(
                value=target.portal_value
            ),
        )

    frame = get_lecture_frame(page)
    frame.locator(SEMESTER_SELECTOR).wait_for(state="visible")
    return frame


def _read_result_table(frame: Frame) -> tuple[list[str], list[list[str]]]:
    table = frame.locator(RESULT_TABLE_SELECTOR)
    table.wait_for(state="visible")

    headers = [
        text.strip()
        for text in table.locator("thead th").all_inner_texts()
    ]
    rows = [
        [text.strip() for text in row.locator("td").all_inner_texts()]
        for row in table.locator("tbody tr").all()
    ]
    return headers, rows


def collect_one_semester(
    page: Page,
    target: SemesterTarget,
    *,
    department_value: str = PHARMACY_DEPARTMENT_VALUE,
) -> list[dict[str, str | int]]:
    """Collect lecture-list rows for one pharmacy semester."""
    frame = _select_semester(page, target)

    frame.locator(TRACK_SELECTOR).select_option(value=REGULAR_TRACK_VALUE)
    frame.locator(DEPARTMENT_SELECTOR).select_option(value=department_value)
    frame.locator(LANGUAGE_SELECTOR).select_option(
        value=KOREAN_LANGUAGE_VALUE
    )
    frame.locator(SUBJECT_NAME_SELECTOR).fill("")

    _postback(
        page,
        lambda: frame.locator(SEARCH_BUTTON_SELECTOR).click(),
    )

    frame = get_lecture_frame(page)
    headers, rows = _read_result_table(frame)
    return [
        {
            "학년도": target.year,
            "학기": target.semester,
            **dict(zip(headers, row, strict=False)),
        }
        for row in rows
    ]


def save_csv(
    path: Path,
    rows: Sequence[dict[str, str | int]],
) -> None:
    """Save dictionaries as an Excel-friendly UTF-8 CSV."""
    path.parent.mkdir(parents=True, exist_ok=True)

    if not rows:
        path.write_text("", encoding="utf-8-sig")
        return

    fieldnames: list[str] = []
    for row in rows:
        for key in row:
            if key not in fieldnames:
                fieldnames.append(key)

    with path.open("w", encoding="utf-8-sig", newline="") as csv_file:
        writer = csv.DictWriter(
            csv_file,
            fieldnames=fieldnames,
            extrasaction="ignore",
        )
        writer.writeheader()
        writer.writerows(rows)
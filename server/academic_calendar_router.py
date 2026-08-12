from __future__ import annotations

import re
import ssl
from datetime import date
from typing import Any, Dict, List
from urllib.error import (
    HTTPError,
    URLError,
)
from urllib.parse import urlencode
from urllib.request import (
    Request,
    urlopen,
)

from bs4 import BeautifulSoup
from fastapi import (
    APIRouter,
    HTTPException,
    Query,
)


router = APIRouter(
    tags=["academic-calendar"],
)


INJE_CALENDAR_URL = (
    "https://www.inje.ac.kr"
    "/kor/setRoute/B_Page.asp"
)


DATE_PATTERN = re.compile(
    r"(\d{2})\.\s*(\d{2})\."
)


def build_inje_calendar_url(
    year: int,
) -> str:
    query = urlencode(
        {
            "pCode": "IF010010000",
            "varCat": "",
            "setYear": year,
            "viewType": "vy",
            "setMonth": 1,
        }
    )

    return (
        f"{INJE_CALENDAR_URL}?{query}"
    )


def fetch_calendar_html(
    year: int,
) -> str:
    url = build_inje_calendar_url(year)

    request = Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 "
                "(compatible; InyakPlanner/1.0)"
            ),
        },
    )

    try:
        ssl_context = (
            ssl._create_unverified_context()
        )

        with urlopen(
            request,
            timeout=15,
            context=ssl_context,
        ) as response:
            return response.read().decode(
                "utf-8"
            )
    except (
        HTTPError,
        URLError,
        TimeoutError,
    ) as error:
        print(
            "academic calendar fetch error:",
            repr(error),
        )

        raise HTTPException(
            status_code=502,
            detail=(
                "인제대학교 학사일정을 "
                "불러오지 못했습니다."
            ),
        ) from error


def parse_date_text(
    *,
    year: int,
    raw_date_text: str,
) -> tuple[str, str]:
    matches = DATE_PATTERN.findall(
        raw_date_text
    )

    if not matches:
        raise ValueError(
            "학사일정 날짜를 해석할 수 없습니다."
        )

    start_month, start_day = matches[0]

    if len(matches) >= 2:
        end_month, end_day = matches[-1]
    else:
        end_month = start_month
        end_day = start_day

    start_date = date(
        year,
        int(start_month),
        int(start_day),
    )

    end_date = date(
        year,
        int(end_month),
        int(end_day),
    )

    return (
        start_date.isoformat(),
        end_date.isoformat(),
    )


def parse_calendar_html(
    *,
    year: int,
    html: str,
) -> List[Dict[str, Any]]:
    soup = BeautifulSoup(
        html,
        "html.parser",
    )

    events: List[
        Dict[str, Any]
    ] = []

    for month_card in soup.select(
        ".monthCard"
    ):
        month_number_element = (
            month_card.select_one(
                ".monthNum"
            )
        )

        if month_number_element is None:
            continue

        month_match = re.search(
            r"(\d{1,2})",
            month_number_element.get_text(
                " ",
                strip=True,
            ),
        )

        if month_match is None:
            continue

        month = int(
            month_match.group(1)
        )

        for item in month_card.select(
            ".eventList > li"
        ):
            date_element = item.select_one(
                ".dateTxt"
            )

            title_element = item.select_one(
                ".titleTxt"
            )

            if (
                date_element is None
                or title_element is None
            ):
                continue

            raw_date_text = (
                date_element.get_text(
                    " ",
                    strip=True,
                )
            )

            title = title_element.get_text(
                " ",
                strip=True,
            )

            if not title:
                continue

            try:
                (
                    start_date,
                    end_date,
                ) = parse_date_text(
                    year=year,
                    raw_date_text=(
                        raw_date_text
                    ),
                )
            except ValueError:
                continue

            events.append(
                {
                    "title": title,
                    "month": month,
                    "start_date": (
                        start_date
                    ),
                    "end_date": end_date,
                }
            )

    events.sort(
        key=lambda event: (
            event["start_date"],
            event["end_date"],
            event["title"],
        )
    )

    return events


@router.get(
    "/api/academic-calendar"
)
def read_academic_calendar(
    year: int = Query(
        ge=2000,
        le=2100,
    ),
) -> Dict[str, Any]:
    html = fetch_calendar_html(year)

    events = parse_calendar_html(
        year=year,
        html=html,
    )

    if not events:
        raise HTTPException(
            status_code=502,
            detail=(
                "인제대학교 학사일정에서 "
                "일정을 찾지 못했습니다."
            ),
        )

    return {
        "academic_year": year,
        "count": len(events),
        "events": events,
    }
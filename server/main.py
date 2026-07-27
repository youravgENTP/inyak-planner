from __future__ import annotations
import re
from io import BytesIO
from pathlib import Path
from urllib.parse import quote
from zipfile import (
    ZIP_DEFLATED,
    ZipFile,
)

from typing import (
    Any,
    Dict,
    List,
    Optional,
)

from fastapi import (
    FastAPI,
    HTTPException,
    Query,
    Response,
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from server.database import (
    get_lecture_by_id,
    get_lectures,
    get_lectures_by_ids,
)

PROJECT_ROOT = Path(
    __file__
).resolve().parents[1]

SYLLABI_ROOT = (
    PROJECT_ROOT
    / "data"
    / "raw"
    / "syllabi"
)


app = FastAPI(
    title="Inyak Planner API",
    version="0.1.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

class SyllabiDownloadRequest(BaseModel):
    lecture_ids: List[int]
    timetable_name: str = "시간표"


def sanitize_filename(
    filename: str,
) -> str:
    """다운로드 파일명에 사용할 수 없는 문자를 제거한다."""
    sanitized_filename = re.sub(
        r'[\\/:*?"<>|]',
        "-",
        filename.strip(),
    )

    return sanitized_filename.strip(
        " ."
    )

@app.get("/")
def read_root() -> Dict[str, str]:
    return {
        "message": "Inyak Planner API is running.",
    }


@app.get("/api/lectures")
def read_lectures(
    academic_year: Optional[int] = Query(default=None),
    semester: Optional[int] = Query(default=None, ge=1, le=2),
    query: Optional[str] = Query(default=None),
) -> Dict[str, Any]:
    lectures = get_lectures(
        academic_year=academic_year,
        semester=semester,
        query=query,
    )

    return {
        "count": len(lectures),
        "lectures": lectures,
    }


@app.get("/api/lectures/{lecture_id}")
def read_lecture(lecture_id: int) -> Dict[str, Any]:
    lecture = get_lecture_by_id(lecture_id)

    if lecture is None:
        raise HTTPException(
            status_code=404,
            detail="강의를 찾을 수 없습니다.",
        )

    return lecture

@app.post("/api/syllabi/download")
def download_syllabi(
    request: SyllabiDownloadRequest,
) -> Response:
    lecture_ids = list(
        dict.fromkeys(request.lecture_ids)
    )

    if not lecture_ids:
        raise HTTPException(
            status_code=400,
            detail="다운로드할 강의를 선택해 주세요.",
        )

    lectures = get_lectures_by_ids(
        lecture_ids
    )

    found_lecture_ids = {
        lecture["id"]
        for lecture in lectures
    }

    missing_lecture_ids = [
        lecture_id
        for lecture_id in lecture_ids
        if lecture_id not in found_lecture_ids
    ]

    if missing_lecture_ids:
        missing_ids_text = ", ".join(
            str(lecture_id)
            for lecture_id in missing_lecture_ids
        )

        raise HTTPException(
            status_code=404,
            detail=(
                "일부 강의를 찾을 수 없습니다: "
                f"{missing_ids_text}"
            ),
        )

    zip_buffer = BytesIO()
    missing_syllabi: List[str] = []

    with ZipFile(
        zip_buffer,
        mode="w",
        compression=ZIP_DEFLATED,
    ) as zip_file:
        for lecture in lectures:
            course_code = str(
                lecture["course_code"]
            )

            section = str(
                lecture["section"]
            )

            academic_year = int(
                lecture["academic_year"]
            )

            semester = int(
                lecture["semester"]
            )

            syllabus_filename = (
                f"{course_code}-{section}.pdf"
            )

            syllabus_path = (
                SYLLABI_ROOT
                / str(academic_year)
                / str(semester)
                / syllabus_filename
            )

            if not syllabus_path.is_file():
                missing_syllabi.append(
                    syllabus_filename
                )

                continue

            zip_file.write(
                syllabus_path,
                arcname=syllabus_filename,
            )

    if missing_syllabi:
        missing_files_text = ", ".join(
            missing_syllabi
        )

        raise HTTPException(
            status_code=404,
            detail=(
                "다음 강의계획서 PDF를 "
                "찾을 수 없습니다: "
                f"{missing_files_text}"
            ),
        )

    zip_buffer.seek(0)

    safe_timetable_name = (
        sanitize_filename(
            request.timetable_name
        )
        or "시간표"
    )

    download_filename = (
        f"{safe_timetable_name}"
        "-강의계획서.zip"
    )

    encoded_filename = quote(
        download_filename
    )

    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/zip",
        headers={
            "Content-Disposition": (
                "attachment; "
                "filename=\"syllabi.zip\"; "
                "filename*=UTF-8''"
                f"{encoded_filename}"
            ),
        },
    )
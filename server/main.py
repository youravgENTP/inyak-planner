from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from server.database import get_lecture_by_id, get_lectures


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
    allow_methods=["GET"],
    allow_headers=["*"],
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
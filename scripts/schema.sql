PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY,
    academic_year INTEGER NOT NULL,
    semester INTEGER NOT NULL CHECK (semester IN (1, 2)),
    track TEXT NOT NULL,
    course_code TEXT NOT NULL,
    course_name TEXT NOT NULL,
    section TEXT NOT NULL,
    completion_type TEXT,
    credits REAL,
    professor TEXT,
    department TEXT,
    recommended_year INTEGER,
    grading_method TEXT,
    competency_type TEXT,
    schedule_and_room TEXT,
    first_collected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_collected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (
        academic_year,
        semester,
        track,
        course_code,
        section
    )
);

/* 교과목 코드 검색 */
CREATE INDEX IF NOT EXISTS idx_courses_code
ON courses (course_code);

/* (학년도 + 학기) 조합 검색 */
CREATE INDEX IF NOT EXISTS idx_courses_term 
On courses (academic_year, semester);
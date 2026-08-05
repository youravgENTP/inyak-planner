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


/* =========================================================
   학번별 교육과정
   ========================================================= */

CREATE TABLE IF NOT EXISTS curriculum_courses (
    id INTEGER PRIMARY KEY,

    /* 입학 학년도: 예) 2024학번 */
    entry_year INTEGER NOT NULL,

    /* 교육과정상 권장 학년 */
    grade INTEGER NOT NULL
        CHECK (grade BETWEEN 1 AND 6),

    /* 교육과정상 권장 학기 */
    semester INTEGER NOT NULL
        CHECK (semester IN (1, 2)),

    /* 교육과정표에 기재된 과목명 */
    course_name TEXT NOT NULL,

    /*
     * 대표 학정번호
     * 동일 과목에 여러 코드가 확인되면 가장 최근 개설 코드를 저장
     * 이전 코드는 notes에 기록
     */
    course_code TEXT,

    /* 해당 학번 교육과정 기준 전필·전선 */
    completion_type TEXT NOT NULL
        CHECK (completion_type IN ('전필', '전선')),

    /* 해당 학번 교육과정 기준 학점 */
    credits REAL,

    /*
     * 명칭 변경, 이전 학정번호, 미개설,
     * 동일·대체 관계 미확정 등의 설명
     */
    notes TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (
        entry_year,
        grade,
        semester,
        course_name
    )
);


/* 입학연도·학년·학기별 교육과정 검색 */

CREATE INDEX IF NOT EXISTS idx_curriculum_courses_entry_year
ON curriculum_courses (
    entry_year,
    grade,
    semester
);


/* 대표 학정번호 검색 */

CREATE INDEX IF NOT EXISTS idx_curriculum_courses_code
ON curriculum_courses (
    course_code
);
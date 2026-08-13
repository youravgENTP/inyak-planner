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

    /*
     * 교육과정 개편으로 서로 연결된
     * 과목들을 묶는 그룹 식별자
     */
    change_group TEXT,

    /*
     * 과목 변경 관계
     * 예: 1:N, N:1
     */
    change_type TEXT
        CHECK (
            change_type IS NULL
            OR change_type IN (
                '1:1',
                '1:N',
                'N:1',
                'N:M'
            )
        ),

    /*
     * current:
     * 현재 졸업요건 계산에 사용하는 과목
     *
     * legacy:
     * 변경 이전 과목.
     * UI에는 표시하지만 졸업요건 계산에서는 제외
     */
    change_role TEXT NOT NULL
        DEFAULT 'current'
        CHECK (
            change_role IN (
                'current',
                'legacy'
            )
        ),

    /*
     * 변경 내용이 실제 교육과정에 반영된 학년도
     */
    change_effective_year INTEGER
        CHECK (
            change_effective_year IS NULL
            OR change_effective_year
                BETWEEN 2000 AND 2100
        ),

    /*
     * 변경 관계에 대한 설명
     */
    change_note TEXT,

    /*
     * 동일 과목의 속성 변경 이전 학점
     */
    previous_credits REAL,

    /*
     * 동일 과목의 속성 변경 이전 이수구분
     */
    previous_completion_type TEXT
        CHECK (
            previous_completion_type IS NULL
            OR previous_completion_type IN (
                '전필',
                '전선'
            )
        ),

    /*
     * 동일 과목의 속성 변경 이전 권장 학년
     */
    previous_grade INTEGER
        CHECK (
            previous_grade IS NULL
            OR previous_grade BETWEEN 1 AND 6
        ),

    /*
     * 동일 과목의 속성 변경 이전 권장 학기
     */
    previous_semester INTEGER
        CHECK (
            previous_semester IS NULL
            OR previous_semester IN (1, 2)
        ),

    /*
     * 동일 과목의 속성 변경이 적용된 학년도
     */
    attribute_change_effective_year INTEGER
        CHECK (
            attribute_change_effective_year IS NULL
            OR attribute_change_effective_year
                BETWEEN 2000 AND 2100
        ),

    /*
     * 학점·이수구분·학년·학기 변경 설명
     */
    attribute_change_note TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (
        entry_year,
        grade,
        semester,
        course_name,
        course_code,
        change_role
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

/* 교육과정 변경 그룹 검색 */

CREATE INDEX IF NOT EXISTS idx_curriculum_courses_change_group
ON curriculum_courses (
    entry_year,
    change_group
);


/* =========================================================
   학번별 전공 졸업요건
   ========================================================= */

/*
 * 입학 학년도별 전공필수·전공선택 최소 이수학점을
 * 저장합니다.
 *
 * 교양 졸업요건은 아래의
 * general_education_requirements 테이블에서
 * 별도로 관리합니다.
 */
CREATE TABLE IF NOT EXISTS graduation_requirements (
    id INTEGER PRIMARY KEY,

    /* 입학 학년도: 예) 2024학번 */
    entry_year INTEGER NOT NULL UNIQUE,

    /* 졸업에 필요한 최소 전공필수 학점 */
    major_required_credits REAL NOT NULL
        CHECK (major_required_credits >= 0),

    /* 졸업에 필요한 최소 전공선택 학점 */
    major_elective_credits REAL NOT NULL
        CHECK (major_elective_credits >= 0),

    /* 원자료 출처나 예외사항 */
    notes TEXT,

    created_at TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP
);


/* 입학연도별 전공 졸업요건 검색 */

CREATE INDEX IF NOT EXISTS
idx_graduation_requirements_entry_year
ON graduation_requirements (
    entry_year
);


/* =========================================================
   학번별 교양 졸업요건
   ========================================================= */

/*
 * 기초교양·균형교양처럼 교양의 큰 이수구분과
 * 해당 이수구분의 전체 졸업요건을 저장합니다.
 */
CREATE TABLE IF NOT EXISTS general_education_requirements (
    id INTEGER PRIMARY KEY,

    /* 입학 학년도: 예) 2024학번 */
    entry_year INTEGER NOT NULL,

    /* 교양의 큰 이수구분 */
    category TEXT NOT NULL
        CHECK (
            category IN (
                '기초교양',
                '균형교양'
            )
        ),

    /* 해당 이수구분에서 요구하는 최소 총학점 */
    minimum_credits REAL NOT NULL
        CHECK (minimum_credits >= 0),

    /*
     * 일정 개수 이상의 세부 영역을 이수해야 하는 경우 사용합니다.
     * 예: 균형교양 3개 영역 이상
     */
    minimum_area_count INTEGER
        CHECK (
            minimum_area_count IS NULL
            OR minimum_area_count >= 0
        ),

    /* 복잡한 이수조건이나 원자료 설명 */
    notes TEXT,

    /* 화면 표시 순서 */
    display_order INTEGER NOT NULL
        CHECK (display_order >= 0),

    created_at TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (
        entry_year,
        category
    )
);


/*
 * 각 교양 이수구분에 포함되는 세부 영역을 저장합니다.
 *
 * 기초교양:
 * 사고, 언어와 표현, 외국어, 코딩 등
 *
 * 균형교양:
 * 인간과 예술, 사회와 문화, 과학과 기술,
 * 융합과 창의 등
 */
CREATE TABLE IF NOT EXISTS general_education_areas (
    id INTEGER PRIMARY KEY,

    requirement_id INTEGER NOT NULL,

    /* 세부 영역명 */
    area_name TEXT NOT NULL,

    /*
     * 해당 영역 자체에 최소 이수학점이 있는 경우 저장합니다.
     * 균형교양처럼 영역별 최소학점이 없으면 NULL입니다.
     */
    minimum_credits REAL
        CHECK (
            minimum_credits IS NULL
            OR minimum_credits >= 0
        ),

    /*
     * 이 영역 자체가 필수인지 표시합니다.
     *
     * 기초교양의 세부 영역은 일반적으로 1,
     * 균형교양 선택 영역은 0으로 저장합니다.
     */
    is_required INTEGER NOT NULL
        DEFAULT 0
        CHECK (is_required IN (0, 1)),

    /* 세부 조건이나 원자료 설명 */
    notes TEXT,

    /* 화면 표시 순서 */
    display_order INTEGER NOT NULL
        CHECK (display_order >= 0),

    created_at TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (
        requirement_id
    )
    REFERENCES general_education_requirements (id)
    ON DELETE CASCADE,

    UNIQUE (
        requirement_id,
        area_name
    )
);


/* 학번별 교양 대분류 조회 */
CREATE INDEX IF NOT EXISTS
idx_general_education_requirements_entry_year
ON general_education_requirements (
    entry_year,
    display_order
);


/* 교양 대분류별 세부 영역 조회 */
CREATE INDEX IF NOT EXISTS
idx_general_education_areas_requirement
ON general_education_areas (
    requirement_id,
    display_order
);
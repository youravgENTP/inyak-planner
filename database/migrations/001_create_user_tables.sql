-- =========================================================
-- Inyak Planner
-- User / authentication schema
-- =========================================================


-- ---------------------------------------------------------
-- 1. Users
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY,

    username TEXT NOT NULL,
    username_normalized TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,

    profile_image_filename TEXT,

    entry_year INTEGER,
    student_type TEXT,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT users_entry_year_check
        CHECK (
            entry_year IS NULL
            OR entry_year BETWEEN 2000 AND 2100
        ),

    CONSTRAINT users_student_type_check
        CHECK (
            student_type IS NULL
            OR student_type IN (
                'regular',
                'transfer'
            )
        )
);


-- ---------------------------------------------------------
-- 2. Login sessions
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY,

    user_id UUID NOT NULL,

    token_hash TEXT NOT NULL UNIQUE,

    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT sessions_user_fk
        FOREIGN KEY (user_id)
        REFERENCES public.users(id)
        ON DELETE CASCADE
);


-- ---------------------------------------------------------
-- 3. User course records
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_course_records (
    id UUID PRIMARY KEY,

    user_id UUID NOT NULL,

    curriculum_course_id BIGINT,
    lecture_id BIGINT,

    general_education_requirement_id BIGINT,
    general_education_area_id BIGINT,

    academic_year INTEGER,
    grade INTEGER,
    semester INTEGER,
    term TEXT,

    course_name TEXT NOT NULL,
    course_code TEXT,

    completion_type TEXT NOT NULL,

    credits DOUBLE PRECISION NOT NULL,

    status TEXT NOT NULL,
    letter_grade TEXT,

    is_retake BOOLEAN NOT NULL DEFAULT FALSE,

    note TEXT,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT user_course_records_user_fk
        FOREIGN KEY (user_id)
        REFERENCES public.users(id)
        ON DELETE CASCADE,

    CONSTRAINT user_course_records_academic_year_check
        CHECK (
            academic_year IS NULL
            OR academic_year BETWEEN 2000 AND 2100
        ),

    CONSTRAINT user_course_records_grade_check
        CHECK (
            grade IS NULL
            OR grade BETWEEN 1 AND 6
        ),

    CONSTRAINT user_course_records_semester_check
        CHECK (
            semester IS NULL
            OR semester IN (1, 2)
        ),

    CONSTRAINT user_course_records_term_check
        CHECK (
            term IS NULL
            OR term IN (
                'spring',
                'summer',
                'fall',
                'winter'
            )
        ),

    CONSTRAINT user_course_records_completion_type_check
        CHECK (
            completion_type IN (
                '전필',
                '전선',
                '교양',
                '기타'
            )
        ),

    CONSTRAINT user_course_records_status_check
        CHECK (
            status IN (
                'planned',
                'in_progress',
                'completed',
                'substituted'
            )
        ),

    CONSTRAINT user_course_records_credits_check
        CHECK (credits >= 0)
);


-- ---------------------------------------------------------
-- 4. Summer / winter semesters
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_special_semesters (
    id UUID PRIMARY KEY,

    user_id UUID NOT NULL,

    grade INTEGER NOT NULL,
    semester INTEGER NOT NULL,
    term TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT user_special_semesters_user_fk
        FOREIGN KEY (user_id)
        REFERENCES public.users(id)
        ON DELETE CASCADE,

    CONSTRAINT user_special_semesters_grade_check
        CHECK (
            grade BETWEEN 1 AND 6
        ),

    CONSTRAINT user_special_semesters_semester_check
        CHECK (
            semester IN (1, 2)
        ),

    CONSTRAINT user_special_semesters_term_check
        CHECK (
            term IN (
                'summer',
                'winter'
            )
        ),

    CONSTRAINT user_special_semesters_unique
        UNIQUE (
            user_id,
            grade,
            term
        )
);


-- =========================================================
-- Indexes
-- =========================================================

CREATE INDEX IF NOT EXISTS
    idx_sessions_user_id
ON public.sessions(user_id);


CREATE INDEX IF NOT EXISTS
    idx_sessions_expires_at
ON public.sessions(expires_at);


CREATE INDEX IF NOT EXISTS
    idx_user_course_records_user_id
ON public.user_course_records(user_id);


CREATE INDEX IF NOT EXISTS
    idx_user_course_records_user_semester
ON public.user_course_records(
    user_id,
    academic_year,
    semester
);


CREATE INDEX IF NOT EXISTS
    idx_user_course_records_user_grade_semester
ON public.user_course_records(
    user_id,
    grade,
    semester
);


CREATE INDEX IF NOT EXISTS
    idx_user_course_records_curriculum_course
ON public.user_course_records(
    user_id,
    curriculum_course_id
);


CREATE INDEX IF NOT EXISTS
    idx_user_course_records_general_education
ON public.user_course_records(
    user_id,
    general_education_requirement_id,
    general_education_area_id
);


CREATE INDEX IF NOT EXISTS
    idx_user_special_semesters_user_id
ON public.user_special_semesters(user_id);
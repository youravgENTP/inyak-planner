-- =========================================================
-- Inyak Planner
-- User saved timetables
-- =========================================================

CREATE TABLE IF NOT EXISTS public.user_saved_timetables (
    id UUID PRIMARY KEY,

    user_id UUID NOT NULL,

    name TEXT NOT NULL,

    academic_year INTEGER NOT NULL,
    semester INTEGER NOT NULL,

    lecture_ids BIGINT[] NOT NULL DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT user_saved_timetables_user_fk
        FOREIGN KEY (user_id)
        REFERENCES public.users(id)
        ON DELETE CASCADE,

    CONSTRAINT user_saved_timetables_academic_year_check
        CHECK (
            academic_year BETWEEN 2000 AND 2100
        ),

    CONSTRAINT user_saved_timetables_semester_check
        CHECK (
            semester IN (1, 2)
        )
);

CREATE INDEX IF NOT EXISTS
    idx_user_saved_timetables_user_id
ON public.user_saved_timetables(user_id);

CREATE INDEX IF NOT EXISTS
    idx_user_saved_timetables_user_semester
ON public.user_saved_timetables(
    user_id,
    academic_year,
    semester
);
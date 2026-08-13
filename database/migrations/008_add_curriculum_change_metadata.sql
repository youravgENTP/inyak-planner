-- =========================================================
-- Inyak Planner
-- Curriculum course change metadata
-- =========================================================
--
-- 학번별 교육과정이 이후 개편되면서 발생한
-- 1:1 / 1:N / N:1 / N:M 과목 변경 관계를 저장한다.
--
-- legacy 과목은 교육과정 변경 이력을 보여주기 위한
-- 표시용 데이터이고,
-- 현재 졸업요건 계산은 current 과목만 사용한다.
-- =========================================================


-- ---------------------------------------------------------
-- 1. Add curriculum change columns
-- ---------------------------------------------------------

ALTER TABLE public.curriculum_courses
ADD COLUMN IF NOT EXISTS change_group TEXT;

ALTER TABLE public.curriculum_courses
ADD COLUMN IF NOT EXISTS change_type TEXT;

ALTER TABLE public.curriculum_courses
ADD COLUMN IF NOT EXISTS change_role TEXT
    NOT NULL
    DEFAULT 'current';

ALTER TABLE public.curriculum_courses
ADD COLUMN IF NOT EXISTS change_effective_year INTEGER;

ALTER TABLE public.curriculum_courses
ADD COLUMN IF NOT EXISTS change_note TEXT;


-- ---------------------------------------------------------
-- 2. Change type constraint
-- ---------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE
            conname =
                'curriculum_change_type_check'
            AND conrelid =
                'public.curriculum_courses'::regclass
    ) THEN
        ALTER TABLE public.curriculum_courses
        ADD CONSTRAINT curriculum_change_type_check
        CHECK (
            change_type IS NULL
            OR change_type IN (
                '1:1',
                '1:N',
                'N:1',
                'N:M'
            )
        );
    END IF;
END
$$;


-- ---------------------------------------------------------
-- 3. Current / legacy constraint
-- ---------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE
            conname =
                'curriculum_change_role_check'
            AND conrelid =
                'public.curriculum_courses'::regclass
    ) THEN
        ALTER TABLE public.curriculum_courses
        ADD CONSTRAINT curriculum_change_role_check
        CHECK (
            change_role IN (
                'current',
                'legacy'
            )
        );
    END IF;
END
$$;


-- ---------------------------------------------------------
-- 4. Effective year constraint
-- ---------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE
            conname =
                'curriculum_change_effective_year_check'
            AND conrelid =
                'public.curriculum_courses'::regclass
    ) THEN
        ALTER TABLE public.curriculum_courses
        ADD CONSTRAINT
            curriculum_change_effective_year_check
        CHECK (
            change_effective_year IS NULL
            OR change_effective_year
                BETWEEN 2000 AND 2100
        );
    END IF;
END
$$;


-- ---------------------------------------------------------
-- 5. Change metadata consistency
-- ---------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE
            conname =
                'curriculum_change_metadata_check'
            AND conrelid =
                'public.curriculum_courses'::regclass
    ) THEN
        ALTER TABLE public.curriculum_courses
        ADD CONSTRAINT
            curriculum_change_metadata_check
        CHECK (
            (
                change_group IS NULL
                AND change_type IS NULL
                AND change_role = 'current'
            )
            OR
            (
                change_group IS NOT NULL
                AND change_type IS NOT NULL
            )
        );
    END IF;
END
$$;


-- ---------------------------------------------------------
-- 6. Index for change-group lookup
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS
idx_curriculum_courses_change_group
ON public.curriculum_courses (
    entry_year,
    change_group
)
WHERE change_group IS NOT NULL;
-- =========================================================
-- Inyak Planner
-- Curriculum course attribute change metadata
-- =========================================================
--
-- 동일한 과목이 유지되면서
-- 학점 / 이수구분 / 권장 학년 / 권장 학기가
-- 변경된 이력을 저장한다.
--
-- 구조 변경(change_group)과는 별개의 개념이다.
-- 현재 졸업요건 계산에는 현재 값만 사용한다.
-- =========================================================


-- ---------------------------------------------------------
-- 1. Previous curriculum attributes
-- ---------------------------------------------------------

ALTER TABLE public.curriculum_courses
ADD COLUMN IF NOT EXISTS previous_credits REAL;

ALTER TABLE public.curriculum_courses
ADD COLUMN IF NOT EXISTS previous_completion_type TEXT;

ALTER TABLE public.curriculum_courses
ADD COLUMN IF NOT EXISTS previous_grade INTEGER;

ALTER TABLE public.curriculum_courses
ADD COLUMN IF NOT EXISTS previous_semester INTEGER;


-- ---------------------------------------------------------
-- 2. Attribute-change metadata
-- ---------------------------------------------------------

ALTER TABLE public.curriculum_courses
ADD COLUMN IF NOT EXISTS
    attribute_change_effective_year INTEGER;

ALTER TABLE public.curriculum_courses
ADD COLUMN IF NOT EXISTS
    attribute_change_note TEXT;


-- ---------------------------------------------------------
-- 3. Previous completion-type constraint
-- ---------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE
            conname =
                'curriculum_previous_completion_type_check'
            AND conrelid =
                'public.curriculum_courses'::regclass
    ) THEN
        ALTER TABLE public.curriculum_courses
        ADD CONSTRAINT
            curriculum_previous_completion_type_check
        CHECK (
            previous_completion_type IS NULL
            OR previous_completion_type IN (
                '전필',
                '전선'
            )
        );
    END IF;
END
$$;


-- ---------------------------------------------------------
-- 4. Previous grade constraint
-- ---------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE
            conname =
                'curriculum_previous_grade_check'
            AND conrelid =
                'public.curriculum_courses'::regclass
    ) THEN
        ALTER TABLE public.curriculum_courses
        ADD CONSTRAINT
            curriculum_previous_grade_check
        CHECK (
            previous_grade IS NULL
            OR previous_grade BETWEEN 1 AND 6
        );
    END IF;
END
$$;


-- ---------------------------------------------------------
-- 5. Previous semester constraint
-- ---------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE
            conname =
                'curriculum_previous_semester_check'
            AND conrelid =
                'public.curriculum_courses'::regclass
    ) THEN
        ALTER TABLE public.curriculum_courses
        ADD CONSTRAINT
            curriculum_previous_semester_check
        CHECK (
            previous_semester IS NULL
            OR previous_semester IN (1, 2)
        );
    END IF;
END
$$;


-- ---------------------------------------------------------
-- 6. Attribute-change effective year constraint
-- ---------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE
            conname =
                'curriculum_attribute_change_year_check'
            AND conrelid =
                'public.curriculum_courses'::regclass
    ) THEN
        ALTER TABLE public.curriculum_courses
        ADD CONSTRAINT
            curriculum_attribute_change_year_check
        CHECK (
            attribute_change_effective_year IS NULL
            OR attribute_change_effective_year
                BETWEEN 2000 AND 2100
        );
    END IF;
END
$$;


-- ---------------------------------------------------------
-- 7. Metadata consistency
-- ---------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE
            conname =
                'curriculum_attribute_change_metadata_check'
            AND conrelid =
                'public.curriculum_courses'::regclass
    ) THEN
        ALTER TABLE public.curriculum_courses
        ADD CONSTRAINT
            curriculum_attribute_change_metadata_check
        CHECK (
            (
                previous_credits IS NULL
                AND previous_completion_type IS NULL
                AND previous_grade IS NULL
                AND previous_semester IS NULL
                AND attribute_change_effective_year IS NULL
                AND attribute_change_note IS NULL
            )
            OR
            (
                previous_credits IS NOT NULL
                OR previous_completion_type IS NOT NULL
                OR previous_grade IS NOT NULL
                OR previous_semester IS NOT NULL
            )
        );
    END IF;
END
$$;
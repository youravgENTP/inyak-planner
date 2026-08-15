-- =========================================================
-- Inyak Planner
-- Protect user curriculum-course references
-- =========================================================
--
-- 목적:
-- user_course_records.curriculum_course_id가
-- 존재하지 않는 curriculum_courses.id를 가리키지 못하게 하고,
-- 사용자 기록이 참조 중인 교육과정 행의 삭제를 막는다.
--
-- ON DELETE RESTRICT:
--   사용자 기록에서 참조 중인 curriculum_courses 행은
--   삭제할 수 없다.
--
-- ON UPDATE RESTRICT:
--   참조 중인 curriculum_courses.id 자체도
--   임의로 변경할 수 없다.
-- =========================================================

BEGIN;


-- ---------------------------------------------------------
-- 1. 기존 고아 참조 검사
--
-- 하나라도 존재하면 migration 전체를 중단한다.
-- ---------------------------------------------------------

DO $$
DECLARE
    orphan_count BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO orphan_count
    FROM public.user_course_records AS ucr
    LEFT JOIN public.curriculum_courses AS cc
        ON cc.id = ucr.curriculum_course_id
    WHERE
        ucr.curriculum_course_id IS NOT NULL
        AND cc.id IS NULL;

    IF orphan_count <> 0 THEN
        RAISE EXCEPTION
            'curriculum_course_id 고아 참조가 %개 있어 FK를 추가할 수 없습니다.',
            orphan_count;
    END IF;
END
$$;


-- ---------------------------------------------------------
-- 2. FK 참조 컬럼 인덱스
--
-- curriculum_courses 행 삭제/변경 시
-- 해당 ID를 참조하는 사용자 기록을 빠르게 찾도록 한다.
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS
    idx_user_course_records_curriculum_course_id
ON public.user_course_records (
    curriculum_course_id
);


-- ---------------------------------------------------------
-- 3. curriculum_course_id 외래키 추가
--
-- 이미 같은 이름의 constraint가 있다면 건너뛴다.
-- ---------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE
            conname =
                'user_course_records_curriculum_course_fk'
            AND conrelid =
                'public.user_course_records'::regclass
    ) THEN
        ALTER TABLE public.user_course_records
        ADD CONSTRAINT
            user_course_records_curriculum_course_fk
        FOREIGN KEY (
            curriculum_course_id
        )
        REFERENCES public.curriculum_courses (
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT;
    END IF;
END
$$;


COMMIT;
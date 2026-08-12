-- =========================================================
-- Inyak Planner
-- Remove legacy plaintext letter grade column
-- =========================================================
--
-- 성적 저장 방식이 서버 측 AES-GCM 암호화(version 2)로
-- 완전히 전환되었으므로 기존 평문 letter_grade 컬럼을 제거한다.
--
-- 이후 DB에는 성적 평문을 저장할 수 없다.
-- =========================================================


-- ---------------------------------------------------------
-- 1. Safety check
-- ---------------------------------------------------------

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.user_course_records
        WHERE letter_grade IS NOT NULL
    ) THEN
        RAISE EXCEPTION
            'letter_grade 평문 데이터가 남아 있어 컬럼을 삭제할 수 없습니다.';
    END IF;
END
$$;


-- ---------------------------------------------------------
-- 2. Drop legacy plaintext column
-- ---------------------------------------------------------

ALTER TABLE public.user_course_records
DROP COLUMN letter_grade;
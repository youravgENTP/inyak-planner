-- =========================================================
-- Inyak Planner
-- Server-side grade encryption version
-- =========================================================
--
-- crypto version 1:
-- 기존 브라우저(client-side) AES-GCM 암호화
--
-- crypto version 2:
-- 새로운 서버(server-side) AES-GCM 암호화
--
-- 전환 기간 동안 두 형식을 모두 허용한다.
-- =========================================================


ALTER TABLE public.user_course_records
DROP CONSTRAINT IF EXISTS
    user_course_records_letter_grade_crypto_version_check;


ALTER TABLE public.user_course_records
ADD CONSTRAINT
    user_course_records_letter_grade_crypto_version_check
CHECK (
    letter_grade_crypto_version IS NULL
    OR letter_grade_crypto_version IN (1, 2)
);
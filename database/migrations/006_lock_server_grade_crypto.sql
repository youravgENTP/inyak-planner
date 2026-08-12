-- =========================================================
-- Inyak Planner
-- Lock grade encryption to server-side crypto version 2
-- =========================================================
--
-- version 1 브라우저 암호화 데이터의 migration이
-- 완료되었으므로 앞으로는:
--
-- - 성적이 없는 기록: crypto version NULL 허용
-- - 암호화된 성적: crypto version 2만 허용
--
-- version 1은 더 이상 저장할 수 없다.
-- =========================================================


ALTER TABLE public.user_course_records
DROP CONSTRAINT IF EXISTS
    user_course_records_letter_grade_crypto_version_check;


ALTER TABLE public.user_course_records
ADD CONSTRAINT
    user_course_records_letter_grade_crypto_version_check
CHECK (
    letter_grade_crypto_version IS NULL
    OR letter_grade_crypto_version = 2
);
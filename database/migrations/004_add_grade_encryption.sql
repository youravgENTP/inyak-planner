-- =========================================================
-- Inyak Planner
-- Client-side grade encryption
-- =========================================================
--
-- 사용자 성적(letter_grade)을 브라우저에서 암호화한 뒤
-- 서버에는 암호문만 저장하기 위한 컬럼을 추가한다.
--
-- 기존 letter_grade 컬럼은 migration 기간 동안만 유지한다.
-- 모든 기존 데이터가 암호화된 뒤 별도 migration에서 제거한다.
-- =========================================================


-- ---------------------------------------------------------
-- 1. Encrypted letter grade
-- ---------------------------------------------------------

ALTER TABLE public.user_course_records
ADD COLUMN IF NOT EXISTS
    letter_grade_ciphertext TEXT;

ALTER TABLE public.user_course_records
ADD COLUMN IF NOT EXISTS
    letter_grade_iv TEXT;

ALTER TABLE public.user_course_records
ADD COLUMN IF NOT EXISTS
    letter_grade_crypto_version INTEGER;


-- ---------------------------------------------------------
-- 2. Encryption metadata consistency
-- ---------------------------------------------------------

ALTER TABLE public.user_course_records
ADD CONSTRAINT
    user_course_records_letter_grade_crypto_check
CHECK (
    (
        letter_grade_ciphertext IS NULL
        AND letter_grade_iv IS NULL
        AND letter_grade_crypto_version IS NULL
    )
    OR
    (
        letter_grade_ciphertext IS NOT NULL
        AND letter_grade_iv IS NOT NULL
        AND letter_grade_crypto_version IS NOT NULL
    )
);


-- ---------------------------------------------------------
-- 3. Supported crypto version
-- ---------------------------------------------------------

ALTER TABLE public.user_course_records
ADD CONSTRAINT
    user_course_records_letter_grade_crypto_version_check
CHECK (
    letter_grade_crypto_version IS NULL
    OR letter_grade_crypto_version = 1
);
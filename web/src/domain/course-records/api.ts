import type {
  AcademicTerm,
  CourseCompletionType,
  CourseRecord,
  CourseRecordInput,
  CourseRecordStatus,
} from './types'

// 성적 암호화 관련 임포트
import {
  decryptLetterGrade,
  getStoredGradeKey,
} from './crypto'


// const API_BASE_URL =
//   'http://localhost:8000'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  'http://localhost:8000'


interface CourseRecordApiItem {
  id: string
  user_id: string
  curriculum_course_id: number | null
  lecture_id: number | null
  general_education_requirement_id:
    number | null
  general_education_area_id:
    number | null
  academic_year: number | null
  grade: number | null
  semester: number | null
  term: AcademicTerm | null
  course_name: string
  course_code: string | null
  completion_type: CourseCompletionType
  credits: number
  status: CourseRecordStatus
  letter_grade: string | null

  letter_grade_ciphertext:
    string | null

  letter_grade_iv:
    string | null

  letter_grade_crypto_version:
    number | null

  is_retake: boolean
  note: string | null
  created_at: string
  updated_at: string
}

interface CourseRecordsResponse {
  count: number
  records: CourseRecordApiItem[]
}

interface CourseRecordsErrorResponse {
  detail?: unknown
}


// 수정 : 암호문이 있는 경우에만 복호화
async function mapCourseRecord(
  record: CourseRecordApiItem,
): Promise<CourseRecord> {
  let letterGrade =
    record.letter_grade

  const hasEncryptedLetterGrade =
    record.letter_grade_ciphertext !==
      null &&
    record.letter_grade_iv !== null &&
    record.letter_grade_crypto_version !==
      null

  if (hasEncryptedLetterGrade) {
    const key =
      await getStoredGradeKey(
        record.user_id,
      )

    if (key === null) {
      throw new Error(
        '이 기기에서 성적 암호화 키를 찾을 수 없습니다. 계정 설정에서 복구 코드를 이용해 성적 암호화 키를 복원해 주세요.',
      )
    }

    letterGrade =
      await decryptLetterGrade(
        key,
        {
          ciphertext:
            record
              .letter_grade_ciphertext!,
          iv:
            record.letter_grade_iv!,
          cryptoVersion:
            record
              .letter_grade_crypto_version!,
        },
      )
  }

  return {
    id: record.id,
    userId: record.user_id,
    curriculumCourseId:
      record.curriculum_course_id,
    lectureId:
      record.lecture_id,
    generalEducationRequirementId:
      record
        .general_education_requirement_id,
    generalEducationAreaId:
      record.general_education_area_id,
    academicYear:
      record.academic_year,
    grade:
      record.grade,
    semester:
      record.semester,
    term:
      record.term,
    courseName:
      record.course_name,
    courseCode:
      record.course_code,
    completionType:
      record.completion_type,
    credits:
      record.credits,
    status:
      record.status,

    letterGrade,

    isRetake:
      record.is_retake,
    note:
      record.note,
    createdAt:
      record.created_at,
    updatedAt:
      record.updated_at,
  }
}


async function getErrorMessage(
  response: Response,
  fallbackMessage: string,
): Promise<string> {
  try {
    const data =
      (await response.json()) as
        CourseRecordsErrorResponse

    if (
      typeof data.detail === 'string' &&
      data.detail.trim().length > 0
    ) {
      return data.detail
    }
  } catch {
    // JSON 응답이 아니면
    // 기본 오류 메시지를 사용합니다.
  }

  return fallbackMessage
}


export async function getCourseRecords():
  Promise<CourseRecord[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/course-records`,
    {
      credentials: 'include',
    },
  )

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        '과목 이수 기록을 불러오지 못했습니다.',
      ),
    )
  }

  const data =
    (await response.json()) as
      CourseRecordsResponse

  return Promise.all(
    data.records.map(
      mapAndMigrateCourseRecord,
    ),
  )
}

async function mapCourseRecordInput(
  input: CourseRecordInput,
  _userId?: string,
) {
  return {
    curriculum_course_id:
      input.curriculumCourseId,
    lecture_id:
      input.lectureId,
    general_education_requirement_id:
      input.generalEducationRequirementId,
    general_education_area_id:
      input.generalEducationAreaId,
    academic_year:
      input.academicYear,
    grade:
      input.grade ?? null,
    semester:
      input.semester,
    term:
      input.term ?? null,
    course_name:
      input.courseName,
    course_code:
      input.courseCode,
    completion_type:
      input.completionType,
    credits:
      input.credits,
    status:
      input.status,

    /*
     * 성적 평문은 HTTPS를 통해
     * FastAPI로 전달한다.
     *
     * FastAPI가 서버 측 AES-GCM으로
     * 암호화한 뒤 DB에는 암호문만 저장한다.
     */
    letter_grade:
      input.letterGrade,

    /*
     * 브라우저는 더 이상 새 성적을
     * 직접 암호화하지 않는다.
     */
    letter_grade_ciphertext:
      null,

    letter_grade_iv:
      null,

    letter_grade_crypto_version:
      null,

    is_retake:
      input.isRetake,
    note:
      input.note,
  }
}

// 기존의 TEXT 성적을 찾고, 암호화하는 함수

async function mapAndMigrateCourseRecord(
  record: CourseRecordApiItem,
): Promise<CourseRecord> {
  let letterGrade =
    record.letter_grade

  const isLegacyClientEncryptedGrade =
    record.letter_grade_ciphertext !==
      null &&
    record.letter_grade_iv !== null &&
    record.letter_grade_crypto_version ===
      1

  /*
   * 기존 version 1 성적이라면
   * 현재 브라우저에 저장된 기존 키로
   * 한 번 복호화한다.
   */
  if (isLegacyClientEncryptedGrade) {
    const key =
      await getStoredGradeKey(
        record.user_id,
      )

    if (key === null) {
      /*
       * 기존 version 1 데이터는
       * 해당 브라우저 키 없이는
       * 복호화할 수 없다.
       *
       * migration 기간 동안 기존
       * 오류 처리 방식을 그대로 유지한다.
       */
      return mapCourseRecord(record)
    }

    letterGrade =
      await decryptLetterGrade(
        key,
        {
          ciphertext:
            record
              .letter_grade_ciphertext!,
          iv:
            record.letter_grade_iv!,
          cryptoVersion:
            record
              .letter_grade_crypto_version!,
        },
      )
  }

  const isLegacyPlaintextGrade =
    record.letter_grade !== null &&
    record.letter_grade_ciphertext ===
      null &&
    record.letter_grade_iv === null &&
    record.letter_grade_crypto_version ===
      null

  /*
   * migration 대상이 아니면
   * 일반 CourseRecord로 변환한다.
   *
   * 여기에는:
   * - 성적이 없는 기록
   * - 서버에서 이미 복호화된 version 2 기록
   * 이 포함된다.
   */
  if (
    !isLegacyClientEncryptedGrade &&
    !isLegacyPlaintextGrade
  ) {
    return mapCourseRecord(record)
  }

  const input: CourseRecordInput = {
    curriculumCourseId:
      record.curriculum_course_id,

    lectureId:
      record.lecture_id,

    generalEducationRequirementId:
      record
        .general_education_requirement_id,

    generalEducationAreaId:
      record.general_education_area_id,

    academicYear:
      record.academic_year,

    grade:
      record.grade,

    semester:
      record.semester,

    term:
      record.term,

    courseName:
      record.course_name,

    courseCode:
      record.course_code,

    completionType:
      record.completion_type,

    credits:
      record.credits,

    status:
      record.status,

    /*
     * version 1이면 브라우저에서
     * 복호화한 평문 성적,
     *
     * 기존 평문 데이터이면
     * 원래 letter_grade가 들어간다.
     *
     * updateCourseRecord()가 이를
     * FastAPI에 보내면 서버에서
     * version 2로 암호화한다.
     */
    letterGrade,

    isRetake:
      record.is_retake,

    note:
      record.note,
  }

  return updateCourseRecord(
    record.id,
    input,
    record.user_id,
  )
}

export async function createCourseRecord(
  input: CourseRecordInput,
  userId?: string,
): Promise<CourseRecord> {

  const requestBody =
    await mapCourseRecordInput(
      input,
      userId,
    )

  const response = await fetch(
    `${API_BASE_URL}/api/course-records`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type':
          'application/json',
      },
      body: JSON.stringify(
        requestBody,
      ),
    },
  )

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        '과목 이수 기록을 저장하지 못했습니다.',
      ),
    )
  }

  const data =
    (await response.json()) as {
      record: CourseRecordApiItem
    }

  return mapCourseRecord(
    data.record,
  )
}

export async function updateCourseRecord(
  recordId: string,
  input: CourseRecordInput,
  userId?: string,
): Promise<CourseRecord> {
  const requestBody =
    await mapCourseRecordInput(
      input,
      userId,
    )

  const response = await fetch(
    `${API_BASE_URL}/api/course-records/${recordId}`,
    {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type':
          'application/json',
      },
      body: JSON.stringify(
        requestBody,
      ),
    },
  )

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        '과목 이수 기록을 수정하지 못했습니다.',
      ),
    )
  }

  const data =
    (await response.json()) as {
      record: CourseRecordApiItem
    }

  return mapCourseRecord(
    data.record,
  )
}

export async function deleteCourseRecord(
  recordId: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/course-records/${recordId}`,
    {
      method: 'DELETE',
      credentials: 'include',
    },
  )

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        '과목 이수 기록을 삭제하지 못했습니다.',
      ),
    )
  }
}
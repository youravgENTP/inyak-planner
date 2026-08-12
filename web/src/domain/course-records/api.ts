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
  encryptLetterGrade,
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
  userId?: string,
) {
  let encryptedLetterGrade:
    {
      ciphertext: string
      iv: string
      cryptoVersion: number
    } | null = null

  if (input.letterGrade !== null) {
    if (userId === undefined) {
      throw new Error(
        '성적을 암호화하려면 로그인 사용자 정보를 확인할 수 있어야 합니다.',
      )
    }

    const key =
      await getStoredGradeKey(
        userId,
      )

    if (key === null) {
      throw new Error(
        '성적 암호화 키가 없습니다. 계정 설정에서 먼저 성적 암호화 키를 생성하거나 복원해 주세요.',
      )
    }

    encryptedLetterGrade =
      await encryptLetterGrade(
        key,
        input.letterGrade,
      )
  }

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
     * 평문 성적은 서버로 보내지 않는다.
     */
    letter_grade:
      null,

    letter_grade_ciphertext:
      encryptedLetterGrade
        ?.ciphertext ?? null,

    letter_grade_iv:
      encryptedLetterGrade
        ?.iv ?? null,

    letter_grade_crypto_version:
      encryptedLetterGrade
        ?.cryptoVersion ?? null,

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
  /*
   * 이미 암호화된 성적이거나
   * 애초에 성적이 없는 기록은
   * 그대로 일반 변환만 수행한다.
   */
  if (
    record.letter_grade === null ||
    record.letter_grade_ciphertext !==
      null ||
    record.letter_grade_iv !== null ||
    record.letter_grade_crypto_version !==
      null
  ) {
    return mapCourseRecord(record)
  }

  /*
   * 여기까지 왔다면:
   *
   * letter_grade = "A+"
   * ciphertext = null
   *
   * 형태의 기존 평문 데이터이다.
   */
  const key =
    await getStoredGradeKey(
      record.user_id,
    )

  /*
   * 아직 사용자가 암호화 키를
   * 생성하지 않은 경우에는
   * 기존 서비스 동작을 유지한다.
   *
   * 키 생성 후 다음 조회 때
   * 자동으로 migration된다.
   */
  if (key === null) {
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
     * 기존 TEXT 성적을 브라우저에서
     * 암호화하기 위해 입력값으로 전달한다.
     *
     * updateCourseRecord 내부에서는
     * 서버에 이 값을 평문으로 보내지 않고
     * AES-GCM 암호문으로 변환한다.
     */
    letterGrade:
      record.letter_grade,

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
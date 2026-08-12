import type {
  AcademicTerm,
  CourseCompletionType,
  CourseRecord,
  CourseRecordInput,
  CourseRecordStatus,
} from './types'



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


// 수정 : 프론트에서 암호화 방식 자체를 모르도록 재설계
async function mapCourseRecord(
  record: CourseRecordApiItem,
): Promise<CourseRecord> {
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
    letterGrade:
      record.letter_grade,
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
      mapCourseRecord,
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
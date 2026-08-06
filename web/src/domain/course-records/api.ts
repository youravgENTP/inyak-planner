import type {
  CourseCompletionType,
  CourseRecord,
  CourseRecordStatus,
} from './types'


const API_BASE_URL =
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
  semester: number | null
  course_name: string
  course_code: string | null
  completion_type: CourseCompletionType
  credits: number
  status: CourseRecordStatus
  letter_grade: string | null
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


function mapCourseRecord(
  record: CourseRecordApiItem,
): CourseRecord {
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
    semester:
      record.semester,
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

  return data.records.map(
    mapCourseRecord,
  )
}
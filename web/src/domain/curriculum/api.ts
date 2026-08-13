import type {
  Curriculum,
  CurriculumApiResponse,
  CurriculumCourse,
  CurriculumCourseApiItem,
} from './types'

// const API_BASE_URL =
//   'http://127.0.0.1:8000'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  'http://127.0.0.1:8000'

function mapCurriculumCourseApiItem(
  item: CurriculumCourseApiItem,
): CurriculumCourse {
  return {
    id: item.id,
    entryYear: item.entry_year,
    grade: item.grade,
    semester: item.semester,
    courseName: item.course_name,
    courseCode: item.course_code,
    completionType:
      item.completion_type,
    credits: item.credits,
    notes: item.notes,
    changeGroup:
      item.change_group,
    changeType:
      item.change_type,
    changeRole:
      item.change_role,
    changeEffectiveYear:
      item.change_effective_year,
    changeNote:
      item.change_note,
    previousCredits:
      item.previous_credits,
    previousCompletionType:
      item.previous_completion_type,
    previousGrade:
      item.previous_grade,
    previousSemester:
      item.previous_semester,
    attributeChangeEffectiveYear:
      item.attribute_change_effective_year,
    attributeChangeNote:
      item.attribute_change_note,
  }
}

async function getApiErrorMessage(
  response: Response,
  fallbackMessage: string,
): Promise<string> {
  try {
    const data = (
      await response.json()
    ) as {
      detail?: unknown
    }

    if (
      typeof data.detail === 'string' &&
      data.detail.trim().length > 0
    ) {
      return data.detail
    }
  } catch {
    // JSON 오류 응답이 아니면
    // 기본 메시지를 사용합니다.
  }

  return (
    `${fallbackMessage} ` +
    `상태 코드: ${response.status}`
  )
}

export async function fetchCurriculum(
  entryYear: number,
): Promise<Curriculum> {
  const searchParameters =
    new URLSearchParams({
      entry_year: String(entryYear),
    })

  const response = await fetch(
    `${API_BASE_URL}/api/curriculum?` +
      searchParameters.toString(),
  )

  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(
        response,
        '교육과정을 불러오지 못했습니다.',
      ),
    )
  }

  const data =
    (await response.json()) as
      CurriculumApiResponse

  return {
    entryYear: data.entry_year,
    count: data.count,
    courses: data.courses.map(
      mapCurriculumCourseApiItem,
    ),
  }
}
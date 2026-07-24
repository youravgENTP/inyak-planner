import type {
  Lecture,
  LectureApiItem,
  LectureListApiResponse,
} from './types'

const API_BASE_URL = 'http://127.0.0.1:8000'

function mapLectureApiItem(item: LectureApiItem): Lecture {
  return {
    id: item.id,
    academicYear: item.academic_year,
    semester: item.semester,
    track: item.track,
    courseCode: item.course_code,
    courseName: item.course_name,
    section: item.section,
    completionType: item.completion_type,
    credits: item.credits,
    professor: item.professor,
    department: item.department,
    recommendedYear: item.recommended_year,
    gradingMethod: item.grading_method,
    competencyType: item.competency_type,
    scheduleAndRoom: item.schedule_and_room,
  }
}

export async function fetchLectures(): Promise<Lecture[]> {
  const response = await fetch(`${API_BASE_URL}/api/lectures`)

  if (!response.ok) {
    throw new Error(
      `강의 목록을 불러오지 못했습니다. 상태 코드: ${response.status}`,
    )
  }

  const data = (await response.json()) as LectureListApiResponse

  return data.lectures.map(mapLectureApiItem)
}
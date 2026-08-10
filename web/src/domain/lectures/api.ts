import type {
  Lecture,
  LectureApiItem,
  LectureListApiResponse,
} from './types'

// const API_BASE_URL = 'http://127.0.0.1:8000'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  'http://localhost:8000'

interface DownloadSyllabiRequest {
  lecture_ids: number[]
  timetable_name: string
}

export interface SyllabiZipDownload {
  blob: Blob
  filename: string
}

export interface LectureSearchFilters {
  academicYear?: number
  semester?: number
  query?: string
}

function mapLectureApiItem(
  item: LectureApiItem,
): Lecture {
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

function getDownloadFilename(
  response: Response,
  fallbackFilename: string,
): string {
  const contentDisposition =
    response.headers.get(
      'Content-Disposition',
    )

  if (contentDisposition === null) {
    return fallbackFilename
  }

  const encodedFilenameMatch =
    contentDisposition.match(
      /filename\*=UTF-8''([^;]+)/i,
    )

  if (encodedFilenameMatch?.[1]) {
    try {
      return decodeURIComponent(
        encodedFilenameMatch[1],
      )
    } catch {
      return fallbackFilename
    }
  }

  const plainFilenameMatch =
    contentDisposition.match(
      /filename="?([^";]+)"?/i,
    )

  return (
    plainFilenameMatch?.[1]?.trim() ||
    fallbackFilename
  )
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
    // JSON 오류 본문이 아니면 기본 메시지를 사용합니다.
  }

  return `${fallbackMessage} 상태 코드: ${response.status}`
}

function createFallbackZipFilename(
  timetableName: string,
): string {
  const safeName = timetableName
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')

  return `${
    safeName || '시간표'
  }-강의계획서.zip`
}

export async function fetchLectures(
  filters: LectureSearchFilters = {},
): Promise<Lecture[]> {
  const searchParameters =
    new URLSearchParams()

  if (
    filters.academicYear !== undefined
  ) {
    searchParameters.set(
      'academic_year',
      String(filters.academicYear),
    )
  }

  if (
    filters.semester !== undefined
  ) {
    searchParameters.set(
      'semester',
      String(filters.semester),
    )
  }

  const normalizedQuery =
    filters.query?.trim() ?? ''

  if (normalizedQuery.length > 0) {
    searchParameters.set(
      'query',
      normalizedQuery,
    )
  }

  const queryString =
    searchParameters.toString()

  const endpoint =
    queryString.length === 0
      ? `${API_BASE_URL}/api/lectures`
      : (
          `${API_BASE_URL}/api/lectures?` +
          queryString
        )

  const response = await fetch(
    endpoint,
  )

  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(
        response,
        '강의 목록을 불러오지 못했습니다.',
      ),
    )
  }

  const data =
    (await response.json()) as
      LectureListApiResponse

  return data.lectures.map(
    mapLectureApiItem,
  )
}

export async function fetchLecture(
  lectureId: number,
): Promise<Lecture> {
  const response = await fetch(
    `${API_BASE_URL}/api/lectures/${lectureId}`,
  )

  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(
        response,
        '강의 정보를 불러오지 못했습니다.',
      ),
    )
  }

  const data =
    (await response.json()) as
      LectureApiItem

  return mapLectureApiItem(data)
}

export async function downloadSyllabiZip(
  lectureIds: readonly number[],
  timetableName: string,
): Promise<SyllabiZipDownload> {
  if (lectureIds.length === 0) {
    throw new Error(
      '다운로드할 강의가 없습니다.',
    )
  }

  const requestBody:
    DownloadSyllabiRequest = {
      lecture_ids: [...lectureIds],
      timetable_name:
        timetableName.trim() || '시간표',
    }

  const response = await fetch(
    `${API_BASE_URL}/api/syllabi/download`,
    {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/json',
      },
      body: JSON.stringify(requestBody),
    },
  )

  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(
        response,
        '강의계획서를 다운로드하지 못했습니다.',
      ),
    )
  }

  const blob = await response.blob()

  if (blob.size === 0) {
    throw new Error(
      '서버에서 빈 ZIP 파일을 반환했습니다.',
    )
  }

  const fallbackFilename =
    createFallbackZipFilename(
      timetableName,
    )

  return {
    blob,
    filename: getDownloadFilename(
      response,
      fallbackFilename,
    ),
  }
}
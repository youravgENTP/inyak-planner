import type {
  CreateTimetableValues,
  SavedTimetable,
} from './types'


const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  'http://localhost:8000'


interface TimetableApiItem {
  id: string
  user_id: string
  name: string
  academic_year: number
  semester: 1 | 2
  lecture_ids: number[]
  created_at: string
  updated_at: string
}


interface TimetablesResponse {
  count: number
  timetables: TimetableApiItem[]
}


interface TimetableResponse {
  timetable: TimetableApiItem
}


function mapTimetable(
  timetable: TimetableApiItem,
): SavedTimetable {
  return {
    id: timetable.id,
    name: timetable.name,
    academicYear:
      timetable.academic_year,
    semester:
      timetable.semester,
    lectureIds: [
      ...new Set(
        timetable.lecture_ids,
      ),
    ],
    createdAt:
      timetable.created_at,
    updatedAt:
      timetable.updated_at,
  }
}


async function getErrorMessage(
  response: Response,
  fallbackMessage: string,
): Promise<string> {
  try {
    const data =
      (await response.json()) as {
        detail?: unknown
      }

    if (
      typeof data.detail === 'string' &&
      data.detail.trim().length > 0
    ) {
      return data.detail
    }
  } catch {
    // JSON 오류가 아니면 기본 메시지를 사용합니다.
  }

  return fallbackMessage
}


function createRequestBody(
  timetable: {
    name: string
    academicYear: number
    semester: 1 | 2
    lectureIds: readonly number[]
  },
) {
  return {
    name: timetable.name,
    academic_year:
      timetable.academicYear,
    semester:
      timetable.semester,
    lecture_ids: [
      ...new Set(
        timetable.lectureIds,
      ),
    ],
  }
}


export async function getTimetables():
  Promise<SavedTimetable[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/timetables`,
    {
      credentials: 'include',
    },
  )

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        '시간표 목록을 불러오지 못했습니다.',
      ),
    )
  }

  const data =
    (await response.json()) as
      TimetablesResponse

  return data.timetables.map(
    mapTimetable,
  )
}


export async function createTimetable(
  values: CreateTimetableValues,
): Promise<SavedTimetable> {
  const response = await fetch(
    `${API_BASE_URL}/api/timetables`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type':
          'application/json',
      },
      body: JSON.stringify(
        createRequestBody({
          name: values.name,
          academicYear:
            values.academicYear,
          semester:
            values.semester,
          lectureIds:
            values.lectureIds ?? [],
        }),
      ),
    },
  )

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        '시간표를 생성하지 못했습니다.',
      ),
    )
  }

  const data =
    (await response.json()) as
      TimetableResponse

  return mapTimetable(
    data.timetable,
  )
}


export async function updateTimetable(
  timetable: SavedTimetable,
): Promise<SavedTimetable> {
  const response = await fetch(
    `${API_BASE_URL}/api/timetables/${timetable.id}`,
    {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type':
          'application/json',
      },
      body: JSON.stringify(
        createRequestBody(
          timetable,
        ),
      ),
    },
  )

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        '시간표를 저장하지 못했습니다.',
      ),
    )
  }

  const data =
    (await response.json()) as
      TimetableResponse

  return mapTimetable(
    data.timetable,
  )
}


export async function deleteTimetable(
  timetableId: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/timetables/${timetableId}`,
    {
      method: 'DELETE',
      credentials: 'include',
    },
  )

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        '시간표를 삭제하지 못했습니다.',
      ),
    )
  }
}
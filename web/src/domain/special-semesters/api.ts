import type {
  SpecialSemester,
  SpecialSemesterInput,
  SpecialSemesterTerm,
} from './types'


// const API_BASE_URL =
//   'http://localhost:8000'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  'http://localhost:8000'

interface SpecialSemesterApiItem {
  id: string
  user_id: string

  grade: number
  semester: number
  term: SpecialSemesterTerm

  created_at: string
  updated_at: string
}


interface SpecialSemestersResponse {
  count: number
  semesters: SpecialSemesterApiItem[]
}


interface SpecialSemesterResponse {
  semester: SpecialSemesterApiItem
}


interface SpecialSemestersErrorResponse {
  detail?: unknown
}


function mapSpecialSemester(
  semester: SpecialSemesterApiItem,
): SpecialSemester {
  return {
    id:
      semester.id,

    userId:
      semester.user_id,

    grade:
      semester.grade,

    semester:
      semester.semester,

    term:
      semester.term,

    createdAt:
      semester.created_at,

    updatedAt:
      semester.updated_at,
  }
}


async function getErrorMessage(
  response: Response,
  fallbackMessage: string,
): Promise<string> {
  try {
    const data =
      (await response.json()) as
        SpecialSemestersErrorResponse

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


export async function getSpecialSemesters():
  Promise<SpecialSemester[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/special-semesters`,
    {
      credentials: 'include',
    },
  )

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        '특별학기를 불러오지 못했습니다.',
      ),
    )
  }

  const data =
    (await response.json()) as
      SpecialSemestersResponse

  return data.semesters.map(
    mapSpecialSemester,
  )
}


export async function createSpecialSemester(
  input: SpecialSemesterInput,
): Promise<SpecialSemester> {
  const response = await fetch(
    `${API_BASE_URL}/api/special-semesters`,
    {
      method: 'POST',

      credentials: 'include',

      headers: {
        'Content-Type':
          'application/json',
      },

      body: JSON.stringify({
        grade:
          input.grade,

        term:
          input.term,
      }),
    },
  )

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        '특별학기를 추가하지 못했습니다.',
      ),
    )
  }

  const data =
    (await response.json()) as
      SpecialSemesterResponse

  return mapSpecialSemester(
    data.semester,
  )
}


export async function deleteSpecialSemester(
  specialSemesterId: string,
): Promise<void> {
  const response = await fetch(
    (
      `${API_BASE_URL}/api/special-semesters/` +
      specialSemesterId
    ),
    {
      method: 'DELETE',
      credentials: 'include',
    },
  )

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        '특별학기를 삭제하지 못했습니다.',
      ),
    )
  }
}
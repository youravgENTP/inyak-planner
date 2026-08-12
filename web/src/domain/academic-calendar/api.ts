import type {
  AcademicCalendar,
  AcademicCalendarEvent,
} from './types'


const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  'http://localhost:8000'


interface AcademicCalendarEventApiItem {
  title: string
  month: number
  start_date: string
  end_date: string
}


interface AcademicCalendarApiResponse {
  academic_year: number
  count: number
  events: AcademicCalendarEventApiItem[]
}


function mapAcademicCalendarEvent(
  event: AcademicCalendarEventApiItem,
): AcademicCalendarEvent {
  return {
    title: event.title,
    month: event.month,
    startDate: event.start_date,
    endDate: event.end_date,
  }
}


export async function getAcademicCalendar(
  year: number,
): Promise<AcademicCalendar> {
  const response = await fetch(
    `${API_BASE_URL}` +
      `/api/academic-calendar` +
      `?year=${encodeURIComponent(year)}`,
  )

  if (!response.ok) {
    throw new Error(
      '학사일정을 불러오지 못했습니다.',
    )
  }

  const data =
    (await response.json()) as
      AcademicCalendarApiResponse

  return {
    academicYear: data.academic_year,
    count: data.count,
    events: data.events.map(
      mapAcademicCalendarEvent,
    ),
  }
}
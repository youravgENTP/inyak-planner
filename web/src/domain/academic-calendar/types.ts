export interface AcademicCalendarEvent {
  title: string
  month: number
  startDate: string
  endDate: string
}

export interface AcademicCalendar {
  academicYear: number
  count: number
  events: AcademicCalendarEvent[]
}
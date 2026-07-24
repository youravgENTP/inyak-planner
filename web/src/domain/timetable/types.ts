export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri'

export interface TimetableCourse {
  id: string
  code: string
  title: string
  professor: string
  room: string
  day: Weekday
  startMinute: number
  endMinute: number
  color: 'navy' | 'teal' | 'blue' | 'slate'
}

export interface TimetableDay {
  key: Weekday
  label: string
  shortLabel: string
}

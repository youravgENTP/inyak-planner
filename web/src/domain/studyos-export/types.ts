import type { Lecture } from '../lectures/types'
import type { ParsedLectureSchedule } from '../lectures/schedule'
import type { SavedTimetable } from '../saved-timetables/types'

export interface StudyOsMeeting {
  weekday: 1 | 2 | 3 | 4 | 5
  startMinute: number
  endMinute: number
  location: string
}

export interface StudyOsTimetableExport {
  format: 'studyos-timetable'
  version: 1
  exportedAt: string
  source: {
    app: 'inyak-planner'
    timetableId: string
    timetableName: string
  }
  academicYear: number
  academicTerm: '1' | '2'
  totalWeeklyMinutes: number
  subjects: Array<{
    externalLectureId: number
    courseCode: string
    name: string
    section: string
    professor: string | null
    credits: number | null
    weeklyMinutes: number
    meetings: StudyOsMeeting[]
  }>
  warnings: {
    missingLectureIds: number[]
    lecturesWithoutMeetings: number[]
  }
}

export interface StudyOsExportInput {
  timetable: SavedTimetable
  lectures: Lecture[]
  parseSchedule: (value: string | null) => ParsedLectureSchedule[]
  exportedAt?: string
}

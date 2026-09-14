import type { Weekday } from '../timetable/types'
import type {
  StudyOsExportInput,
  StudyOsMeeting,
  StudyOsTimetableExport,
} from './types'

const weekdayNumbers: Record<Weekday, StudyOsMeeting['weekday']> = {
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
}

export function createStudyOsTimetableExport({
  timetable,
  lectures,
  parseSchedule,
  exportedAt = new Date().toISOString(),
}: StudyOsExportInput): StudyOsTimetableExport {
  const lecturesById = new Map(
    lectures.map((lecture) => [lecture.id, lecture]),
  )
  const missingLectureIds = timetable.lectureIds.filter(
    (lectureId) => !lecturesById.has(lectureId),
  )
  const lecturesWithoutMeetings: number[] = []

  const subjects = timetable.lectureIds.flatMap((lectureId) => {
    const lecture = lecturesById.get(lectureId)
    if (lecture === undefined) return []

    const meetings = parseSchedule(lecture.scheduleAndRoom).map(
      (meeting): StudyOsMeeting => ({
        weekday: weekdayNumbers[meeting.day],
        startMinute: meeting.startMinute,
        endMinute: meeting.endMinute,
        location: meeting.room,
      }),
    )
    if (meetings.length === 0) lecturesWithoutMeetings.push(lecture.id)
    const weeklyMinutes = meetings.reduce(
      (total, meeting) => total + meeting.endMinute - meeting.startMinute,
      0,
    )

    return [{
      externalLectureId: lecture.id,
      courseCode: lecture.courseCode,
      name: lecture.courseName,
      section: lecture.section,
      professor: lecture.professor,
      credits: lecture.credits,
      weeklyMinutes,
      meetings,
    }]
  })

  return {
    format: 'studyos-timetable',
    version: 1,
    exportedAt,
    source: {
      app: 'inyak-planner',
      timetableId: timetable.id,
      timetableName: timetable.name,
    },
    academicYear: timetable.academicYear,
    academicTerm: String(timetable.semester) as '1' | '2',
    totalWeeklyMinutes: subjects.reduce(
      (total, subject) => total + subject.weeklyMinutes,
      0,
    ),
    subjects,
    warnings: {
      missingLectureIds,
      lecturesWithoutMeetings,
    },
  }
}

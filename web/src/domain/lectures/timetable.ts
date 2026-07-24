import type { Lecture } from './types'
import { parseLectureSchedule } from './schedule'
import type {
  CourseColor,
  TimetableCourse,
} from '../timetable/types'

const COURSE_COLORS: CourseColor[] = [
  'navy',
  'teal',
  'blue',
  'slate',
]

function getLectureColor(
  lectureId: number,
): CourseColor {
  return COURSE_COLORS[
    Math.abs(lectureId) % COURSE_COLORS.length
  ]
}

/*
 * 강의 하나가 여러 요일에 열릴 수 있으므로,
 * 시간표 블록도 여러 개로 변환될 수 있습니다.
 *
 * 예:
 * 월3,4수4 H동101
 *
 * → 월요일 블록 1개
 * → 수요일 블록 1개
 */
export function lectureToTimetableCourses(
  lecture: Lecture,
): TimetableCourse[] {
  const schedules = parseLectureSchedule(
    lecture.scheduleAndRoom,
  )

  return schedules.map((schedule, index) => ({
    /*
     * 각 시간표 블록의 고유 ID입니다.
     */
    id: `lecture-${lecture.id}-${index}`,

    /*
     * 여러 블록이 같은 강의에서 생성됐다는 것을
     * 식별하기 위한 원본 강의 ID입니다.
     */
    sourceLectureId: lecture.id,

    code: lecture.courseCode,
    title: lecture.courseName,
    professor:
      lecture.professor ?? '교수 정보 없음',
    room: schedule.room,
    credits: lecture.credits ?? 0,
    day: schedule.day,
    startMinute: schedule.startMinute,
    endMinute: schedule.endMinute,
    color: getLectureColor(lecture.id),
  }))
}

export function lecturesToTimetableCourses(
  lectures: Lecture[],
): TimetableCourse[] {
  return lectures.flatMap(
    lectureToTimetableCourses,
  )
}
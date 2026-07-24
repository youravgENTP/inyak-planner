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

interface LectureToTimetableCourseOptions {
  isPreview?: boolean
}

function getLectureColor(
  lectureId: number,
): CourseColor {
  return COURSE_COLORS[
    Math.abs(lectureId) % COURSE_COLORS.length
  ]
}

/*
 * 강의 하나를 시간표 블록으로 변환합니다.
 *
 * 강의가 여러 요일에 열리면,
 * 요일별로 여러 개의 블록이 만들어집니다.
 *
 * options.isPreview가 true이면
 * 검색 결과 hover용 미리보기 블록으로 표시합니다.
 */
export function lectureToTimetableCourses(
  lecture: Lecture,
  options: LectureToTimetableCourseOptions = {},
): TimetableCourse[] {
  const schedules = parseLectureSchedule(
    lecture.scheduleAndRoom,
  )

  const isPreview = options.isPreview ?? false

  return schedules.map((schedule, index) => ({
    /*
     * 미리보기 블록과 실제 블록의 ID가
     * 서로 겹치지 않도록 구분합니다.
     */
    id: isPreview
      ? `lecture-preview-${lecture.id}-${index}`
      : `lecture-${lecture.id}-${index}`,

    /*
     * 여러 요일 블록이 같은 원본 강의에서
     * 생성됐다는 것을 식별하기 위한 값입니다.
     */
    sourceLectureId: lecture.id,

    /*
     * 검색 결과 hover로 만들어진
     * 임시 블록인지 나타냅니다.
     */
    isPreview,

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

/*
 * 여러 강의를 실제 시간표 블록 목록으로
 * 한꺼번에 변환합니다.
 */
export function lecturesToTimetableCourses(
  lectures: Lecture[],
): TimetableCourse[] {
  return lectures.flatMap((lecture) =>
    lectureToTimetableCourses(lecture),
  )
}

/*
 * 검색 결과에서 hover 중인 강의 하나를
 * 미리보기 블록으로 변환합니다.
 */
export function lectureToPreviewCourses(
  lecture: Lecture,
): TimetableCourse[] {
  return lectureToTimetableCourses(lecture, {
    isPreview: true,
  })
}
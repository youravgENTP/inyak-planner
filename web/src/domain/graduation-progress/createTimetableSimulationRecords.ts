import type {
  CourseCompletionType,
  CourseRecord,
} from '../course-records/types'

import type {
  Lecture,
} from '../lectures/types'

import type {
  SavedTimetable,
} from '../saved-timetables'


function normalizeCourseCode(
  courseCode: string | null,
): string | null {
  if (courseCode === null) {
    return null
  }

  const normalizedCourseCode =
    courseCode
      .trim()
      .toLocaleUpperCase('en-US')

  return normalizedCourseCode.length === 0
    ? null
    : normalizedCourseCode
}


function normalizeCourseName(
  courseName: string,
): string {
  return courseName
    .trim()
    .replace(/\s+/g, '')
    .toLocaleLowerCase('ko-KR')
}


function getLectureCompletionType(
  lecture: Lecture,
): CourseCompletionType {
  const completionType =
    lecture.completionType
      ?.trim()
      .replace(/\s+/g, '') ?? ''

  if (
    completionType === '전필' ||
    completionType === '전공필수'
  ) {
    return '전필'
  }

  if (
    completionType === '전선' ||
    completionType === '전공선택'
  ) {
    return '전선'
  }

  if (completionType === '교양') {
    return '교양'
  }

  return '기타'
}


function recordAlreadyCoversLecture(
  record: CourseRecord,
  lecture: Lecture,
): boolean {
  /*
   * 재수강으로 말소되는 기록이나
   * F 기록은 앞으로 이수할 과목을
   * 충족한 것으로 보지 않습니다.
   */
  if (
    record.isRetake ||
    record.letterGrade === 'F'
  ) {
    return false
  }

  if (
    record.lectureId !== null &&
    record.lectureId === lecture.id
  ) {
    return true
  }

  const recordCourseCode =
    normalizeCourseCode(
      record.courseCode,
    )

  const lectureCourseCode =
    normalizeCourseCode(
      lecture.courseCode,
    )

  if (
    recordCourseCode !== null &&
    lectureCourseCode !== null &&
    recordCourseCode ===
      lectureCourseCode
  ) {
    return true
  }

  return (
    normalizeCourseName(
      record.courseName,
    ) ===
    normalizeCourseName(
      lecture.courseName,
    )
  )
}


export function createTimetableSimulationRecords(
  timetable: SavedTimetable,
  lectures: readonly Lecture[],
  existingRecords:
    readonly CourseRecord[],
): CourseRecord[] {
  const lectureMap =
    new Map(
      lectures.map(
        (lecture) =>
          [
            lecture.id,
            lecture,
          ] as const,
      ),
    )

  const simulationRecords:
    CourseRecord[] = []

  timetable.lectureIds.forEach(
    (lectureId) => {
      const lecture =
        lectureMap.get(lectureId)

      if (lecture === undefined) {
        return
      }

      const allKnownRecords = [
        ...existingRecords,
        ...simulationRecords,
      ]

      if (
        allKnownRecords.some(
          (record) =>
            recordAlreadyCoversLecture(
              record,
              lecture,
            ),
        )
      ) {
        return
      }

      simulationRecords.push({
        id:
          `simulation-${timetable.id}-` +
          lecture.id,

        userId: 'simulation',

        curriculumCourseId: null,
        lectureId: lecture.id,

        generalEducationRequirementId:
          null,

        generalEducationAreaId: null,

        academicYear:
          lecture.academicYear,

        grade:
          lecture.recommendedYear,

        semester:
          lecture.semester,

        term:
          lecture.semester === 1
            ? 'spring'
            : 'fall',

        courseName:
          lecture.courseName,

        courseCode:
          lecture.courseCode,

        completionType:
          getLectureCompletionType(
            lecture,
          ),

        credits:
          lecture.credits ?? 0,

        status: 'planned',
        letterGrade: null,
        isRetake: false,

        note:
          '시간표 수강예정 시뮬레이션',

        createdAt: '',
        updatedAt: '',
      })
    },
  )

  return simulationRecords
}
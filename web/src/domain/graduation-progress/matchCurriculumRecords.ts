import type {
  CourseRecord,
} from '../course-records/types'
import type {
  Curriculum,
  CurriculumCourse,
} from '../curriculum/types'


export interface CurriculumRecordMatch {
  curriculumCourse:
    CurriculumCourse
  record:
    CourseRecord
}


export interface CurriculumRecordMatchResult {
  matches:
    CurriculumRecordMatch[]

  unmatchedRecords:
    CourseRecord[]
}


function normalizeCourseName(
  courseName: string,
): string {
  return courseName
    .trim()
    .replace(/\s+/g, '')
    .toLocaleLowerCase('ko-KR')
}


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


function findExplicitCurriculumCourse(
  curriculum: Curriculum,
  record: CourseRecord,
): CurriculumCourse | null {
  if (
    record.curriculumCourseId === null
  ) {
    return null
  }

  return (
    curriculum.courses.find(
      (course) =>
        course.id ===
        record.curriculumCourseId,
    ) ?? null
  )
}


function findCourseCodeMatch(
  curriculum: Curriculum,
  record: CourseRecord,
): CurriculumCourse | null {
  const recordCourseCode =
    normalizeCourseCode(
      record.courseCode,
    )

  if (recordCourseCode === null) {
    return null
  }

  const candidates =
    curriculum.courses.filter(
      (course) =>
        normalizeCourseCode(
          course.courseCode,
        ) === recordCourseCode,
    )

  /*
   * 같은 코드가 교육과정 안에서 여러 행에
   * 존재하면 자동으로 결정하지 않습니다.
   */
  if (candidates.length !== 1) {
    return null
  }

  return candidates[0]
}


function findCourseNameMatch(
  curriculum: Curriculum,
  record: CourseRecord,
): CurriculumCourse | null {
  const recordCourseName =
    normalizeCourseName(
      record.courseName,
    )

  const candidates =
    curriculum.courses.filter(
      (course) =>
        normalizeCourseName(
          course.courseName,
        ) === recordCourseName,
    )

  /*
   * 이름이 같더라도 교육과정에 동일 이름의
   * 과목이 둘 이상 있으면 자동 매칭하지
   * 않습니다.
   */
  if (candidates.length !== 1) {
    return null
  }

  return candidates[0]
}


function findMatchingCurriculumCourse(
  curriculum: Curriculum,
  record: CourseRecord,
): CurriculumCourse | null {
  /*
   * 대체 인정처럼 사용자가 공식 과목을
   * 명시적으로 연결한 기록을 가장 우선합니다.
   */
  const explicitCourse =
    findExplicitCurriculumCourse(
      curriculum,
      record,
    )

  if (explicitCourse !== null) {
    return explicitCourse
  }

  const courseCodeMatch =
    findCourseCodeMatch(
      curriculum,
      record,
    )

  if (courseCodeMatch !== null) {
    return courseCodeMatch
  }

  return findCourseNameMatch(
    curriculum,
    record,
  )
}


export function matchCurriculumRecords(
  curriculum: Curriculum,
  records: readonly CourseRecord[],
): CurriculumRecordMatchResult {
  const matches:
    CurriculumRecordMatch[] = []

  const unmatchedRecords:
    CourseRecord[] = []

  /*
   * 하나의 교육과정 과목에 여러 수강기록이
   * 동시에 붙는 것을 막습니다.
   *
   * 재수강 말소 기록은 애초에 matcher에서
   * 제외합니다.
   */
  const matchedCurriculumCourseIds =
    new Set<number>()

  /*
   * 사용자가 curriculumCourseId를
   * 명시적으로 지정한 기록을
   * 자동 매칭 기록보다 먼저 처리합니다.
   *
   * 따라서 자동 매칭과 충돌하는 경우에도
   * 사용자의 수동 연결이 우선합니다.
   */
  const prioritizedRecords =
    [...records].sort(
      (
        firstRecord,
        secondRecord,
      ) => {
        const firstIsExplicit =
          firstRecord
            .curriculumCourseId !== null
            ? 1
            : 0

        const secondIsExplicit =
          secondRecord
            .curriculumCourseId !== null
            ? 1
            : 0

        return (
          secondIsExplicit -
          firstIsExplicit
        )
      },
    )

  for (
    const record of prioritizedRecords
  ) {
    if (record.isRetake) {
      continue
    }

    if (
      record.completionType !== '전필' &&
      record.completionType !== '전선'
    ) {
      continue
    }

    const curriculumCourse =
      findMatchingCurriculumCourse(
        curriculum,
        record,
      )

    if (curriculumCourse === null) {
      if (
        record.status !==
        'substituted'
      ) {
        unmatchedRecords.push(
          record,
        )
      }

      continue
    }

    if (
      matchedCurriculumCourseIds.has(
        curriculumCourse.id,
      )
    ) {
      if (
        record.status !==
        'substituted'
      ) {
        unmatchedRecords.push(
          record,
        )
      }

      continue
    }

    matchedCurriculumCourseIds.add(
      curriculumCourse.id,
    )

    matches.push({
      curriculumCourse,
      record,
    })
  }

  return {
    matches,
    unmatchedRecords,
  }
}
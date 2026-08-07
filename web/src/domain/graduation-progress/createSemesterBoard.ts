import type {
  AuthUser,
} from '../auth/api'
import type {
  CourseRecord,
} from '../course-records/types'
import type {
  Curriculum,
  CurriculumCourse,
} from '../curriculum/types'
import {
  matchCurriculumRecords,
} from './matchCurriculumRecords'


export interface SemesterBoardCourse {
  curriculumCourse:
    CurriculumCourse
  record:
    CourseRecord | null
}

export interface SemesterBoardCard {
  kind: 'semester'
  grade: number
  semester: number
  courses:
    SemesterBoardCourse[]
  unmatchedRecords:
    CourseRecord[]
}

export interface TransferCreditBoardCard {
  kind: 'transferCredits'
  records:
    CourseRecord[]
}

export type GraduationBoardCard =
  | SemesterBoardCard
  | TransferCreditBoardCard

function createSemesterCard(
  curriculum: Curriculum,
  matchedRecordMap:
    ReadonlyMap<number, CourseRecord>,
  unmatchedRecords:
    readonly CourseRecord[],
  grade: number,
  semester: number,
): SemesterBoardCard {
  const officialCourses =
    curriculum.courses.filter(
      (course) =>
        course.grade === grade &&
        course.semester === semester,
    )

  const courses =
    officialCourses.map(
      (curriculumCourse) => ({
        curriculumCourse,
        record:
          matchedRecordMap.get(
            curriculumCourse.id,
          ) ?? null,
      }),
    )

  /*
   * 매칭에 실패한 전공 기록은 사용자가
   * 실제로 기록해 둔 grade + semester
   * 위치에 표시합니다.
   *
   * academicYear를 이용해 사용자의 학년을
   * 역산하지 않습니다.
   */
  const semesterUnmatchedRecords =
    unmatchedRecords.filter(
      (record) =>
        record.grade === grade &&
        record.semester === semester,
    )

  return {
    kind: 'semester',
    grade,
    semester,
    courses,
    unmatchedRecords:
      semesterUnmatchedRecords,
  }
}


function getTransferCreditRecords(
  records: readonly CourseRecord[],
): CourseRecord[] {
  return records.filter(
    (record) =>
      record.status ===
        'substituted' &&
      !record.isRetake,
  )
}


export function createGraduationBoard(
  user: AuthUser,
  curriculum: Curriculum,
  records: readonly CourseRecord[],
): GraduationBoardCard[] {
  const cards:
    GraduationBoardCard[] = []

  if (user.studentType === 'transfer') {
    cards.push({
      kind: 'transferCredits',
      records:
        getTransferCreditRecords(
          records,
        ),
    })
  }

  const effectiveRecords =
    records.filter(
      (record) =>
        !record.isRetake,
    )

  const matchResult =
    matchCurriculumRecords(
      curriculum,
      effectiveRecords,
    )

  const matchedRecordMap =
    new Map<number, CourseRecord>(
      matchResult.matches.map(
        ({
          curriculumCourse,
          record,
        }) => [
          curriculumCourse.id,
          record,
        ],
      ),
    )

  for (
    let grade = 1;
    grade <= 6;
    grade += 1
  ) {
    for (
      let semester = 1;
      semester <= 2;
      semester += 1
    ) {
      cards.push(
        createSemesterCard(
          curriculum,
          matchedRecordMap,
          matchResult.unmatchedRecords,
          grade,
          semester,
        ),
      )
    }
  }

  return cards
}
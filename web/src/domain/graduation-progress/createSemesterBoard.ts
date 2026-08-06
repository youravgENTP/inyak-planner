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


function createCurriculumRecordMap(
  records: readonly CourseRecord[],
): Map<number, CourseRecord> {
  const recordMap =
    new Map<number, CourseRecord>()

  for (const record of records) {
    if (
      record.curriculumCourseId ===
      null
    ) {
      continue
    }

    recordMap.set(
      record.curriculumCourseId,
      record,
    )
  }

  return recordMap
}


function calculateRecordGrade(
  record: CourseRecord,
  entryYear: number,
): number | null {
  if (record.academicYear === null) {
    return null
  }

  const grade =
    record.academicYear -
    entryYear +
    1

  if (grade < 1 || grade > 6) {
    return null
  }

  return grade
}


function getSemesterRecords(
  records: readonly CourseRecord[],
  entryYear: number,
  grade: number,
  semester: number,
): CourseRecord[] {

  return records.filter(
    (record) =>
      record.status !==
        'substituted' &&
      (
        record.completionType ===
          '전필' ||
        record.completionType ===
          '전선'
      ) &&
      record.semester === semester &&
      calculateRecordGrade(
        record,
        entryYear,
      ) === grade,
  )
}

function createSemesterCard(
  curriculum: Curriculum,
  records: readonly CourseRecord[],
  curriculumRecordMap:
    ReadonlyMap<number, CourseRecord>,
  grade: number,
  semester: number,
): SemesterBoardCard {
  const officialCourses =
    curriculum.courses.filter(
      (course) =>
        course.grade === grade &&
        course.semester === semester,
    )

  const semesterRecords =
    getSemesterRecords(
      records,
      curriculum.entryYear,
      grade,
      semester,
    )

  const matchedRecordIds =
    new Set<string>()

  const courses =
    officialCourses.map(
      (curriculumCourse) => {
        const record =
          curriculumRecordMap.get(
            curriculumCourse.id,
          ) ?? null

        if (
          record !== null &&
          record.status !==
            'substituted'
        ) {
          matchedRecordIds.add(
            record.id,
          )
        }

        return {
          curriculumCourse,
          record:
            record !== null &&
            record.status !==
              'substituted'
              ? record
              : null,
        }
      },
    )

  const unmatchedRecords =
    semesterRecords.filter(
      (record) =>
        !matchedRecordIds.has(
          record.id,
        ),
    )

  return {
    kind: 'semester',
    grade,
    semester,
    courses,
    unmatchedRecords,
  }
}


function getTransferCreditRecords(
  records: readonly CourseRecord[],
): CourseRecord[] {
  return records.filter(
    (record) =>
      record.status ===
      'substituted',
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

  const curriculumRecordMap =
    createCurriculumRecordMap(
      records,
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
          records,
          curriculumRecordMap,
          grade,
          semester,
        ),
      )
    }
  }

  return cards
}
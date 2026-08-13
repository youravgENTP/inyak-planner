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
import type {
  Lecture,
} from '../lectures/types'
import {
  findCatalogElectiveRecords,
} from './findCatalogElectiveRecords'
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
        course.changeRole ===
          'current' &&
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


/*
 * 아래부터는 새 개인 이수현황 UI에서 사용할
 * 학년 단위 board model입니다.
 *
 * 기존 SemesterBoardCard 기반 UI를 한 번에
 * 깨뜨리지 않기 위해 기존 model과
 * createGraduationBoard()는 당분간 유지합니다.
 */


export interface SemesterBoardMatchedRecord {
  /*
   * null이면 공식 curriculum에는 없지만
   * 실제 개설 당시 전선으로 확인된 기록입니다.
   */
  curriculumCourse:
    CurriculumCourse | null
  record:
    CourseRecord
}


export interface YearSemesterBoard {
  semester: number

  /*
   * 전필은 공식 교육과정 전체가 기준입니다.
   * 따라서 아직 이수하지 않은 공식 전필도
   * record: null 상태로 포함합니다.
   */
  requiredCourses:
    SemesterBoardCourse[]

  /*
   * 전선은 사용자가 실제로 기록한 과목 중
   * matcher가 공식 전선으로 판정한 기록만
   * 표시합니다.
   *
   * 공식 curriculum의 모든 선택 가능한
   * 전선 과목을 노출하지 않습니다.
   */
  electiveRecords:
    SemesterBoardMatchedRecord[]

  /*
   * 교양은 자동 matcher를 사용하지 않고
   * 사용자가 CourseRecord에 저장한
   * 교양 기록 자체를 사용합니다.
   */
  generalEducationRecords:
    CourseRecord[]

  /*
   * 전공 matcher가 자동 연결하지 못한
   * 기록입니다.
   *
   * 다음 UI 단계에서 졸업요건 미연결
   * 영역으로 표시하고 수동 연결 기능을
   * 그대로 제공할 예정입니다.
   */
  unmatchedRecords:
    CourseRecord[]
}


export interface YearBoardCard {
  kind: 'year'
  grade: number
  semesters:
    YearSemesterBoard[]
}


export interface GraduationYearBoard {
  transferCredits:
    TransferCreditBoardCard | null
  years:
    YearBoardCard[]
}


function recordBelongsToSemester(
  record: CourseRecord,
  grade: number,
  semester: number,
): boolean {
  return (
    record.grade === grade &&
    record.semester === semester
  )
}


function createYearSemesterBoard(
  curriculum: Curriculum,
  matchedRecordMap:
    ReadonlyMap<number, CourseRecord>,
  matchedRecords:
    readonly SemesterBoardMatchedRecord[],
  effectiveRecords:
    readonly CourseRecord[],
  unmatchedRecords:
    readonly CourseRecord[],
  grade: number,
  semester: number,
): YearSemesterBoard {
  /*
   * 전필은 공식 curriculum의 학년-학기
   * 위치를 기준으로 배치합니다.
   *
   * 사용자가 다른 학기에 실제 수강했더라도
   * matcher가 이 공식 전필과 연결했다면
   * 해당 공식 전필의 record로 표시됩니다.
   */
  const requiredCourses =
    curriculum.courses
      .filter(
        (course) =>
          course.changeRole ===
            'current' &&
          course.grade === grade &&
          course.semester === semester &&
          course.completionType ===
            '전필',
      )
      .map(
        (curriculumCourse) => ({
          curriculumCourse,
          record:
            matchedRecordMap.get(
              curriculumCourse.id,
            ) ?? null,
        }),
      )

  /*
   * 일반 전선 기록은 사용자가 실제로 기록한
   * grade + semester 위치에 표시합니다.
   *
   * 전적대 대체 인정은 CourseRecord 자체에
   * grade / semester를 저장하지 않으므로,
   * 연결된 공식 curriculum 과목의 위치를
   * 기준으로 해당 학년 보드에 배치합니다.
   */
  const electiveRecords =
    matchedRecords.filter(
      ({
        curriculumCourse,
        record,
      }) => {
        /*
         * curriculumCourse가 null이면
         * 공식 발표 교육과정에는 없지만,
         * 실제 개설 당시 전선으로 확인된
         * 동적 전선 기록입니다.
         */
        if (curriculumCourse === null) {
          return recordBelongsToSemester(
            record,
            grade,
            semester,
          )
        }

        if (
          curriculumCourse
            .completionType !== '전선'
        ) {
          return false
        }

        if (
          record.status === 'substituted'
        ) {
          return (
            curriculumCourse.grade ===
              grade &&
            curriculumCourse.semester ===
              semester
          )
        }

        return recordBelongsToSemester(
          record,
          grade,
          semester,
        )
      },
    )

  /*
   * 교양 역시 사용자가 실제로 기록한
   * 학년-학기 위치를 사용합니다.
   *
   * 대체 인정 교양은 전적대 인정 영역에서
   * 별도로 관리하므로 일반 학기에서는
   * 제외합니다.
   */
  const generalEducationRecords =
    effectiveRecords.filter(
      (record) =>
        record.completionType ===
          '교양' &&
        record.status !==
          'substituted' &&
        recordBelongsToSemester(
          record,
          grade,
          semester,
        ),
    )

  /*
   * matcher 실패 기록 역시 사용자가 기록한
   * 학년-학기 위치를 유지합니다.
   */
  const semesterUnmatchedRecords =
    unmatchedRecords.filter(
      (record) =>
        recordBelongsToSemester(
          record,
          grade,
          semester,
        ),
    )

  return {
    semester,
    requiredCourses,
    electiveRecords,
    generalEducationRecords,
    unmatchedRecords:
      semesterUnmatchedRecords,
  }
}


export function createGraduationYearBoard(
  user: AuthUser,
  curriculum: Curriculum,
  records: readonly CourseRecord[],
  lectures: readonly Lecture[],
): GraduationYearBoard {
  /*
   * 재수강으로 말소된 기록은
   * 졸업요건 board의 근거로 사용하지 않습니다.
   */
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

  const catalogElectiveRecords =
    findCatalogElectiveRecords(
      matchResult.unmatchedRecords,
      lectures,
    )

  const catalogElectiveRecordIds =
    new Set(
      catalogElectiveRecords.map(
        (record) => record.id,
      ),
    )

  const remainingUnmatchedRecords =
    matchResult.unmatchedRecords.filter(
      (record) =>
        !catalogElectiveRecordIds.has(
          record.id,
        ),
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

  const matchedRecords:
    SemesterBoardMatchedRecord[] = [
      ...matchResult.matches.map(
        ({
          curriculumCourse,
          record,
        }) => ({
          curriculumCourse,
          record,
        }),
      ),

      ...catalogElectiveRecords.map(
        (record) => ({
          curriculumCourse: null,
          record,
        }),
      ),
    ]

  const years =
    Array.from(
      { length: 6 },
      (_, gradeIndex): YearBoardCard => {
        const grade =
          gradeIndex + 1

        return {
          kind: 'year',
          grade,
          semesters: [1, 2].map(
            (semester) =>
              createYearSemesterBoard(
                curriculum,
                matchedRecordMap,
                matchedRecords,
                effectiveRecords,
                remainingUnmatchedRecords,
                grade,
                semester,
              ),
          ),
        }
      },
    )

  return {
    transferCredits:
      user.studentType === 'transfer'
        ? {
            kind: 'transferCredits',
            records:
              getTransferCreditRecords(
                records,
              ),
          }
        : null,

    years,
  }
}
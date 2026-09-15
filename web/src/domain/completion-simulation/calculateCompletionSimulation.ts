import type {
  CourseRecord,
} from '../course-records/types'
import type {
  CurriculumDeliveryRule,
  CurriculumDeliveryType,
} from '../curriculum-delivery-rules/types'
import type {
  Curriculum,
  CurriculumCourse,
} from '../curriculum/types'
import {
  matchCurriculumRecords,
} from '../graduation-progress/matchCurriculumRecords.ts'
import type {
  GraduationProgress,
} from '../graduation-progress/types'


export const REGULAR_SEMESTER_CREDIT_LIMIT = 24

export type AdvancedPracticumTerm =
  | '6-1'
  | '6-2'

export type SemesterSimulationStatus =
  | 'completed'
  | 'current'
  | 'projected'
  | 'sixth_year'

export interface CompletionSimulationInput {
  curriculum: Curriculum
  progress: GraduationProgress
  records: readonly CourseRecord[]
  deliveryRules:
    readonly CurriculumDeliveryRule[]
  currentGrade: number
  currentSemester: number
  externalGeneralEducationCredits: number
  advancedPracticumTerm:
    AdvancedPracticumTerm
}

export interface SemesterSimulation {
  grade: number
  semester: number
  status: SemesterSimulationStatus
  recordedCredits: number
  officialRequiredCredits: number
  requiredCreditsToTake: number
  electiveCredits: number
  generalEducationCredits: number
  additionalCredits: number
  practicumActivityCredits: number
  totalCredits: number
  remainingAvailableCredits: number | null
  attendanceCredits: number
}

export interface CompletionSimulationResult {
  semesters: SemesterSimulation[]
  confirmedCredits: number
  scheduledCredits: number
  remainingGraduationCredits: number
  preSixthGraduationCredits: number
  sixthYearRequiredCredits: number
  sixthYearRegularCapacity: number
  sixthYearAttendanceCredits: number
  advancedPracticumCredits: number
  advancedPracticumTerm:
    AdvancedPracticumTerm
  vacationPracticumCredits: number
  externalGeneralEducationCredits: number
  unallocatedElectiveCredits: number
  unallocatedGeneralEducationCredits: number
  generalEducationAreaRequirements:
    GeneralEducationAreaRequirement[]
}

export interface GeneralEducationAreaRequirement {
  category: string
  remainingAreaCount: number
  requiredAreaNames: string[]
}


const ADVANCED_PRACTICUM_CODES =
  new Set(['ADA226', 'ADA227'])

const VACATION_PRACTICUM_CODES =
  new Set([
    'ADA213',
    'ADA214',
    'ADA215',
    'ADA216',
    'ADA218',
    'ADA219',
    'ADA220',
  ])


function getExpectedCredits(
  progress: {
    completedCredits: number
    inProgressCredits: number
    plannedCredits: number
    requiredCredits: number
  },
): number {
  return (
    progress.completedCredits +
    progress.inProgressCredits +
    progress.plannedCredits
  )
}


function getRemainingCredits(
  progress: {
    completedCredits: number
    inProgressCredits: number
    plannedCredits: number
    requiredCredits: number
  },
): number {
  return Math.max(
    progress.requiredCredits -
      getExpectedCredits(progress),
    0,
  )
}


function getTermIndex(
  grade: number,
  semester: number,
): number {
  return (
    (grade - 1) * 2 +
    (semester - 1)
  )
}


function recordCountsTowardProjection(
  record: CourseRecord,
): boolean {
  return (
    !record.isRetake &&
    record.letterGrade !== 'F'
  )
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


function sumCredits(
  records: readonly CourseRecord[],
): number {
  return records.reduce(
    (total, record) =>
      total + record.credits,
    0,
  )
}


function getConfiguredCourseCodes(
  deliveryRules:
    readonly CurriculumDeliveryRule[],
  deliveryType: CurriculumDeliveryType,
  fallbackCourseCodes:
    ReadonlySet<string>,
): ReadonlySet<string> {
  const configuredCourseCodes =
    new Set(
      deliveryRules
        .filter(
          (rule) =>
            rule.deliveryType ===
              deliveryType,
        )
        .map((rule) => rule.courseCode),
    )

  return configuredCourseCodes.size > 0
    ? configuredCourseCodes
    : fallbackCourseCodes
}


function sumPracticumCredits(
  curriculum: Curriculum,
  courseCodes: ReadonlySet<string>,
): number {
  return curriculum.courses
    .filter(
      (course) =>
        course.changeRole === 'current' &&
        course.courseCode !== null &&
        courseCodes.has(course.courseCode),
    )
    .reduce(
      (total, course) =>
        total + (course.credits ?? 0),
      0,
    )
}


function getOfficialRequiredCourses(
  curriculum: Curriculum,
  grade: number,
  semester: number,
): CurriculumCourse[] {
  return curriculum.courses.filter(
    (course) =>
      course.changeRole === 'current' &&
      course.grade === grade &&
      course.semester === semester &&
      course.completionType === '전필',
  )
}


function getSemesterStatus(
  grade: number,
  semester: number,
  currentGrade: number,
  currentSemester: number,
): SemesterSimulationStatus {
  const index = getTermIndex(
    grade,
    semester,
  )
  const currentIndex = getTermIndex(
    currentGrade,
    currentSemester,
  )

  if (index < currentIndex) {
    return 'completed'
  }

  if (index === currentIndex) {
    return 'current'
  }

  if (grade === 6) {
    return 'sixth_year'
  }

  return 'projected'
}


export function createCompletionSimulation(
  input: CompletionSimulationInput,
): CompletionSimulationResult {
  const effectiveRecords =
    input.records.filter(
      recordCountsTowardProjection,
    )

  const matchResult = matchCurriculumRecords(
    input.curriculum,
    effectiveRecords,
  )

  const matchedRecordByCourseId =
    new Map(
      matchResult.matches.map(
        (match) => [
          match.curriculumCourse.id,
          match.record,
        ],
      ),
    )

  const advancedPracticumCodes =
    getConfiguredCourseCodes(
      input.deliveryRules,
      'flexible_practicum',
      ADVANCED_PRACTICUM_CODES,
    )

  const vacationPracticumCodes =
    getConfiguredCourseCodes(
      input.deliveryRules,
      'vacation_practicum',
      VACATION_PRACTICUM_CODES,
    )

  const practicumCourseCodes = new Set([
    ...advancedPracticumCodes,
    ...vacationPracticumCodes,
  ])

  const advancedPracticumCredits =
    sumPracticumCredits(
      input.curriculum,
      advancedPracticumCodes,
    )

  let remainingElectiveCredits =
    getRemainingCredits(
      input.progress.majorElective.credits,
    )

  const generalEducationRemaining =
    input.progress.generalEducation.reduce(
      (total, requirement) =>
        total +
        getRemainingCredits(
          requirement.credits,
        ),
      0,
    )

  const externalGeneralEducationCredits =
    Math.min(
      Math.max(
        input.externalGeneralEducationCredits,
        0,
      ),
      generalEducationRemaining,
    )

  let remainingGeneralEducationCredits =
    Math.max(
      generalEducationRemaining -
        externalGeneralEducationCredits,
      0,
    )

  let preSixthGraduationCredits = 0
  const semesters: SemesterSimulation[] = []

  for (let grade = 1; grade <= 6; grade += 1) {
    for (
      let semester = 1;
      semester <= 2;
      semester += 1
    ) {
      const status = getSemesterStatus(
        grade,
        semester,
        input.currentGrade,
        input.currentSemester,
      )

      const semesterRecords =
        effectiveRecords.filter(
          (record) =>
            recordBelongsToSemester(
              record,
              grade,
              semester,
            ),
        )

      const recordedCredits =
        sumCredits(semesterRecords)

      const recordedElectiveCredits =
        sumCredits(
          semesterRecords.filter(
            (record) =>
              record.completionType ===
                '전선',
          ),
        )

      const recordedGeneralEducationCredits =
        sumCredits(
          semesterRecords.filter(
            (record) =>
              record.completionType ===
                '교양',
          ),
        )

      const recordedOtherCredits =
        sumCredits(
          semesterRecords.filter(
            (record) =>
              record.completionType ===
                '기타',
          ),
        )

      const officialRequiredCourses =
        getOfficialRequiredCourses(
          input.curriculum,
          grade,
          semester,
        )

      const officialRequiredCredits =
        officialRequiredCourses.reduce(
          (total, course) =>
            total + (course.credits ?? 0),
          0,
        )

      const requiredCreditsToTake =
        officialRequiredCourses.reduce(
          (total, course) => {
            const courseCredits =
              course.credits ?? 0
            const isPracticum =
              course.courseCode !== null &&
              practicumCourseCodes.has(
                course.courseCode,
              )

            if (isPracticum) {
              return total + courseCredits
            }

            const record =
              matchedRecordByCourseId.get(
                course.id,
              )

            if (record === undefined) {
              return total + courseCredits
            }

            if (
              recordBelongsToSemester(
                record,
                grade,
                semester,
              ) &&
              (
                record.status === 'planned' ||
                record.status === 'in_progress'
              )
            ) {
              return total + courseCredits
            }

            return total
          },
          0,
        )

      if (
        status === 'completed' ||
        status === 'current'
      ) {
        const nonPracticumRecords =
          semesterRecords.filter(
            (record) =>
              record.courseCode === null ||
              !practicumCourseCodes.has(
                record.courseCode,
              ),
          )

        semesters.push({
          grade,
          semester,
          status,
          recordedCredits,
          officialRequiredCredits,
          requiredCreditsToTake: 0,
          electiveCredits:
            recordedElectiveCredits,
          generalEducationCredits:
            recordedGeneralEducationCredits,
          additionalCredits:
            recordedOtherCredits,
          practicumActivityCredits: 0,
          totalCredits: recordedCredits,
          remainingAvailableCredits:
            status === 'current'
              ? Math.max(
                  REGULAR_SEMESTER_CREDIT_LIMIT -
                    recordedCredits,
                  0,
                )
              : null,
          attendanceCredits:
            sumCredits(nonPracticumRecords),
        })

        continue
      }

      let capacity = Math.max(
        REGULAR_SEMESTER_CREDIT_LIMIT -
          requiredCreditsToTake -
          recordedElectiveCredits -
          recordedGeneralEducationCredits -
          recordedOtherCredits,
        0,
      )

      const electiveCredits = Math.min(
        remainingElectiveCredits,
        capacity,
      )
      remainingElectiveCredits -=
        electiveCredits
      capacity -= electiveCredits

      const generalEducationCredits = Math.min(
        remainingGeneralEducationCredits,
        capacity,
      )
      remainingGeneralEducationCredits -=
        generalEducationCredits
      capacity -= generalEducationCredits

      const additionalCredits =
        status === 'projected'
          ? capacity
          : 0

      if (status === 'projected') {
        preSixthGraduationCredits +=
          requiredCreditsToTake +
          electiveCredits +
          generalEducationCredits
      }

      const totalCredits =
        requiredCreditsToTake +
        recordedElectiveCredits +
        recordedGeneralEducationCredits +
        recordedOtherCredits +
        electiveCredits +
        generalEducationCredits +
        additionalCredits

      semesters.push({
        grade,
        semester,
        status,
        recordedCredits,
        officialRequiredCredits,
        requiredCreditsToTake,
        electiveCredits:
          recordedElectiveCredits +
          electiveCredits,
        generalEducationCredits:
          recordedGeneralEducationCredits +
          generalEducationCredits,
        additionalCredits:
          recordedOtherCredits +
          additionalCredits,
        practicumActivityCredits:
          grade === 6 &&
          `${grade}-${semester}` ===
            input.advancedPracticumTerm
            ? advancedPracticumCredits
            : 0,
        totalCredits,
        remainingAvailableCredits:
          Math.max(
            REGULAR_SEMESTER_CREDIT_LIMIT -
              totalCredits,
            0,
          ),
        attendanceCredits:
          recordedElectiveCredits +
          recordedGeneralEducationCredits +
          electiveCredits +
          generalEducationCredits,
      })
    }
  }

  const sixthYearSemesters =
    semesters.filter(
      (semester) =>
        semester.grade === 6,
    )

  const sixthYearRequiredCredits =
    sixthYearSemesters.reduce(
      (total, semester) =>
        total +
        semester.officialRequiredCredits,
      0,
    )

  const sixthYearAttendanceCredits =
    sixthYearSemesters.reduce(
      (total, semester) =>
        total + semester.attendanceCredits,
      0,
    )

  const generalEducationAreaRequirements =
    input.progress.generalEducation
      .map((requirement) => ({
        category: requirement.category,
        remainingAreaCount:
          requirement.remainingAreaCount ??
          requirement.areas.filter(
            (area) =>
              area.isRequired &&
              !area.isSatisfied,
          ).length,
        requiredAreaNames:
          requirement.areas
            .filter(
              (area) =>
                area.isRequired &&
                !area.isSatisfied,
            )
            .map((area) => area.areaName),
      }))
      .filter(
        (requirement) =>
          requirement.remainingAreaCount > 0 ||
          requirement.requiredAreaNames.length > 0,
      )

  const remainingGraduationCredits =
    getRemainingCredits(
      input.progress.totalCredits,
    )

  return {
    semesters,
    confirmedCredits:
      sumCredits(
        effectiveRecords.filter(
          (record) =>
            record.status === 'completed' ||
            record.status === 'substituted',
        ),
      ),
    scheduledCredits:
      sumCredits(
        effectiveRecords.filter(
          (record) =>
            record.status === 'in_progress' ||
            record.status === 'planned',
        ),
      ),
    remainingGraduationCredits,
    preSixthGraduationCredits:
      Math.min(
        preSixthGraduationCredits,
        remainingGraduationCredits,
      ),
    sixthYearRequiredCredits,
    sixthYearRegularCapacity:
      Math.max(
        (
          REGULAR_SEMESTER_CREDIT_LIMIT *
          sixthYearSemesters.length
        ) - sixthYearRequiredCredits,
        0,
      ),
    sixthYearAttendanceCredits,
    advancedPracticumCredits,
    advancedPracticumTerm:
      input.advancedPracticumTerm,
    vacationPracticumCredits:
      sumPracticumCredits(
        input.curriculum,
        vacationPracticumCodes,
      ),
    externalGeneralEducationCredits,
    unallocatedElectiveCredits:
      remainingElectiveCredits,
    unallocatedGeneralEducationCredits:
      remainingGeneralEducationCredits,
    generalEducationAreaRequirements,
  }
}

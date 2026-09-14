import type {
  CourseRecord,
} from '../course-records/types'
import type {
  CurriculumDeliveryRule,
  CurriculumDeliveryType,
} from '../curriculum-delivery-rules/types'
import type {
  Curriculum,
} from '../curriculum/types'
import type {
  GraduationProgress,
} from '../graduation-progress/types'


export const REGULAR_SEMESTER_CREDIT_LIMIT = 24

export type SimulationStrategy =
  | 'minimize_sixth_year'
  | 'fill_24'

export type AdvancedPracticumTerm =
  | '6-1'
  | '6-2'

export interface CompletionSimulationInput {
  curriculum: Curriculum
  progress: GraduationProgress
  records: readonly CourseRecord[]
  deliveryRules:
    readonly CurriculumDeliveryRule[]
  startGrade: number
  startSemester: number
  strategy: SimulationStrategy
  externalGeneralEducationCredits: number
  advancedPracticumTerm:
    AdvancedPracticumTerm
}

export interface SemesterSimulation {
  grade: number
  semester: number
  isBeforeStart: boolean
  requiredCredits: number
  electiveCredits: number
  generalEducationCredits: number
  additionalCredits: number
  practicumActivityCredits: number
  totalCredits: number
  remainingCapacity: number
}

export interface CompletionSimulationResult {
  semesters: SemesterSimulation[]
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


function isBeforeStart(
  grade: number,
  semester: number,
  startGrade: number,
  startSemester: number,
): boolean {
  return (
    grade < startGrade ||
    (
      grade === startGrade &&
      semester < startSemester
    )
  )
}


function sumPracticumCredits(
  curriculum: Curriculum,
  deliveryRules:
    readonly CurriculumDeliveryRule[],
  deliveryType: CurriculumDeliveryType,
  fallbackCourseCodes:
    ReadonlySet<string>,
): number {
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

  const courseCodes =
    configuredCourseCodes.size > 0
      ? configuredCourseCodes
      : fallbackCourseCodes

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


function getScheduledFlexibleCredits(
  records: readonly CourseRecord[],
  grade: number,
  semester: number,
  completionType: '전선' | '교양',
): number {
  return records
    .filter(
      (record) =>
        record.grade === grade &&
        record.semester === semester &&
        record.completionType ===
          completionType &&
        record.letterGrade !== 'F' &&
        (
          record.status === 'planned' ||
          record.status === 'in_progress'
        ),
    )
    .reduce(
      (total, record) =>
        total + record.credits,
      0,
    )
}


export function createCompletionSimulation(
  input: CompletionSimulationInput,
): CompletionSimulationResult {
  const advancedPracticumCredits =
    sumPracticumCredits(
      input.curriculum,
      input.deliveryRules,
      'flexible_practicum',
      ADVANCED_PRACTICUM_CODES,
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

  const semesters: SemesterSimulation[] = []

  for (let grade = 1; grade <= 6; grade += 1) {
    for (
      let semester = 1;
      semester <= 2;
      semester += 1
    ) {
      const requiredCredits =
        input.curriculum.courses
          .filter(
            (course) =>
              course.changeRole === 'current' &&
              course.grade === grade &&
              course.semester === semester &&
              course.completionType === '전필',
          )
          .reduce(
            (total, course) =>
              total + (course.credits ?? 0),
            0,
          )

      const beforeStart = isBeforeStart(
        grade,
        semester,
        input.startGrade,
        input.startSemester,
      )

      const scheduledElectiveCredits =
        beforeStart
          ? 0
          : getScheduledFlexibleCredits(
              input.records,
              grade,
              semester,
              '전선',
            )

      const scheduledGeneralEducationCredits =
        beforeStart
          ? 0
          : getScheduledFlexibleCredits(
              input.records,
              grade,
              semester,
              '교양',
            )

      let capacity = Math.max(
        REGULAR_SEMESTER_CREDIT_LIMIT -
          requiredCredits -
          scheduledElectiveCredits -
          scheduledGeneralEducationCredits,
        0,
      )

      let electiveCredits = 0
      let generalEducationCredits = 0
      let additionalCredits = 0

      if (!beforeStart) {
        electiveCredits = Math.min(
          remainingElectiveCredits,
          capacity,
        )
        remainingElectiveCredits -=
          electiveCredits
        capacity -= electiveCredits

        generalEducationCredits = Math.min(
          remainingGeneralEducationCredits,
          capacity,
        )
        remainingGeneralEducationCredits -=
          generalEducationCredits
        capacity -= generalEducationCredits

        if (input.strategy === 'fill_24') {
          additionalCredits = capacity
        }
      }

      const totalCredits =
        requiredCredits +
        scheduledElectiveCredits +
        scheduledGeneralEducationCredits +
        electiveCredits +
        generalEducationCredits +
        additionalCredits

      semesters.push({
        grade,
        semester,
        isBeforeStart: beforeStart,
        requiredCredits,
        electiveCredits:
          scheduledElectiveCredits +
          electiveCredits,
        generalEducationCredits:
          scheduledGeneralEducationCredits +
          generalEducationCredits,
        additionalCredits,
        practicumActivityCredits:
          grade === 6 &&
          `${grade}-${semester}` ===
            input.advancedPracticumTerm
            ? advancedPracticumCredits
            : 0,
        totalCredits,
        remainingCapacity:
          Math.max(
            REGULAR_SEMESTER_CREDIT_LIMIT -
              totalCredits,
            0,
          ),
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
        total + semester.requiredCredits,
      0,
    )

  const sixthYearAttendanceCredits =
    sixthYearSemesters.reduce(
      (total, semester) =>
        total +
        semester.electiveCredits +
        semester.generalEducationCredits +
        semester.additionalCredits,
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

  return {
    semesters,
    sixthYearRequiredCredits,
    sixthYearRegularCapacity:
      (
        REGULAR_SEMESTER_CREDIT_LIMIT *
        sixthYearSemesters.length
      ) - sixthYearRequiredCredits,
    sixthYearAttendanceCredits,
    advancedPracticumCredits,
    advancedPracticumTerm:
      input.advancedPracticumTerm,
    vacationPracticumCredits:
      sumPracticumCredits(
        input.curriculum,
        input.deliveryRules,
        'vacation_practicum',
        VACATION_PRACTICUM_CODES,
      ),
    externalGeneralEducationCredits,
    unallocatedElectiveCredits:
      remainingElectiveCredits,
    unallocatedGeneralEducationCredits:
      remainingGeneralEducationCredits,
    generalEducationAreaRequirements,
  }
}

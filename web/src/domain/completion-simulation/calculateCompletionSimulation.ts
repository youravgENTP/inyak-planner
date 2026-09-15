import type {
  AuthUser,
} from '../auth/api'
import type {
  CourseCompletionType,
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

export type SimulationRowStatus =
  | 'transfer_credit'
  | 'completed'
  | 'current'
  | 'planned'
  | 'projected'
  | 'sixth_year'

export interface CreditSourceBreakdown {
  resident: number
  transfer: number
  projected: number
}

export interface CompletionSimulationRow {
  key: string
  label: string
  status: SimulationRowStatus
  kind:
    | 'transfer_summary'
    | 'regular'
    | 'seasonal'
    | 'unknown_seasonal'
  grade: number | null
  semester: number | null
  officialRequiredCredits: number
  required: CreditSourceBreakdown
  elective: CreditSourceBreakdown
  generalEducation: CreditSourceBreakdown
  other: CreditSourceBreakdown
  additionalElectiveCredits: number
  total: CreditSourceBreakdown
  remainingAvailableCredits: number | null
  practicumActivityCredits: number
}

export interface CompletionSimulationInput {
  user: Pick<AuthUser, 'studentType'>
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

export interface CompletionSimulationResult {
  rows: CompletionSimulationRow[]
  confirmedCredits: number
  scheduledCredits: number
  remainingGraduationCredits: number
  externalGeneralEducationCredits: number
  remainingAfterExternalCredits: number
  practicumCreditsApplied: number
  regularClassCreditsNeeded: number
  preSixthTotalCapacity: number
  preSixthNewCapacity: number
  sixthYearAttendanceCredits: number
  sixthYearUnallocatedCredits: number
  advancedPracticumCredits: number
  advancedPracticumTerm:
    AdvancedPracticumTerm
  vacationPracticumCredits: number
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


function emptyBreakdown(): CreditSourceBreakdown {
  return {
    resident: 0,
    transfer: 0,
    projected: 0,
  }
}


function addBreakdowns(
  ...breakdowns: readonly CreditSourceBreakdown[]
): CreditSourceBreakdown {
  return breakdowns.reduce(
    (total, breakdown) => ({
      resident:
        total.resident + breakdown.resident,
      transfer:
        total.transfer + breakdown.transfer,
      projected:
        total.projected + breakdown.projected,
    }),
    emptyBreakdown(),
  )
}


function getBreakdownTotal(
  breakdown: CreditSourceBreakdown,
): number {
  return (
    breakdown.resident +
    breakdown.transfer +
    breakdown.projected
  )
}


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


function recordBelongsToRegularSemester(
  record: CourseRecord,
  grade: number,
  semester: number,
): boolean {
  const isRegularTerm =
    record.term == null ||
    record.term === 'spring' ||
    record.term === 'fall'

  return (
    isRegularTerm &&
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


function getRegularSemesterStatus(
  user: Pick<AuthUser, 'studentType'>,
  grade: number,
  semester: number,
  currentGrade: number,
  currentSemester: number,
): SimulationRowStatus {
  if (
    user.studentType === 'transfer' &&
    grade <= 2
  ) {
    return 'transfer_credit'
  }

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


function getCompletionType(
  record: CourseRecord,
  matchedCourseByRecordId:
    ReadonlyMap<string, CurriculumCourse>,
): CourseCompletionType {
  return (
    matchedCourseByRecordId
      .get(record.id)
      ?.completionType ??
    record.completionType
  )
}


function createRecordBreakdowns(
  records: readonly CourseRecord[],
  matchedCourseByRecordId:
    ReadonlyMap<string, CurriculumCourse>,
  forceProjected: boolean,
): {
  required: CreditSourceBreakdown
  elective: CreditSourceBreakdown
  generalEducation: CreditSourceBreakdown
  other: CreditSourceBreakdown
} {
  const result = {
    required: emptyBreakdown(),
    elective: emptyBreakdown(),
    generalEducation: emptyBreakdown(),
    other: emptyBreakdown(),
  }

  for (const record of records) {
    const completionType = getCompletionType(
      record,
      matchedCourseByRecordId,
    )

    const target =
      completionType === '전필'
        ? result.required
        : completionType === '전선'
          ? result.elective
          : completionType === '교양'
            ? result.generalEducation
            : result.other

    if (record.status === 'substituted') {
      target.transfer += record.credits
    } else if (
      forceProjected ||
      record.status === 'planned'
    ) {
      target.projected += record.credits
    } else {
      target.resident += record.credits
    }
  }

  return result
}


function createSeasonalRow(
  records: readonly CourseRecord[],
  matchedCourseByRecordId:
    ReadonlyMap<string, CurriculumCourse>,
  grade: number,
  term: 'summer' | 'winter',
): CompletionSimulationRow {
  const breakdowns = createRecordBreakdowns(
    records,
    matchedCourseByRecordId,
    false,
  )

  const total = addBreakdowns(
    breakdowns.required,
    breakdowns.elective,
    breakdowns.generalEducation,
    breakdowns.other,
  )

  const hasInProgress = records.some(
    (record) =>
      record.status === 'in_progress',
  )
  const hasPlanned = records.some(
    (record) =>
      record.status === 'planned',
  )

  return {
    key: `${grade}-${term}`,
    label:
      `${grade}학년 ` +
      (term === 'summer'
        ? '여름학기'
        : '겨울학기'),
    status: hasInProgress
      ? 'current'
      : hasPlanned
        ? 'planned'
        : 'completed',
    kind: 'seasonal',
    grade,
    semester:
      term === 'summer' ? 1 : 2,
    officialRequiredCredits: 0,
    ...breakdowns,
    additionalElectiveCredits: 0,
    total,
    remainingAvailableCredits: null,
    practicumActivityCredits: 0,
  }
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

  const matchedCourseByRecordId =
    new Map(
      matchResult.matches.map(
        (match) => [
          match.record.id,
          match.curriculumCourse,
        ],
      ),
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

  const vacationPracticumCredits =
    sumPracticumCredits(
      input.curriculum,
      vacationPracticumCodes,
    )

  const remainingGraduationCredits =
    getRemainingCredits(
      input.progress.totalCredits,
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

  const remainingAfterExternalCredits =
    Math.max(
      remainingGraduationCredits -
        externalGeneralEducationCredits,
      0,
    )

  const unmatchedPracticumCredits =
    input.curriculum.courses
      .filter(
        (course) =>
          course.changeRole === 'current' &&
          course.courseCode !== null &&
          practicumCourseCodes.has(
            course.courseCode,
          ) &&
          !matchedRecordByCourseId.has(
            course.id,
          ),
      )
      .reduce(
        (total, course) =>
          total + (course.credits ?? 0),
        0,
      )

  const practicumCreditsApplied = Math.min(
    unmatchedPracticumCredits,
    remainingAfterExternalCredits,
  )

  const regularClassCreditsNeeded =
    Math.max(
      remainingAfterExternalCredits -
        practicumCreditsApplied,
      0,
    )

  const currentIndex = getTermIndex(
    input.currentGrade,
    input.currentSemester,
  )

  const preSixthSemesterCount =
    Array.from(
      { length: 10 },
      (_, index) => index,
    ).filter(
      (index) => index > currentIndex,
    ).length

  const preSixthTotalCapacity =
    preSixthSemesterCount *
    REGULAR_SEMESTER_CREDIT_LIMIT

  const futurePreSixthRecords =
    effectiveRecords.filter(
      (record) =>
        record.status !== 'substituted' &&
        record.term !== 'summer' &&
        record.term !== 'winter' &&
        record.grade !== null &&
        record.semester !== null &&
        getTermIndex(
          record.grade,
          record.semester,
        ) > currentIndex &&
        record.grade <= 5,
    )

  const preSixthAlreadyScheduledCredits =
    sumCredits(futurePreSixthRecords)

  const preSixthNewCapacity = Math.max(
    preSixthTotalCapacity -
      preSixthAlreadyScheduledCredits,
    0,
  )

  const sixthYearOfficialRequiredCredits =
    [1, 2].reduce(
      (total, semester) =>
        total +
        getOfficialRequiredCourses(
          input.curriculum,
          6,
          semester,
        ).reduce(
          (semesterTotal, course) =>
            semesterTotal +
            (course.credits ?? 0),
          0,
        ),
      0,
    )

  const sixthYearAdditionalCapacity =
    Math.max(
      REGULAR_SEMESTER_CREDIT_LIMIT * 2 -
        sixthYearOfficialRequiredCredits,
      0,
    )

  const sixthYearAttendanceCredits = Math.min(
    Math.max(
      regularClassCreditsNeeded -
        preSixthNewCapacity,
      0,
    ),
    sixthYearAdditionalCapacity,
  )

  const sixthYearUnallocatedCredits =
    Math.max(
      regularClassCreditsNeeded -
        preSixthNewCapacity -
        sixthYearAttendanceCredits,
      0,
    )

  let remainingElectiveCredits =
    getRemainingCredits(
      input.progress.majorElective.credits,
    )

  let remainingGeneralEducationCredits =
    Math.max(
      generalEducationRemaining -
        externalGeneralEducationCredits,
      0,
    )

  let sixthAttendanceToAllocate =
    sixthYearAttendanceCredits

  const regularRows: CompletionSimulationRow[] = []

  for (let grade = 1; grade <= 6; grade += 1) {
    for (
      let semester = 1;
      semester <= 2;
      semester += 1
    ) {
      const status = getRegularSemesterStatus(
        input.user,
        grade,
        semester,
        input.currentGrade,
        input.currentSemester,
      )

      const residentRecords =
        effectiveRecords.filter(
          (record) =>
            record.status !== 'substituted' &&
            recordBelongsToRegularSemester(
              record,
              grade,
              semester,
            ),
        )

      const mappedTransferRecords =
        matchResult.matches
          .filter(
            (match) =>
              match.record.status ===
                'substituted' &&
              match.curriculumCourse.grade ===
                grade &&
              match.curriculumCourse.semester ===
                semester,
          )
          .map((match) => match.record)

      const rowRecords = [
        ...residentRecords,
        ...mappedTransferRecords,
      ]

      const breakdowns = createRecordBreakdowns(
        rowRecords,
        matchedCourseByRecordId,
        status === 'projected' ||
          status === 'sixth_year',
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

      if (
        status === 'projected' ||
        status === 'sixth_year'
      ) {
        for (
          const course of officialRequiredCourses
        ) {
          const matchedRecord =
            matchedRecordByCourseId.get(
              course.id,
            )

          if (matchedRecord !== undefined) {
            continue
          }

          breakdowns.required.projected +=
            course.credits ?? 0
        }

        if (status === 'sixth_year') {
          const missingRequired = Math.max(
            officialRequiredCredits -
              getBreakdownTotal(
                breakdowns.required,
              ),
            0,
          )

          breakdowns.required.projected +=
            missingRequired
        }
      }

      const fixedCredits = getBreakdownTotal(
        addBreakdowns(
          breakdowns.required,
          breakdowns.elective,
          breakdowns.generalEducation,
          breakdowns.other,
        ),
      )

      let targetAdditionalCredits = 0

      if (status === 'projected') {
        targetAdditionalCredits = Math.max(
          REGULAR_SEMESTER_CREDIT_LIMIT -
            fixedCredits,
          0,
        )
      } else if (status === 'sixth_year') {
        const sixthSemesterCapacity =
          Math.max(
            REGULAR_SEMESTER_CREDIT_LIMIT -
              fixedCredits,
            0,
          )

        targetAdditionalCredits = Math.min(
          sixthAttendanceToAllocate,
          sixthSemesterCapacity,
        )
        sixthAttendanceToAllocate -=
          targetAdditionalCredits
      }

      const electiveAllocation = Math.min(
        remainingElectiveCredits,
        targetAdditionalCredits,
      )
      remainingElectiveCredits -=
        electiveAllocation

      const afterElective =
        targetAdditionalCredits -
        electiveAllocation

      const generalEducationAllocation =
        Math.min(
          remainingGeneralEducationCredits,
          afterElective,
        )
      remainingGeneralEducationCredits -=
        generalEducationAllocation

      const additionalElectiveCredits =
        Math.max(
          afterElective -
            generalEducationAllocation,
          0,
        )

      breakdowns.elective.projected +=
        electiveAllocation +
        additionalElectiveCredits
      breakdowns.generalEducation.projected +=
        generalEducationAllocation

      const total = addBreakdowns(
        breakdowns.required,
        breakdowns.elective,
        breakdowns.generalEducation,
        breakdowns.other,
      )

      const totalCredits =
        getBreakdownTotal(total)

      regularRows.push({
        key: `${grade}-${semester}`,
        label: `${grade}-${semester}`,
        status,
        kind: 'regular',
        grade,
        semester,
        officialRequiredCredits,
        ...breakdowns,
        additionalElectiveCredits,
        total,
        remainingAvailableCredits:
          status === 'completed' ||
          status === 'transfer_credit'
            ? null
            : Math.max(
                REGULAR_SEMESTER_CREDIT_LIMIT -
                  totalCredits,
                0,
              ),
        practicumActivityCredits:
          grade === 6 &&
          `${grade}-${semester}` ===
            input.advancedPracticumTerm
            ? advancedPracticumCredits
            : 0,
      })
    }
  }

  const seasonalRows = new Map<
    string,
    CompletionSimulationRow
  >()

  for (let grade = 1; grade <= 6; grade += 1) {
    for (
      const term of [
        'summer',
        'winter',
      ] as const
    ) {
      const records = effectiveRecords.filter(
        (record) =>
          record.grade === grade &&
          record.term === term,
      )

      if (records.length > 0) {
        seasonalRows.set(
          `${grade}-${term}`,
          createSeasonalRow(
            records,
            matchedCourseByRecordId,
            grade,
            term,
          ),
        )
      }
    }
  }

  const rows: CompletionSimulationRow[] = []

  const substitutedRecords =
    effectiveRecords.filter(
      (record) =>
        record.status === 'substituted',
    )

  if (
    input.user.studentType === 'transfer' &&
    substitutedRecords.length > 0
  ) {
    const breakdowns = createRecordBreakdowns(
      substitutedRecords,
      matchedCourseByRecordId,
      false,
    )
    const total = addBreakdowns(
      breakdowns.required,
      breakdowns.elective,
      breakdowns.generalEducation,
      breakdowns.other,
    )

    rows.push({
      key: 'transfer-summary',
      label: '전적대 학점인정',
      status: 'transfer_credit',
      kind: 'transfer_summary',
      grade: null,
      semester: null,
      officialRequiredCredits: 0,
      ...breakdowns,
      additionalElectiveCredits: 0,
      total,
      remainingAvailableCredits: null,
      practicumActivityCredits: 0,
    })
  }

  for (const row of regularRows) {
    rows.push(row)

    if (row.grade !== null) {
      const summer = seasonalRows.get(
        `${row.grade}-summer`,
      )
      const winter = seasonalRows.get(
        `${row.grade}-winter`,
      )

      if (row.semester === 1 && summer) {
        rows.push(summer)
      }

      if (row.semester === 2 && winter) {
        rows.push(winter)
      }
    }

    if (
      row.status === 'current' &&
      externalGeneralEducationCredits > 0
    ) {
      const generalEducation =
        emptyBreakdown()
      generalEducation.projected =
        externalGeneralEducationCredits

      rows.push({
        key: 'unknown-seasonal',
        label: '계절 (학기 미상)',
        status: 'planned',
        kind: 'unknown_seasonal',
        grade: null,
        semester: null,
        officialRequiredCredits: 0,
        required: emptyBreakdown(),
        elective: emptyBreakdown(),
        generalEducation,
        other: emptyBreakdown(),
        additionalElectiveCredits: 0,
        total: generalEducation,
        remainingAvailableCredits: null,
        practicumActivityCredits: 0,
      })
    }
  }

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
    rows,
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
    externalGeneralEducationCredits,
    remainingAfterExternalCredits,
    practicumCreditsApplied,
    regularClassCreditsNeeded,
    preSixthTotalCapacity,
    preSixthNewCapacity,
    sixthYearAttendanceCredits,
    sixthYearUnallocatedCredits,
    advancedPracticumCredits,
    advancedPracticumTerm:
      input.advancedPracticumTerm,
    vacationPracticumCredits,
    generalEducationAreaRequirements,
  }
}

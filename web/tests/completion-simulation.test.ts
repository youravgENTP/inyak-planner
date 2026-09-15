import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createCompletionSimulation,
} from '../src/domain/completion-simulation/calculateCompletionSimulation.ts'


const curriculum = {
  entryYear: 2024,
  count: 9,
  courses: [
    ['ADA213', 6, 1, 3],
    ['ADA214', 6, 1, 2],
    ['ADA215', 6, 1, 3],
    ['ADA216', 6, 1, 2],
    ['ADA218', 6, 1, 2],
    ['ADA219', 6, 1, 2],
    ['ADA220', 6, 2, 3],
    ['ADA226', 6, 2, 5],
    ['ADA227', 6, 2, 5],
  ].map(
    ([courseCode, grade, semester, credits],
      index) => ({
      id: index + 1,
      entryYear: 2024,
      grade,
      semester,
      courseName: String(courseCode),
      courseCode: String(courseCode),
      completionType: '전필',
      credits,
      notes: null,
      changeGroup: null,
      changeType: null,
      changeRole: 'current',
      changeEffectiveYear: null,
      changeNote: null,
      previousCredits: null,
      previousCompletionType: null,
      previousGrade: null,
      previousSemester: null,
      attributeChangeEffectiveYear: null,
      attributeChangeNote: null,
    }),
  ),
} as any

const emptyCreditProgress = {
  completedCredits: 0,
  inProgressCredits: 0,
  plannedCredits: 0,
  requiredCredits: 0,
  remainingCredits: 0,
  isSatisfied: true,
}

const progress = {
  totalCredits: {
    ...emptyCreditProgress,
    requiredCredits: 48,
    remainingCredits: 48,
    isSatisfied: false,
  },
  majorRequired: {
    completionType: '전필',
    credits: {
      ...emptyCreditProgress,
      requiredCredits: 27,
      remainingCredits: 27,
      isSatisfied: false,
    },
    courses: null,
    isSatisfied: true,
  },
  majorElective: {
    completionType: '전선',
    credits: {
      ...emptyCreditProgress,
      requiredCredits: 15,
      remainingCredits: 15,
      isSatisfied: false,
    },
    courses: null,
    isSatisfied: false,
  },
  generalEducation: [
    {
      requirementId: 1,
      category: '균형교양',
      credits: {
        ...emptyCreditProgress,
        requiredCredits: 6,
        remainingCredits: 6,
        isSatisfied: false,
      },
      minimumAreaCount: 2,
      completedAreaCount: 0,
      remainingAreaCount: 2,
      areasAreSatisfied: false,
      isSatisfied: false,
      areas: [],
    },
  ],
  isSatisfied: false,
  substitutedRecords: [],
} as any

const regularUser = {
  studentType: 'regular',
} as const


test('calculates the official sixth-year 14/13 split', () => {
  const result = createCompletionSimulation({
    user: regularUser,
    curriculum,
    progress,
    records: [],
    deliveryRules: [],
    currentGrade: 5,
    currentSemester: 2,
    externalGeneralEducationCredits: 0,
    advancedPracticumTerm: '6-1',
  })

  const sixthYear = result.rows.filter(
    (row) =>
      row.kind === 'regular' &&
      row.grade === 6,
  )

  assert.deepEqual(
    sixthYear.map(
      (semester) => ({
        required:
          semester.officialRequiredCredits,
        remaining:
          24 -
          semester.officialRequiredCredits,
      }),
    ),
    [
      { required: 14, remaining: 10 },
      { required: 13, remaining: 11 },
    ],
  )
  assert.equal(result.sixthYearAttendanceCredits, 21)
})


test('moves activity, but not recognized credits', () => {
  const firstTerm = createCompletionSimulation({
    user: regularUser,
    curriculum,
    progress,
    records: [],
    deliveryRules: [],
    currentGrade: 5,
    currentSemester: 2,
    externalGeneralEducationCredits: 0,
    advancedPracticumTerm: '6-1',
  })

  const secondTerm = createCompletionSimulation({
    user: regularUser,
    curriculum,
    progress,
    records: [],
    deliveryRules: [],
    currentGrade: 5,
    currentSemester: 2,
    externalGeneralEducationCredits: 0,
    advancedPracticumTerm: '6-2',
  })

  assert.equal(firstTerm.advancedPracticumCredits, 10)
  assert.equal(firstTerm.vacationPracticumCredits, 17)
  assert.equal(
    firstTerm.rows.find(
      (row) => row.key === '6-1',
    )
      .practicumActivityCredits,
    10,
  )
  assert.equal(
    firstTerm.rows.find(
      (row) => row.key === '6-2',
    )
      .practicumActivityCredits,
    0,
  )
  assert.equal(
    secondTerm.rows.find(
      (row) => row.key === '6-1',
    )
      .practicumActivityCredits,
    0,
  )
  assert.equal(
    secondTerm.rows.find(
      (row) => row.key === '6-2',
    )
      .practicumActivityCredits,
    10,
  )
  assert.equal(
    firstTerm.rows
      .filter((row) => row.grade === 6)
      .reduce(
        (total, row) =>
          total + row.officialRequiredCredits,
        0,
      ),
    secondTerm.rows
      .filter((row) => row.grade === 6)
      .reduce(
        (total, row) =>
          total + row.officialRequiredCredits,
        0,
      ),
  )
})


test('external general education reduces regular load', () => {
  const result = createCompletionSimulation({
    user: regularUser,
    curriculum,
    progress,
    records: [],
    deliveryRules: [],
    currentGrade: 5,
    currentSemester: 2,
    externalGeneralEducationCredits: 6,
    advancedPracticumTerm: '6-1',
  })

  assert.equal(
    result.externalGeneralEducationCredits,
    6,
  )
  assert.equal(result.sixthYearAttendanceCredits, 15)
  assert.equal(
    result.generalEducationAreaRequirements[0]
      .remainingAreaCount,
    2,
  )
})


test('reflects actual and in-progress user records', () => {
  const records = [
    {
      id: 'completed-elective',
      curriculumCourseId: null,
      grade: 2,
      semester: 1,
      courseCode: 'ELECTIVE-1',
      courseName: '전공선택 기록',
      completionType: '전선',
      credits: 6,
      status: 'completed',
      letterGrade: 'A+',
      isRetake: false,
    },
    {
      id: 'current-general',
      curriculumCourseId: null,
      grade: 5,
      semester: 2,
      courseCode: 'GENERAL-1',
      courseName: '교양 기록',
      completionType: '교양',
      credits: 3,
      status: 'in_progress',
      letterGrade: null,
      isRetake: false,
    },
    {
      id: 'failed-course',
      curriculumCourseId: null,
      grade: 2,
      semester: 1,
      courseCode: 'FAILED-1',
      courseName: '낙제 기록',
      completionType: '전선',
      credits: 4,
      status: 'completed',
      letterGrade: 'F',
      isRetake: false,
    },
    {
      id: 'retaken-course',
      curriculumCourseId: null,
      grade: 2,
      semester: 1,
      courseCode: 'RETAKE-1',
      courseName: '말소된 재수강 기록',
      completionType: '전선',
      credits: 3,
      status: 'completed',
      letterGrade: 'B+',
      isRetake: true,
    },
  ] as any

  const recordProgress = {
    ...progress,
    totalCredits: {
      ...emptyCreditProgress,
      completedCredits: 6,
      inProgressCredits: 3,
      requiredCredits: 48,
      remainingCredits: 39,
      isSatisfied: false,
    },
    majorElective: {
      ...progress.majorElective,
      credits: {
        ...progress.majorElective.credits,
        completedCredits: 6,
        remainingCredits: 9,
      },
    },
    generalEducation: [
      {
        ...progress.generalEducation[0],
        credits: {
          ...progress.generalEducation[0].credits,
          inProgressCredits: 3,
          remainingCredits: 3,
        },
      },
    ],
  } as any

  const result = createCompletionSimulation({
    user: regularUser,
    curriculum,
    progress: recordProgress,
    records,
    deliveryRules: [],
    currentGrade: 5,
    currentSemester: 2,
    externalGeneralEducationCredits: 0,
    advancedPracticumTerm: '6-1',
  })

  assert.equal(result.confirmedCredits, 6)
  assert.equal(result.scheduledCredits, 3)
  assert.equal(result.remainingGraduationCredits, 39)
  assert.equal(
    result.rows.find(
      (row) => row.key === '2-1',
    ).total.resident,
    6,
  )
  assert.equal(
    result.rows.find(
      (row) => row.key === '5-2',
    ).total.resident,
    3,
  )
  assert.equal(result.sixthYearAttendanceCredits, 12)
})


test('fills every next semester through 5-2 to 24 credits', () => {
  const result = createCompletionSimulation({
    user: regularUser,
    curriculum,
    progress,
    records: [],
    deliveryRules: [],
    currentGrade: 3,
    currentSemester: 2,
    externalGeneralEducationCredits: 0,
    advancedPracticumTerm: '6-1',
  })

  const projectedSemesters =
    result.rows.filter(
      (row) =>
        row.status === 'projected',
    )

  assert.deepEqual(
    projectedSemesters.map(
      (row) =>
        row.total.resident +
        row.total.transfer +
        row.total.projected,
    ),
    [24, 24, 24, 24],
  )
  assert.equal(result.sixthYearAttendanceCredits, 0)
})


test('calculates 128 minus 2 minus 27, then 96 and 3', () => {
  const userProgress = {
    ...progress,
    totalCredits: {
      ...emptyCreditProgress,
      requiredCredits: 128,
      remainingCredits: 128,
      isSatisfied: false,
    },
    majorElective: {
      ...progress.majorElective,
      credits: {
        ...emptyCreditProgress,
        requiredCredits: 99,
        remainingCredits: 99,
        isSatisfied: false,
      },
    },
    generalEducation: [
      {
        ...progress.generalEducation[0],
        credits: {
          ...emptyCreditProgress,
          requiredCredits: 2,
          remainingCredits: 2,
          isSatisfied: false,
        },
      },
    ],
  } as any

  const result = createCompletionSimulation({
    user: regularUser,
    curriculum,
    progress: userProgress,
    records: [],
    deliveryRules: [],
    currentGrade: 3,
    currentSemester: 2,
    externalGeneralEducationCredits: 2,
    advancedPracticumTerm: '6-1',
  })

  assert.equal(result.remainingGraduationCredits, 128)
  assert.equal(result.remainingAfterExternalCredits, 126)
  assert.equal(result.practicumCreditsApplied, 27)
  assert.equal(result.regularClassCreditsNeeded, 99)
  assert.equal(result.preSixthTotalCapacity, 96)
  assert.equal(result.sixthYearAttendanceCredits, 3)

  const sixthFirst = result.rows.find(
    (row) => row.key === '6-1',
  )
  const sixthSecond = result.rows.find(
    (row) => row.key === '6-2',
  )

  assert.equal(
    sixthFirst.total.projected,
    17,
  )
  assert.equal(
    sixthFirst.remainingAvailableCredits,
    7,
  )
  assert.equal(
    sixthSecond.total.projected,
    13,
  )
  assert.equal(
    sixthSecond.remainingAvailableCredits,
    11,
  )
  assert.equal(
    result.rows.some(
      (row) =>
        row.key === 'unknown-seasonal' &&
        row.generalEducation.projected === 2,
    ),
    true,
  )
})


test('shows transfer credits once and maps them to curriculum terms', () => {
  const transferCurriculum = {
    entryYear: 2024,
    count: 2,
    courses: [
      {
        ...curriculum.courses[0],
        id: 101,
        grade: 1,
        semester: 1,
        courseCode: 'TRANSFER-101',
        courseName: '전적대 인정 전필 1',
        credits: 3,
      },
      {
        ...curriculum.courses[0],
        id: 102,
        grade: 2,
        semester: 1,
        courseCode: 'TRANSFER-102',
        courseName: '전적대 인정 전필 2',
        credits: 2,
      },
    ],
  } as any

  const transferRecords = [
    {
      id: 'transfer-1',
      curriculumCourseId: 101,
      grade: null,
      semester: null,
      term: null,
      courseCode: 'TRANSFER-101',
      courseName: '전적대 인정 전필 1',
      completionType: '전필',
      credits: 3,
      status: 'substituted',
      letterGrade: null,
      isRetake: false,
    },
    {
      id: 'transfer-2',
      curriculumCourseId: 102,
      grade: null,
      semester: null,
      term: null,
      courseCode: 'TRANSFER-102',
      courseName: '전적대 인정 전필 2',
      completionType: '전필',
      credits: 2,
      status: 'substituted',
      letterGrade: null,
      isRetake: false,
    },
  ] as any

  const result = createCompletionSimulation({
    user: { studentType: 'transfer' },
    curriculum: transferCurriculum,
    progress,
    records: transferRecords,
    deliveryRules: [],
    currentGrade: 3,
    currentSemester: 2,
    externalGeneralEducationCredits: 0,
    advancedPracticumTerm: '6-1',
  })

  assert.equal(result.confirmedCredits, 5)
  assert.equal(
    result.rows.find(
      (row) => row.key === 'transfer-summary',
    ).total.transfer,
    5,
  )
  assert.equal(
    result.rows.find(
      (row) => row.key === '1-1',
    ).required.transfer,
    3,
  )
  assert.equal(
    result.rows.find(
      (row) => row.key === '2-1',
    ).required.transfer,
    2,
  )
  assert.equal(
    result.rows.find(
      (row) => row.key === '1-2',
    ).status,
    'transfer_credit',
  )
})


test('places recorded summer and winter courses in separate rows', () => {
  const seasonalRecords = [
    {
      id: 'summer-general',
      curriculumCourseId: null,
      grade: 3,
      semester: 1,
      term: 'summer',
      courseCode: 'SUMMER-1',
      courseName: '여름 교양',
      completionType: '교양',
      credits: 2,
      status: 'completed',
      letterGrade: 'A',
      isRetake: false,
    },
    {
      id: 'winter-elective',
      curriculumCourseId: null,
      grade: 3,
      semester: 2,
      term: 'winter',
      courseCode: 'WINTER-1',
      courseName: '겨울 전선',
      completionType: '전선',
      credits: 3,
      status: 'planned',
      letterGrade: null,
      isRetake: false,
    },
  ] as any

  const result = createCompletionSimulation({
    user: regularUser,
    curriculum,
    progress,
    records: seasonalRecords,
    deliveryRules: [],
    currentGrade: 3,
    currentSemester: 2,
    externalGeneralEducationCredits: 0,
    advancedPracticumTerm: '6-1',
  })

  assert.equal(
    result.rows.find(
      (row) => row.key === '3-summer',
    ).generalEducation.resident,
    2,
  )
  assert.equal(
    result.rows.find(
      (row) => row.key === '3-winter',
    ).elective.projected,
    3,
  )
})

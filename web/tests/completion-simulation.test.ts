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
  totalCredits: emptyCreditProgress,
  majorRequired: {
    completionType: '전필',
    credits: emptyCreditProgress,
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


test('calculates the official sixth-year 14/13 split', () => {
  const result = createCompletionSimulation({
    curriculum,
    progress,
    records: [],
    deliveryRules: [],
    currentGrade: 5,
    currentSemester: 2,
    externalGeneralEducationCredits: 0,
    advancedPracticumTerm: '6-1',
  })

  const sixthYear = result.semesters.filter(
    (semester) => semester.grade === 6,
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
  assert.equal(result.sixthYearRegularCapacity, 21)
  assert.equal(result.sixthYearAttendanceCredits, 21)
})


test('moves activity, but not recognized credits', () => {
  const firstTerm = createCompletionSimulation({
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
    firstTerm.semesters.at(-2)
      .practicumActivityCredits,
    10,
  )
  assert.equal(
    firstTerm.semesters.at(-1)
      .practicumActivityCredits,
    0,
  )
  assert.equal(
    secondTerm.semesters.at(-2)
      .practicumActivityCredits,
    0,
  )
  assert.equal(
    secondTerm.semesters.at(-1)
      .practicumActivityCredits,
    10,
  )
  assert.equal(
    firstTerm.sixthYearRequiredCredits,
    secondTerm.sixthYearRequiredCredits,
  )
})


test('external general education reduces regular load', () => {
  const result = createCompletionSimulation({
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
      requiredCredits: 21,
      remainingCredits: 15,
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
  assert.equal(result.remainingGraduationCredits, 12)
  assert.equal(
    result.semesters.find(
      (semester) =>
        semester.grade === 2 &&
        semester.semester === 1,
    ).recordedCredits,
    6,
  )
  assert.equal(
    result.semesters.find(
      (semester) =>
        semester.grade === 5 &&
        semester.semester === 2,
    ).recordedCredits,
    3,
  )
  assert.equal(result.sixthYearAttendanceCredits, 12)
})


test('fills every next semester through 5-2 to 24 credits', () => {
  const result = createCompletionSimulation({
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
    result.semesters.filter(
      (semester) =>
        semester.status === 'projected',
    )

  assert.deepEqual(
    projectedSemesters.map(
      (semester) => semester.totalCredits,
    ),
    [24, 24, 24, 24],
  )
  assert.equal(result.sixthYearAttendanceCredits, 0)
})

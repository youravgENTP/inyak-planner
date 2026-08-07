import type {
  CourseRecord,
  CourseRecordStatus,
} from '../course-records/types'
import type {
  Curriculum,
  CurriculumCompletionType,
} from '../curriculum/types'
import type {
  GeneralEducation,
  GeneralEducationArea,
  GeneralEducationRequirement,
} from '../general-education/types'
import {
  matchCurriculumRecords,
} from './matchCurriculumRecords'
import type {
  CurriculumRecordMatch,
} from './matchCurriculumRecords'
import {
  GRADUATION_TOTAL_CREDITS,
  MAJOR_ELECTIVE_CREDITS,
  MAJOR_REQUIRED_CREDITS,
} from './types'
import type {
  CourseCountProgress,
  CreditProgress,
  GeneralEducationAreaProgress,
  GeneralEducationRequirementProgress,
  GraduationProgress,
  MajorCompletionProgress,
  ProgressRecordState,
} from './types'


const COMPLETED_STATUSES:
  readonly CourseRecordStatus[] = [
    'completed',
    'substituted',
  ]


function getRecordState(
  record: CourseRecord,
): ProgressRecordState {
  if (
    COMPLETED_STATUSES.includes(
      record.status,
    )
  ) {
    return 'completed'
  }

  if (record.status === 'in_progress') {
    return 'inProgress'
  }

  return 'planned'
}


function sumRecordCredits(
  records: readonly CourseRecord[],
  state: ProgressRecordState,
): number {
  return records
    .filter(
      (record) =>
        getRecordState(record) === state,
    )
    .reduce(
      (total, record) =>
        total + record.credits,
      0,
    )
}


function countRecords(
  records: readonly CourseRecord[],
  state: ProgressRecordState,
): number {
  return records.filter(
    (record) =>
      getRecordState(record) === state,
  ).length
}


function createCreditProgress(
  records: readonly CourseRecord[],
  requiredCredits: number,
): CreditProgress {
  const completedCredits =
    sumRecordCredits(
      records,
      'completed',
    )

  const inProgressCredits =
    sumRecordCredits(
      records,
      'inProgress',
    )

  const plannedCredits =
    sumRecordCredits(
      records,
      'planned',
    )

  return {
    completedCredits,
    inProgressCredits,
    plannedCredits,
    requiredCredits,
    remainingCredits: Math.max(
      requiredCredits - completedCredits,
      0,
    ),
    isSatisfied:
      completedCredits >= requiredCredits,
  }
}


function combineCreditProgress(
  progresses:
    readonly CreditProgress[],
): CreditProgress {
  const completedCredits =
    progresses.reduce(
      (total, progress) =>
        total +
        progress.completedCredits,
      0,
    )

  const inProgressCredits =
    progresses.reduce(
      (total, progress) =>
        total +
        progress.inProgressCredits,
      0,
    )

  const plannedCredits =
    progresses.reduce(
      (total, progress) =>
        total +
        progress.plannedCredits,
      0,
    )

  return {
    completedCredits,
    inProgressCredits,
    plannedCredits,
    requiredCredits:
      GRADUATION_TOTAL_CREDITS,
    remainingCredits: Math.max(
      GRADUATION_TOTAL_CREDITS -
        completedCredits,
      0,
    ),
    isSatisfied:
      completedCredits >=
      GRADUATION_TOTAL_CREDITS,
  }
}


function createCourseCountProgress(
  records: readonly CourseRecord[],
  requiredCourseCount: number,
): CourseCountProgress {
  const completedCourseCount =
    countRecords(
      records,
      'completed',
    )

  const inProgressCourseCount =
    countRecords(
      records,
      'inProgress',
    )

  const plannedCourseCount =
    countRecords(
      records,
      'planned',
    )

  return {
    completedCourseCount,
    inProgressCourseCount,
    plannedCourseCount,
    requiredCourseCount,
    remainingCourseCount: Math.max(
      requiredCourseCount -
        completedCourseCount,
      0,
    ),
    isSatisfied:
      completedCourseCount >=
      requiredCourseCount,
  }
}


function getMajorRequiredCredits(
  completionType:
    CurriculumCompletionType,
): number {
  if (completionType === '전필') {
    return MAJOR_REQUIRED_CREDITS
  }

  return MAJOR_ELECTIVE_CREDITS
}


function createMajorProgress(
  curriculum: Curriculum,
  matches:
    readonly CurriculumRecordMatch[],
  completionType:
    CurriculumCompletionType,
): MajorCompletionProgress {
  const officialCourses =
    curriculum.courses.filter(
      (course) =>
        course.completionType ===
        completionType,
    )

  /*
   * 사용자가 수강기록 입력 당시 지정한
   * completionType이 아니라,
   * 학번별 curriculum에서 판정된
   * completionType을 기준으로 분류합니다.
   */
  const matchingRecords =
    matches
      .filter(
        (match) =>
          match.curriculumCourse
            .completionType ===
          completionType,
      )
      .map(
        (match) =>
          match.record,
      )

  return {
    completionType,

    credits: createCreditProgress(
      matchingRecords,
      getMajorRequiredCredits(
        completionType,
      ),
    ),

    courses: createCourseCountProgress(
      matchingRecords,
      officialCourses.length,
    ),
  }
}


function getGeneralEducationRecords(
  records: readonly CourseRecord[],
  requirementId: number,
): CourseRecord[] {
  return records.filter(
    (record) =>
      record.completionType ===
        '교양' &&
      record
        .generalEducationRequirementId ===
        requirementId,
  )
}


function getAreaRecords(
  records: readonly CourseRecord[],
  areaId: number,
): CourseRecord[] {
  return records.filter(
    (record) =>
      record.completionType ===
        '교양' &&
      record.generalEducationAreaId ===
        areaId,
  )
}


function createAreaProgress(
  requirement:
    GeneralEducationRequirement,
  area: GeneralEducationArea,
  records: readonly CourseRecord[],
): GeneralEducationAreaProgress {
  const areaRecords =
    getAreaRecords(
      records,
      area.id,
    )

  const completedCredits =
    sumRecordCredits(
      areaRecords,
      'completed',
    )

  const inProgressCredits =
    sumRecordCredits(
      areaRecords,
      'inProgress',
    )

  const plannedCredits =
    sumRecordCredits(
      areaRecords,
      'planned',
    )

  const hasCompletedRecord =
    areaRecords.some(
      (record) =>
        getRecordState(record) ===
        'completed',
    )

  const remainingCredits =
    area.minimumCredits === null
      ? null
      : Math.max(
          area.minimumCredits -
            completedCredits,
          0,
        )

  const isSatisfied =
    area.minimumCredits === null
      ? hasCompletedRecord
      : completedCredits >=
        area.minimumCredits

  return {
    requirementId:
      requirement.id,
    areaId:
      area.id,
    category:
      requirement.category,
    areaName:
      area.areaName,
    minimumCredits:
      area.minimumCredits,
    isRequired:
      area.isRequired,
    completedCredits,
    inProgressCredits,
    plannedCredits,
    remainingCredits,
    hasCompletedRecord,
    isSatisfied,
  }
}


function createGeneralEducationProgress(
  requirement:
    GeneralEducationRequirement,
  records: readonly CourseRecord[],
): GeneralEducationRequirementProgress {
  const requirementRecords =
    getGeneralEducationRecords(
      records,
      requirement.id,
    )

  const areas =
    requirement.areas.map(
      (area) =>
        createAreaProgress(
          requirement,
          area,
          requirementRecords,
        ),
    )

  const completedAreaCount =
    areas.filter(
      (area) =>
        area.isSatisfied,
    ).length

  const remainingAreaCount =
    requirement.minimumAreaCount === null
      ? null
      : Math.max(
          requirement.minimumAreaCount -
            completedAreaCount,
          0,
        )

  const areasAreSatisfied =
    requirement.minimumAreaCount === null
      ? areas
          .filter(
            (area) =>
              area.isRequired,
          )
          .every(
            (area) =>
              area.isSatisfied,
          )
      : completedAreaCount >=
        requirement.minimumAreaCount

  const credits =
    createCreditProgress(
      requirementRecords,
      requirement.minimumCredits,
    )

  return {
    requirementId:
      requirement.id,
    category:
      requirement.category,
    credits,
    minimumAreaCount:
      requirement.minimumAreaCount,
    completedAreaCount,
    remainingAreaCount,
    areasAreSatisfied,
    isSatisfied:
      credits.isSatisfied &&
      areasAreSatisfied,
    areas,
  }
}


export function calculateGraduationProgress(
  curriculum: Curriculum,
  generalEducation:
    GeneralEducation,
  records: readonly CourseRecord[],
): GraduationProgress {
  const effectiveRecords =
    records.filter(
      (record) =>
        !record.isRetake,
    )

  const curriculumMatchResult =
    matchCurriculumRecords(
      curriculum,
      effectiveRecords,
    )

  const majorRequired =
    createMajorProgress(
      curriculum,
      curriculumMatchResult.matches,
      '전필',
    )

  const majorElective =
    createMajorProgress(
      curriculum,
      curriculumMatchResult.matches,
      '전선',
    )

  const generalEducationProgress =
    generalEducation.requirements.map(
      (requirement) =>
        createGeneralEducationProgress(
          requirement,
          effectiveRecords,
        ),
    )

  const totalCredits =
    combineCreditProgress([
      majorRequired.credits,
      majorElective.credits,
      ...generalEducationProgress.map(
        (requirement) =>
          requirement.credits,
      ),
    ])

  return {
    totalCredits,
    majorRequired,
    majorElective,
    generalEducation:
      generalEducationProgress,
    substitutedRecords:
      effectiveRecords.filter(
        (record) =>
          record.status ===
          'substituted',
      ),
  }
}
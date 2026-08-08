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
import type {
  GraduationRequirements,
} from '../graduation-requirements/types'
import {
  matchCurriculumRecords,
} from './matchCurriculumRecords'
import type {
  CurriculumRecordMatch,
} from './matchCurriculumRecords'
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


function recordCountsTowardGraduation(
  record: CourseRecord,
): boolean {
  /*
   * F는 성적 기록과 GPA 계산에는 남지만
   * 학점을 취득한 과목은 아닙니다.
   *
   * 따라서 졸업요건의 취득학점,
   * 이수 과목 수, 영역 충족에는
   * 반영하지 않습니다.
   */
  return record.letterGrade !== 'F'
}


function sumRecordCredits(
  records: readonly CourseRecord[],
  state: ProgressRecordState,
): number {
  return records
    .filter(
      (record) =>
        recordCountsTowardGraduation(
          record,
        ) &&
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
      recordCountsTowardGraduation(
        record,
      ) &&
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

  const requiredCredits =
    progresses.reduce(
      (total, progress) =>
        total +
        progress.requiredCredits,
      0,
    )

  return {
    completedCredits,
    inProgressCredits,
    plannedCredits,
    requiredCredits,
    remainingCredits: Math.max(
      requiredCredits -
        completedCredits,
      0,
    ),
    isSatisfied:
      completedCredits >=
      requiredCredits,
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


function createMajorProgress(
  curriculum: Curriculum,
  matches:
    readonly CurriculumRecordMatch[],
  completionType:
    CurriculumCompletionType,
  requiredCredits: number,
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

  const credits =
    createCreditProgress(
      matchingRecords,
      requiredCredits,
    )

  const courses =
    completionType === '전필'
      ? createCourseCountProgress(
          matchingRecords,
          officialCourses.length,
        )
      : null

  return {
    completionType,
    credits,
    courses,
    isSatisfied:
      credits.isSatisfied &&
      (
        courses === null ||
        courses.isSatisfied
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
        recordCountsTowardGraduation(
          record,
        ) &&
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
  graduationRequirements:
    GraduationRequirements,
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
      graduationRequirements
        .majorRequiredCredits,
    )

  const majorElective =
    createMajorProgress(
      curriculum,
      curriculumMatchResult.matches,
      '전선',
      graduationRequirements
        .majorElectiveCredits,
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
    isSatisfied:
      majorRequired.isSatisfied &&
      majorElective.isSatisfied &&
      generalEducationProgress.every(
        (requirement) =>
          requirement.isSatisfied,
      ),
    substitutedRecords:
      effectiveRecords.filter(
        (record) =>
          record.status ===
          'substituted',
      ),
  }
}
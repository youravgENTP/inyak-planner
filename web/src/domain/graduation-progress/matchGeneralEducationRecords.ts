import type {
  CourseRecord,
} from '../course-records/types'
import type {
  GeneralEducation,
  GeneralEducationArea,
  GeneralEducationRequirement,
} from '../general-education/types'


export interface GeneralEducationRecordMatch {
  requirement:
    GeneralEducationRequirement
  area:
    GeneralEducationArea
  record:
    CourseRecord
}


export interface GeneralEducationRecordMatchResult {
  matches:
    GeneralEducationRecordMatch[]

  unmatchedRecords:
    CourseRecord[]
}


function normalizeCourseName(
  courseName: string,
): string {
  return courseName
    .trim()
    .replace(/\s+/g, '')
    .toLocaleLowerCase('ko-KR')
}


function normalizeCourseCode(
  courseCode: string | null,
): string | null {
  if (courseCode === null) {
    return null
  }

  const normalized =
    courseCode
      .trim()
      .toLocaleUpperCase('en-US')

  return normalized.length === 0
    ? null
    : normalized
}


interface AreaCandidate {
  requirement:
    GeneralEducationRequirement
  area:
    GeneralEducationArea
}


function getExplicitAreaCandidate(
  generalEducation:
    GeneralEducation,
  record: CourseRecord,
): AreaCandidate | null {
  if (
    record.generalEducationRequirementId ===
      null ||
    record.generalEducationAreaId === null
  ) {
    return null
  }

  const requirement =
    generalEducation.requirements.find(
      (candidate) =>
        candidate.id ===
        record.generalEducationRequirementId,
    )

  if (requirement === undefined) {
    return null
  }

  const area =
    requirement.areas.find(
      (candidate) =>
        candidate.id ===
        record.generalEducationAreaId,
    )

  if (area === undefined) {
    return null
  }

  return {
    requirement,
    area,
  }
}


function getAllAreaCandidates(
  generalEducation:
    GeneralEducation,
): AreaCandidate[] {
  return generalEducation.requirements
    .flatMap(
      (requirement) =>
        requirement.areas.map(
          (area) => ({
            requirement,
            area,
          }),
        ),
    )
}


function deduplicateAreaCandidates(
  candidates:
    readonly AreaCandidate[],
): AreaCandidate[] {
  const uniqueCandidates =
    new Map<number, AreaCandidate>()

  for (const candidate of candidates) {
    uniqueCandidates.set(
      candidate.area.id,
      candidate,
    )
  }

  return [
    ...uniqueCandidates.values(),
  ]
}


function findCourseCodeCandidate(
  generalEducation:
    GeneralEducation,
  record: CourseRecord,
): AreaCandidate | null {
  const recordCourseCode =
    normalizeCourseCode(
      record.courseCode,
    )

  if (recordCourseCode === null) {
    return null
  }

  const candidates =
    getAllAreaCandidates(
      generalEducation,
    ).filter(
      ({ area }) =>
        area.courseMappings.some(
          (mapping) =>
            normalizeCourseCode(
              mapping.courseCode,
            ) === recordCourseCode,
        ),
    )

  const uniqueCandidates =
    deduplicateAreaCandidates(
      candidates,
    )

  if (uniqueCandidates.length !== 1) {
    return null
  }

  return uniqueCandidates[0]
}


function findCourseNameCandidate(
  generalEducation:
    GeneralEducation,
  record: CourseRecord,
): AreaCandidate | null {
  const recordCourseName =
    normalizeCourseName(
      record.courseName,
    )

  const candidates =
    getAllAreaCandidates(
      generalEducation,
    ).filter(
      ({ area }) =>
        area.courseMappings.some(
          (mapping) =>
            normalizeCourseName(
              mapping.courseName,
            ) === recordCourseName,
        ),
    )

  const uniqueCandidates =
    deduplicateAreaCandidates(
      candidates,
    )

  if (uniqueCandidates.length !== 1) {
    return null
  }

  return uniqueCandidates[0]
}


function findGeneralEducationCandidate(
  generalEducation:
    GeneralEducation,
  record: CourseRecord,
): AreaCandidate | null {
  /*
   * 편입 대체 인정처럼 사용자가
   * 명시적으로 교양요건을 연결한 기록을
   * 가장 우선합니다.
   */
  const explicitCandidate =
    getExplicitAreaCandidate(
      generalEducation,
      record,
    )

  if (explicitCandidate !== null) {
    return explicitCandidate
  }

  const courseCodeCandidate =
    findCourseCodeCandidate(
      generalEducation,
      record,
    )

  if (courseCodeCandidate !== null) {
    return courseCodeCandidate
  }

  return findCourseNameCandidate(
    generalEducation,
    record,
  )
}


export function matchGeneralEducationRecords(
  generalEducation:
    GeneralEducation,
  records: readonly CourseRecord[],
): GeneralEducationRecordMatchResult {
  const matches:
    GeneralEducationRecordMatch[] = []

  const unmatchedRecords:
    CourseRecord[] = []

  for (const record of records) {
    if (
      record.isRetake ||
      record.completionType !== '교양'
    ) {
      continue
    }

    const candidate =
      findGeneralEducationCandidate(
        generalEducation,
        record,
      )

    if (candidate === null) {
      if (
        record.status !==
        'substituted'
      ) {
        unmatchedRecords.push(
          record,
        )
      }

      continue
    }

    matches.push({
      requirement:
        candidate.requirement,
      area:
        candidate.area,
      record,
    })
  }

  return {
    matches,
    unmatchedRecords,
  }
}
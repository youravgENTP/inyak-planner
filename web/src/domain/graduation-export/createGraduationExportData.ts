import type {
  AuthUser,
} from '../auth/api'
import type {
  CourseRecord,
} from '../course-records/types'
import type {
  Curriculum,
} from '../curriculum/types'
import type {
  GeneralEducation,
  GeneralEducationCategory,
} from '../general-education/types'
import {
  createGraduationYearBoard,
} from '../graduation-progress/createSemesterBoard'
import type {
  GraduationProgress,
} from '../graduation-progress/types'
import type {
  Lecture,
} from '../lectures/types'

import type {
  GraduationExportData,
  GraduationExportGeneralEducationRequirementRow,
  GraduationExportGeneralEducationRow,
  GraduationExportMajorRow,
  GraduationExportStatus,
  GraduationExportSummaryRow,
} from './types'


function getExportStatus(
  record: CourseRecord,
): GraduationExportStatus {
  /*
   * F는 status가 completed여도
   * 졸업요건상 이수로 인정하지 않습니다.
   */
  if (record.letterGrade === 'F') {
    return '미이수'
  }

  if (record.status === 'completed') {
    return '이수'
  }

  if (record.status === 'substituted') {
    return '대체인정'
  }

  if (record.status === 'in_progress') {
    return '수강중'
  }

  return '계획중'
}


function createSummaryRows(
  graduationProgress: GraduationProgress,
): GraduationExportSummaryRow[] {
  const rows:
    GraduationExportSummaryRow[] = []

  const addRow = (
    title: string,
    progress: {
      completedCredits: number
      inProgressCredits: number
      plannedCredits: number
      requiredCredits: number
      remainingCredits: number
    },
  ) => {
    rows.push({
      title,

      completedCredits:
        progress.completedCredits,

      inProgressCredits:
        progress.inProgressCredits,

      plannedCredits:
        progress.plannedCredits,

      requiredCredits:
        progress.requiredCredits,

      remainingCredits:
        progress.remainingCredits,
    })
  }

  /*
   * 웹사이트의 현재 카드 순서를
   * 그대로 사용합니다.
   */
  addRow(
    '총 이수학점',
    graduationProgress.totalCredits,
  )

  addRow(
    '전공필수',
    graduationProgress.majorRequired.credits,
  )

  addRow(
    '전공선택',
    graduationProgress.majorElective.credits,
  )

  graduationProgress.generalEducation.forEach(
    (requirement) => {
      addRow(
        requirement.category,
        requirement.credits,
      )
    },
  )

  return rows
}


function createMajorRows(
  user: AuthUser,
  curriculum: Curriculum,
  courseRecords: readonly CourseRecord[],
  lectures: readonly Lecture[],
): GraduationExportMajorRow[] {
  /*
   * 기존 개인 이수현황 board의 matcher를
   * 그대로 재사용합니다.
   *
   * 전필:
   * 공식 교육과정 전체
   *
   * 전선:
   * 실제 사용자가 기록한 공식 전선 및
   * 수강편람 기반 동적 전선만 존재
   */
  const board =
    createGraduationYearBoard(
      user,
      curriculum,
      courseRecords,
      lectures,
    )

  const rows:
    GraduationExportMajorRow[] = []

  board.years.forEach((year) => {
    year.semesters.forEach((semester) => {
      /*
       * 전필은 듣지 않은 과목도
       * 반드시 Excel에 들어갑니다.
       */
      semester.requiredCourses.forEach(
        ({
          curriculumCourse,
          record,
        }) => {
          rows.push({
            grade: year.grade,
            semester: semester.semester,

            completionType: '전필',

            courseCode:
              curriculumCourse.courseCode,

            courseName:
              curriculumCourse.courseName,

            /*
             * 전필은 공식 교육과정의
             * 학점을 기준으로 합니다.
             */
            credits:
              curriculumCourse.credits,

            /*
             * 기록이 전혀 없으면 미이수.
             * F 역시 getExportStatus()에서
             * 미이수로 처리됩니다.
             */
            status:
              record === null
                ? '미이수'
                : getExportStatus(record),

            recordId:
              record?.id ?? null,
          })
        },
      )

      /*
       * 전선은 board에 실제 존재하는
       * CourseRecord만 출력합니다.
       *
       * 따라서 공식 교육과정의
       * 미선택 전선은 여기 들어오지 않습니다.
       */
      semester.electiveRecords.forEach(
        ({ record }) => {
          /*
           * F 전선은 Excel 전선 목록에서도
           * 제외합니다.
           */
          if (record.letterGrade === 'F') {
            return
          }

          rows.push({
            grade: year.grade,
            semester: semester.semester,

            completionType: '전선',

            courseCode:
              record.courseCode,

            courseName:
              record.courseName,

            /*
             * 전선은 사용자가 실제 저장한
             * CourseRecord의 학점을 사용합니다.
             */
            credits:
              record.credits,

            status:
              getExportStatus(record),

            recordId:
              record.id,
          })
        },
      )
    })
  })

  return rows
}


function createGeneralEducationLookups(
  generalEducation: GeneralEducation,
) {
  const requirementCategoryMap =
    new Map<
      number,
      GeneralEducationCategory
    >()

  const areaNameMap =
    new Map<number, string>()

  generalEducation.requirements.forEach(
    (requirement) => {
      requirementCategoryMap.set(
        requirement.id,
        requirement.category,
      )

      requirement.areas.forEach((area) => {
        areaNameMap.set(
          area.id,
          area.areaName,
        )
      })
    },
  )

  return {
    requirementCategoryMap,
    areaNameMap,
  }
}


function createGeneralEducationRows(
  generalEducation: GeneralEducation,
  courseRecords: readonly CourseRecord[],
): GraduationExportGeneralEducationRow[] {
  const {
    requirementCategoryMap,
    areaNameMap,
  } = createGeneralEducationLookups(
    generalEducation,
  )

  return courseRecords
    .filter(
      (record) =>
        record.completionType === '교양' &&
        !record.isRetake,
    )
    .map((record) => ({
      grade:
        record.grade,

      semester:
        record.semester,

      category:
        record.generalEducationRequirementId ===
        null
          ? null
          : (
            requirementCategoryMap.get(
              record
                .generalEducationRequirementId,
            ) ?? null
          ),

      areaName:
        record.generalEducationAreaId === null
          ? null
          : (
            areaNameMap.get(
              record.generalEducationAreaId,
            ) ?? null
          ),

      courseCode:
        record.courseCode,

      /*
       * 교양은 별도의 과목 catalog가 없으므로
       * 사용자가 입력한 과목명을 그대로
       * 사용합니다.
       */
      courseName:
        record.courseName,

      credits:
        record.credits,

      status:
        getExportStatus(record),

      recordId:
        record.id,
    }))
}


function createUnfulfilledGeneralEducationRows(
  graduationProgress: GraduationProgress,
): GraduationExportGeneralEducationRequirementRow[] {
  const rows:
    GraduationExportGeneralEducationRequirementRow[] =
      []

  graduationProgress.generalEducation.forEach(
    (requirement) => {
      /*
       * 필수 영역 중 아직 충족하지 않은
       * 영역만 미이수로 표시합니다.
       */
      requirement.areas.forEach((area) => {
        if (
          !area.isRequired ||
          area.isSatisfied
        ) {
          return
        }

        /*
         * minimumCredits가 null인 필수 영역은
         * 현재 구조상 특정 학점 합계를
         * 표현할 수 없으므로 별도 학점 행을
         * 만들지 않습니다.
         */
        if (area.minimumCredits === null) {
          return
        }

        rows.push({
          category:
            requirement.category,

          requirementName:
            area.areaName,

          completedValue:
            area.completedCredits,

          requiredValue:
            area.minimumCredits,

          unit: '학점',

          status: '미이수',
        })
      })

      /*
       * 균형교양처럼
       * "최소 N개 영역 이수" 조건이
       * 부족한 경우 별도 요건 행을 만듭니다.
       *
       * 특정 영역 하나를 임의로
       * 미이수 처리하지 않습니다.
       */
      if (
        requirement.minimumAreaCount !== null &&
        requirement.remainingAreaCount !== null &&
        requirement.remainingAreaCount > 0
      ) {
        rows.push({
          category:
            requirement.category,

          requirementName:
            '이수 영역 수',

          completedValue:
            requirement.completedAreaCount,

          requiredValue:
            requirement.minimumAreaCount,

          unit:
            '개 영역',

          status:
            '미이수',
        })
      }
    },
  )

  return rows
}


export function createGraduationExportData(
  user: AuthUser,
  curriculum: Curriculum,
  generalEducation: GeneralEducation,
  courseRecords: readonly CourseRecord[],
  lectures: readonly Lecture[],
  graduationProgress: GraduationProgress,
): GraduationExportData {
  return {
    summary:
      createSummaryRows(
        graduationProgress,
      ),

    major:
      createMajorRows(
        user,
        curriculum,
        courseRecords,
        lectures,
      ),

    generalEducation:
      createGeneralEducationRows(
        generalEducation,
        courseRecords,
      ),

    unfulfilledGeneralEducationRequirements:
      createUnfulfilledGeneralEducationRows(
        graduationProgress,
      ),
  }
}
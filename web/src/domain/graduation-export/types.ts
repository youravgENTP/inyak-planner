import type {
  GeneralEducationCategory,
} from '../general-education/types'


export type GraduationExportStatus =
  | '이수'
  | '대체인정'
  | '수강중'
  | '계획중'
  | '미이수'


export interface GraduationExportSummaryRow {
  title: string

  completedCredits: number
  inProgressCredits: number
  plannedCredits: number

  requiredCredits: number
  remainingCredits: number
}


export interface GraduationExportMajorRow {
  grade: number
  semester: number

  completionType:
    | '전필'
    | '전선'

  courseCode: string | null
  courseName: string
  credits: number | null

  status: GraduationExportStatus

  /*
   * null이면 아직 CourseRecord가 없는
   * 공식 전필 과목입니다.
   */
  recordId: string | null
}


export interface GraduationExportGeneralEducationRow {
  grade: number | null
  semester: number | null

  category:
    GeneralEducationCategory | null

  areaName: string | null

  courseCode: string | null
  courseName: string
  credits: number

  status: GraduationExportStatus

  /*
   * null이면 실제 CourseRecord가 아니라
   * 교양 필수영역의 미이수 행입니다.
   */
  recordId: string | null
}


export interface GraduationExportData {
  summary:
    GraduationExportSummaryRow[]

  major:
    GraduationExportMajorRow[]

  generalEducation:
    GraduationExportGeneralEducationRow[]

}
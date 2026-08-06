export type CourseCompletionType =
  | '전필'
  | '전선'
  | '교양'
  | '기타'

export type CourseRecordStatus =
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'substituted'

export interface CourseRecord {
  id: string
  userId: string
  curriculumCourseId: number | null
  lectureId: number | null
  generalEducationRequirementId:
    number | null
  generalEducationAreaId:
    number | null
  academicYear: number | null
  grade: number | null
  semester: number | null
  courseName: string
  courseCode: string | null
  completionType: CourseCompletionType
  credits: number
  status: CourseRecordStatus
  letterGrade: string | null
  isRetake: boolean
  note: string | null
  createdAt: string
  updatedAt: string
}

export interface CourseRecordInput {
  curriculumCourseId: number | null
  lectureId: number | null
  generalEducationRequirementId:
    number | null
  generalEducationAreaId:
    number | null
  academicYear: number | null
  grade?: number | null
  semester: number | null
  courseName: string
  courseCode: string | null
  completionType: CourseCompletionType
  credits: number
  status: CourseRecordStatus
  letterGrade: string | null
  isRetake: boolean
  note: string | null
}
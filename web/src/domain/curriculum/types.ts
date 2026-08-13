export type CurriculumCompletionType =
  | '전필'
  | '전선'

export type CurriculumChangeType =
  | '1:1'
  | '1:N'
  | 'N:1'
  | 'N:M'

export type CurriculumChangeRole =
  | 'current'
  | 'legacy'

export interface CurriculumCourse {
  id: number
  entryYear: number
  grade: number
  semester: number
  courseName: string
  courseCode: string | null
  completionType:
    CurriculumCompletionType
  credits: number | null
  notes: string | null
  changeGroup: string | null
  changeType:
    CurriculumChangeType | null
  changeRole:
    CurriculumChangeRole
  changeEffectiveYear:
    number | null
  changeNote: string | null
}

export interface CurriculumCourseApiItem {
  id: number
  entry_year: number
  grade: number
  semester: number
  course_name: string
  course_code: string | null
  completion_type:
    CurriculumCompletionType
  credits: number | null
  notes: string | null
  change_group: string | null
  change_type:
    CurriculumChangeType | null
  change_role:
    CurriculumChangeRole
  change_effective_year:
    number | null
  change_note: string | null
}

export interface CurriculumApiResponse {
  entry_year: number
  count: number
  courses: CurriculumCourseApiItem[]
}

export interface Curriculum {
  entryYear: number
  count: number
  courses: CurriculumCourse[]
}
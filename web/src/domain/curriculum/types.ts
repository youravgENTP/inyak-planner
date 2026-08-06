export type CurriculumCompletionType =
  | '전필'
  | '전선'

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
export interface Lecture {
  id: number
  academicYear: number
  semester: number
  track: string
  courseCode: string
  courseName: string
  section: string
  completionType: string | null
  credits: number | null
  professor: string | null
  department: string | null
  recommendedYear: number | null
  gradingMethod: string | null
  competencyType: string | null
  scheduleAndRoom: string | null
}

export interface LectureApiItem {
  id: number
  academic_year: number
  semester: number
  track: string
  course_code: string
  course_name: string
  section: string
  completion_type: string | null
  credits: number | null
  professor: string | null
  department: string | null
  recommended_year: number | null
  grading_method: string | null
  competency_type: string | null
  schedule_and_room: string | null
}

export interface LectureListApiResponse {
  count: number
  lectures: LectureApiItem[]
}
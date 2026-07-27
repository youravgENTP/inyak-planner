export type AcademicSemester = 1 | 2

// 시간표 1개의 저장 단위
export interface SavedTimetable {
  id: string
  name: string
  academicYear: number
  semester: AcademicSemester
  lectureIds: number[]
  createdAt: string
  updatedAt: string
}

// 시간표_비교페이지에서 사용하는 요약정보
export interface TimetableCreditSummary {
  totalCredits: number
  requiredCredits: number
  electiveCredits: number
  otherCredits: number
}

// 저장된 시간표를 학기별로 묶어줌
export interface TimetableCourseCountSummary {
  totalCourseCount: number
  requiredCourseCount: number
  electiveCourseCount: number
  otherCourseCount: number
}

// (새 시간표 생성, 현재 시간표 복제)
export interface TimetableComparisonSummary {
  credits: TimetableCreditSummary
  courseCounts: TimetableCourseCountSummary
}

export interface TimetableGroup {
  academicYear: number
  semester: AcademicSemester
  timetables: SavedTimetable[]
}

export interface CreateTimetableValues {
  name: string
  academicYear: number
  semester: AcademicSemester
  lectureIds?: number[]
}

export interface UpdateTimetableValues {
  name?: string
  lectureIds?: number[]
}
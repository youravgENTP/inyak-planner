import type {
  CourseRecord,
} from '../course-records/types'
import type {
  CurriculumCompletionType,
} from '../curriculum/types'
import type {
  GeneralEducationCategory,
} from '../general-education/types'

export type ProgressRecordState =
  | 'completed'
  | 'inProgress'
  | 'planned'


export interface CreditProgress {
  completedCredits: number
  inProgressCredits: number
  plannedCredits: number
  requiredCredits: number
  remainingCredits: number
  isSatisfied: boolean
}

export interface CourseCountProgress {
  completedCourseCount: number
  inProgressCourseCount: number
  plannedCourseCount: number
  requiredCourseCount: number
  remainingCourseCount: number
  isSatisfied: boolean
}

export interface MajorCompletionProgress {
  completionType:
    CurriculumCompletionType
  credits: CreditProgress
  courses: CourseCountProgress | null
}

export interface GeneralEducationAreaProgress {
  requirementId: number
  areaId: number
  category:
    GeneralEducationCategory
  areaName: string
  minimumCredits: number | null
  isRequired: boolean
  completedCredits: number
  inProgressCredits: number
  plannedCredits: number
  remainingCredits: number | null
  hasCompletedRecord: boolean
  isSatisfied: boolean
}

export interface GeneralEducationRequirementProgress {
  requirementId: number
  category:
    GeneralEducationCategory
  credits: CreditProgress
  minimumAreaCount: number | null
  completedAreaCount: number
  remainingAreaCount: number | null
  areasAreSatisfied: boolean
  isSatisfied: boolean
  areas:
    GeneralEducationAreaProgress[]
}

export interface GraduationProgress {
  totalCredits: CreditProgress
  majorRequired:
    MajorCompletionProgress
  majorElective:
    MajorCompletionProgress
  generalEducation:
    GeneralEducationRequirementProgress[]
  substitutedRecords:
    CourseRecord[]
}
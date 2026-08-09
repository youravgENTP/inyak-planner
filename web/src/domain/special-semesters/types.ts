export type SpecialSemesterTerm =
  | 'summer'
  | 'winter'


export interface SpecialSemester {
  id: string
  userId: string

  grade: number
  semester: number
  term: SpecialSemesterTerm

  createdAt: string
  updatedAt: string
}


export interface SpecialSemesterInput {
  grade: number
  term: SpecialSemesterTerm
}
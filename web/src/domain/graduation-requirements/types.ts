export interface GraduationRequirementsApiResponse {
  entry_year: number
  major_required_credits: number
  major_elective_credits: number
  notes: string | null
}


export interface GraduationRequirements {
  entryYear: number
  majorRequiredCredits: number
  majorElectiveCredits: number
  notes: string | null
}
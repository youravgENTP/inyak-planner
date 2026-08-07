export type GeneralEducationCategory =
  | '기초교양'
  | '균형교양'


export interface GeneralEducationArea {
  id: number
  areaName: string
  minimumCredits: number | null
  isRequired: boolean
  notes: string | null
  displayOrder: number
}


export interface GeneralEducationRequirement {
  id: number
  entryYear: number
  category: GeneralEducationCategory
  minimumCredits: number
  minimumAreaCount: number | null
  notes: string | null
  displayOrder: number
  areas: GeneralEducationArea[]
}


export interface GeneralEducationAreaApiItem {
  id: number
  area_name: string
  minimum_credits: number | null
  is_required: boolean
  notes: string | null
  display_order: number
}


export interface GeneralEducationRequirementApiItem {
  id: number
  entry_year: number
  category: GeneralEducationCategory
  minimum_credits: number
  minimum_area_count: number | null
  notes: string | null
  display_order: number
  areas: GeneralEducationAreaApiItem[]
}


export interface GeneralEducationApiResponse {
  entry_year: number
  count: number
  requirements:
    GeneralEducationRequirementApiItem[]
}


export interface GeneralEducation {
  entryYear: number
  count: number
  requirements:
    GeneralEducationRequirement[]
}
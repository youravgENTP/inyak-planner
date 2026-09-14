export type CurriculumDeliveryType =
  | 'vacation_practicum'
  | 'flexible_practicum'

export type CurriculumActivityPeriod =
  | '5-summer'
  | '5-winter'
  | '6-1'
  | '6-2'

export interface CurriculumDeliveryRule {
  entryYear: number
  courseCode: string
  deliveryType: CurriculumDeliveryType
  defaultActivityPeriod:
    CurriculumActivityPeriod
  allowedActivityPeriods:
    CurriculumActivityPeriod[]
  consumesRegularCreditLimit: boolean
  notes: string | null
}

export interface CurriculumDeliveryRuleApiItem {
  entry_year: number
  course_code: string
  delivery_type: CurriculumDeliveryType
  default_activity_period:
    CurriculumActivityPeriod
  allowed_activity_periods:
    CurriculumActivityPeriod[]
  consumes_regular_credit_limit: boolean
  notes: string | null
}

export interface CurriculumDeliveryRulesApiResponse {
  entry_year: number
  count: number
  rules: CurriculumDeliveryRuleApiItem[]
}

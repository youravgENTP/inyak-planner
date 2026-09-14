import type {
  CurriculumDeliveryRule,
  CurriculumDeliveryRulesApiResponse,
} from './types'


const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  'http://127.0.0.1:8000'


export async function fetchCurriculumDeliveryRules(
  entryYear: number,
): Promise<CurriculumDeliveryRule[]> {
  const parameters = new URLSearchParams({
    entry_year: String(entryYear),
  })

  const response = await fetch(
    `${API_BASE_URL}/api/curriculum-delivery-rules?` +
      parameters.toString(),
  )

  if (!response.ok) {
    throw new Error(
      '실습 이수 시기 정책을 불러오지 못했습니다.',
    )
  }

  const data =
    (await response.json()) as
      CurriculumDeliveryRulesApiResponse

  return data.rules.map((rule) => ({
    entryYear: rule.entry_year,
    courseCode: rule.course_code,
    deliveryType: rule.delivery_type,
    defaultActivityPeriod:
      rule.default_activity_period,
    allowedActivityPeriods:
      rule.allowed_activity_periods,
    consumesRegularCreditLimit:
      rule.consumes_regular_credit_limit,
    notes: rule.notes,
  }))
}

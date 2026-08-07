import type {
  GeneralEducation,
  GeneralEducationApiResponse,
  GeneralEducationArea,
  GeneralEducationAreaApiItem,
  GeneralEducationRequirement,
  GeneralEducationRequirementApiItem,
} from './types'

const API_BASE_URL =
  'http://127.0.0.1:8000'


function mapGeneralEducationAreaApiItem(
  item: GeneralEducationAreaApiItem,
): GeneralEducationArea {
  return {
    id: item.id,
    areaName: item.area_name,
    minimumCredits:
      item.minimum_credits,
    isRequired: item.is_required,
    notes: item.notes,
    displayOrder: item.display_order,

    courseMappings:
      item.course_mappings.map(
        (mapping) => ({
          id: mapping.id,
          courseCode:
            mapping.course_code,
          courseName:
            mapping.course_name,
          notes:
            mapping.notes,
        }),
      ),
  }
}
  

function mapGeneralEducationRequirementApiItem(
  item:
    GeneralEducationRequirementApiItem,
): GeneralEducationRequirement {
  return {
    id: item.id,
    entryYear: item.entry_year,
    category: item.category,
    minimumCredits:
      item.minimum_credits,
    minimumAreaCount:
      item.minimum_area_count,
    notes: item.notes,
    displayOrder: item.display_order,
    areas: item.areas.map(
      mapGeneralEducationAreaApiItem,
    ),
  }
}

async function getApiErrorMessage(
  response: Response,
  fallbackMessage: string,
): Promise<string> {
  try {
    const data = (
      await response.json()
    ) as {
      detail?: unknown
    }

    if (
      typeof data.detail === 'string' &&
      data.detail.trim().length > 0
    ) {
      return data.detail
    }
  } catch {
    // JSON 오류 응답이 아니면
    // 기본 메시지를 사용합니다.
  }

  return (
    `${fallbackMessage} ` +
    `상태 코드: ${response.status}`
  )
}

export async function fetchGeneralEducation(
  entryYear: number,
): Promise<GeneralEducation> {
  const searchParameters =
    new URLSearchParams({
      entry_year: String(entryYear),
    })

  const response = await fetch(
    `${API_BASE_URL}/api/general-education?` +
      searchParameters.toString(),
  )

  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(
        response,
        '교양 졸업요건을 불러오지 못했습니다.',
      ),
    )
  }

  const data = (
    await response.json()
  ) as GeneralEducationApiResponse

  return {
    entryYear: data.entry_year,
    count: data.count,
    requirements:
      data.requirements.map(
        mapGeneralEducationRequirementApiItem,
      ),
  }
}
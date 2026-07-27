import type {
  DevicePresetCategory,
  DeviceResolutionPreset,
  ResolutionPresetSource,
} from './types'

export interface ResolutionPresetFilter {
  source?: ResolutionPresetSource
  category?: DevicePresetCategory
  searchQuery?: string
}

const normalizeSearchText = (value: string): string =>
  value.trim().toLowerCase()

const matchesSearchQuery = (
  preset: DeviceResolutionPreset,
  normalizedQuery: string,
): boolean => {
  if (normalizedQuery === '') {
    return true
  }

  const searchableValues = [
    preset.label,
    `${preset.width}x${preset.height}`,
    `${preset.width} × ${preset.height}`,
    preset.note ?? '',
    ...preset.models,
  ]

  return searchableValues.some((value) =>
    normalizeSearchText(value).includes(normalizedQuery),
  )
}

export const getPresetsBySource = (
  presets: readonly DeviceResolutionPreset[],
  source: ResolutionPresetSource,
): readonly DeviceResolutionPreset[] =>
  presets.filter((preset) => preset.source === source)

export const getPresetsByCategory = (
  presets: readonly DeviceResolutionPreset[],
  category: DevicePresetCategory,
): readonly DeviceResolutionPreset[] =>
  presets.filter((preset) => preset.category === category)

export const findPresetById = (
  presets: readonly DeviceResolutionPreset[],
  presetId: string,
): DeviceResolutionPreset | undefined =>
  presets.find((preset) => preset.id === presetId)

export const searchResolutionPresets = (
  presets: readonly DeviceResolutionPreset[],
  searchQuery: string,
): readonly DeviceResolutionPreset[] => {
  const normalizedQuery = normalizeSearchText(searchQuery)

  return presets.filter((preset) =>
    matchesSearchQuery(preset, normalizedQuery),
  )
}

export const filterResolutionPresets = (
  presets: readonly DeviceResolutionPreset[],
  filter: ResolutionPresetFilter,
): readonly DeviceResolutionPreset[] => {
  const normalizedQuery = normalizeSearchText(
    filter.searchQuery ?? '',
  )

  return presets.filter((preset) => {
    if (
      filter.source !== undefined &&
      preset.source !== filter.source
    ) {
      return false
    }

    if (
      filter.category !== undefined &&
      preset.category !== filter.category
    ) {
      return false
    }

    return matchesSearchQuery(preset, normalizedQuery)
  })
}
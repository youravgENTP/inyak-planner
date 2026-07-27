export type TimetableDownloadMode =
  | 'custom'
  | 'preset'

export type ResolutionPresetSource =
  | 'apple'
  | 'samsung'
  | 'generic'

export type DevicePresetCategory =
  | 'iphone'
  | 'ipad'
  | 'macbook'
  | 'imac'
  | 'galaxy-phone'
  | 'galaxy-tab'
  | 'galaxy-book'
  | 'samsung-display'
  | 'generic-display'

export type PresetOrientation =
  | 'portrait'
  | 'landscape'

export type TimetableRenderLayout =
  | 'standard'
  | 'mobile-portrait'

export interface ImageDimensions {
  width: number
  height: number
}

export interface CustomSizeValues {
  width: string
  height: string
}

export interface DeviceResolutionPreset {
  id: string
  source: ResolutionPresetSource
  category: DevicePresetCategory
  label: string
  width: number
  height: number
  orientation: PresetOrientation
  diagonalInches?: number
  models: readonly string[]
  note?: string
}

export type DimensionValidationResult =
  | {
      isValid: true
      dimensions: ImageDimensions
    }
  | {
      isValid: false
      errorMessage: string
    }

export interface DownloadTimetablePngOptions {
  element: HTMLElement
  dimensions: ImageDimensions
  layout?: TimetableRenderLayout
  filename?: string
  backgroundColor?: string
}
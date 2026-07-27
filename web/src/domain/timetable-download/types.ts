export type TimetableDownloadMode =
  | 'custom'
  | 'device'

export type DeviceManufacturer =
  | 'Apple'
  | 'Samsung'

export type MobileDeviceType =
  | 'smartphone'
  | 'tablet'

export interface ImageDimensions {
  width: number
  height: number
}

export interface MobileDevicePreset {
  id: string
  manufacturer: DeviceManufacturer
  type: MobileDeviceType
  model: string
  dimensions: ImageDimensions
}

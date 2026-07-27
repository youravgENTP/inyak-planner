import type { DeviceResolutionPreset } from '../../types'
import { IMAC_RESOLUTION_PRESETS } from './imacPresets'
import { IPAD_RESOLUTION_PRESETS } from './ipadPresets'
import { IPHONE_RESOLUTION_PRESETS } from './iphonePresets'
import { MACBOOK_RESOLUTION_PRESETS } from './macbookPresets'

export {
  IMAC_RESOLUTION_PRESETS,
  IPAD_RESOLUTION_PRESETS,
  IPHONE_RESOLUTION_PRESETS,
  MACBOOK_RESOLUTION_PRESETS,
}

export const APPLE_DEVICE_RESOLUTION_PRESETS = [
  ...IPHONE_RESOLUTION_PRESETS,
  ...IPAD_RESOLUTION_PRESETS,
  ...MACBOOK_RESOLUTION_PRESETS,
  ...IMAC_RESOLUTION_PRESETS,
] as const satisfies readonly DeviceResolutionPreset[]
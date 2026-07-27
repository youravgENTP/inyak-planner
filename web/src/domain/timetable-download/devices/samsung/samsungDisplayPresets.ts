import type { DeviceResolutionPreset } from '../../types'

export const SAMSUNG_DISPLAY_RESOLUTION_PRESETS = [
  {
    id: 'samsung-display-fhd-1920x1080',
    source: 'samsung',
    category: 'samsung-display',
    label: 'Samsung 모니터 Full HD — 1920 × 1080',
    width: 1920,
    height: 1080,
    orientation: 'landscape',
    models: [
      'Smart Monitor M5 27형',
      'Smart Monitor M5 32형',
    ],
    note:
      'Samsung Smart Monitor M5 등에서 사용하는 표준 16:9 Full HD 해상도입니다.',
  },
  {
    id: 'samsung-display-qhd-2560x1440',
    source: 'samsung',
    category: 'samsung-display',
    label: 'Samsung 모니터 QHD — 2560 × 1440',
    width: 2560,
    height: 1440,
    orientation: 'landscape',
    models: [
      'Samsung QHD 모니터',
      'Odyssey QHD 게이밍 모니터',
      'ViewFinity QHD 모니터',
    ],
    note:
      '일반 업무용 및 게이밍 모니터에서 널리 사용하는 16:9 QHD 해상도입니다.',
  },
  {
    id: 'samsung-display-uhd-3840x2160',
    source: 'samsung',
    category: 'samsung-display',
    label: 'Samsung 모니터 4K UHD — 3840 × 2160',
    width: 3840,
    height: 2160,
    orientation: 'landscape',
    models: [
      'Smart Monitor M9 32형',
      'Smart Monitor M8 32형',
      'Smart Monitor M7 32형',
      'Smart Monitor M7 43형',
      'ViewFinity S8 27형',
      'ViewFinity S8 32형',
    ],
    note:
      'Smart Monitor M7·M8·M9 및 ViewFinity S8 등에서 사용하는 표준 16:9 4K UHD 해상도입니다.',
  },
  {
    id: 'samsung-viewfinity-s9-5k-5120x2880',
    source: 'samsung',
    category: 'samsung-display',
    label: 'ViewFinity S9 27형 5K — 5120 × 2880',
    width: 5120,
    height: 2880,
    orientation: 'landscape',
    diagonalInches: 27,
    models: [
      'ViewFinity S9 S90PC',
    ],
    note:
      'ViewFinity S9 27형의 16:9 5K 해상도입니다.',
  },
  {
    id: 'samsung-viewfinity-wuhd-5120x2160',
    source: 'samsung',
    category: 'samsung-display',
    label: 'ViewFinity 울트라와이드 5K — 5120 × 2160',
    width: 5120,
    height: 2160,
    orientation: 'landscape',
    models: [
      'ViewFinity S8 S85TH',
    ],
    note:
      'ViewFinity S8 울트라와이드 모델에서 사용하는 21:9 WUHD 해상도입니다.',
  },
  {
    id: 'samsung-display-dqhd-5120x1440',
    source: 'samsung',
    category: 'samsung-display',
    label: 'Samsung 49형 Dual QHD — 5120 × 1440',
    width: 5120,
    height: 1440,
    orientation: 'landscape',
    diagonalInches: 49,
    models: [
      'Odyssey OLED G9 49형',
      'ViewFinity S9 S95UC 49형',
    ],
    note:
      'QHD 모니터 두 대를 나란히 배치한 것과 같은 32:9 Dual QHD 해상도입니다.',
  },
  {
    id: 'samsung-odyssey-neo-g9-57-duhd-7680x2160',
    source: 'samsung',
    category: 'samsung-display',
    label: 'Odyssey Neo G9 57형 Dual UHD — 7680 × 2160',
    width: 7680,
    height: 2160,
    orientation: 'landscape',
    diagonalInches: 57,
    models: [
      'Odyssey Neo G9 G95NC 57형',
    ],
    note:
      '4K UHD 모니터 두 대를 나란히 배치한 것과 같은 32:9 Dual UHD 해상도입니다.',
  },
] as const satisfies readonly DeviceResolutionPreset[]
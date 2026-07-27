import type { DeviceResolutionPreset } from '../../types'

export const IPAD_RESOLUTION_PRESETS = [
  {
    id: 'ipad-mini-8-3-2266x1488',
    source: 'apple',
    category: 'ipad',
    label: 'iPad mini 8.3형 — 2266 × 1488',
    width: 2266,
    height: 1488,
    orientation: 'landscape',
    diagonalInches: 8.3,
    models: [
      'iPad mini (A17 Pro)',
      'iPad mini (6th generation)',
    ],
    note:
      'iPad mini의 기본 디스플레이 해상도를 가로 방향으로 저장한 프리셋입니다.',
  },
  {
    id: 'ipad-11-2360x1640',
    source: 'apple',
    category: 'ipad',
    label: 'iPad 11형 — 2360 × 1640',
    width: 2360,
    height: 1640,
    orientation: 'landscape',
    diagonalInches: 11,
    models: [
      'iPad (A16)',
      'iPad (10th generation)',
      'iPad Air 11-inch (M4)',
      'iPad Air 11-inch (M3)',
      'iPad Air 11-inch (M2)',
    ],
    note:
      '일반 iPad와 11형 iPad Air가 동일한 물리적 픽셀 해상도를 사용합니다.',
  },
  {
    id: 'ipad-pro-11-2420x1668',
    source: 'apple',
    category: 'ipad',
    label: 'iPad Pro 11형 — 2420 × 1668',
    width: 2420,
    height: 1668,
    orientation: 'landscape',
    diagonalInches: 11,
    models: [
      'iPad Pro 11-inch (M5)',
      'iPad Pro 11-inch (M4)',
    ],
  },
  {
    id: 'ipad-air-13-2732x2048',
    source: 'apple',
    category: 'ipad',
    label: 'iPad Air 13형 — 2732 × 2048',
    width: 2732,
    height: 2048,
    orientation: 'landscape',
    diagonalInches: 13,
    models: [
      'iPad Air 13-inch (M4)',
      'iPad Air 13-inch (M3)',
      'iPad Air 13-inch (M2)',
      'iPad Pro 12.9-inch (6th generation)',
      'iPad Pro 12.9-inch (5th generation)',
    ],
    note:
      '13형 iPad Air와 일부 12.9형 iPad Pro 세대가 동일한 해상도를 사용합니다.',
  },
  {
    id: 'ipad-pro-13-2752x2064',
    source: 'apple',
    category: 'ipad',
    label: 'iPad Pro 13형 — 2752 × 2064',
    width: 2752,
    height: 2064,
    orientation: 'landscape',
    diagonalInches: 13,
    models: [
      'iPad Pro 13-inch (M5)',
      'iPad Pro 13-inch (M4)',
    ],
  },
] as const satisfies readonly DeviceResolutionPreset[]
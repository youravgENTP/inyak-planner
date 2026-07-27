import type { DeviceResolutionPreset } from '../../types'

export const IMAC_RESOLUTION_PRESETS = [
  {
    id: 'imac-24-4480x2520',
    source: 'apple',
    category: 'imac',
    label: 'iMac 24형 4.5K — 4480 × 2520',
    width: 4480,
    height: 2520,
    orientation: 'landscape',
    diagonalInches: 23.5,
    models: [
      'iMac 24-inch',
      'iMac 24-inch (M4)',
      'iMac 24-inch (M3, 2023)',
      'iMac 24-inch (M1, 2021)',
    ],
    note:
      '칩, 메모리, 저장 용량, 색상, 포트 구성 및 Nano-texture 글래스 선택과 관계없이 동일한 4.5K 패널 해상도를 사용합니다.',
  },
] as const satisfies readonly DeviceResolutionPreset[]
import type { DeviceResolutionPreset } from '../../types'

export const MACBOOK_RESOLUTION_PRESETS = [
  {
    id: 'macbook-air-13-2560x1664',
    source: 'apple',
    category: 'macbook',
    label: 'MacBook Air 13형 — 2560 × 1664',
    width: 2560,
    height: 1664,
    orientation: 'landscape',
    diagonalInches: 13.6,
    models: [
      'MacBook Air 13-inch',
    ],
    note:
      '칩, 메모리, 저장 용량 및 색상 구성과 관계없이 동일한 내장 디스플레이 해상도를 사용합니다.',
  },
  {
    id: 'macbook-air-15-2880x1864',
    source: 'apple',
    category: 'macbook',
    label: 'MacBook Air 15형 — 2880 × 1864',
    width: 2880,
    height: 1864,
    orientation: 'landscape',
    diagonalInches: 15.3,
    models: [
      'MacBook Air 15-inch',
    ],
    note:
      '칩, 메모리, 저장 용량 및 색상 구성과 관계없이 동일한 내장 디스플레이 해상도를 사용합니다.',
  },
  {
    id: 'macbook-pro-14-3024x1964',
    source: 'apple',
    category: 'macbook',
    label: 'MacBook Pro 14형 — 3024 × 1964',
    width: 3024,
    height: 1964,
    orientation: 'landscape',
    diagonalInches: 14.2,
    models: [
      'MacBook Pro 14-inch',
    ],
    note:
      '칩 구성과 관계없이 동일한 내장 디스플레이 해상도를 사용합니다.',
  },
  {
    id: 'macbook-pro-16-3456x2234',
    source: 'apple',
    category: 'macbook',
    label: 'MacBook Pro 16형 — 3456 × 2234',
    width: 3456,
    height: 2234,
    orientation: 'landscape',
    diagonalInches: 16.2,
    models: [
      'MacBook Pro 16-inch',
    ],
    note:
      '칩 구성과 관계없이 동일한 내장 디스플레이 해상도를 사용합니다.',
  },
] as const satisfies readonly DeviceResolutionPreset[]
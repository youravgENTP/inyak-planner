import type { DeviceResolutionPreset } from '../../types'

export const GALAXY_BOOK_RESOLUTION_PRESETS = [
  {
    id: 'galaxy-book-fhd-15-6-1920x1080',
    source: 'samsung',
    category: 'galaxy-book',
    label: 'Galaxy Book 15.6형 FHD — 1920 × 1080',
    width: 1920,
    height: 1080,
    orientation: 'landscape',
    diagonalInches: 15.6,
    models: [
      'Galaxy Book4 15.6형',
      'Galaxy Book4 15.6형 외장 그래픽 모델',
      'Galaxy Book4 15.6형 OS 미포함 모델',
    ],
    note:
      '일반형 Galaxy Book4 15.6형 모델에서 사용하는 16:9 FHD 해상도입니다.',
  },
  {
    id: 'galaxy-book-3k-14-2880x1800',
    source: 'samsung',
    category: 'galaxy-book',
    label: 'Galaxy Book 14형 3K — 2880 × 1800',
    width: 2880,
    height: 1800,
    orientation: 'landscape',
    diagonalInches: 14,
    models: [
      'Galaxy Book5 Pro 14형',
      'Galaxy Book4 Pro 14형',
      'Galaxy Book4 Edge 14형',
    ],
    note:
      '14형 Pro 및 Edge 계열에서 사용하는 16:10 WQXGA+ 해상도입니다.',
  },
  {
    id: 'galaxy-book-3k-16-2880x1800',
    source: 'samsung',
    category: 'galaxy-book',
    label: 'Galaxy Book 16형 3K — 2880 × 1800',
    width: 2880,
    height: 1800,
    orientation: 'landscape',
    diagonalInches: 16,
    models: [
      'Galaxy Book5 Pro 16형',
      'Galaxy Book4 Pro 16형',
      'Galaxy Book4 Pro 360 16형',
      'Galaxy Book4 Edge 16형',
    ],
    note:
      '16형 Pro·Pro 360·Edge 계열에서 사용하는 16:10 WQXGA+ 해상도입니다.',
  },
] as const satisfies readonly DeviceResolutionPreset[]
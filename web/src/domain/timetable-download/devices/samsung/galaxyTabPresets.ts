import type { DeviceResolutionPreset } from '../../types'

export const GALAXY_TAB_RESOLUTION_PRESETS = [
  {
    id: 'galaxy-tab-a9-plus-11-1920x1200',
    source: 'samsung',
    category: 'galaxy-tab',
    label: 'Galaxy Tab A9+ 11형 — 1920 × 1200',
    width: 1920,
    height: 1200,
    orientation: 'landscape',
    diagonalInches: 11,
    models: [
      'Galaxy Tab A9+',
    ],
    note:
      'Galaxy Tab A9+의 기본 디스플레이 해상도를 가로 방향으로 저장한 프리셋입니다.',
  },
  {
    id: 'galaxy-tab-fe-10-9-2304x1440',
    source: 'samsung',
    category: 'galaxy-tab',
    label: 'Galaxy Tab FE 10.9형 — 2304 × 1440',
    width: 2304,
    height: 1440,
    orientation: 'landscape',
    diagonalInches: 10.9,
    models: [
      'Galaxy Tab S10 FE',
      'Galaxy Tab S9 FE',
    ],
    note:
      'Galaxy Tab S10 FE와 S9 FE가 동일한 2304 × 1440 해상도를 사용합니다.',
  },
  {
    id: 'galaxy-tab-s10-plus-12-4-2800x1752',
    source: 'samsung',
    category: 'galaxy-tab',
    label: 'Galaxy Tab S10+ 12.4형 — 2800 × 1752',
    width: 2800,
    height: 1752,
    orientation: 'landscape',
    diagonalInches: 12.4,
    models: [
      'Galaxy Tab S10+',
    ],
    note:
      'Galaxy Tab S10+의 기본 디스플레이 해상도를 가로 방향으로 저장한 프리셋입니다.',
  },
  {
    id: 'galaxy-tab-s10-fe-plus-13-1-2880x1800',
    source: 'samsung',
    category: 'galaxy-tab',
    label: 'Galaxy Tab S10 FE+ 13.1형 — 2880 × 1800',
    width: 2880,
    height: 1800,
    orientation: 'landscape',
    diagonalInches: 13.1,
    models: [
      'Galaxy Tab S10 FE+',
    ],
    note:
      'Galaxy Tab S10 FE+의 기본 디스플레이 해상도를 가로 방향으로 저장한 프리셋입니다.',
  },
  {
    id: 'galaxy-tab-s10-ultra-14-6-2960x1848',
    source: 'samsung',
    category: 'galaxy-tab',
    label: 'Galaxy Tab S10 Ultra 14.6형 — 2960 × 1848',
    width: 2960,
    height: 1848,
    orientation: 'landscape',
    diagonalInches: 14.6,
    models: [
      'Galaxy Tab S10 Ultra',
    ],
    note:
      'Galaxy Tab S10 Ultra의 기본 디스플레이 해상도를 가로 방향으로 저장한 프리셋입니다.',
  },
] as const satisfies readonly DeviceResolutionPreset[]
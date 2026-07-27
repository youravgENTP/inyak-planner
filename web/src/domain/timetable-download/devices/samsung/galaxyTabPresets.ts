import type { DeviceResolutionPreset } from '../../types'

export const GALAXY_TAB_RESOLUTION_PRESETS = [
  {
    id: 'galaxy-tab-a9-plus-11-1200x1920',
    source: 'samsung',
    category: 'galaxy-tab',
    label: 'Galaxy Tab A9+ 11형 — 1200 × 1920',
    width: 1200,
    height: 1920,
    orientation: 'portrait',
    diagonalInches: 11,
    models: [
      'Galaxy Tab A9+',
    ],
    note:
      'Galaxy Tab A9+의 1920 × 1200 디스플레이를 세로 방향으로 저장한 프리셋입니다.',
  },
  {
    id: 'galaxy-tab-fe-10-9-1440x2304',
    source: 'samsung',
    category: 'galaxy-tab',
    label: 'Galaxy Tab FE 10.9형 — 1440 × 2304',
    width: 1440,
    height: 2304,
    orientation: 'portrait',
    diagonalInches: 10.9,
    models: [
      'Galaxy Tab S10 FE',
      'Galaxy Tab S9 FE',
    ],
    note:
      'Galaxy Tab S10 FE와 S9 FE가 동일한 2304 × 1440 해상도를 사용합니다.',
  },
  {
    id: 'galaxy-tab-s10-plus-12-4-1752x2800',
    source: 'samsung',
    category: 'galaxy-tab',
    label: 'Galaxy Tab S10+ 12.4형 — 1752 × 2800',
    width: 1752,
    height: 2800,
    orientation: 'portrait',
    diagonalInches: 12.4,
    models: [
      'Galaxy Tab S10+',
    ],
    note:
      'Galaxy Tab S10+의 2800 × 1752 Dynamic AMOLED 2X 디스플레이를 세로 방향으로 저장한 프리셋입니다.',
  },
  {
    id: 'galaxy-tab-s10-fe-plus-13-1-1800x2880',
    source: 'samsung',
    category: 'galaxy-tab',
    label: 'Galaxy Tab S10 FE+ 13.1형 — 1800 × 2880',
    width: 1800,
    height: 2880,
    orientation: 'portrait',
    diagonalInches: 13.1,
    models: [
      'Galaxy Tab S10 FE+',
    ],
    note:
      'Galaxy Tab S10 FE+의 2880 × 1800 디스플레이를 세로 방향으로 저장한 프리셋입니다.',
  },
  {
    id: 'galaxy-tab-s10-ultra-14-6-1848x2960',
    source: 'samsung',
    category: 'galaxy-tab',
    label: 'Galaxy Tab S10 Ultra 14.6형 — 1848 × 2960',
    width: 1848,
    height: 2960,
    orientation: 'portrait',
    diagonalInches: 14.6,
    models: [
      'Galaxy Tab S10 Ultra',
    ],
    note:
      'Galaxy Tab S10 Ultra의 2960 × 1848 Dynamic AMOLED 2X 디스플레이를 세로 방향으로 저장한 프리셋입니다.',
  },
] as const satisfies readonly DeviceResolutionPreset[]
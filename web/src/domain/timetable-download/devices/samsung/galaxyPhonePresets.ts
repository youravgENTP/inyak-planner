import type { DeviceResolutionPreset } from '../../types'

export const GALAXY_PHONE_RESOLUTION_PRESETS = [
  {
    id: 'galaxy-phone-fhd-1080x2340',
    source: 'samsung',
    category: 'galaxy-phone',
    label: 'Galaxy 스마트폰 FHD+ — 1080 × 2340',
    width: 1080,
    height: 2340,
    orientation: 'portrait',
    models: [
      'Galaxy S26',
      'Galaxy S25',
      'Galaxy S24',
      'Galaxy S23',
      'Galaxy A56 5G',
      'Galaxy A36 5G',
      'Galaxy A26 5G',
    ],
    note:
      'Galaxy S 시리즈 기본형과 최근 Galaxy A 시리즈에서 널리 사용하는 세로형 FHD+ 해상도입니다.',
  },
  {
    id: 'galaxy-phone-qhd-1440x3120',
    source: 'samsung',
    category: 'galaxy-phone',
    label: 'Galaxy 스마트폰 QHD+ — 1440 × 3120',
    width: 1440,
    height: 3120,
    orientation: 'portrait',
    models: [
      'Galaxy S26+',
      'Galaxy S26 Ultra',
      'Galaxy S25 Ultra',
      'Galaxy S24 Ultra',
    ],
    note:
      '최근 Galaxy S Plus 및 Ultra 제품에서 사용하는 QHD+ 세로 해상도입니다.',
  },
  {
    id: 'galaxy-phone-qhd-1440x3088',
    source: 'samsung',
    category: 'galaxy-phone',
    label: 'Galaxy Ultra QHD+ — 1440 × 3088',
    width: 1440,
    height: 3088,
    orientation: 'portrait',
    models: [
      'Galaxy S23 Ultra',
      'Galaxy S22 Ultra',
    ],
    note:
      '일부 이전 세대 Galaxy S Ultra 제품의 기본 화면 해상도입니다.',
  },
  {
    id: 'galaxy-phone-fhd-1080x2400',
    source: 'samsung',
    category: 'galaxy-phone',
    label: 'Galaxy 스마트폰 FHD+ — 1080 × 2400',
    width: 1080,
    height: 2400,
    orientation: 'portrait',
    models: [
      'Galaxy S21',
      'Galaxy S21+',
      'Galaxy S21 FE',
      'Galaxy A54 5G',
      'Galaxy A53 5G',
      'Galaxy A34 5G',
    ],
    note:
      '이전 세대 Galaxy S·FE·A 시리즈에서 널리 사용된 20:9 계열 해상도입니다.',
  },
  {
    id: 'galaxy-z-flip7-main-1080x2520',
    source: 'samsung',
    category: 'galaxy-phone',
    label: 'Galaxy Z Flip7 주 화면 — 1080 × 2520',
    width: 1080,
    height: 2520,
    orientation: 'portrait',
    diagonalInches: 6.9,
    models: [
      'Galaxy Z Flip7',
    ],
    note:
      'Galaxy Z Flip7을 펼쳤을 때 사용하는 세로형 주 화면 해상도입니다.',
  },
  {
    id: 'galaxy-z-fold7-cover-1080x2520',
    source: 'samsung',
    category: 'galaxy-phone',
    label: 'Galaxy Z Fold7 커버 화면 — 1080 × 2520',
    width: 1080,
    height: 2520,
    orientation: 'portrait',
    diagonalInches: 6.5,
    models: [
      'Galaxy Z Fold7 커버 화면',
    ],
    note:
      'Galaxy Z Fold7을 접은 상태에서 사용하는 외부 커버 화면입니다.',
  },
  {
    id: 'galaxy-z-fold7-main-2184x1968',
    source: 'samsung',
    category: 'galaxy-phone',
    label: 'Galaxy Z Fold7 주 화면 — 2184 × 1968',
    width: 2184,
    height: 1968,
    orientation: 'landscape',
    diagonalInches: 8,
    models: [
      'Galaxy Z Fold7 펼친 화면',
    ],
    note:
      'Galaxy Z Fold7을 완전히 펼쳤을 때 사용하는 거의 정사각형에 가까운 주 화면입니다.',
  },
] as const satisfies readonly DeviceResolutionPreset[]
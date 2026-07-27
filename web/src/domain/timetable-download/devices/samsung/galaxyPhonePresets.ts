import type { DeviceResolutionPreset } from '../../types'

export const GALAXY_PHONE_RESOLUTION_PRESETS = [
  /*
   * =========================================================
   * Galaxy S 시리즈
   * =========================================================
   */

  {
    id: 'galaxy-s9-qhd-1440x2960',
    source: 'samsung',
    category: 'galaxy-phone',
    label: 'Galaxy S9 계열 QHD+ — 1440 × 2960',
    width: 1440,
    height: 2960,
    orientation: 'portrait',
    models: [
      'Galaxy S9',
      'Galaxy S9+',
      'Galaxy S9 Plus',
    ],
    note:
      'Galaxy S9과 S9+가 사용하는 18.5:9 계열 QHD+ 물리적 화면 해상도입니다.',
  },

  {
    id: 'galaxy-s10e-fhd-1080x2280',
    source: 'samsung',
    category: 'galaxy-phone',
    label: 'Galaxy S10e FHD+ — 1080 × 2280',
    width: 1080,
    height: 2280,
    orientation: 'portrait',
    models: [
      'Galaxy S10e',
    ],
    note:
      'Galaxy S10e의 세로형 FHD+ 물리적 화면 해상도입니다.',
  },

  {
    id: 'galaxy-s10-qhd-1440x3040',
    source: 'samsung',
    category: 'galaxy-phone',
    label: 'Galaxy S10 계열 QHD+ — 1440 × 3040',
    width: 1440,
    height: 3040,
    orientation: 'portrait',
    models: [
      'Galaxy S10',
      'Galaxy S10+',
      'Galaxy S10 Plus',
      'Galaxy S10 5G',
    ],
    note:
      'Galaxy S10, S10+ 및 S10 5G가 지원하는 QHD+ 물리적 화면 해상도입니다.',
  },

  {
    id: 'galaxy-s20-qhd-1440x3200',
    source: 'samsung',
    category: 'galaxy-phone',
    label: 'Galaxy S20·S21 Ultra QHD+ — 1440 × 3200',
    width: 1440,
    height: 3200,
    orientation: 'portrait',
    models: [
      'Galaxy S20',
      'Galaxy S20+',
      'Galaxy S20 Plus',
      'Galaxy S20 Ultra',
      'Galaxy S21 Ultra',
    ],
    note:
      'Galaxy S20 시리즈와 Galaxy S21 Ultra가 지원하는 20:9 계열 QHD+ 물리적 화면 해상도입니다.',
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
      'Galaxy S10 Lite',

      'Galaxy S20 FE',
      'Galaxy S20 FE 5G',

      'Galaxy S21',
      'Galaxy S21+',
      'Galaxy S21 Plus',
      'Galaxy S21 FE',

      'Galaxy A54 5G',
      'Galaxy A53 5G',
      'Galaxy A34 5G',
    ],
    note:
      '일부 Galaxy S·FE·A 시리즈에서 사용하는 20:9 FHD+ 물리적 화면 해상도입니다.',
  },

  {
    id: 'galaxy-phone-fhd-1080x2340',
    source: 'samsung',
    category: 'galaxy-phone',
    label: 'Galaxy 스마트폰 FHD+ — 1080 × 2340',
    width: 1080,
    height: 2340,
    orientation: 'portrait',
    models: [
      'Galaxy S22',
      'Galaxy S22+',
      'Galaxy S22 Plus',

      'Galaxy S23',
      'Galaxy S23+',
      'Galaxy S23 Plus',
      'Galaxy S23 FE',

      'Galaxy S24',
      'Galaxy S24 FE',

      'Galaxy S25',
      'Galaxy S25 FE',

      'Galaxy S26',

      'Galaxy A56 5G',
      'Galaxy A36 5G',
      'Galaxy A26 5G',
    ],
    note:
      '최근 Galaxy S 기본형과 일부 Plus·FE·A 모델에서 사용하는 19.5:9 계열 FHD+ 해상도입니다.',
  },

  {
    id: 'galaxy-ultra-qhd-1440x3088',
    source: 'samsung',
    category: 'galaxy-phone',
    label: 'Galaxy Ultra QHD+ — 1440 × 3088',
    width: 1440,
    height: 3088,
    orientation: 'portrait',
    models: [
      'Galaxy S22 Ultra',
      'Galaxy S23 Ultra',
    ],
    note:
      'Galaxy S22 Ultra와 S23 Ultra가 사용하는 QHD+ 물리적 화면 해상도입니다.',
  },

  {
    id: 'galaxy-phone-qhd-1440x3120',
    source: 'samsung',
    category: 'galaxy-phone',
    label: 'Galaxy 최신 Plus·Ultra QHD+ — 1440 × 3120',
    width: 1440,
    height: 3120,
    orientation: 'portrait',
    models: [
      'Galaxy S24+',
      'Galaxy S24 Plus',
      'Galaxy S24 Ultra',

      'Galaxy S25+',
      'Galaxy S25 Plus',
      'Galaxy S25 Ultra',

      'Galaxy S26+',
      'Galaxy S26 Plus',
      'Galaxy S26 Ultra',
    ],
    note:
      '최근 Galaxy S Plus 및 Ultra 모델에서 사용하는 QHD+ 물리적 화면 해상도입니다.',
  },

  /*
   * =========================================================
   * Galaxy Fold / Z Fold 커버 화면
   * =========================================================
   */

  {
    id: 'galaxy-fold-cover-720x1680',
    source: 'samsung',
    category: 'galaxy-phone',
    label: 'Galaxy Fold 커버 화면 — 720 × 1680',
    width: 720,
    height: 1680,
    orientation: 'portrait',
    diagonalInches: 4.6,
    models: [
      'Galaxy Fold 커버 화면',
      'Galaxy Fold 5G 커버 화면',
    ],
    note:
      '1세대 Galaxy Fold를 접었을 때 사용하는 외부 커버 화면입니다.',
  },

  {
    id: 'galaxy-z-fold2-cover-816x2260',
    source: 'samsung',
    category: 'galaxy-phone',
    label: 'Galaxy Z Fold2 커버 화면 — 816 × 2260',
    width: 816,
    height: 2260,
    orientation: 'portrait',
    diagonalInches: 6.2,
    models: [
      'Galaxy Z Fold2 커버 화면',
      'Galaxy Z Fold2 5G 커버 화면',
    ],
    note:
      'Galaxy Z Fold2를 접었을 때 사용하는 외부 커버 화면입니다.',
  },

  {
    id: 'galaxy-z-fold3-cover-832x2268',
    source: 'samsung',
    category: 'galaxy-phone',
    label: 'Galaxy Z Fold3 커버 화면 — 832 × 2268',
    width: 832,
    height: 2268,
    orientation: 'portrait',
    diagonalInches: 6.2,
    models: [
      'Galaxy Z Fold3 커버 화면',
      'Galaxy Z Fold3 5G 커버 화면',
    ],
    note:
      'Galaxy Z Fold3를 접었을 때 사용하는 외부 커버 화면입니다.',
  },

  {
    id: 'galaxy-z-fold4-5-cover-904x2316',
    source: 'samsung',
    category: 'galaxy-phone',
    label: 'Galaxy Z Fold4·5 커버 화면 — 904 × 2316',
    width: 904,
    height: 2316,
    orientation: 'portrait',
    diagonalInches: 6.2,
    models: [
      'Galaxy Z Fold4 커버 화면',
      'Galaxy Z Fold5 커버 화면',
    ],
    note:
      'Galaxy Z Fold4와 Fold5를 접었을 때 사용하는 외부 커버 화면입니다.',
  },

  {
    id: 'galaxy-z-fold6-cover-968x2376',
    source: 'samsung',
    category: 'galaxy-phone',
    label: 'Galaxy Z Fold6 커버 화면 — 968 × 2376',
    width: 968,
    height: 2376,
    orientation: 'portrait',
    diagonalInches: 6.3,
    models: [
      'Galaxy Z Fold6 커버 화면',
    ],
    note:
      'Galaxy Z Fold6를 접었을 때 사용하는 외부 커버 화면입니다.',
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
      'Galaxy Z Fold7을 접었을 때 사용하는 외부 커버 화면입니다.',
  },

  /*
   * =========================================================
   * Galaxy Fold / Z Fold 펼친 내부 화면
   * 내부 화면은 실제 화면 방향에 맞춰 가로형으로 저장합니다.
   * =========================================================
   */

  {
    id: 'galaxy-fold-main-2152x1536',
    source: 'samsung',
    category: 'galaxy-phone',
    label: 'Galaxy Fold 펼친 화면 — 2152 × 1536',
    width: 2152,
    height: 1536,
    orientation: 'landscape',
    diagonalInches: 7.3,
    models: [
      'Galaxy Fold 펼친 화면',
      'Galaxy Fold 5G 펼친 화면',
    ],
    note:
      '1세대 Galaxy Fold를 완전히 펼쳤을 때 사용하는 내부 주 화면입니다.',
  },

  {
    id: 'galaxy-z-fold2-3-main-2208x1768',
    source: 'samsung',
    category: 'galaxy-phone',
    label: 'Galaxy Z Fold2·3 펼친 화면 — 2208 × 1768',
    width: 2208,
    height: 1768,
    orientation: 'landscape',
    diagonalInches: 7.6,
    models: [
      'Galaxy Z Fold2 펼친 화면',
      'Galaxy Z Fold2 5G 펼친 화면',
      'Galaxy Z Fold3 펼친 화면',
      'Galaxy Z Fold3 5G 펼친 화면',
    ],
    note:
      'Galaxy Z Fold2와 Fold3를 완전히 펼쳤을 때 사용하는 내부 주 화면입니다.',
  },

  {
    id: 'galaxy-z-fold4-5-main-2176x1812',
    source: 'samsung',
    category: 'galaxy-phone',
    label: 'Galaxy Z Fold4·5 펼친 화면 — 2176 × 1812',
    width: 2176,
    height: 1812,
    orientation: 'landscape',
    diagonalInches: 7.6,
    models: [
      'Galaxy Z Fold4 펼친 화면',
      'Galaxy Z Fold5 펼친 화면',
    ],
    note:
      'Galaxy Z Fold4와 Fold5를 완전히 펼쳤을 때 사용하는 내부 주 화면입니다.',
  },

  {
    id: 'galaxy-z-fold6-main-2160x1856',
    source: 'samsung',
    category: 'galaxy-phone',
    label: 'Galaxy Z Fold6 펼친 화면 — 2160 × 1856',
    width: 2160,
    height: 1856,
    orientation: 'landscape',
    diagonalInches: 7.6,
    models: [
      'Galaxy Z Fold6 펼친 화면',
    ],
    note:
      'Galaxy Z Fold6를 완전히 펼쳤을 때 사용하는 내부 주 화면입니다.',
  },

  {
    id: 'galaxy-z-fold7-main-2184x1968',
    source: 'samsung',
    category: 'galaxy-phone',
    label: 'Galaxy Z Fold7 펼친 화면 — 2184 × 1968',
    width: 2184,
    height: 1968,
    orientation: 'landscape',
    diagonalInches: 8,
    models: [
      'Galaxy Z Fold7 펼친 화면',
    ],
    note:
      'Galaxy Z Fold7을 완전히 펼쳤을 때 사용하는 내부 주 화면입니다.',
  },

  /*
   * =========================================================
   * Galaxy Z Flip 펼친 내부 화면
   * Flip 커버 화면은 시간표 표시 면적이 지나치게 작아 제외합니다.
   * =========================================================
   */

  {
    id: 'galaxy-z-flip-main-1080x2636',
    source: 'samsung',
    category: 'galaxy-phone',
    label: 'Galaxy Z Flip 펼친 화면 — 1080 × 2636',
    width: 1080,
    height: 2636,
    orientation: 'portrait',
    diagonalInches: 6.7,
    models: [
      'Galaxy Z Flip 펼친 화면',
      'Galaxy Z Flip 5G 펼친 화면',
    ],
    note:
      '1세대 Galaxy Z Flip과 Z Flip 5G를 펼쳤을 때 사용하는 세로형 내부 주 화면입니다.',
  },

  {
    id: 'galaxy-z-flip3-6-main-1080x2640',
    source: 'samsung',
    category: 'galaxy-phone',
    label: 'Galaxy Z Flip3~6 펼친 화면 — 1080 × 2640',
    width: 1080,
    height: 2640,
    orientation: 'portrait',
    diagonalInches: 6.7,
    models: [
      'Galaxy Z Flip3 펼친 화면',
      'Galaxy Z Flip3 5G 펼친 화면',
      'Galaxy Z Flip4 펼친 화면',
      'Galaxy Z Flip5 펼친 화면',
      'Galaxy Z Flip6 펼친 화면',
    ],
    note:
      'Galaxy Z Flip3부터 Flip6까지 펼쳤을 때 사용하는 세로형 내부 주 화면입니다.',
  },

  {
    id: 'galaxy-z-flip7-main-1080x2520',
    source: 'samsung',
    category: 'galaxy-phone',
    label: 'Galaxy Z Flip7 펼친 화면 — 1080 × 2520',
    width: 1080,
    height: 2520,
    orientation: 'portrait',
    diagonalInches: 6.9,
    models: [
      'Galaxy Z Flip7',
      'Galaxy Z Flip7 펼친 화면',
    ],
    note:
      'Galaxy Z Flip7을 펼쳤을 때 사용하는 세로형 내부 주 화면입니다.',
  },
] as const satisfies readonly DeviceResolutionPreset[]
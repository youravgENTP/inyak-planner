import type { TimetableCourse, TimetableDay } from './types'

export const TIMETABLE_DAYS: TimetableDay[] = [
  { key: 'mon', label: '월요일', shortLabel: 'MON' },
  { key: 'tue', label: '화요일', shortLabel: 'TUE' },
  { key: 'wed', label: '수요일', shortLabel: 'WED' },
  { key: 'thu', label: '목요일', shortLabel: 'THU' },
  { key: 'fri', label: '금요일', shortLabel: 'FRI' },
  // { key: 'sat', label: '토요일', shortLabel: 'SAT' },
  // { key: 'sun', label: '일요일', shortLabel: 'SUN' },
]

export const TIMETABLE_START_MINUTE = 9 * 60
export const TIMETABLE_END_MINUTE = 18 * 60
export const TIMETABLE_SLOT_MINUTES = 30
export const TIMETABLE_SLOT_HEIGHT = 34

export const SAMPLE_COURSES: TimetableCourse[] = [
  {
    id: 'pharmaceutics-1',
    code: 'PHR301',
    title: '약제학 I',
    professor: '김인제',
    room: '약학관 201',
    credits: 3,
    day: 'mon',
    startMinute: 9 * 60,
    endMinute: 10 * 60 + 30,
    color: 'navy',
  },
  {
    id: 'pharmacology-1',
    code: 'PHR315',
    title: '약리학 I',
    professor: '박약리',
    room: '약학관 304',
    credits: 3,
    day: 'tue',
    startMinute: 10 * 60,
    endMinute: 12 * 60,
    color: 'teal',
  },
  {
    id: 'medicinal-chemistry',
    code: 'PHR322',
    title: '의약화학 I',
    professor: '이화학',
    room: '약학관 105',
    credits: 3,
    day: 'wed',
    startMinute: 13 * 60,
    endMinute: 15 * 60,
    color: 'blue',
  },
  {
    id: 'pharmacy-practice',
    code: 'PHR330',
    title: '약학실습',
    professor: '최실습',
    room: '실습실 A',
    credits: 2,
    day: 'thu',
    startMinute: 14 * 60,
    endMinute: 17 * 60,
    color: 'slate',
  },
  {
    id: 'clinical-pharmacy',
    code: 'PHR341',
    title: '임상약학개론',
    professor: '정임상',
    room: '약학관 202',
    credits: 3,
    day: 'fri',
    startMinute: 9 * 60 + 30,
    endMinute: 11 * 60,
    color: 'teal',
  },
]
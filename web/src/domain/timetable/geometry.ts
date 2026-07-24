import {
  TIMETABLE_SLOT_HEIGHT,
  TIMETABLE_SLOT_MINUTES,
  TIMETABLE_START_MINUTE,
} from './constants'

export interface TimetableBlockGeometry {
  top: number
  height: number
}

export function getCourseBlockGeometry(
  startMinute: number,
  endMinute: number,
): TimetableBlockGeometry {
  if (endMinute <= startMinute) {
    throw new Error('수업 종료 시각은 시작 시각보다 늦어야 합니다.')
  }

  const pixelsPerMinute = TIMETABLE_SLOT_HEIGHT / TIMETABLE_SLOT_MINUTES

  return {
    top: (startMinute - TIMETABLE_START_MINUTE) * pixelsPerMinute,
    height: (endMinute - startMinute) * pixelsPerMinute,
  }
}

export function formatMinuteAsTime(totalMinute: number): string {
  const hour = Math.floor(totalMinute / 60)
  const minute = totalMinute % 60

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

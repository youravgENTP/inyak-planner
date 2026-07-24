import type { Weekday } from '../timetable/types'

export interface ParsedLectureSchedule {
  day: Weekday
  startMinute: number
  endMinute: number
  room: string
}

const DAY_MAP: Record<string, Weekday> = {
  월: 'mon',
  화: 'tue',
  수: 'wed',
  목: 'thu',
  금: 'fri',
}

/*
 * 1교시는 09:00에 시작합니다.
 *
 * 1교시: 09:00–10:00
 * 2교시: 10:00–11:00
 * 3교시: 11:00–12:00
 * ...
 */
function periodToStartMinute(period: number): number {
  return 9 * 60 + (period - 1) * 60
}

function periodToEndMinute(period: number): number {
  return periodToStartMinute(period) + 60
}

function groupConsecutivePeriods(
  periods: number[],
): number[][] {
  if (periods.length === 0) {
    return []
  }

  const sortedPeriods = [...periods].sort(
    (firstPeriod, secondPeriod) =>
      firstPeriod - secondPeriod,
  )

  const groups: number[][] = []
  let currentGroup: number[] = [sortedPeriods[0]]

  for (
    let index = 1;
    index < sortedPeriods.length;
    index += 1
  ) {
    const currentPeriod = sortedPeriods[index]
    const previousPeriod = sortedPeriods[index - 1]

    if (currentPeriod === previousPeriod + 1) {
      currentGroup.push(currentPeriod)
      continue
    }

    groups.push(currentGroup)
    currentGroup = [currentPeriod]
  }

  groups.push(currentGroup)

  return groups
}

export function parseLectureSchedule(
  scheduleAndRoom: string | null,
): ParsedLectureSchedule[] {
  if (!scheduleAndRoom?.trim()) {
    return []
  }

  const trimmedValue = scheduleAndRoom.trim()

  /*
   * 마지막 공백 뒤의 값을 강의실로 봅니다.
   *
   * 예:
   * "월3,4수4 H동101"
   *
   * schedulePart = "월3,4수4"
   * room = "H동101"
   */
  const lastSpaceIndex = trimmedValue.lastIndexOf(' ')

  if (lastSpaceIndex === -1) {
    return []
  }

  const schedulePart = trimmedValue
    .slice(0, lastSpaceIndex)
    .trim()

  const room = trimmedValue
    .slice(lastSpaceIndex + 1)
    .trim()

  if (!schedulePart || !room) {
    return []
  }

  /*
   * 요일 뒤에 오는 교시 숫자들을 찾습니다.
   *
   * 예:
   * "월3,4수4"
   *
   * 결과:
   * 월 / 3,4
   * 수 / 4
   */
  const schedulePattern = /([월화수목금])([0-9,]+)/g

  const parsedSchedules: ParsedLectureSchedule[] = []

  let match = schedulePattern.exec(schedulePart)

  while (match !== null) {
    const koreanDay = match[1]
    const periodText = match[2]

    const day = DAY_MAP[koreanDay]

    const periods = periodText
      .split(',')
      .map((value) => Number(value))
      .filter(
        (period) =>
          Number.isInteger(period) &&
          period >= 1 &&
          period <= 9,
      )

    const periodGroups =
      groupConsecutivePeriods(periods)

    periodGroups.forEach((group) => {
      const firstPeriod = group[0]
      const lastPeriod = group[group.length - 1]

      parsedSchedules.push({
        day,
        startMinute:
          periodToStartMinute(firstPeriod),
        endMinute:
          periodToEndMinute(lastPeriod),
        room,
      })
    })

    match = schedulePattern.exec(schedulePart)
  }

  return parsedSchedules
}
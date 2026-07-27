import type { SavedTimetable } from './types'

const DEFAULT_TIMETABLE_NAME = '새 시간표'

const escapeRegExp = (
  value: string,
): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const getUsedDefaultNameNumbers = (
  timetables: readonly SavedTimetable[],
): Set<number> => {
  const escapedDefaultName =
    escapeRegExp(DEFAULT_TIMETABLE_NAME)

  const defaultNamePattern = new RegExp(
    `^${escapedDefaultName}(?: (\\d+))?$`,
  )

  const usedNumbers = new Set<number>()

  timetables.forEach((timetable) => {
    const match =
      timetable.name.match(defaultNamePattern)

    if (match === null) {
      return
    }

    const numberText = match[1]

    if (numberText === undefined) {
      usedNumbers.add(1)

      return
    }

    const parsedNumber =
      Number.parseInt(numberText, 10)

    if (Number.isFinite(parsedNumber)) {
      usedNumbers.add(parsedNumber)
    }
  })

  return usedNumbers
}

export const createDefaultTimetableName = (
  timetables: readonly SavedTimetable[],
): string => {
  const usedNumbers =
    getUsedDefaultNameNumbers(timetables)

  let candidateNumber = 1

  while (usedNumbers.has(candidateNumber)) {
    candidateNumber += 1
  }

  if (candidateNumber === 1) {
    return DEFAULT_TIMETABLE_NAME
  }

  return `${DEFAULT_TIMETABLE_NAME} ${candidateNumber}`
}

export const normalizeTimetableName = (
  name: string,
): string =>
  name
    .trim()
    .replace(/\s+/g, ' ')

export const isValidTimetableName = (
  name: string,
): boolean => {
  const normalizedName =
    normalizeTimetableName(name)

  return (
    normalizedName.length > 0 &&
    normalizedName.length <= 30
  )
}

export const getTimetableNameErrorMessage = (
  name: string,
): string | undefined => {
  const normalizedName =
    normalizeTimetableName(name)

  if (normalizedName.length === 0) {
    return '시간표 이름을 입력해 주세요.'
  }

  if (normalizedName.length > 30) {
    return '시간표 이름은 30자 이하로 입력해 주세요.'
  }

  return undefined
}
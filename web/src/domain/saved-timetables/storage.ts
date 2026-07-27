import type { SavedTimetable } from './types'

const SAVED_TIMETABLES_STORAGE_KEY =
  'inyak-planner.saved-timetables'

const ACTIVE_TIMETABLE_ID_STORAGE_KEY =
  'inyak-planner.active-timetable-id'

interface SavedTimetableStorageData {
  version: 1
  timetables: SavedTimetable[]
}

const isRecord = (
  value: unknown,
): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null

const isSavedTimetable = (
  value: unknown,
): value is SavedTimetable => {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.academicYear === 'number' &&
    (
      value.semester === 1 ||
      value.semester === 2
    ) &&
    Array.isArray(value.lectureIds) &&
    value.lectureIds.every(
      (lectureId) =>
        typeof lectureId === 'number' &&
        Number.isInteger(lectureId),
    ) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  )
}

const isSavedTimetableStorageData = (
  value: unknown,
): value is SavedTimetableStorageData => {
  if (!isRecord(value)) {
    return false
  }

  return (
    value.version === 1 &&
    Array.isArray(value.timetables) &&
    value.timetables.every(
      isSavedTimetable,
    )
  )
}

export const loadSavedTimetables =
  (): SavedTimetable[] => {
    try {
      const storedValue =
        window.localStorage.getItem(
          SAVED_TIMETABLES_STORAGE_KEY,
        )

      if (storedValue === null) {
        return []
      }

      const parsedValue: unknown =
        JSON.parse(storedValue)

      if (
        !isSavedTimetableStorageData(
          parsedValue,
        )
      ) {
        return []
      }

      return parsedValue.timetables.map(
        (timetable) => ({
          ...timetable,
          lectureIds: [
            ...new Set(
              timetable.lectureIds,
            ),
          ],
        }),
      )
    } catch {
      return []
    }
  }

export const saveSavedTimetables = (
  timetables: readonly SavedTimetable[],
): void => {
  const storageData:
    SavedTimetableStorageData = {
      version: 1,
      timetables: timetables.map(
        (timetable) => ({
          ...timetable,
          lectureIds: [
            ...new Set(
              timetable.lectureIds,
            ),
          ],
        }),
      ),
    }

  window.localStorage.setItem(
    SAVED_TIMETABLES_STORAGE_KEY,
    JSON.stringify(storageData),
  )
}

export const loadActiveTimetableId =
  (): string | null => {
    try {
      return window.localStorage.getItem(
        ACTIVE_TIMETABLE_ID_STORAGE_KEY,
      )
    } catch {
      return null
    }
  }

export const saveActiveTimetableId = (
  timetableId: string,
): void => {
  window.localStorage.setItem(
    ACTIVE_TIMETABLE_ID_STORAGE_KEY,
    timetableId,
  )
}

export const clearActiveTimetableId =
  (): void => {
    window.localStorage.removeItem(
      ACTIVE_TIMETABLE_ID_STORAGE_KEY,
    )
}

export const clearSavedTimetableStorage =
  (): void => {
    window.localStorage.removeItem(
      SAVED_TIMETABLES_STORAGE_KEY,
    )

    window.localStorage.removeItem(
      ACTIVE_TIMETABLE_ID_STORAGE_KEY,
    )
  }
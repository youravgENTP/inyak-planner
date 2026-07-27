import {
  createDefaultTimetableName,
  normalizeTimetableName,
} from './naming'
import type {
  CreateTimetableValues,
  SavedTimetable,
  UpdateTimetableValues,
} from './types'

const createTimetableId = (): string => {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }

  return [
    'timetable',
    Date.now().toString(36),
    Math.random().toString(36).slice(2),
  ].join('-')
}

const createTimestamp = (): string =>
  new Date().toISOString()

export const createSavedTimetable = (
  values: CreateTimetableValues,
): SavedTimetable => {
  const timestamp = createTimestamp()

  return {
    id: createTimetableId(),
    name: normalizeTimetableName(values.name),
    academicYear: values.academicYear,
    semester: values.semester,
    lectureIds: [
      ...new Set(values.lectureIds ?? []),
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export const createEmptyTimetable = (
  timetables: readonly SavedTimetable[],
  academicYear: number,
  semester: 1 | 2,
): SavedTimetable =>
  createSavedTimetable({
    name: createDefaultTimetableName(
      timetables,
    ),
    academicYear,
    semester,
    lectureIds: [],
  })

export const duplicateTimetable = (
  sourceTimetable: SavedTimetable,
  timetables: readonly SavedTimetable[],
): SavedTimetable =>
  createSavedTimetable({
    name: createDefaultTimetableName(
      timetables,
    ),
    academicYear:
      sourceTimetable.academicYear,
    semester: sourceTimetable.semester,
    lectureIds:
      sourceTimetable.lectureIds,
  })

export const updateSavedTimetable = (
  timetable: SavedTimetable,
  values: UpdateTimetableValues,
): SavedTimetable => {
  const nextName =
    values.name === undefined
      ? timetable.name
      : normalizeTimetableName(
          values.name,
        )

  const nextLectureIds =
    values.lectureIds === undefined
      ? timetable.lectureIds
      : [
          ...new Set(
            values.lectureIds,
          ),
        ]

  return {
    ...timetable,
    name: nextName,
    lectureIds: nextLectureIds,
    updatedAt: createTimestamp(),
  }
}

export const replaceTimetable = (
  timetables: readonly SavedTimetable[],
  updatedTimetable: SavedTimetable,
): SavedTimetable[] =>
  timetables.map((timetable) =>
    timetable.id === updatedTimetable.id
      ? updatedTimetable
      : timetable,
  )

export const removeTimetable = (
  timetables: readonly SavedTimetable[],
  timetableId: string,
): SavedTimetable[] =>
  timetables.filter(
    (timetable) =>
      timetable.id !== timetableId,
  )

export const addLectureToTimetable = (
  timetable: SavedTimetable,
  lectureId: number,
): SavedTimetable => {
  if (
    timetable.lectureIds.includes(
      lectureId,
    )
  ) {
    return timetable
  }

  return updateSavedTimetable(
    timetable,
    {
      lectureIds: [
        ...timetable.lectureIds,
        lectureId,
      ],
    },
  )
}

export const removeLectureFromTimetable = (
  timetable: SavedTimetable,
  lectureId: number,
): SavedTimetable =>
  updateSavedTimetable(
    timetable,
    {
      lectureIds:
        timetable.lectureIds.filter(
          (currentLectureId) =>
            currentLectureId !==
            lectureId,
        ),
    },
  )
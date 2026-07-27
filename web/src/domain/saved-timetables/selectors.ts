import type {
  AcademicSemester,
  SavedTimetable,
  TimetableGroup,
} from './types'

const compareTimetablesByUpdatedAt = (
  firstTimetable: SavedTimetable,
  secondTimetable: SavedTimetable,
): number =>
  secondTimetable.updatedAt.localeCompare(
    firstTimetable.updatedAt,
  )

const compareTimetableGroups = (
  firstGroup: TimetableGroup,
  secondGroup: TimetableGroup,
): number => {
  if (
    firstGroup.academicYear !==
    secondGroup.academicYear
  ) {
    return (
      secondGroup.academicYear -
      firstGroup.academicYear
    )
  }

  return secondGroup.semester - firstGroup.semester
}

export const getActiveTimetable = (
  timetables: readonly SavedTimetable[],
  activeTimetableId: string | null,
): SavedTimetable | undefined => {
  if (activeTimetableId === null) {
    return undefined
  }

  return timetables.find(
    (timetable) =>
      timetable.id === activeTimetableId,
  )
}

export const getTimetableById = (
  timetables: readonly SavedTimetable[],
  timetableId: string,
): SavedTimetable | undefined =>
  timetables.find(
    (timetable) =>
      timetable.id === timetableId,
  )

export const getTimetablesForSemester = (
  timetables: readonly SavedTimetable[],
  academicYear: number,
  semester: AcademicSemester,
): SavedTimetable[] =>
  timetables
    .filter(
      (timetable) =>
        timetable.academicYear === academicYear &&
        timetable.semester === semester,
    )
    .sort(compareTimetablesByUpdatedAt)

export const groupTimetablesBySemester = (
  timetables: readonly SavedTimetable[],
): TimetableGroup[] => {
  const groupMap = new Map<
    string,
    TimetableGroup
  >()

  timetables.forEach((timetable) => {
    const groupKey =
      `${timetable.academicYear}-${timetable.semester}`

    const existingGroup =
      groupMap.get(groupKey)

    if (existingGroup !== undefined) {
      existingGroup.timetables.push(timetable)

      return
    }

    groupMap.set(groupKey, {
      academicYear: timetable.academicYear,
      semester: timetable.semester,
      timetables: [timetable],
    })
  })

  return [...groupMap.values()]
    .map((group) => ({
      ...group,
      timetables: [...group.timetables]
        .sort(compareTimetablesByUpdatedAt),
    }))
    .sort(compareTimetableGroups)
}

export const getTimetableLectureIds = (
  timetable: SavedTimetable | undefined,
): number[] =>
  timetable === undefined
    ? []
    : [...timetable.lectureIds]

export const hasTimetable = (
  timetables: readonly SavedTimetable[],
  timetableId: string,
): boolean =>
  timetables.some(
    (timetable) =>
      timetable.id === timetableId,
  )

export const getValidComparisonTimetableIds = (
  timetables: readonly SavedTimetable[],
  comparisonTimetableIds: readonly string[],
): string[] => {
  const existingTimetableIds = new Set(
    timetables.map(
      (timetable) => timetable.id,
    ),
  )

  const uniqueValidIds: string[] = []

  comparisonTimetableIds.forEach(
    (timetableId) => {
      if (
        !existingTimetableIds.has(timetableId) ||
        uniqueValidIds.includes(timetableId)
      ) {
        return
      }

      uniqueValidIds.push(timetableId)
    },
  )

  return uniqueValidIds.slice(0, 3)
}

export const canAddTimetableToComparison = (
  comparisonTimetableIds: readonly string[],
  timetableId: string,
): boolean =>
  comparisonTimetableIds.length < 3 &&
  !comparisonTimetableIds.includes(timetableId)
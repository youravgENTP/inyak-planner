import type {
  SavedTimetable,
} from './types'


export function getCommonTimetableLectureIds(
  timetables:
    readonly SavedTimetable[],
): Set<number> {
  if (timetables.length < 2) {
    return new Set<number>()
  }

  const [
    firstTimetable,
    ...otherTimetables
  ] = timetables

  return new Set(
    firstTimetable.lectureIds.filter(
      (lectureId) =>
        otherTimetables.every(
          (timetable) =>
            timetable.lectureIds.includes(
              lectureId,
            ),
        ),
    ),
  )
}
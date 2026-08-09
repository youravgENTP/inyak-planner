import { useMemo } from 'react'

import { TimetableGrid } from '../timetable/TimetableGrid'
import {
  lecturesToTimetableCourses,
} from '../../domain/lectures/timetable'
import type { Lecture } from '../../domain/lectures/types'
import type {
  SavedTimetable,
} from '../../domain/saved-timetables'

interface TimetableMiniPreviewProps {
  timetable: SavedTimetable
  lectures: readonly Lecture[]
  mutedLectureIds?: ReadonlySet<number>
}

export function TimetableMiniPreview({
  timetable,
  lectures,
  mutedLectureIds,
}: TimetableMiniPreviewProps) {
  const lectureMap = useMemo(
    () =>
      new Map(
        lectures.map(
          (lecture) =>
            [lecture.id, lecture] as const,
        ),
      ),
    [lectures],
  )

  const timetableLectures = useMemo(
    () =>
      timetable.lectureIds
        .map((lectureId) =>
          lectureMap.get(lectureId),
        )
        .filter(
          (
            lecture,
          ): lecture is Lecture =>
            lecture !== undefined,
        ),
    [
      lectureMap,
      timetable.lectureIds,
    ],
  )

  const courses = useMemo(
    () =>
      lecturesToTimetableCourses(
        timetableLectures,
      ),
    [timetableLectures],
  )

  return (
    <div
      className="timetable-mini-preview"
      aria-label={`${timetable.name} 시간표 미리보기`}
    >
      <TimetableGrid
        courses={courses}
        mutedLectureIds={
          mutedLectureIds
        }
      />
    </div>
  )
}
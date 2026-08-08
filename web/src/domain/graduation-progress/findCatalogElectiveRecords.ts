import type {
  CourseRecord,
} from '../course-records/types'
import type {
  Lecture,
} from '../lectures/types'


export function findCatalogElectiveRecords(
  records: readonly CourseRecord[],
  lectures: readonly Lecture[],
): CourseRecord[] {
  const lectureMap =
    new Map(
      lectures.map(
        (lecture) => [
          lecture.id,
          lecture,
        ],
      ),
    )

  return records.filter(
    (record) => {
      if (
        record.completionType !== '전선' ||
        record.lectureId === null
      ) {
        return false
      }

      const lecture =
        lectureMap.get(
          record.lectureId,
        )

      if (lecture === undefined) {
        return false
      }

      return (
        lecture.completionType === '전선'
      )
    },
  )
}
import type {
  TimetableConflict,
  TimetableCourse,
  Weekday,
} from './types'

export function getCoursesForDay(
  courses: TimetableCourse[],
  day: Weekday,
): TimetableCourse[] {
  return courses
    .filter((course) => course.day === day)
    .sort((firstCourse, secondCourse) => {
      return firstCourse.startMinute - secondCourse.startMinute
    })
}

export function getTotalCredits(
  courses: TimetableCourse[],
): number {
  return courses.reduce((totalCredits, course) => {
    return totalCredits + course.credits
  }, 0)
}

export function doCoursesConflict(
  firstCourse: TimetableCourse,
  secondCourse: TimetableCourse,
): boolean {
  if (firstCourse.id === secondCourse.id) {
    return false
  }

  if (firstCourse.day !== secondCourse.day) {
    return false
  }

  return (
    firstCourse.startMinute < secondCourse.endMinute &&
    secondCourse.startMinute < firstCourse.endMinute
  )
}

export function getTimetableConflicts(
  courses: TimetableCourse[],
): TimetableConflict[] {
  const conflicts: TimetableConflict[] = []

  for (
    let firstIndex = 0;
    firstIndex < courses.length;
    firstIndex += 1
  ) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < courses.length;
      secondIndex += 1
    ) {
      const firstCourse = courses[firstIndex]
      const secondCourse = courses[secondIndex]

      if (doCoursesConflict(firstCourse, secondCourse)) {
        conflicts.push({
          firstCourse,
          secondCourse,
        })
      }
    }
  }

  return conflicts
}

/*
 * TimetablePage가 아직 기존 함수 이름을 사용하고 있으므로
 * 이번 단계에서는 임시 호환 함수를 남겨둡니다.
 *
 * 다음 단계에서 TimetablePage를 수정한 뒤 제거할 예정입니다.
 */
export function getTotalCreditsPlaceholder(
  courses: TimetableCourse[],
): number {
  return getTotalCredits(courses)
}
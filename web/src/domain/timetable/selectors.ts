import type { TimetableCourse, Weekday } from './types'

export function getCoursesForDay(
  courses: TimetableCourse[],
  day: Weekday,
): TimetableCourse[] {
  return courses
    .filter((course) => course.day === day)
    .sort((a, b) => a.startMinute - b.startMinute)
}

export function getTotalCreditsPlaceholder(courses: TimetableCourse[]): number {
  return courses.length * 3
}

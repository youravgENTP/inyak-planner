import type {
  CSSProperties,
  Ref,
} from 'react'

import {
  TIMETABLE_DAYS,
  TIMETABLE_END_MINUTE,
  TIMETABLE_SLOT_HEIGHT,
  TIMETABLE_SLOT_MINUTES,
  TIMETABLE_START_MINUTE,
} from '../../domain/timetable/constants'

import {
  formatMinuteAsTime,
  getCourseBlockGeometry,
} from '../../domain/timetable/geometry'

import { getCoursesForDay } from '../../domain/timetable/selectors'

import type { TimetableCourse } from '../../domain/timetable/types'

interface TimetableGridProps {
  courses: TimetableCourse[]
  isEditing?: boolean
  timetableRef?: Ref<HTMLDivElement>
  onRemoveLecture?: (lectureId: number) => void
  mutedLectureIds?: ReadonlySet<number>
  comparisonCourseClassName?: string
}

function createTimeSlots(): number[] {
  const slots: number[] = []

  for (
    let minute = TIMETABLE_START_MINUTE;
    minute < TIMETABLE_END_MINUTE;
    minute += TIMETABLE_SLOT_MINUTES
  ) {
    slots.push(minute)
  }

  return slots
}

const timeSlots = createTimeSlots()

const gridHeight =
  timeSlots.length * TIMETABLE_SLOT_HEIGHT

export function TimetableGrid({
  courses,
  isEditing = false,
  timetableRef,
  onRemoveLecture,
  mutedLectureIds,
  comparisonCourseClassName,
}: TimetableGridProps) {
  function handleRemoveCourse(
    course: TimetableCourse,
  ) {
    if (
      course.sourceLectureId === undefined ||
      !onRemoveLecture
    ) {
      return
    }

    onRemoveLecture(course.sourceLectureId)
  }

  return (
    <div className="timetable-scroll">
      <div
        ref={timetableRef}
        className="timetable"
        style={
          {
            '--grid-height': `${gridHeight}px`,
          } as CSSProperties
        }
      >
        <div
          className="timetable-corner"
          aria-hidden="true"
        />

        {TIMETABLE_DAYS.map((day) => (
          <div
            className="day-heading"
            key={day.key}
          >
            <strong>{day.shortLabel}</strong>
            <span>{day.label}</span>
          </div>
        ))}

        <div className="time-column">
          {timeSlots.map((minute) => (
            <div
              className="time-label"
              key={minute}
            >
              {minute % 60 === 0
                ? formatMinuteAsTime(minute)
                : ''}
            </div>
          ))}
        </div>

        {TIMETABLE_DAYS.map((day) => (
          <div
            className="day-column"
            key={day.key}
            style={{ height: gridHeight }}
          >
            {timeSlots.map((minute) => (
              <div
                className={`grid-slot${
                  minute % 60 === 0
                    ? ' grid-slot--hour'
                    : ''
                }`}
                key={minute}
              />
            ))}

            {getCoursesForDay(
              courses,
              day.key,
            ).map((course) => {
              const geometry =
                getCourseBlockGeometry(
                  course.startMinute,
                  course.endMinute,
                )

              const canRemove =
                isEditing &&
                !course.isPreview &&
                course.sourceLectureId !== undefined &&
                onRemoveLecture !== undefined

              const isMuted =
                course.sourceLectureId !==
                  undefined &&
                mutedLectureIds?.has(
                  course.sourceLectureId,
                ) === true

              const blockClassName = [
                'course-block',
                `course-block--${course.color}`,
                isMuted
                  ? 'course-block--muted'
                  : comparisonCourseClassName ??
                    '',
                course.isPreview
                  ? 'course-block--preview'
                  : '',
                course.isConflicting
                  ? 'course-block--conflicting'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')

              const conflictLabel =
                course.isConflicting
                  ? ', 다른 수업과 시간이 겹칩니다'
                  : ''

              return (
                <article
                  className={blockClassName}
                  key={course.id}
                  style={{
                    top: geometry.top,
                    height: geometry.height,
                  }}
                  aria-label={`${course.title}, ${formatMinuteAsTime(
                    course.startMinute,
                  )}부터 ${formatMinuteAsTime(
                    course.endMinute,
                  )}까지${conflictLabel}`}
                >
                  {canRemove && (
                    <button
                      className="course-block-remove-button"
                      type="button"
                      aria-label={`${course.title} 시간표에서 삭제`}
                      title="시간표에서 삭제"
                      onClick={() =>
                        handleRemoveCourse(course)
                      }
                    >
                      ×
                    </button>
                  )}

                  <strong>{course.title}</strong>

                  <span>{course.professor}</span>

                  <span>{course.room}</span>
                </article>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
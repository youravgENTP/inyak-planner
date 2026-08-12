import {
  useState,
} from 'react'

import type {
  AcademicCalendarEvent,
} from '../../domain/academic-calendar/types'

interface HorizontalAcademicCalendarProps {
  academicYear: number
  events: AcademicCalendarEvent[]
  onAcademicYearChange: (
    year: number,
  ) => void
}


interface CalendarMonth {
  year: number
  month: number
}


function getDaysInMonth(
  year: number,
  month: number,
): number {
  return new Date(
    year,
    month,
    0,
  ).getDate()
}


function isWeekend(
  year: number,
  month: number,
  day: number,
): boolean {
  const weekday = new Date(
    year,
    month - 1,
    day,
  ).getDay()

  return weekday === 0 || weekday === 6
}


function getFrontHalfMonths(
  academicYear: number,
): CalendarMonth[] {
  return [
    2,
    3,
    4,
    5,
    6,
    7,
    8,
  ].map(
    (month) => ({
      year: academicYear,
      month,
    }),
  )
}


function getBackHalfMonths(
  academicYear: number,
): CalendarMonth[] {
  return [
    {
      year: academicYear,
      month: 8,
    },
    {
      year: academicYear,
      month: 9,
    },
    {
      year: academicYear,
      month: 10,
    },
    {
      year: academicYear,
      month: 11,
    },
    {
      year: academicYear,
      month: 12,
    },
    {
      year: academicYear + 1,
      month: 1,
    },
    {
      year: academicYear + 1,
      month: 2,
    },
  ]
}


function CalendarHalf({
  title,
  months,
  events,
}: {
  title: string
  months: CalendarMonth[]
  events: AcademicCalendarEvent[]
}) {
  return (
    <section className="academic-calendar-horizontal-half">
      <h2>
        {title}
      </h2>

      <div className="academic-calendar-horizontal-scroll">
        <div className="academic-calendar-horizontal-grid">
          {months.map(
            ({
              year,
              month,
            }) => {
              const daysInMonth =
                getDaysInMonth(
                  year,
                  month,
                )

              const monthKey =
                `${year}-${String(
                  month,
                ).padStart(
                  2,
                  '0',
                )}`

              const monthEvents =
                events.filter(
                  (event) =>
                    event.startDate.startsWith(
                      monthKey,
                    ),
                )

              return (
                <div
                  className="academic-calendar-horizontal-month"
                  data-event-count={
                    monthEvents.length
                  }
                  key={`${year}-${month}`}
                >
                  <div className="academic-calendar-horizontal-month-label">
                    <span className="academic-calendar-horizontal-year">
                      {year}
                    </span>

                    <strong>
                      {month}월
                    </strong>
                  </div>

                <div className="academic-calendar-horizontal-days-wrapper">
                    <div className="academic-calendar-horizontal-days">
                    {Array.from(
                      {
                        length: 31,
                      },
                      (
                        _,
                        index,
                      ) => {
                        const day =
                          index + 1

                        const exists =
                          day <=
                          daysInMonth

                        const weekend =
                          exists &&
                          isWeekend(
                            year,
                            month,
                            day,
                          )

                        return (
                          <div
                            className={[
                              'academic-calendar-horizontal-day',
                              weekend
                                ? 'academic-calendar-horizontal-day--weekend'
                                : '',
                              !exists
                                ? 'academic-calendar-horizontal-day--empty'
                                : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            key={day}
                          >
                            {exists
                              ? day
                              : ''}
                          </div>
                        )
                      },
                    )}
                  </div>
                </div>
              </div>
              )
            },
          )}
        </div>
      </div>
    </section>
  )
}


export function HorizontalAcademicCalendar({
  academicYear,
  events,
  onAcademicYearChange,
}: HorizontalAcademicCalendarProps) {
  const [half, setHalf] =
    useState<'front' | 'back'>(
      'front',
    )

  const months =
    half === 'front'
      ? getFrontHalfMonths(
          academicYear,
        )
      : getBackHalfMonths(
          academicYear,
        )

  const title =
    half === 'front'
      ? `${academicYear}학년도 상반기`
      : `${academicYear}학년도 하반기`

  return (
    <div className="academic-calendar-horizontal">
        <div className="academic-calendar-horizontal-controls">
        <div className="academic-calendar-horizontal-year-select">
            <select
            value={academicYear}
            onChange={(event) =>
                onAcademicYearChange(
                Number(
                    event.target.value,
                ),
                )
            }
            >
            {[
                2024,
                2025,
                2026,
                2027,
            ].map((year) => (
                <option
                key={year}
                value={year}
                >
                {year}
                </option>
            ))}
            </select>

            <span>
            학년도
            </span>
        </div>

        <select
            value={half}
            onChange={(event) =>
            setHalf(
                event.target.value as
                | 'front'
                | 'back',
            )
            }
        >
            <option value="front">
            상반기
            </option>

            <option value="back">
            하반기
            </option>
        </select>
        </div>

      <CalendarHalf
        title={title}
        months={months}
        events={events}
      />
    </div>
  )
}
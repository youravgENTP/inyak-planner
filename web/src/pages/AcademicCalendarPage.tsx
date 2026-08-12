import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  getAcademicCalendar,
} from '../domain/academic-calendar/api'

import type {
  AcademicCalendar,
  AcademicCalendarEvent,
} from '../domain/academic-calendar/types'


function getTodayIsoDate(): string {
  const today = new Date()

  const year = today.getFullYear()
  const month = String(
    today.getMonth() + 1,
  ).padStart(2, '0')
  const day = String(
    today.getDate(),
  ).padStart(2, '0')

  return `${year}-${month}-${day}`
}


function formatEventDate(
  event: AcademicCalendarEvent,
): string {
  const start = event.startDate.slice(5)
  const end = event.endDate.slice(5)

  if (event.startDate === event.endDate) {
    return start.replace('-', '.')
  }

  return (
    `${start.replace('-', '.')} ~ ` +
    `${end.replace('-', '.')}`
  )
}


export function AcademicCalendarPage() {
  const [selectedYear, setSelectedYear] =
    useState(2026)

  const [calendar, setCalendar] =
    useState<AcademicCalendar | null>(
      null,
    )

  const [
    loadingError,
    setLoadingError,
  ] = useState<string | null>(null)

  const [isLoading, setIsLoading] =
    useState(false)

  const todayIsoDate = getTodayIsoDate()

  useEffect(() => {
    let isCancelled = false

    async function loadCalendar() {
      setIsLoading(true)
      setLoadingError(null)

      try {
        const result =
          await getAcademicCalendar(
            selectedYear,
          )

        if (!isCancelled) {
          setCalendar(result)
        }
      } catch (error) {
        if (!isCancelled) {
          setCalendar(null)

          setLoadingError(
            error instanceof Error
              ? error.message
              : '학사일정을 불러오지 못했습니다.',
          )
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadCalendar()

    return () => {
      isCancelled = true
    }
  }, [selectedYear])

  const eventsByMonth = useMemo(() => {
    const grouped = new Map<
      number,
      AcademicCalendarEvent[]
    >()

    if (calendar === null) {
      return grouped
    }

    for (const event of calendar.events) {
      const existing =
        grouped.get(event.month)

      if (existing !== undefined) {
        existing.push(event)
      } else {
        grouped.set(
          event.month,
          [event],
        )
      }
    }

    return grouped
  }, [calendar])

  return (
    <section className="academic-calendar-page">
      <header className="academic-calendar-header">
        <h1>학사일정</h1>

        <div className="academic-calendar-year-control">
          <button
            type="button"
            aria-label="이전 연도"
            onClick={() =>
              setSelectedYear(
                (year) => year - 1,
              )
            }
          >
            ‹
          </button>

          <strong>
            {selectedYear}년
          </strong>

          <button
            type="button"
            aria-label="다음 연도"
            onClick={() =>
              setSelectedYear(
                (year) => year + 1,
              )
            }
          >
            ›
          </button>
        </div>
      </header>

      {loadingError !== null ? (
        <p className="academic-calendar-message">
          {loadingError}
        </p>
      ) : isLoading || calendar === null ? (
        <p className="academic-calendar-message">
          학사일정을 불러오는 중입니다.
        </p>
      ) : (
        <div className="academic-calendar-month-list">
          {Array.from(
            eventsByMonth.entries(),
          ).map(
            ([month, events]) => (
              <section
                className="academic-calendar-month"
                key={month}
              >
                <h2>
                  {month}월
                </h2>

                <ul>
                  {events.map(
                    (
                      event,
                      index,
                    ) => {
                      const isPast =
                        event.endDate <
                        todayIsoDate

                      return (
                        <li
                          className={
                            isPast
                              ? 'academic-calendar-event academic-calendar-event--past'
                              : 'academic-calendar-event'
                          }
                          key={
                            `${event.startDate}-` +
                            `${event.endDate}-` +
                            `${event.title}-` +
                            `${index}`
                          }
                        >
                          <span className="academic-calendar-event-date">
                            {formatEventDate(
                              event,
                            )}
                          </span>

                          <span className="academic-calendar-event-title">
                            {event.title}
                          </span>
                        </li>
                      )
                    },
                  )}
                </ul>
              </section>
            ),
          )}
        </div>
      )}
    </section>
  )
}
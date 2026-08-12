import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  getAcademicYearCalendar,
} from '../domain/academic-calendar/api'

import {
  downloadAcademicCalendarPdf,
} from '../domain/academic-calendar/pdf'

import {
  HorizontalAcademicCalendar,
  type AcademicCalendarHalf,
} from '../components/academic-calendar/HorizontalAcademicCalendar'

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

  const [viewMode, setViewMode] =
    useState<'list' | 'horizontal'>(
      'list',
    )

  const [
    selectedHalf,
    setSelectedHalf,
  ] =
    useState<AcademicCalendarHalf>(
      'front',
    )

  const [
    isDownloadingPdf,
    setIsDownloadingPdf,
  ] =
    useState(false)

  const calendarPdfRef =
    useRef<HTMLElement | null>(
      null,
    )

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
          await getAcademicYearCalendar(
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

  async function handlePdfDownload() {
    if (
      calendarPdfRef.current ===
      null
    ) {
      return
    }

    setIsDownloadingPdf(true)

    try {
      await downloadAcademicCalendarPdf(
        calendarPdfRef.current,
        selectedYear,
        selectedHalf,
      )
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : 'PDF를 생성하지 못했습니다.',
      )
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  return (
    <section className="academic-calendar-page">
      <header className="academic-calendar-header">
        <h1>학사일정</h1>
      </header>

      <div className="academic-calendar-toolbar">
        <div
          className="academic-calendar-view-switch"
          role="group"
          aria-label="학사일정 보기 방식"
        >
          <button
            className={
              viewMode === 'list'
                ? 'academic-calendar-view-button academic-calendar-view-button--active'
                : 'academic-calendar-view-button'
            }
            type="button"
            onClick={() =>
              setViewMode('list')
            }
          >
            목록뷰
          </button>

          <button
            className={
              viewMode === 'horizontal'
                ? 'academic-calendar-view-button academic-calendar-view-button--active'
                : 'academic-calendar-view-button'
            }
            type="button"
            onClick={() =>
              setViewMode('horizontal')
            }
          >
            가로뷰
          </button>
        </div>

        {viewMode ===
          'horizontal' && (
          <button
            className="academic-calendar-pdf-button"
            type="button"
            disabled={
              isLoading ||
              calendar === null ||
              isDownloadingPdf
            }
            onClick={() => {
              void handlePdfDownload()
            }}
          >
            {isDownloadingPdf
              ? 'PDF 생성 중...'
              : 'PDF 다운로드'}
          </button>
        )}
      </div>

      {loadingError !== null ? (
        <p className="academic-calendar-message">
          {loadingError}
        </p>
      ) : isLoading || calendar === null ? (
        <p className="academic-calendar-message">
          학사일정을 불러오는 중입니다.
        </p>
      ) : viewMode === 'horizontal' ? (
        <HorizontalAcademicCalendar
          academicYear={selectedYear}
          events={calendar.events}
          half={selectedHalf}
          calendarRef={
            calendarPdfRef
          }
          onAcademicYearChange={
            setSelectedYear
          }
          onHalfChange={
            setSelectedHalf
          }
        />
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
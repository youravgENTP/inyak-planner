import {
  useEffect,
  useState,
} from 'react'

import {
  getAcademicCalendar,
} from '../domain/academic-calendar/api'

import type {
  AcademicCalendar,
} from '../domain/academic-calendar/types'


export function AcademicCalendarPage() {
  const [calendar, setCalendar] =
    useState<AcademicCalendar | null>(
      null,
    )

  const [
    loadingError,
    setLoadingError,
  ] = useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false

    async function loadCalendar() {
      try {
        const result =
          await getAcademicCalendar(
            2026,
          )

        if (!isCancelled) {
          setCalendar(result)
          setLoadingError(null)
        }
      } catch (error) {
        if (!isCancelled) {
          setLoadingError(
            error instanceof Error
              ? error.message
              : '학사일정을 불러오지 못했습니다.',
          )
        }
      }
    }

    void loadCalendar()

    return () => {
      isCancelled = true
    }
  }, [])

  return (
    <section>
      <h1>학사일정</h1>

      {loadingError !== null ? (
        <p>
          {loadingError}
        </p>
      ) : calendar === null ? (
        <p>
          학사일정을 불러오는 중입니다.
        </p>
      ) : (
        <p>
          {calendar.academicYear}년
          학사일정 {calendar.count}건을
          불러왔습니다.
        </p>
      )}
    </section>
  )
}
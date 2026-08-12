interface HorizontalAcademicCalendarProps {
  academicYear: number
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
}: {
  title: string
  months: CalendarMonth[]
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

              return (
                <div
                  className="academic-calendar-horizontal-month"
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
}: HorizontalAcademicCalendarProps) {
  return (
    <div className="academic-calendar-horizontal">
      <CalendarHalf
        title={`${academicYear}학년도 전반기`}
        months={
          getFrontHalfMonths(
            academicYear,
          )
        }
      />

      <CalendarHalf
        title={`${academicYear}학년도 후반기`}
        months={
          getBackHalfMonths(
            academicYear,
          )
        }
      />
    </div>
  )
}
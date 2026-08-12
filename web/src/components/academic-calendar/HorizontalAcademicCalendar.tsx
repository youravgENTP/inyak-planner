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

function getWeekdayLabel(
  year: number,
  month: number,
  day: number,
): string {
  const weekday = new Date(
    year,
    month - 1,
    day,
  ).getDay()

  return [
    '일',
    '월',
    '화',
    '수',
    '목',
    '금',
    '토',
  ][weekday]
}

function normalizeAcademicCalendarEventTitle(
  title: string,
): string {
  return title
    .replace(
      /\(보강실시\)/g,
      '',
    )
    .replace(
      /^\d{1,2}\([일월화수목금토]\)\s*/,
      '',
    )
    .replace(
      /\(계절\)/g,
      ' 계절',
    )
    .replace(
      /\s+/g,
      ' ',
    )
    .trim()
}


function getVerticalDisplayLength(
  text: string,
): number {
  return text
    .replace(
      /\d+\/\d+/g,
      '□',
    )
    .replace(
      /\s/g,
      '',
    ).length
}


function renderVerticalTitlePart(
  titlePart: string,
) {
  return titlePart
    .split(
      /(\d+\/\d+)/g,
    )
    .filter(Boolean)
    .map(
      (
        segment,
        segmentIndex,
      ) =>
        /^\d+\/\d+$/.test(
          segment,
        ) ? (
          <span
            className="academic-calendar-horizontal-event-fraction"
            key={
              `${segment}-` +
              `${segmentIndex}`
            }
          >
            {segment}
          </span>
        ) : (
          segment
        ),
    )
}


function splitSingleDayEventTitle(
  title: string,
): string[] {
  const normalizedTitle =
    title.trim()

  const compactLength =
    getVerticalDisplayLength(
      normalizedTitle,
    )

  if (compactLength <= 8) {
    return [
      normalizedTitle,
    ]
  }

  const words =
    normalizedTitle
      .split(/\s+/)
      .filter(Boolean)

  if (words.length > 1) {
    let bestSplitIndex = 1
    let smallestDifference =
      Number.POSITIVE_INFINITY

    for (
      let index = 1;
      index < words.length;
      index += 1
    ) {
      const firstPart =
        words
          .slice(
            0,
            index,
          )
          .join(' ')

      const secondPart =
        words
          .slice(index)
          .join(' ')

      const firstLength =
        getVerticalDisplayLength(
          firstPart,
        )

      const secondLength =
        getVerticalDisplayLength(
          secondPart,
        )

      const difference =
        Math.abs(
          firstLength -
            secondLength,
        )

      if (
        difference <
        smallestDifference
      ) {
        smallestDifference =
          difference
        bestSplitIndex =
          index
      }
    }

    return [
      words
        .slice(
          0,
          bestSplitIndex,
        )
        .join(' '),
      words
        .slice(
          bestSplitIndex,
        )
        .join(' '),
    ]
  }

  const middleIndex =
    Math.ceil(
      normalizedTitle.length / 2,
    )

  return [
    normalizedTitle.slice(
      0,
      middleIndex,
    ),
    normalizedTitle.slice(
      middleIndex,
    ),
  ]
}

function getSingleDayTitleParts(
  displayTitles: string[],
): string[][] {
  if (displayTitles.length === 1) {
    return [
      splitSingleDayEventTitle(
        displayTitles[0],
      ),
    ]
  }

  if (displayTitles.length === 2) {
    const splitTitles =
      displayTitles.map(
        (title) =>
          splitSingleDayEventTitle(
            title,
          ),
      )

    const totalColumnCount =
      splitTitles.reduce(
        (
          columnCount,
          titleParts,
        ) =>
          columnCount +
          titleParts.length,
        0,
      )

    if (totalColumnCount <= 3) {
      return splitTitles
    }

    const displayLengths =
      displayTitles.map(
        (title) =>
          getVerticalDisplayLength(
            title,
          ),
      )

    const splitIndex =
      displayLengths[0] >=
      displayLengths[1]
        ? 0
        : 1

    return displayTitles.map(
      (
        title,
        index,
      ) =>
        index === splitIndex
          ? splitSingleDayEventTitle(
              title,
            )
          : [
              title,
            ],
    )
  }

  return displayTitles.map(
    (title) => [
      title,
    ],
  )
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
  const monthLayouts =
    months.map(
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

        const monthStart =
          `${monthKey}-01`

        const monthEnd =
          `${monthKey}-${String(
            daysInMonth,
          ).padStart(
            2,
            '0',
          )}`

        const monthEvents =
          events.filter(
            (event) =>
              event.startDate <=
                monthEnd &&
              event.endDate >=
                monthStart,
          )

        const singleDayEventMap =
          new Map<
            number,
            Array<{
              event:
                AcademicCalendarEvent
              displayTitle: string
            }>
          >()

        const rangeLaneEndDays:
          number[] = []

        const rangeEvents =
          monthEvents
            .map((event) => {
              const startDay =
                event.startDate <
                monthStart
                  ? 1
                  : Number(
                      event.startDate.slice(
                        8,
                        10,
                      ),
                    )

              const endDay =
                event.endDate >
                monthEnd
                  ? daysInMonth
                  : Number(
                      event.endDate.slice(
                        8,
                        10,
                      ),
                    )

              const displayTitle =
                normalizeAcademicCalendarEventTitle(
                  event.title,
                )

              return {
                event,
                displayTitle,
                startDay,
                endDay,
              }
            })
            .filter(
              (
                positionedEvent,
              ) => {
                const isSingleDay =
                  positionedEvent
                    .event
                    .startDate ===
                  positionedEvent
                    .event
                    .endDate

                if (!isSingleDay) {
                  return true
                }

                const existing =
                  singleDayEventMap.get(
                    positionedEvent
                      .startDay,
                  )

                const singleEvent = {
                  event:
                    positionedEvent
                      .event,
                  displayTitle:
                    positionedEvent
                      .displayTitle,
                }

                if (
                  existing !==
                  undefined
                ) {
                  existing.push(
                    singleEvent,
                  )
                } else {
                  singleDayEventMap.set(
                    positionedEvent
                      .startDay,
                    [
                      singleEvent,
                    ],
                  )
                }

                return false
              },
            )
            .sort(
              (left, right) =>
                left.startDay -
                  right.startDay ||
                left.endDay -
                  right.endDay,
            )
            .map(
              (
                positionedEvent,
              ) => {
                let lane =
                  rangeLaneEndDays
                    .findIndex(
                      (
                        laneEndDay,
                      ) =>
                        laneEndDay <
                        positionedEvent
                          .startDay,
                    )

                if (lane === -1) {
                  lane =
                    rangeLaneEndDays
                      .length

                  rangeLaneEndDays
                    .push(
                      positionedEvent
                        .endDay,
                    )
                } else {
                  rangeLaneEndDays[
                    lane
                  ] =
                    positionedEvent
                      .endDay
                }

                return {
                  ...positionedEvent,
                  lane,
                }
              },
            )

        const singleDayGroups =
          Array.from(
            singleDayEventMap
              .entries(),
          )
            .sort(
              (
                [leftDay],
                [rightDay],
              ) =>
                leftDay -
                rightDay,
            )
            .map(
              ([
                day,
                dayEvents,
              ]) => {
                const titleParts =
                  getSingleDayTitleParts(
                    dayEvents.map(
                      ({
                        displayTitle,
                      }) =>
                        displayTitle,
                    ),
                  )

                const renderedEvents =
                  dayEvents.map(
                    (
                      dayEvent,
                      index,
                    ) => ({
                      ...dayEvent,
                      titleParts:
                        titleParts[
                          index
                        ],
                    }),
                  )

                const eventHeights =
                  renderedEvents.map(
                    ({
                      titleParts:
                        eventTitleParts,
                    }) =>
                      Math.max(
                        24,
                        Math.max(
                          ...eventTitleParts.map(
                            (
                              titlePart,
                            ) =>
                              getVerticalDisplayLength(
                                titlePart,
                              ) *
                                10 +
                              4,
                          ),
                        ),
                      ),
                  )

                let groupHeight = 0

                for (
                  let index = 0;
                  index <
                  eventHeights.length;
                  index += 3
                ) {
                  const rowHeights =
                    eventHeights.slice(
                      index,
                      index + 3,
                    )

                  groupHeight +=
                    Math.max(
                      ...rowHeights,
                    )

                  if (
                    index + 3 <
                    eventHeights.length
                  ) {
                    groupHeight += 4
                  }
                }

                return {
                  day,
                  events:
                    renderedEvents,
                  height:
                    groupHeight,
                }
              },
            )

        const singleAreaHeight =
          Math.max(
            0,
            ...singleDayGroups.map(
              ({ height }) =>
                height,
            ),
          )

        return {
          year,
          month,
          daysInMonth,
          monthEvents,
          singleDayGroups,
          singleAreaHeight,
          rangeEvents,
          rangeLaneCount:
            rangeLaneEndDays
              .length,
        }
      },
    )

  const commonSingleAreaHeight =
    Math.max(
      72,
      ...monthLayouts.map(
        ({
          singleAreaHeight,
        }) =>
          singleAreaHeight,
      ),
    )

  const commonRangeLaneCount =
    Math.max(
      0,
      ...monthLayouts.map(
        ({
          rangeLaneCount,
        }) =>
          rangeLaneCount,
      ),
    )

  const rangeLaneHeight = 24
  const rangeLaneGap = 4

  const commonRangeAreaHeight =
    commonRangeLaneCount === 0
      ? 0
      : commonRangeLaneCount *
          rangeLaneHeight +
        (
          commonRangeLaneCount -
          1
        ) *
          rangeLaneGap

  const singleRangeGap =
    commonRangeLaneCount > 0
      ? 12
      : 0

  const monthBottomPadding = 8

  const commonMonthRowHeight =
    Math.max(
      132,
      48 +
        commonSingleAreaHeight +
        singleRangeGap +
        commonRangeAreaHeight +
        monthBottomPadding,
    )

  return (
    <section className="academic-calendar-horizontal-half">
      <h2>
        {title}
      </h2>

      <div className="academic-calendar-horizontal-scroll">
        <div className="academic-calendar-horizontal-grid">
          {monthLayouts.map(
            ({
              year,
              month,
              daysInMonth,
              monthEvents,
              singleDayGroups,
              rangeEvents,
            }) => (
              <div
                className="academic-calendar-horizontal-month"
                data-event-count={
                  monthEvents.length
                }
                key={`${year}-${month}`}
                style={{
                  height:
                    `${commonMonthRowHeight}px`,
                }}
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
                            {exists ? (
                              <>
                                <span className="academic-calendar-horizontal-day-number">
                                  {day}
                                </span>

                                <span className="academic-calendar-horizontal-day-weekday">
                                  {getWeekdayLabel(
                                    year,
                                    month,
                                    day,
                                  )}
                                </span>
                              </>
                            ) : null}
                          </div>
                        )
                      },
                    )}
                  </div>

                  <div
                    className="academic-calendar-horizontal-single-events"
                    style={{
                      height:
                        `${commonSingleAreaHeight}px`,
                    }}
                  >
                    {singleDayGroups.map(
                      ({
                        day,
                        events:
                          dayEvents,
                      }) => (
                        <div
                          className="academic-calendar-horizontal-single-day-group"
                          key={day}
                          style={{
                            gridColumn:
                              `${day} / ` +
                              `${day + 1}`,
                          }}
                        >
                          {dayEvents.map(
                            (
                              {
                                event,
                                titleParts,
                              },
                              eventIndex,
                            ) => (
                              <div
                                className="academic-calendar-horizontal-event academic-calendar-horizontal-event--single"
                                key={
                                  `${event.startDate}-` +
                                  `${event.title}-` +
                                  `${eventIndex}`
                                }
                                title={
                                  event.title
                                }
                              >
                                {titleParts.map(
                                  (
                                    titlePart,
                                    partIndex,
                                  ) => (
                                    <span
                                      className="academic-calendar-horizontal-event-single-column"
                                      key={
                                        `${titlePart}-` +
                                        `${partIndex}`
                                      }
                                    >
                                      {renderVerticalTitlePart(
                                        titlePart,
                                      )}
                                    </span>
                                  ),
                                )}
                              </div>
                            ),
                          )}
                        </div>
                      ),
                    )}
                  </div>

                  {commonRangeLaneCount >
                    0 && (
                    <div
                      className="academic-calendar-horizontal-range-events"
                      style={{
                        height:
                          `${commonRangeAreaHeight}px`,
                        gridTemplateRows:
                          `repeat(` +
                          `${commonRangeLaneCount}, ` +
                          `${rangeLaneHeight}px)`,
                      }}
                    >
                      {rangeEvents.map(
                        (
                          {
                            event,
                            displayTitle,
                            startDay,
                            endDay,
                            lane,
                          },
                          index,
                        ) => (
                          <div
                            className="academic-calendar-horizontal-event academic-calendar-horizontal-event--range"
                            key={
                              `${event.startDate}-` +
                              `${event.endDate}-` +
                              `${event.title}-` +
                              `${index}`
                            }
                            style={{
                              gridColumn:
                                `${startDay} / ` +
                                `${endDay + 1}`,
                              gridRow:
                                lane + 1,
                            }}
                            title={
                              event.title
                            }
                          >
                            <div className="academic-calendar-horizontal-range-track">
                              <span className="academic-calendar-horizontal-range-line academic-calendar-horizontal-range-line--start" />

                              <span className="academic-calendar-horizontal-range-label">
                                {
                                  displayTitle
                                }
                              </span>

                              <span className="academic-calendar-horizontal-range-line academic-calendar-horizontal-range-line--end" />
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </div>
            ),
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
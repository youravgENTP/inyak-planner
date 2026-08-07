import './SemesterGpaChart.css'


export interface SemesterGpaChartPoint {
  label: string
  confirmedGpa: number | null
  projectedGpa: number | null
}


interface SemesterGpaChartProps {
  points: readonly SemesterGpaChartPoint[]
}


const CHART_WIDTH = 720
const CHART_HEIGHT = 190

const PADDING_LEFT = 36
const PADDING_RIGHT = 18
const PADDING_TOP = 14
const PADDING_BOTTOM = 34

const MIN_GPA = 0
const MAX_GPA = 4.5


function getX(
  index: number,
  pointCount: number,
): number {
  if (pointCount <= 1) {
    return CHART_WIDTH / 2
  }

  const usableWidth =
    CHART_WIDTH -
    PADDING_LEFT -
    PADDING_RIGHT

  return (
    PADDING_LEFT +
    usableWidth *
      (index / (pointCount - 1))
  )
}


function getY(
  gpa: number,
): number {
  const usableHeight =
    CHART_HEIGHT -
    PADDING_TOP -
    PADDING_BOTTOM

  const normalized =
    (gpa - MIN_GPA) /
    (MAX_GPA - MIN_GPA)

  return (
    PADDING_TOP +
    usableHeight *
      (1 - normalized)
  )
}


function createPath(
  points:
    readonly SemesterGpaChartPoint[],
  getValue: (
    point: SemesterGpaChartPoint,
  ) => number | null,
): string {
  let path = ''
  let previousPointExists = false

  points.forEach((point, index) => {
    const value = getValue(point)

    if (value === null) {
      previousPointExists = false
      return
    }

    const x = getX(
      index,
      points.length,
    )

    const y = getY(value)

    path +=
      `${previousPointExists ? ' L' : ' M'}` +
      ` ${x} ${y}`

    previousPointExists = true
  })

  return path.trim()
}


export function SemesterGpaChart({
  points,
}: SemesterGpaChartProps) {
  const hasAnyGpa =
    points.some(
      (point) =>
        point.confirmedGpa !== null ||
        point.projectedGpa !== null,
    )

  if (!hasAnyGpa) {
    return (
      <div className="semester-gpa-chart-empty">
        GPA를 입력하면 학기별 변화가
        여기에 표시됩니다.
      </div>
    )
  }

  const confirmedPath =
    createPath(
      points,
      (point) =>
        point.confirmedGpa,
    )

  const projectedPath =
    createPath(
      points,
      (point) =>
        point.projectedGpa,
    )

  const guideValues = [
    4.5,
    3,
    1.5,
    0,
  ]

  return (
    <div className="semester-gpa-chart">
      <svg
        aria-label="학기별 GPA 그래프"
        preserveAspectRatio="none"
        role="img"
        viewBox={
          `0 0 ${CHART_WIDTH} ` +
          CHART_HEIGHT
        }
      >
        {guideValues.map(
          (guideValue) => {
            const y = getY(
              guideValue,
            )

            return (
              <g key={guideValue}>
                <line
                  className="semester-gpa-chart__guide"
                  x1={PADDING_LEFT}
                  x2={
                    CHART_WIDTH -
                    PADDING_RIGHT
                  }
                  y1={y}
                  y2={y}
                />

                <text
                  className="semester-gpa-chart__y-label"
                  x={2}
                  y={y + 4}
                >
                  {guideValue.toFixed(1)}
                </text>
              </g>
            )
          },
        )}

        {projectedPath.length > 0 ? (
          <path
            className="semester-gpa-chart__line semester-gpa-chart__line--projected"
            d={projectedPath}
          />
        ) : null}

        {confirmedPath.length > 0 ? (
          <path
            className="semester-gpa-chart__line semester-gpa-chart__line--confirmed"
            d={confirmedPath}
          />
        ) : null}

        {points.map(
          (point, index) => {
            const x = getX(
              index,
              points.length,
            )

            return (
              <g key={point.label}>
                {point.projectedGpa !==
                null ? (
                  <circle
                    className="semester-gpa-chart__point semester-gpa-chart__point--projected"
                    cx={x}
                    cy={getY(
                      point.projectedGpa,
                    )}
                    r={3}
                  />
                ) : null}

                {point.confirmedGpa !==
                null ? (
                  <circle
                    className="semester-gpa-chart__point semester-gpa-chart__point--confirmed"
                    cx={x}
                    cy={getY(
                      point.confirmedGpa,
                    )}
                    r={3}
                  />
                ) : null}

                <text
                  className="semester-gpa-chart__x-label"
                  textAnchor="middle"
                  x={x}
                  y={
                    CHART_HEIGHT - 8
                  }
                >
                  {point.label}
                </text>
              </g>
            )
          },
        )}
      </svg>
    </div>
  )
}
import './GradeDistributionChart.css'


export interface GradeDistributionPoint {
  grade: string
  count: number
}


interface GradeDistributionChartProps {
  points:
    readonly GradeDistributionPoint[]
}


export function GradeDistributionChart({
  points,
}: GradeDistributionChartProps) {
  const maxCount =
    Math.max(
      ...points.map(
        (point) => point.count,
      ),
      0,
    )

  const totalCount =
    points.reduce(
      (total, point) =>
        total + point.count,
      0,
    )

  if (totalCount === 0) {
    return (
      <div className="grade-distribution-chart-empty">
        확정 성적을 입력하면 성적 분포가
        여기에 표시됩니다.
      </div>
    )
  }

  return (
    <div className="grade-distribution-chart">
      {points.map((point) => {
        const widthPercentage =
          maxCount === 0
            ? 0
            : (
              point.count /
              maxCount
            ) * 100

        return (
          <div
            className="grade-distribution-chart__row"
            key={point.grade}
          >
            <span className="grade-distribution-chart__grade">
              {point.grade}
            </span>

            <div className="grade-distribution-chart__track">
              <div
                className="grade-distribution-chart__bar"
                style={{
                  width:
                    `${widthPercentage}%`,
                }}
              />
            </div>

            <strong className="grade-distribution-chart__count">
              {point.count}
            </strong>
          </div>
        )
      })}
    </div>
  )
}
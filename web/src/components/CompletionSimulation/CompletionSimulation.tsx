import {
  useMemo,
  useState,
} from 'react'

import type {
  AuthUser,
} from '../../domain/auth/api'
import {
  createCompletionSimulation,
  type AdvancedPracticumTerm,
  type CreditSourceBreakdown,
  type SimulationRowStatus,
} from '../../domain/completion-simulation/calculateCompletionSimulation'
import type {
  CourseRecord,
} from '../../domain/course-records/types'
import type {
  CurriculumDeliveryRule,
} from '../../domain/curriculum-delivery-rules/types'
import type {
  Curriculum,
} from '../../domain/curriculum/types'
import type {
  GraduationProgress,
} from '../../domain/graduation-progress/types'

import './CompletionSimulation.css'


interface CompletionSimulationProps {
  user: AuthUser
  curriculum: Curriculum
  records: readonly CourseRecord[]
  deliveryRules:
    readonly CurriculumDeliveryRule[]
  progress: GraduationProgress
}


function getExpectedCredits(
  progress: {
    completedCredits: number
    inProgressCredits: number
    plannedCredits: number
    requiredCredits: number
  },
): number {
  return (
    progress.completedCredits +
    progress.inProgressCredits +
    progress.plannedCredits
  )
}


function getCurrentAcademicTerm(
  entryYear: number | null,
  records: readonly CourseRecord[],
): {
  grade: number
  semester: number
} {
  const currentRecord = records
    .filter(
      (record) =>
        record.status === 'in_progress' &&
        record.grade !== null &&
        record.semester !== null,
    )
    .sort(
      (firstRecord, secondRecord) =>
        (
          (secondRecord.grade ?? 0) * 2 +
          (secondRecord.semester ?? 0)
        ) -
        (
          (firstRecord.grade ?? 0) * 2 +
          (firstRecord.semester ?? 0)
        ),
    )[0]

  if (
    currentRecord?.grade !== null &&
    currentRecord?.grade !== undefined &&
    currentRecord.semester !== null
  ) {
    return {
      grade: currentRecord.grade,
      semester: currentRecord.semester,
    }
  }

  const now = new Date()
  const semester =
    now.getMonth() < 6 ? 1 : 2

  if (entryYear === null) {
    return {
      grade: 1,
      semester,
    }
  }

  return {
    grade: Math.min(
      Math.max(
        now.getFullYear() - entryYear + 1,
        1,
      ),
      6,
    ),
    semester,
  }
}


function getNextSemesterLabel(
  grade: number,
  semester: number,
): string {
  if (semester === 1) {
    return `${grade}학년 2학기`
  }

  if (grade >= 6) {
    return '6학년 2학기 이후'
  }

  return `${grade + 1}학년 1학기`
}


function getStatusLabel(
  status: SimulationRowStatus,
): string {
  switch (status) {
    case 'transfer_credit':
      return '전적대 학점인정'
    case 'completed':
      return '이수 완료'
    case 'current':
      return '현재 학기'
    case 'planned':
      return '수강 예정'
    case 'projected':
      return '24학점 가정'
    case 'sixth_year':
      return '졸업 잔여 배치'
  }
}


function MetricCard({
  label,
  value,
  detail,
  emphasized = false,
}: {
  label: string
  value: string
  detail: string
  emphasized?: boolean
}) {
  return (
    <article
      className={
        'completion-simulation-metric' +
        (
          emphasized
            ? ' completion-simulation-metric--emphasized'
            : ''
        )
      }
    >
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}


function CreditBreakdown({
  breakdown,
}: {
  breakdown: CreditSourceBreakdown
}) {
  const parts = [
    breakdown.resident > 0
      ? {
          key: 'resident',
          value: breakdown.resident,
          label: '재학 중 이수',
        }
      : null,
    breakdown.transfer > 0
      ? {
          key: 'transfer',
          value: breakdown.transfer,
          label: '전적대 인정',
        }
      : null,
    breakdown.projected > 0
      ? {
          key: 'projected',
          value: breakdown.projected,
          label: '미래 예상',
        }
      : null,
  ].filter(
    (part): part is NonNullable<
      typeof part
    > => part !== null,
  )

  if (parts.length === 0) {
    return <span>0</span>
  }

  return (
    <span className="completion-simulation-credit-parts">
      {parts.map((part, index) => (
        <span key={part.key}>
          {index > 0 ? (
            <i aria-hidden="true">+</i>
          ) : null}
          <b
            className={
              `completion-simulation-credit--${part.key}`
            }
            title={part.label}
          >
            {part.value}
          </b>
        </span>
      ))}
    </span>
  )
}


export function CompletionSimulation({
  user,
  curriculum,
  records,
  deliveryRules,
  progress,
}: CompletionSimulationProps) {
  const [currentAcademicTerm] = useState(
    () =>
      getCurrentAcademicTerm(
        user.entryYear,
        records,
      ),
  )

  const [advancedPracticumTerm,
    setAdvancedPracticumTerm] =
    useState<AdvancedPracticumTerm>(
      '6-1',
    )

  const generalEducationRemaining =
    useMemo(
      () =>
        progress.generalEducation.reduce(
          (total, requirement) =>
            total +
            Math.max(
              requirement.credits
                .requiredCredits -
                getExpectedCredits(
                  requirement.credits,
                ),
              0,
            ),
          0,
        ),
      [progress],
    )

  const [externalGeneralEducationCredits,
    setExternalGeneralEducationCredits] =
    useState(0)

  const allowedAdvancedPracticumTerms =
    useMemo(
      () => {
        const configuredTerms =
          deliveryRules
            .filter(
              (rule) =>
                rule.deliveryType ===
                  'flexible_practicum',
            )
            .flatMap(
              (rule) =>
                rule.allowedActivityPeriods,
            )
            .filter(
              (period): period is
                AdvancedPracticumTerm =>
                period === '6-1' ||
                period === '6-2',
            )

        return configuredTerms.length > 0
          ? [...new Set(configuredTerms)]
          : (['6-1', '6-2'] as const)
      },
      [deliveryRules],
    )

  const effectiveAdvancedPracticumTerm =
    allowedAdvancedPracticumTerms.includes(
      advancedPracticumTerm,
    )
      ? advancedPracticumTerm
      : allowedAdvancedPracticumTerms[0]

  const simulation = useMemo(
    () =>
      createCompletionSimulation({
        user,
        curriculum,
        progress,
        records,
        deliveryRules,
        currentGrade:
          currentAcademicTerm.grade,
        currentSemester:
          currentAcademicTerm.semester,
        externalGeneralEducationCredits,
        advancedPracticumTerm:
          effectiveAdvancedPracticumTerm,
      }),
    [
      curriculum,
      currentAcademicTerm,
      deliveryRules,
      effectiveAdvancedPracticumTerm,
      externalGeneralEducationCredits,
      progress,
      records,
      user,
    ],
  )

  return (
    <section className="completion-simulation">
      <header className="completion-simulation-heading">
        <div>
          <p>실제 이수기록 기반 학업 설계</p>
          <h2>이수 시뮬레이션</h2>
        </div>

        <span>
          시뮬레이션은 실제 이수기록을
          변경하지 않습니다.
        </span>
      </header>

      <section className="completion-simulation-basis">
        <div>
          <span>현재 기준</span>
          <strong>
            {currentAcademicTerm.grade}학년{' '}
            {currentAcademicTerm.semester}학기
          </strong>
        </div>

        <p>
          실제 기록은 확정{' '}
          <strong>
            {simulation.confirmedCredits}학점
          </strong>
          , 수강 중·예정{' '}
          <strong>
            {simulation.scheduledCredits}학점
          </strong>
          입니다.{' '}
          <strong>
            {getNextSemesterLabel(
              currentAcademicTerm.grade,
              currentAcademicTerm.semester,
            )}
          </strong>
          부터 5학년 2학기까지 매 학기
          24학점을 수강한다고 계산합니다.
        </p>
      </section>

      <div className="completion-simulation-controls">
        <fieldset>
          <legend>심화실습 실제 활동</legend>

          <div className="completion-simulation-segmented">
            {allowedAdvancedPracticumTerms.map(
              (term) => (
                <button
                  aria-pressed={
                    effectiveAdvancedPracticumTerm ===
                      term
                  }
                  key={term}
                  type="button"
                  onClick={() => {
                    setAdvancedPracticumTerm(
                      term,
                    )
                  }}
                >
                  {term === '6-1'
                    ? '6학년 1학기'
                    : '6학년 2학기'}
                </button>
              ),
            )}
          </div>
        </fieldset>

        <div className="completion-simulation-external">
          <label>
            <input
              checked={
                externalGeneralEducationCredits >
                0
              }
              type="checkbox"
              onChange={(event) => {
                setExternalGeneralEducationCredits(
                  event.target.checked
                    ? generalEducationRemaining
                    : 0,
                )
              }}
            />

            <span>
              교양을 계절 및 기타 방법으로 수강
            </span>
          </label>

          {externalGeneralEducationCredits >
          0 ? (
            <label className="completion-simulation-credit-input">
              <span>외부 이수 예정</span>
              <input
                max={generalEducationRemaining}
                min="0"
                step="1"
                type="number"
                value={
                  externalGeneralEducationCredits
                }
                onChange={(event) => {
                  setExternalGeneralEducationCredits(
                    Math.min(
                      Math.max(
                        Number(
                          event.target.value,
                        ) || 0,
                        0,
                      ),
                      generalEducationRemaining,
                    ),
                  )
                }}
              />
              <span>학점</span>
            </label>
          ) : null}
        </div>
      </div>

      <div className="completion-simulation-metrics">
        <MetricCard
          label="졸업요건 잔여"
          value={
            `${simulation.remainingGraduationCredits}학점`
          }
          detail="실제·수강 중·예정 기록 반영"
        />

        <MetricCard
          label="정규학기 외 교양"
          value={
            `−${simulation.externalGeneralEducationCredits}학점`
          }
          detail={
            `잔여 ${simulation.remainingAfterExternalCredits}학점`
          }
        />

        <MetricCard
          label="선이수·후인정 실습"
          value={
            `−${simulation.practicumCreditsApplied}학점`
          }
          detail={
            `정규수업 필요 ${simulation.regularClassCreditsNeeded}학점`
          }
        />

        <MetricCard
          label="5학년 2학기까지 수강 가능"
          value={
            `${simulation.preSixthTotalCapacity}학점`
          }
          detail={
            simulation.preSixthNewCapacity ===
              simulation.preSixthTotalCapacity
              ? '남은 정규학기 × 24학점'
              : `기존 예정 반영 후 신규 ${simulation.preSixthNewCapacity}학점`
          }
        />

        <MetricCard
          emphasized
          label="6학년 실제 추가 등교"
          value={
            `${simulation.sixthYearAttendanceCredits}학점`
          }
          detail="6-1부터 우선 배치"
        />
      </div>

      <div className="completion-simulation-practicum-note">
        <strong>학점 인정과 실제 활동을 분리해 계산합니다.</strong>
        <p>
          심화실습{' '}
          {simulation.advancedPracticumCredits}
          학점의 실제 활동은{' '}
          {simulation.advancedPracticumTerm ===
          '6-1'
            ? '6학년 1학기'
            : '6학년 2학기'}
          , 나머지 필수실무실습{' '}
          {simulation.vacationPracticumCredits}
          학점은 5학년 방학 활동으로 보되,
          학점은 공식 6학년 학기에
          인정합니다.
        </p>
      </div>

      {simulation.sixthYearUnallocatedCredits >
      0 ? (
        <div
          className="completion-simulation-warning"
          role="status"
        >
          6학년의 추가 수강 가능학점을 모두
          사용해도{' '}
          {simulation.sixthYearUnallocatedCredits}
          학점이 부족합니다. 계절학기 또는
          다른 이수 방법이 필요합니다.
        </div>
      ) : null}

      {simulation
        .generalEducationAreaRequirements
        .length > 0 ? (
          <section className="completion-simulation-area-warning">
            <div>
              <strong>교양 영역 확인 필요</strong>
              <p>
                학점 총량을 채워도 아래 영역을
                충족하지 않으면 졸업요건이
                완료되지 않습니다.
              </p>
            </div>

            <ul>
              {simulation
                .generalEducationAreaRequirements
                .map((requirement) => (
                  <li key={requirement.category}>
                    <strong>
                      {requirement.category}
                    </strong>
                    <span>
                      {requirement.remainingAreaCount}
                      개 영역 추가 필요
                      {requirement
                        .requiredAreaNames
                        .length > 0
                        ? ` · 필수: ${requirement.requiredAreaNames.join(', ')}`
                        : ''}
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        ) : null}

      <section className="completion-simulation-table-section">
        <header>
          <div>
            <p>검정 재학 · 초록 전적대 · 파랑 미래</p>
            <h3>학기별 이수 요약</h3>
          </div>

          <span>단위: 학점</span>
        </header>

        <div className="completion-simulation-table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">학기</th>
                <th scope="col">상태</th>
                <th scope="col">해당 학기 전필</th>
                <th scope="col">이수 전필</th>
                <th scope="col">이수 전선</th>
                <th scope="col">이수 교양</th>
                <th scope="col">
                  총 이수/수강 학점
                </th>
                <th scope="col">
                  해당 학기 잔여 수강 가능학점
                </th>
              </tr>
            </thead>

            <tbody>
              {simulation.rows.map((row) => (
                <tr
                  className={
                    `completion-simulation-row--${row.status}`
                  }
                  key={row.key}
                >
                  <th scope="row">
                    {row.label}
                  </th>
                  <td>
                    <span className="completion-simulation-status">
                      {getStatusLabel(row.status)}
                    </span>
                  </td>
                  <td>
                    {row.officialRequiredCredits}
                  </td>
                  <td>
                    <CreditBreakdown
                      breakdown={row.required}
                    />
                  </td>
                  <td>
                    <CreditBreakdown
                      breakdown={row.elective}
                    />
                    {row.additionalElectiveCredits >
                    0 ? (
                      <small>
                        졸업요건 외 추가 선택{' '}
                        {
                          row
                            .additionalElectiveCredits
                        }
                      </small>
                    ) : null}
                  </td>
                  <td>
                    <CreditBreakdown
                      breakdown={
                        row.generalEducation
                      }
                    />
                  </td>
                  <td>
                    <CreditBreakdown
                      breakdown={row.total}
                    />
                    {row.practicumActivityCredits >
                    0 ? (
                      <small>
                        별도 실습 활동{' '}
                        {row.practicumActivityCredits}
                      </small>
                    ) : null}
                  </td>
                  <td>
                    {row.remainingAvailableCredits ===
                    null
                      ? '—'
                      : row.remainingAvailableCredits}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {simulation.rows.some(
          (row) =>
            row.kind === 'transfer_summary',
        ) ? (
          <p className="completion-simulation-transfer-note">
            전적대 학점인정 요약행과 1·2학년
            학기별 초록색 학점은 같은 기록을
            보여주며, 전체 이수학점에는 한 번만
            합산됩니다.
          </p>
        ) : null}
      </section>
    </section>
  )
}

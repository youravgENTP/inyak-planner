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
  type SimulationStrategy,
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


function getDefaultStartTerm(
  entryYear: number | null,
): string {
  if (entryYear === null) {
    return '1-1'
  }

  const now = new Date()
  const grade = Math.min(
    Math.max(
      now.getFullYear() - entryYear + 1,
      1,
    ),
    6,
  )

  return `${grade}-${now.getMonth() < 6 ? 1 : 2}`
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


export function CompletionSimulation({
  user,
  curriculum,
  records,
  deliveryRules,
  progress,
}: CompletionSimulationProps) {
  const [defaultStartTerm] = useState(
    () =>
      getDefaultStartTerm(
        user.entryYear,
      ),
  )

  const [startTerm, setStartTerm] =
    useState(
      () => defaultStartTerm,
    )

  const [strategy, setStrategy] =
    useState<SimulationStrategy>(
      'minimize_sixth_year',
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

  const [startGrade, startSemester] =
    startTerm.split('-').map(Number)

  const simulation = useMemo(
    () =>
      createCompletionSimulation({
        curriculum,
        progress,
        records,
        deliveryRules,
        startGrade,
        startSemester,
        strategy,
        externalGeneralEducationCredits,
        advancedPracticumTerm:
          effectiveAdvancedPracticumTerm,
      }),
    [
      curriculum,
      deliveryRules,
      effectiveAdvancedPracticumTerm,
      externalGeneralEducationCredits,
      progress,
      records,
      startGrade,
      startSemester,
      strategy,
    ],
  )

  const hasUnallocatedCredits =
    simulation.unallocatedElectiveCredits >
      0 ||
    simulation
      .unallocatedGeneralEducationCredits >
      0

  return (
    <section className="completion-simulation">
      <header className="completion-simulation-heading">
        <div>
          <p>24학점 기준 학업 설계</p>
          <h2>이수 시뮬레이션</h2>
        </div>

        <span>
          시뮬레이션은 실제 이수기록을
          변경하지 않습니다.
        </span>
      </header>

      <div className="completion-simulation-controls">
        <label>
          <span>
            어느 학기부터 남은 학점을
            배분할까요?
          </span>
          <select
            value={startTerm}
            onChange={(event) => {
              setStartTerm(
                event.target.value,
              )
            }}
          >
            {Array.from(
              { length: 12 },
              (_, index) => {
                const grade =
                  Math.floor(index / 2) + 1
                const semester =
                  (index % 2) + 1

                return (
                  <option
                    key={`${grade}-${semester}`}
                    value={`${grade}-${semester}`}
                  >
                    {grade}학년 {semester}학기
                    {`${grade}-${semester}` ===
                    defaultStartTerm
                      ? ' · 현재 학기'
                      : ''}
                  </option>
                )
              },
            )}
          </select>

          <small className="completion-simulation-control-help">
            선택한 학기 이전은 이미 지난
            학기로 보고, 남은 전선·교양을
            이 학기부터 6학년 2학기까지
            배분합니다.
          </small>
        </label>

        <fieldset>
          <legend>배분 방식</legend>

          <div className="completion-simulation-segmented">
            <button
              aria-pressed={
                strategy ===
                  'minimize_sixth_year'
              }
              type="button"
              onClick={() => {
                setStrategy(
                  'minimize_sixth_year',
                )
              }}
            >
              6학년 부담 최소화
            </button>

            <button
              aria-pressed={
                strategy === 'fill_24'
              }
              type="button"
              onClick={() => {
                setStrategy('fill_24')
              }}
            >
              매 학기 24학점
            </button>
          </div>
        </fieldset>

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
          label="6학년 공식 전필"
          value={
            `${simulation.sixthYearRequiredCredits}학점`
          }
          detail="학점 인정 학기 기준"
        />

        <MetricCard
          label="6학년 선택 가능 용량"
          value={
            `${simulation.sixthYearRegularCapacity}학점`
          }
          detail="48학점에서 공식 전필 제외"
        />

        <MetricCard
          emphasized
          label="6학년 실제 등교학점"
          value={
            `${simulation.sixthYearAttendanceCredits}학점`
          }
          detail="전선·교양·추가 선택 합계"
        />

        <MetricCard
          label="정규학기 밖 교양"
          value={
            `${simulation.externalGeneralEducationCredits}학점`
          }
          detail="완료 전까지는 계획으로만 반영"
        />
      </div>

      <div className="completion-simulation-practicum-note">
        <strong>실습 인정 방식</strong>
        <p>
          심화실습{' '}
          {simulation.advancedPracticumCredits}
          학점은 공식적으로 6학년 2학기에
          인정하되 실제 활동은{' '}
          {simulation.advancedPracticumTerm ===
          '6-1'
            ? '6학년 1학기'
            : '6학년 2학기'}
          로 계산합니다. 나머지 필수실무실습{' '}
          {simulation.vacationPracticumCredits}
          학점은 5학년 여름·겨울방학 활동으로
          분리합니다.
        </p>
      </div>

      {hasUnallocatedCredits ? (
        <div
          className="completion-simulation-warning"
          role="status"
        >
          선택한 시작 학기 이후의 정규학기
          용량이 부족합니다. 전선{' '}
          {simulation.unallocatedElectiveCredits}
          학점, 교양{' '}
          {
            simulation
              .unallocatedGeneralEducationCredits
          }
          학점을 추가로 배치해야 합니다.
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

      <div className="completion-simulation-semesters">
        {simulation.semesters.map(
          (semester) => (
            <article
              className={
                'completion-simulation-semester' +
                (
                  semester.isBeforeStart
                    ? ' completion-simulation-semester--past'
                    : ''
                )
              }
              key={
                `${semester.grade}-` +
                semester.semester
              }
            >
              <header>
                <span>{semester.grade}학년</span>
                <strong>
                  {semester.grade}학년{' '}
                  {semester.semester}학기
                </strong>
                <small>
                  {semester.isBeforeStart
                    ? '계획 시작 전'
                    : `${semester.totalCredits} / 24학점`}
                </small>
              </header>

              <dl>
                <div>
                  <dt>전필</dt>
                  <dd>
                    {semester.requiredCredits}
                  </dd>
                </div>
                <div>
                  <dt>전선</dt>
                  <dd>
                    {semester.electiveCredits}
                  </dd>
                </div>
                <div>
                  <dt>교양</dt>
                  <dd>
                    {
                      semester
                        .generalEducationCredits
                    }
                  </dd>
                </div>
                <div>
                  <dt>추가 선택</dt>
                  <dd>
                    {semester.additionalCredits}
                  </dd>
                </div>
                <div>
                  <dt>실제 실습</dt>
                  <dd>
                    {
                      semester
                        .practicumActivityCredits
                    }
                  </dd>
                </div>
              </dl>

              {!semester.isBeforeStart ? (
                <div className="completion-simulation-capacity">
                  <span>남은 용량</span>
                  <strong>
                    {semester.remainingCapacity}
                    학점
                  </strong>
                </div>
              ) : null}
            </article>
          ),
        )}
      </div>
    </section>
  )
}

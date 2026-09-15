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
  type SemesterSimulationStatus,
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
  status: SemesterSimulationStatus,
): string {
  switch (status) {
    case 'completed':
      return '실제 이수'
    case 'current':
      return '현재 학기'
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
          실제 이수·수강 중·수강 예정 기록을
          먼저 반영하고,{' '}
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
          label="확정 이수학점"
          value={
            `${simulation.confirmedCredits}학점`
          }
          detail="이수 완료·대체 인정, F 제외"
        />

        <MetricCard
          label="수강 중·예정"
          value={
            `${simulation.scheduledCredits}학점`
          }
          detail="실제 저장된 사용자 기록"
        />

        <MetricCard
          label="졸업요건 잔여"
          value={
            `${simulation.remainingGraduationCredits}학점`
          }
          detail="수강 중·예정까지 반영"
        />

        <MetricCard
          label="5학년 2학기까지 추가 충족"
          value={
            `${simulation.preSixthGraduationCredits}학점`
          }
          detail="다음 학기부터 24학점 가정"
        />

        <MetricCard
          emphasized
          label="6학년 실제 등교 필요"
          value={
            `${simulation.sixthYearAttendanceCredits}학점`
          }
          detail="남은 전선·교양, 6-1 우선 배치"
        />
      </div>

      <div className="completion-simulation-practicum-note">
        <strong>6학년 실습과 등교학점은 별도입니다.</strong>
        <p>
          공식 전필은 6학년 1학기{' '}
          {
            simulation.semesters.find(
              (semester) =>
                semester.grade === 6 &&
                semester.semester === 1,
            )?.officialRequiredCredits ?? 0
          }
          학점, 2학기{' '}
          {
            simulation.semesters.find(
              (semester) =>
                semester.grade === 6 &&
                semester.semester === 2,
            )?.officialRequiredCredits ?? 0
          }
          학점으로 인정됩니다. 심화실습{' '}
          {simulation.advancedPracticumCredits}
          학점의 실제 활동은{' '}
          {simulation.advancedPracticumTerm ===
          '6-1'
            ? '6학년 1학기'
            : '6학년 2학기'}
          , 나머지 필수실무실습{' '}
          {simulation.vacationPracticumCredits}
          학점은 5학년 방학 활동으로
          계산합니다.
        </p>
      </div>

      {hasUnallocatedCredits ? (
        <div
          className="completion-simulation-warning"
          role="status"
        >
          6학년의 추가 수강 가능학점을 모두
          사용해도 졸업요건이 부족합니다.
          전선{' '}
          {simulation.unallocatedElectiveCredits}
          학점, 교양{' '}
          {
            simulation
              .unallocatedGeneralEducationCredits
          }
          학점을 계절학기 또는 다른 방법으로
          추가 이수해야 합니다.
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
            <p>실제 기록 + 24학점 가정</p>
            <h3>학기별 이수 요약</h3>
          </div>

          <span>
            단위: 학점
          </span>
        </header>

        <div className="completion-simulation-table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">학기</th>
                <th scope="col">상태</th>
                <th scope="col">실제·예정 기록</th>
                <th scope="col">공식 전필</th>
                <th scope="col">전선·교양 배정</th>
                <th scope="col">총 인정학점</th>
                <th scope="col">
                  해당 학기 잔여 수강 가능학점
                </th>
                <th scope="col">실제 등교학점</th>
              </tr>
            </thead>

            <tbody>
              {simulation.semesters.map(
                (semester) => (
                  <tr
                    className={
                      `completion-simulation-row--${semester.status}`
                    }
                    key={
                      `${semester.grade}-` +
                      semester.semester
                    }
                  >
                    <th scope="row">
                      {semester.grade}-
                      {semester.semester}
                    </th>
                    <td>
                      <span className="completion-simulation-status">
                        {getStatusLabel(
                          semester.status,
                        )}
                      </span>
                    </td>
                    <td>
                      {semester.recordedCredits}
                    </td>
                    <td>
                      <strong>
                        {
                          semester
                            .officialRequiredCredits
                        }
                      </strong>
                      {semester.status ===
                        'projected' &&
                      semester.requiredCreditsToTake !==
                        semester.officialRequiredCredits ? (
                        <small>
                          남은 전필{' '}
                          {
                            semester
                              .requiredCreditsToTake
                          }
                        </small>
                      ) : null}
                    </td>
                    <td>
                      <strong>
                        전선{' '}
                        {semester.electiveCredits}
                        {' · '}교양{' '}
                        {
                          semester
                            .generalEducationCredits
                        }
                      </strong>
                      {semester.additionalCredits >
                      0 ? (
                        <small>
                          졸업요건 외 추가 수강{' '}
                          {semester.additionalCredits}
                        </small>
                      ) : null}
                    </td>
                    <td>
                      <strong>
                        {semester.totalCredits}
                      </strong>
                    </td>
                    <td>
                      {semester
                        .remainingAvailableCredits ===
                      null
                        ? '—'
                        : semester
                            .remainingAvailableCredits}
                    </td>
                    <td>
                      <strong>
                        {semester.attendanceCredits}
                      </strong>
                      {semester
                        .practicumActivityCredits >
                      0 ? (
                        <small>
                          별도 실습 활동{' '}
                          {
                            semester
                              .practicumActivityCredits
                          }
                        </small>
                      ) : null}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  )
}

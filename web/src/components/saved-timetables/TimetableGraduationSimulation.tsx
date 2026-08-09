import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import type {
  AuthUser,
} from '../../domain/auth/api'

import {
  getCourseRecords,
} from '../../domain/course-records/api'

import type {
  CourseRecord,
} from '../../domain/course-records/types'

import {
  fetchCurriculum,
} from '../../domain/curriculum/api'

import type {
  Curriculum,
} from '../../domain/curriculum/types'

import {
  fetchGeneralEducation,
} from '../../domain/general-education/api'

import type {
  GeneralEducation,
} from '../../domain/general-education/types'

import {
  fetchGraduationRequirements,
} from '../../domain/graduation-requirements/api'

import type {
  GraduationRequirements,
} from '../../domain/graduation-requirements/types'

import {
  calculateGraduationProgress,
} from '../../domain/graduation-progress/calculateProgress'

import {
  createTimetableSimulationRecords,
} from '../../domain/graduation-progress/createTimetableSimulationRecords'

import type {
  CreditProgress,
  GraduationProgress,
} from '../../domain/graduation-progress/types'

import type {
  Lecture,
} from '../../domain/lectures/types'

import type {
  SavedTimetable,
} from '../../domain/saved-timetables'

import './TimetableGraduationSimulation.css'


interface TimetableGraduationSimulationProps {
  user: AuthUser

  timetables:
    readonly SavedTimetable[]

  lectures:
    readonly Lecture[]
}


interface SimulationMetric {
  title: string

  currentCredits: number
  addedCredits: number
  expectedCredits: number
  requiredCredits: number
  remainingCredits: number

  remainingCourseCount:
    number | null
}


interface TimetableSimulationResult {
  timetable: SavedTimetable

  required:
    SimulationMetric

  elective:
    SimulationMetric

  generalEducation:
    SimulationMetric
}


function getExpectedCredits(
  progress: CreditProgress,
): number {
  return (
    progress.completedCredits +
    progress.inProgressCredits +
    progress.plannedCredits
  )
}


function getGeneralEducationCredits(
  progress: GraduationProgress,
) {
  return progress.generalEducation.reduce(
    (
      totals,
      requirement,
    ) => ({
      current:
        totals.current +
        getExpectedCredits(
          requirement.credits,
        ),

      required:
        totals.required +
        requirement
          .credits
          .requiredCredits,
    }),
    {
      current: 0,
      required: 0,
    },
  )
}


function createMetric(
  title: string,
  currentCredits: number,
  simulatedCredits: number,
  requiredCredits: number,
  remainingCourseCount:
    number | null = null,
): SimulationMetric {
  const addedCredits =
    Math.max(
      simulatedCredits -
        currentCredits,
      0,
    )

  return {
    title,

    currentCredits,

    addedCredits,

    expectedCredits:
      simulatedCredits,

    requiredCredits,

    remainingCredits:
      Math.max(
        requiredCredits -
          simulatedCredits,
        0,
      ),

    remainingCourseCount,
  }
}


function SimulationProgressBar({
  metric,
}: {
  metric: SimulationMetric
}) {
  const denominator =
    Math.max(
      metric.requiredCredits,
      1,
    )

  const currentPercent =
    Math.min(
      (
        metric.currentCredits /
        denominator
      ) * 100,
      100,
    )

  const remainingWidth =
    Math.max(
      100 - currentPercent,
      0,
    )

  const addedPercent =
    Math.min(
      (
        metric.addedCredits /
        denominator
      ) * 100,
      remainingWidth,
    )

  return (
    <div className="timetable-simulation-progress">
      <div className="timetable-simulation-progress-heading">
        <strong>
          {metric.title}
        </strong>

        <span>
          {metric.expectedCredits}
          {' / '}
          {metric.requiredCredits}
          학점
        </span>
      </div>

      <div
        className="timetable-simulation-progress-bar"
        aria-label={
          `${metric.title} ` +
          `${metric.expectedCredits} / ` +
          `${metric.requiredCredits}학점`
        }
      >
        <div
          className="timetable-simulation-progress-current"
          style={{
            width:
              `${currentPercent}%`,
          }}
        />

        <div
          className="timetable-simulation-progress-added"
          style={{
            width:
              `${addedPercent}%`,
          }}
        />
      </div>

      <div className="timetable-simulation-progress-caption">
        <span>
          현재 {metric.currentCredits}
        </span>

        <span>
          +{metric.addedCredits}
        </span>

        <strong>
          남은 {metric.remainingCredits}
          학점
        </strong>
      </div>

      {metric.remainingCourseCount !==
      null ? (
        <small>
          전필 과목{' '}
          {metric.remainingCourseCount}
          개 남음
        </small>
      ) : null}
    </div>
  )
}


export function TimetableGraduationSimulation({
  user,
  timetables,
  lectures,
}: TimetableGraduationSimulationProps) {
  const [
    courseRecords,
    setCourseRecords,
  ] = useState<CourseRecord[]>([])

  const [
    curriculum,
    setCurriculum,
  ] = useState<Curriculum | null>(
    null,
  )

  const [
    generalEducation,
    setGeneralEducation,
  ] = useState<GeneralEducation | null>(
    null,
  )

  const [
    graduationRequirements,
    setGraduationRequirements,
  ] = useState<GraduationRequirements | null>(
    null,
  )

  const [
    isLoading,
    setIsLoading,
  ] = useState(true)

  const [
    loadError,
    setLoadError,
  ] = useState<string | null>(null)


  useEffect(() => {
    if (user.entryYear === null) {
      setIsLoading(false)

      return
    }

    async function loadSimulationData() {
      try {
        setIsLoading(true)
        setLoadError(null)

        const [
          records,
          curriculumResult,
          generalEducationResult,
          requirementsResult,
        ] = await Promise.all([
          getCourseRecords(),

          fetchCurriculum(
            user.entryYear!,
          ),

          fetchGeneralEducation(
            user.entryYear!,
          ),

          fetchGraduationRequirements(
            user.entryYear!,
          ),
        ])

        setCourseRecords(records)

        setCurriculum(
          curriculumResult,
        )

        setGeneralEducation(
          generalEducationResult,
        )

        setGraduationRequirements(
          requirementsResult,
        )
      } catch (error) {
        setLoadError(
          error instanceof Error
            ? error.message
            : (
              '수강예정 시뮬레이션 ' +
              '정보를 불러오지 못했습니다.'
            ),
        )
      } finally {
        setIsLoading(false)
      }
    }

    void loadSimulationData()
  }, [user.entryYear])


  const baselineProgress =
    useMemo<
      GraduationProgress | null
    >(
      () => {
        if (
          curriculum === null ||
          generalEducation === null ||
          graduationRequirements ===
            null
        ) {
          return null
        }

        return calculateGraduationProgress(
          curriculum,
          generalEducation,
          graduationRequirements,
          courseRecords,
          lectures,
        )
      },
      [
        courseRecords,
        curriculum,
        generalEducation,
        graduationRequirements,
        lectures,
      ],
    )


  const simulationResults =
    useMemo<
      TimetableSimulationResult[]
    >(
      () => {
        if (
          baselineProgress === null ||
          curriculum === null ||
          generalEducation === null ||
          graduationRequirements ===
            null
        ) {
          return []
        }

        const baselineGeneralEducation =
          getGeneralEducationCredits(
            baselineProgress,
          )

        return timetables.map(
          (timetable) => {
            const simulationRecords =
              createTimetableSimulationRecords(
                timetable,
                lectures,
                courseRecords,
              )

            const simulatedProgress =
              calculateGraduationProgress(
                curriculum,
                generalEducation,
                graduationRequirements,
                [
                  ...courseRecords,
                  ...simulationRecords,
                ],
                lectures,
              )

            const currentRequiredCredits =
              getExpectedCredits(
                baselineProgress
                  .majorRequired
                  .credits,
              )

            const simulatedRequiredCredits =
              getExpectedCredits(
                simulatedProgress
                  .majorRequired
                  .credits,
              )

            const currentElectiveCredits =
              getExpectedCredits(
                baselineProgress
                  .majorElective
                  .credits,
              )

            const simulatedElectiveCredits =
              getExpectedCredits(
                simulatedProgress
                  .majorElective
                  .credits,
              )

            const simulatedGeneralEducation =
              getGeneralEducationCredits(
                simulatedProgress,
              )

            const requiredCourses =
              simulatedProgress
                .majorRequired
                .courses

            const simulatedRequiredCourseCount =
              requiredCourses === null
                ? 0
                : (
                  requiredCourses
                    .completedCourseCount +
                  requiredCourses
                    .inProgressCourseCount +
                  requiredCourses
                    .plannedCourseCount
                )

            const remainingRequiredCourseCount =
              requiredCourses === null
                ? null
                : Math.max(
                    requiredCourses
                      .requiredCourseCount -
                      simulatedRequiredCourseCount,
                    0,
                  )

            return {
              timetable,

              required:
                createMetric(
                  '전공필수',

                  currentRequiredCredits,

                  simulatedRequiredCredits,

                  baselineProgress
                    .majorRequired
                    .credits
                    .requiredCredits,

                  remainingRequiredCourseCount,
                ),

              elective:
                createMetric(
                  '전공선택',

                  currentElectiveCredits,

                  simulatedElectiveCredits,

                  baselineProgress
                    .majorElective
                    .credits
                    .requiredCredits,
                ),

              generalEducation:
                createMetric(
                  '교양',

                  baselineGeneralEducation
                    .current,

                  simulatedGeneralEducation
                    .current,

                  baselineGeneralEducation
                    .required,
                ),
            }
          },
        )
      },
      [
        baselineProgress,
        courseRecords,
        curriculum,
        generalEducation,
        graduationRequirements,
        lectures,
        timetables,
      ],
    )


  if (
    user.entryYear === null ||
    user.studentType === null
  ) {
    return (
      <div className="timetable-simulation-message">
        학업정보를 설정해야
        수강예정 시뮬레이션을
        사용할 수 있습니다.
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="timetable-simulation-message">
        졸업요건을 계산하고 있습니다.
      </div>
    )
  }

  if (loadError !== null) {
    return (
      <div className="timetable-simulation-message">
        {loadError}
      </div>
    )
  }

  return (
    <section className="timetable-simulation">
      <header className="timetable-simulation-header">
        <div>
          <h2>
            수강예정 시뮬레이션
          </h2>

          <p>
            현재 수강이력에 각 시간표의
            과목을 수강 예정으로 더해
            계산합니다.
          </p>
        </div>

        <div className="timetable-simulation-legend">
          <span>
            <i className="timetable-simulation-legend-current" />
            현재
          </span>

          <span>
            <i className="timetable-simulation-legend-added" />
            이 시간표로 추가
          </span>
        </div>
      </header>

      <div
        className="timetable-simulation-grid"
        style={{
          gridTemplateColumns:
            `repeat(${simulationResults.length}, minmax(220px, 1fr))`,
        }}
      >
        {simulationResults.map(
          (result) => (
            <article
              key={result.timetable.id}
              className="timetable-simulation-card"
            >
              <h3>
                {result.timetable.name}
              </h3>

              <SimulationProgressBar
                metric={
                  result.required
                }
              />

              <SimulationProgressBar
                metric={
                  result.elective
                }
              />

              <SimulationProgressBar
                metric={
                  result.generalEducation
                }
              />
            </article>
          ),
        )}
      </div>
    </section>
  )
}
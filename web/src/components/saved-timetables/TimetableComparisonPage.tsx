import {
  useMemo,
  type CSSProperties,
} from 'react'

import "./TimetableComparisonPage.css"

import type { Lecture } from '../../domain/lectures/types'
import type { SavedTimetable } from '../../domain/saved-timetables'
import { TimetableMiniPreview } from './TimetableMiniPreview'

interface TimetableComparisonPageProps {
  timetables: readonly SavedTimetable[]
  lectures: readonly Lecture[]

  onBack?: () => void
  showHeader?: boolean
  showCompactSummary?: boolean
}

interface TimetableComparisonSummary {
  timetable: SavedTimetable

  totalCredits: number

  requiredCredits: number
  electiveCredits: number

  generalEducationCredits: number

  requiredCourseCount: number
  electiveCourseCount: number

  generalEducationCourseCount:
    number

  otherCourseCount: number
}

function normalizeCompletionType(
  completionType: string | null,
): string {
  return completionType
    ?.trim()
    .replace(/\s+/g, '') ?? ''
}

function isRequiredLecture(
  lecture: Lecture,
): boolean {
  const completionType =
    normalizeCompletionType(
      lecture.completionType,
    )

  return (
    completionType === '전필' ||
    completionType === '전공필수'
  )
}

function isElectiveLecture(
  lecture: Lecture,
): boolean {
  const completionType =
    normalizeCompletionType(
      lecture.completionType,
    )

  return (
    completionType === '전선' ||
    completionType === '전공선택'
  )
}

function isGeneralEducationLecture(
  lecture: Lecture,
): boolean {
  const completionType =
    normalizeCompletionType(
      lecture.completionType,
    )

  return (
    completionType === '교양' ||
    completionType.startsWith(
      '교양',
    )
  )
}

function sumCredits(
  lectures: readonly Lecture[],
): number {
  return lectures.reduce(
    (totalCredits, lecture) =>
      totalCredits +
      (lecture.credits ?? 0),
    0,
  )
}

function createComparisonSummary(
  timetable: SavedTimetable,
  lectureMap: ReadonlyMap<
    number,
    Lecture
  >,
): TimetableComparisonSummary {
  const timetableLectures =
    timetable.lectureIds
      .map((lectureId) =>
        lectureMap.get(lectureId),
      )
      .filter(
        (
          lecture,
        ): lecture is Lecture =>
          lecture !== undefined,
      )

  const requiredLectures =
    timetableLectures.filter(
      isRequiredLecture,
    )

  const electiveLectures =
    timetableLectures.filter(
      isElectiveLecture,
    )

  const generalEducationLectures =
    timetableLectures.filter(
      isGeneralEducationLecture,
    )

  const otherCourseCount =
    timetableLectures.length -
    requiredLectures.length -
    electiveLectures.length -
    generalEducationLectures.length

  return {
    timetable,

    totalCredits:
      sumCredits(timetableLectures),

    requiredCredits:
      sumCredits(requiredLectures),

    electiveCredits:
      sumCredits(electiveLectures),

    generalEducationCredits:
      sumCredits(
        generalEducationLectures,
      ),

    requiredCourseCount:
      requiredLectures.length,

    electiveCourseCount:
      electiveLectures.length,

    generalEducationCourseCount:
      generalEducationLectures.length,

    otherCourseCount,
  }
}

export function TimetableComparisonPage({
  timetables,
  lectures,
  onBack,
  showHeader = true,
  showCompactSummary = true,
}: TimetableComparisonPageProps) {
  const lectureMap = useMemo(
    () =>
      new Map(
        lectures.map(
          (lecture) =>
            [lecture.id, lecture] as const,
        ),
      ),
    [lectures],
  )

  const summaries = useMemo(
    () =>
      timetables.map((timetable) =>
        createComparisonSummary(
          timetable,
          lectureMap,
        ),
      ),
    [lectureMap, timetables],
  )

  return (
    <section
      className="timetable-comparison-page"
      aria-labelledby="timetable-comparison-title"
    >
      {showHeader ? (
        <header className="timetable-comparison-page__header">
          <div>
            <span className="page-kicker">
              시간표 비교
            </span>

            <h1 id="timetable-comparison-title">
              시간표 비교
            </h1>

            <p>
              선택한 시간표의 구성과 학점을
              나란히 비교합니다.
            </p>
          </div>

          {onBack !== undefined ? (
            <button
              className="secondary-button"
              type="button"
              onClick={onBack}
            >
              ← 시간표로 돌아가기
            </button>
          ) : null}
        </header>
      ) : null}

      <div className="timetable-comparison-page__scroll">
        <div
          className="timetable-comparison-grid"
          style={{
            '--comparison-column-count':
              summaries.length,
          } as CSSProperties}
        >
          <div
            className="timetable-comparison-grid__corner"
            aria-hidden="true"
          />

          {summaries.map((summary) => (
            <header
              className="timetable-comparison-grid__column-header"
              key={summary.timetable.id}
            >
              <strong>
                {summary.timetable.name}
              </strong>

              <span>
                {
                  summary.timetable
                    .academicYear
                }
                학년도{' '}
                {summary.timetable.semester}
                학기
              </span>
            </header>
          ))}

          <div className="timetable-comparison-grid__row-label">
            시간표
          </div>

          {summaries.map((summary) => (
            <div
              className="timetable-comparison-grid__timetable"
              key={`${summary.timetable.id}-preview`}
            >
              <TimetableMiniPreview
                timetable={
                  summary.timetable
                }
                lectures={lectures}
              />
            </div>

          
          ))}
                  {showCompactSummary ? (
            <>
              <div className="timetable-comparison-grid__row-label">
                구성 요약
              </div>

              {summaries.map(
                (summary) => (
                  <div
                    className="timetable-comparison-grid__compact-summary"
                    key={
                      `${summary.timetable.id}-summary`
                    }
                  >
                    <strong>
                      {summary.totalCredits}
                      학점
                    </strong>

                    <div>
                      <span>
                        전필{' '}
                        {
                          summary
                            .requiredCourseCount
                        }
                        개 ·{' '}
                        {
                          summary
                            .requiredCredits
                        }
                        학점
                      </span>

                      <span>
                        전선{' '}
                        {
                          summary
                            .electiveCourseCount
                        }
                        개 ·{' '}
                        {
                          summary
                            .electiveCredits
                        }
                        학점
                      </span>

                      <span>
                        교양{' '}
                        {
                          summary
                            .generalEducationCourseCount
                        }
                        개 ·{' '}
                        {
                          summary
                            .generalEducationCredits
                        }
                        학점
                      </span>

                      {summary.otherCourseCount >
                      0 ? (
                        <span>
                          기타{' '}
                          {
                            summary
                              .otherCourseCount
                          }
                          개
                        </span>
                      ) : null}
                    </div>
                  </div>
                ),
              )}
            </>
          ) : null}
        </div>
      </div>
    </section>
  )
}
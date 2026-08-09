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

const COMPARISON_COURSE_CLASS_NAMES = [
  'course-block--comparison-a',
  'course-block--comparison-b',
  'course-block--comparison-c',
] as const

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

  const commonLectureIds = useMemo(
    () => {
      if (timetables.length < 2) {
        return new Set<number>()
      }

      const [
        firstTimetable,
        ...otherTimetables
      ] = timetables

      return new Set(
        firstTimetable.lectureIds.filter(
          (lectureId) =>
            otherTimetables.every(
              (timetable) =>
                timetable.lectureIds.includes(
                  lectureId,
                ),
            ),
        ),
      )
    },
    [timetables],
  )

  const differingLecturesByTimetableId =
    useMemo(
      () =>
        new Map(
          timetables.map((timetable) => {
            const differingLectures =
              timetable.lectureIds
                .filter(
                  (lectureId) =>
                    !commonLectureIds.has(
                      lectureId,
                    ),
                )
                .map((lectureId) =>
                  lectureMap.get(lectureId),
                )
                .filter(
                  (
                    lecture,
                  ): lecture is Lecture =>
                    lecture !== undefined,
                )

            return [
              timetable.id,
              differingLectures,
            ] as const
          }),
        ),
      [
        commonLectureIds,
        lectureMap,
        timetables,
      ],
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

          {summaries.map(
            (summary, index) => (
            <div
              className="timetable-comparison-grid__timetable"
              key={`${summary.timetable.id}-preview`}
            >
              <TimetableMiniPreview
                timetable={
                  summary.timetable
                }
                lectures={lectures}
                mutedLectureIds={
                  commonLectureIds
                }
                comparisonCourseClassName={
                  COMPARISON_COURSE_CLASS_NAMES[
                    index
                  ]
                }
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
                    <div className="timetable-comparison-grid__row-label">
            시간표별 과목
          </div>

          {summaries.map((summary, index) => {
            const differingLectures =
              differingLecturesByTimetableId.get(
                summary.timetable.id,
              ) ?? []

            return (
              <div
                className={`timetable-comparison-grid__differences timetable-comparison-grid__differences--${
                  ['a', 'b', 'c'][index]
                }`}
                key={`${summary.timetable.id}-differences`}
              >
                {differingLectures.length > 0 ? (
                  <ul>
                    {differingLectures.map(
                      (lecture) => (
                        <li key={lecture.id}>
                          <strong>
                            {lecture.courseName}
                          </strong>

                          <span>
                            {lecture.completionType ??
                              '구분 없음'}

                            {lecture.credits !==
                              null
                              ? ` · ${lecture.credits}학점`
                              : ''}
                          </span>
                        </li>
                      ),
                    )}
                  </ul>
                ) : (
                  <p>
                    공통 과목만 있습니다.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
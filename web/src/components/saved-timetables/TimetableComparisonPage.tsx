import {
  useMemo,
  type CSSProperties,
} from 'react'

import type { Lecture } from '../../domain/lectures/types'
import type { SavedTimetable } from '../../domain/saved-timetables'
import { TimetableMiniPreview } from './TimetableMiniPreview'

interface TimetableComparisonPageProps {
  timetables: readonly SavedTimetable[]
  lectures: readonly Lecture[]
  onBack: () => void
}

interface TimetableComparisonSummary {
  timetable: SavedTimetable
  lectures: Lecture[]
  totalCredits: number
  requiredCredits: number
  electiveCredits: number
  requiredCourseCount: number
  electiveCourseCount: number
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

  const otherCourseCount =
    timetableLectures.length -
    requiredLectures.length -
    electiveLectures.length

  return {
    timetable,
    lectures: timetableLectures,
    totalCredits:
      sumCredits(timetableLectures),
    requiredCredits:
      sumCredits(requiredLectures),
    electiveCredits:
      sumCredits(electiveLectures),
    requiredCourseCount:
      requiredLectures.length,
    electiveCourseCount:
      electiveLectures.length,
    otherCourseCount,
  }
}

export function TimetableComparisonPage({
  timetables,
  lectures,
  onBack,
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

        <button
          className="secondary-button"
          type="button"
          onClick={onBack}
        >
          ← 시간표로 돌아가기
        </button>
      </header>

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

          <div className="timetable-comparison-grid__row-label">
            총 학점
          </div>

          {summaries.map((summary) => (
            <div
              className="timetable-comparison-grid__metric"
              key={`${summary.timetable.id}-total-credits`}
            >
              <strong>
                {summary.totalCredits}
              </strong>

              <span>학점</span>
            </div>
          ))}

          <div className="timetable-comparison-grid__row-label">
            전공필수
          </div>

          {summaries.map((summary) => (
            <div
              className="timetable-comparison-grid__metric"
              key={`${summary.timetable.id}-required`}
            >
              <strong>
                {
                  summary.requiredCourseCount
                }
                개
              </strong>

              <span>
                {summary.requiredCredits}
                학점
              </span>
            </div>
          ))}

          <div className="timetable-comparison-grid__row-label">
            전공선택
          </div>

          {summaries.map((summary) => (
            <div
              className="timetable-comparison-grid__metric"
              key={`${summary.timetable.id}-elective`}
            >
              <strong>
                {
                  summary.electiveCourseCount
                }
                개
              </strong>

              <span>
                {summary.electiveCredits}
                학점
              </span>
            </div>
          ))}

          <div className="timetable-comparison-grid__row-label">
            기타 과목
          </div>

          {summaries.map((summary) => (
            <div
              className="timetable-comparison-grid__metric"
              key={`${summary.timetable.id}-other`}
            >
              <strong>
                {summary.otherCourseCount}
                개
              </strong>

              <span>
                전필·전선 외
              </span>
            </div>
          ))}

          <div className="timetable-comparison-grid__row-label">
            등록 과목
          </div>

          {summaries.map((summary) => (
            <div
              className="timetable-comparison-grid__course-list"
              key={`${summary.timetable.id}-courses`}
            >
              {summary.lectures.length >
              0 ? (
                <ul>
                  {summary.lectures.map(
                    (lecture) => (
                      <li key={lecture.id}>
                        <div>
                          <strong>
                            {
                              lecture.courseName
                            }
                          </strong>

                          <span>
                            {lecture.professor ??
                              '담당교수 미정'}
                          </span>
                        </div>

                        <small>
                          {lecture.completionType ??
                            '구분 없음'}
                        </small>
                      </li>
                    ),
                  )}
                </ul>
              ) : (
                <p>
                  등록된 과목이 없습니다.
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
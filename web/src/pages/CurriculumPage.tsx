import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import { fetchCurriculum } from '../domain/curriculum/api'
import type {
  Curriculum,
  CurriculumCompletionType,
  CurriculumCourse,
} from '../domain/curriculum/types'
import './CurriculumPage.css'

const DEFAULT_ENTRY_YEAR = 2024

interface SemesterGroup {
  grade: number
  semester: number
  courses: CurriculumCourse[]
}

interface CompletionSummary {
  courseCount: number
  credits: number
  hasUnknownCredits: boolean
}

function createSemesterGroups(
  courses: readonly CurriculumCourse[],
): SemesterGroup[] {
  const groups: SemesterGroup[] = []

  for (let grade = 1; grade <= 6; grade += 1) {
    for (
      let semester = 1;
      semester <= 2;
      semester += 1
    ) {
      groups.push({
        grade,
        semester,
        courses: courses.filter(
          (course) =>
            course.grade === grade &&
            course.semester === semester,
        ),
      })
    }
  }

  return groups
}

function summarizeCourses(
  courses: readonly CurriculumCourse[],
  completionType: CurriculumCompletionType,
): CompletionSummary {
  const matchingCourses = courses.filter(
    (course) =>
      course.completionType ===
      completionType,
  )

  return {
    courseCount: matchingCourses.length,
    credits: matchingCourses.reduce(
      (total, course) =>
        total + (course.credits ?? 0),
      0,
    ),
    hasUnknownCredits:
      matchingCourses.some(
        (course) => course.credits === null,
      ),
  }
}

function formatCredits(
  summary: CompletionSummary,
): string {
  const suffix =
    summary.hasUnknownCredits
      ? '+ 미확정'
      : ''

  return `${summary.credits}학점${suffix}`
}

function formatCourseCredits(
  credits: number | null,
): string {
  if (credits === null) {
    return '학점 미확정'
  }

  return `${credits}학점`
}

export function CurriculumPage() {
  const [
    curriculum,
    setCurriculum,
  ] = useState<Curriculum | null>(null)

  const [
    isLoading,
    setIsLoading,
  ] = useState(true)

  const [
    loadError,
    setLoadError,
  ] = useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false

    async function loadCurriculum() {
      setIsLoading(true)
      setLoadError(null)

      try {
        const result =
          await fetchCurriculum(
            DEFAULT_ENTRY_YEAR,
          )

        if (!isCancelled) {
          setCurriculum(result)
        }
      } catch (error) {
        if (isCancelled) {
          return
        }

        if (error instanceof Error) {
          setLoadError(error.message)
        } else {
          setLoadError(
            '교육과정을 불러오지 못했습니다.',
          )
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadCurriculum()

    return () => {
      isCancelled = true
    }
  }, [])

  const semesterGroups = useMemo(
    () =>
      createSemesterGroups(
        curriculum?.courses ?? [],
      ),
    [curriculum],
  )

  if (isLoading) {
    return (
      <section className="curriculum-page">
        <div className="curriculum-state">
          <p>
            교육과정을 불러오고 있습니다...
          </p>
        </div>
      </section>
    )
  }

  if (loadError !== null) {
    return (
      <section className="curriculum-page">
        <div
          className="
            curriculum-state
            curriculum-state--error
          "
          role="alert"
        >
          <h1>교육과정 조회 오류</h1>
          <p>{loadError}</p>
        </div>
      </section>
    )
  }

  if (
    curriculum === null ||
    curriculum.courses.length === 0
  ) {
    return (
      <section className="curriculum-page">
        <div className="curriculum-state">
          <h1>등록된 교육과정이 없습니다.</h1>
          <p>
            선택한 학번의 교육과정 데이터를
            확인해 주세요.
          </p>
        </div>
      </section>
    )
  }

  const requiredSummary =
    summarizeCourses(
      curriculum.courses,
      '전필',
    )

  const electiveSummary =
    summarizeCourses(
      curriculum.courses,
      '전선',
    )

  return (
    <section className="curriculum-page">
      <header className="curriculum-header">
        <div>
          <p className="curriculum-eyebrow">
            졸업 요건
          </p>

          <h1>
            {curriculum.entryYear}학번
            교육과정
          </h1>

          <p className="curriculum-description">
            학번별 전공필수·전공선택
            교육과정을 학년과 학기별로
            확인합니다.
          </p>
        </div>

        <div className="curriculum-overview">
          <div className="curriculum-overview-item">
            <span>전체 과목</span>
            <strong>
              {curriculum.count}과목
            </strong>
          </div>

          <div className="curriculum-overview-item">
            <span>전공필수</span>
            <strong>
              {requiredSummary.courseCount}
              과목 ·{' '}
              {formatCredits(
                requiredSummary,
              )}
            </strong>
          </div>

          <div className="curriculum-overview-item">
            <span>전공선택</span>
            <strong>
              {electiveSummary.courseCount}
              과목 ·{' '}
              {formatCredits(
                electiveSummary,
              )}
            </strong>
          </div>
        </div>
      </header>

      <div
        className="curriculum-semester-scroll"
        aria-label="학기별 교육과정"
      >
        <div className="curriculum-semester-list">
          {semesterGroups.map((group) => {
            const required =
              summarizeCourses(
                group.courses,
                '전필',
              )

            const elective =
              summarizeCourses(
                group.courses,
                '전선',
              )

            return (
              <article
                className="curriculum-semester-card"
                key={
                  `${group.grade}-` +
                  group.semester
                }
              >
                <header className="curriculum-semester-header">
                  <div>
                    <span>
                      {group.grade}학년
                    </span>

                    <h2>
                      {group.grade}학년{' '}
                      {group.semester}학기
                    </h2>
                  </div>

                  <strong>
                    {group.courses.length}
                    과목
                  </strong>
                </header>

                <div className="curriculum-semester-summary">
                  <div>
                    <span>전필</span>
                    <strong>
                      {required.courseCount}
                      과목
                    </strong>
                    <small>
                      {formatCredits(
                        required,
                      )}
                    </small>
                  </div>

                  <div>
                    <span>전선</span>
                    <strong>
                      {elective.courseCount}
                      과목
                    </strong>
                    <small>
                      {formatCredits(
                        elective,
                      )}
                    </small>
                  </div>
                </div>

                {group.courses.length === 0 ? (
                  <p className="curriculum-semester-empty">
                    등록된 과목이 없습니다.
                  </p>
                ) : (
                  <ul className="curriculum-course-list">
                    {group.courses.map(
                      (course) => (
                        <li
                          className="curriculum-course-item"
                          key={course.id}
                        >
                          <div className="curriculum-course-heading">
                            <strong>
                              {course.courseName}
                            </strong>

                            <span
                              className={
                                'curriculum-course-type ' +
                                (
                                  course.completionType ===
                                  '전필'
                                    ? 'curriculum-course-type--required'
                                    : 'curriculum-course-type--elective'
                                )
                              }
                            >
                              {
                                course.completionType
                              }
                            </span>
                          </div>

                          <div className="curriculum-course-meta">
                            <span>
                              {course.courseCode ??
                                '학정번호 미정'}
                            </span>

                            <span>
                              {formatCourseCredits(
                                course.credits,
                              )}
                            </span>
                          </div>

                          {course.notes !== null && (
                            <details className="curriculum-course-notes">
                              <summary>
                                세부 정보
                              </summary>

                              <p>
                                {course.notes}
                              </p>
                            </details>
                          )}
                        </li>
                      ),
                    )}
                  </ul>
                )}
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
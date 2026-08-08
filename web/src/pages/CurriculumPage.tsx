import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  GeneralEducationRequirements,
} from '../components/GeneralEducationRequirements/GeneralEducationRequirements'
import { fetchCurriculum } from '../domain/curriculum/api'
import type {
  Curriculum,
  CurriculumCompletionType,
  CurriculumCourse,
} from '../domain/curriculum/types'
import {
  fetchGeneralEducation,
} from '../domain/general-education/api'
import type {
  GeneralEducation,
} from '../domain/general-education/types'
import './CurriculumPage.css'

const DEFAULT_ENTRY_YEAR = 2024

const ENTRY_YEARS = [
  2022,
  2023,
  2024,
] as const

type CurriculumSection =
  | 'major'
  | 'generalEducation'

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

  for (
    let grade = 1;
    grade <= 6;
    grade += 1
  ) {
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
  completionType:
    CurriculumCompletionType,
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
        (course) =>
          course.credits === null,
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

  return (
    `${summary.credits}학점` +
    suffix
  )
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
    selectedEntryYear,
    setSelectedEntryYear,
  ] = useState(DEFAULT_ENTRY_YEAR)

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
    activeSection,
    setActiveSection,
  ] = useState<CurriculumSection>(
    'major',
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
    let isCancelled = false

    async function loadRequirements() {
      setIsLoading(true)
      setLoadError(null)

      try {
        const [
          curriculumResult,
          generalEducationResult,
        ] = await Promise.all([
          fetchCurriculum(
            selectedEntryYear,
          ),
          fetchGeneralEducation(
            selectedEntryYear,
          ),
        ])

        if (!isCancelled) {
          setCurriculum(
            curriculumResult,
          )

          setGeneralEducation(
            generalEducationResult,
          )
        }
      } catch (error) {
        if (isCancelled) {
          return
        }

        if (error instanceof Error) {
          setLoadError(error.message)
        } else {
          setLoadError(
            '졸업요건을 불러오지 못했습니다.',
          )
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadRequirements()

    return () => {
      isCancelled = true
    }
  }, [selectedEntryYear])

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
            졸업요건을 불러오고 있습니다...
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
          <h1>졸업요건 조회 오류</h1>
          <p>{loadError}</p>
        </div>
      </section>
    )
  }

  if (
    curriculum === null ||
    generalEducation === null
  ) {
    return (
      <section className="curriculum-page">
        <div className="curriculum-state">
          <h1>
            졸업요건 데이터를
            불러오지 못했습니다.
          </h1>

          <p>
            다시 시도해 주세요.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="curriculum-page">
      <header className="curriculum-header">
        <div>
          <p className="curriculum-eyebrow">
            졸업 요건
          </p>

          <h1>
            {selectedEntryYear}학번{' '}
            {activeSection === 'major'
              ? '전공 교육과정'
              : '교양 졸업요건'}
          </h1>

          <p className="curriculum-description">
            {activeSection === 'major' ? (
              <>
                학번별 전공필수·전공선택
                교육과정을 학년과
                학기별로 확인합니다.
              </>
            ) : (
              <>
                학번별 기초교양·균형교양
                이수학점과 세부 영역을
                확인합니다.
              </>
            )}
          </p>
        </div>

        <label className="curriculum-entry-year-select">
          <span>학번</span>

          <select
            value={selectedEntryYear}
            onChange={(event) => {
              setSelectedEntryYear(
                Number(event.target.value),
              )
            }}
          >
            {ENTRY_YEARS.map(
              (entryYear) => (
                <option
                  key={entryYear}
                  value={entryYear}
                >
                  {entryYear}학번
                </option>
              ),
            )}
          </select>
        </label>
      </header>

      <div
        className="curriculum-section-switch"
        role="tablist"
        aria-label="교육과정 구분"
      >
        <button
          aria-selected={
            activeSection === 'major'
          }
          className={
            'curriculum-section-switch-button ' +
            (
              activeSection === 'major'
                ? 'curriculum-section-switch-button--active'
                : ''
            )
          }
          onClick={() => {
            setActiveSection('major')
          }}
          role="tab"
          type="button"
        >
          전공
        </button>

        <button
          aria-selected={
            activeSection ===
            'generalEducation'
          }
          className={
            'curriculum-section-switch-button ' +
            (
              activeSection ===
              'generalEducation'
                ? 'curriculum-section-switch-button--active'
                : ''
            )
          }
          onClick={() => {
            setActiveSection(
              'generalEducation',
            )
          }}
          role="tab"
          type="button"
        >
          교양
        </button>
      </div>

      {activeSection === 'major' ? (
        curriculum.courses.length === 0 ? (
          <div className="curriculum-inline-empty">
            <strong>
              {selectedEntryYear}학번 전공
              교육과정 데이터가 없습니다.
            </strong>

            <p>
              해당 학번의 전공필수·전공선택
              교육과정이 아직 등록되지
              않았습니다.
            </p>
          </div>
        ) : (
        <div
          className="curriculum-semester-scroll"
          aria-label="학기별 전공 교육과정"
        >
          <div className="curriculum-semester-list">
            {semesterGroups.map(
              (group) => {
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
                          {
                            required.courseCount
                          }
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
                          {
                            elective.courseCount
                          }
                          과목
                        </strong>

                        <small>
                          {formatCredits(
                            elective,
                          )}
                        </small>
                      </div>
                    </div>

                    {group.courses.length ===
                    0 ? (
                      <p className="curriculum-semester-empty">
                        등록된 과목이
                        없습니다.
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
                                  {
                                    course.courseName
                                  }
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

                              {course.notes !==
                                null && (
                                <details className="curriculum-course-notes">
                                  <summary>
                                    세부 정보
                                  </summary>

                                  <p>
                                    {
                                      course.notes
                                    }
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
              },
            )}
          </div>
        </div>
        )
      ) : generalEducation.requirements.length ===
        0 ? (
        <div className="curriculum-inline-empty">
          <strong>
            {selectedEntryYear}학번 교양
            졸업요건 데이터가 없습니다.
          </strong>

          <p>
            해당 학번의 교양 교육과정이
            아직 등록되지 않았습니다.
          </p>
        </div>
      ) : (
        <GeneralEducationRequirements
          generalEducation={
            generalEducation
          }
        />
      )}
    </section>
  )
}
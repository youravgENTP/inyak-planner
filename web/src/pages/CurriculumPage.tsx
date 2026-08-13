import {
  useEffect,
  useMemo,
  useRef,
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

interface CurriculumChangeGroup {
  id: string
  changeType:
    CurriculumCourse['changeType']
  effectiveYear: number | null
  note: string | null
  legacyCourses: CurriculumCourse[]
  currentCourses: CurriculumCourse[]
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

function summarizeCourseSet(
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

function summarizeCourses(
  courses: readonly CurriculumCourse[],
  completionType:
    CurriculumCompletionType,
): CompletionSummary {
  return summarizeCourseSet(
    courses.filter(
      (course) =>
        course.changeRole === 'current',
    ),
    completionType,
  )
}

function getCurrentCurriculumCourses(
  courses: readonly CurriculumCourse[],
): CurriculumCourse[] {
  return courses.filter(
    (course) =>
      course.changeRole === 'current',
  )
}

function getOriginalCurriculumCourses(
  courses: readonly CurriculumCourse[],
): CurriculumCourse[] {
  const originalCourses:
    CurriculumCourse[] = []

  for (const course of courses) {
    if (course.changeRole === 'legacy') {
      originalCourses.push(course)
      continue
    }

    if (course.changeGroup !== null) {
      continue
    }

    const hasAttributeChange =
      course.previousCredits !== null ||
      course.previousCompletionType !== null ||
      course.previousGrade !== null ||
      course.previousSemester !== null

    if (!hasAttributeChange) {
      originalCourses.push(course)
      continue
    }

    originalCourses.push({
      ...course,
      credits:
        course.previousCredits ??
        course.credits,
      completionType:
        course.previousCompletionType ??
        course.completionType,
      grade:
        course.previousGrade ??
        course.grade,
      semester:
        course.previousSemester ??
        course.semester,
    })
  }

  return originalCourses
}

function createChangeGroups(
  courses: readonly CurriculumCourse[],
): CurriculumChangeGroup[] {
  const groups =
    new Map<
      string,
      CurriculumChangeGroup
    >()

  for (const course of courses) {
    if (course.changeGroup === null) {
      continue
    }

    let group = groups.get(
      course.changeGroup,
    )

    if (group === undefined) {
      group = {
        id: course.changeGroup,
        changeType:
          course.changeType,
        effectiveYear:
          course.changeEffectiveYear,
        note: course.changeNote,
        legacyCourses: [],
        currentCourses: [],
      }

      groups.set(
        course.changeGroup,
        group,
      )
    }

    if (
      group.effectiveYear === null &&
      course.changeEffectiveYear !== null
    ) {
      group.effectiveYear =
        course.changeEffectiveYear
    }

    if (
      group.note === null &&
      course.changeNote !== null
    ) {
      group.note =
        course.changeNote
    }

    if (course.changeRole === 'legacy') {
      group.legacyCourses.push(course)
    } else {
      group.currentCourses.push(course)
    }
  }

  return [...groups.values()].sort(
    (firstGroup, secondGroup) => {
      const firstYear =
        firstGroup.effectiveYear ??
        Number.MAX_SAFE_INTEGER

      const secondYear =
        secondGroup.effectiveYear ??
        Number.MAX_SAFE_INTEGER

      if (firstYear !== secondYear) {
        return firstYear - secondYear
      }

      return firstGroup.id.localeCompare(
        secondGroup.id,
      )
    },
  )
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

function formatCourseReference(
  course: CurriculumCourse,
): string {
  return (
    `${course.courseName} · ` +
    `${course.courseCode ??
      '학정번호 미정'} · ` +
    formatCourseCredits(
      course.credits,
    )
  )
}

function formatCourseState({
  grade,
  semester,
  completionType,
  credits,
}: {
  grade: number
  semester: number
  completionType:
    CurriculumCompletionType
  credits: number | null
}): string {
  return (
    `${grade}학년 ${semester}학기 · ` +
    `${completionType} · ` +
    (
      credits === null
        ? '학점 미확정'
        : `${credits}학점`
    )
  )
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

  const topSemesterScrollRef =
    useRef<HTMLDivElement | null>(null)

  const semesterScrollRef =
    useRef<HTMLDivElement | null>(null)

  const [
    semesterScrollWidth,
    setSemesterScrollWidth,
  ] = useState(0)

  const [
    activeChangeGroup,
    setActiveChangeGroup,
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

  const currentCurriculumCourses =
    useMemo(
      () =>
        getCurrentCurriculumCourses(
          curriculum?.courses ?? [],
        ),
      [curriculum],
    )

  const originalCurriculumCourses =
    useMemo(
      () =>
        getOriginalCurriculumCourses(
          curriculum?.courses ?? [],
        ),
      [curriculum],
    )

  const changeGroups = useMemo(
    () =>
      createChangeGroups(
        curriculum?.courses ?? [],
      ),
    [curriculum],
  )

  const attributeChanges = useMemo(
    () =>
      (curriculum?.courses ?? [])
        .filter(
          (course) =>
            course.changeRole ===
              'current' &&
            course.changeGroup === null &&
            (
              course.previousCredits !==
                null ||
              course.previousCompletionType !==
                null ||
              course.previousGrade !==
                null ||
              course.previousSemester !==
                null
            ),
        )
        .sort(
          (
            firstCourse,
            secondCourse,
          ) => {
            const firstYear =
              firstCourse
                .attributeChangeEffectiveYear ??
              Number.MAX_SAFE_INTEGER

            const secondYear =
              secondCourse
                .attributeChangeEffectiveYear ??
              Number.MAX_SAFE_INTEGER

            if (firstYear !== secondYear) {
              return firstYear - secondYear
            }

            if (
              firstCourse.grade !==
              secondCourse.grade
            ) {
              return (
                firstCourse.grade -
                secondCourse.grade
              )
            }

            if (
              firstCourse.semester !==
              secondCourse.semester
            ) {
              return (
                firstCourse.semester -
                secondCourse.semester
              )
            }

            return firstCourse.courseName.localeCompare(
              secondCourse.courseName,
            )
          },
        ),
    [curriculum],
  )

  const changeCount =
    changeGroups.length +
    attributeChanges.length

  const curriculumComparison = useMemo(
    () => ({
      originalRequired:
        summarizeCourseSet(
          originalCurriculumCourses,
          '전필',
        ),
      originalElective:
        summarizeCourseSet(
          originalCurriculumCourses,
          '전선',
        ),
      currentRequired:
        summarizeCourseSet(
          currentCurriculumCourses,
          '전필',
        ),
      currentElective:
        summarizeCourseSet(
          currentCurriculumCourses,
          '전선',
        ),
    }),
    [
      currentCurriculumCourses,
      originalCurriculumCourses,
    ],
  )

  useEffect(() => {
    if (activeSection !== 'major') {
      setSemesterScrollWidth(0)
      return
    }

    const semesterScroll =
      semesterScrollRef.current

    if (semesterScroll === null) {
      return
    }

    const updateScrollWidth = () => {
      setSemesterScrollWidth(
        semesterScroll.scrollWidth,
      )

      const topScroll =
        topSemesterScrollRef.current

      if (topScroll !== null) {
        topScroll.scrollLeft =
          semesterScroll.scrollLeft
      }
    }

    updateScrollWidth()

    window.addEventListener(
      'resize',
      updateScrollWidth,
    )

    return () => {
      window.removeEventListener(
        'resize',
        updateScrollWidth,
      )
    }
  }, [
    activeSection,
    curriculum,
  ])

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
          <div className="curriculum-major-content">
            <details className="curriculum-change-panel">
              <summary>
                <div>
                  <strong>
                    변경 사항
                  </strong>

                  <span>
                    입학 당시 과목표와 현재
                    적용 과목표를 비교합니다.
                  </span>
                </div>

                <span className="curriculum-change-count">
                  {changeCount}건
                </span>
              </summary>

              <div className="curriculum-change-panel-body">
                <div className="curriculum-change-overview">
                  <div>
                    <span>
                      입학 당시 과목표
                    </span>

                    <strong>
                      전필{' '}
                      {
                        curriculumComparison
                          .originalRequired
                          .courseCount
                      }
                      과목 ·{' '}
                      {formatCredits(
                        curriculumComparison
                          .originalRequired,
                      )}
                    </strong>

                    <small>
                      전선{' '}
                      {
                        curriculumComparison
                          .originalElective
                          .courseCount
                      }
                      과목 ·{' '}
                      {formatCredits(
                        curriculumComparison
                          .originalElective,
                      )}
                    </small>
                  </div>

                  <div>
                    <span>
                      현재 적용 과목표
                    </span>

                    <strong>
                      전필{' '}
                      {
                        curriculumComparison
                          .currentRequired
                          .courseCount
                      }
                      과목 ·{' '}
                      {formatCredits(
                        curriculumComparison
                          .currentRequired,
                      )}
                    </strong>

                    <small>
                      전선{' '}
                      {
                        curriculumComparison
                          .currentElective
                          .courseCount
                      }
                      과목 ·{' '}
                      {formatCredits(
                        curriculumComparison
                          .currentElective,
                      )}
                    </small>
                  </div>
                </div>

                <p className="curriculum-change-guidance">
                  이 비교는 교육과정 과목표의
                  구성 변화를 보여줍니다.
                  공식 최소 졸업학점 자체는
                  별도의 졸업요건 데이터를
                  기준으로 합니다.
                </p>

                {changeCount === 0 ? (
                  <p className="curriculum-change-empty">
                    현재 등록된 과목 변경
                    관계가 없습니다.
                  </p>
                ) : (
                  <div className="curriculum-change-list">
                    {changeGroups.map(
                      (changeGroup) => (
                        <article
                          className="curriculum-change-item"
                          key={changeGroup.id}
                        >
                          <header>
                            <strong>
                              {
                                changeGroup.changeType ??
                                '변경'
                              }
                            </strong>

                            <span>
                              {changeGroup.effectiveYear ===
                              null
                                ? '적용 학년도 미정'
                                : `${changeGroup.effectiveYear}학년도 반영`}
                            </span>
                          </header>

                          <div className="curriculum-change-course-map">
                            <div>
                              <span>
                                변경 전
                              </span>

                              <ul>
                                {changeGroup
                                  .legacyCourses
                                  .map(
                                    (course) => (
                                      <li
                                        key={
                                          course.id
                                        }
                                      >
                                        {formatCourseReference(
                                          course,
                                        )}
                                      </li>
                                    ),
                                  )}
                              </ul>
                            </div>

                            <div>
                              <span>
                                현재 적용
                              </span>

                              <ul>
                                {changeGroup
                                  .currentCourses
                                  .map(
                                    (course) => (
                                      <li
                                        key={
                                          course.id
                                        }
                                      >
                                        {formatCourseReference(
                                          course,
                                        )}
                                      </li>
                                    ),
                                  )}
                              </ul>
                            </div>
                          </div>

                          <p className="curriculum-change-reason">
                            {changeGroup.note ??
                              '변경 사유가 아직 입력되지 않았습니다.'}
                          </p>
                        </article>
                      ),
                    )}
                  {attributeChanges.map(
                    (course) => (
                      <article
                        className="curriculum-change-item"
                        key={`attribute-${course.id}`}
                      >
                        <header>
                          <strong>
                            속성 변경
                          </strong>

                          <span>
                            {course
                              .attributeChangeEffectiveYear ===
                            null
                              ? '적용 학년도 미정'
                              : `${course.attributeChangeEffectiveYear}학년도 반영`}
                          </span>
                        </header>

                        <strong>
                          {course.courseName}
                        </strong>

                        <div className="curriculum-change-course-map">
                          <div>
                            <span>
                              변경 전
                            </span>

                            <ul>
                              <li>
                                {formatCourseState({
                                  grade:
                                    course.previousGrade ??
                                    course.grade,
                                  semester:
                                    course.previousSemester ??
                                    course.semester,
                                  completionType:
                                    course
                                      .previousCompletionType ??
                                    course.completionType,
                                  credits:
                                    course.previousCredits ??
                                    course.credits,
                                })}
                              </li>
                            </ul>
                          </div>

                          <div>
                            <span>
                              현재 적용
                            </span>

                            <ul>
                              <li>
                                {formatCourseState({
                                  grade: course.grade,
                                  semester:
                                    course.semester,
                                  completionType:
                                    course.completionType,
                                  credits:
                                    course.credits,
                                })}
                              </li>
                            </ul>
                          </div>
                        </div>

                        <p className="curriculum-change-reason">
                          {course.attributeChangeNote ??
                            '동일 과목의 교육과정 속성이 변경되었습니다.'}
                        </p>
                      </article>
                    ),
                  )}
                  </div>
                )}
              </div>
            </details>

            <div
              aria-hidden="true"
              className="curriculum-top-scroll"
              onScroll={(event) => {
                const semesterScroll =
                  semesterScrollRef.current

                if (
                  semesterScroll !== null &&
                  semesterScroll.scrollLeft !==
                    event.currentTarget
                      .scrollLeft
                ) {
                  semesterScroll.scrollLeft =
                    event.currentTarget
                      .scrollLeft
                }
              }}
              ref={topSemesterScrollRef}
            >
              <div
                className="curriculum-top-scroll-spacer"
                style={{
                  width:
                    `${semesterScrollWidth}px`,
                }}
              />
            </div>

            <div
              aria-label="학기별 전공 교육과정"
              className="curriculum-semester-scroll"
              onScroll={(event) => {
                const topScroll =
                  topSemesterScrollRef.current

                if (
                  topScroll !== null &&
                  topScroll.scrollLeft !==
                    event.currentTarget
                      .scrollLeft
                ) {
                  topScroll.scrollLeft =
                    event.currentTarget
                      .scrollLeft
                }
              }}
              ref={semesterScrollRef}
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

                    const currentCourseCount =
                      required.courseCount +
                      elective.courseCount

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
                              {group.semester}
                              학기
                            </h2>
                          </div>

                          <strong>
                            {
                              currentCourseCount
                            }
                            과목
                          </strong>
                        </header>

                        <div className="curriculum-semester-summary">
                          <div>
                            <span>전필</span>

                            <strong>
                              {
                                required
                                  .courseCount
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
                                elective
                                  .courseCount
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
                              (course) => {
                                const isHighlighted =
                                  course.changeGroup !==
                                    null &&
                                  course.changeGroup ===
                                    activeChangeGroup

                                const relatedCourses =
                                  course.changeGroup ===
                                  null
                                    ? []
                                    : curriculum.courses.filter(
                                        (
                                          relatedCourse,
                                        ) =>
                                          relatedCourse
                                            .changeGroup ===
                                            course.changeGroup &&
                                          relatedCourse
                                            .changeRole !==
                                            course.changeRole,
                                      )

                                const className = [
                                  'curriculum-course-item',
                                  course.changeRole ===
                                  'legacy'
                                    ? 'curriculum-course-item--legacy'
                                    : '',
                                  isHighlighted
                                    ? 'curriculum-course-item--change-highlighted'
                                    : '',
                                ]
                                  .filter(Boolean)
                                  .join(' ')

                                return (
                                  <li
                                    className={
                                      className
                                    }
                                    key={
                                      course.id
                                    }
                                    onBlur={(
                                      event,
                                    ) => {
                                      if (
                                        !event.currentTarget.contains(
                                          event.relatedTarget as
                                            | Node
                                            | null,
                                        )
                                      ) {
                                        setActiveChangeGroup(
                                          null,
                                        )
                                      }
                                    }}
                                    onFocus={() => {
                                      if (
                                        course.changeGroup !==
                                        null
                                      ) {
                                        setActiveChangeGroup(
                                          course.changeGroup,
                                        )
                                      }
                                    }}
                                    onMouseEnter={() => {
                                      if (
                                        course.changeGroup !==
                                        null
                                      ) {
                                        setActiveChangeGroup(
                                          course.changeGroup,
                                        )
                                      }
                                    }}
                                    onMouseLeave={() => {
                                      setActiveChangeGroup(
                                        null,
                                      )
                                    }}
                                    tabIndex={
                                      course.changeGroup ===
                                      null
                                        ? undefined
                                        : 0
                                    }
                                  >
                                    <div className="curriculum-course-heading">
                                      <div className="curriculum-course-title">
                                        <strong>
                                          {
                                            course.courseName
                                          }
                                        </strong>

                                        {course.changeRole ===
                                          'legacy' && (
                                          <span className="curriculum-course-change-badge">
                                            변경
                                          </span>
                                        )}
                                      </div>

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

                                    {(course.notes !==
                                      null ||
                                      course.changeGroup !==
                                        null ||
                                      course.changeNote !==
                                        null) && (
                                      <details className="curriculum-course-notes">
                                        <summary>
                                          세부 정보
                                        </summary>

                                        {course.notes !==
                                          null && (
                                          <p>
                                            {
                                              course.notes
                                            }
                                          </p>
                                        )}

                                        {course.changeNote !==
                                          null &&
                                          course.changeNote !==
                                            course.notes && (
                                            <p className="curriculum-course-change-note">
                                              {
                                                course.changeNote
                                              }
                                            </p>
                                          )}

                                        {course.changeGroup !==
                                          null && (
                                          <div className="curriculum-course-change-details">
                                            <strong>
                                              {course.changeRole ===
                                              'legacy'
                                                ? '현재 적용 과목'
                                                : '변경 전 과목'}
                                            </strong>

                                            {relatedCourses.length ===
                                            0 ? (
                                              <p>
                                                연결된
                                                과목 정보가
                                                없습니다.
                                              </p>
                                            ) : (
                                              <ul>
                                                {relatedCourses.map(
                                                  (
                                                    relatedCourse,
                                                  ) => (
                                                    <li
                                                      key={
                                                        relatedCourse.id
                                                      }
                                                    >
                                                      {formatCourseReference(
                                                        relatedCourse,
                                                      )}
                                                    </li>
                                                  ),
                                                )}
                                              </ul>
                                            )}
                                          </div>
                                        )}
                                      </details>
                                    )}
                                  </li>
                                )
                              },
                            )}
                          </ul>
                        )}
                      </article>
                    )
                  },
                )}
              </div>
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
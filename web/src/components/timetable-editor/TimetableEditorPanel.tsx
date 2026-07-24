import { useMemo, useState } from 'react'

import type { Lecture } from '../../domain/lectures/types'

type SearchMode =
  | 'courseName'
  | 'professor'
  | 'courseCode'

type CompletionTypeFilter =
  | 'all'
  | 'required'
  | 'elective'

type YearFilter = 'all' | number

interface TimetableEditorPanelProps {
  lectures: Lecture[]
  selectedLectures: Lecture[]
  previewLectureId: number | null
  previewConflictCourseTitles: string[]
  onAddLecture: (lecture: Lecture) => void
  onPreviewLectureChange: (
    lecture: Lecture | null,
  ) => void
}

const SEARCH_MODE_LABELS: Record<SearchMode, string> = {
  courseName: '과목명',
  professor: '교수',
  courseCode: '학정번호',
}

function getSearchPlaceholder(
  searchMode: SearchMode,
): string {
  switch (searchMode) {
    case 'professor':
      return '교수명을 입력하세요'

    case 'courseCode':
      return '학정번호를 입력하세요'

    case 'courseName':
    default:
      return '과목명을 입력하세요'
  }
}

function getLectureSearchValue(
  lecture: Lecture,
  searchMode: SearchMode,
): string {
  switch (searchMode) {
    case 'professor':
      return lecture.professor ?? ''

    case 'courseCode':
      return lecture.courseCode

    case 'courseName':
    default:
      return lecture.courseName
  }
}

function formatCompletionType(
  completionType: string | null,
): string {
  const originalType =
    completionType?.trim() ?? ''

  const normalizedType =
    originalType.toUpperCase()

  if (
    normalizedType === 'ME' ||
    originalType === '전필'
  ) {
    return '전필'
  }

  if (
    normalizedType === 'MR' ||
    originalType === '전선'
  ) {
    return '전선'
  }

  return originalType || '이수구분 없음'
}

function matchesCompletionTypeFilter(
  lecture: Lecture,
  filter: CompletionTypeFilter,
): boolean {
  if (filter === 'all') {
    return true
  }

  const completionType =
    formatCompletionType(
      lecture.completionType,
    )

  if (filter === 'required') {
    return completionType === '전필'
  }

  return completionType === '전선'
}

function matchesYearFilter(
  lecture: Lecture,
  filter: YearFilter,
): boolean {
  if (filter === 'all') {
    return true
  }

  return lecture.recommendedYear === filter
}

function formatLectureSection(
  section: string,
): string {
  if (!section.trim()) {
    return '분반 정보 없음'
  }

  return `${section}분반`
}

function formatLectureSchedule(
  lecture: Lecture,
): string {
  return (
    lecture.scheduleAndRoom ??
    '시간 및 강의실 정보 없음'
  )
}

function formatLectureYear(
  recommendedYear: number | null,
): string {
  if (recommendedYear === null) {
    return '학년 정보 없음'
  }

  return `${recommendedYear}학년`
}

function formatLectureCredits(
  credits: number | null,
): string {
  if (credits === null) {
    return '학점 정보 없음'
  }

  return `${credits}학점`
}

export function TimetableEditorPanel({
  lectures,
  selectedLectures,
  previewLectureId,
  previewConflictCourseTitles,
  onAddLecture,
  onPreviewLectureChange,
}: TimetableEditorPanelProps) {
  const [searchMode, setSearchMode] =
    useState<SearchMode>('courseName')

  const [searchQuery, setSearchQuery] =
    useState('')

  const [
    completionTypeFilter,
    setCompletionTypeFilter,
  ] =
    useState<CompletionTypeFilter>('all')

  const [yearFilter, setYearFilter] =
    useState<YearFilter>('all')

  const normalizedQuery = searchQuery
    .trim()
    .toLocaleLowerCase()

  const availableYears = useMemo(() => {
    const yearSet = new Set<number>()

    lectures.forEach((lecture) => {
      if (lecture.recommendedYear !== null) {
        yearSet.add(lecture.recommendedYear)
      }
    })

    return [...yearSet].sort(
      (firstYear, secondYear) =>
        firstYear - secondYear,
    )
  }, [lectures])

  const selectedLectureIds = useMemo(
    () =>
      new Set(
        selectedLectures.map(
          (lecture) => lecture.id,
        ),
      ),
    [selectedLectures],
  )

  const filteredLectures = useMemo(() => {
    return lectures.filter((lecture) => {
      const matchesSearch =
        !normalizedQuery ||
        getLectureSearchValue(
          lecture,
          searchMode,
        )
          .toLocaleLowerCase()
          .includes(normalizedQuery)

      const matchesCompletionType =
        matchesCompletionTypeFilter(
          lecture,
          completionTypeFilter,
        )

      const matchesYear =
        matchesYearFilter(
          lecture,
          yearFilter,
        )

      return (
        matchesSearch &&
        matchesCompletionType &&
        matchesYear
      )
    })
  }, [
    lectures,
    normalizedQuery,
    searchMode,
    completionTypeFilter,
    yearFilter,
  ])

  function handleSearchModeChange(
    nextMode: SearchMode,
  ) {
    setSearchMode(nextMode)
    setSearchQuery('')
    onPreviewLectureChange(null)
  }

  function handleAddLecture(
    lecture: Lecture,
  ) {
    if (selectedLectureIds.has(lecture.id)) {
      return
    }

    onAddLecture(lecture)
    onPreviewLectureChange(null)
  }

  function handlePreviewStart(
    lecture: Lecture,
  ) {
    if (selectedLectureIds.has(lecture.id)) {
      return
    }

    onPreviewLectureChange(lecture)
  }

  function handlePreviewEnd() {
    onPreviewLectureChange(null)
  }

  return (
    <aside
      className="timetable-editor-panel"
      aria-label="시간표 과목 편집"
    >
      <section className="editor-search-section">
        <div className="editor-section-heading">
          <div>
            <h2>과목 검색</h2>

            <p>
              시간표에 추가할 강의를 검색합니다.
            </p>
          </div>
        </div>

        <div
          className="lecture-search-modes"
          role="radiogroup"
          aria-label="검색 기준"
        >
          {(
            Object.entries(
              SEARCH_MODE_LABELS,
            ) as [SearchMode, string][]
          ).map(([mode, label]) => (
            <label key={mode}>
              <input
                type="radio"
                name="lecture-search-mode"
                value={mode}
                checked={searchMode === mode}
                onChange={() =>
                  handleSearchModeChange(mode)
                }
              />

              <span>{label}</span>
            </label>
          ))}
        </div>

        <label className="lecture-search-field">
          <input
            type="search"
            value={searchQuery}
            placeholder={getSearchPlaceholder(
              searchMode,
            )}
            onChange={(event) => {
              setSearchQuery(
                event.target.value,
              )

              onPreviewLectureChange(null)
            }}
          />
        </label>
      </section>

      <section
        className="editor-list-section editor-list-section--full"
        aria-labelledby="search-results-title"
      >
        <div className="editor-list-heading">
          <div className="editor-list-title-group">
            <h3 id="search-results-title">
              검색 결과
            </h3>

            <span>
              {filteredLectures.length}개
            </span>
          </div>

          <div className="lecture-result-filters">
            <label className="result-filter-field">
              <span>학년</span>

              <select
                value={yearFilter}
                onChange={(event) => {
                  const nextValue =
                    event.target.value

                  setYearFilter(
                    nextValue === 'all'
                      ? 'all'
                      : Number(nextValue),
                  )

                  onPreviewLectureChange(null)
                }}
              >
                <option value="all">
                  전체
                </option>

                {availableYears.map((year) => (
                  <option
                    value={year}
                    key={year}
                  >
                    {year}학년
                  </option>
                ))}
              </select>
            </label>

            <label className="result-filter-field">
              <span>이수구분</span>

              <select
                value={completionTypeFilter}
                onChange={(event) => {
                  setCompletionTypeFilter(
                    event.target
                      .value as CompletionTypeFilter,
                  )

                  onPreviewLectureChange(null)
                }}
              >
                <option value="all">
                  전체
                </option>

                <option value="required">
                  전필
                </option>

                <option value="elective">
                  전선
                </option>
              </select>
            </label>
          </div>
        </div>

        <div className="editor-list-scroll">
          {filteredLectures.length === 0 ? (
            <div className="editor-empty-state">
              <p>
                검색 조건에 해당하는 수업이
                없습니다.
              </p>
            </div>
          ) : (
            <ul className="lecture-result-list">
              {filteredLectures.map(
                (lecture) => {
                  const isAlreadyAdded =
                    selectedLectureIds.has(
                      lecture.id,
                    )

                  const isCurrentPreview =
                    previewLectureId ===
                    lecture.id

                  const isConflictingPreview =
                    isCurrentPreview &&
                    previewConflictCourseTitles
                      .length > 0

                  const conflictTooltip =
                    isConflictingPreview
                      ? `시간이 겹치는 수업: ${previewConflictCourseTitles.join(
                          ', ',
                        )}`
                      : undefined

                  const itemClassName = [
                    'lecture-result-item',
                    isConflictingPreview
                      ? 'lecture-result-item--conflicting'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')

                  return (
                    <li
                      className={itemClassName}
                      key={lecture.id}
                      title={conflictTooltip}
                      onMouseEnter={() =>
                        handlePreviewStart(
                          lecture,
                        )
                      }
                      onMouseLeave={
                        handlePreviewEnd
                      }
                      onFocusCapture={() =>
                        handlePreviewStart(
                          lecture,
                        )
                      }
                      onBlurCapture={
                        handlePreviewEnd
                      }
                    >
                      <div className="lecture-result-content">
                        <strong className="lecture-result-title">
                          {lecture.courseName}
                        </strong>

                        <span className="lecture-result-meta">
                          {lecture.professor ??
                            '교수 정보 없음'}
                          {' · '}
                          {formatCompletionType(
                            lecture.completionType,
                          )}
                          {' · '}
                          {lecture.courseCode}
                          {' · '}
                          {formatLectureSection(
                            lecture.section,
                          )}
                        </span>

                        <span className="lecture-result-meta">
                          {formatLectureSchedule(
                            lecture,
                          )}
                          {' · '}
                          {formatLectureYear(
                            lecture.recommendedYear,
                          )}
                          {' · '}
                          {formatLectureCredits(
                            lecture.credits,
                          )}
                        </span>

                        {isConflictingPreview && (
                          <span className="lecture-result-conflict-message">
                            {previewConflictCourseTitles.join(
                              ', ',
                            )}
                            과 시간이 겹칩니다.
                          </span>
                        )}
                      </div>

                      <span
                        className="lecture-add-button-wrapper"
                        title={
                          isAlreadyAdded
                            ? '이미 추가된 강의입니다.'
                            : isConflictingPreview
                              ? conflictTooltip
                              : '시간표에 추가'
                        }
                      >
                        <button
                          className="lecture-add-button"
                          type="button"
                          aria-label={`${lecture.courseName} 시간표에 추가`}
                          disabled={
                            isAlreadyAdded
                          }
                          onClick={() =>
                            handleAddLecture(
                              lecture,
                            )
                          }
                        >
                          +
                        </button>
                      </span>
                    </li>
                  )
                },
              )}
            </ul>
          )}
        </div>
      </section>
    </aside>
  )
}
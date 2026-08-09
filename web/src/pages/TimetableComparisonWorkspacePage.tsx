import {
  useEffect,
  useMemo,
  useState,
  type DragEvent,
} from 'react'

import {
  TimetableComparisonPage,
} from '../components/saved-timetables/TimetableComparisonPage'

import {
  TimetableGraduationSimulation,
} from '../components/saved-timetables/TimetableGraduationSimulation'

import type {
  AuthUser,
} from '../domain/auth/api'

import {
  fetchLectures,
} from '../domain/lectures/api'

import type {
  Lecture,
} from '../domain/lectures/types'

import type {
  AcademicSemester,
  SavedTimetable,
} from '../domain/saved-timetables'

import './TimetableComparisonWorkspacePage.css'


const MAX_COMPARISON_TIMETABLES = 3

const TIMETABLE_DRAG_DATA_TYPE =
  'application/x-inyak-timetable-id'


interface TimetableComparisonWorkspacePageProps {
  user: AuthUser

  timetables:
    readonly SavedTimetable[]
}


function getLatestTimetable(
  timetables:
    readonly SavedTimetable[],
): SavedTimetable | undefined {
  return [...timetables].sort(
    (firstTimetable, secondTimetable) =>
      (
        secondTimetable.academicYear -
        firstTimetable.academicYear
      ) ||
      (
        secondTimetable.semester -
        firstTimetable.semester
      ),
  )[0]
}


export function TimetableComparisonWorkspacePage({
  user,
  timetables,
}: TimetableComparisonWorkspacePageProps) {
  const initialTimetable =
    getLatestTimetable(timetables)

  const [
    selectedAcademicYear,
    setSelectedAcademicYear,
  ] = useState(
    initialTimetable?.academicYear ??
    2026,
  )

  const [
    selectedSemester,
    setSelectedSemester,
  ] = useState<AcademicSemester>(
    initialTimetable?.semester ?? 2,
  )

  const [
    selectedTimetableIds,
    setSelectedTimetableIds,
  ] = useState<string[]>([])

  const [
    isSimulationOpen,
    setIsSimulationOpen,
  ] = useState(false)

  const [
    lectures,
    setLectures,
  ] = useState<Lecture[]>([])

  const [
    isLoadingLectures,
    setIsLoadingLectures,
  ] = useState(true)

  const [
    lectureLoadError,
    setLectureLoadError,
  ] = useState<string | null>(null)


  const availableAcademicYears =
    useMemo(
      () =>
        [
          ...new Set(
            timetables.map(
              (timetable) =>
                timetable.academicYear,
            ),
          ),
        ].sort(
          (
            firstAcademicYear,
            secondAcademicYear,
          ) =>
            secondAcademicYear -
            firstAcademicYear,
        ),
      [timetables],
    )


  const filteredTimetables =
    useMemo(
      () =>
        timetables.filter(
          (timetable) =>
            timetable.academicYear ===
              selectedAcademicYear &&
            timetable.semester ===
              selectedSemester,
        ),
      [
        selectedAcademicYear,
        selectedSemester,
        timetables,
      ],
    )


  const selectedTimetables =
    useMemo(
      () =>
        selectedTimetableIds
          .map((timetableId) =>
            timetables.find(
              (timetable) =>
                timetable.id ===
                timetableId,
            ),
          )
          .filter(
            (
              timetable,
            ): timetable is SavedTimetable =>
              timetable !== undefined,
          )
          .slice(
            0,
            MAX_COMPARISON_TIMETABLES,
          ),
      [
        selectedTimetableIds,
        timetables,
      ],
    )


  useEffect(() => {
    async function loadLectures() {
      try {
        setIsLoadingLectures(true)
        setLectureLoadError(null)

        const loadedLectures =
          await fetchLectures()

        setLectures(loadedLectures)
      } catch (error) {
        setLectureLoadError(
          error instanceof Error
            ? error.message
            : (
              '강의 목록을 ' +
              '불러오지 못했습니다.'
            ),
        )
      } finally {
        setIsLoadingLectures(false)
      }
    }

    void loadLectures()
  }, [])


  function handleAcademicYearChange(
    academicYear: number,
  ) {
    setSelectedAcademicYear(
      academicYear,
    )

    setSelectedTimetableIds([])
        setIsSimulationOpen(false)
  }


  function handleSemesterChange(
    semester: AcademicSemester,
  ) {
    setSelectedSemester(semester)

    setSelectedTimetableIds([])
    setIsSimulationOpen(false)
  }


  function handleToggleTimetable(
    timetableId: string,
  ) {
    setSelectedTimetableIds(
      (currentTimetableIds) => {
        if (
          currentTimetableIds.includes(
            timetableId,
          )
        ) {
          return currentTimetableIds.filter(
            (currentTimetableId) =>
              currentTimetableId !==
              timetableId,
          )
        }

        if (
          currentTimetableIds.length >=
          MAX_COMPARISON_TIMETABLES
        ) {
          return currentTimetableIds
        }

        return [
          ...currentTimetableIds,
          timetableId,
        ]
      },
    )
  }


  function handleTimetableDragStart(
    event: DragEvent<HTMLElement>,
    timetableId: string,
  ) {
    event.dataTransfer.effectAllowed =
      'copy'

    event.dataTransfer.setData(
      TIMETABLE_DRAG_DATA_TYPE,
      timetableId,
    )

    event.dataTransfer.setData(
      'text/plain',
      timetableId,
    )
  }


  function handleComparisonDragOver(
    event: DragEvent<HTMLElement>,
  ) {
    event.preventDefault()

    event.dataTransfer.dropEffect =
      'copy'
  }


  function handleComparisonDrop(
    event: DragEvent<HTMLElement>,
  ) {
    event.preventDefault()

    const timetableId =
      event.dataTransfer.getData(
        TIMETABLE_DRAG_DATA_TYPE,
      ) ||
      event.dataTransfer.getData(
        'text/plain',
      )

    const timetableIsVisible =
      filteredTimetables.some(
        (timetable) =>
          timetable.id ===
          timetableId,
      )

    if (!timetableIsVisible) {
      return
    }

    setSelectedTimetableIds(
      (currentTimetableIds) => {
        if (
          currentTimetableIds.includes(
            timetableId,
          ) ||
          currentTimetableIds.length >=
            MAX_COMPARISON_TIMETABLES
        ) {
          return currentTimetableIds
        }

        return [
          ...currentTimetableIds,
          timetableId,
        ]
      },
    )
  }


  function handleRemoveTimetable(
    timetableId: string,
  ) {
    setSelectedTimetableIds(
      (currentTimetableIds) =>
        currentTimetableIds.filter(
          (currentTimetableId) =>
            currentTimetableId !==
            timetableId,
        ),
    )
  }


  return (
    <section className="timetable-comparison-workspace-page">
      <header className="timetable-comparison-workspace-header">
        <span>시간표</span>

        <h1>시간표 비교</h1>

        <p>
          최대 3개의 시간표를 선택하여
          구성과 수강 계획을 비교합니다.
        </p>
      </header>

      <div className="timetable-comparison-workspace">
        <aside
          className="
            panel
            timetable-comparison-picker
          "
        >
          <div className="timetable-comparison-picker-controls">
            <label>
              <span>학년도</span>

              <select
                value={
                  selectedAcademicYear
                }
                onChange={(event) => {
                  handleAcademicYearChange(
                    Number(
                      event.target.value,
                    ),
                  )
                }}
              >
                {availableAcademicYears.map(
                  (academicYear) => (
                    <option
                      key={academicYear}
                      value={academicYear}
                    >
                      {academicYear}학년도
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              <span>학기</span>

              <select
                value={selectedSemester}
                onChange={(event) => {
                  handleSemesterChange(
                    Number(
                      event.target.value,
                    ) as AcademicSemester,
                  )
                }}
              >
                <option value={1}>
                  1학기
                </option>

                <option value={2}>
                  2학기
                </option>
              </select>
            </label>
          </div>

          <div className="timetable-comparison-picker-heading">
            <div>
              <strong>
                저장된 시간표
              </strong>

              <span>
                {
                  filteredTimetables
                    .length
                }
                개
              </span>
            </div>

            <small>
              최대 {
                MAX_COMPARISON_TIMETABLES
              }개
            </small>
          </div>

          {filteredTimetables.length ===
          0 ? (
            <p className="timetable-comparison-picker-empty">
              이 학기에 저장된 시간표가
              없습니다.
            </p>
          ) : (
            <div className="timetable-comparison-picker-list">
              {filteredTimetables.map(
                (timetable) => {
                  const isSelected =
                    selectedTimetableIds
                      .includes(
                        timetable.id,
                      )

                  const selectionIsFull =
                    selectedTimetableIds
                      .length >=
                      MAX_COMPARISON_TIMETABLES

                  return (
                    <article
                      key={timetable.id}
                      className={
                        `timetable-comparison-picker-item` +
                        (
                          isSelected
                            ? ' timetable-comparison-picker-item--selected'
                            : ''
                        )
                      }
                      draggable
                      onDragStart={(
                        event,
                      ) => {
                        handleTimetableDragStart(
                          event,
                          timetable.id,
                        )
                      }}
                    >
                      <button
                        type="button"
                        disabled={
                          !isSelected &&
                          selectionIsFull
                        }
                        onClick={() => {
                          handleToggleTimetable(
                            timetable.id,
                          )
                        }}
                      >
                        <strong>
                          {timetable.name}
                        </strong>

                        <span>
                          {
                            timetable
                              .lectureIds
                              .length
                          }
                          과목
                        </span>

                        <small>
                          {isSelected
                            ? '선택됨'
                            : '비교에 추가'}
                        </small>
                      </button>
                    </article>
                  )
                },
              )}
            </div>
          )}
        </aside>

        <section
          className="timetable-comparison-result-panel"
          onDragOver={
            handleComparisonDragOver
          }
          onDrop={
            handleComparisonDrop
          }
          aria-label="시간표 비교 영역"
        >
          {selectedTimetables.length >
          0 ? (
            <div className="timetable-comparison-selected-list">
              {selectedTimetables.map(
                (timetable) => (
                  <div
                    key={timetable.id}
                    className="timetable-comparison-selected-item"
                  >
                    <span>
                      {timetable.name}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        handleRemoveTimetable(
                          timetable.id,
                        )
                      }}
                      aria-label={
                        `${timetable.name} 비교 목록에서 제거`
                      }
                    >
                      ×
                    </button>
                  </div>
                ),
              )}
            </div>
          ) : null}

          {selectedTimetables.length <
          2 ? (
            <div className="timetable-comparison-result-empty">
              <strong>
                {selectedTimetables.length ===
                0
                  ? '비교할 시간표를 골라주세요.'
                  : '시간표를 하나 더 선택해 주세요.'}
              </strong>

              <p>
                왼쪽의 저장된 시간표를
                클릭하거나 이 영역으로
                끌어다 놓을 수 있습니다.
              </p>

              <span>
                최대 {
                  MAX_COMPARISON_TIMETABLES
                }개까지 비교할 수 있습니다.
              </span>
            </div>
          ) : isLoadingLectures ? (
            <div className="timetable-comparison-result-empty">
              <strong>
                시간표 정보를 불러오고
                있습니다.
              </strong>
            </div>
          ) : lectureLoadError !==
          null ? (
            <div className="timetable-comparison-result-empty">
              <strong>
                강의 정보를 불러오지
                못했습니다.
              </strong>

              <p>
                {lectureLoadError}
              </p>
            </div>
          ) : (
            <>
              <div className="timetable-comparison-result-actions">
                <button
                  className={
                    isSimulationOpen
                      ? 'secondary-button'
                      : 'primary-button'
                  }
                  type="button"
                  disabled={
                    user.entryYear === null ||
                    user.studentType === null
                  }
                  onClick={() => {
                    setIsSimulationOpen(
                      (currentValue) =>
                        !currentValue,
                    )
                  }}
                >
                  {isSimulationOpen
                    ? '시뮬레이션 닫기'
                    : '수강예정 시뮬레이션'}
                </button>

                {(
                  user.entryYear === null ||
                  user.studentType === null
                ) ? (
                  <span>
                    학업정보 설정이 필요합니다.
                  </span>
                ) : null}
              </div>

              <TimetableComparisonPage
                timetables={
                  selectedTimetables
                }
                lectures={lectures}
                showHeader={false}
              />

              {isSimulationOpen ? (
                <TimetableGraduationSimulation
                  user={user}
                  timetables={
                    selectedTimetables
                  }
                  lectures={lectures}
                />
              ) : null}
            </>
          )}
        </section>
      </div>
    </section>
  )
}
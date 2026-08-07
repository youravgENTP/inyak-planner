import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
} from 'react'

import { TimetableMiniPreview } from './TimetableMiniPreview'
import type { Lecture } from '../../domain/lectures/types'

import {
  groupTimetablesBySemester,
  type SavedTimetable,
} from '../../domain/saved-timetables'

import './SavedTimetablesModal.css'

const MAX_COMPARISON_TIMETABLES = 3

const TIMETABLE_DRAG_DATA_TYPE =
  'application/x-inyak-timetable-id'

interface ComparisonGridStyle
  extends CSSProperties {
  '--comparison-count': number
}

interface SavedTimetablesModalProps {
  isOpen: boolean
  timetables: readonly SavedTimetable[]
  lectures: readonly Lecture[]
  activeTimetableId: string
  comparisonTimetableIds: readonly string[]
  onClose: () => void
  onSelectTimetable: (
    timetableId: string,
  ) => void
  onComparisonTimetableIdsChange: (
    timetableIds: string[],
  ) => void
  onCreateTimetable: () => void
  onDuplicateActiveTimetable: () => void
  onDeleteTimetable?: (
    timetableId: string,
  ) => void
  onCompare: (
    timetableIds: readonly string[],
  ) => void
}

export function SavedTimetablesModal({
  isOpen,
  timetables,
  lectures,
  activeTimetableId,
  comparisonTimetableIds,
  onClose,
  onSelectTimetable,
  onComparisonTimetableIdsChange,
  onCreateTimetable,
  onDuplicateActiveTimetable,
  onDeleteTimetable,
  onCompare,
}: SavedTimetablesModalProps) {
  const modalRef =
    useRef<HTMLDivElement>(null)

  const [
    isCreateMenuOpen,
    setIsCreateMenuOpen,
  ] = useState(false)

  const [
    isComparisonDropActive,
    setIsComparisonDropActive,
  ] = useState(false)

  const timetableGroups = useMemo(
    () =>
      groupTimetablesBySemester(
        timetables,
      ),
    [timetables],
  )

  const timetableMap = useMemo(
    () =>
      new Map(
        timetables.map(
          (timetable) =>
            [
              timetable.id,
              timetable,
            ] as const,
        ),
      ),
    [timetables],
  )

  const comparisonTimetables =
    useMemo(
      () =>
        comparisonTimetableIds
          .map((timetableId) =>
            timetableMap.get(timetableId),
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
        comparisonTimetableIds,
        timetableMap,
      ],
    )

  const comparisonGridStyle:
    ComparisonGridStyle = {
      '--comparison-count':
        Math.max(
          comparisonTimetables.length,
          1,
        ),
    }

  const canCompare =
    comparisonTimetables.length >= 2

  const isComparisonFull =
    comparisonTimetables.length >=
    MAX_COMPARISON_TIMETABLES

  useEffect(() => {
    if (!isOpen) {
      setIsCreateMenuOpen(false)
      setIsComparisonDropActive(false)

      return
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener(
      'keydown',
      handleKeyDown,
    )

    const previousOverflow =
      document.body.style.overflow

    document.body.style.overflow =
      'hidden'

    window.setTimeout(() => {
      modalRef.current?.focus()
    }, 0)

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown,
      )

      document.body.style.overflow =
        previousOverflow
    }
  }, [isOpen, onClose])

  function handleOverlayClick(
    event: MouseEvent<HTMLDivElement>,
  ) {
    if (
      event.target ===
      event.currentTarget
    ) {
      onClose()
    }
  }
///////////
  function handleTimetableDragStart(
    event: DragEvent<HTMLDivElement>,
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
    event: DragEvent<HTMLDivElement>,
  ) {
    event.preventDefault()

    event.dataTransfer.dropEffect =
      'copy'

    setIsComparisonDropActive(true)
  }

  function handleComparisonDragLeave(
    event: DragEvent<HTMLDivElement>,
  ) {
    if (
      event.currentTarget.contains(
        event.relatedTarget as Node | null,
      )
    ) {
      return
    }

    setIsComparisonDropActive(false)
  }

  function handleComparisonDrop(
    event: DragEvent<HTMLDivElement>,
  ) {
    event.preventDefault()

    setIsComparisonDropActive(false)

    const timetableId =
      event.dataTransfer.getData(
        TIMETABLE_DRAG_DATA_TYPE,
      ) ||
      event.dataTransfer.getData(
        'text/plain',
      )

    if (!timetableMap.has(timetableId)) {
      return
    }

    if (
      comparisonTimetableIds.includes(
        timetableId,
      )
    ) {
      return
    }

    if (isComparisonFull) {
      return
    }

    onComparisonTimetableIdsChange([
      ...comparisonTimetableIds,
      timetableId,
    ])
  }

  function handleRemoveComparisonTimetable(
    timetableId: string,
  ) {
    onComparisonTimetableIdsChange(
      comparisonTimetableIds.filter(
        (currentTimetableId) =>
          currentTimetableId !==
          timetableId,
      ),
    )
  }

  function handleCreateTimetable() {
    setIsCreateMenuOpen(false)
    onCreateTimetable()
  }

  function handleDuplicateTimetable() {
    setIsCreateMenuOpen(false)
    onDuplicateActiveTimetable()
  }

  function handleCompare() {
    if (!canCompare) {
      return
    }

    onCompare(
      comparisonTimetables.map(
        (timetable) => timetable.id,
      ),
    )
  }

  if (!isOpen) {
    return null
  }

  return (
    <div
      className="saved-timetables-modal-overlay"
      role="presentation"
      onMouseDown={handleOverlayClick}
    >
      <div
        ref={modalRef}
        className="saved-timetables-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="saved-timetables-modal-title"
        tabIndex={-1}
      >
        <header className="saved-timetables-modal__header">
          <div>
            <h2 id="saved-timetables-modal-title">
              저장된 시간표
            </h2>

            <p>
              시간표 이름을 누르면 해당
              시간표로 이동하고, 아래 영역으로
              끌면 비교할 수 있습니다.
            </p>
          </div>

          <button
            className="saved-timetables-modal__close-button"
            type="button"
            onClick={onClose}
            aria-label="저장된 시간표 창 닫기"
          >
            ×
          </button>
        </header>

        <div className="saved-timetables-modal__body">
          <section
            className="saved-timetables-modal__list-section"
            aria-labelledby="saved-timetable-list-title"
          >
            <div className="saved-timetables-modal__section-heading">
              <div>
                <h3 id="saved-timetable-list-title">
                  지금까지 만든 시간표
                </h3>

                <p>
                  클릭하여 열거나 비교 영역으로
                  끌어다 놓으세요.
                </p>
              </div>

              <div className="saved-timetables-create">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() =>
                    setIsCreateMenuOpen(
                      (isOpen) => !isOpen,
                    )
                  }
                  aria-expanded={
                    isCreateMenuOpen
                  }
                  aria-haspopup="menu"
                >
                  + 새 시간표
                </button>

                {isCreateMenuOpen && (
                  <div
                    className="saved-timetables-create__menu"
                    role="menu"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={
                        handleDuplicateTimetable
                      }
                    >
                      현재 시간표 복제
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={
                        handleCreateTimetable
                      }
                    >
                      새 시간표 생성
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="saved-timetable-groups">
              {timetableGroups.map(
                (group) => (
                  <section
                    className="saved-timetable-group"
                    key={`${group.academicYear}-${group.semester}`}
                  >
                    <h4>
                      {group.academicYear}
                      학년도{' '}
                      {group.semester}학기
                    </h4>

                    <div className="saved-timetable-list">
                      {group.timetables.map(
                        (timetable) => {
                          const isActive =
                            timetable.id ===
                            activeTimetableId

                          const isSelected =
                            comparisonTimetableIds.includes(
                              timetable.id,
                            )

                          return (
                            <div
                              className={`saved-timetable-list-item${
                                isActive
                                  ? ' saved-timetable-list-item--active'
                                  : ''
                              }${
                                isSelected
                                  ? ' saved-timetable-list-item--selected'
                                  : ''
                              }`}
                              key={timetable.id}
                              draggable
                              onDragStart={(
                                event,
                              ) =>
                                handleTimetableDragStart(
                                  event,
                                  timetable.id,
                                )
                              }
                            >
                              <button
                                className="saved-timetable-list-item__open"
                                type="button"
                                onClick={() =>
                                  onSelectTimetable(
                                    timetable.id,
                                  )
                                }
                                aria-current={
                                  isActive
                                    ? 'page'
                                    : undefined
                                }
                              >
                                <span>
                                  {timetable.name}
                                </span>

                                <small>
                                  {
                                    timetable
                                      .lectureIds
                                      .length
                                  }
                                  개 과목
                                </small>
                              </button>
                              <button
                                className="saved-timetable-list-item__delete"
                                type="button"
                                onClick={() =>
                                  onDeleteTimetable?.(
                                    timetable.id,
                                  )
                                }
                                disabled={
                                  timetables.length <= 1 ||
                                  onDeleteTimetable === undefined
                                }
                                aria-label={`${timetable.name} 시간표 삭제`}
                                title={
                                  timetables.length <= 1
                                    ? '마지막 시간표는 삭제할 수 없습니다.'
                                    : '시간표 삭제'
                                }
                              >
                                ×
                              </button>
                              
                            </div>
                          )
                        },
                      )}
                    </div>
                  </section>
                ),
              )}
            </div>
          </section>

          <section
            className="saved-timetables-modal__comparison-section"
            aria-labelledby="comparison-selection-title"
          >
            <div className="saved-timetables-modal__section-heading">
              <div>
                <h3 id="comparison-selection-title">
                  비교할 시간표
                </h3>

                <p>
                  최대 3개의 시간표를 선택할 수
                  있습니다.
                </p>
              </div>

              <span className="comparison-selection-count">
                {comparisonTimetables.length}
                /{MAX_COMPARISON_TIMETABLES}
              </span>
            </div>

            <div
              className={`comparison-selection-drop-zone${
                isComparisonDropActive
                  ? ' comparison-selection-drop-zone--active'
                  : ''
              }${
                isComparisonFull
                  ? ' comparison-selection-drop-zone--full'
                  : ''
              }`}
              onDragOver={
                handleComparisonDragOver
              }
              onDragLeave={
                handleComparisonDragLeave
              }
              onDrop={handleComparisonDrop}
            >
              {comparisonTimetables.length ===
              0 ? (
                <div className="comparison-selection-empty">
                  <strong>
                    비교할 시간표를 여기에
                    끌어다 놓으세요.
                  </strong>

                  <span>
                    시간표를 2개 이상 선택하면
                    비교할 수 있습니다.
                  </span>
                </div>
              ) : (
                <div className="comparison-selection-scroll">
                  <div
                    className="comparison-selection-grid"
                    style={
                      comparisonGridStyle
                    }
                  >
                    {comparisonTimetables.map(
                      (timetable) => (
                        <article
                          className="comparison-selection-preview"
                          key={timetable.id}
                        >
                          <header className="comparison-selection-preview__header">
                            <div>
                              <strong>
                                {timetable.name}
                              </strong>

                              <small>
                                {
                                  timetable.academicYear
                                }
                                학년도{' '}
                                {
                                  timetable.semester
                                }
                                학기
                              </small>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveComparisonTimetable(
                                  timetable.id,
                                )
                              }
                              aria-label={`${timetable.name} 비교 목록에서 제거`}
                            >
                              ×
                            </button>
                          </header>

                          <div className="comparison-selection-preview__canvas">
                            <TimetableMiniPreview
                              timetable={timetable}
                              lectures={lectures}
                            />
                          </div>
                        </article>
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        <footer className="saved-timetables-modal__footer">
          <p>
            {comparisonTimetables.length ===
            1
              ? '시간표를 하나 더 선택해 주세요.'
              : comparisonTimetables.length ===
                  0
                ? '비교할 시간표를 선택해 주세요.'
                : `${comparisonTimetables.length}개의 시간표가 선택되었습니다.`}
          </p>

          <div className="saved-timetables-modal__footer-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={onClose}
            >
              취소
            </button>

            <button
              className="primary-button"
              type="button"
              onClick={handleCompare}
              disabled={!canCompare}
            >
              비교하기
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
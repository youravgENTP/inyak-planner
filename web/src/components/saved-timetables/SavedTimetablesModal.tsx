import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react'

import {
  groupTimetablesBySemester,
  type SavedTimetable,
} from '../../domain/saved-timetables'

import './SavedTimetablesModal.css'

interface SavedTimetablesModalProps {
  isOpen: boolean
  timetables: readonly SavedTimetable[]
  activeTimetableId: string
  onClose: () => void
  onSelectTimetable: (
    timetableId: string,
  ) => void
  onCreateTimetable: () => void
  onDuplicateActiveTimetable: () => void
  onDeleteTimetable?: (
    timetableId: string,
  ) => void
}

export function SavedTimetablesModal({
  isOpen,
  timetables,
  activeTimetableId,
  onClose,
  onSelectTimetable,
  onCreateTimetable,
  onDuplicateActiveTimetable,
  onDeleteTimetable,
}: SavedTimetablesModalProps) {
  const modalRef =
    useRef<HTMLDivElement>(null)

  const [
    isCreateMenuOpen,
    setIsCreateMenuOpen,
  ] = useState(false)


  const timetableGroups = useMemo(
    () =>
      groupTimetablesBySemester(
        timetables,
      ),
    [timetables],
  )

  useEffect(() => {
    if (!isOpen) {
      setIsCreateMenuOpen(false)

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


  function handleCreateTimetable() {
    setIsCreateMenuOpen(false)
    onCreateTimetable()
  }

  function handleDuplicateTimetable() {
    setIsCreateMenuOpen(false)
    onDuplicateActiveTimetable()
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
              저장된 시간표를 확인하고
              관리할 수 있습니다.
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
                  시간표를 클릭하면 해당
                  시간표로 이동합니다.
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

                          return (
                            <div
                              className={`saved-timetable-list-item${
                                isActive
                                  ? ' saved-timetable-list-item--active'
                                  : ''
                              }`}
                              key={timetable.id}
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
        </div>
      </div>
    </div>
  )
}
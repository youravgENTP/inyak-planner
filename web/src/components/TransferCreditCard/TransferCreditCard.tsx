import {
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  deleteCourseRecord,
} from '../../domain/course-records/api'

import type {
  CourseRecord,
} from '../../domain/course-records/types'

import type {
  Curriculum,
} from '../../domain/curriculum/types'

import type {
  GeneralEducation,
} from '../../domain/general-education/types'

import type {
  TransferCreditBoardCard,
} from '../../domain/graduation-progress/createSemesterBoard'

import {
  GeneralEducationTransferCreditModal,
} from '../GeneralEducationTransferCreditModal/GeneralEducationTransferCreditModal'

import {
  MajorTransferCreditModal,
} from '../MajorTransferCreditModal/MajorTransferCreditModal'

import '../GraduationSemesterBoard/GraduationSemesterBoard.css'
import './TransferCreditCard.css'

interface TransferCreditCardProps {
  variant?: 'board' | 'gpa'
  readOnly?: boolean
  card: TransferCreditBoardCard
  curriculum: Curriculum
  generalEducation: GeneralEducation
  onRecordCreated: (
    record: CourseRecord,
  ) => void
  onRecordUpdated: (
    record: CourseRecord,
  ) => void
  onRecordDeleted: (
    recordId: string,
  ) => void
}


function formatCredits(
  credits: number,
): string {
  return `${credits}학점`
}


export function TransferCreditCard({
  variant = 'board',
  readOnly = false,
  card,
  curriculum,
  generalEducation,
  onRecordCreated,
  onRecordUpdated,
  onRecordDeleted,
}: TransferCreditCardProps) {
  const [
    menuIsOpen,
    setMenuIsOpen,
  ] = useState(false)

  const [
    majorModalIsOpen,
    setMajorModalIsOpen,
  ] = useState(false)

  const [
    generalEducationModalIsOpen,
    setGeneralEducationModalIsOpen,
  ] = useState(false)

  const [
    deletingRecordId,
    setDeletingRecordId,
  ] = useState<string | null>(null)

  const [
    editingRecord,
    setEditingRecord,
  ] = useState<CourseRecord | null>(
    null,
  )

  const [
    activeRecordMenuId,
    setActiveRecordMenuId,
  ] = useState<string | null>(
    null,
  )

  const [
    activeCompletionType,
    setActiveCompletionType,
  ] = useState<
    CourseRecord['completionType'] | null
  >(null)

  const menuRef =
    useRef<HTMLDivElement | null>(
      null,
    )

  const actionMenuRef =
    useRef<HTMLDivElement | null>(
      null,
    )

  useEffect(() => {
    if (
      !menuIsOpen &&
      activeRecordMenuId === null
    ) {
      return
    }

    function handlePointerDown(
      event: PointerEvent,
    ) {
      const target =
        event.target as Node

      if (
        menuRef.current?.contains(
          target,
        ) ||
        actionMenuRef.current?.contains(
          target,
        )
      ) {
        return
      }

      setMenuIsOpen(false)
      setActiveRecordMenuId(null)
    }

    document.addEventListener(
      'pointerdown',
      handlePointerDown,
    )

    return () => {
      document.removeEventListener(
        'pointerdown',
        handlePointerDown,
      )
    }
  }, [
    activeRecordMenuId,
    menuIsOpen,
  ])

  function toggleCompletionType(
    completionType:
      CourseRecord['completionType'],
  ) {
    setActiveCompletionType(
      (currentCompletionType) =>
        currentCompletionType ===
        completionType
          ? null
          : completionType,
    )
  }

  async function handleDeleteRecord(
    record: CourseRecord,
  ) {
    const recordLabel =
      record.courseName.trim().length > 0
        ? record.courseName
        : '이 인정 과목'

    const deleteWasConfirmed =
      window.confirm(
        `${recordLabel} 기록을 삭제하시겠습니까?`,
      )

    if (!deleteWasConfirmed) {
      return
    }

    setActiveRecordMenuId(null)
    setDeletingRecordId(record.id)

    try {
      await deleteCourseRecord(
        record.id,
      )

      onRecordDeleted(record.id)
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : '인정 과목을 삭제하지 못했습니다.',
      )
    } finally {
      setDeletingRecordId(null)
    }
  }

  const totalCredits =
    card.records.reduce(
      (total, record) =>
        total + record.credits,
      0,
    )

  const requiredCredits =
    card.records
      .filter(
        (record) =>
          record.completionType ===
          '전필',
      )
      .reduce(
        (total, record) =>
          total + record.credits,
        0,
      )

  const electiveCredits =
    card.records
      .filter(
        (record) =>
          record.completionType ===
          '전선',
      )
      .reduce(
        (total, record) =>
          total + record.credits,
        0,
      )

  const generalEducationCredits =
    card.records
      .filter(
        (record) =>
          record.completionType ===
          '교양',
      )
      .reduce(
        (total, record) =>
          total + record.credits,
        0,
      )

  const visibleRecords =
    activeCompletionType === null
      ? []
      : card.records.filter(
          (record) =>
            record.completionType ===
              activeCompletionType,
        )

  return (
    <>
      <article
        className={
          `graduation-board-card ` +
          `graduation-board-card--transfer` +
          (
            variant === 'gpa'
              ? ' transfer-credit-card--gpa'
              : ''
          )
        }
      >
        <header className="graduation-board-card-header">
          <div>
            <span>
              {variant === 'gpa'
                ? '전적대 인정'
                : '편입생'}
            </span>

            <h3>
              전적대 학점 인정
            </h3>
          </div>

          {!readOnly ? (
            <div
              className="graduation-board-transfer-menu"
              ref={menuRef}
            >
              <button
                aria-expanded={
                  menuIsOpen
                }
                aria-haspopup="menu"
                aria-label="인정 과목 추가"
                className={
                  variant === 'gpa'
                    ? 'gpa-add-course-button'
                    : 'graduation-board-transfer-add'
                }
                type="button"
                onClick={() => {
                  setActiveRecordMenuId(
                    null,
                  )

                  setMenuIsOpen(
                    (currentValue) =>
                      !currentValue,
                  )
                }}
              >
                {variant === 'gpa'
                  ? '+'
                  : '+ 인정 과목 추가'}
              </button>

              {menuIsOpen ? (
                <div
                  className="graduation-board-transfer-menu-list"
                  role="menu"
                >
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setMenuIsOpen(false)
                      setMajorModalIsOpen(
                        true,
                      )
                    }}
                  >
                    <strong>
                      전공
                    </strong>
                  </button>

                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setMenuIsOpen(false)

                      setGeneralEducationModalIsOpen(
                        true,
                      )
                    }}
                  >
                    <strong>
                      교양
                    </strong>
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </header>

        <div className="graduation-board-transfer-summary">
          <button
            aria-expanded={
              activeCompletionType === '전필'
            }
            className="graduation-board-transfer-summary-toggle"
            type="button"
            onClick={() => {
              toggleCompletionType('전필')
            }}
          >
            <span>전필</span>

            <strong>
              {requiredCredits}학점

              <i
                aria-hidden="true"
                className={
                  'graduation-board-transfer-summary-chevron' +
                  (
                    activeCompletionType ===
                    '전필'
                      ? ' graduation-board-transfer-summary-chevron--open'
                      : ''
                  )
                }
              >
                ▾
              </i>
            </strong>
          </button>

          <button
            aria-expanded={
              activeCompletionType === '전선'
            }
            className="graduation-board-transfer-summary-toggle"
            type="button"
            onClick={() => {
              toggleCompletionType('전선')
            }}
          >
            <span>전선</span>

            <strong>
              {electiveCredits}학점

              <i
                aria-hidden="true"
                className={
                  'graduation-board-transfer-summary-chevron' +
                  (
                    activeCompletionType ===
                    '전선'
                      ? ' graduation-board-transfer-summary-chevron--open'
                      : ''
                  )
                }
              >
                ▾
              </i>
            </strong>
          </button>

          <button
            aria-expanded={
              activeCompletionType === '교양'
            }
            className="graduation-board-transfer-summary-toggle"
            type="button"
            onClick={() => {
              toggleCompletionType('교양')
            }}
          >
            <span>교양</span>

            <strong>
              {generalEducationCredits}학점

              <i
                aria-hidden="true"
                className={
                  'graduation-board-transfer-summary-chevron' +
                  (
                    activeCompletionType ===
                    '교양'
                      ? ' graduation-board-transfer-summary-chevron--open'
                      : ''
                  )
                }
              >
                ▾
              </i>
            </strong>
          </button>

          <div>
            <span>총</span>

            <strong>
              {totalCredits}학점
            </strong>
          </div>
        </div>

        {card.records.length === 0 ? (
          <p className="graduation-board-empty">
            등록된 전적대 인정 과목이
            없습니다.
          </p>
        ) : (
          <ul className="graduation-board-course-list">
            {visibleRecords.map(
              (record) => {
                const curriculumCourse =
                  record.curriculumCourseId ===
                  null
                    ? null
                    : (
                      curriculum.courses.find(
                        (course) =>
                          course.id ===
                          record
                            .curriculumCourseId,
                      ) ?? null
                    )

                const generalEducationRequirement =
                  record
                    .generalEducationRequirementId ===
                  null
                    ? null
                    : (
                      generalEducation
                        .requirements
                        .find(
                          (requirement) =>
                            requirement.id ===
                            record
                              .generalEducationRequirementId,
                        ) ?? null
                    )

                const generalEducationArea =
                  record
                    .generalEducationAreaId ===
                  null
                    ? null
                    : (
                      generalEducationRequirement
                        ?.areas
                        .find(
                          (area) =>
                            area.id ===
                            record
                              .generalEducationAreaId,
                        ) ?? null
                    )

                return (
                  <li
                    className="
                      graduation-board-course
                      graduation-board-course--substituted
                      graduation-board-transfer-course
                    "
                    key={record.id}
                  >
                    <div className="graduation-board-transfer-course-content">
                      <strong>
                        {curriculumCourse ===
                        null
                          ? record.courseName
                          : (
                            curriculumCourse
                              .courseName
                          )}
                      </strong>

                      {curriculumCourse !==
                      null ? (
                        <span className="graduation-board-transfer-source">
                          대체인정:{' '}
                          {
                            record.courseName
                          }
                        </span>
                      ) : null}

                      {generalEducationRequirement !==
                      null ? (
                        <span className="graduation-board-transfer-source">
                          {
                            generalEducationRequirement
                              .category
                          }

                          {generalEducationArea ===
                          null
                            ? ''
                            : (
                              ` · ${generalEducationArea.areaName}`
                            )}
                        </span>
                      ) : null}

                      <span>
                        {curriculumCourse !==
                        null ? (
                          <>
                            {
                              record
                                .completionType
                            }
                            {' · '}
                          </>
                        ) : null}

                        {formatCredits(
                          record.credits,
                        )}
                      </span>
                    </div>

                    {!readOnly ? (
                      <div
                        className="graduation-board-transfer-actions"
                        ref={
                          activeRecordMenuId ===
                          record.id
                            ? actionMenuRef
                            : null
                        }
                      >
                        <button
                          aria-expanded={
                            activeRecordMenuId ===
                            record.id
                          }
                          aria-haspopup="menu"
                          aria-label={
                            `${record.courseName} 인정 기록 메뉴`
                          }
                          className="graduation-board-transfer-more"
                          disabled={
                            deletingRecordId ===
                            record.id
                          }
                          type="button"
                          onClick={() => {
                            setMenuIsOpen(false)

                            setActiveRecordMenuId(
                              (
                                currentRecordId,
                              ) =>
                                currentRecordId ===
                                record.id
                                  ? null
                                  : record.id,
                            )
                          }}
                        >
                          ⋯
                        </button>

                        {activeRecordMenuId ===
                        record.id ? (
                          <div
                            className="graduation-board-transfer-action-menu"
                            role="menu"
                          >
                            {curriculumCourse !==
                              null ||
                            generalEducationRequirement !==
                              null ? (
                              <button
                                role="menuitem"
                                type="button"
                                onClick={() => {
                                  setActiveRecordMenuId(
                                    null,
                                  )

                                  setEditingRecord(
                                    record,
                                  )
                                }}
                              >
                                수정
                              </button>
                            ) : null}

                            <button
                              className="graduation-board-transfer-action-delete"
                              role="menuitem"
                              type="button"
                              onClick={() => {
                                setActiveRecordMenuId(
                                  null,
                                )

                                void handleDeleteRecord(
                                  record,
                                )
                              }}
                            >
                              삭제
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                )
              },
            )}
          </ul>
        )}
      </article>

      {!readOnly &&
      majorModalIsOpen ? (
        <MajorTransferCreditModal
          curriculum={curriculum}
          onClose={() => {
            setMajorModalIsOpen(
              false,
            )
          }}
          onCreated={
            onRecordCreated
          }
        />
      ) : null}

      {!readOnly &&
      generalEducationModalIsOpen ? (
        <GeneralEducationTransferCreditModal
          generalEducation={
            generalEducation
          }
          onClose={() => {
            setGeneralEducationModalIsOpen(
              false,
            )
          }}
          onCreated={
            onRecordCreated
          }
        />
      ) : null}

      {!readOnly &&
      editingRecord !== null &&
      editingRecord.curriculumCourseId !==
        null ? (
        <MajorTransferCreditModal
          curriculum={curriculum}
          record={editingRecord}
          onClose={() => {
            setEditingRecord(null)
          }}
          onCreated={
            onRecordCreated
          }
          onUpdated={(
            updatedRecord,
          ) => {
            onRecordUpdated(
              updatedRecord,
            )

            setEditingRecord(null)
          }}
        />
      ) : null}

      {!readOnly &&
      editingRecord !== null &&
      editingRecord
        .generalEducationRequirementId !==
        null ? (
        <GeneralEducationTransferCreditModal
          generalEducation={
            generalEducation
          }
          record={editingRecord}
          onClose={() => {
            setEditingRecord(null)
          }}
          onCreated={
            onRecordCreated
          }
          onUpdated={(
            updatedRecord,
          ) => {
            onRecordUpdated(
              updatedRecord,
            )

            setEditingRecord(null)
          }}
        />
      ) : null}
    </>
  )
}
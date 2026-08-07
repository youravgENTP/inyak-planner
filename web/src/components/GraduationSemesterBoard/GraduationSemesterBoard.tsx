import {
  useEffect,
  useRef,
  useState,
} from 'react'

import type {
  AuthUser,
} from '../../domain/auth/api'
import {
  deleteCourseRecord,
  updateCourseRecord,
} from '../../domain/course-records/api'
import type {
  CourseRecord,
  CourseRecordInput,
} from '../../domain/course-records/types'
import type {
  Curriculum,
} from '../../domain/curriculum/types'
import type {
  GeneralEducation,
} from '../../domain/general-education/types'
import {
  createGraduationBoard,
} from '../../domain/graduation-progress/createSemesterBoard'
import type {
  GraduationBoardCard,
  SemesterBoardCard,
  TransferCreditBoardCard,
} from '../../domain/graduation-progress/createSemesterBoard'
import {
  CourseRecordModal,
} from '../CourseRecordModal/CourseRecordModal'
import {
  GeneralEducationTransferCreditModal,
} from '../GeneralEducationTransferCreditModal/GeneralEducationTransferCreditModal'
import {
  MajorTransferCreditModal,
} from '../MajorTransferCreditModal/MajorTransferCreditModal'
import './GraduationSemesterBoard.css'


interface GraduationSemesterBoardProps {
  user: AuthUser
  curriculum: Curriculum
  generalEducation: GeneralEducation
  records: readonly CourseRecord[]
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
  credits: number | null,
): string {
  if (credits === null) {
    return '학점 미정'
  }

  return `${credits}학점`
}


function getStatusClassName(
  record: CourseRecord,
): string {
  /*
   * F는 수강 자체는 완료된 기록이지만
   * 졸업요건상 이수한 과목은 아닙니다.
   *
   * 따라서 status보다 F 판정을
   * 먼저 적용합니다.
   */
  if (record.letterGrade === 'F') {
    return (
      'graduation-board-course--failed'
    )
  }

  if (record.status === 'completed') {
    return (
      'graduation-board-course--completed'
    )
  }

  if (
    record.status === 'planned' ||
    record.status === 'in_progress'
  ) {
    return (
      'graduation-board-course--scheduled'
    )
  }

  return (
    'graduation-board-course--substituted'
  )
}


function getSemesterSummary(
  card: SemesterBoardCard,
) {
  const requiredCourses =
    card.courses.filter(
      (course) =>
        course.curriculumCourse
          .completionType === '전필',
    )

  const electiveCourses =
    card.courses.filter(
      (course) =>
        course.curriculumCourse
          .completionType === '전선',
    )

  const requiredMatchedRecords =
    requiredCourses
      .map((course) => course.record)
      .filter(
        (
          record,
        ): record is CourseRecord =>
          record !== null &&
          record.letterGrade !== 'F',
      )

  const electiveMatchedRecords =
    electiveCourses
      .map((course) => course.record)
      .filter(
        (
          record,
        ): record is CourseRecord =>
          record !== null &&
          record.letterGrade !== 'F',
      )

  /*
   * 자동 매칭에 실패한 기록은 아직
   * curriculum상의 전필/전선을 확정할 수
   * 없으므로 요약 수치에는 포함하지 않습니다.
   */
  return {
    requiredRecorded:
      requiredMatchedRecords.length,

    requiredTotal:
      requiredCourses.length,

    requiredCredits:
      requiredMatchedRecords.reduce(
        (total, record) =>
          total + record.credits,
        0,
      ),

    electiveRecorded:
      electiveMatchedRecords.length,

    electiveTotal:
      electiveCourses.length,

    electiveCredits:
      electiveMatchedRecords.reduce(
        (total, record) =>
          total + record.credits,
        0,
      ),
  }
}



function SemesterCard({
  card,
  curriculum,
  entryYear,
  onRecordCreated,
  onRecordUpdated,
}: {
  card: SemesterBoardCard
  curriculum: Curriculum
  entryYear: number | null
  onRecordCreated: (
    record: CourseRecord,
  ) => void
  onRecordUpdated: (
    record: CourseRecord,
  ) => void
}) {
  const [
    recordModalIsOpen,
    setRecordModalIsOpen,
  ] = useState(false)

  const [
    linkingRecordId,
    setLinkingRecordId,
  ] = useState<string | null>(null)

  const [
    selectedCurriculumCourseId,
    setSelectedCurriculumCourseId,
  ] = useState('')

  const [
    linkIsSaving,
    setLinkIsSaving,
  ] = useState(false)

  const [
    linkError,
    setLinkError,
  ] = useState<string | null>(null)

  const summary =
    getSemesterSummary(card)

  function openLinkPanel(
    recordId: string,
  ) {
    setLinkingRecordId(recordId)
    setSelectedCurriculumCourseId('')
    setLinkError(null)
  }

  function closeLinkPanel() {
    setLinkingRecordId(null)
    setSelectedCurriculumCourseId('')
    setLinkError(null)
  }

  async function handleLinkRecord(
    record: CourseRecord,
  ) {
    if (linkIsSaving) {
      return
    }

    const curriculumCourseId =
      Number(
        selectedCurriculumCourseId,
      )

    if (
      !Number.isInteger(
        curriculumCourseId,
      )
    ) {
      setLinkError(
        '연결할 공식 과목을 선택해 주세요.',
      )
      return
    }

    const curriculumCourse =
      curriculum.courses.find(
        (course) =>
          course.id ===
          curriculumCourseId,
      )

    if (
      curriculumCourse === undefined
    ) {
      setLinkError(
        '선택한 공식 과목을 찾을 수 없습니다.',
      )
      return
    }

    setLinkIsSaving(true)
    setLinkError(null)

    try {
      const input: CourseRecordInput = {
        curriculumCourseId:
          curriculumCourse.id,

        lectureId:
          record.lectureId,

        generalEducationRequirementId:
          null,

        generalEducationAreaId:
          null,

        academicYear:
          record.academicYear,

        grade:
          record.grade,

        semester:
          record.semester,

        courseName:
          record.courseName,

        courseCode:
          record.courseCode,

        /*
         * 수동으로 공식 과목을 연결했으므로
         * 전필/전선 판정도 공식 교육과정의
         * 값을 사용합니다.
         */
        completionType:
          curriculumCourse.completionType,

        credits:
          record.credits,

        status:
          record.status,

        letterGrade:
          record.letterGrade,

        isRetake:
          record.isRetake,

        note:
          record.note,
      }

      const updatedRecord =
        await updateCourseRecord(
          record.id,
          input,
        )

      onRecordUpdated(
        updatedRecord,
      )

      closeLinkPanel()
    } catch (error) {
      setLinkError(
        error instanceof Error
          ? error.message
          : '공식 과목에 연결하지 못했습니다.',
      )
    } finally {
      setLinkIsSaving(false)
    }
  }

  return (
    <>
      <article className="graduation-board-card">
      <header className="graduation-board-card-header">
        <div>
          <span>
            {card.grade}학년
          </span>

          <h3>
            {card.grade}학년{' '}
            {card.semester}학기
          </h3>
        </div>

        <button
          aria-label={
            `${card.grade}학년 ` +
            `${card.semester}학기 과목 추가`
          }
          className="graduation-board-add-button"
          type="button"
          onClick={() => {
            setRecordModalIsOpen(true)
          }}
        >
          +
        </button>
      </header>

      <div className="graduation-board-card-summary">
        <div>
          <span>전필</span>

          <strong>
            {summary.requiredRecorded}
            {' / '}
            {summary.requiredTotal}과목
          </strong>

          <small>
            {summary.requiredCredits}학점
          </small>
        </div>

        <div>
          <span>전선</span>

          <strong>
            {summary.electiveRecorded}
            {' / '}
            {summary.electiveTotal}과목
          </strong>

          <small>
            {summary.electiveCredits}학점
          </small>
        </div>
      </div>

      <ul className="graduation-board-course-list">
        {card.courses.map(
          ({
            curriculumCourse,
            record,
          }) => (
            <li
              className={
                'graduation-board-course ' +
                (
                  record === null
                    ? ''
                    : getStatusClassName(
                        record,
                      )
                )
              }
              key={curriculumCourse.id}
            >
              <div>
                <strong>
                  {
                    curriculumCourse
                      .courseName
                  }
                </strong>

                <span>
                  {
                    curriculumCourse
                      .completionType
                  }
                  {' · '}
                  {formatCredits(
                    curriculumCourse.credits,
                  )}
                </span>
              </div>
            </li>
          ),
        )}

        {card.unmatchedRecords.map(
          (record) => (
            <li
              className="
                graduation-board-course
                graduation-board-course--unmatched
              "
              key={record.id}
            >
              <div>
                <strong>
                  {record.courseName}
                </strong>

                <span>
                  {record.completionType}
                  {' · '}
                  {formatCredits(
                    record.credits,
                  )}
                </span>

                <span className="graduation-board-course-unmatched-label">
                  졸업요건 미연결
                </span>

                {linkingRecordId !==
                record.id ? (
                  <button
                    className="graduation-board-course-link-button"
                    type="button"
                    onClick={() => {
                      openLinkPanel(
                        record.id,
                      )
                    }}
                  >
                    공식 과목에 연결
                  </button>
                ) : (
                  <div className="graduation-board-course-link-panel">
                    <select
                      disabled={
                        linkIsSaving
                      }
                      value={
                        selectedCurriculumCourseId
                      }
                      onChange={(event) => {
                        setSelectedCurriculumCourseId(
                          event.target.value,
                        )

                        setLinkError(null)
                      }}
                    >
                      <option value="">
                        공식 과목 선택
                      </option>

                      {curriculum.courses.map(
                        (course) => (
                          <option
                            key={course.id}
                            value={course.id}
                          >
                            {course.grade}학년{' '}
                            {course.semester}학기
                            {' · '}
                            {
                              course.completionType
                            }
                            {' · '}
                            {
                              course.courseName
                            }
                          </option>
                        ),
                      )}
                    </select>

                    <div className="graduation-board-course-link-actions">
                      <button
                        disabled={
                          linkIsSaving
                        }
                        type="button"
                        onClick={() => {
                          void handleLinkRecord(
                            record,
                          )
                        }}
                      >
                        {linkIsSaving
                          ? '연결 중...'
                          : '연결'}
                      </button>

                      <button
                        disabled={
                          linkIsSaving
                        }
                        type="button"
                        onClick={
                          closeLinkPanel
                        }
                      >
                        취소
                      </button>
                    </div>

                    {linkError !== null ? (
                      <small className="graduation-board-course-link-error">
                        {linkError}
                      </small>
                    ) : null}
                  </div>
                )}
              </div>
            </li>
          ),
        )}
      </ul>
    </article>

    {recordModalIsOpen ? (
      <CourseRecordModal
        editingRecord={null}
        entryYear={entryYear}
        grade={card.grade}
        semester={card.semester}
        onClose={() => {
          setRecordModalIsOpen(false)
        }}
        onSaved={(savedRecord) => {
          onRecordCreated(
            savedRecord,
          )

          setRecordModalIsOpen(false)
        }}
      />
    ) : null}
  </>
  )
}



function TransferCreditCard({
  card,
  curriculum,
  generalEducation,
  onRecordCreated,
  onRecordUpdated,
  onRecordDeleted,
}: {
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
}) {
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
  ] = useState<CourseRecord | null>(null)

  const [
    activeRecordMenuId,
    setActiveRecordMenuId,
  ] = useState<string | null>(null)

  const menuRef =
    useRef<HTMLDivElement | null>(null)

  const actionMenuRef =
    useRef<HTMLDivElement | null>(null)

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

  return (
    <>
      <article className="graduation-board-card graduation-board-card--transfer">
      <header className="graduation-board-card-header">
        <div>
          <span>편입생</span>

          <h3>전적대 학점 인정</h3>
        </div>
        <div
          className="graduation-board-transfer-menu"
          ref={menuRef}
        >
          <button
            aria-expanded={menuIsOpen}
            aria-haspopup="menu"
            className="graduation-board-transfer-add"
            type="button"
            onClick={() => {
              setActiveRecordMenuId(null)

              setMenuIsOpen(
                (currentValue) =>
                  !currentValue,
              )
            }}
          >
            + 인정 과목 추가
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
                  setMajorModalIsOpen(true)
                }}
              >
                <strong>전공</strong>
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
                <strong>교양</strong>
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <div className="graduation-board-transfer-summary">
        <div>
          <span>전필</span>

          <strong>
            {requiredCredits}학점
          </strong>
        </div>

        <div>
          <span>전선</span>

          <strong>
            {electiveCredits}학점
          </strong>
        </div>

        <div>
          <span>교양</span>

          <strong>
            {generalEducationCredits}학점
          </strong>
        </div>

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
          {card.records.map(
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
                        {record.courseName}
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
                        null
                        ? (
                          <>
                            {
                              record
                                .completionType
                            }
                            {' · '}
                          </>
                        )
                        : null}

                      {formatCredits(
                        record.credits,
                      )}
                    </span>
                  </div>

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
                      aria-label={`${record.courseName} 인정 기록 메뉴`}
                      className="graduation-board-transfer-more"
                      disabled={
                        deletingRecordId ===
                        record.id
                      }
                      type="button"
                      onClick={() => {
                        setMenuIsOpen(false)

                        setActiveRecordMenuId(
                          (currentRecordId) =>
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
                </li>
              )
            },
          )}
        </ul>
        )}
      </article>

      {majorModalIsOpen ? (
        <MajorTransferCreditModal
          curriculum={curriculum}
          onClose={() => {
            setMajorModalIsOpen(false)
          }}
          onCreated={
            onRecordCreated
          }
        />
      ) : null}

      {generalEducationModalIsOpen ? (
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

      {editingRecord !== null &&
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

      {editingRecord !== null &&
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


function BoardCard({
  card,
  curriculum,
  generalEducation,
  entryYear,
  onRecordCreated,
  onRecordUpdated,
  onRecordDeleted,
}: {
  card: GraduationBoardCard
  curriculum: Curriculum
  generalEducation: GeneralEducation
  entryYear: number | null
  onRecordCreated: (
    record: CourseRecord,
  ) => void
  onRecordUpdated: (
    record: CourseRecord,
  ) => void
  onRecordDeleted: (
    recordId: string,
  ) => void
}) {
  if (card.kind === 'transferCredits') {
    return (
      <TransferCreditCard
        card={card}
        curriculum={curriculum}
        generalEducation={
          generalEducation
        }
        onRecordCreated={
          onRecordCreated
        }
        onRecordUpdated={
          onRecordUpdated
        }
        onRecordDeleted={
          onRecordDeleted
        }
      />
    )
  }

  return (
    <SemesterCard
      card={card}
      curriculum={curriculum}
      entryYear={entryYear}
      onRecordCreated={
        onRecordCreated
      }
      onRecordUpdated={
        onRecordUpdated
      }
    />
  )
}


export function GraduationSemesterBoard({
  user,
  curriculum,
  generalEducation,
  records,
  onRecordCreated,
  onRecordUpdated,
  onRecordDeleted,
}: GraduationSemesterBoardProps) {
  const cards =
    createGraduationBoard(
      user,
      curriculum,
      records,
    )

  return (
    <section className="graduation-board-section">
      <header className="graduation-board-section-header">
        <div>
          <p>학기별 이수 현황</p>

          <h2>
            전공 교육과정 이수 보드
          </h2>
        </div>

        <div className="graduation-board-legend">
          <span>
            <i className="graduation-board-legend-completed" />
            이수
          </span>

          <span>
            <i className="graduation-board-legend-scheduled" />
            수강 예정·중
          </span>

          <span>
            <i className="graduation-board-legend-failed" />
            미이수
          </span>

          <span>
            <i className="graduation-board-legend-substituted" />
            대체 인정
          </span>

          <span>
            <i className="graduation-board-legend-unmatched" />
            졸업요건 미연결
          </span>
        </div>

      </header>

      <div
        className="graduation-board-scroll"
        aria-label="학기별 전공 이수 현황"
      >
        <div className="graduation-board-list">
          {cards.map((card) => (
            <BoardCard
              card={card}
              curriculum={curriculum}
              generalEducation={
                generalEducation
              }
              entryYear={user.entryYear}
              onRecordCreated={
                onRecordCreated
              }
              onRecordUpdated={
                onRecordUpdated
              }
              onRecordDeleted={
                onRecordDeleted
              }
              key={
                card.kind ===
                  'transferCredits'
                  ? 'transfer-credits'
                  : (
                    `${card.grade}-` +
                    card.semester
                  )
              }
            />
          ))}
        </div>
      </div>
    </section>
  )
}
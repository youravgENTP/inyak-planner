import {
  useEffect,
  useRef,
  useState,
} from 'react'

import type {
  AuthUser,
} from '../../domain/auth/api'
import type {
  CourseRecord,
  CourseRecordStatus,
} from '../../domain/course-records/types'
import type {
  Curriculum,
} from '../../domain/curriculum/types'
import {
  createGraduationBoard,
} from '../../domain/graduation-progress/createSemesterBoard'
import type {
  GraduationBoardCard,
  SemesterBoardCard,
  TransferCreditBoardCard,
} from '../../domain/graduation-progress/createSemesterBoard'

import {
  MajorTransferCreditModal,
} from '../MajorTransferCreditModal/MajorTransferCreditModal'

import './GraduationSemesterBoard.css'


interface GraduationSemesterBoardProps {
  user: AuthUser
  curriculum: Curriculum
  records: readonly CourseRecord[]
  onRecordCreated: (
    record: CourseRecord,
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
  status: CourseRecordStatus,
): string {
  if (status === 'completed') {
    return (
      'graduation-board-course--completed'
    )
  }

  if (
    status === 'planned' ||
    status === 'in_progress'
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
  const allRecords = [
    ...card.courses
      .map((course) => course.record)
      .filter(
        (
          record,
        ): record is CourseRecord =>
          record !== null,
      ),
    ...card.unmatchedRecords,
  ]

  const requiredRecords =
    allRecords.filter(
      (record) =>
        record.completionType ===
        '전필',
    )

  const electiveRecords =
    allRecords.filter(
      (record) =>
        record.completionType ===
        '전선',
    )

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

  return {
    requiredRecorded:
      requiredRecords.length,
    requiredTotal:
      requiredCourses.length,
    requiredCredits:
      requiredRecords.reduce(
        (total, record) =>
          total + record.credits,
        0,
      ),
    electiveRecorded:
      electiveRecords.length,
    electiveTotal:
      electiveCourses.length,
    electiveCredits:
      electiveRecords.reduce(
        (total, record) =>
          total + record.credits,
        0,
      ),
  }
}


function SemesterCard({
  card,
}: {
  card: SemesterBoardCard
}) {
  const summary =
    getSemesterSummary(card)

  return (
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
          disabled
          title="다음 단계에서 과목 입력 기능을 추가합니다."
          type="button"
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
                        record.status,
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
              className={
                'graduation-board-course ' +
                getStatusClassName(
                  record.status,
                )
              }
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
              </div>
            </li>
          ),
        )}
      </ul>
    </article>
  )
}


function TransferCreditCard({
  card,
  curriculum,
  onRecordCreated,
}: {
  card: TransferCreditBoardCard
  curriculum: Curriculum
  onRecordCreated: (
    record: CourseRecord,
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

  const menuRef =
    useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!menuIsOpen) {
      return
    }

    function handlePointerDown(
      event: PointerEvent,
    ) {
      if (
        menuRef.current === null ||
        menuRef.current.contains(
          event.target as Node,
        )
      ) {
        return
      }

      setMenuIsOpen(false)
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
  }, [menuIsOpen])

  const totalCredits =
    card.records.reduce(
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
                }}
              >
                <strong>교양</strong>
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <div className="graduation-board-transfer-summary">
        <span>
          인정 과목 {card.records.length}개
        </span>

        <strong>
          총 {totalCredits}학점
        </strong>
      </div>

      {card.records.length === 0 ? (
        <p className="graduation-board-empty">
          등록된 전적대 인정 과목이
          없습니다.
        </p>
      ) : (
        <ul className="graduation-board-course-list">
          {card.records.map(
            (record) => (
              <li
                className="
                  graduation-board-course
                  graduation-board-course--substituted
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
                </div>
              </li>
            ),
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
    </>
  )
}


function BoardCard({
  card,
  curriculum,
  onRecordCreated,
}: {
  card: GraduationBoardCard
  curriculum: Curriculum
  onRecordCreated: (
    record: CourseRecord,
  ) => void
}) {
  if (card.kind === 'transferCredits') {
    return (
      <TransferCreditCard
        card={card}
        curriculum={curriculum}
        onRecordCreated={
          onRecordCreated
        }
      />
    )
  }

  return (
    <SemesterCard card={card} />
  )
}


export function GraduationSemesterBoard({
  user,
  curriculum,
  records,
  onRecordCreated,
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
            <i className="graduation-board-legend-substituted" />
            대체 인정
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
              onRecordCreated={
                onRecordCreated
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
import {
  useState,
} from 'react'

import type {
  AuthUser,
} from '../../domain/auth/api'
import {
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
  createGraduationYearBoard,
} from '../../domain/graduation-progress/createSemesterBoard'
import type {
  YearBoardCard,
  YearSemesterBoard,
} from '../../domain/graduation-progress/createSemesterBoard'
import {
  TransferCreditCard,
} from '../TransferCreditCard/TransferCreditCard'
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


type SemesterSectionKey =
  | 'required'
  | 'elective'
  | 'generalEducation'
  | 'unmatched'


function recordFulfillsRequirement(
  record: CourseRecord,
): boolean {
  return (
    record.letterGrade !== 'F' &&
    (
      record.status === 'completed' ||
      record.status === 'substituted'
    )
  )
}


function GraduationBoardCourse({
  courseName,
  completionType,
  credits,
  semester,
  record,
}: {
  courseName: string
  completionType:
    CourseRecord['completionType']
  credits: number | null
  semester: number | null
  record: CourseRecord | null
}) {
  const statusClassName =
    record === null
      ? ''
      : (
        ` ${getStatusClassName(
          record,
        )}`
      )

  return (
    <li
      className={
        `graduation-board-course${statusClassName}`
      }
    >
      <div>
        <strong>
          {courseName}
        </strong>

        <span>
          {completionType}
          {' · '}
          {formatCredits(credits)}

          {semester !== null ? (
            <>
              {' · '}
              {semester}학기
            </>
          ) : null}
        </span>
      </div>
    </li>
  )
}



function SemesterCard({
  card,
  grade,
  curriculum,
  onRecordUpdated,
}: {
  card: YearSemesterBoard
  grade: number
  curriculum: Curriculum
  onRecordUpdated: (
    record: CourseRecord,
  ) => void
}) {
  const [
    openSection,
    setOpenSection,
  ] = useState<SemesterSectionKey | null>(
    null,
  )

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

  const fulfilledRequiredCourses =
    card.requiredCourses.filter(
      ({ record }) =>
        record !== null &&
        recordFulfillsRequirement(
          record,
        ),
    )

  const fulfilledRequiredCredits =
    fulfilledRequiredCourses.reduce(
      (total, { curriculumCourse }) =>
        total +
        (curriculumCourse.credits ?? 0),
      0,
    )

  const requiredTotalCredits =
    card.requiredCourses.reduce(
      (total, { curriculumCourse }) =>
        total +
        (curriculumCourse.credits ?? 0),
      0,
    )

  const electiveCredits =
    card.electiveRecords.reduce(
      (total, { record }) =>
        total + record.credits,
      0,
    )

  const generalEducationCredits =
    card.generalEducationRecords.reduce(
      (total, record) =>
        total + record.credits,
      0,
    )

  const hasRequiredSection =
    card.requiredCourses.length > 0

  const hasElectiveSection =
    card.electiveRecords.length > 0

  const hasGeneralEducationSection =
    card.generalEducationRecords.length >
    0

  /*
   * 졸업요건 미연결 UI는
   * 후속 단계에서 다시 구현합니다.
   */
  const hasUnmatchedSection = false

  const hasVisibleSection =
    hasRequiredSection ||
    hasElectiveSection ||
    hasGeneralEducationSection ||
    hasUnmatchedSection

  function toggleSection(
    section: SemesterSectionKey,
  ) {
    setOpenSection(
      (currentSection) =>
        currentSection === section
          ? null
          : section,
    )
  }

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
    <article className="graduation-board-card">
      <header className="graduation-board-card-header">
        <div>
          <span>학년별 이수 현황</span>

          <h3>
            {grade}학년
          </h3>
        </div>
      </header>

      {!hasVisibleSection ? (
        <p className="graduation-board-empty graduation-board-empty--semester">
          표시할 이수 항목이 없습니다.
        </p>
      ) : null}

      <div className="graduation-board-accordion">
        {hasRequiredSection ? (
          <div className="graduation-board-accordion-section">
            <button
              aria-expanded={
                openSection === 'required'
              }
              className="graduation-board-accordion-toggle"
              type="button"
              onClick={() => {
                toggleSection('required')
              }}
            >
              <span className="graduation-board-accordion-summary">
                <span className="graduation-board-accordion-label">
                  전필
                </span>

                <strong>
                  {
                    fulfilledRequiredCourses
                      .length
                  }
                  {' / '}
                  {card.requiredCourses.length}
                  과목
                  {' · '}
                  {fulfilledRequiredCredits}
                  {' / '}
                  {requiredTotalCredits}
                  학점
                </strong>
              </span>

              <span
                aria-hidden="true"
                className={
                  'graduation-board-accordion-chevron' +
                  (
                    openSection === 'required'
                      ? ' graduation-board-accordion-chevron--open'
                      : ''
                  )
                }
              >
                ▾
              </span>
            </button>

            {openSection === 'required' ? (
              <ul className="graduation-board-course-list">
                {card.requiredCourses.map(
                  ({
                    curriculumCourse,
                    record,
                  }) => (
                    <GraduationBoardCourse
                      completionType="전필"
                      courseName={
                        curriculumCourse
                          .courseName
                      }
                      credits={
                        curriculumCourse
                          .credits
                      }
                      semester={
                        curriculumCourse
                          .semester
                      }
                      key={
                        curriculumCourse.id
                      }
                      record={record}
                    />
                  ),
                )}
              </ul>
            ) : null}
          </div>
        ) : null}

        {hasElectiveSection ? (
          <div className="graduation-board-accordion-section">
            <button
              aria-expanded={
                openSection === 'elective'
              }
              className="graduation-board-accordion-toggle"
              type="button"
              onClick={() => {
                toggleSection('elective')
              }}
            >
              <span className="graduation-board-accordion-summary">
                <span className="graduation-board-accordion-label">
                  전선
                </span>

                <strong>
                  {card.electiveRecords.length}
                  과목
                  {' · '}
                  {electiveCredits}학점
                </strong>
              </span>

              <span
                aria-hidden="true"
                className={
                  'graduation-board-accordion-chevron' +
                  (
                    openSection === 'elective'
                      ? ' graduation-board-accordion-chevron--open'
                      : ''
                  )
                }
              >
                ▾
              </span>
            </button>

            {openSection === 'elective' ? (
              <ul className="graduation-board-course-list">
                {card.electiveRecords.map(
                  ({
                    curriculumCourse,
                    record,
                  }) => (
                    <GraduationBoardCourse
                      completionType={
                        curriculumCourse
                          .completionType
                      }
                      courseName={
                        record.courseName
                      }
                      credits={
                        record.credits
                      }
                      semester={
                        record.status ===
                        'substituted'
                          ? (
                            curriculumCourse
                              .semester
                          )
                          : record.semester
                      }
                      key={record.id}
                      record={record}
                    />
                  ),
                )}
              </ul>
            ) : null}
          </div>
        ) : null}

        {hasGeneralEducationSection ? (
          <div className="graduation-board-accordion-section">
            <button
              aria-expanded={
                openSection ===
                'generalEducation'
              }
              className="graduation-board-accordion-toggle"
              type="button"
              onClick={() => {
                toggleSection(
                  'generalEducation',
                )
              }}
            >
              <span className="graduation-board-accordion-summary">
                <span className="graduation-board-accordion-label">
                  교양
                </span>

                <strong>
                  {
                    card
                      .generalEducationRecords
                      .length
                  }
                  과목
                  {' · '}
                  {generalEducationCredits}
                  학점
                </strong>
              </span>

              <span
                aria-hidden="true"
                className={
                  'graduation-board-accordion-chevron' +
                  (
                    openSection ===
                    'generalEducation'
                      ? ' graduation-board-accordion-chevron--open'
                      : ''
                  )
                }
              >
                ▾
              </span>
            </button>

            {openSection ===
            'generalEducation' ? (
              <ul className="graduation-board-course-list">
                {card.generalEducationRecords.map(
                  (record) => (
                    <GraduationBoardCourse
                      completionType={
                        record.completionType
                      }
                      courseName={
                        record.courseName
                      }
                      credits={
                        record.credits
                      }
                      semester={
                        record.semester
                      }
                      key={record.id}
                      record={record}
                    />
                  ),
                )}
              </ul>
            ) : null}
          </div>
        ) : null}

        {hasUnmatchedSection ? (
          <div className="graduation-board-accordion-section graduation-board-accordion-section--unmatched">
            <button
              aria-expanded={
                openSection === 'unmatched'
              }
              className="graduation-board-accordion-toggle graduation-board-accordion-toggle--unmatched"
              type="button"
              onClick={() => {
                toggleSection('unmatched')
              }}
            >
              <span className="graduation-board-accordion-summary">
                <span className="graduation-board-accordion-label">
                  졸업요건 미연결
                </span>

                <strong>
                  {
                    card.unmatchedRecords
                      .length
                  }
                  과목 · 연결 필요
                </strong>
              </span>

              <span
                aria-hidden="true"
                className={
                  'graduation-board-accordion-chevron' +
                  (
                    openSection === 'unmatched'
                      ? ' graduation-board-accordion-chevron--open'
                      : ''
                  )
                }
              >
                ▾
              </span>
            </button>

            {openSection === 'unmatched' ? (
              <ul className="graduation-board-course-list">
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
                          {
                            record
                              .completionType
                          }
                          {' · '}
                          {formatCredits(
                            record.credits,
                          )}
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
                              onChange={(
                                event,
                              ) => {
                                setSelectedCurriculumCourseId(
                                  event.target
                                    .value,
                                )

                                setLinkError(
                                  null,
                                )
                              }}
                            >
                              <option value="">
                                공식 과목 선택
                              </option>

                              {curriculum.courses.map(
                                (course) => (
                                  <option
                                    key={
                                      course.id
                                    }
                                    value={
                                      course.id
                                    }
                                  >
                                    {
                                      course.grade
                                    }
                                    학년{' '}
                                    {
                                      course.semester
                                    }
                                    학기
                                    {' · '}
                                    {
                                      course
                                        .completionType
                                    }
                                    {' · '}
                                    {
                                      course
                                        .courseName
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

                            {linkError !==
                            null ? (
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
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  )
}

function YearCard({
  card,
  curriculum,
  onRecordUpdated,
}: {
  card: YearBoardCard
  curriculum: Curriculum
  onRecordUpdated: (
    record: CourseRecord,
  ) => void
}) {
  /*
   * 학년 카드는 1학기와 2학기를
   * 하나의 accordion 카드로 합칩니다.
   *
   * 원래 semester 정보는 각 공식 과목 또는
   * CourseRecord에 그대로 남아 있으므로
   * 과목 상세에서 다시 표시할 수 있습니다.
   */
  const combinedCard:
    YearSemesterBoard = {
      semester: 0,

      requiredCourses:
        card.semesters.flatMap(
          (semesterBoard) =>
            semesterBoard
              .requiredCourses,
        ),

      electiveRecords:
        card.semesters.flatMap(
          (semesterBoard) =>
            semesterBoard
              .electiveRecords,
        ),

      generalEducationRecords:
        card.semesters.flatMap(
          (semesterBoard) =>
            semesterBoard
              .generalEducationRecords,
        ),

      unmatchedRecords:
        card.semesters.flatMap(
          (semesterBoard) =>
            semesterBoard
              .unmatchedRecords,
        ),
    }

  return (
    <section className="graduation-board-year-group">
      <SemesterCard
        card={combinedCard}
        grade={card.grade}
        curriculum={curriculum}
        onRecordUpdated={
          onRecordUpdated
        }
      />
    </section>
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
  const board =
    createGraduationYearBoard(
      user,
      curriculum,
      records,
    )

  return (
    <section className="graduation-board-section">
      <header className="graduation-board-section-header">
        <div>
          <p>학년별 이수 현황</p>

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
        aria-label="학년별 전공 이수 현황"
      >
        <div className="graduation-board-list">
          {board.transferCredits !== null ? (
            <TransferCreditCard
              readOnly
              card={board.transferCredits}
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
          ) : null}

          {board.years.map((card) => (
            <YearCard
              card={card}
              curriculum={curriculum}
              onRecordUpdated={
                onRecordUpdated
              }
              key={card.grade}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
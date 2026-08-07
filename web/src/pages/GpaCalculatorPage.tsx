import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  CourseRecordModal,
} from '../components/CourseRecordModal/CourseRecordModal'

import {
  deleteCourseRecord,
  getCourseRecords,
  updateCourseRecord,
} from '../domain/course-records/api'

import type {
  AuthUser,
} from '../domain/auth/api'

import type {
  CourseRecord,
  CourseRecordInput,
} from '../domain/course-records/types'

import './GpaCalculatorPage.css'


interface SemesterDefinition {
  grade: number
  semester: number
}


interface GpaSummary {
  gpa: number | null
  majorGpa: number | null
  earnedCredits: number
}


const SEMESTERS: SemesterDefinition[] =
  Array.from(
    { length: 6 },
    (_, gradeIndex) => {
      const grade = gradeIndex + 1

      return [
        {
          grade,
          semester: 1,
        },
        {
          grade,
          semester: 2,
        },
      ]
    },
  ).flat()


const GRADE_POINTS:
  Record<string, number> = {
    'A+': 4.5,
    A0: 4,
    'B+': 3.5,
    B0: 3,
    'C+': 2.5,
    C0: 2,
    'D+': 1.5,
    D0: 1,
    F: 0,
  }


function isActiveRecord(
  record: CourseRecord,
): boolean {
  return (
    record.status === 'planned' ||
    record.status === 'in_progress'
  )
}


function isMajorRecord(
  record: CourseRecord,
): boolean {
  return (
    record.completionType === '전필' ||
    record.completionType === '전선'
  )
}


function formatCredits(
  credits: number,
): string {
  return Number.isInteger(credits)
    ? `${credits}학점`
    : `${credits.toFixed(1)}학점`
}


function formatGpa(
  gpa: number | null,
): string {
  if (gpa === null) {
    return '—'
  }

  return gpa.toFixed(2)
}


function calculateGpaSummary(
  records: readonly CourseRecord[],
  includeActiveRecords: boolean,
): GpaSummary {
  const includedRecords =
    records.filter((record) => {
      if (
        record.status === 'substituted' ||
        record.letterGrade === null
      ) {
        return false
      }

      if (record.status === 'completed') {
        return true
      }

      return (
        includeActiveRecords &&
        isActiveRecord(record)
      )
    })

  const gradeRecords =
    includedRecords.filter(
      (record) =>
        GRADE_POINTS[
          record.letterGrade ?? ''
        ] !== undefined,
    )

  const totalGradeCredits =
    gradeRecords.reduce(
      (total, record) =>
        total + record.credits,
      0,
    )

  const totalGradePoints =
    gradeRecords.reduce(
      (total, record) =>
        total +
        (
          GRADE_POINTS[
            record.letterGrade ?? ''
          ] * record.credits
        ),
      0,
    )

  const majorRecords =
    gradeRecords.filter(
      isMajorRecord,
    )

  const majorGradeCredits =
    majorRecords.reduce(
      (total, record) =>
        total + record.credits,
      0,
    )

  const majorGradePoints =
    majorRecords.reduce(
      (total, record) =>
        total +
        (
          GRADE_POINTS[
            record.letterGrade ?? ''
          ] * record.credits
        ),
      0,
    )

  const earnedCredits =
    includedRecords.reduce(
      (total, record) => {
        if (record.letterGrade === 'F') {
          return total
        }

        return total + record.credits
      },
      0,
    )

  return {
    gpa:
      totalGradeCredits > 0
        ? totalGradePoints /
          totalGradeCredits
        : null,
    majorGpa:
      majorGradeCredits > 0
        ? majorGradePoints /
          majorGradeCredits
        : null,
    earnedCredits,
  }
}


function createRecordInput(
  record: CourseRecord,
  status: CourseRecord['status'],
): CourseRecordInput {
  return {
    curriculumCourseId:
      record.curriculumCourseId,
    lectureId:
      record.lectureId,
    generalEducationRequirementId:
      record.generalEducationRequirementId,
    generalEducationAreaId:
      record.generalEducationAreaId,
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
    completionType:
      record.completionType,
    credits:
      record.credits,
    status,
    letterGrade:
      record.letterGrade,
    isRetake:
      record.isRetake,
    note:
      record.note,
  }
}

interface GpaCalculatorPageProps {
  user: AuthUser
}

export function GpaCalculatorPage({
  user,
}: GpaCalculatorPageProps) {
  const [
    courseRecords,
    setCourseRecords,
  ] = useState<CourseRecord[]>([])

  const [
    selectedSemester,
    setSelectedSemester,
  ] = useState<SemesterDefinition>(
    SEMESTERS[0],
  )

  const [
    recordsAreLoading,
    setRecordsAreLoading,
  ] = useState(true)

  const [
    recordsError,
    setRecordsError,
  ] = useState<string | null>(null)

  const [
    statusIsUpdating,
    setStatusIsUpdating,
  ] = useState(false)

  const [
    recordModalIsOpen,
    setRecordModalIsOpen,
  ] = useState(false)

  const [
    openMenuRecordId,
    setOpenMenuRecordId,
  ] = useState<string | null>(null)

  const [
    deletingRecordId,
    setDeletingRecordId,
  ] = useState<string | null>(null)

  useEffect(() => {
    let requestIsActive = true

    async function loadCourseRecords() {
      setRecordsAreLoading(true)
      setRecordsError(null)

      try {
        const records =
          await getCourseRecords()

        if (requestIsActive) {
          setCourseRecords(records)
        }
      } catch (error) {
        if (!requestIsActive) {
          return
        }

        setRecordsError(
          error instanceof Error
            ? error.message
            : '수강 기록을 불러오지 못했습니다.',
        )
      } finally {
        if (requestIsActive) {
          setRecordsAreLoading(false)
        }
      }
    }

    void loadCourseRecords()

    return () => {
      requestIsActive = false
    }
  }, [])

  const regularRecords =
    useMemo(
      () =>
        courseRecords.filter(
          (record) =>
            record.status !==
              'substituted' &&
            record.grade !== null &&
            record.semester !== null,
        ),
      [courseRecords],
    )

  const selectedRecords =
    useMemo(
      () =>
        regularRecords
          .filter(
            (record) =>
              record.grade ===
                selectedSemester.grade &&
              record.semester ===
                selectedSemester.semester,
          )
          .sort(
            (firstRecord, secondRecord) =>
              firstRecord.courseName
                .localeCompare(
                  secondRecord.courseName,
                  'ko-KR',
                ),
          ),
      [
        regularRecords,
        selectedSemester,
      ],
    )

  const confirmedSummary =
    useMemo(
      () =>
        calculateGpaSummary(
          regularRecords,
          false,
        ),
      [regularRecords],
    )

  const projectedSummary =
    useMemo(
      () =>
        calculateGpaSummary(
          regularRecords,
          true,
        ),
      [regularRecords],
    )

  const semesterConfirmedSummary =
    useMemo(
      () =>
        calculateGpaSummary(
          selectedRecords,
          false,
        ),
      [selectedRecords],
    )

  const semesterProjectedSummary =
    useMemo(
      () =>
        calculateGpaSummary(
          selectedRecords,
          true,
        ),
      [selectedRecords],
    )

  const allSelectedRecordsAreActive =
    selectedRecords.length > 0 &&
    selectedRecords.every(
      isActiveRecord,
    )

  async function toggleRecordStatus(
    record: CourseRecord,
  ) {
    if (statusIsUpdating) {
      return
    }

    setStatusIsUpdating(true)
    setRecordsError(null)

    const nextStatus =
      isActiveRecord(record)
        ? 'completed'
        : 'in_progress'

    try {
      const updatedRecord =
        await updateCourseRecord(
          record.id,
          createRecordInput(
            record,
            nextStatus,
          ),
        )

      setCourseRecords(
        (currentRecords) =>
          currentRecords.map(
            (currentRecord) =>
              currentRecord.id ===
              updatedRecord.id
                ? updatedRecord
                : currentRecord,
          ),
      )
    } catch (error) {
      setRecordsError(
        error instanceof Error
          ? error.message
          : '수강 상태를 변경하지 못했습니다.',
      )
    } finally {
      setStatusIsUpdating(false)
    }
  }

  async function toggleAllRecordStatuses() {
    if (
      statusIsUpdating ||
      selectedRecords.length === 0
    ) {
      return
    }

    setStatusIsUpdating(true)
    setRecordsError(null)

    const nextStatus =
      allSelectedRecordsAreActive
        ? 'completed'
        : 'in_progress'

    try {
      const updatedRecords =
        await Promise.all(
          selectedRecords.map(
            (record) =>
              updateCourseRecord(
                record.id,
                createRecordInput(
                  record,
                  nextStatus,
                ),
              ),
          ),
        )

      const updatedRecordMap =
        new Map(
          updatedRecords.map(
            (record) => [
              record.id,
              record,
            ],
          ),
        )

      setCourseRecords(
        (currentRecords) =>
          currentRecords.map(
            (record) =>
              updatedRecordMap.get(
                record.id,
              ) ?? record,
          ),
      )
    } catch (error) {
      setRecordsError(
        error instanceof Error
          ? error.message
          : '전체 수강 상태를 변경하지 못했습니다.',
      )
    } finally {
      setStatusIsUpdating(false)
    }
  }

  async function handleDeleteRecord(
    record: CourseRecord,
  ) {
    if (deletingRecordId !== null) {
      return
    }

    const deletionWasConfirmed =
      window.confirm(
        `"${record.courseName}" 과목 기록을 삭제하시겠습니까?`,
      )

    if (!deletionWasConfirmed) {
      return
    }

    setDeletingRecordId(record.id)
    setOpenMenuRecordId(null)
    setRecordsError(null)

    try {
      await deleteCourseRecord(
        record.id,
      )

      setCourseRecords(
        (currentRecords) =>
          currentRecords.filter(
            (currentRecord) =>
              currentRecord.id !==
              record.id,
          ),
      )
    } catch (error) {
      setRecordsError(
        error instanceof Error
          ? error.message
          : '과목 기록을 삭제하지 못했습니다.',
      )
    } finally {
      setDeletingRecordId(null)
    }
  }

  return (
    <section className="gpa-records-page">
      <header className="gpa-records-header">
        <div>
          <p>졸업 요건</p>

          <h1>
            수강 기록 &amp; GPA
          </h1>

          <span>
            학기별 수강 과목과 성적을
            입력하고, 확정 성적과 예상
            성적을 함께 비교합니다.
          </span>
        </div>
      </header>

      <section className="gpa-overview">
        <div className="gpa-overview-metrics">
          <article>
            <span>전체 평점</span>

            <strong>
              {formatGpa(
                confirmedSummary.gpa,
              )}
            </strong>

            <small>
              예상{' '}
              {formatGpa(
                projectedSummary.gpa,
              )}
            </small>
          </article>

          <article>
            <span>전공 평점</span>

            <strong>
              {formatGpa(
                confirmedSummary.majorGpa,
              )}
            </strong>

            <small>
              예상{' '}
              {formatGpa(
                projectedSummary.majorGpa,
              )}
            </small>
          </article>

          <article>
            <span>취득 학점</span>

            <strong>
              {formatCredits(
                confirmedSummary
                  .earnedCredits,
              )}
            </strong>

            <small>
              예상{' '}
              {formatCredits(
                projectedSummary
                  .earnedCredits,
              )}
            </small>
          </article>
        </div>

        <div className="gpa-overview-visuals">
          <article>
            <header>
              <h2>학기별 GPA</h2>

              <div className="gpa-chart-legend">
                <span>
                  <i />
                  확정
                </span>

                <span>
                  <i className="gpa-chart-legend-projected" />
                  예상 포함
                </span>
              </div>
            </header>

            <div className="gpa-chart-placeholder">
              GPA 그래프는 다음 단계에서
              연결합니다.
            </div>
          </article>

          <article>
            <header>
              <h2>성적 분포</h2>
            </header>

            <div className="gpa-chart-placeholder">
              성적 분포는 다음 단계에서
              연결합니다.
            </div>
          </article>
        </div>
      </section>

      <nav
        aria-label="학기 선택"
        className="gpa-semester-tabs"
      >
        {SEMESTERS.map(
          (semesterDefinition) => {
            const isSelected =
              semesterDefinition.grade ===
                selectedSemester.grade &&
              semesterDefinition.semester ===
                selectedSemester.semester

            return (
              <button
                aria-current={
                  isSelected
                    ? 'page'
                    : undefined
                }
                className={
                  `gpa-semester-tab${
                    isSelected
                      ? ' gpa-semester-tab--active'
                      : ''
                  }`
                }
                key={
                  `${semesterDefinition.grade}-` +
                  semesterDefinition.semester
                }
                type="button"
                onClick={() => {
                  setSelectedSemester(
                    semesterDefinition,
                  )
                }}
              >
                {semesterDefinition.grade}
                학년{' '}
                {semesterDefinition.semester}
                학기
              </button>
            )
          },
        )}
      </nav>

      {recordsAreLoading ? (
        <div className="gpa-records-message">
          수강 기록을 불러오고 있습니다.
        </div>
      ) : null}

      {recordsError !== null ? (
        <div
          className="
            gpa-records-message
            gpa-records-message--error
          "
          role="alert"
        >
          {recordsError}
        </div>
      ) : null}

      {!recordsAreLoading ? (
        <section className="gpa-semester-detail">
          <header className="gpa-semester-detail-header">
            <div>
              <p>선택 학기</p>

              <h2>
                {selectedSemester.grade}
                학년{' '}
                {selectedSemester.semester}
                학기
              </h2>
            </div>

            <button
              type="button"
              onClick={() => {
                setRecordModalIsOpen(true)
              }}
            >
              + 과목 입력하기
            </button>
          </header>

          <div className="gpa-semester-metrics">
            <article>
              <span>평점</span>

              <strong>
                {formatGpa(
                  semesterConfirmedSummary.gpa,
                )}
              </strong>

              <small>
                예상{' '}
                {formatGpa(
                  semesterProjectedSummary.gpa,
                )}
              </small>
            </article>

            <article>
              <span>전공 평점</span>

              <strong>
                {formatGpa(
                  semesterConfirmedSummary
                    .majorGpa,
                )}
              </strong>

              <small>
                예상{' '}
                {formatGpa(
                  semesterProjectedSummary
                    .majorGpa,
                )}
              </small>
            </article>

            <article>
              <span>취득 학점</span>

              <strong>
                {formatCredits(
                  semesterConfirmedSummary
                    .earnedCredits,
                )}
              </strong>

              <small>
                예상{' '}
                {formatCredits(
                  semesterProjectedSummary
                    .earnedCredits,
                )}
              </small>
            </article>
          </div>

          <div className="gpa-course-table">
            <div className="gpa-course-table-header">
              <div className="gpa-course-name-heading">
                <span>과목명</span>

                {selectedRecords.length > 0 ? (
                  <button
                    disabled={
                      statusIsUpdating
                    }
                    type="button"
                    onClick={() => {
                      void toggleAllRecordStatuses()
                    }}
                  >
                    {allSelectedRecordsAreActive
                      ? '모든 과목 확정으로 전환'
                      : '모든 과목 수강 (예정) 중 전환'}
                  </button>
                ) : null}
              </div>

              <span>학점</span>
              <span>성적</span>
              <span>이수구분</span>
              <span />
            </div>

            {selectedRecords.length === 0 ? (
              <div className="gpa-course-empty">
                <strong>
                  등록된 과목이 없습니다.
                </strong>

                <p>
                  이 학기의 과목을 입력하면
                  GPA와 개인 이수현황에
                  자동으로 반영됩니다.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setRecordModalIsOpen(true)
                  }}
                >
                  + 과목 입력하기
                </button>
              </div>
            ) : (
              selectedRecords.map(
                (record) => {
                  const recordIsActive =
                    isActiveRecord(record)

                  return (
                    <div
                      className={
                        `gpa-course-row${
                          recordIsActive
                            ? ' gpa-course-row--active'
                            : ''
                        }`
                      }
                      key={record.id}
                    >
                      <div className="gpa-course-name-cell">
                        <strong>
                          {record.courseName}
                        </strong>

                        <button
                          className={
                            `gpa-course-status-toggle${
                              recordIsActive
                                ? ' gpa-course-status-toggle--active'
                                : ''
                            }`
                          }
                          disabled={
                            statusIsUpdating
                          }
                          type="button"
                          onClick={() => {
                            void toggleRecordStatus(
                              record,
                            )
                          }}
                        >
                          {recordIsActive
                            ? '수강 (예정) 중'
                            : '수강 (예정) 중 전환'}
                        </button>
                      </div>

                      <span>
                        {formatCredits(
                          record.credits,
                        )}
                      </span>

                      <span>
                        {record.letterGrade ??
                          '—'}
                      </span>

                      <span>
                        {
                          record
                            .completionType
                        }
                      </span>
                      <div className="gpa-course-menu-container">
                        <button
                          aria-expanded={
                            openMenuRecordId === record.id
                          }
                          aria-haspopup="menu"
                          aria-label={
                            `${record.courseName} 메뉴`
                          }
                          className="gpa-course-menu"
                          disabled={
                            deletingRecordId === record.id
                          }
                          type="button"
                          onClick={() => {
                            setOpenMenuRecordId(
                              (currentRecordId) =>
                                currentRecordId === record.id
                                  ? null
                                  : record.id,
                            )
                          }}
                        >
                          {deletingRecordId === record.id
                            ? '…'
                            : '⋯'}
                        </button>

                        {openMenuRecordId === record.id ? (
                          <div
                            className="gpa-course-menu-popover"
                            role="menu"
                          >
                            <button
                              className="gpa-course-menu-delete"
                              role="menuitem"
                              type="button"
                              onClick={() => {
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
                    </div>
                  )
                },
              )
            )}
          </div>
        </section>
      ) : null}

      {recordModalIsOpen ? (
        <CourseRecordModal
          entryYear={user.entryYear}
          grade={selectedSemester.grade}
          semester={
            selectedSemester.semester
          }
          onClose={() => {
            setRecordModalIsOpen(false)
          }}
          onCreated={(createdRecord) => {
            setCourseRecords(
              (currentRecords) => [
                ...currentRecords,
                createdRecord,
              ],
            )
          }}
        />
      ) : null}
    </section>
  )
}
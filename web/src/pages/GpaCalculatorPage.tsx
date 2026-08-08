import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  CourseRecordModal,
} from '../components/CourseRecordModal/CourseRecordModal'

import {
  TransferCreditCard,
} from '../components/TransferCreditCard/TransferCreditCard'

import {
  GradeDistributionChart,
} from '../components/gpa/GradeDistributionChart'

import {
  SemesterGpaChart,
} from '../components/gpa/SemesterGpaChart'

import {
  TimetableImportModal,
} from '../components/gpa/TimetableImportModal'

import type {
  AuthUser,
} from '../domain/auth/api'

import {
  deleteCourseRecord,
  getCourseRecords,
  updateCourseRecord,
} from '../domain/course-records/api'

import type {
  CourseRecord,
  CourseRecordInput,
} from '../domain/course-records/types'

import {
  fetchCurriculum,
} from '../domain/curriculum/api'

import type {
  Curriculum,
} from '../domain/curriculum/types'

import {
  fetchGeneralEducation,
} from '../domain/general-education/api'

import type {
  GeneralEducation,
} from '../domain/general-education/types'

import type {
  TransferCreditBoardCard,
} from '../domain/graduation-progress/createSemesterBoard'

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


const GRADE_OPTIONS = [
  'A+',
  'A0',
  'B+',
  'B0',
  'C+',
  'C0',
  'D+',
  'D0',
  'F',
] as const


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
  /*
   * GPA 계산 대상:
   * 성적이 입력된 과목만 사용합니다.
   */
  const gradeRecords =
    records.filter((record) => {
      if (
        record.isRetake ||
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
    }).filter(
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

  /*
   * 이수학점 계산 대상:
   * 성적 입력 여부와 무관하게
   * 완료 또는 수강 예정/중인 과목을 셉니다.
   */
  const creditRecords =
    records.filter((record) => {
      if (
        record.isRetake ||
        record.status === 'substituted'
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

  const earnedCredits =
    creditRecords.reduce(
      (total, record) => {
        /*
         * 이미 F가 확정된 과목은
         * 취득학점으로 계산하지 않습니다.
         */
        if (
          record.status === 'completed' &&
          record.letterGrade === 'F'
        ) {
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
  const availableSemesters =
    useMemo(
      () =>
        user.studentType === 'transfer'
          ? SEMESTERS.filter(
              (semesterDefinition) =>
                semesterDefinition.grade >= 3,
            )
          : SEMESTERS,
      [user.studentType],
    )

  const [
    courseRecords,
    setCourseRecords,
  ] = useState<CourseRecord[]>([])

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
    selectedSemester,
    setSelectedSemester,
  ] = useState<SemesterDefinition>(
    () =>
      user.studentType === 'transfer'
        ? {
            grade: 3,
            semester: 1,
          }
        : SEMESTERS[0],
  )

  const [
    transferTabIsSelected,
    setTransferTabIsSelected,
  ] = useState(
    user.studentType === 'transfer',
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
    addMenuIsOpen,
    setAddMenuIsOpen,
  ] = useState(false)

  const [
    timetableImportModalIsOpen,
    setTimetableImportModalIsOpen,
  ] = useState(false)

  const [
    editingRecord,
    setEditingRecord,
  ] = useState<CourseRecord | null>(
    null,
  )

  const [
    openMenuRecordId,
    setOpenMenuRecordId,
  ] = useState<string | null>(null)

  const [
    deletingRecordId,
    setDeletingRecordId,
  ] = useState<string | null>(null)

  const [
    updatingGradeRecordId,
    setUpdatingGradeRecordId,
  ] = useState<string | null>(null)

  useEffect(() => {
    let requestIsActive = true

    async function loadPageData() {
      setRecordsAreLoading(true)
      setRecordsError(null)

      try {
        const transferDataPromise =
          user.studentType ===
            'transfer' &&
          user.entryYear !== null
            ? Promise.all([
                fetchCurriculum(
                  user.entryYear,
                ),
                fetchGeneralEducation(
                  user.entryYear,
                ),
              ])
            : Promise.resolve(null)

        const [
          records,
          transferData,
        ] = await Promise.all([
          getCourseRecords(),
          transferDataPromise,
        ])

        if (requestIsActive) {
          setCourseRecords(records)

          setCurriculum(
            transferData?.[0] ?? null,
          )

          setGeneralEducation(
            transferData?.[1] ?? null,
          )
        }
      } catch (error) {
        if (!requestIsActive) {
          return
        }

        setRecordsError(
          error instanceof Error
            ? error.message
            : (
              '수강 기록과 전적대 인정 ' +
              '정보를 불러오지 못했습니다.'
            ),
        )
      } finally {
        if (requestIsActive) {
          setRecordsAreLoading(false)
        }
      }
    }

    void loadPageData()

    return () => {
      requestIsActive = false
    }
  }, [
    user.entryYear,
    user.studentType,
  ])

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

  const transferCreditCard =
    useMemo<TransferCreditBoardCard>(
      () => ({
        kind: 'transferCredits',

        records:
          courseRecords.filter(
            (record) =>
              record.status ===
                'substituted' &&
              !record.isRetake,
          ),
      }),
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

  const hasProjectedRecords =
    regularRecords.some(
      (record) =>
        !record.isRetake &&
        isActiveRecord(record),
    )

  const semesterHasProjectedRecords =
    selectedRecords.some(
      (record) =>
        !record.isRetake &&
        isActiveRecord(record),
    )

  const semesterGpaChartPoints =
    useMemo(
      () =>
        availableSemesters.map(
          (semesterDefinition) => {
            const semesterRecords =
              regularRecords.filter(
                (record) =>
                  record.grade ===
                    semesterDefinition.grade &&
                  record.semester ===
                    semesterDefinition.semester,
              )

            const confirmed =
              calculateGpaSummary(
                semesterRecords,
                false,
              )

            const projected =
              calculateGpaSummary(
                semesterRecords,
                true,
              )

            return {
              label:
                `${semesterDefinition.grade}-` +
                semesterDefinition.semester,

              confirmedGpa:
                confirmed.gpa,

              projectedGpa:
                projected.gpa,
            }
          },
        ),
      [
        availableSemesters,
        regularRecords,
      ],
    )

  const gradeDistributionPoints =
    useMemo(
      () =>
        GRADE_OPTIONS.map(
          (gradeOption) => ({
            grade: gradeOption,

            count:
              regularRecords.filter(
                (record) =>
                  !record.isRetake &&
                  record.status ===
                    'completed' &&
                  record.letterGrade ===
                    gradeOption,
              ).length,
          }),
        ),
      [regularRecords],
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

  async function handleGradeChange(
  record: CourseRecord,
  selectedValue: string,
) {
  if (updatingGradeRecordId !== null) {
    return
  }

  const nextIsRetake =
    selectedValue === 'retake'

  const nextLetterGrade =
    nextIsRetake ||
    selectedValue.length === 0
      ? null
      : selectedValue

  const nextStatus =
    nextIsRetake
      ? record.status
      : selectedValue.length === 0
        ? 'in_progress'
        : 'completed'

  setUpdatingGradeRecordId(
    record.id,
  )

  setRecordsError(null)

  try {
    const input: CourseRecordInput = {
      ...createRecordInput(
        record,
        nextStatus,
      ),
      letterGrade:
        nextLetterGrade,
      isRetake:
        nextIsRetake,
    }

    const updatedRecord =
      await updateCourseRecord(
        record.id,
        input,
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
        : '성적을 변경하지 못했습니다.',
    )
  } finally {
    setUpdatingGradeRecordId(
      null,
    )
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
            수강이력 입력 &amp; GPA 계산
          </h1>

          <span>
            학기별 수강 과목과 성적을
            입력하고, 확정 성적과 예상
            성적을 함께 비교합니다.
          </span>
        </div>
      </header>

      <div className="gpa-workspace">
      <section className="gpa-overview">
        <div className="gpa-overview-metrics">
          <article>
            <span>전체 평점</span>

            <strong>
              {formatGpa(
                confirmedSummary.gpa,
              )}
            </strong>

            {hasProjectedRecords ? (
              <small>
                예상{' '}
                {formatGpa(
                  projectedSummary.gpa,
                )}
              </small>
            ) : null}
          </article>

          <article>
            <span>전공 평점</span>

            <strong>
              {formatGpa(
                confirmedSummary.majorGpa,
              )}
            </strong>

            {hasProjectedRecords ? (
              <small>
                예상{' '}
                {formatGpa(
                  projectedSummary.majorGpa,
                )}
              </small>
            ) : null}
          </article>

          <article>
            <span>취득 학점</span>

            <strong>
              {formatCredits(
                confirmedSummary
                  .earnedCredits,
              )}
            </strong>

            {hasProjectedRecords ? (
              <small>
                예상{' '}
                {formatCredits(
                  projectedSummary
                    .earnedCredits,
                )}
              </small>
            ) : null}
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

            <SemesterGpaChart
              points={
                semesterGpaChartPoints
              }
            />
          </article>

          <article>
            <header>
              <h2>성적 분포</h2>
            </header>

            <GradeDistributionChart
              points={
                gradeDistributionPoints
              }
            />
          </article>
        </div>
      </section>

        <div className="gpa-record-entry">
      <nav
        aria-label="학기 선택"
        className="gpa-semester-tabs"
      >
        {user.studentType ===
        'transfer' ? (
          <button
            aria-current={
              transferTabIsSelected
                ? 'page'
                : undefined
            }
            className={
              `gpa-semester-tab${
                transferTabIsSelected
                  ? ' gpa-semester-tab--active'
                  : ''
              }`
            }
            type="button"
            onClick={() => {
              setTransferTabIsSelected(
                true,
              )
              setAddMenuIsOpen(false)
            }}
          >
            전적대 학점 인정
          </button>
        ) : null}

        {availableSemesters.map(
          (semesterDefinition) => {
            const isSelected =
              !transferTabIsSelected &&
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
                  setTransferTabIsSelected(
                    false,
                  )
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

      {!recordsAreLoading &&
      transferTabIsSelected &&
      curriculum !== null &&
      generalEducation !== null ? (
        <TransferCreditCard
          variant="gpa"
          card={transferCreditCard}
          curriculum={curriculum}
          generalEducation={
            generalEducation
          }
          onRecordCreated={(
            createdRecord,
          ) => {
            setCourseRecords(
              (currentRecords) => [
                ...currentRecords,
                createdRecord,
              ],
            )
          }}
          onRecordUpdated={(
            updatedRecord,
          ) => {
            setCourseRecords(
              (currentRecords) =>
                currentRecords.map(
                  (record) =>
                    record.id ===
                    updatedRecord.id
                      ? updatedRecord
                      : record,
                ),
            )
          }}
          onRecordDeleted={(
            deletedRecordId,
          ) => {
            setCourseRecords(
              (currentRecords) =>
                currentRecords.filter(
                  (record) =>
                    record.id !==
                    deletedRecordId,
                ),
            )
          }}
        />
      ) : null}

      {!recordsAreLoading &&
      transferTabIsSelected &&
      recordsError === null &&
      (
        curriculum === null ||
        generalEducation === null
      ) ? (
        <div className="gpa-records-message">
          {user.entryYear === null
            ? (
              '전적대 학점 인정을 관리하려면 ' +
              '학번을 먼저 설정해 주세요.'
            )
            : (
              '전적대 학점 인정 정보를 ' +
              '불러오지 못했습니다.'
            )}
        </div>
      ) : null}

      {!recordsAreLoading &&
      !transferTabIsSelected ? (
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

            <div className="gpa-add-course-container">
              <button
                aria-expanded={
                  addMenuIsOpen
                }
                aria-haspopup="menu"
                aria-label="과목 추가"
                className="gpa-add-course-button"
                type="button"
                onClick={() => {
                  setAddMenuIsOpen(
                    (isOpen) => !isOpen,
                  )
                }}
              >
                +
              </button>

              {addMenuIsOpen ? (
                <div
                  className="gpa-add-course-menu"
                  role="menu"
                >
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setAddMenuIsOpen(false)

                      setTimetableImportModalIsOpen(
                        true,
                      )
                    }}
                  >
                    시간표에서 가져오기
                  </button>

                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setAddMenuIsOpen(false)
                      setEditingRecord(null)
                      setRecordModalIsOpen(true)
                    }}
                  >
                    과목 직접 입력하기
                  </button>
                </div>
              ) : null}
            </div>
          </header>

          <div className="gpa-semester-metrics">
            <article>
              <span>평점</span>

              <strong>
                {formatGpa(
                  semesterConfirmedSummary.gpa,
                )}
              </strong>

              {semesterHasProjectedRecords ? (
                <small>
                  예상{' '}
                  {formatGpa(
                    semesterProjectedSummary.gpa,
                  )}
                </small>
              ) : null}
            </article>

            <article>
              <span>전공 평점</span>

              <strong>
                {formatGpa(
                  semesterConfirmedSummary
                    .majorGpa,
                )}
              </strong>

              {semesterHasProjectedRecords ? (
                <small>
                  예상{' '}
                  {formatGpa(
                    semesterProjectedSummary
                      .majorGpa,
                  )}
                </small>
              ) : null}
            </article>

            <article>
              <span>취득 학점</span>

              <strong>
                {formatCredits(
                  semesterConfirmedSummary
                    .earnedCredits,
                )}
              </strong>

              {semesterHasProjectedRecords ? (
                <small>
                  예상{' '}
                  {formatCredits(
                    semesterProjectedSummary
                      .earnedCredits,
                  )}
                </small>
              ) : null}
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
                    setAddMenuIsOpen(true)
                  }}
                >
                  + 과목 추가하기
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
                      <select
                        aria-label={
                          `${record.courseName} 성적`
                        }
                        className="gpa-course-grade-select"
                        disabled={
                          updatingGradeRecordId !== null
                        }
                        value={
                          record.isRetake
                            ? 'retake'
                            : record.letterGrade ?? ''
                        }
                        onChange={(event) => {
                          void handleGradeChange(
                            record,
                            event.target.value,
                          )
                        }}
                      >
                        <option value="">
                          성적 미입력
                        </option>

                        {GRADE_OPTIONS.map(
                          (gradeOption) => (
                            <option
                              key={gradeOption}
                              value={gradeOption}
                            >
                              {gradeOption}
                            </option>
                          ),
                        )}

                        <option value="retake">
                          재수강
                        </option>
                      </select>
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
                              role="menuitem"
                              type="button"
                              onClick={() => {
                                setEditingRecord(record)
                                setOpenMenuRecordId(null)
                                setRecordModalIsOpen(true)
                              }}
                            >
                              수정
                            </button>

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
        </div>
      </div>

      <TimetableImportModal
        isOpen={
          timetableImportModalIsOpen
        }
        grade={
          selectedSemester.grade
        }
        semester={
          selectedSemester.semester
        }
        existingRecords={
          courseRecords
        }
        onClose={() => {
          setTimetableImportModalIsOpen(
            false,
          )
        }}
        onImported={(importedRecords) => {
          setCourseRecords(
            (currentRecords) => [
              ...currentRecords,
              ...importedRecords,
            ],
          )
        }}
      />


      {recordModalIsOpen ? (
        <CourseRecordModal
          editingRecord={editingRecord}
          entryYear={user.entryYear}
          grade={selectedSemester.grade}
          semester={
            selectedSemester.semester
          }
          onClose={() => {
            setRecordModalIsOpen(false)
            setEditingRecord(null)
          }}
          onSaved={(savedRecord) => {
            setCourseRecords(
              (currentRecords) => {
                const recordAlreadyExists =
                  currentRecords.some(
                    (record) =>
                      record.id ===
                      savedRecord.id,
                  )

                if (!recordAlreadyExists) {
                  return [
                    ...currentRecords,
                    savedRecord,
                  ]
                }

                return currentRecords.map(
                  (record) =>
                    record.id === savedRecord.id
                      ? savedRecord
                      : record,
                )
              },
            )
          }}
        />
      ) : null}
    </section>
  )
}
import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  CourseRecordModal,
} from '../components/CourseRecordModal/CourseRecordModal'
import type {
  CourseRecordSemesterSelection,
} from '../components/CourseRecordModal/CourseRecordModal'

import {
  getCourseRecords,
} from '../domain/course-records/api'
import type {
  CourseRecord,
  CourseRecordStatus,
} from '../domain/course-records/types'

import './GpaCalculatorPage.css'


interface SemesterRecordGroup {
  academicYear: number
  semester: number
  records: CourseRecord[]
}


function getStatusLabel(
  status: CourseRecordStatus,
): string {
  if (status === 'planned') {
    return '수강 예정'
  }

  if (status === 'in_progress') {
    return '수강 중'
  }

  if (status === 'completed') {
    return '이수 완료'
  }

  return '대체 인정'
}


function formatCredits(
  credits: number,
): string {
  return Number.isInteger(credits)
    ? `${credits}학점`
    : `${credits.toFixed(1)}학점`
}


function createSemesterGroups(
  records: readonly CourseRecord[],
): SemesterRecordGroup[] {
  const groupMap =
    new Map<string, SemesterRecordGroup>()

  records.forEach((record) => {
    if (
      record.academicYear === null ||
      record.semester === null ||
      record.status === 'substituted'
    ) {
      return
    }

    const key =
      `${record.academicYear}-${record.semester}`

    const existingGroup =
      groupMap.get(key)

    if (existingGroup !== undefined) {
      existingGroup.records.push(record)
      return
    }

    groupMap.set(key, {
      academicYear:
        record.academicYear,
      semester:
        record.semester,
      records: [record],
    })
  })

  return Array.from(
    groupMap.values(),
  )
    .map((group) => ({
      ...group,
      records: [...group.records].sort(
        (firstRecord, secondRecord) =>
          firstRecord.courseName
            .localeCompare(
              secondRecord.courseName,
              'ko-KR',
            ),
      ),
    }))
    .sort(
      (firstGroup, secondGroup) => {
        if (
          firstGroup.academicYear !==
          secondGroup.academicYear
        ) {
          return (
            firstGroup.academicYear -
            secondGroup.academicYear
          )
        }

        return (
          firstGroup.semester -
          secondGroup.semester
        )
      },
    )
}


export function GpaCalculatorPage() {
  const [
    courseRecords,
    setCourseRecords,
  ] = useState<CourseRecord[]>([])

  const [
    recordsAreLoading,
    setRecordsAreLoading,
  ] = useState(true)

  const [
    recordsError,
    setRecordsError,
  ] = useState<string | null>(null)

  const [
    courseRecordModalIsOpen,
    setCourseRecordModalIsOpen,
  ] = useState(false)

  const [
    selectedSemester,
    setSelectedSemester,
  ] = useState<
    CourseRecordSemesterSelection | null
  >(null)

    void selectedSemester

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

  const semesterGroups =
    useMemo(
      () =>
        createSemesterGroups(
          courseRecords,
        ),
      [courseRecords],
    )

  const regularRecords =
    useMemo(
      () =>
        semesterGroups.flatMap(
          (group) => group.records,
        ),
      [semesterGroups],
    )

  const totalCredits =
    regularRecords.reduce(
      (total, record) =>
        total + record.credits,
      0,
    )

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
            등록하고, 입력한 기록을 바탕으로
            GPA와 개인 이수현황을 계산합니다.
          </span>
        </div>

        <button
          className="gpa-records-add-semester"
          type="button"
          onClick={() => {
            setCourseRecordModalIsOpen(
              true,
            )
          }}
        >
          + 수강 기록 추가
        </button>
      </header>

      <div className="gpa-records-summary">
        <article>
          <span>등록 학기</span>

          <strong>
            {semesterGroups.length}개
          </strong>
        </article>

        <article>
          <span>등록 과목</span>

          <strong>
            {regularRecords.length}개
          </strong>
        </article>

        <article>
          <span>등록 학점</span>

          <strong>
            {formatCredits(
              totalCredits,
            )}
          </strong>
        </article>

        <article>
          <span>누적 GPA</span>

          <strong>—</strong>
        </article>
      </div>

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
      recordsError === null &&
      semesterGroups.length === 0 ? (
        <div className="gpa-records-empty">
          <strong>
            등록된 수강 기록이 없습니다.
          </strong>

          <p>
            다음 단계에서 학기를 추가하고
            수강한 과목과 성적을 입력할 수
            있습니다.
          </p>
        </div>
      ) : null}

      {!recordsAreLoading &&
      recordsError === null &&
      semesterGroups.length > 0 ? (
        <div className="gpa-semester-list">
          {semesterGroups.map(
            (group) => {
              const semesterCredits =
                group.records.reduce(
                  (total, record) =>
                    total +
                    record.credits,
                  0,
                )

              return (
                <article
                  className="gpa-semester-card"
                  key={
                    `${group.academicYear}-` +
                    group.semester
                  }
                >
                  <header className="gpa-semester-card-header">
                    <div>
                      <span>
                        {group.academicYear}
                        학년도
                      </span>

                      <h2>
                        {group.academicYear}
                        학년도{' '}
                        {group.semester}
                        학기
                      </h2>
                    </div>

                    <div className="gpa-semester-card-summary">
                      <strong>
                        {
                          group.records
                            .length
                        }
                        과목
                      </strong>

                      <span>
                        {formatCredits(
                          semesterCredits,
                        )}
                      </span>
                    </div>
                  </header>

                  <div className="gpa-semester-table">
                    <div className="gpa-semester-table-header">
                      <span>과목명</span>
                      <span>이수구분</span>
                      <span>학점</span>
                      <span>상태</span>
                      <span>성적</span>
                    </div>

                    {group.records.map(
                      (record) => (
                        <div
                          className="gpa-semester-record"
                          key={record.id}
                        >
                          <strong>
                            {
                              record
                                .courseName
                            }
                          </strong>

                          <span>
                            {
                              record
                                .completionType
                            }
                          </span>

                          <span>
                            {formatCredits(
                              record.credits,
                            )}
                          </span>

                          <span>
                            {getStatusLabel(
                              record.status,
                            )}
                          </span>

                          <span>
                            {
                              record
                                .letterGrade ??
                              '—'
                            }
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                </article>
              )
            },
          )}
        </div>
      ) : null}
      {courseRecordModalIsOpen ? (
        <CourseRecordModal
          onClose={() => {
            setCourseRecordModalIsOpen(
              false,
            )
          }}
          onContinue={(selection) => {
            setSelectedSemester(
              selection,
            )
            setCourseRecordModalIsOpen(
              false,
            )
          }}
        />
      ) : null}
    </section>
  )
}
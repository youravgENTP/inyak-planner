import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  createCourseRecord,
} from '../../domain/course-records/api'

import type {
  CourseCompletionType,
  CourseRecord,
  CourseRecordInput,
} from '../../domain/course-records/types'

import {
  fetchLectures,
} from '../../domain/lectures/api'

import type {
  Lecture,
} from '../../domain/lectures/types'

import {
  loadSavedTimetables,
  type SavedTimetable,
} from '../../domain/saved-timetables'

import './TimetableImportModal.css'


interface TimetableImportModalProps {
  isOpen: boolean
  grade: number
  semester: number

  existingRecords:
    readonly CourseRecord[]

  onClose: () => void

  onImported: (
    records: CourseRecord[],
  ) => void
}


function normalizeCompletionType(
  completionType: string | null,
): CourseCompletionType {
  const normalized =
    completionType?.trim() ?? ''

  if (
    normalized === '전필' ||
    normalized.toUpperCase() === 'ME'
  ) {
    return '전필'
  }

  if (
    normalized === '전선' ||
    normalized.toUpperCase() === 'MR'
  ) {
    return '전선'
  }

  if (normalized === '교양') {
    return '교양'
  }

  return '기타'
}


function formatCredits(
  credits: number | null,
): string {
  if (credits === null) {
    return '학점 정보 없음'
  }

  return Number.isInteger(credits)
    ? `${credits}학점`
    : `${credits.toFixed(1)}학점`
}


export function TimetableImportModal({
  isOpen,
  grade,
  semester,
  existingRecords,
  onClose,
  onImported,
}: TimetableImportModalProps) {
  const [
    timetables,
    setTimetables,
  ] = useState<SavedTimetable[]>([])

  const [
    selectedTimetableId,
    setSelectedTimetableId,
  ] = useState('')

  const [
    timetableLectures,
    setTimetableLectures,
  ] = useState<Lecture[]>([])

  const [
    lecturesAreLoading,
    setLecturesAreLoading,
  ] = useState(false)

  const [
    importIsRunning,
    setImportIsRunning,
  ] = useState(false)

  const [
    importError,
    setImportError,
  ] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const loadedTimetables =
      loadSavedTimetables()
        .sort(
          (first, second) =>
            (
              second.academicYear -
              first.academicYear
            ) ||
            (
              second.semester -
              first.semester
            ) ||
            first.name.localeCompare(
              second.name,
              'ko-KR',
            ),
        )

    setTimetables(loadedTimetables)

    const firstNonEmptyTimetable =
      loadedTimetables.find(
        (timetable) =>
          timetable.lectureIds.length > 0,
      )

    setSelectedTimetableId(
      firstNonEmptyTimetable?.id ?? '',
    )

    setTimetableLectures([])
    setImportError(null)
  }, [isOpen])

  const selectedTimetable =
    useMemo(
      () =>
        timetables.find(
          (timetable) =>
            timetable.id ===
            selectedTimetableId,
        ) ?? null,
      [
        selectedTimetableId,
        timetables,
      ],
    )

  useEffect(() => {
    if (
      !isOpen ||
      selectedTimetable === null
    ) {
      setTimetableLectures([])
      return
    }

    const resolvedTimetable =
      selectedTimetable

    let requestIsActive = true

    async function loadTimetableLectures() {
      setLecturesAreLoading(true)
      setImportError(null)

      try {
        const semesterLectures =
          await fetchLectures({
            academicYear:
              resolvedTimetable
                .academicYear,
            semester:
              resolvedTimetable
                .semester,
          })

        if (!requestIsActive) {
          return
        }

        const lectureIdSet =
          new Set(
            resolvedTimetable.lectureIds,
          )

        setTimetableLectures(
          semesterLectures.filter(
            (lecture) =>
              lectureIdSet.has(
                lecture.id,
              ),
          ),
        )
      } catch (error) {
        if (!requestIsActive) {
          return
        }

        setTimetableLectures([])

        setImportError(
          error instanceof Error
            ? error.message
            : '시간표 강의를 불러오지 못했습니다.',
        )
      } finally {
        if (requestIsActive) {
          setLecturesAreLoading(false)
        }
      }
    }

    void loadTimetableLectures()

    return () => {
      requestIsActive = false
    }
  }, [
    isOpen,
    selectedTimetable,
  ])

  const existingLectureIds =
    useMemo(
      () =>
        new Set(
          existingRecords
            .filter(
              (record) =>
                record.grade === grade &&
                record.semester ===
                  semester &&
                record.lectureId !== null,
            )
            .map(
              (record) =>
                record.lectureId as number,
            ),
        ),
      [
        existingRecords,
        grade,
        semester,
      ],
    )

  const importableLectures =
    useMemo(
      () =>
        timetableLectures.filter(
          (lecture) =>
            !existingLectureIds.has(
              lecture.id,
            ) &&
            lecture.credits !== null,
        ),
      [
        existingLectureIds,
        timetableLectures,
      ],
    )

  const importableCredits =
    importableLectures.reduce(
      (total, lecture) =>
        total + (lecture.credits ?? 0),
      0,
    )

  async function handleImport() {
    if (
      importIsRunning ||
      selectedTimetable === null ||
      importableLectures.length === 0
    ) {
      return
    }

    setImportIsRunning(true)
    setImportError(null)

    const createdRecords:
      CourseRecord[] = []

    try {
      for (
        const lecture of importableLectures
      ) {
        if (lecture.credits === null) {
          continue
        }

        const input:
          CourseRecordInput = {
          curriculumCourseId: null,
          lectureId: lecture.id,

          generalEducationRequirementId:
            null,

          generalEducationAreaId:
            null,

          academicYear:
            lecture.academicYear,

          /*
           * grade + semester는
           * GPA 화면에서 선택한 사용자의
           * 학년-학기 위치입니다.
           */
          grade,
          semester,

          courseName:
            lecture.courseName,

          courseCode:
            lecture.courseCode,

          completionType:
            normalizeCompletionType(
              lecture.completionType,
            ),

          credits:
            lecture.credits,

          status: 'in_progress',
          letterGrade: null,
          isRetake: false,
          note: null,
        }

        const createdRecord =
          await createCourseRecord(
            input,
          )

        createdRecords.push(
          createdRecord,
        )
      }

      onImported(createdRecords)
      onClose()
    } catch (error) {
      /*
       * 앞선 과목들이 이미 저장된 뒤
       * 중간에 오류가 발생할 수도 있으므로,
       * 성공한 기록은 부모 화면에 먼저
       * 반영합니다.
       */
      if (createdRecords.length > 0) {
        onImported(createdRecords)
      }

      setImportError(
        error instanceof Error
          ? error.message
          : '시간표 과목을 가져오지 못했습니다.',
      )
    } finally {
      setImportIsRunning(false)
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div
      className="timetable-import-modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget &&
          !importIsRunning
        ) {
          onClose()
        }
      }}
    >
      <section
        aria-labelledby="timetable-import-modal-title"
        aria-modal="true"
        className="timetable-import-modal"
        role="dialog"
      >
        <header className="timetable-import-modal__header">
          <div>
            <h2 id="timetable-import-modal-title">
              시간표에서 가져오기
            </h2>

            <p>
              {grade}학년 {semester}학기의
              수강 기록으로 추가합니다.
            </p>
          </div>

          <button
            aria-label="시간표 가져오기 창 닫기"
            disabled={importIsRunning}
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="timetable-import-modal__body">
          {timetables.length === 0 ? (
            <p className="timetable-import-modal__empty">
              저장된 시간표가 없습니다.
            </p>
          ) : (
            <>
              <label
                htmlFor="gpa-import-timetable"
              >
                가져올 시간표
              </label>

              <select
                id="gpa-import-timetable"
                disabled={importIsRunning}
                value={selectedTimetableId}
                onChange={(event) => {
                  setSelectedTimetableId(
                    event.target.value,
                  )
                }}
              >
                <option value="">
                  시간표 선택
                </option>

                {timetables.map(
                  (timetable) => (
                    <option
                      disabled={
                        timetable
                          .lectureIds
                          .length === 0
                      }
                      key={timetable.id}
                      value={timetable.id}
                    >
                      {timetable.academicYear}
                      학년도{' '}
                      {timetable.semester}
                      학기 ·{' '}
                      {timetable.name}
                    </option>
                  ),
                )}
              </select>

              {selectedTimetable !== null ? (
                <div className="timetable-import-modal__summary">
                  <strong>
                    {
                      selectedTimetable
                        .name
                    }
                  </strong>

                  <span>
                    {
                      selectedTimetable
                        .academicYear
                    }
                    학년도{' '}
                    {
                      selectedTimetable
                        .semester
                    }
                    학기
                  </span>
                </div>
              ) : null}

              {lecturesAreLoading ? (
                <p className="timetable-import-modal__message">
                  시간표 과목을 불러오고
                  있습니다.
                </p>
              ) : null}

              {!lecturesAreLoading &&
              selectedTimetable !== null ? (
                <div className="timetable-import-modal__courses">
                  {timetableLectures.map(
                    (lecture) => {
                      const isDuplicate =
                        existingLectureIds.has(
                          lecture.id,
                        )

                      const hasNoCredits =
                        lecture.credits ===
                        null

                      return (
                        <article
                          className={
                            `timetable-import-modal__course${
                              isDuplicate ||
                              hasNoCredits
                                ? ' timetable-import-modal__course--disabled'
                                : ''
                            }`
                          }
                          key={lecture.id}
                        >
                          <div>
                            <strong>
                              {
                                lecture
                                  .courseName
                              }
                            </strong>

                            <span>
                              {
                                normalizeCompletionType(
                                  lecture
                                    .completionType,
                                )
                              }
                              {' · '}
                              {formatCredits(
                                lecture.credits,
                              )}
                            </span>
                          </div>

                          {isDuplicate ? (
                            <small>
                              이미 등록됨
                            </small>
                          ) : hasNoCredits ? (
                            <small>
                              학점 정보 없음
                            </small>
                          ) : (
                            <small>
                              가져오기
                            </small>
                          )}
                        </article>
                      )
                    },
                  )}
                </div>
              ) : null}

              {!lecturesAreLoading &&
              selectedTimetable !== null &&
              timetableLectures.length >
                0 ? (
                <div className="timetable-import-modal__result-summary">
                  <strong>
                    {
                      importableLectures
                        .length
                    }
                    과목 ·{' '}
                    {formatCredits(
                      importableCredits,
                    )}
                  </strong>

                  <span>
                    중복 과목은 자동으로
                    제외됩니다.
                  </span>
                </div>
              ) : null}
            </>
          )}

          {importError !== null ? (
            <p
              className="timetable-import-modal__error"
              role="alert"
            >
              {importError}
            </p>
          ) : null}
        </div>

        <footer className="timetable-import-modal__actions">
          <button
            className="secondary-button"
            disabled={importIsRunning}
            type="button"
            onClick={onClose}
          >
            취소
          </button>

          <button
            className="primary-button"
            disabled={
              importIsRunning ||
              importableLectures.length ===
                0
            }
            type="button"
            onClick={() => {
              void handleImport()
            }}
          >
            {importIsRunning
              ? '가져오는 중...'
              : `${importableLectures.length}과목 가져오기`}
          </button>
        </footer>
      </section>
    </div>
  )
}
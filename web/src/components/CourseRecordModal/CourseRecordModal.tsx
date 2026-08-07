import {
  type FormEvent,
  useEffect,
  useState,
} from 'react'

import {
  createCourseRecord,
  updateCourseRecord,
} from '../../domain/course-records/api'
import type {
  CourseCompletionType,
  CourseRecord,
  CourseRecordInput,
} from '../../domain/course-records/types'
import {
  fetchGeneralEducation,
} from '../../domain/general-education/api'
import type {
  GeneralEducation,
} from '../../domain/general-education/types'
import {
  fetchLecture,
  fetchLectures,
} from '../../domain/lectures/api'
import type {
  Lecture,
} from '../../domain/lectures/types'

import './CourseRecordModal.css'


const AVAILABLE_COMPLETION_TYPES:
  CourseCompletionType[] = [
    '전필',
    '전선',
    '교양',
    '기타',
  ]


const FIRST_LECTURE_YEAR = 2019

const CURRENT_ACADEMIC_YEAR =
  new Date().getFullYear()

const ACADEMIC_YEARS =
  Array.from(
    {
      length:
        CURRENT_ACADEMIC_YEAR -
        FIRST_LECTURE_YEAR +
        1,
    },
    (_, index) =>
      CURRENT_ACADEMIC_YEAR - index,
  )


interface CourseRecordModalProps {
  editingRecord: CourseRecord | null

  /*
   * 현재 GpaCalculatorPage와의 연결을
   * 유지하기 위해 당장은 prop에 남겨둡니다.
   *
   * 수강기록 입력 자체에서는 사용자의
   * 학번 교육과정을 참조하지 않습니다.
   */
  entryYear: number | null

  /*
   * grade + semester는 실제 개설정보가 아니라
   * 사용자의 어느 학년-학기 기록인지 나타냅니다.
   */
  grade: number
  semester: number

  onClose: () => void
  onSaved: (
    record: CourseRecord,
  ) => void
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


function formatLectureMeta(
  lecture: Lecture,
): string {
  const details = [
    lecture.courseCode,
    formatCredits(lecture.credits),
    `${lecture.section}분반`,
  ]

  if (
    lecture.professor !== null &&
    lecture.professor.trim().length > 0
  ) {
    details.push(lecture.professor)
  }

  return details.join(' · ')
}


export function CourseRecordModal({
  editingRecord,
  entryYear,
  grade,
  semester,
  onClose,
  onSaved,
}: CourseRecordModalProps) {
  const [
    completionType,
    setCompletionType,
  ] = useState<CourseCompletionType>(
    editingRecord?.completionType ??
      '기타',
  )

  const [
    academicYear,
    setAcademicYear,
  ] = useState(
    editingRecord?.academicYear === null ||
    editingRecord?.academicYear ===
      undefined
      ? String(CURRENT_ACADEMIC_YEAR)
      : String(
          editingRecord.academicYear,
        ),
  )

  const [
    academicSemester,
    setAcademicSemester,
  ] = useState(
    String(semester),
  )

  const [
    courseQuery,
    setCourseQuery,
  ] = useState(
    editingRecord?.courseName ?? '',
  )

  const [
    selectedLecture,
    setSelectedLecture,
  ] = useState<Lecture | null>(null)

  const [
    lectureSearchResults,
    setLectureSearchResults,
  ] = useState<Lecture[]>([])

  const [
    lectureIsLoading,
    setLectureIsLoading,
  ] = useState(false)

  const [
    lectureSearchError,
    setLectureSearchError,
  ] = useState<string | null>(null)

  const [
    generalEducation,
    setGeneralEducation,
  ] = useState<GeneralEducation | null>(
    null,
  )

  const [
    generalEducationIsLoading,
    setGeneralEducationIsLoading,
  ] = useState(false)

  const [
    generalEducationError,
    setGeneralEducationError,
  ] = useState<string | null>(null)

  const [
    selectedGeneralEducationRequirementId,
    setSelectedGeneralEducationRequirementId,
  ] = useState<number | null>(
    editingRecord
      ?.generalEducationRequirementId ??
      null,
  )

  const [
    selectedGeneralEducationAreaId,
    setSelectedGeneralEducationAreaId,
  ] = useState<number | null>(
    editingRecord
      ?.generalEducationAreaId ??
      null,
  )

  const [
    note,
    setNote,
  ] = useState(
    editingRecord?.note ?? '',
  )

  const [
    formError,
    setFormError,
  ] = useState<string | null>(null)

  const [
    formIsSubmitting,
    setFormIsSubmitting,
  ] = useState(false)

  useEffect(() => {
    if (entryYear === null) {
      setGeneralEducation(null)
      setGeneralEducationError(null)
      return
    }

    const resolvedEntryYear =
      entryYear

    let requestIsActive = true

    async function loadGeneralEducation() {
      setGeneralEducationIsLoading(
        true,
      )

      setGeneralEducationError(null)

      try {
        const result =
          await fetchGeneralEducation(
            resolvedEntryYear,
          )

        if (!requestIsActive) {
          return
        }

        setGeneralEducation(result)
      } catch (error) {
        if (!requestIsActive) {
          return
        }

        setGeneralEducation(null)

        setGeneralEducationError(
          error instanceof Error
            ? error.message
            : '교양 졸업요건을 불러오지 못했습니다.',
        )
      } finally {
        if (requestIsActive) {
          setGeneralEducationIsLoading(
            false,
          )
        }
      }
    }

    void loadGeneralEducation()

    return () => {
      requestIsActive = false
    }
  }, [entryYear])

  /*
   * 수정 모드에서 기존 lectureId가 있으면
   * 해당 개설강좌를 불러와 개설학년도와
   * 개설학기를 복원합니다.
   */
  useEffect(() => {
    const lectureId =
      editingRecord?.lectureId

    if (
      lectureId === null ||
      lectureId === undefined
    ) {
      return
    }

    const resolvedLectureId =
      lectureId

    let requestIsActive = true

    async function loadEditingLecture() {
      setLectureIsLoading(true)
      setLectureSearchError(null)

      try {
        const lecture =
          await fetchLecture(
            resolvedLectureId,
          )

        if (!requestIsActive) {
          return
        }

        setSelectedLecture(lecture)

        setAcademicYear(
          String(lecture.academicYear),
        )

        setAcademicSemester(
          String(lecture.semester),
        )

        setCourseQuery(
          lecture.courseName,
        )
      } catch (error) {
        if (!requestIsActive) {
          return
        }

        setLectureSearchError(
          error instanceof Error
            ? error.message
            : '기존 강의 정보를 불러오지 못했습니다.',
        )
      } finally {
        if (requestIsActive) {
          setLectureIsLoading(false)
        }
      }
    }

    void loadEditingLecture()

    return () => {
      requestIsActive = false
    }
  }, [
    editingRecord?.lectureId,
  ])

  /*
   * 과목명을 입력하면 선택한 개설학년도와
   * 개설학기의 실제 강의를 검색합니다.
   *
   * 짧은 입력마다 요청이 발생하지 않도록
   * 250ms debounce를 적용합니다.
   */
  useEffect(() => {
    const normalizedQuery =
      courseQuery.trim()

    if (
      normalizedQuery.length === 0 ||
      selectedLecture !== null
    ) {
      setLectureSearchResults([])
      setLectureSearchError(null)
      return
    }

    const parsedAcademicYear =
      Number(academicYear)

    const parsedSemester =
      Number(academicSemester)

    if (
      !Number.isInteger(
        parsedAcademicYear,
      ) ||
      (
        parsedSemester !== 1 &&
        parsedSemester !== 2
      )
    ) {
      setLectureSearchResults([])
      return
    }

    let requestIsActive = true

    const timeoutId =
      window.setTimeout(() => {
        async function searchLectures() {
          setLectureIsLoading(true)
          setLectureSearchError(null)

          try {
            const lectures =
              await fetchLectures({
                academicYear:
                  parsedAcademicYear,
                semester:
                  parsedSemester,
                query:
                  normalizedQuery,
              })

            if (!requestIsActive) {
              return
            }

            const normalizedLowerQuery =
              normalizedQuery
                .toLocaleLowerCase(
                  'ko-KR',
                )

            const relevantLectures =
              lectures
                .filter((lecture) => {
                  const courseName =
                    lecture.courseName
                      .toLocaleLowerCase(
                        'ko-KR',
                      )

                  const courseCode =
                    lecture.courseCode
                      .toLocaleLowerCase(
                        'ko-KR',
                      )

                  return (
                    courseName.includes(
                      normalizedLowerQuery,
                    ) ||
                    courseCode.includes(
                      normalizedLowerQuery,
                    )
                  )
                })
                .sort(
                  (
                    firstLecture,
                    secondLecture,
                  ) => {
                    const firstName =
                      firstLecture.courseName
                        .toLocaleLowerCase(
                          'ko-KR',
                        )

                    const secondName =
                      secondLecture.courseName
                        .toLocaleLowerCase(
                          'ko-KR',
                        )

                    const firstIsExact =
                      firstName ===
                      normalizedLowerQuery

                    const secondIsExact =
                      secondName ===
                      normalizedLowerQuery

                    if (
                      firstIsExact !==
                      secondIsExact
                    ) {
                      return firstIsExact
                        ? -1
                        : 1
                    }

                    const firstStartsWith =
                      firstName.startsWith(
                        normalizedLowerQuery,
                      )

                    const secondStartsWith =
                      secondName.startsWith(
                        normalizedLowerQuery,
                      )

                    if (
                      firstStartsWith !==
                      secondStartsWith
                    ) {
                      return firstStartsWith
                        ? -1
                        : 1
                    }

                    return firstLecture
                      .courseName
                      .localeCompare(
                        secondLecture
                          .courseName,
                        'ko-KR',
                      )
                  },
                )
                .slice(0, 8)

            setLectureSearchResults(
              relevantLectures,
            )
          } catch (error) {
            if (!requestIsActive) {
              return
            }

            setLectureSearchResults([])

            setLectureSearchError(
              error instanceof Error
                ? error.message
                : '개설과목을 검색하지 못했습니다.',
            )
          } finally {
            if (requestIsActive) {
              setLectureIsLoading(false)
            }
          }
        }

        void searchLectures()
      }, 250)

    return () => {
      requestIsActive = false

      window.clearTimeout(
        timeoutId,
      )
    }
  }, [
    academicSemester,
    academicYear,
    courseQuery,
    selectedLecture,
  ])

  useEffect(() => {
    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        event.key === 'Escape' &&
        !formIsSubmitting
      ) {
        onClose()
      }
    }

    document.addEventListener(
      'keydown',
      handleKeyDown,
    )

    return () => {
      document.removeEventListener(
        'keydown',
        handleKeyDown,
      )
    }
  }, [
    formIsSubmitting,
    onClose,
  ])

  function clearSelectedLecture() {
    setSelectedLecture(null)
    setLectureSearchResults([])
    setLectureSearchError(null)
    setFormError(null)
  }

  function handleAcademicYearChange(
    nextAcademicYear: string,
  ) {
    setAcademicYear(
      nextAcademicYear,
    )

    clearSelectedLecture()
  }

  function handleAcademicSemesterChange(
    nextAcademicSemester: string,
  ) {
    setAcademicSemester(
      nextAcademicSemester,
    )

    clearSelectedLecture()
  }

  function handleCourseQueryChange(
    nextQuery: string,
  ) {
    setCourseQuery(nextQuery)

    if (selectedLecture !== null) {
      clearSelectedLecture()
    }

    setFormError(null)
  }

  function handleLectureSelect(
    lecture: Lecture,
  ) {
    setSelectedLecture(lecture)

    setCourseQuery(
      lecture.courseName,
    )

    setLectureSearchResults([])
    setLectureSearchError(null)
    setFormError(null)
  }

  const selectedGeneralEducationRequirement =
    generalEducation?.requirements.find(
      (requirement) =>
        requirement.id ===
        selectedGeneralEducationRequirementId,
    ) ?? null

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setFormError(null)

    if (selectedLecture === null) {
      setFormError(
        '검색 결과에서 개설과목을 선택해 주세요.',
      )
      return
    }
    if (
      selectedLecture.credits === null
    ) {
      setFormError(
        '선택한 개설과목에 학점 정보가 없어 저장할 수 없습니다.',
      )
      return
    }

    if (completionType === '교양') {
      if (entryYear === null) {
        setFormError(
          '교양 졸업요건을 지정하려면 학번을 먼저 설정해 주세요.',
        )
        return
      }

      if (generalEducationIsLoading) {
        setFormError(
          '교양 졸업요건을 불러오는 중입니다.',
        )
        return
      }

      if (generalEducation === null) {
        setFormError(
          generalEducationError ??
            '교양 졸업요건을 불러오지 못했습니다.',
        )
        return
      }

      if (
        selectedGeneralEducationRequirementId ===
          null ||
        selectedGeneralEducationAreaId === null
      ) {
        setFormError(
          '교양 구분과 세부영역을 모두 선택해 주세요.',
        )
        return
      }

      const selectedArea =
        selectedGeneralEducationRequirement
          ?.areas.find(
            (area) =>
              area.id ===
              selectedGeneralEducationAreaId,
          )

      if (selectedArea === undefined) {
        setFormError(
          '선택한 교양 세부영역을 확인할 수 없습니다.',
        )
        return
      }
    }

    setFormIsSubmitting(true)

    try {
      const input: CourseRecordInput = {
        /*
         * 일반 수강기록에서는 졸업요건을
         * 직접 연결하지 않습니다.
         */
        curriculumCourseId: null,

        lectureId:
          selectedLecture.id,

        generalEducationRequirementId:
          completionType === '교양'
            ? selectedGeneralEducationRequirementId
            : null,

        generalEducationAreaId:
          completionType === '교양'
            ? selectedGeneralEducationAreaId
            : null,

        /*
         * 실제 개설연도는 lecture에서
         * 가져옵니다.
         */
        academicYear:
          selectedLecture.academicYear,

        /*
         * grade + semester는 사용자의
         * 학년-학기 위치입니다.
         */
        grade,
        semester,

        courseName:
          selectedLecture.courseName,

        courseCode:
          selectedLecture.courseCode,

        completionType,

        credits:
          selectedLecture.credits,

        /*
         * 수정 시 기존 상태와 성적,
         * 재수강 말소 여부를 보존합니다.
         *
         * 새 기록의 성적은 표에서
         * 별도로 입력합니다.
         */
        status:
          editingRecord?.status ??
          'completed',

        letterGrade:
          editingRecord?.letterGrade ??
          null,

        isRetake:
          editingRecord?.isRetake ??
          false,

        note:
          note.trim().length === 0
            ? null
            : note.trim(),
      }

      const savedRecord =
        editingRecord === null
          ? await createCourseRecord(input)
          : await updateCourseRecord(
              editingRecord.id,
              input,
            )

      onSaved(savedRecord)
      onClose()
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : '과목 기록을 저장하지 못했습니다.',
      )
    } finally {
      setFormIsSubmitting(false)
    }
  }

  return (
    <div
      className="course-record-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
            event.currentTarget &&
          !formIsSubmitting
        ) {
          onClose()
        }
      }}
    >
      <section
        aria-labelledby="course-record-modal-title"
        aria-modal="true"
        className="course-record-modal"
        role="dialog"
      >
        <header className="course-record-modal-header">
          <div>
            <p>
              {grade}학년 {semester}학기
            </p>

            <h2 id="course-record-modal-title">
              {editingRecord === null
                ? '과목 입력'
                : '과목 수정'}
            </h2>
          </div>

          <button
            aria-label="닫기"
            className="course-record-modal-close"
            disabled={formIsSubmitting}
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <form
          className="course-record-modal-form"
          onSubmit={handleSubmit}
        >
          <fieldset className="course-record-modal-type-fieldset">
            <legend>이수구분</legend>

            <div className="course-record-modal-type-options">
              {AVAILABLE_COMPLETION_TYPES.map(
                (typeOption) => (
                  <label
                    key={typeOption}
                    className={
                      `course-record-modal-type-option${
                        completionType ===
                        typeOption
                          ? ' course-record-modal-type-option--selected'
                          : ''
                      }`
                    }
                  >
                    <input
                      checked={
                        completionType ===
                        typeOption
                      }
                      name="completion-type"
                      type="radio"
                      value={typeOption}
                      onChange={() => {
                        setCompletionType(
                          typeOption,
                        )

                        setFormError(null)
                      }}
                    />

                    <span>
                      {typeOption}
                    </span>
                  </label>
                ),
              )}
            </div>
          </fieldset>

          {completionType === '교양' ? (
            <>
              <div className="course-record-modal-field-grid course-record-modal-field-grid--two">
                <label className="course-record-modal-field">
                  <span>교양 구분</span>

                  <select
                    disabled={
                      generalEducationIsLoading ||
                      generalEducation === null
                    }
                    value={
                      selectedGeneralEducationRequirementId ??
                      ''
                    }
                    onChange={(event) => {
                      const nextValue =
                        event.target.value

                      setSelectedGeneralEducationRequirementId(
                        nextValue.length === 0
                          ? null
                          : Number(nextValue),
                      )

                      setSelectedGeneralEducationAreaId(
                        null,
                      )

                      setFormError(null)
                    }}
                  >
                    <option value="">
                      선택하세요
                    </option>

                    {generalEducation?.requirements.map(
                      (requirement) => (
                        <option
                          key={requirement.id}
                          value={requirement.id}
                        >
                          {requirement.category}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label className="course-record-modal-field">
                  <span>세부영역</span>

                  <select
                    disabled={
                      selectedGeneralEducationRequirement ===
                      null
                    }
                    value={
                      selectedGeneralEducationAreaId ??
                      ''
                    }
                    onChange={(event) => {
                      const nextValue =
                        event.target.value

                      setSelectedGeneralEducationAreaId(
                        nextValue.length === 0
                          ? null
                          : Number(nextValue),
                      )

                      setFormError(null)
                    }}
                  >
                    <option value="">
                      선택하세요
                    </option>

                    {selectedGeneralEducationRequirement
                      ?.areas.map(
                        (area) => (
                          <option
                            key={area.id}
                            value={area.id}
                          >
                            {area.areaName}
                          </option>
                        ),
                      )}
                  </select>
                </label>
              </div>

              {generalEducationIsLoading ? (
                <small>
                  교양 졸업요건을 불러오는 중입니다.
                </small>
              ) : null}

              {generalEducationError !== null ? (
                <small className="course-record-modal-search-error">
                  {generalEducationError}
                </small>
              ) : null}
            </>
          ) : null}

          <div className="course-record-modal-field-grid course-record-modal-field-grid--two">
            <label className="course-record-modal-field">
              <span>개설학년도</span>

              <select
                value={academicYear}
                onChange={(event) => {
                  handleAcademicYearChange(
                    event.target.value,
                  )
                }}
              >
                {ACADEMIC_YEARS.map(
                  (yearOption) => (
                    <option
                      key={yearOption}
                      value={yearOption}
                    >
                      {yearOption}학년도
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="course-record-modal-field">
              <span>개설학기</span>

              <select
                value={academicSemester}
                onChange={(event) => {
                  handleAcademicSemesterChange(
                    event.target.value,
                  )
                }}
              >
                <option value="1">
                  1학기
                </option>

                <option value="2">
                  2학기
                </option>
              </select>
            </label>
          </div>

          <div className="course-record-modal-field course-record-modal-course-search">
            <span>과목명</span>

            <div className="course-record-modal-search-input-wrap">
              <input
                autoComplete="off"
                autoFocus
                placeholder="과목명 또는 과목코드를 입력해 주세요"
                type="text"
                value={courseQuery}
                onChange={(event) => {
                  handleCourseQueryChange(
                    event.target.value,
                  )
                }}
              />

              {lectureIsLoading ? (
                <span className="course-record-modal-search-loading">
                  검색 중...
                </span>
              ) : null}
            </div>

            {lectureSearchResults.length >
            0 ? (
              <div
                aria-label="개설과목 검색 결과"
                className="course-record-modal-search-results"
                role="listbox"
              >
                {lectureSearchResults.map(
                  (lecture) => (
                    <button
                      key={lecture.id}
                      className="course-record-modal-search-result"
                      role="option"
                      type="button"
                      onClick={() => {
                        handleLectureSelect(
                          lecture,
                        )
                      }}
                    >
                      <strong>
                        {lecture.courseName}
                      </strong>

                      <span>
                        {formatLectureMeta(
                          lecture,
                        )}
                      </span>
                    </button>
                  ),
                )}
              </div>
            ) : null}

            {selectedLecture !== null ? (
              <div className="course-record-modal-selected-lecture">
                <div>
                  <strong>
                    {selectedLecture.courseName}
                  </strong>

                  <span>
                    {formatLectureMeta(
                      selectedLecture,
                    )}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setCourseQuery('')
                    clearSelectedLecture()
                  }}
                >
                  다시 선택
                </button>
              </div>
            ) : null}

            {lectureSearchError !== null ? (
              <small className="course-record-modal-search-error">
                {lectureSearchError}
              </small>
            ) : null}

            <small>
              선택한 개설학년도와 학기에
              실제 개설된 과목만 검색됩니다.
            </small>
          </div>

          <label className="course-record-modal-field">
            <span>
              메모
              <small>선택</small>
            </span>

            <textarea
              maxLength={500}
              placeholder="과목에 관한 참고사항"
              rows={3}
              value={note}
              onChange={(event) => {
                setNote(
                  event.target.value,
                )
              }}
            />
          </label>

          {formError !== null ? (
            <p
              className="course-record-modal-error"
              role="alert"
            >
              {formError}
            </p>
          ) : null}

          <footer className="course-record-modal-actions">
            <button
              className="course-record-modal-cancel"
              disabled={formIsSubmitting}
              type="button"
              onClick={onClose}
            >
              취소
            </button>

            <button
              className="course-record-modal-submit"
              disabled={
                formIsSubmitting ||
                lectureIsLoading
              }
              type="submit"
            >
              {formIsSubmitting
                ? '저장 중...'
                : editingRecord === null
                  ? '과목 저장'
                  : '수정 저장'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
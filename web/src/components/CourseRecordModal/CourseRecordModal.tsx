import {
  type FormEvent,
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
  fetchCurriculum,
} from '../../domain/curriculum/api'
import type {
  CurriculumCourse,
} from '../../domain/curriculum/types'
import {
  fetchGeneralEducation,
} from '../../domain/general-education/api'
import type {
  GeneralEducationRequirement,
} from '../../domain/general-education/types'

import './CourseRecordModal.css'


const LETTER_GRADES = [
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


const AVAILABLE_COMPLETION_TYPES:
  CourseCompletionType[] = [
    '전필',
    '전선',
    '교양',
    '기타',
  ]


interface CourseRecordModalProps {
  entryYear: number | null
  grade: number
  semester: number
  onClose: () => void
  onCreated: (
    record: CourseRecord,
  ) => void
}


function formatCourseOption(
  course: CurriculumCourse,
): string {
  const creditsText =
    course.credits === null
      ? '학점 미정'
      : `${course.credits}학점`

  return (
    `${course.grade}학년 ` +
    `${course.semester}학기 · ` +
    `${course.courseName} · ` +
    creditsText
  )
}


export function CourseRecordModal({
  entryYear,
  grade,
  semester,
  onClose,
  onCreated,
}: CourseRecordModalProps) {
  const [
    completionType,
    setCompletionType,
  ] = useState<CourseCompletionType>(
    '기타',
  )

  const [
    curriculumCourses,
    setCurriculumCourses,
  ] = useState<CurriculumCourse[]>([])

  const [
    selectedCurriculumCourseId,
    setSelectedCurriculumCourseId,
  ] = useState('')

  const [
    generalEducationRequirements,
    setGeneralEducationRequirements,
  ] = useState<
    GeneralEducationRequirement[]
  >([])

  const [
    selectedGeneralEducationRequirementId,
    setSelectedGeneralEducationRequirementId,
  ] = useState('')

  const [
    selectedGeneralEducationAreaId,
    setSelectedGeneralEducationAreaId,
  ] = useState('')

  const [
    courseName,
    setCourseName,
  ] = useState('')

  const [
    credits,
    setCredits,
  ] = useState('')

  const [
    letterGrade,
    setLetterGrade,
  ] = useState('')

  const [
    isRetake,
    setIsRetake,
  ] = useState(false)

  const [
    note,
    setNote,
  ] = useState('')

  const [
    curriculumIsLoading,
    setCurriculumIsLoading,
  ] = useState(false)

  const [
    curriculumError,
    setCurriculumError,
  ] = useState<string | null>(null)

  const [
    generalEducationIsLoading,
    setGeneralEducationIsLoading,
  ] = useState(false)

  const [
    generalEducationError,
    setGeneralEducationError,
  ] = useState<string | null>(null)

  const [
    formError,
    setFormError,
  ] = useState<string | null>(null)

  const [
    formIsSubmitting,
    setFormIsSubmitting,
  ] = useState(false)

  const isMajorCourse =
    completionType === '전필' ||
    completionType === '전선'

  const isGeneralEducation =
    completionType === '교양'

  const matchingCurriculumCourses =
    useMemo(() => {
      if (!isMajorCourse) {
        return []
      }

      return curriculumCourses
        .filter(
          (course) =>
            course.completionType ===
            completionType,
        )
        .sort((firstCourse, secondCourse) => {
          const firstMatchesSemester =
            firstCourse.grade === grade &&
            firstCourse.semester === semester

          const secondMatchesSemester =
            secondCourse.grade === grade &&
            secondCourse.semester === semester

          if (
            firstMatchesSemester !==
            secondMatchesSemester
          ) {
            return firstMatchesSemester
              ? -1
              : 1
          }

          if (
            firstCourse.grade !==
            secondCourse.grade
          ) {
            return (
              firstCourse.grade -
              secondCourse.grade
            )
          }

          if (
            firstCourse.semester !==
            secondCourse.semester
          ) {
            return (
              firstCourse.semester -
              secondCourse.semester
            )
          }

          return firstCourse.courseName
            .localeCompare(
              secondCourse.courseName,
              'ko',
            )
        })
    }, [
      completionType,
      curriculumCourses,
      grade,
      isMajorCourse,
      semester,
    ])

  const selectedCurriculumCourse =
    useMemo(
      () =>
        curriculumCourses.find(
          (course) =>
            String(course.id) ===
            selectedCurriculumCourseId,
        ) ?? null,
      [
        curriculumCourses,
        selectedCurriculumCourseId,
      ],
    )

  const selectedGeneralEducationRequirement =
    useMemo(
      () =>
        generalEducationRequirements.find(
          (requirement) =>
            String(requirement.id) ===
            selectedGeneralEducationRequirementId,
        ) ?? null,
      [
        generalEducationRequirements,
        selectedGeneralEducationRequirementId,
      ],
    )

  const selectedGeneralEducationArea =
    useMemo(
      () =>
        selectedGeneralEducationRequirement
          ?.areas.find(
            (area) =>
              String(area.id) ===
              selectedGeneralEducationAreaId,
          ) ?? null,
      [
        selectedGeneralEducationAreaId,
        selectedGeneralEducationRequirement,
      ],
    )

  useEffect(() => {
    if (entryYear === null) {
      return
    }

    const resolvedEntryYear =
      entryYear

    let requestIsActive = true

    async function loadCurriculum() {
      setCurriculumIsLoading(true)
      setCurriculumError(null)

      try {
        const curriculum =
          await fetchCurriculum(
            resolvedEntryYear,
          )

        if (requestIsActive) {
          setCurriculumCourses(
            curriculum.courses,
          )
        }
      } catch (error) {
        if (!requestIsActive) {
          return
        }

        setCurriculumError(
          error instanceof Error
            ? error.message
            : '교육과정을 불러오지 못했습니다.',
        )
      } finally {
        if (requestIsActive) {
          setCurriculumIsLoading(false)
        }
      }
    }

    void loadCurriculum()

    return () => {
      requestIsActive = false
    }
  }, [entryYear])

  useEffect(() => {
    if (entryYear === null) {
      return
    }

    const resolvedEntryYear =
      entryYear

    let requestIsActive = true

    async function loadGeneralEducation() {
      setGeneralEducationIsLoading(true)
      setGeneralEducationError(null)

      try {
        const generalEducation =
          await fetchGeneralEducation(
            resolvedEntryYear,
          )

        if (requestIsActive) {
          setGeneralEducationRequirements(
            generalEducation.requirements,
          )
        }
      } catch (error) {
        if (!requestIsActive) {
          return
        }

        setGeneralEducationError(
          error instanceof Error
            ? error.message
            : '교양요건을 불러오지 못했습니다.',
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

  function handleCompletionTypeChange(
    nextCompletionType:
      CourseCompletionType,
  ) {
    setCompletionType(
      nextCompletionType,
    )

    setSelectedCurriculumCourseId('')

    setSelectedGeneralEducationRequirementId(
      '',
    )

    setSelectedGeneralEducationAreaId('')

    setCourseName('')
    setCredits('')
    setFormError(null)
  }

  function handleCurriculumCourseChange(
    courseId: string,
  ) {
    setSelectedCurriculumCourseId(
      courseId,
    )

    const selectedCourse =
      curriculumCourses.find(
        (course) =>
          String(course.id) === courseId,
      )

    if (selectedCourse === undefined) {
      setCourseName('')
      setCredits('')
      return
    }

    setCourseName(
      selectedCourse.courseName,
    )

    setCredits(
      selectedCourse.credits === null
        ? ''
        : String(selectedCourse.credits),
    )
    }

    function handleGeneralEducationRequirementChange(
      requirementId: string,
    ) {
      setSelectedGeneralEducationRequirementId(
        requirementId,
      )

      setSelectedGeneralEducationAreaId('')
      setFormError(null)
    }

    async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setFormError(null)

    if (
      isMajorCourse &&
      selectedCurriculumCourse === null
    ) {
      setFormError(
        '공식 교육과정 과목을 선택해 주세요.',
      )
      return
    }

    if (
      isGeneralEducation &&
      selectedGeneralEducationRequirement ===
        null
    ) {
      setFormError(
        '교양 구분을 선택해 주세요.',
      )
      return
    }

    if (
      isGeneralEducation &&
      selectedGeneralEducationArea === null
    ) {
      setFormError(
        '교양 세부 영역을 선택해 주세요.',
      )
      return
    }

    const normalizedCourseName =
      courseName.trim()

    const parsedCredits =
      Number(credits)

    if (
      normalizedCourseName.length === 0
    ) {
      setFormError(
        '과목명을 입력해 주세요.',
      )
      return
    }

    if (
      credits.trim().length === 0 ||
      !Number.isFinite(parsedCredits) ||
      parsedCredits <= 0 ||
      parsedCredits > 30
    ) {
      setFormError(
        '학점을 0보다 크고 30 이하인 숫자로 입력해 주세요.',
      )
      return
    }

    setFormIsSubmitting(true)

    try {
      const input: CourseRecordInput = {
        curriculumCourseId:
          selectedCurriculumCourse?.id ??
          null,
        lectureId: null,
        generalEducationRequirementId:
          selectedGeneralEducationRequirement
            ?.id ?? null,
        generalEducationAreaId:
          selectedGeneralEducationArea
            ?.id ?? null,
        academicYear: null,
        grade,
        semester,
        courseName:
          normalizedCourseName,
        courseCode:
          selectedCurriculumCourse
            ?.courseCode ?? null,
        completionType,
        credits: parsedCredits,
        status: 'completed',
        letterGrade:
          letterGrade.length === 0
            ? null
            : letterGrade,
        isRetake,
        note:
          note.trim().length === 0
            ? null
            : note.trim(),
      }

      const createdRecord =
        await createCourseRecord(input)

      onCreated(createdRecord)
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
              과목 입력
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
                        handleCompletionTypeChange(
                          typeOption,
                        )
                      }}
                    />

                    <span>{typeOption}</span>
                  </label>
                ),
              )}
            </div>
          </fieldset>

          {isMajorCourse ? (
            <label className="course-record-modal-field">
              <span>
                공식 교육과정 과목
              </span>

              <select
                disabled={
                  entryYear === null ||
                  curriculumIsLoading
                }
                value={
                  selectedCurriculumCourseId
                }
                onChange={(event) => {
                  handleCurriculumCourseChange(
                    event.target.value,
                  )
                }}
              >
                <option value="">
                  {curriculumIsLoading
                    ? '교육과정 불러오는 중...'
                    : '과목을 선택해 주세요'}
                </option>

                {matchingCurriculumCourses.map(
                  (course) => (
                    <option
                      key={course.id}
                      value={course.id}
                    >
                      {formatCourseOption(
                        course,
                      )}
                    </option>
                  ),
                )}
              </select>

              {entryYear === null ? (
                <small>
                  전공 과목을 선택하려면
                  회원정보에서 입학 학번을
                  설정해야 합니다.
                </small>
              ) : (
                <small>
                  현재 선택 학기의 과목을
                  위쪽에 먼저 표시합니다.
                </small>
              )}
            </label>
          ) : null}

          {isGeneralEducation ? (
            <div className="course-record-modal-field-grid course-record-modal-field-grid--two">
              <label className="course-record-modal-field">
                <span>교양 구분</span>

                <select
                  disabled={
                    entryYear === null ||
                    generalEducationIsLoading
                  }
                  value={
                    selectedGeneralEducationRequirementId
                  }
                  onChange={(event) => {
                    handleGeneralEducationRequirementChange(
                      event.target.value,
                    )
                  }}
                >
                  <option value="">
                    {generalEducationIsLoading
                      ? '교양요건 불러오는 중...'
                      : '교양 구분을 선택해 주세요'}
                  </option>

                  {generalEducationRequirements.map(
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
                <span>세부 영역</span>

                <select
                  disabled={
                    selectedGeneralEducationRequirement ===
                    null
                  }
                  value={
                    selectedGeneralEducationAreaId
                  }
                  onChange={(event) => {
                    setSelectedGeneralEducationAreaId(
                      event.target.value,
                    )
                  }}
                >
                  <option value="">
                    세부 영역을 선택해 주세요
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
          ) : null}

          {generalEducationError !== null &&
          isGeneralEducation ? (
            <p
              className="course-record-modal-error"
              role="alert"
            >
              {generalEducationError}
            </p>
          ) : null}

          {curriculumError !== null &&
          isMajorCourse ? (
            <p
              className="course-record-modal-error"
              role="alert"
            >
              {curriculumError}
            </p>
          ) : null}

          <label className="course-record-modal-field">
            <span>과목명</span>

            <input
              autoFocus={!isMajorCourse}
              disabled={isMajorCourse}
              maxLength={100}
              placeholder={
                isMajorCourse
                  ? '공식 과목을 선택해 주세요'
                  : '예: 연구실 안전교육'
              }
              type="text"
              value={courseName}
              onChange={(event) => {
                setCourseName(
                  event.target.value,
                )
              }}
            />
          </label>

          <div className="course-record-modal-field-grid course-record-modal-field-grid--two">
            <label className="course-record-modal-field">
              <span>학점</span>

              <input
                disabled={
                  isMajorCourse &&
                  selectedCurriculumCourse
                    ?.credits !== null
                }
                max="30"
                min="0.5"
                placeholder="예: 2"
                step="0.5"
                type="number"
                value={credits}
                onChange={(event) => {
                  setCredits(
                    event.target.value,
                  )
                }}
              />

              {isMajorCourse ? (
                <small>
                  공식 교육과정 학점을
                  사용합니다.
                </small>
              ) : null}
            </label>

            <label className="course-record-modal-field">
              <span>성적</span>

              <select
                value={letterGrade}
                onChange={(event) => {
                  setLetterGrade(
                    event.target.value,
                  )
                }}
              >
                <option value="">
                  성적 미입력
                </option>

                {LETTER_GRADES.map(
                  (gradeOption) => (
                    <option
                      key={gradeOption}
                      value={gradeOption}
                    >
                      {gradeOption}
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>

          <label className="course-record-modal-checkbox">
            <input
              checked={isRetake}
              type="checkbox"
              onChange={(event) => {
                setIsRetake(
                  event.target.checked,
                )
              }}
            />

            <span>재수강 과목</span>
          </label>

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
                (
                  isMajorCourse &&
                  (
                    entryYear === null ||
                    curriculumIsLoading ||
                    curriculumError !== null
                  )
                ) ||
                (
                  isGeneralEducation &&
                  (
                    entryYear === null ||
                    generalEducationIsLoading ||
                    generalEducationError !== null
                  )
                )
              }
              type="submit"
            >
              {formIsSubmitting
                ? '저장 중...'
                : '과목 저장'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
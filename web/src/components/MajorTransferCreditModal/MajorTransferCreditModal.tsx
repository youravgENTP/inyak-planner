import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  createCourseRecord,
  updateCourseRecord,
} from '../../domain/course-records/api'
import type {
  CourseRecord,
  CourseRecordInput,
} from '../../domain/course-records/types'
import type {
  Curriculum,
} from '../../domain/curriculum/types'

import './MajorTransferCreditModal.css'


interface MajorTransferCreditModalProps {
  curriculum: Curriculum
  record?: CourseRecord | null
  onClose: () => void
  onCreated: (
    record: CourseRecord,
  ) => void
  onUpdated?: (
    record: CourseRecord,
  ) => void
}


export function MajorTransferCreditModal({
  curriculum,
  record = null,
  onClose,
  onCreated,
  onUpdated,
}: MajorTransferCreditModalProps) {
  const [
    selectedCourseId,
    setSelectedCourseId,
  ] = useState(() => {
    if (
      record?.curriculumCourseId ===
      null ||
      record?.curriculumCourseId ===
      undefined
    ) {
      return ''
    }

    return String(
      record.curriculumCourseId,
    )
  })

  const [
    courseSearchQuery,
    setCourseSearchQuery,
  ] = useState(() => {
    if (
      record?.curriculumCourseId ===
      null ||
      record?.curriculumCourseId ===
      undefined
    ) {
      return ''
    }

    return (
      curriculum.courses.find(
        (course) =>
          course.id ===
          record.curriculumCourseId,
      )?.courseName ?? ''
    )
  })

  const [
    searchIsOpen,
    setSearchIsOpen,
  ] = useState(false)

  const [
    sourceCourseName,
    setSourceCourseName,
  ] = useState(
    record?.courseName ?? '',
  )

  const [
    note,
    setNote,
  ] = useState(
    record?.note ?? '',
  )

  const [
    formError,
    setFormError,
  ] = useState<string | null>(null)

  const [
    formIsSubmitting,
    setFormIsSubmitting,
  ] = useState(false)

  const selectedCourse =
    useMemo(
      () =>
        curriculum.courses.find(
          (course) =>
            course.id ===
            Number(selectedCourseId),
        ) ?? null,
      [
        curriculum.courses,
        selectedCourseId,
      ],
    )

  const filteredCourses =
    useMemo(() => {
      const normalizedQuery =
        courseSearchQuery
          .trim()
          .toLocaleLowerCase('ko-KR')

      const availableCourses =
        curriculum.courses.filter(
          (course) =>
            course.completionType ===
              '전필' ||
            course.completionType ===
              '전선',
        )

      if (normalizedQuery.length === 0) {
        return availableCourses
      }

      return availableCourses.filter(
        (course) => {
          const searchableText = [
            course.courseName,
            course.courseCode ?? '',
            `${course.grade}학년`,
            `${course.semester}학기`,
            course.completionType,
          ]
            .join(' ')
            .toLocaleLowerCase('ko-KR')

          return searchableText.includes(
            normalizedQuery,
          )
        },
      )
    }, [
      courseSearchQuery,
      curriculum.courses,
    ])

  const isEditing =
    record !== null

  useEffect(() => {
    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === 'Escape') {
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
  }, [onClose])

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setFormError(null)

    if (
      sourceCourseName.trim().length === 0
    ) {
      setFormError(
        '전적대에서 이수한 과목명을 입력해 주세요.',
      )
      return
    }

    if (selectedCourse === null) {
      setFormError(
        '대응할 인제대학교 전공 과목을 선택해 주세요.',
      )
      return
    }

    if (selectedCourse.credits === null) {
      setFormError(
        '학점이 등록되지 않은 공식 과목은 선택할 수 없습니다.',
      )
      return
    }

    setFormIsSubmitting(true)

    try {
      const input: CourseRecordInput = {
        curriculumCourseId:
          selectedCourse.id,
        lectureId: null,
        generalEducationRequirementId:
          null,
        generalEducationAreaId:
          null,
        academicYear: null,
        semester: null,
        courseName:
          sourceCourseName.trim(),
        courseCode: null,
        completionType:
          selectedCourse.completionType,
        credits:
          selectedCourse.credits,
        status: 'substituted',
        letterGrade: null,
        isRetake: false,
        note:
          note.trim().length === 0
            ? null
            : note.trim(),
      }

      if (record === null) {
        const createdRecord =
          await createCourseRecord(input)

        onCreated(createdRecord)
      } else {
        const updatedRecord =
          await updateCourseRecord(
            record.id,
            input,
          )

        onUpdated?.(updatedRecord)
      }

      onClose()
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : (
            isEditing
              ? '인정 과목을 수정하지 못했습니다.'
              : '인정 과목을 저장하지 못했습니다.'
          ),
      )
    } finally {
      setFormIsSubmitting(false)
    }
  }

  return (
    <div
      className="major-transfer-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose()
        }
      }}
    >
      <section
        aria-labelledby="major-transfer-modal-title"
        aria-modal="true"
        className="major-transfer-modal"
        role="dialog"
      >
        <header className="major-transfer-modal-header">
          <div>
            <p>전적대 학점 인정</p>

            <h2 id="major-transfer-modal-title">
              {isEditing
                ? '전공 인정 과목 수정'
                : '전공 인정 과목 추가'}
            </h2>
          </div>

          <button
            aria-label="닫기"
            className="major-transfer-modal-close"
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <form
          className="major-transfer-modal-form"
          onSubmit={handleSubmit}
        >
          <label>
            <span>
              전적대 이수 과목명
            </span>

            <input
              autoFocus
              maxLength={100}
              placeholder="예: 유기화학 II"
              type="text"
              value={sourceCourseName}
              onChange={(event) => {
                setSourceCourseName(
                  event.target.value,
                )
              }}
            />
          </label>
          <div className="major-transfer-course-field">
            <label htmlFor="major-transfer-course-search">
              대응할 전공 과목
            </label>

            <div className="major-transfer-course-search">
              <input
                aria-autocomplete="list"
                aria-controls="major-transfer-course-results"
                aria-expanded={searchIsOpen}
                autoComplete="off"
                id="major-transfer-course-search"
                placeholder="과목명 또는 과목코드 검색"
                role="combobox"
                type="search"
                value={courseSearchQuery}
                onFocus={() => {
                  setSearchIsOpen(true)
                }}
                onChange={(event) => {
                  setCourseSearchQuery(
                    event.target.value,
                  )
                  setSelectedCourseId('')
                  setSearchIsOpen(true)
                }}
              />

              {selectedCourse !== null ? (
                <button
                  aria-label="선택한 과목 지우기"
                  className="major-transfer-course-clear"
                  type="button"
                  onClick={() => {
                    setSelectedCourseId('')
                    setCourseSearchQuery('')
                    setSearchIsOpen(true)
                  }}
                >
                  ×
                </button>
              ) : null}
            </div>

            {searchIsOpen ? (
              <div
                className="major-transfer-course-results"
                id="major-transfer-course-results"
                role="listbox"
              >
                {filteredCourses.length === 0 ? (
                  <p className="major-transfer-course-empty">
                    검색 결과가 없습니다.
                  </p>
                ) : (
                  filteredCourses.map(
                    (course) => (
                      <button
                        aria-selected={
                          course.id ===
                          selectedCourse?.id
                        }
                        className={
                          course.id ===
                          selectedCourse?.id
                            ? (
                              'major-transfer-course-result ' +
                              'major-transfer-course-result--selected'
                            )
                            : 'major-transfer-course-result'
                        }
                        disabled={
                          course.credits ===
                          null
                        }
                        key={course.id}
                        role="option"
                        type="button"
                        onClick={() => {
                          setSelectedCourseId(
                            String(course.id),
                          )
                          setCourseSearchQuery(
                            course.courseName,
                          )
                          setSearchIsOpen(false)
                        }}
                      >
                        <strong>
                          {course.courseName}
                        </strong>

                        <span>
                          {course.courseCode ??
                            '과목코드 없음'}
                          {' · '}
                          {course.grade}학년{' '}
                          {course.semester}학기
                          {' · '}
                          {course.completionType}
                          {' · '}
                          {course.credits === null
                            ? '학점 미정'
                            : `${course.credits}학점`}
                        </span>
                      </button>
                    ),
                  )
                )}
              </div>
            ) : null}
          </div>
          {selectedCourse !== null ? (
            <div className="major-transfer-modal-preview">
              <div>
                <span>이수구분</span>
                <strong>
                  {
                    selectedCourse
                      .completionType
                  }
                </strong>
              </div>

              <div>
                <span>인정학점</span>
                <strong>
                  {selectedCourse.credits ??
                    '미정'}
                  {selectedCourse.credits ===
                  null
                    ? ''
                    : '학점'}
                </strong>
              </div>

              <div>
                <span>교육과정 위치</span>
                <strong>
                  {selectedCourse.grade}학년{' '}
                  {
                    selectedCourse
                      .semester
                  }
                  학기
                </strong>
              </div>
            </div>
          ) : null}

          <label>
            <span>
              메모
              <small>선택</small>
            </span>

            <textarea
              maxLength={500}
              placeholder="인정 근거 또는 참고사항"
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
              className="major-transfer-modal-error"
              role="alert"
            >
              {formError}
            </p>
          ) : null}

          <footer className="major-transfer-modal-actions">
            <button
              className="major-transfer-modal-cancel"
              disabled={formIsSubmitting}
              type="button"
              onClick={onClose}
            >
              취소
            </button>

            <button
              className="major-transfer-modal-submit"
              disabled={formIsSubmitting}
              type="submit"
            >
              {formIsSubmitting
                ? '저장 중...'
                : (
                  isEditing
                    ? '변경사항 저장'
                    : '인정 과목 저장'
                )}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
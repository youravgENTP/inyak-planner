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
  CourseRecord,
} from '../../domain/course-records/types'
import type {
  Curriculum,
} from '../../domain/curriculum/types'

import './MajorTransferCreditModal.css'


interface MajorTransferCreditModalProps {
  curriculum: Curriculum
  onClose: () => void
  onCreated: (
    record: CourseRecord,
  ) => void
}


export function MajorTransferCreditModal({
  curriculum,
  onClose,
  onCreated,
}: MajorTransferCreditModalProps) {
  const [
    selectedCourseId,
    setSelectedCourseId,
  ] = useState('')

  const [
    sourceCourseName,
    setSourceCourseName,
  ] = useState('')

  const [
    note,
    setNote,
  ] = useState('')

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
      const createdRecord =
        await createCourseRecord({
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
            selectedCourse
              .completionType,
          credits:
            selectedCourse.credits,
          status: 'substituted',
          letterGrade: null,
          isRetake: false,
          note:
            note.trim().length === 0
              ? null
              : note.trim(),
        })

      onCreated(createdRecord)
      onClose()
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : '인정 과목을 저장하지 못했습니다.',
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
              전공 인정 과목 추가
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

          <label>
            <span>
              대응할 전공 과목
            </span>

            <select
              value={selectedCourseId}
              onChange={(event) => {
                setSelectedCourseId(
                  event.target.value,
                )
              }}
            >
              <option value="">
                과목을 선택하세요
              </option>

              {curriculum.courses.map(
                (course) => (
                  <option
                    key={course.id}
                    value={course.id}
                    disabled={
                      course.credits ===
                      null
                    }
                  >
                    {course.grade}학년{' '}
                    {course.semester}학기 ·{' '}
                    {course.completionType}{' '}
                    · {course.courseName}
                  </option>
                ),
              )}
            </select>
          </label>

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
                : '인정 과목 저장'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
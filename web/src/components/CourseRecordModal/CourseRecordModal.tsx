import {
  type FormEvent,
  useEffect,
  useState,
} from 'react'

import {
  createCourseRecord,
} from '../../domain/course-records/api'
import type {
  CourseRecord,
  CourseRecordInput,
} from '../../domain/course-records/types'

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


interface CourseRecordModalProps {
  grade: number
  semester: number
  onClose: () => void
  onCreated: (
    record: CourseRecord,
  ) => void
}


export function CourseRecordModal({
  grade,
  semester,
  onClose,
  onCreated,
}: CourseRecordModalProps) {
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
    formError,
    setFormError,
  ] = useState<string | null>(null)

  const [
    formIsSubmitting,
    setFormIsSubmitting,
  ] = useState(false)

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

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setFormError(null)

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
        curriculumCourseId: null,
        lectureId: null,
        generalEducationRequirementId:
          null,
        generalEducationAreaId: null,
        academicYear: null,
        grade,
        semester,
        courseName:
          normalizedCourseName,
        courseCode: null,
        completionType: '기타',
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
          <label className="course-record-modal-field">
            <span>과목명</span>

            <input
              autoFocus
              maxLength={100}
              placeholder="예: 연구실 안전교육"
              type="text"
              value={courseName}
              onChange={(event) => {
                setCourseName(
                  event.target.value,
                )
              }}
            />
          </label>

          <div className="course-record-modal-field-grid">
            <label className="course-record-modal-field">
              <span>학점</span>

              <input
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

            <label className="course-record-modal-field">
              <span>이수구분</span>

              <select
                defaultValue="기타"
                disabled
              >
                <option value="기타">
                  기타
                </option>
              </select>

              <small>
                이번 단계에서는 기타
                과목부터 입력합니다.
              </small>
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
              disabled={formIsSubmitting}
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
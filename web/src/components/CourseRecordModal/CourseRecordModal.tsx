import {
  type FormEvent,
  useEffect,
  useState,
} from 'react'

import './CourseRecordModal.css'


export interface CourseRecordSemesterSelection {
  academicYear: number
  semester: number
}


interface CourseRecordModalProps {
  onClose: () => void
  onContinue: (
    selection:
      CourseRecordSemesterSelection,
  ) => void
}


export function CourseRecordModal({
  onClose,
  onContinue,
}: CourseRecordModalProps) {
  const currentYear =
    new Date().getFullYear()

  const [
    academicYear,
    setAcademicYear,
  ] = useState(
    String(currentYear),
  )

  const [
    semester,
    setSemester,
  ] = useState('1')

  const [
    formError,
    setFormError,
  ] = useState<string | null>(null)

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

  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setFormError(null)

    const parsedAcademicYear =
      Number(academicYear)

    const parsedSemester =
      Number(semester)

    if (
      !Number.isInteger(
        parsedAcademicYear,
      ) ||
      parsedAcademicYear < 2000 ||
      parsedAcademicYear > 2100
    ) {
      setFormError(
        '올바른 학년도를 입력해 주세요.',
      )
      return
    }

    if (
      parsedSemester !== 1 &&
      parsedSemester !== 2
    ) {
      setFormError(
        '1학기 또는 2학기를 선택해 주세요.',
      )
      return
    }

    onContinue({
      academicYear:
        parsedAcademicYear,
      semester:
        parsedSemester,
    })
  }

  return (
    <div
      className="course-record-modal-backdrop"
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
        aria-labelledby="course-record-modal-title"
        aria-modal="true"
        className="course-record-modal"
        role="dialog"
      >
        <header className="course-record-modal-header">
          <div>
            <p>수강 기록 등록</p>

            <h2 id="course-record-modal-title">
              학기 선택
            </h2>
          </div>

          <button
            aria-label="닫기"
            className="course-record-modal-close"
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
          <p className="course-record-modal-description">
            과목을 수강했거나 수강할
            학년도를 먼저 선택합니다.
          </p>

          <label>
            <span>학년도</span>

            <input
              autoFocus
              max="2100"
              min="2000"
              type="number"
              value={academicYear}
              onChange={(event) => {
                setAcademicYear(
                  event.target.value,
                )
              }}
            />
          </label>

          <label>
            <span>학기</span>

            <select
              value={semester}
              onChange={(event) => {
                setSemester(
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
              type="button"
              onClick={onClose}
            >
              취소
            </button>

            <button
              className="course-record-modal-submit"
              type="submit"
            >
              과목 선택으로 이동
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
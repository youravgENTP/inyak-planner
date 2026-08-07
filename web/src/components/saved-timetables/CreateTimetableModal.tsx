import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from 'react'

import {
  getTimetableNameErrorMessage,
  normalizeTimetableName,
  type AcademicSemester,
  type CreateTimetableValues,
} from '../../domain/saved-timetables'

import './CreateTimetableModal.css'


interface TimetableSemesterOption {
  academicYear: number
  semester: AcademicSemester
}


interface CreateTimetableModalProps {
  isOpen: boolean

  defaultName: string

  semesterOptions:
    readonly TimetableSemesterOption[]

  initialAcademicYear: number
  initialSemester: AcademicSemester

  onClose: () => void

  onCreate: (
    values: CreateTimetableValues,
  ) => void
}


function createSemesterKey(
  academicYear: number,
  semester: AcademicSemester,
): string {
  return `${academicYear}-${semester}`
}


export function CreateTimetableModal({
  isOpen,
  defaultName,
  semesterOptions,
  initialAcademicYear,
  initialSemester,
  onClose,
  onCreate,
}: CreateTimetableModalProps) {
  const inputRef =
    useRef<HTMLInputElement>(null)

  const [
    nameInput,
    setNameInput,
  ] = useState(defaultName)

  const [
    selectedSemesterKey,
    setSelectedSemesterKey,
  ] = useState('')

  const normalizedName =
    normalizeTimetableName(nameInput)

  const nameError =
    getTimetableNameErrorMessage(
      nameInput,
    )

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setNameInput(defaultName)

    const preferredKey =
      createSemesterKey(
        initialAcademicYear,
        initialSemester,
      )

    const preferredSemesterExists =
      semesterOptions.some(
        (option) =>
          createSemesterKey(
            option.academicYear,
            option.semester,
          ) === preferredKey,
      )

    if (preferredSemesterExists) {
      setSelectedSemesterKey(
        preferredKey,
      )
    } else if (
      semesterOptions.length > 0
    ) {
      const firstOption =
        semesterOptions[0]

      setSelectedSemesterKey(
        createSemesterKey(
          firstOption.academicYear,
          firstOption.semester,
        ),
      )
    } else {
      setSelectedSemesterKey('')
    }

    const focusTimer =
      window.setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 0)

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener(
      'keydown',
      handleKeyDown,
    )

    const previousOverflow =
      document.body.style.overflow

    document.body.style.overflow =
      'hidden'

    return () => {
      window.clearTimeout(focusTimer)

      window.removeEventListener(
        'keydown',
        handleKeyDown,
      )

      document.body.style.overflow =
        previousOverflow
    }
  }, [
    defaultName,
    initialAcademicYear,
    initialSemester,
    isOpen,
    onClose,
    semesterOptions,
  ])

  function handleOverlayMouseDown(
    event: MouseEvent<HTMLDivElement>,
  ) {
    if (
      event.target ===
      event.currentTarget
    ) {
      onClose()
    }
  }

  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (
      nameError !== undefined ||
      selectedSemesterKey.length === 0
    ) {
      return
    }

    const selectedSemester =
      semesterOptions.find(
        (option) =>
          createSemesterKey(
            option.academicYear,
            option.semester,
          ) === selectedSemesterKey,
      )

    if (selectedSemester === undefined) {
      return
    }

    onCreate({
      name: normalizedName,
      academicYear:
        selectedSemester.academicYear,
      semester:
        selectedSemester.semester,
      lectureIds: [],
    })
  }

  if (!isOpen) {
    return null
  }

  return (
    <div
      className="create-timetable-modal-overlay"
      role="presentation"
      onMouseDown={
        handleOverlayMouseDown
      }
    >
      <section
        aria-labelledby="create-timetable-modal-title"
        aria-modal="true"
        className="create-timetable-modal"
        role="dialog"
      >
        <header className="create-timetable-modal__header">
          <div>
            <h2 id="create-timetable-modal-title">
              새 시간표 만들기
            </h2>

            <p>
              시간표의 이름과 기준 학기를
              선택하세요.
            </p>
          </div>

          <button
            aria-label="새 시간표 만들기 창 닫기"
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <form
          className="create-timetable-modal__form"
          onSubmit={handleSubmit}
        >
          <label
            htmlFor="create-timetable-name"
          >
            시간표 이름
          </label>

          <input
            ref={inputRef}
            id="create-timetable-name"
            maxLength={30}
            type="text"
            value={nameInput}
            onChange={(event) => {
              setNameInput(
                event.target.value,
              )
            }}
          />

          <div className="create-timetable-modal__input-footer">
            <span>
              공백만으로는 저장할 수
              없습니다.
            </span>

            <span>
              {nameInput.length}/30
            </span>
          </div>

          {nameError !== undefined &&
          nameInput.length > 0 ? (
            <p
              className="create-timetable-modal__error"
              role="alert"
            >
              {nameError}
            </p>
          ) : null}

          <label
            className="create-timetable-modal__semester-label"
            htmlFor="create-timetable-semester"
          >
            학기
          </label>

          <select
            id="create-timetable-semester"
            disabled={
              semesterOptions.length === 0
            }
            value={selectedSemesterKey}
            onChange={(event) => {
              setSelectedSemesterKey(
                event.target.value,
              )
            }}
          >
            {semesterOptions.map(
              (option) => {
                const optionKey =
                  createSemesterKey(
                    option.academicYear,
                    option.semester,
                  )

                return (
                  <option
                    key={optionKey}
                    value={optionKey}
                  >
                    {option.academicYear}
                    학년도{' '}
                    {option.semester}학기
                  </option>
                )
              },
            )}
          </select>

          {semesterOptions.length === 0 ? (
            <p className="create-timetable-modal__error">
              선택 가능한 개설학기를
              찾지 못했습니다.
            </p>
          ) : (
            <p className="create-timetable-modal__semester-help">
              선택한 학기의 수강편람에
              있는 강의만 시간표에 추가할
              수 있습니다.
            </p>
          )}

          <footer className="create-timetable-modal__actions">
            <button
              className="secondary-button"
              type="button"
              onClick={onClose}
            >
              취소
            </button>

            <button
              className="primary-button"
              disabled={
                nameError !== undefined ||
                selectedSemesterKey.length ===
                  0
              }
              type="submit"
            >
              시간표 생성
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
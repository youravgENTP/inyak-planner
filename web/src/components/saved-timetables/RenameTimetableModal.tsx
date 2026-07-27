import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from 'react'

import './RenameTimetableModal.css'

const MAX_TIMETABLE_NAME_LENGTH = 30

interface RenameTimetableModalProps {
  isOpen: boolean
  currentName: string
  onClose: () => void
  onSave: (name: string) => void
}

export function RenameTimetableModal({
  isOpen,
  currentName,
  onClose,
  onSave,
}: RenameTimetableModalProps) {
  const inputRef =
    useRef<HTMLInputElement>(null)

  const [
    nameInput,
    setNameInput,
  ] = useState(currentName)

  const trimmedName =
    nameInput.trim()

  const isNameValid =
    trimmedName.length > 0 &&
    trimmedName.length <=
      MAX_TIMETABLE_NAME_LENGTH

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setNameInput(currentName)

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
  }, [currentName, isOpen, onClose])

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

    if (!isNameValid) {
      return
    }

    onSave(trimmedName)
  }

  if (!isOpen) {
    return null
  }

  return (
    <div
      className="rename-timetable-modal-overlay"
      role="presentation"
      onMouseDown={
        handleOverlayMouseDown
      }
    >
      <section
        className="rename-timetable-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-timetable-modal-title"
      >
        <header className="rename-timetable-modal__header">
          <div>
            <h2 id="rename-timetable-modal-title">
              시간표 이름 변경
            </h2>

            <p>
              시간표 목록과 다운로드 파일에
              표시될 이름을 입력하세요.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="시간표 이름 변경 창 닫기"
          >
            ×
          </button>
        </header>

        <form
          className="rename-timetable-modal__form"
          onSubmit={handleSubmit}
        >
          <label htmlFor="timetable-name-input">
            시간표 이름
          </label>

          <input
            ref={inputRef}
            id="timetable-name-input"
            type="text"
            value={nameInput}
            maxLength={
              MAX_TIMETABLE_NAME_LENGTH
            }
            onChange={(event) =>
              setNameInput(
                event.target.value,
              )
            }
            aria-describedby="timetable-name-description"
          />

          <div className="rename-timetable-modal__input-footer">
            <span id="timetable-name-description">
              공백만으로는 저장할 수
              없습니다.
            </span>

            <span>
              {nameInput.length}/
              {MAX_TIMETABLE_NAME_LENGTH}
            </span>
          </div>

          {!isNameValid &&
            nameInput.length > 0 && (
              <p
                className="rename-timetable-modal__error"
                role="alert"
              >
                공백을 제외한 이름을 입력해
                주세요.
              </p>
            )}

          <footer className="rename-timetable-modal__actions">
            <button
              className="secondary-button"
              type="button"
              onClick={onClose}
            >
              취소
            </button>

            <button
              className="primary-button"
              type="submit"
              disabled={!isNameValid}
            >
              저장
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
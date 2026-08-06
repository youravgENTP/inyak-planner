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
  GeneralEducation,
} from '../../domain/general-education/types'

import '../MajorTransferCreditModal/MajorTransferCreditModal.css'


interface GeneralEducationTransferCreditModalProps {
  generalEducation: GeneralEducation
  record?: CourseRecord | null
  onClose: () => void
  onCreated: (
    record: CourseRecord,
  ) => void
  onUpdated?: (
    record: CourseRecord,
  ) => void
}


export function GeneralEducationTransferCreditModal({
  generalEducation,
  record= null,
  onClose,
  onCreated,
  onUpdated,
}: GeneralEducationTransferCreditModalProps) {
  const [
    sourceCourseName,
    setSourceCourseName,
  ] = useState(
    record?.courseName ?? '',
  )

  const [
    selectedRequirementId,
    setSelectedRequirementId,
  ] = useState(() => {
    if (
      record
        ?.generalEducationRequirementId ===
        null ||
      record
        ?.generalEducationRequirementId ===
        undefined
    ) {
      return ''
    }

    return String(
      record.generalEducationRequirementId,
    )
  })

  const [
    selectedAreaId,
    setSelectedAreaId,
  ] = useState(() => {
    if (
      record?.generalEducationAreaId ===
        null ||
      record?.generalEducationAreaId ===
        undefined
    ) {
      return ''
    }

    return String(
      record.generalEducationAreaId,
    )
  })

  const [
    recognizedCredits,
    setRecognizedCredits,
  ] = useState(
    record === null
      ? ''
      : String(record.credits),
  )

  const [
    note,
    setNote,
  ] = useState(
    record?.note ?? ''
  )

  const [
    formError,
    setFormError,
  ] = useState<string | null>(null)

  const [
    formIsSubmitting,
    setFormIsSubmitting,
  ] = useState(false)

  const selectedRequirement =
    useMemo(
      () =>
        generalEducation.requirements.find(
          (requirement) =>
            requirement.id ===
            Number(
              selectedRequirementId,
            ),
        ) ?? null,
      [
        generalEducation.requirements,
        selectedRequirementId,
      ],
    )

  const selectedArea =
    useMemo(
      () =>
        selectedRequirement?.areas.find(
          (area) =>
            area.id ===
            Number(selectedAreaId),
        ) ?? null,
      [
        selectedAreaId,
        selectedRequirement,
      ],
    )

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

  function handleRequirementChange(
    requirementId: string,
  ) {
    setSelectedRequirementId(
      requirementId,
    )

    setSelectedAreaId('')
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setFormError(null)

    const credits =
      Number(recognizedCredits)

    if (
      sourceCourseName.trim().length === 0
    ) {
      setFormError(
        '전적대에서 이수한 과목명을 입력해 주세요.',
      )
      return
    }

    if (selectedRequirement === null) {
      setFormError(
        '인정할 교양 구분을 선택해 주세요.',
      )
      return
    }

    if (selectedArea === null) {
      setFormError(
        '인정할 교양 영역을 선택해 주세요.',
      )
      return
    }

    if (
      recognizedCredits.trim().length ===
        0 ||
      !Number.isFinite(credits) ||
      credits <= 0
    ) {
      setFormError(
        '인정학점을 0보다 큰 숫자로 입력해 주세요.',
      )
      return
    }

    setFormIsSubmitting(true)

    try {
      const input: CourseRecordInput = {
        curriculumCourseId: null,
        lectureId: null,
        generalEducationRequirementId:
          selectedRequirement.id,
        generalEducationAreaId:
          selectedArea.id,
        academicYear: null,
        semester: null,
        courseName:
          sourceCourseName.trim(),
        courseCode: null,
        completionType: '교양',
        credits,
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
              ? '교양 인정 과목을 수정하지 못했습니다.'
              : '교양 인정 과목을 저장하지 못했습니다.'
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
        aria-labelledby="general-education-transfer-modal-title"
        aria-modal="true"
        className="major-transfer-modal"
        role="dialog"
      >
        <header className="major-transfer-modal-header">
          <div>
            <p>전적대 학점 인정</p>

            <h2 id="general-education-transfer-modal-title">
              ? '교양 인정 과목 수정'
              : '교양 인정 과목 추가'
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
              placeholder="예: 통계학 입문"
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
            <span>교양 구분</span>

            <select
              value={selectedRequirementId}
              onChange={(event) => {
                handleRequirementChange(
                  event.target.value,
                )
              }}
            >
              <option value="">
                구분을 선택하세요
              </option>

              {generalEducation
                .requirements
                .map((requirement) => (
                  <option
                    key={requirement.id}
                    value={requirement.id}
                  >
                    {
                      requirement.category
                    }
                  </option>
                ))}
            </select>
          </label>

          <label>
            <span>세부 영역</span>

            <select
              disabled={
                selectedRequirement ===
                null
              }
              value={selectedAreaId}
              onChange={(event) => {
                setSelectedAreaId(
                  event.target.value,
                )
              }}
            >
              <option value="">
                영역을 선택하세요
              </option>

              {selectedRequirement?.areas.map(
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

          <label>
            <span>인정학점</span>

            <input
              min="0.5"
              step="0.5"
              type="number"
              value={recognizedCredits}
              onChange={(event) => {
                setRecognizedCredits(
                  event.target.value,
                )
              }}
            />
          </label>

          {selectedRequirement !== null &&
          selectedArea !== null ? (
            <div className="major-transfer-modal-preview">
              <div>
                <span>교양 구분</span>

                <strong>
                  {
                    selectedRequirement
                      .category
                  }
                </strong>
              </div>

              <div>
                <span>세부 영역</span>

                <strong>
                  {selectedArea.areaName}
                </strong>
              </div>

              <div>
                <span>인정학점</span>

                <strong>
                  {recognizedCredits
                    .trim()
                    .length === 0
                    ? '미입력'
                    : `${recognizedCredits}학점`}
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
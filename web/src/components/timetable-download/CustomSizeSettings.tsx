import {
  useState,
  type ChangeEvent,
} from 'react'

import type {
  CustomSizeValues,
} from '../../domain/timetable-download/types'

interface CustomSizeSettingsProps {
  values: CustomSizeValues
  errorMessage?: string
  onValuesChange: (values: CustomSizeValues) => void
}

function CustomSizeSettings({
  values,
  errorMessage,
  onValuesChange,
}: CustomSizeSettingsProps) {
  const [isBrowserSizeApplied, setIsBrowserSizeApplied] =
    useState(false)

  const handleWidthChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    setIsBrowserSizeApplied(false)

    onValuesChange({
      ...values,
      width: event.target.value,
    })
  }

  const handleHeightChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    setIsBrowserSizeApplied(false)

    onValuesChange({
      ...values,
      height: event.target.value,
    })
  }

  const handleBrowserSizeChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const isChecked = event.target.checked

    setIsBrowserSizeApplied(isChecked)

    if (!isChecked) {
      return
    }

    onValuesChange({
      width: String(window.innerWidth),
      height: String(window.innerHeight),
    })
  }

  const errorMessageId = errorMessage
    ? 'custom-size-error'
    : undefined

  return (
    <section
      className="timetable-download-custom-size"
      aria-labelledby="custom-size-heading"
    >
      <div className="timetable-download-setting-heading">
        <h3 id="custom-size-heading">
          사용자 지정 크기
        </h3>

        <p>
          다운로드할 PNG 이미지의 가로와 세로 크기를
          픽셀 단위로 입력해 주세요.
        </p>
      </div>

      <div className="timetable-download-size-fields">
        <label className="timetable-download-size-field">
          <span className="timetable-download-field-label">
            가로
          </span>

          <span className="timetable-download-input-with-unit">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={values.width}
              aria-describedby={errorMessageId}
              aria-invalid={errorMessage !== undefined}
              onChange={handleWidthChange}
            />

            <span aria-hidden="true">
              px
            </span>
          </span>
        </label>

        <label className="timetable-download-size-field">
          <span className="timetable-download-field-label">
            세로
          </span>

          <span className="timetable-download-input-with-unit">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={values.height}
              aria-describedby={errorMessageId}
              aria-invalid={errorMessage !== undefined}
              onChange={handleHeightChange}
            />

            <span aria-hidden="true">
              px
            </span>
          </span>
        </label>
      </div>

      <label className="timetable-download-browser-size-option">
        <input
          type="checkbox"
          checked={isBrowserSizeApplied}
          onChange={handleBrowserSizeChange}
        />

        <span>
          현재 브라우저 화면 크기 적용
        </span>
      </label>

      {errorMessage && (
        <p
          id="custom-size-error"
          className="timetable-download-setting-error"
          role="alert"
        >
          {errorMessage}
        </p>
      )}
    </section>
  )
}

export default CustomSizeSettings
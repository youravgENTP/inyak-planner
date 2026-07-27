import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'

import {
  ALL_RESOLUTION_PRESETS,
} from '../../domain/timetable-download/devices'
import { validateCustomSizeValues } from '../../domain/timetable-download/dimensions'
import downloadTimetablePng from '../../domain/timetable-download/downloadTimetablePng'
import type {
  CustomSizeValues,
  DeviceResolutionPreset,
  ImageDimensions,
  TimetableDownloadMode,
  TimetableRenderLayout,
} from '../../domain/timetable-download/types'
import CustomSizeSettings from './CustomSizeSettings'
import DevicePresetSettings from './DevicePresetSettings'
import './TimetableDownloadModal.css'
import './TimetableDownloadLayout.css'

interface TimetableDownloadModalProps {
  isOpen: boolean
  timetableElement: HTMLElement | null
  filename?: string
  onClose: () => void
}

const DEFAULT_CUSTOM_SIZE: CustomSizeValues = {
  width: '1080',
  height: '1920',
}

const DEFAULT_PRESET = ALL_RESOLUTION_PRESETS[0]

const getErrorMessage = (
  error: unknown,
): string => {
  if (error instanceof Error) {
    return error.message
  }

  return '시간표 이미지를 생성하는 중 알 수 없는 오류가 발생했습니다.'
}

const getPresetRenderLayout = (
  preset: DeviceResolutionPreset,
): TimetableRenderLayout => {
  if (preset.category === 'iphone') {
    return 'mobile-portrait'
  }

  if (
    preset.category === 'galaxy-phone' &&
    preset.orientation === 'portrait'
  ) {
    return 'mobile-portrait'
  }

  return 'standard'
}

function TimetableDownloadModal({
  isOpen,
  timetableElement,
  filename = 'inyak-timetable.png',
  onClose,
}: TimetableDownloadModalProps) {
  const [mode, setMode] =
    useState<TimetableDownloadMode>('custom')

  const [customSizeValues, setCustomSizeValues] =
    useState<CustomSizeValues>(DEFAULT_CUSTOM_SIZE)

  const [
    selectedPreset,
    setSelectedPreset,
  ] = useState<DeviceResolutionPreset>(
    DEFAULT_PRESET,
  )

  const [
    customSizeErrorMessage,
    setCustomSizeErrorMessage,
  ] = useState<string>()

  const [
    downloadErrorMessage,
    setDownloadErrorMessage,
  ] = useState<string>()

  const [isDownloading, setIsDownloading] =
    useState(false)

  const closeButtonRef =
    useRef<HTMLButtonElement>(null)

  const previouslyFocusedElementRef =
    useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    previouslyFocusedElementRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    const previousBodyOverflow =
      document.body.style.overflow

    document.body.style.overflow = 'hidden'

    closeButtonRef.current?.focus()

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key !== 'Escape') {
        return
      }

      event.preventDefault()
      onClose()
    }

    document.addEventListener(
      'keydown',
      handleKeyDown,
    )

    return () => {
      document.body.style.overflow =
        previousBodyOverflow

      document.removeEventListener(
        'keydown',
        handleKeyDown,
      )

      previouslyFocusedElementRef.current?.focus()
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setCustomSizeErrorMessage(undefined)
    setDownloadErrorMessage(undefined)
    setIsDownloading(false)
  }, [isOpen])

  const handleModeChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const nextMode =
      event.target.value as TimetableDownloadMode

    setMode(nextMode)
    setCustomSizeErrorMessage(undefined)
    setDownloadErrorMessage(undefined)
  }

  const handleCustomSizeChange = (
    values: CustomSizeValues,
  ) => {
    setCustomSizeValues(values)
    setCustomSizeErrorMessage(undefined)
    setDownloadErrorMessage(undefined)
  }

  const handlePresetChange = (
    preset: DeviceResolutionPreset,
  ) => {
    setSelectedPreset(preset)
    setDownloadErrorMessage(undefined)
  }

  const getSelectedDimensions = ():
    | ImageDimensions
    | undefined => {
    if (mode === 'preset') {
      return {
        width: selectedPreset.width,
        height: selectedPreset.height,
      }
    }

    const validationResult =
      validateCustomSizeValues(
        customSizeValues,
      )

    if (!validationResult.isValid) {
      setCustomSizeErrorMessage(
        validationResult.errorMessage,
      )

      return undefined
    }

    setCustomSizeErrorMessage(undefined)

    return validationResult.dimensions
  }

  const getSelectedRenderLayout =
    (): TimetableRenderLayout => {
      if (mode !== 'preset') {
        return 'standard'
      }

      return getPresetRenderLayout(
        selectedPreset,
      )
    }

  const handleDownload = async () => {
    if (isDownloading) {
      return
    }

    setDownloadErrorMessage(undefined)

    if (timetableElement === null) {
      setDownloadErrorMessage(
        '다운로드할 시간표 요소를 찾을 수 없습니다.',
      )

      return
    }

    const dimensions =
      getSelectedDimensions()

    if (dimensions === undefined) {
      return
    }

    const layout =
      getSelectedRenderLayout()

    setIsDownloading(true)

    try {
      await downloadTimetablePng({
        element: timetableElement,
        dimensions,
        layout,
        filename,
        backgroundColor: '#ffffff',
      })
    } catch (error) {
      setDownloadErrorMessage(
        getErrorMessage(error),
      )
    } finally {
      setIsDownloading(false)
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div
      className="timetable-download-modal-overlay"
      aria-hidden="false"
    >
      <section
        className="timetable-download-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="timetable-download-modal-title"
        aria-describedby="timetable-download-modal-description"
      >
        <header className="timetable-download-modal-header">
          <div>
            <h2 id="timetable-download-modal-title">
              시간표 다운로드
            </h2>

            <p id="timetable-download-modal-description">
              PNG 이미지의 출력 크기를 선택해 주세요.
              휴대폰은 세로형 시간표로, 태블릿과
              노트북은 가로형 시간표로 저장됩니다.
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            className="timetable-download-modal-close"
            aria-label="시간표 다운로드 창 닫기"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="timetable-download-modal-body">
          <fieldset className="timetable-download-mode-selector">
            <legend>
              크기 선택 방식
            </legend>

            <label>
              <input
                type="radio"
                name="timetable-download-mode"
                value="custom"
                checked={mode === 'custom'}
                onChange={handleModeChange}
              />

              <span>
                사용자 지정
              </span>
            </label>

            <label>
              <input
                type="radio"
                name="timetable-download-mode"
                value="preset"
                checked={mode === 'preset'}
                onChange={handleModeChange}
              />

              <span>
                해상도 프리셋
              </span>
            </label>
          </fieldset>

          {mode === 'custom' ? (
            <CustomSizeSettings
              values={customSizeValues}
              errorMessage={
                customSizeErrorMessage
              }
              onValuesChange={
                handleCustomSizeChange
              }
            />
          ) : (
            <DevicePresetSettings
              selectedPresetId={
                selectedPreset.id
              }
              onPresetChange={
                handlePresetChange
              }
            />
          )}

          {downloadErrorMessage && (
            <p
              className="timetable-download-error"
              role="alert"
            >
              {downloadErrorMessage}
            </p>
          )}
        </div>

        <footer className="timetable-download-modal-footer">
          <button
            type="button"
            className="timetable-download-cancel-button"
            disabled={isDownloading}
            onClick={onClose}
          >
            취소
          </button>

          <button
            type="button"
            className="timetable-download-submit-button"
            disabled={
              isDownloading ||
              timetableElement === null
            }
            aria-busy={isDownloading}
            onClick={handleDownload}
          >
            {isDownloading
              ? 'PNG 생성 중...'
              : 'PNG 다운로드'}
          </button>
        </footer>
      </section>
    </div>
  )
}

export default TimetableDownloadModal
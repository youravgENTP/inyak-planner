import {
  useState,
  type ChangeEvent,
} from 'react'

import {
  ALL_RESOLUTION_PRESETS,
} from '../../domain/timetable-download/devices'
import {
  filterResolutionPresets,
  findPresetById,
} from '../../domain/timetable-download/presetSelectors'
import type {
  DevicePresetCategory,
  DeviceResolutionPreset,
  ResolutionPresetSource,
} from '../../domain/timetable-download/types'

interface DevicePresetSettingsProps {
  selectedPresetId: string
  onPresetChange: (
    preset: DeviceResolutionPreset,
  ) => void
}

interface CategoryOption {
  value: DevicePresetCategory
  label: string
}

const APPLE_CATEGORY_OPTIONS: readonly CategoryOption[] = [
  {
    value: 'iphone',
    label: 'iPhone',
  },
  {
    value: 'ipad',
    label: 'iPad',
  },
  {
    value: 'macbook',
    label: 'MacBook',
  },
  {
    value: 'imac',
    label: 'iMac',
  },
]

const getInitialSource = (
  selectedPresetId: string,
): ResolutionPresetSource => {
  const selectedPreset = findPresetById(
    ALL_RESOLUTION_PRESETS,
    selectedPresetId,
  )

  return selectedPreset?.source ?? 'apple'
}

const getInitialCategory = (
  selectedPresetId: string,
): DevicePresetCategory => {
  const selectedPreset = findPresetById(
    ALL_RESOLUTION_PRESETS,
    selectedPresetId,
  )

  if (
    selectedPreset?.source === 'apple' &&
    selectedPreset.category !== 'generic-display'
  ) {
    return selectedPreset.category
  }

  return 'iphone'
}

function DevicePresetSettings({
  selectedPresetId,
  onPresetChange,
}: DevicePresetSettingsProps) {
  const [source, setSource] =
    useState<ResolutionPresetSource>(() =>
      getInitialSource(selectedPresetId),
    )

  const [category, setCategory] =
    useState<DevicePresetCategory>(() =>
      getInitialCategory(selectedPresetId),
    )

  const [searchQuery, setSearchQuery] = useState('')

  const filteredPresets = filterResolutionPresets(
    ALL_RESOLUTION_PRESETS,
    {
      source,
      category:
        source === 'apple'
          ? category
          : 'generic-display',
      searchQuery,
    },
  )

  const selectedPreset = findPresetById(
    ALL_RESOLUTION_PRESETS,
    selectedPresetId,
  )

  const selectFirstPreset = (
    nextSource: ResolutionPresetSource,
    nextCategory: DevicePresetCategory,
  ) => {
    const matchingPresets = filterResolutionPresets(
      ALL_RESOLUTION_PRESETS,
      {
        source: nextSource,
        category:
          nextSource === 'apple'
            ? nextCategory
            : 'generic-display',
      },
    )

    const firstPreset = matchingPresets[0]

    if (firstPreset !== undefined) {
      onPresetChange(firstPreset)
    }
  }

  const handleSourceChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const nextSource =
      event.target.value as ResolutionPresetSource

    setSource(nextSource)
    setSearchQuery('')

    selectFirstPreset(nextSource, category)
  }

  const handleCategoryChange = (
    event: ChangeEvent<HTMLSelectElement>,
  ) => {
    const nextCategory =
      event.target.value as DevicePresetCategory

    setCategory(nextCategory)
    setSearchQuery('')

    selectFirstPreset('apple', nextCategory)
  }

  const handleSearchChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    setSearchQuery(event.target.value)
  }

  const handlePresetChange = (
    event: ChangeEvent<HTMLSelectElement>,
  ) => {
    const nextPreset = findPresetById(
      ALL_RESOLUTION_PRESETS,
      event.target.value,
    )

    if (nextPreset !== undefined) {
      onPresetChange(nextPreset)
    }
  }

  return (
    <section
      className="timetable-download-preset-settings"
      aria-labelledby="preset-settings-heading"
    >
      <div className="timetable-download-setting-heading">
        <h3 id="preset-settings-heading">
          해상도 프리셋
        </h3>

        <p>
          Apple 기기 또는 일반 화면 해상도를 선택해
          주세요.
        </p>
      </div>

      <fieldset className="timetable-download-preset-source">
        <legend className="timetable-download-field-label">
          프리셋 종류
        </legend>

        <label>
          <input
            type="radio"
            name="resolution-preset-source"
            value="apple"
            checked={source === 'apple'}
            onChange={handleSourceChange}
          />

          <span>Apple 기기</span>
        </label>

        <label>
          <input
            type="radio"
            name="resolution-preset-source"
            value="generic"
            checked={source === 'generic'}
            onChange={handleSourceChange}
          />

          <span>일반 화면</span>
        </label>
      </fieldset>

      {source === 'apple' && (
        <label className="timetable-download-preset-field">
          <span className="timetable-download-field-label">
            제품군
          </span>

          <select
            value={category}
            onChange={handleCategoryChange}
          >
            {APPLE_CATEGORY_OPTIONS.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="timetable-download-preset-field">
        <span className="timetable-download-field-label">
          모델 또는 해상도 검색
        </span>

        <input
          type="search"
          value={searchQuery}
          placeholder={
            source === 'apple'
              ? '예: iPhone 16 Pro'
              : '예: 1920 × 1080'
          }
          autoComplete="off"
          onChange={handleSearchChange}
        />
      </label>

      <label className="timetable-download-preset-field">
        <span className="timetable-download-field-label">
          해상도 선택
        </span>

        <select
          value={
            filteredPresets.some(
              (preset) => preset.id === selectedPresetId,
            )
              ? selectedPresetId
              : ''
          }
          disabled={filteredPresets.length === 0}
          onChange={handlePresetChange}
        >
          {filteredPresets.length === 0 ? (
            <option value="">
              일치하는 프리셋이 없습니다
            </option>
          ) : (
            <>
              <option value="" disabled>
                프리셋을 선택해 주세요
              </option>

              {filteredPresets.map((preset) => (
                <option
                  key={preset.id}
                  value={preset.id}
                >
                  {preset.label}
                </option>
              ))}
            </>
          )}
        </select>
      </label>

      {filteredPresets.length === 0 && (
        <p
          className="timetable-download-empty-message"
          role="status"
        >
          검색 조건과 일치하는 해상도 프리셋이
          없습니다.
        </p>
      )}

      {selectedPreset !== undefined && (
        <div className="timetable-download-preset-summary">
          <div>
            <span>출력 해상도</span>

            <strong>
              {selectedPreset.width}
              {' × '}
              {selectedPreset.height}
              {' px'}
            </strong>
          </div>

          <div>
            <span>화면 방향</span>

            <strong>
              {selectedPreset.orientation === 'portrait'
                ? '세로'
                : '가로'}
            </strong>
          </div>

          {selectedPreset.models.length > 0 && (
            <div>
              <span>해당 모델</span>

              <ul>
                {selectedPreset.models.map((model) => (
                  <li key={model}>
                    {model}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selectedPreset.note && (
            <p>
              {selectedPreset.note}
            </p>
          )}
        </div>
      )}
    </section>
  )
}

export default DevicePresetSettings
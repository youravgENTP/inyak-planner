import type {
  CustomSizeValues,
  DimensionValidationResult,
} from './types'

export const MIN_OUTPUT_DIMENSION = 320
export const MAX_OUTPUT_DIMENSION = 8192
export const MAX_OUTPUT_PIXEL_COUNT = 30_000_000

const POSITIVE_INTEGER_PATTERN = /^\d+$/

const createInvalidResult = (
  errorMessage: string,
): DimensionValidationResult => ({
  isValid: false,
  errorMessage,
})

export const validateOutputDimensions = (
  width: number,
  height: number,
): DimensionValidationResult => {
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return createInvalidResult(
      '가로와 세로 크기는 유효한 숫자여야 합니다.',
    )
  }

  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    return createInvalidResult(
      '가로와 세로 크기는 소수가 아닌 정수로 입력해 주세요.',
    )
  }

  if (width <= 0 || height <= 0) {
    return createInvalidResult(
      '가로와 세로 크기는 0보다 커야 합니다.',
    )
  }

  if (
    width < MIN_OUTPUT_DIMENSION ||
    height < MIN_OUTPUT_DIMENSION
  ) {
    return createInvalidResult(
      `가로와 세로는 각각 최소 ${MIN_OUTPUT_DIMENSION}px 이상이어야 합니다.`,
    )
  }

  if (
    width > MAX_OUTPUT_DIMENSION ||
    height > MAX_OUTPUT_DIMENSION
  ) {
    return createInvalidResult(
      `가로와 세로는 각각 최대 ${MAX_OUTPUT_DIMENSION}px까지 설정할 수 있습니다.`,
    )
  }

  if (width * height > MAX_OUTPUT_PIXEL_COUNT) {
    return createInvalidResult(
      '이미지 전체 크기가 너무 큽니다. 가로 또는 세로 크기를 줄여 주세요.',
    )
  }

  return {
    isValid: true,
    dimensions: {
      width,
      height,
    },
  }
}

export const validateCustomSizeValues = (
  values: CustomSizeValues,
): DimensionValidationResult => {
  const widthValue = values.width.trim()
  const heightValue = values.height.trim()

  if (widthValue === '' || heightValue === '') {
    return createInvalidResult(
      '가로와 세로 크기를 모두 입력해 주세요.',
    )
  }

  if (
    !POSITIVE_INTEGER_PATTERN.test(widthValue) ||
    !POSITIVE_INTEGER_PATTERN.test(heightValue)
  ) {
    return createInvalidResult(
      '가로와 세로 크기는 소수가 아닌 숫자로 입력해 주세요.',
    )
  }

  const width = Number(widthValue)
  const height = Number(heightValue)

  return validateOutputDimensions(width, height)
}
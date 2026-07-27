import { toPng } from 'html-to-image'

import { validateOutputDimensions } from './dimensions'
import type {
  DownloadTimetablePngOptions,
  ImageDimensions,
} from './types'

const DEFAULT_FILENAME = 'inyak-timetable.png'
const DEFAULT_BACKGROUND_COLOR = '#ffffff'
const MAX_RENDER_PIXEL_RATIO = 4

interface ContainedImagePlacement {
  x: number
  y: number
  width: number
  height: number
}

const ensurePngExtension = (filename: string): string =>
  filename.toLowerCase().endsWith('.png')
    ? filename
    : `${filename}.png`

const sanitizeFilename = (filename: string): string => {
  const trimmedFilename = filename.trim()

  const safeFilename = trimmedFilename
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\.+$/g, '')

  return ensurePngExtension(
    safeFilename === ''
      ? DEFAULT_FILENAME
      : safeFilename,
  )
}

const waitForDocumentFonts = async (): Promise<void> => {
  await document.fonts.ready
}

const loadImage = (
  source: string,
): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => {
      resolve(image)
    }

    image.onerror = () => {
      reject(
        new Error(
          '생성된 시간표 이미지를 불러오지 못했습니다.',
        ),
      )
    }

    image.src = source
  })

const createCanvas = (
  dimensions: ImageDimensions,
): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')

  canvas.width = dimensions.width
  canvas.height = dimensions.height

  return canvas
}

const calculateContainedPlacement = (
  sourceDimensions: ImageDimensions,
  targetDimensions: ImageDimensions,
): ContainedImagePlacement => {
  const scale = Math.min(
    targetDimensions.width / sourceDimensions.width,
    targetDimensions.height / sourceDimensions.height,
  )

  const width = sourceDimensions.width * scale
  const height = sourceDimensions.height * scale

  return {
    x: (targetDimensions.width - width) / 2,
    y: (targetDimensions.height - height) / 2,
    width,
    height,
  }
}

const calculateRenderPixelRatio = (
  sourceDimensions: ImageDimensions,
  targetDimensions: ImageDimensions,
): number => {
  const targetScale = Math.min(
    targetDimensions.width / sourceDimensions.width,
    targetDimensions.height / sourceDimensions.height,
  )

  return Math.min(
    Math.max(targetScale, 1),
    MAX_RENDER_PIXEL_RATIO,
  )
}

const canvasToPngBlob = (
  canvas: HTMLCanvasElement,
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob === null) {
          reject(
            new Error(
              'PNG 파일 데이터를 생성하지 못했습니다.',
            ),
          )

          return
        }

        resolve(blob)
      },
      'image/png',
    )
  })

const triggerBlobDownload = (
  blob: Blob,
  filename: string,
): void => {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = objectUrl
  anchor.download = filename
  anchor.style.display = 'none'

  document.body.appendChild(anchor)

  try {
    anchor.click()
  } finally {
    anchor.remove()
    URL.revokeObjectURL(objectUrl)
  }
}

export const downloadTimetablePng = async ({
  element,
  dimensions,
  filename = DEFAULT_FILENAME,
  backgroundColor = DEFAULT_BACKGROUND_COLOR,
}: DownloadTimetablePngOptions): Promise<void> => {
  const dimensionValidation = validateOutputDimensions(
    dimensions.width,
    dimensions.height,
  )

  if (!dimensionValidation.isValid) {
    throw new Error(
      dimensionValidation.errorMessage,
    )
  }

  if (!element.isConnected) {
    throw new Error(
      '다운로드할 시간표를 화면에서 찾을 수 없습니다.',
    )
  }

  const elementBounds = element.getBoundingClientRect()

  const sourceDimensions = {
    width: elementBounds.width,
    height: elementBounds.height,
  }

  if (
    sourceDimensions.width <= 0 ||
    sourceDimensions.height <= 0
  ) {
    throw new Error(
      '시간표의 실제 크기를 확인할 수 없습니다.',
    )
  }

  await waitForDocumentFonts()

  const renderPixelRatio = calculateRenderPixelRatio(
    sourceDimensions,
    dimensions,
  )

  const timetableDataUrl = await toPng(element, {
    backgroundColor,
    cacheBust: true,
    pixelRatio: renderPixelRatio,
  })

  const timetableImage = await loadImage(
    timetableDataUrl,
  )

  const outputCanvas = createCanvas(dimensions)
  const context = outputCanvas.getContext('2d')

  if (context === null) {
    throw new Error(
      '이미지 출력 화면을 생성하지 못했습니다.',
    )
  }

  context.fillStyle = backgroundColor
  context.fillRect(
    0,
    0,
    dimensions.width,
    dimensions.height,
  )

  const placement = calculateContainedPlacement(
    {
      width: timetableImage.naturalWidth,
      height: timetableImage.naturalHeight,
    },
    dimensions,
  )

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'

  context.drawImage(
    timetableImage,
    placement.x,
    placement.y,
    placement.width,
    placement.height,
  )

  const pngBlob = await canvasToPngBlob(
    outputCanvas,
  )

  triggerBlobDownload(
    pngBlob,
    sanitizeFilename(filename),
  )
}

export default downloadTimetablePng
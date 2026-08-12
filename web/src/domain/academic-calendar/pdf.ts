import {
  toPng,
} from 'html-to-image'

import {
  jsPDF,
} from 'jspdf'


const PDF_MARGIN_MM = 8
const PDF_PIXEL_RATIO = 2
const TITLE_GAP_PX = 16


interface RenderedCalendarImage {
  dataUrl: string
  width: number
  height: number
}


function loadImage(
  dataUrl: string,
): Promise<HTMLImageElement> {
  return new Promise(
    (
      resolve,
      reject,
    ) => {
      const image =
        new Image()

      image.onload = () => {
        resolve(image)
      }

      image.onerror = () => {
        reject(
          new Error(
            'PDF 이미지를 불러오지 못했습니다.',
          ),
        )
      }

      image.src =
        dataUrl
    },
  )
}


async function renderElementToPng(
  element: HTMLElement,
): Promise<RenderedCalendarImage> {
  const titleElement =
    element.querySelector<HTMLElement>(
      'h2',
    )

  const calendarGrid =
    element.querySelector<HTMLElement>(
      '.academic-calendar-horizontal-grid',
    )

  if (
    titleElement === null ||
    calendarGrid === null
  ) {
    throw new Error(
      'PDF로 저장할 학사일정 영역을 찾지 못했습니다.',
    )
  }

  await document.fonts.ready

  const gridWidth =
    calendarGrid.scrollWidth

  const gridHeight =
    calendarGrid.scrollHeight

  const titleWidth =
    titleElement.scrollWidth

  const titleHeight =
    titleElement.scrollHeight

  const titleDataUrl =
    await toPng(
      titleElement,
      {
        backgroundColor:
          '#ffffff',

        cacheBust: true,

        pixelRatio:
          PDF_PIXEL_RATIO,

        width:
          titleWidth,

        height:
          titleHeight,
      },
    )

  const gridDataUrl =
    await toPng(
      calendarGrid,
      {
        backgroundColor:
          '#ffffff',

        cacheBust: true,

        pixelRatio:
          PDF_PIXEL_RATIO,

        width:
          gridWidth,

        height:
          gridHeight,

        style: {
          width:
            `${gridWidth}px`,

          minWidth:
            `${gridWidth}px`,

          maxWidth:
            'none',
        },
      },
    )

  const [
    titleImage,
    gridImage,
  ] =
    await Promise.all([
      loadImage(
        titleDataUrl,
      ),
      loadImage(
        gridDataUrl,
      ),
    ])

  const gapPx =
    TITLE_GAP_PX *
    PDF_PIXEL_RATIO

  const canvas =
    document.createElement(
      'canvas',
    )

  canvas.width =
    gridImage.naturalWidth

  canvas.height =
    titleImage.naturalHeight +
    gapPx +
    gridImage.naturalHeight

  const context =
    canvas.getContext(
      '2d',
    )

  if (context === null) {
    throw new Error(
      'PDF 캔버스를 생성하지 못했습니다.',
    )
  }

  context.fillStyle =
    '#ffffff'

  context.fillRect(
    0,
    0,
    canvas.width,
    canvas.height,
  )

  context.drawImage(
    titleImage,
    0,
    0,
  )

  context.drawImage(
    gridImage,
    0,
    titleImage.naturalHeight +
      gapPx,
  )

  return {
    dataUrl:
      canvas.toDataURL(
        'image/png',
      ),

    width:
      canvas.width,

    height:
      canvas.height,
  }
}


function addImageToPdfPage(
  pdf: jsPDF,
  imageDataUrl: string,
  imageWidthPx: number,
  imageHeightPx: number,
) {
  const pageWidth =
    pdf.internal.pageSize.getWidth()

  const pageHeight =
    pdf.internal.pageSize.getHeight()

  const availableWidth =
    pageWidth -
    PDF_MARGIN_MM * 2

  const availableHeight =
    pageHeight -
    PDF_MARGIN_MM * 2

  const imageAspectRatio =
    imageWidthPx /
    imageHeightPx

  const pageAspectRatio =
    availableWidth /
    availableHeight

  let renderedWidth:
    number

  let renderedHeight:
    number

  if (
    imageAspectRatio >
    pageAspectRatio
  ) {
    renderedWidth =
      availableWidth

    renderedHeight =
      renderedWidth /
      imageAspectRatio
  } else {
    renderedHeight =
      availableHeight

    renderedWidth =
      renderedHeight *
      imageAspectRatio
  }

  const x =
    (
      pageWidth -
      renderedWidth
    ) / 2

  const y =
    (
      pageHeight -
      renderedHeight
    ) / 2

  pdf.addImage(
    imageDataUrl,
    'PNG',
    x,
    y,
    renderedWidth,
    renderedHeight,
    undefined,
    'FAST',
  )
}


export async function downloadAcademicCalendarPdf(
  element: HTMLElement,
  academicYear: number,
  half:
    | 'front'
    | 'back',
): Promise<void> {
  const renderedImage =
    await renderElementToPng(
      element,
    )

  const pdf =
    new jsPDF({
      orientation:
        'landscape',
      unit: 'mm',
      format: 'a4',
      compress: true,
    })

  addImageToPdfPage(
    pdf,
    renderedImage.dataUrl,
    renderedImage.width,
    renderedImage.height,
  )

  const halfLabel =
    half === 'front'
      ? '상반기'
      : '하반기'

  pdf.save(
    `${academicYear}학년도_${halfLabel}_학사일정.pdf`,
  )
}
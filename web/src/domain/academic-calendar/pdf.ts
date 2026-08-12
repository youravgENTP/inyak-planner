import {
  toPng,
} from 'html-to-image'

import {
  jsPDF,
} from 'jspdf'


const PDF_MARGIN_MM = 8
const PDF_PIXEL_RATIO = 2


interface RenderedCalendarImage {
  dataUrl: string
  width: number
  height: number
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

  const captureRoot =
    document.createElement('div')

  const titleClone =
    titleElement.cloneNode(
      true,
    ) as HTMLElement

  const gridClone =
    calendarGrid.cloneNode(
      true,
    ) as HTMLElement

  const gridWidth =
    calendarGrid.scrollWidth

  captureRoot.style.position =
    'fixed'

  captureRoot.style.top =
    '-100000px'

  captureRoot.style.left =
    '0'

  captureRoot.style.width =
    `${gridWidth}px`

  captureRoot.style.maxWidth =
    'none'

  captureRoot.style.background =
    '#ffffff'

  captureRoot.style.pointerEvents =
    'none'

  captureRoot.style.zIndex =
    '-1'

  titleClone.style.margin =
    '0 0 16px'

  gridClone.style.width =
    `${gridWidth}px`

  gridClone.style.minWidth =
    `${gridWidth}px`

  gridClone.style.maxWidth =
    'none'

  captureRoot.appendChild(
    titleClone,
  )

  captureRoot.appendChild(
    gridClone,
  )

  document.body.appendChild(
    captureRoot,
  )

  try {
    await document.fonts.ready

    const captureWidth =
      captureRoot.scrollWidth

    const captureHeight =
      captureRoot.scrollHeight

    const dataUrl =
      await toPng(
        captureRoot,
        {
          backgroundColor:
            '#ffffff',

          cacheBust: true,

          pixelRatio:
            PDF_PIXEL_RATIO,

          width:
            captureWidth,

          height:
            captureHeight,
        },
      )

    return {
      dataUrl,
      width:
        captureWidth,
      height:
        captureHeight,
    }
  } finally {
    captureRoot.remove()
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
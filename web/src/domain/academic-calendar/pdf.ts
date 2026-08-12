import {
  toPng,
} from 'html-to-image'

import {
  jsPDF,
} from 'jspdf'


const PDF_MARGIN_MM = 8
const PDF_PIXEL_RATIO = 2


async function renderElementToPng(
  element: HTMLElement,
): Promise<string> {
  const scrollContainer =
    element.querySelector<HTMLElement>(
      '.academic-calendar-horizontal-scroll',
    )

  const calendarGrid =
    element.querySelector<HTMLElement>(
      '.academic-calendar-horizontal-grid',
    )

  if (
    scrollContainer === null ||
    calendarGrid === null
  ) {
    throw new Error(
      'PDF로 저장할 학사일정 영역을 찾지 못했습니다.',
    )
  }

  const captureWidth =
    calendarGrid.offsetWidth

  const captureHeight =
    element.scrollHeight

  const originalOverflow =
    scrollContainer.style.overflow

  const originalWidth =
    scrollContainer.style.width

  const originalMaxWidth =
    scrollContainer.style.maxWidth

  try {
    scrollContainer.style.overflow =
      'visible'

    scrollContainer.style.width =
      `${captureWidth}px`

    scrollContainer.style.maxWidth =
      'none'

    return await toPng(
      element,
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

        style: {
          width:
            `${captureWidth}px`,
          maxWidth: 'none',
        },
      },
    )
  } finally {
    scrollContainer.style.overflow =
      originalOverflow

    scrollContainer.style.width =
      originalWidth

    scrollContainer.style.maxWidth =
      originalMaxWidth
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
  const imageDataUrl =
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
    imageDataUrl,
    element.scrollWidth,
    element.scrollHeight,
  )

  const halfLabel =
    half === 'front'
      ? '상반기'
      : '하반기'

  pdf.save(
    `${academicYear}학년도_${halfLabel}_학사일정.pdf`,
  )
}
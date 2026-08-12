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
  return toPng(
    element,
    {
      backgroundColor: '#ffffff',
      cacheBust: true,
      pixelRatio:
        PDF_PIXEL_RATIO,
      width:
        element.scrollWidth,
      height:
        element.scrollHeight,
    },
  )
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
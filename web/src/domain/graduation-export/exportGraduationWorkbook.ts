import * as ExcelJS from 'exceljs'

import type {
  GraduationExportData,
  GraduationExportStatus,
} from './types'


const STATUS_OPTIONS:
  GraduationExportStatus[] = [
    '이수',
    '대체인정',
    '수강중',
    '계획중',
    '미이수',
  ]


const COLORS = {
  darkGreen: '365F4A',

  lightGreen: 'E5F1E9',
  substitutedGreen: 'C6E0CC',

  inProgressBlue: 'DCEAF7',
  plannedBlue: 'C9DCF2',

  lightRed: 'F6D8D8',

  header: 'E9EEEB',
  border: 'AEBAB3',

  white: 'FFFFFF',
  text: '26332C',
  mutedText: '66736C',
}


function applyThinBorder(
  cell: ExcelJS.Cell,
) {
  cell.border = {
    top: {
      style: 'thin',
      color: {
        argb: COLORS.border,
      },
    },

    left: {
      style: 'thin',
      color: {
        argb: COLORS.border,
      },
    },

    bottom: {
      style: 'thin',
      color: {
        argb: COLORS.border,
      },
    },

    right: {
      style: 'thin',
      color: {
        argb: COLORS.border,
      },
    },
  }
}


function applyHeaderStyle(
  row: ExcelJS.Row,
  firstColumn: number,
  lastColumn: number,
) {
  row.height = 24

  for (
    let column = firstColumn;
    column <= lastColumn;
    column += 1
  ) {
    const cell =
      row.getCell(column)

    cell.font = {
      bold: true,
      color: {
        argb: COLORS.text,
      },
    }

    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: {
        argb: COLORS.header,
      },
    }

    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
    }

    applyThinBorder(cell)
  }
}


function getStatusFill(
  status: GraduationExportStatus,
): string {
  if (status === '이수') {
    return COLORS.lightGreen
  }

  if (status === '대체인정') {
    return COLORS.substitutedGreen
  }

  if (status === '수강중') {
    return COLORS.inProgressBlue
  }

  if (status === '계획중') {
    return COLORS.plannedBlue
  }

  return COLORS.lightRed
}


function applyStatusRowStyle(
  row: ExcelJS.Row,
  status: GraduationExportStatus,
  firstColumn: number,
  lastColumn: number,
) {
  const fillColor =
    getStatusFill(status)

  for (
    let column = firstColumn;
    column <= lastColumn;
    column += 1
  ) {
    const cell =
      row.getCell(column)

    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: {
        argb: fillColor,
      },
    }

    cell.alignment = {
      vertical: 'middle',
    }

    applyThinBorder(cell)
  }
}


function configureWorksheet(
  worksheet: ExcelJS.Worksheet,
  frozenRow: number,
) {
  worksheet.properties.defaultRowHeight =
    20

  worksheet.views = [
    {
      state: 'frozen',
      ySplit: frozenRow,
    },
  ]

  worksheet.pageSetup = {
    orientation: 'landscape',

    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,

    paperSize: 9,

    margins: {
      left: 0.3,
      right: 0.3,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2,
    },
  }
}


function addSheetTitle(
  worksheet: ExcelJS.Worksheet,
  title: string,
  subtitle: string,
  lastColumn: string,
) {
  worksheet.mergeCells(
    `A1:${lastColumn}1`,
  )

  const titleCell =
    worksheet.getCell('A1')

  titleCell.value =
    title

  titleCell.font = {
    size: 18,
    bold: true,
    color: {
      argb: COLORS.white,
    },
  }

  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: {
      argb: COLORS.darkGreen,
    },
  }

  titleCell.alignment = {
    horizontal: 'left',
    vertical: 'middle',
  }

  worksheet.getRow(1).height =
    32

  worksheet.mergeCells(
    `A2:${lastColumn}2`,
  )

  const subtitleCell =
    worksheet.getCell('A2')

  subtitleCell.value =
    subtitle

  subtitleCell.font = {
    size: 10,
    color: {
      argb: COLORS.mutedText,
    },
  }

  subtitleCell.alignment = {
    horizontal: 'left',
    vertical: 'middle',
  }

  worksheet.getRow(2).height =
    22
}


function addStatusValidation(
  worksheet: ExcelJS.Worksheet,
  columnLetter: string,
  firstRow: number,
  lastRow: number,
) {
  for (
    let rowNumber = firstRow;
    rowNumber <= lastRow;
    rowNumber += 1
  ) {
    worksheet.getCell(
      `${columnLetter}${rowNumber}`,
    ).dataValidation = {
      type: 'list',
      allowBlank: false,

      formulae: [
        `"${STATUS_OPTIONS.join(',')}"`,
      ],
    }
  }
}


function getCompletedFormula(
  tableName: string,
  statusColumn: string,
  extraConditions = '',
): string {
  return (
    `=SUMIFS(${tableName}[학점],` +
    `${tableName}[${statusColumn}],"이수"` +
    `${extraConditions})+` +
    `SUMIFS(${tableName}[학점],` +
    `${tableName}[${statusColumn}],"대체인정"` +
    `${extraConditions})`
  )
}


function getScheduledFormula(
  tableName: string,
  statusColumn: string,
  extraConditions = '',
): string {
  return (
    `=SUMIFS(${tableName}[학점],` +
    `${tableName}[${statusColumn}],"수강중"` +
    `${extraConditions})+` +
    `SUMIFS(${tableName}[학점],` +
    `${tableName}[${statusColumn}],"계획중"` +
    `${extraConditions})`
  )
}


function createSummarySheet(
  workbook: ExcelJS.Workbook,
  data: GraduationExportData,
  entryYear: number,
) {
  /*
   * 이 시트를 반드시 가장 먼저 만듭니다.
   *
   * Excel 수식은 아직 생성되지 않은
   * 전공/교양 시트를 참조해도 저장 후
   * 정상적으로 연결됩니다.
   */
  const worksheet =
    workbook.addWorksheet('요약')

  configureWorksheet(
    worksheet,
    4,
  )

  addSheetTitle(
    worksheet,
    '개인 이수 현황',
    `${entryYear}학번 기준`,
    'F',
  )

  worksheet.columns = [
    {
      width: 22,
    },
    {
      width: 14,
    },
    {
      width: 14,
    },
    {
      width: 14,
    },
    {
      width: 14,
    },
    {
      width: 14,
    },
  ]

  const headerRow =
    worksheet.getRow(4)

  headerRow.values = [
    '구분',
    '이수학점',
    '이수 예정',
    '필요학점',
    '남은학점',
    '진척도',
  ]

  applyHeaderStyle(
    headerRow,
    1,
    6,
  )

  const firstSummaryRow =
    5

  const lastSummaryRow =
    firstSummaryRow +
    data.summary.length -
    1

  const firstDetailRow =
    firstSummaryRow + 1

  data.summary.forEach(
    (summaryItem, index) => {
      const rowNumber =
        firstSummaryRow + index

      const row =
        worksheet.getRow(rowNumber)

      row.getCell(1).value =
        summaryItem.title

      /*
       * 졸업요건 기준값은
       * 다운로드 시점의 DB 값을 고정합니다.
       */
      row.getCell(4).value =
        summaryItem.requiredCredits

      /*
       * 총 학점은 아래 카드들의 합계입니다.
       */
      if (
        summaryItem.title ===
        '총 이수학점'
      ) {
        row.getCell(2).value = {
          formula:
            firstDetailRow <=
            lastSummaryRow
              ? (
                `=SUM(B${firstDetailRow}:` +
                `B${lastSummaryRow})`
              )
              : '=0',

          result:
            summaryItem.completedCredits,
        }

        row.getCell(3).value = {
          formula:
            firstDetailRow <=
            lastSummaryRow
              ? (
                `=SUM(C${firstDetailRow}:` +
                `C${lastSummaryRow})`
              )
              : '=0',

          result:
            summaryItem
              .inProgressCredits +
            summaryItem
              .plannedCredits,
        }
      } else if (
        summaryItem.title ===
        '전공필수'
      ) {
        row.getCell(2).value = {
          formula:
            getCompletedFormula(
              'MajorTable',
              '이수 현황',
              ',MajorTable[이수구분],"전필"',
            ),

          result:
            summaryItem.completedCredits,
        }

        row.getCell(3).value = {
          formula:
            getScheduledFormula(
              'MajorTable',
              '이수 현황',
              ',MajorTable[이수구분],"전필"',
            ),

          result:
            summaryItem
              .inProgressCredits +
            summaryItem
              .plannedCredits,
        }
      } else if (
        summaryItem.title ===
        '전공선택'
      ) {
        row.getCell(2).value = {
          formula:
            getCompletedFormula(
              'MajorTable',
              '이수 현황',
              ',MajorTable[이수구분],"전선"',
            ),

          result:
            summaryItem.completedCredits,
        }

        row.getCell(3).value = {
          formula:
            getScheduledFormula(
              'MajorTable',
              '이수 현황',
              ',MajorTable[이수구분],"전선"',
            ),

          result:
            summaryItem
              .inProgressCredits +
            summaryItem
              .plannedCredits,
        }
      } else {
        /*
         * 교양 카드는 해당 구분의
         * 실제 교양 Table을 직접 참조합니다.
         *
         * 따라서 사용자가 로컬 Excel에서
         * 교양 과목 학점이나 상태를 바꾸면
         * 요약 카드도 함께 바뀝니다.
         */
        const categoryCondition =
          `,GeneralEducationTable[구분],` +
          `"${summaryItem.title}"`

        row.getCell(2).value = {
          formula:
            getCompletedFormula(
              'GeneralEducationTable',
              '이수 현황',
              categoryCondition,
            ),

          result:
            summaryItem.completedCredits,
        }

        row.getCell(3).value = {
          formula:
            getScheduledFormula(
              'GeneralEducationTable',
              '이수 현황',
              categoryCondition,
            ),

          result:
            summaryItem
              .inProgressCredits +
            summaryItem
              .plannedCredits,
        }
      }

      /*
       * 남은 학점은 완료 학점만 기준으로
       * 실제 Excel이 계산합니다.
       */
      row.getCell(5).value = {
        formula:
          `=MAX(0,D${rowNumber}-B${rowNumber})`,

        result:
          summaryItem.remainingCredits,
      }

      row.getCell(6).value = {
        formula:
          `=IF(D${rowNumber}=0,1,` +
          `MIN(1,B${rowNumber}/D${rowNumber}))`,

        result:
          summaryItem.requiredCredits === 0
            ? 1
            : Math.min(
                1,
                summaryItem.completedCredits /
                  summaryItem.requiredCredits,
              ),
      }

      row.getCell(6).numFmt =
        '0%'

      row.height =
        24

      for (
        let column = 1;
        column <= 6;
        column += 1
      ) {
        const cell =
          row.getCell(column)

        applyThinBorder(cell)

        cell.alignment = {
          horizontal:
            column === 1
              ? 'left'
              : 'center',

          vertical: 'middle',
        }
      }
    },
  )

  const noteStartRow =
    lastSummaryRow + 3

  worksheet.mergeCells(
    `A${noteStartRow}:F${noteStartRow}`,
  )

  worksheet.getCell(
    `A${noteStartRow}`,
  ).value =
    '※ 이수학점, 이수 예정 학점, 남은 학점은 Excel 수식으로 계산됩니다.'

  worksheet.mergeCells(
    `A${noteStartRow + 1}:` +
    `F${noteStartRow + 1}`,
  )

  worksheet.getCell(
    `A${noteStartRow + 1}`,
  ).value =
    '※ 전공·교양 시트에서 학점 또는 이수 현황을 수정하면 요약 시트에도 반영됩니다.'

  for (
    let rowNumber = noteStartRow;
    rowNumber <= noteStartRow + 1;
    rowNumber += 1
  ) {
    worksheet.getCell(
      `A${rowNumber}`,
    ).font = {
      size: 10,
      color: {
        argb: COLORS.mutedText,
      },
    }
  }
}


function createMajorSheet(
  workbook: ExcelJS.Workbook,
  data: GraduationExportData,
  entryYear: number,
) {
  const worksheet =
    workbook.addWorksheet('전공')

  configureWorksheet(
    worksheet,
    4,
  )

  addSheetTitle(
    worksheet,
    '전공 이수 현황',
    `${entryYear}학번 교육과정 기준`,
    'G',
  )

  worksheet.columns = [
    {
      width: 9,
    },
    {
      width: 9,
    },
    {
      width: 12,
    },
    {
      width: 16,
    },
    {
      width: 30,
    },
    {
      width: 10,
    },
    {
      width: 14,
    },
  ]

  const headerRowNumber =
    4

  const firstDataRow =
    headerRowNumber + 1

  const tableRows =
    data.major.length > 0
      ? data.major.map(
          (item) => [
            item.grade,
            item.semester,
            item.completionType,
            item.courseCode ?? '',
            item.courseName,
            item.credits ?? 0,
            item.status,
          ],
        )
      : [
          [
            '',
            '',
            '',
            '',
            '',
            0,
            '미이수',
          ],
        ]

  worksheet.addTable({
    name: 'MajorTable',

    ref: `A${headerRowNumber}`,

    headerRow: true,
    totalsRow: false,

    style: {
      theme: 'TableStyleMedium2',
      showRowStripes: false,
    },

    columns: [
      {
        name: '학년',
      },
      {
        name: '학기',
      },
      {
        name: '이수구분',
      },
      {
        name: '학정번호',
      },
      {
        name: '과목',
      },
      {
        name: '학점',
      },
      {
        name: '이수 현황',
      },
    ],

    rows:
      tableRows,
  })

  applyHeaderStyle(
    worksheet.getRow(
      headerRowNumber,
    ),
    1,
    7,
  )

  const lastDataRow =
    firstDataRow +
    tableRows.length -
    1

  for (
    let rowNumber = firstDataRow;
    rowNumber <= lastDataRow;
    rowNumber += 1
  ) {
    const row =
      worksheet.getRow(rowNumber)

    row.height =
      22

    const status =
      String(
        row.getCell(7).value ?? '',
      ) as GraduationExportStatus

    if (
      STATUS_OPTIONS.includes(
        status,
      )
    ) {
      applyStatusRowStyle(
        row,
        status,
        1,
        7,
      )
    }

    for (
      const column of [
        1,
        2,
        3,
        4,
        6,
        7,
      ]
    ) {
      row.getCell(
        column,
      ).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      }
    }
  }

  /*
   * 사용자가 Table 아래쪽에 새 행을
   * 직접 추가할 가능성을 고려하여
   * 넉넉한 범위까지 상태 드롭다운을 둡니다.
   */
  addStatusValidation(
    worksheet,
    'G',
    firstDataRow,
    firstDataRow + 500,
  )

  const summaryHeaderRow =
    lastDataRow + 3

  worksheet.getCell(
    `E${summaryHeaderRow}`,
  ).value =
    '구분'

  worksheet.getCell(
    `F${summaryHeaderRow}`,
  ).value =
    '학점'

  worksheet.getCell(
    `G${summaryHeaderRow}`,
  ).value =
    '설명'

  applyHeaderStyle(
    worksheet.getRow(
      summaryHeaderRow,
    ),
    5,
    7,
  )

  const summaryRows = [
    {
      label: '전필 이수',

      formula:
        getCompletedFormula(
          'MajorTable',
          '이수 현황',
          ',MajorTable[이수구분],"전필"',
        ),

      description:
        '이수 + 대체인정',
    },

    {
      label: '전필 이수 예정',

      formula:
        getScheduledFormula(
          'MajorTable',
          '이수 현황',
          ',MajorTable[이수구분],"전필"',
        ),

      description:
        '수강중 + 계획중',
    },

    {
      label: '전선 이수',

      formula:
        getCompletedFormula(
          'MajorTable',
          '이수 현황',
          ',MajorTable[이수구분],"전선"',
        ),

      description:
        '이수 + 대체인정',
    },

    {
      label: '전선 이수 예정',

      formula:
        getScheduledFormula(
          'MajorTable',
          '이수 현황',
          ',MajorTable[이수구분],"전선"',
        ),

      description:
        '수강중 + 계획중',
    },
  ]

  summaryRows.forEach(
    (summaryItem, index) => {
      const rowNumber =
        summaryHeaderRow +
        index +
        1

      worksheet.getCell(
        `E${rowNumber}`,
      ).value =
        summaryItem.label

      worksheet.getCell(
        `F${rowNumber}`,
      ).value = {
        formula:
          summaryItem.formula,

        result: 0,
      }

      worksheet.getCell(
        `G${rowNumber}`,
      ).value =
        summaryItem.description

      worksheet.getCell(
        `F${rowNumber}`,
      ).numFmt =
        '0.0'

      for (
        let column = 5;
        column <= 7;
        column += 1
      ) {
        applyThinBorder(
          worksheet
            .getRow(rowNumber)
            .getCell(column),
        )
      }
    },
  )
}


function createGeneralEducationSheet(
  workbook: ExcelJS.Workbook,
  data: GraduationExportData,
  entryYear: number,
) {
  const worksheet =
    workbook.addWorksheet('교양')

  configureWorksheet(
    worksheet,
    4,
  )

  addSheetTitle(
    worksheet,
    '교양 이수 현황',
    `${entryYear}학번 교양 졸업요건 기준`,
    'H',
  )

  worksheet.columns = [
    {
      width: 9,
    },
    {
      width: 9,
    },
    {
      width: 14,
    },
    {
      width: 24,
    },
    {
      width: 16,
    },
    {
      width: 30,
    },
    {
      width: 10,
    },
    {
      width: 14,
    },
  ]

  const headerRowNumber =
    4

  const firstDataRow =
    headerRowNumber + 1

  const tableRows =
    data.generalEducation.length > 0
      ? data.generalEducation.map(
          (item) => [
            item.grade ?? '',
            item.semester ?? '',
            item.category ?? '',
            item.areaName ?? '',
            item.courseCode ?? '',
            item.courseName,
            item.credits,
            item.status,
          ],
        )
      : [
          [
            '',
            '',
            '',
            '',
            '',
            '',
            0,
            '미이수',
          ],
        ]

  worksheet.addTable({
    name:
      'GeneralEducationTable',

    ref:
      `A${headerRowNumber}`,

    headerRow: true,
    totalsRow: false,

    style: {
      theme: 'TableStyleMedium2',
      showRowStripes: false,
    },

    columns: [
      {
        name: '학년',
      },
      {
        name: '학기',
      },
      {
        name: '구분',
      },
      {
        name: '영역',
      },
      {
        name: '학정번호',
      },
      {
        name: '과목',
      },
      {
        name: '학점',
      },
      {
        name: '이수 현황',
      },
    ],

    rows:
      tableRows,
  })

  applyHeaderStyle(
    worksheet.getRow(
      headerRowNumber,
    ),
    1,
    8,
  )

  const lastDataRow =
    firstDataRow +
    tableRows.length -
    1

  for (
    let rowNumber = firstDataRow;
    rowNumber <= lastDataRow;
    rowNumber += 1
  ) {
    const row =
      worksheet.getRow(rowNumber)

    row.height =
      22

    const status =
      String(
        row.getCell(8).value ?? '',
      ) as GraduationExportStatus

    if (
      STATUS_OPTIONS.includes(
        status,
      )
    ) {
      applyStatusRowStyle(
        row,
        status,
        1,
        8,
      )
    }

    for (
      const column of [
        1,
        2,
        3,
        4,
        5,
        7,
        8,
      ]
    ) {
      row.getCell(
        column,
      ).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      }
    }
  }

  addStatusValidation(
    worksheet,
    'H',
    firstDataRow,
    firstDataRow + 500,
  )

  let nextRow =
    lastDataRow + 3

  /*
   * 과목 목록과 별도로,
   * 우리가 실제로 알고 있는
   * 미충족 영역/영역 수만 표시합니다.
   */
  if (
    data
      .unfulfilledGeneralEducationRequirements
      .length > 0
  ) {
    worksheet.mergeCells(
      `A${nextRow}:H${nextRow}`,
    )

    const titleCell =
      worksheet.getCell(
        `A${nextRow}`,
      )

    titleCell.value =
      '미충족 교양 요건'

    titleCell.font = {
      bold: true,
      color: {
        argb: COLORS.white,
      },
    }

    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: {
        argb: COLORS.darkGreen,
      },
    }

    titleCell.alignment = {
      vertical: 'middle',
    }

    nextRow += 1

    const unmetHeaderRow =
      worksheet.getRow(nextRow)

    unmetHeaderRow.values = [
      '구분',
      '영역 / 요건',
      '현재',
      '필요',
      '단위',
      '상태',
    ]

    applyHeaderStyle(
      unmetHeaderRow,
      1,
      6,
    )

    data
      .unfulfilledGeneralEducationRequirements
      .forEach(
        (requirement) => {
          const row =
            worksheet.addRow([
              requirement.category,
              requirement.requirementName,
              requirement.completedValue,
              requirement.requiredValue,
              requirement.unit,
              requirement.status,
            ])

          applyStatusRowStyle(
            row,
            '미이수',
            1,
            6,
          )
        },
      )

    nextRow =
      (
        worksheet.lastRow?.number ??
        nextRow
      ) + 2
  }

  worksheet.getCell(
    `F${nextRow}`,
  ).value =
    '구분'

  worksheet.getCell(
    `G${nextRow}`,
  ).value =
    '학점'

  worksheet.getCell(
    `H${nextRow}`,
  ).value =
    '설명'

  applyHeaderStyle(
    worksheet.getRow(
      nextRow,
    ),
    6,
    8,
  )

  const summaryRows = [
    {
      label: '교양 이수',

      formula:
        getCompletedFormula(
          'GeneralEducationTable',
          '이수 현황',
        ),

      description:
        '이수 + 대체인정',
    },

    {
      label:
        '교양 이수 예정',

      formula:
        getScheduledFormula(
          'GeneralEducationTable',
          '이수 현황',
        ),

      description:
        '수강중 + 계획중',
    },
  ]

  summaryRows.forEach(
    (summaryItem, index) => {
      const rowNumber =
        nextRow +
        index +
        1

      worksheet.getCell(
        `F${rowNumber}`,
      ).value =
        summaryItem.label

      worksheet.getCell(
        `G${rowNumber}`,
      ).value = {
        formula:
          summaryItem.formula,

        result: 0,
      }

      worksheet.getCell(
        `H${rowNumber}`,
      ).value =
        summaryItem.description

      worksheet.getCell(
        `G${rowNumber}`,
      ).numFmt =
        '0.0'

      for (
        let column = 6;
        column <= 8;
        column += 1
      ) {
        applyThinBorder(
          worksheet
            .getRow(rowNumber)
            .getCell(column),
        )
      }
    },
  )
}


function createDownloadFileName(
  entryYear: number,
): string {
  const now =
    new Date()

  const year =
    now.getFullYear()

  const month =
    String(
      now.getMonth() + 1,
    ).padStart(
      2,
      '0',
    )

  const day =
    String(
      now.getDate(),
    ).padStart(
      2,
      '0',
    )

  return (
    `개인이수현황_` +
    `${entryYear}학번_` +
    `${year}-${month}-${day}.xlsx`
  )
}


export async function exportGraduationWorkbook(
  data: GraduationExportData,
  entryYear: number,
): Promise<void> {
  const workbook =
    new ExcelJS.Workbook()

  workbook.creator =
    '인약'

  workbook.created =
    new Date()

  /*
   * 생성 순서 자체를
   *
   * 요약 → 전공 → 교양
   *
   * 로 둡니다.
   *
   * 따라서 Excel에서 실제로도
   * 요약 탭이 가장 왼쪽에 위치합니다.
   */
  createSummarySheet(
    workbook,
    data,
    entryYear,
  )

  createMajorSheet(
    workbook,
    data,
    entryYear,
  )

  createGeneralEducationSheet(
    workbook,
    data,
    entryYear,
  )

  /*
   * Excel에서 파일을 열었을 때
   * 저장된 cached result가 아니라
   * 실제 수식을 다시 계산하도록 합니다.
   */
  workbook.calcProperties.fullCalcOnLoad =
    true

  const buffer =
    await workbook.xlsx.writeBuffer()

  const blob =
    new Blob(
      [buffer],
      {
        type:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    )

  const objectUrl =
    URL.createObjectURL(
      blob,
    )

  const anchor =
    document.createElement('a')

  anchor.href =
    objectUrl

  anchor.download =
    createDownloadFileName(
      entryYear,
    )

  document.body.appendChild(
    anchor,
  )

  anchor.click()
  anchor.remove()

  URL.revokeObjectURL(
    objectUrl,
  )
}
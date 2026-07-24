/*
 * 시간표에서 사용하는 데이터 구조입니다.
 */

export type Weekday =
  | 'mon'
  | 'tue'
  | 'wed'
  | 'thu'
  | 'fri'

export type CourseColor =
  | 'navy'
  | 'teal'
  | 'blue'
  | 'slate'

export interface TimetableCourse {
  /*
   * 화면에 표시되는 시간표 블록의 고유 ID입니다.
   */
  id: string

  /*
   * DB에 저장된 원본 Lecture의 ID입니다.
   *
   * 같은 강의가 여러 요일 블록으로 나뉘더라도
   * 모두 같은 sourceLectureId를 가집니다.
   */
  sourceLectureId?: number

  /*
   * 검색 결과에 마우스를 올렸을 때 표시되는
   * 임시 미리보기 블록인지 나타냅니다.
   */
  isPreview?: boolean

  /*
   * 다른 수업과 시간이 겹치는 블록인지 나타냅니다.
   *
   * true이면 충돌용 붉은 스타일을 적용합니다.
   */
  isConflicting?: boolean

  code: string
  title: string
  professor: string
  room: string
  credits: number
  day: Weekday
  startMinute: number
  endMinute: number
  color: CourseColor
}

export interface TimetableDay {
  key: Weekday
  label: string
  shortLabel: string
}

export interface TimetableConflict {
  firstCourse: TimetableCourse
  secondCourse: TimetableCourse
}
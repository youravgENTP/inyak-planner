/*
 * 시간표에서 사용하는 데이터가 어떤 모양이어야 하는지
 * TypeScript에 알려주는 파일입니다.
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
   * 시간표 블록 자체의 고유 ID입니다.
   *
   * 한 강의가 월요일과 수요일에 열리면
   * 화면에는 블록이 두 개 만들어지므로,
   * 각 블록마다 서로 다른 ID를 가집니다.
   */
  id: string

  /*
   * DB에 저장된 원본 Lecture의 ID입니다.
   *
   * 같은 강의에서 만들어진 여러 시간표 블록은
   * 모두 같은 sourceLectureId를 가집니다.
   *
   * 편집 화면의 × 버튼으로 이 값을 부모에 전달하면,
   * 해당 강의의 모든 요일 블록을 한꺼번에 삭제할 수 있습니다.
   */
  sourceLectureId?: number

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
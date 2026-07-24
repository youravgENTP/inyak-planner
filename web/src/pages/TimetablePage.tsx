import { useEffect, useMemo, useState } from 'react'

import { TimetableEditorPanel } from '../components/timetable-editor/TimetableEditorPanel'
import { TimetableGrid } from '../components/timetable/TimetableGrid'
import { fetchLectures } from '../domain/lectures/api'
import { lecturesToTimetableCourses } from '../domain/lectures/timetable'
import type { Lecture } from '../domain/lectures/types'
import { getTimetableConflicts } from '../domain/timetable/selectors'

function haveSameLectures(
  firstLectures: Lecture[],
  secondLectures: Lecture[],
): boolean {
  if (firstLectures.length !== secondLectures.length) {
    return false
  }

  const firstIds = firstLectures
    .map((lecture) => lecture.id)
    .sort((firstId, secondId) => firstId - secondId)

  const secondIds = secondLectures
    .map((lecture) => lecture.id)
    .sort((firstId, secondId) => firstId - secondId)

  return firstIds.every(
    (id, index) => id === secondIds[index],
  )
}

export function TimetablePage() {
  const [isEditing, setIsEditing] = useState(false)

  /*
   * API에서 가져온 전체 강의 목록입니다.
   */
  const [lectures, setLectures] =
    useState<Lecture[]>([])

  /*
   * 마지막으로 "수정 완료"를 눌러
   * 저장한 강의 목록입니다.
   */
  const [savedLectures, setSavedLectures] =
    useState<Lecture[]>([])

  /*
   * 현재 편집 화면에서 임시로
   * 수정 중인 강의 목록입니다.
   */
  const [draftLectures, setDraftLectures] =
    useState<Lecture[]>([])

  const [isLoadingLectures, setIsLoadingLectures] =
    useState(true)

  const [lectureLoadError, setLectureLoadError] =
    useState<string | null>(null)

  useEffect(() => {
    async function loadLectures() {
      try {
        setIsLoadingLectures(true)
        setLectureLoadError(null)

        const loadedLectures = await fetchLectures()

        setLectures(loadedLectures)
      } catch (error) {
        if (error instanceof Error) {
          setLectureLoadError(error.message)
        } else {
          setLectureLoadError(
            '강의 목록을 불러오는 중 알 수 없는 오류가 발생했습니다.',
          )
        }
      } finally {
        setIsLoadingLectures(false)
      }
    }

    void loadLectures()
  }, [])

  /*
   * 편집 중에는 임시 강의 목록을,
   * 평상시에는 저장된 강의 목록을 사용합니다.
   */
  const displayedLectures = isEditing
    ? draftLectures
    : savedLectures

  /*
   * Lecture[]를 시간표 블록 데이터로 변환합니다.
   *
   * 한 강의가 여러 요일에 있다면
   * 여러 개의 시간표 블록으로 변환됩니다.
   */
  const displayedCourses = useMemo(
    () =>
      lecturesToTimetableCourses(
        displayedLectures,
      ),
    [displayedLectures],
  )

  const hasUnsavedChanges =
    isEditing &&
    !haveSameLectures(
      savedLectures,
      draftLectures,
    )

  /*
   * 저장하지 않은 변경사항이 있을 때
   * 새로고침이나 탭 닫기를 경고합니다.
   */
  useEffect(() => {
    function handleBeforeUnload(
      event: BeforeUnloadEvent,
    ) {
      if (!hasUnsavedChanges) {
        return
      }

      event.preventDefault()
    }

    window.addEventListener(
      'beforeunload',
      handleBeforeUnload,
    )

    return () => {
      window.removeEventListener(
        'beforeunload',
        handleBeforeUnload,
      )
    }
  }, [hasUnsavedChanges])

  /*
   * 강의 하나가 여러 시간표 블록으로 나뉘어도
   * 학점은 한 번만 합산합니다.
   */
  const creditCount = displayedLectures.reduce(
    (totalCredits, lecture) =>
      totalCredits + (lecture.credits ?? 0),
    0,
  )

  const conflicts =
    getTimetableConflicts(displayedCourses)

  const hasConflicts = conflicts.length > 0

  function handleStartEditing() {
    setDraftLectures([...savedLectures])
    setIsEditing(true)
  }

  function handleResetEditing() {
    if (!hasUnsavedChanges) {
      return
    }

    const shouldReset = window.confirm(
      '지금까지의 변경사항을 초기화하시겠습니까?',
    )

    if (!shouldReset) {
      return
    }

    setDraftLectures([...savedLectures])
  }

  function handleSaveEditing() {
    setSavedLectures([...draftLectures])
    setIsEditing(false)
  }

  function handleAddLecture(lecture: Lecture) {
    setDraftLectures((currentLectures) => {
      const isAlreadyAdded =
        currentLectures.some(
          (currentLecture) =>
            currentLecture.id === lecture.id,
        )

      if (isAlreadyAdded) {
        return currentLectures
      }

      return [...currentLectures, lecture]
    })
  }

  function handleRemoveLecture(
    lectureId: number,
  ) {
    setDraftLectures((currentLectures) =>
      currentLectures.filter(
        (lecture) => lecture.id !== lectureId,
      ),
    )
  }

  return (
    <section className="timetable-page">
      {!isEditing && (
        <div className="page-heading-row">
          <div>
            <span className="page-kicker">
              2026학년도 2학기
            </span>

            <h1>주간 시간표</h1>

            <p>
              수강 과목의 시간과 강의실을
              한눈에 확인합니다.
            </p>
          </div>

          <button
            className="primary-button"
            type="button"
            onClick={handleStartEditing}
          >
            시간표 수정
          </button>
        </div>
      )}

      {!isEditing && (
        <div
          className="summary-grid"
          aria-label="시간표 요약"
        >
          <article className="summary-card">
            <span>등록 과목</span>

            <strong>
              {displayedLectures.length}
            </strong>

            <small>저장된 시간표</small>
          </article>

          <article className="summary-card">
            <span>예상 학점</span>

            <strong>{creditCount}</strong>

            <small>
              선택 과목의 총 학점
            </small>
          </article>

          <article
            className={`summary-card${
              hasConflicts
                ? ''
                : ' summary-card--accent'
            }`}
          >
            <span>시간표 상태</span>

            <strong>
              {hasConflicts
                ? '충돌 있음'
                : '정상'}
            </strong>

            <small>
              {hasConflicts
                ? `${conflicts.length}개의 시간 충돌이 있습니다.`
                : '겹치는 수업 없음'}
            </small>
          </article>
        </div>
      )}

      {!isEditing && (
        <section
          className="panel"
          aria-labelledby="lecture-api-title"
        >
          <div className="panel-header">
            <div>
              <h2 id="lecture-api-title">
                강의 데이터 연결
              </h2>

              <p>
                FastAPI와 SQLite에서 실제 강의
                목록을 불러옵니다.
              </p>
            </div>
          </div>

          {isLoadingLectures && (
            <p>
              강의 목록을 불러오는 중입니다.
            </p>
          )}

          {lectureLoadError && (
            <p role="alert">
              강의 목록을 불러오지 못했습니다:{' '}
              {lectureLoadError}
            </p>
          )}

          {!isLoadingLectures &&
            !lectureLoadError && (
              <p>
                DB에서 강의{' '}
                {lectures.length}개를
                불러왔습니다.
              </p>
            )}
        </section>
      )}

      <div
        className={`timetable-workspace${
          isEditing
            ? ' timetable-workspace--editing'
            : ''
        }`}
      >
        {isEditing && (
          <TimetableEditorPanel
            lectures={lectures}
            selectedLectures={draftLectures}
            onAddLecture={handleAddLecture}
          />
        )}

        <section
          className="panel timetable-panel"
          aria-labelledby="timetable-title"
        >
          <div className="panel-header">
            <div>
              <h2 id="timetable-title">
                내 시간표
              </h2>

              <p>
                월요일부터 금요일,
                09:00–18:00
              </p>
            </div>

            {isEditing && (
              <div className="timetable-edit-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={handleResetEditing}
                  disabled={!hasUnsavedChanges}
                  aria-label="시간표 변경사항 초기화"
                  title="변경사항 초기화"
                >
                  ↻
                </button>

                <button
                  className="primary-button"
                  type="button"
                  onClick={handleSaveEditing}
                >
                  수정 완료
                </button>
              </div>
            )}
          </div>

          <TimetableGrid
            courses={displayedCourses}
            isEditing={isEditing}
            onRemoveLecture={
              handleRemoveLecture
            }
          />
        </section>
      </div>
    </section>
  )
}
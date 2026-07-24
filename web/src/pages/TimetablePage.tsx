import { useEffect, useMemo, useState } from 'react'

import { TimetableEditorPanel } from '../components/timetable-editor/TimetableEditorPanel'
import { TimetableGrid } from '../components/timetable/TimetableGrid'
import { fetchLectures } from '../domain/lectures/api'
import {
  lectureToPreviewCourses,
  lecturesToTimetableCourses,
} from '../domain/lectures/timetable'
import type { Lecture } from '../domain/lectures/types'
import { getTimetableConflicts } from '../domain/timetable/selectors'
import type { TimetableCourse } from '../domain/timetable/types'

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

function doCoursesOverlap(
  firstCourse: TimetableCourse,
  secondCourse: TimetableCourse,
): boolean {
  if (firstCourse.day !== secondCourse.day) {
    return false
  }

  return (
    firstCourse.startMinute <
      secondCourse.endMinute &&
    secondCourse.startMinute <
      firstCourse.endMinute
  )
}

export function TimetablePage() {
  const [isEditing, setIsEditing] = useState(false)

  const [lectures, setLectures] =
    useState<Lecture[]>([])

  const [savedLectures, setSavedLectures] =
    useState<Lecture[]>([])

  const [draftLectures, setDraftLectures] =
    useState<Lecture[]>([])

  const [
    previewLecture,
    setPreviewLecture,
  ] = useState<Lecture | null>(null)

  const [isLoadingLectures, setIsLoadingLectures] =
    useState(true)

  const [lectureLoadError, setLectureLoadError] =
    useState<string | null>(null)

  useEffect(() => {
    async function loadLectures() {
      try {
        setIsLoadingLectures(true)
        setLectureLoadError(null)

        const loadedLectures =
          await fetchLectures()

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

  const displayedLectures = isEditing
    ? draftLectures
    : savedLectures

  const actualCourses = useMemo(
    () =>
      lecturesToTimetableCourses(
        displayedLectures,
      ),
    [displayedLectures],
  )

  const previewCourses = useMemo(() => {
    if (!isEditing || !previewLecture) {
      return []
    }

    return lectureToPreviewCourses(
      previewLecture,
    )
  }, [isEditing, previewLecture])

  const previewConflictState = useMemo(() => {
    const conflictingActualCourseIds =
      new Set<string>()

    const conflictingPreviewCourseIds =
      new Set<string>()

    const conflictingLectureIds =
      new Set<number>()

    previewCourses.forEach((previewCourse) => {
      actualCourses.forEach((actualCourse) => {
        if (
          !doCoursesOverlap(
            previewCourse,
            actualCourse,
          )
        ) {
          return
        }

        conflictingPreviewCourseIds.add(
          previewCourse.id,
        )

        conflictingActualCourseIds.add(
          actualCourse.id,
        )

        if (
          actualCourse.sourceLectureId !== undefined
        ) {
          conflictingLectureIds.add(
            actualCourse.sourceLectureId,
          )
        }
      })
    })

    return {
      conflictingActualCourseIds,
      conflictingPreviewCourseIds,
      conflictingLectureIds,
    }
  }, [actualCourses, previewCourses])

  /*
   * 검색 결과 tooltip과 안내 문구에 사용할
   * 겹치는 기존 과목명 목록입니다.
   *
   * 한 강의가 여러 요일 블록으로 나뉘어 있어도
   * 과목명은 한 번만 표시됩니다.
   */
  const previewConflictCourseTitles =
    useMemo(() => {
      if (!previewLecture) {
        return []
      }

      const titleSet = new Set<string>()

      draftLectures.forEach((lecture) => {
        if (
          previewConflictState
            .conflictingLectureIds
            .has(lecture.id)
        ) {
          titleSet.add(lecture.courseName)
        }
      })

      return [...titleSet]
    }, [
      draftLectures,
      previewLecture,
      previewConflictState,
    ])

  const displayedActualCourses =
    useMemo(
      () =>
        actualCourses.map((course) => ({
          ...course,
          isConflicting:
            previewConflictState
              .conflictingActualCourseIds
              .has(course.id),
        })),
      [
        actualCourses,
        previewConflictState,
      ],
    )

  const displayedPreviewCourses =
    useMemo(
      () =>
        previewCourses.map((course) => ({
          ...course,
          isConflicting:
            previewConflictState
              .conflictingPreviewCourseIds
              .has(course.id),
        })),
      [
        previewCourses,
        previewConflictState,
      ],
    )

  const displayedCourses = useMemo(
    () => [
      ...displayedActualCourses,
      ...displayedPreviewCourses,
    ],
    [
      displayedActualCourses,
      displayedPreviewCourses,
    ],
  )

  const hasUnsavedChanges =
    isEditing &&
    !haveSameLectures(
      savedLectures,
      draftLectures,
    )

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

  const creditCount = displayedLectures.reduce(
    (totalCredits, lecture) =>
      totalCredits + (lecture.credits ?? 0),
    0,
  )

  const conflicts =
    getTimetableConflicts(actualCourses)

  const hasConflicts = conflicts.length > 0

  function handleStartEditing() {
    setDraftLectures([...savedLectures])
    setPreviewLecture(null)
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
    setPreviewLecture(null)
  }

  function handleSaveEditing() {
    setSavedLectures([...draftLectures])
    setPreviewLecture(null)
    setIsEditing(false)
  }

  function handleAddLecture(
    lecture: Lecture,
  ) {
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

    setPreviewLecture(null)
  }

  function handleRemoveLecture(
    lectureId: number,
  ) {
    setDraftLectures((currentLectures) =>
      currentLectures.filter(
        (lecture) => lecture.id !== lectureId,
      ),
    )

    setPreviewLecture((currentPreview) => {
      if (
        currentPreview?.id === lectureId
      ) {
        return null
      }

      return currentPreview
    })
  }

  function handlePreviewLectureChange(
    lecture: Lecture | null,
  ) {
    setPreviewLecture(lecture)
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
            previewLectureId={
              previewLecture?.id ?? null
            }
            previewConflictCourseTitles={
              previewConflictCourseTitles
            }
            onAddLecture={handleAddLecture}
            onPreviewLectureChange={
              handlePreviewLectureChange
            }
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
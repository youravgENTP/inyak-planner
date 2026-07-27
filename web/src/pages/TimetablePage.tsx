import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import TimetableDownloadModal from '../components/timetable-download/TimetableDownloadModal'
import { TimetableEditorPanel } from '../components/timetable-editor/TimetableEditorPanel'
import { TimetableGrid } from '../components/timetable/TimetableGrid'
import { fetchLectures } from '../domain/lectures/api'
import {
  lectureToPreviewCourses,
  lecturesToTimetableCourses,
} from '../domain/lectures/timetable'
import type { Lecture } from '../domain/lectures/types'
import {
  createSavedTimetable,
  getActiveTimetable,
  loadActiveTimetableId,
  loadSavedTimetables,
  replaceTimetable,
  saveActiveTimetableId,
  saveSavedTimetables,
  updateSavedTimetable,
  type SavedTimetable,
} from '../domain/saved-timetables'
import { getTimetableConflicts } from '../domain/timetable/selectors'
import type { TimetableCourse } from '../domain/timetable/types'

interface TimetableCollectionState {
  timetables: SavedTimetable[]
  activeTimetableId: string
}

function createInitialTimetableState():
  TimetableCollectionState {
  const storedTimetables =
    loadSavedTimetables()

  const storedActiveTimetableId =
    loadActiveTimetableId()

  if (storedTimetables.length > 0) {
    const hasStoredActiveTimetable =
      storedActiveTimetableId !== null &&
      storedTimetables.some(
        (timetable) =>
          timetable.id ===
          storedActiveTimetableId,
      )

    return {
      timetables: storedTimetables,
      activeTimetableId:
        hasStoredActiveTimetable
          ? storedActiveTimetableId
          : storedTimetables[0].id,
    }
  }

  const initialTimetable =
    createSavedTimetable({
      name: '내 시간표',
      academicYear: 2026,
      semester: 2,
      lectureIds: [],
    })

  return {
    timetables: [initialTimetable],
    activeTimetableId:
      initialTimetable.id,
  }
}

function haveSameLectureIds(
  firstLectureIds: readonly number[],
  secondLectureIds: readonly number[],
): boolean {
  if (
    firstLectureIds.length !==
    secondLectureIds.length
  ) {
    return false
  }

  const firstIds = [...firstLectureIds].sort(
    (firstId, secondId) =>
      firstId - secondId,
  )

  const secondIds = [
    ...secondLectureIds,
  ].sort(
    (firstId, secondId) =>
      firstId - secondId,
  )

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

function createDownloadFilename(
  timetable: SavedTimetable,
): string {
  const safeName = timetable.name
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')

  return [
    timetable.academicYear,
    timetable.semester,
    safeName || '시간표',
  ].join('-') + '.png'
}

export function TimetablePage() {
  const [isEditing, setIsEditing] =
    useState(false)

  const [
    isDownloadModalOpen,
    setIsDownloadModalOpen,
  ] = useState(false)

  const timetableElementRef =
    useRef<HTMLDivElement>(null)

  const [
    timetableState,
    setTimetableState,
  ] = useState<TimetableCollectionState>(
    createInitialTimetableState,
  )

  const [lectures, setLectures] =
    useState<Lecture[]>([])

  const [
    draftLectureIds,
    setDraftLectureIds,
  ] = useState<number[]>([])

  const [
    previewLecture,
    setPreviewLecture,
  ] = useState<Lecture | null>(null)

  const [
    isLoadingLectures,
    setIsLoadingLectures,
  ] = useState(true)

  const [
    lectureLoadError,
    setLectureLoadError,
  ] = useState<string | null>(null)

  const activeTimetable = useMemo(
    () =>
      getActiveTimetable(
        timetableState.timetables,
        timetableState.activeTimetableId,
      ),
    [
      timetableState.activeTimetableId,
      timetableState.timetables,
    ],
  )

  const lectureMap = useMemo(
    () =>
      new Map(
        lectures.map(
          (lecture) =>
            [lecture.id, lecture] as const,
        ),
      ),
    [lectures],
  )

  const savedLectures = useMemo(() => {
    if (activeTimetable === undefined) {
      return []
    }

    return activeTimetable.lectureIds
      .map((lectureId) =>
        lectureMap.get(lectureId),
      )
      .filter(
        (
          lecture,
        ): lecture is Lecture =>
          lecture !== undefined,
      )
  }, [activeTimetable, lectureMap])

  const draftLectures = useMemo(
    () =>
      draftLectureIds
        .map((lectureId) =>
          lectureMap.get(lectureId),
        )
        .filter(
          (
            lecture,
          ): lecture is Lecture =>
            lecture !== undefined,
        ),
    [draftLectureIds, lectureMap],
  )

  useEffect(() => {
    saveSavedTimetables(
      timetableState.timetables,
    )

    saveActiveTimetableId(
      timetableState.activeTimetableId,
    )
  }, [timetableState])

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

    previewCourses.forEach(
      (previewCourse) => {
        actualCourses.forEach(
          (actualCourse) => {
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
              actualCourse.sourceLectureId !==
              undefined
            ) {
              conflictingLectureIds.add(
                actualCourse.sourceLectureId,
              )
            }
          },
        )
      },
    )

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
    activeTimetable !== undefined &&
    !haveSameLectureIds(
      activeTimetable.lectureIds,
      draftLectureIds,
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

  const creditCount =
    displayedLectures.reduce(
      (totalCredits, lecture) =>
        totalCredits +
        (lecture.credits ?? 0),
      0,
    )

  const conflicts =
    getTimetableConflicts(actualCourses)

  const hasConflicts =
    conflicts.length > 0

  function handleStartEditing() {
    if (activeTimetable === undefined) {
      return
    }

    setDraftLectureIds([
      ...activeTimetable.lectureIds,
    ])

    setPreviewLecture(null)
    setIsDownloadModalOpen(false)
    setIsEditing(true)
  }

  function handleResetEditing() {
    if (
      !hasUnsavedChanges ||
      activeTimetable === undefined
    ) {
      return
    }

    const shouldReset = window.confirm(
      '지금까지의 변경사항을 초기화하시겠습니까?',
    )

    if (!shouldReset) {
      return
    }

    setDraftLectureIds([
      ...activeTimetable.lectureIds,
    ])

    setPreviewLecture(null)
  }

  function handleSaveEditing() {
    if (activeTimetable === undefined) {
      return
    }

    const updatedTimetable =
      updateSavedTimetable(
        activeTimetable,
        {
          lectureIds: draftLectureIds,
        },
      )

    setTimetableState(
      (currentState) => ({
        ...currentState,
        timetables: replaceTimetable(
          currentState.timetables,
          updatedTimetable,
        ),
      }),
    )

    setPreviewLecture(null)
    setIsEditing(false)
  }

  function handleOpenDownloadModal() {
    setIsDownloadModalOpen(true)
  }

  function handleCloseDownloadModal() {
    setIsDownloadModalOpen(false)
  }

  function handleAddLecture(
    lecture: Lecture,
  ) {
    setDraftLectureIds(
      (currentLectureIds) => {
        if (
          currentLectureIds.includes(
            lecture.id,
          )
        ) {
          return currentLectureIds
        }

        return [
          ...currentLectureIds,
          lecture.id,
        ]
      },
    )

    setPreviewLecture(null)
  }

  function handleRemoveLecture(
    lectureId: number,
  ) {
    setDraftLectureIds(
      (currentLectureIds) =>
        currentLectureIds.filter(
          (currentLectureId) =>
            currentLectureId !== lectureId,
        ),
    )

    setPreviewLecture(
      (currentPreview) => {
        if (
          currentPreview?.id ===
          lectureId
        ) {
          return null
        }

        return currentPreview
      },
    )
  }

  function handlePreviewLectureChange(
    lecture: Lecture | null,
  ) {
    setPreviewLecture(lecture)
  }

  if (activeTimetable === undefined) {
    return (
      <section className="timetable-page">
        <p role="alert">
          현재 시간표를 불러오지 못했습니다.
        </p>
      </section>
    )
  }

  return (
    <section className="timetable-page">
      {!isEditing && (
        <div className="page-heading-row">
          <div>
            <span className="page-kicker">
              {activeTimetable.academicYear}
              학년도{' '}
              {activeTimetable.semester}학기
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
                {activeTimetable.name}
              </h2>

              <p>
                월요일부터 금요일,
                09:00–18:00
              </p>
            </div>

            {!isEditing && (
              <button
                className="secondary-button"
                type="button"
                onClick={
                  handleOpenDownloadModal
                }
              >
                시간표 다운로드
              </button>
            )}

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
            timetableRef={
              timetableElementRef
            }
            onRemoveLecture={
              handleRemoveLecture
            }
          />
        </section>
      </div>

      <TimetableDownloadModal
        isOpen={isDownloadModalOpen}
        timetableElement={
          timetableElementRef.current
        }
        filename={createDownloadFilename(
          activeTimetable,
        )}
        onClose={handleCloseDownloadModal}
      />
    </section>
  )
}
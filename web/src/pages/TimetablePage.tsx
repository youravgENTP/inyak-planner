import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { CreateTimetableModal } from '../components/saved-timetables/CreateTimetableModal'
import { SavedTimetablesModal } from '../components/saved-timetables/SavedTimetablesModal'
import { RenameTimetableModal } from '../components/saved-timetables/RenameTimetableModal'
import { TimetableComparisonPage } from '../components/saved-timetables/TimetableComparisonPage'
import TimetableDownloadModal from '../components/timetable-download/TimetableDownloadModal'
import { TimetableEditorPanel } from '../components/timetable-editor/TimetableEditorPanel'
import { TimetableGrid } from '../components/timetable/TimetableGrid'
import { 
  downloadSyllabiZip,
  fetchLectures,
} from '../domain/lectures/api'
import {
  lectureToPreviewCourses,
  lecturesToTimetableCourses,
} from '../domain/lectures/timetable'
import type { Lecture } from '../domain/lectures/types'
import {
  createDefaultTimetableName,
  createSavedTimetable,
  duplicateTimetable,
  getActiveTimetable,
  getValidComparisonTimetableIds,
  loadActiveTimetableId,
  loadSavedTimetables,
  replaceTimetable,
  removeTimetable,
  saveActiveTimetableId,
  saveSavedTimetables,
  updateSavedTimetable,
  type AcademicSemester,
  type CreateTimetableValues,
  type SavedTimetable,
} from '../domain/saved-timetables'
import type { TimetableCourse } from '../domain/timetable/types'
import '../components/saved-timetables/SavedTimetablesModal.css'

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

  const firstIds = [
    ...firstLectureIds,
  ].sort(
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

  return (
    [
      timetable.academicYear,
      timetable.semester,
      safeName || '시간표',
    ].join('-') + '.png'
  )
}

interface TimetablePageProps {
  requestedActiveTimetableId:
    string | null

  onTimetableStateChange: (
    timetables: readonly SavedTimetable[],
    activeTimetableId: string,
  ) => void
}

export function TimetablePage({
  requestedActiveTimetableId,
  onTimetableStateChange,
}: TimetablePageProps) {
  const [isEditing, setIsEditing] =
    useState(false)

  const [
    isDownloadModalOpen,
    setIsDownloadModalOpen,
  ] = useState(false)

  const [
    isSavedTimetablesModalOpen,
    setIsSavedTimetablesModalOpen,
  ] = useState(false)

  const [
    isRenameTimetableModalOpen,
    setIsRenameTimetableModalOpen,
  ] = useState(false)

  const [
    renamingTimetableId,
    setRenamingTimetableId,
  ] = useState<string | null>(null)

  const [
    openTimetableMenuId,
    setOpenTimetableMenuId,
  ] = useState<string | null>(null)

  const [
    isCreateTimetableModalOpen,
    setIsCreateTimetableModalOpen,
  ] = useState(false)

  const [
    isComparisonPageOpen,
    setIsComparisonPageOpen,
  ] = useState(false)

  const [
    comparisonTimetableIds,
    setComparisonTimetableIds,
  ] = useState<string[]>([])

  const timetableElementRef =
    useRef<HTMLDivElement>(null)

  const [
    timetableState,
    setTimetableState,
  ] = useState<TimetableCollectionState>(
    createInitialTimetableState,
  )

  const [
    selectedTimetableYear,
    setSelectedTimetableYear,
  ] = useState<number | null>(null)

  const [
    selectedTimetableSemester,
    setSelectedTimetableSemester,
  ] = useState<
    AcademicSemester | null
  >(null)

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

  const [
    isDownloadingSyllabi,
    setIsDownloadingSyllabi,
  ] = useState(false)

  const [
    syllabiDownloadError,
    setSyllabiDownloadError,
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

  const renamingTimetable =
    useMemo(
      () => {
        if (
          renamingTimetableId === null
        ) {
          return activeTimetable
        }

        return (
          timetableState.timetables.find(
            (timetable) =>
              timetable.id ===
              renamingTimetableId,
          ) ?? activeTimetable
        )
      },
      [
        activeTimetable,
        renamingTimetableId,
        timetableState.timetables,
      ],
    )

  const timetableBrowserYear =
    selectedTimetableYear ??
    activeTimetable?.academicYear ??
    2026

  const timetableBrowserSemester =
    selectedTimetableSemester ??
    activeTimetable?.semester ??
    1

  const timetableBrowserYears =
    useMemo(
      () =>
        [
          ...new Set([
            ...timetableState.timetables.map(
              (timetable) =>
                timetable.academicYear,
            ),

            ...lectures
              .filter(
                (lecture) =>
                  lecture.semester === 1 ||
                  lecture.semester === 2,
              )
              .map(
                (lecture) =>
                  lecture.academicYear,
              ),
          ]),
        ].sort(
          (firstYear, secondYear) =>
            secondYear - firstYear,
        ),
      [
        lectures,
        timetableState.timetables,
      ],
    )

  const filteredSavedTimetables =
    useMemo(
      () =>
        timetableState.timetables.filter(
          (timetable) =>
            timetable.academicYear ===
              timetableBrowserYear &&
            timetable.semester ===
              timetableBrowserSemester,
        ),
      [
        timetableBrowserSemester,
        timetableBrowserYear,
        timetableState.timetables,
      ],
    )

  useEffect(() => {
    if (activeTimetable === undefined) {
      return
    }

    setSelectedTimetableYear(
      activeTimetable.academicYear,
    )

    setSelectedTimetableSemester(
      activeTimetable.semester,
    )
  }, [activeTimetable])

  /*
   * 새 시간표 생성 시 사용할 학기 목록입니다.
   *
   * 코드에 연도와 학기를 하드코딩하지 않고,
   * inyak.db에서 실제로 불러온 lecture들의
   * academicYear + semester 조합만 사용합니다.
   */
  const availableTimetableSemesters =
    useMemo(() => {
      const semesterMap =
        new Map<
          string,
          {
            academicYear: number
            semester: AcademicSemester
          }
        >()

      lectures.forEach((lecture) => {
        if (
          lecture.semester !== 1 &&
          lecture.semester !== 2
        ) {
          return
        }

        const semester =
          lecture.semester as
            AcademicSemester

        const key =
          `${lecture.academicYear}-` +
          semester

        semesterMap.set(key, {
          academicYear:
            lecture.academicYear,
          semester,
        })
      })

      return [
        ...semesterMap.values(),
      ].sort(
        (firstSemester, secondSemester) =>
          (
            secondSemester.academicYear -
            firstSemester.academicYear
          ) ||
          (
            secondSemester.semester -
            firstSemester.semester
          ),
      )
    }, [lectures])

  /*
   * 전체 lectures는 저장된 과거 시간표의
   * 렌더링, 미리보기, 비교에 계속 사용합니다.
   *
   * 시간표 편집기에서만 현재 시간표의
   * 학년도 + 학기에 해당하는 강의로
   * 범위를 제한합니다.
   */
  const editableLectures = useMemo(() => {
    if (activeTimetable === undefined) {
      return []
    }

    return lectures.filter(
      (lecture) =>
        lecture.academicYear ===
          activeTimetable.academicYear &&
        lecture.semester ===
          activeTimetable.semester,
    )
  }, [
    activeTimetable,
    lectures,
  ])

  const comparisonTimetables = useMemo(
  () =>
    comparisonTimetableIds
      .map((timetableId) =>
        timetableState.timetables.find(
          (timetable) =>
            timetable.id === timetableId,
        ),
      )
      .filter(
        (
          timetable,
        ): timetable is SavedTimetable =>
          timetable !== undefined,
      ),
  [
    comparisonTimetableIds,
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
    if (
      requestedActiveTimetableId ===
        null ||
      requestedActiveTimetableId ===
        timetableState.activeTimetableId ||
      !timetableState.timetables.some(
        (timetable) =>
          timetable.id ===
          requestedActiveTimetableId,
      )
    ) {
      return
    }

    setTimetableState(
      (currentState) => ({
        ...currentState,

        activeTimetableId:
          requestedActiveTimetableId,
      }),
    )

    setDraftLectureIds([])
    setPreviewLecture(null)
    setOpenTimetableMenuId(null)

    setIsEditing(false)
    setIsDownloadModalOpen(false)
    setIsSavedTimetablesModalOpen(false)
  }, [
    requestedActiveTimetableId,
    timetableState.activeTimetableId,
    timetableState.timetables,
  ])

  useEffect(() => {
    saveSavedTimetables(
      timetableState.timetables,
    )

    saveActiveTimetableId(
      timetableState.activeTimetableId,
    )

    onTimetableStateChange(
      timetableState.timetables,
      timetableState.activeTimetableId,
    )
  }, [
    onTimetableStateChange,
    timetableState,
  ])

  useEffect(() => {
    setComparisonTimetableIds(
      (currentTimetableIds) =>
        getValidComparisonTimetableIds(
          timetableState.timetables,
          currentTimetableIds,
        ),
    )
  }, [timetableState.timetables])

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

  const unscheduledLectures = useMemo(() => {
    const scheduledLectureIds =
      new Set(
        actualCourses
          .map(
            (course) =>
              course.sourceLectureId,
          )
          .filter(
            (
              lectureId,
            ): lectureId is number =>
              lectureId !== undefined,
          ),
      )

    return displayedLectures.filter(
      (lecture) =>
        !scheduledLectureIds.has(
          lecture.id,
        ),
    )
  }, [actualCourses, displayedLectures])

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

  const timetableCategorySummary =
    useMemo(() => {
      const summary = {
        required: {
          count: 0,
          credits: 0,
        },

        elective: {
          count: 0,
          credits: 0,
        },

        generalEducation: {
          count: 0,
          credits: 0,
        },
      }

      displayedLectures.forEach(
        (lecture) => {
          const completionType =
            lecture.completionType
              ?.trim() ?? ''

          const normalizedType =
            completionType.toUpperCase()

          const credits =
            lecture.credits ?? 0

          if (
            completionType === '전필' ||
            normalizedType === 'ME'
          ) {
            summary.required.count += 1
            summary.required.credits +=
              credits

            return
          }

          if (
            completionType === '전선' ||
            normalizedType === 'MR'
          ) {
            summary.elective.count += 1
            summary.elective.credits +=
              credits

            return
          }

          if (
            completionType === '교양'
          ) {
            summary
              .generalEducation
              .count += 1

            summary
              .generalEducation
              .credits += credits
          }
        },
      )

      return summary
    }, [displayedLectures])

  function handleStartEditing() {
    if (activeTimetable === undefined) {
      return
    }

    setDraftLectureIds([
      ...activeTimetable.lectureIds,
    ])

    setPreviewLecture(null)
    setIsDownloadModalOpen(false)
    setIsSavedTimetablesModalOpen(false)
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
    setIsSavedTimetablesModalOpen(false)
    setIsDownloadModalOpen(true)
  }

  function handleCloseDownloadModal() {
    setIsDownloadModalOpen(false)
  }

  function handleOpenSavedTimetablesModal() {
    setIsComparisonPageOpen(false)
    setIsDownloadModalOpen(false)
    setIsSavedTimetablesModalOpen(true)
  }

  function handleCloseSavedTimetablesModal() {
    setIsSavedTimetablesModalOpen(false)
  }

  function handleOpenRenameTimetableModal() {
    if (activeTimetable === undefined) {
      return
    }

    setRenamingTimetableId(
      activeTimetable.id,
    )

    setIsDownloadModalOpen(false)
    setIsSavedTimetablesModalOpen(false)
    setIsRenameTimetableModalOpen(true)
  }

  function handleOpenRenameTimetable(
    timetableId: string,
  ) {
    setRenamingTimetableId(
      timetableId,
    )

    setOpenTimetableMenuId(null)
    setIsDownloadModalOpen(false)
    setIsSavedTimetablesModalOpen(false)
    setIsRenameTimetableModalOpen(true)
  }

  function handleCloseRenameTimetableModal() {
    setIsRenameTimetableModalOpen(false)
    setRenamingTimetableId(null)
  }

  function handleRenameTimetable(
    name: string,
  ) {
    if (renamingTimetable === undefined) {
      return
    }

    const renamedTimetable =
      updateSavedTimetable(
        renamingTimetable,
        {
          name,
        },
      )

    setTimetableState(
      (currentState) => ({
        ...currentState,

        timetables: replaceTimetable(
          currentState.timetables,
          renamedTimetable,
        ),
      }),
    )

    setIsRenameTimetableModalOpen(false)
    setRenamingTimetableId(null)
  }
  
  function handleSelectTimetable(
    timetableId: string,
  ) {
    if (
      timetableId ===
      timetableState.activeTimetableId
    ) {
      setIsSavedTimetablesModalOpen(false)

      return
    }

    if (hasUnsavedChanges) {
      const shouldDiscardChanges =
        window.confirm(
          '저장하지 않은 변경사항이 있습니다. 다른 시간표로 이동하시겠습니까?',
        )

      if (!shouldDiscardChanges) {
        return
      }
    }

    setTimetableState(
      (currentState) => ({
        ...currentState,
        activeTimetableId: timetableId,
      }),
    )

    setDraftLectureIds([])
    setPreviewLecture(null)
    setIsEditing(false)
    setIsDownloadModalOpen(false)
    setIsSavedTimetablesModalOpen(false)
  }

  function handleComparisonTimetableIdsChange(
    timetableIds: string[],
  ) {
    setComparisonTimetableIds(
      getValidComparisonTimetableIds(
        timetableState.timetables,
        timetableIds,
      ),
    )
  }

  function handleOpenCreateTimetableModal() {
    setIsSavedTimetablesModalOpen(false)
    setIsDownloadModalOpen(false)

    setIsCreateTimetableModalOpen(true)
  }

  function handleCreateTimetable(
    values: CreateTimetableValues,
  ) {
    const newTimetable =
      createSavedTimetable(values)

    setTimetableState(
      (currentState) => ({
        timetables: [
          ...currentState.timetables,
          newTimetable,
        ],
        activeTimetableId:
          newTimetable.id,
      }),
    )

    setDraftLectureIds([])
    setPreviewLecture(null)

    setIsCreateTimetableModalOpen(false)
    setIsDownloadModalOpen(false)
    setIsSavedTimetablesModalOpen(false)

    /*
     * 새 빈 시간표를 만들면 바로
     * 과목을 추가할 수 있도록
     * 편집 모드로 진입합니다.
     */
    setIsEditing(true)
  }

  function handleDuplicateTimetable(
    timetableId: string,
  ) {
    const timetableToDuplicate =
      timetableState.timetables.find(
        (timetable) =>
          timetable.id === timetableId,
      )

    if (
      timetableToDuplicate === undefined
    ) {
      return
    }

    const duplicatedTimetable =
      duplicateTimetable(
        timetableToDuplicate,
        timetableState.timetables,
      )

    setTimetableState(
      (currentState) => ({
        timetables: [
          ...currentState.timetables,
          duplicatedTimetable,
        ],

        activeTimetableId:
          duplicatedTimetable.id,
      }),
    )

    setSelectedTimetableYear(
      duplicatedTimetable.academicYear,
    )

    setSelectedTimetableSemester(
      duplicatedTimetable.semester,
    )

    setOpenTimetableMenuId(null)
    setDraftLectureIds([])
    setPreviewLecture(null)
    setIsEditing(false)
    setIsDownloadModalOpen(false)
    setIsSavedTimetablesModalOpen(false)
  }

  function handleDuplicateActiveTimetable() {
    if (activeTimetable === undefined) {
      return
    }

    handleDuplicateTimetable(
      activeTimetable.id,
    )
  }

function handleCompareTimetables(
  timetableIds: readonly string[],
) {
  const validTimetableIds =
    getValidComparisonTimetableIds(
      timetableState.timetables,
      timetableIds,
    )

  if (validTimetableIds.length < 2) {
    return
  }

  setComparisonTimetableIds(
    validTimetableIds,
  )

  setIsSavedTimetablesModalOpen(false)
  setIsDownloadModalOpen(false)
  setIsEditing(false)
  setPreviewLecture(null)
  setIsComparisonPageOpen(true)
}

function handleDeleteTimetable(
  timetableId: string,
) {
  if (
    timetableState.timetables.length <= 1
  ) {
    return
  }

  const timetableToDelete =
    timetableState.timetables.find(
      (timetable) =>
        timetable.id === timetableId,
    )

  if (timetableToDelete === undefined) {
    return
  }

  const shouldDelete = window.confirm(
    `'${timetableToDelete.name}' 시간표를 삭제하시겠습니까?`,
  )

  if (!shouldDelete) {
    return
  }

  const isDeletingActiveTimetable =
    timetableId ===
    timetableState.activeTimetableId

  setTimetableState((currentState) => {
    const deletedTimetableIndex =
      currentState.timetables.findIndex(
        (timetable) =>
          timetable.id === timetableId,
      )

    if (deletedTimetableIndex < 0) {
      return currentState
    }

    const remainingTimetables =
      removeTimetable(
        currentState.timetables,
        timetableId,
      )

    if (remainingTimetables.length === 0) {
      return currentState
    }

    const nextActiveTimetableId =
      currentState.activeTimetableId ===
      timetableId
        ? remainingTimetables[
            Math.min(
              deletedTimetableIndex,
              remainingTimetables.length - 1,
            )
          ].id
        : currentState.activeTimetableId

    return {
      timetables: remainingTimetables,
      activeTimetableId:
        nextActiveTimetableId,
    }
  })

  setComparisonTimetableIds(
    (currentTimetableIds) =>
      currentTimetableIds.filter(
        (currentTimetableId) =>
          currentTimetableId !==
          timetableId,
      ),
  )

  if (isDeletingActiveTimetable) {
    setDraftLectureIds([])
    setPreviewLecture(null)
    setIsEditing(false)
    setIsDownloadModalOpen(false)
    setIsRenameTimetableModalOpen(false)
  }
}

function handleCloseComparisonPage() {
  setIsComparisonPageOpen(false)
}

async function handleDownloadSyllabi() {
  if (
    activeTimetable === undefined ||
    savedLectures.length === 0 ||
    isDownloadingSyllabi
  ) {
    return
  }

  setSyllabiDownloadError(null)
  setIsDownloadingSyllabi(true)

  try {
    const { blob, filename } =
      await downloadSyllabiZip(
        activeTimetable.lectureIds,
        activeTimetable.name,
      )

    const downloadUrl =
      URL.createObjectURL(blob)

    const downloadLink =
      document.createElement('a')

    downloadLink.href = downloadUrl
    downloadLink.download = filename

    document.body.appendChild(
      downloadLink,
    )

    downloadLink.click()
    downloadLink.remove()

    URL.revokeObjectURL(
      downloadUrl,
    )
  } catch (error) {
    setSyllabiDownloadError(
      error instanceof Error
        ? error.message
        : '강의계획서를 다운로드하지 못했습니다.',
    )
  } finally {
    setIsDownloadingSyllabi(false)
  }
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

  if (
    isComparisonPageOpen &&
    comparisonTimetables.length >= 2
  ) {
    return (
      <TimetableComparisonPage
        timetables={comparisonTimetables}
        lectures={lectures}
        onBack={handleCloseComparisonPage}
      />
    )
  }

  return (
        <section className="timetable-page">
      {!isEditing && (
        <div className="timetable-page-context">
          {activeTimetable.academicYear}
          학년도{' '}
          {activeTimetable.semester}학기
        </div>
      )}

      {lectureLoadError && (
        <p
          className="page-error-message"
          role="alert"
        >
          강의 목록을 불러오지 못했습니다:{' '}
          {lectureLoadError}
        </p>
      )}

      {syllabiDownloadError && (
        <p
          className="page-error-message"
          role="alert"
        >
          {syllabiDownloadError}
        </p>
      )}

      <div
        className={`timetable-workspace${
          isEditing
            ? ' timetable-workspace--editing'
            : ''
        }`}
      >
        {!isEditing && (
          <aside
            className="
              panel
              timetable-browser-panel
            "
            aria-label="시간표 선택"
          >
            <div className="timetable-browser-summary">
              <div className="timetable-browser-summary-main">
                <span>
                  등록 과목 / 학점
                </span>

                <strong>
                  {displayedLectures.length}개
                  {' / '}
                  {creditCount}학점
                </strong>
              </div>

              <dl className="timetable-browser-summary-breakdown">
                <div>
                  <dt>전필</dt>

                  <dd>
                    {
                      timetableCategorySummary
                        .required.count
                    }
                    개
                    {' / '}
                    {
                      timetableCategorySummary
                        .required.credits
                    }
                    학점
                  </dd>
                </div>

                <div>
                  <dt>전선</dt>

                  <dd>
                    {
                      timetableCategorySummary
                        .elective.count
                    }
                    개
                    {' / '}
                    {
                      timetableCategorySummary
                        .elective.credits
                    }
                    학점
                  </dd>
                </div>

                <div>
                  <dt>교양</dt>

                  <dd>
                    {
                      timetableCategorySummary
                        .generalEducation.count
                    }
                    개
                    {' / '}
                    {
                      timetableCategorySummary
                        .generalEducation.credits
                    }
                    학점
                  </dd>
                </div>
              </dl>
            </div>

            <div className="timetable-browser-controls">
              <label>
                <span>학년도</span>

                <select
                  value={
                    timetableBrowserYear
                  }
                  onChange={(event) => {
                    setSelectedTimetableYear(
                      Number(
                        event.target.value,
                      ),
                    )
                  }}
                >
                  {timetableBrowserYears.map(
                    (academicYear) => (
                      <option
                        key={academicYear}
                        value={academicYear}
                      >
                        {academicYear}학년도
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>학기</span>

                <select
                  value={
                    timetableBrowserSemester
                  }
                  onChange={(event) => {
                    setSelectedTimetableSemester(
                      Number(
                        event.target.value,
                      ) as AcademicSemester,
                    )
                  }}
                >
                  <option value={1}>
                    1학기
                  </option>

                  <option value={2}>
                    2학기
                  </option>
                </select>
              </label>
            </div>

            <div className="timetable-browser-list-header">
              <div>
                <span>
                  {timetableBrowserYear}-
                  {timetableBrowserSemester}
                </span>

                <strong>
                  저장된 시간표
                </strong>
              </div>

              <button
                type="button"
                onClick={
                  handleOpenCreateTimetableModal
                }
              >
                + 새 시간표
              </button>
            </div>

            {filteredSavedTimetables.length ===
            0 ? (
              <p className="timetable-browser-empty">
                이 학기에 저장된 시간표가
                없습니다.
              </p>
            ) : (
              <div className="timetable-browser-list">
                {filteredSavedTimetables.map(
                  (timetable) => {
                    const timetableLectures =
                      timetable.lectureIds
                        .map((lectureId) =>
                          lectureMap.get(
                            lectureId,
                          ),
                        )
                        .filter(
                          (
                            lecture,
                          ): lecture is Lecture =>
                            lecture !==
                            undefined,
                        )

                    const timetableCredits =
                      timetableLectures.reduce(
                        (
                          totalCredits,
                          lecture,
                        ) =>
                          totalCredits +
                          (
                            lecture.credits ??
                            0
                          ),
                        0,
                      )

                    const timetableIsActive =
                      timetable.id ===
                      activeTimetable.id

                    return (
                      <article
                        key={timetable.id}
                        className={
                          `timetable-browser-item` +
                          (
                            timetableIsActive
                              ? ' timetable-browser-item--active'
                              : ''
                          )
                        }
                      >
                        <button
                          className="timetable-browser-item-main"
                          type="button"
                          onClick={() => {
                            setOpenTimetableMenuId(
                              null,
                            )

                            handleSelectTimetable(
                              timetable.id,
                            )
                          }}
                        >
                          <strong>
                            {timetable.name}
                          </strong>

                          <span>
                            {
                              timetableLectures
                                .length
                            }
                            과목
                            {' · '}
                            {timetableCredits}
                            학점
                          </span>
                        </button>

                        <div className="timetable-browser-item-menu">
                          <button
                            aria-expanded={
                              openTimetableMenuId ===
                              timetable.id
                            }
                            aria-haspopup="menu"
                            aria-label={
                              `${timetable.name} 관리 메뉴`
                            }
                            className="timetable-browser-item-menu-trigger"
                            type="button"
                            onClick={() => {
                              setOpenTimetableMenuId(
                                (
                                  currentTimetableId,
                                ) =>
                                  currentTimetableId ===
                                  timetable.id
                                    ? null
                                    : timetable.id,
                              )
                            }}
                          >
                            ⋯
                          </button>

                          {openTimetableMenuId ===
                          timetable.id ? (
                            <div
                              className="timetable-browser-item-menu-popover"
                              role="menu"
                            >
                              <button
                                role="menuitem"
                                type="button"
                                onClick={() => {
                                  handleOpenRenameTimetable(
                                    timetable.id,
                                  )
                                }}
                              >
                                이름 변경
                              </button>

                              <button
                                role="menuitem"
                                type="button"
                                onClick={() => {
                                  handleDuplicateTimetable(
                                    timetable.id,
                                  )
                                }}
                              >
                                복제
                              </button>

                              <button
                                className="timetable-browser-item-menu-delete"
                                role="menuitem"
                                type="button"
                                disabled={
                                  timetableState
                                    .timetables
                                    .length <= 1
                                }
                                onClick={() => {
                                  setOpenTimetableMenuId(
                                    null,
                                  )

                                  handleDeleteTimetable(
                                    timetable.id,
                                  )
                                }}
                              >
                                삭제
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </article>
                    )
                  },
                )}
              </div>
            )}

            <button
              className="timetable-browser-manage"
              type="button"
              onClick={
                handleOpenSavedTimetablesModal
              }
            >
              전체 시간표 관리
            </button>
          </aside>
        )}

        {isEditing && (
          <TimetableEditorPanel
            lectures={editableLectures}
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
                <button
                  className="timetable-title-button"
                  type="button"
                  onClick={
                    handleOpenRenameTimetableModal
                  }
                  aria-label={`${activeTimetable.name} 시간표 이름 변경`}
                  title="시간표 이름 변경"
                >
                  <span>
                    {activeTimetable.name}
                  </span>

                  <span
                    className="timetable-title-button__icon"
                    aria-hidden="true"
                  >
                    ✎
                  </span>
                </button>
              </h2>

              <p>
                월요일부터 금요일,
                09:00–18:00
              </p>
            </div>

            {!isEditing && (
              <div className="timetable-view-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={handleStartEditing}
                  disabled={
                    isLoadingLectures ||
                    lectureLoadError !== null
                  }
                >
                  시간표 수정
                </button>

                <button
                  className="secondary-button"
                  type="button"
                  onClick={
                    handleDownloadSyllabi
                  }
                  disabled={
                    savedLectures.length === 0 ||
                    isDownloadingSyllabi
                  }
                >
                  {isDownloadingSyllabi
                    ? '다운로드 준비 중…'
                    : '강의계획서 다운로드'}
                </button>

                <button
                  className="secondary-button"
                  type="button"
                  onClick={
                    handleOpenDownloadModal
                  }
                >
                  시간표 다운로드
                </button>
              </div>
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
          {unscheduledLectures.length > 0 && (
            <section
              className="unscheduled-lectures"
              aria-labelledby="unscheduled-lectures-title"
            >
              <div className="unscheduled-lectures__list">
                {unscheduledLectures.map(
                  (lecture) => (
                    <article
                      className="unscheduled-lecture"
                      key={lecture.id}
                    >
                      <div className="unscheduled-lecture__info">
                        <strong>
                          {lecture.courseName}
                        </strong>

                        {lecture.professor && (
                          <span>
                            {lecture.professor}
                          </span>
                        )}
                      </div>

                      {isEditing && (
                        <button
                          className="unscheduled-lecture__remove"
                          type="button"
                          onClick={() =>
                            handleRemoveLecture(
                              lecture.id,
                            )
                          }
                          aria-label={`${lecture.courseName} 시간표에서 삭제`}
                          title="시간표에서 삭제"
                        >
                          ×
                        </button>
                      )}
                    </article>
                  ),
                )}
              </div>
            </section>
          )}

        </section>
      </div>

      <SavedTimetablesModal
        isOpen={
          isSavedTimetablesModalOpen
        }
        timetables={
          timetableState.timetables
        }
        lectures={lectures}
        activeTimetableId={
          timetableState.activeTimetableId
        }
        comparisonTimetableIds={
          comparisonTimetableIds
        }
        onClose={
          handleCloseSavedTimetablesModal
        }
        onSelectTimetable={
          handleSelectTimetable
        }
        onComparisonTimetableIdsChange={
          handleComparisonTimetableIdsChange
        }
        onCreateTimetable={
          handleOpenCreateTimetableModal
        }
        onDuplicateActiveTimetable={
          handleDuplicateActiveTimetable
        }
        onDeleteTimetable={
          handleDeleteTimetable
        }
        onCompare={
          handleCompareTimetables
        }
      />
      <CreateTimetableModal
        isOpen={
          isCreateTimetableModalOpen
        }
        defaultName={
          createDefaultTimetableName(
            timetableState.timetables,
          )
        }
        semesterOptions={
          availableTimetableSemesters
        }
        initialAcademicYear={
          timetableBrowserYear
        }
        initialSemester={
          timetableBrowserSemester
        }
        onClose={() => {
          setIsCreateTimetableModalOpen(
            false,
          )
        }}
        onCreate={
          handleCreateTimetable
        }
      />

      <RenameTimetableModal
        isOpen={
          isRenameTimetableModalOpen
        }
        currentName={
          renamingTimetable?.name ??
          activeTimetable.name
        }
        onClose={
          handleCloseRenameTimetableModal
        }
        onSave={
          handleRenameTimetable
        }
      />

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
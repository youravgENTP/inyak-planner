import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  GraduationSemesterBoard,
} from '../components/GraduationSemesterBoard/GraduationSemesterBoard'

import type {
  AuthUser,
} from '../domain/auth/api'
import {
  getCourseRecords,
} from '../domain/course-records/api'
import type {
  CourseRecord,
} from '../domain/course-records/types'
import {
  fetchCurriculum,
} from '../domain/curriculum/api'
import type {
  Curriculum,
} from '../domain/curriculum/types'
import {
  fetchGeneralEducation,
} from '../domain/general-education/api'
import type {
  GeneralEducation,
} from '../domain/general-education/types'
import {
  createGraduationExportData,
} from '../domain/graduation-export/createGraduationExportData'
import {
  fetchGraduationRequirements,
} from '../domain/graduation-requirements/api'
import type {
  GraduationRequirements,
} from '../domain/graduation-requirements/types'
import {
  fetchLectures,
} from '../domain/lectures/api'
import type {
  Lecture,
} from '../domain/lectures/types'
import {
  calculateGraduationProgress,
} from '../domain/graduation-progress/calculateProgress'
import type {
  CreditProgress,
  GraduationProgress,
} from '../domain/graduation-progress/types'

import './GraduationPlaceholderPage.css'


interface ProgressTrackerPageProps {
  user: AuthUser
  onOpenAccount: () => void
}


function getStudentTypeLabel(
  studentType: AuthUser['studentType'],
): string {
  if (studentType === 'regular') {
    return '당초 입학생'
  }

  if (studentType === 'transfer') {
    return '편입생'
  }

  return '학생 유형 미설정'
}


function formatCredits(
  credits: number,
): string {
  return `${credits}학점`
}


function getProgressPercent(
  progress: CreditProgress,
): number {
  if (progress.requiredCredits === 0) {
    return 100
  }

  return Math.min(
    (
      progress.completedCredits /
      progress.requiredCredits
    ) * 100,
    100,
  )
}

function ProgressBar({
  progress,
}: {
  progress: CreditProgress
}) {
  const completedPercent =
    getProgressPercent(progress)

  const scheduledCredits =
    progress.inProgressCredits +
    progress.plannedCredits

  const scheduledPercent =
    progress.requiredCredits === 0
      ? 0
      : Math.min(
          (
            scheduledCredits /
            progress.requiredCredits
          ) * 100,
          100 - completedPercent,
        )

  return (
    <div className="graduation-progress-bar">
      <div
        className={
          'graduation-progress-bar-value ' +
          'graduation-progress-bar-value--completed'
        }
        style={{
          width: `${completedPercent}%`,
        }}
      />

      <div
        className={
          'graduation-progress-bar-value ' +
          'graduation-progress-bar-value--scheduled'
        }
        style={{
          width: `${scheduledPercent}%`,
        }}
      />
    </div>
  )
}

function CreditSummaryCard({
  title,
  progress,
}: {
  title: string
  progress: CreditProgress
}) {
  return (
    <article className="graduation-progress-summary-card">
      <div className="graduation-progress-summary-heading">
        <span>{title}</span>

        <strong>
          {formatCredits(
            progress.completedCredits,
          )}
          {' / '}
          {formatCredits(
            progress.requiredCredits,
          )}
        </strong>
      </div>

      <ProgressBar progress={progress} />


      <dl className="graduation-progress-summary-details">
        <div>
          <dt>이수 예정</dt>

          <dd>
            {formatCredits(
              progress.inProgressCredits +
                progress.plannedCredits,
            )}
          </dd>
        </div>

        <div>
          <dt>남은 학점</dt>

          <dd>
            {formatCredits(
              progress.remainingCredits,
            )}
          </dd>
        </div>
      </dl>
    </article>
  )
}

export function ProgressTrackerPage({
  user,
  onOpenAccount,
}: ProgressTrackerPageProps) {
  const [
    courseRecords,
    setCourseRecords,
  ] = useState<CourseRecord[]>([])

  const [
    curriculum,
    setCurriculum,
  ] = useState<Curriculum | null>(null)

  const [
    generalEducation,
    setGeneralEducation,
  ] = useState<GeneralEducation | null>(
    null,
  )

  const [
    graduationRequirements,
    setGraduationRequirements,
  ] = useState<GraduationRequirements | null>(
    null,
  )

  const [
    lectures,
    setLectures,
  ] = useState<Lecture[]>([])

  const [
    dataAreLoading,
    setDataAreLoading,
  ] = useState(false)

  const [
    dataError,
    setDataError,
  ] = useState<string | null>(null)

  const [
    isExporting,
    setIsExporting,
  ] = useState(false)

  const [
    exportError,
    setExportError,
  ] = useState<string | null>(null)

  const academicProfileIsComplete =
    user.entryYear !== null &&
    user.studentType !== null

  const loadProgressData =
    useCallback(async () => {
      if (user.entryYear === null) {
        return
      }

      setDataAreLoading(true)
      setDataError(null)

      try {
        const [
          records,
          curriculumResult,
          generalEducationResult,
          graduationRequirementsResult,
          lecturesResult,
        ] = await Promise.all([
          getCourseRecords(),
          fetchCurriculum(
            user.entryYear,
          ),
          fetchGeneralEducation(
            user.entryYear,
          ),
          fetchGraduationRequirements(
            user.entryYear,
          ),
          fetchLectures(),
        ])

        setCourseRecords(records)
        setCurriculum(
          curriculumResult,
        )
        setGeneralEducation(
          generalEducationResult,
        )
        setGraduationRequirements(
          graduationRequirementsResult,
        )
        setLectures(
          lecturesResult,
        )
      } catch (error) {
        setDataError(
          error instanceof Error
            ? error.message
            : (
              '개인 이수 현황을 ' +
              '불러오지 못했습니다.'
            ),
        )
      } finally {
        setDataAreLoading(false)
      }
    }, [user.entryYear])

  useEffect(() => {
    if (!academicProfileIsComplete) {
      return
    }

    void loadProgressData()
  }, [
    academicProfileIsComplete,
    loadProgressData,
  ])

  const graduationProgress =
    useMemo<GraduationProgress | null>(
      () => {
        if (
          curriculum === null ||
          generalEducation === null ||
          graduationRequirements === null
        ) {
          return null
        }

        return calculateGraduationProgress(
          curriculum,
          generalEducation,
          graduationRequirements,
          courseRecords,
          lectures,
        )
      },
      [
        courseRecords,
        curriculum,
        generalEducation,
        graduationRequirements,
        lectures,
      ],
    )

  async function handleExcelExport() {
    if (
      isExporting ||
      user.entryYear === null ||
      curriculum === null ||
      generalEducation === null ||
      graduationProgress === null
    ) {
      return
    }

    setIsExporting(true)
    setExportError(null)

    try {
      const exportData =
        createGraduationExportData(
          user,
          curriculum,
          generalEducation,
          courseRecords,
          lectures,
          graduationProgress,
        )

      /*
       * ExcelJS는 일반 화면 렌더링에는
       * 필요하지 않은 비교적 큰 라이브러리입니다.
       *
       * 따라서 사용자가 실제로 다운로드 버튼을
       * 눌렀을 때만 workbook 생성 모듈을
       * 불러옵니다.
       */
      const {
        exportGraduationWorkbook,
      } = await import(
        '../domain/graduation-export/exportGraduationWorkbook'
      )

      await exportGraduationWorkbook(
        exportData,
        user.entryYear,
      )
    } catch (error) {
      setExportError(
        error instanceof Error
          ? error.message
          : '엑셀 파일을 생성하지 못했습니다.',
      )
    } finally {
      setIsExporting(false)
    }
  }


  if (!academicProfileIsComplete) {
    return (
      <section className="graduation-placeholder-page">
        <header className="graduation-placeholder-header">
          <p>
            졸업 요건 및 학점 계산기
          </p>

          <h1>개인 이수 현황</h1>

          <span>
            회원정보에 저장된 학번의
            교육과정을 기준으로 이수 현황을
            확인합니다.
          </span>
        </header>

        <div className="graduation-placeholder-card">
          <h2>
            학업정보 설정이 필요합니다.
          </h2>

          <p>
            개인 이수 현황을 계산하려면
            입학 학번과 학생 유형을 먼저
            설정해야 합니다.
          </p>

          <button
            className="secondary-button"
            type="button"
            onClick={onOpenAccount}
          >
            내 정보 관리로 이동
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="graduation-placeholder-page">
      <header className="graduation-placeholder-header">
        <p>
          졸업 요건 및 학점 계산기
        </p>

        <div className="graduation-placeholder-title-row">
          <h1>개인 이수 현황</h1>

          <button
            className="graduation-export-link"
            type="button"
            disabled={
              isExporting ||
              graduationProgress === null ||
              curriculum === null ||
              generalEducation === null
            }
            onClick={() => {
              void handleExcelExport()
            }}
          >
            <span>
              {isExporting
                ? '엑셀 생성 중...'
                : '개인 이수 현황 엑셀'}
            </span>

            <span
              aria-hidden="true"
              className="graduation-export-link-arrow"
            >
              ↓
            </span>
          </button>
        </div>

        <span>
          {user.entryYear}학번 ·{' '}
          {getStudentTypeLabel(
            user.studentType,
          )}{' '}
          기준으로 이수 현황을 확인합니다.
        </span>

        {exportError !== null ? (
          <p className="graduation-export-error">
            {exportError}
          </p>
        ) : null}
      </header>

      {dataAreLoading ? (
        <div className="graduation-placeholder-card">
          <h2>
            졸업요건을 계산하고 있습니다.
          </h2>

          <p>
            전공 교육과정, 교양 졸업요건,
            개인 과목 기록을 확인하고 있습니다.
          </p>
        </div>
      ) : null}

      {!dataAreLoading &&
      dataError !== null ? (
        <div className="graduation-placeholder-card">
          <h2>
            개인 이수 현황을 불러오지
            못했습니다.
          </h2>

          <p>{dataError}</p>

          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              void loadProgressData()
            }}
          >
            다시 시도
          </button>
        </div>
      ) : null}

      {!dataAreLoading &&
      dataError === null &&
      graduationProgress !== null ? (
        <>
          <div className="graduation-progress-summary-grid">
            <CreditSummaryCard
              title="총 이수학점"
              progress={
                graduationProgress.totalCredits
              }
            />

            <CreditSummaryCard
              title="전공필수"
              progress={
                graduationProgress
                  .majorRequired
                  .credits
              }
            />

            <CreditSummaryCard
              title="전공선택"
              progress={
                graduationProgress
                  .majorElective
                  .credits
              }
            />
            {graduationProgress
              .generalEducation
              .map((requirement) => (
                <CreditSummaryCard
                  key={
                    requirement.requirementId
                  }
                  title={
                    requirement.category
                  }
                  progress={
                    requirement.credits
                  }
                />
              ))}
            </div>

          {curriculum !== null &&
          generalEducation !== null ? (
            <GraduationSemesterBoard
              user={user}
              curriculum={curriculum}
              generalEducation={
                generalEducation
              }
              records={courseRecords}
              lectures={lectures}
              onRecordCreated={(
                createdRecord,
              ) => {
                setCourseRecords(
                  (currentRecords) => [
                    ...currentRecords,
                    createdRecord,
                  ],
                )
              }}
              onRecordUpdated={(
                updatedRecord,
              ) => {
                setCourseRecords(
                  (currentRecords) =>
                    currentRecords.map(
                      (record) =>
                        record.id ===
                        updatedRecord.id
                          ? updatedRecord
                          : record,
                    ),
                )
              }}
              onRecordDeleted={(
                deletedRecordId,
              ) => {
                setCourseRecords(
                  (currentRecords) =>
                    currentRecords.filter(
                      (record) =>
                        record.id !==
                        deletedRecordId,
                    ),
                )
              }}
            />
          ) : null}

          {courseRecords.length === 0 ? (
            <div className="graduation-placeholder-card graduation-placeholder-card--compact">
              <h2>
                아직 저장된 과목이 없습니다.
              </h2>

              <p>
                현재 진척도는 모두 0으로
                표시됩니다. 다음 단계에서
                과목 입력과 전적대 인정 기능을
                추가합니다.
              </p>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
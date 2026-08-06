import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import type {
  AuthUser,
} from '../domain/auth/api'
import {
  getCourseRecords,
} from '../domain/course-records/api'
import type {
  CourseRecord,
  CourseRecordStatus,
} from '../domain/course-records/types'

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


function getStatusLabel(
  status: CourseRecordStatus,
): string {
  if (status === 'planned') {
    return '수강 예정'
  }

  if (status === 'in_progress') {
    return '수강 중'
  }

  if (status === 'completed') {
    return '이수 완료'
  }

  return '대체 인정'
}


function getSemesterLabel(
  record: CourseRecord,
): string {
  if (
    record.academicYear === null ||
    record.semester === null
  ) {
    return '학기 미지정'
  }

  return (
    `${record.academicYear}학년도 ` +
    `${record.semester}학기`
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
    recordsAreLoading,
    setRecordsAreLoading,
  ] = useState(false)

  const [
    recordsError,
    setRecordsError,
  ] = useState<string | null>(null)

  const academicProfileIsComplete =
    user.entryYear !== null &&
    user.studentType !== null

  const loadCourseRecords =
    useCallback(async () => {
      setRecordsAreLoading(true)
      setRecordsError(null)

      try {
        const records =
          await getCourseRecords()

        setCourseRecords(records)
      } catch (error) {
        setRecordsError(
          error instanceof Error
            ? error.message
            : (
              '과목 이수 기록을 ' +
              '불러오지 못했습니다.'
            ),
        )
      } finally {
        setRecordsAreLoading(false)
      }
    }, [])

  useEffect(() => {
    if (!academicProfileIsComplete) {
      return
    }

    void loadCourseRecords()
  }, [
    academicProfileIsComplete,
    loadCourseRecords,
  ])

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

        <h1>개인 이수 현황</h1>

        <span>
          {user.entryYear}학번 ·{' '}
          {getStudentTypeLabel(
            user.studentType,
          )}{' '}
          기준으로 이수 현황을 확인합니다.
        </span>
      </header>

      {recordsAreLoading ? (
        <div className="graduation-placeholder-card">
          <h2>이수 기록을 불러오는 중입니다.</h2>

          <p>
            저장된 과목 정보를 확인하고 있습니다.
          </p>
        </div>
      ) : null}

      {!recordsAreLoading &&
      recordsError !== null ? (
        <div className="graduation-placeholder-card">
          <h2>
            이수 기록을 불러오지 못했습니다.
          </h2>

          <p>{recordsError}</p>

          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              void loadCourseRecords()
            }}
          >
            다시 시도
          </button>
        </div>
      ) : null}

      {!recordsAreLoading &&
      recordsError === null &&
      courseRecords.length === 0 ? (
        <div className="graduation-placeholder-card">
          <h2>
            아직 저장된 과목이 없습니다.
          </h2>

          <p>
            다음 단계에서 직접 과목을 입력하거나
            저장된 시간표에서 불러올 수 있습니다.
          </p>
        </div>
      ) : null}

      {!recordsAreLoading &&
      recordsError === null &&
      courseRecords.length > 0 ? (
        <div className="graduation-placeholder-card">
          <h2>
            저장된 과목 {courseRecords.length}개
          </h2>

          <ul>
            {courseRecords.map((record) => (
              <li key={record.id}>
                <strong>
                  {record.courseName}
                </strong>

                {' · '}

                {record.completionType}

                {' · '}

                {record.credits}학점

                {' · '}

                {getStatusLabel(
                  record.status,
                )}

                {' · '}

                {getSemesterLabel(record)}

                {record.isRetake
                  ? ' · 재수강'
                  : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
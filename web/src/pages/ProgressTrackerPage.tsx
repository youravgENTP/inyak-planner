import type {
  AuthUser,
} from '../domain/auth/api'

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

export function ProgressTrackerPage({
  user,
  onOpenAccount,
}: ProgressTrackerPageProps) {
  const academicProfileIsComplete =
    user.entryYear !== null &&
    user.studentType !== null

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

      <div className="graduation-placeholder-card">
        <h2>
          {user.entryYear}학번 개인 이수 현황
        </h2>

        <p>
          학업정보 연결이 완료되었습니다.
          다음 단계에서 과목별 이수 기록과
          졸업요건 충족 현황을 표시합니다.
        </p>
      </div>
    </section>
  )
}
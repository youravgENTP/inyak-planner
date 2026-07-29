import './AccountPage.css'

interface AccountPageProps {
  username: string
  onBack: () => void
  onLogout: () => void
}

function getProfileInitial(
  username: string,
): string {
  const normalizedUsername =
    username.trim()

  if (normalizedUsername.length === 0) {
    return '?'
  }

  return normalizedUsername
    .slice(0, 1)
    .toUpperCase()
}

export function AccountPage({
  username,
  onBack,
  onLogout,
}: AccountPageProps) {
  const profileInitial =
    getProfileInitial(username)

  return (
    <section className="account-page">
      <header className="account-page-header">
        <div>
          <span className="page-kicker">
            계정 설정
          </span>

          <h1>내 정보 관리</h1>

          <p>
            프로필과 계정 정보를 확인하고
            관리합니다.
          </p>
        </div>

        <button
          className="secondary-button"
          type="button"
          onClick={onBack}
        >
          시간표로 돌아가기
        </button>
      </header>

      <div className="account-section">
        <div className="account-section-heading">
          <h2>프로필</h2>

          <p>
            현재 로그인된 계정 정보입니다.
          </p>
        </div>

        <div className="account-profile-card">
          <div
            className="account-profile-avatar"
            aria-hidden="true"
          >
            {profileInitial}
          </div>

          <div className="account-profile-info">
            <span>사용자 ID</span>
            <strong>{username}</strong>
          </div>

          <button
            className="secondary-button"
            type="button"
            disabled
          >
            프로필 이미지 변경
          </button>
        </div>
      </div>

      <div className="account-section">
        <div className="account-section-heading">
          <h2>계정 보안</h2>

          <p>
            비밀번호 변경 기능은 이후
            단계에서 추가합니다.
          </p>
        </div>

        <div className="account-setting-row">
          <div>
            <strong>비밀번호</strong>

            <span>
              계정 비밀번호를 변경합니다.
            </span>
          </div>

          <button
            className="secondary-button"
            type="button"
            disabled
          >
            비밀번호 변경
          </button>
        </div>
      </div>

      <div className="account-section">
        <div className="account-section-heading">
          <h2>로그인 세션</h2>

          <p>
            현재 브라우저의 로그인 상태를
            관리합니다.
          </p>
        </div>

        <div className="account-setting-row">
          <div>
            <strong>현재 계정에서 로그아웃</strong>

            <span>
              이 브라우저의 로그인 세션을
              종료합니다.
            </span>
          </div>

          <button
            className="account-danger-button"
            type="button"
            onClick={onLogout}
          >
            로그아웃
          </button>
        </div>
      </div>
    </section>
  )
}
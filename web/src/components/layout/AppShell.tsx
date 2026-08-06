import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'

export type AppNavigationPage =
  | 'timetable'
  | 'curriculum'
  | 'progress'
  | 'gpa'

interface AppShellProps {
  activePage: AppNavigationPage
  children: ReactNode
  username: string
  onNavigate: (
    page: AppNavigationPage,
  ) => void
  onOpenAccount: () => void
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

export function AppShell({
  activePage,
  children,
  username,
  onNavigate,
  onOpenAccount,
  onLogout,
}: AppShellProps) {
  const [
    isProfileMenuOpen,
    setIsProfileMenuOpen,
  ] = useState(false)

  const profileAreaRef =
    useRef<HTMLDivElement>(null)

  const profileInitial =
    getProfileInitial(username)

  useEffect(() => {
    if (!isProfileMenuOpen) {
      return
    }

    function handleDocumentPointerDown(
      event: PointerEvent,
    ) {
      const clickedElement =
        event.target

      if (
        !(clickedElement instanceof Node)
      ) {
        return
      }

      if (
        profileAreaRef.current?.contains(
          clickedElement,
        )
      ) {
        return
      }

      setIsProfileMenuOpen(false)
    }

    function handleDocumentKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === 'Escape') {
        setIsProfileMenuOpen(false)
      }
    }

    document.addEventListener(
      'pointerdown',
      handleDocumentPointerDown,
    )

    document.addEventListener(
      'keydown',
      handleDocumentKeyDown,
    )

    return () => {
      document.removeEventListener(
        'pointerdown',
        handleDocumentPointerDown,
      )

      document.removeEventListener(
        'keydown',
        handleDocumentKeyDown,
      )
    }
  }, [isProfileMenuOpen])

  function handleProfileButtonClick() {
    setIsProfileMenuOpen(
      (currentValue) => !currentValue,
    )
  }

  function handleProfileSettingsClick() {
    setIsProfileMenuOpen(false)
    onOpenAccount()
  }

  function handleLogoutClick() {
    setIsProfileMenuOpen(false)
    onLogout()
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div
          className="sidebar-profile"
          ref={profileAreaRef}
        >
          <button
            className="sidebar-profile-button"
            type="button"
            aria-expanded={isProfileMenuOpen}
            aria-haspopup="menu"
            onClick={
              handleProfileButtonClick
            }
          >
            <span
              className="sidebar-profile-avatar"
              aria-hidden="true"
            >
              {profileInitial}
            </span>

            <span className="sidebar-profile-text">
              <strong>{username}</strong>
              <span>내 계정</span>
            </span>
          </button>

          {isProfileMenuOpen && (
            <div
              className="sidebar-profile-menu"
              role="menu"
            >
              <button
                className="sidebar-profile-menu-item"
                type="button"
                role="menuitem"
                onClick={
                  handleProfileSettingsClick
                }
              >
                내 정보 관리
              </button>

              <button
                className="
                  sidebar-profile-menu-item
                  sidebar-profile-menu-item--danger
                "
                type="button"
                role="menuitem"
                onClick={
                  handleLogoutClick
                }
              >
                로그아웃
              </button>
            </div>
          )}
        </div>
        <nav
          className="sidebar-nav"
          aria-label="주요 메뉴"
        >
          <div className="nav-section">
            <button
              className={
                `nav-item${
                  activePage === 'timetable'
                    ? ' nav-item--active'
                    : ''
                }`
              }
              type="button"
              onClick={() =>
                onNavigate('timetable')
              }
            >
              시간표
            </button>
          </div>

          <div className="nav-section">
            <button
              className="nav-item"
              disabled
              type="button"
            >
              수강편람
            </button>
          </div>

          <div className="nav-section">
            <div className="nav-group">
              <div className="nav-group-title">
                졸업 요건
              </div>

              <div className="nav-submenu">
                <button
                  className={
                    `nav-subitem${
                      activePage === 'curriculum'
                        ? ' nav-subitem--active'
                        : ''
                    }`
                  }
                  type="button"
                  onClick={() =>
                    onNavigate('curriculum')
                  }
                >
                  학번별 교육과정
                </button>

                <button
                  className={
                    `nav-subitem${
                      activePage === 'gpa'
                        ? ' nav-subitem--active'
                        : ''
                    }`
                  }
                  type="button"
                  onClick={() =>
                    onNavigate('gpa')
                  }
                >
                  수강 기록 &amp; GPA
                </button>

                <button
                  className={
                    `nav-subitem${
                      activePage === 'progress'
                        ? ' nav-subitem--active'
                        : ''
                    }`
                  }
                  type="button"
                  onClick={() =>
                    onNavigate('progress')
                  }
                >
                  개인 이수현황 확인
                </button>
              </div>
            </div>
          </div>
        </nav>
        <div className="sidebar-footer">
          <span>2026학년도 2학기</span>

          <strong>
            Department of Pharmacy
          </strong>
        </div>
      </aside>

      <div className="app-main">
        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  )
}
import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'

export type AppNavigationPage =
  | 'timetable'
  | 'curriculum'

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

interface NavigationItem {
  label: string
  page: AppNavigationPage | null
}

const navigationItems:
  NavigationItem[] = [
    {
      label: '시간표',
      page: 'timetable',
    },
    {
      label: '수강편람',
      page: null,
    },
    {
      label: '졸업 요건',
      page: 'curriculum',
    },
  ]

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
        {navigationItems.map((item) => {
          const isActive =
            item.page !== null &&
            item.page === activePage

          return (
            <button
              className={
                `nav-item${
                  isActive
                    ? ' nav-item--active'
                    : ''
                }`
              }
              disabled={item.page === null}
              key={item.label}
              type="button"
              onClick={() => {
                if (item.page !== null) {
                  onNavigate(item.page)
                }
              }}
            >
              <span
                className="nav-dot"
                aria-hidden="true"
              />

              {item.label}
            </button>
          )
        })}
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
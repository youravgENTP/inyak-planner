/* 
AppShell
├── sidebar
│   ├── brand
│   ├── navigation
│   └── footer
└── app-main
    ├── topbar
    └── page-content
        └── children
*/

import type { ReactNode } from 'react'

interface AppShellProps {
  children: ReactNode
}

const navigationItems = [
  { label: '시간표', active: true },
  { label: '수강편람', active: false },
  { label: '졸업 요건', active: false },
]

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">윤</span>
          <div>
            <strong>가칭</strong>
            <span>devName</span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="주요 메뉴">
          {navigationItems.map((item) => (
            <button
              className={`nav-item${item.active ? ' nav-item--active' : ''}`}
              key={item.label}
              type="button"
            >
              <span className="nav-dot" aria-hidden="true" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span>2026학년도 2학기</span>
          <strong>Department of Pharmacy</strong>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div>
            <span className="topbar-eyebrow">Academic workspace</span>
            <strong>나의 학업 계획</strong>
          </div>
          <button className="profile-button" type="button" aria-label="사용자 메뉴">
            HY
          </button>
        </header>

        <main className="page-content">{children}</main>
      </div>
    </div>
  )
}

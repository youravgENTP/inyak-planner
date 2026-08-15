import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router'

import './App.css'
import {
  AppShell,
  type AppNavigationPage,
} from './components/layout/AppShell'

import {
  getCurrentUser,
  logout,
  type AuthUser,
} from './domain/auth/api'

import type {
  SavedTimetable,
} from './domain/saved-timetables'

import { AccountPage } from './pages/AccountPage'
import { AcademicCalendarPage } from './pages/AcademicCalendarPage'
import { AuthPage } from './pages/AuthPage'
import { CurriculumPage } from './pages/CurriculumPage'
import { GpaCalculatorPage } from './pages/GpaCalculatorPage'
import { ProgressTrackerPage } from './pages/ProgressTrackerPage'
import { TimetableComparisonWorkspacePage } from './pages/TimetableComparisonWorkspacePage'
import { TimetablePage } from './pages/TimetablePage'

const PAGE_PATHS:
  Record<AppNavigationPage, string> = {
    timetable: '/timetable',
    timetableComparison:
      '/timetable/compare',
    academicCalendar:
      '/academic-calendar',
    curriculum: '/curriculum',
    progress: '/progress',
    gpa: '/gpa',
  }

function getActiveNavigationPage(
  pathname: string,
): AppNavigationPage {
  switch (pathname) {
    case '/timetable/compare':
      return 'timetableComparison'

    case '/academic-calendar':
      return 'academicCalendar'

    case '/curriculum':
      return 'curriculum'

    case '/progress':
      return 'progress'

    case '/gpa':
      return 'gpa'

    case '/timetable':
    default:
      return 'timetable'
  }
}

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const [currentUser, setCurrentUser] =
    useState<AuthUser | null>(null)

  const [
    savedTimetables,
    setSavedTimetables,
  ] = useState<SavedTimetable[]>([])


  const [
    isCheckingAuthentication,
    setIsCheckingAuthentication,
  ] = useState(true)

  const [
    authenticationError,
    setAuthenticationError,
  ] = useState<string | null>(null)

  const [
    isLoggingOut,
    setIsLoggingOut,
  ] = useState(false)

  useEffect(() => {
    async function checkAuthentication() {
      try {
        const user =
          await getCurrentUser()

        setCurrentUser(user)
      } catch (error) {
        if (error instanceof Error) {
          setAuthenticationError(
            error.message,
          )
        } else {
          setAuthenticationError(
            '로그인 상태를 확인하지 못했습니다.',
          )
        }
      } finally {
        setIsCheckingAuthentication(false)
      }
    }

    void checkAuthentication()
  }, [])

  async function handleLogout() {
    if (isLoggingOut) {
      return
    }

    setIsLoggingOut(true)
    setAuthenticationError(null)

    try {
      await logout()

      setSavedTimetables([])
      setCurrentUser(null)
      navigate(
        '/timetable',
        { replace: true },
      )
    } catch (error) {
      if (error instanceof Error) {
        setAuthenticationError(
          error.message,
        )
      } else {
        setAuthenticationError(
          '로그아웃하지 못했습니다.',
        )
      }
    } finally {
      setIsLoggingOut(false)
    }
  }

  function handleAuthenticated(
    user: AuthUser,
  ) {
    setSavedTimetables([])
    setCurrentUser(user)
  }

  const handleTimetableStateChange =
    useCallback(
      (
        timetables:
          readonly SavedTimetable[],
      ) => {
        setSavedTimetables([
          ...timetables,
        ])
      },
      [],
    )

  if (isCheckingAuthentication) {
    return (
      <main className="auth-page">
        <p>
          로그인 상태를 확인하고 있습니다...
        </p>
      </main>
    )
  }

  if (authenticationError !== null) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <p
            className="auth-error"
            role="alert"
          >
            {authenticationError}
          </p>

          {currentUser !== null && (
            <button
              className="auth-submit-button"
              type="button"
              onClick={() =>
                setAuthenticationError(null)
              }
            >
              돌아가기
            </button>
          )}
        </section>
      </main>
    )
  }

  if (currentUser === null) {
    return (
      <AuthPage
        onAuthenticated={
          handleAuthenticated
        }
      />
    )
  }

  const activeNavigationPage:
    AppNavigationPage =
      location.pathname === '/account'
        ? 'curriculum'
        : getActiveNavigationPage(
            location.pathname,
          )

  return (
    <AppShell
      activePage={activeNavigationPage}
      username={currentUser.username}
      profileImageFilename={
        currentUser.profileImageFilename
      }
      onNavigate={(page) =>
        navigate(PAGE_PATHS[page])
      }
      onOpenAccount={() =>
        navigate('/account')
      }
      onLogout={() => {
        void handleLogout()
      }}
    >
      <Routes>
        <Route
          path="/"
          element={
            <Navigate
              to="/timetable"
              replace
            />
          }
        />

        <Route
          path="/timetable"
          element={
            <TimetablePage
              onTimetableStateChange={
                handleTimetableStateChange
              }
            />
          }
        />

        <Route
          path="/timetable/compare"
          element={
            <TimetableComparisonWorkspacePage
              user={currentUser}
              timetables={savedTimetables}
            />
          }
        />

        <Route
          path="/academic-calendar"
          element={
            <AcademicCalendarPage />
          }
        />

        <Route
          path="/curriculum"
          element={<CurriculumPage />}
        />

        <Route
          path="/gpa"
          element={
            <GpaCalculatorPage
              user={currentUser}
            />
          }
        />

        <Route
          path="/progress"
          element={
            <ProgressTrackerPage
              user={currentUser}
              onOpenAccount={() =>
                navigate('/account')
              }
            />
          }
        />

        <Route
          path="/account"
          element={
            <AccountPage
              user={currentUser}
              onBack={() =>
                navigate('/timetable')
              }
              onUserUpdated={(
                updatedUser,
              ) =>
                setCurrentUser(updatedUser)
              }
              onLogout={() => {
                void handleLogout()
              }}
            />
          }
        />

        <Route
          path="*"
          element={
            <Navigate
              to="/timetable"
              replace
            />
          }
        />
      </Routes>
    </AppShell>
  )
}

export default App
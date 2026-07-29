import {
  useEffect,
  useState,
} from 'react'

import './App.css'
import { AppShell } from './components/layout/AppShell'
import {
  getCurrentUser,
  logout,
  type AuthUser,
} from './domain/auth/api'
import { AuthPage } from './pages/AuthPage'
import { TimetablePage } from './pages/TimetablePage'

function App() {
  const [currentUser, setCurrentUser] =
    useState<AuthUser | null>(null)

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
        const user = await getCurrentUser()

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
      setCurrentUser(null)
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
        onAuthenticated={setCurrentUser}
      />
    )
  }

  return (
    <AppShell
      username={currentUser.username}
      onLogout={() => {
        void handleLogout()
      }}
    >
      <TimetablePage />
    </AppShell>
  )
}

export default App
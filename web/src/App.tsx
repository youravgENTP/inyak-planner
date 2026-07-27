import {
  useEffect,
  useState,
} from 'react'

import './App.css'
import { AppShell } from './components/layout/AppShell'
import {
  getCurrentUser,
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

  if (isCheckingAuthentication) {
    return (
      <main className="auth-page">
        <p>로그인 상태를 확인하고 있습니다...</p>
      </main>
    )
  }

  if (authenticationError !== null) {
    return (
      <main className="auth-page">
        <p role="alert">
          {authenticationError}
        </p>
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
    <AppShell>
      <TimetablePage />
    </AppShell>
  )
}

export default App
import {
  type FormEvent,
  useState,
} from 'react'

import './AuthPage.css'

import {
  login,
  register,
  type AuthUser,
} from '../domain/auth/api'

interface AuthPageProps {
  onAuthenticated: (
    user: AuthUser,
  ) => void
}

type AuthMode = 'login' | 'register'

export function AuthPage({
  onAuthenticated,
}: AuthPageProps) {
  const [mode, setMode] =
    useState<AuthMode>('login')

  const [username, setUsername] =
    useState('')

  const [password, setPassword] =
    useState('')

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  const [isSubmitting, setIsSubmitting] =
    useState(false)

  const isRegisterMode =
    mode === 'register'

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      const user = isRegisterMode
        ? await register(
            username,
            password,
          )
        : await login(
            username,
            password,
          )

      onAuthenticated(user)
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message)
      } else {
        setErrorMessage(
          '요청을 처리하는 중 오류가 발생했습니다.',
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleModeChange(
    nextMode: AuthMode,
  ) {
    setMode(nextMode)
    setErrorMessage(null)
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <header className="auth-header">
          <p className="auth-eyebrow">
            INYAK PLANNER
          </p>

          <h1 className="auth-title">
            {isRegisterMode
              ? '회원가입'
              : '로그인'}
          </h1>

          <p className="auth-description">
            {isRegisterMode
              ? '새 계정을 만들어 시간표를 관리하세요.'
              : '계정에 로그인해 시간표를 확인하세요.'}
          </p>
        </header>

        <div
          className="auth-mode-selector"
          aria-label="로그인 방식 선택"
        >
          <button
            className={
              mode === 'login'
                ? 'auth-mode-button active'
                : 'auth-mode-button'
            }
            type="button"
            onClick={() =>
              handleModeChange('login')
            }
          >
            로그인
          </button>

          <button
            className={
              mode === 'register'
                ? 'auth-mode-button active'
                : 'auth-mode-button'
            }
            type="button"
            onClick={() =>
              handleModeChange('register')
            }
          >
            회원가입
          </button>
        </div>

        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >
          <label className="auth-field">
            <span className="auth-label">
              사용자 ID
            </span>

            <input
              className="auth-input"
              type="text"
              value={username}
              minLength={3}
              maxLength={30}
              autoComplete="username"
              required
              disabled={isSubmitting}
              onChange={(event) =>
                setUsername(
                  event.target.value,
                )
              }
            />
          </label>

          <label className="auth-field">
            <span className="auth-label">
              비밀번호
            </span>

            <input
              className="auth-input"
              type="password"
              value={password}
              minLength={
                isRegisterMode ? 8 : 1
              }
              maxLength={128}
              autoComplete={
                isRegisterMode
                  ? 'new-password'
                  : 'current-password'
              }
              required
              disabled={isSubmitting}
              onChange={(event) =>
                setPassword(
                  event.target.value,
                )
              }
            />
          </label>

          {errorMessage !== null && (
            <p
              className="auth-error"
              role="alert"
            >
              {errorMessage}
            </p>
          )}

          <button
            className="auth-submit-button"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? '처리 중...'
              : isRegisterMode
                ? '계정 만들기'
                : '로그인'}
          </button>
        </form>
      </section>
    </main>
  )
}
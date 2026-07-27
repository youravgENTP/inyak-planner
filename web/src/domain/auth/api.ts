const API_BASE_URL = 'http://localhost:8000'

export interface AuthUser {
  id: string
  username: string
  createdAt: string
}

interface AuthUserApiItem {
  id: string
  username: string
  created_at: string
}

interface AuthResponse {
  user: AuthUserApiItem
}

interface AuthErrorResponse {
  detail?: unknown
}

function mapAuthUser(
  user: AuthUserApiItem,
): AuthUser {
  return {
    id: user.id,
    username: user.username,
    createdAt: user.created_at,
  }
}

async function getErrorMessage(
  response: Response,
  fallbackMessage: string,
): Promise<string> {
  try {
    const data =
      (await response.json()) as AuthErrorResponse

    if (
      typeof data.detail === 'string' &&
      data.detail.trim().length > 0
    ) {
      return data.detail
    }
  } catch {
    // JSON 응답이 아니면 기본 오류 메시지를 사용합니다.
  }

  return fallbackMessage
}

async function sendCredentialsRequest(
  path: string,
  username: string,
  password: string,
): Promise<AuthUser> {
  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        password,
      }),
    },
  )

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        '인증 요청을 처리하지 못했습니다.',
      ),
    )
  }

  const data =
    (await response.json()) as AuthResponse

  return mapAuthUser(data.user)
}

export function register(
  username: string,
  password: string,
): Promise<AuthUser> {
  return sendCredentialsRequest(
    '/api/auth/register',
    username,
    password,
  )
}

export function login(
  username: string,
  password: string,
): Promise<AuthUser> {
  return sendCredentialsRequest(
    '/api/auth/login',
    username,
    password,
  )
}

export async function getCurrentUser():
  Promise<AuthUser | null> {
  const response = await fetch(
    `${API_BASE_URL}/api/auth/me`,
    {
      credentials: 'include',
    },
  )

  if (response.status === 401) {
    return null
  }

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        '로그인 상태를 확인하지 못했습니다.',
      ),
    )
  }

  const data =
    (await response.json()) as AuthResponse

  return mapAuthUser(data.user)
}

export async function logout():
  Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/auth/logout`,
    {
      method: 'POST',
      credentials: 'include',
    },
  )

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        '로그아웃하지 못했습니다.',
      ),
    )
  }
}
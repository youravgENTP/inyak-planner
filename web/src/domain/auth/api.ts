const API_BASE_URL = 'http://localhost:8000'

export function getProfileImageUrl(
  profileImageFilename: string | null,
): string | null {
  if (profileImageFilename === null) {
    return null
  }

  return (
    `${API_BASE_URL}/profile-images/` +
    encodeURIComponent(
      profileImageFilename,
    )
  )
}

export type StudentType =
  | 'regular'
  | 'transfer'
export interface AuthUser {
  id: string
  username: string
  profileImageFilename: string | null
  entryYear: number | null
  studentType: StudentType | null
  createdAt: string
}

interface AuthUserApiItem {
  id: string
  username: string
  profile_image_filename: string | null
  entry_year: number | null
  student_type: StudentType | null
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
    profileImageFilename:
      user.profile_image_filename,
    entryYear: user.entry_year,
    studentType: user.student_type,
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

export async function updateAcademicProfile(
  entryYear: number,
  studentType: StudentType,
): Promise<AuthUser> {
  const response = await fetch(
    `${API_BASE_URL}/api/auth/profile`,
    {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        entry_year: entryYear,
        student_type: studentType,
      }),
    },
  )

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        '학업정보를 변경하지 못했습니다.',
      ),
    )
  }

  const data =
    (await response.json()) as AuthResponse

  return mapAuthUser(data.user)
}

export async function uploadProfileImage(
  file: File,
): Promise<AuthUser> {
  const formData = new FormData()

  formData.append(
    'image',
    file,
  )

  const response = await fetch(
    `${API_BASE_URL}/api/auth/profile-image`,
    {
      method: 'POST',
      credentials: 'include',
      body: formData,
    },
  )

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        '프로필 이미지를 변경하지 못했습니다.',
      ),
    )
  }

  const data =
    (await response.json()) as AuthResponse

  return mapAuthUser(data.user)
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/auth/password`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    },
  )

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        '비밀번호를 변경하지 못했습니다.',
      ),
    )
  }
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
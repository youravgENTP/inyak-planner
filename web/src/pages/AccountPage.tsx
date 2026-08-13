import {
  type ChangeEvent,
  type FormEvent,
  useRef,
  useState,
} from 'react'

import {
  changePassword,
  getProfileImageUrl,
  updateAcademicProfile,
  uploadProfileImage,
  type AuthUser,
  type StudentType,
} from '../domain/auth/api'

import './AccountPage.css'

interface AccountPageProps {
  user: AuthUser
  onBack: () => void
  onLogout: () => void
  onUserUpdated: (
    user: AuthUser,
  ) => void
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
  user,
  onBack,
  onLogout,
  onUserUpdated,
}: AccountPageProps) {
  const profileInitial =
    getProfileInitial(user.username)

  const profileImageUrl =
    getProfileImageUrl(
      user.profileImageFilename,
    )

  const [
    entryYear,
    setEntryYear,
  ] = useState(
    user.entryYear?.toString() ?? '',
  )

  const [
    studentType,
    setStudentType,
  ] = useState<StudentType | ''>(
    user.studentType ?? '',
  )

  const [
    isSavingAcademicProfile,
    setIsSavingAcademicProfile,
  ] = useState(false)

  const [
    academicProfileError,
    setAcademicProfileError,
  ] = useState<string | null>(null)

  const [
    academicProfileSuccess,
    setAcademicProfileSuccess,
  ] = useState<string | null>(null)

  const [
    currentPassword,
    setCurrentPassword,
  ] = useState('')

  const [
    newPassword,
    setNewPassword,
  ] = useState('')

  const [
    newPasswordConfirm,
    setNewPasswordConfirm,
  ] = useState('')

  const [
    isChangingPassword,
    setIsChangingPassword,
  ] = useState(false)

  const [
    passwordError,
    setPasswordError,
  ] = useState<string | null>(null)

  const [
    passwordSuccess,
    setPasswordSuccess,
  ] = useState<string | null>(null)

  const profileImageInputRef =
    useRef<HTMLInputElement>(null)

  const [
    isUploadingProfileImage,
    setIsUploadingProfileImage,
  ] = useState(false)

  const [
    profileImageError,
    setProfileImageError,
  ] = useState<string | null>(null)

  const [
    profileImageSuccess,
    setProfileImageSuccess,
  ] = useState<string | null>(null)  



  async function handleProfileImageChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0]

    if (file === undefined) {
      return
    }

    setProfileImageError(null)
    setProfileImageSuccess(null)

    if (file.size > 5 * 1024 * 1024) {
      setProfileImageError(
        '프로필 이미지는 5MB 이하만 업로드할 수 있습니다.',
      )
      event.target.value = ''
      return
    }

    setIsUploadingProfileImage(true)

    try {
      const updatedUser =
        await uploadProfileImage(file)

      onUserUpdated(updatedUser)

      setProfileImageSuccess(
        '프로필 이미지가 변경되었습니다.',
      )
    } catch (error) {
      if (error instanceof Error) {
        setProfileImageError(
          error.message,
        )
      } else {
        setProfileImageError(
          '프로필 이미지를 변경하지 못했습니다.',
        )
      }
    } finally {
      setIsUploadingProfileImage(false)

      // 같은 파일을 다시 선택해도 change 이벤트가 발생하도록 초기화합니다.
      event.target.value = ''
    }
  }

  async function handleAcademicProfileSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (
      entryYear === '' ||
      studentType === ''
    ) {
      setAcademicProfileError(
        '입학 학번과 학생 유형을 모두 선택해 주세요.',
      )
      setAcademicProfileSuccess(null)
      return
    }

    setIsSavingAcademicProfile(true)
    setAcademicProfileError(null)
    setAcademicProfileSuccess(null)

    try {
      const updatedUser =
        await updateAcademicProfile(
          Number(entryYear),
          studentType,
        )

      onUserUpdated(updatedUser)

      setAcademicProfileSuccess(
        '학업정보가 저장되었습니다.',
      )
    } catch (error) {
      if (error instanceof Error) {
        setAcademicProfileError(
          error.message,
        )
      } else {
        setAcademicProfileError(
          '학업정보를 저장하지 못했습니다.',
        )
      }
    } finally {
      setIsSavingAcademicProfile(false)
    }
  }

  async function handlePasswordSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (
      currentPassword === '' ||
      newPassword === '' ||
      newPasswordConfirm === ''
    ) {
      setPasswordError(
        '비밀번호 입력란을 모두 작성해 주세요.',
      )
      setPasswordSuccess(null)
      return
    }

    if (newPassword.length < 8) {
      setPasswordError(
        '새 비밀번호는 8자 이상이어야 합니다.',
      )
      setPasswordSuccess(null)
      return
    }

    if (newPassword !== newPasswordConfirm) {
      setPasswordError(
        '새 비밀번호와 비밀번호 확인이 일치하지 않습니다.',
      )
      setPasswordSuccess(null)
      return
    }

    setIsChangingPassword(true)
    setPasswordError(null)
    setPasswordSuccess(null)

    try {
      await changePassword(
        currentPassword,
        newPassword,
      )

      setCurrentPassword('')
      setNewPassword('')
      setNewPasswordConfirm('')

      setPasswordSuccess(
        '비밀번호가 변경되었습니다.',
      )
    } catch (error) {
      if (error instanceof Error) {
        setPasswordError(
          error.message,
        )
      } else {
        setPasswordError(
          '비밀번호를 변경하지 못했습니다.',
        )
      }
    } finally {
      setIsChangingPassword(false)
    }
  }

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
            {profileImageUrl !== null ? (
              <img
                src={profileImageUrl}
                alt=""
              />
            ) : (
              profileInitial
            )}
          </div>

          <div className="account-profile-info">
            <span>사용자 ID</span>
            <strong>{user.username}</strong>
          </div>

          <div className="account-profile-upload">
            <input
              ref={profileImageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={handleProfileImageChange}
            />

            <button
              className="secondary-button"
              type="button"
              disabled={isUploadingProfileImage}
              onClick={() => {
                profileImageInputRef.current?.click()
              }}
            >
              {isUploadingProfileImage
                ? '업로드 중...'
                : '프로필 이미지 변경'}
            </button>

            {profileImageError !== null && (
              <p
                className="
                  account-academic-message
                  account-academic-message--error
                "
                role="alert"
              >
                {profileImageError}
              </p>
            )}

            {profileImageSuccess !== null && (
              <p
                className="
                  account-academic-message
                  account-academic-message--success
                "
                role="status"
              >
                {profileImageSuccess}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="account-section">
        <div className="account-section-heading">
          <h2>학업정보</h2>

          <p>
            졸업요건과 개인 이수 현황을
            계산하는 기준을 설정합니다.
          </p>
        </div>

        <form
          className="account-academic-form"
          onSubmit={
            handleAcademicProfileSubmit
          }
        >
          <div className="account-academic-fields">
            <div className="account-academic-field">
              <label htmlFor="entry-year">
                입학 학번
              </label>

              <select
                id="entry-year"
                value={entryYear}
                disabled={
                  isSavingAcademicProfile
                }
                onChange={(event) => {
                  setEntryYear(
                    event.target.value,
                  )
                  setAcademicProfileError(null)
                  setAcademicProfileSuccess(null)
                }}
              >
                <option value="">
                  학번 선택
                </option>

                <option value="2022">
                  2022학번
                </option>

                <option value="2023">
                  2023학번
                </option>

                <option value="2024">
                  2024학번
                </option>

                <option value="2025">
                  2025학번
                </option>

                <option value="2026">
                  2026학번
                </option>
              </select>
            </div>

            <div className="account-academic-field">
              <label htmlFor="student-type">
                입학 구분
              </label>

              <select
                id="student-type"
                value={studentType}
                disabled={
                  isSavingAcademicProfile
                }
                onChange={(event) => {
                  setStudentType(
                    event.target.value as StudentType | '',
                  )
                  setAcademicProfileError(null)
                  setAcademicProfileSuccess(null)
                }}
              >
                <option value="">
                  입학 유형 선택
                </option>

                <option value="regular">
                  당초 입학생
                </option>

                <option value="transfer">
                  편입생
                </option>
              </select>
            </div>
          </div>

          <div className="account-academic-actions">
            <div>
              {academicProfileError !== null && (
                <p
                  className="
                    account-academic-message
                    account-academic-message--error
                  "
                  role="alert"
                >
                  {academicProfileError}
                </p>
              )}

              {academicProfileSuccess !== null && (
                <p
                  className="
                    account-academic-message
                    account-academic-message--success
                  "
                  role="status"
                >
                  {academicProfileSuccess}
                </p>
              )}
            </div>

            <button
              className="secondary-button"
              type="submit"
              disabled={
                isSavingAcademicProfile
              }
            >
              {isSavingAcademicProfile
                ? '저장 중...'
                : '학업정보 저장'}
            </button>
          </div>
        </form>
      </div>

      <div className="account-section">
        <div className="account-section-heading">
          <h2>계정 보안</h2>

          <p>
            현재 비밀번호를 확인한 뒤
            새 비밀번호로 변경합니다.
          </p>
        </div>

        <form
          className="account-academic-form"
          onSubmit={handlePasswordSubmit}
        >
          <div className="account-academic-fields account-password-fields">
            <div className="account-academic-field">
              <label htmlFor="current-password">
                현재 비밀번호
              </label>

              <input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                disabled={isChangingPassword}
                onChange={(event) => {
                  setCurrentPassword(
                    event.target.value,
                  )
                  setPasswordError(null)
                  setPasswordSuccess(null)
                }}
              />
            </div>

            <div className="account-academic-field">
              <label htmlFor="new-password">
                새 비밀번호
              </label>

              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                disabled={isChangingPassword}
                onChange={(event) => {
                  setNewPassword(
                    event.target.value,
                  )
                  setPasswordError(null)
                  setPasswordSuccess(null)
                }}
              />
            </div>

            <div className="account-academic-field">
              <label htmlFor="new-password-confirm">
                새 비밀번호 확인
              </label>

              <input
                id="new-password-confirm"
                type="password"
                autoComplete="new-password"
                value={newPasswordConfirm}
                disabled={isChangingPassword}
                onChange={(event) => {
                  setNewPasswordConfirm(
                    event.target.value,
                  )
                  setPasswordError(null)
                  setPasswordSuccess(null)
                }}
              />
            </div>
          </div>

          <div className="account-academic-actions">
            <div>
              {passwordError !== null && (
                <p
                  className="
                    account-academic-message
                    account-academic-message--error
                  "
                  role="alert"
                >
                  {passwordError}
                </p>
              )}

              {passwordSuccess !== null && (
                <p
                  className="
                    account-academic-message
                    account-academic-message--success
                  "
                  role="status"
                >
                  {passwordSuccess}
                </p>
              )}
            </div>

            <button
              className="secondary-button"
              type="submit"
              disabled={isChangingPassword}
            >
              {isChangingPassword
                ? '변경 중...'
                : '비밀번호 변경'}
            </button>
          </div>
        </form>
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
            <strong>
              현재 계정에서 로그아웃
            </strong>

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
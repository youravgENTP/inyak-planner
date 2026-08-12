import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
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

import {
  createGradeKey,
  getStoredGradeKey,
  restoreGradeKey,
} from '../domain/course-records/crypto'

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

  const [
    hasGradeEncryptionKey,
    setHasGradeEncryptionKey,
  ] = useState<boolean | null>(null)

  const [
    isCheckingGradeEncryptionKey,
    setIsCheckingGradeEncryptionKey,
  ] = useState(true)

  const [
    isCreatingGradeEncryptionKey,
    setIsCreatingGradeEncryptionKey,
  ] = useState(false)

  const [
    gradeRecoveryCode,
    setGradeRecoveryCode,
  ] = useState<string | null>(null)

  const [
    recoveryCodeInput,
    setRecoveryCodeInput,
  ] = useState('')

  const [
    gradeEncryptionError,
    setGradeEncryptionError,
  ] = useState<string | null>(null)

  const [
    gradeEncryptionSuccess,
    setGradeEncryptionSuccess,
  ] = useState<string | null>(null)

  const [
    hasCopiedRecoveryCode,
    setHasCopiedRecoveryCode,
  ] = useState(false)

  useEffect(() => {
    let isCancelled = false

    async function checkGradeEncryptionKey() {
      setIsCheckingGradeEncryptionKey(true)

      try {
        const key =
          await getStoredGradeKey(user.id)

        if (!isCancelled) {
          setHasGradeEncryptionKey(
            key !== null,
          )
        }
      } catch (error) {
        if (!isCancelled) {
          setHasGradeEncryptionKey(false)

          if (error instanceof Error) {
            setGradeEncryptionError(
              error.message,
            )
          } else {
            setGradeEncryptionError(
              '성적 암호화 키 상태를 확인하지 못했습니다.',
            )
          }
        }
      } finally {
        if (!isCancelled) {
          setIsCheckingGradeEncryptionKey(
            false,
          )
        }
      }
    }

    void checkGradeEncryptionKey()

    return () => {
      isCancelled = true
    }
  }, [user.id])

// 성적 암호화 키 생성함수

  async function handleCreateGradeEncryptionKey() {
    setIsCreatingGradeEncryptionKey(true)
    setGradeEncryptionError(null)
    setGradeEncryptionSuccess(null)
    setHasCopiedRecoveryCode(false)

    try {
      const {
        recoveryCode,
      } = await createGradeKey(
        user.id,
      )

      setHasGradeEncryptionKey(true)
      setGradeRecoveryCode(
        recoveryCode,
      )

      setGradeEncryptionSuccess(
        '성적 암호화 키가 생성되었습니다. 아래 복구 코드를 반드시 별도로 보관해 주세요.',
      )
    } catch (error) {
      if (error instanceof Error) {
        setGradeEncryptionError(
          error.message,
        )
      } else {
        setGradeEncryptionError(
          '성적 암호화 키를 생성하지 못했습니다.',
        )
      }
    } finally {
      setIsCreatingGradeEncryptionKey(false)
    }
  }

// 복구용 코드 복원함수 

  async function handleRestoreGradeEncryptionKey(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (
      recoveryCodeInput.trim() === ''
    ) {
      setGradeEncryptionError(
        '성적 복구 코드를 입력해 주세요.',
      )
      setGradeEncryptionSuccess(null)
      return
    }

    setGradeEncryptionError(null)
    setGradeEncryptionSuccess(null)

    try {
      await restoreGradeKey(
        user.id,
        recoveryCodeInput,
      )

      setHasGradeEncryptionKey(true)
      setRecoveryCodeInput('')

      setGradeEncryptionSuccess(
        '성적 암호화 키를 이 브라우저에 복원했습니다.',
      )
    } catch (error) {
      if (error instanceof Error) {
        setGradeEncryptionError(
          error.message,
        )
      } else {
        setGradeEncryptionError(
          '성적 암호화 키를 복원하지 못했습니다.',
        )
      }
    }
  }

// 복구 코드 복사 함수

  async function handleCopyGradeRecoveryCode() {
    if (gradeRecoveryCode === null) {
      return
    }

    try {
      await navigator.clipboard.writeText(
        gradeRecoveryCode,
      )

      setHasCopiedRecoveryCode(true)
    } catch {
      setGradeEncryptionError(
        '복구 코드를 클립보드에 복사하지 못했습니다. 직접 선택해서 복사해 주세요.',
      )
    }
  }

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

                <option value="2023">
                  2023학번
                </option>

                <option value="2024">
                  2024학번
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
          <h2>성적 개인정보 보호</h2>

          <p>
            성적을 사용자 브라우저에서
            암호화하기 위한 개인 암호화 키를
            관리합니다.
          </p>
        </div>

        <div className="account-setting-row">
          <div>
            <strong>
              성적 암호화 키
            </strong>

            <span>
              {isCheckingGradeEncryptionKey
                ? '암호화 키 상태를 확인하고 있습니다.'
                : hasGradeEncryptionKey
                  ? '이 브라우저에 성적 암호화 키가 준비되어 있습니다.'
                  : '이 브라우저에는 아직 성적 암호화 키가 없습니다.'}
            </span>
          </div>

          {!isCheckingGradeEncryptionKey &&
            !hasGradeEncryptionKey && (
              <button
                className="secondary-button"
                type="button"
                disabled={
                  isCreatingGradeEncryptionKey
                }
                onClick={() => {
                  void handleCreateGradeEncryptionKey()
                }}
              >
                {isCreatingGradeEncryptionKey
                  ? '생성 중...'
                  : '새 암호화 키 생성'}
              </button>
            )}
        </div>

        {gradeRecoveryCode !== null && (
          <div className="account-academic-form">
            <div className="account-section-heading">
              <h3>복구 코드</h3>

              <p>
                이 코드는 서버에 저장되지 않습니다.
                다른 기기에서 성적을 복호화하려면
                반드시 필요합니다.
              </p>
            </div>

            <div className="account-academic-field">
              <label htmlFor="grade-recovery-code">
                성적 복구 코드
              </label>

              <textarea
                id="grade-recovery-code"
                value={gradeRecoveryCode}
                readOnly
                rows={3}
              />
            </div>

            <div className="account-academic-actions">
              <span>
                {hasCopiedRecoveryCode
                  ? '복사되었습니다.'
                  : '비밀번호 관리자 등 안전한 곳에 보관해 주세요.'}
              </span>

              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  void handleCopyGradeRecoveryCode()
                }}
              >
                복구 코드 복사
              </button>
            </div>
          </div>
        )}

        {!hasGradeEncryptionKey &&
          !isCheckingGradeEncryptionKey && (
            <form
              className="account-academic-form"
              onSubmit={
                handleRestoreGradeEncryptionKey
              }
            >
              <div className="account-section-heading">
                <h3>기존 암호화 키 복원</h3>

                <p>
                  다른 브라우저나 기기에서
                  사용하던 복구 코드가 있다면
                  여기에서 복원할 수 있습니다.
                </p>
              </div>

              <div className="account-academic-field">
                <label htmlFor="grade-recovery-code-input">
                  복구 코드
                </label>

                <input
                  id="grade-recovery-code-input"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={recoveryCodeInput}
                  onChange={(event) => {
                    setRecoveryCodeInput(
                      event.target.value,
                    )
                    setGradeEncryptionError(null)
                    setGradeEncryptionSuccess(null)
                  }}
                  placeholder="INYAK-GRADE-V1-..."
                />
              </div>

              <div className="account-academic-actions">
                <div />

                <button
                  className="secondary-button"
                  type="submit"
                >
                  복구 코드로 복원
                </button>
              </div>
            </form>
          )}

        {gradeEncryptionError !== null && (
          <p
            className="
              account-academic-message
              account-academic-message--error
            "
            role="alert"
          >
            {gradeEncryptionError}
          </p>
        )}

        {gradeEncryptionSuccess !== null && (
          <p
            className="
              account-academic-message
              account-academic-message--success
            "
            role="status"
          >
            {gradeEncryptionSuccess}
          </p>
        )}
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
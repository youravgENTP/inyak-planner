const GRADE_CRYPTO_VERSION = 1

const GRADE_KEY_DATABASE_NAME =
  'inyak-private-data'

const GRADE_KEY_DATABASE_VERSION = 1

const GRADE_KEY_STORE_NAME =
  'grade-keys'

const GRADE_RECOVERY_CODE_PREFIX =
  'INYAK-GRADE-V1-'

const AES_KEY_LENGTH_BYTES = 32

const AES_GCM_IV_LENGTH_BYTES = 12


interface StoredGradeKey {
  userId: string
  key: CryptoKey
}


export interface EncryptedLetterGrade {
  ciphertext: string
  iv: string
  cryptoVersion: number
}


function bytesToBase64Url(
  bytes: Uint8Array,
): string {
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}


function base64UrlToBytes(
  value: string,
): Uint8Array {
  const normalizedValue = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const paddingLength =
    (4 - (
      normalizedValue.length % 4
    )) % 4

  const paddedValue =
    normalizedValue +
    '='.repeat(paddingLength)

  const binary = atob(paddedValue)

  const bytes = new Uint8Array(
    binary.length,
  )

  for (
    let index = 0;
    index < binary.length;
    index += 1
  ) {
    bytes[index] =
      binary.charCodeAt(index)
  }

  return bytes
}


function toArrayBuffer(
  bytes: Uint8Array,
): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset +
      bytes.byteLength,
  ) as ArrayBuffer
}


function openGradeKeyDatabase():
  Promise<IDBDatabase> {
  return new Promise(
    (resolve, reject) => {
      const request =
        indexedDB.open(
          GRADE_KEY_DATABASE_NAME,
          GRADE_KEY_DATABASE_VERSION,
        )

      request.onupgradeneeded = () => {
        const database =
          request.result

        if (
          !database.objectStoreNames
            .contains(
              GRADE_KEY_STORE_NAME,
            )
        ) {
          database.createObjectStore(
            GRADE_KEY_STORE_NAME,
            {
              keyPath: 'userId',
            },
          )
        }
      }

      request.onsuccess = () => {
        resolve(request.result)
      }

      request.onerror = () => {
        reject(
          request.error ??
            new Error(
              '성적 암호화 키 저장소를 열지 못했습니다.',
            ),
        )
      }
    },
  )
}


async function saveGradeKey(
  userId: string,
  key: CryptoKey,
): Promise<void> {
  const database =
    await openGradeKeyDatabase()

  try {
    await new Promise<void>(
      (resolve, reject) => {
        const transaction =
          database.transaction(
            GRADE_KEY_STORE_NAME,
            'readwrite',
          )

        const store =
          transaction.objectStore(
            GRADE_KEY_STORE_NAME,
          )

        const storedKey:
          StoredGradeKey = {
            userId,
            key,
          }

        store.put(storedKey)

        transaction.oncomplete = () => {
          resolve()
        }

        transaction.onerror = () => {
          reject(
            transaction.error ??
              new Error(
                '성적 암호화 키를 저장하지 못했습니다.',
              ),
          )
        }

        transaction.onabort = () => {
          reject(
            transaction.error ??
              new Error(
                '성적 암호화 키 저장이 중단되었습니다.',
              ),
          )
        }
      },
    )
  } finally {
    database.close()
  }
}


export async function getStoredGradeKey(
  userId: string,
): Promise<CryptoKey | null> {
  const database =
    await openGradeKeyDatabase()

  try {
    return await new Promise(
      (resolve, reject) => {
        const transaction =
          database.transaction(
            GRADE_KEY_STORE_NAME,
            'readonly',
          )

        const store =
          transaction.objectStore(
            GRADE_KEY_STORE_NAME,
          )

        const request =
          store.get(userId)

        request.onsuccess = () => {
          const result =
            request.result as
              StoredGradeKey |
              undefined

          resolve(
            result?.key ?? null,
          )
        }

        request.onerror = () => {
          reject(
            request.error ??
              new Error(
                '성적 암호화 키를 불러오지 못했습니다.',
              ),
          )
        }
      },
    )
  } finally {
    database.close()
  }
}


async function importRawGradeKey(
  rawKey: Uint8Array,
): Promise<CryptoKey> {
  if (
    rawKey.byteLength !==
    AES_KEY_LENGTH_BYTES
  ) {
    throw new Error(
      '유효하지 않은 성적 복구 코드입니다.',
    )
  }

  return crypto.subtle.importKey(
    'raw',
    toArrayBuffer(rawKey),
    {
      name: 'AES-GCM',
    },
    false,
    [
      'encrypt',
      'decrypt',
    ],
  )
}


export async function createGradeKey(
  userId: string,
): Promise<{
  key: CryptoKey
  recoveryCode: string
}> {
  const existingKey =
    await getStoredGradeKey(userId)

  if (existingKey !== null) {
    throw new Error(
      '이 사용자에게는 이미 성적 암호화 키가 있습니다.',
    )
  }

  const rawKey =
    crypto.getRandomValues(
      new Uint8Array(
        AES_KEY_LENGTH_BYTES,
      ),
    )

  const key =
    await importRawGradeKey(
      rawKey,
    )

  await saveGradeKey(
    userId,
    key,
  )

  return {
    key,
    recoveryCode:
      GRADE_RECOVERY_CODE_PREFIX +
      bytesToBase64Url(rawKey),
  }
}


export async function restoreGradeKey(
  userId: string,
  recoveryCode: string,
): Promise<CryptoKey> {
  const normalizedCode =
    recoveryCode.trim()

  if (
    !normalizedCode.startsWith(
      GRADE_RECOVERY_CODE_PREFIX,
    )
  ) {
    throw new Error(
      '유효하지 않은 성적 복구 코드입니다.',
    )
  }

  const encodedKey =
    normalizedCode.slice(
      GRADE_RECOVERY_CODE_PREFIX.length,
    )

  const rawKey =
    base64UrlToBytes(
      encodedKey,
    )

  const key =
    await importRawGradeKey(
      rawKey,
    )

  await saveGradeKey(
    userId,
    key,
  )

  return key
}


export async function encryptLetterGrade(
  key: CryptoKey,
  letterGrade: string,
): Promise<EncryptedLetterGrade> {
  const iv =
    crypto.getRandomValues(
      new Uint8Array(
        AES_GCM_IV_LENGTH_BYTES,
      ),
    )

  const plaintext =
    new TextEncoder().encode(
      letterGrade,
    )

  const ciphertext =
    await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      plaintext,
    )

  return {
    ciphertext:
      bytesToBase64Url(
        new Uint8Array(
          ciphertext,
        ),
      ),
    iv:
      bytesToBase64Url(iv),
    cryptoVersion:
      GRADE_CRYPTO_VERSION,
  }
}


export async function decryptLetterGrade(
  key: CryptoKey,
  encryptedGrade:
    EncryptedLetterGrade,
): Promise<string> {
  if (
    encryptedGrade.cryptoVersion !==
    GRADE_CRYPTO_VERSION
  ) {
    throw new Error(
      '지원하지 않는 성적 암호화 버전입니다.',
    )
  }

  const iv =
    base64UrlToBytes(
      encryptedGrade.iv,
    )

  const ciphertext =
    base64UrlToBytes(
      encryptedGrade.ciphertext,
    )

  try {
    const plaintext =
      await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv:
            toArrayBuffer(iv),
        },
        key,
        toArrayBuffer(
          ciphertext,
        ),
      )

    return new TextDecoder().decode(
      plaintext,
    )
  } catch {
    throw new Error(
      '성적을 복호화하지 못했습니다. 복구 코드가 올바른지 확인해주세요.',
    )
  }
}
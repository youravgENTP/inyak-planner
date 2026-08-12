from __future__ import annotations

import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import (
    AESGCM,
)


GRADE_CRYPTO_VERSION = 2

GRADE_CRYPTO_KEY_ENV_NAME = (
    "GRADE_ENCRYPTION_KEY"
)

AES_KEY_LENGTH_BYTES = 32

AES_GCM_NONCE_LENGTH_BYTES = 12


def _decode_base64url(
    value: str,
) -> bytes:
    """Base64 URL-safe 문자열을 bytes로 변환한다."""
    padding_length = (
        4 - len(value) % 4
    ) % 4

    padded_value = (
        value +
        "=" * padding_length
    )

    try:
        return base64.urlsafe_b64decode(
            padded_value.encode("ascii")
        )
    except Exception as error:
        raise RuntimeError(
            "GRADE_ENCRYPTION_KEY 형식이 "
            "올바르지 않습니다."
        ) from error


def _encode_base64url(
    value: bytes,
) -> str:
    """bytes를 padding 없는 Base64 URL-safe 문자열로 변환한다."""
    return (
        base64.urlsafe_b64encode(
            value
        )
        .decode("ascii")
        .rstrip("=")
    )


def _get_grade_encryption_key() -> bytes:
    """
    환경변수에서 성적 암호화 키를 읽는다.

    키는 32-byte AES-256 키를
    Base64 URL-safe 형식으로 저장한다.
    """
    encoded_key = os.getenv(
        GRADE_CRYPTO_KEY_ENV_NAME
    )

    if (
        encoded_key is None
        or encoded_key.strip() == ""
    ):
        raise RuntimeError(
            "GRADE_ENCRYPTION_KEY 환경변수가 "
            "설정되어 있지 않습니다."
        )

    key = _decode_base64url(
        encoded_key.strip()
    )

    if len(key) != AES_KEY_LENGTH_BYTES:
        raise RuntimeError(
            "GRADE_ENCRYPTION_KEY는 "
            "32-byte AES-256 키여야 합니다."
        )

    return key


def encrypt_letter_grade(
    letter_grade: str,
) -> dict[str, str | int]:
    """
    평문 성적을 AES-256-GCM으로 암호화한다.

    반환값은 DB에 저장할 ciphertext,
    IV(nonce), crypto version이다.
    """
    key = _get_grade_encryption_key()

    nonce = os.urandom(
        AES_GCM_NONCE_LENGTH_BYTES
    )

    aes_gcm = AESGCM(key)

    ciphertext = aes_gcm.encrypt(
        nonce,
        letter_grade.encode("utf-8"),
        None,
    )

    return {
        "ciphertext":
            _encode_base64url(
                ciphertext
            ),
        "iv":
            _encode_base64url(
                nonce
            ),
        "crypto_version":
            GRADE_CRYPTO_VERSION,
    }


def decrypt_letter_grade(
    *,
    ciphertext: str,
    iv: str,
    crypto_version: int,
) -> str:
    """
    DB에 저장된 성적 암호문을
    서버에서 복호화한다.
    """
    if (
        crypto_version
        != GRADE_CRYPTO_VERSION
    ):
        raise RuntimeError(
            "지원하지 않는 성적 암호화 "
            "버전입니다."
        )

    key = _get_grade_encryption_key()

    encrypted_bytes = (
        _decode_base64url(
            ciphertext
        )
    )

    nonce = _decode_base64url(iv)

    if (
        len(nonce)
        != AES_GCM_NONCE_LENGTH_BYTES
    ):
        raise RuntimeError(
            "성적 암호화 IV 형식이 "
            "올바르지 않습니다."
        )

    aes_gcm = AESGCM(key)

    try:
        plaintext = aes_gcm.decrypt(
            nonce,
            encrypted_bytes,
            None,
        )
    except Exception as error:
        raise RuntimeError(
            "성적 데이터를 복호화하지 "
            "못했습니다."
        ) from error

    return plaintext.decode("utf-8")
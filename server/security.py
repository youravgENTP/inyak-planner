from __future__ import annotations

from pwdlib import PasswordHash


password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    """비밀번호를 안전한 해시 문자열로 변환한다."""
    return password_hash.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str,
) -> bool:
    """입력된 비밀번호가 저장된 해시와 일치하는지 확인한다."""
    return password_hash.verify(
        plain_password,
        hashed_password,
    )
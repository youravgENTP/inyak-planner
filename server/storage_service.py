from __future__ import annotations

import os

from supabase import Client, create_client


PROFILE_IMAGE_BUCKET = "profile-images"


def get_supabase_url() -> str:
    """Supabase 프로젝트 URL을 환경변수에서 읽는다."""
    value = os.environ.get(
        "SUPABASE_URL",
        "",
    ).strip()

    if not value:
        raise RuntimeError(
            "SUPABASE_URL 환경변수가 설정되어 있지 않습니다."
        )

    return value


def get_supabase_secret_key() -> str:
    """서버용 Supabase Secret key를 환경변수에서 읽는다."""
    value = os.environ.get(
        "SUPABASE_SECRET_KEY",
        "",
    ).strip()

    if not value:
        raise RuntimeError(
            "SUPABASE_SECRET_KEY 환경변수가 설정되어 있지 않습니다."
        )

    return value


def get_supabase_client() -> Client:
    """서버용 Supabase client를 생성한다."""
    return create_client(
        get_supabase_url(),
        get_supabase_secret_key(),
    )


def upload_profile_image(
    *,
    filename: str,
    image_bytes: bytes,
    content_type: str,
) -> None:
    """프로필 이미지를 Storage bucket에 업로드한다."""
    client = get_supabase_client()

    client.storage.from_(
        PROFILE_IMAGE_BUCKET
    ).upload(
        path=filename,
        file=image_bytes,
        file_options={
            "content-type": content_type,
            "cache-control": "3600",
            "upsert": "false",
        },
    )


def delete_profile_image(
    filename: str,
) -> None:
    """Storage에서 프로필 이미지를 삭제한다."""
    client = get_supabase_client()

    client.storage.from_(
        PROFILE_IMAGE_BUCKET
    ).remove(
        [filename]
    )


def get_profile_image_public_url(
    filename: str,
) -> str:
    """공개 profile-images bucket의 이미지 URL을 반환한다."""
    client = get_supabase_client()

    return client.storage.from_(
        PROFILE_IMAGE_BUCKET
    ).get_public_url(
        filename
    )
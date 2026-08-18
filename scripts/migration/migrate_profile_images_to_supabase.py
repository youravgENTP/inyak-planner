from __future__ import annotations

import mimetypes
import os
import sys
from pathlib import Path

from supabase import create_client


from scripts.common.data_paths import (
    PROFILE_IMAGE_DIRECTORY,
)

BUCKET_NAME = "profile-images"


def get_required_env(
    name: str,
) -> str:
    value = os.environ.get(
        name,
        "",
    ).strip()

    if not value:
        raise RuntimeError(
            f"{name} 환경변수가 없습니다."
        )

    return value


def migrate() -> None:
    supabase_url = get_required_env(
        "SUPABASE_URL"
    )

    supabase_secret_key = (
        get_required_env(
            "SUPABASE_SECRET_KEY"
        )
    )

    if not PROFILE_IMAGE_DIRECTORY.is_dir():
        raise RuntimeError(
            "프로필 이미지 디렉토리를 "
            "찾을 수 없습니다."
        )

    files = [
        path
        for path
        in PROFILE_IMAGE_DIRECTORY.iterdir()
        if path.is_file()
    ]

    if not files:
        print(
            "이전할 프로필 이미지가 없습니다."
        )
        return

    print(
        f"Profile images found: "
        f"{len(files)}"
    )

    client = create_client(
        supabase_url,
        supabase_secret_key,
    )

    uploaded_count = 0

    for path in files:
        mime_type, _ = (
            mimetypes.guess_type(
                path.name
            )
        )

        if mime_type is None:
            raise RuntimeError(
                f"MIME type을 판별할 수 없습니다: "
                f"{path.name}"
            )

        with path.open(
            "rb"
        ) as file:
            file_bytes = file.read()

        print(
            f"Uploading: {path.name}"
        )

        client.storage.from_(
            BUCKET_NAME
        ).upload(
            path=path.name,
            file=file_bytes,
            file_options={
                "content-type": mime_type,
                "upsert": "false",
            },
        )

        uploaded_count += 1

        print(
            f"[OK] {path.name}"
        )

    print()
    print(
        "Profile image migration completed."
    )
    print(
        f"Total files uploaded: "
        f"{uploaded_count}"
    )


def main() -> None:
    try:
        migrate()

    except Exception as error:
        print()
        print(
            "Migration failed:",
            file=sys.stderr,
        )
        print(
            str(error),
            file=sys.stderr,
        )

        sys.exit(1)


if __name__ == "__main__":
    main()
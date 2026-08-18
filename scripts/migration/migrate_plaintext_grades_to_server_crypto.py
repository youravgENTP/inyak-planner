from __future__ import annotations

from server.auth_database import (
    connect_auth_database,
)
from server.grade_crypto import (
    decrypt_letter_grade,
    encrypt_letter_grade,
)


def main() -> None:
    """
    기존 평문 letter_grade 데이터를
    서버 측 AES-GCM version 2 형식으로
    일괄 migration한다.

    migration은 하나의 DB transaction에서
    수행하며, 중간 오류가 발생하면
    전체 작업을 rollback한다.
    """

    with connect_auth_database() as connection:
        rows = connection.execute(
            """
            SELECT
                id,
                letter_grade
            FROM public.user_course_records
            WHERE
                letter_grade IS NOT NULL
                AND letter_grade_ciphertext IS NULL
                AND letter_grade_iv IS NULL
                AND letter_grade_crypto_version IS NULL
            ORDER BY id
            """
        ).fetchall()

        print(
            f"migration 대상: {len(rows)}개"
        )

        migrated_count = 0

        for row in rows:
            letter_grade = row[
                "letter_grade"
            ]

            if not isinstance(
                letter_grade,
                str,
            ):
                raise RuntimeError(
                    "평문 성적 데이터 형식이 "
                    "올바르지 않습니다."
                )

            encrypted_grade = (
                encrypt_letter_grade(
                    letter_grade
                )
            )

            ciphertext = str(
                encrypted_grade[
                    "ciphertext"
                ]
            )

            iv = str(
                encrypted_grade["iv"]
            )

            crypto_version = int(
                encrypted_grade[
                    "crypto_version"
                ]
            )

            # DB에 쓰기 전에 즉시 복호화하여
            # 원본과 정확히 같은지 확인한다.
            verified_grade = (
                decrypt_letter_grade(
                    ciphertext=ciphertext,
                    iv=iv,
                    crypto_version=(
                        crypto_version
                    ),
                )
            )

            if verified_grade != letter_grade:
                raise RuntimeError(
                    "암호화 검증에 "
                    "실패했습니다."
                )

            cursor = connection.execute(
                """
                UPDATE public.user_course_records
                SET
                    letter_grade_ciphertext = %s,
                    letter_grade_iv = %s,
                    letter_grade_crypto_version = %s,
                    letter_grade = NULL
                WHERE
                    id = %s
                    AND letter_grade IS NOT NULL
                    AND letter_grade_ciphertext IS NULL
                    AND letter_grade_iv IS NULL
                    AND letter_grade_crypto_version IS NULL
                """,
                (
                    ciphertext,
                    iv,
                    crypto_version,
                    row["id"],
                ),
            )

            if cursor.rowcount != 1:
                raise RuntimeError(
                    "성적 migration 중 "
                    "예상하지 못한 DB 상태가 "
                    "발견되었습니다."
                )

            migrated_count += 1

        remaining_count = (
            connection.execute(
                """
                SELECT COUNT(*) AS count
                FROM public.user_course_records
                WHERE letter_grade IS NOT NULL
                """
            )
            .fetchone()["count"]
        )

        if remaining_count != 0:
            raise RuntimeError(
                "migration 후에도 평문 "
                f"성적이 {remaining_count}개 "
                "남아 있습니다."
            )

        print(
            f"migration 완료: "
            f"{migrated_count}개"
        )
        print(
            "남은 평문 성적: 0개"
        )


if __name__ == "__main__":
    main()
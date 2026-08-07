from __future__ import annotations

import argparse
import csv
from pathlib import Path
from typing import Any, Dict, List

from server.database import (
    connect_database,
    ensure_general_education_course_mapping_table,
)


PROJECT_ROOT = Path(__file__).resolve().parents[1]

DEFAULT_INPUT_PATH = (
    PROJECT_ROOT
    / "data"
    / "general_education_course_mappings.csv"
)

REQUIRED_COLUMNS = {
    "entry_year",
    "category",
    "area_name",
    "course_code",
    "course_name",
    "notes",
}

VALID_CATEGORIES = {
    "기초교양",
    "균형교양",
}


def normalize_optional_text(
    value: str | None,
) -> str | None:
    if value is None:
        return None

    normalized = value.strip()

    return (
        normalized
        if normalized
        else None
    )


def load_rows(
    input_path: Path,
) -> List[Dict[str, str]]:
    if not input_path.exists():
        raise FileNotFoundError(
            f"입력 파일을 찾을 수 없습니다: "
            f"{input_path}"
        )

    with input_path.open(
        "r",
        encoding="utf-8-sig",
        newline="",
    ) as file:
        reader = csv.DictReader(file)

        fieldnames = set(
            reader.fieldnames or []
        )

        missing_columns = (
            REQUIRED_COLUMNS -
            fieldnames
        )

        if missing_columns:
            missing_text = ", ".join(
                sorted(missing_columns)
            )

            raise ValueError(
                "CSV 필수 열이 없습니다: "
                f"{missing_text}"
            )

        return [
            dict(row)
            for row in reader
        ]


def resolve_area_id(
    *,
    connection: Any,
    entry_year: int,
    category: str,
    area_name: str,
) -> int:
    rows = connection.execute(
        """
        SELECT
            area.id
        FROM general_education_areas
        AS area
        JOIN general_education_requirements
        AS requirement
            ON requirement.id =
               area.requirement_id
        WHERE
            requirement.entry_year = ?
            AND requirement.category = ?
            AND area.area_name = ?
        """,
        (
            entry_year,
            category,
            area_name,
        ),
    ).fetchall()

    if len(rows) == 0:
        raise ValueError(
            "교양영역을 찾을 수 없습니다: "
            f"{entry_year}학번 / "
            f"{category} / "
            f"{area_name}"
        )

    if len(rows) > 1:
        raise ValueError(
            "교양영역이 중복되어 있습니다: "
            f"{entry_year}학번 / "
            f"{category} / "
            f"{area_name}"
        )

    return int(rows[0]["id"])


def find_existing_mapping(
    *,
    connection: Any,
    area_id: int,
    course_code: str | None,
    course_name: str,
) -> Any:
    if course_code is None:
        return connection.execute(
            """
            SELECT
                id,
                notes
            FROM
                general_education_course_mappings
            WHERE
                area_id = ?
                AND course_code IS NULL
                AND course_name = ?
            """,
            (
                area_id,
                course_name,
            ),
        ).fetchone()

    return connection.execute(
        """
        SELECT
            id,
            notes
        FROM
            general_education_course_mappings
        WHERE
            area_id = ?
            AND course_code = ?
            AND course_name = ?
        """,
        (
            area_id,
            course_code,
            course_name,
        ),
    ).fetchone()


def import_mappings(
    *,
    input_path: Path,
    dry_run: bool,
) -> None:
    rows = load_rows(
        input_path
    )

    ensure_general_education_course_mapping_table()

    inserted_count = 0
    updated_count = 0
    unchanged_count = 0

    with connect_database() as connection:
        prepared_rows = []

        for row_number, row in enumerate(
            rows,
            start=2,
        ):
            entry_year_text = (
                row["entry_year"].strip()
            )

            category = (
                row["category"].strip()
            )

            area_name = (
                row["area_name"].strip()
            )

            course_code = (
                normalize_optional_text(
                    row["course_code"]
                )
            )

            course_name = (
                row["course_name"].strip()
            )

            notes = (
                normalize_optional_text(
                    row["notes"]
                )
            )

            if not entry_year_text:
                raise ValueError(
                    f"{row_number}행: "
                    "entry_year가 비어 있습니다."
                )

            try:
                entry_year = int(
                    entry_year_text
                )
            except ValueError as error:
                raise ValueError(
                    f"{row_number}행: "
                    "entry_year는 정수여야 합니다."
                ) from error

            if category not in VALID_CATEGORIES:
                raise ValueError(
                    f"{row_number}행: "
                    "category는 "
                    "'기초교양' 또는 "
                    "'균형교양'이어야 합니다."
                )

            if not area_name:
                raise ValueError(
                    f"{row_number}행: "
                    "area_name이 비어 있습니다."
                )

            if not course_name:
                raise ValueError(
                    f"{row_number}행: "
                    "course_name이 비어 있습니다."
                )

            area_id = resolve_area_id(
                connection=connection,
                entry_year=entry_year,
                category=category,
                area_name=area_name,
            )

            prepared_rows.append(
                {
                    "area_id": area_id,
                    "course_code":
                        course_code,
                    "course_name":
                        course_name,
                    "notes": notes,
                }
            )

        for row in prepared_rows:
            existing = (
                find_existing_mapping(
                    connection=connection,
                    area_id=row["area_id"],
                    course_code=(
                        row["course_code"]
                    ),
                    course_name=(
                        row["course_name"]
                    ),
                )
            )

            if existing is None:
                inserted_count += 1

                if not dry_run:
                    connection.execute(
                        """
                        INSERT INTO
                            general_education_course_mappings (
                                area_id,
                                course_code,
                                course_name,
                                notes
                            )
                        VALUES (?, ?, ?, ?)
                        """,
                        (
                            row["area_id"],
                            row["course_code"],
                            row["course_name"],
                            row["notes"],
                        ),
                    )

                continue

            if (
                existing["notes"]
                == row["notes"]
            ):
                unchanged_count += 1
                continue

            updated_count += 1

            if not dry_run:
                connection.execute(
                    """
                    UPDATE
                        general_education_course_mappings
                    SET
                        notes = ?
                    WHERE id = ?
                    """,
                    (
                        row["notes"],
                        existing["id"],
                    ),
                )

        if dry_run:
            connection.rollback()
        else:
            connection.commit()

    mode_text = (
        "DRY RUN"
        if dry_run
        else "IMPORT"
    )

    print(
        f"[{mode_text}] "
        f"입력 {len(rows)}건 / "
        f"추가 {inserted_count}건 / "
        f"수정 {updated_count}건 / "
        f"변경 없음 {unchanged_count}건"
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "학번별 교양 과목-영역 매핑을 "
            "inyak.db에 가져옵니다."
        )
    )

    parser.add_argument(
        "input_path",
        nargs="?",
        type=Path,
        default=DEFAULT_INPUT_PATH,
        help=(
            "CSV 파일 경로 "
            "(기본값: "
            "data/general_education_course_mappings.csv)"
        ),
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help=(
            "검증만 수행하고 "
            "DB에는 저장하지 않습니다."
        ),
    )

    arguments = (
        parser.parse_args()
    )

    input_path = (
        arguments.input_path
    )

    if not input_path.is_absolute():
        input_path = (
            PROJECT_ROOT
            / input_path
        )

    import_mappings(
        input_path=input_path,
        dry_run=arguments.dry_run,
    )


if __name__ == "__main__":
    main()
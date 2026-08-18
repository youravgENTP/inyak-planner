"""Import cohort general-education requirements into inyak.db.

Run from the project root:

    python scripts/import_general_education.py \
        data/seed/genera_education/general_education_requirements_2024.csv \
        data/seed/genera_education/general_education_areas_2024.csv

The import replaces only the general-education rows for the
entry year contained in the CSV files.
"""

from __future__ import annotations

import argparse
import csv
import sqlite3
from dataclasses import dataclass
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DB_PATH = PROJECT_ROOT / "data" / "db" / "inyak.db"

REQUIREMENT_COLUMNS = {
    "entry_year",
    "category",
    "minimum_credits",
    "minimum_area_count",
    "notes",
    "display_order",
}

AREA_COLUMNS = {
    "entry_year",
    "category",
    "area_name",
    "minimum_credits",
    "is_required",
    "notes",
    "display_order",
}

VALID_CATEGORIES = {
    "기초교양",
    "균형교양",
}

EXPECTED_2024_REQUIREMENT_COUNT = 2
EXPECTED_2024_AREA_COUNT = 12
EXPECTED_2024_BASIC_CREDITS = 18.0
EXPECTED_2024_BALANCED_CREDITS = 18.0
EXPECTED_2024_BALANCED_AREA_COUNT = 3


@dataclass(frozen=True)
class GeneralEducationRequirement:
    entry_year: int
    category: str
    minimum_credits: float
    minimum_area_count: int | None
    notes: str | None
    display_order: int


@dataclass(frozen=True)
class GeneralEducationArea:
    entry_year: int
    category: str
    area_name: str
    minimum_credits: float | None
    is_required: bool
    notes: str | None
    display_order: int


def clean_optional_text(
    value: str | None,
) -> str | None:
    if value is None:
        return None

    cleaned = value.strip()
    return cleaned or None


def parse_float(
    value: str | None,
    *,
    field_name: str,
    row_number: int,
) -> float:
    cleaned = clean_optional_text(value)

    if cleaned is None:
        raise ValueError(
            f"{row_number}행의 "
            f"{field_name}이 비어 있습니다."
        )

    try:
        parsed = float(cleaned)
    except ValueError as exc:
        raise ValueError(
            f"{row_number}행의 "
            f"{field_name}이 숫자가 아닙니다: "
            f"{cleaned}"
        ) from exc

    if parsed < 0:
        raise ValueError(
            f"{row_number}행의 "
            f"{field_name}은 0 이상이어야 합니다."
        )

    return parsed


def parse_optional_float(
    value: str | None,
    *,
    field_name: str,
    row_number: int,
) -> float | None:
    cleaned = clean_optional_text(value)

    if cleaned is None:
        return None

    return parse_float(
        cleaned,
        field_name=field_name,
        row_number=row_number,
    )


def parse_integer(
    value: str | None,
    *,
    field_name: str,
    row_number: int,
) -> int:
    cleaned = clean_optional_text(value)

    if cleaned is None:
        raise ValueError(
            f"{row_number}행의 "
            f"{field_name}이 비어 있습니다."
        )

    try:
        parsed = int(cleaned)
    except ValueError as exc:
        raise ValueError(
            f"{row_number}행의 "
            f"{field_name}이 정수가 아닙니다: "
            f"{cleaned}"
        ) from exc

    return parsed


def parse_optional_integer(
    value: str | None,
    *,
    field_name: str,
    row_number: int,
) -> int | None:
    cleaned = clean_optional_text(value)

    if cleaned is None:
        return None

    return parse_integer(
        cleaned,
        field_name=field_name,
        row_number=row_number,
    )


def validate_category(
    category: str,
    *,
    row_number: int,
) -> None:
    if category not in VALID_CATEGORIES:
        raise ValueError(
            f"{row_number}행의 category가 "
            f"잘못됐습니다: {category}"
        )


def load_csv_rows(
    csv_path: Path,
    *,
    required_columns: set[str],
) -> list[tuple[int, dict[str, str]]]:
    with csv_path.open(
        "r",
        encoding="utf-8-sig",
        newline="",
    ) as file:
        reader = csv.DictReader(file)

        if reader.fieldnames is None:
            raise ValueError(
                f"CSV 헤더가 없습니다: {csv_path}"
            )

        actual_columns = set(reader.fieldnames)
        missing_columns = (
            required_columns - actual_columns
        )

        if missing_columns:
            missing_text = ", ".join(
                sorted(missing_columns)
            )

            raise ValueError(
                f"CSV 필수 칼럼이 없습니다: "
                f"{missing_text}"
            )

        rows = [
            (row_number, row)
            for row_number, row in enumerate(
                reader,
                start=2,
            )
        ]

    if not rows:
        raise ValueError(
            f"CSV에 데이터 행이 없습니다: "
            f"{csv_path}"
        )

    return rows


def parse_requirement_row(
    row: dict[str, str],
    *,
    row_number: int,
) -> GeneralEducationRequirement:
    entry_year = parse_integer(
        row["entry_year"],
        field_name="entry_year",
        row_number=row_number,
    )

    category = row["category"].strip()
    validate_category(
        category,
        row_number=row_number,
    )

    minimum_credits = parse_float(
        row["minimum_credits"],
        field_name="minimum_credits",
        row_number=row_number,
    )

    minimum_area_count = parse_optional_integer(
        row["minimum_area_count"],
        field_name="minimum_area_count",
        row_number=row_number,
    )

    display_order = parse_integer(
        row["display_order"],
        field_name="display_order",
        row_number=row_number,
    )

    if minimum_area_count is not None:
        if minimum_area_count < 0:
            raise ValueError(
                f"{row_number}행의 "
                "minimum_area_count는 "
                "0 이상이어야 합니다."
            )

    if display_order < 0:
        raise ValueError(
            f"{row_number}행의 "
            "display_order는 "
            "0 이상이어야 합니다."
        )

    return GeneralEducationRequirement(
        entry_year=entry_year,
        category=category,
        minimum_credits=minimum_credits,
        minimum_area_count=minimum_area_count,
        notes=clean_optional_text(
            row["notes"]
        ),
        display_order=display_order,
    )


def parse_area_row(
    row: dict[str, str],
    *,
    row_number: int,
) -> GeneralEducationArea:
    entry_year = parse_integer(
        row["entry_year"],
        field_name="entry_year",
        row_number=row_number,
    )

    category = row["category"].strip()
    validate_category(
        category,
        row_number=row_number,
    )

    area_name = row["area_name"].strip()

    if not area_name:
        raise ValueError(
            f"{row_number}행의 "
            "area_name이 비어 있습니다."
        )

    minimum_credits = parse_optional_float(
        row["minimum_credits"],
        field_name="minimum_credits",
        row_number=row_number,
    )

    is_required_value = parse_integer(
        row["is_required"],
        field_name="is_required",
        row_number=row_number,
    )

    if is_required_value not in (0, 1):
        raise ValueError(
            f"{row_number}행의 "
            "is_required는 0 또는 1이어야 합니다."
        )

    display_order = parse_integer(
        row["display_order"],
        field_name="display_order",
        row_number=row_number,
    )

    if display_order < 0:
        raise ValueError(
            f"{row_number}행의 "
            "display_order는 "
            "0 이상이어야 합니다."
        )

    return GeneralEducationArea(
        entry_year=entry_year,
        category=category,
        area_name=area_name,
        minimum_credits=minimum_credits,
        is_required=bool(
            is_required_value
        ),
        notes=clean_optional_text(
            row["notes"]
        ),
        display_order=display_order,
    )


def load_requirements(
    csv_path: Path,
) -> list[GeneralEducationRequirement]:
    rows = load_csv_rows(
        csv_path,
        required_columns=REQUIREMENT_COLUMNS,
    )

    requirements = [
        parse_requirement_row(
            row,
            row_number=row_number,
        )
        for row_number, row in rows
    ]

    duplicate_keys: set[
        tuple[int, str]
    ] = set()

    seen_keys: set[
        tuple[int, str]
    ] = set()

    for requirement in requirements:
        key = (
            requirement.entry_year,
            requirement.category,
        )

        if key in seen_keys:
            duplicate_keys.add(key)

        seen_keys.add(key)

    if duplicate_keys:
        raise ValueError(
            "중복 교양 대분류가 있습니다: "
            f"{sorted(duplicate_keys)}"
        )

    return requirements


def load_areas(
    csv_path: Path,
) -> list[GeneralEducationArea]:
    rows = load_csv_rows(
        csv_path,
        required_columns=AREA_COLUMNS,
    )

    areas = [
        parse_area_row(
            row,
            row_number=row_number,
        )
        for row_number, row in rows
    ]

    duplicate_keys: set[
        tuple[int, str, str]
    ] = set()

    seen_keys: set[
        tuple[int, str, str]
    ] = set()

    for area in areas:
        key = (
            area.entry_year,
            area.category,
            area.area_name,
        )

        if key in seen_keys:
            duplicate_keys.add(key)

        seen_keys.add(key)

    if duplicate_keys:
        raise ValueError(
            "중복 교양 세부 영역이 있습니다: "
            f"{sorted(duplicate_keys)}"
        )

    return areas


def validate_same_entry_year(
    requirements: list[
        GeneralEducationRequirement
    ],
    areas: list[GeneralEducationArea],
) -> int:
    entry_years = {
        requirement.entry_year
        for requirement in requirements
    }

    entry_years.update(
        area.entry_year
        for area in areas
    )

    if len(entry_years) != 1:
        raise ValueError(
            "한 번에 하나의 입학년도만 "
            "import할 수 있습니다: "
            f"{sorted(entry_years)}"
        )

    return next(iter(entry_years))


def validate_area_parents(
    requirements: list[
        GeneralEducationRequirement
    ],
    areas: list[GeneralEducationArea],
) -> None:
    requirement_keys = {
        (
            requirement.entry_year,
            requirement.category,
        )
        for requirement in requirements
    }

    orphan_keys = {
        (
            area.entry_year,
            area.category,
        )
        for area in areas
        if (
            area.entry_year,
            area.category,
        ) not in requirement_keys
    }

    if orphan_keys:
        raise ValueError(
            "상위 교양 대분류가 없는 "
            "세부 영역이 있습니다: "
            f"{sorted(orphan_keys)}"
        )


def validate_2024(
    requirements: list[
        GeneralEducationRequirement
    ],
    areas: list[GeneralEducationArea],
) -> None:
    entry_year = requirements[0].entry_year

    if entry_year != 2024:
        return

    if (
        len(requirements) !=
        EXPECTED_2024_REQUIREMENT_COUNT
    ):
        raise ValueError(
            "2024학번 교양 대분류 수가 "
            "맞지 않습니다: "
            f"{len(requirements)}개"
        )

    if len(areas) != EXPECTED_2024_AREA_COUNT:
        raise ValueError(
            "2024학번 교양 세부 영역 수가 "
            "맞지 않습니다: "
            f"{len(areas)}개"
        )

    requirement_map = {
        requirement.category: requirement
        for requirement in requirements
    }

    basic = requirement_map.get(
        "기초교양"
    )
    balanced = requirement_map.get(
        "균형교양"
    )

    if basic is None or balanced is None:
        raise ValueError(
            "2024학번은 기초교양과 "
            "균형교양 요건이 모두 필요합니다."
        )

    if (
        basic.minimum_credits !=
        EXPECTED_2024_BASIC_CREDITS
    ):
        raise ValueError(
            "2024학번 기초교양 최소학점이 "
            "맞지 않습니다."
        )

    if (
        balanced.minimum_credits !=
        EXPECTED_2024_BALANCED_CREDITS
    ):
        raise ValueError(
            "2024학번 균형교양 최소학점이 "
            "맞지 않습니다."
        )

    if (
        balanced.minimum_area_count !=
        EXPECTED_2024_BALANCED_AREA_COUNT
    ):
        raise ValueError(
            "2024학번 균형교양 최소 영역 수가 "
            "맞지 않습니다."
        )

    basic_area_credits = sum(
        area.minimum_credits or 0
        for area in areas
        if area.category == "기초교양"
    )

    if (
        basic_area_credits !=
        EXPECTED_2024_BASIC_CREDITS
    ):
        raise ValueError(
            "2024학번 기초교양 세부 영역 "
            "최소학점 합계가 맞지 않습니다: "
            f"{basic_area_credits:g}학점"
        )


def ensure_tables_exist(
    connection: sqlite3.Connection,
) -> None:
    required_tables = {
        "general_education_requirements",
        "general_education_areas",
    }

    rows = connection.execute(
        """
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name IN (
              'general_education_requirements',
              'general_education_areas'
          )
        """
    ).fetchall()

    existing_tables = {
        row[0]
        for row in rows
    }

    missing_tables = (
        required_tables - existing_tables
    )

    if missing_tables:
        raise RuntimeError(
            "교양요건 테이블이 없습니다: "
            f"{sorted(missing_tables)}. "
            "먼저 scripts/schema.sql을 "
            "적용하세요."
        )


def import_general_education(
    requirements: list[
        GeneralEducationRequirement
    ],
    areas: list[GeneralEducationArea],
    *,
    db_path: Path,
) -> None:
    entry_year = requirements[0].entry_year

    requirement_insert_sql = """
    INSERT INTO general_education_requirements (
        entry_year,
        category,
        minimum_credits,
        minimum_area_count,
        notes,
        display_order
    )
    VALUES (?, ?, ?, ?, ?, ?)
    """

    area_insert_sql = """
    INSERT INTO general_education_areas (
        requirement_id,
        area_name,
        minimum_credits,
        is_required,
        notes,
        display_order
    )
    VALUES (?, ?, ?, ?, ?, ?)
    """

    with sqlite3.connect(db_path) as connection:
        connection.execute(
            "PRAGMA foreign_keys = ON"
        )

        ensure_tables_exist(connection)

        connection.execute(
            """
            DELETE FROM
                general_education_requirements
            WHERE entry_year = ?
            """,
            (entry_year,),
        )

        connection.executemany(
            requirement_insert_sql,
            [
                (
                    requirement.entry_year,
                    requirement.category,
                    requirement.minimum_credits,
                    requirement.minimum_area_count,
                    requirement.notes,
                    requirement.display_order,
                )
                for requirement
                in requirements
            ],
        )

        requirement_rows = connection.execute(
            """
            SELECT
                id,
                category
            FROM general_education_requirements
            WHERE entry_year = ?
            """,
            (entry_year,),
        ).fetchall()

        requirement_ids = {
            row[1]: row[0]
            for row in requirement_rows
        }

        connection.executemany(
            area_insert_sql,
            [
                (
                    requirement_ids[
                        area.category
                    ],
                    area.area_name,
                    area.minimum_credits,
                    int(area.is_required),
                    area.notes,
                    area.display_order,
                )
                for area in areas
            ],
        )


def print_summary(
    *,
    entry_year: int,
    db_path: Path,
) -> None:
    with sqlite3.connect(db_path) as connection:
        rows = connection.execute(
            """
            SELECT
                requirement.category,
                requirement.minimum_credits,
                requirement.minimum_area_count,
                COUNT(area.id) AS area_count,
                COALESCE(
                    SUM(area.minimum_credits),
                    0
                ) AS area_minimum_credits
            FROM general_education_requirements
            AS requirement
            LEFT JOIN general_education_areas
            AS area
                ON area.requirement_id =
                   requirement.id
            WHERE requirement.entry_year = ?
            GROUP BY
                requirement.id,
                requirement.category,
                requirement.minimum_credits,
                requirement.minimum_area_count,
                requirement.display_order
            ORDER BY
                requirement.display_order
            """,
            (entry_year,),
        ).fetchall()

    print()
    print(
        f"{entry_year}학번 교양요건 "
        "import 완료"
    )

    for row in rows:
        category = row[0]
        minimum_credits = row[1]
        minimum_area_count = row[2]
        area_count = row[3]
        area_minimum_credits = row[4]

        print(
            f"- {category}: "
            f"최소 {minimum_credits:g}학점, "
            f"{area_count}개 영역"
        )

        if minimum_area_count is not None:
            print(
                "  최소 선택 영역: "
                f"{minimum_area_count}개"
            )

        if area_minimum_credits > 0:
            print(
                "  영역별 최소학점 합계: "
                f"{area_minimum_credits:g}학점"
            )

    print(f"DB: {db_path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "학번별 교양 졸업요건 CSV를 "
            "inyak.db에 저장합니다."
        )
    )

    parser.add_argument(
        "requirements_csv_path",
        type=Path,
        help="교양 대분류 CSV 경로",
    )

    parser.add_argument(
        "areas_csv_path",
        type=Path,
        help="교양 세부 영역 CSV 경로",
    )

    return parser.parse_args()


def main() -> None:
    args = parse_args()

    requirements_csv_path = (
        args.requirements_csv_path
        .expanduser()
        .resolve()
    )

    areas_csv_path = (
        args.areas_csv_path
        .expanduser()
        .resolve()
    )

    for csv_path in (
        requirements_csv_path,
        areas_csv_path,
    ):
        if not csv_path.is_file():
            raise SystemExit(
                "CSV 파일을 찾을 수 없습니다: "
                f"{csv_path}"
            )

    if not DB_PATH.is_file():
        raise SystemExit(
            f"DB 파일을 찾을 수 없습니다: "
            f"{DB_PATH}"
        )

    try:
        requirements = load_requirements(
            requirements_csv_path
        )

        areas = load_areas(
            areas_csv_path
        )

        entry_year = validate_same_entry_year(
            requirements,
            areas,
        )

        validate_area_parents(
            requirements,
            areas,
        )

        validate_2024(
            requirements,
            areas,
        )

        import_general_education(
            requirements,
            areas,
            db_path=DB_PATH,
        )

        print_summary(
            entry_year=entry_year,
            db_path=DB_PATH,
        )
    except (
        ValueError,
        RuntimeError,
        sqlite3.Error,
    ) as error:
        raise SystemExit(
            f"Import 실패: {error}"
        ) from error


if __name__ == "__main__":
    main()
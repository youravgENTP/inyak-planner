from __future__ import annotations

from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]

DATA_DIR = PROJECT_ROOT / "data"

RAW_DIR = DATA_DIR / "raw"
EXTRACTED_DIR = DATA_DIR / "extracted"
REFERENCE_DIR = DATA_DIR / "reference"
SEED_DIR = DATA_DIR / "seed"

RAW_CURRICULUM_PDFS_DIR = (
    RAW_DIR
    / "curriculum_pdfs"
)

RAW_GRADUATION_PDFS_DIR = (
    RAW_DIR
    / "graduation_pdfs"
)

EXTRACTED_CURRICULUM_DIR = (
    EXTRACTED_DIR
    / "curriculum"
)

CURRICULUM_SEED_DIR = (
    SEED_DIR
    / "curriculum"
)

GENERAL_EDUCATION_SEED_DIR = (
    SEED_DIR
    / "general_education"
)

GRADUATION_SEED_DIR = (
    SEED_DIR
    / "graduation"
)

GENERAL_EDUCATION_COURSE_MAPPINGS_PATH = (
    GENERAL_EDUCATION_SEED_DIR
    / "general_education_course_mappings.csv"
)

GRADUATION_REQUIREMENTS_PATH = (
    GRADUATION_SEED_DIR
    / "graduation_requirements.csv"
)

DATABASE_PATH = (
    DATA_DIR
    / "db"
    / "inyak.db"
)


def curriculum_seed_path(
    entry_year: int,
) -> Path:
    return (
        CURRICULUM_SEED_DIR
        / f"curriculum_{entry_year}.csv"
    )


def general_education_requirements_path(
    entry_year: int,
) -> Path:
    return (
        GENERAL_EDUCATION_SEED_DIR
        / (
            "general_education_requirements_"
            f"{entry_year}.csv"
        )
    )


def general_education_areas_path(
    entry_year: int,
) -> Path:
    return (
        GENERAL_EDUCATION_SEED_DIR
        / (
            "general_education_areas_"
            f"{entry_year}.csv"
        )
    )
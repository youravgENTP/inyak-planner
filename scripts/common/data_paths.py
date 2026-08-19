from __future__ import annotations

from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]

SCRIPTS_DIR = PROJECT_ROOT / "scripts"
SCHEMA_PATH = SCRIPTS_DIR / "schema.sql"

DATA_DIR = PROJECT_ROOT / "data"

CURRICULUM_PIPELINE_DIR = (
    DATA_DIR
    / "curriculum_pipeline"
)

CURRICULUM_SOURCE_DIR = (
    CURRICULUM_PIPELINE_DIR
    / "01_source"
)

CURRICULUM_EXTRACTED_DIR = (
    CURRICULUM_PIPELINE_DIR
    / "02_extracted"
)

CURRICULUM_NORMALIZED_DIR = (
    CURRICULUM_PIPELINE_DIR
    / "03_normalized"
)

CURRICULUM_RECONCILED_DIR = (
    CURRICULUM_PIPELINE_DIR
    / "04_reconciled"
)

CURRICULUM_BASELINE_CANDIDATES_DIR = (
    CURRICULUM_PIPELINE_DIR
    / "05_baseline_candidates"
)

CURRICULUM_REVIEW_DIR = (
    CURRICULUM_PIPELINE_DIR
    / "06_review"
)

CURRICULUM_BASELINE_DIR = (
    CURRICULUM_PIPELINE_DIR
    / "07_baseline"
)

RAW_DIR = DATA_DIR / "raw"
EXTRACTED_DIR = DATA_DIR / "extracted"
REFERENCE_DIR = DATA_DIR / "reference"
SEED_DIR = DATA_DIR / "seed"

RAW_CURRICULUM_PDFS_DIR = (
    CURRICULUM_SOURCE_DIR
    / "curriculum_pdfs"
)

RAW_CURRICULUM_FLOWCHARTS_DIR = (
    CURRICULUM_SOURCE_DIR
    / "curriculum_flowcharts"
)

RAW_GRADUATION_PDFS_DIR = (
    RAW_DIR
    / "graduation_pdfs"
)

EXTRACTED_CURRICULUM_DIR = (
    CURRICULUM_EXTRACTED_DIR
    / "curriculum"
)

EXTRACTED_CURRICULUM_FLOWCHARTS_DIR = (
    CURRICULUM_EXTRACTED_DIR
    / "curriculum_flowcharts"
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

AUTH_DATABASE_PATH = (
    DATA_DIR
    / "db"
    / "auth.db"
)

PROFILE_IMAGE_DIRECTORY = (
    DATA_DIR
    / "uploads"
    / "profile-images"
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
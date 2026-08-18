from __future__ import annotations

import hashlib
import json
from pathlib import Path


from scripts.common.data_paths import (
    RAW_DIR,
)

RETRIEVED_AT = "2026-08-18"

YEARS = range(2022, 2027)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()

    with path.open("rb") as file:
        for chunk in iter(
            lambda: file.read(1024 * 1024),
            b"",
        ):
            digest.update(chunk)

    return digest.hexdigest()


def write_json(
    output_path: Path,
    payload: dict,
) -> None:
    output_path.write_text(
        json.dumps(
            payload,
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def curriculum_metadata(
    year: int,
    pdf_path: Path,
) -> dict:
    return {
        "academic_year": year,
        "document_type": (
            "pharmacy_curriculum_excerpt"
        ),
        "file": pdf_path.name,
        "source_document": (
            f"{year}학년도 교육과정"
        ),
        "department": "약학과",
        "is_excerpt": True,
        "retrieved_at": RETRIEVED_AT,
        "sha256": sha256_file(pdf_path),
    }


def graduation_metadata(
    year: int,
    pdf_path: Path,
) -> dict:
    return {
        "academic_year": year,
        "document_type": (
            "graduation_requirements"
        ),
        "file": pdf_path.name,
        "source_document": (
            f"{year}학년도 입학생 "
            "학과(부)별 졸업이수학점"
        ),
        "department": "약학과",
        "is_excerpt": False,
        "retrieved_at": RETRIEVED_AT,
        "sha256": sha256_file(pdf_path),
    }


def main() -> None:
    for year in YEARS:
        curriculum_dir = (
            RAW_DIR
            / "curriculum_pdfs"
            / str(year)
        )

        graduation_dir = (
            RAW_DIR
            / "graduation_pdfs"
            / str(year)
        )

        curriculum_pdfs = sorted(
            curriculum_dir.glob("*.pdf")
        )

        graduation_pdfs = sorted(
            graduation_dir.glob("*.pdf")
        )

        if len(curriculum_pdfs) != 1:
            raise RuntimeError(
                f"{year} curriculum PDF 수가 "
                f"1개가 아닙니다: {curriculum_pdfs}"
            )

        if len(graduation_pdfs) != 1:
            raise RuntimeError(
                f"{year} graduation PDF 수가 "
                f"1개가 아닙니다: {graduation_pdfs}"
            )

        curriculum_pdf = curriculum_pdfs[0]
        graduation_pdf = graduation_pdfs[0]

        write_json(
            curriculum_dir / "source.json",
            curriculum_metadata(
                year,
                curriculum_pdf,
            ),
        )

        write_json(
            graduation_dir / "source.json",
            graduation_metadata(
                year,
                graduation_pdf,
            ),
        )

        print(
            f"{year}: curriculum / "
            "graduation metadata 생성 완료"
        )


if __name__ == "__main__":
    main()
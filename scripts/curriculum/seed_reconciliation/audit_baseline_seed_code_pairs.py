from __future__ import annotations

import csv
import re
import sqlite3
from collections import Counter, defaultdict
from pathlib import Path

from scripts.common.data_paths import (
    DATABASE_PATH,
    EXTRACTED_CURRICULUM_DIR,
    EXTRACTED_CURRICULUM_FLOWCHARTS_DIR,
    PROJECT_ROOT,
)


TARGET_YEARS = [
    2022,
    2023,
    2024,
]

CANDIDATE_COLUMNS = [
    "academic_year",
    "candidate_type",
    "course_name",
    "baseline_code",
    "seed_code",
    "baseline_grade",
    "baseline_semester",
    "seed_grade",
    "seed_semester",
    "baseline_completion_type",
    "seed_completion_type",
    "baseline_credits",
    "seed_credits",
    "official_relation",
    "relation_links",
    "relation_source_years",
    "baseline_db_terms",
    "seed_db_terms",
    "baseline_db_history",
    "seed_db_history",
    "seed_name_db_codes",
    "chronology_signal",
]

UNPAIRED_COLUMNS = [
    "academic_year",
    "side",
    "course_code",
    "course_name",
    "grade",
    "semester",
    "completion_type",
    "credits",
    "db_terms",
    "exact_name_db_codes",
    "reason",
]


def comparison_directory() -> Path:
    return (
        EXTRACTED_CURRICULUM_FLOWCHARTS_DIR
        / "comparison"
    )


def diff_path() -> Path:
    return (
        comparison_directory()
        / "baseline_seed_diff"
        / "baseline_seed_diff.csv"
    )


def output_directory() -> Path:
    return (
        comparison_directory()
        / "baseline_seed_code_pair_audit"
    )


def candidate_path() -> Path:
    return (
        output_directory()
        / "code_pair_candidates.csv"
    )


def unpaired_path() -> Path:
    return (
        output_directory()
        / "unpaired_differences.csv"
    )


def report_path() -> Path:
    return (
        output_directory()
        / "code_pair_audit_report.txt"
    )


def read_csv_rows(
    path: Path,
) -> list[dict[str, str]]:
    with path.open(
        "r",
        encoding="utf-8-sig",
        newline="",
    ) as file:
        return list(
            csv.DictReader(file)
        )


def write_csv(
    path: Path,
    fieldnames: list[str],
    rows: list[dict[str, str]],
) -> None:
    path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with path.open(
        "w",
        encoding="utf-8-sig",
        newline="",
    ) as file:
        writer = csv.DictWriter(
            file,
            fieldnames=fieldnames,
        )

        writer.writeheader()
        writer.writerows(
            rows
        )


def normalize_name(
    text: str,
) -> str:
    # 의도적으로 whitespace만 제거한다.
    # 철자가 다른 과목을 자동으로 동일 과목으로
    # 간주하지 않는다.
    return re.sub(
        r"\s+",
        "",
        text.strip(),
    )


def resolve_database_path() -> Path:
    if DATABASE_PATH.exists():
        return DATABASE_PATH

    fallback = (
        PROJECT_ROOT
        / "inyak.db"
    )

    if fallback.exists():
        return fallback

    raise FileNotFoundError(
        "inyak.db를 찾지 못했습니다.\n"
        f"default: {DATABASE_PATH}\n"
        f"fallback: {fallback}"
    )


def validate_courses_table(
    connection: sqlite3.Connection,
) -> None:
    rows = connection.execute(
        "PRAGMA table_info(courses)"
    ).fetchall()

    columns = {
        row[1]
        for row in rows
    }

    required = {
        "academic_year",
        "semester",
        "course_code",
        "course_name",
        "completion_type",
        "credits",
    }

    missing = (
        required
        - columns
    )

    if missing:
        raise RuntimeError(
            "courses 테이블에 필요한 컬럼이 없습니다: "
            f"{sorted(missing)}"
        )


def load_database_history(
    connection: sqlite3.Connection,
) -> tuple[
    dict[
        str,
        list[dict[str, str]],
    ],
    dict[
        str,
        set[str],
    ],
]:
    cursor = connection.execute(
        """
        SELECT DISTINCT
            academic_year,
            semester,
            course_code,
            course_name,
            completion_type,
            credits
        FROM courses
        ORDER BY
            academic_year,
            semester,
            course_code,
            course_name
        """
    )

    history_by_code = defaultdict(
        list
    )

    codes_by_name = defaultdict(
        set
    )

    for (
        academic_year,
        semester,
        course_code,
        course_name,
        completion_type,
        credits,
    ) in cursor.fetchall():
        code = (
            str(
                course_code
                or ""
            ).strip()
        )

        name = (
            str(
                course_name
                or ""
            ).strip()
        )

        if not code:
            continue

        row = {
            "academic_year": str(
                academic_year
            ),
            "semester": str(
                semester
            ),
            "course_code": code,
            "course_name": name,
            "completion_type": str(
                completion_type
                or ""
            ),
            "credits": (
                ""
                if credits is None
                else f"{float(credits):g}"
            ),
        }

        history_by_code[
            code
        ].append(
            row
        )

        if name:
            codes_by_name[
                normalize_name(name)
            ].add(
                code
            )

    return (
        dict(history_by_code),
        dict(codes_by_name),
    )


def history_terms(
    history_by_code: dict[
        str,
        list[dict[str, str]],
    ],
    code: str,
) -> str:
    if not code:
        return ""

    rows = history_by_code.get(
        code,
        [],
    )

    terms = sorted(
        {
            (
                int(
                    row[
                        "academic_year"
                    ]
                ),
                int(
                    row[
                        "semester"
                    ]
                ),
            )
            for row in rows
        }
    )

    return ";".join(
        f"{year}-{semester}"
        for year, semester
        in terms
    )


def history_detail(
    history_by_code: dict[
        str,
        list[dict[str, str]],
    ],
    code: str,
) -> str:
    if not code:
        return ""

    rows = history_by_code.get(
        code,
        [],
    )

    values = []

    seen = set()

    for row in rows:
        value = (
            f"{row['academic_year']}-"
            f"{row['semester']}"
            f"|{row['course_name']}"
            f"|{row['completion_type']}"
            f"|{row['credits']}"
        )

        if value in seen:
            continue

        seen.add(
            value
        )

        values.append(
            value
        )

    return " / ".join(
        values
    )


def relation_files() -> list[
    tuple[int, Path]
]:
    result = []

    if not (
        EXTRACTED_CURRICULUM_DIR.exists()
    ):
        return result

    for directory in sorted(
        EXTRACTED_CURRICULUM_DIR.iterdir()
    ):
        if not directory.is_dir():
            continue

        try:
            year = int(
                directory.name
            )
        except ValueError:
            continue

        path = (
            directory
            / "course_relations.csv"
        )

        if path.exists():
            result.append(
                (
                    year,
                    path,
                )
            )

    return result


def relation_key(
    code_a: str,
    code_b: str,
) -> tuple[str, str]:
    return tuple(
        sorted(
            [
                code_a,
                code_b,
            ]
        )
    )


def load_relation_index() -> dict[
    tuple[str, str],
    list[dict[str, str]],
]:
    index = defaultdict(
        list
    )

    for (
        source_year,
        path,
    ) in relation_files():
        rows = read_csv_rows(
            path
        )

        for row in rows:
            old_code = (
                row.get(
                    "old_course_code",
                    "",
                ).strip()
            )

            new_code = (
                row.get(
                    "new_course_code",
                    "",
                ).strip()
            )

            if (
                not old_code
                or not new_code
            ):
                continue

            record = dict(
                row
            )

            record[
                "_source_year"
            ] = str(
                source_year
            )

            index[
                relation_key(
                    old_code,
                    new_code,
                )
            ].append(
                record
            )

    return dict(
        index
    )


def row_identity(
    row: dict[str, str],
    side: str,
) -> str:
    code = (
        row.get(
            "course_code",
            "",
        ).strip()
    )

    if code:
        return (
            f"{side}:CODE:{code}"
        )

    if side == "baseline":
        grade = row.get(
            "baseline_grade",
            "",
        )
        semester = row.get(
            "baseline_semester",
            "",
        )
        name = row.get(
            "baseline_course_name",
            "",
        )
    else:
        grade = row.get(
            "seed_grade",
            "",
        )
        semester = row.get(
            "seed_semester",
            "",
        )
        name = row.get(
            "seed_course_name",
            "",
        )

    return (
        f"{side}:NO_CODE:"
        f"{grade}:"
        f"{semester}:"
        f"{normalize_name(name)}"
    )


def baseline_name(
    row: dict[str, str],
) -> str:
    return row.get(
        "baseline_course_name",
        "",
    ).strip()


def seed_name(
    row: dict[str, str],
) -> str:
    return row.get(
        "seed_course_name",
        "",
    ).strip()


def side_code(
    row: dict[str, str],
) -> str:
    return row.get(
        "course_code",
        "",
    ).strip()


def build_candidates(
    diff_rows: list[dict[str, str]],
    relation_index: dict[
        tuple[str, str],
        list[dict[str, str]],
    ],
) -> tuple[
    list[
        tuple[
            dict[str, str],
            dict[str, str],
            set[str],
        ]
    ],
    set[str],
    set[str],
]:
    baseline_only = [
        row
        for row in diff_rows
        if row.get(
            "diff_type",
            "",
        )
        == "baseline_only"
    ]

    seed_only = [
        row
        for row in diff_rows
        if row.get(
            "diff_type",
            "",
        )
        == "seed_only"
    ]

    candidate_map = {}

    baseline_matched = set()
    seed_matched = set()

    baseline_by_name = defaultdict(
        list
    )

    seed_by_name = defaultdict(
        list
    )

    for row in baseline_only:
        year = int(
            row[
                "academic_year"
            ]
        )

        name = normalize_name(
            baseline_name(row)
        )

        if name:
            baseline_by_name[
                (
                    year,
                    name,
                )
            ].append(
                row
            )

    for row in seed_only:
        year = int(
            row[
                "academic_year"
            ]
        )

        name = normalize_name(
            seed_name(row)
        )

        if name:
            seed_by_name[
                (
                    year,
                    name,
                )
            ].append(
                row
            )

    # 1. 같은 연도 + 동일 정규화 과목명
    #    코드가 달라도 후보로만 묶는다.
    common_names = (
        set(
            baseline_by_name
        )
        & set(
            seed_by_name
        )
    )

    for key in sorted(
        common_names
    ):
        baseline_rows = (
            baseline_by_name[
                key
            ]
        )

        seed_rows = (
            seed_by_name[
                key
            ]
        )

        unique = (
            len(baseline_rows) == 1
            and len(seed_rows) == 1
        )

        for baseline in baseline_rows:
            for seed in seed_rows:
                baseline_id = (
                    row_identity(
                        baseline,
                        "baseline",
                    )
                )

                seed_id = (
                    row_identity(
                        seed,
                        "seed",
                    )
                )

                pair_key = (
                    int(
                        baseline[
                            "academic_year"
                        ]
                    ),
                    baseline_id,
                    seed_id,
                )

                types = (
                    candidate_map
                    .setdefault(
                        pair_key,
                        {
                            "baseline": baseline,
                            "seed": seed,
                            "types": set(),
                        },
                    )[
                        "types"
                    ]
                )

                if unique:
                    types.add(
                        "same_name_unique"
                    )
                else:
                    types.add(
                        "same_name_multiple"
                    )

                if not side_code(
                    seed
                ):
                    types.add(
                        "seed_blank_code"
                    )

                baseline_matched.add(
                    baseline_id
                )

                seed_matched.add(
                    seed_id
                )

    # 2. 이름이 달라도 공식 relation으로
    #    코드가 직접 연결되어 있다면 후보로 추가.
    for baseline in baseline_only:
        baseline_code = (
            side_code(
                baseline
            )
        )

        if not baseline_code:
            continue

        year = int(
            baseline[
                "academic_year"
            ]
        )

        for seed in seed_only:
            if (
                int(
                    seed[
                        "academic_year"
                    ]
                )
                != year
            ):
                continue

            seed_code = (
                side_code(
                    seed
                )
            )

            if not seed_code:
                continue

            key = relation_key(
                baseline_code,
                seed_code,
            )

            if key not in relation_index:
                continue

            baseline_id = (
                row_identity(
                    baseline,
                    "baseline",
                )
            )

            seed_id = (
                row_identity(
                    seed,
                    "seed",
                )
            )

            pair_key = (
                year,
                baseline_id,
                seed_id,
            )

            types = (
                candidate_map
                .setdefault(
                    pair_key,
                    {
                        "baseline": baseline,
                        "seed": seed,
                        "types": set(),
                    },
                )[
                    "types"
                ]
            )

            types.add(
                "official_relation"
            )

            baseline_matched.add(
                baseline_id
            )

            seed_matched.add(
                seed_id
            )

    candidates = []

    for key in sorted(
        candidate_map
    ):
        item = (
            candidate_map[
                key
            ]
        )

        candidates.append(
            (
                item[
                    "baseline"
                ],
                item[
                    "seed"
                ],
                item[
                    "types"
                ],
            )
        )

    return (
        candidates,
        baseline_matched,
        seed_matched,
    )


def relation_summary(
    relation_index: dict[
        tuple[str, str],
        list[dict[str, str]],
    ],
    baseline_code: str,
    seed_code: str,
) -> tuple[
    str,
    str,
    str,
]:
    if (
        not baseline_code
        or not seed_code
    ):
        return (
            "no",
            "",
            "",
        )

    rows = relation_index.get(
        relation_key(
            baseline_code,
            seed_code,
        ),
        [],
    )

    if not rows:
        return (
            "no",
            "",
            "",
        )

    links = []

    source_years = set()

    for row in rows:
        relation_type = (
            row.get(
                "relation_type",
                "",
            ).strip()
        )

        old_code = (
            row.get(
                "old_course_code",
                "",
            ).strip()
        )

        new_code = (
            row.get(
                "new_course_code",
                "",
            ).strip()
        )

        designation_year = (
            row.get(
                "designation_year",
                "",
            ).strip()
        )

        source_year = (
            row.get(
                "_source_year",
                "",
            ).strip()
        )

        links.append(
            (
                f"{relation_type}:"
                f"{old_code}->{new_code}"
                f":designation="
                f"{designation_year}"
            )
        )

        if source_year:
            source_years.add(
                source_year
            )

    return (
        "yes",
        ";".join(
            sorted(
                set(
                    links
                )
            )
        ),
        ";".join(
            sorted(
                source_years
            )
        ),
    )


def term_tuples(
    history_by_code: dict[
        str,
        list[dict[str, str]],
    ],
    code: str,
) -> list[
    tuple[int, int]
]:
    if not code:
        return []

    return sorted(
        {
            (
                int(
                    row[
                        "academic_year"
                    ]
                ),
                int(
                    row[
                        "semester"
                    ]
                ),
            )
            for row
            in history_by_code.get(
                code,
                [],
            )
        }
    )


def chronology_signal(
    history_by_code: dict[
        str,
        list[dict[str, str]],
    ],
    baseline_code: str,
    seed_code: str,
) -> str:
    if (
        not baseline_code
        and not seed_code
    ):
        return (
            "no_codes"
        )

    if not seed_code:
        return (
            "seed_code_missing"
        )

    baseline_terms = (
        term_tuples(
            history_by_code,
            baseline_code,
        )
    )

    seed_terms = (
        term_tuples(
            history_by_code,
            seed_code,
        )
    )

    if (
        baseline_terms
        and seed_terms
    ):
        if (
            max(baseline_terms)
            < min(seed_terms)
        ):
            return (
                "baseline_then_seed"
            )

        if (
            max(seed_terms)
            < min(baseline_terms)
        ):
            return (
                "seed_then_baseline"
            )

        return (
            "both_offered_overlap_or_interleaved"
        )

    if baseline_terms:
        return (
            "baseline_code_only_in_db"
        )

    if seed_terms:
        return (
            "seed_code_only_in_db"
        )

    return (
        "neither_code_in_db"
    )


def make_candidate_row(
    baseline: dict[str, str],
    seed: dict[str, str],
    types: set[str],
    relation_index: dict,
    history_by_code: dict,
    codes_by_name: dict,
) -> dict[str, str]:
    baseline_code = (
        side_code(
            baseline
        )
    )

    seed_code = (
        side_code(
            seed
        )
    )

    (
        official_relation,
        relation_links,
        relation_source_years,
    ) = relation_summary(
        relation_index,
        baseline_code,
        seed_code,
    )

    normalized_seed_name = (
        normalize_name(
            seed_name(
                seed
            )
        )
    )

    seed_name_codes = sorted(
        codes_by_name.get(
            normalized_seed_name,
            set(),
        )
    )

    return {
        "academic_year": (
            baseline[
                "academic_year"
            ]
        ),
        "candidate_type": (
            "+".join(
                sorted(
                    types
                )
            )
        ),
        "course_name": (
            baseline_name(
                baseline
            )
            or seed_name(
                seed
            )
        ),
        "baseline_code": (
            baseline_code
        ),
        "seed_code": (
            seed_code
        ),
        "baseline_grade": (
            baseline.get(
                "baseline_grade",
                "",
            )
        ),
        "baseline_semester": (
            baseline.get(
                "baseline_semester",
                "",
            )
        ),
        "seed_grade": (
            seed.get(
                "seed_grade",
                "",
            )
        ),
        "seed_semester": (
            seed.get(
                "seed_semester",
                "",
            )
        ),
        "baseline_completion_type": (
            baseline.get(
                "baseline_completion_type",
                "",
            )
        ),
        "seed_completion_type": (
            seed.get(
                "seed_completion_type",
                "",
            )
        ),
        "baseline_credits": (
            baseline.get(
                "baseline_credits",
                "",
            )
        ),
        "seed_credits": (
            seed.get(
                "seed_credits",
                "",
            )
        ),
        "official_relation": (
            official_relation
        ),
        "relation_links": (
            relation_links
        ),
        "relation_source_years": (
            relation_source_years
        ),
        "baseline_db_terms": (
            history_terms(
                history_by_code,
                baseline_code,
            )
        ),
        "seed_db_terms": (
            history_terms(
                history_by_code,
                seed_code,
            )
        ),
        "baseline_db_history": (
            history_detail(
                history_by_code,
                baseline_code,
            )
        ),
        "seed_db_history": (
            history_detail(
                history_by_code,
                seed_code,
            )
        ),
        "seed_name_db_codes": (
            ";".join(
                seed_name_codes
            )
        ),
        "chronology_signal": (
            chronology_signal(
                history_by_code,
                baseline_code,
                seed_code,
            )
        ),
    }


def make_unpaired_row(
    row: dict[str, str],
    side: str,
    history_by_code: dict,
    codes_by_name: dict,
) -> dict[str, str]:
    code = (
        side_code(
            row
        )
    )

    if side == "baseline":
        name = (
            baseline_name(
                row
            )
        )
        grade = row.get(
            "baseline_grade",
            "",
        )
        semester = row.get(
            "baseline_semester",
            "",
        )
        completion_type = (
            row.get(
                "baseline_completion_type",
                "",
            )
        )
        credits = row.get(
            "baseline_credits",
            "",
        )
    else:
        name = (
            seed_name(
                row
            )
        )
        grade = row.get(
            "seed_grade",
            "",
        )
        semester = row.get(
            "seed_semester",
            "",
        )
        completion_type = (
            row.get(
                "seed_completion_type",
                "",
            )
        )
        credits = row.get(
            "seed_credits",
            "",
        )

    exact_name_codes = sorted(
        codes_by_name.get(
            normalize_name(
                name
            ),
            set(),
        )
    )

    if (
        side == "seed"
        and not code
    ):
        reason = (
            "seed_blank_code_no_baseline_pair"
        )
    else:
        reason = (
            "no_same_name_or_official_relation_pair"
        )

    return {
        "academic_year": (
            row[
                "academic_year"
            ]
        ),
        "side": (
            side
        ),
        "course_code": (
            code
        ),
        "course_name": (
            name
        ),
        "grade": (
            grade
        ),
        "semester": (
            semester
        ),
        "completion_type": (
            completion_type
        ),
        "credits": (
            credits
        ),
        "db_terms": (
            history_terms(
                history_by_code,
                code,
            )
        ),
        "exact_name_db_codes": (
            ";".join(
                exact_name_codes
            )
        ),
        "reason": (
            reason
        ),
    }


def build_report(
    candidate_rows: list[
        dict[str, str]
    ],
    unpaired_rows: list[
        dict[str, str]
    ],
    database_path: Path,
) -> str:
    type_counts = Counter()

    chronology_counts = Counter(
        row[
            "chronology_signal"
        ]
        for row
        in candidate_rows
    )

    for row in candidate_rows:
        for value in (
            row[
                "candidate_type"
            ].split(
                "+"
            )
        ):
            if value:
                type_counts[
                    value
                ] += 1

    lines = [
        (
            "Provisional baseline vs seed "
            "code-pair audit"
        ),
        "=============================================",
        "",
        (
            "This is a read-only diagnostic."
        ),
        (
            "No baseline, seed, extracted source, "
            "or database data is modified."
        ),
        "",
        f"database: {database_path}",
        "",
        "SUMMARY",
        "-------",
        (
            "candidate pairs: "
            f"{len(candidate_rows)}"
        ),
        (
            "unpaired differences: "
            f"{len(unpaired_rows)}"
        ),
        "",
        "Candidate evidence",
        "------------------",
    ]

    for key in sorted(
        type_counts
    ):
        lines.append(
            f"{key}: "
            f"{type_counts[key]}"
        )

    lines.extend(
        [
            "",
            "DB chronology",
            "-------------",
        ]
    )

    for key in sorted(
        chronology_counts
    ):
        lines.append(
            f"{key}: "
            f"{chronology_counts[key]}"
        )

    lines.extend(
        [
            "",
            "CANDIDATE PAIRS",
            "---------------",
        ]
    )

    for row in candidate_rows:
        baseline_code = (
            row[
                "baseline_code"
            ]
            or "(blank)"
        )

        seed_code = (
            row[
                "seed_code"
            ]
            or "(blank)"
        )

        baseline_terms = (
            row[
                "baseline_db_terms"
            ]
            or "-"
        )

        seed_terms = (
            row[
                "seed_db_terms"
            ]
            or "-"
        )

        lines.append(
            (
                f"{row['academic_year']} "
                f"| {row['course_name']} "
                f"| baseline={baseline_code} "
                f"({baseline_terms}) "
                f"| seed={seed_code} "
                f"({seed_terms}) "
                f"| type={row['candidate_type']} "
                f"| relation="
                f"{row['official_relation']} "
                f"| chronology="
                f"{row['chronology_signal']}"
            )
        )

        if (
            not row[
                "seed_code"
            ]
            and row[
                "seed_name_db_codes"
            ]
        ):
            lines.append(
                (
                    "    exact-name DB codes: "
                    f"{row['seed_name_db_codes']}"
                )
            )

        if row[
            "relation_links"
        ]:
            lines.append(
                (
                    "    relation: "
                    f"{row['relation_links']}"
                )
            )

    lines.extend(
        [
            "",
            "UNPAIRED",
            "--------",
        ]
    )

    for row in unpaired_rows:
        code = (
            row[
                "course_code"
            ]
            or "(blank)"
        )

        db_terms = (
            row[
                "db_terms"
            ]
            or "-"
        )

        exact_name_codes = (
            row[
                "exact_name_db_codes"
            ]
            or "-"
        )

        lines.append(
            (
                f"{row['academic_year']} "
                f"| {row['side']} "
                f"| {code} "
                f"| {row['course_name']} "
                f"| DB={db_terms} "
                f"| exact-name-codes="
                f"{exact_name_codes} "
                f"| {row['reason']}"
            )
        )

    lines.extend(
        [
            "",
            "Interpretation rules",
            "--------------------",
            (
                "1. same_name_unique means only that "
                "one baseline-only row and one seed-only row "
                "share the exact whitespace-normalized name."
            ),
            (
                "2. official_relation means the two codes "
                "are directly connected in an extracted "
                "official relation table."
            ),
            (
                "3. Actual offering history is supporting "
                "evidence only; it does not automatically "
                "select the historical cohort code."
            ),
            (
                "4. seed_blank_code rows are never assigned "
                "a code automatically."
            ),
            (
                "5. exact-name DB codes for blank seed rows "
                "are diagnostic candidates only."
            ),
            (
                "6. No ADA/ADB prefix rule is used."
            ),
            "",
        ]
    )

    return "\n".join(
        lines
    )


def main() -> None:
    source_diff_path = (
        diff_path()
    )

    if not (
        source_diff_path.exists()
    ):
        raise FileNotFoundError(
            "baseline-vs-seed diff CSV가 없습니다.\n"
            "먼저 다음을 실행하세요:\n"
            "python -m "
            "scripts.curriculum."
            "compare_baseline_with_seed\n"
            f"path: {source_diff_path}"
        )

    diff_rows = read_csv_rows(
        source_diff_path
    )

    diff_rows = [
        row
        for row in diff_rows
        if int(
            row[
                "academic_year"
            ]
        )
        in TARGET_YEARS
    ]

    relation_index = (
        load_relation_index()
    )

    database_path = (
        resolve_database_path()
    )

    # SQLite URI의 mode=ro로 열어
    # 실수로도 DB를 수정하지 않는다.
    database_uri = (
        "file:"
        f"{database_path.resolve()}"
        "?mode=ro"
    )

    connection = (
        sqlite3.connect(
            database_uri,
            uri=True,
        )
    )

    try:
        validate_courses_table(
            connection
        )

        (
            history_by_code,
            codes_by_name,
        ) = load_database_history(
            connection
        )

    finally:
        connection.close()

    (
        candidates,
        baseline_matched,
        seed_matched,
    ) = build_candidates(
        diff_rows,
        relation_index,
    )

    candidate_rows = [
        make_candidate_row(
            baseline=baseline,
            seed=seed,
            types=types,
            relation_index=(
                relation_index
            ),
            history_by_code=(
                history_by_code
            ),
            codes_by_name=(
                codes_by_name
            ),
        )
        for (
            baseline,
            seed,
            types,
        )
        in candidates
    ]

    unpaired_rows = []

    for row in diff_rows:
        diff_type = row.get(
            "diff_type",
            "",
        )

        if diff_type not in {
            "baseline_only",
            "seed_only",
        }:
            continue

        if (
            diff_type
            == "baseline_only"
        ):
            side = "baseline"
        else:
            side = "seed"

        identity = (
            row_identity(
                row,
                side,
            )
        )

        if (
            side == "baseline"
            and identity
            in baseline_matched
        ):
            continue

        if (
            side == "seed"
            and identity
            in seed_matched
        ):
            continue

        unpaired_rows.append(
            make_unpaired_row(
                row=row,
                side=side,
                history_by_code=(
                    history_by_code
                ),
                codes_by_name=(
                    codes_by_name
                ),
            )
        )

    output_directory().mkdir(
        parents=True,
        exist_ok=True,
    )

    write_csv(
        candidate_path(),
        CANDIDATE_COLUMNS,
        candidate_rows,
    )

    write_csv(
        unpaired_path(),
        UNPAIRED_COLUMNS,
        unpaired_rows,
    )

    report = build_report(
        candidate_rows=(
            candidate_rows
        ),
        unpaired_rows=(
            unpaired_rows
        ),
        database_path=(
            database_path
        ),
    )

    report_path().write_text(
        report,
        encoding="utf-8",
    )

    print()
    print(
        "Provisional baseline vs seed "
        "code-pair audit"
    )
    print(
        "--------------------------------------"
    )
    print(
        f"candidate pairs: "
        f"{len(candidate_rows)}"
    )
    print(
        f"unpaired differences: "
        f"{len(unpaired_rows)}"
    )
    print()
    print(
        f"report: {report_path()}"
    )


if __name__ == "__main__":
    main()
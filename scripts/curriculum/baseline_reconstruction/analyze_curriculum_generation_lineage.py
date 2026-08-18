from __future__ import annotations

import csv
import re
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

from scripts.common.data_paths import (
    EXTRACTED_CURRICULUM_FLOWCHARTS_DIR,
)


GENERATION_FOUR_YEAR = "four_year"
GENERATION_SIX_YEAR = "six_year"
GENERATION_BOTH = "both"
GENERATION_AMBIGUOUS = "ambiguous"

PAIR_COMPLEMENTARY = "complementary_pair_candidate"
PAIR_ONE_SIDED = "one_sided_candidate"
PAIR_CONFLICT = "conflict"
PAIR_UNRESOLVED = "unresolved"

OUTPUT_COLUMNS = [
    "academic_year",
    "grade",
    "semester",
    "course_name",
    "course_code",
    "completion_type",
    "credits",
    "group_size",
    "partner_codes",
    "previous_year",
    "previous_generation",
    "next_year",
    "next_generation",
    "previous_direct_four_year",
    "previous_direct_six_year",
    "next_direct_four_year",
    "next_direct_six_year",
    "row_lineage_candidate",
    "pair_status",
    "lineage_reason",
]


@dataclass(frozen=True)
class EvidenceRow:
    academic_year: int
    grade: int
    semester: int
    course_name: str
    course_code: str
    completion_type: str
    credits: str
    group_size: int
    generation_evidence: str


@dataclass(frozen=True)
class GroupKey:
    academic_year: int
    grade: int
    semester: int
    normalized_name: str


@dataclass
class LineageState:
    previous_year: int | None
    previous_generation: str
    next_year: int | None
    next_generation: str
    previous_direct_four_year: bool
    previous_direct_six_year: bool
    next_direct_four_year: bool
    next_direct_six_year: bool
    candidate: str
    reason: str


def normalize_course_name(
    course_name: str,
) -> str:
    return re.sub(
        r"\s+",
        "",
        course_name.strip(),
    )


def comparison_directory() -> Path:
    return (
        EXTRACTED_CURRICULUM_FLOWCHARTS_DIR
        / "comparison"
    )


def row_evidence_path() -> Path:
    return (
        comparison_directory()
        / "curriculum_generation_row_evidence.csv"
    )


def output_csv_path() -> Path:
    return (
        comparison_directory()
        / "curriculum_generation_lineage.csv"
    )


def output_report_path() -> Path:
    return (
        comparison_directory()
        / "curriculum_generation_lineage_report.txt"
    )


def read_csv_rows(
    path: Path,
) -> list[dict[str, str]]:
    if not path.exists():
        raise FileNotFoundError(
            f"파일이 없습니다: {path}"
        )

    with path.open(
        "r",
        encoding="utf-8-sig",
        newline="",
    ) as file:
        return list(
            csv.DictReader(
                file
            )
        )


def load_evidence_rows() -> list[EvidenceRow]:
    raw_rows = read_csv_rows(
        row_evidence_path()
    )

    rows: list[EvidenceRow] = []

    for row in raw_rows:
        rows.append(
            EvidenceRow(
                academic_year=int(
                    row["academic_year"]
                ),
                grade=int(
                    row["grade"]
                ),
                semester=int(
                    row["semester"]
                ),
                course_name=(
                    row["course_name"].strip()
                ),
                course_code=(
                    row["course_code"].strip()
                ),
                completion_type=(
                    row["completion_type"].strip()
                ),
                credits=(
                    row["credits"].strip()
                ),
                group_size=int(
                    row["pdf_position_group_size"]
                ),
                generation_evidence=(
                    row["generation_evidence"].strip()
                ),
            )
        )

    return rows


def group_key(
    row: EvidenceRow,
) -> GroupKey:
    return GroupKey(
        academic_year=row.academic_year,
        grade=row.grade,
        semester=row.semester,
        normalized_name=(
            normalize_course_name(
                row.course_name
            )
        ),
    )


def build_groups(
    rows: list[EvidenceRow],
) -> dict[
    GroupKey,
    list[EvidenceRow],
]:
    groups: dict[
        GroupKey,
        list[EvidenceRow],
    ] = defaultdict(
        list
    )

    for row in rows:
        groups[
            group_key(
                row
            )
        ].append(
            row
        )

    return dict(
        groups
    )


def build_code_index(
    rows: list[EvidenceRow],
) -> dict[
    str,
    list[EvidenceRow],
]:
    index: dict[
        str,
        list[EvidenceRow],
    ] = defaultdict(
        list
    )

    for row in rows:
        if not row.course_code:
            continue

        index[
            row.course_code
        ].append(
            row
        )

    for code_rows in index.values():
        code_rows.sort(
            key=lambda item: (
                item.academic_year,
                item.grade,
                item.semester,
            )
        )

    return dict(
        index
    )


def usable_direct_generation(
    row: EvidenceRow,
) -> str:
    if row.generation_evidence in {
        GENERATION_FOUR_YEAR,
        GENERATION_SIX_YEAR,
        GENERATION_BOTH,
    }:
        return row.generation_evidence

    return ""


def nearest_previous_direct(
    row: EvidenceRow,
    code_index: dict[
        str,
        list[EvidenceRow],
    ],
) -> EvidenceRow | None:
    candidates = [
        candidate
        for candidate in code_index.get(
            row.course_code,
            []
        )
        if (
            candidate.academic_year
            < row.academic_year
            and usable_direct_generation(
                candidate
            )
        )
    ]

    if not candidates:
        return None

    return max(
        candidates,
        key=lambda candidate: (
            candidate.academic_year,
            candidate.grade,
            candidate.semester,
        ),
    )


def nearest_next_direct(
    row: EvidenceRow,
    code_index: dict[
        str,
        list[EvidenceRow],
    ],
) -> EvidenceRow | None:
    candidates = [
        candidate
        for candidate in code_index.get(
            row.course_code,
            []
        )
        if (
            candidate.academic_year
            > row.academic_year
            and usable_direct_generation(
                candidate
            )
        )
    ]

    if not candidates:
        return None

    return min(
        candidates,
        key=lambda candidate: (
            candidate.academic_year,
            candidate.grade,
            candidate.semester,
        ),
    )


def is_adjacent_year(
    source_year: int,
    target_year: int | None,
) -> bool:
    if target_year is None:
        return False

    return abs(
        source_year
        - target_year
    ) == 1


def build_lineage_state(
    row: EvidenceRow,
    code_index: dict[
        str,
        list[EvidenceRow],
    ],
) -> LineageState:
    previous = nearest_previous_direct(
        row,
        code_index,
    )

    next_row = nearest_next_direct(
        row,
        code_index,
    )

    previous_generation = (
        usable_direct_generation(
            previous
        )
        if previous
        else ""
    )

    next_generation = (
        usable_direct_generation(
            next_row
        )
        if next_row
        else ""
    )

    previous_year = (
        previous.academic_year
        if previous
        else None
    )

    next_year = (
        next_row.academic_year
        if next_row
        else None
    )

    previous_is_adjacent = (
        is_adjacent_year(
            row.academic_year,
            previous_year,
        )
    )

    next_is_adjacent = (
        is_adjacent_year(
            row.academic_year,
            next_year,
        )
    )

    previous_direct_four = (
        previous_is_adjacent
        and previous_generation
        == GENERATION_FOUR_YEAR
    )

    previous_direct_six = (
        previous_is_adjacent
        and previous_generation
        == GENERATION_SIX_YEAR
    )

    next_direct_four = (
        next_is_adjacent
        and next_generation
        == GENERATION_FOUR_YEAR
    )

    next_direct_six = (
        next_is_adjacent
        and next_generation
        == GENERATION_SIX_YEAR
    )

    has_four = (
        previous_direct_four
        or next_direct_four
    )

    has_six = (
        previous_direct_six
        or next_direct_six
    )

    if has_four and has_six:
        return LineageState(
            previous_year=previous_year,
            previous_generation=(
                previous_generation
            ),
            next_year=next_year,
            next_generation=(
                next_generation
            ),
            previous_direct_four_year=(
                previous_direct_four
            ),
            previous_direct_six_year=(
                previous_direct_six
            ),
            next_direct_four_year=(
                next_direct_four
            ),
            next_direct_six_year=(
                next_direct_six
            ),
            candidate=PAIR_CONFLICT,
            reason=(
                "same_code_has_adjacent_"
                "four_and_six_year_evidence"
            ),
        )

    if has_four:
        return LineageState(
            previous_year=previous_year,
            previous_generation=(
                previous_generation
            ),
            next_year=next_year,
            next_generation=(
                next_generation
            ),
            previous_direct_four_year=(
                previous_direct_four
            ),
            previous_direct_six_year=(
                previous_direct_six
            ),
            next_direct_four_year=(
                next_direct_four
            ),
            next_direct_six_year=(
                next_direct_six
            ),
            candidate=GENERATION_FOUR_YEAR,
            reason=(
                "adjacent_year_same_code_"
                "has_four_year_direct_evidence"
            ),
        )

    if has_six:
        return LineageState(
            previous_year=previous_year,
            previous_generation=(
                previous_generation
            ),
            next_year=next_year,
            next_generation=(
                next_generation
            ),
            previous_direct_four_year=(
                previous_direct_four
            ),
            previous_direct_six_year=(
                previous_direct_six
            ),
            next_direct_four_year=(
                next_direct_four
            ),
            next_direct_six_year=(
                next_direct_six
            ),
            candidate=GENERATION_SIX_YEAR,
            reason=(
                "adjacent_year_same_code_"
                "has_six_year_direct_evidence"
            ),
        )

    return LineageState(
        previous_year=previous_year,
        previous_generation=(
            previous_generation
        ),
        next_year=next_year,
        next_generation=(
            next_generation
        ),
        previous_direct_four_year=(
            previous_direct_four
        ),
        previous_direct_six_year=(
            previous_direct_six
        ),
        next_direct_four_year=(
            next_direct_four
        ),
        next_direct_six_year=(
            next_direct_six
        ),
        candidate=PAIR_UNRESOLVED,
        reason=(
            "no_adjacent_year_direct_"
            "generation_evidence"
        ),
    )


def determine_pair_status(
    group: list[EvidenceRow],
    states: dict[
        str,
        LineageState,
    ],
) -> str:
    if len(group) != 2:
        if any(
            states[
                row.course_code
            ].candidate
            == PAIR_CONFLICT
            for row in group
        ):
            return PAIR_CONFLICT

        if any(
            states[
                row.course_code
            ].candidate
            in {
                GENERATION_FOUR_YEAR,
                GENERATION_SIX_YEAR,
            }
            for row in group
        ):
            return PAIR_ONE_SIDED

        return PAIR_UNRESOLVED

    first = states[
        group[0].course_code
    ]

    second = states[
        group[1].course_code
    ]

    if (
        first.candidate
        == PAIR_CONFLICT
        or second.candidate
        == PAIR_CONFLICT
    ):
        return PAIR_CONFLICT

    candidates = {
        first.candidate,
        second.candidate,
    }

    if candidates == {
        GENERATION_FOUR_YEAR,
        GENERATION_SIX_YEAR,
    }:
        return PAIR_COMPLEMENTARY

    resolved_count = sum(
        candidate
        in {
            GENERATION_FOUR_YEAR,
            GENERATION_SIX_YEAR,
        }
        for candidate in candidates
    )

    if resolved_count:
        return PAIR_ONE_SIDED

    return PAIR_UNRESOLVED


def analyze_ambiguous_rows(
    rows: list[EvidenceRow],
) -> list[
    dict[str, str]
]:
    groups = build_groups(
        rows
    )

    code_index = build_code_index(
        rows
    )

    output_rows: list[
        dict[str, str]
    ] = []

    ambiguous_groups = {
        key: group
        for key, group in groups.items()
        if any(
            row.generation_evidence
            == GENERATION_AMBIGUOUS
            for row in group
        )
    }

    for key in sorted(
        ambiguous_groups,
        key=lambda item: (
            item.academic_year,
            item.grade,
            item.semester,
            item.normalized_name,
        ),
    ):
        group = ambiguous_groups[
            key
        ]

        ambiguous_rows = [
            row
            for row in group
            if row.generation_evidence
            == GENERATION_AMBIGUOUS
        ]

        states = {
            row.course_code: (
                build_lineage_state(
                    row,
                    code_index,
                )
            )
            for row in ambiguous_rows
        }

        pair_status = (
            determine_pair_status(
                ambiguous_rows,
                states,
            )
        )

        all_codes = [
            row.course_code
            for row in ambiguous_rows
        ]

        for row in ambiguous_rows:
            state = states[
                row.course_code
            ]

            partner_codes = [
                code
                for code in all_codes
                if code
                != row.course_code
            ]

            output_rows.append(
                {
                    "academic_year": (
                        str(
                            row.academic_year
                        )
                    ),
                    "grade": (
                        str(
                            row.grade
                        )
                    ),
                    "semester": (
                        str(
                            row.semester
                        )
                    ),
                    "course_name": (
                        row.course_name
                    ),
                    "course_code": (
                        row.course_code
                    ),
                    "completion_type": (
                        row.completion_type
                    ),
                    "credits": (
                        row.credits
                    ),
                    "group_size": (
                        str(
                            len(
                                ambiguous_rows
                            )
                        )
                    ),
                    "partner_codes": (
                        ";".join(
                            partner_codes
                        )
                    ),
                    "previous_year": (
                        str(
                            state.previous_year
                        )
                        if state.previous_year
                        is not None
                        else ""
                    ),
                    "previous_generation": (
                        state.previous_generation
                    ),
                    "next_year": (
                        str(
                            state.next_year
                        )
                        if state.next_year
                        is not None
                        else ""
                    ),
                    "next_generation": (
                        state.next_generation
                    ),
                    "previous_direct_four_year": (
                        "yes"
                        if state.previous_direct_four_year
                        else "no"
                    ),
                    "previous_direct_six_year": (
                        "yes"
                        if state.previous_direct_six_year
                        else "no"
                    ),
                    "next_direct_four_year": (
                        "yes"
                        if state.next_direct_four_year
                        else "no"
                    ),
                    "next_direct_six_year": (
                        "yes"
                        if state.next_direct_six_year
                        else "no"
                    ),
                    "row_lineage_candidate": (
                        state.candidate
                    ),
                    "pair_status": (
                        pair_status
                    ),
                    "lineage_reason": (
                        state.reason
                    ),
                }
            )

    return output_rows


def write_csv(
    path: Path,
    rows: list[
        dict[str, str]
    ],
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
            fieldnames=(
                OUTPUT_COLUMNS
            ),
        )

        writer.writeheader()

        writer.writerows(
            rows
        )


def write_report(
    path: Path,
    rows: list[
        dict[str, str]
    ],
) -> None:
    group_rows: dict[
        tuple[
            str,
            str,
            str,
            str,
        ],
        list[
            dict[str, str]
        ],
    ] = defaultdict(
        list
    )

    for row in rows:
        key = (
            row["academic_year"],
            row["grade"],
            row["semester"],
            normalize_course_name(
                row["course_name"]
            ),
        )

        group_rows[
            key
        ].append(
            row
        )

    status_counts: dict[
        str,
        int,
    ] = defaultdict(
        int
    )

    for group in group_rows.values():
        status_counts[
            group[0][
                "pair_status"
            ]
        ] += 1

    lines = [
        (
            "Curriculum generation "
            "lineage report"
        ),
        "=============================================",
        "",
        (
            "ambiguous rows analyzed: "
            f"{len(rows)}"
        ),
        (
            "ambiguous groups analyzed: "
            f"{len(group_rows)}"
        ),
        "",
        "Group summary",
        "-------------",
        (
            f"{PAIR_COMPLEMENTARY}: "
            f"{status_counts[PAIR_COMPLEMENTARY]}"
        ),
        (
            f"{PAIR_ONE_SIDED}: "
            f"{status_counts[PAIR_ONE_SIDED]}"
        ),
        (
            f"{PAIR_CONFLICT}: "
            f"{status_counts[PAIR_CONFLICT]}"
        ),
        (
            f"{PAIR_UNRESOLVED}: "
            f"{status_counts[PAIR_UNRESOLVED]}"
        ),
    ]

    for status in [
        PAIR_COMPLEMENTARY,
        PAIR_ONE_SIDED,
        PAIR_CONFLICT,
        PAIR_UNRESOLVED,
    ]:
        matching_groups = [
            group
            for group in group_rows.values()
            if group[0][
                "pair_status"
            ]
            == status
        ]

        lines.extend(
            [
                "",
                status.upper(),
                "-" * len(
                    status
                ),
                (
                    "count: "
                    f"{len(matching_groups)}"
                ),
            ]
        )

        for group in matching_groups:
            first = group[0]

            lines.append(
                (
                    f"{first['academic_year']} "
                    f"| {first['grade']}-"
                    f"{first['semester']} "
                    f"| {first['course_name']}"
                )
            )

            for row in group:
                previous_text = "-"

                if row["previous_year"]:
                    previous_text = (
                        f"{row['previous_year']}:"
                        f"{row['previous_generation'] or '-'}"
                    )

                next_text = "-"

                if row["next_year"]:
                    next_text = (
                        f"{row['next_year']}:"
                        f"{row['next_generation'] or '-'}"
                    )

                lines.append(
                    (
                        "  "
                        f"{row['course_code']} "
                        f"| candidate="
                        f"{row['row_lineage_candidate']} "
                        f"| prev={previous_text} "
                        f"| next={next_text}"
                    )
                )

    lines.extend(
        [
            "",
            "Rules",
            "-----",
            (
                "1. Only rows already classified "
                "as ambiguous are analyzed."
            ),
            (
                "2. Same course_code is never "
                "globally assigned to one generation."
            ),
            (
                "3. Only direct evidence from an "
                "immediately adjacent academic year "
                "is used for a row candidate."
            ),
            (
                "4. Non-adjacent evidence is shown "
                "for reference but does not assign "
                "a candidate."
            ),
            (
                "5. Evidence of both generations "
                "for the same ambiguous row is "
                "classified as conflict."
            ),
            (
                "6. complementary_pair_candidate "
                "requires exactly two ambiguous rows "
                "and opposite four-year/six-year "
                "row candidates."
            ),
            (
                "7. Candidate results are diagnostic "
                "evidence only and must not be written "
                "into baseline automatically."
            ),
            (
                "8. Course-code prefixes are never "
                "used as generation evidence."
            ),
            "",
        ]
    )

    path.write_text(
        "\n".join(
            lines
        ),
        encoding="utf-8",
    )


def main() -> None:
    rows = load_evidence_rows()

    output_rows = (
        analyze_ambiguous_rows(
            rows
        )
    )

    csv_path = (
        output_csv_path()
    )

    report_path = (
        output_report_path()
    )

    write_csv(
        csv_path,
        output_rows,
    )

    write_report(
        report_path,
        output_rows,
    )

    print()
    print(
        "Curriculum generation lineage"
    )
    print(
        "-----------------------------"
    )
    print(
        f"ambiguous rows: {len(output_rows)}"
    )
    print(
        f"lineage: {csv_path}"
    )
    print(
        f"report:  {report_path}"
    )


if __name__ == "__main__":
    main()
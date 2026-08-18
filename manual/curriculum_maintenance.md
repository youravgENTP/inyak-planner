# Inyak Planner 교육과정 점검 및 업데이트 설명서

## 목차

- [0. 전체 작업 요약](#0-전체-작업-요약)
- [1. 작업 준비 및 전체 흐름](#1-작업-준비-및-전체-흐름)
- [2. 교육과정 데이터 구조](#2-교육과정-데이터-구조)
- [3. Audit 및 Seed CSV 업데이트](#3-audit-및-seed-csv-업데이트)
- [4. SQLite 반영 및 검증](#4-sqlite-반영-및-검증)
- [5. Git 반영](#5-git-반영)
- [6. PostgreSQL 개발·운영 DB 반영 및 검증](#6-postgresql-개발운영-db-반영-및-검증)
- [7. 오류 및 예외 상황](#7-오류-및-예외-상황)


## 0. 전체 작업 요약

이 장은 교육과정 유지보수 작업 전체를 빠르게 확인하기 위한 요약이다.

각 스크립트의 동작, Audit 결과 해석, Seed CSV 컬럼 구조, 오류 대응 방법 등은 이후 각 장에서 설명한다.

이미 작업 방식에 익숙하다면 이 장의 명령어와 체크리스트만 기준으로 작업을 진행할 수 있다.


### 0.1 전체 작업 순서

학번별 교육과정 유지보수는 기본적으로 다음 순서로 진행한다.

    최신 dev 및 대상 Seed 확인
        ↓
    Audit 실행
        ↓
    Audit 결과 및 실제 개설 이력 확인
        ↓
    Seed CSV 수정
        ↓
    Audit 재실행
        ↓
    SQLite 반영 및 검증
        ↓
    Git diff 확인
        ↓
    dev commit / push
        ↓
    개발 PostgreSQL dry-run
        ↓
    개발 PostgreSQL apply
        ↓
    개발 DB 검증
        ↓
    개발 웹 확인
        ↓
    운영 PostgreSQL dry-run
        ↓
    운영 PostgreSQL apply
        ↓
    운영 DB 최종 검증

작업은 기본적으로 한 학번씩 진행한다.

예를 들어 2022학번을 작업한다면 이후 명령의:

    YYYY

부분을:

    2022

로 바꾸어 사용한다.


### 0.2 전체 명령어 요약

아래 명령은 정상적인 교육과정 유지보수 과정에서 사용하는 주요 명령만 순서대로 정리한 것이다.


#### 0.2.1 프로젝트 디렉터리로 이동

    cd /Users/younyung.gene/inyak-planner


#### 0.2.2 현재 Git 상태 확인

    git status

    git branch --show-current

기본 작업 브랜치는:

    dev

이다.


#### 0.2.3 Audit 실행

예: 2022학번

    python scripts/audit_curriculum.py \
      --entry-year 2022

모든 학번을 한 번에 검사하려면:

    python scripts/audit_curriculum.py

특정 학번을 유지보수할 때는 `--entry-year`를 지정하는 것을 기본으로 한다.


#### 0.2.4 Seed 수정 후 Audit 재실행

Seed 파일:

    data/seed/curriculum_YYYY.csv

예:

    data/seed/curriculum_2022.csv

수정 후 다시:

    python scripts/audit_curriculum.py \
      --entry-year 2022

를 실행한다.


#### 0.2.5 SQLite 반영

    python scripts/import_curriculum.py \
      data/seed/curriculum_2022.csv

정상적으로 완료되면 다음 값을 확인한다.

    전체 행
    현재 과목
    변경 전 과목
    현재 전필 학점
    현재 전선 개설학점
    현재 과목 중 대표 학정번호 미지정


#### 0.2.6 Git Diff 확인

    git status

    git diff --stat -- data/seed/curriculum_2022.csv

    git diff -- data/seed/curriculum_2022.csv


#### 0.2.7 Git 반영

대상 파일만 stage한다.

    git add data/seed/curriculum_2022.csv

Stage된 내용을 확인한다.

    git diff --cached

Commit:

    git commit -m "Update 2022 curriculum changes"

Push:

    git push origin dev


#### 0.2.8 개발 PostgreSQL Dry Run

개발 Supabase project ref:

    rkunrjwetsnonwnmatec

`DATABASE_URL`이 개발 DB를 가리키는 상태에서 실행한다.

    python scripts/import_curriculum_postgres.py \
      data/seed/curriculum_2022.csv \
      --project-ref rkunrjwetsnonwnmatec \
      --replace

출력되는 다음 계획을 확인한다.

    UPDATE
    INSERT
    DELETE

`--apply`가 없으므로 이 단계에서는 DB에 쓰지 않는다.


#### 0.2.9 개발 PostgreSQL Apply

Dry Run 결과가 예상과 일치하면:

    python scripts/import_curriculum_postgres.py \
      data/seed/curriculum_2022.csv \
      --project-ref rkunrjwetsnonwnmatec \
      --replace \
      --apply


#### 0.2.10 개발 PostgreSQL 기본 검증

PostgreSQL에 접속한 뒤:

    SELECT
        COUNT(*) AS total_rows,
        COUNT(*) FILTER (
            WHERE change_role = 'current'
        ) AS current_rows,
        COUNT(*) FILTER (
            WHERE change_role = 'legacy'
        ) AS legacy_rows
    FROM public.curriculum_courses
    WHERE entry_year = 2022;

속성 변경 행 수도 확인한다.

    SELECT COUNT(*) AS attribute_change_count
    FROM public.curriculum_courses
    WHERE entry_year = 2022
      AND change_role = 'current'
      AND (
          previous_credits IS NOT NULL
          OR previous_completion_type IS NOT NULL
          OR previous_grade IS NOT NULL
          OR previous_semester IS NOT NULL
      );


#### 0.2.11 사용자 수강기록 FK 확인

필요한 경우 orphan을 확인한다.

    SELECT COUNT(*) AS remaining_orphans
    FROM public.user_course_records AS ucr
    LEFT JOIN public.curriculum_courses AS cc
      ON cc.id = ucr.curriculum_course_id
    WHERE ucr.curriculum_course_id IS NOT NULL
      AND cc.id IS NULL;

정상 결과:

    0


#### 0.2.12 운영 PostgreSQL Dry Run

운영 Supabase project ref:

    alkamigyftmalimqoixa

`DATABASE_URL`이 운영 DB를 가리키는 상태에서 실행한다.

    python scripts/import_curriculum_postgres.py \
      data/seed/curriculum_2022.csv \
      --project-ref alkamigyftmalimqoixa \
      --replace

개발 DB에서 확인한 결과와 비교한다.

특히:

    전체 행
    현재 과목
    변경 전 과목
    UPDATE
    INSERT
    DELETE

가 예상과 맞는지 확인한다.


#### 0.2.13 운영 PostgreSQL Apply

Dry Run 결과가 정상이라면:

    python scripts/import_curriculum_postgres.py \
      data/seed/curriculum_2022.csv \
      --project-ref alkamigyftmalimqoixa \
      --replace \
      --apply


#### 0.2.14 운영 DB 최종 검증

개발 DB에서 사용한 것과 동일한 검증 SQL을 운영 DB에서도 실행한다.

최소한 다음 값을 확인한다.

    total_rows
    current_rows
    legacy_rows
    attribute_change_count

구조변경을 추가한 작업이라면 해당 `change_group`도 직접 확인한다.

필요한 경우 orphan 검사도 다시 실행한다.


### 0.3 작업 완료 체크리스트

한 학번의 교육과정 유지보수 작업은 다음 체크리스트를 위에서 아래로 진행한다.

#### 0.3.1 Audit 및 Seed

- [ ] 최신 `dev` 기준으로 작업하고 있다.
- [ ] 대상 `curriculum_YYYY.csv`를 확인했다.
- [ ] 최초 Audit을 실행했다.
- [ ] Audit에서 발견된 차이를 확인했다.
- [ ] 필요한 실제 개설 이력을 조사했다.
- [ ] Seed CSV를 수정했다.
- [ ] 수정 후 Audit을 다시 실행했다.
- [ ] 남은 Audit 결과가 설명 가능한 상태이다.


#### 0.3.2 SQLite

- [ ] `import_curriculum.py`를 실행했다.
- [ ] 전체 행 수를 확인했다.
- [ ] current / legacy 수를 확인했다.
- [ ] 전필 / 전선 개설학점을 확인했다.
- [ ] 필요한 경우 주요 변경 과목을 직접 확인했다.


#### 0.3.3 Git

- [ ] `git diff`를 확인했다.
- [ ] 의도하지 않은 파일 변경이 포함되지 않았다.
- [ ] 대상 파일을 commit했다.
- [ ] `dev`에 push했다.
- [ ] 원격 `dev`에 변경사항이 반영된 것을 확인했다.


#### 0.3.4 개발 PostgreSQL

- [ ] `DATABASE_URL`이 개발 DB를 가리키는지 확인했다.
- [ ] 개발 DB dry-run을 실행했다.
- [ ] UPDATE / INSERT / DELETE 수를 확인했다.
- [ ] 예상하지 못한 DELETE가 없다.
- [ ] `--apply`로 개발 DB에 반영했다.
- [ ] total / current / legacy 수를 확인했다.
- [ ] Attribute Change 수를 확인했다.
- [ ] 필요한 구조변경 그룹을 확인했다.
- [ ] 필요한 경우 orphan이 0인지 확인했다.
- [ ] 개발 웹에서 교육과정 표시를 확인했다.


#### 0.3.5 운영 PostgreSQL

- [ ] `DATABASE_URL`이 운영 DB를 가리키는지 확인했다.
- [ ] 운영 DB dry-run을 실행했다.
- [ ] 개발 DB에서 검증한 결과와 비교했다.
- [ ] UPDATE / INSERT / DELETE 수를 확인했다.
- [ ] `--apply`로 운영 DB에 반영했다.
- [ ] total / current / legacy 수를 다시 확인했다.
- [ ] Attribute Change 수를 다시 확인했다.
- [ ] 필요한 구조변경 그룹을 확인했다.
- [ ] 필요한 경우 orphan이 0인지 확인했다.


#### 0.3.6 작업 종료

다음 네 상태가 서로 일치하면 해당 학번의 유지보수 작업을 종료한다.

    Seed CSV
    =
    SQLite curriculum_courses
    =
    개발 PostgreSQL curriculum_courses

단, SQLite와 PostgreSQL의 `id` 값 자체가 동일해야 한다는 의미는 아니다.

비교 대상은 해당 학번의 교육과정 내용과 변경 이력이다.

## 1. 작업 준비 및 전체 흐름

### 1.1 관리 대상 파일과 데이터

교육과정 유지보수에서는 다음 파일과 데이터를 사용한다.

#### 1.1.1 교육과정 Seed CSV

학번별 교육과정의 기준 파일이다.

    data/seed/curriculum_YYYY.csv

예:

    data/seed/curriculum_2022.csv
    data/seed/curriculum_2023.csv
    data/seed/curriculum_2024.csv

Seed CSV에는 해당 학번의:

- 현재 교육과정
- 구조변경 전 과목
- 학점·이수구분·학년·학기 변경 이력

이 저장된다.

교육과정을 수정할 때는 DB를 직접 수정하는 것이 아니라 **Seed CSV를 먼저 수정하는 것을 기본으로 한다.**


#### 1.1.2 실제 개설 이력

연도별 수강편람에서 수집한 실제 개설 과목은 로컬 SQLite의:

    data/db/inyak.db

안의:

    courses

테이블에 저장된다.

`courses`에는 실제 개설 당시의 다음 정보가 들어 있다.

- 학년도
- 학기
- 권장학년
- 학정번호
- 과목명
- 이수구분
- 학점

Audit은 Seed CSV와 이 실제 개설 이력을 비교한다.


#### 1.1.3 SQLite 교육과정 테이블

Seed를 로컬 DB에 반영하면:

    data/db/inyak.db

의:

    curriculum_courses

테이블에 저장된다.

반영에는 다음 스크립트를 사용한다.

    scripts/import_curriculum.py


#### 1.1.4 PostgreSQL 교육과정 테이블

개발 및 운영 환경에서는 교육과정이 다음 PostgreSQL 테이블에 저장된다.

    public.curriculum_courses

반영에는 다음 스크립트를 사용한다.

    scripts/import_curriculum_postgres.py

개발 DB와 운영 DB는 서로 다른 Supabase 프로젝트이므로 각각 별도로 반영한다.


#### 1.1.5 주요 스크립트

교육과정 유지보수에서 주로 사용하는 스크립트는 다음 세 개이다.

    scripts/audit_curriculum.py
    scripts/import_curriculum.py
    scripts/import_curriculum_postgres.py

역할은 다음과 같다.

| 스크립트 | 역할 |
|---|---|
| `audit_curriculum.py` | Seed와 실제 수강편람 개설 이력을 비교 |
| `import_curriculum.py` | Seed를 로컬 SQLite `curriculum_courses`에 반영 |
| `import_curriculum_postgres.py` | Seed를 개발·운영 PostgreSQL에 반영 |


### 1.2 작업 시작 전 준비

교육과정 작업은 프로젝트 루트에서 진행한다.

    cd /Users/younyung.gene/inyak-planner

먼저 현재 Git 상태를 확인한다.

    git status

    git branch --show-current

기본 작업 브랜치는:

    dev

이다.

현재 작업 중인 다른 수정사항이 있다면 `git pull` 등을 실행하기 전에 먼저 상태를 확인한다.

원격의 최신 상태를 받아야 하는 경우에는 필요한 로컬 변경사항을 확인한 뒤:

    git pull --ff-only origin dev

를 사용한다.

교육과정 작업을 시작할 때는 최소한 다음 파일이 최신 `dev` 기준인지 확인한다.

    data/seed/curriculum_YYYY.csv
    scripts/audit_curriculum.py
    scripts/import_curriculum.py
    scripts/import_curriculum_postgres.py

특히 이전 작업에서 사용했던 명령이나 스크립트 동작을 기억에 의존하지 않고 현재 `dev`의 파일을 기준으로 한다.


### 1.3 학번별 작업 흐름

교육과정 유지보수는 가능하면 한 학번씩 진행한다.

예를 들어 2022학번을 작업한다면 대상 Seed는:

    data/seed/curriculum_2022.csv

이다.

작업 흐름은 다음과 같다.

    1. 대상 Seed와 최신 dev 확인

    2. audit_curriculum.py 실행

    3. Audit에서 발견된 차이 조사

    4. 실제 courses 개설 이력 확인

    5. curriculum_YYYY.csv 수정

    6. Audit 재실행

    7. import_curriculum.py로 SQLite 반영

    8. SQLite 결과 검증

    9. Git diff 확인 후 dev에 commit / push

    10. 개발 PostgreSQL dry-run

    11. 개발 PostgreSQL apply 및 검증

    12. 개발 웹에서 결과 확인

    13. 운영 PostgreSQL dry-run

    14. 운영 PostgreSQL apply 및 최종 검증

각 단계에서 사용하는 실제 명령은 `## 0. 전체 작업 요약`에 모아 두었으며, 세부 동작과 결과 해석은 이후 각 장에서 설명한다.

작업 대상 학번이 바뀌면 기본적으로 다음 두 부분을 함께 바꾼다.

    --entry-year YYYY

    data/seed/curriculum_YYYY.csv

예를 들어 2024학번을 작업한다면:

    python scripts/audit_curriculum.py \
      --entry-year 2024

및:

    data/seed/curriculum_2024.csv

를 사용한다.

## 2. 교육과정 데이터 구조

### 2.0 빠른 참조

학번별 전공 교육과정은 다음 Seed CSV에 저장한다.

    data/seed/curriculum_YYYY.csv

예:

    data/seed/curriculum_2022.csv

현재 교육과정 Seed는 다음 19개 컬럼을 사용한다.

    entry_year
    grade
    semester
    course_name
    course_code
    completion_type
    credits
    notes
    change_group
    change_type
    change_role
    change_effective_year
    change_note
    previous_credits
    previous_completion_type
    previous_grade
    previous_semester
    attribute_change_effective_year
    attribute_change_note

컬럼은 크게 다음 네 그룹으로 나눌 수 있다.

| 구분 | 컬럼 |
|---|---|
| 기본 과목 정보 | `entry_year`, `grade`, `semester`, `course_name`, `course_code`, `completion_type`, `credits`, `notes` |
| 구조적 변경 | `change_group`, `change_type`, `change_role`, `change_effective_year`, `change_note` |
| 동일 과목 속성 변경 | `previous_credits`, `previous_completion_type`, `previous_grade`, `previous_semester` |
| 속성 변경 메타데이터 | `attribute_change_effective_year`, `attribute_change_note` |

변경 이력 기록 방식은 다음과 같이 구분한다.

| 상황 | 기록 방식 |
|---|---|
| 원래 Seed 값이 잘못됨 | 현재 값만 수정 |
| 같은 과목의 학점 변경 | `previous_credits` |
| 같은 과목의 이수구분 변경 | `previous_completion_type` |
| 같은 과목의 학년 변경 | `previous_grade` |
| 같은 과목의 학기 변경 | `previous_semester` |
| 한 과목이 다른 한 과목으로 변경 | `change_type = 1:1` |
| 한 과목이 여러 과목으로 분리 | `change_type = 1:N` |
| 여러 과목이 한 과목으로 통합 | `change_type = N:1` |
| 여러 과목이 여러 과목으로 재편 | `change_type = N:M` |
| 기존 과목과 관계없는 신규 과목 | 새 `current` 행 |


### 2.1 Seed CSV 기본 구조

하나의 `curriculum_YYYY.csv`는 하나의 입학 학번에 대한 교육과정을 나타낸다.

예:

    curriculum_2022.csv
        → 2022학번 교육과정

Seed에는 현재 과목만 저장하지 않는다.

필요한 경우 다음 정보가 하나의 파일에 함께 존재한다.

- 현재 적용되는 과목
- 구조변경 전 과목
- 같은 과목의 과거 속성
- 구조변경 관계
- 변경 적용 연도
- 변경 관련 메모

현재 적용되는 과목은 `current`, 구조변경으로 더 이상 현재 상태가 아닌 과목은 `legacy`로 구분한다.

Seed CSV가 교육과정 데이터의 기준이며, SQLite와 PostgreSQL의 `curriculum_courses`는 이 Seed를 반영한 결과이다.


### 2.2 기본 과목 정보

#### 2.2.1 `entry_year`

해당 교육과정이 적용되는 입학 학번이다.

예:

    2022

`entry_year = 2022`는 2022학년도 개설 과목이라는 의미가 아니다.

다음 의미이다.

    2022학번 학생에게 적용되는 교육과정

한 개의 Seed CSV에는 하나의 `entry_year`만 존재해야 한다.


#### 2.2.2 `grade`

해당 교육과정에서 과목이 배치되는 권장학년이다.

사용 범위:

    1 ~ 6

예:

    grade = 4

이면 해당 학번 교육과정에서 4학년 과목이라는 의미이다.

같은 학정번호가 실제 교육과정 변경으로 다른 학년으로 이동한 경우에는 현재 학년을 `grade`에 기록하고 이전 학년은 `previous_grade`에 기록한다.


#### 2.2.3 `semester`

해당 교육과정에서 과목이 배치되는 학기이다.

사용 값:

    1
    2

예:

    grade = 4
    semester = 2

이면 4학년 2학기 과목이다.

같은 과목이 다른 학기로 이동한 경우 현재 학기를 `semester`, 이전 학기를 `previous_semester`에 기록한다.


#### 2.2.4 `course_name`

해당 행이 나타내는 과목명이다.

예:

    임상미생물학
    의약품합성학
    독성학1

구조변경의 `legacy` 행에는 과거 과목명을, `current` 행에는 현재 과목명을 각각 기록한다.

오탈자나 띄어쓰기 같은 단순 표기 오류는 변경 이력으로 만들지 않고 직접 수정한다.


#### 2.2.5 `course_code`

과목의 학정번호이다.

예:

    ADB046
    ADA198

실제 개설 과목과 매칭할 때 중요한 식별자로 사용된다.

학정번호가 실제 교육과정 변경으로 바뀐 경우 기존 코드를 단순히 새 코드로 덮어쓰지 않고 일반적으로 `change_*`를 이용한 구조변경으로 기록한다.

예:

    ADB075
        ↓
    ADA115

현재 과목에는 가능한 한 실제 수강편람에서 사용하는 대표 학정번호를 기록한다.

공식 자료에서 아직 코드를 확인할 수 없는 경우에는 빈 값이 존재할 수 있다.


#### 2.2.6 `completion_type`

해당 과목의 현재 이수구분이다.

현재 전공 교육과정에서는 주로 다음 값을 사용한다.

    전필
    전선

동일 과목의 이수구분이 변경된 경우:

    completion_type = 현재 값
    previous_completion_type = 과거 값

형태로 기록한다.

예:

    completion_type = 전필
    previous_completion_type = 전선


#### 2.2.7 `credits`

해당 과목의 현재 학점이다.

예:

    1
    2
    3

같은 과목의 학점이 변경된 경우:

    credits = 현재 학점
    previous_credits = 이전 학점

으로 기록한다.

예:

    credits = 3
    previous_credits = 2


#### 2.2.8 `notes`

해당 행 자체에 대한 일반적인 설명이나 출처를 기록한다.

예:

    2022학년도 공식 교육과정표 기준.

또는:

    2022학번이 5학년이던 2026학년도 실제 개설 이력에서 확인.

`notes`는 필수적인 변경 이력 필드는 아니다.

필요한 경우 해당 행의 출처나 판단 근거를 남기는 용도로 사용한다.

다음 필드와 역할을 구분한다.

    notes
        → 행 자체에 대한 일반 설명

    change_note
        → 구조변경 설명

    attribute_change_note
        → 동일 과목의 속성 변경 설명


### 2.3 구조적 변경 필드: `change_*`

`change_*`는 과목의 단순 속성이 아니라 과목의 정체성이나 구조가 바뀐 경우 사용한다.

대표적인 경우:

- 학정번호 변경
- 과목 대체
- 하나의 과목이 여러 과목으로 분리
- 여러 과목이 하나로 통합
- 여러 과목이 여러 과목으로 재편

사용 컬럼:

    change_group
    change_type
    change_role
    change_effective_year
    change_note


#### 2.3.1 `change_group`

같은 구조변경 사건에 속하는 과거 과목과 현재 과목을 연결하는 그룹 이름이다.

예:

    2022-SYNTHESIS
    2022-TOXICOLOGY
    2022-COMMUNITY-PRE-PRACTICE

예를 들어:

    ADB028 의약품합성학1
    ADB038 의약품합성학2
        ↓
    ADA198 의약품합성학

관계를 기록한다면 세 행 모두 같은 `change_group`을 사용한다.

    change_group = 2022-SYNTHESIS

`change_group`은 정해진 enum이 아니라 사람이 알아보기 위한 식별자이다.

일반적으로 다음과 같이 학번을 포함해 이름을 만든다.

    학번-변경내용


#### 2.3.2 `change_type`

한 구조변경 안에서 기존 과목과 현재 과목의 수 관계를 기록한다.

사용 값:

    1:1
    1:N
    N:1
    N:M

##### 2.3.2.1 `1:1`

기존 과목 하나가 새 과목 하나로 변경된 경우이다.

예:

    ADB075
        ↓
    ADA115

구성:

    legacy = 1
    current = 1


##### 2.3.2.2 `1:N`

기존 과목 하나가 여러 과목으로 분리된 경우이다.

예:

    ADB068 독성학
        ↓
    ADA234 독성학1
    ADA235 독성학2

구성:

    legacy = 1
    current >= 2


##### 2.3.2.3 `N:1`

여러 기존 과목이 하나의 현재 과목으로 통합된 경우이다.

예:

    ADB028 의약품합성학1
    ADB038 의약품합성학2
        ↓
    ADA198 의약품합성학

구성:

    legacy >= 2
    current = 1


##### 2.3.2.4 `N:M`

여러 기존 과목이 여러 현재 과목으로 재편된 경우이다.

구성:

    legacy >= 2
    current >= 2

단순한 `1:N` 또는 `N:1`로 표현할 수 없는 구조변경에 사용한다.


#### 2.3.3 `change_role`

구조변경 안에서 해당 행이 과거 상태인지 현재 상태인지 나타낸다.

사용 값:

    legacy
    current

`legacy`:

    구조변경 전 과목

`current`:

    현재 적용되는 과목

예:

    ADB070 항암약물요법
        change_role = legacy

    ADB103 항암약물요법1
        change_role = current

구조변경이 없는 일반 과목도 현재 데이터에서는 `current`로 취급된다.


#### 2.3.4 `change_effective_year`

해당 구조변경이 그 학번에 적용된 연도를 기록한다.

예:

    change_effective_year = 2026

이 값은 과목이 대학 전체에서 처음 변경된 연도와 반드시 같지는 않다.

해당 `entry_year` 학생이 실제로 그 변경된 과목을 적용받은 연도를 기록한다.

예를 들어 2022학번이 2026년에 5학년이 되어 새 학정번호의 과목을 적용받았다면:

    change_effective_year = 2026

으로 기록할 수 있다.

같은 `change_group`에 속하는 행들은 동일한 `change_effective_year`을 사용한다.


#### 2.3.5 `change_note`

구조변경 내용을 설명하는 메모이다.

가능하면 다음 내용을 포함한다.

- 기존 과목
- 새 과목
- 변경 형태
- 해당 학번에 적용된 시점

예:

    2022학번 기준 지역약국 예비실무실습의
    학정번호가 ADB075에서 ADA115로 변경됨.

또는:

    2022학번 기준 기존 독성학이
    독성학1과 독성학2로 분리됨.


### 2.4 동일 과목 속성 변경 필드: `previous_*`

`previous_*`는 과목의 정체성과 학정번호는 유지되면서 일부 속성만 실제로 변경된 경우 사용한다.

사용 컬럼:

    previous_credits
    previous_completion_type
    previous_grade
    previous_semester

Seed의 기본 필드에는 현재 값을 기록하고, 실제로 변경된 과거 값만 `previous_*`에 기록한다.


#### 2.4.1 `previous_credits`

학점 변경 전 값을 기록한다.

예:

    과거: 2학점
    현재: 3학점

Seed:

    credits = 3
    previous_credits = 2

학점이 변경되지 않았다면 비워 둔다.


#### 2.4.2 `previous_completion_type`

이수구분 변경 전 값을 기록한다.

예:

    과거: 전선
    현재: 전필

Seed:

    completion_type = 전필
    previous_completion_type = 전선

변경되지 않았다면 비워 둔다.


#### 2.4.3 `previous_grade`

권장학년 변경 전 값을 기록한다.

예:

    과거: 5학년 2학기
    현재: 4학년 2학기

Seed:

    grade = 4
    semester = 2
    previous_grade = 5

학기가 그대로라면 `previous_semester`는 비워 둔다.


#### 2.4.4 `previous_semester`

학기 변경 전 값을 기록한다.

예:

    과거: 4학년 1학기
    현재: 4학년 2학기

Seed:

    grade = 4
    semester = 2
    previous_semester = 1

학년이 그대로라면 `previous_grade`는 비워 둔다.


#### 2.4.5 여러 속성이 동시에 변경된 경우

한 과목에서 여러 속성이 동시에 변경될 수도 있다.

예:

    과거:
    5학년 1학기 / 전선 / 2학점

    현재:
    3학년 2학기 / 전필 / 1학점

Seed:

    grade = 3
    semester = 2
    completion_type = 전필
    credits = 1

    previous_grade = 5
    previous_semester = 1
    previous_completion_type = 전선
    previous_credits = 2

`previous_*`에는 실제로 변경된 속성만 기록한다.

과거 행 전체를 복제하는 용도로 사용하지 않는다.


### 2.5 속성 변경 메타데이터

`previous_*`가 존재하는 행에서는 변경 시점과 변경 내용을 다음 컬럼에 기록할 수 있다.

    attribute_change_effective_year
    attribute_change_note


#### 2.5.1 `attribute_change_effective_year`

속성변경이 해당 학번에 적용된 연도를 기록한다.

예:

    ADB046 임상미생물학
    2학점 → 3학점

2022학번이 해당 과목을 실제로 수강하는 2025학년도부터 3학점이 적용되었다면:

    attribute_change_effective_year = 2025

로 기록한다.

`change_effective_year`과 마찬가지로 해당 cohort 기준 적용 시점을 사용한다.


#### 2.5.2 `attribute_change_note`

어떤 속성이 어떻게 변경되었는지 설명한다.

예:

    2022학번 기준 임상미생물학이
    2025학년도 개설에서
    2학점에서 3학점으로 변경됨.

또는:

    2022학번 기준 건강기능식품학이
    4학년 1학기에서 4학년 2학기로 이동함.


### 2.6 변경 유형별 데이터 작성 방식

실제 Seed를 수정할 때는 변경 유형에 따라 다음 방식으로 기록한다.


#### 2.6.1 단순 데이터 오류

기존 Seed 값이 처음부터 잘못 입력된 경우이다.

예:

    Seed: 2학점
    당시 공식 자료: 3학점
    당시 실제 개설: 3학점

처리:

    credits = 3

으로 직접 수정한다.

다음은 기록하지 않는다.

    previous_credits = 2

`previous_*`는 Seed 수정 이력이 아니라 실제 교육과정 변경 이력을 기록하기 위한 필드이다.


#### 2.6.2 동일 과목의 속성 변경

학정번호와 과목 정체성이 유지되면서 학점, 이수구분, 학년 또는 학기만 변경된 경우이다.

예:

    ADB046
    2학점 → 3학점

처리:

    credits = 3
    previous_credits = 2
    attribute_change_effective_year = ...

별도의 `legacy` 행을 만들지 않는다.


#### 2.6.3 1:1 구조변경

한 과목이 다른 한 과목으로 변경된 경우이다.

예:

    ADB075
        ↓
    ADA115

처리:

    ADB075
        change_role = legacy

    ADA115
        change_role = current

두 행에 동일한:

    change_group
    change_type = 1:1
    change_effective_year

을 기록한다.


#### 2.6.4 1:N 구조변경

한 과목이 여러 과목으로 분리된 경우이다.

예:

    ADB068
        ↓
    ADA234
    ADA235

처리:

    ADB068
        legacy

    ADA234
        current

    ADA235
        current

모든 행에 동일한:

    change_group
    change_type = 1:N

을 기록한다.


#### 2.6.5 N:1 구조변경

여러 과목이 하나의 과목으로 통합된 경우이다.

예:

    ADB028
    ADB038
        ↓
    ADA198

처리:

    ADB028
        legacy

    ADB038
        legacy

    ADA198
        current

모든 행에 동일한:

    change_group
    change_type = N:1

을 기록한다.


#### 2.6.6 N:M 구조변경

여러 기존 과목이 여러 현재 과목으로 하나의 개편 단위 안에서 재편된 경우이다.

처리:

    기존 과목들
        → legacy

    현재 과목들
        → current

그리고 모두 동일한:

    change_group
    change_type = N:M

을 사용한다.


#### 2.6.7 신규 과목

기존 과목과 대체·분리·통합 관계가 없는 완전히 새로운 과목이다.

처리:

    새 current 행 추가

일반적으로 다음 필드는 비워 둔다.

    change_group
    change_type
    change_effective_year
    change_note

    previous_credits
    previous_completion_type
    previous_grade
    previous_semester

    attribute_change_effective_year
    attribute_change_note

필요하면 `notes`에 실제 개설 확인 시점이나 추가 근거를 기록한다.


#### 2.6.8 구조변경과 `previous_*`를 중복 기록하지 않는다

구조변경에서는 과거 상태가 `legacy` 행에 이미 보존된다.

예:

    ADB071
    4학년 2학기
        ↓
    ADA145
    5학년 1학기

이라면:

    ADB071
        legacy
        grade = 4
        semester = 2

    ADA145
        current
        grade = 5
        semester = 1

로 기록한다.

ADA145에 다시:

    previous_grade = 4
    previous_semester = 2

를 기록하지 않는다.

구조변경은 `legacy/current + change_*`, 동일 과목의 속성변경은 `previous_*`로 관리한다.


#### 2.6.9 `current`의 의미

이 프로젝트에서 `current`는 대학 전체에서 가장 최신인 교육과정을 뜻하지 않는다.

해당 `entry_year` 학생에게 현재까지 적용된 변경을 반영한 교육과정 상태를 뜻한다.

따라서 같은 과목이라도 학번별 Seed에서:

- 학점
- 이수구분
- 학년
- 학기
- 학정번호
- 변경 적용 연도

가 서로 다를 수 있다.

각 학번의 실제 적용 상태는 Audit 단계에서 해당 cohort의 실제 개설 이력과 비교해 확인한다.


## 3. Audit 및 Seed CSV 업데이트

### 3.0 실행 명령 요약

대상 학번의 Audit을 실행한다.

예: 2022학번

    cd /Users/younyung.gene/inyak-planner

    python scripts/audit_curriculum.py \
      --entry-year 2022

Audit 결과를 확인하고 필요한 경우:

    data/seed/curriculum_2022.csv

를 수정한다.

수정 후 같은 Audit을 다시 실행한다.

    python scripts/audit_curriculum.py \
      --entry-year 2022

일반적인 반복 과정은 다음과 같다.

    Audit 실행
        ↓
    Candidate / mismatch 확인
        ↓
    실제 개설 이력 조사
        ↓
    Seed 수정
        ↓
    Audit 재실행

`--entry-year`를 생략하면 모든 `curriculum_*.csv`를 검사한다.

    python scripts/audit_curriculum.py


### 3.1 Audit 스크립트가 하는 일

사용 스크립트:

    scripts/audit_curriculum.py

Audit은 다음 두 데이터를 비교한다.

    교육과정:
    data/seed/curriculum_YYYY.csv

    실제 개설 이력:
    data/db/inyak.db
        └─ courses

PostgreSQL의 `curriculum_courses`를 검사하는 스크립트가 아니다.

Seed CSV를 직접 읽기 때문에 Seed를 수정한 직후 SQLite import 없이 바로 다시 Audit할 수 있다.

검증은 두 방향으로 수행된다.

    A. 교육과정 → 실제 개설 이력
    B. 실제 개설 이력 → 교육과정


#### 3.1.1 정방향 검증

Seed에 있는 각 과목이 해당 cohort가 실제로 그 학년에 재학했을 시점의 수강편람에서 어떻게 개설되었는지 확인한다.

주로 다음 문제를 찾는다.

- 학정번호로 실제 과목을 찾을 수 없음
- 학점 불일치
- 동일 과목 분반 간 학점 충돌


#### 3.1.2 역방향 검증

실제 수강편람에 개설된 과목이 해당 cohort의 Seed에서 설명되고 있는지 확인한다.

주로 다음 문제를 찾는다.

- 속성 변경
- 학년 또는 학기 이동
- 학정번호 변경
- 학정번호와 위치 동시 변경
- Seed에 없는 신규 과목


#### 3.1.3 Cohort 기준 연도 계산

Audit은 최신 수강편람을 모든 학번에 그대로 적용하지 않는다.

기본 계산은 다음과 같다.

    실제 학년도
    =
    entry_year + grade - 1

예:

    2022학번 3학년 → 2024학년도
    2022학번 4학년 → 2025학년도
    2022학번 5학년 → 2026학년도

따라서 2022학번의 4학년 과목은 기본적으로 2025학년도 4학년 실제 개설과 비교한다.

역방향에서는 다음 식을 사용한다.

    예상 학년
    =
    academic_year - entry_year + 1

예:

    2026 - 2022 + 1 = 5

따라서 2026학년도 5학년 실제 개설이 2022학번의 검사 대상이 된다.


### 3.2 Audit 결과 읽기

Audit 결과는 먼저:

    A. 교육과정 -> 실제 개설 이력

이 출력되고, 이후:

    B. 실제 개설 이력 -> 교육과정

이 출력된다.


#### 3.2.1 정방향 결과

정방향 결과 마지막에는 다음 요약이 출력된다.

    교육과정 과목 수
    현재 검증 가능
    아직 검증 불가
    학점 일치
    학점 불일치
    학정번호로 찾지 못함
    분반 간 학점 충돌

`아직 검증 불가`는 해당 학년도·학기의 실제 `courses` 데이터가 아직 존재하지 않는 경우이다. 

가령, 2025학번의 경우 2026년의 시점에서는 2학년 과목이 개설되었으므로, 2학년까지의 audit이 가능하나, 3~6학년의 과목 개설이력은 알 수 없으므로 2024학번 교육과정과 실제 개설이력을 비교할 수 없다.


#### 3.2.2 `[CREDIT_MISMATCH]`

Seed와 실제 개설의 학정번호·학년·학기는 일치하지만 학점이 다른 경우이다.

예:

    [CREDIT_MISMATCH]
    ...
    교육과정: 2.0
    실제: 3.0

확인 후 다음 중 하나로 처리한다.

    Seed 자체 오입력
        → credits 직접 수정

    실제 학점 변경
        → credits 수정
        → previous_credits에 이전 값 기록


#### 3.2.3 `[SECTION_CREDIT_CONFLICT]`

같은 학년도·학기·권장학년·학정번호에 여러 학점이 존재하는 경우이다.

예:

    실제: [2.0, 3.0]

분반별 `courses` 데이터가 서로 다르므로 수강편람 원자료를 직접 확인해야 한다.

이 상태에서는 Audit이 어느 학점이 맞는지 결정하지 않는다.


#### 3.2.4 `[NOT_FOUND]`

Seed의 학정번호를 예상한 실제 개설 위치에서 찾지 못한 경우이다.

Audit은 함께 다음 후보를 출력할 수 있다.

    같은 학기 이름 기준 후보
    같은 학년도 다른 학기 후보
    다른 권장학년 동일 학정번호 개설

이를 이용해 다음 가능성을 조사한다.

- 학정번호 변경
- 학기 이동
- 학년 이동
- 실제 미개설
- legacy 과목

`NOT_FOUND`가 있다고 해서 반드시 Seed를 수정해야 하는 것은 아니다.

특히 `legacy` 과목이나 해당 연도에 실제로 개설되지 않은 전선 과목은 설명 가능한 `NOT_FOUND`로 남을 수 있다.


#### 3.2.5 역방향 결과

역방향 결과 마지막에는 다음 요약이 출력된다.

    검사 대상 실제 개설 과목
    교육과정 정확 대응
    속성 변경 후보
    학년/학기 이동 후보
    학정번호 변경 후보
    학정번호+위치 변경 후보
    교육과정 미매핑

후보가 발견되면 해당 실제 개설과 Seed를 비교해 필요한 수정 여부를 판단한다.


#### 3.2.6 `[ATTRIBUTE_CHANGED_CANDIDATE]`

학정번호와 위치는 일치하지만 학점 또는 이수구분 등이 다른 경우이다.

예:

    credits: 2.0 → 3.0

또는:

    completion_type: 전선 → 전필

실제 교육과정 변경으로 확인되면 해당 `previous_*` 필드를 사용한다.

단순 Seed 오류라면 현재 값만 수정한다.


#### 3.2.7 `[TERM_OR_GRADE_MOVED_CANDIDATE]`

같은 학정번호가 Seed에 존재하지만 실제 개설 학년 또는 학기가 다른 경우이다.

예:

    semester: 1 → 2

또는:

    grade: 5 → 4

같은 과목의 실제 이동이라면:

    previous_grade
    previous_semester

중 필요한 필드를 기록한다.


#### 3.2.8 `[CODE_CHANGED_CANDIDATE]`

같은 학년·학기에 동일한 과목명이 있지만 학정번호가 다른 경우이다.

예:

    ADB075
        ↓
    ADA115

실제 코드 변경으로 확인되면 일반적으로:

    change_type = 1:1

구조변경으로 기록한다.


#### 3.2.9 `[CODE_AND_POSITION_CHANGED_CANDIDATE]`

과목명은 같지만 학정번호와 학년 또는 학기가 함께 다른 경우이다.

예:

    ADB071 / 4-2
        ↓
    ADA145 / 5-1

같은 과목의 구조변경으로 확인되면 기존 행을 `legacy`, 새 행을 `current`로 기록한다.


#### 3.2.10 `[UNMAPPED_OFFERING]`

해당 cohort가 실제로 맞닥뜨린 개설 과목인데 Seed에서 학정번호 또는 동일명 후보를 찾을 수 없는 경우이다.

주로 다음을 확인한다.

- 신규 과목
- Seed 누락
- 이름이 크게 바뀐 기존 과목
- 과목 분리·통합

기존 과목과 관계가 없는 신규 과목이라면 새 `current` 행으로 추가한다.


### 3.3 실제 개설 이력 조사

Audit 결과만으로 변경 유형이 분명하지 않으면 SQLite의 `courses` 테이블을 직접 조회한다.

특히 한 연도만 보지 않고 필요한 경우 앞뒤 연도까지 함께 확인한다.


#### 3.3.1 학정번호로 조사

예:

    sqlite3 data/db/inyak.db

    SELECT
        academic_year,
        semester,
        recommended_year,
        course_code,
        course_name,
        completion_type,
        credits
    FROM courses
    WHERE course_code = 'ADB046'
    ORDER BY
        academic_year,
        semester,
        recommended_year;

같은 학정번호가 연도별로 어떻게 개설되었는지 확인할 수 있다.


#### 3.3.2 과목명으로 조사

학정번호 변경이 의심되면 과목명으로도 조회한다.

예:

    SELECT
        academic_year,
        semester,
        recommended_year,
        course_code,
        course_name,
        completion_type,
        credits
    FROM courses
    WHERE course_name LIKE '%지역약국%'
    ORDER BY
        academic_year,
        semester,
        recommended_year;

기존 코드와 새 코드의 등장 시점을 비교한다.


#### 3.3.3 Cohort에 해당하는 개설을 선택

여러 연도의 결과가 나오더라도 대상 학번이 실제로 해당 학년에 재학한 연도를 우선해서 본다.

예:

    2022학번
    grade = 4

이라면:

    2025학년도
    recommended_year = 4

개설이 직접적인 비교 대상이다.

예를 들어 최신 2026학년도 4학년 개설이 다르더라도 이를 2022학번 4학년 값으로 바로 사용하지 않는다.


#### 3.3.4 앞뒤 연도 비교

변경 시점이 불분명하면 다음 순서로 비교한다.

    변경 전 연도
    변경이 의심되는 연도
    변경 후 연도

예:

    2024: ADB075
    2025: ADB075
    2026: ADA115

처럼 확인되면 실제 학정번호 변경 여부를 판단하는 데 도움이 된다.


### 3.4 Seed CSV 수정

Audit과 실제 개설 이력을 확인한 뒤:

    data/seed/curriculum_YYYY.csv

를 수정한다.

세부 컬럼 의미는 `## 2. 교육과정 데이터 구조`를 참고한다.


#### 3.4.1 단순 데이터 오류 수정

기존 Seed가 원래부터 잘못된 경우 현재 값만 수정한다.

예:

    credits = 2
        ↓
    credits = 3

이 경우 실제 변경 이력이 아니므로:

    previous_credits

는 기록하지 않는다.


#### 3.4.2 동일 과목 속성 변경

학정번호와 과목 정체성이 유지되는 경우 현재 값을 수정하고 변경 전 값만 `previous_*`에 기록한다.

예:

    credits = 3
    previous_credits = 2

또는:

    semester = 2
    previous_semester = 1

필요하면:

    attribute_change_effective_year
    attribute_change_note

도 함께 기록한다.


#### 3.4.3 구조변경 기록

학정번호 변경, 과목 분리 또는 통합처럼 구조가 바뀐 경우 `change_*`를 사용한다.

예: 1:1

    기존 행:
        change_role = legacy

    새 행:
        change_role = current

    두 행:
        change_group = 동일 값
        change_type = 1:1
        change_effective_year = 동일 값

1:N, N:1, N:M도 같은 방식으로 같은 `change_group` 안에 legacy/current 행을 구성한다.


#### 3.4.4 신규 과목 추가

기존 Seed에서 대응되는 과목이 없고 구조적 관계도 없다면 새 `current` 행을 추가한다.

일반적으로:

    change_group
    change_type
    previous_*

는 비워 둔다.


#### 3.4.5 수정 후 Diff 확인

Seed를 수정한 뒤 DB 반영 전에 실제 변경 범위를 확인한다.

예:

    git diff --stat -- data/seed/curriculum_2022.csv

    git diff -- data/seed/curriculum_2022.csv

예상하지 않은 행이 함께 수정되었거나 파일 전체가 변경된 것처럼 보이면 먼저 원인을 확인한다.


### 3.5 Audit 재실행 및 결과 확인

Seed 수정이 끝나면 같은 Audit을 다시 실행한다.

예:

    python scripts/audit_curriculum.py \
      --entry-year 2022

최종적으로 우선 확인할 것은 다음과 같다.

#### 3.5.1 정방향

가능하면:

    학점 불일치 = 0
    분반 간 학점 충돌 = 0

이 되도록 정리한다.

`NOT_FOUND`는 남을 수 있지만 각 항목이:

- legacy
- 실제 미개설
- 그 밖의 설명 가능한 이유

중 하나인지 확인한다.


#### 3.5.2 역방향

가능하면 다음 후보가 모두 정리된 상태를 목표로 한다.

    속성 변경 후보 = 0
    학년/학기 이동 후보 = 0
    학정번호 변경 후보 = 0
    학정번호+위치 변경 후보 = 0
    교육과정 미매핑 = 0

남는 후보가 있다면 이유를 확인한 뒤 다음 단계로 넘어간다.


## 4. SQLite 반영 및 검증

### 4.0 실행 명령 요약

대상 Seed를 SQLite `inyak.db`에 반영한다.

예: 2022학번

    cd /Users/younyung.gene/inyak-planner

    python scripts/import_curriculum.py \
      data/seed/curriculum_2022.csv

정상적으로 완료되면 필요에 따라 SQLite에 접속한다.

    sqlite3 data/db/inyak.db

기본 행 수 확인:

    SELECT
        COUNT(*) AS total_rows,
        COUNT(*) FILTER (
            WHERE change_role = 'current'
        ) AS current_rows,
        COUNT(*) FILTER (
            WHERE change_role = 'legacy'
        ) AS legacy_rows
    FROM curriculum_courses
    WHERE entry_year = 2022;

Attribute Change 확인:

    SELECT COUNT(*) AS attribute_change_count
    FROM curriculum_courses
    WHERE entry_year = 2022
      AND change_role = 'current'
      AND (
          previous_credits IS NOT NULL
          OR previous_completion_type IS NOT NULL
          OR previous_grade IS NOT NULL
          OR previous_semester IS NOT NULL
      );

구조변경 확인:

    SELECT
        change_group,
        change_type,
        change_role,
        course_code,
        course_name,
        grade,
        semester,
        completion_type,
        credits,
        change_effective_year
    FROM curriculum_courses
    WHERE entry_year = 2022
      AND change_group IS NOT NULL
    ORDER BY
        change_group,
        change_role,
        course_code;


### 4.1 `import_curriculum.py`가 하는 일

사용 스크립트:

    scripts/import_curriculum.py

대상 DB:

    data/db/inyak.db

대상 테이블:

    curriculum_courses

스크립트는 지정한 Seed CSV를 읽어 해당 `entry_year`의 교육과정을 SQLite에 반영한다.

예:

    curriculum_2022.csv
        ↓
    inyak.db
        ↓
    curriculum_courses
        WHERE entry_year = 2022


#### 4.1.1 반영 방식

SQLite에서는 대상 학번의 기존 `curriculum_courses` 행을 먼저 삭제한 뒤 Seed 전체를 다시 INSERT한다.

즉:

    DELETE
    WHERE entry_year = 대상 학번
        ↓
    Seed 전체 INSERT

방식이다.

다른 학번의 `curriculum_courses`에는 영향을 주지 않는다.

실제 수강편람 개설 이력을 저장하는:

    courses

테이블도 수정하지 않는다.


#### 4.1.2 Import 전 CSV 검증

DB에 쓰기 전에 Seed 구조를 검증한다.

주요 검증 항목은 다음과 같다.

- 필수 컬럼 존재
- 하나의 CSV에 하나의 `entry_year`만 존재
- `grade`가 1~6
- `semester`가 1 또는 2
- `completion_type`이 `전필` 또는 `전선`
- `change_role`이 `current` 또는 `legacy`
- `change_type`이 `1:1`, `1:N`, `N:1`, `N:M` 중 하나
- 중복 과목 행 없음
- `change_group` 구성 정상
- `change_effective_year` 일관성
- `previous_*`와 attribute metadata 관계 정상


#### 4.1.3 구조변경 그룹 검증

같은 `change_group` 안에서는 `change_type`이 모두 같아야 한다.

각 구조는 다음 형태를 가져야 한다.

| `change_type` | legacy | current |
|---|---:|---:|
| `1:1` | 1 | 1 |
| `1:N` | 1 | 2 이상 |
| `N:1` | 2 이상 | 1 |
| `N:M` | 2 이상 | 2 이상 |

같은 `change_group`의 `change_effective_year`도 서로 같아야 한다.

구성이 맞지 않으면 DB에 반영하지 않고 Import가 실패한다.


### 4.2 SQLite Import

실행 형식:

    python scripts/import_curriculum.py \
      data/seed/curriculum_YYYY.csv

예: 2024학번

    python scripts/import_curriculum.py \
      data/seed/curriculum_2024.csv


#### 4.2.1 정상 출력

정상적으로 완료되면 다음과 같은 요약이 출력된다.

    2022학번 교육과정 import 완료
    전체 행: 121개
    현재 과목: 105개
    변경 전 과목: 16개
    현재 전필 학점: 122
    현재 전선 개설학점: 117
    현재 과목 중 대표 학정번호 미지정: 0개
    DB: .../data/db/inyak.db

이 값들이 Seed 수정 과정에서 예상한 값과 맞는지 확인한다.


### 4.3 Import 결과 확인

#### 4.3.1 `전체 행`

해당 `entry_year`의 모든 교육과정 행 수이다.

즉:

    current + legacy

를 포함한다.

예:

    전체 행: 121
    current: 105
    legacy: 16

이면:

    105 + 16 = 121

이어야 한다.


#### 4.3.2 `현재 과목`과 `변경 전 과목`

`현재 과목`:

    change_role = 'current'

`변경 전 과목`:

    change_role = 'legacy'

구조변경 전 과목은 `legacy`로 남지만 현재 과목 수와 현재 전필·전선 합계에서는 제외된다.


#### 4.3.3 `현재 전필 학점`

다음 조건의 학점 합계이다.

    change_role = 'current'
    completion_type = '전필'

이 값은 Seed에 들어 있는 현재 전필 과목의 학점 합계이다.

별도로 관리되는 공식 졸업 최소 전필학점과 같은 개념은 아니다.


#### 4.3.4 `현재 전선 개설학점`

다음 조건의 학점 합계이다.

    change_role = 'current'
    completion_type = '전선'

현재 Seed에 존재하는 전선 과목 전체의 개설학점 합계이다.

학생이 반드시 모두 이수해야 하는 학점을 뜻하지 않는다.


#### 4.3.5 `대표 학정번호 미지정`

다음 조건의 과목 수이다.

    change_role = 'current'
    course_code IS NULL

실제 개설 이력과 연결되는 과목은 가능한 한 학정번호가 있는 것이 좋다.

값이 0이 아니라면 해당 과목의 코드가 정말 미확정인지 확인한다.


### 4.4 SQL 검증

Importer의 요약값만 확인해도 기본 반영 여부는 알 수 있지만, 변경 이력이 많은 작업에서는 SQLite에서 직접 확인한다.


#### 4.4.1 전체 / current / legacy 확인

    SELECT
        COUNT(*) AS total_rows,
        COUNT(*) FILTER (
            WHERE change_role = 'current'
        ) AS current_rows,
        COUNT(*) FILTER (
            WHERE change_role = 'legacy'
        ) AS legacy_rows
    FROM curriculum_courses
    WHERE entry_year = 2022;

Importer 출력과 동일해야 한다.


#### 4.4.2 Attribute Change 확인

개수:

    SELECT COUNT(*) AS attribute_change_count
    FROM curriculum_courses
    WHERE entry_year = 2022
      AND change_role = 'current'
      AND (
          previous_credits IS NOT NULL
          OR previous_completion_type IS NOT NULL
          OR previous_grade IS NOT NULL
          OR previous_semester IS NOT NULL
      );

상세:

    SELECT
        course_code,
        course_name,
        grade,
        semester,
        completion_type,
        credits,
        previous_grade,
        previous_semester,
        previous_completion_type,
        previous_credits,
        attribute_change_effective_year
    FROM curriculum_courses
    WHERE entry_year = 2022
      AND change_role = 'current'
      AND (
          previous_credits IS NOT NULL
          OR previous_completion_type IS NOT NULL
          OR previous_grade IS NOT NULL
          OR previous_semester IS NOT NULL
      )
    ORDER BY
        attribute_change_effective_year,
        course_code;


#### 4.4.3 구조변경 그룹 확인

    SELECT
        change_group,
        change_type,
        change_role,
        course_code,
        course_name,
        grade,
        semester,
        completion_type,
        credits,
        change_effective_year
    FROM curriculum_courses
    WHERE entry_year = 2022
      AND change_group IS NOT NULL
    ORDER BY
        change_group,
        change_role,
        course_code;

새로 수정한 `change_group`에서 legacy/current 행이 의도한 구조로 들어갔는지 확인한다.


#### 4.4.4 특정 과목 확인

이번 작업에서 중요한 과목만 직접 조회할 수도 있다.

예:

    SELECT
        course_code,
        course_name,
        grade,
        semester,
        completion_type,
        credits,
        change_role,
        change_group
    FROM curriculum_courses
    WHERE entry_year = 2022
      AND course_code IN (
          'ADA198',
          'ADA115',
          'ADA148',
          'ADA217'
      )
    ORDER BY course_code;

조회할 학정번호는 실제 작업 대상에 맞게 변경한다.


#### 4.4.5 현재 전필·전선 학점 확인

    SELECT
        SUM(
            CASE
                WHEN change_role = 'current'
                 AND completion_type = '전필'
                THEN COALESCE(credits, 0)
                ELSE 0
            END
        ) AS required_credits,

        SUM(
            CASE
                WHEN change_role = 'current'
                 AND completion_type = '전선'
                THEN COALESCE(credits, 0)
                ELSE 0
            END
        ) AS elective_credits
    FROM curriculum_courses
    WHERE entry_year = 2022;

Importer 출력의:

    현재 전필 학점
    현재 전선 개설학점

과 같아야 한다.


#### 4.4.6 SQLite ID의 보존 및 검증 여부

SQLite importer는 해당 학번의 행을 삭제한 뒤 다시 INSERT하므로 기존 `curriculum_courses.id`가 유지되지 않을 수 있다.

따라서 이 단계에서는 ID 보존을 확인하지 않는다.

ID 보존은 사용자 수강기록과 연결되어 있는 PostgreSQL 반영 단계에서 확인한다.

SQLite에서는 다음 값이 Seed와 일치하는지만 확인한다.

- 과목 정보
- current / legacy
- `previous_*`
- `change_*`
- 전필·전선 학점 합계

검증이 끝나면 다음 단계에서 Git에 Seed 변경을 반영한다.

## 5. Git 반영

### 5.0 실행 명령 요약

SQLite 검증까지 끝났으면 Git에 반영한다.

예: 2022학번

    cd /Users/younyung.gene/inyak-planner

현재 브랜치와 작업 상태 확인:

    git branch --show-current
    git status

Seed 변경 확인:

    git diff --stat -- data/seed/curriculum_2022.csv

    git diff -- data/seed/curriculum_2022.csv

대상 Seed만 stage:

    git add data/seed/curriculum_2022.csv

Stage 결과 확인:

    git status

    git diff --cached --stat

    git diff --cached

Commit:

    git commit -m "Update 2022 curriculum"

Push:

    git push origin dev

원격 반영 확인:

    git fetch origin

    git status -sb

    git log -1 --oneline --decorate

정상적으로 push되었다면 현재 `dev`와 `origin/dev`가 같은 commit을 가리켜야 한다.


### 5.1 변경사항 확인

Git에 반영하기 전에 어떤 파일이 실제로 변경되었는지 먼저 확인한다.


#### 5.1.1 현재 브랜치 확인

    git branch --show-current

기본 교육과정 유지보수 브랜치는:

    dev

이다.

다른 브랜치라면 그대로 commit하지 말고 현재 작업 위치를 먼저 확인한다.


#### 5.1.2 전체 작업 상태 확인

    git status

교육과정 작업 외의 수정사항이 함께 존재하는지 확인한다.

예:

    modified:   data/seed/curriculum_2022.csv
    modified:   web/src/...
    untracked:  ...

이 경우 교육과정과 관계없는 파일을 무조건 함께 stage하지 않는다.

특히:

    git add .

를 기본 명령으로 사용하지 않는다.

작업에 필요한 파일을 명시적으로 선택한다.


#### 5.1.3 Seed Diff 확인

예:

    git diff --stat -- data/seed/curriculum_2022.csv

전체 변경 내용:

    git diff -- data/seed/curriculum_2022.csv

다음을 확인한다.

- 예상한 과목만 수정되었는가
- 예상한 신규 행만 추가되었는가
- `previous_*` 값이 의도대로 들어갔는가
- `change_*` 그룹이 의도대로 들어갔는가
- 관계없는 행이 함께 수정되지 않았는가
- CSV 전체가 불필요하게 다시 저장된 것은 아닌가

Audit과 SQLite 결과가 정상이어도 Git diff에서 예상하지 않은 변경이 보이면 commit 전에 원인을 확인한다.


#### 5.1.4 SQLite DB 파일은 Git 반영 대상이 아니다

SQLite importer를 실행하면 로컬:

    data/db/inyak.db

내용은 변경된다.

하지만 현재 `.gitignore`에는:

    data/db/*.db

가 포함되어 있으므로 생성된 SQLite DB는 Git에 commit하지 않는다.

Git에 저장되는 기준 데이터는:

    data/seed/curriculum_YYYY.csv

이다.

즉:

    Seed CSV
        → Git 관리

    data/db/inyak.db
        → 로컬 생성 데이터
        → Git 관리 대상 아님

으로 구분한다.


### 5.2 Stage 및 Commit

변경사항을 확인했으면 이번 작업에 필요한 파일만 stage한다.


#### 5.2.1 Seed 파일 Stage

예:

    git add data/seed/curriculum_2022.csv

여러 학번을 의도적으로 동시에 수정했다면 각각 명시할 수 있다.

예:

    git add \
      data/seed/curriculum_2022.csv \
      data/seed/curriculum_2023.csv

하지만 교육과정 유지보수는 가능한 한 한 학번씩 진행하는 것을 기본으로 한다.


#### 5.2.2 스크립트도 수정한 경우

Audit이나 importer 자체를 수정한 작업이라면 필요한 스크립트도 명시적으로 stage한다.

예:

    git add \
      data/seed/curriculum_2022.csv \
      scripts/audit_curriculum.py

스크립트를 수정하지 않았다면 Seed 작업에 스크립트 파일을 포함할 필요가 없다.


#### 5.2.3 Stage 결과 확인

    git status

이어:

    git diff --cached --stat

    git diff --cached

를 실행한다.

`git diff --cached`는 **이번 commit에 실제로 들어갈 내용**을 보여준다.

따라서 일반 `git diff` 확인과 별도로 반드시 확인하는 것이 좋다.

특히 다음을 본다.

    Changes to be committed:

아래에 이번 교육과정 작업과 관계없는 파일이 들어가 있지 않아야 한다.


#### 5.2.4 잘못 Stage한 파일 제거

파일을 실수로 stage했지만 로컬 수정 자체는 유지하고 싶다면:

    git restore --staged <파일경로>

예:

    git restore --staged web/src/pages/CurriculumPage.tsx

이 명령은 로컬 파일 내용을 되돌리지 않고 stage만 해제한다.


#### 5.2.5 Commit

예:

    git commit -m "Update 2022 curriculum"

Commit 메시지는 어떤 학번의 교육과정을 수정했는지 알 수 있게 작성한다.

예:

    git commit -m "Update 2023 curriculum"

또는 변경 내용이 특정한 경우:

    git commit -m "Update 2024 curriculum history"

처럼 작성할 수 있다.


### 5.3 Dev Push 및 원격 확인

Commit이 끝났으면 `dev` 브랜치에 push한다.


#### 5.3.1 Push 전 상태 확인

    git status

    git log -1 --oneline --decorate

현재 commit이 의도한 교육과정 commit인지 확인한다.


#### 5.3.2 Dev Push

    git push origin dev

이 단계에서는:

    main

으로 직접 push하지 않는다.

교육과정 Seed는 먼저 `dev`에 반영하고 이후 개발 PostgreSQL에서 검증한다.


#### 5.3.3 원격 Dev 상태 갱신

Push 후:

    git fetch origin

을 실행한다.

이어:

    git status -sb

를 확인한다.

정상적인 예:

    ## dev...origin/dev

`ahead` 또는 `behind` 표시가 없다면 로컬 `dev`와 원격 `origin/dev`가 같은 상태이다.


#### 5.3.4 Commit 기준으로 원격 반영 확인

현재 로컬 commit:

    git rev-parse HEAD

원격 dev commit:

    git rev-parse origin/dev

두 SHA가 같으면 현재 로컬 `dev`의 commit이 원격 `dev`까지 반영된 상태이다.

간단히 확인하려면:

    git log -1 --oneline --decorate

출력에서 다음과 같이 같은 commit에 표시되는지 볼 수 있다.

    (HEAD -> dev, origin/dev)


### 5.4 Git 반영 후 확인

Git 작업이 끝난 뒤 다음 상태이면 PostgreSQL 단계로 넘어갈 수 있다.

필요하면 마지막으로:

    git status

를 실행한다.

교육과정 작업과 무관한 기존 로컬 변경사항이 남아 있을 수 있으므로 working tree가 반드시 완전히 깨끗해야 하는 것은 아니다.

중요한 것은 **이번 교육과정 변경이 정확한 범위로 commit되고 `origin/dev`까지 반영되었는지**이다.

다음 단계에서는 이 Git에 반영된 Seed를 기준으로 개발 PostgreSQL에 먼저 Dry Run을 수행한다.

## 6. PostgreSQL 개발·운영 DB 반영 및 검증

### 6.0 실행 명령 요약

PostgreSQL 반영은 반드시:

    개발 DB
        ↓
    운영 DB

순서로 진행한다.

대상 학번이 이미 PostgreSQL에 존재하는 일반적인 유지보수 작업에서는 `--replace`를 사용한다.

예: 2022학번


#### 6.0.1 개발 DB Dry Run

개발 Supabase project ref:

    rkunrjwetsnonwnmatec

먼저 `DATABASE_URL`이 개발 DB를 가리키도록 설정한다.

    set -a
    source config/private/development.env
    echo "$APP_ENV"

Dry Run:

    cd /Users/younyung.gene/inyak-planner

    python scripts/import_curriculum_postgres.py \
      data/seed/curriculum_2022.csv \
      --project-ref rkunrjwetsnonwnmatec \
      --replace

다음 값을 확인한다.

    접속 host
    대상 학번
    전체 행
    현재 과목
    변경 전 과목
    현재 전필 학점
    현재 전선 개설학점
    DB 기존 행
    UPDATE
    INSERT
    DELETE


#### 6.0.2 개발 DB Apply

Dry Run이 정상이라면:

    python scripts/import_curriculum_postgres.py \
      data/seed/curriculum_2022.csv \
      --project-ref rkunrjwetsnonwnmatec \
      --replace \
      --apply


#### 6.0.3 개발 DB 검증

개발 DB에 접속한다.

    psql "$DATABASE_URL"

기본 행 수:

    SELECT
        COUNT(*) AS total_rows,
        COUNT(*) FILTER (
            WHERE change_role = 'current'
        ) AS current_rows,
        COUNT(*) FILTER (
            WHERE change_role = 'legacy'
        ) AS legacy_rows
    FROM public.curriculum_courses
    WHERE entry_year = 2022;

Attribute Change:

    SELECT COUNT(*) AS attribute_change_count
    FROM public.curriculum_courses
    WHERE entry_year = 2022
      AND change_role = 'current'
      AND (
          previous_credits IS NOT NULL
          OR previous_completion_type IS NOT NULL
          OR previous_grade IS NOT NULL
          OR previous_semester IS NOT NULL
      );

Orphan 확인:

    SELECT COUNT(*) AS remaining_orphans
    FROM public.user_course_records AS ucr
    LEFT JOIN public.curriculum_courses AS cc
      ON cc.id = ucr.curriculum_course_id
    WHERE ucr.curriculum_course_id IS NOT NULL
      AND cc.id IS NULL;

정상 결과:

    0

`psql` 종료:

    \q


#### 6.0.4 운영 DB Dry Run

운영 Supabase project ref:

    alkamigyftmalimqoixa

`DATABASE_URL`을 운영 DB로 변경한다.

    set -a
    source config/private/production.env
    echo "$APP_ENV"

Dry Run:

    python scripts/import_curriculum_postgres.py \
      data/seed/curriculum_2022.csv \
      --project-ref alkamigyftmalimqoixa \
      --replace


#### 6.0.5 운영 DB Apply

Dry Run이 개발에서 검증한 결과와 일치하면:

    python scripts/import_curriculum_postgres.py \
      data/seed/curriculum_2022.csv \
      --project-ref alkamigyftmalimqoixa \
      --replace \
      --apply

이후:

    psql "$DATABASE_URL"

로 접속하여 개발 DB와 같은 SQL 검증을 반복한다.


### 6.1 PostgreSQL Importer

사용 스크립트:

    scripts/import_curriculum_postgres.py

대상 테이블:

    public.curriculum_courses

SQLite importer와 달리 PostgreSQL importer는 기존 행의 `id`를 가능한 한 유지하면서 Seed와 DB를 동기화한다.

이는:

    public.user_course_records.curriculum_course_id

가:

    public.curriculum_courses.id

를 참조하기 때문이다.


#### 6.1.1 `DATABASE_URL`

스크립트는 환경변수:

    DATABASE_URL

을 사용하여 PostgreSQL에 접속한다.

설정되어 있지 않으면 작업을 중단한다.

현재 값 자체를 확인하려면:

    echo "$DATABASE_URL"

을 사용할 수 있지만 연결 문자열에는 비밀번호가 포함될 수 있으므로 화면 공유나 로그에 그대로 남기지 않도록 주의한다.

실제 DB가 맞는지는 `--project-ref` 검증과 importer가 출력하는:

    접속 host

를 함께 사용해 확인한다.


#### 6.1.2 `--project-ref`

`--project-ref`는 필수 옵션이다.

개발:

    rkunrjwetsnonwnmatec

운영:

    alkamigyftmalimqoixa

Importer는 지정한 project ref가 실제 `DATABASE_URL` 안에 포함되어 있는지 확인한다.

예를 들어 운영 DB에 연결된 상태에서 개발 ref를 지정하면 작업을 중단한다.

이는 실수로 다른 Supabase 프로젝트에 교육과정을 쓰는 것을 막기 위한 안전장치이다.


#### 6.1.3 `--replace`

대상 학번이 PostgreSQL에 이미 존재할 때 사용한다.

예:

    --replace

기존 교육과정 유지보수에서는 대부분 이미 해당 학번이 DB에 있으므로 사용한다.

`--replace`라는 이름과 달리 현재 importer는 대상 학번의 모든 행을 무조건 삭제하고 새로 넣지 않는다.

기존 행과 새 Seed를 매칭하여 가능한 한 기존 `id`를 유지한다.


#### 6.1.4 `--apply`

실제 DB 쓰기를 허용한다.

생략:

    Dry Run

지정:

    실제 반영

따라서 항상 먼저:

    --replace

까지만 실행하여 계획을 확인한 뒤:

    --replace --apply

를 실행한다.

처음부터 `--apply`를 붙이지 않는다.


#### 6.1.5 신규 학번을 처음 넣는 경우

PostgreSQL에 해당 `entry_year`가 전혀 존재하지 않는 신규 학번이라면 `--replace` 없이 전체 Seed를 INSERT할 수 있다.

예:

    python scripts/import_curriculum_postgres.py \
      data/seed/curriculum_YYYY.csv \
      --project-ref PROJECT_REF

Dry Run 확인 후:

    python scripts/import_curriculum_postgres.py \
      data/seed/curriculum_YYYY.csv \
      --project-ref PROJECT_REF \
      --apply

기존 학번 유지보수와 신규 학번 최초 등록을 구분한다.


### 6.2 개발 DB 반영

운영 DB를 수정하기 전에 반드시 개발 DB에 먼저 동일한 Seed를 반영한다.


#### 6.2.1 Dev Dry Run

예: 2022학번

    export DATABASE_URL='개발 PostgreSQL 연결 문자열'

    python scripts/import_curriculum_postgres.py \
      data/seed/curriculum_2022.csv \
      --project-ref rkunrjwetsnonwnmatec \
      --replace

정상적으로 기존 학번이 존재하면 다음과 같은 부분이 출력된다.

    DB 기존 2022학번 행: ...개

    기존 ID 보존 동기화 계획
      UPDATE: ...개
      INSERT: ...개
      DELETE: ...개

마지막에는:

    DRY RUN 완료:
    DB에는 아무것도 쓰지 않았습니다.

가 출력된다.


#### 6.2.2 `UPDATE`

기존 DB 행과 Seed 행을 같은 과목으로 매칭하여 기존 `id`를 유지한 채 내용을 갱신하는 행 수이다.

매칭 우선순위는 다음과 같다.

    1. 동일한 course_code

    2. 동일한 course_name + change_role

단, 안전하게 유일하게 대응되는 경우에만 사용한다.

기존 과목의:

- 학점
- 학년
- 학기
- 이수구분
- `previous_*`
- `change_*`
- notes

등을 수정했다면 일반적으로 기존 행은 `UPDATE`가 된다.


#### 6.2.3 `INSERT`

현재 DB의 기존 행과 안전하게 대응되지 않는 새로운 Seed 행의 수이다.

대표적으로:

- 신규 과목
- 새로 추가된 `legacy` 행
- 기존 DB에 없었던 구조변경 행

등이 포함될 수 있다.

예를 들어 기존 101행인 학번에 Seed 행 20개를 새로 추가했다면:

    UPDATE: 101
    INSERT: 20
    DELETE: 0

과 같은 계획이 나올 수 있다.


#### 6.2.4 `DELETE`

기존 PostgreSQL에는 있지만 새 Seed에서는 더 이상 대응되는 행이 없는 경우이다.

유지보수 작업에서 `DELETE`가 발생했다면 특히 주의해서 확인한다.

예상하지 않았다면 **Apply하지 않는다.**

먼저:

- Seed에서 행을 실수로 삭제했는지
- 학정번호 또는 과목명 변경으로 매칭이 깨졌는지
- `change_role`을 잘못 변경했는지
- 기존 DB에만 잘못된 행이 있는지

를 확인한다.

정말 삭제해야 하는 경우에만 진행한다.


#### 6.2.5 사용자 기록이 DELETE 대상을 참조하는 경우

Importer는 DELETE 예정인 `curriculum_courses.id`를:

    public.user_course_records.curriculum_course_id

가 참조하고 있는지 확인한다.

참조 중인 행이 있으면 삭제하지 않고 전체 작업을 중단한다.

예:

    CSV에서 삭제될 교육과정 과목을
    사용자 기록이 참조하고 있습니다.

이 경우 강제로 삭제하지 않는다.

해당 사용자 기록과 curriculum row의 관계를 먼저 조사한다.


#### 6.2.6 Dev Apply

Dry Run 계획이 예상과 일치하면:

    python scripts/import_curriculum_postgres.py \
      data/seed/curriculum_2022.csv \
      --project-ref rkunrjwetsnonwnmatec \
      --replace \
      --apply

정상적으로 완료되면:

    2022학번 PostgreSQL import 완료
    최종 행: ...개

가 출력된다.

최종 행 수는 Seed 전체 행 수와 같아야 한다.

Importer도 적용 후 DB 행 수를 다시 검사하며, 예상 행 수와 다르면 오류로 처리한다.


### 6.3 개발 DB 검증

Apply가 성공했더라도 SQL로 실제 DB 상태를 확인한다.


#### 6.3.1 전체 / current / legacy 확인

    psql "$DATABASE_URL"

    SELECT
        COUNT(*) AS total_rows,
        COUNT(*) FILTER (
            WHERE change_role = 'current'
        ) AS current_rows,
        COUNT(*) FILTER (
            WHERE change_role = 'legacy'
        ) AS legacy_rows
    FROM public.curriculum_courses
    WHERE entry_year = 2022;

다음 세 값이 SQLite에서 확인한 결과와 같아야 한다.

    total_rows
    current_rows
    legacy_rows


#### 6.3.2 Attribute Change 확인

개수:

    SELECT COUNT(*) AS attribute_change_count
    FROM public.curriculum_courses
    WHERE entry_year = 2022
      AND change_role = 'current'
      AND (
          previous_credits IS NOT NULL
          OR previous_completion_type IS NOT NULL
          OR previous_grade IS NOT NULL
          OR previous_semester IS NOT NULL
      );

상세:

    SELECT
        id,
        course_code,
        course_name,
        grade,
        semester,
        completion_type,
        credits,
        previous_grade,
        previous_semester,
        previous_completion_type,
        previous_credits,
        attribute_change_effective_year
    FROM public.curriculum_courses
    WHERE entry_year = 2022
      AND change_role = 'current'
      AND (
          previous_credits IS NOT NULL
          OR previous_completion_type IS NOT NULL
          OR previous_grade IS NOT NULL
          OR previous_semester IS NOT NULL
      )
    ORDER BY
        attribute_change_effective_year,
        course_code;


#### 6.3.3 구조변경 확인

    SELECT
        id,
        change_group,
        change_type,
        change_role,
        course_code,
        course_name,
        grade,
        semester,
        completion_type,
        credits,
        change_effective_year
    FROM public.curriculum_courses
    WHERE entry_year = 2022
      AND change_group IS NOT NULL
    ORDER BY
        change_group,
        change_role,
        course_code;

신규 또는 수정한 구조변경 그룹이 의도한 legacy/current 구성으로 들어갔는지 확인한다.


#### 6.3.4 전필·전선 개설학점 확인

    SELECT
        SUM(
            CASE
                WHEN change_role = 'current'
                 AND completion_type = '전필'
                THEN COALESCE(credits, 0)
                ELSE 0
            END
        ) AS required_credits,

        SUM(
            CASE
                WHEN change_role = 'current'
                 AND completion_type = '전선'
                THEN COALESCE(credits, 0)
                ELSE 0
            END
        ) AS elective_credits
    FROM public.curriculum_courses
    WHERE entry_year = 2022;

SQLite importer와 PostgreSQL importer가 출력한 값과 비교한다.


#### 6.3.5 Orphan 확인

    SELECT COUNT(*) AS remaining_orphans
    FROM public.user_course_records AS ucr
    LEFT JOIN public.curriculum_courses AS cc
      ON cc.id = ucr.curriculum_course_id
    WHERE ucr.curriculum_course_id IS NOT NULL
      AND cc.id IS NULL;

정상:

    0

0이 아니라면 운영 DB로 넘어가지 않는다.


#### 6.3.6 FK 확인

필요한 경우 FK 정의 자체를 확인한다.

    SELECT
        conname,
        pg_get_constraintdef(oid)
    FROM pg_constraint
    WHERE conrelid =
            'public.user_course_records'::regclass
      AND conname =
            'user_course_records_curriculum_course_fk';

현재 기대하는 관계는:

    FOREIGN KEY (curriculum_course_id)
    REFERENCES curriculum_courses(id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT

이다.


#### 6.3.7 개발 화면 확인

개발 DB 검증이 끝나면 개발 환경에서 해당 학번의:

- 교육과정 현재 상태
- 변경사항
- 구조변경
- 학점·이수구분·학년·학기 변경

이 예상대로 표시되는지만 확인한다.

문제가 있으면 운영 DB에 반영하지 않고 Seed 또는 개발 DB 단계로 돌아간다.


### 6.4 운영 DB 반영

개발 DB와 개발 화면 검증이 끝난 동일한 Seed를 운영 DB에 반영한다.

개발에서 검증한 뒤 Seed를 다시 수정했다면 운영으로 바로 가지 않고 개발 DB 검증부터 다시 수행한다.


#### 6.4.1 Production Dry Run

운영 `DATABASE_URL`을 설정한다.

    export DATABASE_URL='운영 PostgreSQL 연결 문자열'

운영 project ref:

    alkamigyftmalimqoixa

Dry Run:

    python scripts/import_curriculum_postgres.py \
      data/seed/curriculum_2022.csv \
      --project-ref alkamigyftmalimqoixa \
      --replace


#### 6.4.2 접속 대상 확인

출력에서 가장 먼저:

    접속 host

를 확인한다.

운영 Supabase project ref가:

    alkamigyftmalimqoixa

이므로 운영 DB를 가리키고 있어야 한다.

`DATABASE_URL`과 `--project-ref`가 일치하지 않으면 importer가 작업을 중단한다.


#### 6.4.3 개발 DB 결과와 비교

운영 Dry Run에서 다음 값을 개발 DB 적용 당시 결과와 비교한다.

    대상 학번
    전체 행
    현재 과목
    변경 전 과목
    현재 전필 학점
    현재 전선 개설학점

그리고 동기화 계획:

    UPDATE
    INSERT
    DELETE

도 확인한다.

개발 DB와 운영 DB의 기존 상태가 완전히 같지 않다면 UPDATE/INSERT 계획이 일부 다를 수 있으므로, 숫자가 다르다는 이유만으로 바로 오류라고 판단하지 않는다.

다만 차이가 예상 가능한 이유인지 확인한다.


#### 6.4.4 예상하지 못한 DELETE가 있는 경우

운영 Dry Run에서 예상하지 않은:

    DELETE > 0

이 나오면 Apply하지 않는다.

먼저 원인을 조사한다.

운영 DB에서는 이미 실제 사용자 기록이 해당 `curriculum_courses.id`를 참조하고 있을 수 있으므로 특히 주의한다.


#### 6.4.5 Production Apply

Dry Run을 확인한 뒤:

    python scripts/import_curriculum_postgres.py \
      data/seed/curriculum_2022.csv \
      --project-ref alkamigyftmalimqoixa \
      --replace \
      --apply

정상적으로 완료되면:

    PostgreSQL import 완료
    최종 행: ...개

가 출력된다.


### 6.5 운영 DB 최종 검증

운영 Apply가 완료되면 운영 PostgreSQL에 직접 접속한다.

    psql "$DATABASE_URL"


#### 6.5.1 기본 행 수

    SELECT
        COUNT(*) AS total_rows,
        COUNT(*) FILTER (
            WHERE change_role = 'current'
        ) AS current_rows,
        COUNT(*) FILTER (
            WHERE change_role = 'legacy'
        ) AS legacy_rows
    FROM public.curriculum_courses
    WHERE entry_year = 2022;

Seed, SQLite, 개발 PostgreSQL과 비교한다.


#### 6.5.2 Attribute Change

    SELECT COUNT(*) AS attribute_change_count
    FROM public.curriculum_courses
    WHERE entry_year = 2022
      AND change_role = 'current'
      AND (
          previous_credits IS NOT NULL
          OR previous_completion_type IS NOT NULL
          OR previous_grade IS NOT NULL
          OR previous_semester IS NOT NULL
      );

필요하면 6.3.2의 상세 조회도 다시 실행한다.


#### 6.5.3 구조변경

    SELECT
        change_group,
        change_type,
        change_role,
        course_code,
        course_name,
        grade,
        semester,
        completion_type,
        credits,
        change_effective_year
    FROM public.curriculum_courses
    WHERE entry_year = 2022
      AND change_group IS NOT NULL
    ORDER BY
        change_group,
        change_role,
        course_code;


#### 6.5.4 Orphan

    SELECT COUNT(*) AS remaining_orphans
    FROM public.user_course_records AS ucr
    LEFT JOIN public.curriculum_courses AS cc
      ON cc.id = ucr.curriculum_course_id
    WHERE ucr.curriculum_course_id IS NOT NULL
      AND cc.id IS NULL;

정상:

    0


#### 6.5.5 PostgreSQL 반영 완료 기준

다음 데이터가 같은 교육과정 내용을 나타내는지 확인한다.

    Seed CSV
        =
    SQLite curriculum_courses
        =
    개발 PostgreSQL curriculum_courses
        =
    운영 PostgreSQL curriculum_courses

각 DB의 `id` 숫자 자체가 서로 같아야 한다는 의미는 아니다.

특히 PostgreSQL에서는 기존 사용자 기록과의 연결을 보호하기 위해 **해당 PostgreSQL DB 안에서 기존 curriculum row의 ID를 가능한 한 유지하는 것**이 중요하다.

운영 검증까지 끝나면 해당 학번의 정상적인 교육과정 업데이트 절차는 완료된다.

## 7. 오류 및 예외 상황

이 장은 정상적인 작업 순서가 아니라, Audit·SQLite Import·PostgreSQL Import·Git 작업 중 예상하지 못한 결과가 발생했을 때 참고한다.

문제가 발생하면 우선 **어느 단계에서 발생했는지**를 구분한다.

    Audit
        ↓
    Seed CSV
        ↓
    SQLite Import
        ↓
    Git
        ↓
    PostgreSQL Dry Run
        ↓
    PostgreSQL Apply

오류가 발생한 단계보다 뒤의 작업은 진행하지 않는다.


### 7.1 Audit 결과가 예상과 다른 경우

#### 7.1.1 `[NOT_FOUND]`가 많이 남는 경우

`[NOT_FOUND]`는 Seed의 과목을 예상 위치의 실제 개설 이력에서 학정번호로 찾지 못했다는 뜻이다.

먼저 출력되는 다음 후보를 확인한다.

    같은 학기 이름 기준 후보
    같은 학년도 다른 학기 후보
    다른 권장학년 동일 학정번호 개설

그다음 `courses`를 직접 조회한다.

학정번호 기준:

    sqlite3 data/db/inyak.db

    SELECT
        academic_year,
        semester,
        recommended_year,
        course_code,
        course_name,
        completion_type,
        credits
    FROM courses
    WHERE course_code = 'ADB000'
    ORDER BY
        academic_year,
        semester,
        recommended_year;

과목명 기준:

    SELECT
        academic_year,
        semester,
        recommended_year,
        course_code,
        course_name,
        completion_type,
        credits
    FROM courses
    WHERE course_name LIKE '%과목명%'
    ORDER BY
        academic_year,
        semester,
        recommended_year;

다음 가능성을 구분한다.

- 실제 학정번호 변경
- 학년 이동
- 학기 이동
- 신규 과목으로 대체
- 해당 연도 미개설
- legacy 과목
- Seed 자체 오류

`NOT_FOUND`가 존재한다는 이유만으로 Seed를 자동 수정하지 않는다.


#### 7.1.2 `아직 검증 불가`가 많은 경우

정방향 Audit에서:

    아직 검증 불가

는 해당 cohort의 예상 학년도·학기에 대응되는 실제 `courses` 데이터가 아직 없다는 뜻이다.

예를 들어 미래 학기 수강편람이 아직 수집되지 않았다면 정상적으로 발생할 수 있다.

이는:

    [NOT_FOUND]

와 다르다.

`NOT_FOUND`는 **해당 학기 데이터는 존재하지만 과목을 찾지 못한 경우**이고,

`아직 검증 불가`는 **비교할 학기 자체가 DB에 없는 경우**이다.

현재 보유 학기를 확인하려면:

    SELECT DISTINCT
        academic_year,
        semester
    FROM courses
    ORDER BY
        academic_year,
        semester;


#### 7.1.3 `[CREDIT_MISMATCH]`가 남는 경우

예:

    교육과정: 2
    실제: 3

먼저 다음을 구분한다.

    Seed 오입력
        또는
    실제 교육과정의 학점 변경

Seed 오입력이면:

    credits

만 고친다.

실제 변경이면:

    credits = 현재 학점
    previous_credits = 과거 학점

으로 기록한다.

한 학년도만 보고 판단하기 어려우면 같은 학정번호의 연도별 개설을 조회한다.


#### 7.1.4 `[SECTION_CREDIT_CONFLICT]`가 발생하는 경우

같은 학년도·학기·권장학년·학정번호에서 서로 다른 학점이 발견된 경우이다.

예:

    실제: [2.0, 3.0]

다음과 같이 원자료를 확인한다.

    SELECT
        academic_year,
        semester,
        recommended_year,
        course_code,
        course_name,
        section,
        completion_type,
        credits
    FROM courses
    WHERE academic_year = 2026
      AND semester = 1
      AND course_code = 'ADB000';

`courses` 테이블에 `section` 컬럼이 없는 환경이라면 해당 컬럼은 제외하고 조회한다.

수강편람 원본에서 실제 분반별 학점이 다른지 확인한 뒤 처리한다.

Audit이 어느 값을 선택해야 하는지 자동 결정하지 않는다.


#### 7.1.5 `[ATTRIBUTE_CHANGED_CANDIDATE]`가 예상하지 않게 나타나는 경우

학정번호와 위치는 맞지만:

- 학점
- 이수구분

등이 Seed와 다른 경우이다.

출력의:

    변경:
     - credits: ...
     - completion_type: ...

부분을 확인한다.

실제 변경이면 `previous_*`를 기록하고, 단순 Seed 오류면 현재 값만 수정한다.


#### 7.1.6 `[TERM_OR_GRADE_MOVED_CANDIDATE]`가 남는 경우

같은 학정번호가 다른 학년 또는 학기에 존재한다는 뜻이다.

예:

    Seed:
    5학년 2학기

    실제:
    4학년 2학기

해당 cohort의 실제 수강 연도가 맞는지 먼저 확인한다.

계산:

    실제 학년도
    =
    entry_year + grade - 1

실제 이동으로 확인되면:

    previous_grade
    previous_semester

를 사용한다.


#### 7.1.7 `[CODE_CHANGED_CANDIDATE]`가 남는 경우

같은 위치와 동일한 과목명이지만 학정번호가 다른 경우이다.

예:

    ADB075
        ↓
    ADA115

실제 코드 변경으로 확인되면 보통 `1:1` 구조변경으로 기록한다.

단순한 DB 오타나 잘못 수집된 학정번호라면 구조변경을 만들지 않는다.


#### 7.1.8 `[CODE_AND_POSITION_CHANGED_CANDIDATE]`가 남는 경우

과목명은 같지만 학정번호와 학년 또는 학기가 함께 바뀐 경우이다.

다음 항목을 함께 조사한다.

- 이전 학정번호 개설 종료 시점
- 새 학정번호 등장 시점
- 학년·학기 이동 시점
- 두 과목이 실제로 같은 과목인지 여부

같은 과목의 구조변경으로 확인되면 `change_*`로 관리한다.


#### 7.1.9 `[UNMAPPED_OFFERING]`이 남는 경우

실제 개설은 존재하지만 해당 cohort Seed에서 대응 후보가 없는 경우이다.

먼저 과목명과 학정번호를 연도별로 검색한다.

신규 과목이라면:

    새 current 행

으로 추가한다.

기존 과목의 코드 변경·분리·통합이라면 해당 구조에 맞게 `change_*`를 기록한다.

실제 해당 cohort 교육과정과 관계없는 개설인지도 확인한다.


### 7.2 Seed / SQLite Import 오류

#### 7.2.1 `CSV 필수 칼럼이 없습니다`

예:

    Import 실패:
    CSV 필수 칼럼이 없습니다: ...

Seed 헤더를 확인한다.

현재 사용하는 전체 컬럼은:

    entry_year
    grade
    semester
    course_name
    course_code
    completion_type
    credits
    notes
    change_group
    change_type
    change_role
    change_effective_year
    change_note
    previous_credits
    previous_completion_type
    previous_grade
    previous_semester
    attribute_change_effective_year
    attribute_change_note

이다.

특히 예전 형식의 Seed를 사용하고 있다면 변경 이력 컬럼이 빠져 있을 수 있다.


#### 7.2.2 `CSV에 교육과정 행이 없습니다`

CSV 헤더만 있고 실제 데이터 행이 없는 경우이다.

대상 파일을 잘못 지정하지 않았는지 확인한다.

    ls -l data/seed/curriculum_YYYY.csv


#### 7.2.3 `한 번에 하나의 입학년도만 import할 수 있습니다`

한 Seed 안에 여러 `entry_year`가 섞여 있는 경우이다.

확인:

    cut -d',' -f1 data/seed/curriculum_2022.csv \
      | sort \
      | uniq -c

헤더를 제외하면 하나의 학번만 존재해야 한다.


#### 7.2.4 학년 또는 학기 범위 오류

예:

    grade 범위가 잘못됐습니다

또는:

    semester는 1 또는 2여야 합니다

허용 값:

    grade:
    1 ~ 6

    semester:
    1 또는 2

해당 CSV 행을 직접 확인한다.


#### 7.2.5 이수구분 오류

허용 값:

    전필
    전선

오탈자나 공백이 없는지 확인한다.


#### 7.2.6 `change_role` 오류

허용 값:

    current
    legacy

구조변경이 없는 일반 행은:

    current

여야 한다.


#### 7.2.7 `change_group 없이 change_type을 지정할 수 없습니다`

다음과 같은 잘못된 상태이다.

    change_group =
    change_type = 1:1

구조변경을 기록하려면 두 값을 함께 지정한다.

예:

    change_group = 2022-EXAMPLE
    change_type = 1:1


#### 7.2.8 `change_group이 있으므로 change_type도 필요합니다`

반대 상황이다.

    change_group = 2022-EXAMPLE
    change_type =

이면 안 된다.

해당 그룹의 구조에 맞는:

    1:1
    1:N
    N:1
    N:M

중 하나를 지정한다.


#### 7.2.9 구조변경 그룹 구성이 올바르지 않은 경우

예:

    변경 그룹 ...의 1:N 구성이 올바르지 않습니다.
    legacy=1, current=1

`1:N`이라면:

    legacy = 1
    current >= 2

여야 한다.

구조별 허용 형태:

| Type | legacy | current |
|---|---:|---:|
| `1:1` | 1 | 1 |
| `1:N` | 1 | 2 이상 |
| `N:1` | 2 이상 | 1 |
| `N:M` | 2 이상 | 2 이상 |


#### 7.2.10 같은 그룹의 `change_type`이 서로 다른 경우

예:

    같은 change_group

안에서:

    한 행 = 1:N
    다른 행 = 1:1

처럼 기록되어 있으면 Import가 중단된다.

같은 구조변경 사건에 속하는 모든 행은 동일한 `change_type`을 사용한다.


#### 7.2.11 같은 그룹의 `change_effective_year`가 서로 다른 경우

같은 `change_group` 내에서는 동일한 적용 연도를 사용해야 한다.

예:

    legacy = 2026
    current = 2025

처럼 서로 다르면 오류가 발생한다.

실제 적용 연도를 다시 확인한 뒤 그룹 전체를 맞춘다.


#### 7.2.12 중복 교육과정 과목 오류

Importer는 다음 조합이 같은 행을 중복으로 판단한다.

    grade
    semester
    course_name
    course_code
    change_role

같은 과목을 실수로 두 번 입력했는지 확인한다.

구조변경 때문에 과거/현재 행이 모두 필요한 경우에는 `change_role`과 실제 과목 정보가 올바른지 확인한다.


#### 7.2.13 Attribute Metadata만 있고 `previous_*`가 없는 경우

예:

    attribute_change_effective_year = 2025

가 있지만:

    previous_credits
    previous_completion_type
    previous_grade
    previous_semester

가 모두 비어 있으면 오류이다.

Attribute Change metadata는 실제 이전 속성이 존재할 때만 사용한다.


#### 7.2.14 `curriculum_courses 테이블이 없습니다`

SQLite DB는 존재하지만 스키마가 적용되지 않은 경우이다.

오류 메시지에서 안내하는 대로:

    scripts/schema.sql

적용 여부를 확인한다.

단, 기존 정상 프로젝트 DB에서 갑자기 이 오류가 발생했다면 먼저 잘못된 `inyak.db`를 보고 있는지 확인한다.


### 7.3 PostgreSQL Import 오류

#### 7.3.1 `DATABASE_URL 환경변수가 설정되어 있지 않습니다`

현재 shell에 `DATABASE_URL`이 없다.

확인:

    printenv DATABASE_URL

빈 출력이면 현재 작업 대상 DB에 맞는 연결 문자열을 다시 설정한다.

개발과 운영 연결 문자열을 혼동하지 않는다.


#### 7.3.2 Project Ref 불일치

예:

    DATABASE_URL이 지정한 Supabase project ref와
    일치하지 않습니다.

출력의:

    요청 project ref
    접속 host

를 확인한다.

개발:

    rkunrjwetsnonwnmatec

운영:

    alkamigyftmalimqoixa

잘못된 DB에 쓰는 것을 막기 위한 정상적인 안전 중단이다.

`--project-ref`를 억지로 현재 URL에 맞추기보다 **원래 어느 DB에 작업하려던 것인지 먼저 확인한다.**


#### 7.3.3 PostgreSQL 스키마 컬럼 부족

예:

    PostgreSQL curriculum_courses에
    필요한 컬럼이 없습니다

현재 importer가 요구하는 19개 컬럼 중 일부가 DB에 없는 상태이다.

확인:

    SELECT
        column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'curriculum_courses'
    ORDER BY ordinal_position;

개발 DB와 운영 DB의 migration 상태가 다른지 확인한다.

스키마 문제를 해결하기 전에는 import를 진행하지 않는다.


#### 7.3.4 기존 학번이 있는데 `--replace`를 빼먹은 경우

예:

    PostgreSQL에 이미 2022학번 교육과정이
    ...개 있습니다.

기존 학번 유지보수라면:

    --replace

를 추가해 Dry Run한다.

예:

    python scripts/import_curriculum_postgres.py \
      data/seed/curriculum_2022.csv \
      --project-ref PROJECT_REF \
      --replace


#### 7.3.5 CSV 중복 `course_code`

PostgreSQL importer는 기존 ID를 안전하게 보존하기 위해 incoming Seed의 학정번호 중복을 허용하지 않는다.

예:

    CSV에 중복 course_code가 있어
    기존 ID를 안전하게 보존할 수 없습니다

Seed에서 동일 학정번호가 여러 행에 들어간 이유를 확인한다.

실수라면 수정한다.

실제로 동일 코드가 여러 구조적 행에서 필요하다고 판단되는 경우에는 importer의 ID 매칭 로직과 충돌하므로 자동으로 진행하지 않는다.


#### 7.3.6 예상하지 못한 `INSERT`

예상보다 많은:

    INSERT

가 나타난다면 기존 행과 새 Seed가 매칭되지 않았다는 뜻일 수 있다.

Importer의 기존 행 매칭 우선순위:

    1. 유일한 동일 course_code
    2. 유일한 동일 course_name + change_role

다음을 확인한다.

- course_code가 불필요하게 변경되지 않았는가
- course_name을 동시에 크게 변경하지 않았는가
- `change_role`이 달라지지 않았는가
- 실제 신규 행이 맞는가

신규 과목이나 신규 legacy 행이면 INSERT가 정상이다.


#### 7.3.7 예상하지 못한 `DELETE`

Dry Run에서:

    DELETE > 0

이 예상하지 못한 결과라면 **Apply하지 않는다.**

기존 DB에는 있지만 새 Seed와 대응되지 않는 행이 있다는 뜻이다.

먼저 기존 DB를 조회한다.

    SELECT
        id,
        course_code,
        course_name,
        grade,
        semester,
        change_role,
        change_group
    FROM public.curriculum_courses
    WHERE entry_year = 2022
    ORDER BY id;

Seed에서 사라진 행을 찾는다.

단순히 `legacy`로 남겨야 할 과목을 삭제한 것은 아닌지 확인한다.


#### 7.3.8 DELETE 대상을 사용자 기록이 참조하는 경우

Importer가 다음과 같이 중단할 수 있다.

    CSV에서 삭제될 교육과정 과목을
    사용자 기록이 참조하고 있습니다.

해당 curriculum ID를 조회한다.

    SELECT
        id,
        entry_year,
        course_code,
        course_name,
        change_role
    FROM public.curriculum_courses
    WHERE id = 대상_ID;

사용자 기록:

    SELECT
        id,
        user_id,
        curriculum_course_id
    FROM public.user_course_records
    WHERE curriculum_course_id = 대상_ID;

이 상태에서 curriculum row를 강제 삭제하지 않는다.

Seed 수정이 잘못된 것인지, 실제로 사용자 기록 migration이 필요한 상황인지 먼저 판단한다.


#### 7.3.9 Apply 후 최종 행 수 불일치

Importer는 Apply 후:

    PostgreSQL 해당 학번 최종 행 수
        =
    Seed 전체 행 수

인지 검사한다.

다르면:

    동기화 후 행 수가 예상과 다릅니다

오류가 발생한다.

먼저 대상 학번을 직접 확인한다.

    SELECT COUNT(*)
    FROM public.curriculum_courses
    WHERE entry_year = 2022;

같은 작업을 반복 적용하기 전에 실제 DB 상태를 먼저 조사한다.


#### 7.3.10 Orphan이 0이 아닌 경우

검사:

    SELECT COUNT(*) AS remaining_orphans
    FROM public.user_course_records AS ucr
    LEFT JOIN public.curriculum_courses AS cc
      ON cc.id = ucr.curriculum_course_id
    WHERE ucr.curriculum_course_id IS NOT NULL
      AND cc.id IS NULL;

정상:

    0

0이 아니면 운영 반영이나 추가 작업을 멈춘다.

상세 조회:

    SELECT
        ucr.id AS user_course_record_id,
        ucr.user_id,
        ucr.curriculum_course_id
    FROM public.user_course_records AS ucr
    LEFT JOIN public.curriculum_courses AS cc
      ON cc.id = ucr.curriculum_course_id
    WHERE ucr.curriculum_course_id IS NOT NULL
      AND cc.id IS NULL
    ORDER BY ucr.curriculum_course_id;

어떤 curriculum ID 연결이 끊겼는지 확인한다.


### 7.4 Git 및 데이터 상태가 서로 다른 경우

#### 7.4.1 로컬 Seed와 `origin/dev`가 다른 경우

먼저:

    git status

    git status -sb

    git log -1 --oneline --decorate

를 확인한다.

원격 상태 갱신:

    git fetch origin

현재 local과 remote 차이:

    git log --oneline --left-right HEAD...origin/dev

현재 작업 중인 수정이 있다면 무조건 pull하거나 reset하지 않는다.


#### 7.4.2 Seed는 수정했는데 SQLite가 이전 상태인 경우

Seed 수정 후:

    scripts/import_curriculum.py

를 다시 실행하지 않은 상태일 수 있다.

다시:

    python scripts/import_curriculum.py \
      data/seed/curriculum_2022.csv

를 실행한 뒤 SQL 검증을 반복한다.


#### 7.4.3 SQLite는 맞는데 PostgreSQL이 다른 경우

PostgreSQL Dry Run부터 다시 진행한다.

개발:

    python scripts/import_curriculum_postgres.py \
      data/seed/curriculum_2022.csv \
      --project-ref rkunrjwetsnonwnmatec \
      --replace

Dry Run에서 차이를 확인한 뒤 Apply 여부를 결정한다.


#### 7.4.4 개발 DB와 운영 DB가 다른 경우

두 DB에서 같은 SQL을 실행하여 비교한다.

예:

    SELECT
        COUNT(*) AS total_rows,
        COUNT(*) FILTER (
            WHERE change_role = 'current'
        ) AS current_rows,
        COUNT(*) FILTER (
            WHERE change_role = 'legacy'
        ) AS legacy_rows
    FROM public.curriculum_courses
    WHERE entry_year = 2022;

그리고 구조변경 및 Attribute Change도 각각 확인한다.

개발 DB가 최신이고 운영 DB만 이전 상태라면 운영 Dry Run을 실행한다.

개발 DB와 운영 DB 중 어느 쪽이 기준인지 불분명한 상태에서 운영 DB를 직접 수정하지 않는다.

기준은 항상:

    Git에 반영된 Seed CSV

이다.


#### 7.4.5 어떤 데이터가 기준인지 헷갈리는 경우

교육과정 내용의 기준:

    data/seed/curriculum_YYYY.csv

실제 개설 이력의 기준:

    data/db/inyak.db
        └─ courses

로컬 렌더링용 교육과정 DB:

    data/db/inyak.db
        └─ curriculum_courses

서비스 개발 DB:

    개발 PostgreSQL
        └─ public.curriculum_courses

서비스 운영 DB:

    운영 PostgreSQL
        └─ public.curriculum_courses

정상적인 데이터 흐름은:

    실제 개설 courses
        ↓ Audit
    Seed CSV 수정
        ↓
    SQLite curriculum_courses
        ↓
    Git dev
        ↓
    개발 PostgreSQL
        ↓
    운영 PostgreSQL

이다.

DB에서 발견한 차이를 곧바로 다른 DB에 수동 복사하기보다 먼저 Seed를 기준으로 어느 단계가 뒤처졌는지 확인한다.
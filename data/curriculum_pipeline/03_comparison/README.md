# 03 Comparison

PDF에서 추출한 교육과정과 전공이수체계도에서 추출한 과목을 직접 비교하는 단계입니다.

## compare_flowcharts_with_curriculum.py

### 실행

특정 학년도:

```bash
python -m scripts.curriculum.compare_flowcharts_with_curriculum --year 2024
```

전체 학년도:

```bash
python -m scripts.curriculum.compare_flowcharts_with_curriculum
```

### 병합 논리

입력:

- `02_extracted/curriculum/<year>/courses.csv`
- `02_extracted/curriculum_flowcharts/<year>/4year_courses.csv`
- `02_extracted/curriculum_flowcharts/<year>/6year_courses.csv`

PDF의 각 과목을 기준으로 4년제 및 6년제 전공이수체계도와 비교합니다.

과목명은 공백만 제거하여 비교합니다.

각 PDF 과목에 대해 다음을 확인합니다.

- 같은 과목명, 같은 학년, 같은 학기에 존재하는지
- 같은 이름의 과목이 다른 학년·학기에 존재하는지

이 단계에서는 fuzzy matching이나 자동 과목명 보정을 하지 않습니다.

이 단계에서는 과목의 4년제 / 6년제 세대를 최종 결정하지 않고 비교 evidence만 생성합니다.


## analyze_curriculum_generation_anchors.py

### 실행

사용 가능한 전체 학년도:

```bash
python -m scripts.curriculum.baseline_reconstruction.analyze_curriculum_generation_anchors
```

특정 학년도:

```bash
python -m scripts.curriculum.baseline_reconstruction.analyze_curriculum_generation_anchors \
  --years 2022 2023 2024
```

### 병합 논리

입력:

- `02_extracted/curriculum/<year>/courses.csv`
- `02_extracted/curriculum_flowcharts/<year>/4year_courses.csv`
- `02_extracted/curriculum_flowcharts/<year>/6year_courses.csv`

PDF의 1~2학년 과목에서 사용된 course code는 6년제 course code의 evidence로 취급합니다.

전공이수체계도의 과목과 PDF 과목의 다음 값이 모두 일치하는 경우를 찾습니다.

- 과목명
- 학년
- 학기

일치하는 PDF 행이 정확히 하나일 때만 해당 course code를 4년제 또는 6년제 generation anchor로 사용합니다.

동일한 course code에 대한 evidence는 여러 학년도에 걸쳐 합산합니다.

하나의 course code에 4년제와 6년제 evidence가 모두 존재하면 임의로 결정하지 않고 `conflict`로 남깁니다.
# 02 Extracted

`01_source`의 원본 자료에서 직접 추출한 CSV를 저장합니다.

## extract_curriculum_pdf.py

### 실행

특정 학년도:

```bash
python -m scripts.curriculum.extract_curriculum_pdf --year 2024
```

### 추출 논리

입력:

- `01_source/curriculum_pdfs/<year>/`

교육과정 PDF의 교과목 표를 읽어 다음 정보를 추출합니다.

- 학년
- 학기
- 과목명
- 과목코드
- 이수구분
- 학점

출력:

- `02_extracted/curriculum/<year>/courses.csv`
- `02_extracted/curriculum/<year>/extraction_report.txt`


## extract_curriculum_flowchart_vision.py

### 실행

학년도와 교육과정 체계를 지정하여 실행합니다.

```bash
python -m scripts.curriculum.extract_curriculum_flowchart_vision \
  --year 2024 \
  --program-years 6
```

### 추출 논리

입력:

- `01_source/curriculum_flowcharts/<year>/`

전공이수체계도 이미지에서 과목 박스를 추출하여 다음 정보를 기록합니다.

- 학년
- 학기
- 과목명
- 이미지 내 위치
- confidence

출력:

- `02_extracted/curriculum_flowcharts/<year>/<program_years>year_courses.csv`
- `02_extracted/curriculum_flowcharts/<year>/<program_years>year_extraction_report.txt`


## extract_course_relations.py

### 실행

특정 학년도:

```bash
python -m scripts.curriculum.extract_course_relations --year 2024
```

### 추출 논리

교육과정 PDF의 동일교과목·대체교과목 관계표를 추출합니다.

과목명은 같은 학년도의 `courses.csv`와 비교하여 공백 차이 정도만 정리합니다.

출력:

- `02_extracted/curriculum/<year>/course_relations.csv`
- `02_extracted/curriculum/<year>/relation_extraction_report.txt`
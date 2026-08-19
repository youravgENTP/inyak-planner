# Curriculum Baseline Pipeline

입학연도별 교육과정 baseline을 재구성하는 파이프라인입니다.

## 순서

1. `01_source`
   - 학교 원본 교육과정 PDF와 전공이수체계도

2. `02_extracted`
   - 원본 자료에서 직접 추출한 CSV

3. `03_comparison`
   - PDF 교육과정과 전공이수체계도를 비교
   - course code의 4년제 / 6년제 generation evidence 생성

4. `04_reconciled`
   - 과목 세대와 과목 간 관계를 분석

5. `05_baseline_candidates`
   - 입학연도별 baseline 후보 생성

6. `06_review`
   - 생성된 후보를 비교·검토

7. `07_baseline`
   - 최종 확정 baseline

각 단계에서 사용하는 스크립트의 실행 방법과 병합 논리는 해당 디렉터리의 `README.md`에 기록합니다.
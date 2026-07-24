import { TimetableGrid } from '../components/timetable/TimetableGrid'
import { SAMPLE_COURSES } from '../domain/timetable/constants'
import { getTotalCreditsPlaceholder } from '../domain/timetable/selectors'

export function TimetablePage() {
  const creditCount = getTotalCreditsPlaceholder(SAMPLE_COURSES)

  return (
    <section className="timetable-page">
      <div className="page-heading-row">
        <div>
          <span className="page-kicker">2026학년도 2학기</span>
          <h1>주간 시간표</h1>
          <p>수강 과목의 시간과 강의실을 한눈에 확인합니다.</p>
        </div>

        <button className="primary-button" type="button">
          + 과목 추가
        </button>
      </div>

      <div className="summary-grid" aria-label="시간표 요약">
        <article className="summary-card">
          <span>등록 과목</span>
          <strong>{SAMPLE_COURSES.length}</strong>
          <small>이번 학기</small>
        </article>
        <article className="summary-card">
          <span>예상 학점</span>
          <strong>{creditCount}</strong>
          <small>과목당 3학점 임시 계산</small>
        </article>
        <article className="summary-card summary-card--accent">
          <span>시간표 상태</span>
          <strong>정상</strong>
          <small>겹치는 수업 없음</small>
        </article>
      </div>

      <section className="panel timetable-panel" aria-labelledby="timetable-title">
        <div className="panel-header">
          <div>
            <h2 id="timetable-title">내 시간표</h2>
            <p>월요일부터 금요일, 09:00–18:00</p>
          </div>
          <button className="secondary-button" type="button">
            시간표 설정
          </button>
        </div>

        <TimetableGrid courses={SAMPLE_COURSES} />
      </section>
    </section>
  )
}

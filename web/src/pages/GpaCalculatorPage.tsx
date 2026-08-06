import './GraduationPlaceholderPage.css'

export function GpaCalculatorPage() {
  return (
    <section className="graduation-placeholder-page">
      <header className="graduation-placeholder-header">
        <p>졸업 요건 및 학점 계산기</p>

        <h1>GPA 계산기</h1>

        <span>
          학기별 과목과 성적을 입력하고
          학기 GPA와 누적 GPA를 계산합니다.
        </span>
      </header>

      <div className="graduation-placeholder-card">
        <h2>GPA 계산기 준비 중</h2>

        <p>
          직접 입력하거나 저장된 시간표에서
          과목을 불러오는 기능을 구현할 예정입니다.
        </p>
      </div>
    </section>
  )
}
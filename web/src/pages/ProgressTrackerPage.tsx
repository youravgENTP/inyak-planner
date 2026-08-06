import './GraduationPlaceholderPage.css'

export function ProgressTrackerPage() {
  return (
    <section className="graduation-placeholder-page">
      <header className="graduation-placeholder-header">
        <p>졸업 요건 및 학점 계산기</p>

        <h1>개인 이수 현황</h1>

        <span>
          회원정보에 저장된 학번의 교육과정을
          기준으로 이수 현황을 확인합니다.
        </span>
      </header>

      <div className="graduation-placeholder-card">
        <h2>개인 이수 현황 준비 중</h2>

        <p>
          이후 GPA 계산기에 입력한 과목과 성적을
          바탕으로 전필·전선 이수 현황을
          표시할 예정입니다.
        </p>
      </div>
    </section>
  )
}
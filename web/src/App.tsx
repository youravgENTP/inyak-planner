import './App.css'
import { AppShell } from './components/layout/AppShell'
import { TimetablePage } from './pages/TimetablePage'


/*
1. index.css : 앱 전체의 기본 css 설정
2. App.css : 현재 앱 화면의 구체적인 디자인
3. AppShell : Sidebar, Topbar, Page content와 같은 외곽구조 담당
4. TimetablePage : AppShell로 구현해놓은 전체 틀 안에 들어가는 
   시간표 페이지의 실제 내용
*/

function App() {
  return (
    <AppShell>
      <TimetablePage />
    </AppShell>
  )
}

export default App

/*
JavaScript 함수 선언 by `funciton 함수이름()`
1. FunctionComponent : (숫자, 문자열 등) 대신 JSX를 반환하는 JS 함수
   - 반드시 대분자로 시작하는 이름으로 선언해야함
   - `App()`의 경우 여러 줄의 JSX를 반환하고 있음

2. <AppShell> : 앞서 로드한 AppShell 컴포넌트를 렌더링하는 것
3. <TimetablePage> : TimetablePage 컴포넌트를 렌더링하는 것ㅌ
*/
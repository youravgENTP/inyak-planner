/*
`main.tsx`는 `index.html`에서 `<script></script>` 태그를 이용해 
실행하는 Typescript 파일이다. 

index.html 로드
   ↓
<div id="root"> 생성
   ↓
/src/main.tsx 실행
   ↓
main.tsx가 #root를 찾음
   ↓
createRoot가 해당 div를 React 영역으로 설정
   ↓
<App /> 렌더링
   ↓
AppShell과 TimetablePage 렌더링

*/

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/*
1. document : 현재 브라우저에 열린 HTML 문서 전체를 의미하는 객체
2. getElementById('root') : HTML 문서에서 `id="root"`인 요소 찾기)
3. ! : document.getElementById('root')가 `null`일 수 있지만, 
       `null`이 아니라는 것을 개발자가 확신할 수 있을 때 `null`이 아닐 것으로 취급하라는 것
4. createRoot() : 찾아낸 HTML 요소를 React의 렌더링 루트로 만들어, 
   해당 div 내부를 React가 관리하도록 하는 것
*/

# Claude Code 용 리팩터링 지시서 (복사해서 Claude에게 전달하세요)

@Claude, 다음 명세서(Specification)를 바탕으로 현재 Game Planning-Agent 프로젝트를 **Vanilla JS에서 React + Vite + Tailwind CSS 환경으로 전면 마이그레이션(리팩터링)**하는 작업을 수행해야 합니다.

명세서를 끝까지 숙지한 후, 스캐폴딩(Step 1)부터 컴포넌트 구현(Step 8)까지 코드 작성을 시작해 주세요.

---

## 🏗️ 1. 목표 및 컨텍스트
*   **목표**: `src/pipeline.js` 등 핵심 비즈니스 로직(뇌)은 그대로 100% 보존하면서, DOM을 직접 조작하던 `src/app.js` 및 `ui/` 폴더 하위의 스파게티성 UI(껍데기)를 전면 폐기하고, React/Tailwind 기반의 **'90s Retro 다중 윈도우 에이전트 관제탑'** 컴포넌트로 재구축합니다.
*   **환경**: React 18 + Vite + Tailwind CSS + TypeScript.

## 💾 2. 보존 / 폐기 / 수정 대상 파일 목록

### ✅ 완벽히 보존할 핵심 파일 (DOM 요소 없음)
*   `src/pipeline.js` (EventBus/StateManager 기반 파이프라인 엔진)
*   `src/utils/*` (`event-bus.js`, `state-manager.js`, `helpers.js`, `storage.js`)
*   `src/nodes/planner.js`, `compiler.js`, `auditor.js`
*   `src/config.js`
*   `output/slime-survivors/*` (Vite 구동 시 public 서빙 용도)

### 🗑️ 전면 삭제 및 프레임워크 대체 대상
*   `src/app.js` (React의 App.tsx로 완전 대체)
*   `src/ui/*` 하위 파일 전체 (`board-renderer.js`, `log-console.js` 등 DOM 조작 코드 전면 폐기)
*   `styles/*.css` 전체 (Tailwind Utilities로 100% 통합 및 대체)
*   `index.html` (Vite 구동을 위한 최소한의 스켈레톤 마크업 `<div id="root">` 구조로 교체, script 태그 모두 제거)

### 🔨 수정 대상 (DOM 의존성 제거)
*   `src/nodes/worker.js`: `import { showPromptPanel }` 등 UI 의존성을 삭제하고, 콜백 주입 패턴(`this._uiCallbacks.showSteps(input.steps)`)으로 데이터를 넘기도록 구조 수정.
*   `src/agents/agent-config.js`: 구형 모델명을 `claude-3-5-sonnet-20241022`, `gemini-3.0-pro`, `claude-3-5-haiku-20241022`로 하드코딩 교체.

---

## 🛠️ 3. 구현 스텝 (순서대로 실행하세요)

### Step 1: 프로젝트 스캐폴딩 및 패키지 설치
*   현재 루트 디렉토리에 `package.json` 세팅 및 `react`, `react-dom`, `vite`, `tailwindcss`, `typescript` 빌드 환경을 구축합니다.
*   `vite.config.ts` 설정 시, `output/slime-survivors` 폴더 내용물이 public 정적 경로로 서빙될 수 있도록 조치하세요 (Live Canvas 렌더링용).

### Step 2: Tailwind Config (Win95 테마)
`tailwind.config.js`와 `src/index.css`를 생성하고 다음 커스텀 색상 및 Box Shadow(inset/outset)를 추가하세요.
*   **Colors**: `win-gray`(#c0c0c0), `win-blue`(#000080), `win-white`(#ffffff), `win-dark`(#808080), `win-black`(#000000)
*   **Shadow**: Win95 테두리 음각(inset), 양각(outset) 버튼 효과
*   **Font**: Courier New, monospace 계열

### Step 3: React Context 설계 (상태 제어)
`src/context/WindowContext.tsx`를 생성합니다.
*   **관리 대상**: 윈도우들의 활성 상태(`WindowState[]`), 모든 에이전트 로그 기록(`Log[]`), 현재 파이프라인 흐름(`AgentData[]`).
*   **주의사항**: 윈도우의 **`x, y` 좌표는 절대로 Context에 넣지 마세요.** 오직 개별 모달(컴포넌트)의 로컬 State가 되어야 합니다. (Context 리렌더링 폭탄 방지)

### Step 4: DraggableWindow (부모 액자) 컴포넌트
`src/components/DraggableWindow.tsx`
*   `onMouseDown`, `onMouseMove` 기반으로 자유롭게 드래그 가능한 프레임입니다.
*   bg-win-gray 와 shadow-outset 속성, 상단 타이틀바(win-blue 배경 + win-white 텍스트 + 최소화/닫기 버튼)를 렌더링합니다.

### Step 5: 피처 윈도우 (Window 자식들) 분리
UI를 의미 있게 분할하여 각각의 컴포넌트(`src/components/windows/*`)로 만듭니다.
*   **PlannerWindow.tsx**: GDD/SPEC 입력 렌더링 및 Pipeline 실행 버튼 연결.
*   **TerminalWindow.tsx**: 시스템 `Log` 출력, 컴파일러 및 Worker 노드의 실행 상태(⏳💾⚠️) 표시 창.
*   **LiveCanvasWindow.tsx**: `<iframe src="/output/slime-survivors/index.html">` 삽입.
*   **MemoWindow.tsx**: 텍스트 메모 용도의 유틸 윈도우.

### Step 6: Taskbar (작업 표시줄) 조립
`src/components/Taskbar.tsx`
*   화면 밑단(bottom-0) 고정. 최소화 상태의 윈도우 아이콘들을 렌더링하고 클릭 시 `restore` 및 `zIndex`를 최상단으로 옮깁니다.

### Step 7: 비즈니스 로직 연동 (App.tsx)
`src/App.tsx` 최상단에서 Context Provider를 열고, `PipelineEngine` 인스턴스(기존 `src/pipeline.js`)를 생성합니다.
*   엔진의 `engine.on('node:start')` 등 EventBus 리스너를 React의 `useEffect` 안에서 구독. 이벤트 발생 시 `WindowContext`의 데이터를 갱신합니다.

### Step 8: Node-06 예약 (Playwright)
`src/agents/playwright-agent.js` 뼈대(Stub) 파일을 하나 생성하고, `BrowserAutomationNode` (key: `node06-browser`) 이름으로 빈 클래스 구조만 세팅해 두세요.

---

## 🎯 4. 완료 검증 (Definition of Done)
*   작업 후 `grep -r "getElementById\|querySelector" src/` 명령어를 실행했을 때 `src/` 내부 프론트엔드 코드에서 단 하나의 결과도 나오지 않아야 합니다.
*   `worker.js`에서 UI 파일을 `import` 하는 구문이 없어야 합니다.
*   드래그 성능이 60fps를 유지해야 합니다 (좌표 Context 분리 원칙).
*   Live Canvas 윈도우 안에서 `/output/slime-survivors/index.html` 뱀서 게임이 오류 없이 보여야 합니다.

---

## 📝 5. 메인 에이전트 브리핑 문서 작성 (매우 중요)
위 1~4번의 마이그레이션 작업을 모두 완료한 후, 테스트 및 최종 승인을 진행할 메인 에이전트(AntiGravity)에게 넘겨줄 **[작업 완료 및 테스트 결과 브리핑]** 문서를 `docs/MIGRATION_REPORT.md` 파일명으로 작성해 주세요. 

해당 문서에는 반드시 아래 4가지 항목이 포함되어야 합니다:

1.  **[1] 마이그레이션 실행 결과 요약**
    *   새로 생성/수정/삭제된 주요 파일들의 계층 구조 변화 (`src/components/`, `src/context/` 등)
    *   `src/nodes/worker.js`에서 콜백 주입 패턴(`_uiCallbacks`)이 정확히 어떻게 구현되었는지 코드 스니펫.
2.  **[2] 의존성 통제 검증 (DOM 요소 100% 제거 증명)**
    *   `grep -r "getElementById\|querySelector" src/` 실행 결과 터미널 로그.
3.  **[3] 상태 격리 검증 (60fps 윈도우 드래그 증명)**
    *   `x, y` 드래그 좌표가 `WindowContext`가 아니라 `DraggableWindow.tsx` 내의 로컬 `useState`로 완전히 분리되었음을 증명하는 로직 설명.
4.  **[4] 남은 미구현 기능 및 잠재적 에러 스니펫**
    *   작업 간 놓치거나 컴파일 타임에 발생할 여지가 있는 `event-bus.js` 호환성, 혹은 TypeScript 타입 관련 경고(Warning) 목록과 권장 후속 처리 방안.

완료되었다면 "작업 및 리포트 작성(`docs/MIGRATION_REPORT.md`) 완료" 메시지로 통보해 주세요.

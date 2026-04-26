# 📄 SPEC.md: 에이전트 제어 센터 (Agent Forge UI)

## 1. 시스템 개요 (Overview)
- **목적:** 백그라운드에서 동작하는 AI 에이전트 스웜(Node 01~05)의 실시간 상태, 에러 발생 여부, 작업 로그를 2.5D 이소메트릭 픽셀 아트 스타일의 UI로 모니터링하고 제어한다.
- **아키텍처 스택:** React 18 + Vite + Tailwind CSS + TypeScript (Frontend) / Proxy API (Backend)

## 2. 핵심 데이터 스키마 (Data Schema)
```typescript
// 1. 윈도우 UI 상태
interface WindowState {
  id: string;
  title: string;
  zIndex: number;
  isMinimized: boolean;
  // x, y 좌표는 렌더링 최적화를 위해 Context가 아닌 로컬 상태로 격리함.
}

// 2. 에이전트 작업 상태 (Star-Office-UI 차용)
type AgentStatus = 'idle' | 'writing' | 'researching' | 'executing' | 'error' | 'syncing';

interface AgentData {
  agentId: string;        // 예: 'node-04-worker'
  status: AgentStatus;    // 현재 상태
  currentTask: string;    // 현재 실행 중인 명령 (예: "Player.js 리팩토링 중")
  yesterdayMemo: string;  // 이전 작업 요약 (Audit Log)
  lastUpdated: number;    // 상태 갱신 타임스탬프
}
```

## 3. Module 1: Window Manager (Isometric Pixel UI Core)
**스타일 정의:**
- **디자인 시스템:** 16-bit/32-bit 이소메트릭 픽셀 아트 (Warm Wood & Brick 팔레트)
- **윈도우:** 고대비 타이틀바, 베벨 효과가 있는 3D 픽셀 테두리, 유리 투명도 효과 (Glassmorphism)
- **폰트:** Press Start 2P, VT323 등 픽셀 전용 폰트 활용

**최적화 규칙 (Critical):**
- 윈도우 드래그 시 발생하는 x, y 좌표 변경은 **절대 전역 Context API에 넣지 않음**
- 각 `DraggableWindow` 컴포넌트 내부의 **로컬 State(useState)로만 처리**
- 이를 통해 React 렌더링 트리 전체 리렌더링을 방지하고 **60fps 렌더링 보장**

## 4. Module 2: Agent Status Monitor (상태 수신부)
**기능:**
- 백그라운드 Python 서버(Flask or FastAPI)로부터 `AgentData` 상태 수신
- 수신 방식: Polling 또는 WebSocket
- 수신 데이터를 윈도우 내부에 실시간 렌더링

**시각화:**
- **이소메트릭 배치:** 에이전트가 책상에 앉아 있는 모습의 2.5D 픽셀 아트 캐릭터
- **상태별 애니메이션:**
  - `idle`: ⏳ 숨쉬기/깜빡임 애니메이션
  - `writing`/`executing`: 💾 키보드 타이핑 속도감 있는 애니메이션
  - `researching`/`thinking`: 🔍 머리 긁기, 물음표 말풍선 등 고민하는 모션
  - `error`: ⚠️ 캐릭터 주변 빨간색 글로우 및 당황한 표정
  - **상호작용:** 캐릭터 머리 위 고대비 말풍선(아이보리 바탕 + 갈색 테두리) 표시

## 5. Module 3: Memo & Audit Viewer (로그 출력부)
**기능:**
- Star-Office-UI의 'Yesterday Memo' 패턴 차용
- Node-05(감사관)가 작성한 기술 부채 목록 또는 Node-04가 완료한 작업 내역 출력
- 읽기 전용 텍스트 에어리어 윈도우로 표시
- `AgentData.yesterdayMemo` 필드에서 데이터 수신

## 6. Module 4: Taskbar & Start Menu (작업 표시줄)
**배치 및 고정:**
- 화면 하단에 `fixed bottom-0`로 고정
- 전체 화면 너비 사용 (100vw)

**기능:**
- 최소화된 에이전트 윈도우 목록 표시
- 클릭 시 해당 윈도우:
  1. `zIndex`를 최상단으로 끌어올림 (Focus)
  2. `isMinimized` 상태를 false로 복원 (Restore)

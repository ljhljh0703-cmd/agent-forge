# Agent Forge OS

**Vanilla JS → React/Vite/Tailwind 마이그레이션 완료**

이소메트릭 픽셀 오피스 테마의 다중 윈도우 에이전트 OS. 5-에이전트 AI 파이프라인(Gemini 2.0 Flash)으로 게임/소프트웨어/문서를 자동 생성합니다.

## 📋 설정

### 설치
```bash
npm install
```

### 개발 서버
```bash
npm run dev
```

### 빌드
```bash
npm run build
```

### 타입 체크
```bash
npm run type-check
```

## 🏗️ 프로젝트 구조

```
.
├── src/
│   ├── main.tsx                 # React 엔트리포인트
│   ├── App.tsx                  # 메인 앱 컴포넌트
│   ├── index.css                # Tailwind 전역 스타일
│   ├── context/
│   │   └── WindowContext.tsx     # 윈도우/에이전트 상태 관리
│   ├── components/
│   │   ├── DraggableWindow.tsx   # 드래그 가능한 윈도우
│   │   ├── Taskbar.tsx           # 하단 작업 표시줄
│   │   └── windows/
│   │       ├── PlannerWindow.tsx
│   │       ├── TerminalWindow.tsx
│   │       ├── LiveCanvasWindow.tsx
│   │       └── MemoWindow.tsx
│   ├── nodes/                    # 순수 로직 (DOM 없음)
│   └── agents/                   # 에이전트 설정
├── output/slime-survivors/       # 게임 결과물
├── index.html                    # Vite 엔트리포인트
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## 🎨 이소메트릭 픽셀 오피스 테마

Tailwind CSS 커스텀 토큰:
- `iso-*`: 이소메트릭 오피스 색상 팔레트 (floor, wall, accent, panel 등)
- `font-pixel`: Press Start 2P 픽셀 폰트
- `shadow-pixel`: 하드 오프셋 그림자 (4px 4px 0)

## 🔧 핵심 변경사항

### 1. 에이전트 API 모델 업데이트
```javascript
LEADER:    'claude-3-5-sonnet-20241022'
MEMBER:    'gemini-3.0-pro'
SUB_AGENT: 'claude-3-5-haiku-20241022'
```

### 2. worker.js 콜백 주입 패턴
- DOM import 제거
- `setUICallbacks({ showSteps, onComplete })` 패턴 적용

---

**마이그레이션 완료 일자**: 2026-03-02
**기술 스택**: React 18, Vite 5, Tailwind CSS 3.4, TypeScript 5.3

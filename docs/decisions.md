# decisions.md — 작업 재개용 핵심 기록

> **최종 갱신**: 2026-03-03 (Task 5·6·7 완료)
> **목적**: 창 폭발/세션 재시작 후 즉시 컨텍스트 복원

---

## ✅ 현재 위치 (Last Known State)

**SPEC-02 + 버그픽스 3건 완료 (2026-03-03)**
→ Step 8-A~8-F 모두 구현 완료. TypeScript 에러 0건.
→ Task 5 (Compiler), Task 6 (HistoryWindow), Task 7 (창 경계) 완료.

### SPEC-02 완료 체크리스트
| Step | 내용 | 상태 |
|------|------|------|
| 8-A | 도메인 스위칭 인프라 (Taskbar 스위처 + Context) | ✅ |
| 8-B | Planner SW 모드 (PRD 자동 생성) | ✅ |
| 8-C | Architect SW 모드 (아키텍처 문서 생성) | ✅ |
| 8-D | Worker SW 모드 (보일러플레이트 + 파일 추출) | ✅ |
| 8-E | Auditor SW 모드 (5카테고리 검증 + severity 루프백) | ✅ |
| 8-F | Live Canvas Mermaid 렌더링 + 파일트리 + ZIP 다운로드 | ✅ |

### 이번 세션에서 수정한 버그/누락
1. **stale closure 버그** — `runWorker`가 `GeneratedFile[]`를 반환하도록 수정 → ArchitectWindow에서 직접 사용
2. **ZIP 다운로드** — jszip 설치 + handleDownloadZip 실제 ZIP 구현
3. **API Key UI** — AgentStatusPanel에 password input + localStorage 저장 추가
4. **.env.example** 파일 생성
5. **Compiler 활성화** — `runCompiler()` + `compiler`/`compiler_sw` 역할 추가, ArchitectWindow에서 호출
6. **HistoryWindow** — 완료된 파이프라인 결과를 localStorage에 저장/조회/불러오기
7. **창 경계 제한** — DraggableWindow의 handleMouseMove에 clamp 적용 (우측 패널 300px, 태스크바 120px 제외)

### 다음 세션 시작 시 할 것
- `npm run dev` 실행 → API Key 입력 → 게임/SW 모드로 E2E 테스트
- Taskbar에 History 버튼이 보이는지 확인

---

## 🏗️ 프로젝트 근본 변경 결정

### [D-01] Vanilla JS → React + TypeScript 전환 (완료)
- **결정 이유**: Phase 6까지 완성했으나, 실제 Claude API 연동 및 SW 도메인 지원을 위해 전면 재작성 선택
- **현재 스택**: React + TypeScript + Vite + Tailwind CSS
- **순수 브라우저 앱** 유지 (Node.js 서버 없음)

### [D-02] 도메인 모드 추가 (game / software)
- `src/config/domain-mode.ts` — `DomainMode = 'game' | 'software'`
- `GAME_DOMAIN` / `SOFTWARE_DOMAIN` 두 가지 설정 존재
- `canvasType`: game → `iframe-game`, software → `mermaid-diagram`
- 전환 시 에이전트 title/description도 동적으로 변경

### [D-03] Google Gemini API 연동 (2026-03-03 Anthropic → Google 전환)
- `src/services/ai-client.ts` — Gemini API 클라이언트 (SSE 스트리밍)
- `src/services/agent-service.ts` — 5개 에이전트 역할 + 스트리밍 지원
- 모델: `gemini-2.0-flash` (전 에이전트 공통)
- **API Key**: Google AI Studio (https://aistudio.google.com/apikey) — `AIza...` 형식
- 프록시: `/api/google` → `https://generativelanguage.googleapis.com` (vite.config.ts)
- **API Key 저장**: 앱 우측 패널 상단 입력 → localStorage 저장

### [D-04] 에이전트 역할 (agent-service.ts의 AGENT_ROLES)
| roleId | 이름 | 역할 |
|--------|------|------|
| planner | Alex (기획자) | 아이디어 → GDD 생성 |
| architect | Sam (아키텍트) | GDD → SPEC 생성 |
| worker | (워커) | SPEC → 코드 생성 (파일별) |
| auditor | (감사자) | 코드 → 품질 검증 |

---

## 📁 현재 핵심 파일 맵

```
src/
├── App.tsx                      ← 엔트리 (투-컬럼 레이아웃)
├── main.tsx                     ← Vite 엔트리
├── index.css                    ← Tailwind 기본
├── config/
│   ├── domain-mode.ts           ← DomainMode, DomainConfig, GAME_DOMAIN, SW_DOMAIN
│   ├── genre-templates.ts       ← 게임 장르 템플릿 (RPG, 슈팅 등)
│   └── employees.ts             ← 에이전트 캐릭터 설정 (이름/외형)
├── context/
│   └── WindowContext.tsx        ← 전역 상태 (windows, agents, pipeline, domain)
├── services/
│   ├── ai-client.ts             ← Claude API 래퍼
│   └── agent-service.ts         ← 에이전트 역할 + 스트리밍
├── utils/
│   └── code-extractor.ts        ← AI 응답에서 코드블록 추출, assembleGame()
├── components/
│   ├── OfficeSetting.tsx        ← 오피스 배경 씬
│   ├── EmployeeCard.tsx         ← 에이전트 캐릭터 카드
│   ├── DraggableWindow.tsx      ← 드래그 가능 윈도우
│   ├── Taskbar.tsx              ← 하단 윈도우 목록
│   ├── AgentStatusPanel.tsx     ← 우측 에이전트 상태 패널
│   └── windows/
│       ├── PlannerWindow.tsx    ← 아이디어/GDD 입력 + AI 생성 (★ 최근 작업)
│       ├── ArchitectWindow.tsx  ← GDD → SPEC 생성 (★ 최근 작업)
│       ├── LiveCanvasWindow.tsx ← 게임/다이어그램 실시간 렌더 (★ 최근 작업)
│       ├── TerminalWindow.tsx   ← 로그 콘솔
│       └── MemoWindow.tsx       ← 메모장
└── (구형 vanilla JS 파일들)
    ├── config.js, pipeline.js   ← 구버전 (참조용, 삭제 고려)
    ├── nodes/                   ← 구버전 노드들
    └── agents/                  ← 구버전 스텁들
```

---

## 🔄 WindowContext 핵심 상태

```typescript
PipelineState {
  status: 'idle' | 'running' | 'paused' | 'complete' | 'error'
  currentNode: string | null
  gdd: string          // Planner 출력
  spec: string         // Architect 출력
  generatedCode: GeneratedFile[]   // Worker 출력 (파일별)
  diagrams: MermaidDiagram[]       // SW 모드용 Mermaid
  auditResult: AuditResult | null  // Auditor 출력
  loopCount: number
}
```

---

## ⚠️ 미완성 / 확인 필요 사항

| # | 항목 | 상태 |
|---|------|------|
| 1 | **API Key 입력 방식** | ai-client.ts 확인 필요 — 환경변수? 런타임 입력? |
| 2 | **Worker 실제 구현** | agent-service.ts에서 worker 호출 확인 필요 |
| 3 | **ArchitectWindow** — SW 모드 분기 | 최근 작업됨, 완료 여부 불명 |
| 4 | **LiveCanvasWindow** — SW 모드 Mermaid 렌더 | 최근 작업됨, 완료 여부 불명 |
| 5 | **PlannerWindow** — SW 모드 분기 | 최근 작업됨, 완료 여부 불명 |
| 6 | **구형 vanilla JS 파일** 정리 | config.js, pipeline.js, nodes/, agents/ 삭제 여부 결정 필요 |
| 7 | **vite.config.ts** | API proxy 설정 여부 확인 필요 (CORS) |

---

## 🚧 마지막 작업 흐름 추정 (Mar 3 20:30~20:38)

파일 수정 타임스탬프 기준:
1. `ai-client.ts` (18:19) — Claude API 클라이언트 작성
2. `genre-templates.ts` (18:20) — 장르 템플릿
3. `domain-mode.ts` (20:28) — SW 도메인 추가
4. `employees.ts` (20:29) — 직원 설정
5. `App.tsx` (20:29) — 레이아웃 업데이트
6. `Taskbar.tsx` (20:29) — 태스크바
7. `ArchitectWindow.tsx` (20:32) — Architect 창
8. `code-extractor.ts` (20:32) — 코드 추출 유틸
9. `agent-service.ts` (20:30) — 에이전트 서비스
10. `PlannerWindow.tsx` (20:31) — Planner 창
11. `LiveCanvasWindow.tsx` (20:38) ← **가장 마지막 작업**
12. `WindowContext.tsx` (20:34) — 컨텍스트 업데이트

**추정**: SW 도메인 지원 추가 작업 중 창이 터진 것으로 보임.
LiveCanvasWindow의 SW 모드 (Mermaid 다이어그램 렌더러) 작업이 미완성일 가능성 있음.

---

## 🔑 주의사항 (함정)

1. **전역 함수 노출 불필요** — React 앱이므로 `window.xxx` 패턴 필요 없음
2. **순수 브라우저** — subprocess 불가, Node.js API 없음
3. **구형 JS 파일들** (`pipeline.js`, `config.js`, `nodes/`, `agents/`) — React 앱과 무관, 혼동 주의
4. **도메인 모드** — `domainMode === 'software'`일 때 LiveCanvas는 Mermaid 렌더러, game이면 iframe 게임
5. **HANDOFF.md는 구버전** — Phase 1~6 vanilla JS 기준. 현재 React 앱 기준이 아님

---

## ▶ 다음 작업 시작 시

```
docs/decisions.md를 읽고 현재 프로젝트 상태를 파악한 뒤
[작업 내용]을 진행해줘.
```

가장 가능성 높은 다음 작업:
- LiveCanvasWindow.tsx의 SW 모드 Mermaid 렌더러 완성 확인/수정
- npm run dev 실행 후 E2E 테스트

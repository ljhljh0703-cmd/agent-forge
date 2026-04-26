# 🔄 AI Agent Pipeline — 핸드오프 문서

> **최종 갱신**: 2026-02-20 22:25 KST
> **목적**: 새 대화(또는 새 에이전트)가 이 프로젝트를 이어받을 때, 컨텍스트 소실 없이 즉시 작업을 재개하기 위한 문서

---

## 📍 프로젝트 한 줄 요약

이소메트릭 픽셀 오피스 테마의 **다중 윈도우 에이전트 OS**로, AI 에이전트 5-노드 파이프라인(Planner → Architect → Compiler → Worker → Auditor)을 시각화하고, 실제 GDD/SPEC 문서를 파싱하여 코드를 자동 생성하는 도구.

---

## 1. 지금까지 완료된 작업

### Phase 1~4: 기반 구축 ✅

| 항목 | 핵심 파일 | 줄 수 |
|------|----------|------|
| UI 보드 (레거시 vanilla JS) | `index.html` | 204 |
| 스캐폴딩 (30개 파일 생성) | 전체 `src/`, `styles/`, `templates/` | — |
| Prompter→Compiler 리네임 | `compiler.js`, `config.js`, `nodes.css` 등 6개 파일 | — |
| PipelineEngine (순차 실행 + 루프백) | `src/pipeline.js` | 148 |
| EventBus (on/emit/off) | `src/utils/event-bus.js` | ~30 |
| StateManager (get/set/subscribe) | `src/utils/state-manager.js` | ~50 |
| 노드 Mock 로직 (Compiler/Worker/Auditor) | `src/nodes/*.js` | — |
| UI ↔ Pipeline 이벤트 바인딩 | `src/app.js` | 300 |
| 루프백 시각화 (SVG + Loop Card) | `src/app.js` + `connections.js` | — |

### Phase 5: 실전 구현 ✅

| Step | 항목 | 핵심 파일 | 현재 상태 |
|------|------|----------|----------|
| **5-A** | GDD/SPEC 입력 UI | `src/ui/file-loader.js` (97줄) | ✅ textarea + 파일 선택 + 드래그앤드롭 작동 |
| **5-B** | Compiler 실전화 | `src/nodes/compiler.js` (229줄) | ✅ SPEC 파싱 → task 분해 → 프롬프트 생성 |
| **5-C** | Worker 프롬프트 카드 UI | `src/ui/prompt-display.js` (184줄) + `worker.js` (89줄) | ✅ 카드 표시 + 복사 + 완료 확인 |
| **5-D** | Auditor 체크리스트 UI | `src/ui/checklist-display.js` (107줄) + `auditor.js` (128줄) | ✅ 체크리스트 + Debt Score 산출 |
| **5-E** | 통합 | `src/app.js` (300줄) | ✅ Compiler→Worker→Auditor 전체 플로우 연결 |

### Phase 6: 강화 & 테스트 ✅

| Step | 항목 | 핵심 파일 | 현재 상태 |
|------|------|----------|----------|
| **6-A** | E2E 테스트 | localhost:8080 | ✅ Compiler 4 step 생성, Worker 카드 4장, 에러 0건 |
| **6-B** | Compiler 파싱 강화 | `compiler.js` (384줄) | ✅ 유연 헤더 매칭 + 폴백 전략 |
| **6-C** | 프롬프트 품질 개선 | `compiler.js` | ✅ /model, 대상 파일, 완료 기준 포함 |
| **6-D** | Auditor 자동 검증 | `auditor.js` (208줄) | ✅ autoScore/manualScore 분리 |
| **6-E** | 정리 + 반응형 CSS | `main.css` (367줄) | ✅ 4 breakpoint 반응형 |

### 현재 작동하는 기능

1. **▶ Run Pipeline**: GDD/SPEC 로드 → Compiler → Worker(프롬프트 카드) → Auditor(체크리스트) → Pass/Fail
2. **⟲ Simulate Loop**: mock 데이터로 자동 실행 + HIGH 난이도 step 강제 실패 → 루프백 시연
3. **↺ Reset**: 전체 상태 초기화
4. **파일 로더**: textarea 입력, 파일 선택 버튼, 드래그앤드롭 3가지 방식 지원

---

## 2. 앞으로 남은 과제

### 🔴 우선순위 높음

| 과제 | 설명 | 복잡도 |
|------|------|--------|
| **실제 GDD/SPEC로 E2E 테스트** | Gemini에서 생성한 실제 GDD.md + SPEC.md를 넣고 전체 플로우 확인 | MID |
| **SKILL.md 생성** | Compiler 노드가 `SKILL.md`를 참조하도록 설계되어 있으나 파일 미존재 | LOW |
| **Compiler 파싱 강화** | 현재는 고정 패턴(`## 6. 구현 순서` 등)만 파싱 → 유연한 파싱 필요 | HIGH |
| **로컬 서버 설정** | `file://` 프로토콜은 일부 브라우저에서 ES Module 제한 있음 → `npx serve .` 등 필요 | LOW |

### 🟡 중간

| 과제 | 설명 |
|------|------|
| **Worker 프롬프트 품질 개선** | `_buildPrompt()`이 현재 단순 문자열 결합 → 더 구조화된 프롬프트 생성 |
| **Auditor 자동 검증** | 현재 수동 체크리스트 → 파일 존재 확인 등 자동 검증 로직 추가 |
| **팀 모드(Sub-Agent) 실전화** | `src/agents/` 폴더에 스텁만 존재 (team-manager.js, agent-router.js, agent-config.js) |
| **CSS 반응형 보강** | 모바일/태블릿 대응 미흡 |

### 🟢 보류/미래

| 과제 | 설명 |
|------|------|
| Gemini API 직접 연동 | Node 1~2를 브라우저에서 Gemini API 호출 → 현재는 수동 파일 로드 |
| execution-plan.json 파일 저장 | 현재 메모리에만 존재 → 파일 다운로드 기능 |
| 히스토리/세이브/로드 | LocalStorage로 이전 파이프라인 결과 저장 |

---

## 3. 시도했지만 실패한 방법

### ❌ Prompter 노드 (Gemini 영역에서 프롬프트 가공)

- **시도**: Node 3을 "Prompter"로 설계, Gemini 채팅에서 프롬프트를 가공
- **문제**: Gemini ↔ Claude Code 핸드오프 시 암묵적 맥락 유실, 역할 중복 (Worker도 프롬프트 가공)
- **결론**: **Compiler로 리네임**, Claude Code 영역으로 이동 → GDD+SPEC을 파싱하여 실행 명령어 세트를 생성하는 역할로 전환
- **참고**: `pipeline_redesign_analysis.md`에 상세 리스크 분석 기록

### ❌ Worker에서 Claude Code Subprocess 직접 호출

- **시도**: Worker 노드가 자동으로 Claude Code subprocess를 호출하여 코드 생성
- **문제**: 이 프로젝트는 **순수 브라우저 앱** (Node.js 서버 없음) → subprocess 호출 불가
- **결론**: Worker를 **프롬프트 카드 UI**로 전환. 사용자가 프롬프트를 복사 → Claude Code에 직접 입력 → 완료 확인하는 반자동 방식 채택

### ❌ 하나의 긴 대화에서 Phase 전체 구현

- **시도**: Phase 5의 5-A ~ 5-E를 한 대화에서 연속 진행
- **문제**: 대화 후반부에서 컨텍스트 윈도우 초과 → 초반 구현 내용/규칙을 잊음 → 엉뚱한 방향으로 코드 수정
- **결론**: CLAUDE_BRIEFING.md + 이 핸드오프 문서를 활용하여 **대화를 짧게 유지**해야 함

### ❌ 콘솔 에러 디버깅 중 토글 버튼 이벤트 누락 (대화 2b2d042a)

- **시도**: File Loader의 토글 버튼이 반응하지 않는 문제 수정
- **원인**: `toggleFileLoader()`가 `window` 전역에 노출되지 않아 HTML `onclick`에서 호출 불가
- **결론**: `window.toggleFileLoader = function() { ... }` 형태로 전역 노출 추가하여 해결

---

## 4. 핵심 아키텍처 맵

```
Game Planning-Agent/
├── index.html                ← 엔트리 HTML (204줄)
├── styles/                   ← CSS 8개 파일
│   ├── main.css              ← 기본 + 파일 로더 스타일
│   ├── nodes.css             ← 노드 룸 스타일
│   ├── animations.css        ← 모든 @keyframes
│   ├── detail-panel.css      ← 디테일 오버레이
│   ├── log-console.css       ← 로그 콘솔
│   ├── connections.css       ← SVG 연결선
│   ├── prompt-display.css    ← Worker 프롬프트 카드
│   └── checklist-display.css ← Auditor 체크리스트
├── src/
│   ├── app.js                ← 엔트리 + 이벤트 바인딩 (300줄)
│   ├── pipeline.js           ← PipelineEngine (148줄)
│   ├── config.js             ← NODES 데이터, NODE_ORDER (92줄)
│   ├── agents/               ← 팀 모드 (스텁만 존재)
│   │   ├── team-manager.js
│   │   ├── agent-router.js
│   │   └── agent-config.js
│   ├── nodes/
│   │   ├── base-node.js      ← BaseNode 추상 클래스
│   │   ├── planner.js        ← 자동 complete (Gemini 완료 가정)
│   │   ├── architect.js      ← 자동 complete (Gemini 완료 가정)
│   │   ├── compiler.js       ← ★ SPEC 파싱 → execution-plan (229줄)
│   │   ├── worker.js         ← ★ 프롬프트 카드 UI 연동 (89줄)
│   │   └── auditor.js        ← ★ 체크리스트 + Debt Score (128줄)
│   ├── ui/
│   │   ├── file-loader.js    ← GDD/SPEC 입력 (97줄)
│   │   ├── prompt-display.js ← Worker 프롬프트 카드 (184줄)
│   │   ├── checklist-display.js ← Auditor 체크리스트 (107줄)
│   │   ├── board-renderer.js ← 노드 상태 표시
│   │   ├── connections.js    ← SVG 연결선
│   │   ├── detail-panel.js   ← 노드 디테일 패널
│   │   ├── log-console.js    ← 로그 콘솔
│   │   ├── particles.js      ← 토치 파티클
│   │   └── victory.js        ← 승리 오버레이
│   └── utils/
│       ├── event-bus.js      ← on/emit/off
│       ├── state-manager.js  ← get/set/subscribe
│       ├── storage.js        ← localStorage 래퍼 (스텁)
│       └── helpers.js        ← sleep() 등
├── templates/
│   ├── gdd-template.md       ← GDD 마크다운 템플릿
│   └── spec-template.md      ← SPEC 마크다운 템플릿
├── output/                   ← Worker 출력 디렉토리 (비어 있음)
└── docs/
    ├── HANDOFF.md             ← 이 문서
    ├── CLAUDE_BRIEFING.md     ← Claude Code 브리핑
    ├── WORK_SPEC.md           ← 작업 명세서 (819줄, 31KB)
    ├── GDD.md                 ← 플레이스홀더
    └── SPEC.md                ← 플레이스홀더
```

---

## 5. 데이터 흐름

```
[사용자] GDD.md/SPEC.md 로드 (file-loader.js)
    ↓
StateManager에 저장: 'source.gdd', 'source.spec'
    ↓
[Planner/Architect] 자동 complete (Gemini 사전 완료)
    ↓
[Compiler] StateManager에서 GDD/SPEC 읽기
    → SPEC의 "## 6. 구현 순서" 파싱 → task 목록
    → SPEC의 "## 3. 핵심 모듈 설계" 파싱 → 모듈별 task
    → SPEC의 "## 7. 완료 기준" 파싱 → checkItems (Auditor용)
    → 각 task에 난이도(HIGH/MID/LOW) 배정 + 프롬프트 생성
    → 결과를 StateManager에 'node.compiler.result'로 저장
    ↓
[Worker] Compiler 결과의 steps를 prompt-display에 전달
    → 사용자: 프롬프트 복사 → Claude Code에 입력 → ✅ 완료 클릭
    → 모든 step 완료 시 Promise resolve
    ↓
[Auditor] StateManager에서 checkItems 읽기
    → 체크리스트 UI 표시 → 사용자 수동 체크
    → Debt Score = (미체크/전체) × 10
    → Score < 5.0 → PASS ✅ (pipeline:complete)
    → Score ≥ 5.0 → FAIL → loopBack(compiler 또는 worker)
```

---

## 6. 주의사항 (함정 모음)

| # | 함정 | 설명 |
|---|------|------|
| 1 | **전역 함수 노출** | HTML `onclick`에서 호출되는 함수는 반드시 `window.함수명 = function() {...}` 으로 전역 노출해야 함. ES Module 스코프 때문. |
| 2 | **SPEC 파싱 고정 패턴** | Compiler는 `## 6. 구현 순서`, `## 3. 핵심 모듈 설계`, `## 7. 완료 기준` 패턴만 인식. SPEC 포맷이 다르면 빈 task 생성. |
| 3 | **순수 브라우저 앱** | Node.js 서버 없음. 파일 시스템 접근 불가. subprocess 호출 불가. 모든 로직은 클라이언트 사이드. |
| 4 | **simulateLoop 패치** | `app.js`의 `simulateLoop()`은 Worker와 Auditor의 execute/validate를 런타임 패치함. 원본 복원 로직이 있으므로 건드리지 말 것. |
| 5 | **SKILL.md 미존재** | 프로젝트에 SKILL.md가 없음. Compiler가 참조하지 않으나, WORK_SPEC.md에는 SKILL 흡수로 설계되어 있음 → 불일치. |
| 6 | **agents/ 스텁** | `src/agents/` 폴더의 3개 파일은 **스텁만 존재**. 실제 팀 모드 라우팅은 미구현. |
| 7 | **WORK_SPEC.md 31KB** | 이 파일을 통째로 읽으면 컨텍스트 폭발. **HANDOFF.md**(이 문서)와 **CLAUDE_BRIEFING.md**만 읽으면 충분. |

---

## 7. 새 대화 시작 시 추천 프롬프트

```
docs/HANDOFF.md를 읽고, 현재 프로젝트의 상태를 파악한 뒤
[원하는 작업]을 진행해줘.
```

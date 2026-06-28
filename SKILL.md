# SKILL.md — Agent Forge OS 프로젝트 스킬셋

> **이 파일은 Compiler 노드가 참조하는 프로젝트 스킬/규칙 문서입니다.**

AgentForge는 AI 게임 스튜디오 파이프라인(기획→제작→검증)의 웹 자동생성 인스턴스다 — Auditor 폐루프·Debt Score·HITL이 단순 바이브코딩과 구분되는 거버넌스 핵심. 단, 에셋 생성(②Asset)과 자기진화(⑤Evolve)는 현재 범위 밖이며, game-studio-pipeline 본체(vault 설계·진행 중)와는 별도 독립 구현이다.

---

## 프로젝트 규칙

### 기술 스택
- **React 18** + **TypeScript 5.3 (strict)** + **Vite 5** + **Tailwind CSS 3.4**
- **iframe sandbox** — Worker가 생성한 HTML을 격리 실행 후 Probe로 검증
- **Gemini 3.5 Flash / 3.1 Pro** — model-strategy.ts 기준, BYOK 런타임

### 기술 제약
- **클라이언트 사이드 전용** — Node.js 서버 없음, 모든 로직 브라우저에서 실행
- **BYOK** — Gemini API Key는 `.env`(gitignore) 또는 UI 입력. dist 번들 금지
- **TS strict** — `noImplicitAny`, `strictNullChecks` 활성화. `any` 사용 금지
- **싱글톤 AIClient** — `getAIClient()` 통해서만 접근(키 변경 시 `resetAIClient()`)

### 코딩 컨벤션
- 함수명: camelCase
- 클래스명: PascalCase
- 상수: UPPER_SNAKE_CASE
- 내부(private) 함수: `_` 접두사
- 주석: 한글, 파일 상단에 역할 설명 + 입출력 명시
- export: 파일 하단이 아닌 함수/클래스 선언부에서 직접 export

### 아키텍처 패턴
- **WindowContext** — 전역 상태 허브 (windows, agents, pipeline, domainMode)
- **DraggableWindow** — 드래그 위치는 local useState(Context X), zIndex·visibility만 Context
- **MetricsCollector** — 이벤트 기반 pub/sub, API 콜 메트릭 수집
- **CostCalculator** — 토큰 → USD 변환
- **AgentService** — roleId → systemPrompt/model/temperature 매핑 싱글톤

### 파이프라인 에이전트 역할
| 단계 | 역할(ID) | 산출물 |
|------|---------|--------|
| 1 | planner | GDD (마크다운) |
| 2 | architect | SPEC (마크다운 + mermaid) |
| 3 | compiler | ExecutionPlan JSON |
| 4 | worker | 코드(스트리밍) |
| 5 | auditor | AuditResult JSON (Debt Score 0-10) |

루프백: auditor → worker(fix-worker) 또는 compiler(fix-compiler), MAX=3회

### 도메인 접미사 패턴
- 기본(게임): `planner`, `architect`, ...
- SW 도메인: `planner_sw`, `architect_sw`, ...
- Docs 도메인: `planner_docs`, `architect_docs`, ...
- `baseAgentId()` 로 메트릭 집계 시 접미사 제거

---

## Claude Code 작업 시 참고

### 모델 사용 가이드
| 작업 유형 | 추천 모델 | 명령어 |
|----------|----------|--------|
| 설계/판단/아키텍처 | Opus | `/model opus` |
| 구현/분석/코드 작성 | Sonnet | `/model sonnet` |
| 파일 생성/포맷팅/정리 | Haiku | `/model haiku` |

### 파이프라인 SPEC 파싱 규칙
Compiler 노드가 SPEC에서 task를 추출할 때 사용하는 패턴:
- `## 6. 구현 순서` → 번호 리스트(1. 2. 3.)
- `## 3. 핵심 모듈 설계` → ### 서브헤딩
- `## 7. 완료 기준` → 체크박스(- [ ])

### 검증 방법
```bash
npm run type-check   # tsc --noEmit
npm run lint         # eslint src
npm run dev          # Vite dev server (port 5173)
```

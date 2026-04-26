# SPEC-01: 게임 개발 자동화 강화 명세서

> **버전**: 1.0.0
> **작성일**: 2026-03-03
> **기반 문서**: docs/Upgrade.md §1, docs/HANDOFF.md, docs/WORK_SPEC.md
> **현재 상태**: Phase 5~6 완료 (기반 파이프라인 작동) → 이 명세서는 **Phase 7: 자동화 강화**

---

## 1. 현재 상태 분석 (AS-IS)

### 작동하는 기능
| 기능 | 상태 | 한계 |
|------|------|------|
| GDD/SPEC 텍스트 입력 | ✅ | 사용자가 직접 작성해야 함 |
| Compiler SPEC 파싱 → task 분해 | ✅ | 고정 패턴만 인식 (`## 6. 구현 순서` 등) |
| Worker 프롬프트 카드 UI | ✅ | 프롬프트를 수동으로 복사 → Claude Code에 붙여넣기 |
| Auditor 체크리스트 | ✅ | 수동 체크만 가능, 자동 검증 없음 |
| Live Canvas | ✅ | `/output/slime-survivors/` 하드코딩 |
| 에이전트 상태 모니터링 | ✅ | 시각적 표시만, 실제 작업 연동 없음 |

### 작동하지 않는 기능 (스텁/미구현)
| 기능 | 파일 | 상태 |
|------|------|------|
| AI API 호출 | 없음 | 미구현 |
| Planner 자동 GDD 생성 | `nodes/planner.js` | 자동 complete (Gemini 완료 가정) |
| Architect 자동 SPEC 생성 | `nodes/architect.js` | 자동 complete (Gemini 완료 가정) |
| 팀 모드 (에이전트 라우팅) | `src/agents/*.js` | 스텁만 존재 |
| Worker 자동 코드 생성 | `nodes/worker.js` | 프롬프트 카드 표시만 |
| Auditor 자동 검증 | `nodes/auditor.js` | 수동 체크리스트만 |
| Live Canvas 동적 렌더링 | `LiveCanvasWindow.tsx` | 정적 iframe |

---

## 2. 목표 상태 (TO-BE)

사용자가 **한 줄 게임 아이디어**를 입력하면, 5명의 에이전트가 **자동으로 협력**하여 **플레이 가능한 게임**을 생성한다.

```
[사용자 입력]
"탑다운 뷰 로그라이크, 마법사가 주인공, 3스테이지"

        ↓ (자동)

[Planner]  → GDD 자동 생성 (Claude API)
[Architect] → SPEC 자동 생성 (Claude API)
[Compiler]  → Task 분해 + 프롬프트 생성
[Worker]    → 코드 자동 생성 (Claude API)
[Auditor]   → 자동 검증 + 피드백 루프

        ↓ (자동)

[Live Canvas] → 생성된 게임 즉시 플레이 가능
```

---

## 3. 구현 단계 (7단계)

### Step 7-A: API 통합 레이어
### Step 7-B: Planner 자동화 (GDD 자동 생성)
### Step 7-C: Architect 자동화 (SPEC 자동 생성)
### Step 7-D: Worker 자동화 (코드 자동 생성)
### Step 7-E: Auditor 자동화 (자동 검증 + 피드백 루프)
### Step 7-F: Live Canvas 동적 렌더링
### Step 7-G: 장르 템플릿 시스템

---

## Step 7-A: API 통합 레이어

**목적**: 모든 에이전트가 공유하는 AI API 호출 인프라 구축
**추천 모델**: ⚔️ Sonnet (구현 작업)

### 새 파일

#### `src/services/ai-client.ts`

```typescript
interface AIClientConfig {
  provider: 'anthropic' | 'openai' | 'gemini';
  apiKey: string;
  model: string;
  maxTokens?: number;
}

interface AIRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;   // 기본 0.7
  maxTokens?: number;     // 기본 4096
}

interface AIResponse {
  content: string;
  usage: { inputTokens: number; outputTokens: number };
  model: string;
  latencyMs: number;
}

class AIClient {
  constructor(config: AIClientConfig);

  // 단일 요청
  async complete(request: AIRequest): Promise<AIResponse>;

  // 스트리밍 요청 (진행 상황 표시용)
  async stream(request: AIRequest, onChunk: (text: string) => void): Promise<AIResponse>;

  // 헬스 체크
  async ping(): Promise<boolean>;
}
```

#### `src/services/agent-service.ts`

```typescript
// 각 에이전트 역할별 프롬프트 템플릿 + API 호출 래퍼

interface AgentRole {
  id: string;
  name: string;
  systemPrompt: string;
  model: string;         // 역할별 최적 모델
  temperature: number;   // 역할별 최적 temperature
}

const AGENT_ROLES: Record<string, AgentRole> = {
  planner: {
    id: 'planner',
    name: 'Alex (기획자)',
    systemPrompt: '당신은 게임 기획 전문가입니다...',
    model: 'claude-sonnet-4-6',
    temperature: 0.8,      // 창의성 높게
  },
  architect: {
    id: 'architect',
    name: 'Sam (아키텍트)',
    systemPrompt: '당신은 게임 기술 아키텍트입니다...',
    model: 'claude-sonnet-4-6',
    temperature: 0.3,      // 정확성 높게
  },
  worker: {
    id: 'worker',
    name: 'Casey (워커)',
    systemPrompt: '당신은 게임 개발자입니다...',
    model: 'claude-sonnet-4-6',
    temperature: 0.2,      // 코드 정확성
  },
  auditor: {
    id: 'auditor',
    name: 'Morgan (감시자)',
    systemPrompt: '당신은 QA 엔지니어입니다...',
    model: 'claude-haiku-4-5',
    temperature: 0.1,      // 검증은 일관성
  },
};

class AgentService {
  constructor(aiClient: AIClient);

  // 에이전트 역할로 요청
  async execute(roleId: string, prompt: string): Promise<AIResponse>;

  // 스트리밍 실행 (UI 실시간 업데이트용)
  async executeStream(
    roleId: string,
    prompt: string,
    onChunk: (text: string) => void,
  ): Promise<AIResponse>;
}
```

### 수정 파일

#### `src/context/WindowContext.tsx` 변경

```typescript
// 추가할 상태
interface PipelineState {
  status: 'idle' | 'running' | 'paused' | 'complete' | 'error';
  currentNode: string | null;
  gdd: string;                   // Planner 생성 결과
  spec: string;                  // Architect 생성 결과
  executionPlan: Task[];         // Compiler 생성 결과
  generatedCode: GeneratedFile[]; // Worker 생성 결과
  auditResult: AuditResult;      // Auditor 검증 결과
  loopCount: number;             // 루프백 횟수 (최대 3회)
}

// Context에 추가
pipelineState: PipelineState;
runPipeline: (idea: string) => Promise<void>;
pausePipeline: () => void;
resumePipeline: () => void;
```

#### `.env` 파일 (새로 생성)

```
VITE_AI_PROVIDER=anthropic
VITE_AI_API_KEY=sk-ant-xxx
VITE_AI_MODEL=claude-sonnet-4-6
```

### 완료 기준
- [ ] AIClient가 Claude API에 요청을 보내고 응답을 받을 수 있다
- [ ] 스트리밍 모드에서 청크 단위로 텍스트를 받을 수 있다
- [ ] API 키가 `.env`에서 안전하게 로드된다
- [ ] 에러 핸들링: API 키 누락, 네트워크 오류, 토큰 초과 등
- [ ] AgentService가 역할별 system prompt와 model을 자동 적용한다

### 주의사항
- **CORS 문제**: 브라우저에서 직접 Anthropic API를 호출하면 CORS 에러 발생 가능 → 프록시 서버 필요 시 Step 7-A-2에서 처리
- **API 키 보안**: `.env`는 `.gitignore`에 이미 포함되어 있으나 확인 필요
- **비용 관리**: 각 요청의 토큰 사용량을 추적하고 UI에 표시

---

## Step 7-B: Planner 자동화 (GDD 자동 생성)

**목적**: 한 줄 게임 아이디어 → 완전한 GDD 문서 자동 생성
**추천 모델**: 🏆 Opus (설계 판단)

### 수정 파일

#### `src/components/windows/PlannerWindow.tsx` 변경

현재 상태: 텍스트 입력 / 파일 업로드만 가능
변경 후: **아이디어 입력 → AI 자동 GDD 생성** 모드 추가

```typescript
// 3가지 입력 모드
type InputMode = 'idea' | 'text' | 'file';

// 'idea' 모드 (새로 추가):
// - 한 줄 입력 필드 + "Generate GDD" 버튼
// - 장르 선택 드롭다운 (선택적)
// - 플랫폼 선택 (Desktop / Mobile / Both)
// - 난이도 선택 (Simple / Medium / Complex)
```

#### Planner 시스템 프롬프트 (신규)

```
당신은 게임 기획 전문가 Alex입니다.
사용자의 게임 아이디어를 받아 GDD(Game Design Document)를 생성합니다.

출력 형식은 반드시 다음 마크다운 구조를 따릅니다:
## 1. 개요
- 프로젝트명, 장르, 한 줄 요약

## 2. 아트 스타일
- CSS 기반 렌더링 (이미지 에셋 없음, 이모지+도형)

## 3. 핵심 메카닉
- 이동, 공격, 적 AI, 충돌, 경험치, 레벨업 등

## 4. 타겟 플랫폼
- 데스크탑 브라우저

## 5. 의사결정 로그
- 기술적 선택과 그 이유

제약 조건:
- Canvas 대신 DOM 렌더링 (CSS 애니메이션 활용, 개발 속도 우선)
- 프레임워크 없이 Vanilla JS (의존성 제로, 즉시 실행 가능)
- 60초 이내 세션 (짧은 증명용)
- 복잡도 최소화 (레벨업 최대 3회 등)
```

### 데이터 흐름

```
사용자 입력: "탑다운 뷰 로그라이크, 마법사가 주인공, 3스테이지"
    ↓
PlannerWindow → AgentService.executeStream('planner', prompt)
    ↓
[스트리밍 응답] → PlannerWindow 미리보기에 실시간 타이핑 효과
    ↓
완료 → pipelineState.gdd에 저장
    ↓
Agent Status Panel: Alex 상태 idle → writing → idle
    ↓
Terminal 로그: "🧑‍💼 [Alex] GDD 생성 완료 (1,247자)"
```

### UI 변경사항

```
┌─────────────────────────────────────────────┐
│ 📜 Planner                          [_][X] │
├─────────────────────────────────────────────┤
│ [💡 Idea] [📝 Text] [📁 File]              │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ 게임 아이디어를 입력하세요:              │ │
│ │ [탑다운 뷰 로그라이크, 마법사 주인공    ]│ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ 장르: [▼ 로그라이크   ] 플랫폼: [▼ Desktop] │
│ 복잡도: ○ Simple  ● Medium  ○ Complex      │
│                                             │
│ [🤖 Generate GDD]                           │
│                                             │
│ ┌─ Preview ─────────────────────────────┐   │
│ │ # Game Design Document                │   │
│ │ ## 1. 개요                            │   │
│ │ - 프로젝트명: Wizard Survivors        │   │
│ │ - 장르: 탑다운 로그라이크             │   │
│ │ ... (실시간 타이핑)                   │   │
│ └───────────────────────────────────────┘   │
│                                             │
│ [▶ Accept & Continue to Architect]          │
└─────────────────────────────────────────────┘
```

### 완료 기준
- [ ] 'idea' 모드에서 한 줄 입력 → GDD 마크다운 자동 생성
- [ ] 스트리밍 응답이 Preview 영역에 실시간으로 표시된다
- [ ] 생성된 GDD가 `templates/gdd-template.md` 구조를 따른다
- [ ] Agent Status Panel에서 Alex의 상태가 실시간 변경된다
- [ ] Terminal에 진행 로그가 출력된다
- [ ] "Accept" 버튼 클릭 시 다음 단계(Architect)로 자동 진행
- [ ] 기존 'text'/'file' 모드도 그대로 작동한다

---

## Step 7-C: Architect 자동화 (SPEC 자동 생성)

**목적**: GDD를 기반으로 기술 명세(SPEC) 자동 생성
**추천 모델**: ⚔️ Sonnet (구현 작업)

### 새 파일

#### `src/components/windows/ArchitectWindow.tsx`

현재 Architect 윈도우가 없으므로 신규 생성.

```typescript
// Planner에서 생성된 GDD를 받아 SPEC을 자동 생성

// SPEC 자동 생성 프로세스:
// 1. GDD 내용을 Architect 에이전트에 전달
// 2. 스트리밍 응답으로 SPEC 실시간 생성
// 3. 생성된 SPEC 미리보기
// 4. 사용자 확인 후 다음 단계로 진행
```

#### Architect 시스템 프롬프트 (신규)

```
당신은 게임 기술 아키텍트 Sam입니다.
GDD를 받아 기술 명세서(SPEC)를 생성합니다.

출력 형식은 반드시 다음 마크다운 구조를 따릅니다:

## 1. 시스템 개요
- 기술 스택 정의

## 2. 핵심 데이터 스키마
- 게임 상태, 엔티티 정의

## 3. 핵심 모듈 설계
### 3.1 렌더링 엔진
### 3.2 입력 처리
### 3.3 게임 로직
### 3.4 UI/HUD

## 4. 폴더 구조
- 파일 트리

## 5. 의존성
- 사용할 라이브러리 (가급적 없음)

## 6. 구현 순서
1. 기본 구조 생성
2. 렌더링 엔진
3. ...

## 7. 완료 기준
- [ ] 기준 1
- [ ] 기준 2

제약 조건:
- 단일 HTML + CSS + JS 파일 (빌드 도구 없음)
- 외부 의존성 없음 (Vanilla JS)
- DOM 렌더링 (Canvas 아님)
- 60초 이내 실행 가능한 게임
```

### 수정 파일

#### `src/context/WindowContext.tsx`

```typescript
// windows 초기값에 architect 추가
{ id: 'architect', title: '🧑‍🔧 Architect', zIndex: 8.5, isMinimized: false, isVisible: false },
```

#### `src/App.tsx`

```typescript
// ArchitectWindow 임포트 및 DraggableWindow 추가
<DraggableWindow id="architect" title="🧑‍🔧 Architect">
  <ArchitectWindow />
</DraggableWindow>
```

### 데이터 흐름

```
pipelineState.gdd (Planner 결과)
    ↓
ArchitectWindow → AgentService.executeStream('architect', gdd)
    ↓
[스트리밍 응답] → ArchitectWindow 미리보기에 실시간 표시
    ↓
완료 → pipelineState.spec에 저장
    ↓
Agent Status Panel: Sam 상태 idle → researching → idle
    ↓
Terminal 로그: "🧑‍🔧 [Sam] SPEC 생성 완료 (2,891자)"
    ↓
자동으로 Compiler 단계 트리거
```

### 완료 기준
- [ ] GDD를 입력받아 SPEC 마크다운을 자동 생성한다
- [ ] 생성된 SPEC이 Compiler가 파싱할 수 있는 구조(`## 6. 구현 순서` 등)를 따른다
- [ ] 스트리밍 응답이 실시간으로 표시된다
- [ ] Agent Status Panel에서 Sam 상태가 실시간 변경된다
- [ ] "Accept" 버튼 클릭 시 Compiler로 자동 진행

---

## Step 7-D: Worker 자동화 (코드 자동 생성)

**목적**: Compiler의 execution plan을 받아 실제 게임 코드를 자동 생성
**추천 모델**: ⚔️ Sonnet (코드 구현)

### 현재 → 변경

```
현재: Worker가 프롬프트 카드를 표시 → 사용자가 수동으로 복사 → Claude Code에 붙여넣기
변경: Worker가 각 task의 프롬프트를 AI API에 자동 전달 → 코드 자동 생성
```

### 수정 파일

#### `src/components/windows/LiveCanvasWindow.tsx` 변경 (Step 7-F에서 상세)

#### Worker 실행 로직

```typescript
interface GeneratedFile {
  path: string;        // 예: "index.html"
  content: string;     // 파일 내용
  taskId: number;      // 어떤 task에서 생성됐는지
}

// Worker 실행 프로세스:
// 1. executionPlan.tasks를 순서대로 처리
// 2. 각 task의 prompt를 Worker 에이전트에 전달
// 3. 응답에서 코드 블록 추출 (```html, ```css, ```javascript)
// 4. GeneratedFile 배열에 저장
// 5. 각 task 완료 시 UI 업데이트 (진행률 표시)
// 6. 모든 task 완료 시 Auditor로 전달
```

#### 코드 블록 추출 유틸

```typescript
// src/utils/code-extractor.ts

interface CodeBlock {
  language: string;    // html, css, javascript
  content: string;
  filename?: string;   // 코드 블록 위에 주석으로 명시된 파일명
}

// AI 응답에서 코드 블록을 추출하는 유틸
function extractCodeBlocks(markdown: string): CodeBlock[];

// 코드 블록을 파일로 매핑
function codeBlocksToFiles(blocks: CodeBlock[], projectName: string): GeneratedFile[];
```

### UI 변경사항 (Worker 프롬프트 카드 → 자동 실행 모드)

```
┌─────────────────────────────────────────────┐
│ 🖥️ Terminal                          [_][X] │
├─────────────────────────────────────────────┤
│ [14:32:01] 👨‍🚀 [Casey] Task 1/6 실행 중...  │
│ [14:32:01]   📄 기본 HTML 구조 생성         │
│ [14:32:08]   ✅ index.html 생성 (142줄)     │
│ [14:32:08] 👨‍🚀 [Casey] Task 2/6 실행 중...  │
│ [14:32:08]   📄 렌더링 엔진 구현            │
│ [14:32:15]   ✅ style.css 생성 (87줄)       │
│ [14:32:15]   ✅ renderer.js 생성 (203줄)    │
│ ...                                         │
│                                             │
│ ████████████░░░░░░░░ 60% (Task 4/6)        │
└─────────────────────────────────────────────┘
```

### 완료 기준
- [ ] Compiler 결과의 각 task를 순차적으로 AI API에 전달한다
- [ ] AI 응답에서 코드 블록을 정확히 추출한다
- [ ] 각 task 완료 시 Terminal에 진행 로그가 출력된다
- [ ] 진행률 바가 표시된다
- [ ] 생성된 코드가 pipelineState.generatedCode에 저장된다
- [ ] 에러 발생 시 해당 task를 재시도하거나 스킵할 수 있다

---

## Step 7-E: Auditor 자동화 (자동 검증 + 피드백 루프)

**목적**: 생성된 코드를 자동 검증하고, 문제 발견 시 Worker에게 수정 요청
**추천 모델**: ⚔️ Sonnet (분석 작업)

### Auditor 자동 검증 항목

```typescript
interface AuditResult {
  score: number;           // 0~10 (5.0 미만이면 Pass)
  checks: AuditCheck[];
  summary: string;
  recommendation: 'pass' | 'fix-worker' | 'fix-compiler';
}

interface AuditCheck {
  category: 'structure' | 'logic' | 'style' | 'completeness';
  item: string;
  passed: boolean;
  detail: string;
}
```

#### 자동 검증 규칙

```
1. 구조 검증 (structure):
   - SPEC에 명시된 파일이 모두 생성되었는가
   - HTML에 필수 요소(DOCTYPE, meta, body)가 있는가
   - JS에 문법 오류가 없는가 (try-catch로 eval 테스트)

2. 로직 검증 (logic):
   - GDD의 핵심 메카닉 키워드가 코드에 반영되었는가
     (예: GDD에 "WASD 이동"이 있으면 코드에 keydown 이벤트가 있는가)
   - 게임 루프(requestAnimationFrame 또는 setInterval)가 존재하는가
   - 플레이어/적 엔티티 정의가 있는가

3. 스타일 검증 (style):
   - CSS가 존재하고 비어있지 않은가
   - GDD의 아트 스타일 키워드가 반영되었는가

4. 완전성 검증 (completeness):
   - SPEC의 "완료 기준" 체크박스 항목 대비 충족률
   - 단일 HTML 파일로 실행 가능한가 (외부 의존성 없음)
```

### 피드백 루프

```
Auditor 검증 결과
    ↓
Score >= 5.0 (FAIL)
    ↓
recommendation 분류:
  - 'fix-worker': 코드 품질 이슈 → Worker에게 수정 프롬프트 전달
  - 'fix-compiler': 설계 이슈 → Compiler에게 task 재분해 요청
    ↓
Auditor가 수정 프롬프트 자동 생성:
  "[수정 요청] 다음 문제를 수정해주세요:
   1. keydown 이벤트 핸들러가 없음 → WASD 이동 구현 필요
   2. 게임 루프가 없음 → requestAnimationFrame 추가 필요
   원본 코드: (기존 코드 첨부)
   수정된 전체 코드를 출력해주세요."
    ↓
Worker 재실행 (수정 프롬프트 기반)
    ↓
Auditor 재검증
    ↓
최대 3회 루프 → 3회 초과 시 사용자에게 알림
```

### UI 변경사항

```
Agent Status Panel 변경:
┌────────────────────────────┐
│ 🧑‍⚖️ Morgan (감시자)         │
│ ⚙️ 검증 중                  │
│                            │
│ 자동 검증: ████████░░ 80%  │
│ ✅ 구조 검증 Pass           │
│ ✅ 로직 검증 Pass           │
│ ❌ 완전성 검증 Fail         │
│   → "WASD 이동 미구현"     │
│                            │
│ Debt Score: 3.2/10         │
│ 판정: ✅ PASS               │
└────────────────────────────┘
```

### 완료 기준
- [ ] 4가지 카테고리(구조/로직/스타일/완전성)를 자동 검증한다
- [ ] Debt Score를 자동 산출한다
- [ ] Score >= 5.0일 때 수정 프롬프트를 자동 생성한다
- [ ] Worker에게 수정 요청을 자동 전달하고 재실행한다
- [ ] 최대 3회 루프 후 중단한다
- [ ] 루프 횟수와 각 라운드의 점수 변화를 UI에 표시한다

---

## Step 7-F: Live Canvas 동적 렌더링

**목적**: Worker가 생성한 코드를 즉시 실행하여 브라우저에서 플레이 가능하게 만든다
**추천 모델**: ⚡ Haiku (기계적 UI 작업)

### 현재 → 변경

```
현재: <iframe src="/output/slime-survivors/index.html" /> (하드코딩)
변경: Worker 생성 코드를 Blob URL로 변환 → iframe에 동적 로드
```

### 수정 파일

#### `src/components/windows/LiveCanvasWindow.tsx` 변경

```typescript
// 핵심 로직: 생성된 코드를 실행 가능한 HTML로 조합

function assembleGame(files: GeneratedFile[]): string {
  // 1. HTML 파일 찾기
  const html = files.find(f => f.path.endsWith('.html'));
  const css = files.find(f => f.path.endsWith('.css'));
  const js = files.filter(f => f.path.endsWith('.js'));

  // 2. 단일 HTML로 인라인 조합
  // <style> 태그에 CSS 삽입
  // <script> 태그에 JS 삽입

  // 3. Blob URL 생성
  const blob = new Blob([assembledHtml], { type: 'text/html' });
  return URL.createObjectURL(blob);
}

// 컴포넌트:
// - pipelineState.generatedCode가 변경되면 자동으로 assembleGame 실행
// - iframe src를 Blob URL로 교체
// - 이전 Blob URL은 revokeObjectURL로 해제
// - 에러 발생 시 에러 메시지 표시 (iframe 대신)
```

### UI 변경사항

```
┌─────────────────────────────────────────────┐
│ 🎮 Live Canvas                       [_][X] │
├─────────────────────────────────────────────┤
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │                                       │  │
│  │     [생성된 게임이 여기서 실행됨]      │  │
│  │                                       │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  [🔄 Reload] [📥 Download] [🔗 Open Tab]   │
│                                             │
└─────────────────────────────────────────────┘

버튼 기능:
- Reload: 현재 코드로 iframe 새로고침
- Download: 생성된 게임 파일을 ZIP으로 다운로드
- Open Tab: 새 브라우저 탭에서 게임 열기
```

### 완료 기준
- [ ] Worker가 생성한 코드가 Live Canvas에 즉시 렌더링된다
- [ ] iframe sandbox로 보안 격리된다
- [ ] Reload 버튼이 작동한다
- [ ] Download 버튼으로 게임 파일을 ZIP으로 다운로드할 수 있다
- [ ] 코드에 에러가 있을 때 에러 메시지가 표시된다
- [ ] Auditor 루프 후 수정된 코드로 자동 갱신된다

---

## Step 7-G: 장르 템플릿 시스템

**목적**: 자주 사용되는 게임 장르의 사전 정의 템플릿을 제공하여 GDD/SPEC 품질 향상
**추천 모델**: ⚡ Haiku (반복 작업)

### 새 파일

#### `src/config/genre-templates.ts`

```typescript
interface GenreTemplate {
  id: string;
  name: string;
  nameKo: string;
  icon: string;
  description: string;
  gddHints: string;      // Planner에게 전달할 장르별 힌트
  specHints: string;      // Architect에게 전달할 기술 힌트
  mechanics: string[];    // 기본 메카닉 목록
  example: string;        // 예시 게임 아이디어
}

const GENRE_TEMPLATES: GenreTemplate[] = [
  {
    id: 'survivors',
    name: 'Survivors-like',
    nameKo: '뱀서라이크',
    icon: '🧟',
    description: '자동 공격 + 웨이브 서바이벌',
    mechanics: ['자동 공격', '웨이브 스폰', '경험치/레벨업', '생존 타이머'],
    example: '슬라임이 사방에서 몰려오는 1분 서바이벌',
    gddHints: '자동 공격 주기, 적 스폰 규칙, 레벨업 보상 정의 필수',
    specHints: '엔티티 풀링, 충돌 감지 최적화 고려',
  },
  {
    id: 'platformer',
    name: 'Platformer',
    nameKo: '플랫포머',
    icon: '🏃',
    description: '점프 + 장애물 회피',
    mechanics: ['점프/중력', '장애물', '코인 수집', '스테이지 클리어'],
    example: '3단계 스테이지를 점프로 클리어하는 러너',
    gddHints: '중력 값, 점프 높이, 스테이지 구성 정의 필수',
    specHints: '물리 엔진 단순화 (중력+충돌만), 레벨 데이터 구조',
  },
  {
    id: 'puzzle',
    name: 'Puzzle',
    nameKo: '퍼즐',
    icon: '🧩',
    description: '논리 + 패턴 매칭',
    mechanics: ['그리드 시스템', '매칭 규칙', '스코어링', '제한 시간/턴'],
    example: '같은 색 블록 3개를 맞추는 매치-3 퍼즐',
    gddHints: '그리드 크기, 매칭 규칙, 콤보 시스템 정의',
    specHints: '2D 배열 상태 관리, 애니메이션 큐',
  },
  {
    id: 'shooter',
    name: 'Shooter',
    nameKo: '슈팅',
    icon: '🚀',
    description: '투사체 + 적 파괴',
    mechanics: ['투사체 발사', '적 패턴', '보스', '파워업'],
    example: '우주 전투기로 외계인을 물리치는 종스크롤 슈터',
    gddHints: '투사체 속도, 적 패턴, 보스 HP 정의',
    specHints: '오브젝트 풀링, 충돌 매트릭스',
  },
  {
    id: 'tower-defense',
    name: 'Tower Defense',
    nameKo: '타워 디펜스',
    icon: '🏰',
    description: '타워 배치 + 경로 방어',
    mechanics: ['타워 배치', '적 경로', '웨이브', '자원 관리'],
    example: '3종류 타워로 5웨이브를 방어하는 TD',
    gddHints: '타워 종류/사거리/DPS, 적 HP/속도, 웨이브 구성',
    specHints: '경로 탐색(하드코딩), 타워-적 거리 계산',
  },
];
```

### UI 변경사항 (PlannerWindow에 장르 선택 추가)

```
┌─────────────────────────────────────────────┐
│ 📜 Planner                          [_][X] │
├─────────────────────────────────────────────┤
│ [💡 Idea] [📝 Text] [📁 File]              │
│                                             │
│ 장르 선택 (선택적):                          │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │
│ │ 🧟  │ │ 🏃  │ │ 🧩  │ │ 🚀  │ │ 🏰  │   │
│ │뱀서 │ │플랫 │ │퍼즐 │ │슈팅 │ │TD   │   │
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘   │
│                                             │
│ 💡 선택된 장르의 기본 메카닉:                │
│ • 자동 공격  • 웨이브 스폰                   │
│ • 경험치/레벨업  • 생존 타이머               │
│                                             │
│ 아이디어:                                    │
│ [마법사가 스켈레톤 웨이브에서 생존           ]│
│                                             │
│ [🤖 Generate GDD]                           │
└─────────────────────────────────────────────┘
```

### 완료 기준
- [ ] 5개 이상의 장르 템플릿이 정의되어 있다
- [ ] PlannerWindow에서 장르를 선택하면 관련 메카닉이 표시된다
- [ ] 선택된 장르의 hints가 Planner/Architect 프롬프트에 자동 포함된다
- [ ] 장르 미선택 시에도 자유 입력이 가능하다
- [ ] 장르 선택이 GDD/SPEC 품질(구조 준수율)을 향상시킨다

---

## 4. 전체 파이프라인 흐름도 (TO-BE)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  [사용자] 게임 아이디어 입력 + 장르 선택 (선택적)            │
│           "마법사 로그라이크, 3스테이지"                      │
│                                                             │
│      ↓ Step 7-B                                             │
│                                                             │
│  [Planner/Alex] ──AI API──→ GDD 자동 생성                   │
│      │  스트리밍 → PlannerWindow 실시간 표시                 │
│      │  Agent Status: idle → writing → idle                 │
│      ↓ (사용자 Accept 클릭)                                  │
│                                                             │
│  [Architect/Sam] ──AI API──→ SPEC 자동 생성                  │
│      │  스트리밍 → ArchitectWindow 실시간 표시               │
│      │  Agent Status: idle → researching → idle             │
│      ↓ (사용자 Accept 클릭)                                  │
│                                                             │
│  [Compiler/Jordan] ──로컬──→ SPEC 파싱 → Task 분해           │
│      │  기존 파싱 로직 활용 (AI 호출 불필요)                 │
│      ↓                                                      │
│                                                             │
│  [Worker/Casey] ──AI API──→ 코드 자동 생성                   │
│      │  Task별 순차 실행                                    │
│      │  Agent Status: idle → writing → idle                 │
│      ↓                                                      │
│                                                             │
│  [Auditor/Morgan] ──로컬+AI──→ 자동 검증                     │
│      │  구조/로직/스타일/완전성 체크                         │
│      │                                                      │
│      ├── Score < 5.0 → ✅ PASS                              │
│      │       ↓                                              │
│      │   [Live Canvas] Blob URL → 게임 실행                 │
│      │                                                      │
│      └── Score >= 5.0 → ❌ FAIL (최대 3회 루프)             │
│              ↓                                              │
│          수정 프롬프트 생성 → Worker 재실행                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. 구현 우선순위 및 의존성

```
Step 7-A (API 레이어)
    ↓
Step 7-B (Planner) ←── Step 7-G (장르 템플릿, 병렬 가능)
    ↓
Step 7-C (Architect)
    ↓
Step 7-D (Worker) ←── Step 7-F (Live Canvas, 병렬 가능)
    ↓
Step 7-E (Auditor + 피드백 루프)
```

| Step | 의존성 | 추천 모델 | 예상 복잡도 |
|------|--------|----------|------------|
| 7-A | 없음 | ⚔️ Sonnet | MID |
| 7-B | 7-A | 🏆 Opus | MID |
| 7-C | 7-A, 7-B | ⚔️ Sonnet | MID |
| 7-D | 7-A, 7-C | ⚔️ Sonnet | HIGH |
| 7-E | 7-D | ⚔️ Sonnet | HIGH |
| 7-F | 7-D | ⚡ Haiku | LOW |
| 7-G | 없음 | ⚡ Haiku | LOW |

---

## 6. 기술적 주의사항

### CORS 프록시 문제
브라우저에서 Anthropic API를 직접 호출하면 CORS 에러가 발생한다.

**해결 방안 (택 1):**

| 방안 | 설명 | 복잡도 |
|------|------|--------|
| A. Vite 프록시 | `vite.config.ts`에 `/api` 프록시 설정 → 개발 환경에서만 작동 | LOW |
| B. Edge Function | Vercel/Netlify Edge Function으로 프록시 | MID |
| C. 로컬 Express 서버 | `server.ts` 파일 추가, `npm run server` | MID |

**추천: 방안 A (개발 단계)** → 프로덕션 배포 시 방안 B로 전환

```typescript
// vite.config.ts 추가
server: {
  proxy: {
    '/api/anthropic': {
      target: 'https://api.anthropic.com',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
    },
  },
},
```

### iframe 보안
생성된 코드를 iframe에서 실행할 때 보안 격리 필요.

```html
<iframe
  sandbox="allow-scripts"
  src={blobUrl}
/>
```
- `allow-scripts`: JS 실행 허용
- `allow-same-origin` 제거: 부모 페이지 접근 차단
- CSP 헤더 불필요 (Blob URL은 동일 출처)

### 비용 관리
전체 파이프라인 1회 실행 시 예상 토큰:

| 단계 | 입력 토큰 | 출력 토큰 | 모델 |
|------|----------|----------|------|
| Planner | ~500 | ~1,500 | Sonnet |
| Architect | ~2,000 | ~3,000 | Sonnet |
| Worker (task당) | ~3,000 | ~4,000 | Sonnet |
| Worker (6 tasks) | ~18,000 | ~24,000 | Sonnet |
| Auditor | ~5,000 | ~1,000 | Haiku |
| **합계** | **~25,500** | **~29,500** | |

---

## 7. 테스트 시나리오

### 시나리오 1: 뱀서라이크 (기존 GDD 재현)
```
입력: "슬라임 서바이벌, WASD 이동, 자동 공격, 60초 생존"
장르: Survivors-like
기대: 현재 output/slime-survivors/와 유사한 게임 자동 생성
검증: Live Canvas에서 플레이 가능, WASD 이동 작동
```

### 시나리오 2: 플랫포머
```
입력: "3단계 점프 게임, 코인 수집, 적 회피"
장르: Platformer
기대: 좌우 이동 + 점프, 3개 스테이지, 코인 카운터
검증: 방향키로 이동/점프, 코인 수집 시 점수 증가
```

### 시나리오 3: 자유 입력 (장르 미선택)
```
입력: "두 명이 번갈아 돌을 놓는 오목 게임"
장르: 미선택
기대: 15x15 그리드, 턴제 돌 놓기, 5목 승리 판정
검증: 클릭으로 돌 배치, 승리 판정 정확
```

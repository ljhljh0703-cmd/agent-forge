# SPEC-03: 멀티-에이전트 협력 시스템 시뮬레이션 명세서

> **버전**: 1.0.0
> **작성일**: 2026-03-03
> **기반 문서**: docs/Upgrade.md §3, docs/SPEC-01, docs/SPEC-02
> **선행 조건**: SPEC-01 Step 7-A (API 통합 레이어) 완료 필수

---

## 1. 현재 상태 분석 (AS-IS)

### 에이전트 모니터링 현황
| 요소 | 현재 상태 | 한계 |
|------|----------|------|
| Agent Status Panel | 5명 상태 표시 (idle/writing 등) | 실제 작업과 무관한 정적 표시 |
| Terminal 로그 | 시간순 텍스트 로그 | 에이전트 간 메시지 흐름 불가시 |
| WindowContext.agents | AgentData 배열 관리 | 토큰/비용/응답시간 미추적 |
| 팀 모드 (agents/) | 스텁만 존재 | 실제 라우팅/에스컬레이션 미구현 |
| 실험 기능 | 없음 | 비교 실험 불가 |

### 재활용 가능한 요소
| 요소 | 재활용성 |
|------|---------|
| AgentStatusPanel UI 프레임 | ✅ 확장하여 메트릭 추가 |
| TerminalWindow | ✅ 필터링 기능 추가 |
| employees.ts 구조 | ✅ 모델 설정 동적 변경 |
| WindowContext 상태 관리 | ✅ 메트릭 필드 확장 |
| DraggableWindow | ✅ 새 윈도우 추가 가능 |

---

## 2. 목표 상태 (TO-BE)

Agent Forge OS를 **멀티-에이전트 연구/교육 플랫폼**으로 확장하여, 서로 다른 LLM 조합의 협력 패턴을 **시각적으로 실험하고 비교**할 수 있게 한다.

```
┌──────────────────────────────────────────────────────────┐
│                  Agent Forge OS - Lab Mode                │
│                                                          │
│  ┌─── 실험 설정 ──┐  ┌──── 실시간 모니터링 ────────────┐ │
│  │ 실험 A: 전원 Sonnet│  │  에이전트 간 메시지 흐름 시각화 │ │
│  │ 실험 B: 혼합 모델 │  │  토큰 사용량 실시간 그래프      │ │
│  │ [▶ Start]      │  │  응답 시간 히트맵               │ │
│  └────────────────┘  └────────────────────────────────┘ │
│                                                          │
│  ┌──── 비교 대시보드 ──────────────────────────────────┐ │
│  │ 실험 A vs 실험 B                                    │ │
│  │ 품질: ████████ 85% vs ██████░░ 72%                 │ │
│  │ 비용: $0.12 vs $0.08                               │ │
│  │ 시간: 45s vs 32s                                    │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

## 3. 구현 단계 (7단계)

### Step 9-A: 에이전트 메트릭 수집 인프라
### Step 9-B: 메시지 패싱 시각화
### Step 9-C: 실험 설정 시스템
### Step 9-D: 실시간 대시보드
### Step 9-E: 비교 분석 엔진
### Step 9-F: 협력 패턴 시뮬레이터
### Step 9-G: 실험 리포트 생성

---

## Step 9-A: 에이전트 메트릭 수집 인프라

**목적**: 모든 에이전트의 API 호출에서 성능/비용 메트릭을 자동 수집
**추천 모델**: ⚔️ Sonnet

### 새 파일

#### `src/services/metrics-collector.ts`

```typescript
// ──── 메트릭 데이터 구조 ────

interface AgentMetric {
  id: string;                    // 고유 ID
  experimentId: string;          // 소속 실험
  agentId: string;               // planner / architect / compiler / worker / auditor
  timestamp: number;             // 타임스탬프
  type: 'api-call' | 'message-pass' | 'state-change' | 'error';

  // API 호출 메트릭
  apiCall?: {
    model: string;               // 사용된 모델
    provider: string;            // anthropic / openai / gemini
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    cost: number;                // USD 환산 비용
    success: boolean;
    errorMessage?: string;
  };

  // 메시지 패싱 메트릭
  messagePass?: {
    from: string;                // 발신 에이전트
    to: string;                  // 수신 에이전트
    contentType: string;         // 'gdd' | 'spec' | 'task' | 'code' | 'feedback'
    contentSize: number;         // 바이트
  };

  // 상태 변경 메트릭
  stateChange?: {
    from: string;                // 이전 상태
    to: string;                  // 새 상태
    trigger: string;             // 변경 원인
  };
}

// ──── 메트릭 수집기 ────

class MetricsCollector {
  private metrics: AgentMetric[] = [];
  private listeners: Map<string, ((metric: AgentMetric) => void)[]> = new Map();

  // 메트릭 기록
  record(metric: Omit<AgentMetric, 'id' | 'timestamp'>): void;

  // 실시간 구독
  subscribe(eventType: AgentMetric['type'], callback: (metric: AgentMetric) => void): () => void;

  // 집계 쿼리
  getByExperiment(experimentId: string): AgentMetric[];
  getByAgent(agentId: string): AgentMetric[];
  getByTimeRange(start: number, end: number): AgentMetric[];

  // 통계 계산
  getSummary(experimentId: string): ExperimentSummary;

  // 내보내기
  exportJSON(): string;
  exportCSV(): string;

  // 초기화
  clear(): void;
}

// ──── 통계 요약 ────

interface ExperimentSummary {
  experimentId: string;
  totalApiCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;              // USD
  totalLatencyMs: number;
  averageLatencyMs: number;
  errorCount: number;
  errorRate: number;              // 0~1

  // 에이전트별 분류
  byAgent: Record<string, {
    apiCalls: number;
    tokens: number;
    cost: number;
    avgLatencyMs: number;
    errorRate: number;
  }>;

  // 모델별 분류
  byModel: Record<string, {
    apiCalls: number;
    tokens: number;
    cost: number;
    avgLatencyMs: number;
  }>;

  // 시간 축 데이터 (차트용)
  timeline: {
    timestamp: number;
    cumulativeCost: number;
    cumulativeTokens: number;
    activeAgents: number;
  }[];
}
```

#### `src/services/cost-calculator.ts`

```typescript
// 모델별 토큰 단가 (USD per 1M tokens, 2026-03 기준)

interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

const PRICING: Record<string, ModelPricing> = {
  'claude-opus-4-6':      { inputPer1M: 15.00, outputPer1M: 75.00 },
  'claude-sonnet-4-6':    { inputPer1M: 3.00,  outputPer1M: 15.00 },
  'claude-haiku-4-5':     { inputPer1M: 0.80,  outputPer1M: 4.00  },
  'gpt-4o':               { inputPer1M: 2.50,  outputPer1M: 10.00 },
  'gpt-4o-mini':          { inputPer1M: 0.15,  outputPer1M: 0.60  },
  'gemini-2.0-flash':     { inputPer1M: 0.10,  outputPer1M: 0.40  },
  'gemini-2.0-pro':       { inputPer1M: 1.25,  outputPer1M: 5.00  },
};

function calculateCost(model: string, inputTokens: number, outputTokens: number): number;
```

### 수정 파일

#### `src/services/ai-client.ts` 변경 (SPEC-01에서 생성)

```typescript
// AIClient.complete() / stream()에 메트릭 수집 훅 추가

class AIClient {
  constructor(config: AIClientConfig, metricsCollector?: MetricsCollector);

  async complete(request: AIRequest): Promise<AIResponse> {
    const start = Date.now();
    try {
      const response = await this._callAPI(request);
      // 메트릭 자동 기록
      this.metricsCollector?.record({
        experimentId: this.currentExperimentId,
        agentId: this.currentAgentId,
        type: 'api-call',
        apiCall: {
          model: this.config.model,
          provider: this.config.provider,
          inputTokens: response.usage.inputTokens,
          outputTokens: response.usage.outputTokens,
          latencyMs: Date.now() - start,
          cost: calculateCost(this.config.model, response.usage.inputTokens, response.usage.outputTokens),
          success: true,
        },
      });
      return response;
    } catch (error) {
      // 에러 메트릭 기록
      this.metricsCollector?.record({ /* ... error metric ... */ });
      throw error;
    }
  }
}
```

#### `src/context/WindowContext.tsx` 변경

```typescript
// AgentData 확장
interface AgentData {
  agentId: string;
  status: AgentStatus;
  currentTask: string;
  yesterdayMemo: string;
  lastUpdated: number;

  // 신규 메트릭 필드
  totalApiCalls: number;
  totalTokens: number;
  totalCost: number;
  avgLatencyMs: number;
  errorCount: number;
  currentModel: string;         // 현재 사용 중인 모델
}
```

### 완료 기준
- [ ] 모든 AI API 호출에서 메트릭(토큰/비용/응답시간)이 자동 수집된다
- [ ] 메시지 패싱 이벤트가 기록된다
- [ ] 에이전트 상태 변경 이벤트가 기록된다
- [ ] ExperimentSummary로 실험별 통계를 조회할 수 있다
- [ ] 모델별 비용이 정확히 계산된다
- [ ] JSON/CSV 내보내기가 가능하다

---

## Step 9-B: 메시지 패싱 시각화

**목적**: 에이전트 간 데이터 전달 흐름을 시각적으로 표시
**추천 모델**: ⚔️ Sonnet

### 새 파일

#### `src/components/windows/MessageFlowWindow.tsx`

```typescript
// 에이전트 간 메시지 흐름을 방향 그래프로 시각화

// 시각화 요소:
// 1. 5개 에이전트 노드 (원형, 위치 고정)
// 2. 에이전트 간 화살표 (메시지 전달 방향)
// 3. 화살표 위에 데이터 유형 라벨 (GDD / SPEC / Task / Code / Feedback)
// 4. 애니메이션: 메시지 전달 시 화살표 위를 점이 이동
// 5. 루프백 시 빨간 화살표 표시
```

### UI 설계

```
┌─────────────────────────────────────────────────┐
│ 🔀 Message Flow                          [_][X] │
├─────────────────────────────────────────────────┤
│                                                 │
│          ┌──────────┐                           │
│          │ 🧑‍💼 Alex  │                           │
│          │ Planner  │                           │
│          └────┬─────┘                           │
│               │ GDD (1,247자)                   │
│               ▼                                 │
│          ┌──────────┐                           │
│          │ 🧑‍🔧 Sam   │                           │
│          │ Architect│                           │
│          └────┬─────┘                           │
│               │ SPEC (2,891자)                  │
│               ▼                                 │
│          ┌──────────┐                           │
│          │ 🧑‍💻 Jordan│                           │
│          │ Compiler │                           │
│          └────┬─────┘                           │
│               │ Tasks (6개)                     │
│               ▼                                 │
│          ┌──────────┐                           │
│          │ 👨‍🚀 Casey │                           │
│          │ Worker   │                           │
│          └────┬─────┘                           │
│               │ Code (12파일)                   │
│               ▼                                 │
│          ┌──────────┐                           │
│          │ 🧑‍⚖️ Morgan│◄──── Feedback (loop 1)   │
│          │ Auditor  │────▶ Worker               │
│          └──────────┘                           │
│                                                 │
│  전달된 메시지: 8건 | 총 데이터: 12.4KB         │
└─────────────────────────────────────────────────┘
```

### 렌더링 방식

```typescript
// SVG 기반 렌더링 (Canvas 아님)

interface MessageFlowNode {
  id: string;
  label: string;
  emoji: string;
  x: number;
  y: number;
  status: 'idle' | 'active' | 'complete';
}

interface MessageFlowEdge {
  from: string;
  to: string;
  label: string;           // 데이터 유형
  dataSize: string;        // "1,247자" 등
  timestamp: number;
  isLoopback: boolean;     // 루프백이면 빨간색
  animationState: 'waiting' | 'transferring' | 'complete';
}

// 렌더링:
// 1. 노드: <circle> + <text>
// 2. 엣지: <path> + <marker> (화살표) + <text> (라벨)
// 3. 애니메이션: <animateMotion> 으로 점이 화살표를 따라 이동
// 4. 루프백: 곡선 화살표 + 빨간색 스트로크
```

### 완료 기준
- [ ] 5개 에이전트 노드가 SVG로 표시된다
- [ ] 메시지 전달 시 화살표와 라벨이 표시된다
- [ ] 전달 중 애니메이션이 재생된다
- [ ] 루프백 시 빨간 화살표가 표시된다
- [ ] 전달된 메시지 수와 총 데이터 크기가 표시된다
- [ ] 실시간으로 업데이트된다 (MetricsCollector 구독)

---

## Step 9-C: 실험 설정 시스템

**목적**: 서로 다른 LLM 조합/설정으로 파이프라인을 실행하는 실험 정의
**추천 모델**: ⚔️ Sonnet

### 새 파일

#### `src/config/experiments.ts`

```typescript
interface ExperimentConfig {
  id: string;
  name: string;
  description: string;

  // 에이전트별 모델 배정
  agentModels: {
    planner: ModelConfig;
    architect: ModelConfig;
    compiler: ModelConfig;     // 로컬 처리이므로 model은 'local'
    worker: ModelConfig;
    auditor: ModelConfig;
  };

  // 협력 패턴
  cooperationPattern: 'sequential' | 'parallel' | 'debate';

  // 입력 데이터 (동일 입력으로 비교하기 위해)
  input: {
    idea: string;
    domain: DomainMode;
    template?: string;
  };

  // 실행 옵션
  options: {
    maxLoops: number;          // 최대 루프백 횟수
    timeout: number;           // 전체 타임아웃 (ms)
    collectIntermediates: boolean;  // 중간 결과물 보관 여부
  };
}

interface ModelConfig {
  provider: 'anthropic' | 'openai' | 'gemini';
  model: string;
  temperature: number;
}
```

#### `src/components/windows/ExperimentWindow.tsx`

```typescript
// 실험 설정 + 실행 UI

// 화면 구성:
// 1. 실험 이름 입력
// 2. 에이전트별 모델 드롭다운
// 3. 협력 패턴 선택 (Sequential / Parallel / Debate)
// 4. 입력 아이디어 입력
// 5. [▶ Run Experiment] 버튼
// 6. 실험 이력 목록
```

### UI 설계

```
┌─────────────────────────────────────────────────┐
│ 🧪 Experiment Lab                        [_][X] │
├─────────────────────────────────────────────────┤
│                                                 │
│ 실험명: [실험 A: 전원 Sonnet                  ] │
│                                                 │
│ ── 에이전트 모델 배정 ──                        │
│ 🧑‍💼 Planner:  [▼ claude-sonnet-4-6      ]       │
│ 🧑‍🔧 Architect: [▼ claude-sonnet-4-6      ]      │
│ 🧑‍💻 Compiler:  [  로컬 처리 (변경 불가)   ]     │
│ 👨‍🚀 Worker:    [▼ claude-sonnet-4-6      ]       │
│ 🧑‍⚖️ Auditor:   [▼ claude-haiku-4-5      ]       │
│                                                 │
│ ── 협력 패턴 ──                                 │
│ ● Sequential (순차: P→A→C→W→Au)                │
│ ○ Parallel   (병렬: P+A 동시 → C→W+Au)         │
│ ○ Debate     (토론: W+Au가 3라운드 토론)        │
│                                                 │
│ ── 입력 ──                                      │
│ 도메인: [▼ Game Dev]                            │
│ 아이디어: [슬라임 서바이벌 게임               ] │
│                                                 │
│ [▶ Run Experiment]  [📋 Presets]                │
│                                                 │
│ ── 실험 이력 ──                                  │
│ │ #1 전원 Sonnet    │ ✅ 완료 │ $0.12 │ 45s │  │
│ │ #2 혼합 모델      │ 🔄 진행 │ $0.04 │ 18s │  │
│ │ #3 전원 Haiku     │ ⏳ 대기 │       │     │  │
└─────────────────────────────────────────────────┘
```

### 프리셋 실험 구성

```typescript
const EXPERIMENT_PRESETS: ExperimentConfig[] = [
  {
    id: 'preset-all-sonnet',
    name: '전원 Sonnet',
    description: '모든 에이전트에 Claude Sonnet 4.6 배치 (균형형)',
    agentModels: {
      planner:   { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.7 },
      architect: { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.3 },
      compiler:  { provider: 'local', model: 'local', temperature: 0 },
      worker:    { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.2 },
      auditor:   { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.1 },
    },
    cooperationPattern: 'sequential',
    // ...
  },
  {
    id: 'preset-cost-optimized',
    name: '비용 최적화',
    description: '리더만 Sonnet, 나머지 Haiku (저비용)',
    agentModels: {
      planner:   { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.7 },
      architect: { provider: 'anthropic', model: 'claude-haiku-4-5', temperature: 0.3 },
      compiler:  { provider: 'local', model: 'local', temperature: 0 },
      worker:    { provider: 'anthropic', model: 'claude-haiku-4-5', temperature: 0.2 },
      auditor:   { provider: 'anthropic', model: 'claude-haiku-4-5', temperature: 0.1 },
    },
    cooperationPattern: 'sequential',
    // ...
  },
  {
    id: 'preset-quality-first',
    name: '품질 우선',
    description: 'Planner+Worker에 Opus, 나머지 Sonnet (고품질)',
    agentModels: {
      planner:   { provider: 'anthropic', model: 'claude-opus-4-6', temperature: 0.8 },
      architect: { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.3 },
      compiler:  { provider: 'local', model: 'local', temperature: 0 },
      worker:    { provider: 'anthropic', model: 'claude-opus-4-6', temperature: 0.2 },
      auditor:   { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.1 },
    },
    cooperationPattern: 'sequential',
    // ...
  },
  {
    id: 'preset-multi-provider',
    name: '멀티 프로바이더',
    description: 'Claude + GPT + Gemini 혼합 (다양성)',
    agentModels: {
      planner:   { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.7 },
      architect: { provider: 'openai', model: 'gpt-4o', temperature: 0.3 },
      compiler:  { provider: 'local', model: 'local', temperature: 0 },
      worker:    { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.2 },
      auditor:   { provider: 'gemini', model: 'gemini-2.0-flash', temperature: 0.1 },
    },
    cooperationPattern: 'sequential',
    // ...
  },
  {
    id: 'preset-debate',
    name: '토론형',
    description: 'Worker와 Auditor가 3라운드 토론 후 결론',
    agentModels: {
      planner:   { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.7 },
      architect: { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.3 },
      compiler:  { provider: 'local', model: 'local', temperature: 0 },
      worker:    { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.3 },
      auditor:   { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.3 },
    },
    cooperationPattern: 'debate',
    // ...
  },
];
```

### 완료 기준
- [ ] ExperimentWindow에서 에이전트별 모델을 선택할 수 있다
- [ ] 협력 패턴(Sequential/Parallel/Debate)을 선택할 수 있다
- [ ] 5개 프리셋이 제공된다
- [ ] 실험 실행 시 선택된 설정으로 파이프라인이 작동한다
- [ ] 실험 이력이 목록으로 표시된다
- [ ] 동일 입력으로 여러 실험을 실행할 수 있다

---

## Step 9-D: 실시간 대시보드

**목적**: 실험 진행 중 메트릭을 실시간으로 시각화
**추천 모델**: ⚔️ Sonnet

### 새 파일

#### `src/components/windows/DashboardWindow.tsx`

```typescript
// 실시간 메트릭 대시보드

// 구성 요소:
// 1. 토큰 사용량 실시간 바 차트 (에이전트별)
// 2. 비용 누적 라인 차트 (시간 축)
// 3. 응답 시간 히트맵 (에이전트 × 호출 순서)
// 4. 에이전트 활동 타임라인 (간트 차트 형태)
// 5. 에러율 게이지
```

### UI 설계

```
┌─────────────────────────────────────────────────────────────┐
│ 📊 Dashboard - 실험 A: 전원 Sonnet                   [_][X] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ── 토큰 사용량 (에이전트별) ──                               │
│ Planner  ████████░░░░░░░░  8,241 tokens ($0.03)            │
│ Architect ████████████░░░░ 12,891 tokens ($0.05)            │
│ Worker   ████████████████ 24,102 tokens ($0.08)             │
│ Auditor  ████░░░░░░░░░░░░  4,523 tokens ($0.01)            │
│                                                             │
│ ── 비용 누적 (시간 축) ──                                    │
│ $0.20 │                                          ╱──        │
│ $0.15 │                                   ╱─────╱           │
│ $0.10 │                            ╱─────╱                  │
│ $0.05 │              ╱────────────╱                          │
│ $0.00 │─────────────╱                                        │
│       └──────┬──────┬──────┬──────┬──────┬──────            │
│         Planner  Arch   Compile  Worker  Audit               │
│                                                             │
│ ── 응답 시간 (ms) ──                                         │
│ Planner   [2,341] [    ] [    ] [    ]                      │
│ Architect [    ] [3,102] [    ] [    ]                       │
│ Worker    [    ] [    ] [1,823] [2,105] [1,945] [2,301]     │
│ Auditor   [    ] [    ] [    ] [    ] [    ] [1,102]        │
│           호출1   호출2   호출3   호출4   호출5   호출6       │
│                                                             │
│ ── 활동 타임라인 ──                                          │
│ 0s    10s    20s    30s    40s    50s                        │
│ Planner  ████░░░░░░░░░░░░░░░░░░░░░░░░░░                    │
│ Architect ░░░░████░░░░░░░░░░░░░░░░░░░░░                     │
│ Compiler  ░░░░░░░░██░░░░░░░░░░░░░░░░░░░                    │
│ Worker    ░░░░░░░░░░████████████░░░░░░░                     │
│ Auditor   ░░░░░░░░░░░░░░░░░░░░░░████░░                     │
│                                                             │
│ 총 비용: $0.17 | 총 시간: 47s | 에러율: 0%                  │
└─────────────────────────────────────────────────────────────┘
```

### 차트 렌더링 방식

```typescript
// 외부 라이브러리 사용하지 않고 순수 SVG + CSS로 구현
// 이유: 의존성 최소화, 프로젝트 테마 일관성

// 바 차트: <rect> 요소 + width transition
// 라인 차트: <polyline> 또는 <path>
// 히트맵: <rect> 요소 + 색상 매핑 (밝은 초록 → 빨간색)
// 타임라인: <rect> 요소 + 수평 배치

// MetricsCollector.subscribe()로 실시간 업데이트
// requestAnimationFrame 기반 렌더링 (60fps)
```

### 완료 기준
- [ ] 토큰 사용량 바 차트가 에이전트별로 실시간 업데이트된다
- [ ] 비용 누적 라인 차트가 시간 축으로 표시된다
- [ ] 응답 시간 히트맵이 호출별로 색상 구분된다
- [ ] 활동 타임라인이 간트 차트 형태로 표시된다
- [ ] 총 비용/시간/에러율 요약이 표시된다
- [ ] 순수 SVG/CSS로 구현되어 외부 차트 라이브러리 의존 없음

---

## Step 9-E: 비교 분석 엔진

**목적**: 2개 이상의 실험 결과를 나란히 비교하여 최적 조합을 판별
**추천 모델**: ⚔️ Sonnet

### 새 파일

#### `src/services/comparison-engine.ts`

```typescript
interface ComparisonResult {
  experiments: string[];     // 비교 대상 실험 ID 목록

  // 카테고리별 비교
  quality: {
    metric: 'auditScore';
    values: Record<string, number>;     // experimentId → score
    winner: string;                      // 최고 점수 실험
  };

  cost: {
    metric: 'totalCostUSD';
    values: Record<string, number>;
    winner: string;                      // 최저 비용 실험
  };

  speed: {
    metric: 'totalLatencyMs';
    values: Record<string, number>;
    winner: string;                      // 최단 시간 실험
  };

  efficiency: {
    metric: 'qualityPerDollar';          // audit score / cost
    values: Record<string, number>;
    winner: string;                      // 최고 효율 실험
  };

  // 종합 추천
  recommendation: {
    bestOverall: string;
    bestQuality: string;
    bestCost: string;
    bestSpeed: string;
    reasoning: string;
  };
}

class ComparisonEngine {
  compare(experimentIds: string[], metricsCollector: MetricsCollector): ComparisonResult;
}
```

#### `src/components/windows/ComparisonWindow.tsx`

### UI 설계

```
┌─────────────────────────────────────────────────────────────┐
│ ⚖️ Comparison - 실험 A vs 실험 B vs 실험 C           [_][X] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ── 품질 (Audit Score) ──                                    │
│ 실험 A (전원 Sonnet)  ████████████████ 8.5/10  🏆          │
│ 실험 B (비용 최적화)   ██████████████░░ 7.2/10              │
│ 실험 C (품질 우선)    █████████████████ 9.1/10  🏆          │
│                                                             │
│ ── 비용 (USD) ──                                            │
│ 실험 A  $0.17  ██████████████░░░                            │
│ 실험 B  $0.06  █████░░░░░░░░░░░  🏆 (-65%)                 │
│ 실험 C  $0.34  █████████████████████████████                │
│                                                             │
│ ── 속도 (초) ──                                              │
│ 실험 A  47s  ████████████████░                              │
│ 실험 B  32s  ███████████░░░░░  🏆 (-32%)                   │
│ 실험 C  68s  ██████████████████████                         │
│                                                             │
│ ── 효율성 (품질/비용) ──                                     │
│ 실험 A  50.0  ████████████████                              │
│ 실험 B  120.0 █████████████████████████████████████ 🏆      │
│ 실험 C  26.8  █████████░░░░░░░                              │
│                                                             │
│ ┌─ 종합 추천 ─────────────────────────────────────────────┐ │
│ │ 🏆 전체 최적: 실험 A (전원 Sonnet) — 품질/비용 균형     │ │
│ │ 💎 품질 최고: 실험 C (품질 우선) — Opus 조합             │ │
│ │ 💰 비용 최저: 실험 B (비용 최적화) — Haiku 활용          │ │
│ │ ⚡ 속도 최고: 실험 B (비용 최적화) — 경량 모델 빠른 응답  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [📥 Export Report]  [📊 Export CSV]                         │
└─────────────────────────────────────────────────────────────┘
```

### 완료 기준
- [ ] 2~5개 실험을 동시에 비교할 수 있다
- [ ] 품질/비용/속도/효율성 4개 축으로 비교 차트가 표시된다
- [ ] 각 축의 우승자가 표시된다
- [ ] 종합 추천이 자동 생성된다
- [ ] Report(마크다운) / CSV 내보내기가 가능하다

---

## Step 9-F: 협력 패턴 시뮬레이터

**목적**: Sequential 외에 Parallel, Debate 패턴을 구현하여 비교 실험 가능
**추천 모델**: 🏆 Opus

### 협력 패턴 정의

#### 1. Sequential (순차) — 기존

```
Planner → Architect → Compiler → Worker → Auditor
         (한 에이전트 완료 후 다음 시작)
```

#### 2. Parallel (병렬)

```
Planner ──┐
           ├──→ Compiler → Worker ──┐
Architect ─┘                        ├──→ 결과 병합
                           Auditor ─┘

- Planner + Architect 동시 실행
- Compiler가 두 결과를 합침
- Worker + Auditor 부분 병렬화 (Worker 중간 결과를 Auditor가 점진 검증)
```

#### 3. Debate (토론)

```
Planner → Architect → Compiler →
    ┌─────────────────────────┐
    │ Round 1: Worker 코드 생성  │
    │ Round 1: Auditor 리뷰     │
    │ Round 2: Worker 반론/수정  │
    │ Round 2: Auditor 재리뷰   │
    │ Round 3: Worker 최종 수정  │
    │ Round 3: Auditor 최종 판정 │
    └─────────────────────────┘
    → 최종 결과

- Worker와 Auditor가 대화형으로 3라운드 토론
- 각 라운드에서 Auditor의 피드백을 Worker에 전달
- 기존 루프백과 다른 점: 전체 재생성이 아닌 점진적 개선
```

### 새 파일

#### `src/services/cooperation-patterns.ts`

```typescript
interface CooperationPattern {
  id: 'sequential' | 'parallel' | 'debate';
  name: string;
  description: string;

  // 실행 로직
  execute(
    agents: Record<string, AgentService>,
    input: string,
    metricsCollector: MetricsCollector,
    onProgress: (update: ProgressUpdate) => void,
  ): Promise<PipelineResult>;
}

interface ProgressUpdate {
  stage: string;
  agentId: string;
  status: 'start' | 'progress' | 'complete' | 'error';
  message: string;
  data?: any;
}

// Sequential 패턴
class SequentialPattern implements CooperationPattern {
  // 기존 파이프라인 로직을 패턴으로 추출
  async execute(/*...*/) { /* P→A→C→W→Au 순차 실행 */ }
}

// Parallel 패턴
class ParallelPattern implements CooperationPattern {
  async execute(/*...*/) {
    // 1. Promise.all([planner, architect]) — 동시 실행
    // 2. compiler — 두 결과 합산
    // 3. worker + auditor 점진 병렬
  }
}

// Debate 패턴
class DebatePattern implements CooperationPattern {
  async execute(/*...*/) {
    // 1. P→A→C 순차 (기존과 동일)
    // 2. Worker + Auditor 3라운드 토론
    //    Round N: Worker 생성/수정 → Auditor 리뷰 → 피드백
    // 3. 최종 Auditor 판정
  }
}
```

### 완료 기준
- [ ] Sequential 패턴이 기존 파이프라인과 동일하게 작동한다
- [ ] Parallel 패턴에서 Planner+Architect가 동시 실행된다
- [ ] Debate 패턴에서 Worker+Auditor가 3라운드 토론한다
- [ ] 각 패턴의 진행 상황이 ProgressUpdate로 실시간 전달된다
- [ ] Message Flow 시각화가 패턴별로 다르게 표시된다

---

## Step 9-G: 실험 리포트 생성

**목적**: 실험 결과를 구조화된 마크다운 리포트로 자동 생성
**추천 모델**: ⚡ Haiku

### 리포트 구조

```markdown
# 실험 리포트: [실험명]
생성일: 2026-03-03 14:32:01

## 1. 실험 설정
| 에이전트 | 모델 | Temperature |
|----------|------|-------------|
| Planner | claude-sonnet-4-6 | 0.7 |
| ... | ... | ... |

협력 패턴: Sequential
도메인: Game Dev
입력: "슬라임 서바이벌 게임"

## 2. 실행 결과
- 총 소요 시간: 47초
- 총 토큰: 49,757 (입력: 25,500 / 출력: 24,257)
- 총 비용: $0.17
- Audit Score: 8.5/10
- 루프백: 0회

## 3. 에이전트별 상세
### Planner (Alex)
- 모델: claude-sonnet-4-6
- 토큰: 8,241 | 비용: $0.03 | 응답 시간: 2,341ms
- 출력: GDD (1,247자)

### ... (각 에이전트)

## 4. 생성된 산출물
- GDD: 1,247자
- SPEC: 2,891자
- Tasks: 6개
- 코드 파일: 3개 (412줄)

## 5. 비교 분석 (다른 실험과 비교 시)
(ComparisonResult 포함)
```

### 완료 기준
- [ ] 실험 완료 시 마크다운 리포트가 자동 생성된다
- [ ] 리포트에 설정/결과/에이전트별 상세/산출물이 포함된다
- [ ] 비교 분석 결과가 포함된다 (비교 실험 시)
- [ ] 마크다운 다운로드가 가능하다
- [ ] MemoWindow에 리포트 미리보기가 표시된다

---

## 4. 전체 구조 (TO-BE)

```
┌──────────────────────────────────────────────────────────────┐
│                  Agent Forge OS                              │
│                                                              │
│  [🎮 Game] [🏗️ SW Architect] [🧪 Lab Mode]                  │
│                                                              │
│  ┌─── 기존 윈도우 ──────┐  ┌─── 신규 윈도우 (Lab) ────────┐ │
│  │ 📜 Planner           │  │ 🧪 Experiment Lab             │ │
│  │ 🧑‍🔧 Architect          │  │ 📊 Dashboard                  │ │
│  │ 🖥️ Terminal            │  │ 🔀 Message Flow               │ │
│  │ 🎮 Live Canvas        │  │ ⚖️ Comparison                  │ │
│  │ 📝 Memo              │  │                               │ │
│  └──────────────────────┘  └───────────────────────────────┘ │
│                                                              │
│  ┌─── Agent Status Panel (확장) ────────────────────────────┐│
│  │ 🧑‍💼 Alex | sonnet | 8,241 tok | $0.03 | 2.3s avg        ││
│  │ 🧑‍🔧 Sam  | sonnet | 12,891 tok | $0.05 | 3.1s avg       ││
│  │ ...                                                      ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

---

## 5. 구현 우선순위 및 의존성

```
Step 9-A (메트릭 수집) ──필수──→ 9-B, 9-C, 9-D, 9-E, 9-F, 9-G
    ↓
Step 9-B (메시지 시각화) ─── 독립
Step 9-C (실험 설정) ─── 독립
    ↓
Step 9-D (대시보드) ←── 9-A, 9-C
Step 9-F (협력 패턴) ←── 9-C
    ↓
Step 9-E (비교 엔진) ←── 9-A, 9-C (2개 이상 실험 결과 필요)
    ↓
Step 9-G (리포트) ←── 9-E
```

| Step | 의존성 | 추천 모델 | 예상 복잡도 |
|------|--------|----------|------------|
| 9-A | SPEC-01 7-A | ⚔️ Sonnet | HIGH |
| 9-B | 9-A | ⚔️ Sonnet | MID |
| 9-C | 9-A | ⚔️ Sonnet | MID |
| 9-D | 9-A, 9-C | ⚔️ Sonnet | HIGH |
| 9-E | 9-A, 9-C | ⚔️ Sonnet | MID |
| 9-F | 9-C | 🏆 Opus | HIGH |
| 9-G | 9-E | ⚡ Haiku | LOW |

### SPEC-01, SPEC-02와의 의존 관계

```
SPEC-01 Step 7-A (AI Client) ──필수──→ SPEC-03 전체
SPEC-02 Step 8-A (도메인 스위칭) ──참조──→ SPEC-03 Step 9-C (도메인 선택 UI)
```

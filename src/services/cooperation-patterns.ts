import { AgentService, getAgentService } from './agent-service';
import { AIResponse } from './ai-client';
import { getMetricsCollector } from './metrics-collector';

export interface PipelineInput {
  gdd: string;
  spec: string;
  experimentId: string;
  domainMode: 'game' | 'software';
  onLog: (msg: string, level: 'info' | 'warn' | 'error' | 'success') => void;
  onAgentUpdate: (agentId: string, data: Record<string, unknown>) => void;
  onChunk?: (agentId: string, chunk: string) => void;
}

export interface PatternResult {
  gdd: string;
  spec: string;
  code: string;
  auditRaw: string;
}

export interface CooperationPatternExecutor {
  name: string;
  description: string;
  execute(input: PipelineInput): Promise<PatternResult>;
}

// ── Sequential: Planner→Architect→Compiler→Worker→Auditor ──
export class SequentialPattern implements CooperationPatternExecutor {
  name = 'sequential';
  description = '순차 실행: Planner → Architect → Compiler → Worker → Auditor';

  async execute(input: PipelineInput): Promise<PatternResult> {
    const { gdd, spec, experimentId, domainMode, onLog, onAgentUpdate } = input;
    const service = getAgentService();
    const isSW = domainMode === 'software';
    const collector = getMetricsCollector();

    // Step 1: Planner (GDD already provided — pass through)
    onLog(`[Sequential] GDD/PRD 사용 (${gdd.length}자)`, 'info');

    // Step 2: Architect (SPEC already provided — pass through)
    onLog(`[Sequential] SPEC/아키텍처 문서 사용 (${spec.length}자)`, 'info');

    // Step 3: Compiler
    onAgentUpdate('compiler', { status: 'executing', currentTask: '실행 계획 생성 중...' });
    const compilerRole = isSW ? 'compiler_sw' : 'compiler';
    const compilerPrompt = `다음을 분석하여 실행 계획 JSON을 생성하세요.\n\n${gdd.slice(0, 3000)}\n\n${spec.slice(0, 4000)}`;
    const compilerResp = await service.execute(compilerRole, compilerPrompt);
    onAgentUpdate('compiler', { status: 'idle', currentTask: '' });
    onLog('[Sequential] Compiler 완료', 'success');

    // Step 4: Worker
    onAgentUpdate('worker', { status: 'writing', currentTask: '코드 생성 중...' });
    const workerRole = isSW ? 'worker_sw' : 'worker';
    let workerContent = '';
    await service.executeStream(workerRole, `${gdd}\n\n${spec}\n\n${compilerResp.content}`, (chunk) => {
      workerContent += chunk;
      input.onChunk?.('worker', chunk);
    });
    onAgentUpdate('worker', { status: 'idle', currentTask: '' });
    onLog('[Sequential] Worker 완료', 'success');

    // Step 5: Auditor
    onAgentUpdate('auditor', { status: 'executing', currentTask: '검증 중...' });
    const auditorRole = isSW ? 'auditor_sw' : 'auditor';
    const auditorResp = await service.execute(auditorRole, `${gdd.slice(0, 3000)}\n\n${spec.slice(0, 3000)}\n\n${workerContent.slice(0, 12000)}`);
    onAgentUpdate('auditor', { status: 'idle', currentTask: '' });
    onLog('[Sequential] Auditor 완료', 'success');

    return { gdd, spec, code: workerContent, auditRaw: auditorResp.content };
  }
}

// ── Parallel: Planner+Architect 동시 → Compiler → Worker → Auditor ──
export class ParallelPattern implements CooperationPatternExecutor {
  name = 'parallel';
  description = '병렬 실행: Planner+Architect 동시 → Compiler → Worker → Auditor';

  async execute(input: PipelineInput): Promise<PatternResult> {
    const { gdd, spec, experimentId, domainMode, onLog, onAgentUpdate } = input;
    const service = getAgentService();
    const isSW = domainMode === 'software';

    // Step 1: Planner + Architect in parallel
    onAgentUpdate('planner', { status: 'writing', currentTask: 'GDD/PRD 보완 중...' });
    onAgentUpdate('architect', { status: 'writing', currentTask: 'SPEC/아키텍처 보완 중...' });
    onLog('[Parallel] Planner + Architect 동시 실행', 'info');

    const plannerRole = isSW ? 'planner_sw' : 'planner';
    const architectRole = isSW ? 'architect_sw' : 'architect';

    const [plannerResp, architectResp] = await Promise.all([
      service.execute(plannerRole, `기존 GDD/PRD를 보완하세요:\n\n${gdd}`),
      service.execute(architectRole, `기존 SPEC/아키텍처를 보완하세요:\n\n${spec}`),
    ]);

    const refinedGdd = plannerResp.content;
    const refinedSpec = architectResp.content;
    onAgentUpdate('planner', { status: 'idle', currentTask: '' });
    onAgentUpdate('architect', { status: 'idle', currentTask: '' });
    onLog('[Parallel] Planner + Architect 완료', 'success');

    // Step 2: Compiler
    onAgentUpdate('compiler', { status: 'executing', currentTask: '실행 계획 생성 중...' });
    const compilerRole = isSW ? 'compiler_sw' : 'compiler';
    const compilerResp = await service.execute(compilerRole, `${refinedGdd.slice(0, 3000)}\n\n${refinedSpec.slice(0, 4000)}`);
    onAgentUpdate('compiler', { status: 'idle', currentTask: '' });
    onLog('[Parallel] Compiler 완료', 'success');

    // Step 3: Worker
    onAgentUpdate('worker', { status: 'writing', currentTask: '코드 생성 중...' });
    const workerRole = isSW ? 'worker_sw' : 'worker';
    let workerContent = '';
    await service.executeStream(workerRole, `${refinedGdd}\n\n${refinedSpec}\n\n${compilerResp.content}`, (chunk) => {
      workerContent += chunk;
      input.onChunk?.('worker', chunk);
    });
    onAgentUpdate('worker', { status: 'idle', currentTask: '' });
    onLog('[Parallel] Worker 완료', 'success');

    // Step 4: Auditor
    onAgentUpdate('auditor', { status: 'executing', currentTask: '검증 중...' });
    const auditorRole = isSW ? 'auditor_sw' : 'auditor';
    const auditorResp = await service.execute(auditorRole, `${refinedGdd.slice(0, 3000)}\n\n${refinedSpec.slice(0, 3000)}\n\n${workerContent.slice(0, 12000)}`);
    onAgentUpdate('auditor', { status: 'idle', currentTask: '' });
    onLog('[Parallel] Auditor 완료', 'success');

    return { gdd: refinedGdd, spec: refinedSpec, code: workerContent, auditRaw: auditorResp.content };
  }
}

// ── Debate: Worker 2개 독립 생성 → Auditor가 최선 선택 ──
export class DebatePattern implements CooperationPatternExecutor {
  name = 'debate';
  description = '토론 실행: Worker 2개가 독립 코드 생성 → Auditor가 최선 선택';

  async execute(input: PipelineInput): Promise<PatternResult> {
    const { gdd, spec, experimentId, domainMode, onLog, onAgentUpdate } = input;
    const service = getAgentService();
    const isSW = domainMode === 'software';

    // Step 1: Compiler
    onAgentUpdate('compiler', { status: 'executing', currentTask: '실행 계획 생성 중...' });
    const compilerRole = isSW ? 'compiler_sw' : 'compiler';
    const compilerResp = await service.execute(compilerRole, `${gdd.slice(0, 3000)}\n\n${spec.slice(0, 4000)}`);
    onAgentUpdate('compiler', { status: 'idle', currentTask: '' });
    onLog('[Debate] Compiler 완료', 'success');

    // Step 2: Two Workers in parallel
    onAgentUpdate('worker', { status: 'writing', currentTask: '코드 생성 (2개 버전)...' });
    onLog('[Debate] Worker A + Worker B 동시 실행', 'info');

    const workerRole = isSW ? 'worker_sw' : 'worker';
    const basePrompt = `${gdd}\n\n${spec}\n\n${compilerResp.content}`;

    let contentA = '';
    let contentB = '';

    const [respA, respB] = await Promise.all([
      service.executeStream(workerRole, `${basePrompt}\n\n접근법 A: 가독성과 유지보수성을 최우선으로 구현하세요.`, (chunk) => {
        contentA += chunk;
      }),
      service.executeStream(workerRole, `${basePrompt}\n\n접근법 B: 성능과 효율성을 최우선으로 구현하세요.`, (chunk) => {
        contentB += chunk;
      }),
    ]);

    onAgentUpdate('worker', { status: 'idle', currentTask: '' });
    onLog(`[Debate] Worker A (${contentA.length}자), Worker B (${contentB.length}자) 생성 완료`, 'success');

    // Step 3: Auditor chooses the best
    onAgentUpdate('auditor', { status: 'executing', currentTask: '두 버전 비교 평가 중...' });
    const auditorRole = isSW ? 'auditor_sw' : 'auditor';
    const judgePrompt = `두 가지 구현을 비교 평가하세요.

=== GDD ===
${gdd.slice(0, 2000)}

=== SPEC ===
${spec.slice(0, 2000)}

=== 구현 A (가독성 우선) ===
${contentA.slice(0, 6000)}

=== 구현 B (성능 우선) ===
${contentB.slice(0, 6000)}

다음 JSON 형식으로 응답하세요. "chosen" 필드로 선택된 버전(A 또는 B)을 명시하세요:
{
  "chosen": "A",
  "score": 3.5,
  "checks": [...],
  "summary": "...",
  "recommendation": "pass",
  "fixPrompt": ""
}`;

    const auditorResp = await service.execute(auditorRole, judgePrompt);
    onAgentUpdate('auditor', { status: 'idle', currentTask: '' });

    // Parse chosen version
    let chosenCode = contentA;
    try {
      const json = JSON.parse(auditorResp.content.match(/\{[\s\S]*\}/)?.[0] ?? '{}');
      if (json.chosen === 'B') {
        chosenCode = contentB;
        onLog('[Debate] Auditor 선택: 버전 B (성능 우선)', 'success');
      } else {
        onLog('[Debate] Auditor 선택: 버전 A (가독성 우선)', 'success');
      }
    } catch {
      onLog('[Debate] Auditor 응답 파싱 실패 — 버전 A 사용', 'warn');
    }

    return { gdd, spec, code: chosenCode, auditRaw: auditorResp.content };
  }
}

// ── Factory ──
const PATTERNS: Record<string, CooperationPatternExecutor> = {
  sequential: new SequentialPattern(),
  parallel: new ParallelPattern(),
  debate: new DebatePattern(),
};

export function getCooperationPattern(name: string): CooperationPatternExecutor {
  return PATTERNS[name] ?? PATTERNS.sequential;
}

export function listPatterns(): CooperationPatternExecutor[] {
  return Object.values(PATTERNS);
}

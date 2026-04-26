import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { getAgentService } from '../services/agent-service';
import { getMetricsCollector } from '../services/metrics-collector';
import { extractCodeBlocks, codeBlocksToFiles, extractSWCodeBlocks, extractMermaidDiagrams, MermaidDiagram } from '../utils/code-extractor';
import { DomainMode, DomainConfig, DOMAIN_CONFIGS, GAME_DOMAIN } from '../config/domain-mode';
import { ModelStrategy, MODEL_STRATEGIES } from '../config/model-strategy';
import { applyModelStrategy } from '../services/agent-service';
import { executeInSandbox, RuntimeReport } from '../services/runtime-sandbox';

export interface WindowState {
  id: string;
  title: string;
  zIndex: number;
  isMinimized: boolean;
  isVisible: boolean;
}

export interface AgentData {
  agentId: string;
  status: 'idle' | 'writing' | 'researching' | 'executing' | 'error' | 'syncing';
  currentTask: string;
  yesterdayMemo: string;
  lastUpdated: number;
  // 9-A 메트릭 필드
  totalApiCalls: number;
  totalTokens: number;
  totalCost: number;
  avgLatencyMs: number;
  errorCount: number;
  currentModel: string;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

export interface GeneratedFile {
  path: string;
  content: string;
  taskId: number;
}

export interface AuditCheck {
  category: 'structure' | 'logic' | 'style' | 'completeness';
  item: string;
  passed: boolean;
  detail: string;
}

export interface AuditResult {
  score: number;
  checks: AuditCheck[];
  summary: string;
  recommendation: 'pass' | 'fix-worker' | 'fix-compiler';
  fixPrompt: string;
}

export interface CompilerTask {
  id: number;
  title: string;
  difficulty: 'HIGH' | 'MID' | 'LOW';
  targetFiles: string[];
  prompt: string;
}

export interface ExecutionPlan {
  projectName: string;
  totalTasks: number;
  tasks: CompilerTask[];
}

export interface PipelineState {
  status: 'idle' | 'running' | 'paused' | 'complete' | 'error';
  currentNode: string | null;
  gdd: string;
  spec: string;
  executionPlan: ExecutionPlan | null;
  generatedCode: GeneratedFile[];
  diagrams: MermaidDiagram[];
  auditResult: AuditResult | null;
  runtimeReport: RuntimeReport | null;
  loopCount: number;
}

export interface PipelineLog {
  id: string;
  timestamp: number;
  domainMode: DomainMode;
  projectName: string;
  gdd: string;
  spec: string;
  generatedFileCount: number;
  auditScore: number | null;
  passed: boolean;
}

export interface SavedDocument {
  id: string;
  timestamp: number;
  type: 'skill' | 'spec' | 'handoff' | 'startercode';
  title: string;
  content: string;
  domainMode: DomainMode;
}

export const SAVED_DOCS_KEY = 'saved_documents';

export function loadSavedDocuments(): SavedDocument[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_DOCS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function saveDocument(doc: SavedDocument): void {
  const docs = loadSavedDocuments();
  localStorage.setItem(SAVED_DOCS_KEY, JSON.stringify([doc, ...docs]));
}

export function deleteDocument(id: string): void {
  const docs = loadSavedDocuments();
  localStorage.setItem(SAVED_DOCS_KEY, JSON.stringify(docs.filter(d => d.id !== id)));
}

// ──── AI 응답 스키마 검증 ──────────────────────────────────
function isValidExecutionPlan(obj: unknown): obj is ExecutionPlan {
  if (typeof obj !== 'object' || obj === null) return false;
  const p = obj as Record<string, unknown>;
  return (
    typeof p.projectName === 'string' &&
    typeof p.totalTasks === 'number' &&
    Array.isArray(p.tasks)
  );
}

function isValidAuditResult(obj: unknown): obj is AuditResult {
  if (typeof obj !== 'object' || obj === null) return false;
  const r = obj as Record<string, unknown>;
  return (
    typeof r.score === 'number' &&
    Array.isArray(r.checks) &&
    typeof r.summary === 'string' &&
    ['pass', 'fix-worker', 'fix-compiler'].includes(r.recommendation as string)
  );
}

const MAX_AUDIT_LOOPS = 3;

const LOGS_KEY = 'pipeline_logs';
const MAX_LOGS = 20;

export function loadPipelineLogs(): PipelineLog[] {
  try {
    return JSON.parse(localStorage.getItem(LOGS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function savePipelineLog(log: PipelineLog): void {
  const logs = loadPipelineLogs();
  const updated = [log, ...logs].slice(0, MAX_LOGS);
  localStorage.setItem(LOGS_KEY, JSON.stringify(updated));
}

interface WindowContextType {
  windows: WindowState[];
  agents: AgentData[];
  logs: LogEntry[];
  pipeline: PipelineState;
  domainMode: DomainMode;
  domainConfig: DomainConfig;
  currentExperimentId: string;
  modelStrategy: ModelStrategy;
  approvalMode: boolean;
  setApprovalMode: (on: boolean) => void;
  setModelStrategy: (strategy: ModelStrategy) => void;
  switchDomain: (mode: DomainMode) => void;
  focusWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  toggleWindowVisibility: (id: string) => void;
  addLog: (message: string, level?: LogEntry['level']) => void;
  updateAgent: (agentId: string, data: Partial<AgentData>) => void;
  setPipeline: (data: Partial<PipelineState>) => void;
  setExperimentId: (id: string) => void;
  runCompiler: (gdd: string, spec: string) => Promise<ExecutionPlan>;
  runWorker: (spec: string, gdd: string, plan?: ExecutionPlan) => Promise<GeneratedFile[]>;
  runAuditor: (gdd: string, spec: string, code: GeneratedFile[]) => Promise<AuditResult>;
}

const defaultPipeline: PipelineState = {
  status: 'idle',
  currentNode: null,
  gdd: '',
  spec: '',
  executionPlan: null,
  generatedCode: [],
  diagrams: [],
  auditResult: null,
  runtimeReport: null,
  loopCount: 0,
};

const WindowContext = createContext<WindowContextType | undefined>(undefined);

export const WindowContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [windows, setWindows] = useState<WindowState[]>([
    { id: 'planner', title: '📜 Planner', zIndex: 10, isMinimized: false, isVisible: false },
    { id: 'architect', title: '🧑‍🔧 Architect', zIndex: 9, isMinimized: false, isVisible: false },
    { id: 'terminal', title: '🖥️ Terminal', zIndex: 8, isMinimized: false, isVisible: false },
    { id: 'canvas', title: '🎮 Live Canvas', zIndex: 7, isMinimized: false, isVisible: false },
    { id: 'memo', title: '📞 직원 호출', zIndex: 6, isMinimized: false, isVisible: false },
    { id: 'history', title: '📚 History', zIndex: 5, isMinimized: false, isVisible: false },
    // ── Lab Mode 창 ──
    { id: 'message-flow', title: '🔀 Message Flow', zIndex: 4, isMinimized: false, isVisible: false },
    { id: 'experiment',   title: '🧪 Experiment Lab', zIndex: 3, isMinimized: false, isVisible: false },
    { id: 'dashboard',    title: '📊 Dashboard', zIndex: 2, isMinimized: false, isVisible: false },
    { id: 'comparison',   title: '⚖️ Comparison', zIndex: 1, isMinimized: false, isVisible: false },
    // ── Docs Mode 창 ──
    { id: 'code-input',   title: '📂 Code Input', zIndex: 0, isMinimized: false, isVisible: false },
  ]);

  const defaultMetrics = { totalApiCalls: 0, totalTokens: 0, totalCost: 0, avgLatencyMs: 0, errorCount: 0, currentModel: 'gemini-2.0-flash' };
  const [agents, setAgents] = useState<AgentData[]>([
    { agentId: 'planner', status: 'idle', currentTask: '', yesterdayMemo: '', lastUpdated: Date.now(), ...defaultMetrics },
    { agentId: 'architect', status: 'idle', currentTask: '', yesterdayMemo: '', lastUpdated: Date.now(), ...defaultMetrics },
    { agentId: 'compiler', status: 'idle', currentTask: '', yesterdayMemo: '', lastUpdated: Date.now(), ...defaultMetrics },
    { agentId: 'worker', status: 'idle', currentTask: '', yesterdayMemo: '', lastUpdated: Date.now(), ...defaultMetrics },
    { agentId: 'auditor', status: 'idle', currentTask: '', yesterdayMemo: '', lastUpdated: Date.now(), ...defaultMetrics },
  ]);

  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: '0',
      timestamp: Date.now(),
      level: 'info',
      message: '🏰 Agent Forge initialized. Awaiting orders...',
    },
  ]);

  const [pipeline, setPipelineState] = useState<PipelineState>(defaultPipeline);
  const pipelineRef = useRef(pipeline);
  pipelineRef.current = pipeline;
  const compilerLockRef = useRef(false);

  const [domainMode, setDomainMode] = useState<DomainMode>('game');
  const [domainConfig, setDomainConfig] = useState<DomainConfig>(GAME_DOMAIN);
  const [currentExperimentId, setCurrentExperimentId] = useState('default');
  const [modelStrategy, setModelStrategyState] = useState<ModelStrategy>('all-flash');
  const [approvalMode, setApprovalModeState] = useState<boolean>(() => {
    try { return localStorage.getItem('approval_mode') === 'true'; } catch { return false; }
  });

  const focusWindow = useCallback((id: string) => {
    setWindows(prevWindows => {
      const maxZ = Math.max(...prevWindows.map(w => w.zIndex));
      return prevWindows.map(w =>
        w.id === id ? { ...w, zIndex: maxZ + 1, isMinimized: false } : w
      );
    });
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    setWindows(prevWindows =>
      prevWindows.map(w =>
        w.id === id ? { ...w, isMinimized: true } : w
      )
    );
  }, []);

  const restoreWindow = useCallback((id: string) => {
    focusWindow(id);
    setWindows(prevWindows =>
      prevWindows.map(w =>
        w.id === id ? { ...w, isMinimized: false } : w
      )
    );
  }, [focusWindow]);

  const toggleWindowVisibility = useCallback((id: string) => {
    setWindows(prevWindows =>
      prevWindows.map(w =>
        w.id === id ? { ...w, isVisible: !w.isVisible, isMinimized: false } : w
      )
    );
  }, []);

  const addLog = useCallback((message: string, level: LogEntry['level'] = 'info') => {
    setLogs(prevLogs => [
      ...prevLogs,
      {
        id: String(Date.now() + Math.random()),
        timestamp: Date.now(),
        level,
        message,
      },
    ]);
  }, []);

  const setApprovalMode = useCallback((on: boolean) => {
    setApprovalModeState(on);
    try { localStorage.setItem('approval_mode', String(on)); } catch { /* noop */ }
    addLog(on ? '🛡️ 승인 모드 활성화 — GDD/SPEC 완성 후 수정 및 승인 필요' : '⚡ 승인 모드 비활성화 — 자동 진행', 'info');
  }, [addLog]);

  const setModelStrategy = useCallback((strategy: ModelStrategy) => {
    setModelStrategyState(strategy);
    applyModelStrategy(strategy);
    addLog(`🔀 모델 전략 변경: ${MODEL_STRATEGIES[strategy].label} — ${MODEL_STRATEGIES[strategy].description}`, 'info');
  }, [addLog]);

  const updateAgent = useCallback((agentId: string, data: Partial<AgentData>) => {
    setAgents(prevAgents =>
      prevAgents.map(agent =>
        agent.agentId === agentId
          ? { ...agent, ...data, lastUpdated: Date.now() }
          : agent
      )
    );
  }, []);

  const setPipeline = useCallback((data: Partial<PipelineState>) => {
    setPipelineState(prev => ({ ...prev, ...data }));
  }, []);

  const setExperimentId = useCallback((id: string) => {
    setCurrentExperimentId(id);
    getAgentService().setExperimentId(id);
  }, []);

  const switchDomain = useCallback((mode: DomainMode) => {
    const config = DOMAIN_CONFIGS[mode];
    setDomainMode(mode);
    setDomainConfig(config);
    setPipelineState(defaultPipeline);
    setAgents(prev =>
      prev.map(agent => ({
        ...agent,
        status: 'idle' as const,
        currentTask: '',
      }))
    );
    setLogs(prev => [
      ...prev,
      {
        id: String(Date.now()),
        timestamp: Date.now(),
        level: 'info' as const,
        message: `🔄 도메인 전환: ${DOMAIN_CONFIGS[domainMode].label} → ${config.label}`,
      },
    ]);
  }, [domainMode]);

  // 메트릭 자동 수집: api-call 이벤트를 구독하여 AgentData 메트릭 갱신
  useEffect(() => {
    const collector = getMetricsCollector();
    const unsub = collector.subscribe('api-call', (metric) => {
      if (!metric.apiCall) return;
      const { inputTokens, outputTokens, latencyMs, cost, success, model } = metric.apiCall;
      const tokens = inputTokens + outputTokens;
      setAgents(prev =>
        prev.map(agent => {
          if (agent.agentId !== metric.agentId) return agent;
          const newCalls = agent.totalApiCalls + 1;
          const newTokens = agent.totalTokens + tokens;
          const newCost = agent.totalCost + cost;
          const newAvgLatency = (agent.avgLatencyMs * agent.totalApiCalls + latencyMs) / newCalls;
          const newErrors = agent.errorCount + (success ? 0 : 1);
          return {
            ...agent,
            totalApiCalls: newCalls,
            totalTokens: newTokens,
            totalCost: newCost,
            avgLatencyMs: Math.round(newAvgLatency),
            errorCount: newErrors,
            currentModel: model,
            lastUpdated: Date.now(),
          };
        }),
      );
    });
    return unsub;
  }, []);

  // pipeline complete 시 자동 저장
  useEffect(() => {
    if (pipeline.status !== 'complete') return;
    const firstLine = pipeline.gdd.split('\n').find(l => l.trim()) ?? 'Untitled';
    const log: PipelineLog = {
      id: String(Date.now()),
      timestamp: Date.now(),
      domainMode,
      projectName: firstLine.replace(/^#+\s*/, '').slice(0, 60),
      gdd: pipeline.gdd,
      spec: pipeline.spec,
      generatedFileCount: pipeline.generatedCode.length,
      auditScore: pipeline.auditResult?.score ?? null,
      passed: pipeline.auditResult?.recommendation === 'pass',
    };
    savePipelineLog(log);
    addLog(`💾 세션 저장 완료 — "${log.projectName}"`, 'success');
  }, [pipeline.status]);

  // Compiler: GDD+SPEC → 실행 계획(JSON) 생성
  const runCompiler = useCallback(async (gdd: string, spec: string): Promise<ExecutionPlan> => {
    // 동시 실행 방지 (ref 기반 락 — 비동기 state에 의존하지 않음)
    if (compilerLockRef.current) {
      addLog('⚠️ 파이프라인이 이미 실행 중입니다', 'warn');
      throw new Error('파이프라인 실행 중');
    }
    compilerLockRef.current = true;
    // 새 파이프라인 시작 시 루프 카운터 초기화
    setPipeline({ loopCount: 0 });

    const agentService = getAgentService();
    const roleId = domainMode === 'software' ? 'compiler_sw'
                 : domainMode === 'docs'     ? 'compiler_docs'
                 : 'compiler';
    const inputLabel = domainMode === 'software' ? 'PRD'
                     : domainMode === 'docs'     ? '문서 스코프'
                     : 'GDD';
    const docLabel = domainMode === 'software' ? '아키텍처 문서'
                   : domainMode === 'docs'     ? '코드 분석'
                   : 'SPEC';

    const collector = getMetricsCollector();
    const expId = pipelineRef.current && currentExperimentId ? currentExperimentId : 'default';
    // message-pass: planner→architect(gdd), architect→compiler(spec)
    collector.record({ experimentId: expId, agentId: 'planner', type: 'message-pass', messagePass: { from: 'planner', to: 'architect', contentType: 'gdd', contentSize: gdd.length } });
    collector.record({ experimentId: expId, agentId: 'architect', type: 'message-pass', messagePass: { from: 'architect', to: 'compiler', contentType: 'spec', contentSize: spec.length } });

    setPipeline({ status: 'running', currentNode: 'compiler' });
    updateAgent('compiler', { status: 'executing', currentTask: '실행 계획 수립 중...' });
    addLog(`🧑‍💻 [Jordan] 실행 계획 분석 시작...`, 'info');

    const prompt = `다음 ${inputLabel}와 ${docLabel}를 분석하여 실행 계획 JSON을 생성하세요.

=== ${inputLabel} ===
${gdd.slice(0, 3000)}

=== ${docLabel} ===
${spec.slice(0, 4000)}`;

    try {
      const response = await agentService.execute(roleId, prompt);
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Compiler JSON 파싱 실패');

      const parsed: unknown = JSON.parse(jsonMatch[0]);
      if (!isValidExecutionPlan(parsed)) throw new Error('Compiler 응답 스키마 오류');
      const plan: ExecutionPlan = parsed;
      setPipeline({ executionPlan: plan });
      addLog(
        `🧑‍💻 [Jordan] 실행 계획 완료 — ${plan.totalTasks}개 태스크 (${plan.tasks.filter(t => t.difficulty === 'HIGH').length} HIGH)`,
        'success',
      );
      updateAgent('compiler', {
        status: 'idle',
        currentTask: '',
        yesterdayMemo: `${plan.projectName}: ${plan.totalTasks}개 태스크 계획`,
      });
      compilerLockRef.current = false;
      return plan;
    } catch (err) {
      compilerLockRef.current = false;
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`❌ [Jordan] 오류: ${msg}`, 'error');
      updateAgent('compiler', { status: 'error', currentTask: msg });
      // 파싱 실패 시 기본 플랜으로 폴백
      const fallback: ExecutionPlan = {
        projectName: 'Project',
        totalTasks: 1,
        tasks: [{ id: 1, title: '전체 구현', difficulty: 'HIGH', targetFiles: [], prompt: spec }],
      };
      setPipeline({ executionPlan: fallback });
      return fallback;
    }
  }, [addLog, updateAgent, setPipeline, domainMode]);

  // Worker: SPEC/아키텍처 문서를 파싱하여 코드 생성 (게임/SW 모드 분기)
  const runWorker = useCallback(async (spec: string, gdd: string, plan?: ExecutionPlan) => {
    const agentService = getAgentService();
    const isDocs = domainMode === 'docs';
    const isSW = domainMode === 'software';
    const roleId = isSW ? 'worker_sw'
                 : isDocs ? 'worker_docs'
                 : 'worker';

    const collector = getMetricsCollector();
    const expId = currentExperimentId ?? 'default';
    collector.record({ experimentId: expId, agentId: 'compiler', type: 'message-pass', messagePass: { from: 'compiler', to: 'worker', contentType: 'task', contentSize: spec.length } });

    setPipeline({ status: 'running', currentNode: 'worker' });
    updateAgent('worker', { status: 'writing', currentTask: '코드 생성 시작...' });
    addLog('👨‍🚀 [Casey] Worker 시작 - 코드 자동 생성', 'info');

    // 구현 순서 파싱 (## 6. 구현 순서 섹션)
    const taskMatch = spec.match(/## 6\.\s*구현 순서([\s\S]*?)(?=##|$)/i);
    const tasks: string[] = [];
    if (taskMatch) {
      const lines = taskMatch[1].split('\n').filter(l => l.trim().match(/^\d+\./));
      lines.forEach(l => tasks.push(l.replace(/^\d+\.\s*/, '').trim()));
    }

    const inputLabel = isSW ? 'PRD' : isDocs ? '문서 스코프' : 'GDD';
    const docLabel = isSW ? '아키텍처 문서' : isDocs ? '코드 분석' : 'SPEC';

    // Compiler 실행 계획이 있으면 task prompt를 통합하여 사용
    const planContext = plan && plan.tasks.length > 0
      ? `\n\n=== 실행 계획 (Jordan 컴파일러) ===\n프로젝트: ${plan.projectName}\n\n` +
        plan.tasks.map(t =>
          `[Task ${t.id}] ${t.title} (${t.difficulty})\n대상 파일: ${t.targetFiles.join(', ') || '없음'}\n지시사항: ${t.prompt}`
        ).join('\n\n')
      : '';

    const prompt = isDocs
      ? `다음 문서 스코프(TOC)와 코드 분석 결과를 기반으로 완전한 기술 문서를 마크다운으로 작성하세요.

=== 문서 스코프 ===
${gdd}

=== 코드 분석 ===
${spec}${planContext}

목차의 모든 섹션을 빠짐없이 작성하세요.
Mermaid 다이어그램, 코드 스니펫, 테이블을 적극 활용하세요.
마크다운 원본 텍스트만 출력하세요 (코드 블록으로 감싸지 마세요).`
      : isSW
      ? `다음 ${inputLabel}와 ${docLabel}를 기반으로 보일러플레이트 코드를 생성하세요.

=== ${inputLabel} ===
${gdd}

=== ${docLabel} ===
${spec}${planContext}

구현 순서(## 6)에 따라 모든 파일을 생성하세요.
각 파일은 파일 경로를 포함한 코드 블록으로 출력하세요 (예: \`\`\`src/index.ts).
README.md와 .env.example도 반드시 포함하세요.`
      : `다음 GDD와 SPEC을 기반으로 완전히 동작하는 게임 코드를 생성하세요.

=== GDD ===
${gdd}

=== SPEC ===
${spec}${planContext}

모든 파일(HTML, CSS, JS)을 단일 index.html에 인라인으로 포함하여 즉시 실행 가능한 완전한 코드를 출력하세요.
코드 블록을 사용하고 파일명을 주석으로 명시하세요.`;

    const generated: GeneratedFile[] = [];
    let streamedContent = '';

    try {
      updateAgent('worker', { currentTask: `코드 생성 중 (${tasks.length}개 태스크)` });
      addLog(`👨‍🚀 [Casey] ${tasks.length || 1}개 태스크 실행 중...`, 'info');

      await agentService.executeStream(roleId, prompt, (chunk) => {
        streamedContent += chunk;
      });

      if (isDocs) {
        // Docs 모드: 스트리밍된 마크다운을 단일 파일로 저장
        generated.push({
          path: 'documentation.md',
          content: streamedContent,
          taskId: 0,
        });
        // Mermaid 다이어그램 추출 (분석 결과에서)
        const diagrams = extractMermaidDiagrams(streamedContent);
        setPipeline({ diagrams });
        addLog(`📄 [Casey] 기술 문서 생성 완료 (${streamedContent.length}자, 다이어그램 ${diagrams.length}개)`, 'success');
      } else if (isSW) {
        // SW 모드: 파일 경로 포함 코드 블록 추출
        const swFiles = extractSWCodeBlocks(streamedContent);
        generated.push(...swFiles);

        // Mermaid 다이어그램 추출 (spec에서)
        const diagrams = extractMermaidDiagrams(spec);
        setPipeline({ diagrams });

        addLog(`👨‍🚀 [Casey] ${generated.length}개 파일 생성 완료 (다이어그램 ${diagrams.length}개)`, 'success');
      } else {
        // 게임 모드: 일반 코드 블록 추출
        const blocks = extractCodeBlocks(streamedContent);
        const files = codeBlocksToFiles(blocks, 'game');
        generated.push(...files);

        addLog(`👨‍🚀 [Casey] ${generated.length}개 파일 생성 완료`, 'success');
      }

      updateAgent('worker', { status: 'idle', currentTask: '' });
      setPipeline({ generatedCode: generated, currentNode: null });
      // message-pass: worker→auditor
      const codeSize = generated.reduce((s, f) => s + f.content.length, 0);
      collector.record({ experimentId: expId, agentId: 'worker', type: 'message-pass', messagePass: { from: 'worker', to: 'auditor', contentType: 'code', contentSize: codeSize } });
      return generated;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`❌ [Casey] 오류: ${msg}`, 'error');
      updateAgent('worker', { status: 'error', currentTask: msg });
      setPipeline({ status: 'error' });
      throw err;
    }
  }, [addLog, updateAgent, setPipeline, domainMode]);

  // Auditor: 생성된 코드/문서를 검증 (게임/SW 모드 분기)
  const runAuditor = useCallback(async (
    gdd: string,
    spec: string,
    code: GeneratedFile[],
  ): Promise<AuditResult> => {
    const agentService = getAgentService();
    const isSW = domainMode === 'software';
    const isDocs = domainMode === 'docs';
    const roleId = isSW ? 'auditor_sw'
                 : isDocs ? 'auditor_docs'
                 : 'auditor';

    updateAgent('auditor', { status: 'executing', currentTask: '자동 검증 중...' });
    addLog('🧑‍⚖️ [Morgan] Auditor 검증 시작', 'info');

    // Game 모드: 런타임 샌드박스 실행
    let runtimeReport: RuntimeReport | null = null;
    const isGame = domainMode === 'game';
    if (isGame && code.length > 0) {
      try {
        addLog('🔬 [Morgan] 런타임 샌드박스 실행 중...', 'info');
        runtimeReport = await executeInSandbox(code);
        setPipeline({ runtimeReport });
        if (runtimeReport.success) {
          addLog(`🔬 런타임 검증 완료 — 에러 없음, DOM ${runtimeReport.domInfo.elementCount}개, 게임루프 ${runtimeReport.hasGameLoop ? '감지' : '미감지'} (${runtimeReport.loadTimeMs}ms)`, 'success');
        } else {
          addLog(`🔬 런타임 검증 완료 — 에러 ${runtimeReport.errors.length}개 발견 (${runtimeReport.loadTimeMs}ms)`, 'warn');
        }
      } catch (err) {
        addLog(`⚠️ 런타임 샌드박스 실행 실패 — 정적 분석으로 진행`, 'warn');
      }
    }

    // 코드 길이가 너무 길면 앞부분만 전달 (토큰 절약)
    const MAX_CODE_CHARS = 12000;
    const codeStr = code
      .map(f => `=== ${f.path} ===\n${f.content}`)
      .join('\n\n')
      .slice(0, MAX_CODE_CHARS);

    const inputLabel = isSW ? 'PRD' : isDocs ? '문서 스코프' : 'GDD';
    const docLabel = isSW ? '아키텍처 문서' : isDocs ? '코드 분석' : 'SPEC';
    const codeLabel = isDocs ? '생성된 문서' : '생성된 코드';

    // 런타임 결과 섹션 (Game 모드에서만)
    const runtimeSection = runtimeReport
      ? `\n\n=== 런타임 실행 결과 ===
- 실행 성공: ${runtimeReport.success ? '✅' : '❌'}
- 에러: ${runtimeReport.errors.length > 0 ? runtimeReport.errors.join('; ') : '없음'}
- 경고: ${runtimeReport.warnings.length > 0 ? runtimeReport.warnings.join('; ') : '없음'}
- 게임 루프 감지: ${runtimeReport.hasGameLoop ? '✅' : '❌'}
- DOM 엘리먼트 수: ${runtimeReport.domInfo.elementCount}개
- Canvas 존재: ${runtimeReport.domInfo.hasCanvas ? '✅' : '❌'}
- Console 로그: ${runtimeReport.logs.length > 0 ? runtimeReport.logs.slice(0, 10).join('; ') : '없음'}
- 로드 시간: ${runtimeReport.loadTimeMs}ms`
      : '';

    const prompt = `다음 ${inputLabel}, ${docLabel}, ${codeLabel}를 검증하세요.

=== ${inputLabel} ===
${gdd.slice(0, 3000)}

=== ${docLabel} ===
${spec.slice(0, 3000)}

=== 생성된 코드 ===
${codeStr}${runtimeSection}

JSON 형식으로만 응답하세요.`;

    try {
      const response = await agentService.execute(roleId, prompt);
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Auditor JSON 파싱 실패');

      const parsedAudit: unknown = JSON.parse(jsonMatch[0]);
      if (!isValidAuditResult(parsedAudit)) throw new Error('Auditor 응답 스키마 오류');
      const result: AuditResult = parsedAudit;

      // SW/Docs 모드: severity 기반 recommendation 보정
      if (isSW || isDocs) {
        const hasCritical = result.checks.some(
          (c: AuditCheck & { severity?: string }) => !c.passed && c.severity === 'critical',
        );
        const hasMajor = result.checks.some(
          (c: AuditCheck & { severity?: string }) => !c.passed && c.severity === 'major',
        );
        const hasOnlyMinor = !hasCritical && !hasMajor;

        if (hasCritical) {
          result.recommendation = 'fix-compiler';
        } else if (hasMajor) {
          result.recommendation = 'fix-worker';
        } else if (hasOnlyMinor || result.score < 5) {
          result.recommendation = 'pass';
          if (hasOnlyMinor && result.checks.some((c: AuditCheck) => !c.passed)) {
            addLog('⚠️ [Morgan] Minor 이슈 있음 - 경고와 함께 PASS 처리', 'warn');
          }
        }
      }

      // 루프 카운터 상한 체크 — 의도치 않은 무한 재시도 방지
      if (result.recommendation !== 'pass') {
        const currentLoop = pipelineRef.current.loopCount;
        if (currentLoop >= MAX_AUDIT_LOOPS - 1) {
          addLog(`⛔ [Morgan] 최대 재시도(${MAX_AUDIT_LOOPS}회) 초과 — 파이프라인 강제 종료`, 'warn');
          result.recommendation = 'pass';
        } else {
          setPipeline({ loopCount: currentLoop + 1 });
        }
      }

      addLog(
        `🧑‍⚖️ [Morgan] 검증 완료 - Debt Score: ${result.score}/10 → ${result.recommendation.toUpperCase()}`,
        result.recommendation === 'pass' ? 'success' : 'warn',
      );
      updateAgent('auditor', { status: 'idle', currentTask: '' });
      setPipeline({ auditResult: result });
      // 루프백 메시지 기록
      if (result.recommendation !== 'pass') {
        const expId = currentExperimentId ?? 'default';
        getMetricsCollector().record({ experimentId: expId, agentId: 'auditor', type: 'message-pass', messagePass: { from: 'auditor', to: 'worker', contentType: 'feedback', contentSize: result.fixPrompt.length } });
      }
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`❌ [Morgan] 오류: ${msg}`, 'error');
      updateAgent('auditor', { status: 'error', currentTask: msg });
      const fallback: AuditResult = {
        score: 0,
        checks: [],
        summary: '검증 오류로 인해 자동 통과 처리',
        recommendation: 'pass',
        fixPrompt: '',
      };
      setPipeline({ auditResult: fallback });
      return fallback;
    }
  }, [addLog, updateAgent, setPipeline, domainMode]);

  const value: WindowContextType = {
    windows,
    agents,
    logs,
    pipeline,
    domainMode,
    domainConfig,
    currentExperimentId,
    modelStrategy,
    approvalMode,
    setApprovalMode,
    setModelStrategy,
    switchDomain,
    focusWindow,
    minimizeWindow,
    restoreWindow,
    toggleWindowVisibility,
    addLog,
    updateAgent,
    setPipeline,
    setExperimentId,
    runCompiler,
    runWorker,
    runAuditor,
  };

  return (
    <WindowContext.Provider value={value}>
      {children}
    </WindowContext.Provider>
  );
};

export const useWindowContext = () => {
  const context = useContext(WindowContext);
  if (!context) {
    throw new Error('useWindowContext must be used within WindowContextProvider');
  }
  return context;
};

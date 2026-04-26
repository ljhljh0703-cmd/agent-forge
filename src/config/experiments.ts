import { DomainMode } from './domain-mode';

export interface ModelConfig {
  provider: 'anthropic' | 'openai' | 'gemini';
  model: string;
  temperature: number;
}

export type CooperationPattern = 'sequential' | 'parallel' | 'debate';

export interface ExperimentConfig {
  id: string;
  name: string;
  description: string;
  agentModels: {
    planner: ModelConfig;
    architect: ModelConfig;
    compiler: ModelConfig;
    worker: ModelConfig;
    auditor: ModelConfig;
  };
  cooperationPattern: CooperationPattern;
  input: {
    idea: string;
    domain: DomainMode;
  };
  options: {
    maxLoops: number;
    timeout: number;
    collectIntermediates: boolean;
  };
}

export interface ExperimentRun {
  id: string;
  timestamp: number;
  config: ExperimentConfig;
  status: 'running' | 'complete' | 'error';
  totalCost: number;
  totalTokens: number;
  totalLatencyMs: number;
  auditScore: number | null;
  fileCount: number;
}

const DEFAULT_OPTIONS = { maxLoops: 3, timeout: 300_000, collectIntermediates: false };

export const EXPERIMENT_PRESETS: ExperimentConfig[] = [
  {
    id: 'preset-all-sonnet',
    name: '전원 Sonnet',
    description: '모든 에이전트에 Claude Sonnet 4.6 배치 (균형형)',
    cooperationPattern: 'sequential',
    input: { idea: '', domain: 'game' },
    options: DEFAULT_OPTIONS,
    agentModels: {
      planner:   { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.8 },
      architect: { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.3 },
      compiler:  { provider: 'gemini',    model: 'local',             temperature: 0   },
      worker:    { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.2 },
      auditor:   { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.1 },
    },
  },
  {
    id: 'preset-cost-optimized',
    name: '비용 최적화',
    description: '리더만 Sonnet, 나머지 Haiku (저비용)',
    cooperationPattern: 'sequential',
    input: { idea: '', domain: 'game' },
    options: DEFAULT_OPTIONS,
    agentModels: {
      planner:   { provider: 'anthropic', model: 'claude-sonnet-4-6',         temperature: 0.8 },
      architect: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', temperature: 0.3 },
      compiler:  { provider: 'gemini',    model: 'local',                     temperature: 0   },
      worker:    { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', temperature: 0.2 },
      auditor:   { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', temperature: 0.1 },
    },
  },
  {
    id: 'preset-quality-first',
    name: '품질 우선',
    description: 'Planner+Worker에 Opus, 나머지 Sonnet (고품질)',
    cooperationPattern: 'sequential',
    input: { idea: '', domain: 'game' },
    options: DEFAULT_OPTIONS,
    agentModels: {
      planner:   { provider: 'anthropic', model: 'claude-opus-4-6',   temperature: 0.8 },
      architect: { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.3 },
      compiler:  { provider: 'gemini',    model: 'local',             temperature: 0   },
      worker:    { provider: 'anthropic', model: 'claude-opus-4-6',   temperature: 0.2 },
      auditor:   { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.1 },
    },
  },
  {
    id: 'preset-gemini-all',
    name: '전원 Gemini (현재)',
    description: '현재 설정 — 모든 에이전트에 Gemini 2.0 Flash',
    cooperationPattern: 'sequential',
    input: { idea: '', domain: 'game' },
    options: DEFAULT_OPTIONS,
    agentModels: {
      planner:   { provider: 'gemini', model: 'gemini-2.0-flash', temperature: 0.8 },
      architect: { provider: 'gemini', model: 'gemini-2.0-flash', temperature: 0.3 },
      compiler:  { provider: 'gemini', model: 'local',            temperature: 0   },
      worker:    { provider: 'gemini', model: 'gemini-2.0-flash', temperature: 0.2 },
      auditor:   { provider: 'gemini', model: 'gemini-2.0-flash', temperature: 0.1 },
    },
  },
  {
    id: 'preset-debate',
    name: '토론형',
    description: 'Worker와 Auditor가 3라운드 토론 후 결론 (실험적)',
    cooperationPattern: 'debate',
    input: { idea: '', domain: 'game' },
    options: { ...DEFAULT_OPTIONS, maxLoops: 3 },
    agentModels: {
      planner:   { provider: 'gemini', model: 'gemini-2.0-flash', temperature: 0.8 },
      architect: { provider: 'gemini', model: 'gemini-2.0-flash', temperature: 0.3 },
      compiler:  { provider: 'gemini', model: 'local',            temperature: 0   },
      worker:    { provider: 'gemini', model: 'gemini-2.0-flash', temperature: 0.3 },
      auditor:   { provider: 'gemini', model: 'gemini-2.0-flash', temperature: 0.3 },
    },
  },
];

const RUNS_KEY = 'experiment_runs';
const MAX_RUNS = 20;

export function loadExperimentRuns(): ExperimentRun[] {
  try {
    return JSON.parse(localStorage.getItem(RUNS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function saveExperimentRun(run: ExperimentRun): void {
  const runs = loadExperimentRuns();
  const updated = [run, ...runs.filter(r => r.id !== run.id)].slice(0, MAX_RUNS);
  localStorage.setItem(RUNS_KEY, JSON.stringify(updated));
}

export function deleteExperimentRun(id: string): void {
  const runs = loadExperimentRuns().filter(r => r.id !== id);
  localStorage.setItem(RUNS_KEY, JSON.stringify(runs));
}

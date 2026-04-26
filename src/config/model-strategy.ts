export type ModelStrategy = 'all-flash' | 'hybrid-pro' | 'all-pro';

export interface ModelStrategyConfig {
  id: ModelStrategy;
  label: string;
  description: string;
  models: {
    planner: string;
    architect: string;
    compiler: string;
    worker: string;
    auditor: string;
  };
}

export const MODEL_STRATEGIES: Record<ModelStrategy, ModelStrategyConfig> = {
  'all-flash': {
    id: 'all-flash',
    label: 'All Flash',
    description: '빠르고 경제적 — 모든 에이전트 Flash',
    models: {
      planner: 'gemini-2.0-flash',
      architect: 'gemini-2.0-flash',
      compiler: 'gemini-2.0-flash',
      worker: 'gemini-2.0-flash',
      auditor: 'gemini-2.0-flash',
    },
  },
  'hybrid-pro': {
    id: 'hybrid-pro',
    label: 'Hybrid Pro',
    description: '설계+검토만 Pro — 품질↑ 비용 적정',
    models: {
      planner: 'gemini-2.0-flash',
      architect: 'gemini-2.5-pro',
      compiler: 'gemini-2.0-flash',
      worker: 'gemini-2.0-flash',
      auditor: 'gemini-2.5-pro',
    },
  },
  'all-pro': {
    id: 'all-pro',
    label: 'All Pro',
    description: '최고 품질 — 모든 에이전트 Pro (느리고 비쌈)',
    models: {
      planner: 'gemini-2.5-pro',
      architect: 'gemini-2.5-pro',
      compiler: 'gemini-2.5-pro',
      worker: 'gemini-2.5-pro',
      auditor: 'gemini-2.5-pro',
    },
  },
};

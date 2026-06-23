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
      planner: 'gemini-3.5-flash',
      architect: 'gemini-3.5-flash',
      compiler: 'gemini-3.5-flash',
      worker: 'gemini-3.5-flash',
      auditor: 'gemini-3.5-flash',
    },
  },
  'hybrid-pro': {
    id: 'hybrid-pro',
    label: 'Hybrid Pro',
    description: '설계+검토만 Pro — 품질↑ 비용 적정',
    models: {
      planner: 'gemini-3.5-flash',
      architect: 'gemini-3.1-pro',
      compiler: 'gemini-3.5-flash',
      worker: 'gemini-3.5-flash',
      auditor: 'gemini-3.1-pro',
    },
  },
  'all-pro': {
    id: 'all-pro',
    label: 'All Pro',
    description: '최고 품질 — 모든 에이전트 Pro (느리고 비쌈)',
    models: {
      planner: 'gemini-3.1-pro',
      architect: 'gemini-3.1-pro',
      compiler: 'gemini-3.1-pro',
      worker: 'gemini-3.1-pro',
      auditor: 'gemini-3.1-pro',
    },
  },
};

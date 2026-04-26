export type AgentMetricType = 'api-call' | 'message-pass' | 'state-change' | 'error';

export interface AgentMetric {
  id: string;
  experimentId: string;
  agentId: string;
  timestamp: number;
  type: AgentMetricType;

  apiCall?: {
    model: string;
    provider: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    cost: number;
    success: boolean;
    errorMessage?: string;
  };

  messagePass?: {
    from: string;
    to: string;
    contentType: 'gdd' | 'spec' | 'task' | 'code' | 'feedback';
    contentSize: number;
  };

  stateChange?: {
    from: string;
    to: string;
    trigger: string;
  };
}

export interface AgentSummary {
  apiCalls: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  totalLatencyMs: number;
  avgLatencyMs: number;
  errorCount: number;
}

export interface ExperimentSummary {
  experimentId: string;
  totalApiCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  totalLatencyMs: number;
  averageLatencyMs: number;
  errorCount: number;
  errorRate: number;
  byAgent: Record<string, AgentSummary>;
  byModel: Record<string, { apiCalls: number; inputTokens: number; outputTokens: number; cost: number; avgLatencyMs: number }>;
  timeline: {
    timestamp: number;
    cumulativeCost: number;
    cumulativeTokens: number;
    agentId: string;
  }[];
}

type Listener = (metric: AgentMetric) => void;

export class MetricsCollector {
  private metrics: AgentMetric[] = [];
  private listeners: Map<AgentMetricType | 'all', Listener[]> = new Map();

  record(metric: Omit<AgentMetric, 'id' | 'timestamp'>): AgentMetric {
    const full: AgentMetric = {
      ...metric,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
    };
    this.metrics.push(full);
    this.listeners.get(full.type)?.forEach(fn => fn(full));
    this.listeners.get('all')?.forEach(fn => fn(full));
    return full;
  }

  subscribe(eventType: AgentMetricType | 'all', callback: Listener): () => void {
    const arr = this.listeners.get(eventType) ?? [];
    arr.push(callback);
    this.listeners.set(eventType, arr);
    return () => {
      const updated = (this.listeners.get(eventType) ?? []).filter(fn => fn !== callback);
      this.listeners.set(eventType, updated);
    };
  }

  getAll(): AgentMetric[] {
    return [...this.metrics];
  }

  getByExperiment(experimentId: string): AgentMetric[] {
    return this.metrics.filter(m => m.experimentId === experimentId);
  }

  getByAgent(agentId: string): AgentMetric[] {
    return this.metrics.filter(m => m.agentId === agentId);
  }

  getByTimeRange(start: number, end: number): AgentMetric[] {
    return this.metrics.filter(m => m.timestamp >= start && m.timestamp <= end);
  }

  getMessagePasses(experimentId?: string): AgentMetric[] {
    return this.metrics.filter(
      m => m.type === 'message-pass' && (!experimentId || m.experimentId === experimentId),
    );
  }

  getSummary(experimentId: string): ExperimentSummary {
    const calls = this.metrics.filter(
      m => m.experimentId === experimentId && m.type === 'api-call',
    );
    const errors = this.metrics.filter(
      m => m.experimentId === experimentId && m.type === 'error',
    );

    const totalInputTokens = calls.reduce((s, m) => s + (m.apiCall?.inputTokens ?? 0), 0);
    const totalOutputTokens = calls.reduce((s, m) => s + (m.apiCall?.outputTokens ?? 0), 0);
    const totalCost = calls.reduce((s, m) => s + (m.apiCall?.cost ?? 0), 0);
    const totalLatencyMs = calls.reduce((s, m) => s + (m.apiCall?.latencyMs ?? 0), 0);

    // per-agent
    const byAgent: Record<string, AgentSummary> = {};
    for (const m of calls) {
      if (!byAgent[m.agentId]) {
        byAgent[m.agentId] = { apiCalls: 0, inputTokens: 0, outputTokens: 0, cost: 0, totalLatencyMs: 0, avgLatencyMs: 0, errorCount: 0 };
      }
      byAgent[m.agentId].apiCalls++;
      byAgent[m.agentId].inputTokens += m.apiCall?.inputTokens ?? 0;
      byAgent[m.agentId].outputTokens += m.apiCall?.outputTokens ?? 0;
      byAgent[m.agentId].cost += m.apiCall?.cost ?? 0;
      byAgent[m.agentId].totalLatencyMs += m.apiCall?.latencyMs ?? 0;
    }
    for (const id of Object.keys(byAgent)) {
      const s = byAgent[id];
      s.avgLatencyMs = s.apiCalls > 0 ? s.totalLatencyMs / s.apiCalls : 0;
    }

    // per-model
    const byModel: ExperimentSummary['byModel'] = {};
    for (const m of calls) {
      const model = m.apiCall?.model ?? 'unknown';
      if (!byModel[model]) {
        byModel[model] = { apiCalls: 0, inputTokens: 0, outputTokens: 0, cost: 0, avgLatencyMs: 0 };
      }
      byModel[model].apiCalls++;
      byModel[model].inputTokens += m.apiCall?.inputTokens ?? 0;
      byModel[model].outputTokens += m.apiCall?.outputTokens ?? 0;
      byModel[model].cost += m.apiCall?.cost ?? 0;
      byModel[model].avgLatencyMs += m.apiCall?.latencyMs ?? 0;
    }
    for (const model of Object.keys(byModel)) {
      const n = byModel[model].apiCalls;
      if (n > 0) byModel[model].avgLatencyMs /= n;
    }

    // timeline
    let cumCost = 0;
    let cumTokens = 0;
    const sorted = [...calls].sort((a, b) => a.timestamp - b.timestamp);
    const timeline = sorted.map(m => {
      cumCost += m.apiCall?.cost ?? 0;
      cumTokens += (m.apiCall?.inputTokens ?? 0) + (m.apiCall?.outputTokens ?? 0);
      return { timestamp: m.timestamp, cumulativeCost: cumCost, cumulativeTokens: cumTokens, agentId: m.agentId };
    });

    return {
      experimentId,
      totalApiCalls: calls.length,
      totalInputTokens,
      totalOutputTokens,
      totalCost,
      totalLatencyMs,
      averageLatencyMs: calls.length > 0 ? totalLatencyMs / calls.length : 0,
      errorCount: errors.length,
      errorRate: (calls.length + errors.length) > 0 ? errors.length / (calls.length + errors.length) : 0,
      byAgent,
      byModel,
      timeline,
    };
  }

  exportJSON(): string {
    return JSON.stringify(this.metrics, null, 2);
  }

  exportCSV(): string {
    const header = 'id,experimentId,agentId,timestamp,type,model,inputTokens,outputTokens,latencyMs,cost';
    const rows = this.metrics.map(m => [
      m.id, m.experimentId, m.agentId, m.timestamp, m.type,
      m.apiCall?.model ?? '',
      m.apiCall?.inputTokens ?? '',
      m.apiCall?.outputTokens ?? '',
      m.apiCall?.latencyMs ?? '',
      m.apiCall?.cost?.toFixed(6) ?? '',
    ].join(','));
    return [header, ...rows].join('\n');
  }

  clear(experimentId?: string): void {
    if (experimentId) {
      this.metrics = this.metrics.filter(m => m.experimentId !== experimentId);
    } else {
      this.metrics = [];
    }
  }
}

let _collector: MetricsCollector | null = null;

export function getMetricsCollector(): MetricsCollector {
  if (!_collector) _collector = new MetricsCollector();
  return _collector;
}

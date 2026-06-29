import React, { useState, useEffect } from 'react';
import { useWindowContext } from '../context/WindowContext';
import { EMPLOYEES, EMPLOYEE_STATUSES } from '../config/employees';
import { resetAIClient } from '../services/ai-client';
import { getMetricsCollector, AgentSummary } from '../services/metrics-collector';
import { formatCost, formatTokens, formatLatency } from '../services/cost-calculator';
import { ModelStrategy, MODEL_STRATEGIES } from '../config/model-strategy';
import { PipelineProgressBar } from './PipelineProgressBar';

// 2-letter initials per agent
const AGENT_INITIALS: Record<string, string> = {
  planner:  'AL',
  architect: 'SA',
  compiler: 'JO',
  worker:   'CA',
  auditor:  'MO',
};

const STRATEGY_CAPTIONS: Record<ModelStrategy, string> = {
  'all-flash':   'gemini-3.5-flash · 빠르고 경제적',
  'hybrid-pro':  'flash / gemini-3.1-pro · 균형',
  'all-pro':     'gemini-3.1-pro · 최고 품질',
};

function computeByAgent(): Record<string, AgentSummary> {
  const allMetrics = getMetricsCollector().getAll().filter(m => m.type === 'api-call');
  const byAgent: Record<string, AgentSummary> = {};
  for (const m of allMetrics) {
    if (!byAgent[m.agentId]) {
      byAgent[m.agentId] = { apiCalls: 0, inputTokens: 0, outputTokens: 0, cost: 0, totalLatencyMs: 0, avgLatencyMs: 0, errorCount: 0 };
    }
    const s = byAgent[m.agentId];
    s.apiCalls++;
    s.inputTokens  += m.apiCall?.inputTokens ?? 0;
    s.outputTokens += m.apiCall?.outputTokens ?? 0;
    s.cost         += m.apiCall?.cost ?? 0;
    s.totalLatencyMs += m.apiCall?.latencyMs ?? 0;
    s.avgLatencyMs = s.totalLatencyMs / s.apiCalls;
  }
  return byAgent;
}

const BG     = 'var(--surface)';
const BORDER = '0.5px solid var(--line)';
const INK    = 'var(--ink)';
const SOFT   = 'var(--ink-soft)';
const DIV    = '1px solid var(--line)';

export const AgentStatusPanel: React.FC = () => {
  const { agents, addLog, modelStrategy, setModelStrategy } = useWindowContext();
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('ai_api_key') ?? '');
  const [saved,  setSaved]  = useState(!!localStorage.getItem('ai_api_key'));
  const [metricsByAgent, setMetricsByAgent] = useState<Record<string, AgentSummary>>(computeByAgent);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const unsub = getMetricsCollector().subscribe('api-call', () => {
      setMetricsByAgent(computeByAgent());
    });
    return unsub;
  }, []);

  const handleSaveKey = () => {
    localStorage.setItem('ai_api_key', apiKey);
    resetAIClient();
    setSaved(true);
    addLog('API Key 저장 완료', 'success');
  };

  const activeCount = agents.filter(a => a.status !== 'idle').length;
  const idleCount   = agents.filter(a => a.status === 'idle').length;
  const totalCost   = Object.values(metricsByAgent).reduce((s, v) => s + v.cost, 0);

  if (collapsed) {
    return (
      <div
        className="h-full flex flex-col items-center py-3"
        style={{ width: '44px', backgroundColor: BG, borderLeft: BORDER }}
      >
        <button
          onClick={() => setCollapsed(false)}
          style={{
            background: 'none', border: 'none',
            color: SOFT, cursor: 'pointer',
            width: '32px', height: '32px', fontSize: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '6px',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--brand-50)'; e.currentTarget.style.color = 'var(--brand)'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = SOFT; }}
        >
          ◀
        </button>
        <div style={{
          writingMode: 'vertical-rl', fontSize: '12px', fontWeight: 600,
          color: SOFT, marginTop: '12px', letterSpacing: '2px',
        }}>
          STUDIO
        </div>
        <div style={{ marginTop: 'auto', marginBottom: '8px' }}>
          <div style={{
            width: '24px', height: '24px', borderRadius: '12px',
            backgroundColor: activeCount > 0 ? 'var(--brand)' : 'var(--line)',
            color: activeCount > 0 ? '#FFFFFF' : SOFT,
            fontSize: '12px', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {activeCount}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-full flex flex-col"
      style={{ width: '280px', backgroundColor: BG, borderLeft: BORDER, color: INK }}
    >
      {/* ── 헤더 ── */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: DIV }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: INK }}>Live studio</h2>
          <p style={{ fontSize: '12px', color: SOFT, marginTop: '2px' }}>
            {activeCount > 0 ? `${activeCount}명 작업 중` : '파이프라인 대기'}
          </p>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          style={{
            background: 'none', border: 'none',
            color: SOFT, cursor: 'pointer',
            width: '28px', height: '28px', fontSize: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '6px',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--brand-50)'; e.currentTarget.style.color = 'var(--brand)'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = SOFT; }}
        >
          ▶
        </button>
      </div>

      {/* ── API Key ── */}
      <div className="px-4 py-3 space-y-2" style={{ borderBottom: DIV }}>
        <label style={{ fontSize: '13px', fontWeight: 600, color: SOFT }}>
          API Key{saved && <span style={{ color: 'var(--ok)', marginLeft: '6px', fontWeight: 700 }}>✓ Connected</span>}
        </label>
        <div className="flex gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={e => { setApiKey(e.target.value); setSaved(false); }}
            placeholder="AIza..."
            className="flex-1 mono"
            style={{
              fontSize: '12px', padding: '6px 10px',
              backgroundColor: 'var(--bg)',
              border: '1px solid var(--line)',
              borderRadius: '4px',
              color: INK, outline: 'none',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--brand)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--line)'; }}
          />
          <button
            onClick={handleSaveKey}
            disabled={!apiKey.trim()}
            style={{
              fontSize: '12px', padding: '6px 12px', fontWeight: 600,
              backgroundColor: apiKey.trim() ? 'var(--brand)' : 'var(--line)',
              border: 'none', borderRadius: '4px',
              color: apiKey.trim() ? '#FFFFFF' : SOFT,
              cursor: apiKey.trim() ? 'pointer' : 'default',
              opacity: apiKey.trim() ? 1 : 0.6,
              transition: 'all 0.15s',
            }}
          >
            Save
          </button>
        </div>
      </div>

      {/* ── Model Strategy ── */}
      <div className="px-4 py-3 space-y-2" style={{ borderBottom: DIV }}>
        <label style={{ fontSize: '13px', fontWeight: 600, color: SOFT }}>Model Strategy</label>
        <div className="flex gap-1">
          {(Object.keys(MODEL_STRATEGIES) as ModelStrategy[]).map((key) => {
            const s = MODEL_STRATEGIES[key];
            const active = modelStrategy === key;
            return (
              <button
                key={key}
                onClick={() => setModelStrategy(key)}
                title={s.description}
                style={{
                  flex: 1,
                  fontSize: '12px',
                  fontWeight: active ? 700 : 500,
                  padding: '5px 4px',
                  border: active ? '1px solid var(--brand)' : '1px solid var(--line)',
                  borderRadius: '4px',
                  backgroundColor: active ? 'var(--brand-50)' : 'transparent',
                  color: active ? 'var(--brand)' : SOFT,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.backgroundColor = 'var(--brand-50)'; e.currentTarget.style.color = 'var(--brand)'; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = SOFT; } }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        <p className="mono" style={{ fontSize: '12px', color: SOFT, opacity: 0.85 }}>
          {STRATEGY_CAPTIONS[modelStrategy]}
        </p>
      </div>

      {/* ── Pipeline Progress ── */}
      <PipelineProgressBar />

      {/* ── 에이전트 타일 ── */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {agents.map((agent) => {
          const employee = EMPLOYEES[agent.agentId as keyof typeof EMPLOYEES];
          const status   = EMPLOYEE_STATUSES[agent.status as keyof typeof EMPLOYEE_STATUSES] || EMPLOYEE_STATUSES.idle;
          const metrics  = metricsByAgent[agent.agentId];
          const isActive = agent.status !== 'idle';
          const isError  = agent.status === 'error';
          if (!employee) return null;

          const initials  = AGENT_INITIALS[agent.agentId] ?? employee.name.slice(0, 2).toUpperCase();
          const dotColor  = isError ? 'var(--brand)' : isActive ? 'var(--ok)' : 'var(--ink-soft)';
          const agentModel = MODEL_STRATEGIES[modelStrategy].models[agent.agentId as keyof typeof MODEL_STRATEGIES['all-flash']['models']];
          const isPro      = agentModel?.includes('pro') ?? false;

          return (
            <div
              key={agent.agentId}
              style={{
                backgroundColor: isActive ? 'var(--brand-50)' : 'transparent',
                border: isActive ? '1px solid var(--line)' : '1px solid transparent',
                borderRadius: '8px',
                padding: '10px 12px',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg)'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <div className="flex items-center gap-3 mb-2">
                {/* 이니셜 아바타 + 상태 점 */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '16px',
                    backgroundColor: 'var(--brand-50)',
                    border: '1px solid var(--brand)',
                    color: 'var(--brand)',
                    fontSize: '12px', fontWeight: 700, letterSpacing: '0.5px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    lineHeight: 1,
                  }}>
                    {initials}
                  </div>
                  <div style={{
                    position: 'absolute', bottom: '-1px', right: '-1px',
                    width: '10px', height: '10px', borderRadius: '5px',
                    backgroundColor: dotColor,
                    border: '2px solid var(--surface)',
                    opacity: isActive || isError ? 1 : 0.4,
                    transition: 'background-color 0.2s',
                  }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p style={{ fontSize: '14px', fontWeight: 600, color: INK }}>{employee.name}</p>
                    {agentModel && (
                      <span className="mono" style={{
                        fontSize: '11px', fontWeight: 700,
                        padding: '1px 5px', borderRadius: '3px',
                        backgroundColor: isPro ? 'oklch(97% 0.025 90)' : 'var(--brand-50)',
                        color: isPro ? 'oklch(55% 0.13 90)' : SOFT,
                        letterSpacing: '0.5px',
                      }}>
                        {isPro ? 'PRO' : 'FLASH'}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '13px', color: SOFT, marginTop: '1px' }}>{employee.title}</p>
                </div>

                <span style={{
                  fontSize: '12px',
                  color: isError ? 'var(--brand)' : isActive ? 'var(--brand)' : SOFT,
                  fontWeight: isActive ? 600 : 400,
                  flexShrink: 0,
                }}>
                  {isActive ? status.label : '대기'}
                </span>
              </div>

              {agent.currentTask ? (
                <div style={{
                  fontSize: '13px', lineHeight: '18px', padding: '5px 10px',
                  backgroundColor: 'var(--bg)',
                  borderRadius: '4px', borderLeft: '2px solid var(--brand)',
                  color: INK, marginTop: '4px',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {agent.currentTask}
                </div>
              ) : (
                <div style={{ fontSize: '12px', padding: '4px 0', color: SOFT, marginTop: '2px' }}>
                  대기 중...
                </div>
              )}

              {metrics && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {[
                    { label: 'TKN',  value: formatTokens(metrics.inputTokens + metrics.outputTokens) },
                    { label: 'COST', value: formatCost(metrics.cost) },
                    { label: 'AVG',  value: formatLatency(Math.round(metrics.avgLatencyMs)) },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ textAlign: 'center', padding: '4px', backgroundColor: 'var(--bg)', borderRadius: '4px', border: '1px solid var(--line)' }}>
                      <div style={{ fontSize: '11px', color: SOFT, fontWeight: 500 }}>{label}</div>
                      <div className="mono" style={{ fontSize: '12px', color: INK, fontWeight: 600 }}>{value}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── 하단 통계 ── */}
      <div className="px-4 py-3" style={{ borderTop: DIV, fontSize: '13px', color: SOFT }}>
        <div className="flex justify-between mb-1">
          <span>Active <span style={{ color: 'var(--ok)', fontWeight: 700 }}>{activeCount}</span>/{agents.length}</span>
          <span>Idle <span style={{ fontWeight: 600 }}>{idleCount}</span>/{agents.length}</span>
        </div>
        <div className="mono" style={{ fontWeight: 700, color: INK, fontSize: '13px' }}>
          Total Cost: {formatCost(totalCost)}
        </div>
      </div>
    </div>
  );
};

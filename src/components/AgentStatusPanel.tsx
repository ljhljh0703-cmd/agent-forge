import React, { useState, useEffect } from 'react';
import { useWindowContext } from '../context/WindowContext';
import { EMPLOYEES, EMPLOYEE_STATUSES } from '../config/employees';
import { resetAIClient } from '../services/ai-client';
import { getMetricsCollector, AgentSummary } from '../services/metrics-collector';
import { formatCost, formatTokens, formatLatency } from '../services/cost-calculator';
import { ModelStrategy, MODEL_STRATEGIES } from '../config/model-strategy';
import { PipelineProgressBar } from './PipelineProgressBar';

function computeByAgent(): Record<string, AgentSummary> {
  const collector = getMetricsCollector();
  const allMetrics = collector.getAll().filter(m => m.type === 'api-call');
  const byAgent: Record<string, AgentSummary> = {};
  for (const m of allMetrics) {
    if (!byAgent[m.agentId]) {
      byAgent[m.agentId] = { apiCalls: 0, inputTokens: 0, outputTokens: 0, cost: 0, totalLatencyMs: 0, avgLatencyMs: 0, errorCount: 0 };
    }
    const s = byAgent[m.agentId];
    s.apiCalls++;
    s.inputTokens += m.apiCall?.inputTokens ?? 0;
    s.outputTokens += m.apiCall?.outputTokens ?? 0;
    s.cost += m.apiCall?.cost ?? 0;
    s.totalLatencyMs += m.apiCall?.latencyMs ?? 0;
    s.avgLatencyMs = s.totalLatencyMs / s.apiCalls;
  }
  return byAgent;
}

const STRATEGY_CAPTIONS: Record<ModelStrategy, string> = {
  'all-flash': 'gemini-3.5-flash · 빠르고 경제적',
  'hybrid-pro': 'flash/gemini-3.1-pro · 균형',
  'all-pro': 'gemini-3.1-pro · 최고 품질',
};

const PANEL_BG = 'var(--surface)';
const PANEL_BORDER = '0.5px solid var(--line)';
const TEXT_PRIMARY = 'var(--ink)';
const TEXT_MUTED = 'var(--ink-soft)';
const DIVIDER = '1px solid var(--line)';

export const AgentStatusPanel: React.FC = () => {
  const { agents, addLog, modelStrategy, setModelStrategy } = useWindowContext();
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('ai_api_key') ?? '');
  const [saved, setSaved] = useState(!!localStorage.getItem('ai_api_key'));
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
  const idleCount = agents.filter(a => a.status === 'idle').length;
  const totalCost = Object.values(metricsByAgent).reduce((s, v) => s + v.cost, 0);

  if (collapsed) {
    return (
      <div
        className="h-full flex flex-col items-center py-3"
        style={{ width: '44px', backgroundColor: PANEL_BG, borderLeft: PANEL_BORDER }}
      >
        <button
          onClick={() => setCollapsed(false)}
          style={{
            background: 'none', border: 'none',
            color: TEXT_MUTED, cursor: 'pointer',
            width: '32px', height: '32px', fontSize: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '6px',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--brand-50)'; e.currentTarget.style.color = 'var(--brand)'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = TEXT_MUTED; }}
        >
          ◀
        </button>
        <div style={{
          writingMode: 'vertical-rl', fontSize: '11px', fontWeight: 600,
          color: TEXT_MUTED, marginTop: '12px', letterSpacing: '2px',
        }}>
          TEAM
        </div>
        <div style={{ marginTop: 'auto', marginBottom: '8px' }}>
          <div style={{
            width: '24px', height: '24px', borderRadius: '12px',
            backgroundColor: activeCount > 0 ? 'var(--brand)' : 'var(--line)',
            color: activeCount > 0 ? '#FFFFFF' : TEXT_MUTED,
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
      style={{ width: '320px', backgroundColor: PANEL_BG, borderLeft: PANEL_BORDER, color: TEXT_PRIMARY }}
    >
      {/* 헤더 */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: DIVIDER }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: TEXT_PRIMARY }}>Team Status</h2>
          <p style={{ fontSize: '12px', color: TEXT_MUTED, marginTop: '2px' }}>실시간 근무 상태</p>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          style={{
            background: 'none', border: 'none',
            color: TEXT_MUTED, cursor: 'pointer',
            width: '28px', height: '28px', fontSize: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '6px',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--brand-50)'; e.currentTarget.style.color = 'var(--brand)'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = TEXT_MUTED; }}
        >
          ▶
        </button>
      </div>

      {/* API Key 입력 */}
      <div className="px-4 py-3 space-y-2" style={{ borderBottom: DIVIDER }}>
        <label style={{ fontSize: '12px', fontWeight: 600, color: TEXT_MUTED }}>
          API Key {saved && <span style={{ color: 'var(--ok)', marginLeft: '4px' }}>✓ Connected</span>}
        </label>
        <div className="flex gap-2">
          <input
            type="password" value={apiKey}
            onChange={e => { setApiKey(e.target.value); setSaved(false); }}
            placeholder="AIza..."
            className="flex-1 mono"
            style={{
              fontSize: '12px', padding: '6px 10px',
              backgroundColor: 'var(--bg)',
              border: '1px solid var(--line)',
              borderRadius: '4px',
              color: TEXT_PRIMARY, outline: 'none',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--brand)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--line)'; }}
          />
          <button
            onClick={handleSaveKey}
            disabled={!apiKey.trim()}
            style={{
              fontSize: '12px', padding: '6px 14px', fontWeight: 600,
              backgroundColor: apiKey.trim() ? 'var(--brand)' : 'var(--line)',
              border: 'none', borderRadius: '4px',
              color: apiKey.trim() ? '#FFFFFF' : TEXT_MUTED,
              cursor: apiKey.trim() ? 'pointer' : 'default',
              opacity: apiKey.trim() ? 1 : 0.6,
              transition: 'all 0.15s',
            }}
          >
            Save
          </button>
        </div>
      </div>

      {/* 모델 전략 선택 */}
      <div className="px-4 py-3 space-y-2" style={{ borderBottom: DIVIDER }}>
        <label style={{ fontSize: '12px', fontWeight: 600, color: TEXT_MUTED }}>Model Strategy</label>
        <div className="flex gap-1">
          {(Object.keys(MODEL_STRATEGIES) as ModelStrategy[]).map((key) => {
            const s = MODEL_STRATEGIES[key];
            const isSelected = modelStrategy === key;
            return (
              <button
                key={key}
                onClick={() => setModelStrategy(key)}
                title={s.description}
                style={{
                  flex: 1,
                  fontSize: '11px',
                  fontWeight: isSelected ? 700 : 500,
                  padding: '5px 4px',
                  border: isSelected ? '1px solid var(--brand)' : '1px solid var(--line)',
                  borderRadius: '4px',
                  backgroundColor: isSelected ? 'var(--brand-50)' : 'transparent',
                  color: isSelected ? 'var(--brand)' : TEXT_MUTED,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.backgroundColor = 'var(--brand-50)'; e.currentTarget.style.color = 'var(--brand)'; } }}
                onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = TEXT_MUTED; } }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        <p className="mono" style={{ fontSize: '11px', color: TEXT_MUTED, opacity: 0.8 }}>
          {STRATEGY_CAPTIONS[modelStrategy]}
        </p>
      </div>

      {/* 파이프라인 진행률 */}
      <PipelineProgressBar />

      {/* 에이전트 리스트 */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {agents.map((agent) => {
          const employee = EMPLOYEES[agent.agentId as keyof typeof EMPLOYEES];
          const status = EMPLOYEE_STATUSES[agent.status as keyof typeof EMPLOYEE_STATUSES] || EMPLOYEE_STATUSES.idle;
          const metrics = metricsByAgent[agent.agentId];
          const isActive = agent.status !== 'idle';
          if (!employee) return null;

          const initial = employee.name.charAt(0).toUpperCase();

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
                {/* 이니셜 아바타 */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '16px',
                    backgroundColor: 'var(--brand-50)',
                    border: '1px solid var(--brand)',
                    color: 'var(--brand)',
                    fontSize: '14px', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    lineHeight: 1,
                  }}>
                    {initial}
                  </div>
                  {/* 상태 점 */}
                  <div style={{
                    position: 'absolute', bottom: '-1px', right: '-1px',
                    width: '10px', height: '10px', borderRadius: '5px',
                    backgroundColor: isActive ? 'var(--ok)' : 'var(--ink-soft)',
                    border: '2px solid var(--surface)',
                    opacity: isActive ? 1 : 0.5,
                  }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p style={{ fontSize: '14px', fontWeight: 600, color: TEXT_PRIMARY }}>{employee.name}</p>
                    {(() => {
                      const agentModel = MODEL_STRATEGIES[modelStrategy].models[agent.agentId as keyof typeof MODEL_STRATEGIES['all-flash']['models']];
                      if (!agentModel) return null;
                      const isPro = agentModel.includes('pro');
                      return (
                        <span className="mono" style={{
                          fontSize: '9px', fontWeight: 700,
                          padding: '1px 5px', borderRadius: '3px',
                          backgroundColor: isPro ? 'oklch(97% 0.025 90)' : 'var(--brand-50)',
                          color: isPro ? 'oklch(55% 0.13 90)' : TEXT_MUTED,
                          letterSpacing: '0.5px',
                        }}>
                          {isPro ? 'PRO' : 'FLASH'}
                        </span>
                      );
                    })()}
                  </div>
                  <p style={{ fontSize: '12px', color: TEXT_MUTED, marginTop: '1px' }}>{employee.title}</p>
                </div>

                {/* 상태 텍스트 (이모지 없음) */}
                <span style={{ fontSize: '11px', color: isActive ? 'var(--brand)' : TEXT_MUTED, fontWeight: isActive ? 600 : 400, flexShrink: 0 }}>
                  {isActive ? status.label : '대기'}
                </span>
              </div>

              {agent.currentTask ? (
                <div style={{
                  fontSize: '12px', lineHeight: '18px', padding: '5px 10px',
                  backgroundColor: 'var(--bg)',
                  borderRadius: '4px', borderLeft: '2px solid var(--brand)',
                  color: TEXT_PRIMARY, marginTop: '4px',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {agent.currentTask}
                </div>
              ) : (
                <div style={{ fontSize: '12px', padding: '4px 0', color: TEXT_MUTED, marginTop: '2px' }}>
                  대기 중...
                </div>
              )}

              {metrics && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {[
                    { label: 'TKN', value: formatTokens(metrics.inputTokens + metrics.outputTokens) },
                    { label: 'COST', value: formatCost(metrics.cost) },
                    { label: 'AVG', value: formatLatency(Math.round(metrics.avgLatencyMs)) },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ textAlign: 'center', padding: '4px', backgroundColor: 'var(--bg)', borderRadius: '4px', border: '1px solid var(--line)' }}>
                      <div style={{ fontSize: '10px', color: TEXT_MUTED, fontWeight: 500 }}>{label}</div>
                      <div className="mono" style={{ fontSize: '11px', color: TEXT_PRIMARY, fontWeight: 600 }}>{value}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 하단 통계 */}
      <div className="px-4 py-3" style={{ borderTop: DIVIDER, fontSize: '12px', color: TEXT_MUTED }}>
        <div className="flex justify-between mb-1">
          <span>Active <span style={{ color: 'var(--ok)', fontWeight: 700 }}>{activeCount}</span>/{agents.length}</span>
          <span>Idle <span style={{ fontWeight: 600 }}>{idleCount}</span>/{agents.length}</span>
        </div>
        <div className="mono" style={{ fontWeight: 600, color: TEXT_PRIMARY, fontSize: '12px' }}>
          Total Cost: {formatCost(totalCost)}
        </div>
      </div>
    </div>
  );
};

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

// Slack 스타일 진행률 바
const ProgressBar: React.FC<{ current: number; max: number; color: string; label: string }> = ({ current, max, color, label }) => {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  return (
    <div style={{ marginBottom: '4px' }}>
      <div className="flex justify-between" style={{ fontSize: '11px', color: '#616061', marginBottom: '2px' }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600 }}>{current}</span>
      </div>
      <div style={{ height: '6px', backgroundColor: '#EEEEEE', borderRadius: '3px' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          backgroundColor: color,
          borderRadius: '3px',
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );
};

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
    addLog('🔑 API Key 저장 완료', 'success');
  };

  const activeCount = agents.filter(a => a.status !== 'idle').length;
  const idleCount = agents.filter(a => a.status === 'idle').length;
  const totalCost = Object.values(metricsByAgent).reduce((s, v) => s + v.cost, 0);

  // 접힌 상태
  if (collapsed) {
    return (
      <div
        className="h-full flex flex-col items-center py-3"
        style={{
          width: '44px',
          backgroundColor: '#3F0E40',
        }}
      >
        <button
          onClick={() => setCollapsed(false)}
          style={{
            background: 'none', border: 'none',
            color: '#FFFFFF', cursor: 'pointer',
            width: '32px', height: '32px', fontSize: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '6px',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#522653'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          ◀
        </button>
        <div style={{
          writingMode: 'vertical-rl', fontSize: '11px', fontWeight: 600,
          color: 'rgba(255,255,255,0.7)', marginTop: '12px', letterSpacing: '2px',
        }}>
          TEAM
        </div>
        <div style={{ marginTop: 'auto', marginBottom: '8px' }}>
          <div style={{
            width: '24px', height: '24px', borderRadius: '12px',
            backgroundColor: activeCount > 0 ? '#007A5A' : '#522653',
            color: '#FFFFFF', fontSize: '12px', fontWeight: 700,
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
      style={{
        width: '320px',
        backgroundColor: '#3F0E40',
        color: '#FFFFFF',
      }}
    >
      {/* 헤더 */}
      <div className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
      >
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF' }}>
            Team Status
          </h2>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
            실시간 근무 상태
          </p>
        </div>
        <button onClick={() => setCollapsed(true)}
          style={{
            background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
            width: '28px', height: '28px', fontSize: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '6px',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#522653'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          ▶
        </button>
      </div>

      {/* API Key 입력 */}
      <div className="px-4 py-3 space-y-2"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
      >
        <label style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
          API Key {saved && <span style={{ color: '#007A5A', marginLeft: '4px' }}>✓ Connected</span>}
        </label>
        <div className="flex gap-2">
          <input
            type="password" value={apiKey}
            onChange={e => { setApiKey(e.target.value); setSaved(false); }}
            placeholder="AIza..."
            className="flex-1 font-mono"
            style={{
              fontSize: '13px', padding: '6px 10px',
              backgroundColor: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '4px',
              color: '#FFFFFF', outline: 'none',
            }}
          />
          <button onClick={handleSaveKey} disabled={!apiKey.trim()}
            style={{
              fontSize: '13px', padding: '6px 14px', fontWeight: 600,
              backgroundColor: apiKey.trim() ? '#007A5A' : 'rgba(255,255,255,0.1)',
              border: 'none', borderRadius: '4px',
              color: '#FFFFFF', cursor: apiKey.trim() ? 'pointer' : 'default',
              opacity: apiKey.trim() ? 1 : 0.4,
            }}
          >
            Save
          </button>
        </div>
      </div>

      {/* 모델 전략 선택 */}
      <div className="px-4 py-3 space-y-2"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
      >
        <label style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
          Model Strategy
        </label>
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
                  fontWeight: 600,
                  padding: '5px 4px',
                  border: isSelected ? '1px solid #007A5A' : '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '4px',
                  backgroundColor: isSelected ? '#007A5A' : 'rgba(255,255,255,0.06)',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
          {MODEL_STRATEGIES[modelStrategy].description}
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

          return (
            <div key={agent.agentId} style={{
              backgroundColor: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
              borderRadius: '8px',
              padding: '10px 12px',
              transition: 'background-color 0.2s',
            }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div style={{ position: 'relative' }}>
                  <span style={{ fontSize: '24px' }}>{employee.emoji}</span>
                  {/* 온라인 상태 점 */}
                  <div style={{
                    position: 'absolute', bottom: '-2px', right: '-2px',
                    width: '10px', height: '10px', borderRadius: '5px',
                    backgroundColor: isActive ? '#007A5A' : '#616061',
                    border: '2px solid #3F0E40',
                  }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>{employee.name}</p>
                    {(() => {
                      const agentModel = MODEL_STRATEGIES[modelStrategy].models[agent.agentId as keyof typeof MODEL_STRATEGIES['all-flash']['models']];
                      if (!agentModel) return null;
                      const isPro = agentModel.includes('pro');
                      return (
                        <span style={{
                          fontSize: '9px', fontWeight: 700,
                          padding: '1px 5px', borderRadius: '3px',
                          backgroundColor: isPro ? 'rgba(255,180,0,0.25)' : 'rgba(255,255,255,0.1)',
                          color: isPro ? '#FFB400' : 'rgba(255,255,255,0.5)',
                          letterSpacing: '0.5px',
                        }}>
                          {isPro ? 'PRO' : 'FLASH'}
                        </span>
                      );
                    })()}
                  </div>
                  <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '1px' }}>{employee.title}</p>
                </div>
                <span style={{ fontSize: '16px' }}>{status.icon}</span>
              </div>

              {metrics && (
                <ProgressBar
                  current={metrics.apiCalls}
                  max={Math.max(metrics.apiCalls, 10)}
                  color={isActive ? '#1264A3' : 'rgba(255,255,255,0.2)'}
                  label="Calls"
                />
              )}

              {agent.currentTask ? (
                <div style={{
                  fontSize: '12px', lineHeight: '18px', padding: '6px 10px',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderRadius: '4px', borderLeft: '3px solid #1264A3',
                  color: 'rgba(255,255,255,0.8)', marginTop: '4px',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {agent.currentTask}
                </div>
              ) : (
                <div style={{
                  fontSize: '12px', padding: '6px 10px',
                  color: 'rgba(255,255,255,0.3)', marginTop: '4px',
                }}>
                  대기 중...
                </div>
              )}

              {metrics && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div style={{ textAlign: 'center', padding: '4px', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '4px' }}>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>TKN</div>
                    <div style={{ fontSize: '12px', color: '#FFFFFF', fontWeight: 600 }}>{formatTokens(metrics.inputTokens + metrics.outputTokens)}</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '4px', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '4px' }}>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>COST</div>
                    <div style={{ fontSize: '12px', color: '#FFFFFF', fontWeight: 600 }}>{formatCost(metrics.cost)}</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '4px', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '4px' }}>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>AVG</div>
                    <div style={{ fontSize: '12px', color: '#FFFFFF', fontWeight: 600 }}>{formatLatency(Math.round(metrics.avgLatencyMs))}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 하단 통계 */}
      <div className="px-4 py-3" style={{
        borderTop: '1px solid rgba(255,255,255,0.1)',
        fontSize: '12px', color: 'rgba(255,255,255,0.6)',
      }}>
        <div className="flex justify-between mb-1">
          <span>Active <span style={{ color: '#007A5A', fontWeight: 600 }}>{activeCount}</span>/{agents.length}</span>
          <span>Idle <span style={{ fontWeight: 600 }}>{idleCount}</span>/{agents.length}</span>
        </div>
        <div style={{ fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>Total Cost: {formatCost(totalCost)}</div>
      </div>
    </div>
  );
};

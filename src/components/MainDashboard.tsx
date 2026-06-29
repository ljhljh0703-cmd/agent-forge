import React, { useState, useEffect } from 'react';
import { useWindowContext } from '../context/WindowContext';
import { getMetricsCollector } from '../services/metrics-collector';
import { formatCost, formatTokens } from '../services/cost-calculator';
import type { DomainMode } from '../config/domain-mode';

const STAGE_LABELS: Record<DomainMode, string[]> = {
  game: ['GDD', 'SPEC', 'Plan', 'Code', 'QA'],
  software: ['PRD', 'Arch', 'Plan', 'Code', 'Review'],
  docs: ['Scope', 'Analysis', 'Plan', 'Docs', 'Verify'],
};

const AGENT_IDS = ['planner', 'architect', 'compiler', 'worker', 'auditor'] as const;
type StageStatus = 'completed' | 'active' | 'error' | 'pending';

function computeTotalCost(): number {
  return getMetricsCollector()
    .getAll()
    .filter(m => m.type === 'api-call')
    .reduce((s, m) => s + (m.apiCall?.cost ?? 0), 0);
}

function computeTotalTokens(): number {
  return getMetricsCollector()
    .getAll()
    .filter(m => m.type === 'api-call')
    .reduce((s, m) => s + (m.apiCall?.inputTokens ?? 0) + (m.apiCall?.outputTokens ?? 0), 0);
}

export const MainDashboard: React.FC = () => {
  const { agents, pipeline, domainMode } = useWindowContext();
  const labels = STAGE_LABELS[domainMode];
  const [totalCost, setTotalCost] = useState(computeTotalCost);
  const [totalTokens, setTotalTokens] = useState(computeTotalTokens);

  useEffect(() => {
    const unsub = getMetricsCollector().subscribe('api-call', () => {
      setTotalCost(computeTotalCost());
      setTotalTokens(computeTotalTokens());
    });
    return unsub;
  }, []);

  const getStageStatus = (idx: number): StageStatus => {
    const agent = agents.find(a => a.agentId === AGENT_IDS[idx]);
    if (!agent) return 'pending';
    if (agent.status === 'error') return 'error';
    const artifacts = [
      !!pipeline.gdd,
      !!pipeline.spec,
      !!pipeline.executionPlan,
      pipeline.generatedCode.length > 0,
      !!pipeline.auditResult,
    ];
    if (artifacts[idx]) return 'completed';
    if (agent.status !== 'idle') return 'active';
    return 'pending';
  };

  const stages = AGENT_IDS.map((_, i) => getStageStatus(i));

  const statusColor = (s: StageStatus): string => {
    switch (s) {
      case 'completed': return 'var(--ok)';
      case 'active':    return 'var(--brand)';
      case 'error':     return '#E01E5A';
      default:          return 'var(--line)';
    }
  };

  const debtScore = pipeline.auditResult?.score ?? null;
  const debtRec   = pipeline.auditResult?.recommendation ?? null;
  const debtLabel = debtScore === null ? '[미실행]' : debtRec === 'pass' ? 'PASS' : 'FIX';
  const debtColor = debtScore === null ? 'var(--ink-soft)' : debtRec === 'pass' ? 'var(--ok)' : '#E01E5A';
  const loopCount = pipeline.loopCount;

  const metricCards = [
    {
      label: 'DEBT SCORE',
      value: debtScore !== null ? `${debtScore}` : '—',
      unit: debtScore !== null ? '/10' : '',
      sub: debtLabel,
      subColor: debtColor,
    },
    {
      label: 'TOTAL COST',
      value: totalCost === 0 ? '—' : formatCost(totalCost),
      unit: '',
      sub: 'USD · 이번 세션',
      subColor: 'var(--ink-soft)',
    },
    {
      label: 'LOOP BACK',
      value: `${loopCount}`,
      unit: '',
      sub: 'Auditor 재실행',
      subColor: loopCount > 0 ? '#E01E5A' : 'var(--ink-soft)',
      valueColor: loopCount > 0 ? '#E01E5A' : 'var(--ink)',
    },
    {
      label: 'TOKENS',
      value: totalTokens === 0 ? '—' : formatTokens(totalTokens),
      unit: '',
      sub: '입력+출력 합계',
      subColor: 'var(--ink-soft)',
    },
  ];

  return (
    <div
      className="absolute inset-0 overflow-auto"
      style={{ backgroundColor: 'var(--bg)', padding: '28px 32px' }}
    >
      {/* ── Pipeline ──────────────────────────── */}
      <div style={{ marginBottom: '32px', maxWidth: '620px' }}>
        <div style={{
          fontSize: '11px', fontWeight: 700, letterSpacing: '2px',
          color: 'var(--ink-soft)', marginBottom: '20px',
          textTransform: 'uppercase',
        }}>
          Pipeline
        </div>

        {/* Nodes + lines */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {stages.map((status, idx) => (
            <React.Fragment key={idx}>
              <div style={{ flex: '0 0 auto' }}>
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  backgroundColor: statusColor(status),
                  boxShadow: status === 'active' ? '0 0 0 6px var(--brand-50)' : 'none',
                  transition: 'all 0.3s',
                  animation: status === 'active' ? 'pulse-dot 1.5s ease-in-out infinite' : 'none',
                }} />
              </div>
              {idx < 4 && (
                <div style={{
                  flex: 1, height: '2px', minWidth: '28px',
                  backgroundColor: stages[idx] === 'completed' ? 'var(--ok)' : 'var(--line)',
                  transition: 'background-color 0.3s',
                }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Stage labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', maxWidth: '100%' }}>
          {labels.map((label, idx) => (
            <div key={idx} style={{
              textAlign: 'center',
              fontSize: '13px',
              fontWeight: stages[idx] === 'active' ? 700 : 500,
              color: stages[idx] === 'error'   ? '#E01E5A'
                   : stages[idx] === 'pending' ? 'var(--line)'
                   : stages[idx] === 'active'  ? 'var(--brand)'
                   : 'var(--ink-soft)',
              minWidth: '24px',
              transition: 'color 0.3s',
            }}>
              {label}
            </div>
          ))}
        </div>

        {loopCount > 0 && (
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#E01E5A', fontWeight: 600 }}>
            Auditor re-run: {loopCount}x
          </div>
        )}
      </div>

      {/* ── Metrics cards ─────────────────────── */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {metricCards.map(({ label, value, unit, sub, subColor, valueColor }) => (
          <div key={label} style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: '10px',
            padding: '18px 22px',
            minWidth: '148px',
          }}>
            <div style={{
              fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px',
              color: 'var(--ink-soft)', marginBottom: '10px',
              textTransform: 'uppercase',
            }}>
              {label}
            </div>
            <div className="mono" style={{
              fontSize: '32px', fontWeight: 700,
              color: valueColor ?? 'var(--ink)',
              lineHeight: 1,
            }}>
              {value}
              {unit && (
                <span style={{ fontSize: '16px', color: 'var(--ink-soft)', fontWeight: 400, marginLeft: '3px' }}>
                  {unit}
                </span>
              )}
            </div>
            <div style={{ fontSize: '12px', color: subColor, marginTop: '8px', fontWeight: subColor !== 'var(--ink-soft)' ? 600 : 400 }}>
              {sub}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

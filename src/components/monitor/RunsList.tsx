import React from 'react';
import { useMonitor } from '../../context/MonitorContext';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function toTitleCase(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

const ReachBadge: React.FC<{ pass: boolean }> = ({ pass }) => (
  <span style={{
    fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: '10px',
    backgroundColor: pass ? 'oklch(95% 0.03 145)' : 'oklch(96% 0.02 20)',
    color: pass ? 'var(--ok)' : '#E01E5A',
    letterSpacing: '0.3px', flexShrink: 0,
  }}>
    {pass ? 'REACH OK' : 'REACH FAIL'}
  </span>
);

const ScopeBadge: React.FC<{ status: string }> = ({ status }) => {
  const color = status === 'in_scope' ? 'var(--ok)' : status === 'downscoped' ? 'oklch(55% 0.14 80)' : '#E01E5A';
  const bg    = status === 'in_scope' ? 'oklch(95% 0.03 145)' : status === 'downscoped' ? 'oklch(97% 0.04 80)' : 'oklch(96% 0.02 20)';
  const label = status === 'in_scope' ? 'IN SCOPE' : status === 'downscoped' ? 'DOWNSCOPED' : 'FLAGGED';
  return (
    <span style={{
      fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: '10px',
      backgroundColor: bg, color, letterSpacing: '0.3px', flexShrink: 0,
    }}>
      {label}
    </span>
  );
};

export const RunsList: React.FC = () => {
  const { runs, loading, selectedRunId, setSelectedRunId } = useMonitor();

  if (loading) return (
    <div style={{ padding: '16px', color: 'var(--ink-soft)', fontSize: '13px' }}>로딩 중...</div>
  );

  if (runs.length === 0) return (
    <div style={{ padding: '16px', color: 'var(--ink-soft)', fontSize: '13px', lineHeight: 1.6 }}>
      run이 없습니다.<br />
      오케스트레이터(CLI)로 게임을 생성하면 여기에 표시됩니다.
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%', overflow: 'auto' }}>
      {runs.map(run => {
        const isSelected = run.runId === selectedRunId;
        const tplCount   = run.usedTemplates?.length ?? 0;
        return (
          <div
            key={run.runId}
            onClick={() => setSelectedRunId(isSelected ? null : run.runId)}
            style={{
              padding: '12px 14px', borderRadius: '8px', flexShrink: 0,
              border: `1px solid ${isSelected ? 'var(--brand)' : 'var(--line)'}`,
              backgroundColor: isSelected ? 'var(--brand-50)' : 'var(--surface)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.backgroundColor = 'var(--bg)'; e.currentTarget.style.borderColor = 'var(--ink-soft)'; } }}
            onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.backgroundColor = 'var(--surface)'; e.currentTarget.style.borderColor = 'var(--line)'; } }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px', gap: '8px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: isSelected ? 'var(--brand)' : 'var(--ink)', lineHeight: 1.3 }}>
                {toTitleCase(run.idea)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--ink-soft)', flexShrink: 0, marginTop: '2px' }}>
                {formatDate(run.createdAt)}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', alignItems: 'center' }}>
              <ReachBadge pass={run.reachabilityProof?.pass ?? false} />
              <ScopeBadge status={run.templateApiCheck?.status ?? 'in_scope'} />
              {tplCount > 0 && (
                <span style={{
                  fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: '10px',
                  backgroundColor: 'oklch(97% 0.02 250)', color: 'oklch(50% 0.12 250)',
                  letterSpacing: '0.3px',
                }}>
                  T×{tplCount}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

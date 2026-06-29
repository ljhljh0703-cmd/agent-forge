import React from 'react';
import { useMonitor } from '../../context/MonitorContext';

export const EvolutionLibrary: React.FC = () => {
  const { memory, loading } = useMonitor();

  if (loading) return (
    <div style={{ padding: '16px', color: 'var(--ink-soft)', fontSize: '13px' }}>로딩 중...</div>
  );
  if (!memory) return (
    <div style={{ padding: '16px', color: 'var(--ink-soft)', fontSize: '13px' }}>studio-memory 없음</div>
  );

  const templates  = memory.templates?.templates ?? [];
  const candidates = memory.ruleCandidates?.candidates ?? [];
  const stableN    = memory.templates?.stableThresholdProjects ?? 5;

  return (
    <div style={{ height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Templates */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', color: 'var(--ink-soft)', marginBottom: '12px', textTransform: 'uppercase' }}>
          Templates ({templates.length}) — stability {stableN}회 이상이면 stable
        </div>
        {templates.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--ink-soft)' }}>템플릿 없음</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {templates.map(t => {
              const stabPct  = Math.min(100, (t.stability / stableN) * 100);
              const isStable = t.status === 'stable';
              return (
                <div key={t.id} style={{
                  padding: '14px 16px', borderRadius: '8px',
                  border: `1px solid ${isStable ? 'var(--ok)' : 'var(--line)'}`,
                  backgroundColor: 'var(--surface)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.4, flex: 1, marginRight: '10px', fontFamily: 'monospace' }}>
                      {t.id}
                    </div>
                    <span style={{
                      fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', flexShrink: 0,
                      backgroundColor: isStable ? 'oklch(95% 0.03 145)' : 'oklch(97% 0.04 80)',
                      color: isStable ? 'var(--ok)' : 'oklch(50% 0.14 80)',
                    }}>
                      {isStable ? 'STABLE' : 'CANDIDATE'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginBottom: '10px' }}>
                    {t.description}
                  </div>
                  {/* Stability bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1, height: '4px', borderRadius: '2px', backgroundColor: 'var(--line)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${stabPct}%`, borderRadius: '2px',
                        backgroundColor: isStable ? 'var(--ok)' : 'var(--brand)',
                        transition: 'width 0.4s',
                      }} />
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--ink-soft)', flexShrink: 0, fontFamily: 'monospace', fontWeight: 600 }}>
                      {t.stability}/{stableN}
                    </div>
                  </div>
                  {t.sourceRuns.length > 0 && (
                    <div style={{ fontSize: '10px', color: 'var(--ink-soft)', marginTop: '6px', opacity: 0.6, fontFamily: 'monospace' }}>
                      {t.sourceRuns.map(r => r.split('-').slice(-3).join('-')).join(' · ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Rule Candidates */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', color: 'var(--ink-soft)', marginBottom: '12px', textTransform: 'uppercase' }}>
          Rule Candidates ({candidates.length}) — HITL 승격 대기
        </div>
        {candidates.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--ink-soft)' }}>룰 후보 없음</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {candidates.map(c => (
              <div key={c.id} style={{
                padding: '14px 16px', borderRadius: '8px',
                border: '1px solid #E01E5A',
                backgroundColor: 'oklch(99% 0.003 20)',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px', gap: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ink-soft)', fontFamily: 'monospace', flex: 1 }}>
                    {c.errorSignature}
                  </div>
                  <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                    <span style={{
                      fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
                      backgroundColor: '#E01E5A', color: '#FFF',
                    }}>
                      HITL 대기
                    </span>
                    <span style={{
                      fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
                      backgroundColor: 'oklch(96% 0.02 20)', color: '#E01E5A', fontFamily: 'monospace',
                    }}>
                      ×{c.occurrences}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--ink)', lineHeight: 1.55, marginBottom: '10px' }}>
                  {c.proposedRule}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--ink-soft)', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                  <span>timing: <strong>{c.checkTiming}</strong></span>
                  <span>active: <strong style={{ color: '#E01E5A' }}>no (staged only)</strong></span>
                  <span>requires HITL: <strong>{c.requiresHitl ? 'yes' : 'no'}</strong></span>
                </div>
                {c.activationNote && (
                  <div style={{ fontSize: '11px', color: 'var(--ink-soft)', marginTop: '8px', opacity: 0.7, fontStyle: 'italic', lineHeight: 1.5 }}>
                    {c.activationNote}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

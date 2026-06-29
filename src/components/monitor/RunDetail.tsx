import React, { useState } from 'react';
import { useMonitor } from '../../context/MonitorContext';

type Tab = 'gdd' | 'proof' | 'assets';

function toTitleCase(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

export const RunDetail: React.FC = () => {
  const { runs, selectedRunId } = useMonitor();
  const [tab, setTab]             = useState<Tab>('gdd');
  const [gameLoaded, setGameLoaded] = useState(false);

  const run = runs.find(r => r.runId === selectedRunId);

  if (!run) {
    return (
      <div style={{
        height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--ink-soft)', fontSize: '13px', textAlign: 'center', padding: '24px',
      }}>
        ← 왼쪽에서 run을 선택하세요
      </div>
    );
  }

  const gameSrc     = `/api/runs-static/${run.runId}/game/index.html`;
  const spriteSrc   = `/api/runs-static/${run.runId}/assets/codex-sprite.png`;
  const snapshotSrc = `/api/runs-static/${run.runId}/proof/snapshot.png`;

  const proof            = run.reachabilityProof;
  const templateApiCheck = run.templateApiCheck;

  const TabBtn: React.FC<{ t: Tab; label: string }> = ({ t, label }) => (
    <button
      onClick={() => setTab(t)}
      style={{
        fontSize: '12px', fontWeight: tab === t ? 700 : 500,
        padding: '5px 14px', borderRadius: '4px',
        border: `1px solid ${tab === t ? 'var(--brand)' : 'var(--line)'}`,
        backgroundColor: tab === t ? 'var(--brand-50)' : 'transparent',
        color: tab === t ? 'var(--brand)' : 'var(--ink-soft)',
        cursor: 'pointer', transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 헤더 */}
      <div style={{ flexShrink: 0, marginBottom: '10px' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)' }}>
          {toTitleCase(run.idea)}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--ink-soft)', marginTop: '2px', fontFamily: 'monospace', opacity: 0.7 }}>
          {run.runId}
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0, marginBottom: '12px' }}>
        <TabBtn t="gdd" label="GDD + 게임" />
        <TabBtn t="proof" label="Proof" />
        <TabBtn t="assets" label="Assets" />
      </div>

      {/* 콘텐츠 */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {tab === 'gdd' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden' }}>
            {/* GDD 텍스트 */}
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', backgroundColor: 'var(--bg)', border: '1px solid var(--line)', borderRadius: '6px', padding: '14px 16px' }}>
              <pre style={{ fontSize: '12px', color: 'var(--ink)', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, fontFamily: 'inherit' }}>
                {run.gddText || '(GDD 없음)'}
              </pre>
            </div>
            {/* 게임 미리보기 */}
            <div style={{ flexShrink: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', color: 'var(--ink-soft)', marginBottom: '6px', textTransform: 'uppercase' }}>
                게임 미리보기 (iframe sandbox)
              </div>
              <div style={{ position: 'relative', border: '1px solid var(--line)', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#111', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {!gameLoaded ? (
                  <button
                    onClick={() => setGameLoaded(true)}
                    style={{
                      fontSize: '13px', fontWeight: 600, padding: '8px 20px',
                      backgroundColor: 'var(--brand)', color: '#FFF',
                      border: 'none', borderRadius: '6px', cursor: 'pointer',
                    }}
                  >
                    게임 로드
                  </button>
                ) : (
                  <iframe
                    src={gameSrc}
                    sandbox="allow-scripts"
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    title={`game-${run.runId}`}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'proof' && (
          <div style={{ height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Reachability */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', color: 'var(--ink-soft)', marginBottom: '8px', textTransform: 'uppercase' }}>
                Reachability Proof
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {([
                  ['playerMoves',      proof?.playerMoves],
                  ['scoreChanges',     proof?.scoreChanges],
                  ['winReachable',     proof?.winReachable],
                  ['failReachable',    proof?.failReachable],
                  ['terminalReachable',proof?.terminalReachable],
                ] as [string, boolean | undefined][]).map(([key, val]) => (
                  <div key={key} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--line)',
                    backgroundColor: 'var(--bg)',
                  }}>
                    <span style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>{key}</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: val ? 'var(--ok)' : '#E01E5A' }}>
                      {val ? 'ok' : 'fail'}
                    </span>
                  </div>
                ))}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: '6px',
                  border: `1px solid ${proof?.pass ? 'var(--ok)' : '#E01E5A'}`,
                  backgroundColor: proof?.pass ? 'oklch(95% 0.03 145)' : 'oklch(96% 0.02 20)',
                }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: proof?.pass ? 'var(--ok)' : '#E01E5A' }}>OVERALL</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: proof?.pass ? 'var(--ok)' : '#E01E5A' }}>
                    {proof?.pass ? 'PASS' : 'FAIL'}
                  </span>
                </div>
              </div>
            </div>

            {/* Template API Check */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', color: 'var(--ink-soft)', marginBottom: '8px', textTransform: 'uppercase' }}>
                Template API Check
              </div>
              <div style={{ padding: '12px 14px', borderRadius: '6px', border: '1px solid var(--line)', backgroundColor: 'var(--bg)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ok)', marginBottom: '6px' }}>
                  In Scope ({templateApiCheck?.inScope.length ?? 0})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
                  {templateApiCheck?.inScope.map(s => (
                    <span key={s} style={{ padding: '2px 7px', borderRadius: '4px', backgroundColor: 'oklch(95% 0.03 145)', color: 'var(--ok)', fontSize: '11px' }}>{s}</span>
                  ))}
                </div>
                {(templateApiCheck?.flagged.length ?? 0) > 0 && (
                  <>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#E01E5A', marginBottom: '6px' }}>
                      Flagged ({templateApiCheck?.flagged.length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {templateApiCheck?.flagged.map(s => (
                        <span key={s} style={{ padding: '2px 7px', borderRadius: '4px', backgroundColor: 'oklch(96% 0.02 20)', color: '#E01E5A', fontSize: '11px' }}>{s}</span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Used Templates */}
            {(run.usedTemplates?.length ?? 0) > 0 && (
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', color: 'var(--ink-soft)', marginBottom: '8px', textTransform: 'uppercase' }}>
                  Used Templates
                </div>
                {run.usedTemplates.map(t => (
                  <div key={t.id} style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--line)', backgroundColor: 'var(--bg)', fontSize: '12px', marginBottom: '6px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: '2px', fontFamily: 'monospace', fontSize: '11px' }}>{t.id}</div>
                    <div style={{ color: 'var(--ink-soft)' }}>{t.description}</div>
                    <div style={{ fontSize: '11px', color: 'var(--ink-soft)', marginTop: '4px', opacity: 0.7 }}>
                      stability at use: {t.stabilityAtUse}/5 · {t.statusAtUse}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'assets' && (
          <div style={{ height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Sprite */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', color: 'var(--ink-soft)', marginBottom: '8px', textTransform: 'uppercase' }}>
                Codex Sprite (agent-sprite-forge)
              </div>
              <div style={{
                border: '1px solid var(--line)', borderRadius: '6px', overflow: 'hidden',
                backgroundColor: 'oklch(10% 0 0)', padding: '16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100px',
              }}>
                <img
                  src={spriteSrc}
                  alt="codex-sprite"
                  style={{ imageRendering: 'pixelated', maxWidth: '100%', maxHeight: '200px' }}
                  onError={e => { (e.target as HTMLImageElement).alt = '스프라이트 없음'; }}
                />
              </div>
            </div>
            {/* Snapshot */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', color: 'var(--ink-soft)', marginBottom: '8px', textTransform: 'uppercase' }}>
                Proof Snapshot
              </div>
              <div style={{ border: '1px solid var(--line)', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#000' }}>
                <img
                  src={snapshotSrc}
                  alt="proof-snapshot"
                  style={{ width: '100%', display: 'block' }}
                  onError={e => {
                    const el = e.target as HTMLImageElement;
                    el.style.display = 'none';
                    el.insertAdjacentHTML('afterend', '<div style="padding:16px;font-size:12px;color:var(--ink-soft);text-align:center;">스냅샷 없음</div>');
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

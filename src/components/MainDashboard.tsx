import React, { useState, useEffect } from 'react';
import { useWindowContext } from '../context/WindowContext';
import { getMetricsCollector } from '../services/metrics-collector';
import { formatCost, formatTokens } from '../services/cost-calculator';
import type { DomainMode } from '../config/domain-mode';
import { useMonitor } from '../context/MonitorContext';
import { RunsList } from './monitor/RunsList';
import { RunDetail } from './monitor/RunDetail';
import { EvolutionLibrary } from './monitor/EvolutionLibrary';

const STAGE_LABELS: Record<DomainMode, string[]> = {
  game:     ['GDD',   'SPEC',     'Plan', 'Code',   'QA'],
  software: ['PRD',   'Arch',     'Plan', 'Code',   'Review'],
  docs:     ['Scope', 'Analysis', 'Plan', 'Docs',   'Verify'],
};

const AGENT_IDS = ['planner', 'architect', 'compiler', 'worker', 'auditor'] as const;
const AGENT_INITIALS: Record<string, string> = {
  planner: 'AL', architect: 'SA', compiler: 'JO', worker: 'CA', auditor: 'MO',
};

type StageStatus = 'completed' | 'active' | 'error' | 'pending';

function computeTotalCost(): number {
  return getMetricsCollector().getAll().filter(m => m.type === 'api-call')
    .reduce((s, m) => s + (m.apiCall?.cost ?? 0), 0);
}
function computeTotalTokens(): number {
  return getMetricsCollector().getAll().filter(m => m.type === 'api-call')
    .reduce((s, m) => s + (m.apiCall?.inputTokens ?? 0) + (m.apiCall?.outputTokens ?? 0), 0);
}

// ── StartPanel ────────────────────────────────────────────────
const DOMAIN_HINTS: Record<DomainMode, { q: string; placeholder: string; primaryWindow: string }> = {
  game:     { q: '어떤 게임을 만들까요?',      placeholder: '예: 슬라임이 몰려오는 1분 서바이벌 게임…',  primaryWindow: 'planner' },
  software: { q: '어떤 소프트웨어를 만들까요?', placeholder: '예: 팀 협업용 Todo 앱, 실시간 동기화…',    primaryWindow: 'planner' },
  docs:     { q: '코드를 문서화할까요?',         placeholder: '코드를 업로드하거나 GitHub URL을 입력하세요.', primaryWindow: 'code-input' },
};

const StartPanel: React.FC = () => {
  const { toggleWindowVisibility, domainMode, domainConfig } = useWindowContext();
  const [idea, setIdea] = useState('');
  const hint = DOMAIN_HINTS[domainMode];
  const templates = domainConfig.templates?.slice(0, 3) ?? [];

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: '22px', padding: '32px 96px',
    }}>
      {/* 제목 */}
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>
          {hint.q}
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--ink-soft)', marginTop: '8px', lineHeight: 1.6 }}>
          {domainConfig.description} — Alex → Sam → Jordan → Casey → Morgan 파이프라인 자동 실행
        </p>
      </div>

      {/* 장르/템플릿 빠른 선택 */}
      {templates.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {templates.map(tpl => (
            <button
              key={tpl.id}
              onClick={() => setIdea(tpl.example)}
              style={{
                fontSize: '13px', padding: '5px 14px', fontWeight: 500,
                border: '1px solid var(--line)', borderRadius: '20px',
                backgroundColor: 'var(--surface)', color: 'var(--ink-soft)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.color = 'var(--brand)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.color = 'var(--ink-soft)'; }}
            >
              {tpl.name}
            </button>
          ))}
        </div>
      )}

      {/* 아이디어 입력 */}
      <textarea
        value={idea}
        onChange={e => setIdea(e.target.value)}
        placeholder={hint.placeholder}
        style={{
          width: '100%', maxWidth: '700px', minHeight: '140px', resize: 'vertical',
          fontSize: '14px', lineHeight: '1.7', padding: '16px 18px',
          backgroundColor: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: '8px', color: 'var(--ink)', outline: 'none', fontFamily: 'inherit',
          transition: 'border-color 0.15s',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--brand)'; }}
        onBlur={e => { e.currentTarget.style.borderColor = 'var(--line)'; }}
      />

      {/* 액션 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button
          onClick={() => toggleWindowVisibility(hint.primaryWindow)}
          style={{
            padding: '12px 36px', fontSize: '15px', fontWeight: 700,
            backgroundColor: 'var(--brand)', color: '#FFFFFF',
            border: 'none', borderRadius: '8px', cursor: 'pointer',
            letterSpacing: '0.3px', transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
        >
          생성 시작
        </button>
        <span style={{ fontSize: '13px', color: 'var(--ink-soft)' }}>
          또는 하단 타스크바에서 창 선택
        </span>
      </div>
    </div>
  );
};

// ── RunningPanel ──────────────────────────────────────────────
const RunningPanel: React.FC = () => {
  const { agents, pipeline, toggleWindowVisibility } = useWindowContext();
  const activeAgent = agents.find(a => a.status !== 'idle' && a.status !== 'error');
  const isPaused = pipeline.status === 'paused';

  // 최신 산출물 선택
  const artifact = (() => {
    if (pipeline.generatedCode.length > 0) return { label: '생성 코드', text: pipeline.generatedCode[0]?.content ?? '' };
    if (pipeline.spec) return { label: 'SPEC', text: pipeline.spec };
    if (pipeline.gdd) return { label: 'GDD', text: pipeline.gdd };
    return null;
  })();

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '14px', overflow: 'hidden' }}>
      {/* 상태 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        {isPaused ? (
          <div style={{
            padding: '6px 16px', borderRadius: '6px', fontSize: '14px', fontWeight: 700,
            backgroundColor: 'var(--brand-50)', color: 'var(--brand)',
            border: '1px solid var(--brand)',
          }}>
            승인 대기 중 — 관련 창에서 확인 후 승인하세요
          </div>
        ) : activeAgent ? (
          <>
            <div style={{
              width: '36px', height: '36px', borderRadius: '18px',
              backgroundColor: 'var(--brand-50)', border: '1px solid var(--brand)',
              color: 'var(--brand)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.5px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              {AGENT_INITIALS[activeAgent.agentId] ?? '??'}
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>
                {activeAgent.agentId.charAt(0).toUpperCase() + activeAgent.agentId.slice(1)} 실행 중
              </div>
              <div style={{ fontSize: '13px', color: 'var(--ink-soft)', marginTop: '2px' }}>
                {activeAgent.currentTask || '처리 중...'}
              </div>
            </div>
            <div style={{
              width: '10px', height: '10px', borderRadius: '5px',
              backgroundColor: 'var(--ok)', marginLeft: '4px',
              animation: 'pulse-dot 1.5s ease-in-out infinite', flexShrink: 0,
            }} />
          </>
        ) : (
          <div style={{ fontSize: '14px', color: 'var(--ink-soft)' }}>파이프라인 실행 중...</div>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          {pipeline.gdd && (
            <button onClick={() => toggleWindowVisibility('planner')}
              style={{ fontSize: '12px', padding: '4px 12px', border: '1px solid var(--line)', borderRadius: '4px', backgroundColor: 'var(--surface)', color: 'var(--ink-soft)', cursor: 'pointer' }}>
              GDD
            </button>
          )}
          {pipeline.spec && (
            <button onClick={() => toggleWindowVisibility('architect')}
              style={{ fontSize: '12px', padding: '4px 12px', border: '1px solid var(--line)', borderRadius: '4px', backgroundColor: 'var(--surface)', color: 'var(--ink-soft)', cursor: 'pointer' }}>
              SPEC
            </button>
          )}
          {pipeline.generatedCode.length > 0 && (
            <button onClick={() => toggleWindowVisibility('canvas')}
              style={{ fontSize: '12px', padding: '4px 12px', border: '1px solid var(--brand)', borderRadius: '4px', backgroundColor: 'var(--brand-50)', color: 'var(--brand)', cursor: 'pointer', fontWeight: 600 }}>
              Live Canvas
            </button>
          )}
        </div>
      </div>

      {/* 산출물 미리보기 */}
      {artifact ? (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'hidden' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', color: 'var(--ink-soft)', textTransform: 'uppercase' }}>
            {artifact.label} 미리보기
          </div>
          <div style={{
            flex: 1, minHeight: 0, overflow: 'auto',
            backgroundColor: 'var(--bg)', border: '1px solid var(--line)',
            borderRadius: '6px', padding: '14px 16px',
          }}>
            <pre style={{
              fontSize: '13px', color: 'var(--ink)', lineHeight: '1.65',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              fontFamily: 'inherit', margin: 0,
            }}>
              {artifact.text.slice(0, 3000)}
              {artifact.text.length > 3000 && '\n\n…(계속)'}
            </pre>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: 'var(--ink-soft)' }}>
            <div style={{ fontSize: '14px' }}>에이전트가 작업 중입니다...</div>
            <div style={{ fontSize: '13px', marginTop: '6px' }}>Terminal 창에서 실시간 로그를 확인하세요</div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── CompletePanel ─────────────────────────────────────────────
const CompletePanel: React.FC = () => {
  const { pipeline, toggleWindowVisibility } = useWindowContext();
  const score = pipeline.auditResult?.score ?? null;
  const rec   = pipeline.auditResult?.recommendation ?? null;
  const isPassed = rec === 'pass';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '32px', fontWeight: 700, color: isPassed ? 'var(--ok)' : 'var(--brand)' }}>
          {isPassed ? '파이프라인 완료' : '재작업 중'}
        </div>
        {score !== null && (
          <div style={{ fontSize: '14px', color: 'var(--ink-soft)', marginTop: '8px' }}>
            Debt Score: {score}/10 — {rec?.toUpperCase()}
          </div>
        )}
        {pipeline.generatedCode.length > 0 && (
          <div style={{ fontSize: '14px', color: 'var(--ink-soft)', marginTop: '4px' }}>
            {pipeline.generatedCode.length}개 파일 생성 완료
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={() => toggleWindowVisibility('canvas')}
          style={{
            padding: '12px 28px', fontSize: '14px', fontWeight: 700,
            backgroundColor: 'var(--brand)', color: '#FFFFFF',
            border: 'none', borderRadius: '8px', cursor: 'pointer',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
        >
          Live Canvas 열기
        </button>
        <button
          onClick={() => toggleWindowVisibility('history')}
          style={{
            padding: '12px 28px', fontSize: '14px', fontWeight: 600,
            backgroundColor: 'transparent', color: 'var(--ink-soft)',
            border: '1px solid var(--line)', borderRadius: '8px', cursor: 'pointer',
          }}
        >
          History
        </button>
      </div>
    </div>
  );
};

// ── ErrorPanel ────────────────────────────────────────────────
const ErrorPanel: React.FC = () => {
  const { agents } = useWindowContext();
  const errAgent = agents.find(a => a.status === 'error');
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
      <div style={{ fontSize: '18px', fontWeight: 700, color: '#E01E5A' }}>파이프라인 오류</div>
      {errAgent && (
        <div style={{ fontSize: '14px', color: 'var(--ink-soft)' }}>
          {errAgent.agentId}: {errAgent.currentTask}
        </div>
      )}
      <div style={{ fontSize: '13px', color: 'var(--ink-soft)' }}>Terminal 창에서 로그를 확인하세요</div>
    </div>
  );
};

type MonitorTab = 'runs' | 'evolution';

// ── v2 모니터 워크스페이스 ──────────────────────────────────────
const V2Monitor: React.FC = () => {
  const { selectedRunId, refresh } = useMonitor();
  const [tab, setTab] = useState<MonitorTab>('runs');

  const TabBtn: React.FC<{ t: MonitorTab; label: string }> = ({ t, label }) => (
    <button
      onClick={() => setTab(t)}
      style={{
        fontSize: '12px', fontWeight: tab === t ? 700 : 500, padding: '4px 14px',
        borderRadius: '4px',
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexShrink: 0 }}>
        <TabBtn t="runs" label="Runs" />
        <TabBtn t="evolution" label="Evolution Library" />
        <button
          onClick={refresh}
          style={{
            marginLeft: 'auto', fontSize: '11px', padding: '4px 10px',
            border: '1px solid var(--line)', borderRadius: '4px',
            backgroundColor: 'transparent', color: 'var(--ink-soft)', cursor: 'pointer',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.color = 'var(--brand)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.color = 'var(--ink-soft)'; }}
        >
          새로고침
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {tab === 'runs' && (
          selectedRunId ? (
            <div style={{ height: '100%', display: 'flex', gap: '14px', overflow: 'hidden' }}>
              <div style={{ width: '220px', flexShrink: 0, overflow: 'hidden' }}>
                <RunsList />
              </div>
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <RunDetail />
              </div>
            </div>
          ) : (
            <RunsList />
          )
        )}
        {tab === 'evolution' && <EvolutionLibrary />}
      </div>
    </div>
  );
};

// ── MainDashboard (메인) ──────────────────────────────────────
export const MainDashboard: React.FC = () => {
  const { agents, pipeline, domainMode } = useWindowContext();
  const labels = STAGE_LABELS[domainMode];
  const [totalCost,   setTotalCost]   = useState(computeTotalCost);
  const [totalTokens, setTotalTokens] = useState(computeTotalTokens);
  const [showV1,      setShowV1]      = useState(false);

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

  const statusColor = (s: StageStatus): string => ({
    completed: 'var(--ok)',
    active:    'var(--brand)',
    error:     '#E01E5A',
    pending:   'var(--line)',
  }[s]);

  const debtScore = pipeline.auditResult?.score ?? null;
  const debtRec   = pipeline.auditResult?.recommendation ?? null;
  const debtColor = debtScore === null ? 'var(--ink-soft)' : debtRec === 'pass' ? 'var(--ok)' : '#E01E5A';

  const metricCards = [
    {
      label: 'DEBT SCORE',
      value: debtScore !== null ? `${debtScore}` : '—',
      unit:  debtScore !== null ? '/10' : '',
      sub:   debtScore === null ? '[미실행]' : debtRec === 'pass' ? 'PASS' : 'FIX',
      subColor: debtColor,
    },
    {
      label: 'TOTAL COST',
      value: totalCost === 0 ? '—' : formatCost(totalCost),
      unit: '', sub: 'USD · 이번 세션', subColor: 'var(--ink-soft)',
    },
    {
      label: 'LOOP BACK',
      value: `${pipeline.loopCount}`,
      unit: '',
      sub: 'Auditor 재실행',
      subColor: pipeline.loopCount > 0 ? '#E01E5A' : 'var(--ink-soft)',
      valueColor: pipeline.loopCount > 0 ? '#E01E5A' : 'var(--ink)',
    },
    {
      label: 'TOKENS',
      value: totalTokens === 0 ? '—' : formatTokens(totalTokens),
      unit: '', sub: '입력+출력 합계', subColor: 'var(--ink-soft)',
    },
  ];

  const WorkspaceContent = (() => {
    switch (pipeline.status) {
      case 'running':
      case 'paused':   return RunningPanel;
      case 'complete': return CompletePanel;
      case 'error':    return ErrorPanel;
      default:         return StartPanel;
    }
  })();

  return (
    <div
      className="absolute inset-0"
      style={{ backgroundColor: 'var(--bg)', display: 'flex', flexDirection: 'column' }}
    >
      {/* ── 1) Pipeline — 풀폭 ────────────────── */}
      <div style={{ padding: '24px 28px 0', flexShrink: 0 }}>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', color: 'var(--ink-soft)', marginBottom: '18px', textTransform: 'uppercase' }}>
          Pipeline
        </div>

        {/* 노드 + 라인 */}
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
                  flex: 1, height: '2px', minWidth: '24px',
                  backgroundColor: stages[idx] === 'completed' ? 'var(--ok)' : 'var(--line)',
                  transition: 'background-color 0.3s',
                }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* 라벨 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
          {labels.map((label, idx) => (
            <div key={idx} style={{
              textAlign: 'center', fontSize: '13px',
              fontWeight: stages[idx] === 'active' ? 700 : 500,
              color: stages[idx] === 'error'   ? '#E01E5A'
                   : stages[idx] === 'pending' ? 'var(--line)'
                   : stages[idx] === 'active'  ? 'var(--brand)'
                   : 'var(--ink-soft)',
              minWidth: '24px', transition: 'color 0.3s',
            }}>
              {label}
            </div>
          ))}
        </div>

        {pipeline.loopCount > 0 && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#E01E5A', fontWeight: 600 }}>
            Auditor re-run: {pipeline.loopCount}x
          </div>
        )}
      </div>

      {/* ── 2) 메트릭 카드 — 4-col 풀폭 그리드 ── */}
      <div style={{ padding: '20px 28px', flexShrink: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
          {metricCards.map(({ label, value, unit, sub, subColor, valueColor }) => (
            <div key={label} style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: '10px',
              padding: '18px 20px',
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', color: 'var(--ink-soft)', marginBottom: '10px', textTransform: 'uppercase' }}>
                {label}
              </div>
              <div className="mono" style={{ fontSize: '28px', fontWeight: 700, color: (valueColor as string | undefined) ?? 'var(--ink)', lineHeight: 1 }}>
                {value}
                {unit && <span style={{ fontSize: '14px', color: 'var(--ink-soft)', fontWeight: 400, marginLeft: '3px' }}>{unit}</span>}
              </div>
              <div style={{ fontSize: '12px', color: subColor as string, marginTop: '8px', fontWeight: subColor !== 'var(--ink-soft)' ? 600 : 400 }}>
                {sub}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3) 워크스페이스 — v2 모니터 (기본) / v1 레거시 (토글) ── */}
      <div style={{ flex: 1, minHeight: 0, margin: '0 28px 20px' }}>
        <div style={{
          height: '100%', backgroundColor: 'var(--surface)',
          border: `1px solid ${showV1 ? 'oklch(80% 0.04 60)' : 'var(--line)'}`,
          borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}>
          {/* 워크스페이스 헤더 */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 18px', borderBottom: '1px solid var(--line)', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', color: 'var(--ink-soft)', textTransform: 'uppercase' }}>
                {showV1 ? 'v1 레거시 엔진' : 'v2 Monitor'}
              </span>
              {showV1 && (
                <span style={{
                  fontSize: '10px', fontWeight: 700, padding: '1px 7px', borderRadius: '10px',
                  backgroundColor: 'oklch(96% 0.025 60)', color: 'oklch(55% 0.1 60)',
                }}>
                  DEPRECATED
                </span>
              )}
            </div>
            <button
              onClick={() => setShowV1(v => !v)}
              style={{
                fontSize: '11px', padding: '3px 10px',
                border: '1px solid var(--line)', borderRadius: '4px',
                backgroundColor: 'transparent',
                color: showV1 ? 'var(--brand)' : 'var(--ink-soft)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.color = 'var(--brand)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.color = showV1 ? 'var(--brand)' : 'var(--ink-soft)'; }}
            >
              {showV1 ? 'v2 모니터로' : 'v1 레거시'}
            </button>
          </div>
          {/* 콘텐츠 */}
          <div style={{ flex: 1, minHeight: 0, padding: '16px 18px', overflow: 'hidden' }}>
            {showV1 ? <WorkspaceContent /> : <V2Monitor />}
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { useWindowContext } from '../context/WindowContext';
import type { DomainMode } from '../config/domain-mode';

// 도메인별 스테이지 라벨
const STAGE_LABELS: Record<DomainMode, string[]> = {
  game: ['GDD', 'SPEC', 'Plan', 'Code', 'QA'],
  software: ['PRD', 'Arch', 'Plan', 'Boilerplate', 'Review'],
  docs: ['Scope', 'Analysis', 'Plan', 'Docs', 'Verify'],
};

// 5개 에이전트 순서
const AGENT_IDS = ['planner', 'architect', 'compiler', 'worker', 'auditor'] as const;

type StageStatus = 'completed' | 'active' | 'error' | 'pending';

function formatElapsed(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  return `${min}m${sec % 60}s`;
}

export const PipelineProgressBar: React.FC = () => {
  const { agents, pipeline, domainMode } = useWindowContext();
  const labels = STAGE_LABELS[domainMode];

  // 경과 시간 추적
  const [timings, setTimings] = useState<number[]>([0, 0, 0, 0, 0]);
  const startTimesRef = useRef<(number | null)[]>([null, null, null, null, null]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 스테이지 상태 도출
  const getStageStatus = (idx: number): StageStatus => {
    const agentId = AGENT_IDS[idx];
    const agent = agents.find(a => a.agentId === agentId);
    if (!agent) return 'pending';

    if (agent.status === 'error') return 'error';

    // artifact 완성 여부 체크
    const hasArtifact = (() => {
      switch (idx) {
        case 0: return !!pipeline.gdd;
        case 1: return !!pipeline.spec;
        case 2: return !!pipeline.executionPlan;
        case 3: return pipeline.generatedCode.length > 0;
        case 4: return !!pipeline.auditResult;
        default: return false;
      }
    })();

    if (hasArtifact) return 'completed';
    if (agent.status !== 'idle') return 'active';
    return 'pending';
  };

  const stages = AGENT_IDS.map((_, i) => getStageStatus(i));

  // 활성 스테이지 타이머
  useEffect(() => {
    stages.forEach((status, idx) => {
      if (status === 'active' && startTimesRef.current[idx] === null) {
        startTimesRef.current[idx] = Date.now();
      }
      if (status === 'completed' && startTimesRef.current[idx] !== null) {
        const elapsed = Date.now() - startTimesRef.current[idx]!;
        setTimings(prev => {
          const next = [...prev];
          next[idx] = elapsed;
          return next;
        });
        startTimesRef.current[idx] = null;
      }
    });

    const hasActive = stages.some(s => s === 'active');
    if (hasActive && !intervalRef.current) {
      intervalRef.current = setInterval(() => {
        setTimings(prev => {
          const next = [...prev];
          startTimesRef.current.forEach((start, idx) => {
            if (start !== null) {
              next[idx] = Date.now() - start;
            }
          });
          return next;
        });
      }, 1000);
    } else if (!hasActive && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [stages.join(',')]);

  // 파이프라인 idle 시 리셋
  useEffect(() => {
    if (pipeline.status === 'idle') {
      setTimings([0, 0, 0, 0, 0]);
      startTimesRef.current = [null, null, null, null, null];
    }
  }, [pipeline.status]);

  const statusColor = (s: StageStatus): string => {
    switch (s) {
      case 'completed': return 'var(--ok)';
      case 'active': return 'var(--brand)';
      case 'error': return '#E01E5A';
      case 'pending': return 'var(--line)';
    }
  };

  const lineColor = (leftStatus: StageStatus, rightStatus: StageStatus): string => {
    if (leftStatus === 'completed' && rightStatus !== 'pending') return 'var(--ok)';
    if (leftStatus === 'completed') return 'var(--line)';
    return 'var(--line)';
  };

  return (
    <div
      className="px-4 py-3"
      style={{ borderBottom: '1px solid var(--line)' }}
    >
      <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-soft)', marginBottom: '8px', display: 'block' }}>
        Pipeline
      </label>

      {/* 노드 + 연결선 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {stages.map((status, idx) => (
          <React.Fragment key={idx}>
            {/* 노드 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto', position: 'relative' }}>
              <div
                style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  backgroundColor: statusColor(status),
                  transition: 'background-color 0.3s',
                  animation: status === 'active' ? 'pulse-dot 1.5s ease-in-out infinite' : 'none',
                }}
              />
              {/* 루프 뱃지 (Auditor only) */}
              {idx === 4 && pipeline.loopCount > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-8px',
                  backgroundColor: '#E01E5A',
                  color: '#FFFFFF',
                  fontSize: '9px',
                  fontWeight: 700,
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                }}>
                  {pipeline.loopCount}
                </div>
              )}
            </div>

            {/* 연결선 (마지막 노드 제외) */}
            {idx < 4 && (
              <div style={{
                flex: 1,
                height: '2px',
                backgroundColor: lineColor(stages[idx], stages[idx + 1]),
                transition: 'background-color 0.3s',
                minWidth: '8px',
              }} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* 라벨 + 시간 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
        {labels.map((label, idx) => (
          <div key={idx} style={{
            textAlign: 'center',
            fontSize: '10px',
            fontWeight: stages[idx] === 'active' ? 700 : 500,
            color: stages[idx] === 'pending'
              ? 'var(--line)'
              : stages[idx] === 'error'
                ? '#E01E5A'
                : 'var(--ink-soft)',
            lineHeight: '14px',
            minWidth: '14px',
          }}>
            <div>{label}</div>
            {timings[idx] > 0 && (
              <div style={{
                fontSize: '9px',
                color: stages[idx] === 'active' ? 'var(--brand)' : 'var(--ink-soft)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {stages[idx] === 'active' && pipeline.loopCount > 0 && idx === 4
                  ? `⟲${pipeline.loopCount}`
                  : formatElapsed(timings[idx])}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

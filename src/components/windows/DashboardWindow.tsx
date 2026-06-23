import React, { useState, useEffect, useCallback } from 'react';
import { useWindowContext } from '../../context/WindowContext';
import { getMetricsCollector, ExperimentSummary } from '../../services/metrics-collector';
import { formatCost, formatTokens, formatLatency } from '../../services/cost-calculator';

function downloadMetricsJSON(
  summary: ExperimentSummary,
  modelStrategy: string,
  auditScore: number | null,
  loopCount: number,
): void {
  const byAgentFlat: Record<string, { inputTokens: number; outputTokens: number; costUSD: number }> = {};
  for (const [id, s] of Object.entries(summary.byAgent)) {
    byAgentFlat[id] = { inputTokens: s.inputTokens, outputTokens: s.outputTokens, costUSD: s.cost };
  }
  const payload = {
    _note: '실측값. fill-metrics.mjs로 README에 자동 반영.',
    debtScore: auditScore,
    loopbackCount: loopCount,
    domCount: null,
    hasGameLoop: null,
    iframeLoadTimeMs: null,
    pipelineTotalMs: summary.totalLatencyMs,
    modelStrategy,
    totalCostUSD: summary.totalCost,
    totalTokens: summary.totalInputTokens + summary.totalOutputTokens,
    byAgent: byAgentFlat,
    allFlash: null,
    hybridPro: null,
    allPro: null,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'last-run-metrics.json';
  a.click();
  URL.revokeObjectURL(url);
}

const AGENT_COLORS: Record<string, string> = {
  planner:  '#d4a574',
  architect:'#c9866f',
  compiler: '#9b8fb5',
  worker:   '#a0b8ab',
  auditor:  '#8fa881',
};

const AGENT_EMOJIS: Record<string, string> = {
  planner:  '🧑‍💼',
  architect:'🧑‍🔧',
  compiler: '🧑‍💻',
  worker:   '👨‍🚀',
  auditor:  '🧑‍⚖️',
};

const AGENT_ORDER = ['planner', 'architect', 'compiler', 'worker', 'auditor'];
const CHART_W = 220;
const BAR_H = 14;
const BAR_GAP = 6;

function BarChart({ summary }: { summary: ExperimentSummary }) {
  const maxTokens = Math.max(
    1,
    ...AGENT_ORDER.map(id => {
      const s = summary.byAgent[id];
      return s ? s.inputTokens + s.outputTokens : 0;
    }),
  );

  return (
    <svg width={CHART_W} height={AGENT_ORDER.length * (BAR_H + BAR_GAP) + 10} className="block">
      {AGENT_ORDER.map((agentId, i) => {
        const s = summary.byAgent[agentId];
        const tokens = s ? s.inputTokens + s.outputTokens : 0;
        const cost = s ? s.cost : 0;
        const barW = maxTokens > 0 ? (tokens / maxTokens) * (CHART_W - 80) : 0;
        const y = i * (BAR_H + BAR_GAP);
        const color = AGENT_COLORS[agentId] ?? '#c9a87c';
        return (
          <g key={agentId}>
            <text x="0" y={y + BAR_H - 2} fontSize="10" fill="#5a3a1a">
              {AGENT_EMOJIS[agentId]} {agentId.slice(0, 4)}
            </text>
            <rect x={50} y={y} width={Math.max(barW, 0)} height={BAR_H} fill={color} rx="2" />
            {tokens > 0 && (
              <text x={52 + barW} y={y + BAR_H - 2} fontSize="9" fill="#5a3a1a">
                {formatTokens(tokens)} ({formatCost(cost)})
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function CostTimeline({ summary }: { summary: ExperimentSummary }) {
  if (summary.timeline.length < 2) return (
    <div className="text-amber-400 text-xs text-center py-2">API 호출 대기 중...</div>
  );

  const W = CHART_W, H = 60, PAD = 8;
  const maxCost = summary.timeline[summary.timeline.length - 1].cumulativeCost || 1;
  const minTs = summary.timeline[0].timestamp;
  const maxTs = summary.timeline[summary.timeline.length - 1].timestamp || (minTs + 1);

  const pts = summary.timeline.map(p => {
    const x = PAD + ((p.timestamp - minTs) / (maxTs - minTs)) * (W - PAD * 2);
    const y = H - PAD - (p.cumulativeCost / maxCost) * (H - PAD * 2);
    return `${x},${y}`;
  });

  return (
    <svg width={W} height={H} className="block">
      <polyline points={pts.join(' ')} fill="none" stroke="#8b6f47" strokeWidth="2" />
      {summary.timeline.map((p, i) => {
        const x = PAD + ((p.timestamp - minTs) / (maxTs - minTs)) * (W - PAD * 2);
        const y = H - PAD - (p.cumulativeCost / maxCost) * (H - PAD * 2);
        const color = AGENT_COLORS[p.agentId] ?? '#c9a87c';
        return <circle key={i} cx={x} cy={y} r="4" fill={color} stroke="#8b6f47" strokeWidth="1" />;
      })}
      <text x={PAD} y={H - 1} fontSize="8" fill="#8b6f47">0s</text>
      <text x={W - PAD - 12} y={H - 1} fontSize="8" fill="#8b6f47">
        {formatLatency(maxTs - minTs)}
      </text>
      <text x={PAD} y={PAD + 6} fontSize="8" fill="#8b6f47">{formatCost(maxCost)}</text>
    </svg>
  );
}

function LatencyHeatmap({ summary }: { summary: ExperimentSummary }) {
  const calls = getMetricsCollector().getAll().filter(m => m.type === 'api-call');
  if (calls.length === 0) return (
    <div className="text-amber-400 text-xs text-center py-2">API 호출 대기 중...</div>
  );

  const maxLatency = Math.max(...calls.map(m => m.apiCall?.latencyMs ?? 0), 1);
  const W = CHART_W, cellW = 18, cellH = 14;

  // group by agentId
  const grouped: Record<string, number[]> = {};
  for (const m of calls) {
    if (!grouped[m.agentId]) grouped[m.agentId] = [];
    grouped[m.agentId].push(m.apiCall?.latencyMs ?? 0);
  }

  const agents = Object.keys(grouped);
  const H = agents.length * (cellH + 2) + 4;

  return (
    <svg width={W} height={H} className="block">
      {agents.map((agentId, ai) => (
        <g key={agentId}>
          <text x="0" y={ai * (cellH + 2) + cellH - 2} fontSize="9" fill="#5a3a1a">
            {agentId.slice(0, 5)}
          </text>
          {grouped[agentId].slice(0, 8).map((lat, ci) => {
            const ratio = lat / maxLatency;
            const r = Math.round(200 * ratio);
            const g = Math.round(160 * (1 - ratio));
            const fill = `rgb(${r},${g + 80},80)`;
            return (
              <g key={ci}>
                <rect
                  x={46 + ci * (cellW + 2)}
                  y={ai * (cellH + 2)}
                  width={cellW} height={cellH}
                  fill={fill} rx="2"
                />
                <title>{formatLatency(lat)}</title>
              </g>
            );
          })}
        </g>
      ))}
    </svg>
  );
}

export const DashboardWindow: React.FC = () => {
  const { currentExperimentId, pipeline, modelStrategy } = useWindowContext();
  const [summary, setSummary] = useState<ExperimentSummary>(() =>
    getMetricsCollector().getSummary(currentExperimentId),
  );

  const refresh = useCallback(() => {
    setSummary(getMetricsCollector().getSummary(currentExperimentId));
  }, [currentExperimentId]);

  useEffect(() => {
    refresh();
    const unsub = getMetricsCollector().subscribe('all', refresh);
    return unsub;
  }, [refresh]);

  return (
    <div className="flex flex-col h-full text-xs gap-2 overflow-y-auto p-1">
      {/* 메트릭 다운로드 */}
      {summary.totalApiCalls > 0 && (
        <button
          onClick={() => downloadMetricsJSON(summary, modelStrategy, pipeline.auditResult?.score ?? null, pipeline.loopCount)}
          className="flex-shrink-0 w-full py-1 border border-amber-500 rounded text-amber-800 hover:bg-amber-100 font-bold"
        >
          결과 저장 → last-run-metrics.json
        </button>
      )}
      {/* 헤더 요약 */}
      <div
        className="flex-shrink-0 grid grid-cols-3 gap-1 p-2 rounded text-center"
        style={{ backgroundColor: '#faf4ec', border: '1px solid #c9a87c' }}
      >
        <div>
          <div className="font-bold text-amber-900">총 비용</div>
          <div className="text-green-700 font-mono">{formatCost(summary.totalCost)}</div>
        </div>
        <div>
          <div className="font-bold text-amber-900">총 시간</div>
          <div className="font-mono">{formatLatency(summary.totalLatencyMs)}</div>
        </div>
        <div>
          <div className="font-bold text-amber-900">에러율</div>
          <div className="font-mono">{(summary.errorRate * 100).toFixed(0)}%</div>
        </div>
      </div>

      {/* 토큰 바 차트 */}
      <Section title="토큰 사용량 (에이전트별)">
        <BarChart summary={summary} />
      </Section>

      {/* 비용 누적 라인 */}
      <Section title="비용 누적 타임라인">
        <CostTimeline summary={summary} />
      </Section>

      {/* 응답 시간 히트맵 */}
      <Section title="응답 시간 히트맵 (초록=빠름, 빨강=느림)">
        <LatencyHeatmap summary={summary} />
      </Section>

      {/* 모델별 통계 */}
      {Object.keys(summary.byModel).length > 0 && (
        <Section title="모델별 통계">
          {Object.entries(summary.byModel).map(([model, s]) => (
            <div key={model} className="flex justify-between text-xs py-0.5 border-b border-amber-100">
              <span className="text-amber-900 truncate flex-1">{model}</span>
              <span className="text-amber-700 ml-2">{s.apiCalls}회</span>
              <span className="text-amber-700 ml-2">{formatCost(s.cost)}</span>
            </div>
          ))}
        </Section>
      )}

      {summary.totalApiCalls === 0 && (
        <div className="text-amber-400 text-center mt-4">
          파이프라인을 실행하면 메트릭이 표시됩니다
        </div>
      )}
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="flex-shrink-0 border border-amber-200 rounded p-2 bg-amber-50">
    <div className="font-bold text-amber-900 mb-1">{title}</div>
    {children}
  </div>
);

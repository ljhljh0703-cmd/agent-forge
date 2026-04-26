import React, { useState, useCallback, useEffect } from 'react';
import { getMetricsCollector } from '../../services/metrics-collector';
import { ComparisonEngine, ComparisonResult } from '../../services/comparison-engine';
import { loadExperimentRuns, ExperimentRun } from '../../config/experiments';
import { formatCost, formatTokens, formatLatency } from '../../services/cost-calculator';

const engine = new ComparisonEngine();

function AxisBar({
  label,
  values,
  experimentIds,
  runNames,
  winner,
  higherIsBetter,
  formatter,
}: {
  label: string;
  values: Record<string, number>;
  experimentIds: string[];
  runNames: Record<string, string>;
  winner: string;
  higherIsBetter: boolean;
  formatter: (v: number) => string;
}) {
  const allVals = experimentIds.map(id => values[id] ?? 0);
  const maxVal = Math.max(...allVals, 1);

  return (
    <div className="mb-2">
      <div className="font-bold text-amber-900 mb-1">{label}</div>
      {experimentIds.map(id => {
        const v = values[id] ?? 0;
        const pct = (v / maxVal) * 100;
        const barPct = higherIsBetter ? pct : 100 - pct + (100 - maxVal > 0 ? 0 : 0);
        const isWinner = id === winner;
        return (
          <div key={id} className="flex items-center gap-2 mb-1">
            <span className="text-xs text-amber-800 truncate" style={{ width: '80px' }}>
              {isWinner ? '🏆 ' : '   '}{runNames[id] ?? id.slice(-6)}
            </span>
            <div className="flex-1 bg-amber-100 rounded" style={{ height: '12px' }}>
              <div
                className="rounded h-full"
                style={{
                  width: `${Math.max(barPct, 2)}%`,
                  backgroundColor: isWinner ? '#8b6f47' : '#c9a87c',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <span className="text-xs font-mono text-amber-800 w-16 text-right">
              {formatter(v)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export const ComparisonWindow: React.FC = () => {
  const [allRuns, setAllRuns] = useState<ExperimentRun[]>(loadExperimentRuns);
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<ComparisonResult | null>(null);

  const refreshRuns = useCallback(() => setAllRuns(loadExperimentRuns()), []);

  useEffect(() => {
    const unsub = getMetricsCollector().subscribe('all', refreshRuns);
    return unsub;
  }, [refreshRuns]);

  const handleToggle = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id].slice(0, 5),
    );
    setResult(null);
  };

  const handleCompare = () => {
    if (selected.length < 1) return;
    const r = engine.compare(selected, getMetricsCollector());
    setResult(r);
  };

  const handleExport = () => {
    if (!result) return;
    const md = engine.generateMarkdown(result);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comparison-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    if (!result) return;
    const csv = getMetricsCollector().exportCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `metrics-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const runNames: Record<string, string> = {};
  for (const run of allRuns) {
    runNames[run.id] = run.config.name;
  }

  const completedRuns = allRuns.filter(r => r.status === 'complete');

  return (
    <div className="flex flex-col h-full text-xs gap-2 overflow-hidden">
      {/* 실험 선택 */}
      <div className="flex-shrink-0 border border-amber-300 rounded p-2 bg-amber-50">
        <div className="font-bold text-amber-900 mb-1">
          비교할 실험 선택 (최대 5개, 현재 {selected.length}개)
        </div>
        {completedRuns.length === 0 && (
          <div className="text-amber-400">완료된 실험이 없습니다</div>
        )}
        {completedRuns.map(run => (
          <label key={run.id} className="flex items-center gap-2 cursor-pointer py-0.5">
            <input
              type="checkbox"
              checked={selected.includes(run.id)}
              onChange={() => handleToggle(run.id)}
            />
            <span className="flex-1 truncate">{run.config.name}</span>
            <span className="text-amber-600">{formatCost(run.totalCost)}</span>
          </label>
        ))}
      </div>

      <button
        onClick={handleCompare}
        disabled={selected.length < 1}
        className="win-button text-xs font-bold flex-shrink-0 disabled:opacity-40"
      >
        ⚖️ 비교 분석
      </button>

      {/* 비교 결과 */}
      {result && (
        <div className="flex-1 overflow-y-auto space-y-2">
          {/* 종합 추천 */}
          <div
            className="p-2 rounded border text-xs"
            style={{ backgroundColor: '#fef9f0', borderColor: '#c9a87c' }}
          >
            <div className="font-bold text-amber-900 mb-1">종합 추천</div>
            <div className="text-amber-800 leading-relaxed">{result.recommendation.reasoning}</div>
          </div>

          {/* 축별 바 차트 */}
          {Object.values(result.axes).map(axis => (
            <div
              key={axis.metric}
              className="p-2 rounded border"
              style={{ backgroundColor: '#faf4ec', borderColor: '#c9a87c' }}
            >
              <AxisBar
                label={axis.label}
                values={axis.values}
                experimentIds={result.experimentIds}
                runNames={runNames}
                winner={axis.winner}
                higherIsBetter={axis.higherIsBetter}
                formatter={axis.formatter}
              />
            </div>
          ))}

          {/* 에이전트별 상세 (첫 실험) */}
          {result.experimentIds.length > 0 && (
            <div
              className="p-2 rounded border"
              style={{ backgroundColor: '#faf4ec', borderColor: '#c9a87c' }}
            >
              <div className="font-bold text-amber-900 mb-1">에이전트별 비용 상세</div>
              {result.experimentIds.map(id => {
                const sum = result.summaries[id];
                return (
                  <div key={id} className="mb-1">
                    <div className="font-semibold text-amber-800">{runNames[id]}</div>
                    {Object.entries(sum.byAgent).map(([agentId, s]) => (
                      <div key={agentId} className="flex justify-between text-amber-700 pl-2">
                        <span>{agentId}</span>
                        <span>{formatTokens(s.inputTokens + s.outputTokens)} / {formatCost(s.cost)} / {formatLatency(Math.round(s.avgLatencyMs))}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {/* Export */}
          <div className="flex gap-2 flex-shrink-0 pb-2">
            <button onClick={handleExport} className="flex-1 win-button text-xs">
              📥 Report MD
            </button>
            <button onClick={handleExportCSV} className="flex-1 win-button text-xs">
              📊 Metrics CSV
            </button>
          </div>
        </div>
      )}

      {!result && selected.length === 0 && (
        <div className="text-amber-400 text-center mt-4">
          완료된 실험을 선택하고 비교 분석을 실행하세요
        </div>
      )}
    </div>
  );
};

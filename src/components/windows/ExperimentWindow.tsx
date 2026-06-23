import React, { useState, useCallback, useEffect } from 'react';
import { useWindowContext } from '../../context/WindowContext';
import {
  ExperimentConfig,
  ExperimentRun,
  CooperationPattern,
  EXPERIMENT_PRESETS,
  loadExperimentRuns,
  saveExperimentRun,
  deleteExperimentRun,
} from '../../config/experiments';
import { DomainMode } from '../../config/domain-mode';
import { getMetricsCollector } from '../../services/metrics-collector';
import { formatCost, formatLatency, formatTokens } from '../../services/cost-calculator';

export function generateExperimentReport(run: ExperimentRun): string {
  const summary = getMetricsCollector().getSummary(run.id);
  const lines = [
    `# 실험 리포트: ${run.config.name}`,
    `생성일: ${new Date(run.timestamp).toLocaleString('ko-KR')}`,
    ``,
    `## 1. 실험 설정`,
    `협력 패턴: ${{ sequential: '순차 (P→A→C→W→Au)', parallel: '병렬 (P+A 동시 → C→W)', debate: '토론 (W+Au 3라운드)' }[run.config.cooperationPattern]}`,
    ``,
    `| 에이전트 | 모델 | Temperature |`,
    `|----------|------|-------------|`,
    ...Object.entries(run.config.agentModels).map(([a, m]) =>
      `| ${a} | ${m.model} | ${m.temperature} |`,
    ),
    ``,
    `## 2. 실행 결과`,
    `- 총 비용: ${formatCost(run.totalCost)}`,
    `- 총 토큰: ${formatTokens(run.totalTokens)}`,
    `- 총 시간: ${formatLatency(run.totalLatencyMs)}`,
    `- Audit Score: ${run.auditScore ?? 'N/A'}/10`,
    `- 생성 파일: ${run.fileCount}개`,
    ``,
    `## 3. 에이전트별 상세`,
    ...Object.entries(summary.byAgent).map(([id, s]) =>
      `### ${id}\n- 호출: ${s.apiCalls}회 | 토큰: ${formatTokens(s.inputTokens + s.outputTokens)} | 비용: ${formatCost(s.cost)} | avg: ${formatLatency(Math.round(s.avgLatencyMs))}`,
    ),
  ];
  return lines.join('\n');
}

const AVAILABLE_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.1-pro',
  'claude-sonnet-4-6',
  'claude-opus-4-6',
  'claude-haiku-4-5-20251001',
  'gpt-4o',
  'gpt-4o-mini',
];

const PATTERN_LABELS: Record<CooperationPattern, string> = {
  sequential: '순차 (P→A→C→W→Au)',
  parallel:   '병렬 (P+A 동시 → C→W)',
  debate:     '토론 (W+Au 3라운드)',
};

const STATUS_ICONS: Record<ExperimentRun['status'], string> = {
  running: '🔄',
  complete: '✅',
  error: '❌',
};

function makeDefaultConfig(): ExperimentConfig {
  return {
    id: '',
    name: `실험 #${loadExperimentRuns().length + 1}`,
    description: '',
    cooperationPattern: 'sequential',
    input: { idea: '', domain: 'game' },
    options: { maxLoops: 3, timeout: 300_000, collectIntermediates: false },
    agentModels: {
      planner:   { provider: 'gemini', model: 'gemini-3.5-flash', temperature: 0.8 },
      architect: { provider: 'gemini', model: 'gemini-3.5-flash', temperature: 0.3 },
      compiler:  { provider: 'gemini', model: 'local',            temperature: 0   },
      worker:    { provider: 'gemini', model: 'gemini-3.5-flash', temperature: 0.2 },
      auditor:   { provider: 'gemini', model: 'gemini-3.5-flash', temperature: 0.1 },
    },
  };
}

export const ExperimentWindow: React.FC = () => {
  const { addLog, pipeline, setExperimentId, currentExperimentId } = useWindowContext();
  const [config, setConfig] = useState<ExperimentConfig>(makeDefaultConfig);
  const [runs, setRuns] = useState<ExperimentRun[]>(loadExperimentRuns);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const refreshRuns = useCallback(() => setRuns(loadExperimentRuns()), []);

  // 파이프라인 완료 시 실험 run 업데이트
  useEffect(() => {
    if (currentExperimentId === 'default') return;
    const existingRun = runs.find(r => r.id === currentExperimentId);
    if (!existingRun || existingRun.status === 'complete') return;

    if (pipeline.status === 'complete') {
      const summary = getMetricsCollector().getSummary(currentExperimentId);
      const updated: ExperimentRun = {
        ...existingRun,
        status: 'complete',
        totalCost: summary.totalCost,
        totalTokens: summary.totalInputTokens + summary.totalOutputTokens,
        totalLatencyMs: summary.totalLatencyMs,
        auditScore: pipeline.auditResult?.score ?? null,
        fileCount: pipeline.generatedCode.length,
      };
      saveExperimentRun(updated);
      refreshRuns();
      addLog(`🧪 [실험] "${updated.config.name}" 완료 — ${formatCost(updated.totalCost)}`, 'success');
    }
  }, [pipeline.status, currentExperimentId]);

  const applyPreset = (preset: ExperimentConfig) => {
    setConfig({ ...preset, id: '', name: `${preset.name} #${runs.length + 1}`, input: { ...preset.input, idea: config.input.idea } });
  };

  const handleStartExperiment = () => {
    const experimentId = `exp-${Date.now()}`;
    const finalConfig: ExperimentConfig = { ...config, id: experimentId };

    const run: ExperimentRun = {
      id: experimentId,
      timestamp: Date.now(),
      config: finalConfig,
      status: 'running',
      totalCost: 0,
      totalTokens: 0,
      totalLatencyMs: 0,
      auditScore: null,
      fileCount: 0,
    };
    saveExperimentRun(run);
    refreshRuns();

    setExperimentId(experimentId);
    addLog(`🧪 [실험] "${finalConfig.name}" 시작 — ID: ${experimentId}`, 'info');
    addLog(`💡 이제 Planner 창에서 아이디어를 입력하고 파이프라인을 실행하세요`, 'info');
  };

  const handleDeleteRun = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteExperimentRun(id);
    if (selectedRunId === id) setSelectedRunId(null);
    refreshRuns();
  };

  const exportReport = (run: ExperimentRun) => {
    const markdown = generateExperimentReport(run);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${run.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedRun = runs.find(r => r.id === selectedRunId);
  const isCurrentExp = currentExperimentId !== 'default';

  return (
    <div className="flex flex-col h-full text-xs gap-2 overflow-hidden">
      {/* 실험명 */}
      <input
        value={config.name}
        onChange={e => setConfig(c => ({ ...c, name: e.target.value }))}
        className="win-input text-xs flex-shrink-0"
        placeholder="실험명"
      />

      {/* 프리셋 */}
      <div className="flex gap-1 flex-wrap flex-shrink-0">
        {EXPERIMENT_PRESETS.map(p => (
          <button
            key={p.id}
            onClick={() => applyPreset(p)}
            className="px-2 py-1 text-xs border border-amber-600 rounded hover:bg-amber-100"
            style={{ color: '#5a3a1a' }}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* 에이전트 모델 설정 */}
      <div className="flex-shrink-0 border border-amber-300 rounded p-2 bg-amber-50">
        <div className="font-bold mb-1 text-amber-900">에이전트 모델 배정</div>
        {(['planner', 'architect', 'compiler', 'worker', 'auditor'] as const).map(agent => (
          <div key={agent} className="flex items-center gap-1 mb-1">
            <span className="w-16 font-semibold text-amber-800">{agent}</span>
            {agent === 'compiler' ? (
              <span className="flex-1 text-amber-500 italic">로컬 처리 (변경 불가)</span>
            ) : (
              <select
                value={config.agentModels[agent].model}
                onChange={e => setConfig(c => ({
                  ...c,
                  agentModels: {
                    ...c.agentModels,
                    [agent]: { ...c.agentModels[agent], model: e.target.value },
                  },
                }))}
                className="flex-1 win-input text-xs py-0"
              >
                {AVAILABLE_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
          </div>
        ))}
      </div>

      {/* 협력 패턴 */}
      <div className="flex-shrink-0">
        <div className="font-bold mb-1 text-amber-900">협력 패턴</div>
        <div className="flex gap-1 flex-col">
          {(['sequential', 'parallel', 'debate'] as CooperationPattern[]).map(p => (
            <label key={p} className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="pattern"
                value={p}
                checked={config.cooperationPattern === p}
                onChange={() => setConfig(c => ({ ...c, cooperationPattern: p }))}
              />
              <span>{PATTERN_LABELS[p]}</span>
              {p !== 'sequential' && <span className="text-amber-500">(실험적)</span>}
            </label>
          ))}
        </div>
      </div>

      {/* 도메인 */}
      <div className="flex gap-2 items-center flex-shrink-0">
        <span className="font-bold text-amber-900">도메인:</span>
        {(['game', 'software'] as DomainMode[]).map(d => (
          <button
            key={d}
            onClick={() => setConfig(c => ({ ...c, input: { ...c.input, domain: d } }))}
            className={`px-2 py-1 text-xs border rounded ${config.input.domain === d ? 'bg-amber-800 text-white' : 'bg-amber-100 text-amber-900'}`}
          >
            {d === 'game' ? '🎮 Game' : '🏗️ SW'}
          </button>
        ))}
      </div>

      {/* 실행 버튼 */}
      <button
        onClick={handleStartExperiment}
        className="win-button text-xs font-bold flex-shrink-0"
        style={{ backgroundColor: isCurrentExp ? '#c9a87c' : undefined }}
      >
        {isCurrentExp ? `▶ 실험 진행 중 (${currentExperimentId.slice(-6)})` : '▶ 실험 시작'}
      </button>

      {/* 실험 이력 */}
      <div className="flex-1 overflow-y-auto border border-amber-300 rounded bg-amber-50">
        <div className="px-2 py-1 font-bold text-amber-900 border-b border-amber-200">실험 이력</div>
        {runs.length === 0 && (
          <div className="text-amber-400 text-center mt-3">실험 이력 없음</div>
        )}
        {runs.map(run => (
          <div
            key={run.id}
            onClick={() => setSelectedRunId(run.id === selectedRunId ? null : run.id)}
            className={`p-2 cursor-pointer border-b border-amber-200 hover:bg-amber-100 ${selectedRunId === run.id ? 'bg-amber-200' : ''}`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold">{STATUS_ICONS[run.status]} {run.config.name}</span>
              <div className="flex gap-1">
                {run.status === 'complete' && (
                  <button
                    onClick={e => { e.stopPropagation(); exportReport(run); }}
                    className="text-xs px-1 py-0 border border-amber-600 rounded hover:bg-amber-200"
                  >
                    📥
                  </button>
                )}
                <button
                  onClick={e => handleDeleteRun(run.id, e)}
                  className="text-xs px-1 py-0 border border-red-400 rounded hover:bg-red-100"
                  style={{ color: '#c53030' }}
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="text-amber-600 text-xs">
              {new Date(run.timestamp).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              {run.status === 'complete' && ` | ${formatCost(run.totalCost)} | ${formatTokens(run.totalTokens)}`}
            </div>
            {selectedRunId === run.id && (
              <div className="mt-1 text-xs text-amber-800 space-y-0.5 border-t border-amber-200 pt-1">
                <div>패턴: {PATTERN_LABELS[run.config.cooperationPattern]}</div>
                {run.auditScore !== null && <div>Audit: {run.auditScore}/10</div>}
                <div>파일: {run.fileCount}개 | 시간: {formatLatency(run.totalLatencyMs)}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

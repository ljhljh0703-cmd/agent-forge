import { MetricsCollector, ExperimentSummary } from './metrics-collector';
import { loadExperimentRuns, ExperimentRun } from '../config/experiments';
import { formatCost, formatTokens, formatLatency } from './cost-calculator';

export interface ComparisonAxis {
  metric: string;
  label: string;
  values: Record<string, number>;  // experimentId → value
  winner: string;                   // 최적 실험 ID
  higherIsBetter: boolean;
  formatter: (v: number) => string;
}

export interface ComparisonResult {
  experimentIds: string[];
  axes: {
    quality: ComparisonAxis;
    cost: ComparisonAxis;
    speed: ComparisonAxis;
    efficiency: ComparisonAxis;
  };
  recommendation: {
    bestOverall: string;
    bestQuality: string;
    bestCost: string;
    bestSpeed: string;
    reasoning: string;
  };
  summaries: Record<string, ExperimentSummary>;
  runs: Record<string, ExperimentRun>;
}

export class ComparisonEngine {
  compare(experimentIds: string[], collector: MetricsCollector): ComparisonResult | null {
    if (experimentIds.length < 1) return null;

    const runs = loadExperimentRuns();
    const runMap: Record<string, ExperimentRun> = {};
    for (const id of experimentIds) {
      const r = runs.find(r => r.id === id);
      if (r) runMap[id] = r;
    }

    const summaries: Record<string, ExperimentSummary> = {};
    for (const id of experimentIds) {
      summaries[id] = collector.getSummary(id);
    }

    // Quality axis: audit score (높을수록 나쁨 → invert)
    const qualityValues: Record<string, number> = {};
    for (const id of experimentIds) {
      const run = runMap[id];
      // 낮을수록 좋은 audit score → 10 - score로 변환해서 높을수록 좋게
      qualityValues[id] = run?.auditScore !== null && run?.auditScore !== undefined
        ? 10 - run.auditScore
        : 0;
    }
    const qualityWinner = maxKey(qualityValues);

    // Cost axis: 낮을수록 좋음
    const costValues: Record<string, number> = {};
    for (const id of experimentIds) {
      costValues[id] = summaries[id].totalCost;
    }
    const costWinner = minKey(costValues);

    // Speed axis: 낮을수록 좋음
    const speedValues: Record<string, number> = {};
    for (const id of experimentIds) {
      speedValues[id] = summaries[id].totalLatencyMs;
    }
    const speedWinner = minKey(speedValues);

    // Efficiency axis: qualityPerDollar = (10 - auditScore) / cost
    const effValues: Record<string, number> = {};
    for (const id of experimentIds) {
      const quality = qualityValues[id];
      const cost = costValues[id];
      effValues[id] = cost > 0 ? quality / cost : quality;
    }
    const effWinner = maxKey(effValues);

    // Best overall: wins the most axes
    const winCounts: Record<string, number> = {};
    for (const id of experimentIds) winCounts[id] = 0;
    for (const winner of [qualityWinner, costWinner, speedWinner, effWinner]) {
      if (winner) winCounts[winner] = (winCounts[winner] ?? 0) + 1;
    }
    const bestOverall = maxKey(winCounts) ?? experimentIds[0];

    const runName = (id: string) => runMap[id]?.config.name ?? id.slice(-6);

    const reasoning = [
      `전체 최적: ${runName(bestOverall)} (${winCounts[bestOverall]}개 축 우승)`,
      qualityWinner && `품질 최고: ${runName(qualityWinner)} (Audit Score ${runMap[qualityWinner]?.auditScore ?? 'N/A'}/10)`,
      costWinner && `비용 최저: ${runName(costWinner)} (${formatCost(costValues[costWinner])})`,
      speedWinner && `속도 최고: ${runName(speedWinner)} (${formatLatency(speedValues[speedWinner])})`,
    ].filter(Boolean).join(' | ');

    return {
      experimentIds,
      summaries,
      runs: runMap,
      axes: {
        quality: {
          metric: 'auditScore',
          label: '품질 (10 - Audit Score)',
          values: qualityValues,
          winner: qualityWinner ?? '',
          higherIsBetter: true,
          formatter: v => `${(10 - v).toFixed(1)}/10`,
        },
        cost: {
          metric: 'totalCostUSD',
          label: '비용 (USD)',
          values: costValues,
          winner: costWinner ?? '',
          higherIsBetter: false,
          formatter: formatCost,
        },
        speed: {
          metric: 'totalLatencyMs',
          label: '속도 (ms)',
          values: speedValues,
          winner: speedWinner ?? '',
          higherIsBetter: false,
          formatter: formatLatency,
        },
        efficiency: {
          metric: 'qualityPerDollar',
          label: '효율 (품질/비용)',
          values: effValues,
          winner: effWinner ?? '',
          higherIsBetter: true,
          formatter: v => v.toFixed(1),
        },
      },
      recommendation: {
        bestOverall,
        bestQuality: qualityWinner ?? '',
        bestCost: costWinner ?? '',
        bestSpeed: speedWinner ?? '',
        reasoning,
      },
    };
  }

  generateMarkdown(result: ComparisonResult): string {
    const runName = (id: string) => result.runs[id]?.config.name ?? id.slice(-6);
    const lines = [
      `# 실험 비교 리포트`,
      `생성일: ${new Date().toLocaleString('ko-KR')}`,
      ``,
      `## 비교 대상`,
      result.experimentIds.map(id => `- ${runName(id)} (${id})`).join('\n'),
      ``,
      `## 축별 비교`,
      ...Object.values(result.axes).map(axis => [
        `### ${axis.label}`,
        result.experimentIds.map(id =>
          `- ${runName(id)}: ${axis.formatter(axis.values[id])} ${id === axis.winner ? '🏆' : ''}`,
        ).join('\n'),
      ].join('\n')),
      ``,
      `## 종합 추천`,
      result.recommendation.reasoning,
    ];
    return lines.join('\n');
  }
}

function maxKey(map: Record<string, number>): string {
  return Object.entries(map).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

function minKey(map: Record<string, number>): string {
  return Object.entries(map).sort((a, b) => a[1] - b[1])[0]?.[0] ?? '';
}

export { formatCost, formatTokens, formatLatency };

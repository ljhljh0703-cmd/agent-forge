export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

// USD per 1M tokens — 2026-03 기준
const PRICING: Record<string, ModelPricing> = {
  'claude-opus-4-6':           { inputPer1M: 15.00, outputPer1M: 75.00 },
  'claude-sonnet-4-6':         { inputPer1M: 3.00,  outputPer1M: 15.00 },
  'claude-haiku-4-5':          { inputPer1M: 0.80,  outputPer1M: 4.00  },
  'claude-haiku-4-5-20251001': { inputPer1M: 0.80,  outputPer1M: 4.00  },
  'gpt-4o':                    { inputPer1M: 2.50,  outputPer1M: 10.00 },
  'gpt-4o-mini':               { inputPer1M: 0.15,  outputPer1M: 0.60  },
  'gemini-2.0-flash':          { inputPer1M: 0.10,  outputPer1M: 0.40  },
  'gemini-2.0-pro':            { inputPer1M: 1.25,  outputPer1M: 5.00  },
  'gemini-1.5-flash':          { inputPer1M: 0.075, outputPer1M: 0.30  },
  'gemini-1.5-pro':            { inputPer1M: 1.25,  outputPer1M: 5.00  },
  'gemini-2.5-pro-preview-06-05': { inputPer1M: 1.25, outputPer1M: 10.00 },
};

/** 모델 + 토큰 수로 USD 비용 계산. 알 수 없는 모델은 gemini-2.0-flash 단가 적용 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = PRICING[model] ?? PRICING['gemini-2.0-flash'];
  return (inputTokens / 1_000_000) * p.inputPer1M +
         (outputTokens / 1_000_000) * p.outputPer1M;
}

export function formatCost(costUSD: number): string {
  if (costUSD === 0) return '$0.000';
  if (costUSD < 0.0001) return '<$0.0001';
  return `$${costUSD.toFixed(4)}`;
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return String(tokens);
}

export function formatLatency(ms: number): string {
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${ms}ms`;
}

export { PRICING };

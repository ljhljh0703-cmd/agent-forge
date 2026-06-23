#!/usr/bin/env node
/**
 * fill-metrics.mjs
 * docs/last-run-metrics.json을 읽어 README.md의 [측정전] 플레이스홀더를 실측값으로 교체.
 * 사용: node scripts/fill-metrics.mjs
 * null 필드는 [측정전] 유지 (더미 수치 주장 금지).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const METRICS_PATH = path.join(ROOT, 'docs', 'last-run-metrics.json');
const README_PATH = path.join(ROOT, 'README.md');

const metrics = JSON.parse(fs.readFileSync(METRICS_PATH, 'utf8'));

function fmt(v, suffix = '') {
  return v == null ? '[측정전]' : `${v}${suffix}`;
}
function fmtCost(v) {
  return v == null ? '[측정전]' : `$${v.toFixed(4)}`;
}
function fmtTokens(v) {
  return v == null ? '[측정전]' : `${(v / 1000).toFixed(1)}k`;
}
function fmtMs(v) {
  return v == null ? '[측정전]' : `${Math.round(v / 1000)}s`;
}

let readme = fs.readFileSync(README_PATH, 'utf8');

// Badge: Debt_Score-측정전 → Debt_Score-X
if (metrics.debtScore != null) {
  readme = readme.replace(
    /Debt_Score-[^)]+/,
    `Debt_Score-${metrics.debtScore}%2F10-${metrics.debtScore <= 3 ? 'brightgreen' : metrics.debtScore <= 6 ? 'yellow' : 'red'}`,
  );
}

// Table: Debt Score
readme = readme.replace(
  /\| Debt Score \(slime-survivors\) \| \[측정전\] \|/,
  `| Debt Score (slime-survivors) | ${fmt(metrics.debtScore, '/10')} |`,
);

// 루프백 횟수
readme = readme.replace(
  /\| 루프백 횟수 \| \[측정전\] \|/,
  `| 루프백 횟수 | ${fmt(metrics.loopbackCount, '회')} |`,
);

// DOM 요소 수
readme = readme.replace(
  /\| DOM 요소 수 \| \[측정전\] \|/,
  `| DOM 요소 수 | ${fmt(metrics.domCount, '개')} |`,
);

// gameLoop 감지
readme = readme.replace(
  /\| gameLoop 감지 \| \[측정전\] \|/,
  `| gameLoop 감지 | ${metrics.hasGameLoop == null ? '[측정전]' : metrics.hasGameLoop ? 'true' : 'false'} |`,
);

// iframe 로드 시간
readme = readme.replace(
  /\| iframe 로드 시간 \| \[측정전\] ms \|/,
  `| iframe 로드 시간 | ${fmt(metrics.iframeLoadTimeMs, ' ms')} |`,
);

// 파이프라인 총 소요
readme = readme.replace(
  /\| 파이프라인 총 소요 \| \[측정전\] \|/,
  `| 파이프라인 총 소요 | ${fmtMs(metrics.pipelineTotalMs)} |`,
);

// 모델 전략 표 — 행 당 3개 [측정전]
// All Flash
if (metrics.allFlash) {
  readme = readme.replace(
    /\| All Flash \(gemini-3\.5-flash\) \| \[측정전\] \| \[측정전\] \| \[측정전\] \|/,
    `| All Flash (gemini-3.5-flash) | ${fmtCost(metrics.allFlash.costUSD)} | ${fmtTokens(metrics.allFlash.totalTokens)} | ${fmtMs(metrics.allFlash.latencyMs)} |`,
  );
}
if (metrics.hybridPro) {
  readme = readme.replace(
    /\| Hybrid Pro \| \[측정전\] \| \[측정전\] \| \[측정전\] \|/,
    `| Hybrid Pro | ${fmtCost(metrics.hybridPro.costUSD)} | ${fmtTokens(metrics.hybridPro.totalTokens)} | ${fmtMs(metrics.hybridPro.latencyMs)} |`,
  );
}
if (metrics.allPro) {
  readme = readme.replace(
    /\| All Pro \(gemini-3\.1-pro\) \| \[측정전\] \| \[측정전\] \| \[측정전\] \|/,
    `| All Pro (gemini-3.1-pro) | ${fmtCost(metrics.allPro.costUSD)} | ${fmtTokens(metrics.allPro.totalTokens)} | ${fmtMs(metrics.allPro.latencyMs)} |`,
  );
}

fs.writeFileSync(README_PATH, readme, 'utf8');

console.log('README.md 갱신 완료:');
console.log(`  debtScore: ${metrics.debtScore ?? '[측정전]'}`);
console.log(`  loopbackCount: ${metrics.loopbackCount ?? '[측정전]'}`);
console.log(`  pipelineTotalMs: ${metrics.pipelineTotalMs ?? '[측정전]'}`);
console.log('  allFlash/hybridPro/allPro: 해당 필드가 null이면 [측정전] 유지');

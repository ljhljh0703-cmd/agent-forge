import { spawn } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface ProofTarget {
  source: 'gdd';
  coreVerb: string;
  requestedScoreTarget: number | null;
  proofScoreTarget: number;
  movementKeys: string[];
  moveScenarioMs: number;
  failScenarioMs: number;
  assertions: string[];
}

export interface DigestSample {
  status: string;
  score: number;
  winTarget: number;
  playerMoved: boolean;
  playerPos: { x: number | null; y: number | null };
  frame: number;
}

export interface ReachabilityProof {
  target: ProofTarget;
  pass: boolean;
  playerMoves: boolean;
  scoreChanges: boolean;
  winReachable: boolean;
  failReachable: boolean;
  terminalReachable: boolean;
  flagged: string[];
  move: {
    initial: DigestSample | null;
    final: DigestSample | null;
    maxScore: number;
    samples: DigestSample[];
  };
  fail: {
    final: DigestSample | null;
    samples: DigestSample[];
  };
}

export function deriveProofTarget(idea: string, gdd: string): ProofTarget {
  const requestedScoreTarget = extractRequestedScoreTarget(gdd);
  return {
    source: 'gdd',
    coreVerb: detectCoreVerb(`${idea}\n${gdd}`),
    requestedScoreTarget,
    proofScoreTarget: Math.max(1, Math.min(requestedScoreTarget ?? 3, 3)),
    movementKeys: ['ArrowRight', 'ArrowDown', ' '],
    moveScenarioMs: 12_000,
    failScenarioMs: 15_000,
    assertions: ['playerMoves', 'scoreChanges', 'terminalReachable'],
  };
}

export async function runReachabilityProof(
  gamePath: string,
  proofDir: string,
  target: ProofTarget,
  outputName = 'reachability.json'
): Promise<ReachabilityProof> {
  await mkdir(proofDir, { recursive: true });
  const harnessPath = join(proofDir, `${outputName.replace(/\.json$/, '')}-harness.html`);
  const outputPath = join(proofDir, outputName);
  await writeFile(harnessPath, buildHarnessHtml(gamePath, target), 'utf8');

  const html = await dumpDom(harnessPath, target.moveScenarioMs + target.failScenarioMs + 10_000);
  const proof = parseHarnessResult(html);
  await writeFile(outputPath, `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
  return proof;
}

export async function runDeadFixtureProof(proofDir: string, target: ProofTarget): Promise<ReachabilityProof> {
  const fixturePath = join(proofDir, 'dead-fixture.html');
  await writeFile(
    fixturePath,
    `<!doctype html>
<html>
<body>
<canvas id="game" width="320" height="180"></canvas>
<script>
window.__af = {
  status: 'play',
  score: 0,
  winTarget: 1,
  playerMoved: false,
  playerPos: { x: 160, y: 90 },
  frame: 0
};
setInterval(() => { window.__af.frame += 1; }, 100);
</script>
</body>
</html>
`,
    'utf8'
  );
  return runReachabilityProof(fixturePath, proofDir, target, 'dead-reachability.json');
}

function extractRequestedScoreTarget(gdd: string): number | null {
  const winLine = gdd
    .split(/\r?\n/)
    .find((line) => /\b(win|target|score|collect|reach)\b/i.test(line) && /\d+/.test(line));
  const match = winLine?.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function detectCoreVerb(text: string): string {
  const verbs = ['dash', 'collect', 'dodge', 'survive', 'move', 'aim'];
  return verbs.find((verb) => new RegExp(`\\b${verb}\\b`, 'i').test(text)) ?? 'move';
}

async function dumpDom(harnessPath: string, virtualTimeBudgetMs: number): Promise<string> {
  const browser = await findHeadlessBrowser();
  const { code, stdout, stderr } = await spawnCollect(browser, [
    '--headless=new',
    '--disable-gpu',
    '--allow-file-access-from-files',
    '--disable-web-security',
    `--virtual-time-budget=${virtualTimeBudgetMs}`,
    '--run-all-compositor-stages-before-draw',
    '--dump-dom',
    pathToFileURL(harnessPath).href,
  ]);
  if (code !== 0) {
    throw new Error(`reachability harness failed with ${code}: ${stderr}`);
  }
  return stdout;
}

async function findHeadlessBrowser(): Promise<string> {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Try the next installed browser.
    }
  }
  throw new Error('No supported headless browser found for reachability proof');
}

function buildHarnessHtml(gamePath: string, target: ProofTarget): string {
  const gameUrl = pathToFileURL(gamePath).href;
  const targetJson = JSON.stringify(target);

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>AgentForge reachability harness</title></head>
<body>
<pre id="result">pending</pre>
<iframe id="game-frame" style="width: 960px; height: 640px; border: 0"></iframe>
<script>
const TARGET = ${targetJson};
const GAME_URL = ${JSON.stringify(gameUrl)};
const result = document.getElementById('result');
const frame = document.getElementById('game-frame');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function readDigest(win) {
  const af = win.__af || {};
  const pos = af.playerPos || {};
  return {
    status: String(af.status || 'missing'),
    score: Number.isFinite(Number(af.score)) ? Number(af.score) : 0,
    winTarget: Number.isFinite(Number(af.winTarget)) ? Number(af.winTarget) : TARGET.proofScoreTarget,
    playerMoved: Boolean(af.playerMoved),
    playerPos: {
      x: Number.isFinite(Number(pos.x)) ? Number(pos.x) : null,
      y: Number.isFinite(Number(pos.y)) ? Number(pos.y) : null
    },
    frame: Number.isFinite(Number(af.frame)) ? Number(af.frame) : 0
  };
}

function sendKey(win, type, key) {
  const event = new KeyboardEvent(type, {
    key,
    code: key === ' ' ? 'Space' : key,
    bubbles: true,
    cancelable: true
  });
  win.dispatchEvent(event);
  win.document.dispatchEvent(event);
  const canvas = win.document.querySelector('canvas');
  if (canvas) {
    canvas.dispatchEvent(event);
  }
}

function setKeys(win, type) {
  for (const key of TARGET.movementKeys) {
    sendKey(win, type, key);
  }
  sendKey(win, type, 'd');
  sendKey(win, type, 's');
}

async function loadGame(scenario) {
  const url = GAME_URL + '?afScenario=' + encodeURIComponent(scenario) + '&t=' + Date.now();
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('iframe load timeout')), 5000);
    frame.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    frame.src = url;
  });
  await sleep(300);
  frame.contentWindow.focus();
  return frame.contentWindow;
}

async function runMoveScenario() {
  const win = await loadGame('move');
    const samples = [];
    const initial = readDigest(win);
    let maxScore = initial.score;
    let winReachable = initial.status === 'win';
    const ticks = Math.ceil(TARGET.moveScenarioMs / 33);

  for (let tick = 0; tick < ticks; tick += 1) {
    const input = movementInputForTick(tick, ticks);
    const sample = await stepGame(win, input, 1 / 30);
    samples.push(sample);
    maxScore = Math.max(maxScore, sample.score);
    winReachable = winReachable || sample.status === 'win' || sample.score >= Math.max(1, sample.winTarget || TARGET.proofScoreTarget);
  }
  setKeys(win, 'keyup');
  await sleep(100);
  return { initial, final: readDigest(win), maxScore, winReachable, samples: thinSamples(samples) };
}

function movementInputForTick(tick, totalTicks) {
  const p = tick / Math.max(1, totalTicks);
  const input = { dash: tick % 12 === 0 };
  if (p < 0.34) return { ...input, right: true, down: true };
  if (p < 0.56) return { ...input, right: true, up: true };
  if (p < 0.78) return { ...input, left: true, up: true };
  return { ...input, left: true, down: true };
}

async function runFailScenario() {
  const win = await loadGame('fail');
  const samples = [];
  let failReachable = false;
  const ticks = Math.ceil(TARGET.failScenarioMs / 33);

  for (let tick = 0; tick < ticks; tick += 1) {
    const sample = await stepGame(win, {}, 1 / 30);
    samples.push(sample);
    failReachable = failReachable || sample.status === 'fail' || sample.status === 'lose' || sample.status === 'lost';
    if (failReachable) break;
  }
  return { final: readDigest(win), failReachable, samples: thinSamples(samples) };
}

async function stepGame(win, input, dt) {
  if (typeof win.__afStep === 'function') {
    return normalizeDigest(win.__afStep(input, dt) || win.__af || {});
  }

  if (input.right) sendKey(win, 'keydown', 'ArrowRight');
  if (input.down) sendKey(win, 'keydown', 'ArrowDown');
  if (input.dash) sendKey(win, 'keydown', ' ');
  await sleep(Math.max(16, dt * 1000));
  if (input.dash) sendKey(win, 'keyup', ' ');
  return readDigest(win);
}

function normalizeDigest(af) {
  const pos = af.playerPos || {};
  return {
    status: String(af.status || 'missing'),
    score: Number.isFinite(Number(af.score)) ? Number(af.score) : 0,
    winTarget: Number.isFinite(Number(af.winTarget)) ? Number(af.winTarget) : TARGET.proofScoreTarget,
    playerMoved: Boolean(af.playerMoved),
    playerPos: {
      x: Number.isFinite(Number(pos.x)) ? Number(pos.x) : null,
      y: Number.isFinite(Number(pos.y)) ? Number(pos.y) : null
    },
    frame: Number.isFinite(Number(af.frame)) ? Number(af.frame) : 0
  };
}

function thinSamples(samples) {
  if (samples.length <= 12) return samples;
  const stride = Math.max(1, Math.floor(samples.length / 12));
  return samples.filter((_, index) => index % stride === 0).slice(0, 12);
}

(async () => {
  try {
    const move = await runMoveScenario();
    const fail = await runFailScenario();
    const playerMoves = Boolean(move.final && (move.final.playerMoved ||
      (move.initial && move.final.playerPos.x !== null && move.initial.playerPos.x !== null &&
        (Math.abs(move.final.playerPos.x - move.initial.playerPos.x) > 2 ||
          Math.abs(move.final.playerPos.y - move.initial.playerPos.y) > 2))));
    const scoreChanges = move.maxScore > (move.initial ? move.initial.score : 0);
    const winReachable = Boolean(move.winReachable);
    const failReachable = Boolean(fail.failReachable);
    const terminalReachable = winReachable || failReachable;
    const flagged = [];
    if (!playerMoves) flagged.push('playerMoves');
    if (!scoreChanges) flagged.push('scoreChanges');
    if (!terminalReachable) flagged.push('terminalReachable');
    const proof = {
      target: TARGET,
      pass: flagged.length === 0,
      playerMoves,
      scoreChanges,
      winReachable,
      failReachable,
      terminalReachable,
      flagged,
      move: {
        initial: move.initial,
        final: move.final,
        maxScore: move.maxScore,
        samples: move.samples
      },
      fail: {
        final: fail.final,
        samples: fail.samples
      }
    };
    result.textContent = JSON.stringify(proof);
  } catch (error) {
    result.textContent = JSON.stringify({
      target: TARGET,
      pass: false,
      playerMoves: false,
      scoreChanges: false,
      winReachable: false,
      failReachable: false,
      terminalReachable: false,
      flagged: ['harnessError'],
      move: { initial: null, final: null, maxScore: 0, samples: [] },
      fail: { final: null, samples: [] },
      error: String(error && error.stack || error)
    });
  }
})();
</script>
</body>
</html>
`;
}

function parseHarnessResult(html: string): ReachabilityProof {
  const match = html.match(/<pre id="result">([\s\S]*?)<\/pre>/);
  if (!match) {
    throw new Error('reachability harness did not emit #result');
  }
  return JSON.parse(decodeHtml(match[1])) as ReachabilityProof;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function spawnCollect(
  command: string,
  args: string[]
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import type { ProofTarget, ReachabilityProof } from './reachability.js';
import type { TemplateApiCheck, TemplateApiFlag } from './template-api.js';

export interface TemplateEntry {
  id: string;
  description: string;
  contract: {
    archetype: string;
    gameplayLoop: string[];
    observationDigest: string;
    commandSurface: string;
    assetPattern: string;
    proofPattern: string;
  };
  sourceRuns: string[];
  stability: number;
  status: 'candidate' | 'stable';
  createdAt: string;
  updatedAt: string;
}

export interface TemplateMemory {
  schemaVersion: 1;
  stableThresholdProjects: number;
  notes: string;
  templates: TemplateEntry[];
}

export interface DebugLogEntry {
  id: string;
  errorSignature: string;
  rootCause: string;
  stage: string;
  source: 'generate' | 'template-api' | 'p4-seed';
  runId?: string;
  evidence?: string;
  observedAt: string;
  verifiedFix?: {
    summary: string;
    verifiedAt: string;
    runId: string;
    evidence: string[];
  };
}

export interface DebugLog {
  schemaVersion: 1;
  generalizerThreshold: number;
  notes: string;
  entries: DebugLogEntry[];
}

export interface RuleCandidate {
  id: string;
  errorSignature: string;
  occurrences: number;
  proposedRule: string;
  checkTiming: 'pre-plan' | 'pre-produce' | 'post-produce' | 'verify';
  status: 'candidate';
  active: false;
  requiresHitl: true;
  createdAt: string;
  updatedAt: string;
  evidenceEntryIds: string[];
  activationNote: string;
}

export interface RuleCandidateMemory {
  schemaVersion: 1;
  notes: string;
  candidates: RuleCandidate[];
}

export interface ActiveRule {
  id: string;
  rule: string;
  checkTiming: 'pre-plan' | 'pre-produce' | 'post-produce' | 'verify';
  approvedBy: string;
  approvedAt: string;
}

export interface ActiveRuleMemory {
  schemaVersion: 1;
  notes: string;
  rules: ActiveRule[];
}

export interface UsedTemplate {
  id: string;
  description: string;
  stabilityAtUse: number;
  statusAtUse: TemplateEntry['status'];
  sourceRuns: string[];
}

export interface EvolutionContext {
  memoryDir: string;
  templatesPath: string;
  debugLogPath: string;
  ruleCandidatesPath: string;
  activeRulesPath: string;
  selectedTemplates: TemplateEntry[];
  activeRules: ActiveRule[];
  promptText: string;
}

export interface SuccessfulRunInput {
  runId: string;
  idea: string;
  gdd: string;
  html: string;
  proofTarget: ProofTarget;
  templateApiCheck: TemplateApiCheck;
  reachabilityProof: ReachabilityProof;
}

export interface SuccessfulRunEvolution {
  template: Pick<TemplateEntry, 'id' | 'description' | 'stability' | 'status' | 'sourceRuns'>;
  memoryPaths: {
    templates: string;
    debugLog: string;
    ruleCandidates: string;
    activeRules: string;
  };
}

export interface DebugEventInput {
  errorSignature: string;
  rootCause: string;
  stage: string;
  source: DebugLogEntry['source'];
  runId?: string;
  evidence?: string;
  verifiedFix?: DebugLogEntry['verifiedFix'];
}

const stableThresholdProjects = 5;
const generalizerThreshold = 3;

export async function loadEvolutionContext(repoRoot: string): Promise<EvolutionContext> {
  const memoryDir = join(repoRoot, 'studio-memory');
  const templatesPath = join(memoryDir, 'templates.json');
  const debugLogPath = join(memoryDir, 'debug-log.json');
  const ruleCandidatesPath = join(memoryDir, 'rule-candidates.json');
  const activeRulesPath = join(memoryDir, 'active-rules.json');
  const [templateMemory, activeRuleMemory] = await Promise.all([
    readTemplateMemory(templatesPath),
    readActiveRuleMemory(activeRulesPath),
  ]);
  const selectedTemplates = templateMemory.templates
    .filter((entry) => entry.stability >= 1)
    .sort((a, b) => b.stability - a.stability || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 2);
  const activeRules = activeRuleMemory.rules;

  return {
    memoryDir,
    templatesPath,
    debugLogPath,
    ruleCandidatesPath,
    activeRulesPath,
    selectedTemplates,
    activeRules,
    promptText: formatEvolutionPrompt(selectedTemplates, activeRules),
  };
}

export function usedTemplatesFromContext(context: EvolutionContext): UsedTemplate[] {
  return context.selectedTemplates.map((entry) => ({
    id: entry.id,
    description: entry.description,
    stabilityAtUse: entry.stability,
    statusAtUse: entry.status,
    sourceRuns: entry.sourceRuns,
  }));
}

export async function recordSuccessfulRun(
  repoRoot: string,
  input: SuccessfulRunInput
): Promise<SuccessfulRunEvolution> {
  const paths = memoryPaths(repoRoot);
  await mkdir(paths.memoryDir, { recursive: true });
  const memory = await readTemplateMemory(paths.templatesPath);
  const now = new Date().toISOString();
  const extracted = extractTemplate(input, now);
  const existing = memory.templates.find((entry) => entry.id === extracted.id);
  const updated = existing ? mergeTemplate(existing, extracted, input.runId, now) : extracted;
  memory.templates = existing
    ? memory.templates.map((entry) => (entry.id === updated.id ? updated : entry))
    : [...memory.templates, updated];
  memory.templates.sort((a, b) => b.stability - a.stability || a.id.localeCompare(b.id));
  await writeJson(paths.templatesPath, memory);

  return {
    template: {
      id: updated.id,
      description: updated.description,
      stability: updated.stability,
      status: updated.status,
      sourceRuns: updated.sourceRuns,
    },
    memoryPaths: toRepoRelativePaths(repoRoot, paths),
  };
}

export function templateApiDebugEvents(
  runId: string,
  flags: TemplateApiFlag[],
  verifiedFix?: DebugLogEntry['verifiedFix']
): DebugEventInput[] {
  return flags.map((flag) => ({
    errorSignature: `template_api_flag:${flag.capability}`,
    rootCause: `Requested unsupported capability matched by template_api: ${flag.matched.join(', ')}`,
    stage: 'plan-template-api',
    source: 'template-api',
    runId,
    evidence: flag.suggestedDownscope,
    verifiedFix,
  }));
}

export async function recordDebugEvents(
  repoRoot: string,
  events: DebugEventInput[]
): Promise<{ debugLogPath: string; ruleCandidatesPath: string; candidates: RuleCandidate[] }> {
  const paths = memoryPaths(repoRoot);
  await mkdir(paths.memoryDir, { recursive: true });
  const debugLog = await readDebugLog(paths.debugLogPath);
  const now = new Date().toISOString();
  const entries = events.map((event, index) => ({
    id: `${slug(event.errorSignature)}-${now.replace(/[-:.TZ]/g, '').slice(0, 14)}-${index + 1}`,
    observedAt: now,
    ...event,
  }));
  debugLog.entries.push(...entries);
  await writeJson(paths.debugLogPath, debugLog);

  const ruleCandidates = await generalizeRuleCandidates(paths.ruleCandidatesPath, debugLog, now);
  return {
    debugLogPath: relative(repoRoot, paths.debugLogPath),
    ruleCandidatesPath: relative(repoRoot, paths.ruleCandidatesPath),
    candidates: ruleCandidates.candidates,
  };
}

export function classifyErrorSignature(stage: string, error: unknown): DebugEventInput {
  const message = error instanceof Error ? error.message : String(error);
  return {
    errorSignature: `${stage}:${signatureFromMessage(message)}`,
    rootCause: `Generation stage "${stage}" failed. Inspect the recorded error and stage output before adding a fix.`,
    stage,
    source: 'generate',
    evidence: message.slice(0, 500),
  };
}

export async function seedDebugThresholdDemo(repoRoot: string, runId: string): Promise<{
  debugLogPath: string;
  ruleCandidatesPath: string;
  candidate: RuleCandidate | undefined;
}> {
  const reachability = await readJson<{ pass: boolean } | null>(
    join(repoRoot, 'runs', runId, 'proof', 'reachability.json'),
    null
  );
  if (!reachability?.pass) {
    throw new Error(`Cannot seed a verifiedFix from ${runId}: runs/${runId}/proof/reachability.json is missing or not pass=true`);
  }

  const verifiedAt = new Date().toISOString();
  const events: DebugEventInput[] = Array.from({ length: generalizerThreshold }, (_, index) => ({
    errorSignature: 'static_validation:missing-window-afstep',
    rootCause:
      'Generated HTML omitted the thin command surface, which made reachability proof depend on browser animation timing instead of the same update/render path.',
    stage: 'post-produce-static-validation',
    source: 'p4-seed',
    runId,
    evidence: `P4 threshold seed occurrence ${index + 1}/3. Seeded for Generalizer demo; activation remains HITL-only.`,
    verifiedFix: {
      summary:
        'Require window.__afStep(input, dt), validate it statically, and verify the generated run with the reachability proof.',
      verifiedAt,
      runId,
      evidence: [`runs/${runId}/proof/reachability.json`, `runs/${runId}/meta.json`],
    },
  }));
  const result = await recordDebugEvents(repoRoot, events);
  return {
    debugLogPath: result.debugLogPath,
    ruleCandidatesPath: result.ruleCandidatesPath,
    candidate: result.candidates.find((candidate) => candidate.errorSignature === events[0].errorSignature),
  };
}

function formatEvolutionPrompt(templates: TemplateEntry[], activeRules: ActiveRule[]): string {
  const sections: string[] = [
    'EVOLUTION_MEMORY:',
    'Use repo-local studio-memory as a scaffold source only. Do not invent unavailable engine features.',
  ];

  if (templates.length > 0) {
    sections.push('Reusable scaffold candidates from prior verified runs:');
    for (const entry of templates) {
      sections.push(
        `- ${entry.id}: ${entry.description}`,
        `  contract: ${formatContract(entry.contract)}`,
        `  stability: ${entry.stability} project(s); status: ${entry.status}`
      );
    }
    sections.push(
      'If a candidate fits the idea, reuse the top compatible scaffold and include exactly this line in the GDD: "Reused Scaffold Candidate: <template id>".'
    );
  } else {
    sections.push('Reusable scaffold candidates: none yet. Generate from the base Canvas template.');
  }

  if (activeRules.length > 0) {
    sections.push('Approved proactive rules from studio-memory/active-rules.json:');
    for (const rule of activeRules) {
      sections.push(`- ${rule.id} (${rule.checkTiming}): ${rule.rule}`);
    }
  } else {
    sections.push('Approved proactive rules: none. Ignore rule-candidates.json unless a human has promoted a rule to active-rules.json.');
  }

  return sections.join('\n');
}

function extractTemplate(input: SuccessfulRunInput, now: string): TemplateEntry {
  const text = `${input.idea}\n${input.gdd}\n${input.html}`;
  const archetype = detectArchetype(text);
  const gameplayLoop = Array.from(
    new Set([
      input.proofTarget.coreVerb,
      /collect|coin|pickup|score/i.test(text) ? 'collectible-score' : 'score-loop',
      /timer|survive|fail/i.test(text) ? 'fail-timer' : 'terminal-state',
      /dash|burst|space/i.test(text) ? 'dash-input' : 'keyboard-move',
    ])
  );
  const id = `template-${slug(`${archetype}-${gameplayLoop.join('-')}`)}`;
  const description = `${archetype} Canvas scaffold with ${gameplayLoop.join(', ')}`;

  return {
    id,
    description,
    contract: {
      archetype,
      gameplayLoop,
      observationDigest: 'window.__af { status, score, winTarget, playerMoved, playerPos, frame }',
      commandSurface: 'window.__afStep(input, dt) advances the same update/render path',
      assetPattern: 'single generated sprite loaded via Image and drawn with ctx.drawImage',
      proofPattern: `reachability target ${input.proofTarget.coreVerb}; terminalReachable=${input.reachabilityProof.terminalReachable}`,
    },
    sourceRuns: [input.runId],
    stability: 1,
    status: 'candidate',
    createdAt: now,
    updatedAt: now,
  };
}

function mergeTemplate(existing: TemplateEntry, extracted: TemplateEntry, runId: string, now: string): TemplateEntry {
  const sourceRuns = Array.from(new Set([...existing.sourceRuns, runId]));
  const stability = sourceRuns.length;
  return {
    ...existing,
    description: extracted.description,
    contract: extracted.contract,
    sourceRuns,
    stability,
    status: stability >= stableThresholdProjects ? 'stable' : 'candidate',
    updatedAt: now,
  };
}

async function generalizeRuleCandidates(
  ruleCandidatesPath: string,
  debugLog: DebugLog,
  now: string
): Promise<RuleCandidateMemory> {
  const memory = await readRuleCandidateMemory(ruleCandidatesPath);
  const bySignature = new Map<string, DebugLogEntry[]>();
  for (const entry of debugLog.entries) {
    const group = bySignature.get(entry.errorSignature) ?? [];
    group.push(entry);
    bySignature.set(entry.errorSignature, group);
  }

  for (const [signature, entries] of bySignature) {
    if (entries.length < debugLog.generalizerThreshold) continue;
    const existing = memory.candidates.find((candidate) => candidate.errorSignature === signature);
    const evidenceEntryIds = entries.map((entry) => entry.id);
    if (existing) {
      existing.occurrences = entries.length;
      existing.evidenceEntryIds = evidenceEntryIds;
      existing.updatedAt = now;
      continue;
    }

    memory.candidates.push({
      id: `rule-${slug(signature)}`,
      errorSignature: signature,
      occurrences: entries.length,
      proposedRule: proposedRuleFor(signature, entries),
      checkTiming: checkTimingFor(signature),
      status: 'candidate',
      active: false,
      requiresHitl: true,
      createdAt: now,
      updatedAt: now,
      evidenceEntryIds,
      activationNote:
        'Staged only. Do not activate this rule until command-center Gate 3 and author confirmation promote it into studio-memory/active-rules.json.',
    });
  }

  memory.candidates.sort((a, b) => b.occurrences - a.occurrences || a.id.localeCompare(b.id));
  await writeJson(ruleCandidatesPath, memory);
  return memory;
}

function proposedRuleFor(signature: string, entries: DebugLogEntry[]): string {
  if (signature === 'static_validation:missing-window-afstep') {
    return 'Before accepting produced HTML, statically require window.__afStep(input, dt) and then run reachability proof against that command surface.';
  }
  if (signature.startsWith('template_api_flag:')) {
    const capability = signature.split(':')[1] ?? 'unsupported capability';
    return `Before GDD production, scan for ${capability} and force a supported Canvas downscope instead of silently designing outside the Template API.`;
  }
  const rootCause = entries[0]?.rootCause ?? signature;
  return `Add a proactive check for repeated signature "${signature}": ${rootCause}`;
}

function checkTimingFor(signature: string): RuleCandidate['checkTiming'] {
  if (signature.startsWith('template_api_flag:')) return 'pre-plan';
  if (signature.includes('static_validation')) return 'post-produce';
  if (signature.includes('reachability')) return 'verify';
  return 'pre-produce';
}

function detectArchetype(text: string): string {
  if (/top[- ]down|arena|2d/i.test(text)) return 'top-down-2d';
  if (/grid|tile/i.test(text)) return 'grid-2d';
  return 'single-screen-2d';
}

function formatContract(contract: TemplateEntry['contract']): string {
  return [
    contract.archetype,
    contract.gameplayLoop.join(' + '),
    contract.observationDigest,
    contract.commandSurface,
    contract.assetPattern,
    contract.proofPattern,
  ].join(' | ');
}

function signatureFromMessage(message: string): string {
  return slug(
    message
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '<email>')
      .replace(/[0-9a-f]{24,}/gi, '<hash>')
      .replace(/\d+/g, '<n>')
      .slice(0, 90)
  );
}

async function readTemplateMemory(path: string): Promise<TemplateMemory> {
  return readJson(path, {
    schemaVersion: 1,
    stableThresholdProjects,
    notes: 'Repo-local P4 Template memory. stability is the number of distinct source runs; status becomes stable at 5 projects/runs.',
    templates: [],
  });
}

async function readDebugLog(path: string): Promise<DebugLog> {
  return readJson(path, {
    schemaVersion: 1,
    generalizerThreshold,
    notes: 'Repo-local P4 Debug memory. verifiedFix is written only when a follow-up verification artifact exists.',
    entries: [],
  });
}

async function readRuleCandidateMemory(path: string): Promise<RuleCandidateMemory> {
  return readJson(path, {
    schemaVersion: 1,
    notes:
      'Rule candidates are staged only. Human approval must copy/promote a candidate into active-rules.json before it affects generation gates.',
    candidates: [],
  });
}

async function readActiveRuleMemory(path: string): Promise<ActiveRuleMemory> {
  return readJson(path, {
    schemaVersion: 1,
    notes: 'Only command-center Gate 3 plus author-approved proactive rules belong here.',
    rules: [],
  });
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return fallback;
    }
    throw error;
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function memoryPaths(repoRoot: string): {
  memoryDir: string;
  templatesPath: string;
  debugLogPath: string;
  ruleCandidatesPath: string;
  activeRulesPath: string;
} {
  const memoryDir = join(repoRoot, 'studio-memory');
  return {
    memoryDir,
    templatesPath: join(memoryDir, 'templates.json'),
    debugLogPath: join(memoryDir, 'debug-log.json'),
    ruleCandidatesPath: join(memoryDir, 'rule-candidates.json'),
    activeRulesPath: join(memoryDir, 'active-rules.json'),
  };
}

function toRepoRelativePaths(
  repoRoot: string,
  paths: ReturnType<typeof memoryPaths>
): SuccessfulRunEvolution['memoryPaths'] {
  return {
    templates: relative(repoRoot, resolve(paths.templatesPath)),
    debugLog: relative(repoRoot, resolve(paths.debugLogPath)),
    ruleCandidates: relative(repoRoot, resolve(paths.ruleCandidatesPath)),
    activeRules: relative(repoRoot, resolve(paths.activeRulesPath)),
  };
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'entry'
  );
}

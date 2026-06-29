import { spawn } from 'node:child_process';
import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { codexHome, finalAgentMessage, runCodexExec } from './codex-cli.js';
import { checkTemplateApi, formatTemplateApiCheck, type TemplateApiCheck } from './template-api.js';

interface RunMeta {
  runId: string;
  idea: string;
  createdAt: string;
  codex: {
    gddThreadId: string | null;
    assetThreadId: string | null;
    produceThreadId: string | null;
    assetSource: string;
  };
  outputs: {
    gdd: string;
    rawAsset: string;
    sprite: string;
    atlas: string;
    game: string;
    snapshot: string;
    templateApiCheck: string;
  };
  templateApiCheck: TemplateApiCheck;
  proof: {
    usesCanvas: boolean;
    usesGeneratedAsset: boolean;
    usesDrawImage: boolean;
    snapshotCaptured: boolean;
  };
}

const repoRoot = process.cwd();
const idea = process.argv.slice(2).join(' ').trim();

if (!idea) {
  console.error('Usage: npm run generate -- "<game idea>"');
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});

async function main(): Promise<void> {
  const createdAt = new Date().toISOString();
  const runId = makeRunId(createdAt, idea);
  const runDir = join(repoRoot, 'runs', runId);
  const assetDir = join(runDir, 'assets');
  const gameDir = join(runDir, 'game');
  const proofDir = join(runDir, 'proof');
  const knowledgeDir = join(repoRoot, 'orchestrator', 'knowledge');
  const [templateApi, designRules] = await Promise.all([
    readFile(join(knowledgeDir, 'template_api.md'), 'utf8'),
    readFile(join(knowledgeDir, 'design_rules.md'), 'utf8'),
  ]);

  await mkdir(assetDir, { recursive: true });
  await mkdir(gameDir, { recursive: true });
  await mkdir(proofDir, { recursive: true });

  const gddResult = await runCodexExec(gddPrompt(idea, templateApi, designRules), {
    cwd: repoRoot,
    sandbox: 'read-only',
    timeoutMs: 180_000,
  });
  if (gddResult.code !== 0) {
    throw new Error(`Codex GDD generation failed with code ${gddResult.code}: ${gddResult.stderr}`);
  }
  const gdd = finalAgentMessage(gddResult);
  if (!gdd) throw new Error('Codex GDD generation returned no agent message');
  const templateApiCheck = checkTemplateApi(idea, gdd);
  const gddPath = join(runDir, 'gdd.md');
  const checkedGdd = `${gdd.trim()}\n\n---\n\n## Deterministic Template API Check\n\n${formatTemplateApiCheck(templateApiCheck)}\n`;
  await writeFile(gddPath, checkedGdd, 'utf8');
  const templateApiCheckPath = join(proofDir, 'template-api-check.json');
  await writeJson(templateApiCheckPath, templateApiCheck);

  const assetResult = await runCodexExec(assetPrompt(idea), {
    cwd: repoRoot,
    sandbox: 'workspace-write',
    timeoutMs: 300_000,
  });
  if (assetResult.code !== 0) {
    throw new Error(`Codex image generation failed with code ${assetResult.code}: ${assetResult.stderr}`);
  }
  const generatedImage = assetResult.generatedImages[0];
  if (!generatedImage) {
    throw new Error(
      `Codex image_gen did not leave a PNG under ${codexHome()}/generated_images/${assetResult.threadId ?? '<no-thread-id>'}`
    );
  }

  const rawAssetPath = join(assetDir, 'codex-raw.png');
  const spritePath = join(assetDir, 'codex-sprite.png');
  const atlasPath = join(assetDir, 'atlas.json');
  await copyFile(generatedImage.path, rawAssetPath);
  await removeChromaKey(rawAssetPath, spritePath);
  await writeJson(atlasPath, {
    schemaVersion: 1,
    source: 'codex-cli-image_gen',
    raw: './codex-raw.png',
    image: './codex-sprite.png',
    frameSize: { width: 96, height: 96 },
    frames: [{ id: 'player_coin', x: 0, y: 0, w: 96, h: 96, anchor: { x: 48, y: 48 } }],
    notes: 'P1 one-sprite atlas. Raw art came from Codex CLI -> built-in image_gen; chroma-key removal is local post-processing.',
  });

  const assetRelativeFromGame = `../assets/${basename(spritePath)}`;
  const produceResult = await runCodexExec(producePrompt(idea, checkedGdd, assetRelativeFromGame, templateApiCheck), {
    cwd: repoRoot,
    sandbox: 'read-only',
    timeoutMs: 180_000,
  });
  if (produceResult.code !== 0) {
    throw new Error(`Codex game production failed with code ${produceResult.code}: ${produceResult.stderr}`);
  }
  const html = extractHtml(finalAgentMessage(produceResult));
  validateGameHtml(html, assetRelativeFromGame);

  const gamePath = join(gameDir, 'index.html');
  await writeFile(gamePath, html, 'utf8');

  const snapshotPath = join(proofDir, 'snapshot.png');
  await captureSnapshot(gamePath, snapshotPath);

  const meta: RunMeta = {
    runId,
    idea,
    createdAt,
    codex: {
      gddThreadId: gddResult.threadId,
      assetThreadId: assetResult.threadId,
      produceThreadId: produceResult.threadId,
      assetSource: generatedImage.path,
    },
    outputs: {
      gdd: toRepoRelative(gddPath),
      rawAsset: toRepoRelative(rawAssetPath),
      sprite: toRepoRelative(spritePath),
      atlas: toRepoRelative(atlasPath),
      game: toRepoRelative(gamePath),
      snapshot: toRepoRelative(snapshotPath),
      templateApiCheck: toRepoRelative(templateApiCheckPath),
    },
    templateApiCheck,
    proof: {
      usesCanvas: /<canvas[\s>]/i.test(html),
      usesGeneratedAsset: html.includes(assetRelativeFromGame),
      usesDrawImage: /drawImage\s*\(/.test(html),
      snapshotCaptured: true,
    },
  };
  await writeJson(join(runDir, 'meta.json'), meta);

  console.log(JSON.stringify(meta, null, 2));
}

function gddPrompt(gameIdea: string, templateApi: string, designRules: string): string {
  return [
    'Return a concise markdown GDD for a tiny browser Canvas game.',
    'Do not edit files and do not run shell commands.',
    'Use the provided DESIGN_RULES and TEMPLATE_API as hard constraints.',
    'Keep scope to one screen, one controllable actor, one win/score loop, and one generated sprite asset.',
    'If the user idea asks for unsupported TEMPLATE_API features, explicitly add an "Out-of-scope / Downscope" section and redesign the game into the supported Canvas slice.',
    'Do not silently accept unsupported features.',
    'TEMPLATE_API:',
    templateApi,
    'DESIGN_RULES:',
    designRules,
    `Idea: ${gameIdea}`,
  ].join('\n');
}

function assetPrompt(gameIdea: string): string {
  return [
    'Use only the built-in image_gen tool.',
    'Generate one original, clean-room 2D game sprite for this tiny Canvas game.',
    'Style: readable pixel-art-like icon, centered, generous padding, no text, no watermark.',
    'Background: perfectly flat solid #FF00FF chroma-key. Do not use #FF00FF in the subject.',
    'Do not write code, do not use Python/Pillow/Canvas/SVG, and do not call external APIs.',
    'After generation, briefly state whether image_gen was used. The orchestrator will recover the PNG from CODEX_HOME/generated_images by thread id.',
    `Game idea: ${gameIdea}`,
  ].join('\n');
}

function producePrompt(gameIdea: string, gdd: string, assetPath: string, templateApiCheck: TemplateApiCheck): string {
  return [
    'Return one complete standalone HTML document only. No markdown fences.',
    'The game must use a <canvas> element and JavaScript CanvasRenderingContext2D.',
    `It must load the generated sprite from "${assetPath}" with an Image object and draw it with ctx.drawImage(...).`,
    'Do not use DOM sprites for gameplay. Do not reference external CDNs or remote assets.',
    'Implement keyboard movement and a visible score or survival timer.',
    'Stay inside the P1 Template API. Do not add unsupported features.',
    `Template API status: ${templateApiCheck.status}`,
    `Flagged unsupported capabilities: ${templateApiCheck.flagged.map((flag) => flag.capability).join(', ') || 'none'}`,
    `Game idea: ${gameIdea}`,
    'GDD:',
    gdd.slice(0, 4000),
  ].join('\n');
}

function extractHtml(message: string): string {
  const fenced = message.match(/```(?:html)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const raw = fenced || message.trim();
  const doctypeIndex = raw.toLowerCase().indexOf('<!doctype');
  if (doctypeIndex >= 0) return raw.slice(doctypeIndex).trim();
  const htmlIndex = raw.toLowerCase().indexOf('<html');
  if (htmlIndex >= 0) return `<!doctype html>\n${raw.slice(htmlIndex).trim()}`;
  throw new Error('Codex game production did not return an HTML document');
}

function validateGameHtml(html: string, assetPath: string): void {
  const checks: Array<[boolean, string]> = [
    [/<canvas[\s>]/i.test(html), 'missing <canvas>'],
    [html.includes(assetPath), `missing generated asset path ${assetPath}`],
    [/drawImage\s*\(/.test(html), 'missing ctx.drawImage(...) usage'],
  ];
  const failures = checks.filter(([pass]) => !pass).map(([, label]) => label);
  if (failures.length > 0) {
    throw new Error(`Generated game failed validation: ${failures.join(', ')}`);
  }
}

async function removeChromaKey(input: string, output: string): Promise<void> {
  const helper = join(codexHome(), 'skills', '.system', 'imagegen', 'scripts', 'remove_chroma_key.py');
  await access(helper, constants.R_OK);
  await runCommand('python3', [
    helper,
    '--input',
    input,
    '--out',
    output,
    '--auto-key',
    'border',
    '--soft-matte',
    '--transparent-threshold',
    '12',
    '--opaque-threshold',
    '220',
    '--despill',
  ]);
}

async function captureSnapshot(gamePath: string, outputPath: string): Promise<void> {
  const browser = await findHeadlessBrowser();
  await runCommand(browser, [
    '--headless=new',
    '--disable-gpu',
    '--allow-file-access-from-files',
    `--screenshot=${outputPath}`,
    '--window-size=960,640',
    pathToFileURL(gamePath).href,
  ]);
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
  throw new Error('No supported headless browser found for snapshot capture');
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolveCommand, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolveCommand();
      } else {
        reject(new Error(`${command} exited with ${code}: ${stderr}`));
      }
    });
  });
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function makeRunId(createdAt: string, text: string): string {
  const stamp = createdAt.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 36) || 'game';
  return `${stamp}-${slug}`;
}

function toRepoRelative(path: string): string {
  return relative(repoRoot, resolve(path));
}

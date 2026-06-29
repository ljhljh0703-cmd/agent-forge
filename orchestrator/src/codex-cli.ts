import { spawn } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface CodexExecOptions {
  cwd: string;
  sandbox?: 'read-only' | 'workspace-write';
  timeoutMs?: number;
}

export interface GeneratedImage {
  path: string;
  mtimeMs: number;
  size: number;
}

export interface CodexExecResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  threadId: string | null;
  messages: string[];
  generatedImages: GeneratedImage[];
  stdout: string;
  stderr: string;
}

export function codexHome(): string {
  return process.env.CODEX_HOME || join(homedir(), '.codex');
}

export async function runCodexExec(prompt: string, options: CodexExecOptions): Promise<CodexExecResult> {
  const args = [
    '--ask-for-approval',
    'never',
    '--sandbox',
    options.sandbox ?? 'read-only',
    '-C',
    options.cwd,
    'exec',
    '--ephemeral',
    '--skip-git-repo-check',
    '--json',
    prompt,
  ];

  const { code, signal, stdout, stderr } = await spawnCollect('codex', args, {
    cwd: options.cwd,
    timeoutMs: options.timeoutMs ?? 180_000,
  });

  const { threadId, messages } = parseCodexJsonl(stdout);
  const generatedImages = threadId ? await listGeneratedImages(threadId) : [];

  return { code, signal, threadId, messages, generatedImages, stdout, stderr };
}

export function finalAgentMessage(result: CodexExecResult): string {
  return result.messages[result.messages.length - 1]?.trim() ?? '';
}

export async function listGeneratedImages(threadId: string): Promise<GeneratedImage[]> {
  const dir = join(codexHome(), 'generated_images', threadId);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const images: GeneratedImage[] = [];
  for (const entry of entries) {
    if (!entry.toLowerCase().endsWith('.png')) continue;
    const imagePath = join(dir, entry);
    const info = await stat(imagePath);
    images.push({ path: imagePath, mtimeMs: info.mtimeMs, size: info.size });
  }

  return images.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function parseCodexJsonl(stdout: string): { threadId: string | null; messages: string[] } {
  let threadId: string | null = null;
  const messages: string[] = [];

  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line) as {
        type?: string;
        thread_id?: string;
        item?: { type?: string; text?: string };
      };
      if (event.type === 'thread.started' && typeof event.thread_id === 'string') {
        threadId = event.thread_id;
      }
      if (event.type === 'item.completed' && event.item?.type === 'agent_message' && typeof event.item.text === 'string') {
        messages.push(event.item.text);
      }
    } catch {
      // Keep raw stdout in the result; malformed diagnostic lines are non-fatal.
    }
  }

  return { threadId, messages };
}

function spawnCollect(
  command: string,
  args: string[],
  options: { cwd: string; timeoutMs: number }
): Promise<{ code: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), options.timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr });
    });
  });
}

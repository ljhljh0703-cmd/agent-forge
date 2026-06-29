export const AGENTFORGE_MANIFEST_URL = '/assets/agentforge/manifest.json';

export type AgentForgeLayer = 'base' | 'actor' | 'object' | 'fx';

export interface AgentForgeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AgentForgeAnchor {
  x: number;
  y: number;
}

export interface AgentForgeFrame {
  id: string;
  rect: AgentForgeRect;
  anchor: AgentForgeAnchor;
  layer: AgentForgeLayer;
  sourceCell: [number, number];
  classification?: string;
  collision: Record<string, unknown>;
}

export interface AgentForgeAnimation {
  frames: string[];
  fps: number;
  loop: boolean;
}

export interface AgentForgeAtlas {
  id: string;
  image: string;
  metadata: string;
  frameSize: {
    width: number;
    height: number;
  };
  atlasGrid: {
    columns: number;
    rows: number;
  };
  frames: AgentForgeFrame[];
  animations: Record<string, AgentForgeAnimation>;
  source: {
    raw: string;
    keyed: string;
    rawOrigin: string;
  };
}

export interface AgentForgeManifest {
  schemaVersion: number;
  id: string;
  pipeline: string;
  approvalState: string;
  cleanRoom: {
    rawArt: string;
    thirdPartyIp: boolean;
    secretsRequired: boolean;
    licenseIntent: string;
  };
  methodology: {
    chromaKey: string;
    multiRowGrid: boolean;
    singleRowMultiCellSheets: boolean;
    bodyOnlySprites: boolean;
    fxSeparated: boolean;
    layerSeparation: boolean;
    propClassification: string[];
  };
  atlases: AgentForgeAtlas[];
  collision: string;
  sceneHooks: string;
  qaPreview: string;
}

export interface AgentForgeLoadedPack {
  manifest: AgentForgeManifest;
  images: Map<string, HTMLImageElement>;
  frames: Map<string, AgentForgeFrame & { atlasId: string }>;
}

export interface AgentForgeDrawOptions {
  scale?: number;
  flipX?: boolean;
  alpha?: number;
}

export async function loadAgentForgeManifest(url = AGENTFORGE_MANIFEST_URL): Promise<AgentForgeManifest> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`AgentForge manifest load failed: ${response.status}`);
  }
  const manifest = (await response.json()) as AgentForgeManifest;
  validateAgentForgeManifest(manifest);
  return manifest;
}

export async function loadAgentForgePack(url = AGENTFORGE_MANIFEST_URL): Promise<AgentForgeLoadedPack> {
  const manifest = await loadAgentForgeManifest(url);
  const images = new Map<string, HTMLImageElement>();
  const frames = new Map<string, AgentForgeFrame & { atlasId: string }>();

  await Promise.all(
    manifest.atlases.map(async (atlas) => {
      images.set(atlas.id, await loadImage(atlas.image));
      for (const frame of atlas.frames) {
        frames.set(frame.id, { ...frame, atlasId: atlas.id });
      }
    })
  );

  return { manifest, images, frames };
}

export function drawAgentForgeFrame(
  context: CanvasRenderingContext2D,
  pack: AgentForgeLoadedPack,
  frameId: string,
  x: number,
  y: number,
  options: AgentForgeDrawOptions = {}
): boolean {
  const frame = pack.frames.get(frameId);
  if (!frame) return false;

  const image = pack.images.get(frame.atlasId);
  if (!image) return false;

  const scale = options.scale ?? 1;
  const drawX = Math.round(x - frame.anchor.x * scale);
  const drawY = Math.round(y - frame.anchor.y * scale);
  const drawW = Math.round(frame.rect.w * scale);
  const drawH = Math.round(frame.rect.h * scale);
  const previousAlpha = context.globalAlpha;

  context.save();
  context.imageSmoothingEnabled = false;
  context.globalAlpha = options.alpha ?? previousAlpha;
  if (options.flipX) {
    context.translate(drawX + drawW, drawY);
    context.scale(-1, 1);
    context.drawImage(image, frame.rect.x, frame.rect.y, frame.rect.w, frame.rect.h, 0, 0, drawW, drawH);
  } else {
    context.drawImage(image, frame.rect.x, frame.rect.y, frame.rect.w, frame.rect.h, drawX, drawY, drawW, drawH);
  }
  context.restore();
  context.globalAlpha = previousAlpha;

  return true;
}

export function frameForAnimation(
  atlas: AgentForgeAtlas,
  animationId: string,
  elapsedMs: number
): string | null {
  const animation = atlas.animations[animationId];
  if (!animation || animation.frames.length === 0 || animation.fps <= 0) return null;

  const frameIndex = Math.floor((elapsedMs / 1000) * animation.fps);
  if (animation.loop) {
    return animation.frames[frameIndex % animation.frames.length];
  }
  return animation.frames[Math.min(frameIndex, animation.frames.length - 1)];
}

function validateAgentForgeManifest(manifest: AgentForgeManifest): void {
  if (manifest.schemaVersion !== 1) {
    throw new Error(`Unsupported AgentForge manifest schema: ${manifest.schemaVersion}`);
  }
  if (!manifest.methodology.layerSeparation || !manifest.methodology.fxSeparated) {
    throw new Error('AgentForge manifest violates layer separation requirements');
  }
  if (manifest.methodology.singleRowMultiCellSheets) {
    throw new Error('AgentForge manifest reports forbidden 1xN multi-cell sheets');
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`AgentForge atlas image load failed: ${src}`));
    image.src = src;
  });
}

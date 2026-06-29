export interface TemplateApiCheck {
  status: 'in_scope' | 'downscoped';
  inScope: string[];
  flagged: TemplateApiFlag[];
}

export interface TemplateApiFlag {
  capability: string;
  severity: 'unsupported';
  matched: string[];
  suggestedDownscope: string;
}

interface CapabilityPattern {
  capability: string;
  patterns: RegExp[];
  suggestedDownscope: string;
}

const supportedCapabilities = [
  'single_screen_canvas',
  'standalone_html',
  'single_generated_sprite',
  'sprite_draw_image',
  'keyboard_input',
  'pointer_restart',
  'top_down_2d_movement',
  'simple_dash_or_burst',
  'simple_entities',
  'simple_collision',
  'score_timer_win_fail',
  'basic_canvas_ui',
  'basic_particle_or_motion_feedback',
  'headless_snapshot',
];

const unsupportedPatterns: CapabilityPattern[] = [
  {
    capability: 'three_d',
    patterns: [/\b3d\b/i, /\bthree\.?js\b/i, /\bwebgl\b/i, /\bvoxel\b/i, /\bfirst-person\b/i],
    suggestedDownscope: 'Use a top-down 2D Canvas view with simple shape/sprite depth cues.',
  },
  {
    capability: 'network_multiplayer',
    patterns: [/\bmultiplayer\b/i, /\bmmo\b/i, /\bonline\b/i, /\bmatchmaking\b/i, /\bsocket\b/i, /\bco-?op\b/i],
    suggestedDownscope: 'Use a single-player loop with local score/timer pressure.',
  },
  {
    capability: 'server_persistence',
    patterns: [/\bserver\b/i, /\bdatabase\b/i, /\baccount\b/i, /\bcloud save\b/i, /\bpersistent\b/i],
    suggestedDownscope: 'Keep state in memory for one local browser session.',
  },
  {
    capability: 'large_world_streaming',
    patterns: [/\bopen world\b/i, /\binfinite\b/i, /\bstreaming\b/i, /\bprocedural world\b/i, /\bmassive world\b/i],
    suggestedDownscope: 'Use one fixed arena with bounded entity spawning.',
  },
  {
    capability: 'complex_physics',
    patterns: [/\brigid body\b/i, /\bragdoll\b/i, /\bjoints?\b/i, /\bphysics engine\b/i, /\bplatformer physics\b/i],
    suggestedDownscope: 'Use velocity, bounds checks, and simple overlap collision.',
  },
  {
    capability: 'multi_frame_animation',
    patterns: [/\bsprite sheet\b/i, /\bmulti-?frame\b/i, /\banimated sprite\b/i, /\bframe animation\b/i],
    suggestedDownscope: 'Use one generated sprite with Canvas transforms, scale, alpha, and motion feedback.',
  },
  {
    capability: 'tilemap_pipeline',
    patterns: [/\btilemap\b/i, /\btiled\b/i, /\bldtk\b/i, /\btile collision\b/i],
    suggestedDownscope: 'Use a drawn grid or simple obstacle rectangles directly in Canvas.',
  },
  {
    capability: 'shader_pipeline',
    patterns: [/\bshader\b/i, /\bpost-?processing\b/i, /\blighting pipeline\b/i],
    suggestedDownscope: 'Use Canvas fills, gradients, alpha, and simple flashes.',
  },
  {
    capability: 'audio_pipeline',
    patterns: [/\baudio\b/i, /\bmusic\b/i, /\bsoundtrack\b/i, /\bsfx\b/i],
    suggestedDownscope: 'Use visual feedback only until an audio pipeline is proven.',
  },
  {
    capability: 'inventory_dialogue_quest',
    patterns: [/\binventory\b/i, /\bdialogue\b/i, /\bquest\b/i, /\bbranching story\b/i],
    suggestedDownscope: 'Use one arcade objective and a score/timer end condition.',
  },
  {
    capability: 'ai_agents',
    patterns: [/\bllm npc\b/i, /\bbehavior tree\b/i, /\bgoap\b/i, /\bautonomous npc\b/i],
    suggestedDownscope: 'Use simple deterministic enemy or hazard motion.',
  },
  {
    capability: 'mobile_packaging',
    patterns: [/\bios\b/i, /\bandroid\b/i, /\bapp store\b/i, /\bnative mobile\b/i],
    suggestedDownscope: 'Keep output as a browser-playable local HTML file.',
  },
];

export function checkTemplateApi(idea: string, gdd: string): TemplateApiCheck {
  const text = `${idea}\n${stripNonRequirementSections(gdd)}`;
  const flagged = unsupportedPatterns.flatMap((entry) => {
    const matched = entry.patterns
      .map((pattern) => text.match(pattern)?.[0])
      .filter((match): match is string => Boolean(match));

    if (matched.length === 0) return [];

    return [
      {
        capability: entry.capability,
        severity: 'unsupported' as const,
        matched: Array.from(new Set(matched.map((match) => match.toLowerCase()))),
        suggestedDownscope: entry.suggestedDownscope,
      },
    ];
  });

  return {
    status: flagged.length > 0 ? 'downscoped' : 'in_scope',
    inScope: supportedCapabilities,
    flagged,
  };
}

function stripNonRequirementSections(markdown: string): string {
  const stopSection = /^##\s+(out[- ]of[- ]scope|downscope|unsupported|anti[- ]rules|deterministic template api check)/i;
  const keepLines: string[] = [];
  let skipping = false;

  for (const line of markdown.split(/\r?\n/)) {
    if (/^##\s+/.test(line)) {
      skipping = stopSection.test(line);
    }
    if (!skipping) {
      keepLines.push(line);
    }
  }

  return keepLines
    .filter((line) => !/^\s*-\s*no\s+/i.test(line))
    .filter((line) => !/\b(no|without|avoid|avoids|not|unsupported|out of scope)\b/i.test(line))
    .join('\n');
}

export function formatTemplateApiCheck(check: TemplateApiCheck): string {
  if (check.flagged.length === 0) {
    return 'Template API Check: all requested features fit the proven P1 Canvas template API.';
  }

  const lines = ['Template API Check: unsupported requests were detected and must be downscoped.'];
  for (const flag of check.flagged) {
    lines.push(`- ${flag.capability}: matched ${flag.matched.join(', ')} -> ${flag.suggestedDownscope}`);
  }
  return lines.join('\n');
}

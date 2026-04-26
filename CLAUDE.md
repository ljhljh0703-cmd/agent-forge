# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite dev server (port 5173, auto-opens browser)
npm run build        # tsc + vite build → dist/
npm run type-check   # tsc --noEmit (TypeScript validation only)
npm run preview      # Preview production build locally
```

No test framework is configured. Verify changes via `npm run type-check` and manual browser testing.

## Project Overview

**Agent Forge OS** — A multi-window React application with a retro OS aesthetic that orchestrates a 5-agent AI pipeline (Gemini 2.0 Flash) across three domain modes:

- **Game** (`game`): User idea → GDD → SPEC → Execution Plan → Game Code (single HTML) → QA
- **Software** (`software`): Requirements → PRD → Architecture → Task Plan → Boilerplate Code → Review
- **Docs** (`docs`): Code Input → Document Scope → Code Analysis → Writing Plan → Markdown Docs → Verification

All logic runs client-side. Gemini API calls are proxied through Vite dev server (`/api/google` → `generativelanguage.googleapis.com`).

## Architecture

### Agent Pipeline (5 stages)

Each domain mode has its own set of agent roles (suffixed `_sw` or `_docs`) defined in `src/services/agent-service.ts`:

1. **Planner** (Alex) → Generates GDD/PRD/TOC (markdown)
2. **Architect** (Sam) → Generates SPEC/Architecture/Code Analysis (markdown + mermaid)
3. **Compiler** (Jordan) → Breaks spec into ExecutionPlan JSON (tasks array)
4. **Worker** (Casey) → Generates code/docs via streaming (`executeStream()`)
5. **Auditor** (Morgan) → Validates output, returns AuditResult JSON (Debt Score 0-10)

Auditor can loop back to Worker (fix-worker) or Compiler (fix-compiler), max 3 loops.

### State Management

`src/context/WindowContext.tsx` is the central state hub — it holds:
- `windows[]` — visibility, zIndex, minimize state for all 11 windows
- `agents[]` — status, metrics per agent
- `pipeline` — GDD, SPEC, execution plan, generated code, audit result
- `domainMode` — current mode ('game' | 'software' | 'docs')
- `runCompiler()`, `runWorker()`, `runAuditor()` — pipeline execution functions with domain branching

### DraggableWindow Pattern

`src/components/DraggableWindow.tsx` manages window drag position in **local useState** (not Context) to avoid re-rendering the entire tree on every mousemove. Context only tracks zIndex, visibility, and minimize state.

### Domain Mode System

`src/config/domain-mode.ts` defines `DomainConfig` per mode with: role mappings, employee title overrides, canvas type, and input templates. Switching domains resets the entire pipeline.

### Key Services

| File | Purpose |
|------|---------|
| `src/services/agent-service.ts` | Singleton mapping 20+ role IDs to systemPrompt/model/temperature |
| `src/services/ai-client.ts` | Gemini API wrapper (complete + stream) |
| `src/services/metrics-collector.ts` | Event-based pub/sub for API call metrics |
| `src/services/cost-calculator.ts` | Token → USD cost conversion |

### LiveCanvasWindow Rendering

`src/components/windows/LiveCanvasWindow.tsx` switches renderer by domain:
- Game → `GameCanvas` (sandboxed iframe with Blob URL)
- Software → `SWCanvas` (Mermaid diagrams + file tree + code preview)
- Docs → `DocsCanvas` (marked + highlight.js + Mermaid, with TOC navigation)

## Conventions

- **TypeScript strict mode** — all code is fully typed
- **Path alias**: `@/*` → `src/*` (configured in tsconfig.json and vite.config.ts)
- **Naming**: camelCase functions, PascalCase components/classes, UPPER_SNAKE_CASE constants
- **Comments**: Korean preferred for inline comments
- **Exports**: export at declaration site, not at file bottom
- **Tailwind custom tokens**: `win-gray`, `win-blue`, `win-white`, `win-dark`, `win-light` colors; `outset`/`inset` box shadows for Win95 aesthetic
- **AI roles follow suffix pattern**: base (`planner`), SW mode (`planner_sw`), Docs mode (`planner_docs`). `baseAgentId()` strips suffixes for metrics grouping.

## Environment

Requires `VITE_AI_API_KEY` (Google AI API key) in `.env`. See `.env.example`.

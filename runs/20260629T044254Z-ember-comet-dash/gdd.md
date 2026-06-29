# Ember Comet Dash — Tiny Canvas GDD

## Scope

- One standalone `index.html`
- One fixed HTML5 Canvas screen
- One controllable actor
- One generated PNG sprite asset
- Keyboard movement + dash
- Click/pointer restart only
- No audio, 3D, tilemaps, multiplayer, backend, inventory, dialogue, or AI

## Core Verb

Dash.

## Core Loop

Move the ember comet, dash through glowing ember cores, collect `2` cores before the timer reaches zero, then restart or replay.

Loop duration: `10 seconds`.

## Player Actor

**Ember Comet**

- Top-down 2D actor
- Moves with `WASD` / arrow keys
- Short dash burst on `Space`
- Bounded inside the canvas
- Drawn using the single generated sprite PNG via `ctx.drawImage(...)`

## Generated Sprite Asset

One PNG:

`ember_comet_player.png`

Prompt direction:

> Small top-down ember comet character, glowing orange core, short flame tail, readable silhouette, transparent background, game sprite, centered, no animation frames.

## Screen Layout

- Canvas: fixed single playfield
- Top-left: score `0 / 2`
- Top-right: timer `10.0`
- Bottom: dash cooldown bar
- Center overlay on win/fail with click-to-restart

## Entities

- `2` ember cores spawn on screen at fixed readable positions
- Each core is a simple Canvas circle/glow, not a sprite
- Optional ash drift particles are Canvas-only visual feedback

## Mechanics

- Player moves freely in 2D
- Dash gives a short speed burst with cooldown
- Collision uses simple circle overlap
- Collecting a core increases score by `1`
- Dash creates a brief trail/flash
- Timer counts down from `10`

## Win / Fail

- **Win:** collect `2` ember cores before timer ends
- **Fail:** timer reaches `0`
- **Restart:** click or tap after win/fail

## Difficulty Curve

Very gentle:

- First core is close to spawn
- Second core is farther away
- Dash makes the target comfortably reachable
- No hazards in P1 scope

## P3 Reachability Proof

- Score target: `2`
- Fail timer: `10 seconds`
- With no input: player collects nothing, timer reaches zero, fail state occurs within the required `8-12` second window.
- With basic input: player can move/dash to two fixed cores and win before timeout.

## Out-of-scope / Downscope

No unsupported features are included. “Comet” is represented as a top-down Canvas sprite and motion trail, not 3D space flight, physics simulation, shaders, or particle systems beyond simple Canvas feedback.

---

## Deterministic Template API Check

Template API Check: all requested features fit the proven P1 Canvas template API.

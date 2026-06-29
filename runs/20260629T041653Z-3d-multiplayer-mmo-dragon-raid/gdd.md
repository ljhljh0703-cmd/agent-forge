# GDD: Dragon Raid Dash

## Out-of-scope / Downscope

Original idea: **3D multiplayer MMO dragon raid**.

Unsupported by `TEMPLATE_API`:
- 3D rendering
- multiplayer / MMO networking
- raid parties
- server persistence
- complex AI boss behavior
- audio, inventory, quests, large worlds

Downscoped version: **a one-screen solo Canvas raid minigame** where one player dodges dragon breath zones, dashes to collect raid sigils, and wins by filling the raid score before time runs out.

## Core

- **Verb:** dash / collect / dodge
- **Screen:** single fixed top-down Canvas arena
- **Actor:** one controllable raider
- **Sprite asset:** one generated PNG for the player raider
- **Loop:** dodge hazards, dash through safe gaps, collect sigils, repeat every 5-15 seconds

## Gameplay

Player moves with **WASD / arrow keys** inside a rectangular arena.

Dragon pressure is represented by Canvas-only hazards:
- red breath circles
- warning flashes before danger
- drifting ember particles

Sigils spawn around the arena. Collecting sigils increases the raid score.

Dash gives a short burst with cooldown:
- useful for reaching sigils
- risky if dashed into breath zones
- cooldown bar shown in UI

## Win / Fail

- **Win:** collect `10` raid sigils before the timer ends
- **Fail:** timer reaches `0` or player takes `3` hits
- **Restart:** click / pointer input on end overlay

## Feedback

- score text increments on pickup
- raider flashes on hit
- dash leaves a short trail
- cooldown bar fills after dash
- breath zones pulse before becoming dangerous
- win/fail overlay appears clearly

## Difficulty Curve

Over a 60-second round:
- breath zones spawn slightly faster
- sigils appear farther from the player
- final 15 seconds increases hazard drift speed

## Sprite Prompt

Generate one PNG sprite:

> Top-down tiny fantasy raid knight, readable silhouette, shield and glowing spear, colorful browser-game style, transparent background, single character, no animation frames.

## Implementation Constraints

- one standalone `index.html`
- no CDN
- no remote assets
- one generated PNG copied to `runs/<id>/assets/`
- sprite loaded with `new Image()`
- rendered with `ctx.drawImage(...)`
- simple JS objects/arrays for sigils and hazards
- circle overlap collision
- Canvas text/bars/overlays only
- headless Chrome screenshot can verify the local file view

---

## Deterministic Template API Check

Template API Check: unsupported requests were detected and must be downscoped.
- three_d: matched 3d -> Use a top-down 2D Canvas view with simple shape/sprite depth cues.
- network_multiplayer: matched multiplayer, mmo -> Use a single-player loop with local score/timer pressure.

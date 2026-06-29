# Crystal Fox Dash GDD

## Scope
- One-screen standalone HTML5 Canvas game.
- One controllable actor: **Crystal Fox**.
- One generated sprite asset: `crystal_fox.png`, drawn with `ctx.drawImage(...)`.
- Input: WASD / arrow keys movement, Space or Shift dash, click/tap restart.
- No audio, 3D, tilemaps, multiplayer, dialogue, inventory, or AI systems.

## Core Verb
**Dash** to collect crystals before the storm timer expires.

## Core Loop
1. Move the Crystal Fox around a fixed top-down arena.
2. Dash through glowing crystals to collect them.
3. Each crystal collected increases score and spawns a new crystal.
4. Reach **2 crystals** before the timer ends to win.
5. If the timer reaches zero first, fail and restart.

## Win / Fail
- Win target: **2 crystals collected**.
- Fail timer: **10 seconds**.
- No-input proof: if the player does nothing, the timer reaches zero in 10 seconds and the fail state appears.

## Player Actor
- Crystal Fox starts near the center-left of the canvas.
- Moves in 2D within screen bounds.
- Dash gives a short speed burst with cooldown.
- Dash feedback: cyan trail, brief sprite glow, cooldown bar.

## Entities
- `player`: position, velocity, radius, dash cooldown.
- `crystal`: one pickup at a time, radius collision.
- Optional Canvas-only particles: small shards emitted on collect.

## Scoring
- Collecting a crystal: `score += 1`.
- Score text: `Crystals: 0 / 2`.
- On score `2`, show win overlay.

## Screen Layout
- Fixed Canvas playfield, no scrolling.
- Top-left: score.
- Top-right: timer.
- Bottom-center: dash cooldown bar.
- Center overlay: win/fail message and click-to-restart prompt.

## Generated Sprite Asset
Prompt: “small top-down crystal fox game sprite, bright icy blue fur, faceted crystal tail, readable silhouette, transparent background, 2D pixel-inspired fantasy style.”

## P3 Reachability Proof
- Target score: **2**.
- Fail timer: **10 seconds**.
- With no input: score remains `0`, timer reaches `0`, fail overlay appears within the required 8-12 second window.
- With basic input: two nearby crystal pickups are reachable through movement plus dash before timeout.

---

## Deterministic Template API Check

Template API Check: all requested features fit the proven P1 Canvas template API.

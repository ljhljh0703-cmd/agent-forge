# Moon Fern Dash

Reused Scaffold Candidate: template-top-down-2d-dash-collectible-score-fail-timer-dash-input

## Concept
A tiny one-screen top-down Canvas game where the player controls a glowing moon fern, dashing through drifting moondew motes before moonlight fades.

## Core Verb
Dash / collect.

## Template Fit
- `single_screen_canvas`
- `standalone_html`
- `single_generated_sprite`
- `keyboard_input`
- `simple_dash_or_burst`
- `simple_collision`
- `score_timer_win_fail`
- `basic_canvas_ui`

## Actor & Asset
- One controllable actor: Moon Fern.
- One generated sprite asset: `moon_fern.png`.
- Drawn with `new Image()` and `ctx.drawImage(...)`.

## Controls
- Arrow keys / WASD: move.
- Space / Shift: short dash burst with cooldown.
- Click / pointer: restart after win or fail.

## Core Loop
Move around the fixed Canvas, dash into moondew pickups, score, and repeat until reaching the win target or the timer expires.

## Rules
- Win target: `3` moondew pickups.
- Fail timer: `10` seconds.
- No input reachability: if the player does nothing, timer reaches fail state within 10 seconds.
- Pickups are simple glowing circles.
- Collision uses circle overlap.
- Player stays inside screen bounds.

## Feedback
- Score increments immediately on pickup.
- Dash creates a short trail / flash.
- Dash cooldown shown as a small bar.
- Timer and score are always visible.
- Win/fail overlay appears with restart prompt.

## P3 Reachability Proof
- Score target is within required range: `3`.
- Fail timer is within required range: `10s`.
- With no input, fail state is reachable automatically when timer reaches zero.
- With input, three pickups can be reached by moving/dashing within one screen.

## Out-of-scope / Downscope
None required. The idea fits the supported Canvas slice without 3D, audio, tilemaps, AI agents, networking, or multi-frame animation.

No files edited. No shell commands run.

---

## Deterministic Template API Check

Template API Check: all requested features fit the proven P1 Canvas template API.

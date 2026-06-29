# Beacon Moth Dash

## Concept
A tiny top-down Canvas game where the player controls one glowing moth, dashing between beacons to collect light before the night fades.

## Core Verb
Dash.

## Core Loop
Every 5-15 seconds:
1. Move toward the active beacon.
2. Dash through light motes to collect points.
3. Avoid shadow wisps.
4. Repeat until the score target is reached or time expires.

## Screen
- One fixed HTML5 Canvas playfield.
- No scrolling, no camera, no level transitions.
- Dark garden background drawn with Canvas shapes.

## Player
- Actor: one beacon moth.
- Asset: one generated moth PNG.
- Movement: WASD / arrow keys.
- Dash: Space key or Shift.
- Dash has a short burst and visible cooldown bar.

## Entities
- Light motes: circular pickups worth points.
- Shadow wisps: simple drifting hazards that reduce score or briefly slow the moth.
- Beacon: glowing Canvas circle that marks the current collection zone.

## Score / Win / Fail
- Timer: 45 seconds.
- Win: reach 30 light before time runs out.
- Fail: timer reaches zero before target score.
- Click / pointer restarts after win or fail.

## Feedback
- Dash leaves a short glowing trail.
- Collecting a mote flashes the beacon and increments score.
- Hitting a shadow briefly darkens the screen edge.
- UI shows score, timer, dash cooldown, and win/fail overlay.

## Difficulty Curve
- First 15 seconds: slow shadows, generous motes.
- Middle: shadows drift faster.
- Final 10 seconds: mote spawn spacing increases and timer pressure becomes clear.

## Implementation Constraints
- One standalone `index.html`.
- One generated sprite PNG loaded with `new Image()` and drawn via `ctx.drawImage(...)`.
- All other visuals are Canvas shapes.
- No audio, 3D, tilemaps, networking, backend saves, complex physics, AI, or sprite sheets.

---

## Deterministic Template API Check

Template API Check: all requested features fit the proven P1 Canvas template API.

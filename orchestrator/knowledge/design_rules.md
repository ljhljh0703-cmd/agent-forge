# AgentForge P1 Design Rules

Keep GDDs small enough for the proven P1 Canvas engine.

## Rules

- Start from one verb: move, dodge, collect, dash, aim, or survive.
- Define one core loop that can repeat every 5-15 seconds.
- Use one controllable actor and one generated sprite asset.
- Add immediate feedback for each player action: score change, motion, flash, bar, timer, or overlay.
- Include one clear win/fail condition.
- Use a gentle difficulty curve: speed, spawn rate, timer pressure, or target score.
- Prefer readable top-down 2D mechanics over large simulation.
- Keep implementation to one standalone Canvas HTML file.

## Anti-rules

- Do not design features that need 3D, networking, backend state, multiple sprite sheets, tilemap import, audio generation, or complex AI.
- Do not hide unsupported requirements. Downscope them visibly.
- Do not add more systems than the score/timer/one-loop game needs.

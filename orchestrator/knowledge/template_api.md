# AgentForge P1 Template API

This file describes only capabilities proven by the P1 run:
`runs/20260629T033855Z-magnet-coin-dash/`.

It is a constraint document for the GDD phase. Do not promise features outside
this surface unless a later phase proves them.

## Supported

- `single_screen_canvas`: one fixed HTML5 Canvas playfield with no scrolling.
- `standalone_html`: one standalone `index.html`, no external CDN or remote asset.
- `single_generated_sprite`: one Codex image_gen PNG copied into `runs/<id>/assets/`.
- `sprite_draw_image`: generated sprite loaded through `new Image()` and drawn with `ctx.drawImage(...)`.
- `keyboard_input`: keyboard movement with arrow keys / WASD.
- `pointer_restart`: pointer or click input for simple restart/confirmation.
- `top_down_2d_movement`: 2D x/y movement inside screen bounds.
- `simple_dash_or_burst`: one short movement burst/cooldown mechanic.
- `simple_entities`: lightweight JS objects or arrays for pickups/hazards.
- `simple_collision`: circle/radius or rectangle overlap checks.
- `score_timer_win_fail`: visible score, timer, win/fail or restart state.
- `basic_canvas_ui`: text, bars, simple shapes, overlay messages.
- `basic_particle_or_motion_feedback`: simple Canvas-only feedback such as trails, flashes, drift, attraction, bounce.
- `headless_snapshot`: Chrome headless screenshot proof from local file URL.

## Unsupported Until Proven

- `three_d`: 3D rendering, perspective camera, WebGL/Three.js scenes.
- `network_multiplayer`: online multiplayer, matchmaking, sockets, shared server state.
- `server_persistence`: backend services, database saves, accounts, cloud sync.
- `large_world_streaming`: multi-map overworlds, streaming levels, procedural infinite worlds.
- `complex_physics`: rigid-body engines, joints, ragdolls, advanced platformer physics.
- `multi_frame_animation`: generated multi-frame sprite sheets or deterministic animation slicing.
- `tilemap_pipeline`: full tilemap generation, tile collision import, LDtk/Tiled export.
- `shader_pipeline`: custom shaders, post-processing, lighting pipeline, complex particles.
- `audio_pipeline`: generated audio, music, spatial audio, mixer logic.
- `inventory_dialogue_quest`: inventory systems, branching dialogue, quest graphs.
- `ai_agents`: autonomous NPC planning, LLM NPCs, GOAP/behavior trees.
- `mobile_packaging`: native iOS/Android packaging.

## Design Contract

If an idea asks for unsupported features, the GDD must explicitly downscope it
to the supported Canvas slice or mark it out of scope. Silent acceptance is a
failure.

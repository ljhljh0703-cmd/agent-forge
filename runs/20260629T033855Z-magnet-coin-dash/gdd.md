# Magnet Coin Dash - Tiny Canvas GDD

## Concept
A one-screen browser Canvas arcade game where the player controls a tiny magnet that dashes around a compact arena, pulling nearby coins into itself for points.

## Scope
- One screen: fixed arena, no scrolling
- One controllable actor: the magnet
- One score loop: collect coins to reach the target score
- One generated sprite asset: player magnet sprite

## Core Loop
1. Coins spawn around the arena.
2. Player moves and dashes toward coin clusters.
3. Nearby coins are attracted into the magnet.
4. Each collected coin increases score.
5. Reach the target score before time runs out to win.

## Controls
- `WASD` / Arrow keys: move
- `Space`: short dash toward movement direction

## Player Actor
**Magnet**
- Moves freely inside screen bounds
- Has a small attraction radius
- Dash temporarily increases speed and attraction strength
- Cannot leave the arena

## Game Objects
**Coins**
- Spawn randomly after collection
- Drift slightly when inside attraction radius
- Collected on contact with magnet

## Win / Lose
- Score target: `30 coins`
- Time limit: `60 seconds`
- Win: collect 30 coins before timer ends
- Lose: timer reaches zero first

## UI
- Top-left: score
- Top-right: timer
- Center overlay on end: `You Win` or `Time Up`
- Restart button or `R` key

## Visual Style
Bright, readable, arcade-like. Dark neutral background, gold coins, red-blue magnet.

## Generated Sprite Asset
**Asset:** `magnet_player.png`  
**Size:** `64x64`  
**Description:** cute horseshoe magnet with tiny boots, red and blue tips, transparent background, simple readable pixel-art style.

## Implementation Notes
Use HTML5 Canvas with a single update/render loop. Keep all entities lightweight circles except the player sprite. Coin attraction can be simple vector movement toward the magnet when within radius.

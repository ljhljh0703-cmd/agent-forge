# 🎨 PROMPT: Agent Forge UI/UX Overhaul (Isometric Pixel Art)

## 1. Goal
Refactor the current Agent Forge UI from a generic 90s Retro style (Win95/98) to a high-fidelity **2.5D Isometric Pixel Art** experience. The new design should feel warm, professional, yet cozy (like a "Indie Game Dev Studio").

## 2. Core Visual Requirements
### 🏠 Perspective & Palette
- **Isometric 2.5D:** Use a consistent 30-degree isometric projection for the room and all furniture.
- **Warm Palette:** 
  - Primary colors: **Warm Wood (#8B4513, #6B4423, #5D3A1A)**.
  - Accent: **Rustic Brick (#B22222, #8B0000)** for walls.
  - Floors: **Polished Wood Planks** (long rectangles with subtle pixel grain).
- **Ambient Lighting:** Add "Soft Glow" or "Sunlight" effects coming from isometric windows. Implement "God Rays" (alpha-blended light shafts) hitting the floor.

### 🖼️ Asset Style
- **Pixel Art:** All characters, furniture, and UI borders should follow a consistent pixel-art aesthetic (16-bit or 32-bit style).
- **Characters:** NO emojis as characters. Use **seated pixel art sprites** for agents.
  - Agents should have 2-4 frame "idle" animations (breathing/blinking).
  - Agents should have "task-specific" animations (typing on keyboard, scratching head for 'thinking').
- **Furniture (Isometric):**
  - **Desks:** Heavy oak desks with visible grain.
  - **Chairs:** Ergonomic mesh or classic leather chairs (pixel art).
  - **Props:** Potted plants (Monstera/Fern), coffee mugs, and stacked papers.

## 3. Component-Level Specifications
### 🛋️ OfficeSetting.tsx (The Room)
- **Geometry:** 2.5D Corner view (Two walls meeting at center).
- **Wall Textures:** Brick patterns or warm-toned wallpaper.
- **Floor:** Isometric tiling with wood grain variation.
- **Atmosphere:** Use CSS/SVG filters for a slight warm bloom or vignette.

### 👨‍💻 EmployeeCard.tsx (The Agents)
- **Positioning:** Agents are **seated behind desks**. Desks are fixed in 2.5D space.
- **Interaction (Speech Bubbles):**
  - High-visibility: **Cream Background (#F5E6D3)** with **Thick Brown Border (#4A2E1A)**.
  - Content: **Emoji + Action Text** (e.g., "🏗️ Architecting the SPEC...").
  - Tip: The bubble should "pop" up and down slightly (floating animation).

### 🪟 Window UI (DraggableWindow.tsx & Taskbar.tsx)
- **Visibility & Accessibility:**
  - **Higher Contrast:** Darker title bars with light text.
  - **Borders:** Use 3D blocky pixel borders (beveled effect).
  - **Backgrounds:** Use semi-opaque glassmorphism (e.g., `bg-white/80` or `bg-slate-900/80` with `backdrop-blur`) to keep the "Room" visible while maintaining readability of text inside.
  - **Shadows:** Use large, soft isometric shadows (`drop-shadow-2xl`) to separate windows from the background.

## 4. Technical Implementation Details
- **Tech stack:** React + Tailwind CSS + Lucide (for retro icons).
- **Scaling:** The room should be responsive but maintain its isometric aspect ratio.
- **Z-Index Layering:** Strictly manage depths (Floor -> Furniture -> Agents -> Speech Bubbles -> Windows).
- **Performance:** Use `memo` for static furniture pieces to avoid redundant SVG/div re-renders.

## 5. Verification Checklist for Claude
- [ ] Is the room 2.5D Isometric?
- [ ] Are the agents sitting at their desks?
- [ ] Is the palette warm (Wood, Brick)?
- [ ] Are speech bubbles highly visible (Cream/Brown contrast)?
- [ ] Do windows have clear, high-contrast title bars?

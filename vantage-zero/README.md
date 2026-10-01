# VANTAGE ZERO — Tactical Arena FPS

A fast, **browser-based 3D first-person shooter** inspired by the *feel* of fast tactical
shooters — precise gunplay, recoil control, ADS, crouch/sprint movement, a small arena map
with lanes and cover, and wave-based enemy bots with believable AI.

> **100% original**: every asset is procedural (geometry, textures, sounds, names).
> Nothing is copied from Call of Duty, Counter-Strike, or any other game.

![Tech](https://img.shields.io/badge/engine-Three.js%20%2F%20WebGL-blue) ![Audio](https://img.shields.io/badge/audio-Web%20Audio%20API%20(procedural)-green) ![Assets](https://img.shields.io/badge/assets-0%20external%20files-orange)

---

## Running the game

**Option A — double-click** `index.html` (works online; the engine loads from a public CDN
if the local `libs/` folder isn't found).

**Option B — local server (recommended, works offline):**

```bash
cd vantage-zero
python3 -m http.server 8080
# open http://localhost:8080
```

Any static file server works (`npx serve`, `php -S`, etc.). No build step, no dependencies
to install, nothing to compile.

**Requirements:** a modern desktop browser with WebGL (Chrome / Edge / Firefox / Safari),
mouse + keyboard. Click **DEPLOY** on the main menu — the click also unlocks audio.

> If the game runs inside an iframe that blocks pointer lock, it automatically switches to
> a fallback mouse-look mode and shows a hint. Use the **“Open in new tab ↗”** button for
> the best experience.

## Files

| File | Required | Purpose |
|---|---|---|
| `index.html` | ✅ | **The entire game** — HTML, CSS, and all game code in one commented, sectioned file (~3,250 lines). |
| `libs/three.module.min.js` | optional | Vendored Three.js r170 — used first so the game works offline. If missing, the game falls back to a public CDN. |
| `README.md` | — | This file. |

## Controls

| Input | Action |
|---|---|
| `W A S D` / Arrow keys | Move |
| Mouse | Look (pointer lock) |
| Left mouse | Fire |
| Right mouse (hold) | Aim down sights |
| `R` | Reload |
| `Shift` | Sprint |
| `Space` | Jump |
| `C` / `Ctrl` | Crouch (C recommended) |
| `1` / `2` / `Q` / Mouse wheel | Switch weapon |
| `Tab` (hold) | Match info |
| `Esc` | Pause |

## Gameplay summary

- **Map “Depot K-9”** — a compact arena with a central bunker ring (4 doorways), two
  flanking lanes, mid-field cross walls, crates, jersey barriers, barrels, pillars.
  Everything is axis-aligned box geometry → cheap AABB physics and predictable cover.
- **6 escalating waves** — enemy count, HP, damage, accuracy, reaction time and aggression
  all scale per wave. Short resupply breaks between waves (+HP, +armor, +ammo).
- **2 weapons** — the **VK-7 Kestrel** rifle (auto, 26 dmg, controllable recoil) and the
  **P9 Wasp** pistol (semi-auto, 20 dmg, laser-accurate, 2.6× headshots). Each has its own
  damage model, spread/bloom, recoil pattern, reload timing, muzzle flash, tracer, and
  procedurally synthesized firing sound.
- **Score** — 100/kill, +50 headshot bonus, 250/wave clear, +150 flawless wave bonus.
  HUD tracks health, armor, ammo, reserve, wave, timer, score, kill feed, accuracy.
- **Enemy AI** — patrol → hear/see (FOV + line-of-sight raycasts) → alert/search →
  combat (strafe, range-keeping, reaction delay, burst fire with imperfect accuracy) →
  cover (breaks line of sight to reload or when badly hurt).

## Architecture (sections inside `index.html`)

The single module script is organized into numbered, searchable banners:

```
[1]  Engine loader          [10] Player (movement, health, camera, gunplay)
[2]  Config & data          [11] Enemy bots & AI
[3]  Utilities              [12] Wave manager
[4]  Settings               [13] HUD / UI / minimap / compass
[5]  Input                  [14] Game orchestrator
[6]  Audio engine           [15] Main loop (requestAnimationFrame + delta time)
[7]  Renderer & lights      [16] Boot
[8]  Procedural textures
[9]  Map, props & collision
```

Key systems:

- **Physics** — swept axis-separated AABB collision shared by the player and all bots.
  Delta-time based; frame time is clamped so tab-switches can't explode the simulation.
- **AI** — a small state machine per bot; line-of-sight raycasts are staggered
  (~7 Hz per bot) for performance, with local steering, stuck detection and detours.
- **Effects** — fully pooled: 2 `THREE.Points` particle systems (sparks/dust, ~940
  particles), an instanced-mesh tracer pool, an instanced-mesh decal pool, pooled flash
  lights, and a recycled enemy pool. Zero per-shot allocations in steady state.
- **Rendering** — one shadow-casting directional light (2048² map, tight bounds),
  hemisphere ambient, ACES tone mapping, fog, procedural shader sky, merged wall mesh,
  instanced crates/barriers/barrels → the whole static world renders in ~7 draw calls.
- **Audio** — two tiny Web Audio synth primitives (filtered noise + oscillator envelopes)
  compose every sound: shots, impacts per surface, footsteps, reloads, whiz, UI, wave
  stingers, and a subtle ambient wind/hum bed. Stereo panning + distance attenuation.

## Performance notes (laptop-friendly)

- Pixel ratio capped (1.75 high / 1.25 low / 1.0 performance) via **Settings → Quality**.
- Shadow map 2048/1024/off; only the sun casts shadows.
- Static geometry merged/instanced; enemies are ~10 boxes each; max 7 concurrent.
- All transient effects pooled; no per-frame allocations in the hot loop (scratch vectors).
- `dt` clamped at 50 ms; AI raycasts staggered; minimap/compass drawn on small 2D canvases.

## Extending the game

**Add a weapon** — append an entry to the `WEAPONS` array (damage, rpm, mag, spread,
recoil, sounds…) and a builder function next to `buildRifleModel()` in the ViewModel
section, then add its hip/ADS poses to `hipPos`/`adsPos`. It automatically appears in the
HUD, switch wheel, and restock logic.

**Add a map** — everything about “Depot K-9” is data: the `WALLS`, `CRATES`, `BARRIERS`,
`BARRELS`, `WAYPOINTS`, `ENEMY_SPAWNS` and `PLAYER_SPAWN` arrays in section [9]. The
colliders, minimap, cover points and AI navigation are all generated from those lists.

**Add an enemy type** — subclass `Enemy` and override `think()` (the state machine) or
`reset()` (stats). Faster/slower/tankier variants need only a different config object;
`waveConfig(n)` in section [1] is the single difficulty curve.

**Add a game mode** — the `Game` object is a small state machine
(`menu → playing ⇄ paused → dead/victory`). A “bomb defusal” or “time attack” mode is a
matter of replacing `Waves` with a different objective manager that reuses the same
player/AI/effects systems.

**Debug handle** — `window.VZ` exposes `Game`, `player`, `enemies`, `Waves`, `UI`,
`input`, `Settings`, `CFG`, `WEAPONS`, `THREE`, `scene`, `camera` for console tinkering.

## Roadmap ideas

- Grenades + destructible props, weapon pickups, health stations
- Navmesh/A* pathing for smarter flanking, bot-to-bot coordination (suppression, peeling)
- Match replays, settings for key rebinding, gamepad support
- Accessibility: FOV-independent sensitivity, colorblind palettes, subtitles for audio cues

# Runbook

## Setup

```bash
cd /Users/mrroddy/Downloads/suomi-sniper
npm install
```

Node 18+ (`node -v`). No test runner and no linter are configured.

## Run

```bash
npm run dev          # dev server with hot reload (default http://localhost:5173)
```

Other ports if 5173 is taken:

```bash
npm run dev -- --port 5174 --strictPort
```

## Test

There is no test suite. Verify by hand, or by script.

**By hand** — the checklist in `AGENTS.md` → "Verifying a change":

1. `npm run build` must complete without errors.
2. Play a full round on each of the four maps.
3. Fire twice quickly: you should be found. Stand still: exposure should fall.
4. Resize the window, including a narrow one — the canvas must fill it, not sit
   in a corner.
5. Hold right-click: the scope should fill the frame, centred, with the wheel
   switching ×4/×8 and the bracket finding a man.
6. **Fire at a man you are bracketed on: he must drop.** If the bracket is orange
   and the shot does nothing, `HIT_RADIUS` and the bracket threshold have drifted
   apart — they are the same constant in `game/round.js` on purpose.
7. **At the hip there must be a centre dot.** It is the only indication of where a
   hip shot goes; the rifle view model does not sit on the aim line.

**By script** (tenth pass): raw CDP against headless Chromium
(`chromium --headless=new --enable-unsafe-swiftshader --use-angle=swiftshader
--remote-debugging-port=9334`) pointed at the dev server. The suites live in a
scratch directory outside the repo:

```
mobile.mjs     — phone controls: 360° look, stick, every action, portrait/landscape
extraction.mjs — Paluu: quiet/loud exits, marker, hunters, HUD, shells, win
objectives.mjs — plans/kill-destroy-hold, ammo, camp+towers, sabotage, return fire
camp.mjs       — campaign ladder, difficulty, skirmish, bread band, regen, animals
loadout.mjs    — rifle cards, persistence, ADS raise/down, magazine, rechamber gate
chain2.mjs     — sortie-1 tutorial chain to the general win, rechamber-aware
shots-return.mjs — extraction flare, shell impact and under-fire results shots
```

Run order after any menu/round/enemy/input change: `mobile.mjs`,
`extraction.mjs`, `objectives.mjs`, `camp.mjs`, `loadout.mjs`, `chain2.mjs`.
`mobile.mjs` uses `Emulation.setDeviceMetricsOverride` (844×390 and 390×780),
`Emulation.setTouchEmulationEnabled` and emulated `hover:none` / `pointer:coarse`
media features; it dispatches synthetic `PointerEvent`s with `pointerType:
'touch'`. `chain2.mjs` clears localStorage first and zeroes heat so it always
runs the sortie-1 clean win; the others clear on boot too. Headless quirks (budget generous): rAF throttled to ~1–14 fps there,
so sleeps must be long and time-based mechanics need polling; aim-teleport AND
`fireShot()` must share one `Runtime.evaluate` (the frame loop re-aims between
evals); the rechamber guarantee is only testable inside one evaluation;
screenshots need retries.

Anything that needs the game's own state can reach it through
`window.__sniper` in dev builds:

```
round, camera, world, progress, difficultyId, weapon, ammo, missions,
aim, setAiming, setView, setZoom, zoom, fireShot, reload, rechamberLeft,
terrainAt, probe, startRound
```

`startRound(null, n)` is the test hook for jumping straight to a sortie number.
Vite strips that hook from the production build.

A useful sizing assertion, which is the regression test for the half-screen bug:

```js
const c = document.getElementById('scene');
const b = c.getBoundingClientRect();
// b.width === innerWidth, b.height === innerHeight, b.left === 0, b.top === 0
// c.width === b.width * devicePixelRatio
```

## Build

```bash
npm run build        # static output to dist/
npm run preview      # serve the build locally
```

## Deploy

- Platform: start.ng (serves `dist/`, `build/`, `docs/` or `out/`).
- Repo: https://github.com/AbdKabeer1/suomi-sniper (public, `main`).
- URL: https://suomi-sniper.start.ng (live).
- Command: `npm run build`, commit `dist/`, push. The first publish needed
  `POST /games/check` then `POST /games/publish` and approving the returned
  `approve_url`; after that, pushes update the game automatically.
- **Leaderboard keys** in `startng.json` must be lowercase `[a-z0-9_]` (max 24):
  `kills`, `lines_held`. `linesHeld` is rejected by validation — keep the
  snake_case key at the API boundary and the camelCase name inside the game.
- `dist/` is committed on purpose; do not add it to `.gitignore`.

## Environment

- Required env vars: none. No `.env`, no secrets, no backend.
- Where secrets live: nowhere — start.ng handles sign-in.
- Never commit: binary assets (see `AGENTS.md`), and do not add auth secrets.

## Troubleshooting

- **Black screen, no menu:** a thrown error — the game paints it into `#fatal`.
  Check the console.
- **Game paints into part of the screen:** the canvas sizing regressed. Confirm
  `renderer.setSize(w, h, false)` still has the `false`, that `#scene` still has
  `position: fixed; inset: 0; width/height: 100%`, and that the `ResizeObserver`
  is still attached.
- **The rifle clips through trees:** the weapon was moved into the world scene.
  It belongs in `WeaponView`'s own scene, drawn after the world with
  `clearDepth()`.
- **The scope magnifies the stock:** `WeaponView.camera`'s FOV was changed. It
  must stay fixed.
- **Menu feels slow to appear:** it should not. `whoami()` is skipped outside
  `*.start.ng`, so the menu shows immediately. If it waits, that guard regressed.
- **Shots "do nothing":** check three things in order — the centre dot is visible
  at the hip (`setCrosshair(true)` in `setView`), the bracket is showing
  (`updateReticle` no longer returns early when not aiming), and `probe()`
  returns `lethal`. If the bracket is orange but the shot misses, `HIT_RADIUS`
  and the bracket threshold have drifted apart.
- **Bracket flickers / never appears at long range:** `probe()`'s angular
  acquisition was narrowed. It should be `min(6, max(2.2, t * 0.028))`.
- **Bodies never disappear, or snap flat instantly:** `_updateFallen` in
  `scene/enemies.js`. It runs off capped game time, so under a very slow renderer
  it advances slowly — that is the frame cap, not a bug.
- **Objects floating or sunk:** something is placing at `y = 0`. Use
  `terrainHeight(x, z, map)`.
- **Third-person camera inside a tree:** expected — there is no camera collision
  against scenery beyond the terrain.
- **Scope off-centre or clipped:** check `--scope-d` in `:root` and that
  `.scope-window` uses `left/top: 50%` with `translate(-50%, -50%)`.

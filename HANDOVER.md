# HANDOVER

Point-in-time snapshot of **Suomi Sniper**. Read this before changing anything —
it records what is known-good, what has never been run, and what to do first.

**Status: live at https://suomi-sniper.start.ng.** The eleventh pass makes it
fully playable on phones: a left movement stick, drag-anywhere 360° look, and a
right-hand cluster for FIRE, AIM, RELOAD, ZOOM, VIEW, BREAD, CROUCH and RUN,
with the same round rules as the keyboard. The tenth pass added **Paluu — the
return**: every sortie now has an ending. A quiet run vanishes clean; a loud one
triggers a flare, hunters and a counter-battery barrage, and you have to run to a
green smoke marker to get out. The ninth pass gave each sortie a different
objective plan (kills, sabotage, a sniper duel, a hold), added an ammunition
loadout, built enemy camps with watchtowers and elevated guards, and made the
enemies shoulder their rifles and shoot back with tracers. See
`handoff/STATUS.md` and `handoff/DECISIONS.md` for the reasoning. Touch is
verified in emulation; real-device feel is still a hand-play item.

---

## What this is

A first-person stealth sniper game set in the Finnish Winter War. You hold a
line against advancing infantry columns, with patrols that hunt you once a shot
gives you away. Four maps, each with fixed weather that changes the core
exposure economy. A campaign ladders you through them: 50 sorties, a win opens
one, a loss replays. Objectives change with the sortie number — watchtowers,
supply dumps, a sniper duel, a hold in the snow — so the ladder is not the same
chain fifty times.

---

## What's built

| File | Contains |
| --- | --- |
| `src/main.js` | Renderer and canvas sizing, first- and third-person cameras, view switching, scope zoom, breathing, pointer lock, touch joystick + 360° look + action wiring, magazine/reload keys, frame loop, campaign flow and progress persistence, ammo state |
| `src/styles.css` | Interface, HUD, scope glass and reticle, touch control layout with safe-area insets, campaign card, loadout cards, ammo cards, bordered buttons |
| `src/data/maps.js` | Four maps, named for their Winter War places (Kollaanjoki, Tolvajärvi, Suomussalmi, Salla), with terrain weather and prop density |
| `src/data/campaign.js` | The 50-sortie ladder: per-sortie stakes, chapters with lore, difficulty presets, progress persistence |
| `src/data/missions.js` | Eight reusable objective plans (kill / destroy / hold), selected deterministically by sortie number; tutorial and finale |
| `src/data/ammo.js` | Three loads: service ball, armour-piercing (rank damage), match grade (hit window) |
| `src/data/lines.js` | Kill and wound callouts, picked by rank, range and streak |
| `src/data/weapons.js` | Three rifles (M/28, L42 chassis, .300 LRS): zoom, sway, cycle, kick, sound, skin, magazine and clip reload time |
| `src/scene/world.js` | Sky, terrain snow, instanced forest, rocks, shrubs, logs, hills, ruins, the enemy camp (tents, two watchtowers, crates, truck, flag, fire), line marker, snowfall, wildlife, extraction smoke and pooled shell impacts |
| `src/scene/animals.js` | Ambient wildlife: hares, reindeer, fox, ravens per map; graze/wander/flee reflexes, driven by `world.scare()` on rifle shots |
| `src/ui/preview.js` | Canvas painter for the menu map previews (procedural, seeded per map) |
| `src/scene/terrain.js` | `terrainHeight(x, z, map)` — one shared ground function |
| `src/scene/player.js` | The player's own figure: walk/aim poses plus the rifle carried in the hands, seated to the shoulder on aiming (blended) |
| `src/scene/weapon.js` | The first-person scoped rifle: geometry, sway, bob, recoil, muzzle flash, second render pass |
| `src/scene/enemies.js` | Soldier figures with shouldered-rifle aiming, muzzle flash and tracers, tower/camp posts, rank caps, death fall, sentry/column/patrol/guard/tower/sniper/officer/general AI, line-of-sight test, hit and damage, alarm and hunter spawning |
| `src/game/round.js` | Exposure, stamina, health + hidden recovery, movement bounds, shooting, hit detection, magazine and reload rule, difficulty/noise scaling, ammunition effects, mission engine (kill/destroy/hold), crate destruction, heat, Paluu extraction phase and counter-battery, scoring |
| `src/game/audio.js` | Layered rifle crack and echoes, enemy rifle by distance, shell whistle and impact, flare, wind bed, heartbeat, footsteps, bolt and dry and clip sounds |
| `src/services/startng.js` | whoami, scores, leaderboard, sign-in |
| `src/ui/screens.js` | Campaign/skirmish menu with preview, rifle + ammunition + difficulty step, HUD, pause, results, touch stick and action cluster |
| `src/ui/reticle.js` | The scope window and mil-dot reticle, aim bracket, range readout, third-person crosshair |
| `tools/cover.html` | Generates the start.ng cover picture |
| `startng.json` | Leaderboard columns: kills, lines_held |

---

## Verification status

Verified by script in headless Chromium (CDP, SwiftShader WebGL) against
`npm run dev`; six suites all green — mobile, extraction, objectives, campaign,
loadout/ADS/magazine, and the sortie-1 mission chain. Screenshots confirm the
campaign menu, the rifle/ammo step with bordered Deploy button, the in-game camp
with two watchtowers, the green extraction flare with `FALL BACK — 49 m`, the
under-fire results card, and the phone layout in both orientations. Scripts live
outside the repo; see `handoff/RUNBOOK.md`.

The production build is **live at https://suomi-sniper.start.ng** and was
smoke-tested there: menu renders immediately, canvas fills the viewport at the
drawing buffer's device ratio, the start.ng connect frame resolves the player as
a guest with a sign-in button, `cover.png` and hashed assets serve, Deploy starts
sortie 1 with the objective and `5/5` ammo HUD, there is no fatal bar, and the
production bundle correctly omits the `__sniper` dev hook.

What was checked in the ninth–eleventh passes (headlines; full lists in
`handoff/STATUS.md`):

1. **Phone controls.** Emulated 844×390 landscape and 390×780 portrait: touch
   controls hidden in the menu, all eight actions present in a round, a 960 px
   swipe turns the view past 2π, the stick moves the player and releasing stops
   him, BREAD shows the count and heals, FIRE/RELOAD/AIM/ZOOM/VIEW/CROUCH/RUN
   all act, pause hides the controls and resume restores them, and the HUD
   elements do not overlap.
2. **Paluu works both ways.** A quiet run (heat 0) wins clean with "Clean exit —
   the snow never told on you" and never enters extraction. A loud run (heat 1)
   enters extraction: green marker visible, two hunters plus the camp, HUD
   `FALL BACK` with a rotating bearing, shellfire scheduled, a direct shell
   drains blood, reaching the smoke wins, results say "You got out under fire."
2. **Sorties differ.** Sortie 1 is the tutorial; sorties 2–9 open with tower,
   column, sabotage, sniper, hold, sentries, patrol plans; 49–50 are a
   four-objective finale.
3. **Sabotage works end to end:** three crates shot apart, the objective counts
   them, and the mission advances to the next phase.
4. **Towers and camp:** two watchtowers with guards standing 3.5 m above the
   ground; a tower guard can be shot at platform height; five crates, tents,
   truck, flag and two camp guards exist.
5. **Enemies shoot back:** they shoulder the rifle (`rifleHeld`), tracers appear,
   and the player loses blood while exposed.
6. **Ammunition:** AP persists, reaches the round, and one-shots a 2-hp officer.
7. **Menu:** Next → rifle & ammunition → Deploy — Sortie N, all with visible
   borders (the old `#ui button { border: none }` was the root cause).
8. Everything from earlier passes still holds (campaign ladder, bread, regen,
   wildlife, rifle loadout, rechamber gate).
3. **Blizzard rerun.** The same chain passes on Frozen Lake, whose 110 m fog is
   the tightest constraint on `spawnBoss` placement.
4. **Layout.** At 1280×713 and an emulated 390×780 the mission pill, score pill,
   callout and objective banner stay inside the viewport and do not overlap.
5. **Build.** `npm run build`: 18 modules, ~68 kB app JS.

Not checked: whether the mission pacing is fun, or whether the bosses read as
bosses at 150 m on a real display. That needs a hand-play.

What was actually checked in the fourth pass:

1. **It builds.** `npm run build` completes clean. 16 modules, ~56 kB app JS.
2. **The canvas fills the viewport.** At 1280×800, 390×780, 1440×560, 700×900
   and 1920×1080 the canvas box equals the viewport, sits at (0, 0), and its
   drawing buffer equals the box × device pixel ratio. This is the half-screen
   bug: `renderer.setSize(w, h, false)` plus a `ResizeObserver`, so check this
   again at any new window shape.
3. **All four maps load** with zero console errors and zero page errors.
4. **The weapon view model** is visible in first person at hip, hidden when the
   scope is up, and hidden in third person.
5. **The scope.** Right-click sets `reticle-scoping`, the window is
   76 vmin across (608 px at 800 px tall, 296 px at 390 px wide), the wheel
   switches ×4 → ×8, and the camera FOV settles at 10.5° then 5.4°.
6. **Firing** increments `shotsFired` and sets `recoil` to 1 (flash and kick).
7. **Movement.** Walking settles at ~3.7 m/s, `Shift` at ~6.0 m/s, and releasing
   the keys decelerates through ~0.5 m/s rather than stopping dead.
8. **Views switch.** `V` toggles first ⇄ third; in third person the player figure
   and centre dot show and the weapon view model goes away.
9. **Touch.** On 390×780 the `AIM` and `FIRE` buttons show; `AIM` sets the scope
   and narrows the FOV; `FIRE` fires.

What was actually checked in the fifth pass:

1. **It builds.** `npm run build` completes clean. 16 modules, ~59 kB app JS.
2. **Aiming references exist everywhere.** In first person at the hip the centre
   dot is visible (`opacity: 1`) and hidden again under the scope.
3. **Shots land.** Aiming the camera dead at a man and firing increments
   `kills`, at 52–96 m, on every map. The probe reports `lethal: true` and the
   bracket turns orange for exactly the shots that connect.
4. **The bracket shows at the hip** on all four maps when a man is under the aim
   line, with the range and a "right-click" (or "hold AIM" on touch) hint. Its
   screen centre matches the projected man's chest to within the miss distance
   (bracket centre 643, 402 vs crosshair 640, 400 for a 0.27 m miss at 75 m).
5. **Men fall.** A hit leaves the body visible, rotating to exactly
   ±`(π/2) × 0.92` about its own axis, then clears after `deathT > 3.4`.
6. **Sentries are static.** Position drift over 900 ms is 0.00 m.
7. **Every map spawns sentries**: 2 sentries per map, plus the per-map columns
   and patrols (kollaa 3+2, lake 3+3, village 4+2, ridge 3+3). Zero console and
   page errors across all four.
8. **Touch AIM is a toggle and releases properly.** Tap AIM → scoping, button
   lit; tap ZOOM → ×8; tap AIM again → scope down, button clear.
9. **The core tension is unchanged.** Two quick shots take exposure from ~22 to
   100.
10. **Sizing and the scope survive all of it.** Canvas box equals the viewport at
    700×900 after a play session; wheel still cycles ×8 → ×4 (FOV 10.0°).

Not verified: real phone or desktop hardware, frame rate on a mid-range phone,
and the feel of the new scope magnification and sprint by hand. **Hand-play an
actual round on each map before trusting the feel.**

---

## Change log of the second pass

Added after the first playable build, in response to feedback. Still untested in
the same way as everything else.

- **The player walks.** The first version was a stationary sniper who could only
  relocate between fixed hides. That was the wrong game — you asked for one in
  motion. Movement is now free: `WASD` walks, relative to where you're looking,
  clamped to the map and to the friendly side of the line.
- **Crouch** (`C` / `Ctrl`) halves the exposure cost of walking and drops the
  camera, at the cost of moving like a man wading.
- **Bread is on the ground**, scattered out in the open between you and the
  line, collected by walking within 2.2 m. The old version only had bread at
  certain hides.
- **Aiming no longer requires clicking to lock the mouse.** `movementX/Y` works
  unlocked; the click-to-lock step was a discovery problem, not a feature.
- **Yaw is unlimited** now that you can turn around.
- **`health.set is not a function`** was a shadowing bug: `setMeters` destructured
  `{ health, stamina, exposure }`, shadowing the meter objects of the same name.
- **The sights were never shown.** `createSights()` was called, styled, and then
  `show()` was never invoked.
- **`setHud` rebuilt the HUD's DOM every frame.** Now guarded by a change key.

---

## Change log of the third pass

Movement, views, zoom targeting and the environment rebuild.

- **A visible player.** `scene/player.js` adds a figure in white winter kit with
  walk and aim poses. Hidden in first person; shown in third.
- **View switching (`V`).** First person is the eye behind the sights; third
  person is over the shoulder. The camera keeps the aim orientation in both, so
  the reticle stays truthful; the third-person camera pulls *in* rather than up
  when ground rises behind the player.
- **Aim / zoom on right-click (or the `AIM` button).** Narrows the FOV, halves
  the sway, halves walking speed while sighted, and brackets the man under the
  crosshair with his range. The bracket turns amber when the shot is on him.
  This is deliberately still iron sights — no glass, no scope.
- **`scene/terrain.js`.** The ground was a flat plane. It is now displaced by a
  shared closed-form height function that the camera, enemies, trees, props and
  bread all sample, so nothing floats or sinks. Amplitude is per map: near-flat
  on the frozen lake, rolling on the ridge.
- **The environment is no longer bare.** Rocks, snowed-in shrubs, fallen logs and
  a low distant ridge, all instanced; a proper sky texture with cloud bands and
  horizon haze; a soft sun disc; a cracked ice sheet on the lake; denser,
  better-shaped conifers whose snow caps follow the branches instead of hiding
  the tree. Props are kept clear of the hides, including the few metres behind
  where the third-person camera sits.
- **The village reads again.** Snowier ground and a little more light through the
  fog, so the ruins are legible.
- **No more black-screen wait on localhost.** `whoami()` is skipped entirely
  outside `*.start.ng` (it could never have answered), and the menu shows
  immediately instead of after two sequential 5 s timeouts.
- **Mobile got an `AIM` and a `FIRE` button**, and the favicon 404 is gone.
- **`fire()` no longer refuses to fire while walking.** `this.moving` was never
  assigned, so the guard silently did nothing; removing it means the keyboard and
  the click mean the same thing, and movement is priced through exposure instead.

---

## Change log of the fourth pass

The half-screen bug, modern optics, better motion and a better forest.

- **The half-screen bug is fixed.** `renderer.setSize(w, h)` was writing inline
  pixel dimensions onto the canvas, which overrode the stylesheet. Whenever those
  pixels disagreed with the actual viewport — a window that opened small, then
  maximised, a display swap, a browser zoom — the game rendered into one corner
  of the screen. Now `setSize(w, h, false)` leaves the CSS box alone, and a
  `ResizeObserver` on the canvas plus `visualViewport`/`resize`/
  `orientationchange` keeps the drawing buffer, camera aspect and weapon camera
  in step. **Do not remove the `false`.**
- **The iron sights are gone.** `src/ui/sights.js` and its CSS were deleted. The
  owner asked for real optics rather than the historical no-scope constraint.
- **A first-person weapon.** `scene/weapon.js` builds a modern scoped bolt-action
  from primitives — chassis, fluted barrel, brake, bolt handle, magazine, a
  three-part scope with lens and turrets, and gloved hands. It sways with the
  breath, bobs with actual ground speed, kicks on recoil and lights a muzzle
  flash. It renders in a second pass with the depth buffer cleared, so it never
  clips the world and its own parts still sort correctly.
- **A real scope.** `ui/reticle.js` now draws a circular glass window with an
  opaque surround, hairlines, a mil-dot ladder and the magnification label.
  Right-click raises it; the wheel switches ×4 (10.5°) and ×8 (5.4°). Sway is
  scaled by the field of view so the picture settles, and mouse sensitivity
  scales with it so the scope stays steerable.
- **Movement has weight.** `round.js` keeps a velocity and accelerates toward the
  desired gait instead of teleporting the position. Walk 3.7 m/s, crouch
  1.8 m/s, sighted 1.5 m/s, sprint 6.0 m/s. Stamina and exposure price the gait;
  "moving" now means covering ground, including the slide after you let go.
- **`Shift` does two jobs**: sprint while moving, held breath while scoped.
- **Stride follows distance, not time**, and the third-person figure leans into
  a sprint.
- **The forest reads better.** Pines have three foliage tiers instead of two (a
  two-cone tree is a party hat, and the silhouette is all you can identify at
  150 m). Birch crowns fork upward with shorter, thinner twigs instead of long
  near-horizontal poles. Every instanced prop gets a small per-instance
  brightness tint, so four hundred trees stop sharing one flat green.
- **Menu copy and controls updated** to match the scope and the sprint.

---

## Change log of the fifth pass

Fixing "right-click and mouse just shoot nothing", and making the men look like
men.

The report was that firing did nothing. It wasn't the hit test: aiming dead at a
man always registered. Two things made it *feel* broken.

- **There was no aiming reference at all in first person at the hip.** The centre
  dot only appeared in third person and the target bracket only while aiming, so
  a hip shot was fired completely blind — the rifle view model sits low and right
  of frame and the barrel is not where the round goes. Now the centre dot shows
  in every view, and the bracket appears at the hip too, with the range and a
  nudge to bring the scope up. This is the actual fix for the report.
- **"On target" did not mean "will hit".** The bracket turned orange at a 0.5 m
  miss, but the shot only connected inside 0.45 m. The two are now the same
  number: `HIT_RADIUS` (0.6 m) in `round.js` decides both, and `probe()` returns a
  `lethal` flag so the UI can never promise a hit the rules won't give.
- **Target acquisition is by angle, not distance.** A fixed 2.4 m window means
  very different things at 60 m and 200 m; at the hip, breath sway alone is 1–2 m
  at 150 m, so the bracket flickered in and out. `probe()` now widens its search
  with range (`min(6, max(2.2, t × 0.028))`), holding a roughly constant slice of
  the view.
- **Men fall over instead of blinking out.** `hit()` starts a death animation —
  the body topples about its own left-right axis (eased out, capped at `deathT`
  3.4 s) and stays on the snow. This is the hit confirmation: a figure dropping
  is unambiguous in a way that a vanished one never was.
- **The soldiers are people now.** Rebuilt in `scene/enemies.js`: steel helmet
  with a brim, a shadowed face, neck, sloping shoulder yoke, a greatcoat with a
  waist and a flared hem, belt, buckle, pouch, pack, gloved hands and boots with
  toe boxes. Each man gets a slightly different coat and helmet tint. The rifle
  is slung muzzle-up over the shoulder — held across the chest it poked a barrel
  out sideways at shoulder height, which at 80 m read as a stick growing out of
  him.
- **Sentries: a third kind, and the static target.** Two per map, standing posts
  between you and the line. They scan a few degrees but never move, and they are
  the first thing a new player can actually practise on. They don't count toward
  the win condition.
- **Static figures idle.** `applyIdle()` gives a man who has stopped settled
  weight and slow breathing instead of a frozen walk pose.
- **Touch magnification.** A phone has no wheel, so the touch pad gets a `ZOOM`
  button. `AIM` is now a **tap toggle** rather than a hold, so the other thumb is
  free to drag the view — holding a button and aiming at once was not workable.

---

## Things most likely to need tuning

Every one is a single number near the top of its file. The last five are new in
the third pass.

| What | Where | Current | If it feels wrong |
| --- | --- | --- | --- |
| Exposure added per shot | `fire()`, `game/round.js` | `+22`, plus up to `+34` for closeness | The main difficulty dial |
| Exposure decay per second | `update()`, `game/round.js` | 26 blizzard / 20 fog / 14 clear | Higher makes hiding easier |
| Spotted threshold | `SPOTTED`, `game/round.js` | 55 | Where incoming fire starts landing |
| Quiet threshold | `QUIET`, `game/round.js` | 30 | Unused at present — kept for a "safe" HUD state |
| Hearing radius | `hearShot()`, `scene/enemies.js` | 190 m | How far one shot carries |
| Hit radius | `HIT_RADIUS`, `game/round.js` | 0.6 m | Generosity of the hitbox; also sets when the bracket turns orange |
| Target acquisition | `probe()`, `game/round.js` | `min(6, max(2.2, t × 0.028))` m | How close the aim line must be before the bracket appears |
| Death linger | `_updateFallen()`, `scene/enemies.js` | 3.4 s | How long a body stays on the snow |
| Sentries per map | `_spawn()`, `scene/enemies.js` | 2 (`map.sentries`) | More gives an easier warm-up |
| Breath sway | frame loop, `main.js` | `0.0075` → `0.0011` held | How hard aiming is |
| Enemy damage | `enemies.update()`, `scene/enemies.js` | 2–14 by distance | Lethality |
| Bread restore | `eat()`, `game/round.js` | +30 health, +55 stamina | |
| Column speed | `maps.js` `enemySpeed` | 1.15–1.35 | How fast the pressure builds |
| Scope magnification | `ZOOM_LEVELS`, `main.js` | ×4 = 10.5°, ×8 = 5.4° | Lower is a harder zoom; add a third level if wanted |
| Third-person aimed FOV | `FOV_AIM_THIRD`, `main.js` | 18 | How far the shoulder view pulls in |
| Look sensitivity | `lookSensitivity()`, `main.js` | 0.0016 × (fov / 42), floor 0.18 | Raise if the scope turns too slowly |
| Sprint speed | `update()`, `game/round.js` | 6.0 m/s | Faster than 6.5 stops reading as a man |
| Acceleration | `update()`, `game/round.js` | 11 moving / 14 stopping | Lower is heavier, higher is snappier |
| Weapon hip pose | `WeaponView`, `scene/weapon.js` | `(0.23, -0.25, -0.9)`, scale 0.9 | Where the rifle sits in frame |
| Third-person distance | camera block, `main.js` | 4.2 hip / 2.2 aimed | How much of the man you see |
| Terrain relief | `terrain` amp, `maps.js` | 0.12 lake → 4.2 ridge | How rolling the ground is |
| Prop density | `env`, `maps.js` | per map | How cluttered the snow reads |
| Shadow map | `renderer.shadowMap`, `main.js` | 2048 | Do not raise — phone budget |

---

## Known gaps

1. **No collision with props.** Rocks, logs and shrubs are scenery; you walk
   through them. The third-person camera can still clip into a large tree trunk.
2. **Patrols hone in perfectly** once alerted — they know your exact position
   rather than a rough one, which is harsher than the comment claims.
3. **No wind effect on the bullet.** The wind is audio and atmosphere only; it
   doesn't move the shot.
4. **No cover system.** Line of sight is blocked by trees, but standing at a
   hide has no mechanical benefit beyond being still.
5. **Touch is verified in emulation, not on physical hardware.** The 844×390 and
   390×780 layouts, stick, 360° look and every button are scripted green, but
   thumb reach, Safari address-bar resize and real GPU frame rate need a phone.
6. **The dev hook.** `main.js` exposes `window.__sniper` (including `weapon`,
   `setZoom`, `touchState` and `zoom()`) when `import.meta.env.DEV` is true. Vite
   strips it from the production build; it exists so changes can be checked by
   script rather than by eye.

---

## Next steps

1. Play it by hand: `npm run dev` on a laptop and the live URL on an iPhone and
   an Android phone. The scripted checks prove it runs, moves and shoots; they
   cannot tell you whether it feels good.
2. Judge the touch feel: stick dead zone, drag sensitivity at 4×/8×, thumb reach
   to FIRE and AIM, and whether auto-breath on scope is too forgiving.
3. Decide two things the owner has not answered: **should the game start in
   third person?** and **is ×8 too strong / too weak?**
4. Tune exposure-per-shot until two quick shots reliably get you found and three
   slow ones doesn't.
5. Add a second weapon (the view-model builder is self-contained, so this is a
   data change plus a `setWeapon()` on `main.js`) if the owner wants variety.
6. Next feature candidates: the Nemesis sniper, a daily seeded contract, or
   medals on the results card.
7. Ship: `npm run build`, commit `dist/`, push — start.ng updates the live game.

---

## Gotchas

- **`dist/`, not its parent.** start.ng wants `index.html` inside `dist/`.
- **`npm run build` wipes `dist/`.** Anything placed there by hand disappears —
  put the cover in `public/` so every build copies it in.
- **Sign-in only works on `*.start.ng`.** Locally the connect page is silent and
  the game correctly reports you as a guest. Don't "fix" that.
- **The scene is replaced on every map change** by `loadMap()`, which disposes
  the old one wholesale. Anything you hold a reference to across a map change
  (a material, a geometry) will be disposed underneath you.
- **The ground is a function, not a mesh.** Anything that sits on the snow must
  be placed at `terrainHeight(x, z, map)`; assuming `y = 0` floats or sinks it.
  This includes the camera, the enemies and the bread.
- **Props stay clear of the hides** (12 m) and of the player's tree-respawn zone
  (9 m), because the third-person camera sits several metres behind the player.
- **Instanced trees have no individual objects.** Line of sight is checked
  against `world.treeSpots`, not by raycasting. If you change tree placement,
  that list is what the hit test uses.
- **One hit radius.** `HIT_RADIUS` in `game/round.js` is the single source of
  truth for both what a shot hits and when the bracket turns orange. If you
  change one without the other the reticle starts lying.
- **Everything in first person leaves the camera along the aim line**, but the
  rifle view model does not sit on that line — it is held at the hip, low and
  right. That is what the centre dot is for. Don't remove it.

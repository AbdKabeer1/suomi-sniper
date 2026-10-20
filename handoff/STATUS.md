# Status

Last updated: 2026-10-20 (eleventh pass — full mobile controls)

## Done

### This pass (eleventh) — phone controls
- **Full touch control layer.** Left analog stick for movement, drag anywhere on
  the world to look with **unbounded yaw** (a complete 360° and beyond — the old
  ±π clamp is gone), and a right-hand action cluster: `FIRE`, `AIM` (toggle),
  `RELOAD`, `ZOOM`, `VIEW` (first/third), `BREAD`; movement toggles `CROUCH` and
  `RUN` sit above the stick. Every laptop key has a touch equivalent.
- **Control state is shared with the keyboard.** The stick writes the same
  `fwd`/`strafe` input the keys do; crouch/sprint are merged into the same round
  input. The round rules do not know which device is in use.
- **360° look** works with the mouse and touch; pitch still clamps. Touch look
  is pointer-id-owned, so a second thumb on the stick or a button cannot reset
  the view mid-turn. Tap-to-fire on the world was removed — the dedicated FIRE
  button is the only trigger, so looking around cannot fire a shot by accident.
- **Breath on touch:** scoping in holds your breath automatically (the Shift job
  when aiming), with the same stamina cost.
- **HUD reflow for phones.** Score strip drops the secondary columns, the meters
  gain a translucent panel and move mid-left, the bread count moves onto the
  `BREAD` button, and the objective gets its own row in portrait. Safe-area
  insets and `viewport-fit=cover` keep controls off the notch/home bar.
- **Detection fallback.** Touch mode turns on for a coarse pointer *or* any
  touch device with no fine pointer; the `touch-device` body class drives the
  layout and visibility, so an Android WebView or in-app browser that reports
  pointer media oddly still gets the controls instead of a game with invisible
  input.
- **Layout and lifecycle:** controls are hidden in the menu, results and pause
  (body `in-round` / `paused` classes), return on resume, and reset on blur.
  A portrait menu shows a one-line "Rotate to landscape" hint; the game itself
  is fully playable upright.
- **iOS audio:** the first pointerdown anywhere unlocks WebAudio, not just a
  canvas press, so the synth wakes on a menu tap.
- **HUD bugs fixed:** `.hud-level` had no CSS at all and sat on top of the
  start.ng profile card; it now sits beneath it. Meter labels were clipped by
  their 52 px flex basis; widened to 62 px.
- **Verification:** new `mobile.mjs`, ALL GREEN (coarse-pointer detection,
  hidden-in-menu controls, all 8 actions, 360° swipe past 2π, stick movement and
  release, bread heal, fire, reload, crouch, run, aim, zoom, view, pause/resume,
  portrait layout, no overlap, canvas fill, desktop hides controls). All five
  desktop suites still green.

### Previous pass (tenth) — Paluu (The Return)
- **The sortie has an ending now.** When the last objective falls, the round
  does not cut to results. `round.heat` (accrued while exposure > 50, plus a
  little per shot and per hit) decides which exit you get:
  - **heat < 0.55 — clean exit.** You disappear; results say "Clean exit — the
    snow never told on you." This is the mastery read and the replay goal.
  - **heat ≥ 0.55 — they have your range.** A green flare goes up, the camp
    turns hunter (every man alert = 1) and two hunters are pushed out to cut the
    retreat. Counter-battery shells walk toward your last position. A smoke
    column marks a rendezvous 46–62 m behind you (never less than ~38 m after
    clamping). Reach the smoke to win; die on the way and the sortie is lost.
    Sortie 1 is exempt: the tutorial always awards the clean exit so the
    barrage cannot eat the first win before the loop is learned.
- **The barrage** (`round._updateExtraction`): shells are telegraphed by a
  whistle (`shellIncoming`) one second before impact, land with a 9.5 m falloff
  radius and 34 max damage, and are led by your velocity — standing still is
  what gets you hit. Cadence scales with difficulty. Impacts spawn a pooled
  flash/plume/crater in `scene/world.js`, scare wildlife, and shake the camera
  (position only, never the aim).
- **HUD**: a green `FALL BACK — n m` pill with a bearing arrow that rotates
  relative to the camera; results add "You got out under fire."
- **Scene**: green flare + rising smoke + pulsing ring at the rendezvous, and a
  four-slot impact pool (no allocation during the run). New synth sounds:
  `shellIncoming`, `shellImpact`, `flare`.
- **Bug fixed on the way:** the results card was reading `breadFound` from the
  snapshot, which never included it — every results screen said
  "Bread found: undefined". Added to `snapshot()`.
- **Readability fix:** the first shell flash was an enormous white dome that
  hid the run; scaled down to a flash with a visible plume and crater.
- **Verification:** new `extraction.mjs`, ALL GREEN (quiet path, loud path,
  marker, hunters, HUD/bearing, shell scheduling, shell damage, win at the
  smoke, under-fire results, no undefined stats). All four existing suites still
  green.

### Previous pass (ninth)
- **Different objectives per sortie.** `src/data/missions.js` now builds the
  objective chain from the sortie number instead of shipping one fixed chain.
  Sortie 1 keeps the tutorial (sentries → column → officer → general); sorties
  2–48 cycle eight plans, and 49–50 run a four-objective finale. Objective
  types are real, not renamed kills:
  - **kill** by enemy kind — sentries, tower watchmen, patrols, camp guards,
    officer, sniper, general.
  - **destroy** — shoot the camp's supply crates apart (`_pickCrate` in round,
    `world.breakCrate()` in scene).
  - **hold** — stay alive and unfound for 25–55 s; the only objective that
    rewards doing nothing.
  Deterministic numbering means the menu and the round cannot disagree about
  what sortie 23 asks for.
- **Enemy camp + watchtowers.** `createCamp()` in `scene/world.js`: four tents,
  two timber watchtowers with platform-height guards, five supply crates, fuel
  drums, a truck, a flag, sandbags, a camp fire. The camp clearing excludes
  trees and boulders. Tower platform heights are handed to the enemy layer so
  men actually stand on them (`baseY`), and the hit test uses `baseY + chest`
  so elevated men are hittable. A sniper can spawn on a tower for the duel
  objective.
- **Enemies shoot back visibly.** Soldiers now carry the rifle on the shoulder
  and re-pose it into their hands (`setRiflePose`) when engaging, face the
  player, and fire with a muzzle flash and a pooled tracer line. Accuracy falls
  with range and against a moving/crouched target; misses put a tracer past the
  player. A new `enemyShot` event plays a distance-mixed rifle crack, and the
  existing near-miss whizz stays. Hurt fires only after exposure > 55.
- **Ammunition loadout.** `src/data/ammo.js`: Service ball, Armour-piercing
  (`bossDamage: 2`, narrower hit window), Match grade (`radius: 1.32`, wider
  window). Selected in menu step 2, persisted as `suomiAmmo`, read by the round
  for hit radius and rank damage.
- **Menu flow fixed.** Step 1's button now says **Next** (amber bordered), step 2
  is titled "2 · Rifle & ammunition" with three bordered ammo cards, and the
  start button is a wide bordered **Deploy — Sortie N / Deploy — <place>**.
  The root cause of buttons having no borders was `#ui button { border: none }`
  — an ID selector beating every class border. Removed; every button class owns
  its edge now.
- **Verification:** new `objectives.mjs` suite, ALL GREEN (28 checks); campaign,
  loadout and mission-chain suites all green; build clean (~105 kB app JS).

### Previous pass (eighth)
- **Campaign ladder.** Fifty sorties across five chapters
  (`src/data/campaign.js`): Kollaanjoki (1–12), Tolvajärvi (13–24),
  Suomussalmi (25–36), Salla (37–48), finale on Salla (49–50). Each sortie's
  stakes come from its number only — deterministic and shared by the menu and
  the round: sentries, columns, patrols, enemy pace ∩ cap, and a boss HP bonus
  every 20 sorties. **A win opens exactly one sortie; a loss replays the same
  number.** Progress is `suomiProgress` in localStorage (the old `suomiLevel`
  — which advanced on losses — is retired). Results card now says
  "Sortie N held — sortie N+1 unlocked" and the primary button reads
  "To the next sortie".
- **Menu restructured.** Step 1 is now Campaign/Skirmish tabs. Campaign shows
  the sortie card: `SORTIE n OF 50`, chapter title, chapter lore, painted map
  preview, and a progress bar. Skirmish keeps the four map cards and plays any
  place at your current sortie's stakes (the map-card click updates the deploy
  spec, so switching place mid-browse never deploys the stale pick).
- **Difficulty.** Recruit/Regular/Veteran chips on the loadout step, persisted
  as `suomiDifficulty`. Scales enemy pace (via the map), shot noise
  (exposure gain ×0.8/1.0/1.25) and damage taken (×0.8/1.0/1.3). It never gates
  content — the ladder's gate is winning.
- **Sortie stakes verification.** Canvas preview painted, stakes stamped on
  the round (`columns: 3` at sortie 1), lost round kept progress at 1, win
  moved to 2, skirmish on Suomussalmi carried level 2's stakes. All over CDP.
- **Bread reachable (bug fix).** The movement clamp was
  `z ≥ LINE_Z + 4`, but bread spawns at negative z past the line — every loaf
  sat behind an invisible wall. The band is now `z ∈ [-60, 70]`: crossing your
  own line into no-man's land is deliberate (bread lives there, and so do
  patrols). Bread scatter pulled in to `z ∈ [-54, -8]`.
- **Blood returns when hidden.** Health regenerates slowly
  (+1.6 hp/s of game time) while stopped and exposure < 20 — hiding behind a
  rock after taking hits is now the correct answer, and bread is the deliberate
  big heal (still +30). Verified over CDP: 70 → >75 while stationary.
- **Wildlife.** `src/scene/animals.js`: mountain hares, reindeer, a fox, and
  circling ravens — rosters fit each place (blizzard = sheltering hares, fog =
  fox in the ruins, bright ridges = reindeer herd + ravens). They wander near
  a home point, graze, flee on a rifle crack within 55 m (`round.fire()` →
  `world.scare()`) or when the player gets inside 15 m. Hares hop; each animal
  keeps its own timing clock. wired into `createWorld`, no game rules touched.
- **HUD label** changed from `TASO` to `SORTIE` (the number is the sortie).

### Kept from earlier passes (all re-verified this pass)
- Mission chain (sentries → column → officer → general) with wound callouts
  and boss spawn-on-phase; CHAIN regression all green.
- Three rifles on the menu, persisted (`data/weapons.js`), ADS scope raise
  with FOV + opacity transition, rechamber gate after every fired round
  (a miss also cycles the bolt — see decisions), 5/5/4-round internal
  magazines, R to reload with stripper-clip sound and dry-click on empty.
- Procedural-only assets, layers respected (`scene/` never imports `game/`).

## Deployment (start.ng)

- **Repo:** https://github.com/AbdKabeer1/suomi-sniper (public, `main`), started
  from the previously empty repo on the owner's account.
- **Build payload:** `dist/` committed (5 files, ~1.3 MB): `index.html`,
  `cover.png`, hashed JS/CSS. `base: './'` keeps asset URLs relative.
- **Validation:** `POST /games/check` passes; folder `dist`, no warnings.
- **Live:** https://suomi-sniper.start.ng — approved and smoke-tested in a real
  headless browser: menu, canvas fill, guest profile card from start.ng, cover
  and hashed JS served, Deploy starts sortie 1 with the objective/ammo HUD, no
  fatal bar, and the production build correctly has no `__sniper` dev hook.
- **Updates:** pushing to `main` updates the game automatically. Rebuild
  (`npm run build`) and commit `dist/` before pushing.
- **Leaderboard keys:** start.ng requires lowercase `[a-z0-9_]`; the columns are
  `kills` and `lines_held` (not `linesHeld`). The game keeps camelCase internally
  and maps at the API boundary in `main.js`.

## In progress

- Nothing. Complete and machine-verified.

## Blocked

- Nothing blocking. Real-device feel, frame rate on a phone, the visual read of
  the animals in motion, and whether the new enemy fire is too punishing are
  owner-judgement items.

## Next

1. Hand-play on a real iPhone and a real Android phone in both orientations.
   Judge: thumb reach to `FIRE`/`AIM`, stick dead zone, drag sensitivity at 4×
   and 8×, and whether the auto-breath on scope is too forgiving.
2. Hand-play Paluu on a loud and a quiet run. Judge: is the clean-exit threshold
   reachable without deliberately not shooting? Is the barrage survivable at
   sortie 1 / 25 / 49? Does the 46–62 m run feel like a climax or a chore?
3. Hand-play sorties 1–5 and 49–50. Judge: does each plan feel distinct? Is the
   sniper duel survivable on Veteran? Is the first return-fire exchange too
   sharp (enemy fire starts at exposure 48, aim delay 0.5 s)?
4. Watchtower readability: confirm the platform guards read at 120 m on a
   laptop, and that tower legs do not hide the camp behind them on Salla.
5. Evaluate mastery feedback: results card could show "sortie streak", per-plan
   completion stars or a chapter medal — cheap additive retention.
6. Ship future changes: `npm run build`, commit `dist/`, push — the live game
   updates itself.

## Current state

- **Builds?** Yes. `npm run build` clean (~115 kB app JS gzipped ~40.0 kB).
- **Runs?** Yes, headless Chromium + SwiftShader; `#fatal` never shows.
- **Suites (CDP against `npm run dev`, scripts in the temp workspace):**
  - `mobile.mjs` — MOBILE ALL GREEN: emulated 844×390 and 390×780, coarse
    pointer, touch controls hidden in menu and shown in round, 8 actions, 360°
    drag, stick movement/release, bread heal, fire, reload, crouch, run, aim,
    zoom, view, pause/resume, HUD overlap checks, canvas fill, desktop hides
    controls.
  - `extraction.mjs` — PALUU ALL GREEN: quiet run wins clean and never starts an
    extraction; loud run enters extraction, marker visible, hunters spawned,
    FALL BACK + bearing arrow, shellfire scheduled, a direct shell drains blood,
    reaching the smoke wins under fire, results have no undefined stats.
  - `objectives.mjs` — OBJECTIVES ALL GREEN: Next/bordered buttons, three ammo
    cards + AP persistence, tutorial sortie intact, plans for sorties 2–9 and
    49–50 (kill/destroy/hold), camps + towers + elevated guards, tower guard
    hittable at platform height, sabotage mission end-to-end (three crates
    broken → objective advances), AP one-shots a 2-hp officer, enemies shoulder
    rifles, fire back and draw blood, no fatal bar.
  - `camp.mjs` — CAMPAIGN ALL GREEN: campaign card, skirmish tab hiding,
    difficulty persistence and round-wiring, sortie stakes, loss keeps
    progress, win opens one sortie and the menu shows it, skirmish at current
    stakes, bread inside the walking band, pickup + eat = +30 HP, hidden
    regen, `world.scare` wired, no fatal bar.
  - `loadout.mjs` — ALL GREEN: 3 rifle cards, default chassis, pick persists,
    round start, scope raise (opacity/FOV/handoff, ×10 for lrs), down-scope
    restore, first shot fires, rapid second shot dry-blocked **within one
    evaluation**, recovery after the bolt, no page errors.
  - `chain2.mjs` — CHAIN ALL GREEN: full tutorial chain sentries → column →
    officer (wound callout "1 more") → general (3 hp) → win → results, with the
    magazine and bolt gate respected. It clears storage first so it always runs
    sortie 1.
- **Screenshot proof:** menu step 1 (Next button, bordered), step 2 (rifle
  cards, three bordered ammo cards, bordered Deploy button), and an in-game shot
  of the camp with two watchtowers, tents, crates, flag and a guard.
- **Known-broken / unverified:** real-device feel and frame rate; no collision
  with scenery (the camp is walk-through); third-person camera can clip a large
  trunk; animals not eyeballed in motion; return-fire and barrage balance not
  yet hand-judged; the camp adds roughly 100 draw calls, so phone frame rate
  needs a check. Touch controls are verified in emulation, not yet on a physical
  iPhone/Android (thumb reach, Safari address-bar resize, and real GPU frame
  rate remain hand-play items).

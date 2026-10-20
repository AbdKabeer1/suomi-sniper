# Decisions

Record choices that the next agent should not re-litigate without a reason.

## 2026-10-20 — Paluu: the ending is earned by heat, not fixed

- Context: every sortie ended the moment the last objective died, which killed
  the tension exactly when it should peak (getting away with it).
- Options: (a) always an exfiltration phase; (b) a random extraction event;
  (c) one heat value decides whether you slip away clean or have to run the
  guns.
- Chosen: (c). `heat` accrues while exposure > 50 (0.22/s), 0.05 per shot and
  0.08 per hit. Below 0.55 → clean win; above → `_beginExtraction()`.
- Why: it ties the whole stealth economy to the ending. A player who shoots from
  distance and disappears gets the clean exit; a player who gets seen and keeps
  firing gets the barrage. That gives replay a goal ("can I get out clean on
  this sortie?") without adding a mode. Always-on extraction would make quiet
  play pointless and turn every sortie into a 30-second chore.
- Trade-off: the clean path has no set piece, only a line on the results card.
  If that proves anticlimactic, add a short "the snow closes over you" beat —
  not a mechanic.
- Tutorial guard: sortie 1 is exempt from extraction (threshold 1.1). The first
  win has to be seen before the game asks the player to survive a barrage.

## 2026-10-20 — Extraction is a phase, not a new status

- Chosen: `status` stays PLAYING during the exit; `phase` becomes 'extraction'.
  Enemies, exposure, bread, shooting and the health check all keep running.
- Why: a separate status would need every system to learn a fourth state. A
  phase lets the run home reuse the exact rules that got you there — which is
  the whole point of the finale.
- Guard: `_win()` is now idempotent (`status !== PLAYING` returns), and the
  health check only runs while PLAYING, so a shell landing on the same frame as
  the win cannot overwrite the result.

## 2026-10-20 — Shells are telegraphed, and shake the camera but never the aim

- Chosen: a whistle 1.05 s before impact (`shellIncoming`), a 9.5 m falloff
  radius, velocity-led targeting, and camera-position shake only.
- Why: an untelegraphed explosion is a coin flip, not a decision. Leading with
  your velocity makes movement the answer (standing still is what gets you hit).
  Shaking the aim would mean the game randomly takes the shot you lined up;
  shaking the body sells the blast without stealing agency.
- Trade-off: a player who sprints in a straight line is still easy to lead.
  Strafing and using the terrain is the counterplay; if it feels unfair, widen
  the spread before reducing damage.

## 2026-10-20 — Objectives vary by sortie number, not by chapter only

- Context: The owner's complaint was that every level was the same four beats
  ("kill general etc., just repeated kills").
- Options: (a) keep one chain and vary counts; (b) write 50 bespoke missions;
  (c) eight reusable **plan shapes** composed from three objective types
  (kill / destroy / hold), selected deterministically by sortie number.
- Chosen: (c). `buildMissions(level, map)` in `data/missions.js`; sortie 1 stays
  the tutorial, 2–48 cycle eight plans, 49–50 run a four-objective finale.
- Why: 50 hand-written missions is content debt nobody can maintain; plan
  shapes multiplied by target counts and depth scaling give genuinely different
  play (elevated duel vs sabotage vs waiting) with one file to tune. Determinism
  keeps menu and round in agreement with no extra state.
- Trade-off: Plans repeat on an eight-sortie cycle. Counts and boss HP creep
  with depth, but a player may recognise the shape by sortie 10. Adding a ninth
  plan is the intended cheap extension.

## 2026-10-20 — Destructible crates are shot, not interacted with

- Chosen: Supply crates are world meshes with an `alive` flag. `round._pickCrate`
  ray-tests a 0.9 m sphere; a hit calls `world.breakCrate()` (hide mesh, drop a
  scorch disc) and `_recordDestroy('crate')`.
- Why: A sabotage objective that needs a key press would need a new input and a
  new animation. Shooting the thing you can already see is the mechanic the
  game already has, and it makes the scope useful on something that is not a man.
- Trade-off: Crates have no collision; walking through a camp is possible. Not
  worth a physics system for five boxes.

## 2026-10-20 — Enemies must visibly shoulder the rifle before firing

- Chosen: `setRiflePose(fig, held)` re-parents the same rifle from the back to
  the hands; `applyAiming` shoulders it, and the enemy faces the player. Muzzle
  flash + a pooled tracer line accompany each shot, and `enemyShot` carries the
  distance for a mixed rifle crack.
- Why: The previous build had aiming arms and a rifle still slung on the back —
  it read as a man waving at you while damage appeared from nowhere. The
  half-second shoulder-and-aim is also the player's warning to go to ground.
- Trade-off: A column keeps walking while it shoulders the rifle (the line still
  has to fall if ignored). This looks slightly stiff but preserves the pressure.

## 2026-10-20 — Watchtower guards are a kind, with platform `baseY`

- Chosen: `scene/world.js` builds two towers and returns `{x, z, y}` platform
  spots. `EnemyManager._add` stores `baseY`; every frame and every hit test uses
  it instead of `terrainHeight`. Tower/sniper speed is 0, alert starts high.
- Why: Elevation has to be real — a guard whose feet are on the snow but whose
  model is drawn 3.4 m up is a bug, and a chest hit test that ignores the
  platform makes elevated men unkillable. One `baseY` fixes both.
- Trade-off: Line of sight still ignores height (2D tree test). An elevated man
  can "see" through a trunk that would block a ground man; at these ranges it is
  invisible and cheaper than a 3D occlusion test.

## 2026-10-20 — Ammunition is a per-sortie trade-off, not an unlock

- Chosen: `data/ammo.js` — ball (baseline), AP (`bossDamage 2`, `radius 0.82`),
  match (`radius 1.32`). Free choice, persisted, read by the round.
- Why: The rifle choice changes feel; ammunition changes the plan. AP into a
  general sortie saves a hit at the cost of a narrower window; match into a
  patrol hunt widens it. None is a straight upgrade, so there is a reason to
  change the answer on a replay.
- Trade-off: AP one-shots a 2-hp officer — intentional, and the narrow window is
  the price. If it proves too strong, raise `bossDamage` cost (e.g. radius 0.7).

## 2026-10-20 — Button borders were killed by an ID selector

- Context: The owner asked for visible button borders; the menu had none.
- Root cause: `#ui button { border: none }` in `styles.css` outranked every
  `.btn`, `.map-card`, `.weapon-card` etc. border.
- Chosen: Remove the global border reset; each button class declares its own
  edge. `.btn-primary` and `.btn-deploy` carry an amber border; `.btn-step`
  ("Next") and the ammo/difficulty chips are bordered panels.
- Why: One ID rule was silently undoing the entire design system. Fix at the
  cause rather than adding `!important` per class.

## 2026-10-20 — A campaign ladder with one gate: winning

- Context: The owner asked for story/progression ("level 1 to 60 or 100, only
  proceed as you play/win"), plus difficulty choice.
- Options: (a) endless score-chase; (b) fifty sorties, five chapters, one gate —
  a win opens exactly one sortie; (c) chapters unlock per map completion.
- Chosen: (b). `data/campaign.js` derives each sortie's stakes from its number;
  `suomiProgress` stores the highest unlocked sortie; a loss replays the same
  number.
- Why: Deterministic numbering means the menu and the round can never disagree
  about what sortie 23 is. One-gate-one-sortie keeps the frontier always one
  game away — the classic retention shape — without content that only exists at
  high levels (all chapter places stay playable across the ladder). Skirmish
  gives replay a home at current stakes so the ladder isn't a cage.
- Trade-off: `suomiProgress` is client-local. If start.ng later wants account
  sync, that becomes a server value; nothing else changes.
- Retired: `suomiLevel`, which advanced on losses — a counter, not a ladder.

## 2026-10-20 — Difficulty is a multiplier, not a lock

- Chosen: Recruit/Regular/Veteran as {enemySpeed, noise, damage} multipliers
  applied to the map clone (pace) and in `Round` (shot exposure gain, damage
  taken). Never gates sorties.
- Why: The ladder's gate is winning; difficulty is about what evening you want.
  Locking "harder only if you grind" inverts that and punishes a good player
  having a bad night.

## 2026-10-20 — You may cross your own line (and the bread is out there)

- Context: The owner could not reach the bread — the clamp was
  `z ≥ LINE_Z + 4` while bread spawned at nominal z −70…−12.
- Options: (a) move bread into the safe band; (b) open the band to
  `z ∈ [LINE_Z − 60, 70]` so crossing the line is possible.
- Chosen: (b), plus bread pulled to z −54…−8. 
- Why: Cross-the-line foraging is exactly the stealth tension the game is about
  — patrols hunt there. Moving bread home would have fixed the symptom and kept
  the invisible wall.
- Trade-off: The player can now walk toward enemy spawn lanes; the −60 floor
  keeps them out of the columns' own corridor.

## 2026-10-20 — Hidden recovery beats bread-as-only-heal

- Chosen: slow clot (+1.6 hp/s) whenever stopped with exposure < 20; bread
  stays the fast +30.
- Why: The owner described the loop precisely: take a hit, break line of sight
  behind a rock/tree, come back. A progress bar that only moves via bread makes
  hiding feel passive; a slow bleed-back makes the hide itself the mechanic.

## 2026-10-20 — Wildlife is ambience, never targets

- Chosen: hares/reindeer/fox/raven rosters per map in `scene/animals.js`; they
  graze, wander near home, and flee rifle noise (55 m) or close approach
  (15 m). `round.fire()` calls `world.scare()`; scene code never decides when
  things are loud (layer rule).
- Why: An arctic forest with zero animal life reads as a menu screen. Scattering
  on the first shot is also stealth feedback — grass and animals tell you the
  forest heard it.
- Non-goal: shootable animals (off-brand for the subject matter), population
  density, or AI paths — "some random stuff in its natural habitat" is the brief.

## 2026-10-20 — The mission chain runs inside one round, not one objective per level

- Context: The owner asked for "levels or phases, like mission type", with each
  kill handing over a harder task (boss, general).
- Options considered: (a) one objective per level, results screen between them;
  (b) four escalating phases inside a single sortie; (c) both.
- Chosen: (b), per the owner's answer. `src/data/missions.js` holds the chain;
  `Round` counts kills per kind and advances.
- Why: A sortie already has a start, a climax and a results screen. Splitting the
  four beats across four results screens would break the tension every 90 seconds
  and make the boss feel like a separate game.
- Trade-off: Columns no longer end the round by themselves; `columnsLeft` is
  informational. Losing the line still costs health during later phases.
- Revisit if: the owner wants a "campaign" of many sorties rather than a chain
  inside each one.

## 2026-10-20 — Bosses take multiple hits and bring an escort

- Context: "Harder task like kill boss or general", with multi-hit chosen.
- Chosen: Officer 2 hits, general 3, both with two guards. Spawned by their phase,
  not placed on the map at load.
- Why: The hit test is a single chest sphere (`_pickTarget`); adding head/body
  zones would mean retuning `HIT_RADIUS` and every bracket promise. More hit
  points is the cheapest real difficulty, and the guards make the phase about
  position rather than about clicking three times.
- Trade-off: A wounded boss keeps walking; the callout must state the hits left or
  it reads as a broken hit test. `pickWoundLine` does that.
- Note: `spawnBoss` places the target inside `map.fog.far`; the lake's 110 m
  visibility otherwise makes a fixed 150 m spawn invisible.

## 2026-10-20 — Kill callouts are bilingual, mild, and drawn above the scope

- Context: The owner asked for kill comments ("hell yea got you", "perkele",
  "paska", "good headshot").
- Chosen: Short Finnish/English lines in `src/data/lines.js`, selected by rank,
  range and streak. Appended to `<body>` at `z-index: 35`.
- Why: The scope's surround is an opaque `box-shadow` on a circle inside `#ui`
  (z-index 10), so anything inside the HUD is invisible with the glass up — which
  is exactly when a kill happens.
- Tone: mild swearing only (perkele, paska, saatana), no slurs, no gore, no
  gloating over bodies. AGENTS.md still applies.
- Revisit if: the owner wants the lines voiced or localised.

## 2026-10-19 — SUPERSEDED: zoom was a narrowed view, not a telescopic scope

- The third pass chose (b): narrow the camera FOV and keep iron sights, so as not
  to contradict Häyhä's refusal of a scope.
- **Superseded in the fourth pass.** The owner explicitly asked: "ignore the old
  Simo gun, use actual new guns with a scope where I can zoom in and shoot
  targets." A real scope overlay and a first-person weapon now replace the iron
  sights. Do not re-litigate the historical constraint.

## 2026-10-19 — The weapon is a second render pass

- Context: A first-person rifle needs to sit close to the camera and must never
  clip into world geometry, but its own parts still need to occlude each other.
- Options considered: (a) model it in the world scene; (b) model it in the world
  scene with `depthTest: false`; (c) its own scene, own fixed-FOV camera, drawn
  after the world with `clearDepth()`.
- Chosen: (c), in `src/scene/weapon.js` and `WeaponView.render()`.
- Why: (a) clips through trees; (b) fixes that but draws the receiver through the
  stock. Two passes fixes both, and a fixed FOV stops the scope zoom from
  magnifying the stock.
- Trade-off: A second `renderer.render()` call per frame and a second set of
  lights. Cheap at this scene size.
- Revisit if: frame rate on a low-end phone becomes the priority.

## 2026-10-19 — Magnification is FOV, not an optical render target

- Context: ×4 and ×8 need to look like optics.
- Options considered: (a) a second render target / true optical zoom; (b) narrow
  the camera FOV and draw a DOM scope over it.
- Chosen: (b), with `ZOOM_LEVELS` in `main.js`.
- Why: A second scene render is expensive and invisible at these ranges. The FOV
  change plus a convincing glass overlay is what actually sells it.
- Trade-off: Sway and sensitivity must be scaled by the FOV or the scope becomes
  unusable and nauseating; both are handled in `main.js`.
- Revisit if: the owner wants true variable-power optics with a visible optical
  distortion.

## 2026-10-19 — CSS owns the canvas box

- Context: The owner reported the game sometimes painting into half the screen.
  `renderer.setSize(w, h)` writes inline pixel dimensions onto the canvas, which
  override the stylesheet; when they disagree with the viewport, the render fills
  only part of it.
- Chosen: `renderer.setSize(w, h, false)` so Three never touches the canvas CSS
  box, plus a `ResizeObserver` and `visualViewport` listener.
- Why: Makes the failure structurally impossible rather than reliant on a
  `resize` event firing at the right moment.
- Trade-off: The canvas must be given a CSS size; `#scene` is `position: fixed;
  inset: 0; width/height: 100%`. Do not remove that.
- Revisit if: never — this is the standard robust pattern.

## 2026-10-19 — Terrain is a pure function, not a stored heightmap

- Context: Adding relief means the mesh, camera, enemies, trees, props and bread
  must all agree on the surface height.
- Options considered: (a) a stored heightmap that one module owns and others
  query; (b) a closed-form `terrainHeight(x, z, map)` any module can call.
- Chosen: (b), in `src/scene/terrain.js`.
- Why: No owner, no synchronisation bug, and `game/` is allowed to import
  `scene/` under the project's layer rules.
- Trade-off: The terrain is deterministic from the seed, so hand-placing a
  specific landmark means choosing coordinates against the function.
- Revisit if: the terrain needs authored features a function cannot express.

## 2026-10-19 — The third-person camera keeps the aim orientation

- Context: The reticle must mark where the shot actually goes, and `round.fire()`
  fires along the camera's forward vector.
- Options considered: (a) `lookAt` the player (nice framing, dishonest reticle);
  (b) keep the aim orientation and offset the camera sideways; (c) no third
  person.
- Chosen: (b).
- Why: Reticle and shot stay consistent in both views.
- Trade-off: The player's body is not centred; it sits to the lower-left. When
  ground rises behind the player, the camera is pulled *in* rather than lifted, so
  the body does not drop out of frame.
- Revisit if: third-person aiming ever feels misaligned in play.

## 2026-10-19 — `fire()` fires while walking

- Context: `round.fire()` had `|| this.moving`, but `this.moving` was never
  assigned — the guard silently did nothing.
- Chosen: remove the guard rather than start enforcing it.
- Why: A click or a keypress that does nothing reads as a bug. Movement is already
  priced through the exposure economy.
- Revisit if: walking-fire becomes a dominant strategy.

## 2026-10-19 — One key, two jobs: `Shift` sprints and holds breath

- Context: The third pass used `Shift` for a held breath. A sprint needs a key,
  and the obvious one is `Shift`.
- Chosen: `Shift` sprints while moving and steadies while scoped, decided by the
  current state (`sprinting = shift && !aiming && !crouching`).
- Why: Both actions are "commit briefly"; one key avoids a new bind and never
  conflicts, because you are either moving or scoped.
- Trade-off: Slightly implicit. The controls crib on the menu says so.
- Revisit if: play-testing shows people expecting `Shift` to always sprint.

## 2026-10-19 — Movement accelerates; it does not teleport

- Context: The old model moved `x += direction * speed * dt`, so starting and
  stopping were instantaneous and the stride ran on a timer.
- Chosen: A velocity (`vx`, `vz`) lerped toward the desired gait, with
  `walkPhase` advanced by distance.
- Why: Weight is most of what makes movement read as a body rather than a camera;
  it also makes the rifle bob and footstep cadence honest.
- Trade-off: A short slide after releasing the keys, and a few tuning constants
  (`11` accelerating, `14` stopping).
- Revisit if: it feels floaty — raise the acceleration constants.

## 2026-10-19 — One hit radius decides both the shot and the bracket

- Context: The owner reported that firing did nothing. Aiming dead at a man always
  registered, so the problem was feedback, not detection — but there was also a
  real inconsistency: the bracket turned orange at a `miss < 0.5` m while the shot
  only connected inside `0.45` m, so "locked" did not guarantee a hit.
- Options considered: (a) two separate numbers, tuned to look right; (b) one
  constant, `HIT_RADIUS`, used by both, exposed to the UI as `probe().lethal`.
- Chosen: (b), `HIT_RADIUS = 0.6` in `game/round.js`.
- Why: The reticle must never promise a hit the rules won't give. Making the
  rules the only source of truth for "on target" means the two can't drift.
- Trade-off: `main.js` no longer computes the lock condition itself; it reads
  `probe().lethal`.
- Revisit if: the bracket starts turning orange too eagerly — lower `HIT_RADIUS`,
  and the bracket follows automatically.

## 2026-10-19 — Target acquisition is by angle, not by distance

- Context: `probe()` searched a fixed 2.4 m around the aim line. At the hip,
  breath sway alone is 1–2 m at 150 m, so the bracket flickered in and out at
  exactly the range where a player needs it most.
- Options considered: (a) raise the fixed radius; (b) a fixed *angular* window;
  (c) a radius that scales with range.
- Chosen: (c) — `min(6, max(2.2, t × 0.028))` metres, with `_pickTarget()`
  accepting a radius *or* a function of range.
- Why: What a player perceives as "I am on that man" is an angle, not a distance.
  A fixed number of metres means wildly different things at 60 m and 200 m.
- Trade-off: The bracket is generous at long range (~1.6° of slack). It is an
  acquisition aid only; lethality still uses the fixed world-space `HIT_RADIUS`.
- Revisit if: the bracket starts snapping to men you clearly are not aiming at.

## 2026-10-19 — A centre dot in first person, at the hip

- Context: The shot leaves the camera along the aim line, but the rifle view model
  is held at the hip — low and right of frame. A player has no way to infer the
  aim line from the rifle, and the reticle showed nothing at the hip at all.
- Chosen: Always show the centre dot; hide it under the scope, which draws its own
  centre. Show the bracket in every view, not only while aiming.
- Why: A shot fired with no reference reads as "the gun is broken" however
  correct the hit detection is.
- Trade-off: The HUD is slightly busier at the hip. Worth it.
- Revisit if: never remove the dot while the rifle is drawn off-axis.

## 2026-10-19 — A body falls; it does not blink out

- Context: `hit()` set `visible = false` immediately, so a successful shot had no
  visual confirmation beyond the hitmarker and the number in the HUD.
- Chosen: An eased topple about the man's own left-right axis, body left on the
  snow for 3.4 s. Requires `root.rotation.order = 'YXZ'` so the fall rotates about
  the soldier's own axis regardless of which way he faced.
- Why: A figure dropping is unambiguous in a way a vanished one never is.
- Trade-off: Dead bodies stay in the scene graph briefly; at these counts it is
  free.

## 2026-10-19 — Static sentries as a third enemy kind

- Context: Every enemy moved, so there was no stationary target to learn on.
- Chosen: `sentry`, 2 per map via `map.sentries`, standing posts between the
  player and the line, scanning a few degrees. They do not count toward
  `columnsLeft`, so they never block or end a round.
- Why: A new player needs one thing that holds still while they work out the
  scope, the bracket and the breath hold.
- Trade-off: They add to `enemies.alive`, so they are included in `hearShot` and
  `nearest` — intentional, they can shoot you.
- Revisit if: they make the early game too noisy; lower `map.sentries`.

## Open questions

- Should the default view be third person? The owner asked to *see* the character;
  it currently starts first person with `V` to pull back.
- Is ×8 too strong or too weak? It is a starting guess at 5.4°.
- Does the phone matter enough to justify touch movement? Magnification now has a
  button and `AIM` is a toggle, so the only remaining phone gap is walking.

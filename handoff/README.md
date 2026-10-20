# Suomi Sniper — Handoff

## Goal

Make **Suomi Sniper** a good game to actually play, for the owner and their
sister, on a laptop and on a phone. The owner's fifth-pass feedback:

> "Right-click and mouse just shoot nothing. What I actually want is to aim into
> the target through the sniper lens and shoot at it — moving or static targets.
> If possible I want close-to-human representations, not toys. But whatever, I
> just need a good player experience."

So: make firing obviously work and obviously connect; give the enemies a human
silhouette; give the player both moving and static targets.

## Deliverables

- [x] **Firing works and shows it works.** A centre dot in every view (including
      first person at the hip, where there was previously no reference at all),
      a target bracket that appears at the hip too, and one `HIT_RADIUS` (0.6 m)
      that decides both what a shot hits and when the bracket turns orange. A hit
      drops the man.
- [x] **Enemies with a human silhouette.** Helmet, face, neck, sloping shoulders,
      a greatcoat with a waist and a flared hem, belt, pouch, pack, gloved hands,
      boots with toe boxes, and a slung rifle — plus per-man colour variation.
- [x] **Moving and static targets.** Columns advance, patrols wander and hunt, and
      a new static `sentry` kind stands a post on every map.
- [x] **Touch zoom** (a phone has no wheel) and `AIM` changed from a hold to a tap
      toggle, so the other thumb can drag the view.
- [x] Half-screen bug fixed; scoped rifle view model; ×4/×8 optic; weighted
      movement and sprint; better forest. (Carried over from the fourth pass.)
- [x] **Docs** (`README.md`, `HANDOVER.md`, `AGENTS.md`) and this `handoff/`
      folder updated.

## Wave 9 (current) — owner feedback

> "the levels are still playing repeated activities kill general e.t.c just
> repeated kills and enemies, different level should have different objectives!
> ... the button after choosing a map should say next not just 'sortie choose
> your rifle' ... choose a rifle or ammunition with visible button borders ...
> Soldiers post can be on watchtower/towers too ... build camps in enemy map to
> look army camp type ... enemies should hold their own rifle and shoot at me
> when I'm sighted not just walk like some dumbo."

Delivered:

- [x] **Objectives vary by sortie.** Eight plans built from kill / destroy /
      hold objectives, chosen by sortie number; tutorial sortie 1 unchanged;
      finale 49–50 is four objectives.
- [x] **Watchtowers and army camp.** Tents, two timber towers with platform
      guards, supply crates, barrels, truck, flag, sandbags, camp fire.
- [x] **Enemies use their rifles.** They shoulder the weapon, face the player,
      muzzle flash, pooled tracers, distance-mixed crack, and real damage.
- [x] **Menu flow.** Step 1 CTA is **Next**; step 2 is rifle **and ammunition**;
      the deploy button is a wide, bordered **Deploy — Sortie N / place**.
- [x] **Visible borders on every control** — root cause was
      `#ui button { border: none }` outranking all class borders.
- [x] **Ammunition loadout** — ball / AP / match grade, persisted, with real
      trade-offs in the round.

Acceptance (met by script, `objectives.mjs`): plans differ across sorties 2–9;
sabotage counts and advances; two towers with guards 3.5 m up; a tower guard can
be shot; three crates destroyed by rifle fire; AP one-shots a 2-hp officer;
enemies shoulder rifles, fire and draw blood; no fatal bar.

## Wave 10 (current) — Paluu (The Return)

Owner green-light to build the recommended finale. Delivered:

- [x] **A real ending for every sortie.** `heat` (exposure > 50, shots, hits)
      decides whether you slip away clean or the camp answers.
- [x] **Under fire:** green flare, all enemies alerted, two hunters cutting the
      retreat, counter-battery shells led by your velocity with a one-second
      whistle warning, falloff damage and camera shake.
- [x] **Rendezvous:** smoke column 46–62 m behind you, green HUD pill with a
      bearing arrow and `FALL BACK — n m`.
- [x] **Results:** "Clean exit — the snow never told on you" or "You got out
      under fire", plus the fixed `breadFound` stat.
- [x] **Audio/visuals:** synth shell whistle and impact, flare, pooled
      flash/plume/crater, wildlife scattering from impacts.

Acceptance (met by script, `extraction.mjs`): quiet run wins clean and never
starts an extraction; loud run enters extraction with marker, hunters and HUD;
shellfire is scheduled; a direct shell drains blood; reaching the smoke wins
under fire; results have no undefined stats.

## Acceptance criteria

- `npm run build` completes with no errors. **Met.**
- The canvas exactly fills the viewport at 1280×800, 390×780, 1440×560, 700×900
  and 1920×1080, positioned at (0, 0), with the drawing buffer at
  size × device pixel ratio. **Met** (headless Chromium, scripted).
- All four maps load and play with zero console or page errors, and each spawns
  sentries plus its columns and patrols. **Met.**
- Aiming dead at a man and firing registers a kill, and the bracket is orange
  exactly for the shots that connect. **Met** (52–96 m, all four maps).
- The bracket appears at the hip on every map, with range and a scope hint.
  **Met.**
- A hit leaves the body visible, falls, and clears. **Met** (±1.45 rad, cleared
  after 3.4 s).
- The weapon shows at hip in first person, hides under the scope and in third
  person. **Met.**
- The scope window is centred and 76 vmin across; the wheel switches ×4/×8 and
  the camera settles at 10.5° / 5.4°. **Met.**
- Firing registers and kicks; walking ≈ 3.7 m/s, sprinting ≈ 6.0 m/s, releasing
  the keys decelerates. **Met.**
- Touch `AIM` toggles the scope and lights up; `ZOOM` cycles magnification; both
  work at 390×780. **Met.**
- **Not met / not testable by script:** whether it *feels* good on real hardware.
  That requires hand-play. See `STATUS.md`.

## Deadline

- None given. Delivered as a working increment.

## Constraints

- Stack: Vite + Three.js, vanilla JS, no framework, no test runner, no linter.
  Staying on the web stack is deliberate: it runs on any laptop or phone with no
  install and deploys to start.ng. Moving to a game engine would be a rewrite and
  would lose that.
- Procedural assets only — no binary files in `src/`. Every texture is drawn on a
  canvas, every sound is synthesised.
- Tone: winter atmosphere, generic infantry, no gore. The historical no-scope
  constraint is **superseded** at the owner's request — do not reintroduce it.
- Out of scope for this pass: touch **movement**, additional weapons, bullet
  wind, reload, prop collision, difficulty settings.

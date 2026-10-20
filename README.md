# Suomi Sniper

A stealth sniper game in a winter war. You are in a snow scrape with a scoped
rifle and a treeline. Columns of infantry are crossing toward the line you're
holding. Every shot you take stops a column and tells them roughly where you are.

Each sortie is its own operation. The first teaches the chain — sentries, column,
officer, general — and after that the objectives change with the sortie number:
silence watchtowers, break a supply dump apart with rifle fire, win a duel with an
enemy sniper, hunt a patrol, or stay hidden while a sweep passes. The men shoot
back once they have a firing solution, so the loop is fire, relocate, hide and
let the blood come back.

Before deploying you choose a rifle and a load: service ball, armour-piercing
(officers and generals fall in half the hits, at the cost of a narrower window)
or match grade (a wider hit window).

How you played decides how you leave. A quiet sortie ends with you vanishing
into the snow. A loud one does not end at the last kill: a flare goes up, the
camp turns hunter, and counter-battery shells walk toward your position. A green
smoke column marks the rendezvous. Reach it — or don't come back at all.

Built with Three.js. Runs entirely in the browser, no server, no dependencies at
runtime beyond the engine itself. Works on a laptop and on a phone.

## A note on the subject

The winter setting is atmosphere, not a reconstruction. The rifle is a modern
scoped bolt-action rather than the iron-sighted Mosin of the period — an earlier
build followed Simo Häyhä's refusal of a telescopic sight, and the owner asked
for a scope and modern optics instead, so that constraint is gone.

The enemies are generic infantry, there is no gore, and the game is about
staying unseen rather than about killing.

## Quick start

```bash
npm install
npm run dev
```

```bash
npm run build     # static output to dist/
npm run preview   # serve the build locally
```

Node 18 or newer.

## Controls

| Action | Mouse and keyboard | Touch |
| --- | --- | --- |
| Move | `W` `A` `S` `D` | — |
| Look | Move the mouse | Drag |
| Raise the scope | Hold right-click | Tap `AIM` (it stays up) |
| Magnification | Mouse wheel (while scoped) | `ZOOM` button |
| Fire | Click, or `Space` | Tap, or the `FIRE` button |
| Sprint / hold your breath | `Shift` | — |
| Crouch | Hold `C` or `Ctrl` | — |
| First / third person | `V` | — |
| Eat winter bread | `F` | — |
| Pause | `Esc` or `P` | The `II` button |

Clicking locks the mouse so the cursor can't reach the edge of the window, but
aiming works without it — you only need to lock if the edge gets in the way.
On the menu, `1`–`4` pick a map directly.

**`Shift` does whichever job fits the moment.** Standing still, it's a held
breath: the sway flattens and stamina drains. Moving, it's a sprint: much faster,
much louder, and it empties your breath quickly.

**Right-click raises the scope.** The rifle goes away, the glass fills the frame,
and the field of view drops to 4× (10.5°) or 8× (5.4°) with the wheel. Mouse
sensitivity scales with the zoom so the scope stays steerable. Inside the glass,
the bracket snaps onto whoever is under the crosshair and shows his range; it
turns orange when the shot is on him — the same number decides whether the shot
lands, so orange really does mean "this one connects". On a phone tap `AIM` to
bring the scope up (tap again to drop it), `ZOOM` to change magnification, and
`FIRE` to shoot.

**At the hip you get a centre dot, not a crosshair.** The rifle view model sits
low and to the right of frame and is not where the round goes; the dot is. The
bracket still finds a man under that line at any view, which is your cue to bring
the scope up.

**A man you hit goes down.** He topples over and lies on the snow for a few
seconds — that drop is the confirmation, not the number in the HUD. Two of the
figures on each map are sentries standing a post: they hold still, so they're the
thing to practise on.

**Every kill gets a line.** The shooter mutters to himself — Finnish and English,
picked by what the shot was: point-blank, a long one, a streak, or one of the two
officers. A boss who takes a round and stays up says how many he has left, so a
multi-hit target never reads as a bug.

**`V` changes the view.** First person puts the rifle in your hands and the glass
in front of your eye; third person pulls back over the shoulder so you can see
your man walking. The reticle marks where the shot goes in both.

## How it works

**Exposure is the game.** Firing spikes it. Walking spikes it more slowly.
Crouching roughly halves what moving costs you; sprinting costs more than a walk.
Standing still bleeds it away — faster in a blizzard, much slower in hard sun.
Past about 55 they have a firing solution and you start taking real damage; under
30 nothing is looking for you.

**Movement has weight.** You accelerate toward a speed instead of snapping to it,
the stride advances with distance rather than with time, and the rifle bobs in
your hands in step with the ground you're covering.

**Holding your breath** steadies the sway but drains stamina. Exhausted, the sway
worsens and you can barely walk.

**Bread** lies out in the open between you and the line, so collecting it means
walking toward the people who are looking for you. Walk over it to pick it up,
then `F` to eat. It restores health and a lot of stamina.

**Moving is the answer to being found.** A patrol will walk to where you fired
from; walk away and it arrives at empty snow. But walking raises exposure the
whole time, so the timing is the decision.

**The round runs on objectives.** A sortie is four phases: quiet the two sentries,
drop two men from the column, kill the officer (two hits, two guards), kill the
general (three hits, an escort, and he keeps moving). The HUD shows the live
objective and its count, and each new phase is announced on screen. Killing a
column early still counts when its phase opens; the chain skips straight past an
objective that is already satisfied.

**The round ends** when the general goes down, or when your health does. Columns
that reach the line still cost health after you have moved on from them, so the
early phases stay dangerous.

## The four maps

Weather is fixed per map: each place is meant to be remembered for its
conditions, and Kollaa in a blizzard would just be the frozen lake with trees.

| Map | Weather | The problem |
| --- | --- | --- |
| **Kollaa Forest** | Clear and still | Long sightlines for both sides |
| **Frozen Lake** | Blizzard | Almost invisible, almost blind, no cover at all |
| **Ruined Village** | Fog | Columns get close before you see them; broken walls break line of sight |
| **Snow Ridge** | Hard sun | Shoot at 200 m, but being seen is the whole risk |

## Signing in and the leaderboard

start.ng is the backend: it handles sign-in, the leaderboard and hosting.

You play as a **guest** until you sign in. start.ng's character rule is met with a
**profile card**: your start.ng character's face, their name and your `@account`,
top-left. Guests see the guest look and a sign-in button. (Third-person view also
puts your man in the snow, but that figure is generic winter kit, not the
platform character.)

Scores are saved to start.ng's shared leaderboard, ranked by enemies down and
then columns stopped. Guests can read the board but not post to it; that's the
platform's rule.

**Sign-in only works on the live address** at `*.start.ng`. Opened as a local
file the connect page stays silent, so the game reports you as a guest — which is
expected, not broken. The game plays fine either way.

## Deploying to start.ng

start.ng never runs your code or installs packages. It serves static files from
`dist/`, `build/`, `docs/` or `out/`, in that order.

```bash
npm run build
```

Commit `dist/` (and `public/`, if you use it) and push. The repo is
https://github.com/AbdKabeer1/suomi-sniper and the game is live at
https://suomi-sniper.start.ng. To re-publish from scratch:

```bash
curl -X POST https://api.start.ng/games/check \
  -H "Content-Type: application/json" \
  -d '{"repo_url":"https://github.com/AbdKabeer1/suomi-sniper"}'
```

Fix anything it reports, then `POST /games/publish` with the same body and open
the `approve_url` it returns. After that, pushing to the branch is enough —
start.ng updates the game by itself.

**Leaderboard keys must be lowercase snake_case.** `startng.json` uses `kills`
and `lines_held`; a camelCase key like `linesHeld` is rejected by validation.
The game keeps `linesHeld` internally and maps it at the API boundary.

The cover picture is generated by `tools/cover.html`: open it in a browser, click
Download, and save the result as `public/cover.png` so every build copies it into
`dist/`.

## Project structure

```
src/
  main.js               Renderer, cameras, views, scope, input, the frame loop
  styles.css            All interface, scope and reticle styling
  data/
    maps.js             The four maps: terrain, weather, hides, bread, props
    missions.js         The four-objective chain every sortie runs
    lines.js            Kill and wound callouts, picked by range/streak/rank
  scene/
    world.js            Sky, snow, terrain, forest, rocks, ruins, snowfall
    terrain.js          The ground height function every layer samples
    player.js           The player's own figure, for third person
    weapon.js           The first-person rifle, drawn in its own scene
    enemies.js          Soldiers, sentries/columns/patrols, the death fall, line of sight
  game/
    round.js            Exposure, stamina, health, movement, shooting, scoring
    audio.js            Synthesised rifle, wind, heartbeat
  services/
    startng.js          Sign-in, scores, leaderboard
  ui/
    screens.js          Menu, HUD, results
    reticle.js          The scope, aim bracket and range readout
tools/
  cover.html            Generates cover.png
startng.json            Leaderboard columns
```

## Design notes

**Why the rifle is a second render pass.** The weapon lives in its own scene, with
its own fixed-FOV camera, and is drawn after the world with the depth buffer
cleared. Modelled inside the world scene it would either clip through the tree
you're standing beside, or — with depth testing switched off to stop that —
draw its receiver straight through its own stock. Two passes fixes both, and the
fixed FOV means bringing the scope up doesn't magnify the stock.

**Why the scope is DOM.** Upright hairlines that alias into nothing at 8× are the
one thing an optic can't afford. Drawn in CSS they stay an exact pixel at any
resolution and any window shape, and the round window is one element with a
viewport-wide shadow rather than a mask to keep in sync.

**Why everything is procedural.** No models, no textures, no audio files. The
whole game is a few JS files, which is what makes it load quickly on a mobile
connection — and it suits a scene that is deliberately pared back.

**Why line of sight is checked against a tree list.** Two hundred instanced trees
have no individual objects to raycast against, so the tree positions are kept as
plain numbers and tested against the shot's line directly. It's cheaper and it's
the only thing that works with instancing.

**Why exposure decays differently per weather.** A blizzard hides you; hard sun
does the opposite. That single number is what makes the four maps feel different
rather than being four paint jobs.

**Why magnification is a field of view.** Two levels, 4× and 8×, implemented as
narrower cameras rather than a second render target. A true optical zoom would
cost a second scene render for a difference you cannot see at these ranges, and
the FOV change is what actually sells the glass. Sway is scaled by the zoom so
the picture settles instead of amplifying into noise, and look sensitivity scales
with it so the scope stays steerable.

**Why the canvas is sized by CSS, not by the renderer.** `renderer.setSize(w, h,
false)` deliberately leaves the canvas's CSS box alone. Without that third
argument Three writes inline pixel dimensions onto the canvas, which beat the
stylesheet — and the moment those pixels disagree with the viewport (a small
first window, a maximised one, a display swap) the game paints into one corner of
the screen. A `ResizeObserver` on the canvas plus `visualViewport` covers the
layout changes that never fire a window `resize`.

**Why the terrain is one shared function.** The ground mesh, the camera, the
enemies, the trees and the bread all need to agree on where the surface is.
Storing a heightmap somewhere would mean one owner and four consumers; a
closed-form `terrainHeight(x, z, map)` means nobody owns it and everybody can
sample it, and it can't drift out of sync.

**Why the third-person camera pulls in instead of lifting.** The camera keeps the
aim orientation so the reticle stays truthful. If the ground rises behind you,
lifting the camera along that fixed orientation drops the player out of the
bottom of the frame — so it shortens the distance instead.

## Licence

No licence file yet. Add one before making the repository public.

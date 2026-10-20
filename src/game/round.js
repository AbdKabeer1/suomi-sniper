import * as THREE from 'three';
import { EnemyManager } from '../scene/enemies.js';
import { PlayerFigure } from '../scene/player.js';
import { terrainHeight } from '../scene/terrain.js';
import { LINE_Z } from '../data/maps.js';
import { buildMissions } from '../data/missions.js';

// A round: hold the line without being found.
//
// The whole game is one tension. Shooting is how you stop the columns, and
// shooting is also the only thing that reliably gives you away. Everything
// else — moving, breathing, eating — is a way of managing that.

export const STATUS = {
  READY: 'ready',
  PLAYING: 'playing',
  WON: 'won',
  LOST: 'lost',
};

// How much noise one shot makes, and the radius within which it is heard.
const SHOT_LOUDNESS = 1;

// The radius around a man's chest that a shot counts as a hit. It is deliberately
// a little wider than a real torso: at 190 metres a 1.8 m figure is about half a
// degree tall, and asking a player to land inside a 0.3 m box through a screen is
// a test of mouse precision, not marksmanship. This same number decides both
// "will this shot land" and whether the target bracket turns orange, so the
// bracket can never promise a hit the rules won't give.
export const HIT_RADIUS = 0.6;

// Scratch vectors for the frame loop and the shot test. `update` runs every
// frame and `probe()` is called from it, so `new THREE.Vector*()` in those paths
// had the GC picking up dozens of short-lived objects a frame — the "skips" the
// player sees as an occasional dropped frame. Allocated once, reused forever.
const wishScratch = new THREE.Vector2();
const probeDirScratch = new THREE.Vector3();
const shotDirScratch = new THREE.Vector3();
const hitToScratch = new THREE.Vector3();
const hitPassScratch = new THREE.Vector3();
const extractionDirScratch = new THREE.Vector3();

// probe()'s acquisition cone widens with range. A module function, so the call
// site passes a stable reference instead of building a fresh arrow every frame.
function acquisitionRadius(t) {
  return Math.min(6, Math.max(2.2, t * 0.028));
}

// Exposure is a continuous signal; the thresholds that used to live here are
// now owned by the enemy layer (it decides when a man sees you) and by the
// hidden-recovery rule below. One number, one owner.

export class Round {
  constructor({ scene, map, world, camera, onEvent, weapon, difficulty, campaign, ammo }) {
    this.scene = scene;
    this.map = map;
    this.world = world;
    this.camera = camera;
    this.onEvent = onEvent || (() => {});
    // The rifle this sortie is fought with: magazine size and clip reload time
    // are rules, so they belong here, and main.js hands the choice in.
    this.weapon = weapon && weapon.mag ? weapon : { mag: 5, reloadTime: 2.8 };
    // Difficulty touches the rules, not the tools: it scales how loud moving is
    // (noise), how much a burst of enemy fire costs (damage), and the map's
    // enemySpeed is already folded in upstream. Defaults are Regular.
    this.difficulty = difficulty || { noise: 1, damage: 1 };
    // The campaign's stake in this round: which sortie it is, and how many
    // extra hits the bosses carry at this depth.
    this.campaign = campaign || { level: 1, bossHpBonus: 0 };
    // The round in the chamber. Ammunition changes what a hit is worth — a
    // wider window, or double damage on rank — without touching the rifle.
    this.ammo = ammo || { damage: 1, bossDamage: 1, radius: 1 };
    // One closure for the whole round, not one per frame.
    this._boundEnemyEvent = (event) => this._handleEnemyEvent(event);
  }

  start() {
    // Clear anything left from a previous round.
    if (this.enemies) {
      for (const e of this.enemies.enemies) this.scene.remove(e.fig.root);
    }
    if (this.breadItems) {
      for (const b of this.breadItems) this.scene.remove(b.mesh);
    }
    if (this.avatar) this.scene.remove(this.avatar.root);

    this.enemies = new EnemyManager(this.scene, this.map, this.world.treeSpots, this.world);
    // The player's own body. Hidden in first person, and the thing you steer in
    // third person. It carries the rifle this round is fought with — the choice
    // from the menu follows you into the world.
    this.avatar = new PlayerFigure(this.scene, this.weapon);
    this.avatar.setVisible(false);

    const spawn = this.map.hides[0];
    this.hideIndex = 0;
    this.player = {
      x: spawn.x,
      z: spawn.z,
      groundY: terrainHeight(spawn.x, spawn.z, this.map),
      // Facing the line, which is down -z.
      yaw: 0,
      exposure: 0,
      health: 100,
      stamina: 100,
      crouched: false,
      aiming: false,
      walkPhase: 0,
      speedNow: 0,
      // Ground velocity, so starting and stopping carry weight instead of
      // snapping. See update().
      vx: 0,
      vz: 0,
    };

    this.kills = 0;
    this.linesHeld = 0;
    this.linesLost = 0;
    this.shotsFired = 0;
    this.breadFound = 0;
    this.breadHeld = 0;
    this.elapsed = 0;

    // The magazine starts full. A sortie is long enough that a top-up is a
    // decision you make under fire at least once.
    this.mag = {
      size: this.weapon.mag,
      inMag: this.weapon.mag,
      // Seconds left while a clip is going in; 0 when not reloading.
      reloading: 0,
      reloadTime: this.weapon.reloadTime,
    };

    // Mission state is per sortie. `killsByKind` is cumulative so a man dropped
    // before his phase opens still counts toward it.
    this.killsByKind = {};
    this.missionIndex = 0;
    // The sortie's objectives, built from its number. Sortie 1 is the fixed
    // tutorial chain; every later sortie rotates through a different plan
    // (towers, sabotage, a sniper duel, a hold) instead of repeating it.
    this.missions = buildMissions(this.campaign.level || 1, this.map);
    this.missionElapsed = 0;
    this.destroyedByKind = {};
    this.streak = 0;
    this.lastKillAt = -99;

    // Paluu — the exit. `heat` measures how much the camp has your number: being
    // seen and staying seen brings the guns around; a shot from far away is
    // nearly free. When the objectives are done, heat decides whether you slip
    // away clean or have to run a barrage to the rendezvous.
    this.phase = 'objectives';
    this.heat = 0;
    this.extraction = null;
    this.shells = [];
    this.shellTimer = 0;
    this.clean = false;

    this.breathHold = 0;
    this.recoil = 0;
    this.hitMarker = 0;
    this.status = STATUS.PLAYING;

    this._scatterBread();

    this._emit('started', this.snapshot());
    this._beginMission();
  }

  // Bread on the ground, always out in the open between you and the line.
  //
  // It's placed forward rather than around you on purpose: collecting it means
  // walking toward the people who are looking for you, which turns eating from
  // a button press into a decision.
  _scatterBread() {
    this.breadItems = [];
    for (let i = 0; i < 6; i++) {
      const x = (Math.random() - 0.5) * 110;
      // Between the line and roughly 50 m into no-man's land — inside the
      // walkable band. Bread beyond an invisible wall is a broken promise; bread
      // among the patrols is a reason to go where you shouldn't.
      const z = -8 - Math.random() * 46;

      const gy = terrainHeight(x, z, this.map);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.2, 0.28),
        new THREE.MeshStandardMaterial({ color: 0xb07a3c, roughness: 0.85 })
      );
      mesh.position.set(x, gy + 0.16, z);
      mesh.castShadow = true;
      this.scene.add(mesh);

      // A small warm glow so a dark loaf in white snow is findable without
      // being a beacon that gives your position away.
      const glow = new THREE.PointLight(0xe0a33c, 1.6, 7, 2);
      glow.position.set(x, gy + 0.9, z);
      this.scene.add(glow);
      mesh.userData.glow = glow;

      this.breadItems.push({ x, z, mesh, taken: false });
    }
  }

  snapshot() {
    return {
      kills: this.kills,
      linesHeld: this.linesHeld,
      linesLost: this.linesLost,
      shotsFired: this.shotsFired,
      breadHeld: this.breadHeld,
      breadFound: this.breadFound,
      exposure: this.player.exposure,
      health: this.player.health,
      stamina: this.player.stamina,
      hideIndex: this.hideIndex,
      level: this.level,
      // Which mag state the HUD prints: rounds in the rifle, and where the clip
      // is if one is going in (0..1).
      ammo: this.mag ? { inMag: this.mag.inMag, size: this.mag.size, reloading: this.mag.reloading > 0 } : null,
      columnsLeft: this.enemies ? this.enemies.enemies.filter((e) => e.kind === 'column' && e.alive).length : 0,
      // The HUD shows the live objective; null once the chain is finished.
      mission: this._missionState(),
      // Paluu state. The extraction object carries the distance and the bearing
      // relative to where the camera is looking, so the HUD arrow can point at
      // the smoke without the UI knowing anything about angles.
      phase: this.phase,
      heat: this.heat,
      extraction:
        this.phase === 'extraction' && this.extraction ? this._extractionState() : null,
    };
  }

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  // Behind the scope and holding your breath steadies the shot. It costs
  // stamina, so a long wait is a real decision rather than a free accuracy buff.
  setBreathHold(holding) {
    this.wantBreath = holding;
  }

  // First person hides the body; third person wants it.
  setAvatarVisible(on) {
    if (this.avatar) this.avatar.setVisible(on);
  }

  fire() {
    if (this.status !== STATUS.PLAYING) return false;

    // The bolt rifle's two reasons not to fire. Both are honest failures — the
    // trigger works, the rifle doesn't — and both click instead of bang.
    if (this.mag.reloading > 0) {
      this._emit('empty', { reloading: true });
      return { blocked: 'reloading' };
    }
    if (this.mag.inMag <= 0) {
      this._emit('empty', { reloading: false });
      return { blocked: 'empty' };
    }
    this.mag.inMag -= 1;

    this.shotsFired += 1;
    this.recoil = 1;

    const dir = shotDirScratch;
    this.camera.getWorldDirection(dir);
    const origin = this.camera.position;

    const target = this._pickTarget(origin, dir);
    // Supply crates are real targets, not scenery: a shot that passes within a
    // crate's radius breaks it, unless a man is standing nearer along the ray.
    const crate = this._pickCrate(origin, dir);
    const hitCrate = crate && (!target || crate.distance < target.distance);

    if (hitCrate) {
      this.world.breakCrate(crate.crate);
      this._recordDestroy('crate');
      this.hitMarker = 0.6;
    } else if (target) {
      // Ammunition decides what a hit is worth: AP doubles damage on rank, ball
      // and match hit a man the same. The figure only takes the number.
      const damage = target.enemy.rank ? this.ammo.bossDamage : this.ammo.damage;
      const result = this.enemies.hit(target.enemy, damage);
      this.hitMarker = 0.6;

      if (result.down) {
        this._recordKill(target.enemy, target.distance);
      } else {
        // A wound is its own event: the hitmarker confirms the shot, but the man
        // is still standing and the objective has not moved.
        this._emit('wound', {
          kind: target.enemy.kind,
          rank: target.enemy.rank,
          remaining: result.remaining,
          distance: target.distance,
        });
      }
    } else {
      this._emit('miss', {});
    }

    // The cost. Everyone in earshot now knows roughly where the shot came from,
    // and the exposure spike is what turns a clean position into a hunted one.
    // Difficulty scales the spike — a Recruit gets forgiven half of it, a
    // Veteran pays extra.
    this.enemies.hearShot(this.player, SHOT_LOUDNESS);

    // Wildlife clears out: a rifle crack is the loudest thing in the forest.
    if (this.world && this.world.scare) this.world.scare(this.player.x, this.player.z);

    const near = this.enemies.nearest(this.player.x, this.player.z);
    const closeness = THREE.MathUtils.clamp(1 - near.distance / 190, 0, 1);
    this.player.exposure = Math.min(
      100,
      this.player.exposure + (22 + closeness * 34) * (this.difficulty.noise || 1)
    );
    this.player.stamina = Math.max(0, this.player.stamina - 4);

    // A shot is heat, but only a little: it tells them a shot happened, not
    // exactly where you are. Staying seen is what really cooks you.
    this.heat = Math.min(1, this.heat + 0.05);

    // Protocol: `false` = round not in play, `{ blocked }` = rifle refused, and
    // `{ fired }` covers everything after — hit or miss, a round went out. A
    // plain `false` for a miss conflated "fired" with "couldn't fire" and made
    // the bolt gate treat misses as free shots.
    return { fired: true, target: Boolean(target) };
  }

  // The old hide-to-hide walk used to live here. Movement is free now, handled
  // in update() from the input main.js pushes in.

  // Reload with a stripper clip. Only deliverable when not already reloading
  // and not full; the taking-your-time part is the weapon's reloadTime, ticked
  // down in update().
  reload() {
    if (this.status !== STATUS.PLAYING) return false;
    if (this.mag.reloading > 0) return false;
    if (this.mag.inMag >= this.mag.size) return false;

    this.mag.reloading = this.mag.reloadTime;
    this._emit('reloadStart', { ...this.mag });
    return true;
  }

  _tickReload(dt) {
    if (this.mag.reloading <= 0) return;
    this.mag.reloading = Math.max(0, this.mag.reloading - dt);
    if (this.mag.reloading === 0) {
      this.mag.inMag = this.mag.size;
      this._emit('reloaded', { ...this.mag });
    }
  }

  // Winter bread. Restores what the cold and the walking have taken.
  eat() {    if (this.status !== STATUS.PLAYING || this.breadHeld <= 0) return false;

    this.breadHeld -= 1;
    this.player.health = Math.min(100, this.player.health + 30);
    this.player.stamina = Math.min(100, this.player.stamina + 55);
    this._emit('ate', this.snapshot());
    return true;
  }

  // main.js pushes the current input each frame before calling update().
  setInput(input) {
    this.input = input;
  }

  // What the shot is currently on, if anything. The HUD uses this to draw the
  // target bracket and range; `miss` is how far the aim line passes from the
  // man's chest, and `lethal` says whether a shot pulled right now would land.
  //
  // Acquisition is by angle, not by distance. A fixed number of metres means
  // wildly different things at 60 m and 200 m, and what the player perceives as
  // "I am on that man" does not change with range — so the window widens with
  // distance to hold a roughly constant slice of the view.
  probe() {
    if (this.status !== STATUS.PLAYING) return null;
    this.camera.getWorldDirection(probeDirScratch);
    return this._pickTarget(this.camera.position, probeDirScratch, acquisitionRadius);
  }

  // -------------------------------------------------------------------------
  // Per-frame
  // -------------------------------------------------------------------------

  update(dt) {
    if (this.status !== STATUS.PLAYING) return;

    this.elapsed += dt;
    this.recoil = Math.max(0, this.recoil - dt * 3.5);
    this.hitMarker = Math.max(0, this.hitMarker - dt);
    this._tickReload(dt);

    const p = this.player;
    const input = this.input || { fwd: 0, strafe: 0, crouch: false };
    p.crouched = Boolean(input.crouch);
    p.aiming = Boolean(input.aiming);

    // ---- Movement ----
    // Free walking. You're uphill of the line and can go where you like, but
    // everything you do up here is visible, so moving is always a cost.
    const wish = wishScratch.set(input.strafe, input.fwd);
    const wants = wish.lengthSq() > 0.01;
    if (wants) wish.normalize();

    // Which gait. Exhausted, you can barely walk; sighted in, you shuffle; a
    // sprint costs the most breath and makes the most noise.
    const canSprint = Boolean(input.sprint) && !p.crouched && !p.aiming && p.stamina > 3;
    let target = 0;
    if (wants) {
      if (p.aiming) target = 1.5;
      else if (p.crouched) target = 1.8;
      else if (canSprint) target = 6.0 * this.level;
      else target = 3.7 * this.level;
      if (p.stamina < 20) target *= 0.6;
    }

    // Movement is relative to where you're looking.
    const sin = Math.sin(p.yaw);
    const cos = Math.cos(p.yaw);
    const dirX = wants ? wish.x * cos - wish.y * sin : 0;
    const dirZ = wants ? -wish.x * sin - wish.y * cos : 0;

    // Accelerate toward the desired velocity. The time constant is short — this
    // is weight, not delay — and letting go decelerates along the same curve,
    // which is what makes a stop look like a stop rather than a freeze.
    const k = Math.min(1, dt * (wants ? 11 : 14));
    p.vx += (dirX * target - p.vx) * k;
    p.vz += (dirZ * target - p.vz) * k;

    p.x += p.vx * dt;
    p.z += p.vz * dt;

    const speed = Math.hypot(p.vx, p.vz);
    p.speedNow = speed;
    // "Moving" means actually covering ground, including the moment after you
    // release the keys. Exposure, footsteps and breath holding all key off this
    // rather than off the keys, so stopping costs what stopping costs.
    const moving = speed > 0.35;
    this.moving = moving;

    // Walk phase advances with distance rather than with time, so the stride
    // never slides out from under the feet.
    p.walkPhase += dt * (2.4 + speed * 1.05);

    // Stamina: a sprint empties it, a shuffle barely touches it, and standing
    // still is how you get it back.
    if (canSprint && moving) {
      p.stamina = Math.max(0, p.stamina - dt * 7);
    } else if (moving) {
      p.stamina = Math.max(0, p.stamina - dt * (p.crouched ? 1.2 : 2.6));
    } else {
      p.stamina = Math.min(100, p.stamina + dt * 6);
    }

    // Stay inside the map, and stay behind the line you're holding.
    // Bounds. Crossing your own line into no-man's land is allowed — that is
    // where the bread lies and where the patrols hunt, so reaching it is a
    // decision, not a bug. The floor keeps you out of the enemy's spawn columns
    // without an invisible wall that eats a wandering player's momentum.
    p.x = THREE.MathUtils.clamp(p.x, -130, 130);
    p.z = THREE.MathUtils.clamp(p.z, LINE_Z - 60, 70);

    // The ground moves under you; everything that sits on it reads this.
    p.groundY = terrainHeight(p.x, p.z, this.map);

    // ---- Bread ----
    // Collected by walking over it. Nothing to press — the cost is the walk.
    for (const b of this.breadItems) {
      if (b.taken) continue;
      if (Math.hypot(b.x - p.x, b.z - p.z) < 2.2) {
        b.taken = true;
        this.scene.remove(b.mesh);
        if (b.mesh.userData.glow) this.scene.remove(b.mesh.userData.glow);
        this.breadFound += 1;
        this.breadHeld += 1;
        this._emit('bread', { held: this.breadHeld });
      }
    }

    // ---- Breathing ----
    // Holding steady costs stamina and only works while it lasts.
    const canHold = this.wantBreath && p.stamina > 5 && !this.moving;
    this.breathHold = THREE.MathUtils.clamp(
      this.breathHold + (canHold ? dt * 4 : -dt * 5),
      0,
      1
    );
    if (canHold) p.stamina = Math.max(0, p.stamina - dt * 9);

    // ---- Exposure ----
    // Stillness is the only thing that makes you safe. How fast you fade back
    // into the snow depends on the weather: a blizzard hides you, hard sun does
    // the opposite.
    const weatherDecay =
      this.map.weather === 'blizzard' ? 26 : this.map.weather === 'fog' ? 20 : 14;

    if (!moving) {
      p.exposure = Math.max(0, p.exposure - dt * weatherDecay);
    } else {
      // Walking is the loudest thing you can do that isn't a rifle. Crouching
      // roughly halves it, at the cost of moving like a man wading; a sprint
      // throws the caution away and then some.
      const noise = p.crouched ? 7 : canSprint ? 26 : 16;
      p.exposure = Math.min(100, p.exposure + dt * noise);
    }

    // Enemies nearby and looking at you push it back up.
    for (const e of this.enemies.alive) {
      const d = Math.hypot(e.x - p.x, e.z - p.z);
      if (d > 120) continue;
      const closeness = 1 - d / 120;
      e.alert = Math.min(1, e.alert + dt * closeness * 0.06);
    }

    // ---- Recovery ----
    // Blood only comes back when you are small, still and unfound. Bread is the
    // deliberate heal; this is the slow clot that makes hiding behind a rock
    // after taking a hit the right answer instead of sitting there dying.
    // Any exposure above near-quiet (someone is looking for you) stops it.
    if (!moving && p.exposure < 20 && p.health < 100) {
      p.health = Math.min(100, p.health + dt * 1.6);
    }

    // ---- Heat ----
    // How much the camp has your number. Exposure above 50 means somebody is
    // actively looking at you; that is what brings the guns around. A quiet
    // player who fires from range and disappears never heats up much.
    if (this.phase === 'objectives') {
      if (p.exposure > 50) this.heat = Math.min(1, this.heat + dt * 0.22);
      else if (p.exposure < 20) this.heat = Math.max(0, this.heat - dt * 0.02);
    }

    // ---- The player's body ----
    if (this.avatar) {
      this.avatar.update({
        x: p.x,
        z: p.z,
        yaw: p.yaw,
        phase: p.walkPhase,
        moving,
        crouched: p.crouched,
        aiming: p.aiming,
        groundY: p.groundY,
        speed: p.speedNow,
        dt,
      });
    }

    // ---- Enemies ----
    this.enemies.update(dt, p, this._boundEnemyEvent);

    // ---- Paluu: the run home ----
    if (this.phase === 'extraction') this._updateExtraction(dt);

    // ---- Hold objectives ----
    // Time is the objective. Staying hidden is the win condition, which makes
    // this the one mission that rewards doing nothing at all.
    const mission = this._currentMission();
    if (mission && mission.type === 'hold') {
      this.missionElapsed += dt;
      if (this.missionElapsed >= mission.seconds) this._advanceMissions();
    }

    // ---- Round end ----
    // Winning is no longer "the column is empty" — the mission chain decides.
    // Columns that reach the line still cost health, which is what keeps the
    // early phases dangerous after you have moved on from them.
    if (this.status === STATUS.PLAYING && p.health <= 0) {
      this.linesHeld = this.map.columns - this.linesLost;
      this.status = STATUS.LOST;
      this._emit('over', { won: false, ...this.snapshot() });
    }
  }

  _handleEnemyEvent(event) {
    const p = this.player;
    if (event.type === 'lineBreached') {
      this.linesLost += 1;
      // Losing the line costs you, but it doesn't end the round on its own —
      // you can still hold what's left.
      p.health = Math.max(0, p.health - 18);
      this.heat = Math.min(1, this.heat + 0.1);
      this._emit('breach', this.snapshot());
    } else if (event.type === 'shotAtPlayer') {
      // The shot is audible whether it lands or not — a crack and a whizz are
      // the difference between "they see me" and "they are shooting at me".
      this._emit('enemyShot', {
        distance: event.distance,
        from: event.from,
        kind: event.kind,
        sniper: Boolean(event.sniper),
        hit: event.damage > 0,
      });

      // The enemy decided whether the round hit — range, target movement and
      // crouching are already in that number. Re-checking exposure here made a
      // sniper's hit at 40 exposure a "near miss" even though he fired it with a
      // scope; the men only fire when they can see you.
      if (event.damage > 0) {
        const dmg = event.damage * (this.difficulty.damage || 1);
        p.health = Math.max(0, p.health - dmg);
        // Taking hits means they are not guessing any more.
        this.heat = Math.min(1, this.heat + 0.08);
        this._emit('hurt', { damage: dmg, health: p.health });
      } else {
        this._emit('nearMiss', {});
      }
    }
  }

  // -------------------------------------------------------------------------
  // Hit detection
  // -------------------------------------------------------------------------

  // The nearest enemy whose body the shot passes within a hand's width of. Done
  // against positions rather than meshes: the soldiers are built from dozens of
  // small parts and raycasting every one of them would cost far more than this
  // needs to.
  //
  // `radius` is metres, or a function of range in metres. The function form is
  // how `probe()` acquires by angle. The shot itself always uses HIT_RADIUS, so
  // what counts as a hit never depends on how the bracket was drawn.
  _pickTarget(origin, dir, radius = HIT_RADIUS) {
    let best = null;
    let bestT = Infinity;

    for (const e of this.enemies.alive) {
      // Scratch vectors: `update()` calls `probe()` every frame, so the old
      // per-call allocations were 2–3 objects per living man per frame.
      hitToScratch.set(e.x, (e.baseY ?? terrainHeight(e.x, e.z, this.map)) + 1.15, e.z).sub(origin);
      const t = hitToScratch.dot(dir);
      if (t < 0 || t > 400) continue;

      // |dir·t − (chest − origin)| is exactly the miss distance, without ever
      // materialising the closest point or the chest itself.
      const miss = hitPassScratch.copy(dir).multiplyScalar(t).sub(hitToScratch).length();
      const reach = typeof radius === 'function' ? radius(t) : radius;

      if (miss < reach && t < bestT) {
        bestT = t;
        best = { enemy: e, distance: t, miss, lethal: miss < HIT_RADIUS * this.ammo.radius };
      }
    }

    return best;
  }

  // The nearest supply crate along the aim line. Crates are boxes, not men:
  // testing against the crate's centre with a generous radius is enough to make
  // them feel solid without reconstructing their geometry for a ray test.
  _pickCrate(origin, dir) {
    const crates = (this.world && this.world.camp && this.world.camp.crates) || [];
    let best = null;

    for (const crate of crates) {
      if (!crate.alive) continue;

      const ox = crate.mesh.position.x - origin.x;
      const oy = crate.mesh.position.y - origin.y;
      const oz = crate.mesh.position.z - origin.z;
      const t = ox * dir.x + oy * dir.y + oz * dir.z;
      if (t < 2 || t > 400) continue;

      const miss = Math.hypot(
        crate.mesh.position.x - (origin.x + dir.x * t),
        crate.mesh.position.y - (origin.y + dir.y * t),
        crate.mesh.position.z - (origin.z + dir.z * t)
      );

      if (miss < 0.9 && (!best || t < best.distance)) best = { crate, distance: t };
    }

    return best;
  }

  // -------------------------------------------------------------------------
  // Paluu — the return
  // -------------------------------------------------------------------------

  _extractionState() {
    const p = this.player;
    const dx = this.extraction.x - p.x;
    const dz = this.extraction.z - p.z;
    const distance = Math.hypot(dx, dz);

    this.camera.getWorldDirection(extractionDirScratch);
    const camYaw = Math.atan2(extractionDirScratch.x, -extractionDirScratch.z);
    const targetYaw = Math.atan2(dx, -dz);
    // Shortest signed angle from where you look to where you need to go.
    const relative = Math.atan2(
      Math.sin(targetYaw - camYaw),
      Math.cos(targetYaw - camYaw)
    );

    return { active: true, distance, relative, radius: this.extraction.radius };
  }

  // The last objective is down. How the sortie was played decides the ending:
  // a quiet run disappears, a loud one has to run the guns.
  _finishObjectives() {
    // Sortie 1 is the tutorial. Its win is always the clean exit — the barrage
    // cannot be allowed to eat the lesson (and the only win a new player has
    // seen) before they have played the loop once.
    const tutorial = (this.campaign.level || 1) === 1;
    const threshold = tutorial ? 1.1 : 0.55;

    if (this.heat >= threshold) {
      this._beginExtraction();
    } else {
      this._win({ clean: true });
    }
  }

  _beginExtraction() {
    const p = this.player;
    this.phase = 'extraction';

    // The rendezvous is 46–62 m roughly behind you, toward home: far enough to
    // be a run, close enough that a sprint and a bread can get you there.
    const spread = (Math.random() - 0.5) * 1.15;
    const dist = 46 + Math.random() * 16;
    let x = THREE.MathUtils.clamp(p.x + Math.sin(spread) * dist, -120, 120);
    let z = THREE.MathUtils.clamp(p.z + Math.cos(spread) * dist, -55, 68);

    // A player already near the back edge would get a ten-metre "run"; if the
    // clamp ate the distance, slide the rendezvous sideways instead so the
    // finale is always a real crossing.
    if (Math.hypot(x - p.x, z - p.z) < 38) {
      const lateral = p.x >= 0 ? -1 : 1;
      x = THREE.MathUtils.clamp(p.x + lateral * 46, -120, 120);
      z = THREE.MathUtils.clamp(p.z + 16, -55, 68);
    }

    this.extraction = { x, z, radius: 7 };

    // Everyone who heard the last shot now knows the area, and two men are
    // pushed out to cut the line of retreat.
    this.enemies.alarm();
    this.enemies.spawnHunters(p.x, p.z, 2);

    this.shellTimer = 2.2;
    this.shells = [];

    this._emit('extraction', {
      x,
      z,
      distance: Math.hypot(x - p.x, z - p.z),
    });
  }

  _updateExtraction(dt) {
    const p = this.player;

    // The smoke is the finish line. Seven metres is forgiving — a shell can
    // knock you sideways on the last step and it should still count.
    if (Math.hypot(this.extraction.x - p.x, this.extraction.z - p.z) < this.extraction.radius) {
      this._win({ clean: false });
      return;
    }

    // Counter-battery fire walks toward where you were a moment ago. The shell
    // is aimed with a lead from your velocity, so standing still is what gets
    // you hit; the whistle is the warning, the crater is the argument.
    this.shellTimer -= dt;
    if (this.shellTimer <= 0) {
      const lead = 0.55;
      const spread = 6.5;
      const sx = THREE.MathUtils.clamp(
        p.x + p.vx * lead + (Math.random() - 0.5) * spread,
        -130,
        130
      );
      const sz = THREE.MathUtils.clamp(
        p.z + p.vz * lead + (Math.random() - 0.5) * spread,
        -60,
        70
      );
      this.shells.push({ x: sx, z: sz, t: 1.05, radius: 9.5, damage: 34 });
      this._emit('shellIncoming', {
        x: sx,
        z: sz,
        distance: Math.hypot(sx - p.x, sz - p.z),
      });
      // Veteran brings the guns around faster; recruit gives you a breath more.
      const pace = 0.62 + (this.difficulty.damage || 1) * 0.3;
      this.shellTimer = (1.8 + Math.random() * 1.0) / pace;
    }

    for (let i = this.shells.length - 1; i >= 0; i--) {
      const shell = this.shells[i];
      shell.t -= dt;
      if (shell.t > 0) continue;
      this.shells.splice(i, 1);

      const d = Math.hypot(p.x - shell.x, p.z - shell.z);
      const falloff = Math.max(0, 1 - d / shell.radius);
      if (falloff > 0) {
        const dmg = shell.damage * falloff * (this.difficulty.damage || 1);
        p.health = Math.max(0, p.health - dmg);
        this._emit('hurt', { damage: dmg, health: p.health });
      }
      this._emit('shellImpact', {
        x: shell.x,
        z: shell.z,
        radius: shell.radius,
        distance: d,
      });
      if (this.world && this.world.scare) this.world.scare(shell.x, shell.z);
    }
  }

  // -------------------------------------------------------------------------
  // Missions
  // -------------------------------------------------------------------------

  _currentMission() {
    return (this.missions && this.missions[this.missionIndex]) || null;
  }

  _missionState() {
    const mission = this._currentMission();
    if (!mission) return null;

    let progress = 0;
    let total = 1;

    if (mission.type === 'destroy') {
      total = mission.target;
      progress = (this.destroyedByKind && this.destroyedByKind[mission.kind]) || 0;
    } else if (mission.type === 'hold') {
      total = mission.seconds;
      progress = Math.floor(this.missionElapsed || 0);
    } else {
      total = typeof mission.target === 'function' ? mission.target(this.map) : mission.target;
      progress = (this.killsByKind && this.killsByKind[mission.kind]) || 0;
    }

    return {
      id: mission.id,
      type: mission.type || 'kill',
      title: mission.title,
      brief: mission.brief,
      progress: Math.min(total, progress),
      total,
    };
  }

  _beginMission() {
    const mission = this._currentMission();
    if (!mission) return;

    // Hold objectives count from the moment they open, and only then.
    this.missionElapsed = 0;

    // Bosses are spawned by the phase that needs them. This is why the officer
    // is not on the map from the first second: he is the answer to finishing
    // the earlier objectives, not another man in the treeline. Deeper sorties
    // harden the bosses by a hit or two (see data/campaign.js); a sniper spawns
    // on the watchtower instead of in the snow.
    if (mission.spawn && this.enemies) {
      const bonus = (this.campaign && this.campaign.bossHpBonus) || 0;
      this.enemies.spawnBoss({ ...mission.spawn, health: mission.spawn.health + bonus });
    }

    this._emit('mission', { index: this.missionIndex, ...this._missionState() });
  }

  _recordKill(enemy, distance) {
    this.kills += 1;

    const kind = enemy.kind;
    this.killsByKind = this.killsByKind || {};
    this.killsByKind[kind] = (this.killsByKind[kind] || 0) + 1;

    // A streak is kills close enough together to read as one burst of shooting
    // rather than a slow afternoon. Five seconds is roughly the time it takes to
    // re-acquire after the recoil settles.
    this.streak = this.elapsed - this.lastKillAt <= 5 ? this.streak + 1 : 1;
    this.lastKillAt = this.elapsed;

    this._emit('hit', {
      kind,
      rank: enemy.rank || null,
      distance,
      kills: this.kills,
      streak: this.streak,
    });

    this._advanceMissions();
  }

  // A crate is not a man, but it advances the objective just like one.
  _recordDestroy(kind) {
    this.destroyedByKind = this.destroyedByKind || {};
    this.destroyedByKind[kind] = (this.destroyedByKind[kind] || 0) + 1;
    this._emit('destroy', { kind, destroyed: this.destroyedByKind[kind] });
    this._advanceMissions();
  }

  _advanceMissions() {
    // A loop, not an if: killing a column during the sentry phase can leave the
    // next objective already satisfied, and the chain should skip straight past
    // it rather than asking for a man who is already down.
    let guard = 0;
    while (this.missionIndex < this.missions.length && guard <= this.missions.length) {
      guard += 1;
      const state = this._missionState();
      if (!state || state.progress < state.total) return;

      const done = this.missions[this.missionIndex];
      this.missionIndex += 1;
      this._emit('missionDone', { id: done.id, title: done.title });

      if (this.missionIndex >= this.missions.length) {
        this._finishObjectives();
        return;
      }

      this._beginMission();
    }
  }

  _win(options = {}) {
    if (this.status !== STATUS.PLAYING) return;
    this.linesHeld = Math.max(0, this.map.columns - this.linesLost);
    this.status = STATUS.WON;
    this.clean = Boolean(options.clean);
    this._emit('over', {
      won: true,
      clean: this.clean,
      heat: this.heat,
      ...this.snapshot(),
    });
  }

  _emit(type, data) {
    this.onEvent({ type, ...data });
  }
}

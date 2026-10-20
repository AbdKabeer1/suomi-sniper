import * as THREE from 'three';
import { LINE_Z, SPAWN_Z } from '../data/maps.js';
import { terrainHeight } from './terrain.js';

// The opposition.
//
// Two kinds, and the difference matters tactically: a **column** walks straight
// at the line you're holding and will not stop for anything, and a **patrol**
// wanders until it hears a shot and then comes looking for you. Shooting a
// column is urgent; shooting a patrol is what gets you found.

const HIP_Y = 0.92;
const THIGH = 0.45;
const SHIN = 0.39;

// Walking speed, relative to the map's base. A column presses on; an officer
// advances deliberately; a general holds back and shifts his ground; guards sit
// between the two.
const SPEED_FACTOR = {
  column: 1,
  officer: 0.62,
  general: 0.5,
  guard: 0.8,
  patrol: 0.75,
  sentry: 0.75,
  // Men on a tower platform do not walk. A sniper picks his ground and stays.
  tower: 0,
  sniper: 0,
};

function mat(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
}

function limb(color, length, radius) {
  const group = new THREE.Group();
  const m = mat(color);
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.88, length, 6), m);
  cyl.position.y = -length / 2;
  cyl.castShadow = true;
  group.add(cyl);
  group.add(new THREE.Mesh(new THREE.SphereGeometry(radius, 6, 5), m));
  return group;
}

// A line infantryman in a winter greatcoat and steel helmet.
//
// These are seen between 60 and 250 metres, which is a long way of saying that
// the silhouette is the whole model: shoulders, helmet, coat hem and a rifle
// across the chest have to read at a glance. Everything else is there so that
// when you do get close it looks like a man in kit rather than a stack of boxes.
function createSoldier(seed = 0) {
  const root = new THREE.Group();
  // Yaw first, then pitch: the death fall rotates about the soldier's own
  // left-right axis no matter which way he was facing.
  root.rotation.order = 'YXZ';

  // A little per-man variation, so a column doesn't read as one clone repeated.
  const coats = [0x6b6553, 0x5f5a49, 0x736b57, 0x67614f];
  const furs = [0x8a7f68, 0x7d7361, 0x92876e];
  const coat = coats[seed % coats.length];
  const fur = furs[seed % furs.length];
  const dark = 0x35322b;
  const skin = 0xc2a184;
  const coatMat = mat(coat);
  const darkMat = mat(dark);
  const bootMat = mat(0x241f1a);

  // ---- Legs, hinged at the hip so they can walk ----
  const legs = { left: null, right: null };
  for (const side of ['left', 'right']) {
    const sign = side === 'left' ? -1 : 1;
    const hip = new THREE.Group();
    hip.position.set(sign * 0.105, HIP_Y, 0);
    root.add(hip);

    const thigh = limb(dark, THIGH, 0.075);
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -THIGH;
    thigh.add(knee);

    const shin = limb(dark, SHIN, 0.06);
    knee.add(shin);

    // A boot with a toe box. The toe is the thing that stops a foot reading as
    // a peg when a man is walking across your scope.
    const boot = new THREE.Group();
    boot.position.set(0, -SHIN - 0.02, 0);
    knee.add(boot);

    const ankle = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.13), bootMat);
    ankle.position.y = -0.02;
    ankle.castShadow = true;
    boot.add(ankle);

    const toe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.075, 0.2), bootMat);
    toe.position.set(0, -0.045, -0.09);
    toe.castShadow = true;
    boot.add(toe);

    legs[side] = { hip, knee };
  }

  // ---- Torso: waist, chest, shoulder yoke ----
  const torso = new THREE.Group();
  torso.position.y = HIP_Y;
  root.add(torso);

  // The coat flares at the hem and narrows at the waist. Two cylinders rather
  // than one is what gives him a waist at all.
  const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.3, 10), coatMat);
  hem.position.y = 0.14;
  hem.castShadow = true;
  torso.add(hem);

  const coatMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.2, 0.36, 10), coatMat);
  coatMesh.position.y = 0.44;
  coatMesh.castShadow = true;
  torso.add(coatMesh);

  // Broad, slightly sloped shoulders. This one shape is most of what makes the
  // figure read as human at range.
  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.235, 10, 7), coatMat);
  shoulders.scale.set(1.08, 0.56, 0.74);
  shoulders.position.y = 0.57;
  shoulders.castShadow = true;
  torso.add(shoulders);

  // Rolled hood/collar sitting behind the neck.
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.15, 9, 7), coatMat);
  hood.scale.set(1, 0.78, 0.9);
  hood.position.set(0, 0.64, 0.05);
  torso.add(hood);

  // Belt, buckle and a pouch. The waist is where a blocky model gives itself
  // away, so it gets broken up.
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.212, 0.212, 0.07, 10), darkMat);
  belt.position.y = 0.31;
  torso.add(belt);

  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.045, 0.02), mat(0x8a8578));
  buckle.position.set(0, 0.31, -0.2);
  torso.add(buckle);

  const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.11, 0.06), darkMat);
  pouch.position.set(0.15, 0.27, -0.13);
  pouch.castShadow = true;
  torso.add(pouch);

  // Pack on his back, high enough to show over the shoulders.
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.28, 0.14), mat(0x4a4438));
  pack.position.set(0, 0.5, 0.19);
  pack.castShadow = true;
  torso.add(pack);

  // ---- Head, face and helmet ----
  const head = new THREE.Group();
  head.position.y = 0.64;
  torso.add(head);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.09, 8), mat(skin));
  neck.position.y = -0.06;
  head.add(neck);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), mat(skin));
  skull.scale.set(0.94, 1.1, 0.98);
  skull.position.y = 0.04;
  skull.castShadow = true;
  head.add(skull);

  // A shadowed face under the brim. At range this reads as a face far better
  // than modelled eyes, which would be a few pixels and cost ten times as much.
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.07, 0.02), mat(0x8f7358));
  face.position.set(0, 0.02, -0.105);
  head.add(face);

  // Steel helmet: a dome with a slight brim.
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.142, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    mat(fur)
  );
  dome.position.y = 0.09;
  dome.scale.set(1, 0.92, 1.02);
  dome.castShadow = true;
  head.add(dome);

  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.146, 0.152, 0.035, 12), mat(fur));
  brim.position.y = 0.065;
  head.add(brim);

  // ---- Arms, with gloved hands ----
  const arms = { left: null, right: null };
  for (const side of ['left', 'right']) {
    const sign = side === 'left' ? -1 : 1;
    const shoulder = new THREE.Group();
    shoulder.position.set(sign * 0.225, 0.54, 0);
    torso.add(shoulder);

    const upper = limb(coat, 0.29, 0.062);
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = -0.29;
    upper.add(elbow);

    const fore = limb(coat, 0.25, 0.052);
    elbow.add(fore);

    // Mitten: a flattened hand, not a ball.
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.062, 7, 6), mat(0x4a4438));
    hand.scale.set(1, 1.15, 0.8);
    hand.position.y = -0.28;
    hand.castShadow = true;
    elbow.add(hand);

    arms[side] = { shoulder, elbow };
  }

  // ---- Rifle, slung across his back ----
  const rifle = new THREE.Group();
  const rifleMat = mat(0x3d2b1c);
  const barrelMat = mat(0x2a2a2a);

  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.07, 0.48), rifleMat);
  stock.position.set(0, 0, -0.06);
  stock.castShadow = true;
  rifle.add(stock);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.44, 6), barrelMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.018, -0.46);
  rifle.add(barrel);

  const sling = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.5), darkMat);
  sling.position.set(0.02, -0.03, -0.1);
  rifle.add(sling);

  // Carried muzzle-up over the right shoulder. A rifle held across the chest
  // pokes a barrel out sideways at shoulder height, which at 80 metres reads as
  // a stick growing out of the man; slung on the back it is unmistakably a
  // soldier, and it strengthens the silhouette instead of muddying it.
  //
  // When he engages, the whole group is re-parented by setRiflePose() — the
  // same rifle, shouldered, because a man who shoots you with a rifle on his
  // back reads as a bug no amount of tracer will fix.
  rifle.position.set(0.17, 0.26, 0.17);
  rifle.rotation.set(1.32, 0.18, 0.16);
  rifle.scale.setScalar(0.94);
  torso.add(rifle);

  // Muzzle flash at the barrel's mouth. Additive, depth-write off, and only
  // visible for a couple of frames; it is the single strongest "he is shooting
  // at you" cue at range.
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.55, 0.55),
    new THREE.MeshBasicMaterial({
      color: 0xffd27a,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  flash.position.set(0, 0.018, -0.72);
  flash.visible = false;
  rifle.add(flash);

  root.userData.height = 1.8;

  return { root, torso, head, arms, legs, rifle, flash };
}

// Rank marks for the two men who are worth more than one round.
//
// At 150 m a soldier is a silhouette, so rank has to be readable from the shape:
// a peaked cap instead of a helmet dome, a bright band, and shoulder boards.
// The coat underneath is the same figure — an officer in this weather is still a
// man in a greatcoat, not a video-game armour set.
function addRankMarks(fig, kind) {
  const general = kind === 'general';
  const capMat = mat(general ? 0x2b2e26 : 0x3a3d31);
  const bandMat = mat(general ? 0x8a1f1a : 0x2b2b2b);

  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.148, 0.1, 12), capMat);
  crown.position.y = 0.115;
  crown.castShadow = true;
  fig.head.add(crown);

  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.162, 0.162, 0.022, 12), capMat);
  top.position.y = 0.172;
  fig.head.add(top);

  // The band is the part that catches light, so it is what makes the cap read at
  // range rather than looking like a slightly taller helmet.
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.157, 0.157, 0.03, 12), bandMat);
  band.position.y = 0.072;
  fig.head.add(band);

  const peak = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.018, 0.09), mat(0x15161a));
  peak.position.set(0, 0.066, -0.14);
  peak.rotation.x = -0.15;
  fig.head.add(peak);

  for (const side of [-1, 1]) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.014, 0.16), bandMat);
    board.position.set(side * 0.22, 0.615, 0);
    fig.torso.add(board);
  }

  // Slightly larger than the men around him — the general is supposed to be the
  // one figure you can pick out of an escort at a glance.
  fig.root.scale.setScalar(general ? 1.05 : 1.03);
}

// The rifle has two homes: slung over the shoulder while walking, and shouldered
// against the cheek while engaging. The arms are already posed for each; this is
// the bit that puts the weapon in the hands rather than leaving it on his back
// while he fires at you.
const RIFLE_SLUNG = { p: [0.17, 0.26, 0.17], r: [1.32, 0.18, 0.16] };
const RIFLE_HELD = { p: [0.04, 0.4, -0.2], r: [0, 0, 0] };

function setRiflePose(fig, held) {
  if (fig.rifleHeld === held) return;
  const pose = held ? RIFLE_HELD : RIFLE_SLUNG;
  fig.rifle.position.set(pose.p[0], pose.p[1], pose.p[2]);
  fig.rifle.rotation.set(pose.r[0], pose.r[1], pose.r[2]);
  fig.rifleHeld = held;
}

// One leg forward, one back, arms counter-swinging. Called every frame with the
// enemy's accumulated walk phase.
function applyWalk(fig, phase, intensity = 1) {
  setRiflePose(fig, false);
  const s = Math.sin(phase) * intensity;
  const c = Math.sin(phase + Math.PI) * intensity;

  fig.legs.left.hip.rotation.x = s * 0.7;
  fig.legs.right.hip.rotation.x = c * 0.7;
  fig.legs.left.knee.rotation.x = Math.max(0, -s) * 0.8;
  fig.legs.right.knee.rotation.x = Math.max(0, -c) * 0.8;

  fig.arms.left.shoulder.rotation.x = c * 0.45;
  fig.arms.right.shoulder.rotation.x = s * 0.45;

  fig.torso.rotation.y = s * 0.07;
  fig.head.rotation.y = 0;
  fig.root.position.y = Math.abs(Math.sin(phase)) * 0.035;
}

// A man standing his ground: weight settled, tiny breathing motion, head
// scanning a few degrees. Used by sentries, and by anyone who has stopped.
function applyIdle(fig, t) {
  setRiflePose(fig, false);
  const breathe = Math.sin(t * 1.3);

  fig.legs.left.hip.rotation.x = 0.03;
  fig.legs.right.hip.rotation.x = -0.03;
  fig.legs.left.knee.rotation.x = 0.02;
  fig.legs.right.knee.rotation.x = 0.02;

  fig.arms.left.shoulder.rotation.x = -0.08;
  fig.arms.right.shoulder.rotation.x = -0.14;
  fig.arms.left.elbow.rotation.x = -0.18;
  fig.arms.right.elbow.rotation.x = -0.24;

  fig.torso.rotation.y = Math.sin(t * 0.42) * 0.055;
  fig.head.rotation.y = Math.sin(t * 0.42 + 0.8) * 0.16;
  fig.root.position.y = breathe * 0.006;
}

// Raised rifle, leaning into the shot. Used for the moment before they fire,
// which is the only warning the player gets.
function applyAiming(fig, t) {
  setRiflePose(fig, true);
  fig.torso.rotation.y = 0;
  fig.head.rotation.y = 0;
  fig.arms.right.shoulder.rotation.x = -1.35;
  fig.arms.right.elbow.rotation.x = -0.35;
  fig.arms.left.shoulder.rotation.x = -1.15;
  fig.arms.left.elbow.rotation.x = -0.5;
  fig.root.position.y = Math.sin(t * 2) * 0.01;
}

// ---------------------------------------------------------------------------
// Line of sight
// ---------------------------------------------------------------------------

// Is anything solid between these two points? Tested against the tree list
// rather than the scene graph, because 200-odd instanced trees have no
// individual objects to raycast against.
export function hasLineOfSight(from, to, treeSpots) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len2 = dx * dx + dz * dz;
  if (len2 < 1) return true;

  for (const tree of treeSpots) {
    const t = ((tree.x - from.x) * dx + (tree.z - from.z) * dz) / len2;
    if (t < 0.05 || t > 0.95) continue;
    const px = from.x + dx * t;
    const pz = from.z + dz * t;
    const dist2 = (tree.x - px) ** 2 + (tree.z - pz) ** 2;
    // A tree blocks if the line passes within its trunk radius.
    const r = 0.9 * tree.scale;
    if (dist2 < r * r) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// The enemy force
// ---------------------------------------------------------------------------

export class EnemyManager {
  constructor(scene, map, treeSpots, world = null) {
    this.scene = scene;
    this.map = map;
    this.treeSpots = treeSpots;
    this.world = world;
    this.enemies = [];
    this.rng = Math.random;

    // Tracer pool. Six short-lived lines is plenty when a firefight is a dozen
    // men shooting at one man who should be moving. Pooled, so the frame that
    // matters never allocates a line.
    this.tracers = [];
    for (let i = 0; i < 6; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const line = new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.9 })
      );
      line.frustumCulled = false;
      line.visible = false;
      scene.add(line);
      this.tracers.push({ line, life: 0 });
    }
    this._tracerIndex = 0;

    this._spawn();
  }

  _spawn() {
    // Sentries: standing posts between you and the line. Static targets, and
    // the first thing a new player actually gets to practise on.
    const sentries = this.map.sentries ?? 2;
    for (let i = 0; i < sentries; i++) {
      const lane = (i - (sentries - 1) / 2) * 30 + (this.rng() - 0.5) * 10;
      this._add('sentry', lane, -34 - this.rng() * 30);
    }

    // Columns: straight lanes toward the line, spaced so they arrive in a
    // steady trickle rather than all at once.
    for (let i = 0; i < this.map.columns; i++) {
      const lane = (i - (this.map.columns - 1) / 2) * 26 + (this.rng() - 0.5) * 8;
      this._add('column', lane, SPAWN_Z - i * 34 - this.rng() * 20);
    }

    // Patrols: wandering, further forward, and the ones that punish a shot.
    for (let i = 0; i < this.map.patrols; i++) {
      const lane = (this.rng() - 0.5) * 120;
      this._add('patrol', lane, -40 - this.rng() * 70);
    }

    // The camp is manned before the mission asks for anything: two men on the
    // tower platforms with a height advantage and a clear view, two on the
    // ground working the tents. A camp that only exists as scenery would read
    // as a diorama the moment the player looked through the scope.
    const camp = this.world && this.world.camp;
    if (camp) {
      for (const tower of camp.towers.slice(0, 2)) {
        this._add('tower', tower.x, tower.z, { y: tower.y });
      }
      for (const guard of camp.guards.slice(0, 2)) {
        this._add('guard', guard.x, guard.z);
      }
    }
  }

  // Shown up by the mission chain, not by the map. `spawnBoss` puts the target
  // and his escort far enough out to be a shot worth taking but inside the
  // map's fog, or on the lake he would spawn invisible and never be found.
  // `onTower` puts a sniper on a watchtower platform instead of in the snow.
  spawnBoss({ kind, health, escorts = 2, onTower = false }) {
    const fogFar = this.map.fog?.far ?? 300;
    const near = Math.min(110, fogFar * 0.6);
    const far = Math.min(160, fogFar * 0.85);

    let lane = (this.rng() - 0.5) * 50;
    let z = kind === 'general' ? -far - this.rng() * 10 : -near - this.rng() * 12;
    let y;

    if (onTower) {
      const towers = (this.world && this.world.camp && this.world.camp.towers) || [];
      const tower = towers[1] || towers[0];
      if (tower) {
        lane = tower.x + 0.65;
        z = tower.z;
        y = tower.y;
      }
    }

    const boss = this._add(kind, lane, z, { health, rank: kind, y });

    for (let i = 0; i < escorts; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      this._add('guard', lane + side * (7 + this.rng() * 6), z + 6 + this.rng() * 12);
    }

    return boss;
  }

  _add(kind, x, z, opts = {}) {
    // Each man gets a slightly different coat, so a column doesn't look like one
    // figure copied five times.
    this._styleSeed = (this._styleSeed || 0) + 1;
    const fig = createSoldier(this._styleSeed);
    if (kind === 'officer' || kind === 'general' || kind === 'sniper') addRankMarks(fig, kind);

    const health = opts.health ?? 1;
    // Men on a tower stand at platform height; everyone else uses the ground
    // under their feet. `baseY` is the anchor every later frame reuses, so a
    // tower guard never drifts down to the snow when the walk bob resets him.
    const baseY = opts.y ?? terrainHeight(x, z, this.map);

    const enemy = {
      kind,
      // `rank` is only set on the men who take more than one round; the HUD
      // and the callouts use it to talk about them as people rather than targets.
      rank: opts.rank || null,
      fig,
      x,
      z,
      baseY,
      homeX: x,
      homeZ: z,
      facing: Math.PI, // facing the player, roughly
      baseFacing: Math.PI,
      health,
      maxHealth: health,
      alive: true,
      // Anyone with height or a scope starts the sortie already suspicious;
      // ground sentries wake up when the forest does.
      alert: opts.alert ?? (kind === 'tower' ? 0.4 : kind === 'sniper' ? 0.55 : 0),
      walkPhase: this.rng() * Math.PI * 2,
      wanderT: this.rng() * 10,
      fireCooldown: 0,
      aiming: 0,
      flashT: 0,
      speed: this.map.enemySpeed * SPEED_FACTOR[kind],
      // Death animation state. `dying` is undefined until the man is hit.
      dying: undefined,
      deathT: 0,
      gone: false,
    };

    fig.root.position.set(x, baseY, z);
    this.scene.add(fig.root);
    this.enemies.push(enemy);
    return enemy;
  }

  get alive() {
    return this.enemies.filter((e) => e.alive);
  }

  // A shot went off at `origin`. Everyone within earshot gets more suspicious,
  // and closer means much more suspicious — a rifle is loud, but a rifle at
  // fifty metres is unmistakable.
  hearShot(origin, loudness = 1) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - origin.x, e.z - origin.z);
      const hearing = 190 * loudness;
      if (d < hearing) {
        const closeness = 1 - d / hearing;
        e.alert = Math.min(1, e.alert + closeness * closeness * 0.75);
      }
    }
  }

  // Nearest living enemy to a point, for the "am I about to be overrun" checks.
  nearest(x, z) {
    let best = null;
    let bestD = Infinity;
    for (const e of this.alive) {
      const d = Math.hypot(e.x - x, e.z - z);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return { enemy: best, distance: bestD };
  }

  // Paluu: the camp has your range. Everyone alive turns hunter at once, and
  // two men are put out wide to cut the retreat. They are ordinary guards with
  // one difference — they already know roughly where you are.
  alarm() {
    for (const e of this.enemies) {
      if (e.alive) e.alert = 1;
    }
  }

  spawnHunters(x, z, count = 2) {
    const spawned = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 28 + Math.random() * 14;
      const hx = THREE.MathUtils.clamp(x + Math.cos(angle) * dist, -120, 120);
      const hz = THREE.MathUtils.clamp(z + Math.sin(angle) * dist, -55, 68);
      const hunter = this._add('guard', hx, hz);
      hunter.alert = 1;
      hunter.baseFacing = Math.atan2(-(x - hx), -(z - hz));
      hunter.facing = hunter.baseFacing;
      spawned.push(hunter);
    }
    return spawned;
  }

  update(dt, player, onEvent) {
    for (const e of this.enemies) {
      if (!e.alive) continue;

      const toPlayerX = player.x - e.x;
      const toPlayerZ = player.z - e.z;
      const distToPlayer = Math.hypot(toPlayerX, toPlayerZ);

      // Can this man see the player? Range, exposure, and a clear line through
      // the trees. A sniper works further out and needs less exposure — that is
      // the difference between a sentry and a marksman.
      const range = e.kind === 'sniper' ? 260 : 150;
      const spotted = player.exposure > (e.kind === 'sniper' ? 38 : 48);
      const canSee =
        // The general directs the fight rather than firing; his escort does the
        // shooting. It also keeps the final target from killing you while you
        // are working out which figure in the group is him.
        e.kind !== 'general' &&
        distToPlayer < range &&
        spotted &&
        hasLineOfSight(e, player, this.treeSpots);

      // ---- Where to go ----
      let targetX = e.x;
      let targetZ = e.z;
      e.wanderT += dt * 0.3;

      // A man with a firing solution stops and shoulders his rifle. Only the
      // column keeps walking — that is exactly what makes it a column, and the
      // line still gets lost if you leave it alone.
      if (!canSee || e.kind === 'column') {
        if (e.kind === 'column') {
          targetZ = LINE_Z + 2;
          targetX = e.homeX;
        } else if (e.kind === 'officer') {
          // The officer keeps coming even when the shooting starts. He is the one
          // target that closes the distance while you are trying to re-acquire him.
          targetZ = LINE_Z + 10;
          targetX = e.homeX + Math.sin(e.wanderT * 0.5) * 8;
        } else if (e.kind === 'general') {
          // The general holds his ground and shifts across it. A three-hit target
          // that walks toward you is a chore; one that slides sideways is a shot
          // you have to time.
          targetZ = e.homeZ + Math.cos(e.wanderT * 0.4) * 10;
          targetX = e.homeX + Math.sin(e.wanderT * 0.35) * 22;
        } else if (e.kind === 'tower' || e.kind === 'sniper') {
          // On the platform. Men with height do not abandon it.
          targetX = e.homeX;
          targetZ = e.homeZ;
        } else if (e.kind === 'sentry' && e.alert <= 0.45) {
          // On his post. He scans, but he does not wander off it.
          targetX = e.homeX;
          targetZ = e.homeZ;
        } else if (e.alert > 0.45) {
          // Hunting: head for where the player actually is. They cheat slightly
          // — they know the position, not the exact spot — which is what makes
          // repositioning after a shot actually work.
          targetX = player.x + Math.sin(e.wanderT * 0.6) * 6;
          targetZ = player.z + Math.cos(e.wanderT * 0.6) * 6;
        } else {
          targetX = e.homeX + Math.sin(e.wanderT) * 22;
          targetZ = e.homeZ + Math.cos(e.wanderT * 0.7) * 14;
        }
      }

      const dx = targetX - e.x;
      const dz = targetZ - e.z;
      const d = Math.hypot(dx, dz);

      // Alert decays when nothing is happening, so a quiet spell genuinely
      // buys you time rather than just pausing the hunt.
      const moving = d > 1.5 && e.speed > 0;
      if (moving) {
        const step = (e.speed * dt) / d;
        e.x += dx * step;
        e.z += dz * step;
        e.facing = Math.atan2(-dx, -dz);
        e.walkPhase += dt * 5.2;
      } else {
        e.walkPhase += dt * 1.2;
      }

      // A sentry on his post turns his head and shoulders across the approach
      // instead of freezing like a statue. A tower man scans the whole near
      // ground, which is what makes his platform feel occupied.
      if (e.kind === 'sentry' && !moving) {
        e.facing = e.baseFacing + Math.sin(e.wanderT * 2.2) * 0.4;
      } else if (e.kind === 'tower' && !canSee) {
        e.facing = e.baseFacing + Math.sin(e.wanderT * 1.6) * 0.55;
      }

      if (!moving || e.kind === 'patrol') {
        e.alert = Math.max(0, e.alert - dt * (e.kind === 'patrol' ? 0.05 : 0.12));
      }

      // ---- Shooting ----
      e.fireCooldown -= dt;

      if (canSee) {
        // Face the player and shoulder the rifle. The visible aim is the
        // warning: there is about half a second to go to ground before he
        // fires, and standing in the open is not a plan.
        e.facing = Math.atan2(-toPlayerX, -toPlayerZ);
        e.aiming += dt;
        applyAiming(e.fig, e.wanderT);

        if (e.aiming > (e.kind === 'sniper' ? 0.8 : 0.5) && e.fireCooldown <= 0) {
          e.aiming = 0;
          const sniper = e.kind === 'sniper';
          e.fireCooldown = (sniper ? 2.6 : 2.1) + this.rng() * (sniper ? 1.3 : 2.0);

          // Accuracy falls with range, and a crouched or moving target is
          // harder to hit. A miss still puts a tracer past your ear.
          const baseChance = sniper ? 0.8 : 0.62;
          const rangePenalty = Math.min(0.34, distToPlayer / 420);
          const coverBonus = player.crouched ? 0.15 : 0;
          const moveBonus = (player.speedNow || 0) > 1.2 ? 0.08 : 0;
          const hitChance = Math.max(0.16, baseChance - rangePenalty - coverBonus - moveBonus);
          const hit = this.rng() < hitChance;
          const damage = hit
            ? THREE.MathUtils.clamp(
                (sniper ? 30 : 16) - distToPlayer * (sniper ? 0.05 : 0.06),
                3,
                sniper ? 30 : 16
              )
            : 0;

          this._flash(e);
          this._tracer(e, player, hit);
          onEvent({
            type: 'shotAtPlayer',
            damage,
            from: { x: e.x, z: e.z },
            distance: distToPlayer,
            kind: e.kind,
            sniper,
          });
        }
      } else {
        e.aiming = 0;
        if (moving) applyWalk(e.fig, e.walkPhase);
        else if (e.kind === 'sentry' || e.kind === 'tower' || e.kind === 'sniper') {
          applyIdle(e.fig, e.wanderT);
        } else {
          applyWalk(e.fig, e.walkPhase, 0.15);
        }
      }

      if (e.flashT > 0) {
        e.flashT -= dt;
        if (e.flashT <= 0) e.fig.flash.visible = false;
      }

      // The walk cycle writes a small bob into root.position.y; this lifts the
      // whole figure onto the ground (or the tower platform) without discarding it.
      e.fig.root.position.set(e.x, e.baseY + e.fig.root.position.y, e.z);
      e.fig.root.rotation.y = e.facing;

      // Reached the line.
      if (e.kind === 'column' && e.z > LINE_Z + 2) {
        e.alive = false;
        e.fig.root.visible = false;
        onEvent({ type: 'lineBreached', enemy: e });
      }
    }

    this._tickTracers(dt);
    this._updateFallen(dt);
  }

  // The flash and the tracer come from the rifle's actual world pose, so a
  // shouldered rifle flashes where its barrel is rather than at the man's chest.
  _flash(enemy) {
    enemy.fig.flash.visible = true;
    enemy.flashT = 0.07;
  }

  _tracer(enemy, player, hit) {
    const slot = this.tracers[this._tracerIndex % this.tracers.length];
    this._tracerIndex += 1;

    enemy.fig.root.updateMatrixWorld(true);
    const from = enemy.fig.rifle.localToWorld(new THREE.Vector3(0, 0.02, -0.72));

    // A miss is a round that goes past: offset the endpoint beside the player
    // rather than through him, so the tracer is honest about what happened.
    const lateral = hit ? 0 : (this.rng() < 0.5 ? -1 : 1) * (1.4 + this.rng() * 3.2);
    const px = player.x + lateral;
    const pz = player.z + (hit ? 0 : (this.rng() - 0.5) * 2.4);
    const groundY = player.groundY ?? terrainHeight(player.x, player.z, this.map);
    const py = groundY + 1.25 + (hit ? 0 : this.rng() * 0.8);

    const pos = slot.line.geometry.attributes.position;
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, px, py, pz);
    pos.needsUpdate = true;
    slot.line.visible = true;
    slot.life = 0.08;
  }

  _tickTracers(dt) {
    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      if (t.life <= 0) t.line.visible = false;
    }
  }

  // Men who have been shot. They topple over and stay on the snow for a few
  // seconds before fading out. This is the hit confirmation: a body dropping is
  // unambiguous in a way that a figure blinking out of existence never is, and
  // it means the player can see what they actually hit.
  _updateFallen(dt) {
    for (const e of this.enemies) {
      if (e.alive || e.gone || e.dying === undefined) continue;

      e.dying = Math.min(1, e.dying + dt * 2.2);
      e.deathT += dt;

      // Fast at first, then settling — a body dropping, not a door swinging.
      const k = 1 - (1 - e.dying) ** 3;
      e.fig.root.position.set(e.x, e.deathY + k * 0.1, e.z);
      e.fig.root.rotation.x = e.deathDir * k * (Math.PI / 2) * 0.92;

      if (e.deathT > 3.4) {
        e.fig.root.visible = false;
        e.gone = true;
      }
    }
  }

  // Applies damage and returns what happened, so the caller can tell a kill from
  // a wound. A man with one hit point dies exactly as he did before; the officer
  // and the general simply have more than one. `damage` comes from the
  // ammunition (armour-piercing hurts rank harder), so the rules stay in the
  // round and the figure only takes the number.
  hit(enemy, damage = 1) {
    if (!enemy || !enemy.alive) return { down: false, remaining: 0 };

    enemy.health -= damage;
    if (enemy.health > 0) {
      return { down: false, remaining: Math.max(1, Math.ceil(enemy.health)) };
    }

    enemy.alive = false;
    enemy.dying = 0;
    enemy.deathT = 0;
    enemy.deathDir = this.rng() < 0.5 ? 1 : -1;
    enemy.deathY = enemy.baseY ?? terrainHeight(enemy.x, enemy.z, this.map);
    return { down: true, remaining: 0 };
  }
}

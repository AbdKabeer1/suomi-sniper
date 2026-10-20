import * as THREE from 'three';

// The player, as an object in the world.
//
// The camera is inside the player's head in first-person, so for most of the
// game this figure is hidden. It exists because "change my views" needs
// something to look at in third-person, and because a body that walks gives the
// movement weight that a floating camera never has.

const HIP_Y = 0.92;
const THIGH = 0.45;
const SHIN = 0.39;

// The white snow suit. Off-white rather than pure white, so the figure still
// reads against snow — a pure-#fff man on a #e6edf4 field is a hole in the
// world, not a silhouette.
const SUIT = 0xe4e8ea;
const SUIT_SHADE = 0xcfd6da;
const BOOT = 0x3a352e;
const STRAP = 0x5b5343;
const SKIN = 0xc9a882;

// The two rifle carries, in torso space (torso sits at HIP_Y, eye is 1.62, so a
// shoulder-height rifle origin sits around torso y ≈ 0.62).
//
// CARRY — held in both hands across the body, muzzle down-forward: what a soldier
// moving through snow actually does, and it keeps the barrel out of the trees
// while walking.
const RIFLE_CARRY = {
  pos: new THREE.Vector3(0.05, 0.22, 0.1),
  rot: new THREE.Euler(0.42, 0.12, -0.3),
};
// AIM — seated into the firing shoulder, barrel on the aim line.
const RIFLE_AIM = {
  pos: new THREE.Vector3(0.0, 0.62, -0.18),
  rot: new THREE.Euler(-0.005, 0, 0),
};

// Limb targets for the aiming pose, applied as an overlay onto whatever the
// walk cycle currently holds (see update for why that and not a hard switch).
const AIM_POSE = {
  rShoulderX: -1.5,
  rElbowX: -0.5,
  lShoulderX: -1.25,
  lElbowX: -0.65,
  torsoYaw: 0,
};

function mat(color, roughness = 0.92) {
  return new THREE.MeshStandardMaterial({ color, roughness });
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

function createFigure() {
  const root = new THREE.Group();

  // Legs, hinged at the hip so they can walk. Boots are wider than the enemy's
  // — a snow boot, not a marching boot.
  const legs = { left: null, right: null };
  for (const side of ['left', 'right']) {
    const sign = side === 'left' ? -1 : 1;
    const hip = new THREE.Group();
    hip.position.set(sign * 0.1, HIP_Y, 0);
    root.add(hip);

    const thigh = limb(SUIT_SHADE, THIGH, 0.085);
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -THIGH;
    thigh.add(knee);

    const shin = limb(SUIT, SHIN, 0.07);
    knee.add(shin);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.28), mat(BOOT));
    boot.position.set(0, -SHIN - 0.02, 0.06);
    boot.castShadow = true;
    knee.add(boot);

    legs[side] = { hip, knee };
  }

  // Torso: a padded white smock, belted at the waist.
  const torso = new THREE.Group();
  torso.position.y = HIP_Y;
  root.add(torso);

  const smock = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.28, 0.84, 8), mat(SUIT));
  smock.position.y = 0.2;
  smock.castShadow = true;
  torso.add(smock);

  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.245, 0.1, 8), mat(STRAP));
  belt.position.y = 0.04;
  torso.add(belt);

  // A white hood over the head. The silhouette that reads at distance is the
  // hood, which is the whole point of winter camouflage.
  const head = new THREE.Group();
  head.position.y = 0.8;
  torso.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.135, 10, 8), mat(SUIT));
  skull.scale.set(1, 1.06, 0.95);
  skull.castShadow = true;
  head.add(skull);

  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.175, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), mat(SUIT_SHADE));
  hood.position.y = 0.02;
  hood.castShadow = true;
  head.add(hood);

  const face = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), mat(SKIN));
  face.position.set(0, -0.01, -0.07);
  face.scale.set(1, 0.85, 0.6);
  head.add(face);

  // Arms.
  const arms = { left: null, right: null };
  for (const side of ['left', 'right']) {
    const sign = side === 'left' ? -1 : 1;
    const shoulder = new THREE.Group();
    shoulder.position.set(sign * 0.24, 0.56, 0);
    torso.add(shoulder);

    const upper = limb(SUIT, 0.31, 0.07);
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = -0.31;
    upper.add(elbow);

    const fore = limb(SUIT_SHADE, 0.27, 0.06);
    elbow.add(fore);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 5), mat(SKIN));
    hand.position.y = -0.29;
    elbow.add(hand);

    arms[side] = { shoulder, elbow };
  }

  // The rifle, held rather than slung. Two carries exist and the update blends
  // between them: hands-ahead low ready while walking, and seated into the
  // shoulder along the aim line when the scope comes up. The wood and steel
  // materials are kept so the menu's rifle choice can tint it.
  const woodMat = mat(0x4a3524, 0.8);
  const steelMat = mat(0x24262a, 0.6);

  const rifle = new THREE.Group();
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.9), woodMat);
  stock.position.set(0, -0.01, -0.2);
  stock.castShadow = true;
  rifle.add(stock);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.75, 6), steelMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.015, -0.95);
  rifle.add(barrel);

  const boltHandle = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 5), steelMat);
  boltHandle.position.set(0.05, 0.02, -0.14);
  rifle.add(boltHandle);

  rifle.position.copy(RIFLE_CARRY.pos);
  rifle.rotation.copy(RIFLE_CARRY.rot);
  torso.add(rifle);

  root.userData.height = 1.8;

  return { root, torso, head, arms, legs, rifle, hood, stockMat: woodMat };
}

// One leg forward, one back, arms counter-swinging. `intensity` lets the same
// function give a standing idle a small amount of life.
function applyWalk(fig, phase, intensity = 1) {
  const s = Math.sin(phase) * intensity;
  const c = Math.sin(phase + Math.PI) * intensity;

  fig.legs.left.hip.rotation.x = s * 0.7;
  fig.legs.right.hip.rotation.x = c * 0.7;
  fig.legs.left.knee.rotation.x = Math.max(0, -s) * 0.8;
  fig.legs.right.knee.rotation.x = Math.max(0, -c) * 0.8;

  fig.arms.left.shoulder.rotation.x = c * 0.4;
  fig.arms.right.shoulder.rotation.x = s * 0.4;

  fig.torso.rotation.y = s * 0.07;
}

// The pose when the rifle is up and the eye is behind the sights.
function applyAiming(fig) {
  fig.torso.rotation.y = AIM_POSE.torsoYaw;
  fig.arms.right.shoulder.rotation.x = AIM_POSE.rShoulderX;
  fig.arms.right.elbow.rotation.x = AIM_POSE.rElbowX;
  fig.arms.left.shoulder.rotation.x = AIM_POSE.lShoulderX;
  fig.arms.left.elbow.rotation.x = AIM_POSE.lElbowX;
  fig.legs.left.hip.rotation.x = 0.1;
  fig.legs.right.hip.rotation.x = -0.1;
  fig.legs.left.knee.rotation.x = 0.1;
  fig.legs.right.knee.rotation.x = 0.1;
}

// Nudge one rotation axis toward a pose target. `m` is the blend weight.
function toward(rot, prop, target, m) {
  rot[prop] += (target - rot[prop]) * m;
}

export class PlayerFigure {
  constructor(scene, weapon = null) {
    // createFigure returns the group plus named limbs; keep both. `root` is
    // what gets added to the scene and moved, `fig` is what gets posed.
    this.fig = createFigure();
    this.root = this.fig.root;
    // Rifle carry blend: 0 = in the hands, 1 = at the shoulder and on the aim
    // line. Eased, because a pose that snaps reads as a puppet.
    this.carryMix = 0;
    if (weapon && weapon.chassis != null) this.setSkin(weapon.chassis);
    this.root.visible = false; // first-person by default
    scene.add(this.root);
  }

  setVisible(on) {
    this.root.visible = Boolean(on);
  }

  // Tint the stock to the chosen rifle. Same silhouette either way — a bolt
  // gun is a bolt gun — but a parkerised M/28 and a tan LRS read differently
  // in third person, which keeps your own kit connected to the menu pick.
  setSkin(chassisHex) {
    this.fig.stockMat.color.setHex(chassisHex);
  }

  update({ x, z, yaw, phase, moving, crouched, aiming, groundY, speed = 0, dt = 0 }) {
    this.root.position.set(x, groundY, z);
    this.root.rotation.y = yaw;

    // Crouching is a lowered stance, not a scale change: the knees fold and the
    // whole body drops, which is what makes it read as "low in the snow".
    if (crouched) {
      this.root.position.y = groundY - 0.34;
    }

    // Stride length follows actual speed, so a crouch-walk reads as a shuffle
    // and a sprint reads as a run from the same cycle. Above walking pace the
    // whole body leans into it, which is most of what sells a sprint in third
    // person.
    const stride = Math.min(1.2, 0.5 + speed * 0.13);
    const lean = THREE.MathUtils.clamp((speed - 4.2) / 4, 0, 1) * 0.14;

    this.fig.torso.rotation.x = -lean;
    this.fig.head.rotation.x = lean * 0.6;

    // The carry blend runs in real time, so the rifle has weight while it
    // rises. appliedWalk lays the walk/idle pose first; the aiming pose is then
    // trained onto whatever that left behind, so limbs travel rather than
    // teleport when the scope comes up — and drift back naturally on release.
    if (dt > 0) this.carryMix = THREE.MathUtils.clamp(this.carryMix + (aiming ? dt / 0.22 : -dt / 0.22), 0, 1);
    const m = this.carryMix;

    if (moving) applyWalk(this.fig, phase, stride);
    else applyWalk(this.fig, phase, 0.12);

    if (m > 0) {
      toward(this.fig.arms.right.shoulder.rotation, 'x', AIM_POSE.rShoulderX, m);
      toward(this.fig.arms.right.shoulder.rotation, 'x', AIM_POSE.rShoulderX, m);
      toward(this.fig.arms.right.elbow.rotation, 'x', AIM_POSE.rElbowX, m);
      toward(this.fig.arms.left.shoulder.rotation, 'x', AIM_POSE.lShoulderX, m);
      toward(this.fig.arms.left.elbow.rotation, 'x', AIM_POSE.lElbowX, m);
      toward(this.fig.torso.rotation, 'y', AIM_POSE.torsoYaw, m);
    }

    // The rifle follows the same blend, from hands-across-body to the
    // shoulder. A gentle bounce with the stride keeps the carry lifelike while
    // walking, and leaves the aim rock-steady.
    const bounce = Math.sin(phase) * 0.02 * (1 - m);
    this.fig.rifle.position.lerpVectors(RIFLE_CARRY.pos, RIFLE_AIM.pos, m);
    this.fig.rifle.position.z += bounce;
    this.fig.rifle.rotation.x = THREE.MathUtils.lerp(RIFLE_CARRY.rot.x, RIFLE_AIM.rot.x, m);
    this.fig.rifle.rotation.y = THREE.MathUtils.lerp(RIFLE_CARRY.rot.y, RIFLE_AIM.rot.y, m);
    this.fig.rifle.rotation.z = THREE.MathUtils.lerp(RIFLE_CARRY.rot.z, RIFLE_AIM.rot.z, m);
  }
}

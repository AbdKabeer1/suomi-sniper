import * as THREE from 'three';

// The rifle in your hands.
//
// A modern scoped bolt-action: polymer chassis, fluted barrel, a big objective
// lens up top. Drawn as real geometry in a scene of its own and composited over
// the world in a second pass with the depth buffer cleared between them.
//
// That's the standard view-model arrangement, and it exists for a reason: a
// rifle modelled inside the world scene either clips through the tree you are
// standing next to, or — if you switch depth testing off to stop that — loses
// its own internal occlusion and draws the receiver straight through the stock.
// Two passes fixes both. Everything else here is cosmetics.
//
// It knows nothing about the rules. main.js decides when it is on screen and how
// far the scope is wound in. Keep it that way: the weapon is a view.

const POLYMER = 0x2b3034;
const POLYMER_DARK = 0x1e2225;
const STEEL = 0x181b1e;
const STEEL_LIGHT = 0x353a3f;
const GLOVE = 0x343a32;
const LENS = 0x2f5c78;

function std(color, roughness, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function box(w, h, d, material) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
}

function cyl(rTop, rBottom, len, material, seg = 12) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, len, seg), material);
}

// Built along -z, so "forward" is away from the eye. Local origin sits at the
// receiver, which is the point the whole thing pivots around. Returns the
// materials alongside the geometry so `setSkin` can repaint them per weapon.
function buildRifle() {
  const rifle = new THREE.Group();

  const matPoly = std(POLYMER, 0.62);
  const matDark = std(POLYMER_DARK, 0.72);
  const matSteel = std(STEEL, 0.34, 0.85);
  const matBright = std(STEEL_LIGHT, 0.4, 0.7);
  const matGlove = std(GLOVE, 0.95);
  const mats = { poly: matPoly, dark: matDark };

  // ---- Receiver and rail ----
  const receiver = box(0.058, 0.085, 0.42, matPoly);
  receiver.position.set(0, 0, -0.12);
  rifle.add(receiver);

  const rail = box(0.03, 0.012, 0.34, matBright);
  rail.position.set(0, 0.048, -0.14);
  rifle.add(rail);

  // ---- Barrel, handguard, brake ----
  const barrel = cyl(0.013, 0.015, 0.66, matSteel);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.012, -0.66);
  rifle.add(barrel);

  const handguard = box(0.05, 0.055, 0.34, matDark);
  handguard.position.set(0, 0.002, -0.44);
  rifle.add(handguard);

  const brake = cyl(0.021, 0.021, 0.085, matBright, 10);
  brake.rotation.x = Math.PI / 2;
  brake.position.set(0, 0.012, -1.0);
  rifle.add(brake);

  // ---- Stock, grip, magazine ----
  const butt = box(0.05, 0.13, 0.24, matPoly);
  butt.position.set(0, -0.03, 0.24);
  rifle.add(butt);

  const cheek = box(0.05, 0.035, 0.18, matDark);
  cheek.position.set(0, 0.045, 0.22);
  rifle.add(cheek);

  const grip = box(0.038, 0.11, 0.06, matDark);
  grip.position.set(0, -0.085, 0.015);
  grip.rotation.x = -0.18;
  rifle.add(grip);

  const mag = box(0.042, 0.1, 0.07, matDark);
  mag.position.set(0, -0.085, -0.19);
  rifle.add(mag);

  // ---- Bolt handle, on the right ----
  const boltStem = cyl(0.008, 0.008, 0.06, matBright, 8);
  boltStem.rotation.z = Math.PI / 2;
  boltStem.position.set(0.045, 0.02, -0.03);
  rifle.add(boltStem);

  const boltKnob = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), matBright);
  boltKnob.position.set(0.075, 0.02, -0.03);
  rifle.add(boltKnob);

  // ---- The scope: objective, ocular, tube, turrets, mounts ----
  const scopeY = 0.095;
  const scopeZ = -0.26;

  const objective = cyl(0.028, 0.028, 0.17, matSteel, 16);
  objective.rotation.x = Math.PI / 2;
  objective.position.set(0, scopeY, scopeZ - 0.14);
  rifle.add(objective);

  const ocular = cyl(0.026, 0.026, 0.11, matSteel, 16);
  ocular.rotation.x = Math.PI / 2;
  ocular.position.set(0, scopeY, scopeZ + 0.14);
  rifle.add(ocular);

  const tube = cyl(0.016, 0.016, 0.12, matBright, 14);
  tube.rotation.x = Math.PI / 2;
  tube.position.set(0, scopeY, scopeZ);
  rifle.add(tube);

  const turretTop = cyl(0.013, 0.013, 0.03, matBright, 12);
  turretTop.position.set(0, scopeY + 0.028, scopeZ);
  rifle.add(turretTop);

  const turretSide = cyl(0.013, 0.013, 0.03, matBright, 12);
  turretSide.rotation.z = Math.PI / 2;
  turretSide.position.set(0.03, scopeY, scopeZ);
  rifle.add(turretSide);

  const mountA = box(0.028, 0.042, 0.028, matBright);
  mountA.position.set(0, 0.062, -0.34);
  rifle.add(mountA);

  const mountB = box(0.028, 0.042, 0.028, matBright);
  mountB.position.set(0, 0.062, -0.16);
  rifle.add(mountB);

  // The objective glass. Facing forward, so all the shooter sees of it is a
  // cold blue glint along the top of the barrel — which is the point.
  const lens = new THREE.Mesh(
    new THREE.CircleGeometry(0.0255, 20),
    new THREE.MeshStandardMaterial({
      color: LENS,
      roughness: 0.14,
      metalness: 0.6,
      emissive: 0x0a1a24,
      emissiveIntensity: 1,
    })
  );
  lens.position.set(0, scopeY, scopeZ - 0.226);
  lens.rotation.y = Math.PI;
  rifle.add(lens);

  // ---- Gloved hands ----
  const hand = (x, y, z, rx, rz) => {
    const g = new THREE.Group();
    g.add(box(0.07, 0.085, 0.095, matGlove));
    const thumb = box(0.03, 0.028, 0.055, matGlove);
    thumb.position.set(0, 0.04, 0.01);
    g.add(thumb);
    g.position.set(x, y, z);
    g.rotation.set(rx, 0, rz);
    return g;
  };

  // Support hand under the handguard; trigger hand wrapped on the grip.
  rifle.add(hand(-0.005, -0.075, -0.44, 0.3, 0.16));
  rifle.add(hand(0.012, -0.14, 0.03, -0.2, -0.1));

  return { rifle, mats };
}

export class WeaponView {
  constructor() {
    this.scene = new THREE.Scene();
    // A camera of its own, at a fixed field of view: the rifle must not zoom
    // when the world zoom does, or bringing the scope up would magnify the stock.
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.01, 12);

    this.scene.add(new THREE.HemisphereLight(0xdfe8f0, 0x23282c, 1.15));

    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(-1.1, 1.5, 1.2);
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(0x93b6d8, 0.85);
    rim.position.set(1.6, -0.6, -1.0);
    this.scene.add(rim);

    this.group = new THREE.Group();
    const { rifle, mats } = buildRifle();
    this.mats = mats;
    this.group.add(rifle);
    this.scene.add(this.group);

    // Hip carry: lower right of frame, canted so the muzzle leans toward the
    // centre line. Sized by eye — the rifle is deliberately small enough in frame
    // that the treeline stays readable above it, because that treeline is the
    // game. Positions are metres in the weapon scene's own space, not the world's.
    this.group.scale.setScalar(0.9);
    this.hip = new THREE.Vector3(0.23, -0.25, -0.9);
    this.hipRot = new THREE.Euler(0, 0.16, 0.05);

    // Shoulder carry: where the rifle goes as the scope comes up — pulled in and
    // centred so the ocular rises toward the aim line while the DOM glass fades
    // in over it. At 1 the view is fully behind the scope and the rifle leaves
    // frame; the two never have to agree pixel-perfect, just hand over cleanly.
    this.aimed = new THREE.Vector3(0.0, -0.075, -0.42);
    this.aimedRot = new THREE.Euler(-0.02, 0, 0);

    // Muzzle flash. A sprite plus a light, both switched on by the recoil value
    // main.js pushes in — so the flash is a consequence of the shot rather than
    // a timer that could drift out of step with the sound.
    const { canvas, ctx } = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      return { canvas: c, ctx: c.getContext('2d') };
    })();
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,244,214,0.95)');
    grad.addColorStop(0.35, 'rgba(255,196,110,0.55)');
    grad.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    this.flash = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(canvas),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0,
      })
    );
    this.flash.position.set(0, 0.012, -1.06);
    this.flash.scale.set(0.34, 0.34, 1);
    this.group.add(this.flash);

    this.flashLight = new THREE.PointLight(0xffc074, 0, 1.6, 2);
    this.flashLight.position.set(0, 0.02, -1.02);
    this.group.add(this.flashLight);

    this.sway = { x: 0, y: 0 };
    this.group.visible = false;
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  // Repaint the chassis per weapon choice. Same geometry — the silhouette is a
  // scoped bolt rifle either way — but a parkerised M/28 and a tan-and-brown LRS
  // should not read as the same rifle at the hip.
  setSkin(gun) {
    if (!this.mats) return;
    this.mats.poly.color.setHex(gun.chassis);
    this.mats.dark.color.setHex(gun.chassis).multiplyScalar(0.72);
  }

  // `speed` is metres per second, `phase` the walk cycle, `recoil` 0..1 and
  // `scopeT` the scope raise progress (0 hip, 1 behind glass).
  update(dt, { visible, speed, phase, swayYaw, swayPitch, recoil, scopeT = 0 }) {
    // Fully behind the glass the DOM scope owns the centre of the screen, so the
    // rifle bows out at the end of the raise.
    const t = scopeT * scopeT * (3 - 2 * scopeT);
    this.group.visible = Boolean(visible) && t < 0.94;
    if (!this.group.visible) return;

    // Ease the breathing sway so the rifle drifts and settles instead of
    // mirroring the sine wave exactly.
    const k = Math.min(1, dt * 8);
    this.sway.x += (swayYaw - this.sway.x) * k;
    this.sway.y += (swayPitch - this.sway.y) * k;

    // Bob is driven by actual ground speed, so a walk, a crouch and a sprint all
    // move the rifle by different amounts without a second set of constants. As
    // the rifle is braced into the shoulder, the wobble damps almost to nothing.
    const braced = 1 - t * 0.85;
    const bob = Math.min(1, speed / 6) * braced;
    const bobX = Math.sin(phase) * 0.014 * bob;
    const bobY = Math.abs(Math.cos(phase)) * 0.011 * bob;

    this.group.position.set(
      THREE.MathUtils.lerp(this.hip.x, this.aimed.x, t) + this.sway.x * 1.6 * braced + bobX,
      THREE.MathUtils.lerp(this.hip.y, this.aimed.y, t) + this.sway.y * 1.6 * braced + bobY,
      THREE.MathUtils.lerp(this.hip.z, this.aimed.z, t) + recoil * 0.055
    );
    this.group.rotation.set(
      THREE.MathUtils.lerp(this.hipRot.x, this.aimedRot.x, t) - recoil * 0.3 * braced,
      THREE.MathUtils.lerp(this.hipRot.y, this.aimedRot.y, t) + this.sway.x * 0.6 * braced,
      THREE.MathUtils.lerp(this.hipRot.z, this.aimedRot.z, t) +
        this.sway.y * 0.4 * braced +
        Math.sin(phase) * 0.012 * bob
    );

    const flash = Math.max(0, recoil);
    this.flash.material.opacity = flash * 1.2;
    this.flashLight.intensity = flash * 5;
  }

  // Drawn after the world, with the depth buffer wiped, so the rifle sits on top
  // of the scene without ever punching through it.
  render(renderer) {
    if (!this.group.visible) return;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.autoClear = true;
  }
}

// Ambient wildlife.
//
// The point is not targets — shooting animals is off-brand for this game and
// always will be — and not density either. It is that an arctic forest complete
// silence reads as fake. A few animals that belong to each place move, graze
// and scatter when the rifle speaks, which makes the quiet between shots feel
// like weather, not like an empty room.
//
// One small figure per animal, a wander circle around a home point, and a flee
// reflex on loud noise or close approach. Ravens circle; everything else stays
// near the ground. Nothing here touches game rules: the scene layer draws, the
// game layer only calls scare() when a shot goes out.

import * as THREE from 'three';
import { terrainHeight } from './terrain.js';

function mat(color, roughness = 0.95) {
  return new THREE.MeshStandardMaterial({ color, roughness });
}

function part(group, geo, material, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.scale.set(sx, sy, sz);
  group.add(mesh);
  return mesh;
}

// ---- Species ---------------------------------------------------------------

// Mountain hare: white, small, and all ears. Hop bob when moving.
function buildHare() {
  const white = mat(0xe8edf1);
  const dark = mat(0x39312b);
  const g = new THREE.Group();
  part(g, new THREE.SphereGeometry(0.16, 6, 5), white, 0, 0.17, 0, 0, 0, 0, 1, 0.9, 1.35);
  part(g, new THREE.SphereGeometry(0.08, 6, 4), white, 0, 0.28, -0.2);
  // Ears, laid back until it moves — a flat ear reads as either the wind or a
  // very winded rabbit; both are fine.
  part(g, new THREE.CylinderGeometry(0.018, 0.03, 0.26, 4), dark, 0.05, 0.48, -0.14, 0.5);
  part(g, new THREE.CylinderGeometry(0.018, 0.03, 0.26, 4), dark, -0.05, 0.48, -0.14, 0.5);
  return g;
}

// Reindeer: scoped by silhouette — a chest, a neck and antler forks. Four legs
// as a single dark cross-shape reads fine beyond 30 m and saves the vertices
// for the head, which is where the eye looks first.
function buildReindeer() {
  const hide = mat(0x5f4a38);
  const dark = mat(0x35291f);
  const g = new THREE.Group();
  // Body tilted up slightly at the shoulder, as they actually stand.
  part(g, new THREE.BoxGeometry(0.52, 0.6, 1.2), hide, 0, 1.05, -0.05, 0, 0, 0, 1, 1, 1.25);
  part(g, new THREE.BoxGeometry(0.2, 0.62, 0.26), hide, 0, 1.42, -0.78, 0.45);
  part(g, new THREE.BoxGeometry(0.2, 0.26, 0.42), hide, 0, 1.68, -1.02);
  part(g, new THREE.BoxGeometry(0.05, 0.28, 0.05), dark, 0.12, 1.95, -1.0, 0.3, 0, 0.5);
  part(g, new THREE.BoxGeometry(0.05, 0.28, 0.05), dark, -0.12, 1.95, -1.0, 0.3, 0, -0.5);
  // The cross of legs.
  part(g, new THREE.BoxGeometry(0.09, 0.95, 0.09), dark, 0.16, 0.5, -0.5);
  part(g, new THREE.BoxGeometry(0.09, 0.95, 0.09), dark, -0.16, 0.5, -0.5);
  part(g, new THREE.BoxGeometry(0.09, 0.95, 0.09), dark, 0.16, 0.5, 0.45);
  part(g, new THREE.BoxGeometry(0.09, 0.95, 0.09), dark, -0.16, 0.5, 0.45);
  return g;
}

// Fox: low, rusty, with the tail that makes shape read at distance.
function buildFox() {
  const coat = mat(0x9a5f38);
  const dark = mat(0x4a3628);
  const g = new THREE.Group();
  part(g, new THREE.BoxGeometry(0.24, 0.26, 0.72), coat, 0, 0.34, 0);
  part(g, new THREE.BoxGeometry(0.18, 0.2, 0.3), coat, 0, 0.46, -0.5);
  part(g, new THREE.ConeGeometry(0.035, 0.12, 4), dark, 0.08, 0.6, -0.42);
  part(g, new THREE.ConeGeometry(0.035, 0.12, 4), dark, -0.08, 0.6, -0.42);
  part(g, new THREE.CylinderGeometry(0.07, 0.04, 0.55, 5), coat, 0, 0.42, 0.62, -1.15);
  return g;
}

// Raven: two wing panels on a body, flown in a wide circle. No shadows — it is
// usually against sky or snow, and a shadow disc two hundred metres across
// would cost more texture updates than it earns.
function buildRaven() {
  const black = mat(0x1c1e20, 0.8);
  const g = new THREE.Group();
  part(g, new THREE.SphereGeometry(0.09, 5, 4), black, 0, 0, 0, 0, 0, 0, 1, 0.8, 1.5);
  const left = part(g, new THREE.BoxGeometry(0.42, 0.02, 0.14), black, -0.28, 0.02, 0);
  const right = part(g, new THREE.BoxGeometry(0.42, 0.02, 0.14), black, 0.28, 0.02, 0);
  return { g, left, right };
}

// ---- Population per place --------------------------------------------------

const ROSTERS = {
  // Kollaa's still cold air: reindeer browse the treeline, hares bolt between
  // shrubs, and one distant raven drifts the wind.
  kollaa: [
    { kind: 'reindeer', count: 2 },
    { kind: 'hare', count: 3 },
    { kind: 'raven', count: 1 },
  ],
  // A blizzard is hare country: they shelter low while the wind does the
  // hiding. Big animals bed down and stay out of it.
  lake: [{ kind: 'hare', count: 4 }],
  // Suomussalmi's fog and ruins: a fox working the burnt houses.
  village: [
    { kind: 'hare', count: 3 },
    { kind: 'fox', count: 1 },
  ],
  // Salla's open ridges: the reindeer herd is what you'd actually see, and
  // ravens mark the column lanes like they always seem to.
  ridge: [
    { kind: 'reindeer', count: 2 },
    { kind: 'raven', count: 3 },
  ],
};

export function createAnimals(scene, map) {
  const group = new THREE.Group();
  const animals = [];
  const roster = ROSTERS[map.id] || ROSTERS.kollaa;

  // Keep animal homes off the middle lane and out of the line's back garden,
  // so nothing wanders through the first-person brush constantly.
  function homeSpot() {
    for (let tryn = 0; tryn < 20; tryn++) {
      const x = (Math.random() < 0.5 ? -1 : 1) * (16 + Math.random() * 90);
      const z = -110 + Math.random() * 130;
      if (map.hides && map.hides.some((h) => Math.hypot(h.x - x, h.z - z) < 14)) continue;
      return { x, z };
    }
    return { x: 40, z: -40 };
  }

  const spawnGround = (kind, count) => {
    const build = kind === 'hare' ? buildHare : kind === 'reindeer' ? buildReindeer : buildFox;
    for (let i = 0; i < count; i++) {
      const home = homeSpot();
      const figure = build();
      figure.castShadow = kind === 'reindeer';
      figure.position.set(home.x, terrainHeight(home.x, home.z, map), home.z);
      group.add(figure);

      animals.push({
        kind,
        figure,
        home,
        x: home.x,
        z: home.z,
        heading: Math.random() * Math.PI * 2,
        // Each animal keeps its own clock so a group doesn't graze in lockstep
        // — identical timings is the tell that a background system is one
        // array of clones.
        timer: Math.random() * 5,
        state: 'settle',
        speed: 0,
        bob: Math.random() * Math.PI * 2,
      });
    }
  };

  const spawnRavens = (count) => {
    for (let i = 0; i < count; i++) {
      const raven = buildRaven();
      const home = homeSpot();
      group.add(raven.g);
      animals.push({
        kind: 'raven',
        figure: raven.g,
        wings: { left: raven.left, right: raven.right },
        home,
        angle: Math.random() * Math.PI * 2,
        radius: 18 + Math.random() * 22,
        height: 13 + Math.random() * 9,
        rate: (0.14 + Math.random() * 0.16) * (Math.random() < 0.5 ? -1 : 1),
        flap: Math.random() * Math.PI * 2,
      });
    }
  };

  for (const entry of roster) {
    if (entry.kind === 'raven') spawnRavens(entry.count);
    else spawnGround(entry.kind, entry.count);
  }

  scene.add(group);

  // ---- Behaviour ----------------------------------------------------------

  function flee(fromX, fromZ) {
    for (const a of animals) {
      if (a.kind === 'raven') continue;
      const d = Math.hypot(a.x - fromX, a.z - fromZ);
      // A rifle crack clears out anything within earshot; the far side of the
      // woods doesn't care.
      if (d > 55) continue;
      a.state = 'flee';
      a.timer = 3.5 + Math.random() * 2;
      a.heading = Math.atan2(a.x - fromX, a.z - fromZ);
      a.speed = a.kind === 'reindeer' ? 5.2 : 7.5;
      // Hares zig; reindeer just go.
      if (a.kind === 'hare') a.heading += (Math.random() - 0.5) * 1.2;
    }
  }

  function update(dt, playerX, playerZ) {
    for (const a of animals) {
      if (a.kind === 'raven') {
        // Circle high over its home patch, wings beating. The slow vertical
        // sine stops the orbit reading as a car on a roundabout.
        a.angle += a.rate * dt;
        a.flap += dt * 9;
        const wingBeat = Math.sin(a.flap) * 0.5;
        a.wings.left.rotation.z = wingBeat;
        a.wings.right.rotation.z = -wingBeat;
        a.figure.position.set(
          a.home.x + Math.cos(a.angle) * a.radius,
          a.height + Math.sin(a.angle * 2.3) * 1.6,
          a.home.z + Math.sin(a.angle) * a.radius
        );
        a.figure.rotation.y = -a.angle - (a.rate > 0 ? Math.PI / 2 : -Math.PI / 2);
        continue;
      }

      a.timer -= dt;
      if (a.state === 'flee') {
        if (a.timer <= 0) {
          a.state = 'settle';
          a.timer = 2 + Math.random() * 4;
          a.speed = 0;
        }
      } else if (a.timer <= 0) {
        // A person within 15 m is scarier than distant thunder: flare first,
        // even without a shot.
        const playerD = Math.hypot(a.x - playerX, a.z - playerZ);
        if (playerD < 15) {
          flee(playerX, playerZ);
          continue;
        }
        a.state = a.state === 'settle' && Math.random() < 0.55 ? 'settle' : 'wander';
        if (a.state === 'wander') {
          a.heading += (Math.random() - 0.5) * 1.6;
          a.speed = a.kind === 'reindeer' ? 0.9 : 1.5;
          a.timer = 2.5 + Math.random() * 4;
        } else {
          a.speed = 0;
          a.timer = 3 + Math.random() * 5;
        }
      }

      if (a.speed > 0) {
        // Step, keep inside a loose circle of home, and hop for the hare: the
        // bounce is the whole read for a small white animal in white snow.
        a.x += Math.sin(a.heading) * a.speed * dt;
        a.z += Math.cos(a.heading) * a.speed * dt;
        const fromHome = Math.hypot(a.x - a.home.x, a.z - a.home.z);
        if (fromHome > 24) {
          a.heading = Math.atan2(a.home.x - a.x, a.home.z - a.z);
          if (a.state !== 'flee') a.state = 'wander';
        }
        a.bob += dt * (a.kind === 'hare' ? 14 : 7);
        a.figure.position.set(a.x, 0, a.z);
        const gy = terrainHeight(a.x, a.z, map);
        const hop = a.kind === 'hare' ? Math.abs(Math.sin(a.bob)) * 0.18 : 0;
        a.figure.position.y = gy + hop;
      } else {
        a.figure.position.y = terrainHeight(a.x, a.z, map) + Math.sin(a.bob) * 0.01;
      }
      a.figure.rotation.y = a.heading + Math.PI;
    }
  }

  return { update, flee, animals };
}

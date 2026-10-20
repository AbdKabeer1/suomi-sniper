import * as THREE from 'three';
import { LINE_Z } from '../data/maps.js';
import { terrainHeight } from './terrain.js';
import { createAnimals } from './animals.js';

// The world each map is played in.
//
// Everything is drawn in code and trees are instanced: a Finnish forest at any
// believable density is hundreds of trees, and as individual meshes that is
// hundreds of draw calls per frame. Two or three InstancedMeshes per tree type
// keeps it at a handful.

// ---------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------

function makeCanvas(size) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  return { canvas, ctx: canvas.getContext('2d') };
}

// A per-instance brightness multiplier. Instanced props all sharing one material
// is what keeps the draw calls down, but it also means four hundred identical
// green cones. A few per cent either way is enough to break that up without a
// second material or a second draw call.
const tintColor = new THREE.Color();
function varyTint(mesh, i, amount) {
  tintColor.setScalar(1 + (Math.random() - 0.5) * 2 * amount);
  mesh.setColorAt(i, tintColor);
}

function shade(hex, amount) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h;
  const num = parseInt(full, 16);
  const target = amount < 0 ? 0 : 255;
  const p = Math.abs(amount);
  const r = Math.round(((num >> 16) & 255) * (1 - p) + target * p);
  const g = Math.round(((num >> 8) & 255) * (1 - p) + target * p);
  const b = Math.round((num & 255) * (1 - p) + target * p);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// Snow, with the faint blue shading that stops it reading as a flat white sheet
// and the odd wind-scoured patch showing darker ground underneath.
function makeSnowTexture(map) {
  const size = 1024;
  const { canvas, ctx } = makeCanvas(size);

  ctx.fillStyle = map.ground.base;
  ctx.fillRect(0, 0, size, size);

  // Wind-scoured patches.
  for (let i = 0; i < map.ground.patches; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 20 + Math.random() * 90;
    ctx.globalAlpha = 0.06 + Math.random() * 0.16;
    ctx.fillStyle = map.ground.tint;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.4 + Math.random() * 0.5), Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Wind-scoured streaks. Deliberately short and offset: full-width strokes
  // connect across the tiled texture and read as seams running to the horizon.
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = shade(map.ground.tint, -0.14);
  for (let i = 0; i < 220; i++) {
    const x0 = Math.random() * size;
    const y = Math.random() * size;
    const len = 60 + Math.random() * 220;
    ctx.lineWidth = 1 + Math.random() * 2.5;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.bezierCurveTo(x0 + len * 0.3, y + 10, x0 + len * 0.7, y - 10, x0 + len, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 14);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeSkyTexture(map) {
  const size = 512;
  const { canvas, ctx } = makeCanvas(size);

  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, map.sky.top);
  grad.addColorStop(0.5, map.sky.mid);
  grad.addColorStop(0.78, map.sky.bottom || map.sky.low);
  grad.addColorStop(1, map.sky.low);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Wind-stretched cloud bands, thin and low. Ellipses that cross an edge are
  // repeated on the other side so the texture still wraps without a seam.
  const cloudAlpha =
    map.weather === 'bright' ? 0.22 : map.weather === 'clear' ? 0.28 : map.weather === 'fog' ? 0.14 : 0.1;
  ctx.fillStyle = `rgba(255, 255, 255, ${cloudAlpha})`;
  for (let i = 0; i < 46; i++) {
    const y = size * (0.28 + Math.random() * 0.42);
    const w = 30 + Math.random() * 170;
    const h = 3 + Math.random() * 12;
    const x = Math.random() * size;

    const draw = (cx) => {
      ctx.beginPath();
      ctx.ellipse(cx, y, w, h, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    draw(x);
    if (x - w < 0) draw(x + size);
    if (x + w > size) draw(x - size);
  }

  // A pale haze right at the horizon, where winter air actually sits.
  const haze = ctx.createLinearGradient(0, size * 0.6, 0, size * 0.86);
  haze.addColorStop(0, 'rgba(255,255,255,0)');
  haze.addColorStop(0.6, 'rgba(255,255,255,0.18)');
  haze.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, size * 0.6, size, size * 0.26);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------------------
// Scenery
// ---------------------------------------------------------------------------

function createSky(map) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(700, 32, 16),
    new THREE.MeshBasicMaterial({
      map: makeSkyTexture(map),
      side: THREE.BackSide,
      fog: false, // the sky must not be swallowed by the haze that fogs the land
    })
  );
  return mesh;
}

function createGround(map) {
  // 200 segments across 1200 m is a 6 m grid. The shortest terrain wave is
  // about 55 m, so that is several samples per bump — and it keeps the vertex
  // count somewhere a mid-range phone can carry. The mesh is rotated into world
  // space first so the height function sees real x/z, not plane-local coords.
  const geo = new THREE.PlaneGeometry(1200, 1200, 200, 200);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i), map));
  }
  geo.computeVertexNormals();

  const ground = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ map: makeSnowTexture(map), roughness: 1 })
  );
  ground.receiveShadow = true;
  return ground;
}

// Where the trees stand. Kept so the game can check line of sight against them
// later without walking the scene graph.
function scatterTrees(map) {
  const spots = [];
  const { count, spread, near, far, type } = map.trees;
  const camp = map.campCenter;

  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * spread * 2;
    const z = near + Math.random() * (far - near);
    // Keep a clear corridor in the middle so the approach is readable, and keep
    // trunks out of the hides themselves — a tree grown through the player's
    // back is not a forest, it is a bug.
    if (Math.abs(x) < 6 && z > -120) continue;
    if ((map.hides || []).some((h) => Math.hypot(h.x - x, h.z - z) < 9)) continue;
    // A tree growing through a tent is the same bug with a different roof.
    if (camp && Math.hypot(camp.x - x, camp.z - z) < 24) continue;
    spots.push({
      x,
      z,
      y: terrainHeight(x, z, map),
      scale: 0.68 + Math.random() * 0.55,
      rotation: Math.random() * Math.PI * 2,
      type,
    });
  }
  return spots;
}

function createForest(spots) {
  const group = new THREE.Group();
  const pines = spots.filter((s) => s.type === 'pine');
  const birches = spots.filter((s) => s.type === 'birch');

  const dummy = new THREE.Object3D();

  function fill(mesh, list, place, vary = 0) {
    list.forEach((spot, i) => {
      place(dummy, spot);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      varyTint(mesh, i, vary);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    group.add(mesh);
  }

  // ---- Pines: trunk, three foliage tiers, snow settled on each ----
  //
  // Three tiers rather than two. A two-cone tree is a party hat, and at 150
  // metres the silhouette is the only thing you can identify a tree by — which
  // matters, because these are also the things you check line of sight against.
  if (pines.length) {
    const barkMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 1 });
    const needleMat = new THREE.MeshStandardMaterial({ color: 0x33513c, roughness: 1 });
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xf4f8fb, roughness: 0.85 });

    const trunkH = 3.8;
    const trunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.13, 0.2, trunkH, 6),
      barkMat,
      pines.length
    );

    fill(
      trunks,
      pines,
      (d, s) => {
        d.position.set(s.x, s.y + (trunkH * s.scale) / 2, s.z);
        d.rotation.set(0, s.rotation, 0);
        d.scale.setScalar(s.scale);
      },
      0.14
    );

    // Height above the base, in unscaled metres. The tiers overlap by a third of
    // their height so the fir reads as stacked skirts rather than as three cones
    // balanced on each other.
    const tiers = [
      { r: 1.24, h: 4.2, y: 5.8, snowR: 0.72, snowH: 2.1, snowY: 6.9 },
      { r: 1.0, h: 3.6, y: 7.1, snowR: 0.6, snowH: 1.8, snowY: 8.1 },
      { r: 0.78, h: 3.0, y: 8.4, snowR: 0.46, snowH: 1.4, snowY: 9.2 },
    ];

    for (const tier of tiers) {
      const green = new THREE.InstancedMesh(
        new THREE.ConeGeometry(tier.r, tier.h, 8),
        needleMat,
        pines.length
      );
      const snow = new THREE.InstancedMesh(
        new THREE.ConeGeometry(tier.snowR, tier.snowH, 8),
        snowMat,
        pines.length
      );

      fill(
        green,
        pines,
        (d, s) => {
          d.position.set(s.x, s.y + tier.y * s.scale, s.z);
          d.rotation.set(0, s.rotation, 0);
          d.scale.setScalar(s.scale);
        },
        0.24
      );
      // The snow sits inset by a hair and low on the tier, so the green shows
      // as a rim underneath — the way snow actually settles on a branch rather
      // than as a separate white cone.
      fill(
        snow,
        pines,
        (d, s) => {
          d.position.set(s.x, s.y + tier.snowY * s.scale, s.z);
          d.rotation.set(0, s.rotation + 0.22, 0);
          d.scale.set(s.scale * 0.97, s.scale * 1.02, s.scale * 0.97);
        },
        0.05
      );
    }
  }

  // ---- Birches: bare white trunks, the skeleton of a winter wood ----
  if (birches.length) {
    const birchMat = new THREE.MeshStandardMaterial({ color: 0xe8e6e0, roughness: 0.9 });
    const twigMat = new THREE.MeshStandardMaterial({ color: 0x7b6f60, roughness: 1 });

    const TWIGS = 5;
    const trunkH = 6.5;
    const trunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.09, 0.16, trunkH, 6),
      birchMat,
      birches.length
    );
    // Short and steeply raked. Long near-horizontal cylinders read as rusted
    // rebar poking out of the trunk; a winter crown forks upward and thin.
    const twigs = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.016, 0.03, 1.7, 4),
      twigMat,
      birches.length * TWIGS
    );

    fill(
      trunks,
      birches,
      (d, s) => {
        d.position.set(s.x, s.y + (trunkH * s.scale) / 2, s.z);
        d.rotation.set(0, s.rotation, (Math.random() - 0.5) * 0.08);
        d.scale.setScalar(s.scale);
      },
      0.08
    );

    twigs.count = birches.length * TWIGS;
    birches.forEach((s, i) => {
      for (let k = 0; k < TWIGS; k++) {
        const a = s.rotation + (k / TWIGS) * Math.PI * 2 + Math.random() * 0.6;
        const up = 1.4 + Math.random() * 1.1; // how far below the tip it forks
        const lean = 0.42 + Math.random() * 0.3; // how far off vertical

        dummy.position.set(
          s.x + Math.sin(a) * 0.2 * s.scale,
          s.y + (trunkH - up) * s.scale,
          s.z + Math.cos(a) * 0.2 * s.scale
        );
        dummy.rotation.set(Math.cos(a) * lean, 0, -Math.sin(a) * lean);
        dummy.scale.setScalar(s.scale * (0.75 + Math.random() * 0.6));
        dummy.updateMatrix();
        twigs.setMatrixAt(i * TWIGS + k, dummy.matrix);
      }
    });
    twigs.instanceMatrix.needsUpdate = true;
    twigs.castShadow = true;
    group.add(trunks, twigs);
  }

  return group;
}

// A burnt-out timber house, for the village. Four walls with the roof gone.
function createRuin(width = 8, depth = 6, height = 3.4, groundY = 0) {
  const ruin = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x8a7a68, roughness: 1 });
  const charMat = new THREE.MeshStandardMaterial({ color: 0x2f2a25, roughness: 1 });

  const t = 0.35;
  const walls = [
    { w: width, d: t, x: 0, z: -depth / 2, h: height },
    { w: t, d: depth, x: -width / 2, z: 0, h: height },
    { w: t, d: depth, x: width / 2, z: 0, h: height * 0.6 }, // one wall half down
    { w: width * 0.45, d: t, x: -width * 0.25, z: depth / 2, h: height * 0.8 },
  ];

  for (const w of walls) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w.w, w.h, w.d), wallMat);
    mesh.position.set(w.x, groundY + w.h / 2, w.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    ruin.add(mesh);
  }

  // Charred beams, fallen across the opening.
  for (let i = 0; i < 4; i++) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, depth * 0.9), charMat);
    beam.position.set(
      -width / 2 + 1.5 + i * 1.8,
      groundY + height * 0.55 + Math.random(),
      Math.random() * 1.5
    );
    beam.rotation.x = (Math.random() - 0.5) * 0.5;
    beam.rotation.z = (Math.random() - 0.5) * 0.3;
    beam.castShadow = true;
    ruin.add(beam);
  }

  return ruin;
}

function createVillage(map) {
  const group = new THREE.Group();
  const layout = [
    [-42, -30, 9, 7, 0.2],
    [34, -44, 11, 6, -0.35],
    [-58, -62, 8, 8, 0.6],
    [52, -26, 7, 6, 0.1],
    [-18, -78, 10, 7, -0.2],
    [22, -96, 9, 6, 0.45],
  ];
  for (const [x, z, w, d, rot] of layout) {
    const ruin = createRuin(w, d, 3.4, terrainHeight(x, z, map));
    ruin.position.set(x, 0, z);
    ruin.rotation.y = rot;
    group.add(ruin);
  }

  // A few charred stumps where a fence was.
  const stumpMat = new THREE.MeshStandardMaterial({ color: 0x2f2a25, roughness: 1 });
  for (let i = 0; i < 40; i++) {
    const x = (Math.random() - 0.5) * 160;
    const z = -20 - Math.random() * 90;
    const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.6 + Math.random(), 5), stumpMat);
    stump.position.set(x, terrainHeight(x, z, map) + 0.3, z);
    stump.castShadow = true;
    group.add(stump);
  }
  return group;
}

// ---------------------------------------------------------------------------
// The enemy camp
//
// A line of walking men on empty snow reads as a shooting gallery. The camp is
// what turns the far side of the map into a *place*: tents with canvas and
// stove smoke, a truck, a flag, supply crates worth shooting, and two timber
// watchtowers with men in them. It is also the source of the sabotage
// objectives — the crates are real objects with a hit radius, not set dressing.
//
// The whole camp is built in world coordinates (the group is not translated),
// because the tower spots and crate positions have to be handed to the enemy
// and round layers exactly as they appear in the scene.
// ---------------------------------------------------------------------------

const TOWER_H = 3.4;

function createTent(map, x, z, rot, scale = 1) {
  const g = new THREE.Group();
  const canvas = new THREE.MeshStandardMaterial({ color: 0x77785f, roughness: 1 });
  const snow = new THREE.MeshStandardMaterial({ color: 0xe7eff5, roughness: 0.95 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2d2a24, roughness: 1 });

  const w = 3.4 * scale;
  const d = 3.0 * scale;
  const h = 1.9 * scale;

  // Two leaning panels make the A-frame. Rotating thin slabs rather than
  // building a prism keeps the vertex count down and still reads as a ridge
  // tent at any distance the game is played at.
  for (const side of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w * 0.62, 0.055, d), canvas);
    panel.position.set(side * w * 0.235, h * 0.5, 0);
    panel.rotation.z = -side * 0.62;
    panel.castShadow = true;
    g.add(panel);
  }

  // A strip of snow along the ridge, and the ridge pole itself.
  const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, d, 5), dark);
  ridge.rotation.x = Math.PI / 2;
  ridge.position.y = h;
  g.add(ridge);

  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, d), snow);
  cap.position.y = h + 0.03;
  g.add(cap);

  // The door is a dark mouth at the front, which is what makes it read as a
  // shelter with an inside rather than a canvas lump.
  const door = new THREE.Mesh(new THREE.BoxGeometry(w * 0.3, h * 0.62, 0.04), dark);
  door.position.set(0, h * 0.31, -d * 0.5 - 0.02);
  g.add(door);

  g.position.set(x, terrainHeight(x, z, map), z);
  g.rotation.y = rot;
  return g;
}

function createWatchtower(map, x, z, rot) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x3b2d21, roughness: 1 });
  const snow = new THREE.MeshStandardMaterial({ color: 0xe7eff5, roughness: 0.95 });

  // Splayed legs, one per corner.
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.11, TOWER_H, 5), wood);
    leg.position.set(sx * 0.92, TOWER_H / 2, sz * 0.92);
    leg.rotation.z = -sx * 0.055;
    leg.rotation.x = sz * 0.055;
    leg.castShadow = true;
    g.add(leg);
  }

  // Two cross braces so the legs read as one structure.
  for (const sz of [-1, 1]) {
    const brace = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 0.07), wood);
    brace.position.set(0, TOWER_H * 0.52, sz * 0.92);
    g.add(brace);
  }

  // Deck and a waist-high rail on three sides (the fourth is the ladder).
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.16, 2.7), darkWood);
  deck.position.y = TOWER_H;
  deck.castShadow = true;
  deck.receiveShadow = true;
  g.add(deck);

  for (const [px, pz] of [
    [-1.2, -1.2],
    [1.2, -1.2],
    [-1.2, 1.2],
    [1.2, 1.2],
  ]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.85, 0.08), wood);
    post.position.set(px, TOWER_H + 0.5, pz);
    g.add(post);
  }
  for (const [rx, rz, w, d] of [
    [0, -1.2, 2.5, 0.07],
    [-1.2, 0, 0.07, 2.5],
    [1.2, 0, 0.07, 2.5],
  ]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, d), wood);
    rail.position.set(rx, TOWER_H + 0.82, rz);
    g.add(rail);
  }

  // A shallow roof on four short posts. The snow slab is the part that catches
  // the sun from the player's side, which is how the tower is found at 150 m.
  for (const [px, pz] of [
    [-1.1, -1.1],
    [1.1, -1.1],
    [-1.1, 1.1],
    [1.1, 1.1],
  ]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.5, 0.07), darkWood);
    post.position.set(px, TOWER_H + 1.55, pz);
    g.add(post);
  }

  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.1, 3.1), darkWood);
  roof.position.y = TOWER_H + 2.32;
  roof.castShadow = true;
  g.add(roof);

  const roofSnow = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.09, 3.0), snow);
  roofSnow.position.y = TOWER_H + 2.4;
  g.add(roofSnow);

  // Ladder on the back face: two rails and four rungs is enough to read.
  for (const sx of [-0.42, 0.42]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, TOWER_H, 0.06), wood);
    rail.position.set(sx, TOWER_H / 2, 1.42);
    g.add(rail);
  }
  for (let i = 0; i < 4; i++) {
    const rung = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.05), wood);
    rung.position.set(0, 0.55 + i * 0.75, 1.42);
    g.add(rung);
  }

  g.position.set(x, terrainHeight(x, z, map), z);
  g.rotation.y = rot;
  return g;
}

function createTruck(map, x, z, rot) {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0x4e5347, roughness: 0.9 });
  const canvas = new THREE.MeshStandardMaterial({ color: 0x6e6c55, roughness: 1 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x1d1c19, roughness: 1 });

  const bed = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.6, 4.0), body);
  bed.position.set(0, 0.85, 0.4);
  bed.castShadow = true;
  g.add(bed);

  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.15, 1.5), body);
  cab.position.set(0, 1.15, -2.1);
  cab.castShadow = true;
  g.add(cab);

  // Canvas tilt over the bed — the thing that makes a truck read as a truck
  // from three hundred metres.
  const cover = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.25, 3.4), canvas);
  cover.position.set(0, 1.75, 0.6);
  cover.castShadow = true;
  g.add(cover);

  for (const [wx, wz] of [
    [-1.0, -2.0],
    [1.0, -2.0],
    [-1.0, 1.2],
    [1.0, 1.2],
  ]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.24, 10), tyre);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.46, wz);
    wheel.castShadow = true;
    g.add(wheel);
  }

  g.position.set(x, terrainHeight(x, z, map), z);
  g.rotation.y = rot;
  return g;
}

function createCrate(map, x, z, rot) {
  const wood = new THREE.MeshStandardMaterial({ color: 0x9a7647, roughness: 0.95 });
  const band = new THREE.MeshStandardMaterial({ color: 0x5a3a1f, roughness: 0.95 });

  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.7, 0.92), wood);
  box.castShadow = true;
  box.receiveShadow = true;
  g.add(box);

  // Dark slats. The crate has to read as a target, not as another snow lump.
  for (const zOff of [-0.28, 0.28]) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.09, 0.08), band);
    slat.position.set(0, 0.28, zOff);
    g.add(slat);
  }

  g.position.set(x, terrainHeight(x, z, map) + 0.35, z);
  g.rotation.y = rot;
  return g;
}

function createBarrel(map, x, z) {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x3f4a44, roughness: 0.7, metalness: 0.3 });
  const band = new THREE.MeshStandardMaterial({ color: 0x8a3b22, roughness: 0.8 });

  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.95, 10), steel);
  drum.position.y = 0.475;
  drum.castShadow = true;
  g.add(drum);

  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.16, 10), band);
  stripe.position.y = 0.62;
  g.add(stripe);

  g.position.set(x, terrainHeight(x, z, map), z);
  return g;
}

function createCamp(map) {
  const group = new THREE.Group();
  const rnd = Math.random;

  // Blizzards hide everything past 110 m, so that camp sits closer to the line
  // — otherwise the map's whole enemy presence would be invisible weather.
  const blizzard = map.weather === 'blizzard';
  const cx = (rnd() < 0.5 ? -1 : 1) * (26 + rnd() * 14);
  const cz = (blizzard ? -66 : -94) - rnd() * 16;

  // Trampled ground: the clearing the camp has worn into the snow.
  const patch = new THREE.Mesh(
    new THREE.CircleGeometry(17, 24),
    new THREE.MeshStandardMaterial({
      color: 0x6f6a5e,
      roughness: 1,
      transparent: true,
      opacity: 0.42,
    })
  );
  patch.rotation.x = -Math.PI / 2;
  patch.position.set(cx, terrainHeight(cx, cz, map) + 0.03, cz);
  group.add(patch);

  // Tents: three shelters and one command tent, spread around the clearing.
  const tents = [
    [cx - 10, cz + 5, 0.18, 1],
    [cx + 11, cz + 6, -0.32, 1],
    [cx - 8, cz - 8, 1.25, 1],
    [cx + 3, cz + 10, 0.08, 1.28],
  ];
  for (const [tx, tz, rot, scale] of tents) {
    group.add(createTent(map, tx, tz, rot, scale));
  }

  // Two watchtowers on the camp's forward corners. Their platform heights are
  // handed to the enemy layer so men can actually stand up there.
  const towers = [];
  const towerSpots = [
    [cx - 15, cz - 5, -0.38],
    [cx + 16, cz - 3, 0.52],
  ];
  for (const [tx, tz, rot] of towerSpots) {
    group.add(createWatchtower(map, tx, tz, rot));
    towers.push({
      x: tx,
      z: tz,
      y: terrainHeight(tx, tz, map) + TOWER_H + 0.1,
    });
  }

  // Supply crates — these are the sabotage targets. Their world positions and
  // meshes are handed to the round so a shot can break them.
  const crates = [];
  const crateSpots = [
    [cx + 3.5, cz - 9.5, 0.28],
    [cx + 5.2, cz - 10.1, 0.9],
    [cx - 3.2, cz - 10.4, -0.22],
    [cx + 8.4, cz + 1.2, 0.55],
    [cx - 6.2, cz + 0.8, 0.85],
  ];
  for (const [x, z, rot] of crateSpots) {
    const mesh = createCrate(map, x, z, rot);
    group.add(mesh);
    crates.push({ mesh, x, z, y: mesh.position.y, alive: true });
  }

  for (const [bx, bz] of [
    [cx + 7.5, cz - 3.2],
    [cx + 8.3, cz - 4.3],
    [cx - 2.2, cz - 6.5],
    [cx - 11.5, cz + 8.5],
  ]) {
    group.add(createBarrel(map, bx, bz));
  }

  group.add(createTruck(map, cx + 12, cz - 11, 0.42));

  // Camp fire: three logs and an ember cone. One small point light, no shadow —
  // at this distance the glow is the read, not the lighting.
  const fireX = cx - 1;
  const fireZ = cz + 2.5;
  const fireY = terrainHeight(fireX, fireZ, map);
  const logMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 1 });
  for (let i = 0; i < 3; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.1, 5), logMat);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (i / 3) * Math.PI;
    log.position.set(fireX, fireY + 0.11, fireZ);
    group.add(log);
  }
  const ember = new THREE.Mesh(
    new THREE.ConeGeometry(0.3, 0.55, 6),
    new THREE.MeshBasicMaterial({ color: 0xffa142 })
  );
  ember.position.set(fireX, fireY + 0.38, fireZ);
  group.add(ember);
  const fireLight = new THREE.PointLight(0xff8c3a, 1.5, 14, 2);
  fireLight.position.set(fireX, fireY + 0.9, fireZ);
  group.add(fireLight);

  // Camp flag. A dark red rectangle is the one saturated colour on the map and
  // reads at a glance through the scope.
  const poleY = terrainHeight(cx + 4, cz + 13, map);
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.07, 4.2, 6),
    new THREE.MeshStandardMaterial({ color: 0x6b5a48, roughness: 1 })
  );
  pole.position.set(cx + 4, poleY + 2.1, cz + 13);
  pole.castShadow = true;
  group.add(pole);

  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.85),
    new THREE.MeshStandardMaterial({ color: 0x8a1f1a, roughness: 1, side: THREE.DoubleSide })
  );
  flag.position.set(cx + 4.82, poleY + 3.55, cz + 13);
  group.add(flag);

  // A low sandbag wall on the line-facing side.
  const bagMat = new THREE.MeshStandardMaterial({ color: 0x8b8266, roughness: 1 });
  for (let i = 0; i < 9; i++) {
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.32, 0.4), bagMat);
    bag.position.set(cx - 7 + i * 0.78, terrainHeight(cx - 7 + i * 0.78, cz + 14, map) + 0.16, cz + 14);
    bag.rotation.y = (rnd() - 0.5) * 0.25;
    bag.castShadow = true;
    group.add(bag);
  }

  // Two men on camp duty, so the camp is occupied the moment the round starts.
  const guards = [
    { x: cx + 4.5, z: cz + 5.5 },
    { x: cx - 5.5, z: cz - 3.5 },
  ];

  return {
    group,
    center: { x: cx, z: cz },
    towers,
    crates,
    guards,
  };
}

// The line you are holding: a run of marker posts across the map at z = 0.
function createLineMarker(map) {
  const group = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0x6b5a48, roughness: 1 });
  const flagMat = new THREE.MeshStandardMaterial({
    color: 0x2b4a7a,
    roughness: 1,
    side: THREE.DoubleSide,
  });

  for (let i = -16; i <= 16; i++) {
    const x = i * 9;
    const gy = terrainHeight(x, LINE_Z, map);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.6, 6), postMat);
    post.position.set(x, gy + 0.8, LINE_Z);
    post.castShadow = true;
    group.add(post);

    // Every third post gets a small blue-and-white marker.
    if (i % 3 === 0) {
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.35), flagMat);
      flag.position.set(x + 0.28, gy + 1.35, LINE_Z);
      group.add(flag);
    }
  }
  return group;
}

// Distant treeline, unlit and pale, so the map doesn't end in empty space.
function createTreeline(map) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: shade(map.sky.low || map.ground.base, -0.14),
  });

  for (let i = 0; i < 90; i++) {
    const h = 16 + Math.random() * 26;
    const x = (Math.random() - 0.5) * 900;
    const z = -230 - Math.random() * 200;
    const tree = new THREE.Mesh(new THREE.ConeGeometry(h * 0.32, h, 5), mat);
    tree.position.set(x, terrainHeight(x, z, map) + h / 2 - 3, z);
    group.add(tree);
  }
  return group;
}

// ---------------------------------------------------------------------------
// Ground cover
//
// The flat plane was the problem. These props give the eye something at every
// distance: rock and shrub at your feet, logs in the middle ground, hills on the
// horizon. All instanced, so the whole set costs a handful of draw calls.
// ---------------------------------------------------------------------------

// Positions in the band between the player and the treeline. The centre lane is
// kept a little clearer so the approach stays readable at a glance, and every
// hide gets a clear pocket — you should never open your eyes inside a bush.
function scatterProps(map, count, spread, zNear, zFar, avoidRadius = 7) {
  const hides = map.hides || [];
  const camp = map.campCenter;
  const spots = [];
  for (let i = 0; i < count; i++) {
    let x = (Math.random() - 0.5) * spread * 2;
    const z = zNear + Math.random() * (zFar - zNear);
    if (Math.abs(x) < avoidRadius && z > -110) {
      x += (x < 0 ? -1 : 1) * avoidRadius;
    }
    // Props stay well clear of every hide. The third-person camera sits several
    // metres behind the player, so a 7 m pocket still left boulders in its face.
    if (hides.some((h) => Math.hypot(h.x - x, h.z - z) < 12)) continue;
    // The camp is a clearing: no boulder through the command tent.
    if (camp && Math.hypot(camp.x - x, camp.z - z) < 20) continue;
    spots.push({ x, z });
  }
  return spots;
}

function createRocks(map) {
  const spots = scatterProps(map, map.env.rocks, 190, 65, -210);
  const group = new THREE.Group();

  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x7f8a93,
    roughness: 1,
    flatShading: true,
  });
  const snowMat = new THREE.MeshStandardMaterial({
    color: 0xe9f0f5,
    roughness: 0.95,
    flatShading: true,
  });

  const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), rockMat, spots.length);
  const caps = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.74, 0), snowMat, spots.length);
  const dummy = new THREE.Object3D();

  spots.forEach((s, i) => {
    const gy = terrainHeight(s.x, s.z, map);
    const scale = 0.35 + Math.random() * 0.75;

    dummy.position.set(s.x, gy + scale * 0.32, s.z);
    dummy.rotation.set(
      (Math.random() - 0.5) * 0.35,
      Math.random() * Math.PI * 2,
      (Math.random() - 0.5) * 0.35
    );
    dummy.scale.set(scale, scale * (0.5 + Math.random() * 0.45), scale);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);

    // The cap is the same rock, smaller and pushed up: snow that has settled in
    // the top facets.
    dummy.position.y = gy + scale * 0.72;
    dummy.scale.multiplyScalar(0.72);
    dummy.updateMatrix();
    caps.setMatrixAt(i, dummy.matrix);

    varyTint(rocks, i, 0.22);
    varyTint(caps, i, 0.06);
  });

  rocks.instanceMatrix.needsUpdate = true;
  caps.instanceMatrix.needsUpdate = true;
  if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;
  if (caps.instanceColor) caps.instanceColor.needsUpdate = true;
  rocks.castShadow = true;
  caps.castShadow = true;
  group.add(rocks, caps);
  return group;
}

function createShrubs(map) {
  const spots = scatterProps(map, map.env.shrubs, 175, 70, -195, 5);
  const group = new THREE.Group();

  const bushMat = new THREE.MeshStandardMaterial({ color: 0x46523f, roughness: 1 });
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xe2ebf1, roughness: 0.95 });

  const bushes = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), bushMat, spots.length);
  const caps = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), snowMat, spots.length);
  const dummy = new THREE.Object3D();

  spots.forEach((s, i) => {
    const gy = terrainHeight(s.x, s.z, map);
    const r = 0.3 + Math.random() * 0.75;

    dummy.position.set(s.x, gy + r * 0.2, s.z);
    dummy.rotation.set(0, Math.random() * Math.PI, 0);
    dummy.scale.set(r * 1.4, r * 0.7, r * 1.4);
    dummy.updateMatrix();
    bushes.setMatrixAt(i, dummy.matrix);

    dummy.position.y = gy + r * 0.42;
    dummy.scale.set(r * 1.2, r * 0.44, r * 1.2);
    dummy.updateMatrix();
    caps.setMatrixAt(i, dummy.matrix);

    varyTint(bushes, i, 0.24);
    varyTint(caps, i, 0.05);
  });

  bushes.instanceMatrix.needsUpdate = true;
  caps.instanceMatrix.needsUpdate = true;
  if (bushes.instanceColor) bushes.instanceColor.needsUpdate = true;
  if (caps.instanceColor) caps.instanceColor.needsUpdate = true;
  bushes.castShadow = true;
  group.add(bushes, caps);
  return group;
}

function createLogs(map) {
  const spots = scatterProps(map, map.env.logs, 160, 55, -175, 6);

  // Lying along x before the per-instance yaw, so they read as deadfall rather
  // than as posts.
  const geo = new THREE.CylinderGeometry(0.14, 0.19, 3.4, 6);
  geo.rotateZ(Math.PI / 2);

  const logs = new THREE.InstancedMesh(
    geo,
    new THREE.MeshStandardMaterial({ color: 0x584534, roughness: 1 }),
    spots.length
  );
  const dummy = new THREE.Object3D();

  spots.forEach((s, i) => {
    const gy = terrainHeight(s.x, s.z, map);
    dummy.position.set(s.x, gy + 0.15, s.z);
    dummy.rotation.set((Math.random() - 0.5) * 0.14, Math.random() * Math.PI, (Math.random() - 0.5) * 0.1);
    dummy.scale.setScalar(0.8 + Math.random() * 0.8);
    dummy.updateMatrix();
    logs.setMatrixAt(i, dummy.matrix);
    varyTint(logs, i, 0.2);
  });

  logs.instanceMatrix.needsUpdate = true;
  if (logs.instanceColor) logs.instanceColor.needsUpdate = true;
  logs.castShadow = true;
  return logs;
}

// A low ridge beyond the treeline. Unlit and hazed, because it is meant to read
// as distance rather than as a place you could walk to. Kept low and wide: a
// tall dome here just looks like a blue wall above the horizon.
function createHills(map) {
  const group = new THREE.Group();
  const far = new THREE.MeshBasicMaterial({
    color: shade(map.sky.low || map.sky.mid, -0.1),
    fog: true,
  });
  const near = new THREE.MeshBasicMaterial({
    color: shade(map.sky.low || map.sky.mid, -0.05),
    fog: true,
  });
  const geo = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);

  for (let i = 0; i < 36; i++) {
    const h = 14 + Math.random() * 18;
    const r = 110 + Math.random() * 120;
    const x = (Math.random() - 0.5) * 1400;
    const z = -300 - Math.random() * 180;
    const hill = new THREE.Mesh(geo, i % 2 ? far : near);
    hill.scale.set(r, h, r);
    hill.position.set(x, terrainHeight(x, z, map) - 4, z);
    group.add(hill);
  }
  return group;
}

// A soft disc where the sun is. It's the one bright thing in the sky, and it
// gives the light a direction the eye can confirm.
function createSunGlow(map) {
  const { canvas, ctx } = makeCanvas(128);
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255, 251, 236, 1)');
  grad.addColorStop(0.16, 'rgba(255, 246, 219, 0.7)');
  grad.addColorStop(0.48, 'rgba(255, 240, 208, 0.16)');
  grad.addColorStop(1, 'rgba(255, 240, 208, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const opacity =
    map.weather === 'bright' ? 0.9 : map.weather === 'clear' ? 0.55 : map.weather === 'fog' ? 0.14 : 0.06;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
      opacity,
    })
  );
  sprite.position.set(-520, 330, 430);
  sprite.scale.set(260, 260, 1);
  return sprite;
}

// A frozen pond for the lake map. Flat by definition, and the one place on the
// map where the snow gives way to something reflective.
function createIcePatch(map) {
  const size = 512;
  const { canvas, ctx } = makeCanvas(size);

  ctx.fillStyle = '#b9d4e2';
  ctx.fillRect(0, 0, size, size);

  // Wind-scoured white streaks.
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = '#eef7fb';
  for (let i = 0; i < 70; i++) {
    ctx.lineWidth = 1 + Math.random() * 3;
    ctx.beginPath();
    const y = Math.random() * size;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(size * 0.3, y + 14, size * 0.7, y - 14, size, y);
    ctx.stroke();
  }

  // Cracks, thin and angular.
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = '#7fa4b8';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 16; i++) {
    let x = Math.random() * size;
    let y = Math.random() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 5; k++) {
      x += (Math.random() - 0.5) * 90;
      y += (Math.random() - 0.5) * 90;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const ice = new THREE.Mesh(
    new THREE.CircleGeometry(64, 48),
    new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.28,
      metalness: 0.12,
      color: 0xdceef7,
    })
  );
  ice.rotation.x = -Math.PI / 2;
  ice.scale.set(1.5, 1, 0.75);
  ice.position.set(-6, terrainHeight(-6, -78, map) + 0.03, -78);
  ice.receiveShadow = true;
  return ice;
}

// ---------------------------------------------------------------------------
// Weather
// ---------------------------------------------------------------------------

// Snow that surrounds the camera rather than sitting in a fixed box, so it
// falls everywhere you look and never runs out.
function createSnowfall(map) {
  const { count, speed, drift, size } = map.snowfall;
  const positions = new Float32Array(count * 3);

  // A box around the origin; the update recentres it on the camera each frame.
  const R = 60;
  const H = 44;
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * R * 2;
    positions[i * 3 + 1] = Math.random() * H;
    positions[i * 3 + 2] = (Math.random() - 0.5) * R * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const { canvas, ctx } = makeCanvas(32);
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);

  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size,
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      depthWrite: false,
      opacity: map.weather === 'blizzard' ? 0.9 : 0.65,
      blending: THREE.NormalBlending,
    })
  );
  points.frustumCulled = false;

  return {
    points,
    update(dt, camera) {
      const pos = geo.attributes.position;
      const cx = camera.position.x;
      const cz = camera.position.z;

      for (let i = 0; i < count; i++) {
        let x = pos.getX(i) + drift * dt;
        let y = pos.getY(i) - speed * dt;
        let z = pos.getZ(i) + drift * 0.35 * dt;

        if (y < 0) y += H;
        // Wrap in a box centred on the camera, so flakes appear from all sides.
        if (x - cx > R) x -= R * 2;
        if (x - cx < -R) x += R * 2;
        if (z - cz > R) z -= R * 2;
        if (z - cz < -R) z += R * 2;

        pos.setXYZ(i, x, y, z);
      }
      pos.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

export function createWorld(scene, map) {
  scene.fog = new THREE.Fog(map.fog.color, map.fog.near, map.fog.far);

  scene.add(createSky(map));
  scene.add(createSunGlow(map));

  scene.add(new THREE.HemisphereLight(map.light.sky, map.light.ground, 0.85));

  // Low winter sun. The long shadows across snow are most of what makes the
  // scene read as cold rather than as a white floor.
  const sun = new THREE.DirectionalLight(map.light.sun, map.light.intensity);
  sun.position.set(-70, 46, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 260;
  sun.shadow.camera.left = -90;
  sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90;
  sun.shadow.camera.bottom = -90;
  sun.shadow.bias = -0.0007;
  scene.add(sun);
  scene.add(sun.target);

  scene.add(createGround(map));

  // The enemy camp is planned before the forest, so trees and boulders can keep
  // its clearing clear. The meshes themselves are added after the ground cover.
  const camp = createCamp(map);
  map.campCenter = camp.center;

  const spots = scatterTrees(map);
  scene.add(createForest(spots));

  scene.add(createRocks(map));
  scene.add(createShrubs(map));
  scene.add(createLogs(map));
  if (map.env.hills) scene.add(createHills(map));

  if (map.id === 'village') scene.add(createVillage(map));
  if (map.env.ice) scene.add(createIcePatch(map));

  scene.add(camp.group);

  scene.add(createLineMarker(map));
  scene.add(createTreeline(map));

  const snowfall = createSnowfall(map);
  scene.add(snowfall.points);

  // Ambient wildlife rides with the world: the scene layer owns the figures and
  // their wander clock, and anything else can shout scare() at them.
  const animals = createAnimals(scene, map);
  scene.add(animals.group);

  // A destroyed crate leaves a dark patch where it stood. One shared material,
  // one small disc per crate — the alternative is a particle system for four
  // objects, which would cost more than the camp itself.
  const scorchMat = new THREE.MeshBasicMaterial({
    color: 0x241f19,
    transparent: true,
    opacity: 0.72,
  });

  // ---- Paluu: the rendezvous marker, and the barrage ----------------------
  // A green flare and a column of smoke, visible through fog and at distance —
  // this is the one thing in the world the player is running toward, so it has
  // to read from 60 m in a blizzard.
  const extractionGroup = new THREE.Group();
  extractionGroup.visible = false;

  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x7cf5b0,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.8, 14, 8), beamMat);
  beam.position.y = 7;
  extractionGroup.add(beam);

  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x7cf5b0,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(4.6, 6.4, 30), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  extractionGroup.add(ring);

  const smokePuffs = [];
  for (let i = 0; i < 7; i++) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(1, 7, 5),
      new THREE.MeshBasicMaterial({
        color: 0xc9d4d8,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      })
    );
    extractionGroup.add(puff);
    smokePuffs.push(puff);
  }
  scene.add(extractionGroup);
  let extractionT = 0;

  // Shell impacts: four reusable craters. The barrage must not allocate a new
  // explosion every two seconds while the player is running for their life.
  const impacts = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(1, 8, 6),
      new THREE.MeshBasicMaterial({
        color: 0xffe2ad,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      })
    );
    const plume = new THREE.Group();
    const puffMats = [];
    for (let k = 0; k < 5; k++) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xf1f6fa,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const chunk = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.6, 5), material);
      chunk.position.set((Math.random() - 0.5) * 2.4, 0, (Math.random() - 0.5) * 2.4);
      plume.add(chunk);
      puffMats.push(material);
    }
    const craterMat = new THREE.MeshBasicMaterial({
      color: 0x353028,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const crater = new THREE.Mesh(new THREE.CircleGeometry(2.4, 16), craterMat);
    crater.rotation.x = -Math.PI / 2;
    crater.position.y = 0.06;
    g.add(flash, plume, crater);
    g.visible = false;
    scene.add(g);
    impacts.push({ g, flash, plume, craterMat, puffs: puffMats, life: 0 });
  }
  let impactIndex = 0;

  return {
    sun,
    treeSpots: spots,
    camp: {
      center: camp.center,
      towers: camp.towers,
      crates: camp.crates,
      guards: camp.guards,
    },
    // A hit crate is removed and replaced by its scorch, and the round counts it.
    breakCrate(crate) {
      if (!crate || !crate.alive) return false;
      crate.alive = false;
      crate.mesh.visible = false;
      const scorch = new THREE.Mesh(new THREE.CircleGeometry(0.95, 12), scorchMat);
      scorch.rotation.x = -Math.PI / 2;
      scorch.position.set(crate.x, terrainHeight(crate.x, crate.z, map) + 0.05, crate.z);
      scene.add(scorch);
      return true;
    },
    // Round decides *where* the exit is; the scene only draws the smoke.
    showExtraction(x, z) {
      extractionGroup.position.set(x, terrainHeight(x, z, map), z);
      extractionGroup.visible = true;
      extractionT = 0;
    },
    hideExtraction() {
      extractionGroup.visible = false;
    },
    // Exposed for the headless suite; also handy when tuning from the console.
    extractionActive() {
      return extractionGroup.visible;
    },
    shellImpact(x, z) {
      const slot = impacts[impactIndex % impacts.length];
      impactIndex += 1;
      slot.g.position.set(x, terrainHeight(x, z, map), z);
      slot.g.visible = true;
      slot.life = 1;
    },
    update(dt, camera) {
      snowfall.update(dt, camera);
      animals.update(dt, camera.position.x, camera.position.z);
      // Keep the shadow volume centred on the player, so the shadows that
      // matter are always inside the shadow camera's box.
      sun.target.position.set(camera.position.x, 0, camera.position.z);
      sun.position.set(camera.position.x - 70, 46, camera.position.z + 40);

      // The rendezvous column: puffs rise, drift and fade on a loop.
      if (extractionGroup.visible) {
        extractionT += dt;
        smokePuffs.forEach((puff, i) => {
          const k = (extractionT * 0.22 + i / smokePuffs.length) % 1;
          puff.position.set(
            Math.sin(i * 2.1 + extractionT * 0.5) * 1.5,
            0.7 + k * 11,
            Math.cos(i * 1.7 + extractionT * 0.4) * 1.5
          );
          puff.scale.setScalar(0.9 + k * 2.4);
          puff.material.opacity = (1 - k) * 0.34;
        });
        ringMat.opacity = 0.34 + Math.sin(extractionT * 2.6) * 0.16;
      }

      // Impacts: flash, plume and crater all driven by one life value.
      for (const s of impacts) {
        if (s.life <= 0) continue;
        s.life = Math.max(0, s.life - dt * 1.35);
        const k = s.life;
        const grow = 1 - k;
        // A flash, not a white wall: the earlier scale filled the whole frame
        // and hid the very run it was meant to sell.
        s.flash.scale.setScalar(0.5 + grow * 3.6);
        s.flash.material.opacity = k * 0.55;
        s.plume.position.y = grow * 4.5;
        s.plume.scale.setScalar(0.5 + grow * 1.25);
        for (const material of s.puffs) material.opacity = k * 0.7;
        s.craterMat.opacity = Math.min(0.55, k * 1.2);
        if (s.life <= 0) s.g.visible = false;
      }
    },
    // A rifle crack, or anything else worth running from. Wired from round.fire()
    // in the game layer — scene code never decides when it is loud.
    scare(x, z) {
      animals.flee(x, z);
    },
  };
}

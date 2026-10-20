// The four places the game happens.
//
// Weather is fixed per map rather than chosen separately: each place is meant
// to be remembered for its conditions, and Kollaa in a blizzard would just be
// the frozen lake with trees. The weather is the map's whole character.
//
// Scale is metres. You sit at positive z looking toward negative z, the line you
// are holding is at z = 0, and everything comes at you from beyond it.

export const LINE_Z = 0;
export const SPAWN_Z = -140;

export function getMap(idOrMap) {
  // Passes pre-built map objects straight through (startRound stamps sortie
  // stakes onto a clone before loading), and resolves ids as always.
  if (idOrMap && typeof idOrMap === 'object') return idOrMap;
  return MAPS.find((m) => m.id === idOrMap);
}

export const MAPS = [
  {
    id: 'kollaa',
    // A real Winter War position on the Kollaanjoki, held through the entire
    // war. The name is the promise: "Kollaa kestää" — Kollaa holds.
    name: 'Kollaanjoki',
    region: 'Ladoga Karelia',
    subtitle: 'The line that never broke',
    // A clear, still, killing cold. You can see a long way — so can they.
    weather: 'clear',
    fog: { color: 0xdbe6f0, near: 90, far: 400 },
    sky: { top: '#3f6f9e', mid: '#a8c4dc', low: '#e4eef6' },
    light: { sun: 0xfff6e6, intensity: 1.9, sky: 0xc4d8ea, ground: 0x8fa2b3 },
    ground: { base: '#e6edf4', tint: '#c4d3e0', patches: 700 },
    trees: { count: 430, type: 'pine', near: -150, far: 70, spread: 180 },
    snowfall: { count: 260, speed: 0.9, drift: 0.5, size: 0.16 },
    hides: [
      { x: -9, z: 34 },
      { x: 6, z: 29 },
      { x: 18, z: 40 },
      { x: -22, z: 44 },
      { x: 2, z: 21 },
    ],
    bread: [1, 3],
    columns: 3,
    patrols: 2,
    enemySpeed: 1.15,
    // Gentle relief: a forest with drifts and hollows, never a wall.
    terrain: { amp: 1.8, seed: 3 },
    env: { rocks: 90, shrubs: 220, logs: 18, hills: true },
  },

  {
    id: 'lake',
    // Tolvajärvi: the December 1939 battle swung around frozen lake ice and
    // high snow fringes.
    name: 'Tolvajärvi',
    region: 'Karelian border — December 1939',
    subtitle: 'Frozen open water, no cover for a kilometre',
    // Blizzard. You are almost invisible and almost blind, and the wind noise
    // covers your shots — but there is nothing to hide behind if they close in.
    weather: 'blizzard',
    fog: { color: 0xe8eef4, near: 12, far: 110 },
    sky: { top: '#8fa6b8', mid: '#c8d6e0', low: '#eef3f7' },
    light: { sun: 0xdfe8f0, intensity: 1.1, sky: 0xd8e2ec, ground: 0xa8b8c4 },
    ground: { base: '#dce9f2', tint: '#b9ccda', patches: 180 },
    trees: { count: 74, type: 'pine', near: -60, far: 50, spread: 160 },
    snowfall: { count: 1400, speed: 3.4, drift: 6, size: 0.2 },
    hides: [
      { x: -4, z: 30 },
      { x: 10, z: 33 },
      { x: -16, z: 37 },
      { x: 20, z: 28 },
    ],
    bread: [0, 3],
    columns: 3,
    patrols: 3,
    enemySpeed: 1.35,
    // A frozen lake is flat. Keep it almost level or it stops reading as ice.
    terrain: { amp: 0.12, seed: 7 },
    env: { rocks: 20, shrubs: 40, logs: 6, hills: true, ice: true },
  },

  {
    id: 'village',
    // Suomussalmi: the motti battles among burnt farmsteads in the snow.
    name: 'Suomussalmi',
    region: 'Kainuu — the motti forest',
    subtitle: 'Burnt-out farmsteads, fogged in',
    // Fog. Short sightlines, so the columns get close before you see them — but
    // the broken walls give you something to break line of sight behind.
    weather: 'fog',
    fog: { color: 0xc9d0d6, near: 25, far: 170 },
    sky: { top: '#7d8a94', mid: '#aeb9c0', low: '#d5dade' },
    light: { sun: 0xe8e2d4, intensity: 1.25, sky: 0xbcc6cc, ground: 0x7a7268 },
    ground: { base: '#e4ded3', tint: '#b6ad9e', patches: 900 },
    trees: { count: 180, type: 'birch', near: -130, far: 60, spread: 165 },
    snowfall: { count: 500, speed: 1.4, drift: 1.2, size: 0.14 },
    hides: [
      { x: -12, z: 26 },
      { x: 8, z: 31 },
      { x: -26, z: 35 },
      { x: 22, z: 24 },
    ],
    bread: [2],
    columns: 4,
    patrols: 2,
    enemySpeed: 1.2,
    // Broken ground between the houses: mounds, ditches, collapsed cellars.
    terrain: { amp: 2.2, seed: 5 },
    env: { rocks: 110, shrubs: 130, logs: 26, hills: true },
  },

  {
    id: 'ridge',
    // Salla: high ridgelines and cruel arctic sunlight, the long-shot ground.
    name: 'Salla',
    region: 'Lapland, above the Arctic Circle',
    subtitle: 'Open ridgelines, hard sun, long shots',
    // Hard sun on snow. The brightest map: you can shoot at 200 metres, and
    // being seen is the whole risk.
    weather: 'bright',
    fog: { color: 0xeaf2f8, near: 140, far: 520 },
    sky: { top: '#2f6699', mid: '#bcd8ee', low: '#f2f8fc' },
    light: { sun: 0xffffff, intensity: 2.4, sky: 0xd0e4f2, ground: 0x9fb4c4 },
    ground: { base: '#eef4f9', tint: '#cfdde8', patches: 320 },
    trees: { count: 280, type: 'pine', near: -170, far: 40, spread: 195 },
    snowfall: { count: 120, speed: 0.6, drift: 2.4, size: 0.13 },
    hides: [
      { x: -14, z: 46 },
      { x: 4, z: 52 },
      { x: 24, z: 44 },
      { x: -30, z: 40 },
    ],
    bread: [0, 2],
    columns: 3,
    patrols: 3,
    enemySpeed: 1.25,
    // The long sightlines are the point, so the land rolls but never blocks.
    terrain: { amp: 4.2, seed: 11 },
    env: { rocks: 160, shrubs: 100, logs: 14, hills: true },
  },
];

function findMap(id) {
  return MAPS.find((m) => m.id === id) || MAPS[0];
}

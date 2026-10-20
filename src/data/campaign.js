// The campaign: fifty sorties, five chapters, and progress that only moves when
// a sortie is actually won.
//
// The design question this answers is "why come back": a player can't just
// wander into any round any more. The campaign ladders them through the four
// places — each chapter harder than the last — with a story line on the menu
// card, and every win opens exactly one more sortie. Losing returns you to the
// same sortie number. Skirmish (any unlocked place, campaign difficulty) exists
// because replays need a home, not because the ladder is optional.
//
// Scaling is deliberately gentle: speed and counts creep up, bosses gain a hit
// every few sorties, and nothing jumps. A ladder that punishes is a ladder
// people stop climbing.

const CYCLE = ['kollaa', 'lake', 'village', 'ridge'];

export const CAMPAIGN_TOTAL = 50;

export const CHAPTERS = [
  {
    id: 'kollaa',
    from: 1,
    to: 12,
    title: 'Kollaanjoki — the line holds',
    lore: 'The river is frozen to its bones and the patrol road is quiet. Your line is the last one north of the lake. Hold it, and count your rounds.',
  },
  {
    id: 'tolvajarvi',
    from: 13,
    to: 24,
    title: 'Tolvajärvi — whiteout country',
    lore: 'Open ice, no cover for a kilometre, and wind that erases your tracks in seconds — theirs too. Out here you shoot once, then you move.',
  },
  {
    id: 'suomussalmi',
    from: 25,
    to: 36,
    title: 'Suomussalmi — the motti forest',
    lore: 'Burnt farmsteads and fog thick enough to drink. They are lost among the mottis, cut off and desperate. Lost men shoot at everything.',
  },
  {
    id: 'salla',
    from: 37,
    to: 48,
    title: 'Salla — long views',
    lore: 'High ridgelines, hard arctic sun, and sightlines measured in hundreds of metres. The hills are open, and so are you.',
  },
  {
    id: 'finale',
    from: 49,
    to: 50,
    title: 'The last ridge',
    lore: 'Everything they have left is moving up one road. The general walks with them. End it, and the line holds another winter.',
  },
];

// Difficulty stays a player choice rather than a ladder attribute — a bad day
// should not cost progress, only pride. The numbers are multipliers, applied in
// round.js (exposure gain, damage taken) and folded into each map's enemySpeed.
export const DIFFICULTIES = [
  { id: 'recruit', label: 'Recruit', enemySpeed: 0.85, noise: 0.8, damage: 0.8 },
  { id: 'regular', label: 'Regular', enemySpeed: 1.0, noise: 1.0, damage: 1.0 },
  { id: 'veteran', label: 'Veteran', enemySpeed: 1.18, noise: 1.25, damage: 1.3 },
];

export function getDifficulty(id) {
  return DIFFICULTIES.find((d) => d.id === id) || DIFFICULTIES[1];
}

// Every sortie's shape, derived from its number. Pure and deterministic so the
// menu and the round cannot disagree about what sortie 23 is.
export function levelConfig(n) {
  const level = Math.max(1, Math.min(CAMPAIGN_TOTAL, Math.floor(Number(n) || 1)));
  // Sorties 49–50 are the finale on Salla's ridges; before that, four
  // chapters of twelve rotate through the cycle.
  const cycleIndex = Math.min(CYCLE.length - 1, Math.floor((level - 1) / 12) % CYCLE.length);
  const mapId = level >= 49 ? 'ridge' : CYCLE[cycleIndex];
  return {
    level,
    mapId,
    // Columns thicken every ~4 sorties, patrols every ~7. Cumulative kills in
    // the mission chain are per-kind, so extra columns only add targets, not
    // required targets.
    sentries: Math.min(4, 2 + Math.floor(level / 14)),
    columns: Math.min(6, 3 + Math.floor(level / 4)),
    patrols: Math.min(4, 1 + Math.floor(level / 7)),
    // Walk pace and hunting pace creep up, capped at 1.5×.
    enemySpeed: 1.0 + Math.min(0.5, 0.012 * (level - 1)),
    // The officer takes a third hit around sortie 20; the general a fourth
    // around 30. Enough to matter, never enough to feel like a boss fight
    // that eats a full magazine.
    bossHpBonus: Math.floor(level / 20),
  };
}

export function chapterFor(n) {
  const level = Math.max(1, Math.min(CAMPAIGN_TOTAL, Math.floor(Number(n) || 1)));
  return CHAPTERS.find((c) => level >= c.from && level <= c.to) || CHAPTERS[0];
}

// ---- Persistence -----------------------------------------------------------
// Progress (highest unlocked sortie) and the chosen difficulty are localStorage
// alongside the rifle pick, so the campaign survives a browser reload the way
// the loadout already does.

export function loadProgress() {
  const n = Number(localStorage.getItem('suomiProgress'));
  return Number.isFinite(n) && n >= 1 ? Math.min(CAMPAIGN_TOTAL, Math.floor(n)) : 1;
}

export function saveProgress(n) {
  // Only ever moves forward: a loss re-plays the same sortie rather than
  // reopening the ones before it.
  const current = loadProgress();
  if (n > current) localStorage.setItem('suomiProgress', String(Math.min(CAMPAIGN_TOTAL, n)));
}

export function loadDifficultyId() {
  return localStorage.getItem('suomiDifficulty') || 'regular';
}

export function saveDifficultyId(id) {
  if (getDifficulty(id).id === id) localStorage.setItem('suomiDifficulty', id);
}

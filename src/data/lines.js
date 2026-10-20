// What the shooter says after a man goes down.
//
// This is the voice the game was missing: a Finnish marksman muttering to
// himself in the snow. The mix is deliberate — the occasional Finnish word reads
// as flavour rather than as a translation exercise, and the English lines carry
// the ones you actually want to see in a firefight.
//
// Tone rules: taunts, not gore. Mild swearing (perkele, paska, saatana) and
// marksmanship praise. No slurs, no gloating over bodies. The enemies are generic
// infantry and this stays a stealth game.
//
// Pools are chosen by context in `pickKillLine`, so a 200 m shot never gets the
// point-blank line.

const GENERIC = [
  'Hell yeah — got you.',
  'Perkele. Down.',
  'Paska. That one is over.',
  'Stay down.',
  'Good shot.',
  'Hyvä laukaus.',
  'Nappiin.',
  'One round, one man.',
  'That is how it is done.',
  'Saatana. Right through him.',
];

const CLOSE = [
  'That close, and he never heard it.',
  'Perkele — right in front of me.',
  'Point blank. Paska.',
  'Too close. He was looking at the snow, not at me.',
  'He walked into it. Hyvä.',
];

const LONG = [
  'Two hundred metres. Perkele.',
  'Long shot. He never knew.',
  'Hyvä laukaus — that was a long one.',
  'That is a proper shot.',
  'Paska. I did not think that would land.',
  'Wind held, round landed. Good.',
];

const STREAK = [
  'Three in a row. Saatana, keep going.',
  'They keep coming. Perkele.',
  'Still standing. Keep the line.',
  'On a roll. Hyvä.',
  'That is four. Do not get greedy.',
];

const OFFICER = [
  'Officer down. Perkele.',
  'That is the officer — and his guards heard it.',
  'Not so proud now.',
  'Officer. Two rounds well spent.',
];

const GENERAL = [
  'The general is down. Saatana — we did it.',
  'General down. The line holds.',
  'Perkele. That was the general.',
  'The general. Hyvä laukaus, indeed.',
];

const WOUND = [
  "Hit — he's still up.",
  'Wounded. Finish him.',
  'Osui — vielä pystyssä.',
  "That's a hit. He's not down.",
  'He felt that. One more.',
];

// Remember the last line from each pool so the same sentence does not come up
// twice in a row — repetition is what makes callouts feel canned.
const lastPick = new Map();

function draw(pool, name, rng) {
  if (pool.length === 1) return pool[0];
  const previous = lastPick.get(name);
  let index = Math.floor(rng() * pool.length);
  if (index === previous) index = (index + 1 + Math.floor(rng() * (pool.length - 1))) % pool.length;
  lastPick.set(name, index);
  return pool[index];
}

// Picks by what the shot actually was. Bosses trump distance; a streak trumps a
// long shot, because the streak is the more interesting thing to say out loud.
export function pickKillLine({ kind, distance = 0, streak = 1, rng = Math.random } = {}) {
  if (kind === 'general') return { text: draw(GENERAL, 'general', rng), tone: 'boss' };
  if (kind === 'officer') return { text: draw(OFFICER, 'officer', rng), tone: 'boss' };
  if (streak >= 3) return { text: draw(STREAK, 'streak', rng), tone: 'good' };
  if (distance >= 150) return { text: draw(LONG, 'long', rng), tone: 'good' };
  if (distance <= 55) return { text: draw(CLOSE, 'close', rng), tone: 'good' };
  return { text: draw(GENERIC, 'generic', rng), tone: 'good' };
}

// A boss that is wounded, not dead. `remaining` is hits left, so the line can be
// specific about how close it was.
export function pickWoundLine({ kind, remaining = 1, rng = Math.random } = {}) {
  if (kind === 'general') {
    return { text: `The general is hit — ${remaining} more.`, tone: 'wound' };
  }
  if (kind === 'officer') {
    return { text: `Officer hit — ${remaining} more.`, tone: 'wound' };
  }
  return { text: draw(WOUND, 'wound', rng), tone: 'wound' };
}

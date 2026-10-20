// Ammunition: the other half of the loadout.
//
// A rifle is a tool; the round is the decision. Three loads, and none is the
// best one — the choice is what you expect to be shooting at. This is the kind
// of small, legible trade-off that makes a short sortie worth replaying with a
// different answer, and it costs the game nothing but a number.
//
// - Ball is the service round: full damage on men, nothing special on rank.
// - AP trades forgiveness for punch: a narrower hit window, but officers and
//   generals take half the hits they normally would.
// - Match is the marksman's load: a wider hit window (tighter group in the
//   rules, which is what "match grade" means to a player) and no boss bonus.
export const AMMO = [
  {
    id: 'ball',
    label: 'Service ball',
    short: 'BALL',
    note: 'Standard round. Forgiving, no specialties.',
    damage: 1,
    bossDamage: 1,
    radius: 1,
  },
  {
    id: 'ap',
    label: 'Armour-piercing',
    short: 'AP',
    note: 'Officers and generals fall in half the hits. Narrow window.',
    damage: 1,
    bossDamage: 2,
    radius: 0.82,
  },
  {
    id: 'match',
    label: 'Match grade',
    short: 'MATCH',
    note: 'Tighter groups: the hit window forgives more.',
    damage: 1,
    bossDamage: 1,
    radius: 1.32,
  },
];

export function getAmmo(id) {
  return AMMO.find((a) => a.id === id) || AMMO[0];
}

export function loadAmmoId() {
  return localStorage.getItem('suomiAmmo') || 'ball';
}

export function saveAmmoId(id) {
  if (getAmmo(id).id === id) localStorage.setItem('suomiAmmo', id);
}

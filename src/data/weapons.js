// The loadout. Three rifles, and the differences are real differences — not a
// skin swap: magnification, how much the breath wobble is worth, how fast the
// bolt cycles, and how the shot sounds and kicks. The M/28 is quick and steady
// but short-glassed; the LRS reaches furthest and punishes you for it.
//
// Zoom is a camera FOV (see the magnification note in main.js): a lower number
// is a longer glass. `sway`, `kick`, `rechamber` act directly on the frame loop
// and the weapon view.

export const WEAPONS = [
  {
    id: 'm28',
    name: 'M/28 Finn',
    tag: 'Old bolt, new glass. Fast to settle, fast to cycle.',
    stats: { zoom: 2, steadiness: 5, cycle: 5 },
    zoom: [{ label: '×6', fov: 7.4 }],
    sway: 0.82,
    rechamber: 0.55,
    kick: 0.85,
    // Internal magazine (how many rounds before the bolt is empty) and how long
    // a top-up with a stripper clip takes, in seconds. Both are real rifle
    // behaviour: a Mosin holds 5, and putting another 5 in is a deliberate,
    // audible pause, not an instant refill.
    mag: 5,
    reloadTime: 2.4,
    sound: { crack: 0.44, boomFrom: 112, boomTo: 48, boomDur: 0.4, echoGain: 0.13, crackFreq: 5600 },
    chassis: 0x2a332c,
    accent: 0x4a5a48,
  },
  {
    id: 'chassis',
    name: 'L42 Chassis',
    tag: 'Two-stage trigger, two magnifications. The all-rounder.',
    stats: { zoom: 4, steadiness: 4, cycle: 4 },
    zoom: [
      { label: '×4', fov: 10.5 },
      { label: '×8', fov: 5.4 },
    ],
    sway: 0.75,
    rechamber: 0.62,
    kick: 0.8,
    mag: 5,
    reloadTime: 2.8,
    sound: { crack: 0.5, boomFrom: 96, boomTo: 38, boomDur: 0.5, echoGain: 0.18, crackFreq: 5200 },
    chassis: 0x2b3034,
    accent: 0x40474d,
  },
  {
    id: 'lrs',
    name: '.300 LRS',
    tag: 'Heavy barrel, heavy bolt, heavy report. Hits past 200 m.',
    stats: { zoom: 5, steadiness: 4, cycle: 1 },
    zoom: [{ label: '×10', fov: 4.6 }],
    sway: 0.68,
    rechamber: 0.95,
    kick: 1.25,
    // The fluted bolt race makes a heavy single-stack box mag; four rounds.
    mag: 4,
    reloadTime: 3.4,
    sound: { crack: 0.6, boomFrom: 74, boomTo: 27, boomDur: 0.66, echoGain: 0.26, crackFreq: 4600 },
    chassis: 0x34302a,
    accent: 0x5a4632,
  },
];

export function getWeapon(id) {
  return WEAPONS.find((w) => w.id === id) || WEAPONS[1]; // L42 Chassis by default
}

export const WEAPON_STORE_KEY = 'suomiWeapon';

export function loadWeaponId() {
  try {
    return localStorage.getItem(WEAPON_STORE_KEY) || getWeapon('chassis').id;
  } catch {
    return 'chassis';
  }
}

export function saveWeaponId(id) {
  try {
    localStorage.setItem(WEAPON_STORE_KEY, id);
  } catch {
    // Private browsing etc. — the choice just doesn't persist, which is fine.
  }
}

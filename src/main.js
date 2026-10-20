import * as THREE from 'three';
import './styles.css';
import { createWorld } from './scene/world.js';
import { terrainHeight } from './scene/terrain.js';
import { WeaponView } from './scene/weapon.js';
import { Round, STATUS } from './game/round.js';
import { getMap, MAPS } from './data/maps.js';
import { pickKillLine, pickWoundLine } from './data/lines.js';
import { getWeapon, loadWeaponId, saveWeaponId } from './data/weapons.js';
import { getAmmo, loadAmmoId, saveAmmoId } from './data/ammo.js';
import {
  CAMPAIGN_TOTAL,
  chapterFor,
  getDifficulty,
  levelConfig,
  loadDifficultyId,
  loadProgress,
  saveDifficultyId,
  saveProgress,
} from './data/campaign.js';
import { createUI } from './ui/screens.js';
import { createReticle } from './ui/reticle.js';
import { sfx, startWind, unlockAudio } from './game/audio.js';
import {
  whoami,
  saveScore,
  readLeaderboard,
  goToSignIn,
} from './services/startng.js';

// ---------------------------------------------------------------------------
// Anything that throws should be visible.
//
// A game that silently stops responding is the worst failure there is: you
// can't tell a bug from a slow frame. This puts it on screen, which also makes
// it reportable without opening dev tools.
// ---------------------------------------------------------------------------

function showFatal(message) {
  let bar = document.getElementById('fatal');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'fatal';
    document.body.appendChild(bar);
  }
  bar.textContent = `Something broke: ${message}`;
  bar.classList.add('fatal-on');
}

window.addEventListener('error', (e) => showFatal(e.message || 'unknown error'));
window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason;
  showFatal((reason && reason.message) || String(reason) || 'unknown error');
});

// ---------------------------------------------------------------------------
// Renderer and camera
// ---------------------------------------------------------------------------

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

// Eye height lying in a snow scrape. Low, which is what makes the ground in
// front of you read as a parapet.
const EYE_Y = 1.62;
const EYE_Y_CROUCHED = 0.95;

// Hip and shoulder fields of view. Aiming in first person doesn't widen or
// narrow these — it selects a scope magnification below.
const FOV_FIRST = 42; // narrow, like a rifleman's attention
const FOV_THIRD = 48; // a little wider so the body and the ground both read
const FOV_AIM_THIRD = 18; // over the shoulder, pulled in

// Scope magnifications come from the selected weapon (data/weapons.js). Zoom is
// still a camera field of view — a 4x glass on a 42° eye is about 10.5°, and 8x
// about 5.3°; both are honest enough to feel like optics rather than like "the
// camera got narrow". The rifle choice also brings sway, rechamber time, recoil
// and the shot's sound with it, so one pickup changes how the game feels.
let gun = getWeapon(loadWeaponId());
let zoomLevels = gun.zoom;
let zoomIndex = 0;

// The load: ammunition is the second half of the rifle choice and is read by
// the round, so main owns the pick and persists it beside the rifle.
let ammo = getAmmo(loadAmmoId());

// Campaign state: the highest unlocked sortie and the chosen difficulty. The
// old suomiLevel key is retired — it advanced on losses too, which is not a
// ladder, just a counter.
let progress = loadProgress();
let difficultyId = loadDifficultyId();
let currentLevel = progress;

const camera = new THREE.PerspectiveCamera(FOV_FIRST, 1, 0.1, 1200);

let scene = new THREE.Scene();
let world = null;
let round = null;

const ui = createUI(document.getElementById('ui'));
const reticle = createReticle(document.getElementById('ui'));
const weapon = new WeaponView();
reticle.setZoom(zoomLevels[zoomIndex].label);
weapon.setSkin(gun);

// ---------------------------------------------------------------------------
// Sizing
//
// The canvas is sized by CSS (`#scene` is a fixed, full-viewport box), and the
// renderer is told about the result with `setSize(w, h, false)`. That third
// argument is the whole trick: without it Three writes inline pixel width and
// height onto the canvas, which beats the stylesheet — and the moment those
// pixels disagree with the viewport (a window that opened small, a maximised
// window, a display swap, a browser zoom), the game renders into a corner of the
// screen instead of all of it. Let CSS own the box; the renderer just matches it.
//
// A ResizeObserver on the canvas catches every layout change, including the ones
// that never fire a window `resize` — a phone's address bar retracting, a
// sidebar opening, an orientation flip on the way. visualViewport covers the
// keyboard-zoom cases ResizeObserver can miss.
// ---------------------------------------------------------------------------

function resize() {
  const width = canvas.clientWidth || window.innerWidth;
  const height = canvas.clientHeight || window.innerHeight;
  const aspect = width / Math.max(1, height);

  // The ratio can change while the window doesn't: dragging between a retina and
  // a non-retina display. Re-read it here rather than once at boot. Capped at 2
  // because a 3x phone would render nine times the pixels for no visible gain.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);

  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  weapon.resize(aspect);
}

if (typeof ResizeObserver === 'function') {
  new ResizeObserver(resize).observe(canvas);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
document.addEventListener('visibilitychange', resize);
resize();

// ---------------------------------------------------------------------------
// Aim and view state
// ---------------------------------------------------------------------------

// Yaw is deliberately unbounded: a player can spin a full 360° and keep going.
// Capping it at ±π stopped continuous turning at the half-turn, which read as
// the game fighting the mouse. Pitch stays limited — you're a man with a rifle,
// not a gun turret.
const PITCH_MIN = -0.5;
const PITCH_MAX = 0.4;

const VIEW = { FIRST: 'first', THIRD: 'third' };

// Phones have no wheel and no right-click. Used to word the aiming hint, to add
// the touch body class, and to auto-hold breath behind the scope.
//
// The pointer media query is the primary signal, but some Android WebViews and
// in-app browsers report it oddly. A touch device with no fine pointer is a
// phone or tablet regardless, so fall back to that instead of shipping a game
// with invisible controls.
const TOUCH =
  window.matchMedia('(hover: none) and (pointer: coarse)').matches ||
  (navigator.maxTouchPoints > 0 && !window.matchMedia('(any-pointer: fine)').matches);
if (TOUCH) document.body.classList.add('touch-device');

const aim = { yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0, recoilKick: 0 };

let viewMode = VIEW.FIRST;
let aiming = false;
// Scope raise progress: 0 is the rifle at the hip, 1 is the eye behind the
// glass. The transition runs every frame and drives the camera zoom, the DOM
// scope's opacity and the weapon's raised pose together, so bringing the rifle
// up is one continuous move instead of an overlay snapping on.
let aimT = 0;
// Down-timer after a shot, in seconds. A bolt rifle can't fire again until the
// bolt has cycled; this is what the rechamber stat in data/weapons.js is worth.
let rechamberLeft = 0;

let player = null;
let signedIn = false;
let boardEntries = [];
let boardLocal = true;
let started = false;
let wasLocked = false; // target-lock edge detector, for the acquisition click

async function refreshBoard() {
  const { ok, entries } = await readLeaderboard(10);
  boardEntries = entries;
  boardLocal = !ok;
  return { entries, local: !ok };
}

// askStart.ng again on return: the docs require it, because the player may have
// signed in or out on start.ng while they were away.
async function refreshPlayer() {
  const { player: p } = await whoami();
  if (!p) return;
  const nowSignedIn = Boolean(p.account);
  if (player && p.name === player.name && nowSignedIn === signedIn) return;

  player = p;
  signedIn = nowSignedIn;
  ui.setPlayer(player, signedIn, () => goToSignIn());
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

function setView(mode) {
  viewMode = mode;
  const third = mode === VIEW.THIRD;

  if (started) reticle.show();
  // A centre reference in every view, including first person at the hip. The
  // shot leaves the camera along the aim line, so this dot is literally where
  // the round goes — without it a hip shot is fired blind, which reads as
  // "the gun doesn't shoot".
  reticle.setCrosshair(true);
  // The scope overlay is driven per-frame by the aim transition, so dropping to
  // third person can simply collapse the transition.
  if (third) aimT = 0;
  if (round) round.setAvatarVisible(third);
  document.body.classList.toggle('view-third', third);
}

function toggleView() {
  if (!started) return;
  setView(viewMode === VIEW.FIRST ? VIEW.THIRD : VIEW.FIRST);
}

function setAiming(on) {
  aiming = Boolean(on);
}

// Dropping the scope from somewhere other than the input itself (quitting,
// pausing, losing focus) also has to release the touch button, which is a
// toggle and would otherwise stay lit.
function dropAim() {
  setAiming(false);
  aimT = 0;
  reticle.setScopeProgress(0);
  ui.resetAim();
}

function cycleZoom() {
  zoomIndex = (zoomIndex + 1) % zoomLevels.length;
  reticle.setZoom(zoomLevels[zoomIndex].label);
}

// ---------------------------------------------------------------------------
// Map loading
// ---------------------------------------------------------------------------

function loadMap(mapOrId) {
  // Accepts either a map id or a map object already stamped with sortie stakes
  // (see startRound). getMap passes objects through.
  const map = getMap(mapOrId);

  // A fresh scene per map. Disposing the old one wholesale is simpler and far
  // less error-prone than trying to unpick individual objects, and a map change
  // happens once per round.
  scene.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = [].concat(obj.material);
      for (const m of mats) {
        for (const key of ['map', 'alphaMap', 'normalMap']) {
          if (m[key]) m[key].dispose();
        }
        m.dispose();
      }
    }
  });

  scene = new THREE.Scene();
  world = createWorld(scene, map);

  round = new Round({
    scene,
    map,
    world,
    camera,
    onEvent: handleGameEvent,
    // Magazine capacity and clip reload time are rules and ride on the round;
    // the rifle picked in the menu is what you carry for the whole sortie.
    weapon: gun,
    // Ammunition rides on the round like the rifle does: wider hit window or
    // double damage on rank, decided in the menu.
    ammo,
  });

  aim.yaw = aim.targetYaw = 0;
  aim.pitch = aim.targetPitch = 0;
  aim.recoilKick = 0;
  dropAim();

  startWind(map.weather === 'blizzard' ? 2.4 : map.weather === 'fog' ? 0.7 : 1.2);
  return map;
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

const keys = new Set();
let pointerLocked = false;
let touchDrag = { active: false, id: null, x: 0, y: 0 };

// iOS only starts audio from a user gesture. Catch the first tap anywhere — a
// menu button counts — so the synth is awake by the time the first shot needs it.
document.addEventListener('pointerdown', () => unlockAudio(), { once: true, passive: true });
// Virtual stick and toggle state. These are merged into the same input the
// keyboard produces, so the round rules do not know or care which device is in
// the player's hands.
const touchMove = { x: 0, y: 0 };
let touchCrouch = false;
let touchSprint = false;

// Pointer lock on desktop: a sniper game needs the mouse to turn the head, and
// without lock the cursor hits the edge of the window and the aim stops. It is
// requested on the first shot, but firing does not wait for it — movementX/Y is
// the same either way, so requiring the lock would only be a discovery problem.
canvas.addEventListener('mousedown', (e) => {
  unlockAudio();
  if (!round || round.status !== STATUS.PLAYING) return;

  if (e.button === 0) {
    if (!pointerLocked && canvas.requestPointerLock) canvas.requestPointerLock();
    fireShot();
  } else if (e.button === 2) {
    setAiming(true);
  }
});

window.addEventListener('mouseup', (e) => {
  if (e.button === 2) setAiming(false);
});

// Right-click is aim, not a browser menu.
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
  document.body.classList.toggle('locked', pointerLocked);
});

// Look sensitivity follows the field of view, so a turn feels the same whether
// you are at 42° or down the 8x glass. Without this the scope would be unusable:
// a 5° field means a millimetre of mouse swings the whole view. The floor keeps
// it turnable when fully wound in, which matters more than being exactly right.
function lookSensitivity(base = 0.0016) {
  return base * Math.max(0.18, camera.fov / FOV_FIRST);
}

// Works with or without pointer lock. Locking only stops the cursor reaching
// the edge of the window — movementX/Y is the same either way.
document.addEventListener('mousemove', (e) => {
  const s = lookSensitivity();
  // No yaw clamp: the view keeps turning past the half-turn.
  aim.targetYaw -= e.movementX * s;
  aim.targetPitch = THREE.MathUtils.clamp(aim.targetPitch - e.movementY * s, PITCH_MIN, PITCH_MAX);
});

// The wheel is the magnification ring, and only while the scope is up — the rest
// of the time there is nothing for it to do, so it must not swallow the scroll.
canvas.addEventListener(
  'wheel',
  (e) => {
    if (!aiming || viewMode !== VIEW.FIRST) return;
    e.preventDefault();
    cycleZoom();
  },
  { passive: false }
);

// Touch: drag anywhere on the world to look. The controls live in their own
// corners, so there is no "look pad" to find — the whole open screen turns the
// view, which is what makes a 360° spin feel natural on a phone.
//
// One pointer owns the look at a time. A second finger is either on the stick or
// on a button, and must not reset the view mid-turn.
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' || !started) return;
  if (touchDrag.active) return;
  unlockAudio();
  touchDrag = { active: true, id: e.pointerId, x: e.clientX, y: e.clientY };
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {
    // Synthetic pointers in tests cannot be captured; dragging still works.
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!touchDrag.active || e.pointerId !== touchDrag.id) return;
  const dx = e.clientX - touchDrag.x;
  const dy = e.clientY - touchDrag.y;
  touchDrag.x = e.clientX;
  touchDrag.y = e.clientY;
  const s = lookSensitivity(0.0068);
  aim.targetYaw -= dx * s;
  aim.targetPitch = THREE.MathUtils.clamp(aim.targetPitch - dy * s, PITCH_MIN, PITCH_MAX);
});

function endTouchLook(e) {
  if (e.pointerId !== touchDrag.id) return;
  touchDrag.active = false;
  touchDrag.id = null;
}
canvas.addEventListener('pointerup', endTouchLook);
canvas.addEventListener('pointercancel', endTouchLook);
canvas.addEventListener('lostpointercapture', endTouchLook);

// Losing focus with a finger down should not leave the player walking into a
// tree. Pausing, quitting and restarting all run through this too.
function resetTouchState() {
  touchMove.x = 0;
  touchMove.y = 0;
  touchCrouch = false;
  touchSprint = false;
  touchDrag.active = false;
  touchDrag.id = null;
  ui.resetAim();
}

window.addEventListener('keydown', (e) => {
  unlockAudio();

  if (e.code === 'Escape' || e.code === 'KeyP') {
    e.preventDefault();
    togglePause();
    return;
  }

  if (keys.has(e.code)) return; // ignore auto-repeat for one-shot actions
  keys.add(e.code);

  switch (e.code) {
    case 'Space':
      e.preventDefault();
      fireShot();
      break;
    case 'KeyF':
      eatBread();
      break;
    case 'KeyR':
      eatAmmo();
      break;
    case 'KeyV':
      toggleView();
      break;
    default:
      break;
  }

  // Number keys jump straight into a skirmish from the menu.
  if (!started && /^Digit[1-4]$/.test(e.code)) {
    const index = Number(e.code.slice(5)) - 1;
    if (MAPS[index]) startRound(MAPS[index].id, progress);
  }
});

window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
});

window.addEventListener('blur', () => {
  keys.clear();
  dropAim();
  resetTouchState();
});

// The menu's rifle pick. One function so both persistence and the live view
// state change together.
function selectWeapon(id) {
  gun = getWeapon(id);
  saveWeaponId(id);
  zoomLevels = gun.zoom;
  zoomIndex = 0;
  reticle.setZoom(zoomLevels[0].label);
  weapon.setSkin(gun);
  rechamberLeft = 0;
}

// Ammunition pick. Read at deploy time by the round, so this only has to keep
// the menu and storage in step.
function selectAmmo(id) {
  ammo = getAmmo(id);
  saveAmmoId(ammo.id);
  ui.toast(`${ammo.label} loaded`, 'toast-good');
}

const loadoutOptions = () => ({
  weaponId: gun.id,
  onSelectWeapon: selectWeapon,
  ammoId: ammo.id,
  onSelectAmmo: selectAmmo,
});

// The campaign card the menu shows: where you are on the ladder, what the
// chapter says, and the difficulty callback that only persists the choice —
// difficulty is read at deploy time, so switching mid-browse is safe.
const campaignOptions = () => {
  const cfg = levelConfig(progress);
  const chap = chapterFor(progress);
  return {
    level: progress,
    total: CAMPAIGN_TOTAL,
    mapId: cfg.mapId,
    chapterTitle: chap.title,
    lore: chap.lore,
    difficultyId,
    onSelectDifficulty: (id) => {
      difficultyId = id;
      saveDifficultyId(id);
      ui.toast(`Difficulty: ${getDifficulty(id).label}`, 'toast-warn');
    },
  };
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function fireShot() {
  if (!started || !round || ui.paused) return;
  if (rechamberLeft > 0) {
    // Early trigger on a cycling bolt: a dry mechanical click, nothing more.
    sfx.dry();
    return;
  }
  rechamberLeft = gun.rechamber;

  // The round decides whether it can fire at all. A blocked trigger is a dry
  // click — no bang, no recoil, no exposure, nothing believable happens.
  // NOTE on the protocol: fire() returns `false` only when the round isn't in
  // play, `{ blocked }` when the rifle itself refuses, and an object with
  // `fired: true` — either way the bolt has still cycled on a *miss*, so the
  // rechamber must NOT be cleared there.
  const shot = round.fire();
  if (shot === false) return;
  if (shot && shot.blocked) {
    sfx.dry();
    // No round went out, so nothing has to cycle: reset the bolt timer.
    rechamberLeft = 0;
    ui.setHud(round.snapshot());
    return;
  }

  // Hit or miss: a round left the barrel, so the bolt cycle stands.
  sfx.rifle(gun.sound);
  ui.setHud(round.snapshot());
}


function eatBread() {
  if (!started || !round || ui.paused) return;
  if (round.eat()) sfx.eat();
}

// R: the clip. A couple of seconds of nothing, which is what a reload is — do
// it behind cover, because pulling the trigger during it just clicks.
function eatAmmo() {
  if (!started || !round || ui.paused) return;
  if (!round.reload()) return;
  sfx.reload();
}

function togglePause(force) {
  if (!started || round.status !== STATUS.PLAYING) return;
  const next = typeof force === 'boolean' ? force : !ui.paused;
  document.body.classList.toggle('paused', next);

  if (next) {
    dropAim();
    ui.showPause({
      onResume: () => togglePause(false),
      onRestart: () => {
        ui.hidePause();
        // The same sortie number again — restart replays what you are on,
        // which for a skirmish is its place and for the campaign its ladder
        // slot (progress may have moved past it; that doesn't matter here).
        startRound(round.map.id, round.level);
      },
      onQuit: () => {
        ui.hidePause();
        started = false;
        resetTouchState();
        document.body.classList.remove('in-round', 'paused');
        reticle.hide();
      ui.showMenu(
        player,
        signedIn,
        startRound,
        () => goToSignIn(),
        loadoutOptions(),
        campaignOptions()
      );
      },
    });
    if (document.exitPointerLock) document.exitPointerLock();
  } else {
    ui.hidePause();
  }
}

// ---------------------------------------------------------------------------
// Flow
// ---------------------------------------------------------------------------

function startRound(mapId, levelOverride) {
  // The sortie number decides the map (campaign), unless a specific map was
  // asked for (skirmish, or the number-key shortcuts). The level still lands on
  // the round AFTER loadMap builds it, for the same reason as before: the round
  // object does not exist until then.
  const level = Math.max(
    1,
    Math.min(CAMPAIGN_TOTAL, Math.floor(Number(levelOverride) || progress))
  );
  const cfg = levelConfig(level);
  const diff = getDifficulty(difficultyId);
  // The effective map is the map's design with the sortie's stakes folded in:
  // thicker columns, more patrols, creeping pace. A clone per sortie keeps the
  // data layer untouched — MAPS stays the source of truth for what a place is.
  // A map OBJECT may arrive (restart passes the live round's map); resolve it
  // back to its place so stakes multiply once, not compound.
  const placeId = mapId && typeof mapId === 'object' ? mapId.id : mapId;
  const base = getMap(placeId || cfg.mapId);
  const map = {
    ...base,
    sentries: cfg.sentries,
    columns: cfg.columns,
    patrols: cfg.patrols,
    enemySpeed: base.enemySpeed * Math.min(1.35, cfg.enemySpeed) * diff.enemySpeed,
  };

  loadMap(map);
  round.level = level;
  round.campaign = cfg;
  round.difficulty = { noise: diff.noise, damage: diff.damage };
  currentLevel = level;

  round.start();
  started = true;
  shake = 0;
  resetTouchState();
  document.body.classList.add('in-round');
  document.body.classList.remove('paused');
  ui.hideMenu();
  ui.setPlayer(player, signedIn, () => goToSignIn());
  ui.setHud(round.snapshot());
  ui.setMeters(round.player);
  reticle.show();
  // A round begins at the hip: scope down, fresh magnification bolt open.
  aimT = 0;
  rechamberLeft = 0;
  reticle.setScopeProgress(0);
  reticle.setZoom(zoomLevels[0].label);
  zoomIndex = 0;
  // The scope glass only exists in first person; setView decides which overlay shows.
  setView(viewMode);
  world.update(0, camera);
}

function handleGameEvent(event) {
  switch (event.type) {
    case 'hit': {
      ui.showHit();
      sfx.hit();
      // The line is chosen from what the shot was: boss, streak, distance.
      const line = pickKillLine({
        kind: event.kind,
        distance: event.distance,
        streak: event.streak,
      });
      ui.showCallout(line.text, line.tone);
      break;
    }

    case 'wound': {
      // Hit, but the man is still up. The hitmarker confirms the shot; the
      // callout says how many rounds he has left so a boss never feels buggy.
      ui.showHit();
      sfx.hit();
      const line = pickWoundLine({ kind: event.kind, remaining: event.remaining });
      ui.showCallout(line.text, line.tone);
      break;
    }

    case 'mission':
      ui.announceMission(event);
      break;

    case 'missionDone':
      ui.toast(`${event.title} — done`, 'toast-good');
      break;

    case 'reloadStart':
      ui.toast('Stripping the clip in…', 'toast-warn');
      ui.setHud(round.snapshot());
      break;

    case 'reloaded':
      ui.toast(`Bolt loaded — ${event.inMag} rounds`, 'toast-good');
      ui.setHud(round.snapshot());
      break;

    case 'empty':
      // Turning the trigger with an empty mag (or mid-clip) is already handled
      // where fireShot is called; the toast teaches the fix once.
      ui.toast(event.reloading ? 'Still loading the clip' : 'Magazine empty — press R', 'toast-warn');
      ui.setHud(round.snapshot());
      break;

    case 'bread':
      sfx.eat();
      ui.toast('Winter bread', 'toast-good');
      break;

    case 'hurt':
      ui.flashDamage();
      sfx.hurt();
      break;

    case 'enemyShot':
      // Their rifle, at whatever distance it was fired from. The whizz of a
      // near miss is a separate event, so a miss reads as crack-then-pass.
      sfx.enemyRifle(event.distance || 100);
      break;

    case 'destroy':
      ui.toast(`Supply hit — ${event.destroyed}`, 'toast-good');
      ui.setHud(round.snapshot());
      break;

    case 'extraction':
      // The last objective is down but the camp has your range. Green smoke is
      // the rendezvous; the shells start walking in two seconds.
      world.showExtraction(event.x, event.z);
      sfx.flare();
      ui.announceMission({
        title: 'They have your range',
        brief: 'The guns are turning. Fall back to the green smoke — keep low, keep moving.',
      });
      ui.toast('Fall back to the green smoke', 'toast-bad');
      break;

    case 'shellIncoming':
      sfx.shellIncoming();
      break;

    case 'shellImpact':
      world.shellImpact(event.x, event.z);
      sfx.shellImpact(event.distance);
      shake = Math.min(1.4, shake + Math.max(0.12, 1 - (event.distance || 0) / 55) * 1.1);
      break;

    case 'nearMiss':
      sfx.incoming();
      break;

    case 'breach':
      ui.toast('The line is breached', 'toast-bad');
      break;

    case 'over':
      finishRound(event);
      break;

    default:
      break;
  }
}

async function finishRound(event) {
  started = false;
  resetTouchState();
  document.body.classList.remove('in-round', 'paused');
  dropAim();
  reticle.hide();
  if (world && world.hideExtraction) world.hideExtraction();
  if (document.exitPointerLock) document.exitPointerLock();
  event.won ? sfx.win() : sfx.lose();

  // Let the last callout land before the results card covers the screen. The
  // win line ("the general is down") is the payoff for the whole sortie and it
  // is gone in a frame if the overlay opens on the same tick.
  await new Promise((resolve) => setTimeout(resolve, event.won ? 1300 : 700));

  // ---- The ladder ----
  // A win opens exactly one more sortie; a loss replays the same number. The
  // old suomiLevel incremented on every round regardless of outcome, which made
  // the number meaningless — nothing to earn, nothing to protect.
  if (event.won) {
    const next = Math.min(CAMPAIGN_TOTAL, round.level + 1);
    // saveProgress only ever moves forward, so a replay of an older sortie
    // can't wound the ladder.
    saveProgress(next);
    progress = loadProgress();
  }

  // Shell shake must not leak into the results screen or the next sortie.
  shake = 0;

  let saved = null;
  if (signedIn) {
    // start.ng leaderboard keys must be lowercase snake_case; the game's own
    // `linesHeld` stays camelCase internally.
    saved = await saveScore({ kills: event.kills, lines_held: event.linesHeld });
  }
  const { entries, local } = await refreshBoard();

  ui.showResults(
    {
      won: event.won,
      kills: event.kills,
      linesHeld: event.linesHeld,
      linesLost: event.linesLost,
      shotsFired: event.shotsFired,
      breadFound: event.breadFound,
      board: entries,
      local,
      playerId: player ? player.id : null,
      signedIn,
      saved,
      onSignIn: () => goToSignIn(),
      // Sortie context for the results card: what you just finished, what a
      // win opened, and whether the exit was clean or under fire.
      sortie: round.level,
      next: event.won ? progress : round.level,
      clean: Boolean(event.clean),
    },
    () =>
      ui.showMenu(
        player,
        signedIn,
        startRound,
        () => goToSignIn(),
        loadoutOptions(),
        campaignOptions()
      )
  );
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------

const clock = new THREE.Clock();
let breathPhase = 0;
let stepTimer = 0;
let heartbeatTimer = 0;
// Shell concussion. Applied to the camera position only, never the aim, so a
// near miss rattles the picture without stealing a shot the player earned.
let shake = 0;

const scratchDir = new THREE.Vector3();
const scratchChest = new THREE.Vector3();
// Reused every frame — see round.js on why per-frame allocations are dropped.
const frameEuler = new THREE.Euler(0, 0, 0, 'YXZ');

function frame() {
  requestAnimationFrame(frame);

  // getDelta runs even while paused, so the clock never banks a huge delta to
  // spend in one jump when play resumes.
  const dt = Math.min(clock.getDelta(), 0.05);

  if (!started || ui.paused || !round) {
    renderer.render(scene, camera);
    return;
  }

  const p = round.player;
  const map = round.map;

  // Shift does two jobs, and which one is settled by what you're doing. Standing
  // with the scope up, it's a held breath. On the move, it's a sprint. Both are
  // the same instinct — commit, briefly — so one key is enough.
  const shift = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const crouching = keys.has('KeyC') || keys.has('ControlLeft') || touchCrouch;
  const sprinting = (shift || touchSprint) && !aiming && !crouching;

  // ---- Breathing ----
  // Two slow waves, so the sway never repeats on an obvious beat. Holding your
  // breath flattens it but drains stamina, and aiming steadies it further —
  // which is what makes bringing the rifle up worth doing.
  breathPhase += dt * (1.1 + p.exposure / 220);
  if (rechamberLeft > 0) rechamberLeft = Math.max(0, rechamberLeft - dt);
  // A phone has no Shift. Scoping in already steadies the rifle, so on touch the
  // hold is automatic while the glass is up — the stamina cost is unchanged.
  round.setBreathHold(shift || (TOUCH && aiming));
  const steady = round.breathHold;
  const aimSteady = aiming ? 0.5 : 1;

  // ---- The scope raise ----
  // One progress value drives the whole pickup: the camera's slide from the hip
  // field of view to the glass, the DOM scope fading in, and the rifle rising to
  // the eye in weapon.update below. Holding right-click is the only input here;
  // release and it runs the same move backwards.
  const raiseSpeed = dt / 0.3; // about a third of a second, eye to glass
  const wantAim = aiming && viewMode === VIEW.FIRST ? 1 : 0;
  // Step toward the target, not "up if below it": stepping up only when
  // wantAim > aimT ping-ponged forever at the top, once raiseSpeed past the
  // exact 1.0.
  aimT = THREE.MathUtils.clamp(aimT + raiseSpeed * Math.sign(wantAim - aimT), 0, 1);
  // Smoothstep on top of the linear clock, so the pickup eases in and out —
  // mechanical scopes have weight.
  const raised = aimT * aimT * (3 - 2 * aimT);
  reticle.setScopeProgress(raised);

  // Wobble is scaled by the field of view. Held at full strength it would be
  // amplified eightfold through the glass, which is neither playable nor what a
  // supported rifle actually does — the whole point of a scope is that it
  // settles the picture.
  const steadiness = THREE.MathUtils.clamp(camera.fov / FOV_FIRST, 0.18, 1);
  // The gun also sways: the M/28 settles fast, the LRS fights you less but is
  // slow to cycle. gun.sway is the loadout's multiplier on the whole wobble.
  const swayAmount =
    THREE.MathUtils.lerp(0.0075, 0.0011, steady) *
    (p.stamina < 25 ? 1.8 : 1) *
    aimSteady *
    steadiness *
    gun.sway;

  const swayYaw = (Math.sin(breathPhase) * 0.7 + Math.sin(breathPhase * 1.7 + 1.3) * 0.3) * swayAmount;
  const swayPitch = (Math.sin(breathPhase * 0.8 + 0.5) * 0.6 + Math.sin(breathPhase * 2.1) * 0.4) * swayAmount;

  // Recoil kicks the barrel up and slightly off, then settles. Heavy calibres
  // (gun.kick) throw the sight picture further.
  aim.recoilKick += (round.recoil * 0.06 * gun.kick - aim.recoilKick) * Math.min(1, dt * 12);

  aim.yaw += (aim.targetYaw - aim.yaw) * Math.min(1, dt * 14);
  aim.pitch += (aim.targetPitch - aim.pitch) * Math.min(1, dt * 14);

  // ---- Input ----
  // Pushed before the round integrates it, so movement and exposure are
  // calculated from the same frame's intent.
  round.setInput({
    fwd: THREE.MathUtils.clamp(
      (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0) + touchMove.y,
      -1,
      1
    ),
    strafe: THREE.MathUtils.clamp(
      (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0) + touchMove.x,
      -1,
      1
    ),
    crouch: crouching,
    sprint: sprinting,
    aiming,
  });
  // You face wherever you're looking, so walking is relative to the camera.
  p.yaw = aim.yaw;

  round.update(dt);

  // Footsteps, paced to how fast you're actually going. The timer is derived
  // from speed rather than set per stance, so a sprint is audibly a sprint and a
  // crawl is audibly a crawl without a table of cases.
  if (p.speedNow > 0.4) {
    stepTimer -= dt;
    if (stepTimer <= 0) {
      sfx.step();
      stepTimer = THREE.MathUtils.clamp(1.6 / Math.max(1.4, p.speedNow), 0.26, 0.62);
    }
  }

  // ---- Camera ----
  const totalYaw = aim.yaw + swayYaw;
  const totalPitch = aim.pitch + swayPitch + aim.recoilKick;
  const roll = Math.sin(breathPhase * 0.5) * 0.006 * (1 - steady);

  frameEuler.set(totalPitch, totalYaw, roll);
  scratchDir.set(0, 0, -1).applyEuler(frameEuler);

  // Crouching drops the eye line, which is most of what makes crouching feel
  // different from standing still.
  const eyeHeight = p.crouched ? EYE_Y_CROUCHED : EYE_Y;
  // A little bob while walking: enough to make the view feel alive, not
  // enough to spoil a shot you'd otherwise have made.
  const bob = p.speedNow > 0 ? Math.sin(p.walkPhase) * 0.03 : 0;
  const headY = p.groundY + eyeHeight + bob;

  if (viewMode === VIEW.FIRST) {
    camera.position.set(p.x, headY, p.z);
  } else {
    // Over the shoulder: back along the aim line and off to one side. The
    // orientation stays the aim orientation, so what is under the reticle is
    // exactly what the shot passes through; the side offset is only so the
    // player's own body sits to one side of the frame instead of filling it.
    const lift = aiming ? 0.32 : 0.85;
    const side = aiming ? 0.42 : 0.95;

    const rh = Math.hypot(scratchDir.x, scratchDir.z) || 1;
    const rightX = -scratchDir.z / rh;
    const rightZ = scratchDir.x / rh;

    // If the ground rises behind the player, pull the camera in rather than
    // lifting it. A lifted camera keeps the aim direction, so the player drops
    // out of the bottom of the frame — which is exactly what a ridge does.
    let dist = aiming ? 2.2 : 4.2;
    for (let i = 0; i < 8; i++) {
      const cx = p.x - scratchDir.x * dist + rightX * side;
      const cy = headY + lift - scratchDir.y * dist;
      const cz = p.z - scratchDir.z * dist + rightZ * side;
      if (cy >= terrainHeight(cx, cz, map) + 0.35 || dist <= 1) {
        camera.position.set(cx, cy, cz);
        break;
      }
      dist -= 0.45;
    }
    // Final guard: never leave the camera below the snow.
    const camGround = terrainHeight(camera.position.x, camera.position.z, map) + 0.3;
    if (camera.position.y < camGround) camera.position.y = camGround;
  }

  // Aim stays exactly where the player put it; the body of the camera takes the
  // hit. Decays fast enough to be a punch, not a handicap.
  if (shake > 0) {
    shake = Math.max(0, shake - dt * 2.4);
    const amp = shake * 0.16;
    camera.position.x += (Math.random() - 0.5) * amp;
    camera.position.y += (Math.random() - 0.5) * amp;
    camera.position.z += (Math.random() - 0.5) * amp * 0.4;
  }

  camera.quaternion.setFromEuler(frameEuler);

  // ---- Aim / zoom ----
  // First person aiming runs the scope raise; third person is just a pulled-in
  // over-the-shoulder framing. During the raise the field of view interpolates
  // between the hip eye and the glass, so the zoom arrives with the rifle
  // instead of after it.
  const targetFov =
    aimT > 0
      ? THREE.MathUtils.lerp(FOV_FIRST, zoomLevels[zoomIndex].fov, raised)
      : aiming && viewMode === VIEW.THIRD
        ? FOV_AIM_THIRD
        : viewMode === VIEW.THIRD
          ? FOV_THIRD
          : FOV_FIRST;
  camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 10);
  camera.updateProjectionMatrix();

  // ---- The rifle in your hands ----
  // It rides the same sway the camera does, so it reads as one object rather
  // than a sticker. `scopeT` raises it towards the eye as the scope comes up;
  // once the glass is fully in the rifle hands off to it and leaves frame.
  weapon.update(dt, {
    visible: viewMode === VIEW.FIRST,
    speed: p.speedNow,
    phase: p.walkPhase,
    swayYaw: totalYaw - aim.yaw,
    swayPitch: -(totalPitch - aim.pitch),
    recoil: round.recoil,
    scopeT: aimT,
  });

  // ---- Target bracket ----
  camera.updateMatrixWorld();
  updateReticle(map);

  // ---- HUD ----
  ui.setHud(round.snapshot());
  ui.setMeters(p);

  // The screen closing in as you're found is the warning you feel before you
  // read the meter. The vignette reads this variable.
  document.documentElement.style.setProperty('--exposure', String(p.exposure / 100));

  // ---- Heartbeat ----
  if (p.exposure > 45) {
    heartbeatTimer -= dt;
    if (heartbeatTimer <= 0) {
      sfx.heartbeat((p.exposure - 45) / 55);
      heartbeatTimer = THREE.MathUtils.lerp(1.1, 0.42, (p.exposure - 45) / 55);
    }
  }

  world.update(dt, camera);
  renderer.render(scene, camera);
  // Second pass, depth buffer cleared: the rifle always draws over the world.
  weapon.render(renderer);
}

// Projects the man under the aim line to the screen and hands the position to
// the reticle. Shown in every view: a bracket on a man you are nearly on is the
// only thing that teaches you to bring the scope up.
function updateReticle(map) {
  const probe = round.probe();
  if (!probe) {
    wasLocked = false;
    reticle.clearTarget();
    return;
  }

  scratchChest.set(probe.enemy.x, 1.15 + terrainHeight(probe.enemy.x, probe.enemy.z, map), probe.enemy.z);
  const ndc = scratchChest.project(camera);
  if (ndc.z > 1) {
    wasLocked = false;
    reticle.clearTarget();
    return;
  }

  const x = (ndc.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-ndc.y * 0.5 + 0.5) * window.innerHeight;
  // The bracket shrinks with range, which is most of what sells the zoom.
  const size = THREE.MathUtils.clamp(9000 / probe.distance, 42, 160);
  // `lethal` comes from the rules layer and uses the same radius as the shot, so
  // an orange bracket always means the next round lands.
  const locked = Boolean(probe.lethal);
  const hint =
    !aiming && viewMode === VIEW.FIRST && probe.distance > 45
      ? TOUCH
        ? 'hold AIM'
        : 'right-click'
      : '';

  if (locked && !wasLocked) sfx.lock();
  wasLocked = locked;

  reticle.setTarget({ x, y, distance: probe.distance, locked, size, hint });
}

// ---------------------------------------------------------------------------

ui.onPause(() => togglePause());
ui.onFire(() => fireShot());
ui.onAim((down) => setAiming(down));
// The rest of the laptop's keys, as touch controls. Movement is analog; the
// toggles are edge-triggered so a thumb does not have to hold them.
ui.onMove((v) => {
  touchMove.x = v.x;
  touchMove.y = v.y;
});
ui.onReload(() => eatAmmo());
ui.onCrouch((on) => {
  touchCrouch = on;
});
ui.onSprint((on) => {
  touchSprint = on;
});
ui.onView(() => toggleView());
ui.onBread(() => eatBread());
// A phone has no wheel, so the magnification ring gets its own button.
ui.onZoom(() => {
  if (aiming && viewMode === VIEW.FIRST) cycleZoom();
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    refreshPlayer();
    if (round && round.status === STATUS.PLAYING && started) togglePause(true);
  }
});
window.addEventListener('focus', refreshPlayer);

// Show the menu immediately. Asking start.ng who you are is a network round
// trip, and a black screen while it resolves reads as a broken game; the profile
// and board fill in when they arrive.
ui.showMenu(null, false, startRound, () => goToSignIn(), loadoutOptions(), campaignOptions());

(async function boot() {
  const { player: p } = await whoami();
  player = p;
  signedIn = Boolean(p && p.account);
  ui.setPlayer(player, signedIn, () => goToSignIn());
  await refreshBoard();
})();

// Dev-only handle for automated checks and for tuning from the console. Vite
// drops this whole block from the production build.
if (import.meta.env.DEV) {
  window.__sniper = {
    get round() {
      return round;
    },
    get camera() {
      return camera;
    },
    get viewMode() {
      return viewMode;
    },
    get weapon() {
      return weapon;
    },
    aim,
    setAiming,
    setView,
    setZoom: cycleZoom,
    zoom: () => zoomLevels[zoomIndex],
    fireShot,
    get gun() {
      return gun;
    },
    get ammo() {
      return ammo;
    },
    get missions() {
      return round ? round.missions : null;
    },
    // Test hook: start a sortie directly, on the same path the menu uses.
    startRound,
    reload: eatAmmo,
    get rechamberLeft() {
      return rechamberLeft;
    },
    terrainAt: (x, z) => (round ? terrainHeight(x, z, round.map) : 0),
    probe: () => (round ? round.probe() : null),
    get world() {
      return world;
    },
    get progress() {
      return progress;
    },
    get difficultyId() {
      return difficultyId;
    },
    // Dev-only view of the virtual stick and toggles, for the mobile suite.
    get touchState() {
      return {
        move: { x: touchMove.x, y: touchMove.y },
        crouch: touchCrouch,
        sprint: touchSprint,
        dragging: touchDrag.active,
      };
    },
  };
}

frame();

// Menu, HUD and results.
//
// All DOM over the canvas. The reticle needs to be crisp, the HUD needs to be
// readable in a blizzard, and the numbers need to be legible at a glance while
// you're watching a treeline rather than the screen.

import { getMap, MAPS } from '../data/maps.js';
import { WEAPONS } from '../data/weapons.js';
import { AMMO } from '../data/ammo.js';
import { DIFFICULTIES } from '../data/campaign.js';
import { drawMapPreview } from './preview.js';

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value !== null && value !== undefined) node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) if (child) node.appendChild(child);
  return node;
}

const WEATHER_LABEL = {
  clear: 'Clear and still',
  blizzard: 'Blizzard',
  fog: 'Fog',
  bright: 'Hard sun',
};

// A 5-dot rating row on a weapon card.
function statDots(label, value) {
  const dots = [];
  for (let i = 0; i < 5; i++) dots.push(el('span', { class: `w-dot${i < value ? ' w-dot-on' : ''}` }));
  return el('div', { class: 'w-stat' }, [
    el('span', { class: 'w-stat-label', text: label }),
    el('span', { class: 'w-dots' }, dots),
  ]);
}

function bar(label, className) {
  const fill = el('div', { class: `meter-fill ${className}` });
  return {
    root: el('div', { class: 'meter' }, [
      el('span', { class: 'meter-label', text: label }),
      el('div', { class: 'meter-track' }, [fill]),
    ]),
    set(value) {
      fill.style.width = `${Math.max(0, Math.min(100, value))}%`;
    },
    // Health turns red as it drains; the others don't need to shout.
    setLow(on) {
      fill.classList.toggle('meter-fill-low', on);
    },
  };
}

function boardTable(entries, local, highlightId) {
  const list = el('div', { class: 'board' });
  list.appendChild(
    el('div', { class: 'board-head' }, [
      el('span', { class: 'board-title', text: 'Global top scores' }),
      el('span', {
        class: `board-badge${local ? ' board-badge-off' : ''}`,
        text: local ? 'Not on start.ng' : 'Live',
      }),
    ])
  );

  if (!entries || entries.length === 0) {
    list.appendChild(el('p', { class: 'board-empty', text: 'No scores yet. Be the first.' }));
    return list;
  }

  entries.slice(0, 10).forEach((e) => {
    const stats = e.stats || {};
    list.appendChild(
      el('div', { class: `board-row${e.player_id === highlightId ? ' board-me' : ''}` }, [
        el('span', { class: 'board-rank', text: String(e.rank) }),
        el('span', { class: 'board-name', text: e.name }),
        el('span', { class: 'board-stat', text: `${stats.kills ?? 0} down` }),
        el('span', { class: 'board-stat', text: `${stats.linesHeld ?? 0} held` }),
      ])
    );
  });
  return list;
}

export function createUI(root) {
  let selectedMap = MAPS[0].id;
  // Guards setHud against rebuilding the DOM on every frame.
  let lastHudKey = '';

  // ---- Sights-adjacent feedback ------------------------------------------
  const vignette = el('div', { class: 'vignette hidden' });
  root.appendChild(vignette);

  const hitMarker = el('div', { class: 'hitmarker hidden' }, [
    el('span', { class: 'hitmarker-line hm-tl' }),
    el('span', { class: 'hitmarker-line hm-tr' }),
    el('span', { class: 'hitmarker-line hm-bl' }),
    el('span', { class: 'hitmarker-line hm-br' }),
  ]);
  root.appendChild(hitMarker);

  const damageFlash = el('div', { class: 'damage-flash' });
  root.appendChild(damageFlash);

  // ---- HUD ---------------------------------------------------------------
  const hud = el('div', { class: 'hud hidden' });

  // Your start.ng character. The platform's character rule wants an in-world
  // avatar or a profile card; this game is usually played from behind the scope
  // rather than behind a visible body, so it uses the profile card.
  const profileCard = el('div', { class: 'startng-card' });
  hud.appendChild(profileCard);

  const scoreLine = el('div', { class: 'hud-scores' });
  hud.appendChild(scoreLine);

  // Rounds in the rifle: `5/5`, refreshed only when it changes (see setHud).
  const ammoLine = el('div', { class: 'ammo hidden' });
  hud.appendChild(ammoLine);

  // The live objective. It sits under the score strip and is rebuilt with the
  // rest of the HUD only when the numbers change.
  const missionTitle = el('span', { class: 'mission-title' });
  const missionProgress = el('span', { class: 'mission-progress' });
  const missionLine = el('div', { class: 'mission hidden' }, [
    el('span', { class: 'mission-kicker', text: 'Objective' }),
    missionTitle,
    missionProgress,
  ]);
  hud.appendChild(missionLine);

  // Paluu: a bearing arrow and the distance to the smoke. Kept outside the HUD's
  // rebuild-on-change path because it moves every frame — two DOM writes are
  // cheaper than rebuilding the score strip for a changing number.
  const extractionArrow = el('span', { class: 'extraction-arrow', text: '➤' });
  const extractionText = el('span', { class: 'extraction-text' });
  const extractionLine = el('div', { class: 'extraction hidden' }, [
    extractionArrow,
    extractionText,
  ]);
  hud.appendChild(extractionLine);

  const health = bar('HEALTH', 'meter-fill-health');
  const stamina = bar('BREATH', 'meter-fill-stamina');
  const exposure = bar('SEEN', 'meter-fill-exposure');

  const meters = el('div', { class: 'meters' }, [exposure.root, health.root, stamina.root]);
  hud.appendChild(meters);

  const breadLine = el('div', { class: 'bread hidden' }, [
    el('span', { class: 'bread-icon', text: '🍞' }),
    el('span', { class: 'bread-count', text: '0' }),
    el('span', { class: 'bread-hint', text: 'F' }),
  ]);
  hud.appendChild(breadLine);

  const levelLine = el('div', { class: 'hud-level' }, [
    el('span', { class: 'level-label', text: 'SORTIE' }),
    el('span', { class: 'level-number', text: '1' }),
  ]);
  hud.appendChild(levelLine);

  const toast = el('div', { class: 'toast hidden' });
  hud.appendChild(toast);

  const pauseBtn = el('button', {
    class: 'hud-btn',
    text: 'II',
    'aria-label': 'Pause',
    onClick: () => hud._onPause && hud._onPause(),
  });
  hud.appendChild(pauseBtn);

  // Touch controls. Hidden by CSS on anything with a mouse, because the keyboard
  // and right-click already cover those. A phone has neither.
  //
  // AIM is a tap to raise and a tap to drop, not a hold. On a phone the other
  // thumb is busy dragging the view, and a button that has to stay pressed is a
  // button you cannot aim with. ZOOM replaces the mouse wheel, which a phone
  // does not have.
  let aimingTouch = false;
  const aimBtn = el('button', { class: 'touch-btn touch-aim', text: 'AIM', 'aria-label': 'Aim' });
  aimBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    aimingTouch = !aimingTouch;
    aimBtn.classList.toggle('touch-on', aimingTouch);
    hud._onAim && hud._onAim(aimingTouch);
  });

  const zoomBtn = el('button', {
    class: 'touch-btn touch-zoom',
    text: 'ZOOM',
    'aria-label': 'Magnification',
  });
  zoomBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    hud._onZoom && hud._onZoom();
  });

  const fireBtn = el('button', { class: 'touch-btn touch-fire', text: 'FIRE', 'aria-label': 'Fire' });
  fireBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    hud._onFire && hud._onFire();
  });

  // On <body>, not in the HUD. The scope's opaque surround is drawn later in
  // #ui, so anything inside the HUD disappears behind it — and the one moment
  // FIRE must be findable is the moment the scope is up.
  document.body.appendChild(el('div', { class: 'touch-pad' }, [zoomBtn, aimBtn, fireBtn]));

  root.appendChild(hud);

  // ---- Kill callouts and objective announcements --------------------------
  // On <body>, not in #ui: the scope's black surround covers #ui, and both of
  // these have to stay readable with the glass up. Same reason as the touch pad.
  const callout = el('div', { class: 'callout' });
  document.body.appendChild(callout);

  const bannerTitle = el('strong', { class: 'mission-banner-title' });
  const bannerBrief = el('span', { class: 'mission-banner-brief' });
  const missionBanner = el('div', { class: 'mission-banner' }, [
    el('span', { class: 'mission-banner-kicker', text: 'New objective' }),
    bannerTitle,
    bannerBrief,
  ]);
  document.body.appendChild(missionBanner);

  let calloutTimer = 0;
  let bannerTimer = 0;

  // ---- Loadout ------------------------------------------------------------
  // Three rifles, chosen before a round starts and persisted by main.js. The
  // cards are rebuilt on every click (three nodes, once per click — harmless)
  // and re-rendered with the current id whenever the menu is shown.
  let selectedWeapon = null;
  const weaponRow = el('div', { class: 'weapon-row' });

  function renderWeapons() {
    weaponRow.innerHTML = '';
    for (const w of WEAPONS) {
      const card = el('button', {
        class: `weapon-card${w.id === selectedWeapon ? ' weapon-card-on' : ''}`,
        'data-id': w.id,
        onClick: () => {
          if (selectedWeapon === w.id) return;
          selectedWeapon = w.id;
          renderWeapons();
          if (weaponRow._onSelect) weaponRow._onSelect(w.id);
        },
      });
      card.append(
        el('div', { class: 'weapon-name', text: w.name }),
        el('p', { class: 'weapon-tag', text: w.tag }),
        el('div', { class: 'weapon-stats' }, [
          statDots('GLASS', w.stats.zoom),
          statDots('STEADY', w.stats.steadiness),
          statDots('CYCLE', w.stats.cycle),
        ])
      );
      weaponRow.appendChild(card);
    }
  }

  // ---- Menu --------------------------------------------------------------
  // Two steps, in order, because a loadout is chosen for a place — not the
  // other way round. Step 1: where you are going (with a canvas-drawn preview
  // of the actual terrain). Step 2: what you carry. The map list is out of
  // sight during step 2; the preview captions stay.
  const menu = el('div', { class: 'menu hidden' });

  menu.append(
    el('header', { class: 'menu-head' }, [
      el('div', { class: 'kicker', text: 'Winter marksman' }),
      el('h1', { class: 'title', text: 'SUOMI SNIPER' }),
      el('p', {
        class: 'subtitle',
        text: 'Snow, a treeline and a scoped rifle. Wind the glass in, hold your breath, stop the columns before they reach the line — and do not be found.',
      }),
    ])
  );

  // ---- Step 1: deployment ------------------------------------------------
  const stepMap = el('div', { class: 'menu-step menu-step-map' });

  stepMap.append(el('div', { class: 'menu-kicker', text: '1 · Choose how to deploy' }));

  const modeRow = el('div', { class: 'mode-row' });
  const modeCampaign = el('button', { class: 'mode-chip', text: 'Campaign', onClick: () => setMode('campaign') });
  const modeSkirmish = el('button', { class: 'mode-chip', text: 'Skirmish', onClick: () => setMode('skirmish') });
  modeRow.append(modeCampaign, modeSkirmish);
  stepMap.appendChild(modeRow);

  // ---- Campaign panel ----------------------------------------------------
  // The spine. One card: which sortie you are on, one line of where you are in
  // the story, a painted preview of the ground, and the ladder bar. Nothing to
  // pick — the campaign picks for you; the only lever left is going to win it.
  const sortieLabel = el('div', { class: 'sortie-label' });
  const chapterTitle = el('div', { class: 'chapter-title' });
  const lore = el('p', { class: 'sortie-lore' });
  const progressLabel = el('div', { class: 'progress-label' });
  const progressBar = el('div', { class: 'progress-track' }, [el('div', { class: 'progress-fill' })]);

  const campaignPanel = el('div', { class: 'campaign-panel' }, [
    sortieLabel,
    chapterTitle,
    lore,
    progressLabel,
    progressBar,
  ]);

  // ---- Skirmish panel ----------------------------------------------------
  const mapRow = el('div', { class: 'map-row' });
  for (const map of MAPS) {
    const card = el('button', {
      class: `map-card${map.id === selectedMap ? ' map-card-on' : ''}`,
      'data-id': map.id,
      onClick: () => {
        selectedMap = map.id;
        for (const c of mapRow.children) {
          c.classList.toggle('map-card-on', c.dataset.id === selectedMap);
        }
        // Keep what Take Position deploys with in step with the pick, so a
        // player who switches places mid-way never deploys to the stale one.
        menu._spec = { mapId: selectedMap, level: menu._campaign ? menu._campaign.level : 1 };
        refreshPreview();
      },
    });

    const swatch = el('div', { class: `map-swatch map-swatch-${map.weather}` });
    card.append(
      swatch,
      el('div', { class: 'map-name', text: map.name }),
      el('div', { class: 'map-weather', text: `${map.region}` }),
      el('div', { class: 'map-sub', text: map.subtitle })
    );
    mapRow.appendChild(card);
  }
  const skirmishNote = el(
    'p',
    {
      class: 'skirmish-note',
      text: 'Free run in a place you have unlocked, at your current sortie\u2019s stakes. No ladder, no story \u2014 the same rules.',
    }
  );

  const skirmishPanel = el('div', { class: 'skirmish-panel' }, [mapRow, skirmishNote]);

  // The preview: the chosen map drawn as a picture of the place, captioned
  // with its real-world region. Drawn once per selection, never per frame.
  const previewCanvas = el('canvas', { class: 'map-preview-canvas', width: 960, height: 340 });
  const previewName = el('div', { class: 'preview-name' });
  const previewRegion = el('div', { class: 'preview-region' });
  const previewSub = el('div', { class: 'preview-sub' });
  const previewPanel = el('div', { class: 'map-preview' }, [
    previewCanvas,
    el('div', { class: 'preview-caption' }, [
      el('div', { class: 'preview-text' }, [previewName, previewRegion]),
      previewSub,
    ]),
  ]);
  stepMap.appendChild(previewPanel);

  const loadoutCta = el('button', {
    class: 'btn btn-primary btn-step',
    // The label is deliberately just "Next": it is one step in a two-step
    // deploy, and the step it opens explains itself.
    text: 'Next',
    onClick: () => setStep('loadout'),
  });
  stepMap.appendChild(loadoutCta);

  let menuMode = 'campaign';
  // What Take Position deploys with. Campaign lets main.js pick the map off the
  // sortie number; skirmish carries the picked place.
  menu._spec = { mapId: null, level: 1 };

  function setMode(mode) {
    menuMode = mode;
    const camp = mode === 'campaign';
    modeCampaign.classList.toggle('mode-on', camp);
    modeSkirmish.classList.toggle('mode-on', !camp);
    campaignPanel.classList.toggle('hidden', !camp);
    skirmishPanel.classList.toggle('hidden', camp);
    if (camp) {
      menu._spec = { mapId: null, level: menu._campaign ? menu._campaign.level : 1 };
      refreshCampaign();
    } else {
      menu._spec = { mapId: selectedMap, level: menu._campaign ? menu._campaign.level : 1 };
      refreshPreview();
    }
    updateStartLabel();
  }

  function refreshCampaign() {
    const c = menu._campaign || {};
    const map = getMap(c.mapId || 'kollaa');
    drawMapPreview(previewCanvas, map);
    previewName.textContent = map.name;
    previewRegion.textContent = map.region;
    previewSub.textContent = map.subtitle;
    sortieLabel.textContent = `SORTIE ${c.level || 1} OF ${c.total || 50}`;
    chapterTitle.textContent = c.chapterTitle || map.name;
    lore.textContent = c.lore || 'Ram your clip in and hold the cold off.';
    const done = Math.max(0, (c.level || 1) - 1);
    progressLabel.textContent = `${done} of ${(c.total || 50) - 1} previous sorties won`;
    progressBar.firstChild.style.width = `${((done / Math.max(1, (c.total || 50) - 1)) * 100).toFixed(1)}%`;
    reminderText.textContent = `Rifle & ammunition for sortie ${c.level || 1} — ${map.name.toLowerCase()}`;
    updateStartLabel();
  }

  function refreshPreview() {
    const map = getMap(selectedMap);
    drawMapPreview(previewCanvas, map);
    previewName.textContent = map.name;
    previewRegion.textContent = map.region;
    previewSub.textContent = map.subtitle;
    reminderText.textContent = `Rifle & ammunition for the ${map.name} · change deployment`;
    updateStartLabel();
  }

  // ---- Step 2: loadout ---------------------------------------------------
  const stepLoadout = el('div', { class: 'menu-step menu-step-loadout hidden' });

  const reminderText = el('span', { class: 'kicker-strong' });
  const deploymentReminder = el('div', { class: 'menu-kicker' }, [
    el('button', {
      class: 'reminder-back',
      text: 'change',
      onClick: () => setStep('map'),
    }),
    reminderText,
  ]);
  stepLoadout.append(
    el('div', { class: 'menu-kicker', text: '2 · Rifle & ammunition' }),
    deploymentReminder
  );
  stepLoadout.append(weaponRow);

  // Ammunition. Three loads with real trade-offs (see data/ammo.js): the choice
  // is legible on the card, not hidden in a stat sheet.
  const ammoRow = el('div', { class: 'ammo-row' });
  const ammoChips = AMMO.map((a) =>
    el(
      'button',
      {
        class: `ammo-chip${a.id === 'ball' ? ' ammo-on' : ''}`,
        'data-id': a.id,
        onClick: () => {
          if (ammoRow._onSelect) ammoRow._onSelect(a.id);
          for (const chip of ammoRow.children) {
            chip.classList.toggle('ammo-on', chip.dataset.id === a.id);
          }
        },
      },
      [
        el('span', { class: 'ammo-chip-head' }, [
          el('span', { class: 'ammo-chip-name', text: a.label }),
          el('span', { class: 'ammo-chip-tag', text: a.short }),
        ]),
        el('span', { class: 'ammo-chip-note', text: a.note }),
      ]
    )
  );
  ammoRow.append(...ammoChips);
  stepLoadout.append(ammoRow);

  // Difficulty: a choice, not a gate. It scales how loud you are, how hard
  // enemy fire bites, and how fast they walk — but no sortie unlocks because of
  // it. The ladder's gate is winning; difficulty is about the evening you want.
  const difficultyLabel = el('div', { class: 'menu-kicker', text: 'Difficulty' });
  const difficultyRow = el('div', { class: 'difficulty-row' });
  const difficultyChips = DIFFICULTIES.map((d) =>
    el('button', {
      class: 'diff-chip',
      'data-id': d.id,
      text: d.label,
      onClick: () => {
        if (difficultyRow._onSelect) difficultyRow._onSelect(d.id);
        for (const chip of difficultyRow.children) {
          chip.classList.toggle('diff-on', chip.dataset.id === d.id);
        }
      },
    })
  );
  difficultyRow.append(...difficultyChips);
  stepLoadout.append(difficultyLabel, difficultyRow);

  const backCta = el('button', {
    class: 'btn btn-ghost',
    text: 'Back to deployments',
    onClick: () => setStep('map'),
  });
  stepLoadout.append(backCta);

  function setStep(step) {
    const first = step === 'map';
    stepMap.classList.toggle('hidden', !first);
    stepLoadout.classList.toggle('hidden', first);
    backCta.classList.toggle('hidden', first);
    // Deploy only once a rifle is chosen; the primary CTA lives in step 2.
    startBtn.classList.toggle('hidden', first);
    if (first) {
      if (menuMode === 'campaign') refreshCampaign();
      else refreshPreview();
    }
    menu.dataset.step = step;
  }

  stepMap.append(campaignPanel, skirmishPanel);

  menu.append(stepMap, stepLoadout);

  const menuCard = el('div', { class: 'menu-profile' });
  menu.appendChild(menuCard);

  // Finnish motivational phrases shown before each level
  const MOTIVATIONS = [
    'Sisu ei lopu koskaan.',
    'Onnea matkalle.',
    'Jokainen taso vaikeammaksi.',
    'Pysy piilossa, pysy elossa.',
    'Lumi peittää jälkit, mutta ei ääniä.',
  ];
  let motivationIndex = 0;

  const note = el('p', { class: 'history-note' });
  note.textContent =
    'Winter camouflage against a line of infantry. Fire and the snow tells on you; move and it tells sooner. The bracket turns orange when the shot will land. Every sortie is its own operation — watchtowers, supply dumps, a sniper duel, a hold in the snow — built from the sortie number, never the same four beats twice. A small personal project.';

  // motivation banner — shown after map selection, before start
  const motIdx = (motivationIndex++) % MOTIVATIONS.length;
  const motivationBanner = el('div', { class: 'motivation-banner' }, [
    el('p', { class: 'motivation-text', text: MOTIVATIONS[motIdx] }),
  ]);
  // `note` has to be in the tree before it can be used as an insertion point.
  menu.appendChild(note);
  menu.insertBefore(motivationBanner, note);

  // The controls, spelled out. A stealth game lives or dies on the player
  // knowing that crouching and standing still are things they can do.
  const controls = el('div', { class: 'controls' }, [
    el('span', { class: 'control' }, [
      el('b', { text: 'WASD' }),
      el('span', { text: 'move' }),
    ]),
    el('span', { class: 'control' }, [
      el('b', { text: 'Mouse' }),
      el('span', { text: 'look' }),
    ]),
    el('span', { class: 'control' }, [
      el('b', { text: 'Right-click' }),
      el('span', { text: 'raise the scope' }),
    ]),
    el('span', { class: 'control' }, [
      el('b', { text: 'Wheel' }),
      el('span', { text: 'magnification' }),
    ]),
    el('span', { class: 'control' }, [
      el('b', { text: 'Click' }),
      el('span', { text: 'fire' }),
    ]),
    el('span', { class: 'control' }, [
      el('b', { text: 'Shift' }),
      el('span', { text: 'sprint / hold breath' }),
    ]),
    el('span', { class: 'control' }, [
      el('b', { text: 'C' }),
      el('span', { text: 'crouch' }),
    ]),
    el('span', { class: 'control' }, [
      el('b', { text: 'V' }),
      el('span', { text: 'first / third person' }),
    ]),
    el('span', { class: 'control' }, [
      el('b', { text: 'F' }),
      el('span', { text: 'eat bread' }),
    ]),
  ]);
  menu.appendChild(controls);

  const startBtn = el('button', {
    id: 'menuStart',
    class: 'btn btn-primary btn-deploy',
    text: 'Deploy',
    // Campaign deploys at the sortie number the ladder says; skirmish carries
    // the picked place. main.js resolves the map for a campaign sortie itself.
    onClick: () => {
      const spec = menu._spec || { mapId: selectedMap, level: 1 };
      menu._onStart(spec.mapId, spec.level);
    },
  });
  menu.appendChild(startBtn);

  // The deploy button is the last thing a player reads before the snow. It says
  // exactly what it will do — the sortie number, or the place for a skirmish.
  function updateStartLabel() {
    if (!menu._campaign && !menu._spec) return;
    const spec = menu._spec || {};
    const campaign = menu._campaign || {};
    if (menuMode === 'campaign') {
      startBtn.textContent = `Deploy — Sortie ${campaign.level || spec.level || 1}`;
    } else {
      const map = getMap(spec.mapId || selectedMap);
      startBtn.textContent = `Deploy — ${map.name}`;
    }
  }

  root.appendChild(menu);

  // ---- Pause -------------------------------------------------------------
  const pausePanel = el('div', { class: 'overlay hidden' });
  const pauseCard = el('div', { class: 'overlay-card' });
  pausePanel.appendChild(pauseCard);
  root.appendChild(pausePanel);

  // ---- Results -----------------------------------------------------------
  const results = el('div', { class: 'overlay hidden' });
  root.appendChild(results);

  // -----------------------------------------------------------------------

  // The profile card. `player` is the start.ng user or guest.
  function renderProfile(player, signedIn, onSignIn) {
    profileCard.innerHTML = '';
    menuCard.innerHTML = '';
    if (!player) return;

    for (const host of [profileCard, menuCard]) {
      const big = host === menuCard;
      host.append(
        el('img', {
          class: big ? 'startng-face startng-face-big' : 'startng-face',
          src: player.face || '',
          alt: '',
        }),
        el('div', { class: 'startng-meta' }, [
          el('b', { text: player.name }),
          el('span', { text: signedIn ? `@${player.account}` : 'Guest' }),
        ]),
        signedIn
          ? null
          : el('button', {
              class: 'startng-signin',
              text: 'Sign in',
              onClick: () => onSignIn(),
            })
      );
    }
  }

  let toastTimer = null;
  function showToast(text, kind = '') {
    toast.textContent = text;
    toast.className = `toast ${kind}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('hidden'), 1800);
  }

  // `tone` is 'good', 'boss' or 'wound' — it only changes the colour.
  function showCallout(text, tone = 'good') {
    if (!text) return;
    callout.textContent = text;
    // Resetting the class and forcing a reflow restarts the animation, so two
    // kills in quick succession both show instead of the second one inheriting
    // a half-finished fade.
    callout.className = 'callout';
    void callout.offsetWidth;
    callout.classList.add(`callout-${tone}`, 'callout-on');
    clearTimeout(calloutTimer);
    calloutTimer = setTimeout(() => callout.classList.remove('callout-on'), 1900);
  }

  function announceMission({ title, brief } = {}) {
    if (!title) return;
    bannerTitle.textContent = title;
    bannerBrief.textContent = brief || '';
    missionBanner.className = 'mission-banner';
    void missionBanner.offsetWidth;
    missionBanner.classList.add('mission-banner-on');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => missionBanner.classList.remove('mission-banner-on'), 3800);
  }

  function clearCallouts() {
    clearTimeout(calloutTimer);
    clearTimeout(bannerTimer);
    callout.classList.remove('callout-on');
    missionBanner.classList.remove('mission-banner-on');
  }

  return {
    // ---- Menu ----------------------------------------------------------
    // `loadout` is { weaponId, onSelectWeapon } — the chosen rifle and the
    // callback that hands a pick back to main.js, which owns persistence and
    // the actual weapon stats. `campaign` is { level, total, mapId,
    // chapterTitle, lore, difficultyId, onSelectDifficulty } — the ladder state
    // main.js owns, rendered here as the sortie card.
    showMenu(player, signedIn, onStart, onSignIn, loadout = {}, campaign = {}) {
      menu._onStart = onStart;
      menu._campaign = campaign;
      selectedWeapon = loadout.weaponId || WEAPONS[1].id;
      weaponRow._onSelect = loadout.onSelectWeapon || null;
      ammoRow._onSelect = loadout.onSelectAmmo || null;
      const chosenAmmo = loadout.ammoId || 'ball';
      for (const chip of ammoRow.children) {
        chip.classList.toggle('ammo-on', chip.dataset.id === chosenAmmo);
      }
      difficultyRow._onSelect = campaign.onSelectDifficulty || null;
      const chosenDiff = campaign.difficultyId || 'regular';
      for (const chip of difficultyRow.children) {
        chip.classList.toggle('diff-on', chip.dataset.id === chosenDiff);
      }
      renderWeapons();
      setStep('map');
      setMode('campaign');
      renderProfile(player, signedIn, onSignIn);
      clearCallouts();
      menu.classList.remove('hidden');
      hud.classList.add('hidden');
      results.classList.add('hidden');
      pausePanel.classList.add('hidden');
      vignette.classList.add('hidden');
    },

    hideMenu() {
      menu.classList.add('hidden');
      hud.classList.remove('hidden');
      vignette.classList.remove('hidden');
    },

    // ---- HUD -----------------------------------------------------------
    setPlayer(player, signedIn, onSignIn) {
      renderProfile(player, signedIn, onSignIn);
    },

    // Rebuilt only when a number actually changes. This is called every frame
    // from the game loop, and tearing down and rebuilding the DOM at 60fps
    // makes the HUD flicker and costs more than the whole render.
    setHud({ kills, linesHeld, linesLost, columnsLeft, breadHeld, level, mission, ammo, extraction }) {
      // The extraction readout updates every frame; the rest of the HUD only
      // rebuilds when a number changes.
      if (extraction && extraction.active) {
        extractionLine.classList.remove('hidden');
        extractionArrow.style.transform = `rotate(${(extraction.relative || 0).toFixed(3)}rad)`;
        extractionText.textContent = `FALL BACK — ${Math.round(extraction.distance)} m`;
      } else {
        extractionLine.classList.add('hidden');
      }

      const missionKey = mission ? `${mission.id}:${mission.progress}/${mission.total}` : 'none';
      const ammoKey = ammo ? `${ammo.inMag}/${ammo.size}${ammo.reloading ? '~' : ''}` : 'x';
      const key = `${kills}|${columnsLeft}|${linesLost}|${breadHeld}|${level}|${missionKey}|${ammoKey}|${extraction ? 'exit' : ''}`;
      if (key === lastHudKey) return;
      lastHudKey = key;

      if (mission) {
        missionLine.classList.remove('hidden');
        missionTitle.textContent = mission.title;
        // Hold objectives count up in seconds; every other type counts targets.
        missionProgress.textContent =
          mission.type === 'hold'
            ? `${mission.progress}s / ${mission.total}s`
            : `${mission.progress}/${mission.total}`;
      } else {
        missionLine.classList.add('hidden');
      }

      scoreLine.innerHTML = '';
      scoreLine.append(
        el('div', { class: 'hud-stat' }, [
          el('b', { text: String(kills) }),
          el('span', { text: 'down' }),
        ]),
        el('div', { class: 'hud-stat' }, [
          el('b', { text: String(columnsLeft) }),
          el('span', { text: 'columns left' }),
        ]),
        el('div', { class: 'hud-stat' }, [
          el('b', { text: String(linesLost) }),
          el('span', { text: 'breached' }),
        ]),
        el('span', { class: 'hud-level-number', text: String(level) })
      );

      // Rounds left. Ticks red at the last two or a reload, and mentions R so
      // the fix is next to the number that needs it.
      if (ammo) {
        const low = ammo.reloading || ammo.inMag <= 2;
        ammoLine.innerHTML = '';
        ammoLine.append(
          el('span', { class: 'ammo-icon', text: '◈' }),
          el('span', { class: 'ammo-count', text: ammo.reloading ? '···' : `${ammo.inMag}/${ammo.size}` }),
          el('span', { class: 'ammo-hint', text: ammo.reloading ? 'loading' : 'R' })
        );
        ammoLine.classList.toggle('ammo-low', low);
        ammoLine.classList.remove('hidden');
      }

      breadHeld > 0 ? breadLine.classList.remove('hidden') : breadLine.classList.add('hidden');
      breadLine.querySelector('.bread-count').textContent = String(breadHeld);
    },

    // The parameter names are deliberately different from the meter objects
    // above. Destructuring as `health` here would shadow the bar and turn it
    // into a number, which is exactly the bug that produced
    // "health.set is not a function".
    setMeters({ health: healthValue, stamina: staminaValue, exposure: exposureValue }) {
      health.set(healthValue);
      health.setLow(healthValue < 35);
      stamina.set(staminaValue);
      exposure.set(exposureValue);
    },

    // ---- Feedback ------------------------------------------------------
    showHit() {
      hitMarker.classList.remove('hidden');
      hitMarker.classList.add('hitmarker-on');
      setTimeout(() => {
        hitMarker.classList.add('hidden');
        hitMarker.classList.remove('hitmarker-on');
      }, 260);
    },

    showCallout,
    announceMission,
    hideCallouts: clearCallouts,

    flashDamage() {
      damageFlash.classList.remove('damage-on');
      void damageFlash.offsetWidth;
      damageFlash.classList.add('damage-on');
    },

    toast: showToast,

    // ---- Pause ---------------------------------------------------------
    onPause(handler) {
      hud._onPause = handler;
    },

    onFire(handler) {
      hud._onFire = handler;
    },

    onAim(handler) {
      hud._onAim = handler;
    },

    onZoom(handler) {
      hud._onZoom = handler;
    },

    // The touch AIM button is a toggle, so it has to be told when the game has
    // dropped the scope behind its back — on quit, pause or restart.
    resetAim() {
      aimingTouch = false;
      aimBtn.classList.remove('touch-on');
    },

    showPause({ onResume, onRestart, onQuit }) {
      pauseCard.innerHTML = '';
      pauseCard.append(
        el('h2', { class: 'overlay-title', text: 'Holding' }),
        el('p', { class: 'overlay-sub', text: 'The line waits.' }),
        el('button', { class: 'btn btn-primary', text: 'Back to it', onClick: onResume }),
        el('button', { class: 'btn btn-ghost', text: 'Restart this map', onClick: onRestart }),
        el('button', { class: 'btn btn-ghost', text: 'Pick another map', onClick: onQuit })
      );
      pausePanel.classList.remove('hidden');
    },

    hidePause() {
      pausePanel.classList.add('hidden');
    },

    get paused() {
      return !pausePanel.classList.contains('hidden');
    },

    // ---- Results -------------------------------------------------------
    // `campaign` is { sortie, next } — which sortie just ended and, on a win,
    // which one it opened. The card says it instead of a generic "Again": the
    // read either way is you earned the next one or you get to earn this one.
    showResults({ won, kills, linesHeld, linesLost, shotsFired, breadFound, board, local, playerId, signedIn, saved, onSignIn, sortie, next, clean }, onReplay) {
      clearCallouts();
      results.innerHTML = '';

      const accuracy = shotsFired > 0 ? Math.round((kills / shotsFired) * 100) : 0;
      const sortieLine = Number.isFinite(sortie)
        ? won && Number.isFinite(next)
          ? `Sortie ${sortie} held — sortie ${next} unlocked.`
          : `Sortie ${sortie} waits. It stays unlocked until you hold the line.`
        : null;
      // Paluu: the exit is the story of the sortie. A clean slip is the mastery
      // read; getting out under fire is the one players will retell.
      const exitLine = won
        ? clean
          ? 'Clean exit — the snow never told on you.'
          : 'You got out under fire.'
        : null;

      let saveLine;
      if (!signedIn) {
        saveLine = el('button', {
          class: 'btn btn-ghost',
          text: 'Sign in to save your score',
          onClick: () => onSignIn(),
        });
      } else if (saved && saved.ok === false) {
        saveLine = el('p', { class: 'summary-note', text: saved.error || 'Score not saved.' });
      } else if (saved && saved.improved) {
        saveLine = el('p', {
          class: 'summary-note summary-note-good',
          text: `New best — you're #${saved.rank}`,
        });
      } else if (saved) {
        saveLine = el('p', { class: 'summary-note', text: `You're #${saved.rank}` });
      }

      results.append(
        el('div', { class: 'overlay-card' }, [
          el('div', { class: 'kicker', text: won ? 'Line held' : 'You were found' }),
          el('h1', { class: 'title', text: won ? 'THE LINE HOLDS' : 'FOUND' }),
          el('p', {
            class: 'overlay-sub',
            text: won
              ? 'The columns are stopped. Another night in the snow.'
              : 'They worked out where you were. Better to move sooner.',
          }),
          sortieLine ? el('p', { class: 'summary-note summary-note-good', text: sortieLine }) : null,
          exitLine
            ? el('p', {
                class: `summary-note${clean ? ' summary-note-good' : ''}`,
                text: exitLine,
              })
            : null,
          el('div', { class: 'summary-rows' }, [
            el('div', { class: 'summary-row' }, [
              el('span', { text: 'Down' }),
              el('strong', { text: String(kills) }),
            ]),
            el('div', { class: 'summary-row' }, [
              el('span', { text: 'Columns stopped' }),
              el('strong', { text: `${linesHeld} of ${linesHeld + linesLost}` }),
            ]),
            el('div', { class: 'summary-row' }, [
              el('span', { text: 'Rounds fired' }),
              el('strong', { text: `${shotsFired} · ${accuracy}% on target` }),
            ]),
            el('div', { class: 'summary-row' }, [
              el('span', { text: 'Bread found' }),
              el('strong', { text: String(breadFound) }),
            ]),
          ]),
          saveLine,
          board ? boardTable(board, local, playerId) : null,
          el('button', { class: 'btn btn-primary', text: won ? 'To the next sortie' : 'Take it again', onClick: onReplay }),
        ])
      );
      results.classList.remove('hidden');
      hud.classList.add('hidden');
      vignette.classList.add('hidden');
    },
  };
}
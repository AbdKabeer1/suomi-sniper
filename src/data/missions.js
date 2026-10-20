// The objectives for a sortie.
//
// The first sortie is the tutorial and stays fixed: sentries teach the scope,
// the column teaches the cost of a shot, the officer and general teach that a
// target can take more than one round. After that the ladder must not be the
// same four beats fifty times, so each sortie draws a *plan* from a rotating
// set of mission shapes:
//
//   kill      — a kind of man must go down (sentries, tower watchmen, patrols,
//               camp guards, an officer, a sniper, the general)
//   destroy   — the camp's supply crates and fuel drums must be shot apart
//   hold      — stay alive and unfound for a stretch of time
//
// Plans are picked by sortie number, so the menu and the round agree about
// sortie 23 without any extra state. The variety is real, not cosmetic: tower
// watchmen are elevated and shoot down at you, a sniper duel is a two-way
// exchange, crates are cold objects you have to find through the scope, and a
// hold objective turns the round into a waiting game you can lose by moving.
//
// Every mission carries `title` + `brief` because the brief is the only place
// the player learns what this sortie is asking of them.

const kill = (id, kind, target, title, brief, spawn) => ({
  id,
  type: 'kill',
  kind,
  target,
  title,
  brief,
  ...(spawn ? { spawn } : {}),
});

const destroy = (id, target, title, brief) => ({
  id,
  type: 'destroy',
  kind: 'crate',
  target,
  title,
  brief,
});

const hold = (id, seconds, title, brief) => ({
  id,
  type: 'hold',
  seconds,
  title,
  brief,
});

// Sortie 1. Kept exactly as the old chain, because it is the one that has to
// teach every rule before the game starts varying them.
function tutorial(map) {
  return [
    kill(
      'sentries',
      'sentry',
      map.sentries ?? 2,
      'Quiet the sentries',
      'Two men on the posts, watching the approach. Take them before they raise the alarm.'
    ),
    kill(
      'column',
      'column',
      2,
      'Stop the column',
      'Drop two men from the column. The rest will hesitate, and hesitation buys you a minute.'
    ),
    kill(
      'officer',
      'officer',
      1,
      'Kill the officer',
      'An officer is coming up behind two guards. He takes two hits — and his guards will hunt you.',
      { kind: 'officer', health: 2, escorts: 2 }
    ),
    kill(
      'general',
      'general',
      1,
      'Kill the general',
      'The general himself, holding at long range with an escort. Three hits. Do not lose him.',
      { kind: 'general', health: 3, escorts: 2 }
    ),
  ];
}

// Each plan is a function of the sortie number so counts can creep with depth
// without changing the shape. `extra` is deliberately tiny: the challenge in
// this game is the exposure economy, not a target-count treadmill.
const PLANS = [
  // 0 — Watchposts. Teaches that height is a threat: the towers have to go
  // first or you spend the whole sortie being glassed.
  (n) => {
    const extra = n >= 22 ? 1 : 0;
    return [
      kill(
        'tower',
        'tower',
        2,
        'Silence the watchtowers',
        'Two men in the towers have the approach under glass. Take them before they call the alarm.'
      ),
      kill(
        'sentries',
        'sentry',
        2 + extra,
        'Clear the ground posts',
        'The posts are watching the wire. Two shots, two silences — and then the camp will notice.'
      ),
      kill(
        'officer',
        'officer',
        1,
        'Kill the inspecting officer',
        'He is walking the posts to find out why they went quiet. Two hits, and his guards will come looking.',
        { kind: 'officer', health: 2, escorts: 2 }
      ),
    ];
  },

  // 1 — Supply line. A column moving through, and the dump that feeds it.
  (n) => {
    const extra = n >= 26 ? 1 : 0;
    return [
      kill(
        'column',
        'column',
        2 + extra,
        'Break the column',
        'The column is moving on the line. Two men down will stall it while you turn on its supplies.'
      ),
      destroy(
        'supply',
        3,
        'Burn the supply dump',
        'Crates and fuel drums behind the tents. Shoot the dump apart and the column stops eating.'
      ),
      kill(
        'officer',
        'officer',
        1,
        'Kill the supply officer',
        'An officer is coming out to see the smoke. He takes two hits — make them count.',
        { kind: 'officer', health: 2, escorts: 2 }
      ),
    ];
  },

  // 2 — Camp raid. The camp itself is the objective.
  (n) => {
    const extra = n >= 30 ? 1 : 0;
    return [
      destroy(
        'supply',
        3 + extra,
        'Raid the camp stores',
        'Three crates in the open, guarded. Everything in that camp is a target and nothing is close.'
      ),
      kill(
        'camp',
        'guard',
        2,
        'Kill the camp guards',
        'Two men are working the tents. They have rifles in their hands now — they heard the crates go.'
      ),
      kill(
        'general',
        'general',
        1,
        'Kill the general',
        'He is at the camp flag, directing the search. Three hits, and his escort will not make it easy.',
        { kind: 'general', health: 3, escorts: 2 }
      ),
    ];
  },

  // 3 — The duel. A sniper on the tower is shooting back, and he is good.
  (n) => {
    const extra = n >= 28 ? 1 : 0;
    return [
      kill(
        'sniper',
        'sniper',
        1,
        'Win the duel',
        'A sniper is up in the tower with a scope on your side of the line. He fires fast and he does not miss twice. Kill him first.',
        { kind: 'sniper', health: 1, escorts: 1, onTower: true }
      ),
      kill(
        'patrol',
        'patrol',
        2 + extra,
        'Break the patrol',
        'The patrol below the tower is coming to find you. Two men, and they know the ground.'
      ),
      kill(
        'officer',
        'officer',
        1,
        'Kill the officer',
        'The officer who sent the sniper up is still on the road. Two hits, and his guards are already moving.',
        { kind: 'officer', health: 2, escorts: 2 }
      ),
    ];
  },

  // 4 — Hold. The only objective that punishes impatience instead of aim.
  (n) => {
    const seconds = 35 + Math.min(20, Math.floor(n / 2));
    return [
      hold(
        'hold',
        seconds,
        'Wait them out',
        'The camp is alert and searching. Stay small, stay still, and let the sweep pass. Any noise resets their patience.'
      ),
      kill(
        'column',
        'column',
        2,
        'Stop the column',
        'They gave up the sweep and pushed the column forward instead. Two men down will hold the line.'
      ),
      kill(
        'general',
        'general',
        1,
        'Kill the general',
        'He has come forward to force the crossing himself. Three hits, at range, with his escort watching.',
        { kind: 'general', health: 3, escorts: 2 }
      ),
    ];
  },

  // 5 — Long watch. A slow, tense sortie that opens with waiting.
  (n) => {
    const seconds = 25 + Math.min(15, Math.floor(n / 3));
    return [
      kill(
        'sentries',
        'sentry',
        2,
        'Quiet the sentries',
        'The posts are close tonight. Take both men without letting the camp hear it.'
      ),
      hold(
        'hold',
        seconds,
        'Stay unseen',
        'The relief column is sweeping the treeline. Nothing to shoot — just do not be found while it passes.'
      ),
      kill(
        'officer',
        'officer',
        1,
        'Kill the officer',
        'The sweep left an officer behind to count the posts. Two hits before he counts you.',
        { kind: 'officer', health: 2, escorts: 2 }
      ),
    ];
  },

  // 6 — Hunt. Patrol first, then the tower that directs it.
  (n) => {
    const extra = n >= 32 ? 1 : 0;
    return [
      kill(
        'patrol',
        'patrol',
        3,
        'Hunt the patrol',
        'A patrol is working the near treeline. Three men — they will hear the first shot and come at you.'
      ),
      kill(
        'tower',
        'tower',
        2,
        'Silence the towers',
        'The tower men are directing the patrol by hand signal. Take the eyes out of the fight.'
      ),
      kill(
        'sniper',
        'sniper',
        1,
        'Kill their marksman',
        'They have put a marksman on the ridge with orders to find you. He shoots first if you let him.',
        { kind: 'sniper', health: 1, escorts: 1, onTower: true }
      ),
    ];
  },

  // 7 — Assault. The camp is being packed up and moved; stop all of it.
  (n) => {
    const extra = n >= 34 ? 1 : 0;
    return [
      destroy(
        'supply',
        3 + extra,
        'Break the camp stores',
        'They are loading the crates onto the trucks. Every crate you break is a day they cannot advance.'
      ),
      hold(
        'hold',
        25,
        'Let the sweep pass',
        'The camp is up and angry, working the treeline in pairs. Go to ground and let them walk past.'
      ),
      kill(
        'general',
        'general',
        1,
        'Kill the general',
        'He is at the trucks, trying to save what is left. Three hits and the camp has no head.',
        { kind: 'general', health: 3, escorts: 2 }
      ),
    ];
  },
];

// The last two sorties are the campaign's crescendo: every mechanic at once,
// and a general who has learned to travel with a sniper of his own.
function finale() {
  return [
    hold(
      'hold',
      30,
      'Let the camp settle',
      'The last camp is alert and the treeline is full of searchers. Be nothing for thirty seconds.'
    ),
    destroy('supply', 4, 'Burn the last supplies', 'Four crates and a fuel drum. The trucks are not leaving.'),
    kill(
      'sniper',
      'sniper',
      1,
      'Kill the marksman',
      'Their best shot is on the tower with a clear line down your approach. He is waiting for you to move.',
      { kind: 'sniper', health: 1, escorts: 0, onTower: true }
    ),
    kill(
      'general',
      'general',
      1,
      'Kill the general',
      'Everything they have left is on this ridge. Three hits, and it is over.',
      { kind: 'general', health: 3, escorts: 2 }
    ),
  ];
}

export function buildMissions(level, map) {
  const n = Math.max(1, Math.floor(Number(level) || 1));
  if (n === 1) return tutorial(map);
  if (n >= 49) return finale();
  // Sorties 2..48 cycle the eight plans. Consecutive sorties never share one,
  // so the player feels the change immediately rather than on a long cycle.
  const plan = PLANS[(n - 2) % PLANS.length];
  return plan(n);
}

// A short, human label for the sortie's opening objective — used on the menu
// so the player knows what kind of evening they are walking into.
export function missionKindLabel(mission) {
  if (!mission) return '';
  if (mission.type === 'hold') return 'Hold';
  if (mission.type === 'destroy') return 'Sabotage';
  if (mission.kind === 'sniper') return 'Duel';
  if (mission.kind === 'officer' || mission.kind === 'general') return 'Assassination';
  return 'Hunt';
}

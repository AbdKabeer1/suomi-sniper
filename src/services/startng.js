// Talking to start.ng.
//
// start.ng is the backend: it handles sign-in, the leaderboard and hosting. The
// game never sees a password, an email or the player's real sign-in.
//
// This uses the **connect page** — a hidden iframe at start.ng/connect that we
// postMessage to. It only answers games served from a *.start.ng address, which
// publishing gives us. Outside start.ng it stays silent, so every call here has
// to cope with "no answer" and the game has to remain playable.

const START_NG = 'https://start.ng';
const TIMEOUT_MS = 5000;

let framePromise;

// The connect page only answers games served from *.start.ng. Asking from
// localhost just burns the full timeout five seconds at a time, so skip the
// round trip entirely when we know it cannot succeed. The game stays playable
// as a guest, which is the contract.
function onStartNg() {
  const host = location.hostname;
  return host === 'start.ng' || host.endsWith('.start.ng');
}

function connectFrame() {
  framePromise ??= new Promise((resolve, reject) => {
    const el = document.createElement('iframe');
    el.src = `${START_NG}/connect`;
    el.hidden = true;
    el.onload = () => resolve(el);
    el.onerror = reject;
    document.body.append(el);
  });
  return framePromise;
}

// Sends a message and resolves to start.ng's reply, or null if it didn't answer.
//
// The origin check is the whole security model: without it, any page that could
// get a message in edgewise could impersonate start.ng and hand us a fake
// player.
export async function askStartNg(message, replyType, timeoutMs = TIMEOUT_MS) {
  if (!onStartNg()) return null;

  let el;
  try {
    el = await connectFrame();
  } catch {
    return null;
  }

  return new Promise((resolve) => {
    const requestId = Math.random().toString(36).slice(2);

    const done = (reply) => {
      clearTimeout(timer);
      removeEventListener('message', onMessage);
      resolve(reply);
    };

    const timer = setTimeout(() => done(null), timeoutMs);

    function onMessage(e) {
      if (e.origin !== START_NG || e.source !== el.contentWindow) return;
      if (e.data?.type === replyType && e.data.requestId === requestId) done(e.data);
    }

    addEventListener('message', onMessage);
    el.contentWindow.postMessage({ ...message, requestId }, START_NG);
  });
}

// Who is playing. `player` is whichever of user/guest applies, resolved.
export async function whoami() {
  const reply = await askStartNg({ type: 'startng:whoami' }, 'startng:user');
  if (!reply) return { user: null, guest: null, player: null, offline: true };
  return {
    user: reply.user ?? null,
    guest: reply.guest ?? null,
    player: reply.user ?? reply.guest ?? null,
    offline: false,
  };
}

export function signInUrl() {
  return `${START_NG}/?return_to=${encodeURIComponent(location.origin + location.pathname)}`;
}

export function goToSignIn() {
  location.href = signInUrl();
}

// Save a run. Signed-in players only — guests get { ok: false, error }.
export async function saveScore(stats) {
  const reply = await askStartNg({ type: 'startng:score', stats }, 'startng:scoreSaved');
  if (!reply) return { ok: false, error: 'start.ng did not answer' };
  return reply;
}

// The board is readable by everyone, guests included.
export async function readLeaderboard(limit = 10) {
  const reply = await askStartNg(
    { type: 'startng:leaderboard', limit },
    'startng:leaderboardData'
  );
  if (!reply || !reply.ok) return { ok: false, entries: [] };
  return { ok: true, entries: reply.entries || [] };
}

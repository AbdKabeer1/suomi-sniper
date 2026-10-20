// Sound, synthesised. No audio files — the whole game ships as JS.
//
// The two that matter are the rifle and the wind. The rifle has to sound like
// something that gives away your position, and the wind has to be continuous,
// because a blizzard that goes quiet between gusts stops being a blizzard.

let ctx = null;
let windGain = null;
let windSource = null;
// One white-noise buffer, generated once and shared by every burst. Firing used
// to allocate a fresh 1.5–3 s buffer per layer per shot — a couple of hundred
// thousand floats a round — which shows up as an audio-scheduling skip.
let sharedNoise = null;

function audio() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function noiseBuffer(ac, seconds) {
  const frames = Math.floor(ac.sampleRate * seconds);
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

// 3.5 s is longer than any burst we play; bursts pick a random offset into it,
// so two identical layers never sound like a loop.
const NOISE_LEN = 3.5;
function noise() {
  const ac = audio();
  if (!ac) return null;
  if (!sharedNoise) sharedNoise = noiseBuffer(ac, NOISE_LEN);
  return sharedNoise;
}

function burst({ dur, gain, filterFreq, q = 1, delay = 0, type = 'bandpass' }) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + delay;

  const src = ac.createBufferSource();
  const buf = noise();
  if (!buf) return;
  src.buffer = buf;

  const filter = ac.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = filterFreq;
  filter.Q.value = q;

  const amp = ac.createGain();
  amp.gain.setValueAtTime(gain, t0);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  src.connect(filter).connect(amp).connect(ac.destination);
  src.start(t0, Math.random() * (NOISE_LEN - dur), dur + 0.02);
}

function tone({ freq, dur, type = 'sine', gain = 0.2, sweepTo = null, delay = 0 }) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(amp).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  // A sniper's shot, not a pistol pop. Four things layered:
  //   1. the supersonic crack — a hard, short high pass,
  //   2. the muzzle blast — a low-passed body right at the front,
  //   3. the boom — a deep sweep down, which is what makes the calibre read,
  //   4. the valley echo — the shot rolling back off the treeline, twice.
  // Then the bolt cycle, because on a bolt-action the shot isn't over when the
  // round leaves: the follow-up click is what tells the player it is.
  // `profile` comes from the selected weapon (see data/weapons.js) — the LRS is
  // deeper and louder, the M/28 a hair lighter.
  rifle(profile = {}) {
    const p = {
      crack: 0.5,
      crackFreq: 5200,
      boomFrom: 96,
      boomTo: 38,
      boomDur: 0.5,
      echoGain: 0.18,
      ...profile,
    };

    // 1. Supersonic crack.
    burst({ dur: 0.045, gain: p.crack, filterFreq: p.crackFreq, q: 0.6, type: 'highpass' });
    // 2. Muzzle blast body.
    burst({ dur: 0.14, gain: 0.5, filterFreq: 1100, q: 0.3, type: 'lowpass' });
    // 3. The boom: a fundamental falling into the ground, plus a touch of
    //    upper body so it doesn't turn into pure sub-bass.
    tone({ freq: p.boomFrom, dur: p.boomDur, type: 'sine', gain: 0.42, sweepTo: p.boomTo });
    tone({
      freq: p.boomFrom * 1.5,
      dur: p.boomDur * 0.6,
      type: 'triangle',
      gain: 0.12,
      sweepTo: p.boomTo * 1.5,
    });
    // 4. Echo off the treeline: first a bright roll, then the deep tail.
    burst({ dur: 2.4, gain: p.echoGain, filterFreq: 700, q: 0.35, delay: 0.12 });
    burst({ dur: 3.0, gain: p.echoGain * 0.5, filterFreq: 320, q: 0.4, delay: 0.5 });
    // Bolt cycle. Diagnostically two clicks: unlock, then rechamber.
    burst({ dur: 0.03, gain: 0.14, filterFreq: 2600, q: 2, delay: 0.9 });
    burst({ dur: 0.03, gain: 0.12, filterFreq: 3300, q: 2, delay: 0.98 });
  },

  // Trigger pressed while the bolt is still cycling. A dull mechanical click, so
  // a too-early second shot feels like a rifle rather than a lost input.
  dry() {
    burst({ dur: 0.025, gain: 0.1, filterFreq: 1800, q: 3 });
    tone({ freq: 300, dur: 0.04, type: 'square', gain: 0.03 });
  },

  // The clip going in. Three mechanical beats: the follower pouch pressed down,
  // the stripper clip slapping in, and the bolt sliding back into battery.
  // Spread over ~1.6 s so it reads as work being done during the reload timer,
  // not one click that ends before the timer does.
  reload() {
    burst({ dur: 0.05, gain: 0.14, filterFreq: 900, q: 1.4, delay: 0.0 });
    burst({ dur: 0.04, gain: 0.18, filterFreq: 2100, q: 2.4, delay: 0.55 });
    burst({ dur: 0.06, gain: 0.2, filterFreq: 700, q: 1.2, delay: 1.05 });
    burst({ dur: 0.05, gain: 0.16, filterFreq: 2900, q: 2.2, delay: 1.45 });
    burst({ dur: 0.04, gain: 0.13, filterFreq: 2400, q: 2.6, delay: 1.6 });
  },

  // A short, close enemy rifle. Distance does the mixing: a shot from the far
  // treeline is a flat crack and a long tail, one from thirty metres is a slap.
  enemyRifle(distance = 100) {
    const loud = Math.max(0.22, 1 - distance / 280);
    burst({ dur: 0.05, gain: 0.2 * loud, filterFreq: 3400, q: 0.9 });
    tone({ freq: 170, dur: 0.2, type: 'triangle', gain: 0.11 * loud, sweepTo: 66 });
    burst({ dur: 1.4, gain: 0.06 * loud, filterFreq: 540, q: 0.5, delay: 0.05 });
  },

  // The wet thud of a hit. Deliberately not celebratory.
  hit() {
    burst({ dur: 0.12, gain: 0.3, filterFreq: 500, q: 1.2 });
  },

  // A short, dry click when the aim settles on a man. Feedback, not reward —
  // it tells you the shot is on before you waste it.
  lock() {
    tone({ freq: 900, dur: 0.06, type: 'square', gain: 0.045, sweepTo: 660 });
  },

  // Incoming: the crack of a round passing, then the report from where it came.
  incoming() {
    burst({ dur: 0.03, gain: 0.35, filterFreq: 5200, q: 3 });
    burst({ dur: 0.9, gain: 0.1, filterFreq: 900, q: 0.4, delay: 0.05 });
  },

  hurt() {
    tone({ freq: 130, dur: 0.4, type: 'sawtooth', gain: 0.16, sweepTo: 70 });
  },

  // Bread: a small, warm, ordinary sound. The only kind thing in the game.
  eat() {
    burst({ dur: 0.08, gain: 0.18, filterFreq: 900, q: 1.5 });
    tone({ freq: 420, dur: 0.2, type: 'sine', gain: 0.08, sweepTo: 520, delay: 0.06 });
  },

  // Feet in snow, played while moving between hides.
  step() {
    burst({ dur: 0.09, gain: 0.14, filterFreq: 2400, q: 0.8 });
  },

  // Two thumps, faster as the exposure climbs. Purely a nerve sound.
  heartbeat(intensity) {
    const g = 0.08 + intensity * 0.16;
    tone({ freq: 68, dur: 0.16, type: 'sine', gain: g, sweepTo: 44 });
    tone({ freq: 60, dur: 0.2, type: 'sine', gain: g * 0.7, sweepTo: 40, delay: 0.19 });
  },

  // Counter-battery. The whistle is the warning and it has to arrive before the
  // bang by about a second; the impact is a low, chest-level thump rather than
  // the rifle's crack.
  shellIncoming() {
    tone({ freq: 1500, dur: 1.05, type: 'sine', gain: 0.055, sweepTo: 380 });
    tone({ freq: 2250, dur: 1.0, type: 'sine', gain: 0.02, sweepTo: 560 });
  },

  shellImpact(distance = 30) {
    const loud = Math.max(0.3, 1 - distance / 170);
    tone({ freq: 74, dur: 0.95, type: 'sine', gain: 0.42 * loud, sweepTo: 24 });
    burst({ dur: 0.45, gain: 0.34 * loud, filterFreq: 430, q: 0.5 });
    burst({ dur: 1.9, gain: 0.13 * loud, filterFreq: 220, q: 0.4, delay: 0.07 });
  },

  // The flare that starts the run home: a hard pop and a rising hiss.
  flare() {
    burst({ dur: 0.07, gain: 0.26, filterFreq: 3200, q: 1 });
    tone({ freq: 780, dur: 0.7, type: 'sine', gain: 0.06, sweepTo: 1500 });
    burst({ dur: 1.2, gain: 0.05, filterFreq: 2400, q: 0.8, delay: 0.1 });
  },

  win() {
    tone({ freq: 392, dur: 0.4, type: 'sine', gain: 0.14 });
    tone({ freq: 523, dur: 0.5, type: 'sine', gain: 0.14, delay: 0.22 });
    tone({ freq: 659, dur: 0.9, type: 'sine', gain: 0.12, delay: 0.46 });
  },

  lose() {
    tone({ freq: 220, dur: 1.1, type: 'sine', gain: 0.16, sweepTo: 90 });
    burst({ dur: 1.4, gain: 0.09, filterFreq: 300, q: 0.4, delay: 0.2 });
  },
};

// The wind is a continuous looped noise bed with a filter on it, rather than
// repeated one-shots — it has to be there all the time, at a level that rises
// and falls, or the weather stops feeling like weather.
export function startWind(intensity = 1) {
  const ac = audio();
  if (!ac || windSource) return;

  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, 4);
  src.loop = true;

  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  filter.Q.value = 0.6;

  const gain = ac.createGain();
  gain.gain.value = 0.045 * intensity;

  src.connect(filter).connect(gain).connect(ac.destination);
  src.start();

  windSource = src;
  windGain = gain;

  // Slow, irregular gusts rather than a steady hiss.
  let t = 0;
  setInterval(() => {
    if (!windGain || !ctx) return;
    t += 0.4;
    const gust = 0.6 + Math.sin(t * 0.5) * 0.25 + Math.sin(t * 1.7 + 1.3) * 0.15;
    windGain.gain.setTargetAtTime(0.045 * intensity * gust, ctx.currentTime, 0.6);
  }, 400);
}

export function setWindIntensity(intensity) {
  if (!windGain || !ctx) return;
  windGain.gain.setTargetAtTime(0.045 * intensity, ctx.currentTime, 0.5);
}

export function unlockAudio() {
  audio();
}

/**
 * موتور صوتی سبک بر پایه‌ی WebAudio.
 * هیچ فایل صوتی خارجی لازم نیست؛ همه‌ی افکت‌ها سنتز می‌شوند.
 */

let ctx = null;
let master = null;
let muted = false;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.28;
  master.connect(ctx.destination);
  return ctx;
}

export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume();
}

export function setMuted(value) {
  muted = value;
  if (master) master.gain.value = muted ? 0 : 0.28;
}

export function isMuted() {
  return muted;
}

function tone({ freq = 440, type = 'sine', dur = 0.15, gain = 0.5, slideTo = null, delay = 0 }) {
  const c = ensure();
  if (!c || muted) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise({ dur = 0.3, gain = 0.5, filter = 900, delay = 0, sweep = true }) {
  const c = ensure();
  if (!c || muted) return;
  const t0 = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'lowpass';
  bp.frequency.setValueAtTime(filter, t0);
  if (sweep) bp.frequency.exponentialRampToValueAtTime(Math.max(80, filter * 0.15), t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp).connect(g).connect(master);
  src.start(t0);
}

export const sfx = {
  plant: () => {
    tone({ freq: 180, type: 'triangle', dur: 0.12, gain: 0.35, slideTo: 300 });
    noise({ dur: 0.14, gain: 0.18, filter: 1400 });
  },
  shoot: () => tone({ freq: 620, type: 'square', dur: 0.07, gain: 0.12, slideTo: 380 }),
  freezeShoot: () => tone({ freq: 880, type: 'triangle', dur: 0.1, gain: 0.14, slideTo: 520 }),
  hit: () => noise({ dur: 0.08, gain: 0.16, filter: 2600 }),
  sun: () => {
    tone({ freq: 660, type: 'sine', dur: 0.1, gain: 0.3 });
    tone({ freq: 990, type: 'sine', dur: 0.16, gain: 0.24, delay: 0.07 });
  },
  explode: () => {
    noise({ dur: 0.6, gain: 0.7, filter: 1100 });
    tone({ freq: 120, type: 'sawtooth', dur: 0.4, gain: 0.35, slideTo: 40 });
  },
  chomp: () => {
    tone({ freq: 150, type: 'sawtooth', dur: 0.14, gain: 0.3, slideTo: 70 });
    noise({ dur: 0.18, gain: 0.25, filter: 700 });
  },
  zombieDie: () => {
    tone({ freq: 210, type: 'sawtooth', dur: 0.35, gain: 0.2, slideTo: 60 });
    noise({ dur: 0.3, gain: 0.14, filter: 500 });
  },
  groan: () => {
    tone({ freq: 95, type: 'sawtooth', dur: 0.7, gain: 0.16, slideTo: 62 });
  },
  mower: () => {
    noise({ dur: 1.2, gain: 0.35, filter: 1800, sweep: false });
    tone({ freq: 90, type: 'square', dur: 1.0, gain: 0.14 });
  },
  wave: () => {
    tone({ freq: 300, type: 'sawtooth', dur: 0.5, gain: 0.25, slideTo: 150 });
    tone({ freq: 200, type: 'sawtooth', dur: 0.7, gain: 0.2, slideTo: 100, delay: 0.25 });
  },
  error: () => tone({ freq: 160, type: 'square', dur: 0.12, gain: 0.18, slideTo: 110 }),
  win: () => {
    [523, 659, 784, 1047].forEach((f, i) =>
      tone({ freq: f, type: 'triangle', dur: 0.35, gain: 0.3, delay: i * 0.13 })
    );
  },
  lose: () => {
    [392, 330, 262, 196].forEach((f, i) =>
      tone({ freq: f, type: 'sawtooth', dur: 0.5, gain: 0.26, delay: i * 0.2 })
    );
  },
};

// صداهای بازی با Web Audio API ساخته می‌شوند (بدون فایل صوتی)

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.sfxOn = true;
    this.musicOn = true;
    this.musicTimer = null;
    this.step = 0;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxOn ? 0.55 : 0;
    this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicOn ? 0.13 : 0;
    this.musicGain.connect(this.master);
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setSfx(on) {
    this.sfxOn = on;
    if (this.sfxGain) this.sfxGain.gain.value = on ? 0.55 : 0;
  }

  setMusic(on) {
    this.musicOn = on;
    if (this.musicGain) this.musicGain.gain.value = on ? 0.13 : 0;
  }

  tone({ freq = 440, to = null, dur = 0.16, type = 'sine', vol = 0.5, delay = 0, attack = 0.005 }) {
    if (!this.ctx || !this.sfxOn) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise({ dur = 0.25, vol = 0.4, delay = 0, filter = 900, type = 'lowpass', sweep = null }) {
    if (!this.ctx || !this.sfxOn) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const bq = this.ctx.createBiquadFilter();
    bq.type = type;
    bq.frequency.setValueAtTime(filter, t0);
    if (sweep) bq.frequency.exponentialRampToValueAtTime(sweep, t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bq).connect(g).connect(this.sfxGain);
    src.start(t0);
  }

  /* ------------------------ افکت‌ها ------------------------ */
  plant() {
    this.noise({ dur: 0.18, vol: 0.35, filter: 1400, sweep: 400 });
    this.tone({ freq: 220, to: 340, dur: 0.12, type: 'triangle', vol: 0.25 });
  }
  sun() {
    this.tone({ freq: 880, to: 1320, dur: 0.14, type: 'sine', vol: 0.3 });
    this.tone({ freq: 1320, to: 1760, dur: 0.12, type: 'sine', vol: 0.2, delay: 0.07 });
  }
  shoot() {
    this.tone({ freq: 640, to: 300, dur: 0.09, type: 'square', vol: 0.12 });
  }
  hit() {
    this.noise({ dur: 0.08, vol: 0.2, filter: 2400, sweep: 800 });
  }
  freeze() {
    this.tone({ freq: 1400, to: 700, dur: 0.18, type: 'sine', vol: 0.15 });
  }
  chomp() {
    this.noise({ dur: 0.14, vol: 0.32, filter: 700, sweep: 220 });
    this.tone({ freq: 140, to: 70, dur: 0.16, type: 'sawtooth', vol: 0.2 });
  }
  gulp() {
    this.tone({ freq: 300, to: 90, dur: 0.3, type: 'sine', vol: 0.3 });
  }
  boom() {
    this.noise({ dur: 0.7, vol: 0.7, filter: 1600, sweep: 90 });
    this.tone({ freq: 120, to: 35, dur: 0.6, type: 'sawtooth', vol: 0.4 });
  }
  burn() {
    this.noise({ dur: 0.9, vol: 0.5, filter: 2600, sweep: 500, type: 'bandpass' });
  }
  groan() {
    const f = 90 + Math.random() * 40;
    this.tone({ freq: f, to: f * 0.7, dur: 0.5, type: 'sawtooth', vol: 0.12 });
    this.noise({ dur: 0.45, vol: 0.1, filter: 500 });
  }
  mower() {
    this.tone({ freq: 90, to: 160, dur: 0.9, type: 'square', vol: 0.18 });
    this.noise({ dur: 0.9, vol: 0.3, filter: 700 });
  }
  wave() {
    this.tone({ freq: 180, to: 90, dur: 0.9, type: 'sawtooth', vol: 0.3 });
    this.tone({ freq: 240, to: 120, dur: 0.9, type: 'sawtooth', vol: 0.2, delay: 0.1 });
  }
  win() {
    [523, 659, 784, 1047].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.3, type: 'triangle', vol: 0.4, delay: i * 0.13 })
    );
  }
  lose() {
    [392, 349, 311, 233].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.45, type: 'sawtooth', vol: 0.3, delay: i * 0.2 })
    );
  }
  click() {
    this.tone({ freq: 520, to: 700, dur: 0.06, type: 'square', vol: 0.15 });
  }
  error() {
    this.tone({ freq: 160, to: 110, dur: 0.14, type: 'square', vol: 0.18 });
  }

  /* ------------------------ موسیقی ------------------------ */
  startMusic(theme = 'day') {
    this.init();
    this.stopMusic();
    if (!this.ctx) return;
    const scale = theme === 'night' ? [196, 233, 262, 294, 349, 392] : [262, 294, 330, 392, 440, 523];
    const bass = theme === 'night' ? [98, 87, 110, 82] : [131, 110, 147, 98];
    this.step = 0;
    const beat = () => {
      if (!this.ctx || !this.musicOn) return;
      const t0 = this.ctx.currentTime;
      const s = this.step;
      // خط باس
      if (s % 4 === 0) {
        this.mTone(bass[(s / 4) % bass.length], 0.55, 'triangle', 0.5, t0);
      }
      // ملودی
      if (s % 2 === 0) {
        const n = scale[(Math.floor(s / 2) * 3 + (s % 6)) % scale.length];
        this.mTone(n * 2, 0.22, 'square', 0.12, t0);
      }
      if (s % 8 === 6) this.mTone(scale[3] * 2, 0.3, 'sine', 0.14, t0);
      this.step = (s + 1) % 32;
    };
    beat();
    this.musicTimer = setInterval(beat, 260);
  }

  mTone(freq, dur, type, vol, t0) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.musicGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }
}

export const sfx = new AudioEngine();

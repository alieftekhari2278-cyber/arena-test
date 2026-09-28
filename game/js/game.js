/**
 * حلقه‌ی اصلی بازی «گیاهان در برابر زامبی‌ها».
 * رندر روی Canvas، رابط کاربری با DOM.
 */

import { GRID, CANVAS, SUN, PLANTS, PLANT_ORDER, ZOMBIES, LEVELS, ENDLESS, cellCenter, laneY } from './config.js';
import { Plant, Zombie, Bullet, SunToken, Particle, Mower } from './entities.js';
import { drawPlant, drawPlantIcon, drawZombie, drawSun, drawPea, drawMower, roundRect } from './sprites.js';
import { sfx, setMuted, isMuted, unlockAudio } from './audio.js';

const STORAGE_KEY = 'pvz-fa-progress-v1';

/* ------------------------------ ابزارها ------------------------------ */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const faDigits = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { unlocked: 1, best: 0 };
    const p = JSON.parse(raw);
    return { unlocked: clamp(p.unlocked || 1, 1, LEVELS.length), best: p.best || 0 };
  } catch {
    return { unlocked: 1, best: 0 };
  }
}
function saveProgress(p) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* ذخیره‌سازی در دسترس نیست */
  }
}

/* ------------------------------ پس‌زمینه ------------------------------ */

function buildBackground() {
  const c = document.createElement('canvas');
  c.width = CANVAS.width;
  c.height = CANVAS.height;
  const g = c.getContext('2d');

  // آسمان/زمینه‌ی بیرون چمن
  const sky = g.createLinearGradient(0, 0, 0, CANVAS.height);
  sky.addColorStop(0, '#3c6b2c');
  sky.addColorStop(1, '#2c5220');
  g.fillStyle = sky;
  g.fillRect(0, 0, CANVAS.width, CANVAS.height);

  // خانه‌ی سمت چپ
  const houseW = GRID.offsetX;
  const hg = g.createLinearGradient(0, 0, houseW, 0);
  hg.addColorStop(0, '#6d5136');
  hg.addColorStop(1, '#8d6b47');
  g.fillStyle = hg;
  g.fillRect(0, 0, houseW, CANVAS.height);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  for (let i = 0; i < 14; i++) g.fillRect(0, i * 40 + 6, houseW, 3);
  g.fillStyle = 'rgba(255,255,255,0.10)';
  g.fillRect(houseW - 8, 0, 8, CANVAS.height);

  // چمن شطرنجی
  for (let r = 0; r < GRID.rows; r++) {
    for (let col = 0; col < GRID.cols; col++) {
      const x = GRID.offsetX + col * GRID.cellW;
      const y = GRID.offsetY + r * GRID.cellH;
      const light = (r + col) % 2 === 0;
      g.fillStyle = light ? '#6fbf4a' : '#5aa93a';
      g.fillRect(x, y, GRID.cellW, GRID.cellH);
      // بافت تیغه‌های چمن
      g.strokeStyle = light ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.045)';
      g.lineWidth = 1;
      for (let i = 0; i < 9; i++) {
        const gx = x + rand(2, GRID.cellW - 2);
        const gy = y + rand(2, GRID.cellH - 2);
        g.beginPath();
        g.moveTo(gx, gy);
        g.lineTo(gx + rand(-2, 2), gy - rand(3, 7));
        g.stroke();
      }
    }
  }

  // لبه‌های چمن
  g.strokeStyle = 'rgba(20,50,15,0.35)';
  g.lineWidth = 2;
  g.strokeRect(GRID.offsetX, GRID.offsetY, GRID.cols * GRID.cellW, GRID.rows * GRID.cellH);

  // مسیر خاکی سمت راست (محل ورود زامبی‌ها)
  const rx = GRID.offsetX + GRID.cols * GRID.cellW;
  const dg = g.createLinearGradient(rx, 0, CANVAS.width, 0);
  dg.addColorStop(0, '#6d5a3c');
  dg.addColorStop(1, '#4d3f29');
  g.fillStyle = dg;
  g.fillRect(rx, 0, CANVAS.width - rx, CANVAS.height);
  g.fillStyle = 'rgba(0,0,0,0.16)';
  for (let i = 0; i < 26; i++) {
    g.beginPath();
    g.ellipse(rand(rx + 4, CANVAS.width - 4), rand(4, CANVAS.height - 4), rand(2, 7), rand(1.5, 4), rand(0, 3), 0, Math.PI * 2);
    g.fill();
  }

  // سایه‌ی نرم داخلی برای عمق
  const vig = g.createRadialGradient(CANVAS.width / 2, CANVAS.height / 2, CANVAS.height * 0.35, CANVAS.width / 2, CANVAS.height / 2, CANVAS.height);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.30)');
  g.fillStyle = vig;
  g.fillRect(0, 0, CANVAS.width, CANVAS.height);

  return c;
}

/* --------------------------------------------------------------------- */

export class Game {
  constructor(root) {
    this.root = root;
    this.canvas = root.querySelector('#lawn');
    this.ctx = this.canvas.getContext('2d');
    this.bg = buildBackground();
    this.progress = loadProgress();

    this.state = 'menu'; // menu | intro | playing | paused | won | lost
    this.time = 0;
    this.lastFrame = 0;
    this.shake = 0;
    this.hugeWaveFlash = 0;
    this.selected = null;
    this.shovelActive = false;
    this.particles = [];
    this.pendingShots = [];
    this.pointer = { x: -999, y: -999, inside: false };

    this.el = {
      sunCount: root.querySelector('#sun-count'),
      seedBar: root.querySelector('#seed-bar'),
      shovel: root.querySelector('#shovel-btn'),
      pause: root.querySelector('#pause-btn'),
      mute: root.querySelector('#mute-btn'),
      menuBtn: root.querySelector('#menu-btn'),
      waveFill: root.querySelector('#wave-fill'),
      waveLabel: root.querySelector('#wave-label'),
      levelName: root.querySelector('#level-name'),
      overlay: root.querySelector('#overlay'),
      toast: root.querySelector('#toast'),
      hud: root.querySelector('#hud'),
    };

    this.setupCanvas();
    this.bindEvents();
    this.showMenu();
    requestAnimationFrame((t) => this.loop(t));
  }

  /* ----------------------------- راه‌اندازی ---------------------------- */

  setupCanvas() {
    const resize = () => {
      const dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);
      this.canvas.width = CANVAS.width * dpr;
      this.canvas.height = CANVAS.height * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ctx.imageSmoothingEnabled = true;
    };
    resize();
    window.addEventListener('resize', resize);
  }

  bindEvents() {
    const toCanvas = (e) => {
      const r = this.canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / r.width) * CANVAS.width,
        y: ((e.clientY - r.top) / r.height) * CANVAS.height,
      };
    };

    this.canvas.addEventListener('pointermove', (e) => {
      const p = toCanvas(e);
      this.pointer.x = p.x;
      this.pointer.y = p.y;
      this.pointer.inside = true;
    });
    this.canvas.addEventListener('pointerleave', () => {
      this.pointer.inside = false;
    });
    this.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      unlockAudio();
      const p = toCanvas(e);
      this.pointer.x = p.x;
      this.pointer.y = p.y;
      this.pointer.inside = true;
      this.handleClick(p.x, p.y);
    });
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.clearSelection();
    });

    this.el.shovel.addEventListener('click', () => {
      unlockAudio();
      this.toggleShovel();
    });
    this.el.pause.addEventListener('click', () => this.togglePause());
    this.el.menuBtn.addEventListener('click', () => this.confirmQuit());
    this.el.mute.addEventListener('click', () => {
      unlockAudio();
      setMuted(!isMuted());
      this.el.mute.textContent = isMuted() ? '🔇' : '🔊';
      this.el.mute.setAttribute('aria-label', isMuted() ? 'روشن کردن صدا' : 'خاموش کردن صدا');
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.state === 'playing' || this.state === 'paused') this.togglePause();
        else this.clearSelection();
        return;
      }
      if (this.state !== 'playing') return;
      if (e.key >= '1' && e.key <= '9') {
        const idx = Number(e.key) - 1;
        if (this.level.plants[idx]) this.selectSeed(this.level.plants[idx]);
      }
      if (e.key === 's' || e.key === 'S' || e.key === 'ش') this.toggleShovel();
    });
  }

  /* ------------------------------- منوها ------------------------------ */

  showOverlay(html, className = '') {
    this.el.overlay.className = `overlay ${className}`;
    this.el.overlay.innerHTML = html;
    this.el.overlay.hidden = false;
  }

  hideOverlay() {
    this.el.overlay.hidden = true;
    this.el.overlay.innerHTML = '';
  }

  showMenu() {
    this.state = 'menu';
    this.finished = true;
    this.el.hud.classList.add('is-hidden');
    this.el.seedBar.innerHTML = '';
    this.seedEls = {};
    this.canvas.classList.remove('planting', 'digging');
    this.selected = null;
    this.shovelActive = false;
    this.particles = [];
    this.progress = loadProgress();
    const cards = LEVELS.map((lv) => {
      const locked = lv.id > this.progress.unlocked;
      return `
        <button class="level-card${locked ? ' locked' : ''}" data-level="${lv.id}" ${locked ? 'disabled' : ''}>
          <span class="level-num">${faDigits(lv.id)}</span>
          <span class="level-info">
            <strong>${lv.name}</strong>
            <small>${locked ? 'برای باز شدن، مرحله‌ی قبل را تمام کن' : lv.subtitle}</small>
          </span>
          <span class="level-mark">${locked ? '🔒' : '▶'}</span>
        </button>`;
    }).join('');

    const endlessLocked = this.progress.unlocked < 3;
    this.showOverlay(
      `<div class="panel menu-panel">
        <h1 class="title">گیاهان <span>در برابر</span> زامبی‌ها</h1>
        <p class="subtitle">حیاطت را با گیاه‌ها از حمله‌ی زامبی‌ها نجات بده</p>
        <div class="level-list">${cards}</div>
        <button class="level-card endless${endlessLocked ? ' locked' : ''}" data-level="endless" ${endlessLocked ? 'disabled' : ''}>
          <span class="level-num">∞</span>
          <span class="level-info">
            <strong>${ENDLESS.name}</strong>
            <small>${endlessLocked ? 'با تمام کردن مرحله‌ی ۲ باز می‌شود' : `${ENDLESS.subtitle} — رکورد: موج ${faDigits(this.progress.best)}`}</small>
          </span>
          <span class="level-mark">${endlessLocked ? '🔒' : '▶'}</span>
        </button>
        <details class="howto">
          <summary>راهنمای بازی</summary>
          <ul>
            <li>روی کارت بذر کلیک کن (یا کلید ۱ تا ۹) و بعد روی خانه‌ی چمن کلیک کن تا گیاه کاشته شود.</li>
            <li>خورشیدها را با کلیک جمع کن؛ بدون خورشید نمی‌توانی گیاه بخری.</li>
            <li>با بیل (کلید S) گیاه اشتباه را بردار. کلیک راست انتخاب را لغو می‌کند.</li>
            <li>هر لاین یک ماشین چمن‌زنی دارد؛ فقط یک‌بار نجاتت می‌دهد.</li>
            <li>کلید Esc برای توقف بازی.</li>
          </ul>
        </details>
      </div>`,
      'menu'
    );

    this.el.overlay.querySelectorAll('[data-level]').forEach((btn) => {
      btn.addEventListener('click', () => {
        unlockAudio();
        const id = btn.dataset.level;
        this.startLevel(id === 'endless' ? ENDLESS : LEVELS.find((l) => String(l.id) === id));
      });
    });
  }

  confirmQuit() {
    if (this.state === 'playing') this.state = 'paused';
    this.showOverlay(
      `<div class="panel small">
        <h2>بازگشت به منو؟</h2>
        <p>پیشرفت این مرحله از بین می‌رود.</p>
        <div class="row">
          <button class="btn ghost" data-act="cancel">ادامه‌ی بازی</button>
          <button class="btn danger" data-act="quit">بله، برگرد</button>
        </div>
      </div>`,
      'dim'
    );
    this.el.overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => {
      this.hideOverlay();
      this.state = 'playing';
    });
    this.el.overlay.querySelector('[data-act="quit"]').addEventListener('click', () => this.showMenu());
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.el.pause.textContent = '▶';
      this.showOverlay(
        `<div class="panel small">
          <h2>بازی متوقف شد</h2>
          <p>موج ${faDigits(this.wave)} از ${this.level.endless ? '∞' : faDigits(this.level.waves)}</p>
          <div class="row">
            <button class="btn" data-act="resume">ادامه</button>
            <button class="btn ghost" data-act="menu">منوی اصلی</button>
          </div>
        </div>`,
        'dim'
      );
      this.el.overlay.querySelector('[data-act="resume"]').addEventListener('click', () => this.togglePause());
      this.el.overlay.querySelector('[data-act="menu"]').addEventListener('click', () => this.showMenu());
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.el.pause.textContent = '⏸';
      this.hideOverlay();
    }
  }

  /* ------------------------------ شروع مرحله --------------------------- */

  startLevel(level) {
    this.level = level;
    this.sun = SUN.startingAmount;
    this.plants = [];
    this.zombies = [];
    this.bullets = [];
    this.suns = [];
    this.particles = [];
    this.mowers = Array.from({ length: GRID.rows }, (_, r) => new Mower(r, GRID.offsetX - 28));
    this.grid = Array.from({ length: GRID.rows }, () => new Array(GRID.cols).fill(null));
    this.cooldowns = Object.fromEntries(level.plants.map((p) => [p, 0]));
    this.selected = null;
    this.shovelActive = false;
    this.wave = 0;
    this.waveTimer = this.level.firstWaveDelay ?? 24;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.pendingShots = [];
    this.skyTimer = rand(4, 7);
    this.kills = 0;
    this.shake = 0;
    this.hugeWaveFlash = 0;
    this.finished = false;

    this.buildSeedBar();
    this.el.levelName.textContent = level.endless ? level.name : `مرحله ${faDigits(level.id)} — ${level.name}`;
    this.el.hud.classList.remove('is-hidden');
    this.el.pause.textContent = '⏸';
    this.updateSunDisplay();
    this.updateWaveBar();

    // نمایش پیام شروع
    this.state = 'intro';
    this.introTimer = 2.6;
    this.hideOverlay();
    this.toast('زامبی‌ها دارند می‌آیند!', 2.2, 'warn');
    sfx.groan();
  }

  buildSeedBar() {
    this.el.seedBar.innerHTML = '';
    this.seedEls = {};
    this.level.plants.forEach((type, i) => {
      const cfg = PLANTS[type];
      const btn = document.createElement('button');
      btn.className = 'seed';
      btn.type = 'button';
      btn.dataset.type = type;
      btn.title = `${cfg.name} — ${cfg.desc}`;
      btn.setAttribute('aria-label', `${cfg.name}، قیمت ${cfg.cost} خورشید`);
      btn.innerHTML = `
        <canvas class="seed-art" width="56" height="56"></canvas>
        <span class="seed-name">${cfg.name}</span>
        <span class="seed-cost">${faDigits(cfg.cost)}</span>
        <span class="seed-key">${faDigits(i + 1)}</span>
        <span class="seed-cd"></span>`;
      const ic = btn.querySelector('canvas').getContext('2d');
      drawPlantIcon(ic, type, 56);
      btn.addEventListener('click', () => {
        unlockAudio();
        this.selectSeed(type);
      });
      this.el.seedBar.appendChild(btn);
      this.seedEls[type] = btn;
    });
  }

  /* ------------------------------ تعامل ------------------------------- */

  selectSeed(type) {
    if (this.state !== 'playing' && this.state !== 'intro') return;
    if (this.selected === type) return this.clearSelection();
    if (this.cooldowns[type] > 0) {
      sfx.error();
      this.toast('این گیاه هنوز آماده نیست', 1.1);
      return;
    }
    if (this.sun < PLANTS[type].cost) {
      sfx.error();
      this.toast('خورشید کافی نداری', 1.1);
      return;
    }
    this.selected = type;
    this.shovelActive = false;
    this.refreshSeedStates();
  }

  clearSelection() {
    this.selected = null;
    this.shovelActive = false;
    this.refreshSeedStates();
  }

  toggleShovel() {
    if (this.state !== 'playing') return;
    this.shovelActive = !this.shovelActive;
    this.selected = null;
    this.refreshSeedStates();
  }

  refreshSeedStates() {
    if (!this.seedEls) return;
    for (const [type, el] of Object.entries(this.seedEls)) {
      const cfg = PLANTS[type];
      el.classList.toggle('selected', this.selected === type);
      el.classList.toggle('disabled', this.cooldowns[type] > 0 || this.sun < cfg.cost);
    }
    this.el.shovel.classList.toggle('selected', this.shovelActive);
    this.canvas.classList.toggle('planting', !!this.selected);
    this.canvas.classList.toggle('digging', this.shovelActive);
  }

  cellAt(x, y) {
    const col = Math.floor((x - GRID.offsetX) / GRID.cellW);
    const row = Math.floor((y - GRID.offsetY) / GRID.cellH);
    if (col < 0 || col >= GRID.cols || row < 0 || row >= GRID.rows) return null;
    return { col, row };
  }

  handleClick(x, y) {
    if (this.state === 'intro') this.state = 'playing';
    if (this.state !== 'playing') return;

    const cell = this.cellAt(x, y);
    const existing = cell ? this.grid[cell.row][cell.col] : null;

    // ۱) بیل بر جمع‌آوری خورشید اولویت دارد (وگرنه خورشیدِ روی گیاه مانع می‌شود)
    if (this.shovelActive) {
      if (!cell) return;
      if (existing) {
        existing.dead = true;
        this.grid[cell.row][cell.col] = null;
        this.spawnPoof(existing.x, existing.y, '#9bd06a');
        sfx.plant();
      }
      this.shovelActive = false;
      this.refreshSeedStates();
      return;
    }

    // ۲) جمع‌کردن خورشید
    for (const s of this.suns) {
      if (s.collecting || s.dead) continue;
      if (Math.hypot(s.x - x, s.y - y) < 30) {
        this.collectSun(s);
        return;
      }
    }

    // ۳) کاشت
    if (!cell) return;
    if (!this.selected) return;
    const cfg = PLANTS[this.selected];
    if (existing) {
      sfx.error();
      this.toast('این خانه پر است', 1);
      return;
    }
    if (this.sun < cfg.cost) {
      sfx.error();
      return;
    }
    const plant = new Plant(this.selected, cell.col, cell.row);
    this.plants.push(plant);
    this.grid[cell.row][cell.col] = plant;
    this.sun -= cfg.cost;
    this.cooldowns[this.selected] = cfg.cooldown;
    this.selected = null;
    this.updateSunDisplay();
    this.refreshSeedStates();
    sfx.plant();
    this.spawnPoof(plant.x, plant.y + 18, '#8fd05f');
  }

  collectSun(s) {
    s.collecting = true;
    this.sun += s.value;
    this.updateSunDisplay();
    this.refreshSeedStates();
    sfx.sun();
  }

  updateSunDisplay() {
    this.el.sunCount.textContent = faDigits(this.sun);
  }

  toast(text, duration = 1.6, kind = '') {
    this.el.toast.textContent = text;
    this.el.toast.className = `toast show ${kind}`;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.el.toast.className = 'toast';
    }, duration * 1000);
  }

  /* ------------------------------ موج‌ها ------------------------------ */

  isHugeWave(waveNumber) {
    if (this.level.endless) return waveNumber % 5 === 0;
    return waveNumber === this.level.waves || waveNumber === Math.ceil(this.level.waves / 2);
  }

  buildWave(waveNumber) {
    const lv = this.level;
    const huge = this.isHugeWave(waveNumber);
    let budget = (lv.budgetBase + (waveNumber - 1) * lv.budgetGrowth) * (huge ? 2.0 : 1);
    if (lv.endless) budget *= 1 + waveNumber * 0.04;

    // زامبی‌های سنگین فقط در نیمه‌ی دوم مرحله ظاهر می‌شوند
    const total = lv.endless ? 14 : lv.waves;
    const p = waveNumber / total;
    const maxThreat = p < 0.45 ? 2 : p < 0.62 ? 5 : p < 0.85 ? 10 : 99;
    const unlockedPool = lv.pool.filter((id) => ZOMBIES[id].threat <= maxThreat);
    const pool = unlockedPool.length ? unlockedPool : ['basic'];

    const list = [];
    let guard = 0;
    while (budget > 0 && guard++ < 120) {
      const id = pick(pool);
      const cost = ZOMBIES[id].threat;
      if (cost > budget && list.length > 0) break;
      list.push(id);
      budget -= cost;
    }
    if (huge) list.push('flag');

    // پخش متعادل روی لاین‌ها: هر بار همه‌ی لاین‌ها را قاطی می‌کنیم و به ترتیب
    // استفاده می‌کنیم تا چند زامبی پشت‌سرهم در یک لاین جمع نشوند.
    const rows = [];
    while (rows.length < list.length) {
      const shuffled = [...Array(GRID.rows).keys()].sort(() => Math.random() - 0.5);
      rows.push(...shuffled);
    }
    return list.map((id, i) => ({ id, row: rows[i], delay: rand(0, huge ? 7 : 10) }));
  }

  startWave() {
    this.wave += 1;
    const huge = this.isHugeWave(this.wave);
    this.spawnQueue = this.buildWave(this.wave).sort((a, b) => a.delay - b.delay);
    this.spawnTimer = 0;
    this.waveTimer = this.level.waveGap;
    if (huge) {
      this.hugeWaveFlash = 2.4;
      this.toast('موج بزرگ زامبی‌ها!', 2.2, 'danger');
      sfx.wave();
      this.shake = Math.max(this.shake, 8);
    } else {
      sfx.groan();
    }
    if (this.level.endless && this.wave > this.progress.best) {
      this.progress.best = this.wave;
      saveProgress(this.progress);
    }
    this.updateWaveBar();
  }

  updateWaveBar() {
    const total = this.level.endless ? Math.max(10, this.wave + 3) : this.level.waves;
    const pct = clamp((this.wave / total) * 100, 0, 100);
    this.el.waveFill.style.width = `${pct}%`;
    this.el.waveLabel.textContent = this.level.endless
      ? `موج ${faDigits(this.wave)}`
      : `موج ${faDigits(this.wave)} از ${faDigits(this.level.waves)}`;
  }

  /* ------------------------------ ذرات ------------------------------- */

  spawnPoof(x, y, color) {
    for (let i = 0; i < 10; i++) {
      this.particles.push(
        new Particle({
          x,
          y,
          vx: rand(-60, 60),
          vy: rand(-120, -30),
          life: rand(0.35, 0.7),
          maxLife: 0.7,
          size: rand(2, 5),
          color,
        })
      );
    }
  }

  spawnSplat(x, y, color = '#8ddc4f') {
    for (let i = 0; i < 6; i++) {
      this.particles.push(
        new Particle({
          x,
          y,
          vx: rand(-90, 20),
          vy: rand(-90, 10),
          life: rand(0.2, 0.4),
          maxLife: 0.4,
          size: rand(1.5, 3.5),
          color,
        })
      );
    }
  }

  spawnExplosion(x, y, big = true) {
    const n = big ? 34 : 18;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(60, big ? 320 : 180);
      this.particles.push(
        new Particle({
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 60,
          life: rand(0.35, 0.9),
          maxLife: 0.9,
          size: rand(3, big ? 10 : 6),
          color: pick(['#ffd14a', '#ff8c2b', '#ff4d21', '#ffe9a8']),
          gravity: 180,
        })
      );
    }
    this.particles.push(
      new Particle({ x, y, vx: 0, vy: 0, life: 0.34, maxLife: 0.34, size: big ? 92 : 52, color: '#fff2c0', shape: 'flash', gravity: 0 })
    );
  }

  spawnGibs(x, y) {
    for (let i = 0; i < 8; i++) {
      this.particles.push(
        new Particle({
          x: x + rand(-8, 8),
          y: y + rand(-30, 0),
          vx: rand(-110, 40),
          vy: rand(-220, -60),
          life: rand(0.5, 0.9),
          maxLife: 0.9,
          size: rand(3, 7),
          color: pick(['#6b9a58', '#9ec98a', '#47703a', '#59607a']),
          shape: 'rect',
          rot: rand(0, 6),
          vr: rand(-8, 8),
        })
      );
    }
  }

  /* ----------------------------- به‌روزرسانی --------------------------- */

  update(dt) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 22);
    this.hugeWaveFlash = Math.max(0, this.hugeWaveFlash - dt);

    if (this.state === 'intro') {
      this.introTimer -= dt;
      if (this.introTimer <= 0) this.state = 'playing';
      this.updateParticles(dt);
      return;
    }
    if (this.state !== 'playing') return;

    // خنک‌سازی کارت‌ها
    let needsRefresh = false;
    for (const type of Object.keys(this.cooldowns)) {
      if (this.cooldowns[type] > 0) {
        this.cooldowns[type] = Math.max(0, this.cooldowns[type] - dt);
        const cfg = PLANTS[type];
        const el = this.seedEls[type];
        if (el) el.querySelector('.seed-cd').style.height = `${(this.cooldowns[type] / cfg.cooldown) * 100}%`;
        if (this.cooldowns[type] === 0) needsRefresh = true;
      }
    }
    if (needsRefresh) this.refreshSeedStates();

    // خورشید آسمانی
    this.skyTimer -= dt;
    if (this.skyTimer <= 0) {
      this.skyTimer = rand(SUN.skyIntervalMin, SUN.skyIntervalMax);
      const x = rand(GRID.offsetX + 30, GRID.offsetX + GRID.cols * GRID.cellW - 30);
      const targetY = rand(GRID.offsetY + 60, CANVAS.height - 40);
      this.suns.push(new SunToken(x, -20, targetY, SUN.skyValue, true));
    }

    this.updateWaves(dt);
    this.updatePlants(dt);
    this.updatePendingShots(dt);
    this.updateBullets(dt);
    this.updateZombies(dt);
    this.updateSuns(dt);
    this.updateMowers(dt);
    this.updateParticles(dt);
    this.cleanup();
    this.checkEnd();
  }

  updateWaves(dt) {
    // صف تولد زامبی‌ها
    if (this.spawnQueue.length) {
      this.spawnTimer += dt;
      while (this.spawnQueue.length && this.spawnQueue[0].delay <= this.spawnTimer) {
        const item = this.spawnQueue.shift();
        this.zombies.push(new Zombie(item.id, item.row, CANVAS.width + rand(10, 70)));
      }
    }

    const noMoreWaves = !this.level.endless && this.wave >= this.level.waves;
    if (noMoreWaves) return;

    this.waveTimer -= dt;
    // اگر زمین کاملاً پاک شد، کمی زودتر موج بعد را بفرست (اما نه خیلی زود)
    const cleared = this.zombies.length === 0 && this.spawnQueue.length === 0;
    if (this.waveTimer <= 0 || (cleared && this.waveTimer < this.level.waveGap - 16)) {
      this.startWave();
    }
  }

  updatePlants(dt) {
    for (const p of this.plants) {
      if (!p.alive) continue;
      p.age += dt;
      p.flash = Math.max(0, p.flash - dt * 3);
      p.planting = Math.max(0, p.planting - dt * 4);
      p.recoil = Math.max(0, p.recoil - dt * 6);

      switch (p.cfg.kind) {
        case 'producer': {
          p.produceTimer -= dt;
          p.charge = 1 - clamp(p.produceTimer / p.cfg.produceInterval, 0, 1);
          if (p.produceTimer <= 0) {
            p.produceTimer = p.cfg.produceInterval;
            const s = new SunToken(p.x + rand(-8, 8), p.y - 20, p.y + 16, p.cfg.produceValue, false);
            this.suns.push(s);
          }
          break;
        }
        case 'shooter': {
          const hasTarget = this.zombies.some((z) => !z.dead && z.row === p.row && z.x > p.x - 10 && z.x < CANVAS.width + 60);
          if (!hasTarget) break;
          p.fireTimer -= dt;
          if (p.fireTimer <= 0) {
            p.fireTimer = p.cfg.fireRate;
            p.recoil = 1;
            for (let b = 0; b < p.cfg.bullets; b++) {
              this.pendingShots.push({ plant: p, delay: b * 0.14 });
            }
          }
          break;
        }
        case 'mine': {
          if (!p.armed && p.age >= p.armTime) {
            p.armed = true;
            this.spawnPoof(p.x, p.y, '#ffd27a');
          }
          if (p.armed) {
            const victim = this.zombies.find(
              (z) => !z.dead && z.row === p.row && Math.abs(z.x - p.x) < GRID.cellW * 0.6
            );
            if (victim) {
              this.explode(p.x, p.y, p.row, GRID.cellW * 0.75, p.cfg.damage, false);
              p.dead = true;
              this.grid[p.row][p.col] = null;
            }
          }
          break;
        }
        case 'chomper': {
          if (p.chewTimer > 0) {
            p.chewTimer -= dt;
            break;
          }
          const victim = this.zombies.find(
            (z) => !z.dead && z.row === p.row && z.x > p.x && z.x - p.x < GRID.cellW * p.cfg.range
          );
          if (victim) {
            victim.dead = true;
            victim.eaten = true;
            this.kills += 1;
            p.chewTimer = p.cfg.chewTime;
            sfx.chomp();
            this.spawnSplat(victim.x, victim.y - 20, '#6b9a58');
          }
          break;
        }
        case 'bomb': {
          p.fuseTimer -= dt;
          if (p.fuseTimer <= 0) {
            this.explode(p.x, p.y, p.row, GRID.cellW * p.cfg.radius, p.cfg.damage, true);
            p.dead = true;
            this.grid[p.row][p.col] = null;
          }
          break;
        }
        case 'lanebomb': {
          p.fuseTimer -= dt;
          if (p.fuseTimer <= 0) {
            this.burnLane(p.row, p.cfg.damage);
            p.dead = true;
            this.grid[p.row][p.col] = null;
          }
          break;
        }
        default:
          break;
      }
    }
  }

  /** شلیک‌های زمان‌بندی‌شده (مثلاً نخود دوم نخودپران دوقلو) */
  updatePendingShots(dt) {
    if (!this.pendingShots.length) return;
    let fired = false;
    for (const s of this.pendingShots) {
      s.delay -= dt;
      if (s.delay > 0) continue;
      s.done = true;
      fired = true;
      const p = s.plant;
      if (!p.alive) continue;
      this.bullets.push(new Bullet(p.x + 26, p.y - 24, p.row, p.cfg.damage, p.cfg.freeze));
      p.cfg.freeze ? sfx.freezeShoot() : sfx.shoot();
    }
    if (fired) this.pendingShots = this.pendingShots.filter((s) => !s.done);
  }

  explode(x, y, row, radius, damage, big) {
    sfx.explode();
    this.spawnExplosion(x, y - 20, big);
    this.shake = Math.max(this.shake, big ? 12 : 7);
    for (const z of this.zombies) {
      if (z.dead) continue;
      const dx = Math.abs(z.x - x);
      const dy = Math.abs(z.y - y);
      if (dx <= radius && dy <= GRID.cellH * (big ? 1.1 : 0.6)) {
        z.armor = 0;
        z.damage(damage);
        if (z.dead) this.onZombieKilled(z, true);
      }
    }
  }

  burnLane(row, damage) {
    sfx.explode();
    this.shake = Math.max(this.shake, 10);
    for (let i = 0; i < 16; i++) {
      this.spawnExplosion(GRID.offsetX + rand(0, GRID.cols * GRID.cellW), laneY(row) - 10, false);
    }
    for (const z of this.zombies) {
      if (z.dead || z.row !== row) continue;
      z.armor = 0;
      z.damage(damage);
      if (z.dead) this.onZombieKilled(z, true);
    }
  }

  updateBullets(dt) {
    for (const b of this.bullets) {
      if (b.dead) continue;
      b.x += b.vx * dt;
      if (b.x > CANVAS.width + 20) {
        b.dead = true;
        continue;
      }
      for (const z of this.zombies) {
        if (z.dead || z.row !== b.row) continue;
        if (b.x > z.x - 20 && b.x < z.x + 22) {
          z.damage(b.damage);
          if (b.freeze) z.slowTimer = 6;
          b.dead = true;
          sfx.hit();
          this.spawnSplat(b.x + 6, b.y, b.freeze ? '#bdeeff' : '#8ddc4f');
          if (z.dead) this.onZombieKilled(z, false);
          break;
        }
      }
    }
  }

  onZombieKilled(z, violent) {
    this.kills += 1;
    sfx.zombieDie();
    if (violent) this.spawnGibs(z.x, z.y);
    else this.spawnSplat(z.x, z.y - 25, '#6b9a58');
  }

  updateZombies(dt) {
    for (const z of this.zombies) {
      if (z.dead) continue;
      z.flash = Math.max(0, z.flash - dt * 4);
      if (z.slowTimer > 0) z.slowTimer -= dt;

      // هدف خوردن: گیاه در همان لاین جلوی زامبی
      const mouth = z.x - 16;
      let target = null;
      for (const p of this.plants) {
        if (!p.alive || p.row !== z.row) continue;
        if (Math.abs(p.x - mouth) < GRID.cellW * 0.5) {
          if (!target || p.x > target.x) target = p;
        }
      }

      if (target) {
        z.eating = true;
        z.eatTarget = target;
        if (z.cfg.smash) {
          z.smashCooldown -= dt;
          if (z.smashCooldown <= 0) {
            z.smashCooldown = 1.6;
            target.damage(9999);
            this.spawnPoof(target.x, target.y, '#9bd06a');
            this.shake = Math.max(this.shake, 9);
            sfx.chomp();
          }
        } else {
          target.damage(z.cfg.dps * dt);
          if (Math.random() < dt * 3) this.spawnSplat(target.x + 10, target.y - 18, '#7fc65a');
        }
        if (!target.alive) {
          this.grid[target.row][target.col] = null;
          z.eating = false;
        }
      } else {
        z.eating = false;
        z.x -= z.speed * dt;
        z.walkPhase += dt * (z.speed / 8);
      }

      // رسیدن به خانه
      if (z.x < GRID.offsetX - 4) {
        const mower = this.mowers[z.row];
        if (mower && !mower.used && !mower.running) {
          mower.running = true;
          mower.used = true;
          sfx.mower();
        } else if (!mower || mower.used) {
          if (!mower.running) this.lose();
        }
      }
    }
  }

  updateMowers(dt) {
    for (const m of this.mowers) {
      if (!m.running) continue;
      m.x += 420 * dt;
      for (const z of this.zombies) {
        if (z.dead || z.row !== m.row) continue;
        if (Math.abs(z.x - m.x) < 34) {
          z.dead = true;
          this.onZombieKilled(z, true);
        }
      }
      if (m.x > CANVAS.width + 60) m.running = false;
    }
  }

  updateSuns(dt) {
    for (const s of this.suns) {
      if (s.dead) continue;
      if (s.collecting) {
        // پرواز به سمت شمارنده‌ی خورشید بالای صفحه
        s.y -= 520 * dt;
        s.x += (GRID.offsetX + 40 - s.x) * dt * 4;
        s.alpha -= dt * 2.2;
        if (s.alpha <= 0) s.dead = true;
        continue;
      }
      if (s.fromSky) {
        if (s.y < s.targetY) s.y = Math.min(s.targetY, s.y + SUN.fallSpeed * dt);
        else s.life -= dt;
      } else {
        s.vy += 240 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (s.y >= s.targetY) {
          s.y = s.targetY;
          s.vy = 0;
          s.vx *= 0.7;
          s.life -= dt;
        }
      }
      if (s.life < 2) s.alpha = clamp(s.life / 2, 0, 1);
      if (s.life <= 0) s.dead = true;
    }
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      if (p.dead) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.dead = true;
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
  }

  cleanup() {
    if (this.plants.some((p) => p.dead)) this.plants = this.plants.filter((p) => !p.dead);
    if (this.zombies.some((z) => z.dead)) this.zombies = this.zombies.filter((z) => !z.dead);
    if (this.bullets.some((b) => b.dead)) this.bullets = this.bullets.filter((b) => !b.dead);
    if (this.suns.some((s) => s.dead)) this.suns = this.suns.filter((s) => !s.dead);
    if (this.particles.length > 400 || this.particles.some((p) => p.dead))
      this.particles = this.particles.filter((p) => !p.dead);
  }

  checkEnd() {
    if (this.finished || this.level.endless) return;
    if (this.wave >= this.level.waves && this.zombies.length === 0 && this.spawnQueue.length === 0) {
      this.win();
    }
  }

  /* ------------------------------ پایان ------------------------------ */

  win() {
    this.finished = true;
    this.state = 'won';
    sfx.win();
    const next = this.level.id + 1;
    if (typeof this.level.id === 'number' && next > this.progress.unlocked && next <= LEVELS.length) {
      this.progress.unlocked = next;
      saveProgress(this.progress);
    }
    const hasNext = typeof this.level.id === 'number' && next <= LEVELS.length;
    this.showOverlay(
      `<div class="panel result win">
        <div class="result-icon">🌻</div>
        <h2>حیاط نجات پیدا کرد!</h2>
        <p>${this.level.name} با موفقیت تمام شد.</p>
        <div class="stats">
          <div><strong>${faDigits(this.kills)}</strong><span>زامبی نابودشده</span></div>
          <div><strong>${faDigits(this.level.waves)}</strong><span>موج دفع‌شده</span></div>
          <div><strong>${faDigits(this.plants.length)}</strong><span>گیاه زنده</span></div>
        </div>
        <div class="row">
          ${hasNext ? '<button class="btn" data-act="next">مرحله‌ی بعد</button>' : ''}
          <button class="btn ghost" data-act="replay">دوباره</button>
          <button class="btn ghost" data-act="menu">منوی اصلی</button>
        </div>
      </div>`,
      'dim'
    );
    this.wireResultButtons(hasNext ? LEVELS.find((l) => l.id === next) : null);
  }

  lose() {
    if (this.finished) return;
    this.finished = true;
    this.state = 'lost';
    sfx.lose();
    this.shake = 16;
    this.showOverlay(
      `<div class="panel result lose">
        <div class="result-icon">🧟</div>
        <h2>زامبی‌ها مغزت را خوردند!</h2>
        <p>${this.level.endless ? `تا موج ${faDigits(this.wave)} دوام آوردی.` : `در موج ${faDigits(this.wave)} از ${faDigits(this.level.waves)} شکست خوردی.`}</p>
        <div class="stats">
          <div><strong>${faDigits(this.kills)}</strong><span>زامبی نابودشده</span></div>
          <div><strong>${faDigits(this.wave)}</strong><span>موج</span></div>
        </div>
        <div class="row">
          <button class="btn" data-act="replay">تلاش دوباره</button>
          <button class="btn ghost" data-act="menu">منوی اصلی</button>
        </div>
      </div>`,
      'dim'
    );
    this.wireResultButtons(null);
  }

  wireResultButtons(nextLevel) {
    const o = this.el.overlay;
    o.querySelector('[data-act="menu"]').addEventListener('click', () => this.showMenu());
    const replay = o.querySelector('[data-act="replay"]');
    if (replay) replay.addEventListener('click', () => this.startLevel(this.level));
    const next = o.querySelector('[data-act="next"]');
    if (next && nextLevel) next.addEventListener('click', () => this.startLevel(nextLevel));
  }

  /* ------------------------------- رندر ------------------------------- */

  render() {
    const ctx = this.ctx;
    ctx.save();
    if (this.shake > 0.2) {
      ctx.translate(rand(-this.shake, this.shake) * 0.4, rand(-this.shake, this.shake) * 0.4);
    }
    ctx.clearRect(-20, -20, CANVAS.width + 40, CANVAS.height + 40);
    ctx.drawImage(this.bg, 0, 0, CANVAS.width, CANVAS.height);

    if (this.state === 'menu') {
      this.renderMenuBackdrop(ctx);
      ctx.restore();
      return;
    }

    // پیش‌نمایش کاشت
    this.renderPlacementHint(ctx);

    // ماشین‌های چمن‌زنی
    for (const m of this.mowers) if (!m.used || m.running) drawMower(ctx, m, this.time);

    // مرتب‌سازی بر اساس لاین برای عمق درست
    const drawables = [];
    for (const p of this.plants) drawables.push({ y: p.y, kind: 'plant', o: p });
    for (const z of this.zombies) drawables.push({ y: z.y + 1, kind: 'zombie', o: z });
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) {
      if (d.kind === 'plant') drawPlant(ctx, d.o, this.time);
      else drawZombie(ctx, d.o, this.time);
    }

    for (const b of this.bullets) drawPea(ctx, b);
    for (const s of this.suns) drawSun(ctx, s, this.time);
    this.renderParticles(ctx);

    // برچسب موج بزرگ
    if (this.hugeWaveFlash > 0) {
      const a = Math.min(1, this.hugeWaveFlash / 1.2) * (0.5 + 0.5 * Math.sin(this.time * 12));
      ctx.fillStyle = `rgba(190,20,20,${0.16 * a})`;
      ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
    }

    if (this.state === 'intro') this.renderIntro(ctx);
    ctx.restore();
  }

  renderMenuBackdrop(ctx) {
    ctx.fillStyle = 'rgba(8,18,8,0.55)';
    ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
    const demoPlants = ['sunflower', 'peashooter', 'wallnut', 'chomper', 'snowpea'];
    demoPlants.forEach((type, i) => {
      const { x, y } = cellCenter(1 + i, 4);
      drawPlant(ctx, { type, x, y: y - 10, seed: i, hp: 1, maxHp: 1, charge: 0, recoil: 0, chewTimer: 0, armed: true, age: 99, armTime: 1, fuseTimer: 9, planting: 0, flash: 0 }, this.time);
    });
  }

  renderPlacementHint(ctx) {
    if (!this.pointer.inside) return;
    if (!this.selected && !this.shovelActive) return;
    const cell = this.cellAt(this.pointer.x, this.pointer.y);
    if (!cell) return;
    const x = GRID.offsetX + cell.col * GRID.cellW;
    const y = GRID.offsetY + cell.row * GRID.cellH;
    const occupied = !!this.grid[cell.row][cell.col];
    const ok = this.shovelActive ? occupied : !occupied;
    ctx.save();
    ctx.fillStyle = ok ? 'rgba(255,255,255,0.22)' : 'rgba(220,60,40,0.24)';
    ctx.fillRect(x, y, GRID.cellW, GRID.cellH);
    ctx.strokeStyle = ok ? 'rgba(255,255,255,0.7)' : 'rgba(240,90,70,0.85)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([7, 5]);
    ctx.strokeRect(x + 1.5, y + 1.5, GRID.cellW - 3, GRID.cellH - 3);
    ctx.setLineDash([]);
    if (this.selected && ok) {
      ctx.globalAlpha = 0.55;
      const c = cellCenter(cell.col, cell.row);
      drawPlant(
        ctx,
        { type: this.selected, x: c.x, y: c.y, seed: 2, hp: 1, maxHp: 1, charge: 0, recoil: 0, chewTimer: 0, armed: true, age: 99, armTime: 1, fuseTimer: 9, planting: 0, flash: 0 },
        this.time
      );
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  renderParticles(ctx) {
    for (const p of this.particles) {
      if (p.dead) continue;
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = a;
      if (p.shape === 'flash') {
        const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.size);
        g.addColorStop(0, 'rgba(255,255,220,0.95)');
        g.addColorStop(1, 'rgba(255,160,40,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'rect') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        roundRect(ctx, -p.size / 2, -p.size / 2, p.size, p.size * 1.4, 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  renderIntro(ctx) {
    const a = clamp(this.introTimer / 2.6, 0, 1);
    ctx.save();
    ctx.globalAlpha = Math.min(1, a * 1.6);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, CANVAS.height / 2 - 52, CANVAS.width, 104);
    ctx.fillStyle = '#ffe27a';
    ctx.font = 'bold 44px Tahoma, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 12;
    ctx.fillText('زامبی‌ها می‌آیند!', CANVAS.width / 2, CANVAS.height / 2);
    ctx.restore();
  }

  /* ------------------------------ حلقه ------------------------------- */

  loop(ts) {
    const dt = Math.min(0.05, (ts - this.lastFrame) / 1000 || 0);
    this.lastFrame = ts;
    this.update(dt);
    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }
}

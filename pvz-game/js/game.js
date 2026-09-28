// هسته‌ی بازی: حلقه اصلی، منطق موج‌ها، ورودی کاربر و رندر

import { CFG, PLANTS, colCenter, rowCenter, colAt, rowAt, survivalWave } from './config.js';
import { buildBackground, drawPlantArt, drawTombstone } from './art.js';
import { Plant, Zombie, Projectile, SunOrb, Mower, Particle, FloatText, burst } from './entities.js';
import { sfx } from './audio.js';

const ROW_ORDER = (a, b) => a.y - b.y;

export class Game {
  constructor(canvas) {
    this.cv = canvas;
    // رندر با توجه به چگالی پیکسل نمایشگر تا تصویر روی صفحه‌های رتینا تیز بماند
    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    this.cv.width = Math.round(CFG.W * dpr);
    this.cv.height = Math.round(CFG.H * dpr);
    if (this.cv.style) {
      this.cv.style.width = CFG.W + 'px';
      this.cv.style.height = CFG.H + 'px';
    }
    this.ctx = canvas.getContext('2d');
    this.ctx.scale(dpr, dpr);

    this.state = 'idle';
    this.on = {};
    this.time = 0;
    this.last = 0;
    this.mouse = { x: -1, y: -1, inside: false };

    this.bg = { day: null, night: null };
    this.raf = null;

    this.bindInput();
  }

  /* ------------------------- راه‌اندازی ------------------------- */

  start(level, seeds) {
    // اگر حلقه‌ای در حال اجراست متوقفش کن تا دو حلقه هم‌زمان نداشته باشیم
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.last = 0;
    sfx.stopMusic();

    this.level = level;
    this.seeds = seeds.map((id) => ({
      id,
      def: PLANTS[id],
      cd: 0,
      ready: true,
    }));
    this.selected = -1;
    this.shovel = false;

    this.grid = Array.from({ length: CFG.ROWS }, () => Array(CFG.COLS).fill(null));
    this.plants = [];
    this.zombies = [];
    this.projectiles = [];
    this.suns = [];
    this.particles = [];
    this.mowers = Array.from({ length: CFG.ROWS }, (_, r) => new Mower(r));
    this.decor = [];

    this.sun = level.startSun;
    this.time = 0;
    this.skySunT = 5;
    this.waveIndex = 0;
    this.waveTimer = 5.5;
    this.pending = [];
    this.pendingT = 0;
    this.endless = !!level.endless;
    this.totalWaves = this.endless ? 0 : level.waves.length;
    this.finished = false;
    this.banner = null;
    this.bannerT = 0;
    this.shakeT = 0;
    this.stats = { killed: 0, planted: 0, sunCollected: 0 };

    if (level.theme === 'night') {
      const spots = [];
      for (let i = 0; i < 4; i++) {
        const c = 4 + Math.floor(Math.random() * 5);
        const r = Math.floor(Math.random() * CFG.ROWS);
        const key = `${r},${c}`;
        if (spots.includes(key)) continue;
        spots.push(key);
        this.decor.push({ type: 'tomb', col: c, row: r, x: colCenter(c), y: rowCenter(r) + 28 });
        this.grid[r][c] = 'blocked';
      }
    }

    if (!this.bg[level.theme]) this.bg[level.theme] = buildBackground(level.theme);
    this.bgImg = this.bg[level.theme];

    this.state = 'playing';
    this.showBanner('آماده باش!', 1.6);
    sfx.startMusic(level.theme);
    this.emitHud();
    this.loop(performance.now());
  }

  stop() {
    this.state = 'idle';
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    sfx.stopMusic();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    sfx.stopMusic();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.last = performance.now();
    sfx.startMusic(this.level.theme);
  }

  /* --------------------------- ورودی --------------------------- */

  bindInput() {
    const pos = (e) => {
      const r = this.cv.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / r.width) * CFG.W,
        y: ((e.clientY - r.top) / r.height) * CFG.H,
      };
    };

    this.cv.addEventListener('pointermove', (e) => {
      const p = pos(e);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      this.mouse.inside = true;
    });
    this.cv.addEventListener('pointerleave', () => {
      this.mouse.inside = false;
    });
    this.cv.addEventListener('pointerdown', (e) => {
      if (this.state !== 'playing') return;
      const p = pos(e);
      if (e.button === 2) {
        this.clearSelection();
        return;
      }
      this.click(p.x, p.y);
    });
    this.cv.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.clearSelection();
    });
  }

  click(x, y) {
    // ۱) جمع‌آوری آفتاب
    for (let i = this.suns.length - 1; i >= 0; i--) {
      const s = this.suns[i];
      if (s.contains(x, y)) {
        // شمارنده‌ی آفتاب در چیدمان راست‌به‌چپ، بالا سمت راست قرار دارد
        s.collect(CFG.W - 62, 2);
        this.sun += s.value;
        this.stats.sunCollected += s.value;
        this.particles.push(new FloatText(s.x, s.y - 18, `+${s.value}`, '#ffe066', 20));
        sfx.sun();
        this.emitHud();
        return;
      }
    }

    const c = colAt(x);
    const r = rowAt(y);
    const onGrid = c >= 0 && c < CFG.COLS && r >= 0 && r < CFG.ROWS;

    // ۲) بیل
    if (this.shovel) {
      if (onGrid && this.grid[r][c] && this.grid[r][c] !== 'blocked') {
        const p = this.grid[r][c];
        this.particles.push(...burst(p.x, p.y + 10, '#7ad13f', 8));
        this.removePlant(p);
        sfx.plant();
      }
      this.shovel = false;
      this.emitHud();
      return;
    }

    // ۳) کاشت
    if (this.selected >= 0 && onGrid) {
      this.tryPlant(this.selected, c, r);
      return;
    }
  }

  tryPlant(idx, c, r) {
    const seed = this.seeds[idx];
    if (!seed) return;
    if (this.grid[r][c]) {
      sfx.error();
      this.particles.push(new FloatText(colCenter(c), rowCenter(r) - 20, 'جا اشغال است', '#ff8787', 15));
      return;
    }
    if (!seed.ready) {
      sfx.error();
      return;
    }
    if (this.sun < seed.def.cost) {
      sfx.error();
      this.particles.push(new FloatText(colCenter(c), rowCenter(r) - 20, 'آفتاب کافی نیست', '#ff8787', 15));
      return;
    }
    const p = new Plant(seed.id, c, r);
    this.grid[r][c] = p;
    this.plants.push(p);
    this.sun -= seed.def.cost;
    seed.cd = seed.def.cooldown;
    seed.ready = false;
    this.stats.planted++;
    this.particles.push(...burst(p.x, p.y + 20, '#8b5a2b', 6, 70));
    sfx.plant();
    this.clearSelection();
    this.emitHud();
  }

  selectSeed(i) {
    if (this.state !== 'playing') return;
    const seed = this.seeds[i];
    if (!seed) return;
    this.shovel = false;
    this.selected = this.selected === i ? -1 : i;
    sfx.click();
    this.emitHud();
  }

  toggleShovel() {
    if (this.state !== 'playing') return;
    this.shovel = !this.shovel;
    this.selected = -1;
    sfx.click();
    this.emitHud();
  }

  clearSelection() {
    this.selected = -1;
    this.shovel = false;
    this.emitHud();
  }

  /* --------------------------- منطق --------------------------- */

  removePlant(p) {
    p.dead = true;
    if (this.grid[p.row][p.col] === p) this.grid[p.row][p.col] = null;
    const i = this.plants.indexOf(p);
    if (i >= 0) this.plants.splice(i, 1);
  }

  firstZombieInRow(row, fromX) {
    let best = null;
    for (const z of this.zombies) {
      if (z.row !== row || z.state === 'die') continue;
      if (z.x < fromX - 20) continue;
      if (!best || z.x < best.x) best = z;
    }
    return best;
  }

  spawnSun(x, y, value, fromPlant) {
    this.suns.push(new SunOrb(x, y, value, fromPlant));
  }

  explode(x, y, radiusCells, damage, kind) {
    const r = radiusCells * CFG.CELL_W;
    for (const z of this.zombies) {
      if (z.state === 'die') continue;
      if (Math.hypot(z.x - x, z.y - y) < r) z.hurt(this, damage, false);
    }
    const color = kind === 'fire' ? '#ff922b' : '#a0763c';
    for (let i = 0; i < 34; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 300;
      this.particles.push(
        new Particle(x, y, Math.cos(a) * sp, Math.sin(a) * sp * 0.6 - 60, 0.4 + Math.random() * 0.6, i % 3 ? color : '#ffe066', 4 + Math.random() * 7, 200)
      );
    }
    this.shakeT = 0.35;
    sfx.boom();
  }

  burnLane(row, damage) {
    for (const z of this.zombies) {
      if (z.row === row && z.state !== 'die') z.hurt(this, damage, false);
    }
    for (let i = 0; i < 60; i++) {
      const x = CFG.GRID_X + Math.random() * CFG.LAWN_W;
      const y = rowCenter(row) + (Math.random() * 50 - 25);
      this.particles.push(
        new Particle(x, y, (Math.random() - 0.5) * 60, -90 - Math.random() * 120, 0.4 + Math.random() * 0.6, ['#ff922b', '#ffd43b', '#f03e3e'][i % 3], 5 + Math.random() * 7, 40)
      );
    }
    this.shakeT = 0.3;
    sfx.burn();
  }

  showBanner(text, dur = 2.2, big = false) {
    this.banner = { text, big };
    this.bannerT = dur;
  }

  /* --------------------------- موج‌ها --------------------------- */

  updateWaves(dt) {
    if (this.finished) return;

    // صف انتظار برای اسپاون تدریجی
    if (this.pending.length) {
      this.pendingT -= dt;
      if (this.pendingT <= 0) {
        const item = this.pending.shift();
        this.zombies.push(new Zombie(item.type, item.row, Math.random() * 40));
        this.pendingT = 0.35 + Math.random() * 0.75;
      }
      return;
    }

    this.waveTimer -= dt;
    if (this.waveTimer > 0) return;

    const wave = this.endless ? survivalWave(this.waveIndex + 1) : this.level.waves[this.waveIndex];
    if (!wave) {
      // همه موج‌ها اسپاون شده‌اند
      if (this.zombies.length === 0) this.win();
      return;
    }

    this.waveIndex++;
    const rows = [];
    for (const type of wave.list) {
      let r;
      let guard = 0;
      do {
        r = Math.floor(Math.random() * CFG.ROWS);
        guard++;
      } while (rows.slice(-2).includes(r) && guard < 6);
      rows.push(r);
      this.pending.push({ type, row: r });
    }
    this.pendingT = 0.2;

    if (wave.big) {
      this.showBanner('موج بزرگ زامبی‌ها در راه است!', 2.6, true);
      sfx.wave();
    } else if (this.waveIndex === 1) {
      this.showBanner('زامبی‌ها دارند می‌آیند!', 2.2);
      sfx.wave();
    } else if (this.endless) {
      this.showBanner(`موج ${this.waveIndex}`, 1.4);
    }

    const next = this.endless ? survivalWave(this.waveIndex + 1) : this.level.waves[this.waveIndex];
    this.waveTimer = next ? next.delay : 6;
    this.emitHud();
  }

  win() {
    if (this.finished) return;
    this.finished = true;
    this.state = 'won';
    sfx.stopMusic();
    sfx.win();
    if (this.on.end) this.on.end('win', this.stats, this.waveIndex);
  }

  lose() {
    if (this.finished) return;
    this.finished = true;
    this.state = 'lost';
    sfx.stopMusic();
    sfx.lose();
    if (this.on.end) this.on.end('lose', this.stats, this.waveIndex);
  }

  emitHud() {
    if (this.on.hud) {
      this.on.hud({
        sun: this.sun,
        seeds: this.seeds,
        selected: this.selected,
        shovel: this.shovel,
        wave: this.waveIndex,
        totalWaves: this.totalWaves,
        progress: this.endless ? 0 : Math.min(1, this.waveIndex / Math.max(1, this.totalWaves)),
      });
    }
  }

  /* --------------------------- حلقه --------------------------- */

  loop(ts) {
    this.raf = requestAnimationFrame((t) => this.loop(t));
    if (!this.last) this.last = ts;
    let dt = (ts - this.last) / 1000;
    this.last = ts;
    if (dt > 0.05) dt = 0.05;

    if (this.state === 'playing') this.update(dt);
    this.render(dt);
  }

  update(dt) {
    this.time += dt;
    if (this.bannerT > 0) this.bannerT -= dt;
    if (this.shakeT > 0) this.shakeT -= dt;

    // خنک‌شدن بسته‌های بذر
    let hudDirty = false;
    for (const s of this.seeds) {
      if (!s.ready) {
        s.cd -= dt;
        if (s.cd <= 0) {
          s.cd = 0;
          s.ready = true;
        }
        hudDirty = true;
      }
    }

    // آفتاب آسمانی
    if (this.level.skySun) {
      this.skySunT -= dt;
      if (this.skySunT <= 0) {
        this.skySunT = 7.5 + Math.random() * 3;
        const x = CFG.GRID_X + 30 + Math.random() * (CFG.LAWN_W - 60);
        const y = CFG.GRID_Y + 40 + Math.random() * (CFG.LAWN_H - 70);
        this.spawnSun(x, y, 25, false);
      }
    }

    for (const p of this.plants) p.update(this, dt);
    for (const z of this.zombies) z.update(this, dt);
    for (const pr of this.projectiles) pr.update(this, dt);
    for (const s of this.suns) s.update(this, dt);
    for (const m of this.mowers) m.update(this, dt);
    for (const pt of this.particles) pt.update(this, dt);

    this.plants = this.plants.filter((p) => {
      if (p.dead && this.grid[p.row][p.col] === p) this.grid[p.row][p.col] = null;
      return !p.dead;
    });
    this.zombies = this.zombies.filter((z) => !z.dead);
    this.projectiles = this.projectiles.filter((p) => !p.dead);
    this.suns = this.suns.filter((s) => !s.dead);
    this.particles = this.particles.filter((p) => !p.dead);

    this.updateWaves(dt);

    if (hudDirty) this.emitHud();
  }

  render() {
    const ctx = this.ctx;
    ctx.save();
    if (this.shakeT > 0) {
      const k = this.shakeT * 18;
      ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
    }
    ctx.drawImage(this.bgImg, 0, 0);

    // سنگ‌قبرها
    for (const d of this.decor) {
      ctx.save();
      ctx.translate(d.x, d.y);
      drawTombstone(ctx);
      ctx.restore();
    }

    // هایلایت خانه زیر موس
    if (this.state === 'playing' && this.mouse.inside && (this.selected >= 0 || this.shovel)) {
      const c = colAt(this.mouse.x);
      const r = rowAt(this.mouse.y);
      if (c >= 0 && c < CFG.COLS && r >= 0 && r < CFG.ROWS) {
        const free = !this.grid[r][c];
        const ok = this.shovel ? !free && this.grid[r][c] !== 'blocked' : free;
        ctx.fillStyle = ok ? 'rgba(255,255,255,.22)' : 'rgba(255,70,70,.22)';
        ctx.fillRect(CFG.GRID_X + c * CFG.CELL_W, CFG.GRID_Y + r * CFG.CELL_H, CFG.CELL_W, CFG.CELL_H);
        ctx.strokeStyle = ok ? 'rgba(255,255,255,.7)' : 'rgba(255,90,90,.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(CFG.GRID_X + c * CFG.CELL_W + 1, CFG.GRID_Y + r * CFG.CELL_H + 1, CFG.CELL_W - 2, CFG.CELL_H - 2);
      }
    }

    for (const m of this.mowers) m.draw(ctx);

    // مرتب‌سازی بر اساس عمق
    const ents = [...this.plants, ...this.zombies].sort(ROW_ORDER);
    for (const e of ents) e.draw(ctx);
    for (const p of this.projectiles) p.draw(ctx);
    for (const p of this.particles) p.draw(ctx);
    for (const s of this.suns) s.draw(ctx);

    // پیش‌نمایش گیاه زیر نشانگر
    if (this.state === 'playing' && this.mouse.inside && this.selected >= 0) {
      const seed = this.seeds[this.selected];
      const c = colAt(this.mouse.x);
      const r = rowAt(this.mouse.y);
      const gx = c >= 0 && c < CFG.COLS ? colCenter(c) : this.mouse.x;
      const gy = r >= 0 && r < CFG.ROWS ? rowCenter(r) + 30 : this.mouse.y + 20;
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.translate(gx, gy);
      drawPlantArt(ctx, seed.id, this.time, { hp: 1, armed: true, fuseRatio: 0, state: 'idle' });
      ctx.restore();
    }

    // شب: هاله نور
    if (this.level && this.level.theme === 'night') {
      const g = ctx.createRadialGradient(CFG.W * 0.35, CFG.H * 0.5, 100, CFG.W * 0.35, CFG.H * 0.5, 700);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(5,10,35,.35)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, CFG.W, CFG.H);
    }

    ctx.restore();

    this.renderBanner(ctx);
    if (this.state === 'paused') this.renderPauseVeil(ctx);
  }

  renderBanner(ctx) {
    if (!this.banner || this.bannerT <= 0) return;
    const a = Math.min(1, this.bannerT * 1.6);
    ctx.save();
    ctx.globalAlpha = a;
    const big = this.banner.big;
    const y = CFG.H * 0.34;
    ctx.font = `bold ${big ? 40 : 32}px Vazirmatn, Tahoma, sans-serif`;
    ctx.textAlign = 'center';
    const w = ctx.measureText(this.banner.text).width + 60;
    ctx.fillStyle = big ? 'rgba(140,20,20,.82)' : 'rgba(20,30,15,.72)';
    const bx = CFG.W / 2 - w / 2;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(bx, y - 38, w, 58, 16) : ctx.rect(bx, y - 38, w, 58);
    ctx.fill();
    ctx.strokeStyle = big ? 'rgba(255,180,180,.7)' : 'rgba(255,255,255,.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillText(this.banner.text, CFG.W / 2, y + 2);
    ctx.restore();
  }

  renderPauseVeil(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(8,14,20,.55)';
    ctx.fillRect(0, 0, CFG.W, CFG.H);
    ctx.restore();
  }
}

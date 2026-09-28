// موجودیت‌های بازی: گیاه، زامبی، گلوله، آفتاب، ذره، چمن‌زن

import { CFG, PLANTS, ZOMBIES, colCenter, rowCenter, colAt } from './config.js';
import { drawPlantArt, drawZombieArt, drawSunOrb, drawPea, drawMower, ell } from './art.js';
import { sfx } from './audio.js';

let UID = 1;

/* بوم کمکی برای رنگ‌آمیزی زامبی (یخ‌زدگی و فلاش ضربه) */
const TINT_W = 170;
const TINT_H = 190;
const TINT_OX = 85;
const TINT_OY = 158;
let TINT_CV = null;
let TINT_CTX = null;
function tintCtx() {
  if (TINT_CTX !== null) return TINT_CTX;
  try {
    TINT_CV = document.createElement('canvas');
    TINT_CV.width = TINT_W;
    TINT_CV.height = TINT_H;
    TINT_CTX = TINT_CV.getContext('2d');
  } catch {
    TINT_CTX = false;
  }
  return TINT_CTX;
}

/* ============================ گیاه ============================ */

export class Plant {
  constructor(id, col, row) {
    this.uid = UID++;
    this.id = id;
    this.def = PLANTS[id];
    this.col = col;
    this.row = row;
    this.x = colCenter(col);
    this.y = rowCenter(row);
    this.maxHp = this.def.hp;
    this.hp = this.maxHp;
    this.t = Math.random() * 3;
    this.dead = false;
    this.state = 'idle';
    this.recoil = 0;
    this.hitFlash = 0;
    this.spawnAnim = 0;

    // مخصوص هر نوع
    this.timer = this.def.kind === 'producer' ? this.def.produceFirst : 0;
    this.fireT = 0.5;
    this.armLeft = this.def.armTime || 0;
    this.armed = !this.def.armTime;
    this.fuseLeft = this.def.fuse || 0;
    this.chewLeft = 0;
    this.biteAnim = 0;
    this.produceGlow = 0;
    this.burstLeft = 0;
    this.burstT = 0;
  }

  get alive() {
    return !this.dead;
  }

  damage(n) {
    this.hp -= n;
    this.hitFlash = 0.12;
    if (this.hp <= 0) this.dead = true;
  }

  update(game, dt) {
    this.t += dt;
    if (this.spawnAnim < 1) this.spawnAnim = Math.min(1, this.spawnAnim + dt * 4);
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 6);
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.produceGlow > 0) this.produceGlow -= dt;

    const d = this.def;

    switch (d.kind) {
      case 'producer': {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.timer = d.produceEvery;
          this.produceGlow = 1.2;
          game.spawnSun(this.x + (Math.random() * 30 - 15), this.y - 10, d.produceValue, true);
        }
        break;
      }
      case 'shooter': {
        const target = game.firstZombieInRow(this.row, this.x);
        if (this.burstLeft > 0) {
          this.burstT -= dt;
          if (this.burstT <= 0) {
            this.burstLeft--;
            this.burstT = 0.15;
            this.fire(game);
          }
        } else {
          this.fireT -= dt;
          if (target && this.fireT <= 0) {
            this.fireT = d.fireRate;
            this.fire(game);
            if (d.burst) {
              this.burstLeft = d.burst - 1;
              this.burstT = 0.15;
            }
          }
        }
        break;
      }
      case 'mine': {
        if (!this.armed) {
          this.armLeft -= dt;
          if (this.armLeft <= 0) {
            this.armed = true;
            sfx.plant();
          }
        } else {
          const z = game.zombies.find(
            (zz) => zz.row === this.row && zz.state !== 'die' && Math.abs(zz.x - this.x) < CFG.CELL_W * 0.55
          );
          if (z) {
            game.explode(this.x, this.y, 0.8, d.damage, 'dirt');
            this.dead = true;
          }
        }
        break;
      }
      case 'bomb': {
        this.fuseLeft -= dt;
        if (this.fuseLeft <= 0) {
          game.explode(this.x, this.y, d.radius, d.damage, 'fire');
          this.dead = true;
        }
        break;
      }
      case 'lanefire': {
        this.fuseLeft -= dt;
        if (this.fuseLeft <= 0) {
          game.burnLane(this.row, d.damage);
          this.dead = true;
        }
        break;
      }
      case 'chomper': {
        if (this.chewLeft > 0) {
          this.chewLeft -= dt;
          this.state = this.chewLeft > 0 ? 'chew' : 'idle';
        } else if (this.biteAnim > 0) {
          this.biteAnim = Math.max(0, this.biteAnim - dt * 3);
        } else {
          const reach = CFG.CELL_W * d.reach;
          const z = game.zombies.find(
            (zz) => zz.row === this.row && zz.state !== 'die' && zz.x > this.x - 20 && zz.x < this.x + reach
          );
          if (z) {
            z.instantKill(game, true);
            this.chewLeft = d.chewTime;
            this.biteAnim = 1;
            this.state = 'chew';
            sfx.gulp();
          }
        }
        break;
      }
      default:
        break;
    }
  }

  fire(game) {
    const d = this.def;
    this.recoil = 1;
    game.projectiles.push(new Projectile(this.x + 24, this.y - 22, this.row, d.damage, d.bullet === 'frost'));
    sfx.shoot();
  }

  get fuseRatio() {
    if (!this.def.fuse) return 0;
    return 1 - this.fuseLeft / this.def.fuse;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y + 30);
    const s = 0.6 + 0.4 * easeOutBack(this.spawnAnim);
    ctx.scale(s, s);
    if (this.hitFlash > 0) {
      ctx.save();
      ctx.globalAlpha = 0.6;
    }
    drawPlantArt(ctx, this.id, this.t, {
      hp: this.hp / this.maxHp,
      armed: this.armed,
      armLeft: this.armLeft,
      fuseRatio: this.fuseRatio,
      state: this.state,
      biteAnim: this.biteAnim,
      recoil: this.recoil,
      produceGlow: this.produceGlow,
    });
    if (this.hitFlash > 0) ctx.restore();
    ctx.restore();

    if (this.hp < this.maxHp && this.def.kind !== 'bomb' && this.def.kind !== 'lanefire') {
      hpBar(ctx, this.x, this.y - 40, this.hp / this.maxHp, '#7ad13f');
    }
  }
}

/* ============================ زامبی ============================ */

export class Zombie {
  constructor(type, row, xOffset = 0) {
    this.uid = UID++;
    this.type = type;
    this.def = ZOMBIES[type];
    this.row = row;
    this.x = CFG.SPAWN_X + xOffset;
    this.y = rowCenter(row);
    this.maxHp = this.def.hp;
    this.hp = this.def.hp;
    this.maxShield = this.def.shield;
    this.shield = this.def.shield;
    this.baseSpeed = this.def.speed;
    this.state = 'walk';
    this.t = Math.random() * 4;
    this.phase = Math.random() * 6;
    this.slowT = 0;
    this.hitFlash = 0;
    this.dieT = 0;
    this.eaten = false;
    this.dead = false;
    this.raged = false;
    this.groanT = 3 + Math.random() * 8;
  }

  get speed() {
    let s = this.baseSpeed;
    if (this.slowT > 0) s *= 0.5;
    return s;
  }

  hurt(game, n, frost) {
    if (this.state === 'die') return;
    if (frost) {
      this.slowT = 4;
    }
    if (this.shield > 0) {
      this.shield -= n;
      if (this.shield < 0) {
        this.hp += this.shield;
        this.shield = 0;
        if (this.type === 'news' && !this.raged) {
          this.raged = true;
          this.baseSpeed = this.def.rageSpeed;
          sfx.groan();
        }
      }
    } else {
      this.hp -= n;
    }
    this.hitFlash = 0.1;
    if (this.hp <= 0) this.die(game);
  }

  die(game) {
    if (this.state === 'die') return;
    this.state = 'die';
    this.dieT = 0;
    game.stats.killed++;
    game.particles.push(...burst(this.x, this.y + 10, '#8aa877', 7));
  }

  instantKill(game, swallow) {
    if (this.state === 'die') return;
    game.stats.killed++;
    if (swallow) {
      this.dead = true;
      game.particles.push(...burst(this.x, this.y + 6, '#b45fd6', 9));
    } else {
      this.hp = 0;
      this.die(game);
    }
  }

  update(game, dt) {
    this.t += dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.slowT > 0) this.slowT -= dt;

    if (this.state === 'die') {
      this.dieT += dt;
      if (this.dieT > 1.3) this.dead = true;
      return;
    }

    this.groanT -= dt;
    if (this.groanT <= 0) {
      this.groanT = 7 + Math.random() * 12;
      if (Math.random() < 0.5) sfx.groan();
    }

    // چمن‌زن
    const mower = game.mowers[this.row];
    if (mower && !mower.used && this.x < CFG.GRID_X + 6) {
      mower.trigger();
    }

    // باخت
    if (this.x < CFG.GRID_X - 46) {
      game.lose();
      return;
    }

    // خوردن گیاه
    const c = colAt(this.x - 18);
    const plant = c >= 0 && c < CFG.COLS ? game.grid[this.row][c] : null;
    if (plant && plant.alive) {
      this.state = 'eat';
      plant.damage(this.def.dps * dt);
      if (Math.random() < dt * 2.2) sfx.chomp();
      if (!plant.alive) {
        game.removePlant(plant);
        this.state = 'walk';
      }
    } else {
      this.state = 'walk';
      this.x -= this.speed * dt;
    }
  }

  drawBody(ctx) {
    if (this.state === 'die') {
      const k = Math.min(1, this.dieT / 1.3);
      ctx.rotate(-k * 1.35);
      ctx.translate(-k * 12, k * 6);
    }
    drawZombieArt(ctx, this.type, this.t, {
      state: this.state,
      phase: this.phase,
      speedFactor: this.slowT > 0 ? 0.5 : this.raged ? 2 : 1,
      shieldRatio: this.maxShield ? Math.max(0, this.shield / this.maxShield) : undefined,
    });
  }

  draw(ctx) {
    const dieAlpha =
      this.state === 'die'
        ? 1 - Math.max(0, (Math.min(1, this.dieT / 1.3) - 0.55) / 0.45)
        : 1;
    const tint =
      this.hitFlash > 0
        ? `rgba(255,255,255,${Math.min(0.75, this.hitFlash * 5)})`
        : this.slowT > 0
          ? 'rgba(110,200,255,.34)'
          : null;

    if (!tint) {
      ctx.save();
      ctx.globalAlpha = dieAlpha;
      ctx.translate(this.x, this.y + 32);
      this.drawBody(ctx);
      ctx.restore();
    } else {
      // رنگ‌آمیزی فقط روی پیکسل‌های خود زامبی، با بوم کمکی
      const b = tintCtx();
      if (b) {
        b.clearRect(0, 0, TINT_W, TINT_H);
        b.save();
        b.translate(TINT_OX, TINT_OY);
        this.drawBody(b);
        b.restore();
        b.save();
        b.globalCompositeOperation = 'source-atop';
        b.fillStyle = tint;
        b.fillRect(0, 0, TINT_W, TINT_H);
        b.restore();
        ctx.save();
        ctx.globalAlpha = dieAlpha;
        ctx.drawImage(TINT_CV, this.x - TINT_OX, this.y + 32 - TINT_OY);
        ctx.restore();
      } else {
        ctx.save();
        ctx.globalAlpha = dieAlpha;
        ctx.translate(this.x, this.y + 32);
        this.drawBody(ctx);
        ctx.restore();
      }
    }

    if (this.state !== 'die') {
      const totalMax = this.maxHp + this.maxShield;
      const total = this.hp + Math.max(0, this.shield);
      if (total < totalMax) {
        hpBar(ctx, this.x, this.y - 48, total / totalMax, this.shield > 0 ? '#c9cdd4' : '#e05252');
      }
    }
  }
}

/* ============================ گلوله ============================ */

export class Projectile {
  constructor(x, y, row, damage, frost) {
    this.x = x;
    this.y = y;
    this.row = row;
    this.damage = damage;
    this.frost = frost;
    this.vx = 330;
    this.dead = false;
    this.t = 0;
  }

  update(game, dt) {
    this.t += dt;
    this.x += this.vx * dt;
    if (this.x > CFG.W + 30) {
      this.dead = true;
      return;
    }
    for (const z of game.zombies) {
      if (z.row !== this.row || z.state === 'die') continue;
      if (this.x > z.x - 20 && this.x < z.x + 16) {
        z.hurt(game, this.damage, this.frost);
        this.dead = true;
        game.particles.push(
          ...burst(this.x, this.y, this.frost ? '#9fe6ff' : '#9ade5c', 5, 60)
        );
        if (this.frost) sfx.freeze();
        else sfx.hit();
        return;
      }
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    drawPea(ctx, this.t, this.frost);
    ctx.restore();
  }
}

/* ============================ آفتاب ============================ */

export class SunOrb {
  constructor(x, y, value, fromPlant) {
    this.x = x;
    this.y = fromPlant ? y : -30;
    this.targetY = fromPlant ? y + 18 : y;
    this.value = value;
    this.r = 22;
    this.life = 11;
    this.dead = false;
    this.t = Math.random() * 3;
    this.collecting = false;
    this.cx = 0;
    this.cy = 0;
    this.vy = fromPlant ? -55 : 0;
    this.fromPlant = fromPlant;
    this.pop = 0;
  }

  contains(px, py) {
    return !this.collecting && Math.hypot(px - this.x, py - this.y) < this.r + 10;
  }

  collect(tx, ty) {
    this.collecting = true;
    this.cx = tx;
    this.cy = ty;
  }

  update(game, dt) {
    this.t += dt;
    if (this.pop < 1) this.pop = Math.min(1, this.pop + dt * 5);
    if (this.collecting) {
      const dx = this.cx - this.x;
      const dy = this.cy - this.y;
      const d = Math.hypot(dx, dy);
      const sp = 900 * dt;
      if (d < sp) {
        this.dead = true;
        return;
      }
      this.x += (dx / d) * sp;
      this.y += (dy / d) * sp;
      this.r = Math.max(7, this.r - dt * 30);
      return;
    }
    if (this.fromPlant) {
      this.vy += 180 * dt;
      this.y += this.vy * dt;
      if (this.y > this.targetY) {
        this.y = this.targetY;
        this.vy = 0;
      }
    } else if (this.y < this.targetY) {
      this.y = Math.min(this.targetY, this.y + 48 * dt);
    } else {
      this.life -= dt;
      if (this.life <= 0) this.dead = true;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    const s = (0.4 + 0.6 * easeOutBack(this.pop)) * (1 + Math.sin(this.t * 3) * 0.03);
    ctx.scale(s, s);
    if (this.life < 3 && !this.collecting) ctx.globalAlpha = 0.35 + Math.abs(Math.sin(this.t * 7)) * 0.65;
    drawSunOrb(ctx, this.t, this.r);
    ctx.restore();
  }
}

/* ============================ چمن‌زن ============================ */

export class Mower {
  constructor(row) {
    this.row = row;
    this.x = CFG.MOWER_X;
    this.y = rowCenter(row);
    this.running = false;
    this.used = false;
    this.t = 0;
  }

  trigger() {
    if (this.used) return;
    this.used = true;
    this.running = true;
    sfx.mower();
  }

  update(game, dt) {
    this.t += dt;
    if (!this.running) return;
    this.x += 430 * dt;
    for (const z of game.zombies) {
      if (z.row === this.row && z.state !== 'die' && Math.abs(z.x - this.x) < 34) {
        z.instantKill(game, false);
        game.particles.push(...burst(z.x, z.y + 10, '#8aa877', 8, 140));
      }
    }
    if (this.x > CFG.W + 40) this.running = false;
  }

  draw(ctx) {
    if (this.used && !this.running) return;
    ctx.save();
    ctx.translate(this.x, this.y + 30);
    drawMower(ctx, this.t, this.running);
    ctx.restore();
  }
}

/* ============================ ذرات ============================ */

export class Particle {
  constructor(x, y, vx, vy, life, color, size, gravity = 260) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = life;
    this.max = life;
    this.color = color;
    this.size = size;
    this.gravity = gravity;
    this.dead = false;
  }

  update(game, dt) {
    this.life -= dt;
    if (this.life <= 0) {
      this.dead = true;
      return;
    }
    this.vy += this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  draw(ctx) {
    const a = Math.max(0, this.life / this.max);
    ctx.globalAlpha = a;
    ell(ctx, this.x, this.y, this.size * a + 1, this.size * a + 1, this.color);
    ctx.globalAlpha = 1;
  }
}

export class FloatText {
  constructor(x, y, text, color = '#fff', size = 18) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.size = size;
    this.life = 1.1;
    this.max = 1.1;
    this.dead = false;
  }
  update(game, dt) {
    this.life -= dt;
    this.y -= 34 * dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life / this.max);
    ctx.font = `bold ${this.size}px Vazirmatn, Tahoma, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,.55)';
    ctx.strokeText(this.text, this.x, this.y);
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

/* ============================ کمکی ============================ */

export function burst(x, y, color, n = 8, spread = 100) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = spread * (0.4 + Math.random() * 0.9);
    out.push(new Particle(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 40, 0.35 + Math.random() * 0.4, color, 3 + Math.random() * 3));
  }
  return out;
}

export function hpBar(ctx, x, y, ratio, color) {
  const w = 44;
  const h = 5;
  ctx.save();
  ctx.globalAlpha = 0.9;
  rr(ctxSafe(ctx), x - w / 2, y, w, h, 3, 'rgba(0,0,0,.45)');
  rr(ctxSafe(ctx), x - w / 2, y, Math.max(2, w * Math.max(0, ratio)), h, 3, color);
  ctx.restore();
}

function ctxSafe(ctx) {
  return ctx;
}

function rr(ctx, x, y, w, h, r, fill) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

export function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

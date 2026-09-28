/** کلاس‌های موجودیت‌های بازی. منطق به‌روزرسانی در `game.js` هماهنگ می‌شود. */

import { PLANTS, ZOMBIES, cellCenter, laneY } from './config.js';

let uid = 0;
export const nextId = () => ++uid;

export class Plant {
  constructor(type, col, row) {
    const cfg = PLANTS[type];
    const { x, y } = cellCenter(col, row);
    this.id = nextId();
    this.type = type;
    this.cfg = cfg;
    this.col = col;
    this.row = row;
    this.x = x;
    this.y = y;
    this.maxHp = cfg.hp;
    this.hp = cfg.hp;
    this.seed = Math.random() * 10;
    this.age = 0;
    this.flash = 0;
    this.planting = 1; // انیمیشن کاشت (۱ → ۰)
    this.recoil = 0;
    this.dead = false;

    // ویژه‌ی هر نوع
    this.fireTimer = cfg.fireRate ? cfg.fireRate * 0.45 : 0;
    this.produceTimer = cfg.produceFirst ?? 0;
    this.charge = 0;
    this.chewTimer = 0;
    this.armTime = cfg.armTime ?? 0;
    this.armed = cfg.kind !== 'mine';
    this.fuseTimer = cfg.fuse ?? 0;
  }

  get alive() {
    return !this.dead && this.hp > 0;
  }

  damage(amount) {
    this.hp -= amount;
    this.flash = 0.35;
    if (this.hp <= 0) this.dead = true;
  }
}

export class Zombie {
  constructor(typeId, row, x) {
    const cfg = ZOMBIES[typeId];
    this.id = nextId();
    this.cfg = cfg;
    this.row = row;
    this.x = x;
    this.y = laneY(row);
    this.maxHp = cfg.hp;
    this.hp = cfg.hp;
    this.maxArmor = cfg.armor ?? 0;
    this.armor = this.maxArmor;
    this.baseSpeed = cfg.speed;
    this.walkPhase = Math.random() * Math.PI * 2;
    this.eating = false;
    this.eatTarget = null;
    this.slowTimer = 0;
    this.flash = 0;
    this.raged = false;
    this.dead = false;
    this.dying = 0;
    this.smashCooldown = 0;
  }

  get speed() {
    const base = this.raged && this.cfg.rageSpeed ? this.cfg.rageSpeed : this.baseSpeed;
    return this.slowTimer > 0 ? base * 0.5 : base;
  }

  get totalHp() {
    return this.hp + this.armor;
  }

  damage(amount) {
    this.flash = 0.25;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, amount);
      this.armor -= absorbed;
      amount -= absorbed;
      if (this.armor <= 0 && this.cfg.rageSpeed) this.raged = true;
    }
    if (amount > 0) this.hp -= amount;
    if (this.hp <= 0) this.dead = true;
  }
}

export class Bullet {
  constructor(x, y, row, damage, freeze) {
    this.id = nextId();
    this.x = x;
    this.y = y;
    this.row = row;
    this.vx = 300;
    this.r = 7;
    this.damage = damage;
    this.freeze = !!freeze;
    this.dead = false;
  }
}

export class SunToken {
  constructor(x, y, targetY, value, fromSky) {
    this.id = nextId();
    this.x = x;
    this.y = y;
    this.targetY = targetY;
    this.value = value;
    this.fromSky = fromSky;
    this.alpha = 1;
    this.life = 11;
    this.seed = Math.random() * 6;
    this.vx = fromSky ? 0 : (Math.random() - 0.5) * 34;
    this.vy = fromSky ? 0 : -70;
    this.dead = false;
    this.collecting = false;
  }
}

export class Particle {
  constructor(opts) {
    Object.assign(
      this,
      {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0.6,
        maxLife: 0.6,
        size: 4,
        color: '#fff',
        gravity: 260,
        shape: 'circle',
        text: '',
        rot: 0,
        vr: 0,
      },
      opts
    );
    this.dead = false;
  }
}

export class Mower {
  constructor(row, x) {
    this.row = row;
    this.x = x;
    this.y = laneY(row);
    this.running = false;
    this.used = false;
  }
}

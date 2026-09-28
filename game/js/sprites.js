/**
 * تمام گرافیک بازی به‌صورت برداری و در زمان اجرا کشیده می‌شود.
 * هیچ فایل تصویری خارجی‌ای لازم نیست، پس بازی کاملاً آفلاین کار می‌کند.
 *
 * قرارداد: مبدأ (0,0) هر موجودیت روی «زمین» و در مرکز افقی آن است؛
 * بدنه به سمت y منفی رشد می‌کند.
 */

/* ---------------------------- ابزارهای پایه ---------------------------- */

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function ellipse(ctx, x, y, rx, ry, fill, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
}

function shadow(ctx, rx = 26, ry = 8, alpha = 0.22) {
  ctx.fillStyle = `rgba(12,32,10,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(0, 2, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function eye(ctx, x, y, r, look = -1, blink = false) {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
  if (blink) {
    ctx.strokeStyle = '#26301f';
    ctx.lineWidth = Math.max(1.4, r * 0.5);
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.lineTo(x + r, y);
    ctx.stroke();
    return;
  }
  ctx.fillStyle = '#16200f';
  ctx.beginPath();
  ctx.arc(x + look * r * 0.32, y + r * 0.1, r * 0.52, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(x + look * r * 0.32 - r * 0.2, y - r * 0.2, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

function stem(ctx, height, color = '#4a9d34', width = 7) {
  const grad = ctx.createLinearGradient(-width, 0, width, 0);
  grad.addColorStop(0, '#2f6f21');
  grad.addColorStop(0.45, color);
  grad.addColorStop(1, '#7fc65a');
  ctx.fillStyle = grad;
  roundRect(ctx, -width / 2, -height, width, height, width / 2);
  ctx.fill();
}

function leaf(ctx, x, y, size, dir = 1, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(dir, 1);
  const g = ctx.createLinearGradient(0, -size * 0.4, size, size * 0.4);
  g.addColorStop(0, '#5fb03c');
  g.addColorStop(1, '#2f7521');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(size * 0.55, -size * 0.55, size * 1.15, 0);
  ctx.quadraticCurveTo(size * 0.55, size * 0.45, 0, 0);
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,60,15,0.35)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(size * 0.08, 0);
  ctx.quadraticCurveTo(size * 0.6, -size * 0.06, size * 1.05, -0.5);
  ctx.stroke();
  ctx.restore();
}

/* ------------------------------- گیاهان ------------------------------- */

function drawSunflower(ctx, t, p) {
  shadow(ctx);
  const sway = Math.sin(t * 1.7 + p.seed) * 0.07;
  ctx.save();
  ctx.rotate(sway);
  stem(ctx, 44);
  leaf(ctx, -3, -16, 17, -1, -0.25);
  leaf(ctx, 3, -24, 15, 1, 0.2);

  const hy = -54;
  const glow = 0.5 + 0.5 * Math.sin(t * 2.4 + p.seed);
  // پرتوهای نور هنگام تولید خورشید
  if (p.charge > 0.82) {
    ctx.fillStyle = `rgba(255,224,110,${0.18 * glow})`;
    ctx.beginPath();
    ctx.arc(0, hy, 34, 0, Math.PI * 2);
    ctx.fill();
  }
  const petals = 12;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2 + Math.sin(t * 1.1 + p.seed) * 0.05;
    ctx.save();
    ctx.translate(0, hy);
    ctx.rotate(a);
    const g = ctx.createLinearGradient(0, -8, 0, -26);
    g.addColorStop(0, '#ffd24a');
    g.addColorStop(1, '#ff9e18');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, -19, 7.5, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const fg = ctx.createRadialGradient(-4, hy - 4, 2, 0, hy, 17);
  fg.addColorStop(0, '#ffe27a');
  fg.addColorStop(1, '#e7a21c');
  ellipse(ctx, 0, hy, 17, 16, fg);
  const blink = Math.sin(t * 0.9 + p.seed * 3) > 0.97;
  eye(ctx, -6, hy - 3, 4.2, 1, blink);
  eye(ctx, 6, hy - 3, 4.2, 1, blink);
  ctx.strokeStyle = '#8a5a10';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, hy + 3, 6, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

function peaHead(ctx, hy, colorA, colorB, barrels, recoil) {
  const g = ctx.createRadialGradient(-5, hy - 6, 2, 2, hy, 18);
  g.addColorStop(0, colorA);
  g.addColorStop(1, colorB);
  for (let b = 0; b < barrels; b++) {
    const by = hy + (barrels === 2 ? (b === 0 ? -7 : 7) : 0);
    ctx.fillStyle = colorB;
    roundRect(ctx, 10 - recoil, by - 6, 22, 12, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(31 - recoil, by, 2.6, 4.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ellipse(ctx, 0 - recoil * 0.4, hy, 18, 17, g);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  ctx.ellipse(-7 - recoil * 0.4, hy - 7, 6, 4, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawPeashooterLike(ctx, t, p, opts) {
  shadow(ctx);
  const sway = Math.sin(t * 1.5 + p.seed) * 0.05;
  const recoil = p.recoil > 0 ? p.recoil * 7 : 0;
  ctx.save();
  ctx.rotate(sway);
  stem(ctx, 40);
  leaf(ctx, -3, -14, 16, -1, -0.2);
  leaf(ctx, 2, -22, 13, 1, 0.25);
  const hy = -50;
  peaHead(ctx, hy, opts.colorA, opts.colorB, opts.barrels, recoil);
  const blink = Math.sin(t * 0.8 + p.seed * 2) > 0.975;
  eye(ctx, -1 - recoil * 0.4, hy - 4, 4, 1, blink);
  if (opts.frost) {
    ctx.strokeStyle = 'rgba(230,252,255,0.8)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) {
      const a = t * 0.6 + i * 2.1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 20, hy + Math.sin(a) * 19);
      ctx.lineTo(Math.cos(a) * 25, hy + Math.sin(a) * 24);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawWallnut(ctx, t, p) {
  shadow(ctx, 28, 8);
  const squish = 1 + Math.sin(t * 2 + p.seed) * 0.015;
  ctx.save();
  ctx.scale(1 / squish, squish);
  const g = ctx.createRadialGradient(-8, -42, 4, 0, -32, 36);
  g.addColorStop(0, '#d9a463');
  g.addColorStop(0.6, '#b97b3c');
  g.addColorStop(1, '#8a5423');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-26, 0);
  ctx.bezierCurveTo(-32, -34, -20, -62, 0, -62);
  ctx.bezierCurveTo(20, -62, 32, -34, 26, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(80,46,16,0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const ratio = p.hp / p.maxHp;
  ctx.strokeStyle = 'rgba(70,40,14,0.55)';
  ctx.lineWidth = 2.2;
  if (ratio < 0.66) {
    ctx.beginPath();
    ctx.moveTo(-18, -50);
    ctx.lineTo(-10, -38);
    ctx.lineTo(-17, -28);
    ctx.stroke();
  }
  if (ratio < 0.33) {
    ctx.beginPath();
    ctx.moveTo(16, -52);
    ctx.lineTo(8, -40);
    ctx.lineTo(18, -30);
    ctx.lineTo(10, -16);
    ctx.stroke();
  }
  const hurt = ratio < 0.33;
  const blink = Math.sin(t * 0.7 + p.seed) > 0.96;
  eye(ctx, -8, -40, 5, 1, blink);
  eye(ctx, 9, -40, 5, 1, blink);
  ctx.strokeStyle = '#5c360f';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (hurt) ctx.arc(0, -22, 7, 1.15 * Math.PI, 1.85 * Math.PI);
  else ctx.arc(0, -30, 8, 0.12 * Math.PI, 0.88 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

function drawPotatoMine(ctx, t, p) {
  const armed = p.armed;
  shadow(ctx, 22, 7);
  // تپه‌ی خاک
  ctx.fillStyle = '#6b4a2a';
  ctx.beginPath();
  ctx.ellipse(0, -2, 26, 9, 0, Math.PI, 0);
  ctx.fill();
  const rise = armed ? 1 : Math.min(1, p.age / Math.max(0.01, p.armTime)) * 0.35;
  ctx.save();
  ctx.translate(0, -rise * 16);
  const g = ctx.createRadialGradient(-6, -16, 3, 0, -12, 24);
  g.addColorStop(0, '#c99a5f');
  g.addColorStop(1, '#8b6231');
  ellipse(ctx, 0, -14, 22, 15, g);
  ctx.strokeStyle = 'rgba(70,45,18,0.45)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = 'rgba(80,52,20,0.5)';
    ctx.beginPath();
    ctx.arc(-14 + i * 8, -20 + (i % 2) * 8, 1.7, 0, Math.PI * 2);
    ctx.fill();
  }
  if (armed) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 7);
    ctx.fillStyle = `rgba(255,70,50,${0.45 + pulse * 0.55})`;
    ctx.beginPath();
    ctx.arc(0, -30, 3.6 + pulse, 0, Math.PI * 2);
    ctx.fill();
    eye(ctx, -7, -15, 4, 1);
    eye(ctx, 7, -15, 4, 1);
    ctx.strokeStyle = '#4d3110';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -8, 5, 1.05 * Math.PI, 1.95 * Math.PI);
    ctx.stroke();
  } else {
    eye(ctx, -6, -14, 3.4, 1, Math.sin(t * 3) > 0);
    eye(ctx, 6, -14, 3.4, 1, Math.sin(t * 3) > 0);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = 'bold 11px Tahoma, sans-serif';
    ctx.textAlign = 'center';
    const left = Math.max(0, Math.ceil(p.armTime - p.age));
    ctx.fillText(String(left), 0, -34);
  }
  ctx.restore();
}

function drawChomper(ctx, t, p) {
  shadow(ctx, 25, 8);
  const chewing = p.chewTimer > 0;
  const open = chewing ? 0 : 0.5 + 0.5 * Math.sin(t * 2 + p.seed);
  ctx.save();
  ctx.rotate(Math.sin(t * 1.3 + p.seed) * 0.05);
  stem(ctx, 34, '#5aa03a');
  leaf(ctx, -3, -12, 15, -1, -0.3);
  leaf(ctx, 3, -20, 13, 1, 0.3);
  ctx.translate(2, -46);
  const bodyG = ctx.createRadialGradient(-6, -6, 3, 0, 0, 24);
  bodyG.addColorStop(0, '#b768d6');
  bodyG.addColorStop(1, '#7a2f99');
  // فک پایین
  ctx.save();
  ctx.rotate(open * 0.32);
  ctx.fillStyle = '#6b2789';
  roundRect(ctx, -16, -2, 34, 18, 9);
  ctx.fill();
  ctx.fillStyle = '#fff2f8';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-8 + i * 8, 0);
    ctx.lineTo(-4 + i * 8, -7);
    ctx.lineTo(0 + i * 8, 0);
    ctx.fill();
  }
  ctx.restore();
  // فک بالا
  ctx.save();
  ctx.rotate(-open * 0.45);
  ctx.fillStyle = bodyG;
  ctx.beginPath();
  ctx.moveTo(-18, 2);
  ctx.bezierCurveTo(-22, -22, -4, -32, 12, -26);
  ctx.bezierCurveTo(24, -21, 22, -4, 18, 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff2f8';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-8 + i * 8, 1);
    ctx.lineTo(-4 + i * 8, 8);
    ctx.lineTo(0 + i * 8, 1);
    ctx.fill();
  }
  eye(ctx, 2, -18, 4.2, 1, chewing);
  ctx.restore();
  if (chewing) {
    ctx.fillStyle = 'rgba(120,45,150,0.9)';
    const bulge = 3 + Math.sin(t * 9) * 2;
    ctx.beginPath();
    ctx.ellipse(-4, 6, 10 + bulge, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCherryBomb(ctx, t, p) {
  shadow(ctx, 26, 8);
  const pulse = 1 + Math.sin(t * 18) * 0.06 * (p.fuseTimer < 0.6 ? 2 : 1);
  ctx.save();
  ctx.scale(pulse, pulse);
  ctx.strokeStyle = '#3f7a2a';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-10, -30);
  ctx.quadraticCurveTo(0, -56, 10, -30);
  ctx.stroke();
  const mk = (cx, cy, r) => {
    const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
    g.addColorStop(0, '#ff6b6b');
    g.addColorStop(0.6, '#e02020');
    g.addColorStop(1, '#9c0d18');
    ellipse(ctx, cx, cy, r, r, g);
    eye(ctx, cx - r * 0.3, cy - r * 0.15, r * 0.24, 1);
    eye(ctx, cx + r * 0.32, cy - r * 0.15, r * 0.24, 1);
    ctx.strokeStyle = '#6d0a12';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.2, r * 0.36, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
  };
  mk(-13, -20, 17);
  mk(14, -22, 17);
  ctx.restore();
}

function drawJalapeno(ctx, t, p) {
  shadow(ctx, 24, 7);
  const pulse = 1 + Math.sin(t * 16) * 0.05;
  ctx.save();
  ctx.scale(pulse, pulse);
  ctx.translate(0, -26);
  ctx.rotate(-0.12);
  const g = ctx.createLinearGradient(-18, -20, 18, 20);
  g.addColorStop(0, '#ff5a3c');
  g.addColorStop(1, '#b81212');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-16, -20);
  ctx.bezierCurveTo(14, -26, 22, 2, 6, 22);
  ctx.bezierCurveTo(-6, 30, -22, 8, -16, -20);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.ellipse(-7, -6, 4, 12, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3f7a2a';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-14, -20);
  ctx.quadraticCurveTo(-8, -34, 2, -32);
  ctx.stroke();
  eye(ctx, -6, -8, 4, 1);
  eye(ctx, 6, -6, 4, 1);
  ctx.strokeStyle = '#6d0a12';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 4, 6, 1.1 * Math.PI, 1.9 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

const PLANT_PAINTERS = {
  sunflower: drawSunflower,
  peashooter: (ctx, t, p) =>
    drawPeashooterLike(ctx, t, p, { colorA: '#8ede63', colorB: '#3e8f2c', barrels: 1 }),
  snowpea: (ctx, t, p) =>
    drawPeashooterLike(ctx, t, p, { colorA: '#bff2ff', colorB: '#3aa7c9', barrels: 1, frost: true }),
  repeater: (ctx, t, p) =>
    drawPeashooterLike(ctx, t, p, { colorA: '#9ee86f', colorB: '#357f24', barrels: 2 }),
  wallnut: drawWallnut,
  potatomine: drawPotatoMine,
  chomper: drawChomper,
  cherrybomb: drawCherryBomb,
  jalapeno: drawJalapeno,
};

export function drawPlant(ctx, plant, t) {
  const painter = PLANT_PAINTERS[plant.type];
  if (!painter) return;
  ctx.save();
  ctx.translate(plant.x, plant.y + 26);
  if (plant.planting > 0) {
    const k = 1 - plant.planting;
    ctx.scale(0.6 + 0.4 * k, 0.5 + 0.5 * k + Math.sin(k * Math.PI) * 0.12);
  }
  painter(ctx, t, plant);
  if (plant.flash > 0) {
    ctx.globalAlpha = plant.flash * 0.55;
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.ellipse(0, -30, 30, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** آیکون کوچک گیاه برای کارت‌های بذر (بدون سایه و انیمیشن) */
export function drawPlantIcon(ctx, type, size) {
  const fake = { seed: 1.2, hp: 1, maxHp: 1, charge: 0, recoil: 0, chewTimer: 0, armed: true, age: 99, armTime: 1, fuseTimer: 9 };
  ctx.save();
  ctx.translate(size / 2, size * 0.86);
  const s = size / 96;
  ctx.scale(s, s);
  const painter = PLANT_PAINTERS[type];
  if (painter) painter(ctx, 0.6, fake);
  ctx.restore();
}

/* ------------------------------ زامبی‌ها ------------------------------ */

const SKIN = { a: '#9ec98a', b: '#6b9a58', dark: '#47703a' };

function zombieArm(ctx, phase, len = 30) {
  ctx.strokeStyle = SKIN.b;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  const bend = Math.sin(phase) * 3;
  ctx.quadraticCurveTo(-len * 0.55, bend - 2, -len, bend + 2);
  ctx.stroke();
  ctx.fillStyle = SKIN.a;
  ctx.beginPath();
  ctx.arc(-len - 3, bend + 2, 5.5, 0, Math.PI * 2);
  ctx.fill();
}

function zombieLeg(ctx, x, swing, color = '#3a4a6a') {
  ctx.save();
  ctx.translate(x, -24);
  ctx.rotate(swing);
  ctx.fillStyle = color;
  roundRect(ctx, -5, 0, 10, 24, 4);
  ctx.fill();
  ctx.fillStyle = '#2b2b33';
  roundRect(ctx, -8, 20, 15, 7, 3);
  ctx.fill();
  ctx.restore();
}

function coneHat(ctx) {
  const g = ctx.createLinearGradient(-14, -30, 14, 0);
  g.addColorStop(0, '#ff9a3c');
  g.addColorStop(1, '#d1561a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.lineTo(16, 2);
  ctx.lineTo(-16, 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  roundRect(ctx, -11, -12, 22, 5, 2);
  ctx.fill();
}

function bucketHat(ctx) {
  const g = ctx.createLinearGradient(-16, -26, 16, 0);
  g.addColorStop(0, '#d9dee6');
  g.addColorStop(0.45, '#9aa4b2');
  g.addColorStop(1, '#6d7787');
  ctx.fillStyle = g;
  roundRect(ctx, -16, -26, 32, 30, 4);
  ctx.fill();
  ctx.fillStyle = '#7d8795';
  roundRect(ctx, -18, -28, 36, 6, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-9, -22);
  ctx.lineTo(-9, 0);
  ctx.stroke();
}

function footballHelmet(ctx) {
  const g = ctx.createLinearGradient(-18, -26, 18, 4);
  g.addColorStop(0, '#e0483c');
  g.addColorStop(1, '#8d1a14');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, -8, 18, Math.PI, 0);
  ctx.lineTo(18, 2);
  ctx.lineTo(-18, 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#f2f2f2';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-17, -2);
  ctx.quadraticCurveTo(-24, 8, -12, 12);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-17, 4);
  ctx.lineTo(-11, 6);
  ctx.stroke();
}

export function drawZombie(ctx, z, t) {
  const cfg = z.cfg;
  const scale = cfg.id === 'gargantuar' ? 1.75 : 1;
  ctx.save();
  ctx.translate(z.x, z.y + 30);
  shadow(ctx, 22 * scale, 7 * scale, 0.25);
  ctx.scale(scale, scale);

  const speedFactor = z.eating ? 0 : 1;
  const phase = z.walkPhase;
  const bob = z.eating ? Math.sin(t * 9) * 1.5 : Math.abs(Math.sin(phase)) * 2.5;
  ctx.translate(0, -bob);
  const lean = z.eating ? -0.12 : Math.sin(phase) * 0.04;
  ctx.rotate(lean);

  // پاها
  zombieLeg(ctx, -6, Math.sin(phase) * 0.45 * speedFactor);
  zombieLeg(ctx, 7, Math.sin(phase + Math.PI) * 0.45 * speedFactor);

  // بدن
  const bg = ctx.createLinearGradient(-16, -60, 16, -24);
  bg.addColorStop(0, cfg.id === 'football' ? '#c94a3e' : '#59607a');
  bg.addColorStop(1, cfg.id === 'football' ? '#7d221c' : '#333a52');
  ctx.fillStyle = bg;
  roundRect(ctx, -15, -58, 30, 36, 8);
  ctx.fill();
  // لکه و پارگی لباس
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(4, -34, 6, 4, 0.4, 0, Math.PI * 2);
  ctx.fill();

  // دست‌ها
  ctx.save();
  ctx.translate(-10, -50);
  ctx.rotate(z.eating ? -0.45 + Math.sin(t * 12) * 0.1 : -0.1 + Math.sin(phase) * 0.12);
  zombieArm(ctx, phase, 28);
  ctx.restore();
  ctx.save();
  ctx.translate(-6, -46);
  ctx.rotate(z.eating ? -0.2 + Math.sin(t * 12 + 1) * 0.1 : 0.12 - Math.sin(phase) * 0.12);
  zombieArm(ctx, phase + 1, 24);
  ctx.restore();

  // سر
  ctx.save();
  ctx.translate(-2, -66);
  ctx.rotate(z.eating ? 0.16 + Math.sin(t * 12) * 0.07 : Math.sin(phase * 0.5) * 0.06);
  const hg = ctx.createRadialGradient(-5, -6, 3, 0, 0, 17);
  hg.addColorStop(0, SKIN.a);
  hg.addColorStop(1, SKIN.b);
  ellipse(ctx, 0, 0, 15, 16, hg);
  // موی پراکنده
  ctx.strokeStyle = '#33412a';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-4 + i * 4, -15);
    ctx.lineTo(-6 + i * 4, -22 - (i % 2) * 3);
    ctx.stroke();
  }
  // چشم‌ها
  eye(ctx, -7, -3, 4.2, -1);
  eye(ctx, 4, -3, 3.6, -1);
  // دهان
  ctx.fillStyle = '#2a1414';
  const openMouth = z.eating ? 4 + Math.abs(Math.sin(t * 12)) * 4 : 3;
  roundRect(ctx, -11, 5, 15, openMouth, 2);
  ctx.fill();
  ctx.fillStyle = '#f3f0e2';
  for (let i = 0; i < 3; i++) {
    roundRect(ctx, -10 + i * 5, 5, 3, 3, 1);
    ctx.fill();
  }
  // کلاه‌ها
  ctx.save();
  ctx.translate(0, -14);
  if (cfg.id === 'cone' && z.armor > 0) coneHat(ctx);
  else if (cfg.id === 'bucket' && z.armor > 0) bucketHat(ctx);
  else if (cfg.id === 'football' && z.armor > 0) footballHelmet(ctx);
  ctx.restore();
  ctx.restore();

  // پرچم
  if (cfg.id === 'flag') {
    ctx.save();
    ctx.translate(10, -52);
    ctx.strokeStyle = '#6b4a2a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(4, -46);
    ctx.stroke();
    const wave = Math.sin(t * 6) * 3;
    ctx.fillStyle = '#d33';
    ctx.beginPath();
    ctx.moveTo(4, -44);
    ctx.quadraticCurveTo(18, -40 + wave, 30, -44);
    ctx.lineTo(30, -28);
    ctx.quadraticCurveTo(18, -24 + wave, 4, -28);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // روزنامه
  if (cfg.id === 'newspaper' && z.armor > 0) {
    ctx.save();
    ctx.translate(-22, -48);
    ctx.rotate(-0.15);
    ctx.fillStyle = '#efe9d8';
    roundRect(ctx, -12, -14, 26, 28, 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,60,60,0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(-9, -10 + i * 4);
      ctx.lineTo(11, -10 + i * 4);
      ctx.stroke();
    }
    ctx.restore();
  }

  // چماق غول‌پیکر
  if (cfg.id === 'gargantuar') {
    ctx.save();
    ctx.translate(-16, -56);
    ctx.rotate(-0.5 + Math.sin(phase) * 0.15);
    ctx.fillStyle = '#7b5b33';
    roundRect(ctx, -6, -40, 12, 48, 5);
    ctx.fill();
    ctx.fillStyle = '#5d421f';
    ctx.beginPath();
    ctx.arc(0, -42, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // افکت یخ‌زدگی
  if (z.slowTimer > 0) {
    ctx.fillStyle = 'rgba(120,205,255,0.30)';
    roundRect(ctx, -20, -86, 40, 88, 12);
    ctx.fill();
  }
  if (z.flash > 0) {
    ctx.globalAlpha = Math.min(0.6, z.flash * 0.7);
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, -20, -86, 40, 88, 12);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/* ------------------------------- سایر ------------------------------- */

export function drawSun(ctx, s, t) {
  ctx.save();
  ctx.translate(s.x, s.y);
  const pulse = 1 + Math.sin(t * 3 + s.seed) * 0.05;
  ctx.scale(pulse, pulse);
  ctx.globalAlpha = s.alpha;
  ctx.rotate(t * 0.6 + s.seed);
  ctx.fillStyle = 'rgba(255,214,80,0.28)';
  for (let i = 0; i < 8; i++) {
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    ctx.moveTo(-5, -14);
    ctx.lineTo(0, -30);
    ctx.lineTo(5, -14);
    ctx.closePath();
    ctx.fill();
  }
  ctx.rotate(-(t * 0.6 + s.seed));
  const g = ctx.createRadialGradient(-4, -5, 2, 0, 0, 17);
  g.addColorStop(0, '#fff6bd');
  g.addColorStop(0.55, '#ffd83a');
  g.addColorStop(1, '#f0a416');
  ellipse(ctx, 0, 0, 16, 16, g);
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function drawPea(ctx, b) {
  ctx.save();
  ctx.translate(b.x, b.y);
  const g = ctx.createRadialGradient(-2, -2, 1, 0, 0, b.r);
  if (b.freeze) {
    g.addColorStop(0, '#e8fbff');
    g.addColorStop(1, '#42b6dd');
  } else {
    g.addColorStop(0, '#d6ff9e');
    g.addColorStop(1, '#4f9f2e');
  }
  ellipse(ctx, 0, 0, b.r, b.r, g);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.arc(-b.r * 0.35, -b.r * 0.35, b.r * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawMower(ctx, m, t) {
  ctx.save();
  ctx.translate(m.x, m.y + 20);
  shadow(ctx, 20, 6, 0.25);
  const g = ctx.createLinearGradient(0, -26, 0, 0);
  g.addColorStop(0, '#f24d3d');
  g.addColorStop(1, '#a51f18');
  ctx.fillStyle = g;
  roundRect(ctx, -20, -24, 38, 20, 6);
  ctx.fill();
  ctx.fillStyle = '#c9ccd4';
  roundRect(ctx, 6, -34, 6, 16, 3);
  ctx.fill();
  ctx.fillStyle = '#2c2c34';
  const spin = m.running ? t * 22 : 0;
  [-12, 8].forEach((wx) => {
    ctx.save();
    ctx.translate(wx, -4);
    ctx.rotate(spin);
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8b8f99';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(5, 0);
    ctx.stroke();
    ctx.restore();
  });
  ctx.fillStyle = '#b9bec9';
  roundRect(ctx, -24, -14, 8, 10, 2);
  ctx.fill();
  ctx.restore();
}

// تمام گرافیک بازی به‌صورت برداری روی Canvas کشیده می‌شود (بدون فایل تصویری)

import { CFG } from './config.js';

export const PLANT_SCALE = 0.78;
export const ZOMBIE_SCALE = 0.84;

/* ---------------------------- کمکی‌ها ---------------------------- */

export function ell(ctx, x, y, rx, ry, fill, stroke, lw = 2.5) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

export function rr(ctx, x, y, w, h, r, fill, stroke, lw = 2.5) {
  const rad = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

function shadow(ctx, rx = 26, ry = 8, a = 0.22) {
  ctx.beginPath();
  ctx.ellipse(0, 2, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(20,40,15,${a})`;
  ctx.fill();
}

function leaf(ctx, x, y, dir, s = 1, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot + dir * -0.35);
  ctx.scale(dir * s, s);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(14, -10, 26, -2);
  ctx.quadraticCurveTo(14, 8, 0, 0);
  ctx.fillStyle = '#54ad38';
  ctx.fill();
  ctx.strokeStyle = '#2f7521';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.restore();
}

function eyes(ctx, x, y, r = 3.4, color = '#241206', blink = false) {
  if (blink) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-x - r, y);
    ctx.lineTo(-x + r, y);
    ctx.moveTo(x - r, y);
    ctx.lineTo(x + r, y);
    ctx.stroke();
    return;
  }
  ell(ctx, -x, y, r, r * 1.2, color);
  ell(ctx, x, y, r, r * 1.2, color);
  ell(ctx, -x + r * 0.35, y - r * 0.45, r * 0.32, r * 0.32, 'rgba(255,255,255,.85)');
  ell(ctx, x + r * 0.35, y - r * 0.45, r * 0.32, r * 0.32, 'rgba(255,255,255,.85)');
}

/* ---------------------------- گیاهان ---------------------------- */

function stem(ctx, h = 30, w = 8) {
  ctx.strokeStyle = '#3d8f2c';
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.quadraticCurveTo(3, -h * 0.55, 0, -h);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.18)';
  ctx.lineWidth = w * 0.35;
  ctx.beginPath();
  ctx.moveTo(-1.5, -6);
  ctx.quadraticCurveTo(1.5, -h * 0.55, -1.5, -h + 4);
  ctx.stroke();
}

function artSunflower(ctx, t, o) {
  const bob = Math.sin(t * 2.1) * 0.07;
  shadow(ctx, 24, 7);
  stem(ctx, 32);
  leaf(ctx, -5, -14, -1, 0.95);
  leaf(ctx, 5, -24, 1, 0.85);
  ctx.save();
  ctx.translate(0, -50);
  ctx.rotate(bob);
  const g = ctx.createLinearGradient(0, -30, 0, 30);
  g.addColorStop(0, '#ffe066');
  g.addColorStop(1, '#f7b731');
  for (let i = 0; i < 14; i++) {
    ctx.save();
    ctx.rotate((i / 14) * Math.PI * 2 + Math.sin(t * 1.6 + i) * 0.03);
    ctx.beginPath();
    ctx.ellipse(0, -29, 8.5, 15, 0, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#d99a17';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
  const cg = ctx.createRadialGradient(-6, -6, 3, 0, 0, 22);
  cg.addColorStop(0, '#a36b32');
  cg.addColorStop(1, '#70431a');
  ell(ctx, 0, 0, 20, 20, cg, '#4a2c10', 3);
  ctx.fillStyle = 'rgba(40,22,6,.35)';
  for (let i = 0; i < 18; i++) {
    const a = i * 2.4;
    const rad = 3 + i * 0.85;
    if (rad > 15) break;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * rad, Math.sin(a) * rad, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  const happy = o.produceGlow > 0;
  eyes(ctx, 7.5, -3, 3.6, '#2b1a0c', Math.sin(t * 0.9) > 0.985);
  ctx.strokeStyle = '#2b1a0c';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 2, happy ? 9 : 7, 0.12 * Math.PI, 0.88 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

function shooterHead(ctx, t, o, palette) {
  const recoil = o.recoil || 0;
  ctx.save();
  ctx.translate(-recoil * 4, 0);
  const g = ctx.createRadialGradient(-6, -6, 2, 0, 0, 19);
  g.addColorStop(0, palette.light);
  g.addColorStop(1, palette.mid);
  ell(ctx, 0, 0, 18, 17, g, palette.dark, 2.6);
  // دهانه
  ctx.save();
  ctx.translate(12, -3);
  rr(ctx, 0, -9, 20, 18, 8, palette.mid, palette.dark, 2.6);
  ell(ctx, 19, 0, 5.5, 8, palette.dark);
  ell(ctx, 19, 0, 3.6, 5.6, '#20360f');
  ctx.restore();
  eyes(ctx, 6, -4, 3.2, '#22350f', Math.sin(t * 1.1 + 2) > 0.98);
  ctx.restore();
}

function artPeashooter(ctx, t, o) {
  shadow(ctx, 22, 7);
  const sway = Math.sin(t * 1.8) * 1.5;
  stem(ctx, 34);
  leaf(ctx, -5, -16, -1, 0.9);
  ctx.save();
  ctx.translate(sway, -50);
  shooterHead(ctx, t, o, { light: '#9ede6a', mid: '#5fb832', dark: '#2f7a1c' });
  ctx.restore();
}

function artRepeater(ctx, t, o) {
  shadow(ctx, 22, 7);
  const sway = Math.sin(t * 1.8) * 1.5;
  stem(ctx, 36);
  leaf(ctx, -5, -16, -1, 0.9);
  leaf(ctx, 5, -26, 1, 0.75);
  ctx.save();
  ctx.translate(sway, -52);
  ctx.save();
  ctx.translate(-2, 9);
  ctx.scale(0.82, 0.82);
  shooterHead(ctx, t + 0.4, o, { light: '#8ed45c', mid: '#4ea129', dark: '#2a6b18' });
  ctx.restore();
  shooterHead(ctx, t, o, { light: '#9ede6a', mid: '#5fb832', dark: '#2f7a1c' });
  ctx.restore();
}

function artSnowpea(ctx, t, o) {
  shadow(ctx, 22, 7);
  const sway = Math.sin(t * 1.8) * 1.5;
  stem(ctx, 34);
  leaf(ctx, -5, -16, -1, 0.9);
  ctx.save();
  ctx.translate(sway, -50);
  shooterHead(ctx, t, o, { light: '#cdf3ff', mid: '#6cc8e8', dark: '#2f7fa3' });
  // بلور یخ
  ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 3; i++) {
    const a = t * 1.4 + i * 2.1;
    const x = -4 + Math.cos(a) * 16;
    const y = -20 + Math.sin(a * 1.3) * 7;
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const ang = (k / 3) * Math.PI;
      ctx.moveTo(x - Math.cos(ang) * 3.4, y - Math.sin(ang) * 3.4);
      ctx.lineTo(x + Math.cos(ang) * 3.4, y + Math.sin(ang) * 3.4);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function artWallnut(ctx, t, o) {
  shadow(ctx, 25, 8);
  const hp = o.hp === undefined ? 1 : o.hp;
  const squash = 1 + Math.sin(t * 1.5) * 0.015;
  ctx.save();
  ctx.scale(1 / squash, squash);
  const g = ctx.createLinearGradient(-20, -60, 20, 0);
  g.addColorStop(0, hp > 0.66 ? '#e0a860' : hp > 0.33 ? '#cf9550' : '#b87f42');
  g.addColorStop(1, hp > 0.66 ? '#b47a3a' : hp > 0.33 ? '#a06a30' : '#8a5827');
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.bezierCurveTo(-30, -6, -28, -62, 0, -62);
  ctx.bezierCurveTo(28, -62, 30, -6, 0, -2);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#6d431a';
  ctx.lineWidth = 3;
  ctx.stroke();
  // بافت
  ctx.strokeStyle = 'rgba(109,67,26,.35)';
  ctx.lineWidth = 2;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 9, -8);
    ctx.quadraticCurveTo(i * 13, -34, i * 8, -57);
    ctx.stroke();
  }
  // ترک‌ها با آسیب
  if (hp <= 0.66) {
    ctx.strokeStyle = 'rgba(70,40,12,.8)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-16, -44);
    ctx.lineTo(-8, -34);
    ctx.lineTo(-13, -24);
    ctx.stroke();
  }
  if (hp <= 0.33) {
    ctx.strokeStyle = 'rgba(70,40,12,.85)';
    ctx.beginPath();
    ctx.moveTo(15, -50);
    ctx.lineTo(7, -40);
    ctx.lineTo(16, -30);
    ctx.lineTo(9, -18);
    ctx.stroke();
  }
  const worried = hp <= 0.5;
  eyes(ctx, 8, -38, 3.6, '#3d2208', Math.sin(t * 0.8) > 0.97);
  ctx.strokeStyle = '#3d2208';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (worried) ctx.arc(0, -22, 7, 1.15 * Math.PI, 1.85 * Math.PI);
  else ctx.arc(0, -28, 7, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

function artPotatomine(ctx, t, o) {
  shadow(ctx, 22, 7);
  // تپه خاک
  ctx.beginPath();
  ctx.ellipse(0, -3, 25, 9, 0, Math.PI, 0);
  ctx.fillStyle = '#6b4a2a';
  ctx.fill();
  ctx.strokeStyle = '#4a3119';
  ctx.lineWidth = 2;
  ctx.stroke();
  if (!o.armed) {
    ctx.strokeStyle = '#4aa32c';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.quadraticCurveTo(4, -14, 1, -20);
    ctx.stroke();
    leaf(ctx, 1, -20, 1, 0.42);
    leaf(ctx, 1, -18, -1, 0.35);
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.font = 'bold 11px Tahoma';
    ctx.textAlign = 'center';
    ctx.fillText(Math.ceil(o.armLeft || 0) + '', 0, -26);
  } else {
    const p = 1 + Math.sin(t * 6) * 0.03;
    ctx.save();
    ctx.scale(p, p);
    const g = ctx.createLinearGradient(-18, -34, 14, -4);
    g.addColorStop(0, '#d9b682');
    g.addColorStop(1, '#a87f4d');
    ell(ctx, 0, -20, 21, 16, g, '#6b4a21', 2.6);
    ctx.fillStyle = 'rgba(90,60,25,.55)';
    for (const p2 of [[-9, -26], [7, -16], [-4, -13], [11, -27]]) {
      ctx.beginPath();
      ctx.arc(p2[0], p2[1], 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
    eyes(ctx, 7, -23, 3.2, '#3d2208');
    ctx.strokeStyle = '#3d2208';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, -16, 5.5, 0.12 * Math.PI, 0.88 * Math.PI);
    ctx.stroke();
    const blink = (Math.sin(t * 9) + 1) / 2;
    ell(ctx, 0, -37, 4.2, 4.2, `rgba(255,${60 + blink * 60},40,${0.5 + blink * 0.5})`, '#7a2010', 1.6);
    ctx.restore();
  }
}

function artChomper(ctx, t, o) {
  shadow(ctx, 24, 8);
  const chew = o.state === 'chew';
  const bite = o.biteAnim || 0;
  stem(ctx, 26, 9);
  leaf(ctx, -7, -12, -1, 1.0);
  leaf(ctx, 7, -18, 1, 0.9);
  ctx.save();
  ctx.translate(0, -40);
  const lunge = bite > 0 ? Math.sin(bite * Math.PI) * 14 : 0;
  ctx.translate(-lunge, 0);
  const open = chew ? 0 : bite > 0 ? 0.1 : 0.55 + Math.sin(t * 2) * 0.06;
  const g = ctx.createLinearGradient(0, -22, 0, 18);
  g.addColorStop(0, '#b45fd6');
  g.addColorStop(1, '#7c2fa3');
  // فک پایین
  ctx.save();
  ctx.rotate(open * 0.45);
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.bezierCurveTo(4, 16, -22, 16, -24, 2);
  ctx.bezierCurveTo(-18, -4, 4, -2, 14, 0);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#4d1868';
  ctx.lineWidth = 2.6;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-18 + i * 9, 1);
    ctx.lineTo(-14 + i * 9, -6);
    ctx.lineTo(-10 + i * 9, 1);
    ctx.fill();
  }
  ctx.restore();
  // فک بالا
  ctx.save();
  ctx.rotate(-open * 0.6);
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.bezierCurveTo(6, -26, -24, -24, -26, -3);
  ctx.bezierCurveTo(-16, 2, 4, 3, 14, 0);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#4d1868';
  ctx.lineWidth = 2.6;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-20 + i * 9, -1);
    ctx.lineTo(-16 + i * 9, 6);
    ctx.lineTo(-12 + i * 9, -1);
    ctx.fill();
  }
  eyes(ctx, 5, -14, 3, '#2a0c3a');
  ctx.restore();
  if (chew) {
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.font = 'bold 10px Tahoma';
    ctx.textAlign = 'center';
    ctx.fillText('...', 0, -34);
  }
  ctx.restore();
}

function artCherrybomb(ctx, t, o) {
  shadow(ctx, 26, 8);
  const f = o.fuseRatio || 0;
  const pulse = 1 + Math.sin(t * (8 + f * 26)) * (0.04 + f * 0.1);
  ctx.save();
  ctx.scale(pulse, pulse);
  ctx.strokeStyle = '#3f8f2e';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-12, -26);
  ctx.quadraticCurveTo(-2, -46, 4, -40);
  ctx.moveTo(12, -26);
  ctx.quadraticCurveTo(6, -46, 4, -40);
  ctx.stroke();
  leaf(ctx, 4, -41, 1, 0.5, -0.5);
  for (const [cx, cy, r] of [[-13, -20, 16], [13, -22, 17]]) {
    const g = ctx.createRadialGradient(cx - 5, cy - 6, 2, cx, cy, r);
    g.addColorStop(0, `rgb(${240 + f * 15},${90 - f * 60},${90 - f * 60})`);
    g.addColorStop(1, '#a51427');
    ell(ctx, cx, cy, r, r, g, '#6d0b19', 2.6);
    ell(ctx, cx - r * 0.35, cy - r * 0.38, r * 0.25, r * 0.18, 'rgba(255,255,255,.55)');
  }
  ctx.strokeStyle = '#2a0409';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  // ابروهای عصبانی + چشم
  ctx.beginPath();
  ctx.moveTo(-20, -28);
  ctx.lineTo(-9, -24);
  ctx.moveTo(20, -30);
  ctx.lineTo(9, -26);
  ctx.stroke();
  ell(ctx, -15, -19, 3.2, 4, '#2a0409');
  ell(ctx, 14, -21, 3.2, 4, '#2a0409');
  ctx.restore();
  if (f > 0.5) {
    ctx.globalAlpha = (f - 0.5) * 1.6;
    ell(ctx, 0, -24, 40, 36, 'rgba(255,220,120,.5)');
    ctx.globalAlpha = 1;
  }
}

function artJalapeno(ctx, t, o) {
  shadow(ctx, 18, 6);
  const f = o.fuseRatio || 0;
  const pulse = 1 + Math.sin(t * (8 + f * 24)) * (0.03 + f * 0.09);
  ctx.save();
  ctx.scale(pulse, pulse);
  const g = ctx.createLinearGradient(-10, -50, 10, 0);
  g.addColorStop(0, '#ff6b35');
  g.addColorStop(1, '#c1121f');
  ctx.beginPath();
  ctx.moveTo(0, -46);
  ctx.bezierCurveTo(16, -44, 20, -16, 6, -3);
  ctx.bezierCurveTo(-4, 2, -18, -8, -14, -26);
  ctx.bezierCurveTo(-12, -40, -8, -46, 0, -46);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#7a0b14';
  ctx.lineWidth = 2.6;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.4)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-6, -38);
  ctx.quadraticCurveTo(-11, -24, -7, -12);
  ctx.stroke();
  ctx.strokeStyle = '#3f8f2e';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, -46);
  ctx.quadraticCurveTo(2, -56, 9, -58);
  ctx.stroke();
  leaf(ctx, 0, -48, -1, 0.4, 0.4);
  ctx.strokeStyle = '#2a0409';
  ctx.lineWidth = 2.3;
  ctx.beginPath();
  ctx.moveTo(-11, -34);
  ctx.lineTo(-3, -31);
  ctx.moveTo(10, -33);
  ctx.lineTo(3, -31);
  ctx.stroke();
  ell(ctx, -7, -26, 2.8, 3.4, '#2a0409');
  ell(ctx, 6, -26, 2.8, 3.4, '#2a0409');
  // شعله
  for (let i = 0; i < 4; i++) {
    const a = t * 7 + i * 1.7;
    const fy = -52 - ((a % 3) / 3) * 10;
    ctx.globalAlpha = 0.5 + f * 0.5;
    ell(ctx, Math.sin(a) * 6, fy, 3.5, 6, i % 2 ? '#ffb703' : '#fb5607');
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

const PLANT_ART = {
  sunflower: artSunflower,
  peashooter: artPeashooter,
  repeater: artRepeater,
  snowpea: artSnowpea,
  wallnut: artWallnut,
  potatomine: artPotatomine,
  chomper: artChomper,
  cherrybomb: artCherrybomb,
  jalapeno: artJalapeno,
};

export function drawPlantArt(ctx, id, t, o = {}) {
  const fn = PLANT_ART[id];
  if (!fn) return;
  ctx.save();
  ctx.scale(o.scale || PLANT_SCALE, o.scale || PLANT_SCALE);
  ctx.lineJoin = 'round';
  fn(ctx, t, o);
  ctx.restore();
}

/* ---------------------------- زامبی‌ها ---------------------------- */

const SKIN = '#9fb98a';
const SKIN_D = '#6f8a5c';

function zLeg(ctx, x, swing, pants) {
  ctx.save();
  ctx.translate(x, -36);
  ctx.rotate(swing * 0.02);
  rr(ctx, -6, 0, 12, 24, 5, pants, '#2c2c3a', 2);
  ctx.translate(0, 24);
  ctx.rotate(-swing * 0.012);
  rr(ctx, -6, 0, 12, 14, 4, '#3b3b4a', '#23232e', 2);
  rr(ctx, -10, 9, 17, 7, 3.5, '#2e2e3a', '#1b1b24', 2);
  ctx.restore();
}

function zArm(ctx, sx, sy, angle, len, sleeve, rotten) {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(angle);
  rr(ctx, -len, -6, len, 12, 6, sleeve, '#2c2c3a', 2);
  ell(ctx, -len - 2, 0, 7.5, 7, rotten ? '#8aa877' : SKIN, SKIN_D, 2);
  ctx.restore();
}

function zHead(ctx, t, o, opts = {}) {
  ctx.save();
  ctx.translate(opts.dx || 0, 0);
  ctx.rotate(opts.rot || 0);
  const g = ctx.createRadialGradient(-5, -6, 3, 0, 0, 18);
  g.addColorStop(0, '#b6cfa1');
  g.addColorStop(1, SKIN);
  ell(ctx, 0, 0, 16, 17, g, SKIN_D, 2.6);
  // مو
  ctx.strokeStyle = '#4a3f33';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-8 + i * 5, -14);
    ctx.quadraticCurveTo(-10 + i * 5, -22, -5 + i * 5, -24 + (i % 2) * 3);
    ctx.stroke();
  }
  // چشم‌های گودافتاده
  ell(ctx, -8, -4, 5.2, 5.6, '#586a48');
  ell(ctx, 4, -5, 5, 5.4, '#586a48');
  const look = o.state === 'eat' ? 0.8 : 0;
  ell(ctx, -8.6 - look, -4, 2.3, 2.6, '#f2f2e4');
  ell(ctx, 3.4 - look, -5, 2.2, 2.5, '#f2f2e4');
  ell(ctx, -9 - look, -4, 1.1, 1.3, '#1a1a12');
  ell(ctx, 3 - look, -5, 1.1, 1.3, '#1a1a12');
  // دهان
  const chomp = o.state === 'eat' ? Math.abs(Math.sin(t * 9)) * 5 : 1.5;
  ctx.beginPath();
  ctx.ellipse(-3, 8, 8, 2.5 + chomp, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#3a1f1f';
  ctx.fill();
  ctx.strokeStyle = SKIN_D;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.fillStyle = '#f5f3e0';
  ctx.beginPath();
  ctx.moveTo(-8, 6.5);
  ctx.lineTo(-5, 6.5);
  ctx.lineTo(-6.5, 10);
  ctx.fill();
  // گوش
  ell(ctx, 14, 0, 4, 5.5, SKIN, SKIN_D, 1.8);
  ctx.restore();
}

function zBody(ctx, shirt, shirtDark) {
  ctx.beginPath();
  ctx.moveTo(-13, -34);
  ctx.lineTo(13, -34);
  ctx.lineTo(16, -66);
  ctx.lineTo(-16, -66);
  ctx.closePath();
  ctx.fillStyle = shirt;
  ctx.fill();
  ctx.strokeStyle = shirtDark;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  // پارگی لباس
  ctx.fillStyle = shirtDark;
  ctx.beginPath();
  ctx.moveTo(-13, -34);
  ctx.lineTo(-8, -40);
  ctx.lineTo(-3, -34);
  ctx.lineTo(2, -41);
  ctx.lineTo(7, -34);
  ctx.closePath();
  ctx.fill();
  // یقه
  ctx.beginPath();
  ctx.moveTo(-7, -66);
  ctx.lineTo(0, -58);
  ctx.lineTo(7, -66);
  ctx.fillStyle = SKIN;
  ctx.fill();
}

function zombieCommon(ctx, t, o, style) {
  const walk = o.state !== 'eat';
  const ph = o.phase || 0;
  const p = walk ? t * 4.2 * (o.speedFactor || 1) + ph : t * 2 + ph;
  const bob = walk ? Math.abs(Math.sin(p)) * 2.6 : Math.sin(p * 3) * 1.2;
  shadow(ctx, 22, 7, 0.25);
  ctx.save();
  ctx.translate(0, -bob);
  ctx.rotate(Math.sin(p * 0.5) * 0.03 - 0.05);

  zLeg(ctx, 7, Math.sin(p + Math.PI) * 18, style.pants);
  zArm(ctx, 10, -60, 2.5 + Math.sin(p) * 0.08, 30, style.shirtDark, true);
  zLeg(ctx, -4, Math.sin(p) * 18, style.pants);
  zBody(ctx, style.shirt, style.shirtDark);

  ctx.save();
  ctx.translate(0, -80);
  const eatLunge = o.state === 'eat' ? Math.abs(Math.sin(t * 9)) * 4 : 0;
  zHead(ctx, t, o, { dx: -eatLunge, rot: Math.sin(p * 0.5) * 0.04 });
  if (style.hat) style.hat(ctx, t, o);
  ctx.restore();

  // بازوی جلویی
  const armAng = o.state === 'eat' ? 3.05 + Math.sin(t * 9) * 0.12 : 3.05 + Math.sin(p) * 0.1;
  zArm(ctx, -8, -62, armAng, 32, style.shirt, true);
  if (style.front) style.front(ctx, t, o);
  ctx.restore();
}

function hatCone(ctx, t, o) {
  const worn = o.shieldRatio === undefined ? 1 : o.shieldRatio;
  ctx.save();
  ctx.translate(-1, -14);
  ctx.rotate(-0.08 + (1 - worn) * 0.25);
  ctx.beginPath();
  ctx.moveTo(0, -26 - worn * 4);
  ctx.lineTo(13, 4);
  ctx.lineTo(-13, 4);
  ctx.closePath();
  const g = ctx.createLinearGradient(-13, 0, 13, 0);
  g.addColorStop(0, '#f77f00');
  g.addColorStop(1, '#d35400');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#8f3b00';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.8)';
  ctx.fillRect(-9, -8, 18, 5);
  if (worn < 0.6) {
    ctx.strokeStyle = 'rgba(80,30,0,.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, 2);
    ctx.lineTo(-2, -8);
    ctx.lineTo(-7, -14);
    ctx.stroke();
  }
  ctx.restore();
}

function hatBucket(ctx, t, o) {
  const worn = o.shieldRatio === undefined ? 1 : o.shieldRatio;
  ctx.save();
  ctx.translate(-1, -12);
  ctx.rotate(-0.06 + (1 - worn) * 0.2);
  const g = ctx.createLinearGradient(-16, 0, 16, 0);
  g.addColorStop(0, '#d7dbe0');
  g.addColorStop(0.5, '#9aa2ac');
  g.addColorStop(1, '#6f7680');
  ctx.beginPath();
  ctx.moveTo(-15, 4);
  ctx.lineTo(-12, -22);
  ctx.lineTo(12, -22);
  ctx.lineTo(15, 4);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#4e545c';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  rr(ctx, -14, -25, 28, 6, 3, '#b9c0c8', '#4e545c', 2);
  if (worn < 0.66) {
    ctx.strokeStyle = 'rgba(50,55,60,.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, 2);
    ctx.lineTo(-3, -10);
    ctx.lineTo(-9, -18);
    ctx.stroke();
  }
  if (worn < 0.33) {
    ctx.beginPath();
    ctx.moveTo(9, 2);
    ctx.lineTo(4, -8);
    ctx.lineTo(10, -16);
    ctx.stroke();
  }
  ctx.restore();
}

function hatHelmet(ctx, t, o) {
  ctx.save();
  ctx.translate(-1, -8);
  const g = ctx.createLinearGradient(0, -22, 0, 4);
  g.addColorStop(0, '#e63946');
  g.addColorStop(1, '#9d1c26');
  ctx.beginPath();
  ctx.ellipse(0, -6, 19, 17, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#6b0f16';
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.strokeStyle = '#f1faee';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -23);
  ctx.lineTo(0, -6);
  ctx.stroke();
  // محافظ صورت
  ctx.strokeStyle = '#d9d9d9';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-17, -6);
  ctx.quadraticCurveTo(-26, 4, -16, 10);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-20, 1);
  ctx.lineTo(-13, 1);
  ctx.stroke();
  ctx.restore();
}

function frontNewspaper(ctx, t, o) {
  if (o.shieldRatio !== undefined && o.shieldRatio <= 0) return;
  ctx.save();
  ctx.translate(-26, -56);
  ctx.rotate(-0.12);
  rr(ctx, -16, -16, 34, 34, 2, '#efe9d8', '#8d8877', 2);
  ctx.strokeStyle = '#8d8877';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(-12, -9 + i * 5);
    ctx.lineTo(13, -9 + i * 5);
    ctx.stroke();
  }
  ctx.fillStyle = '#5b5648';
  ctx.fillRect(-12, -14, 24, 3.5);
  ctx.restore();
}

function frontFlag(ctx, t, o) {
  ctx.save();
  ctx.translate(-36, -58);
  ctx.rotate(0.15);
  ctx.strokeStyle = '#8a6a3a';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 14);
  ctx.lineTo(0, -44);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -44);
  for (let i = 0; i <= 6; i++) {
    const px = (i / 6) * -34;
    const py = -44 + 14 * (i / 6) + Math.sin(t * 7 + i * 0.8) * 3;
    ctx.lineTo(px, py);
  }
  for (let i = 6; i >= 0; i--) {
    const px = (i / 6) * -34;
    const py = -22 + 4 * (i / 6) + Math.sin(t * 7 + i * 0.8) * 3;
    ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = '#c1121f';
  ctx.fill();
  ctx.strokeStyle = '#7a0b14';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = '#f1faee';
  ctx.font = 'bold 9px Tahoma';
  ctx.textAlign = 'center';
  ctx.fillText('BRAINS', -17, -30);
  ctx.restore();
}

function frontShoulderPads(ctx) {
  rr(ctx, -20, -70, 40, 13, 6, '#e63946', '#6b0f16', 2.2);
  ctx.fillStyle = '#f1faee';
  ctx.font = 'bold 11px Tahoma';
  ctx.textAlign = 'center';
  ctx.fillText('0', 0, -47);
}

const ZOMBIE_STYLE = {
  basic: { shirt: '#6b6f9e', shirtDark: '#4a4d73', pants: '#3f4460' },
  flag: { shirt: '#7a6f9e', shirtDark: '#524a73', pants: '#3f4460', front: frontFlag },
  cone: { shirt: '#6b6f9e', shirtDark: '#4a4d73', pants: '#3f4460', hat: hatCone },
  news: { shirt: '#8a7f6a', shirtDark: '#645b4b', pants: '#4a4438', front: frontNewspaper },
  bucket: { shirt: '#6b6f9e', shirtDark: '#4a4d73', pants: '#3f4460', hat: hatBucket },
  football: {
    shirt: '#e63946',
    shirtDark: '#9d1c26',
    pants: '#f1faee',
    hat: hatHelmet,
    front: (ctx) => frontShoulderPads(ctx),
  },
};

export function drawZombieArt(ctx, type, t, o = {}) {
  const style = ZOMBIE_STYLE[type] || ZOMBIE_STYLE.basic;
  ctx.save();
  ctx.scale(o.scale || ZOMBIE_SCALE, o.scale || ZOMBIE_SCALE);
  ctx.lineJoin = 'round';
  zombieCommon(ctx, t, o, style);
  ctx.restore();
}

/* ------------------------- اشیای دیگر ------------------------- */

export function drawSunOrb(ctx, t, r = 22) {
  ctx.save();
  const g = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
  g.addColorStop(0, '#fff7c2');
  g.addColorStop(0.6, '#ffd43b');
  g.addColorStop(1, '#f59f00');
  ctx.save();
  ctx.rotate(t * 0.9);
  ctx.fillStyle = 'rgba(255,212,59,.45)';
  for (let i = 0; i < 8; i++) {
    ctx.save();
    ctx.rotate((i / 8) * Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(-4, -r * 0.9);
    ctx.lineTo(0, -r * 1.5);
    ctx.lineTo(4, -r * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  ell(ctx, 0, 0, r, r, g, 'rgba(245,159,0,.8)', 2);
  ell(ctx, -r * 0.3, -r * 0.35, r * 0.24, r * 0.18, 'rgba(255,255,255,.8)');
  ctx.restore();
}

export function drawPea(ctx, t, frost) {
  const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, 9);
  if (frost) {
    g.addColorStop(0, '#e8fbff');
    g.addColorStop(1, '#63c4e6');
  } else {
    g.addColorStop(0, '#d8f7a3');
    g.addColorStop(1, '#6cbf35');
  }
  ell(ctx, 0, 0, 9, 9, g, frost ? '#2f7fa3' : '#3d8f24', 2);
  ell(ctx, -3, -3.5, 2.6, 2, 'rgba(255,255,255,.8)');
}

export function drawMower(ctx, t, moving) {
  ctx.save();
  shadow(ctx, 22, 6);
  rr(ctx, -20, -26, 40, 20, 6, '#c92a2a', '#7a1414', 2.4);
  rr(ctx, -22, -32, 20, 10, 4, '#e03131', '#7a1414', 2.2);
  // تیغه‌ها
  ctx.save();
  ctx.translate(16, -12);
  ctx.rotate(moving ? t * 22 : t * 1.2);
  ctx.strokeStyle = '#adb5bd';
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.rotate((i / 3) * Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -9);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  // چرخ‌ها
  for (const wx of [-13, 12]) {
    ell(ctx, wx, -5, 7.5, 7.5, '#343a40', '#16181b', 2);
    ctx.save();
    ctx.translate(wx, -5);
    ctx.rotate(moving ? t * 16 : 0);
    ctx.strokeStyle = '#868e96';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(5, 0);
    ctx.moveTo(0, -5);
    ctx.lineTo(0, 5);
    ctx.stroke();
    ctx.restore();
  }
  // دسته
  ctx.strokeStyle = '#495057';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-14, -24);
  ctx.quadraticCurveTo(-28, -30, -26, -44);
  ctx.stroke();
  ctx.restore();
}

export function drawTombstone(ctx) {
  ctx.save();
  shadow(ctx, 20, 6, 0.3);
  ctx.beginPath();
  ctx.moveTo(-16, 0);
  ctx.lineTo(-16, -26);
  ctx.quadraticCurveTo(0, -44, 16, -26);
  ctx.lineTo(16, 0);
  ctx.closePath();
  ctx.fillStyle = '#6a6f78';
  ctx.fill();
  ctx.strokeStyle = '#41454c';
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.strokeStyle = '#41454c';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(0, -32);
  ctx.lineTo(0, -14);
  ctx.moveTo(-7, -25);
  ctx.lineTo(7, -25);
  ctx.stroke();
  ctx.restore();
}

/* ------------------------ پس‌زمینه ------------------------ */

function grassTuft(ctx, x, y, s, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6 * s;
  ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * 3 * s, y);
    ctx.quadraticCurveTo(x + i * 5 * s, y - 5 * s, x + i * 7 * s, y - 8 * s);
    ctx.stroke();
  }
}

function mulberry(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildBackground(theme) {
  const cv = document.createElement('canvas');
  cv.width = CFG.W;
  cv.height = CFG.H;
  const ctx = cv.getContext('2d');
  const night = theme === 'night';
  const rand = mulberry(7717);

  // آسمان / پس‌زمینه بالا
  const sky = ctx.createLinearGradient(0, 0, 0, CFG.GRID_Y + 20);
  if (night) {
    sky.addColorStop(0, '#16213e');
    sky.addColorStop(1, '#1f2f4a');
  } else {
    sky.addColorStop(0, '#8fd3f4');
    sky.addColorStop(1, '#bfe6a8');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CFG.W, CFG.GRID_Y + 16);

  if (night) {
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < 40; i++) {
      const x = rand() * CFG.W;
      const y = rand() * (CFG.GRID_Y - 10);
      ctx.globalAlpha = 0.3 + rand() * 0.7;
      ctx.beginPath();
      ctx.arc(x, y, rand() * 1.3 + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // ماه
    ctx.fillStyle = '#f5f3ce';
    ctx.beginPath();
    ctx.arc(830, 34, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(22,33,62,1)';
    ctx.beginPath();
    ctx.arc(820, 28, 19, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    for (const [cx, cy, s] of [[420, 26, 1], [620, 16, 0.7], [880, 32, 0.85]]) {
      ctx.beginPath();
      ctx.arc(cx, cy, 16 * s, 0, Math.PI * 2);
      ctx.arc(cx + 18 * s, cy + 4 * s, 12 * s, 0, Math.PI * 2);
      ctx.arc(cx - 18 * s, cy + 5 * s, 11 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // چمن
  const g1 = night ? '#2f5a34' : '#6ab150';
  const g2 = night ? '#27502c' : '#5ca446';
  for (let r = 0; r < CFG.ROWS; r++) {
    ctx.fillStyle = r % 2 === 0 ? g1 : g2;
    ctx.fillRect(0, CFG.GRID_Y + r * CFG.CELL_H, CFG.W, CFG.CELL_H);
  }
  // نوار بالا و پایین چمن
  ctx.fillStyle = night ? '#24472a' : '#4f9440';
  ctx.fillRect(0, CFG.GRID_B, CFG.W, CFG.H - CFG.GRID_B);

  // بافت چمن
  const tuft = night ? 'rgba(160,220,160,.12)' : 'rgba(255,255,255,.16)';
  for (let i = 0; i < 420; i++) {
    const x = rand() * CFG.W;
    const y = CFG.GRID_Y + rand() * (CFG.H - CFG.GRID_Y);
    grassTuft(ctx, x, y, 0.5 + rand() * 0.6, tuft);
  }

  // خطوط شبکه ظریف
  ctx.strokeStyle = night ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.09)';
  ctx.lineWidth = 1;
  for (let c = 0; c <= CFG.COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(CFG.GRID_X + c * CFG.CELL_W, CFG.GRID_Y);
    ctx.lineTo(CFG.GRID_X + c * CFG.CELL_W, CFG.GRID_B);
    ctx.stroke();
  }
  for (let r = 0; r <= CFG.ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(CFG.GRID_X, CFG.GRID_Y + r * CFG.CELL_H);
    ctx.lineTo(CFG.GRID_R, CFG.GRID_Y + r * CFG.CELL_H);
    ctx.stroke();
  }

  // پرچین پشتی
  ctx.fillStyle = night ? '#1b3a22' : '#3f7d33';
  ctx.beginPath();
  for (let x = -10; x < CFG.W + 20; x += 26) {
    ctx.moveTo(x, CFG.GRID_Y + 10);
    ctx.arc(x, CFG.GRID_Y + 6, 17, Math.PI, 0);
  }
  ctx.fill();
  ctx.fillStyle = night ? '#24502c' : '#4c9a3d';
  ctx.beginPath();
  for (let x = 0; x < CFG.W + 20; x += 26) {
    ctx.arc(x, CFG.GRID_Y + 2, 12, Math.PI, 0);
  }
  ctx.fill();

  // خانه سمت چپ
  const hx = 0;
  const hw = 92;
  ctx.fillStyle = night ? '#6b5540' : '#c9a26a';
  ctx.fillRect(hx, CFG.GRID_Y - 20, hw, CFG.H - CFG.GRID_Y + 20);
  ctx.fillStyle = night ? '#5a4736' : '#b9915c';
  for (let y = CFG.GRID_Y - 20; y < CFG.H; y += 22) {
    ctx.fillRect(hx, y, hw, 2);
  }
  // سقف
  ctx.fillStyle = night ? '#4a2f24' : '#8c4a32';
  ctx.beginPath();
  ctx.moveTo(-6, CFG.GRID_Y - 18);
  ctx.lineTo(hw + 16, CFG.GRID_Y - 18);
  ctx.lineTo(hw + 4, CFG.GRID_Y - 40);
  ctx.lineTo(-6, CFG.GRID_Y - 40);
  ctx.closePath();
  ctx.fill();
  // در
  ctx.fillStyle = night ? '#3c2a1c' : '#7a4a22';
  rr(ctx, 16, 300, 50, 120, 6, night ? '#3c2a1c' : '#7a4a22', '#4a2c10', 3);
  ctx.fillStyle = '#ffd43b';
  ctx.beginPath();
  ctx.arc(58, 362, 4, 0, Math.PI * 2);
  ctx.fill();
  // پنجره
  rr(ctx, 16, 130, 56, 52, 5, night ? '#f2c14e' : '#bfe6f5', '#4a2c10', 3);
  ctx.strokeStyle = '#4a2c10';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(44, 130);
  ctx.lineTo(44, 182);
  ctx.moveTo(16, 156);
  ctx.lineTo(72, 156);
  ctx.stroke();

  // نوار خاکی محل چمن‌زن
  ctx.fillStyle = night ? '#3d3020' : '#6d5334';
  ctx.fillRect(hw, CFG.GRID_Y, CFG.GRID_X - hw, CFG.LAWN_H);
  ctx.fillStyle = 'rgba(0,0,0,.12)';
  ctx.fillRect(hw, CFG.GRID_Y, 6, CFG.LAWN_H);

  if (night) {
    ctx.fillStyle = 'rgba(10,15,40,.28)';
    ctx.fillRect(0, 0, CFG.W, CFG.H);
  }

  // سایه لبه‌ها
  const vg = ctx.createLinearGradient(CFG.W - 90, 0, CFG.W, 0);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,.22)');
  ctx.fillStyle = vg;
  ctx.fillRect(CFG.W - 90, 0, 90, CFG.H);

  return cv;
}

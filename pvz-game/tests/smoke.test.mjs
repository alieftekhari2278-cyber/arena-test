// تست دود: اجرای کامل منطق و رندر بازی بدون مرورگر
// اجرا:  node pvz-game/tests/smoke.test.mjs
import { installStubs, makeCanvas } from './_stub-dom.mjs';
installStubs();

const { Game } = await import('../js/game.js');
const { LEVELS, SURVIVAL, CFG } = await import('../js/config.js');

let failures = 0;
function check(name, cond) {
  if (!cond) {
    failures++;
    console.log('  ✗ ' + name);
  } else console.log('  ✓ ' + name);
}

for (const level of [...LEVELS, SURVIVAL]) {
  console.log(`\n▶ ${level.name}`);
  const g = new Game(makeCanvas());
  let ended = null;
  g.on.end = (r, s, w) => (ended = { r, s, w });
  g.on.hud = () => {};
  // جلوگیری از اجرای حلقه‌ی واقعی
  g.loop = () => {};
  const seeds = level.plants.slice(0, level.slots);
  g.start(level, seeds);
  check('شروع شد', g.state === 'playing');

  // شبیه‌سازی: هر ثانیه سعی کن گیاه بکاری و آفتاب‌ها را جمع کن
  const dt = 1 / 60;
  let simulated = 0;
  const maxSec = level.endless ? 240 : 900;
  let planted = 0;
  while (simulated < maxSec && !ended) {
    g.update(dt);
    simulated += dt;
    // جمع کردن آفتاب‌ها
    for (const s of [...g.suns]) {
      if (!s.collecting) {
        g.sun += s.value;
        s.dead = true;
      }
    }
    // کاشت تصادفی
    if (Math.random() < dt * 4) {
      const i = Math.floor(Math.random() * g.seeds.length);
      const c = Math.floor(Math.random() * CFG.COLS);
      const r = Math.floor(Math.random() * CFG.ROWS);
      const before = g.plants.length;
      g.tryPlant(i, c, r);
      if (g.plants.length > before) planted++;
    }
    // رندر هر ۲۰ فریم برای کشف خطای گرافیکی
    if (Math.floor(simulated * 60) % 20 === 0) {
      g.mouse = { x: 400, y: 300, inside: true };
      g.selected = 0;
      g.render();
      g.selected = -1;
    }
  }
  check('گیاه کاشته شد (' + planted + ')', planted > 3);
  check('موج‌ها اجرا شدند (موج ' + g.waveIndex + ')', g.waveIndex > 0);
  check('زامبی کشته شد (' + g.stats.killed + ')', g.stats.killed > 0);
  if (!level.endless) {
    check('بازی تمام شد: ' + (ended ? ended.r : 'هیچ'), !!ended);
  } else {
    check('بقا پایدار ماند', g.waveIndex >= 3);
  }
}

// تست منطق خاص
console.log('\n▶ بررسی‌های موردی');
{
  const g = new Game(makeCanvas());
  g.on.hud = () => {};
  g.loop = () => {};
  g.start(LEVELS[0], ['sunflower', 'peashooter', 'wallnut', 'potatomine', 'cherrybomb']);
  g.sun = 1000;
  g.tryPlant(0, 0, 0);
  check('گیاه در شبکه ثبت شد', !!g.grid[0][0]);
  const cost = g.seeds[0].def.cost;
  check('آفتاب کم شد', g.sun === 1000 - cost);
  const before = g.sun;
  g.tryPlant(0, 0, 0);
  check('کاشت روی خانه اشغال رد شد', g.sun === before);
  check('بسته در حالت خنک‌شدن است', !g.seeds[0].ready);

  // چمن‌زن
  const { Zombie } = await import('../js/entities.js');
  const z = new Zombie('basic', 2);
  z.x = CFG.GRID_X + 2;
  g.zombies.push(z);
  g.update(1 / 60);
  check('چمن‌زن فعال شد', g.mowers[2].running === true);
  for (let i = 0; i < 200; i++) g.update(1 / 60);
  check('چمن‌زن زامبی را نابود کرد', g.zombies.indexOf(z) === -1);

  // باخت
  const g2 = new Game(makeCanvas());
  g2.on.hud = () => {};
  g2.loop = () => {};
  let lost = false;
  g2.on.end = (r) => (lost = r === 'lose');
  g2.start(LEVELS[0], ['sunflower']);
  const z2 = new Zombie('basic', 1);
  z2.x = CFG.GRID_X - 60;
  g2.mowers[1].used = true;
  g2.zombies.push(z2);
  g2.update(1 / 60);
  check('رسیدن زامبی به خانه = باخت', lost);
}

console.log(failures ? `\n❌ ${failures} بررسی ناموفق` : '\n✅ همه بررسی‌ها موفق');
process.exit(failures ? 1 : 0);

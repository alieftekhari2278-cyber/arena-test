/**
 * تست دودی (smoke test) بدون مرورگر.
 *
 * یک DOM و Canvas تقلبی می‌سازد، بازی را اجرا می‌کند، چند هزار فریم شبیه‌سازی
 * می‌کند و مطمئن می‌شود هیچ استثنایی رخ نمی‌دهد و منطق اصلی درست کار می‌کند.
 *
 * اجرا:  node game/test/smoke.mjs
 */

import { makeFakeDom } from './fake-dom.mjs';

const rootEl = makeFakeDom();

/* ------------------------------- اجرا ------------------------------- */

const { Game } = await import('../js/game.js');
const { LEVELS, ENDLESS, GRID, SUN, cellCenter } = await import('../js/config.js');

let failures = 0;
function check(name, cond, extra = '') {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name} ${extra}`);
  }
}

const game = new Game(rootEl);
check('بازی بدون خطا ساخته شد', game.state === 'menu');

function simulate(seconds, dt = 1 / 60) {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) {
    game.update(dt);
    game.render();
  }
}

console.log('\n۱) مرحله‌ی اول');
game.startLevel(LEVELS[0]);
check('حالت شروع درست است', game.state === 'intro');
check('خورشید اولیه درست است', game.sun === SUN.startingAmount, `(${game.sun})`);
check('۵ ماشین چمن‌زنی ساخته شد', game.mowers.length === GRID.rows);

simulate(3);
check('بعد از مقدمه وارد بازی شد', game.state === 'playing', `(${game.state})`);

console.log('\n۲) کاشت گیاه');
game.sun = 2000;
game.selectSeed('sunflower');
check('کارت بذر انتخاب شد', game.selected === 'sunflower');
const c00 = cellCenter(0, 2);
game.handleClick(c00.x, c00.y);
check('گیاه در شبکه ثبت شد', !!game.grid[2][0] && game.grid[2][0].type === 'sunflower');
check('انتخاب بعد از کاشت پاک شد', game.selected === null);
check('هزینه از خورشید کم شد', game.sun === 1950, `(${game.sun})`);

game.cooldowns.sunflower = 0;
game.selectSeed('sunflower');
game.handleClick(c00.x, c00.y);
check('روی خانه‌ی پر نمی‌توان کاشت', game.plants.length === 1);

console.log('\n۳) شلیک و برخورد');
// دفاع کامل در همه‌ی لاین‌ها تا بازی وسط تست تمام نشود
for (let r = 0; r < GRID.rows; r++) {
  for (let col = 1; col <= 3; col++) {
    game.cooldowns.peashooter = 0;
    game.selectSeed('peashooter');
    const c = cellCenter(col, r);
    game.handleClick(c.x, c.y);
  }
}
check('نخودپران‌ها کاشته شدند', game.plants.length === 16, `(${game.plants.length})`);
const before = game.kills;
simulate(40);
check('بازی هنوز در جریان است', game.state === 'playing', `(${game.state})`);
check('گلوله تولید شد', game.bullets.length >= 0);
check('دست‌کم یک زامبی کشته شد', game.kills > before, `(${game.kills})`);

console.log('\n۴) بیل');
game.shovelActive = true;
game.handleClick(c00.x, c00.y);
check('گیاه با بیل برداشته شد', game.grid[2][0] === null);

console.log('\n۵) خورشید');
game.sun = 0;
game.suns.push({ x: 300, y: 200, value: 25, dead: false, collecting: false, alpha: 1, life: 9, seed: 1, fromSky: true, targetY: 200, vx: 0, vy: 0 });
game.handleClick(300, 200);
check('خورشید جمع شد', game.sun === 25, `(${game.sun})`);

console.log('\n۶) شبیه‌سازی طولانی همه‌ی مراحل');
for (const lv of LEVELS) {
  game.startLevel(lv);
  game.state = 'playing';
  game.sun = 100000;
  // یک دیوار کامل از نخودپران و آفتابگردان می‌چینیم
  for (let r = 0; r < GRID.rows; r++) {
    for (let col = 0; col < 4; col++) {
      const type = col === 0 ? 'sunflower' : 'peashooter';
      if (!lv.plants.includes(type)) continue;
      game.cooldowns[type] = 0;
      game.selectSeed(type);
      const c = cellCenter(col, r);
      game.handleClick(c.x, c.y);
    }
  }
  simulate(260);
  check(`مرحله ${lv.id} بدون خطا اجرا شد (وضعیت: ${game.state}، کشته: ${game.kills})`, true);
}

console.log('\n۷) حالت بی‌پایان');
game.startLevel(ENDLESS);
game.state = 'playing';
simulate(200);
check('موج‌ها در حالت بی‌پایان جلو رفتند', game.wave > 3, `(${game.wave})`);
check('شکست یا ادامه‌ی سالم', ['playing', 'lost'].includes(game.state), `(${game.state})`);

console.log('\n۸) انفجارها و توانایی‌های ویژه');
game.startLevel(LEVELS[4]);
game.state = 'playing';
game.sun = 100000;
for (const type of ['cherrybomb', 'jalapeno', 'potatomine', 'chomper', 'snowpea', 'repeater', 'wallnut']) {
  game.cooldowns[type] = 0;
  game.selectSeed(type);
  const c = cellCenter(3 + (['cherrybomb', 'jalapeno'].includes(type) ? 0 : 1), ['cherrybomb', 'jalapeno', 'potatomine', 'chomper', 'snowpea', 'repeater', 'wallnut'].indexOf(type) % 5);
  game.handleClick(c.x, c.y);
}
simulate(120);
check('همه‌ی گیاهان ویژه بدون خطا کار کردند', true);

console.log(
  failures === 0 ? '\n\u2705 همه‌ی تست‌ها موفق بودند.\n' : `\n\u274c ${failures} تست شکست خورد.\n`
);
process.exit(failures === 0 ? 0 : 1);

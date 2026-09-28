/**
 * سنجش بالانس مراحل با یک ربات ساده که مثل یک بازیکن متوسط بازی می‌کند:
 * خورشیدها را جمع می‌کند، دو ستون آفتابگردان می‌کارد و بقیه را نخودپران/نخود یخی.
 *
 * اجرا:  node game/test/balance.mjs
 */

import { makeFakeDom } from './fake-dom.mjs';

const rootEl = makeFakeDom();
const { Game } = await import('../js/game.js');
const { LEVELS, GRID, cellCenter, PLANTS } = await import('../js/config.js');

const game = new Game(rootEl);

function plantAt(g, type, col, row) {
  if (!g.level.plants.includes(type)) return false;
  if (g.grid[row][col]) return false;
  if (g.sun < PLANTS[type].cost || g.cooldowns[type] > 0) return false;
  g.selected = type;
  const c = cellCenter(col, row);
  g.handleClick(c.x, c.y);
  return true;
}

function botTurn(g) {
  // جمع‌آوری خورشید (با کمی تأخیر واقع‌گرایانه)
  for (const s of g.suns) if (!s.collecting && !s.dead && s.life < 9.5) g.collectSun(s);

  // واکنش اضطراری: اگر یک لاین شلوغ شد، بمب بینداز
  const perLane = new Array(GRID.rows).fill(0);
  for (const z of g.zombies) if (z.x < 700) perLane[z.row]++;
  const hot = perLane.findIndex((n) => n >= 4);
  if (hot >= 0) {
    for (let col = 5; col >= 2; col--) {
      if (plantAt(g, 'cherrybomb', col, hot) || plantAt(g, 'jalapeno', col, hot)) return;
    }
  }

  // دفاع اضطراری: لاینی که زامبی دارد ولی هیچ مهاجمی ندارد
  const shootersInLane = new Array(GRID.rows).fill(0);
  for (const p of g.plants) if (['peashooter', 'snowpea', 'repeater'].includes(p.type)) shootersInLane[p.row]++;
  for (let r = 0; r < GRID.rows; r++) {
    if (shootersInLane[r] > 0 || perLane[r] === 0) continue;
    for (const col of [2, 3, 1, 4]) {
      if (plantAt(g, 'peashooter', col, r)) return;
    }
    return; // پول نداریم؛ پس‌انداز کن
  }

  // استراتژی انسانی: یک آفتابگردان، یک مهاجم، و همین‌طور ادامه
  const order = [];
  for (let r = 0; r < GRID.rows; r++) {
    order.push({ type: 'sunflower', col: 0, row: r });
    order.push({ type: 'peashooter', col: 2, row: r });
  }
  for (let r = 0; r < GRID.rows; r++) {
    order.push({ type: 'sunflower', col: 1, row: r });
    order.push({ type: 'peashooter', col: 3, row: r });
  }
  for (let r = 0; r < GRID.rows; r++) order.push({ type: 'snowpea', col: 4, row: r });
  for (let r = 0; r < GRID.rows; r++) order.push({ type: 'repeater', col: 5, row: r });
  for (let r = 0; r < GRID.rows; r++) order.push({ type: 'repeater', col: 6, row: r });
  for (let r = 0; r < GRID.rows; r++) order.push({ type: 'wallnut', col: 7, row: r });

  // اولین جای خالی در برنامه را پیدا کن؛ اگر پول کافی نیست پس‌انداز کن
  // (پریدن از روی آن باعث می‌شد ربات فقط آفتابگردان بکارد)
  for (const slot of order) {
    if (!g.level.plants.includes(slot.type)) continue;
    if (g.grid[slot.row][slot.col]) continue;
    plantAt(g, slot.type, slot.col, slot.row);
    break;
  }
}

const ROUNDS = Number(process.env.ROUNDS || 5);
console.log(`گزارش بالانس — ${ROUNDS} بار بازی خودکار برای هر مرحله\n`);

function playLevel(lv) {
  game.startLevel(lv);
  game.state = 'playing';
  const dt = 1 / 60;
  let t = 0;
  let botTick = 0;
  while (game.state === 'playing' && t < 900) {
    game.update(dt);
    t += dt;
    botTick += dt;
    if (botTick >= 0.5) {
      botTick = 0;
      botTurn(game);
    }
  }
  return { won: game.state === 'won', wave: game.wave, kills: game.kills, time: t };
}

const rows = [];
for (const lv of LEVELS) {
  let wins = 0;
  let timeSum = 0;
  let killSum = 0;
  for (let i = 0; i < ROUNDS; i++) {
    const r = playLevel(lv);
    if (r.won) wins++;
    timeSum += r.time;
    killSum += r.kills;
  }
  const rate = Math.round((wins / ROUNDS) * 100);
  rows.push({ lv, rate, time: timeSum / ROUNDS, kills: killSum / ROUNDS });
  console.log(
    `مرحله ${lv.id} — ${lv.name.padEnd(14)} | نرخ برد ربات: ${String(rate).padStart(3)}% | میانگین زمان: ${(timeSum / ROUNDS).toFixed(0)}s | میانگین کشته: ${(killSum / ROUNDS).toFixed(0)}`
  );
}

console.log('\nمعیار طراحی: مرحله‌ی ۱ باید تقریباً همیشه برده شود و سختی به‌تدریج بالا برود.');
const first = rows[0];
const ok = first.rate >= 80 && rows[rows.length - 1].rate <= first.rate;
console.log(ok ? '✅ منحنی سختی منطقی است.' : '⚠️ منحنی سختی نیاز به تنظیم دارد.');

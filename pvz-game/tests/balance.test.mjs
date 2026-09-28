// تست تعادل: یک ربات با استراتژی منطقی مرحله‌ها را بازی می‌کند
// اجرا:  node pvz-game/tests/balance.test.mjs
import { installStubs, makeCanvas } from './_stub-dom.mjs';
installStubs();

const { Game } = await import('../js/game.js');
const { LEVELS, SURVIVAL, CFG } = await import('../js/config.js');

const noop = () => {};
const SKILL = { good: 1 };
const RUNS = 8;

function play(level, seeds, maxSec, skill = 1) {
  const g = new Game(makeCanvas());
  let ended = null;
  g.on.hud = noop;
  g.on.end = (r, s, w) => (ended = { r, s, w });
  g.loop = noop;
  g.start(level, seeds);

  const idx = (id) => seeds.indexOf(id);
  const dt = 1 / 60;
  let t = 0;
  let think = 0;

  const put = (id, c, r) => {
    const i = idx(id);
    if (i < 0 || c < 0 || c >= CFG.COLS || r < 0 || r >= CFG.ROWS) return false;
    if (g.grid[r][c]) return false;
    const before = g.plants.length;
    g.tryPlant(i, c, r);
    return g.plants.length > before;
  };
  const countIn = (r, ids) => g.plants.filter((p) => p.row === r && ids.includes(p.id)).length;

  while (t < maxSec && !ended) {
    g.update(dt);
    t += dt;

    for (const s of g.suns) {
      if (!s.collecting && Math.random() < skill) {
        g.sun += s.value;
        s.dead = true;
        g.stats.sunCollected += s.value;
      }
    }

    think -= dt;
    if (think > 0) continue;
    think = 0.25;

    const sunflowers = g.plants.filter((p) => p.id === 'sunflower').length;
    const shooters = ['peashooter', 'repeater', 'snowpea'];
    let acted = false;

    // ۱) وضعیت اضطراری نزدیک خانه
    for (const z of g.zombies) {
      if (z.state === 'die') continue;
      if (z.x < CFG.GRID_X + CFG.CELL_W * 2) {
        const c = Math.max(0, Math.min(CFG.COLS - 1, Math.floor((z.x - CFG.GRID_X) / CFG.CELL_W) + 1));
        if (put('cherrybomb', c, z.row) || put('jalapeno', c, z.row) || put('potatomine', c, z.row)) {
          acted = true;
          break;
        }
      }
    }
    if (acted) continue;

    // ۲) اقتصاد اولیه
    if (sunflowers < 4) {
      for (let r = 0; r < 5 && !acted; r++) for (const c of [0, 1]) if (put('sunflower', c, r)) { acted = true; break; }
      if (acted) continue;
    }

    // ۳) دفاع ردیف‌های تهدیدشده
    for (const r of new Set(g.zombies.filter((z) => z.state !== 'die').map((z) => z.row))) {
      if (countIn(r, shooters) < 2) {
        for (const c of [2, 3, 4, 5]) if (put('snowpea', c, r) || put('repeater', c, r) || put('peashooter', c, r)) { acted = true; break; }
      }
      if (acted) break;
    }
    if (acted) continue;

    // ۴) اقتصاد بیشتر
    if (sunflowers < 9 && g.sun >= 110) {
      for (let r = 0; r < 5 && !acted; r++) for (const c of [0, 1]) if (put('sunflower', c, r)) { acted = true; break; }
      if (acted) continue;
    }

    // ۵) تقویت خط دفاع
    for (let r = 0; r < 5 && !acted; r++) {
      if (countIn(r, shooters) < 3 && g.sun >= 150) {
        for (const c of [2, 3, 4, 5]) if (put('repeater', c, r) || put('peashooter', c, r)) { acted = true; break; }
      }
    }
    if (acted) continue;

    // ۶) گردوی دیواری
    if (g.sun >= 200) for (let r = 0; r < 5 && !acted; r++) if (put('wallnut', 7, r)) acted = true;
  }

  return { ended, t: Math.round(t), stats: g.stats, wave: g.waveIndex, mowers: g.mowers.filter((m) => !m.used).length };
}

let fail = 0;
for (const lv of LEVELS) {
  const seeds = lv.plants.slice(0, lv.slots);
  for (const [label, sk] of [['ربات', SKILL.good]]) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) runs.push(play(lv, seeds, 1800, sk));
    const wins = runs.filter((r) => r.ended && r.ended.r === 'win').length;
    const avgWave = (runs.reduce((a, r) => a + r.wave, 0) / runs.length).toFixed(1);
    console.log(
      `مرحله ${lv.id} «${lv.name}» [${label}]: ${wins}/${RUNS} برد · میانگین موج ${avgWave} از ${lv.waves.length} · چمن‌زن سالم: ${runs.map((r) => r.mowers).join(',')}`
    );
    const rate = wins / RUNS;
    if (rate < 0.35) {
      fail++;
      console.log('   ⚠ خیلی سخت است (نرخ برد ' + Math.round(rate * 100) + '٪)');
    } else if (rate === 1) {
      console.log('   ℹ ربات همیشه می‌برد — برای مرحله‌ی آموزشی طبیعی است');
    }
  }
}

const sr = [];
for (let i = 0; i < 5; i++) sr.push(play(SURVIVAL, SURVIVAL.plants.slice(0, SURVIVAL.slots), 2400, SKILL.good));
const avgSurv = sr.reduce((a, r) => a + r.wave, 0) / sr.length;
console.log(`بقا: موج‌های ${sr.map((r) => r.wave).join(', ')} · میانگین ${avgSurv.toFixed(1)}`);
if (avgSurv < 8) {
  fail++;
  console.log('   ⚠ حالت بقا خیلی زود تمام می‌شود');
}

console.log(fail ? `\n❌ ${fail} مورد نیاز به تنظیم دارد` : '\n✅ تعادل قابل قبول است');

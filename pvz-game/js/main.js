// اتصال رابط کاربری HTML به هسته‌ی بازی

import { CFG, PLANTS, PLANT_ORDER, LEVELS, SURVIVAL } from './config.js';
import { drawPlantArt, drawZombieArt, drawSunOrb, buildBackground } from './art.js';
import { Game } from './game.js';
import { sfx } from './audio.js';

/* --------------------------- کمکی --------------------------- */

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const fa = (n) => String(n).replace(/\d/g, (d) => FA_DIGITS[+d]);

const STORE = 'pvz.progress.v1';
function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORE)) || { cleared: [], bestWave: 0 };
  } catch {
    return { cleared: [], bestWave: 0 };
  }
}
function saveProgress(p) {
  try {
    localStorage.setItem(STORE, JSON.stringify(p));
  } catch {
    /* بی‌خیال */
  }
}
let progress = loadProgress();

/* --------------------------- آیکن گیاه --------------------------- */

function renderPlantIcon(cv, id, t = 1.4) {
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.save();
  ctx.translate(cv.width / 2, cv.height * 0.94);
  const s = cv.height / 80;
  ctx.scale(s, s);
  drawPlantArt(ctx, id, t, { hp: 1, armed: true, fuseRatio: 0, state: 'idle', armLeft: 0 });
  ctx.restore();
}

function renderSunIcon(cv) {
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.save();
  ctx.translate(cv.width / 2, cv.height / 2);
  ctx.scale(0.72, 0.72);
  drawSunOrb(ctx, 0.4, 22);
  ctx.restore();
}

/* --------------------------- مقیاس صفحه --------------------------- */

function fitStage() {
  const stage = $('#stage');
  const pad = 16;
  const sx = (window.innerWidth - pad) / 1000;
  const sy = (window.innerHeight - pad) / 692;
  const s = Math.min(sx, sy, 1.35);
  stage.style.transform = `scale(${s})`;
}
window.addEventListener('resize', fitStage);

/* --------------------------- صفحه‌ها --------------------------- */

const SCREENS = {
  menu: '#screenMenu',
  levels: '#screenLevels',
  seeds: '#screenSeeds',
  help: '#screenHelp',
  pause: '#screenPause',
  result: '#screenResult',
  none: null,
};

let current = 'menu';

function show(name) {
  current = name;
  Object.entries(SCREENS).forEach(([k, sel]) => {
    if (!sel) return;
    $(sel).classList.toggle('show', k === name);
  });
  if (name === 'menu') refreshMenu();
  if (name === 'levels') buildLevels();
}

/* --------------------------- بازی --------------------------- */

const canvas = $('#game');
const game = new Game(canvas);

let activeLevel = null;
let chosen = [];

game.on.hud = (s) => updateHud(s);
game.on.end = (result, stats, wave) => onGameEnd(result, stats, wave);

/* --------------------------- منوی اصلی --------------------------- */

function refreshMenu() {
  const done = progress.cleared.length;
  const parts = [];
  if (done) parts.push(`مرحله‌های تمام‌شده: ${fa(done)} از ${fa(LEVELS.length)}`);
  if (progress.bestWave) parts.push(`رکورد بقا: موج ${fa(progress.bestWave)}`);
  $('#bestLine').textContent = parts.join(' · ');
}

let menuBg = null;
function drawMenuArt() {
  const cv = $('#menuArt');
  const ctx = cv.getContext('2d');
  if (!menuBg) menuBg = buildBackground('day');
  const g = ctx.createLinearGradient(0, 0, 0, 300);
  g.addColorStop(0, 'rgba(12,30,18,0)');
  g.addColorStop(1, 'rgba(12,30,18,.92)');
  ctx.drawImage(menuBg, 0, 300, 1000, 300, 0, 0, 1000, 300);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1000, 300);

  const t = performance.now() / 1000;
  ctx.save();
  ctx.translate(150, 250);
  drawPlantArt(ctx, 'sunflower', t, { hp: 1 });
  ctx.restore();
  ctx.save();
  ctx.translate(250, 250);
  drawPlantArt(ctx, 'peashooter', t + 1, { hp: 1 });
  ctx.restore();
  ctx.save();
  ctx.translate(760, 250);
  drawZombieArt(ctx, 'cone', t, { state: 'walk', phase: 1, shieldRatio: 1 });
  ctx.restore();
  ctx.save();
  ctx.translate(880, 250);
  drawZombieArt(ctx, 'bucket', t + 2, { state: 'walk', phase: 3, shieldRatio: 1 });
  ctx.restore();
}

/* --------------------------- انتخاب مرحله --------------------------- */

const LEVEL_ICONS = ['🌤️', '🌙', '🔥'];

function buildLevels() {
  const list = $('#levelList');
  list.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const locked = i > 0 && !progress.cleared.includes(LEVELS[i - 1].id);
    const b = document.createElement('button');
    b.className = 'levelcard' + (locked ? ' locked' : '');
    b.innerHTML = `
      ${progress.cleared.includes(lv.id) ? '<span class="lvdone">⭐</span>' : ''}
      <span class="lvicon">${LEVEL_ICONS[i] || '🌱'}</span>
      <span class="lvname">مرحله ${fa(lv.id)} — ${lv.name}</span>
      <span class="lvsub">${lv.subtitle}</span>`;
    if (!locked) b.addEventListener('click', () => openSeedPicker(lv));
    list.appendChild(b);
  });

  const survLocked = !progress.cleared.includes(1);
  const s = document.createElement('button');
  s.className = 'levelcard' + (survLocked ? ' locked' : '');
  s.innerHTML = `
    <span class="lvicon">♾️</span>
    <span class="lvname">${SURVIVAL.name}</span>
    <span class="lvsub">${SURVIVAL.subtitle}${progress.bestWave ? ` · رکورد: ${fa(progress.bestWave)}` : ''}</span>`;
  if (!survLocked) s.addEventListener('click', () => openSeedPicker(SURVIVAL));
  list.appendChild(s);
}

/* --------------------------- انتخاب بذر --------------------------- */

function openSeedPicker(level) {
  activeLevel = level;
  chosen = [];
  $('#seedTitle').textContent = `${level.name} — بذرهایت را انتخاب کن`;
  $('#seedHint').textContent = `حداکثر ${fa(level.slots)} بذر می‌توانی برداری. آفتابگردان و یک گیاه تهاجمی تقریباً همیشه لازم‌اند.`;

  const wrap = $('#seedPick');
  wrap.innerHTML = '';
  for (const id of PLANT_ORDER) {
    if (!level.plants.includes(id)) continue;
    const def = PLANTS[id];
    const card = document.createElement('button');
    card.className = 'seedcard';
    card.dataset.id = id;
    card.innerHTML = `
      <canvas width="144" height="112"></canvas>
      <span class="nm">${def.name}</span>
      <span class="cost">☀ ${fa(def.cost)}</span>
      <span class="tip">${def.desc}</span>`;
    const cv = card.querySelector('canvas');
    cv.width = 144;
    cv.height = 112;
    renderPlantIcon(cv, id, 1.4);
    card.addEventListener('click', () => toggleSeed(id, card));
    wrap.appendChild(card);
  }
  updateChosen();
  show('seeds');
}

function toggleSeed(id, card) {
  sfx.resume();
  const i = chosen.indexOf(id);
  if (i >= 0) {
    chosen.splice(i, 1);
    card.classList.remove('picked');
  } else {
    if (chosen.length >= activeLevel.slots) {
      sfx.error();
      return;
    }
    chosen.push(id);
    card.classList.add('picked');
  }
  sfx.click();
  updateChosen();
}

function updateChosen() {
  const row = $('#chosenRow');
  row.innerHTML = '';
  if (!chosen.length) {
    row.innerHTML = '<span class="empty">هنوز بذری انتخاب نکرده‌ای</span>';
  } else {
    for (const id of chosen) {
      const c = document.createElement('span');
      c.className = 'chip';
      c.textContent = `${PLANTS[id].name} · ☀${fa(PLANTS[id].cost)}`;
      row.appendChild(c);
    }
  }
  $('#startBtn').disabled = chosen.length === 0;
  $('#startBtn').textContent = chosen.length ? `بزن بریم! (${fa(chosen.length)}/${fa(activeLevel.slots)})` : 'بزن بریم!';
}

$('#autoPick').addEventListener('click', () => {
  const pref = ['sunflower', 'peashooter', 'wallnut', 'potatomine', 'snowpea', 'repeater', 'cherrybomb', 'chomper', 'jalapeno'];
  chosen = pref.filter((p) => activeLevel.plants.includes(p)).slice(0, activeLevel.slots);
  $$('#seedPick .seedcard').forEach((c) => c.classList.toggle('picked', chosen.includes(c.dataset.id)));
  sfx.click();
  updateChosen();
});

$('#startBtn').addEventListener('click', () => {
  sfx.resume();
  startGame();
});

/* --------------------------- شروع بازی --------------------------- */

function startGame() {
  show('none');
  buildSeedBar(chosen);
  game.start(activeLevel, chosen);
}

function buildSeedBar(ids) {
  const bar = $('#seedbar');
  bar.innerHTML = '';
  ids.forEach((id, i) => {
    const def = PLANTS[id];
    const b = document.createElement('button');
    b.className = 'packet';
    b.dataset.i = i;
    b.title = `${def.name} — ${def.desc}`;
    b.innerHTML = `
      <span class="key">${fa(i + 1)}</span>
      <canvas width="120" height="92"></canvas>
      <span class="cost">☀ ${fa(def.cost)}</span>
      <span class="nm">${def.name}</span>
      <span class="cd"></span>`;
    renderPlantIcon(b.querySelector('canvas'), id, 1.4);
    b.addEventListener('click', () => game.selectSeed(i));
    bar.appendChild(b);
  });
}

function updateHud(s) {
  $('#sunCount').textContent = fa(s.sun);
  const packets = $$('#seedbar .packet');
  packets.forEach((p, i) => {
    const seed = s.seeds[i];
    if (!seed) return;
    p.classList.toggle('selected', s.selected === i);
    p.classList.toggle('poor', !seed.ready || s.sun < seed.def.cost);
    const cd = p.querySelector('.cd');
    cd.style.height = seed.ready ? '0%' : `${(seed.cd / seed.def.cooldown) * 100}%`;
  });
  $('#shovelBtn').classList.toggle('active', s.shovel);
  canvas.style.cursor = s.selected >= 0 || s.shovel ? 'pointer' : 'crosshair';

  const fill = $('#progressFill');
  const head = $('#progressHead');
  const pct = s.totalWaves ? Math.round(s.progress * 100) : Math.min(100, (s.wave % 10) * 10);
  fill.style.width = pct + '%';
  head.style.right = pct + '%';
  $('#progressLabel').textContent = s.totalWaves
    ? `موج ${fa(s.wave)} از ${fa(s.totalWaves)}`
    : `موج ${fa(s.wave)}`;
}

/* --------------------------- پایان بازی --------------------------- */

function onGameEnd(result, stats, wave) {
  const win = result === 'win';
  $('#resultTitle').textContent = win ? '🌻 پیروزی!' : '🧟 زامبی‌ها مغزت را خوردند!';
  $('#resultTitle').style.color = win ? '#8ce26a' : '#ff8787';
  $('#resultSub').textContent = win
    ? `مرحله «${activeLevel.name}» را با موفقیت تمام کردی.`
    : activeLevel.endless
      ? `تا موج ${fa(wave)} دوام آوردی.`
      : `در موج ${fa(wave)} شکست خوردی. دوباره تلاش کن!`;
  $('#resultStats').innerHTML = `
    <div><b>${fa(stats.killed)}</b><span>زامبی نابودشده</span></div>
    <div><b>${fa(stats.planted)}</b><span>گیاه کاشته‌شده</span></div>
    <div><b>${fa(stats.sunCollected)}</b><span>آفتاب جمع‌شده</span></div>`;

  if (activeLevel.endless) {
    if (wave > progress.bestWave) {
      progress.bestWave = wave;
      saveProgress(progress);
    }
    $('#nextBtn').style.display = 'none';
  } else if (win) {
    if (!progress.cleared.includes(activeLevel.id)) {
      progress.cleared.push(activeLevel.id);
      saveProgress(progress);
    }
    const idx = LEVELS.findIndex((l) => l.id === activeLevel.id);
    const next = LEVELS[idx + 1];
    $('#nextBtn').style.display = next ? '' : 'none';
    $('#nextBtn').onclick = () => {
      if (next) openSeedPicker(next);
    };
  } else {
    $('#nextBtn').style.display = 'none';
  }
  show('result');
}

$('#againBtn').addEventListener('click', () => {
  show('none');
  game.start(activeLevel, chosen);
});
$('#homeBtn').addEventListener('click', () => {
  game.stop();
  show('menu');
});

/* --------------------------- توقف --------------------------- */

function togglePause() {
  if (game.state === 'playing') {
    game.pause();
    show('pause');
  } else if (game.state === 'paused') {
    show('none');
    game.resume();
  }
}

$('#pauseBtn').addEventListener('click', togglePause);
$('#resumeBtn').addEventListener('click', togglePause);
$('#restartBtn').addEventListener('click', () => {
  show('none');
  game.start(activeLevel, chosen);
});
$('#quitBtn').addEventListener('click', () => {
  game.stop();
  show('menu');
});
$('#shovelBtn').addEventListener('click', () => game.toggleShovel());

$('#sfxToggle').addEventListener('change', (e) => sfx.setSfx(e.target.checked));
$('#musicToggle').addEventListener('change', (e) => {
  sfx.setMusic(e.target.checked);
  if (e.target.checked && game.state === 'playing') sfx.startMusic(game.level.theme);
});

/* --------------------------- ناوبری عمومی --------------------------- */

$$('[data-go]').forEach((b) =>
  b.addEventListener('click', () => {
    sfx.resume();
    sfx.click();
    show(b.dataset.go);
  })
);

/* --------------------------- صفحه‌کلید --------------------------- */

window.addEventListener('keydown', (e) => {
  if (game.state !== 'playing' && game.state !== 'paused') return;
  if (e.code === 'Escape') {
    if (game.state === 'playing' && (game.selected >= 0 || game.shovel)) {
      game.clearSelection();
    } else {
      togglePause();
    }
    e.preventDefault();
    return;
  }
  if (e.code === 'Space') {
    togglePause();
    e.preventDefault();
    return;
  }
  if (game.state !== 'playing') return;
  if (e.key === 's' || e.key === 'S' || e.key === 'س') {
    game.toggleShovel();
    return;
  }
  // ارقام لاتین، فارسی و عربی
  const faIdx = FA_DIGITS.indexOf(e.key);
  const arIdx = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'].indexOf(e.key);
  const n = faIdx >= 0 ? faIdx : arIdx >= 0 ? arIdx : parseInt(e.key, 10);
  if (!Number.isNaN(n) && n >= 1 && n <= 9) game.selectSeed(n - 1);
});

/* --------------------------- شروع --------------------------- */

document.addEventListener('pointerdown', () => sfx.resume(), { once: true });

renderSunIcon($('.sun-icon'));
drawMenuArt();
fitStage();
show('menu');

// انیمیشن ملایم صحنه‌ی منو
setInterval(() => {
  if (current === 'menu') drawMenuArt();
}, 90);

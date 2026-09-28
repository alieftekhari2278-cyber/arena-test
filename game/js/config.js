/**
 * پیکربندی بازی: ابعاد شبکه، گیاهان، زامبی‌ها و مراحل.
 * همه‌ی مقادیر عددی در یک جا نگه داشته شده‌اند تا بالانس بازی ساده باشد.
 */

export const GRID = {
  cols: 9,
  rows: 5,
  cellW: 84,
  cellH: 98,
  offsetX: 62, // فضای سمت چپ برای ماشین‌های چمن‌زنی و خانه
  offsetY: 14,
};

export const CANVAS = {
  width: GRID.offsetX + GRID.cols * GRID.cellW + 74,
  height: GRID.offsetY * 2 + GRID.rows * GRID.cellH,
};

export const SUN = {
  startingAmount: 100,
  skyValue: 25,
  skyIntervalMin: 5.5,
  skyIntervalMax: 8,
  lifetime: 11, // ثانیه تا محو شدن
  fallSpeed: 42,
};

/** تبدیل مختصات شبکه به پیکسل (مرکز خانه) */
export function cellCenter(col, row) {
  return {
    x: GRID.offsetX + col * GRID.cellW + GRID.cellW / 2,
    y: GRID.offsetY + row * GRID.cellH + GRID.cellH / 2,
  };
}

export function laneY(row) {
  return GRID.offsetY + row * GRID.cellH + GRID.cellH / 2;
}

/* ------------------------------------------------------------------ */
/* گیاهان                                                              */
/* ------------------------------------------------------------------ */

export const PLANTS = {
  sunflower: {
    id: 'sunflower',
    name: 'آفتابگردان',
    desc: 'هر چند ثانیه ۲۵ خورشید تولید می‌کند. ستون اقتصاد شماست.',
    cost: 50,
    cooldown: 7.5,
    hp: 300,
    kind: 'producer',
    produceInterval: 13,
    produceFirst: 3,
    produceValue: 25,
  },
  peashooter: {
    id: 'peashooter',
    name: 'نخودپران',
    desc: 'به زامبی‌های لاین خودش نخود شلیک می‌کند.',
    cost: 100,
    cooldown: 7.5,
    hp: 300,
    kind: 'shooter',
    damage: 20,
    fireRate: 1.45,
    bullets: 1,
  },
  wallnut: {
    id: 'wallnut',
    name: 'گردوی دیواری',
    desc: 'جان بسیار بالا؛ جلوی زامبی‌ها را سد می‌کند.',
    cost: 50,
    cooldown: 20,
    hp: 4000,
    kind: 'wall',
  },
  potatomine: {
    id: 'potatomine',
    name: 'مین سیب‌زمینی',
    desc: 'ارزان است ولی باید مسلح شود. بعد از آن اولین زامبی را منفجر می‌کند.',
    cost: 25,
    cooldown: 25,
    hp: 300,
    kind: 'mine',
    armTime: 14,
    damage: 2000,
  },
  snowpea: {
    id: 'snowpea',
    name: 'نخود یخی',
    desc: 'نخود یخی شلیک می‌کند و سرعت زامبی را نصف می‌کند.',
    cost: 175,
    cooldown: 7.5,
    hp: 300,
    kind: 'shooter',
    damage: 20,
    fireRate: 1.45,
    bullets: 1,
    freeze: true,
  },
  repeater: {
    id: 'repeater',
    name: 'نخودپران دوقلو',
    desc: 'در هر شلیک دو نخود پرتاب می‌کند.',
    cost: 200,
    cooldown: 7.5,
    hp: 300,
    kind: 'shooter',
    damage: 20,
    fireRate: 1.45,
    bullets: 2,
  },
  chomper: {
    id: 'chomper',
    name: 'بلعنده',
    desc: 'زامبی نزدیک را یک‌جا می‌بلعد، اما مدتی مشغول جویدن است.',
    cost: 150,
    cooldown: 7.5,
    hp: 300,
    kind: 'chomper',
    chewTime: 11,
    range: 1.15,
  },
  cherrybomb: {
    id: 'cherrybomb',
    name: 'بمب گیلاس',
    desc: 'کل زامبی‌های یک ناحیه‌ی ۳×۳ را منفجر می‌کند.',
    cost: 150,
    cooldown: 35,
    hp: 300,
    kind: 'bomb',
    fuse: 1.1,
    damage: 2000,
    radius: 1.45,
  },
  jalapeno: {
    id: 'jalapeno',
    name: 'فلفل تند',
    desc: 'تمام لاین خودش را با آتش پاک‌سازی می‌کند.',
    cost: 125,
    cooldown: 35,
    hp: 300,
    kind: 'lanebomb',
    fuse: 1.1,
    damage: 2000,
  },
};

export const PLANT_ORDER = [
  'sunflower',
  'peashooter',
  'wallnut',
  'potatomine',
  'snowpea',
  'repeater',
  'chomper',
  'cherrybomb',
  'jalapeno',
];

/* ------------------------------------------------------------------ */
/* زامبی‌ها                                                            */
/* ------------------------------------------------------------------ */

export const ZOMBIES = {
  basic: {
    id: 'basic',
    name: 'زامبی ساده',
    hp: 200,
    speed: 20,
    dps: 100,
    threat: 1,
  },
  flag: {
    id: 'flag',
    name: 'زامبی پرچم‌دار',
    hp: 200,
    speed: 30,
    dps: 100,
    threat: 1,
  },
  cone: {
    id: 'cone',
    name: 'زامبی مخروطی',
    hp: 200,
    armor: 370,
    speed: 20,
    dps: 100,
    threat: 2,
  },
  newspaper: {
    id: 'newspaper',
    name: 'زامبی روزنامه‌خوان',
    hp: 200,
    armor: 150,
    speed: 18,
    rageSpeed: 44,
    dps: 100,
    threat: 2,
  },
  bucket: {
    id: 'bucket',
    name: 'زامبی سطلی',
    hp: 200,
    armor: 1100,
    speed: 20,
    dps: 100,
    threat: 5,
  },
  football: {
    id: 'football',
    name: 'زامبی فوتبالیست',
    hp: 200,
    armor: 1400,
    speed: 34,
    dps: 100,
    threat: 10,
  },
  gargantuar: {
    id: 'gargantuar',
    name: 'زامبی غول‌پیکر',
    hp: 3000,
    speed: 13,
    dps: 100,
    smash: true, // گیاه را یک‌ضرب نابود می‌کند
    threat: 16,
  },
};

/* ------------------------------------------------------------------ */
/* مراحل                                                               */
/* ------------------------------------------------------------------ */

export const LEVELS = [
  {
    id: 1,
    name: 'حیاط جلویی',
    subtitle: 'اولین شب آرام. فقط زامبی‌های ساده.',
    plants: ['sunflower', 'peashooter', 'wallnut', 'potatomine'],
    waves: 8,
    pool: ['basic', 'basic', 'basic', 'cone'],
    budgetBase: 1,
    budgetGrowth: 0.4,
    waveGap: 28,
    firstWaveDelay: 30,
  },
  {
    id: 2,
    name: 'همسایه‌ی مزاحم',
    subtitle: 'مخروطی‌ها و روزنامه‌خوان‌ها از راه رسیدند.',
    plants: ['sunflower', 'peashooter', 'wallnut', 'potatomine', 'snowpea'],
    waves: 10,
    pool: ['basic', 'basic', 'cone', 'cone', 'newspaper'],
    budgetBase: 1,
    budgetGrowth: 0.5,
    waveGap: 27,
    firstWaveDelay: 28,
  },
  {
    id: 3,
    name: 'شب سطل‌ها',
    subtitle: 'زره فلزی؛ آتش سنگین‌تری لازم داری.',
    plants: ['sunflower', 'peashooter', 'wallnut', 'potatomine', 'snowpea', 'repeater', 'cherrybomb'],
    waves: 12,
    pool: ['basic', 'cone', 'cone', 'newspaper', 'bucket'],
    budgetBase: 1,
    budgetGrowth: 0.62,
    waveGap: 26,
    firstWaveDelay: 26,
  },
  {
    id: 4,
    name: 'بازی خانگی',
    subtitle: 'فوتبالیست‌ها سریع می‌دوند. مواظب لاین‌های خالی باش.',
    plants: ['sunflower', 'peashooter', 'wallnut', 'potatomine', 'snowpea', 'repeater', 'chomper', 'cherrybomb', 'jalapeno'],
    waves: 14,
    pool: ['basic', 'basic', 'cone', 'newspaper', 'bucket', 'bucket', 'football'],
    budgetBase: 1,
    budgetGrowth: 0.7,
    waveGap: 25,
    firstWaveDelay: 26,
  },
  {
    id: 5,
    name: 'حمله‌ی نهایی',
    subtitle: 'غول‌پیکرها آمده‌اند. موفق باشی.',
    plants: PLANT_ORDER,
    waves: 16,
    pool: ['basic', 'cone', 'cone', 'newspaper', 'bucket', 'bucket', 'football', 'gargantuar'],
    budgetBase: 1,
    budgetGrowth: 0.85,
    waveGap: 24,
    firstWaveDelay: 25,
  },
];

export const ENDLESS = {
  id: 'endless',
  name: 'بقا (بی‌پایان)',
  subtitle: 'موج‌ها تمام نمی‌شوند. تا کجا دوام می‌آوری؟',
  plants: PLANT_ORDER,
  waves: Infinity,
  pool: ['basic', 'cone', 'newspaper', 'bucket', 'football', 'gargantuar'],
  budgetBase: 1,
  budgetGrowth: 0.5,
  waveGap: 22,
  firstWaveDelay: 26,
  endless: true,
};

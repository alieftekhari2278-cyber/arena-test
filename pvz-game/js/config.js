// پیکربندی کلی بازی و داده‌های گیاهان، زامبی‌ها و مراحل

export const CFG = {
  COLS: 9,
  ROWS: 5,
  CELL_W: 86,
  CELL_H: 96,
  GRID_X: 152,
  GRID_Y: 76,
  W: 1000,
  H: 600,
  SPAWN_X: 995,
  MOWER_X: 108,
};

CFG.LAWN_W = CFG.COLS * CFG.CELL_W; // 774
CFG.LAWN_H = CFG.ROWS * CFG.CELL_H; // 480
CFG.GRID_R = CFG.GRID_X + CFG.LAWN_W;
CFG.GRID_B = CFG.GRID_Y + CFG.LAWN_H;

export const colCenter = (c) => CFG.GRID_X + c * CFG.CELL_W + CFG.CELL_W / 2;
export const rowCenter = (r) => CFG.GRID_Y + r * CFG.CELL_H + CFG.CELL_H / 2;
export const colAt = (x) => Math.floor((x - CFG.GRID_X) / CFG.CELL_W);
export const rowAt = (y) => Math.floor((y - CFG.GRID_Y) / CFG.CELL_H);

/* ------------------------------------------------------------------ */
/*  گیاهان                                                             */
/* ------------------------------------------------------------------ */

export const PLANTS = {
  sunflower: {
    id: 'sunflower',
    name: 'آفتابگردان',
    desc: 'با نور خورشید آفتاب تولید می‌کند. اول از همه این را بکارید.',
    cost: 50,
    cooldown: 5,
    hp: 300,
    kind: 'producer',
    produceEvery: 20,
    produceFirst: 6,
    produceValue: 25,
  },
  peashooter: {
    id: 'peashooter',
    name: 'نخودپاش',
    desc: 'به سمت زامبی‌های ردیف خودش نخود شلیک می‌کند.',
    cost: 100,
    cooldown: 5,
    hp: 300,
    kind: 'shooter',
    fireRate: 1.3,
    damage: 22,
    bullet: 'pea',
  },
  wallnut: {
    id: 'wallnut',
    name: 'گردوی دیواری',
    desc: 'پوسته‌ی سختش زامبی‌ها را پشت خط نگه می‌دارد.',
    cost: 50,
    cooldown: 20,
    hp: 2600,
    kind: 'wall',
  },
  potatomine: {
    id: 'potatomine',
    name: 'سیب‌زمینی‌مین',
    desc: 'ارزان است ولی باید مسلح شود. بعد از آن هر زامبی را منفجر می‌کند.',
    cost: 25,
    cooldown: 14,
    hp: 300,
    kind: 'mine',
    armTime: 12,
    damage: 2500,
  },
  snowpea: {
    id: 'snowpea',
    name: 'نخود برفی',
    desc: 'نخود یخی شلیک می‌کند و سرعت زامبی را نصف می‌کند.',
    cost: 175,
    cooldown: 6,
    hp: 300,
    kind: 'shooter',
    fireRate: 1.3,
    damage: 22,
    bullet: 'frost',
  },
  repeater: {
    id: 'repeater',
    name: 'نخودپاش دوقلو',
    desc: 'در هر شلیک دو نخود پرتاب می‌کند.',
    cost: 200,
    cooldown: 6,
    hp: 300,
    kind: 'shooter',
    fireRate: 1.3,
    damage: 22,
    bullet: 'pea',
    burst: 2,
  },
  chomper: {
    id: 'chomper',
    name: 'گیاه گوشت‌خوار',
    desc: 'زامبی نزدیک را یک‌جا می‌بلعد، اما مدتی طول می‌کشد تا بجود.',
    cost: 150,
    cooldown: 10,
    hp: 300,
    kind: 'chomper',
    chewTime: 13,
    reach: 1.15,
  },
  cherrybomb: {
    id: 'cherrybomb',
    name: 'بمب گیلاسی',
    desc: 'همه‌ی زامبی‌های یک ناحیه ۳×۳ را منفجر می‌کند.',
    cost: 150,
    cooldown: 28,
    hp: 4000,
    kind: 'bomb',
    fuse: 1.15,
    damage: 2500,
    radius: 1.45,
  },
  jalapeno: {
    id: 'jalapeno',
    name: 'فلفل تند',
    desc: 'کل ردیف را به آتش می‌کشد.',
    cost: 125,
    cooldown: 28,
    hp: 4000,
    kind: 'lanefire',
    fuse: 1.0,
    damage: 2500,
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
/*  زامبی‌ها                                                           */
/* ------------------------------------------------------------------ */

export const ZOMBIES = {
  basic: {
    id: 'basic',
    name: 'زامبی ساده',
    hp: 200,
    shield: 0,
    speed: 17,
    dps: 45,
  },
  flag: {
    id: 'flag',
    name: 'زامبی پرچم‌دار',
    hp: 200,
    shield: 0,
    speed: 24,
    dps: 45,
  },
  cone: {
    id: 'cone',
    name: 'زامبی مخروط‌به‌سر',
    hp: 200,
    shield: 370,
    speed: 17,
    dps: 45,
  },
  news: {
    id: 'news',
    name: 'زامبی روزنامه‌خوان',
    hp: 200,
    shield: 150,
    speed: 16,
    rageSpeed: 38,
    dps: 45,
  },
  bucket: {
    id: 'bucket',
    name: 'زامبی سطل‌به‌سر',
    hp: 200,
    shield: 1100,
    speed: 17,
    dps: 45,
  },
  football: {
    id: 'football',
    name: 'زامبی فوتبالیست',
    hp: 200,
    shield: 1150,
    speed: 30,
    dps: 70,
  },
};

/* ------------------------------------------------------------------ */
/*  مراحل                                                              */
/* ------------------------------------------------------------------ */

const rep = (type, n) => Array.from({ length: n }, () => type);

export const LEVELS = [
  {
    id: 1,
    name: 'حیاط جلویی',
    subtitle: 'روز · آموزش پایه',
    theme: 'day',
    skySun: true,
    startSun: 100,
    slots: 6,
    plants: ['sunflower', 'peashooter', 'wallnut', 'potatomine', 'cherrybomb'],
    waves: [
      { delay: 30, list: ['basic'] },
      { delay: 30, list: ['basic'] },
      { delay: 28, list: rep('basic', 2) },
      { delay: 28, list: ['basic', 'cone'] },
      { delay: 26, list: [...rep('basic', 2), ...rep('cone', 2)], big: true },
      { delay: 28, list: [...rep('basic', 3), ...rep('cone', 2)] },
      { delay: 26, list: [...rep('basic', 2), ...rep('cone', 3), 'bucket'] },
      { delay: 26, list: [...rep('basic', 3), ...rep('cone', 3), ...rep('bucket', 2)] },
      { delay: 30, list: ['flag', ...rep('basic', 5), ...rep('cone', 4), ...rep('bucket', 3)], big: true, final: true },
    ],
  },
  {
    id: 2,
    name: 'شب در حیاط',
    subtitle: 'شب · آفتاب از آسمان نمی‌بارد',
    theme: 'night',
    skySun: false,
    startSun: 325,
    slots: 7,
    plants: ['sunflower', 'peashooter', 'wallnut', 'potatomine', 'snowpea', 'chomper', 'cherrybomb'],
    waves: [
      { delay: 34, list: ['basic'] },
      { delay: 32, list: rep('basic', 2) },
      { delay: 30, list: ['basic', 'news'] },
      { delay: 30, list: [...rep('basic', 2), 'cone'] },
      { delay: 30, list: [...rep('cone', 2), 'news'], big: true },
      { delay: 30, list: [...rep('basic', 2), ...rep('cone', 2), 'bucket'] },
      { delay: 28, list: [...rep('news', 2), ...rep('cone', 2), 'bucket'] },
      { delay: 30, list: [...rep('basic', 3), ...rep('cone', 2), 'bucket'] },
      { delay: 30, list: [...rep('cone', 3), ...rep('news', 2), 'bucket'] },
      { delay: 34, list: ['flag', ...rep('basic', 4), ...rep('cone', 3), ...rep('news', 2), ...rep('bucket', 2)], big: true, final: true },
    ],
  },
  {
    id: 3,
    name: 'دردسر بزرگ',
    subtitle: 'روز · موج‌های سنگین',
    theme: 'day',
    skySun: true,
    startSun: 250,
    slots: 8,
    plants: PLANT_ORDER.slice(),
    waves: [
      { delay: 32, list: ['basic'] },
      { delay: 30, list: rep('basic', 2) },
      { delay: 30, list: ['basic', 'cone'] },
      { delay: 30, list: [...rep('cone', 2), 'news'], big: true },
      { delay: 32, list: [...rep('basic', 2), ...rep('cone', 2), 'bucket'] },
      { delay: 32, list: [...rep('news', 2), ...rep('cone', 2), 'bucket'] },
      { delay: 32, list: [...rep('basic', 3), ...rep('cone', 3), 'bucket'] },
      { delay: 34, list: [...rep('cone', 3), ...rep('bucket', 2), 'football'], big: true },
      { delay: 36, list: [...rep('basic', 3), ...rep('news', 2), ...rep('bucket', 2), 'football'] },
      {
        delay: 40,
        list: ['flag', ...rep('basic', 4), ...rep('cone', 3), ...rep('news', 2), ...rep('bucket', 3), 'football'],
        big: true,
        final: true,
      },
    ],
  },
];

export const SURVIVAL = {
  id: 0,
  name: 'بقا (بی‌پایان)',
  subtitle: 'تا جایی که می‌توانی دوام بیاور',
  theme: 'day',
  skySun: true,
  startSun: 250,
  slots: 9,
  plants: PLANT_ORDER.slice(),
  endless: true,
};

// ساخت موج برای حالت بقا بر اساس شماره موج
export function survivalWave(n) {
  const budget = 1.2 + n * 1.35;
  const pool = [
    { t: 'basic', w: 1 },
    { t: 'cone', w: 2.2, min: 2 },
    { t: 'news', w: 2.4, min: 3 },
    { t: 'bucket', w: 4.2, min: 5 },
    { t: 'football', w: 6, min: 8 },
  ].filter((p) => !p.min || n >= p.min);

  const list = [];
  let left = budget;
  let guard = 0;
  while (left > 0.9 && guard++ < 80) {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick.w <= left || list.length === 0) {
      list.push(pick.t);
      left -= pick.w;
    } else {
      left -= 1;
    }
  }
  const big = n % 5 === 0;
  if (big) list.unshift('flag');
  return { delay: Math.max(22, 36 - n * 0.6), list, big };
}

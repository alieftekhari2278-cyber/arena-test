// شبیه‌سازی حداقلی DOM و Canvas تا بتوان هسته‌ی بازی را در Node اجرا کرد
const noop = () => {};

function makeCtx() {
  const grad = { addColorStop: noop };
  const target = {
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
    measureText: () => ({ width: 42 }),
  };
  return new Proxy(target, {
    get: (o, k) => (k in o ? o[k] : noop),
    set: (o, k, v) => ((o[k] = v), true),
  });
}

export function makeCanvas() {
  const c = {
    width: 1000,
    height: 600,
    style: {},
    addEventListener: noop,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }),
  };
  c.getContext = () => makeCtx();
  return c;
}

export function installStubs() {
  global.document = { createElement: () => makeCanvas(), addEventListener: noop };
  global.window = { addEventListener: noop, devicePixelRatio: 1 };
  global.requestAnimationFrame = () => 0;
  global.cancelAnimationFrame = noop;
  global.localStorage = { getItem: () => null, setItem: noop };
}

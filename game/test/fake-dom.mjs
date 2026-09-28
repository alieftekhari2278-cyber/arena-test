/**
 * یک DOM و Canvas تقلبی و بسیار سبک برای اجرای بازی در Node.js.
 * فقط همان APIهایی را دارد که کد بازی واقعاً استفاده می‌کند.
 */

class FakeClassList {
  constructor() {
    this.set = new Set();
  }
  add(...c) {
    c.forEach((x) => this.set.add(x));
  }
  remove(...c) {
    c.forEach((x) => this.set.delete(x));
  }
  toggle(c, force) {
    const on = force === undefined ? !this.set.has(c) : force;
    if (on) this.set.add(c);
    else this.set.delete(c);
  }
  contains(c) {
    return this.set.has(c);
  }
}

const gradientStub = { addColorStop() {} };

export function fakeCtx() {
  return new Proxy(
    {
      canvas: { width: 100, height: 100 },
      createLinearGradient: () => gradientStub,
      createRadialGradient: () => gradientStub,
      createPattern: () => null,
      measureText: () => ({ width: 10 }),
      setTransform() {},
    },
    {
      get: (t, p) => (p in t ? t[p] : () => {}),
      set: (t, p, v) => ((t[p] = v), true),
    }
  );
}

export class FakeEl {
  constructor(tag = 'div') {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.classList = new FakeClassList();
    this.style = new Proxy({}, { get: (t, p) => t[p] ?? '', set: (t, p, v) => ((t[p] = v), true) });
    this.dataset = {};
    this.textContent = '';
    this._html = '';
    this.hidden = false;
    this.listeners = {};
    this.width = 56;
    this.height = 56;
    this._cache = new Map();
  }
  set innerHTML(v) {
    this._html = v;
  }
  get innerHTML() {
    return this._html;
  }
  set className(v) {
    this.classList = new FakeClassList();
    String(v)
      .split(/\s+/)
      .filter(Boolean)
      .forEach((c) => this.classList.add(c));
  }
  get className() {
    return [...this.classList.set].join(' ');
  }
  getContext() {
    return fakeCtx();
  }
  addEventListener(type, fn) {
    (this.listeners[type] ||= []).push(fn);
  }
  removeEventListener() {}
  setAttribute(k, v) {
    this[k] = v;
  }
  getAttribute(k) {
    return this[k];
  }
  appendChild(c) {
    this.children.push(c);
    return c;
  }
  querySelector(sel) {
    if (!this._cache.has(sel)) {
      this._cache.set(sel, new FakeEl(String(sel).includes('canvas') ? 'canvas' : 'div'));
    }
    return this._cache.get(sel);
  }
  querySelectorAll() {
    return [];
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 892, height: 518 };
  }
}

/** globalهای لازم را نصب می‌کند و المنت ریشه را برمی‌گرداند. */
export function makeFakeDom() {
  const rootEl = new FakeEl('div');
  const store = new Map();
  globalThis.document = {
    createElement: (tag) => new FakeEl(tag),
    getElementById: () => rootEl,
    querySelector: () => rootEl,
  };
  globalThis.window = { devicePixelRatio: 1, addEventListener() {} };
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };
  globalThis.requestAnimationFrame = () => 0;
  return rootEl;
}

/* FlyWire v783 2D connectome simulator — browser client.
 *
 * The server owns the LIF simulation; this file only renders. Layout is
 * fetched once as a Float32 buffer, frames arrive as a small binary packet
 * (JSON header + Uint32 spike ids).
 */
'use strict';

const arena = document.getElementById('arena');
const actx = arena.getContext('2d');
const brain = document.getElementById('brain');
const bctx = brain.getContext('2d');

let META = null;
let XY = null;          // Float32Array [N*2], normalised 0..1
let CLS = null;         // Uint8Array [N]
let baseLayer = null;   // offscreen anatomy render
let glow = null, gctx = null;
let placingKind = null;
let running = true;

const api = (p, o) => fetch(p, o).then(r => r.ok ? r : Promise.reject(new Error(p + ' ' + r.status)));
const post = (body) => api('/api/control', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/* ------------------------------------------------------------------ boot */
async function boot() {
  META = await (await api('/api/meta')).json();

  document.getElementById('datasetLine').textContent =
    META.dataset + ' · leaky integrate-and-fire · ' + META.citation;
  document.getElementById('badgeNeurons').textContent =
    META.neurons.toLocaleString() + ' neurons';
  document.getElementById('badgeEdges').textContent =
    META.edges.toLocaleString() + ' connections (≥' + META.min_syn + ' synapses)';
  document.getElementById('cite').innerHTML =
    'Connectome: FlyWire FAFB v783, Zenodo <code>10.5281/zenodo.10676866</code>, CC-BY-4.0. ' +
    'Neuron/synapse parameters after Shiu et al. 2024. Annotations: Schlegel et al. 2024.';

  const lt = document.getElementById('lifTable');
  lt.innerHTML = Object.entries(META.lif)
    .map(([k, v]) => `<tr><td>${k.replace(/_/g, ' ')}</td><td>${v}</td></tr>`).join('');

  buildClassLegend();
  buildStimButtons();

  const buf = await (await api('/api/layout')).arrayBuffer();
  const n = META.neurons;
  XY = new Float32Array(buf, 0, n * 2);
  CLS = new Uint8Array(buf, n * 2 * 4, n);

  makeBaseLayer();
  wireControls();
  loop();
}

function buildClassLegend() {
  const el = document.getElementById('classLegend');
  const rows = META.super_class_names
    .map((name, i) => ({ name, i, c: META.super_class_counts[name] || 0 }))
    .sort((a, b) => b.c - a.c);
  el.innerHTML = rows.map(r =>
    `<div><i style="background:${META.colors[r.i]}"></i>${r.name} <b>${r.c.toLocaleString()}</b></div>`
  ).join('');
}

const STIM_LABEL = {
  photo_L: 'photoreceptors L', photo_R: 'photoreceptors R',
  orn_L: 'olfactory ORN L', orn_R: 'olfactory ORN R',
  dn_L: 'descending L', dn_R: 'descending R',
};

function buildStimButtons() {
  const host = document.getElementById('stimList');
  host.innerHTML = '';
  for (const [key, count] of Object.entries(META.populations)) {
    const b = document.createElement('button');
    b.innerHTML = `<span>${STIM_LABEL[key] || key}</span><small>${count.toLocaleString()}</small>`;
    b.onclick = () => {
      const on = b.classList.toggle('active');
      post({ action: 'stim', population: key, hz: on ? 400 : 0 });
    };
    host.appendChild(b);
  }
}

/* -------------------------------------------------------------- rendering */
function makeBaseLayer() {
  baseLayer = document.createElement('canvas');
  baseLayer.width = brain.width;
  baseLayer.height = brain.height;
  const c = baseLayer.getContext('2d');
  c.fillStyle = '#05080f';
  c.fillRect(0, 0, brain.width, brain.height);

  // Group by class so fillStyle changes once per class, not once per neuron.
  const pad = 22;
  const w = brain.width - pad * 2, h = brain.height - pad * 2;
  const byClass = new Map();
  for (let i = 0; i < CLS.length; i++) {
    let a = byClass.get(CLS[i]);
    if (!a) byClass.set(CLS[i], a = []);
    a.push(i);
  }
  c.globalAlpha = 0.5;
  for (const [cls, list] of byClass) {
    c.fillStyle = META.colors[cls] || '#6b7684';
    for (const i of list) {
      const x = pad + XY[i * 2] * w;
      const y = pad + (1 - XY[i * 2 + 1]) * h;
      c.fillRect(x, y, 1, 1);
    }
  }
  c.globalAlpha = 1;

  glow = document.createElement('canvas');
  glow.width = brain.width;
  glow.height = brain.height;
  gctx = glow.getContext('2d');
}

function drawBrain(spikes) {
  const pad = 22;
  const w = brain.width - pad * 2, h = brain.height - pad * 2;

  // Fade the previous spikes to leave a short afterglow.
  gctx.globalCompositeOperation = 'destination-out';
  gctx.fillStyle = 'rgba(0,0,0,0.30)';
  gctx.fillRect(0, 0, glow.width, glow.height);
  gctx.globalCompositeOperation = 'source-over';

  gctx.fillStyle = '#ffffff';
  for (let k = 0; k < spikes.length; k++) {
    const i = spikes[k];
    const x = pad + XY[i * 2] * w;
    const y = pad + (1 - XY[i * 2 + 1]) * h;
    gctx.fillRect(x - 0.5, y - 0.5, 2, 2);
  }

  bctx.drawImage(baseLayer, 0, 0);
  bctx.globalCompositeOperation = 'lighter';
  bctx.drawImage(glow, 0, 0);
  bctx.globalCompositeOperation = 'source-over';
}

const SRC_COLOR = { light: '#ffd34d', odor: '#4de0b4', aversive: '#ff6b5e' };

function drawArena(st) {
  const W = arena.width, H = arena.height;
  const sx = W / st.width, sy = H / st.height;

  actx.fillStyle = '#05080f';
  actx.fillRect(0, 0, W, H);

  // grid
  actx.strokeStyle = 'rgba(30,40,64,0.55)';
  actx.lineWidth = 1;
  actx.beginPath();
  for (let x = 0; x <= W; x += 50) { actx.moveTo(x, 0); actx.lineTo(x, H); }
  for (let y = 0; y <= H; y += 50) { actx.moveTo(0, y); actx.lineTo(W, y); }
  actx.stroke();

  // sources with falloff halo
  for (const s of st.sources) {
    const x = s.x * sx, y = s.y * sy, r = s.radius * sx;
    const col = SRC_COLOR[s.kind] || '#ffffff';
    const g = actx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hexA(col, 0.30 * s.strength));
    g.addColorStop(1, hexA(col, 0));
    actx.fillStyle = g;
    actx.beginPath(); actx.arc(x, y, r, 0, 6.2832); actx.fill();
    actx.fillStyle = col;
    actx.beginPath(); actx.arc(x, y, 6, 0, 6.2832); actx.fill();
  }

  // trail
  if (TRAIL.length > 1) {
    actx.strokeStyle = 'rgba(77,224,180,0.5)';
    actx.lineWidth = 1.6;
    actx.beginPath();
    actx.moveTo(TRAIL[0][0] * sx, TRAIL[0][1] * sy);
    for (let i = 1; i < TRAIL.length; i++) actx.lineTo(TRAIL[i][0] * sx, TRAIL[i][1] * sy);
    actx.stroke();
  }

  // agent
  const ax = st.x * sx, ay = st.y * sy, th = st.theta;
  actx.save();
  actx.translate(ax, ay);
  actx.rotate(th);
  actx.fillStyle = '#ffffff';
  actx.beginPath();
  actx.moveTo(15, 0); actx.lineTo(-9, 8); actx.lineTo(-5, 0); actx.lineTo(-9, -8);
  actx.closePath(); actx.fill();
  actx.strokeStyle = 'rgba(255,211,77,0.75)';
  actx.lineWidth = 1.2;
  for (const sgn of [1, -1]) {
    actx.beginPath();
    actx.moveTo(6, sgn * 4);
    actx.lineTo(6 + Math.cos(sgn * 0.96) * 26, sgn * 4 + Math.sin(sgn * 0.96) * 26);
    actx.stroke();
  }
  actx.restore();
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ------------------------------------------------------------------ loop */
let TRAIL = [];

async function loop() {
  try {
    const buf = await (await api('/api/frame')).arrayBuffer();
    const dv = new DataView(buf);
    const hlen = dv.getUint32(0, true);
    const info = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hlen)));
    const spikes = new Uint32Array(buf, 4 + hlen);

    const st = info.world;
    TRAIL.push([st.x, st.y]);
    if (TRAIL.length > 900) TRAIL.shift();

    drawArena(st);
    drawBrain(spikes);
    updateHud(info);
  } catch (e) {
    console.error(e);
    await new Promise(r => setTimeout(r, 500));
  }
  requestAnimationFrame(loop);
}

function setBar(id, v) {
  const el = document.getElementById(id);
  if (el) el.style.width = Math.max(0, Math.min(100, v * 100)) + '%';
}

function updateHud(info) {
  const s = info.sense || {};
  setBar('bar-eye_left', (s.eye_left || 0));
  setBar('bar-eye_right', (s.eye_right || 0));
  setBar('bar-odor_left', (s.odor_left || 0));
  setBar('bar-odor_right', (s.odor_right || 0));
  setBar('bar-dn_left', info.rate_dn_left / 4);
  setBar('bar-dn_right', info.rate_dn_right / 4);

  document.getElementById('stSim').textContent = (info.sim_ms / 1000).toFixed(2) + ' s';
  document.getElementById('stStep').textContent = info.step_ms.toFixed(1) + ' ms';
  document.getElementById('stActive').textContent =
    info.active.toLocaleString() + ' (' + info.active_pct + '%)';
  document.getElementById('stDn').textContent =
    info.rate_dn_left.toFixed(2) + ' / ' + info.rate_dn_right.toFixed(2) + ' Hz';
  document.getElementById('stSpeed').textContent = info.world.speed.toFixed(0) + ' u/s';
  document.getElementById('stHits').textContent = info.world.collisions;
}

/* -------------------------------------------------------------- controls */
function wireControls() {
  const play = document.getElementById('btnPlay');
  play.onclick = () => {
    running = !running;
    play.textContent = running ? 'Pause' : 'Play';
    post({ action: running ? 'play' : 'pause' });
  };

  document.getElementById('btnReset').onclick = () => {
    TRAIL = [];
    post({ action: 'reset' });
  };

  const sp = document.getElementById('speed');
  sp.oninput = () => {
    document.getElementById('speedVal').textContent = sp.value;
    post({ action: 'speed', value: +sp.value });
  };

  document.querySelectorAll('[data-kind]').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('[data-kind]').forEach(o => o.classList.remove('active'));
      if (placingKind === b.dataset.kind) { placingKind = null; return; }
      placingKind = b.dataset.kind;
      b.classList.add('active');
    };
  });

  const ap = document.getElementById('btnApproach');
  const av = document.getElementById('btnAvoid');
  const setMode = (sign) => {
    ap.classList.toggle('active', sign > 0);
    av.classList.toggle('active', sign < 0);
    post({ action: 'coupling', values: { turn_sign: sign } });
  };
  ap.onclick = () => setMode(+1);
  av.onclick = () => setMode(-1);

  document.getElementById('btnClearSrc').onclick = () => post({ action: 'clear_sources' });
  document.getElementById('btnResetSrc').onclick = () => post({ action: 'reset_sources' });

  arena.addEventListener('click', ev => {
    const r = arena.getBoundingClientRect();
    const x = (ev.clientX - r.left) / r.width * META.world.width;
    const y = (ev.clientY - r.top) / r.height * META.world.height;
    post({ action: 'add_source', x, y, kind: placingKind || 'light', strength: 1.0 });
  });
}

boot().catch(e => {
  document.getElementById('datasetLine').textContent = 'failed to start: ' + e.message;
  console.error(e);
});

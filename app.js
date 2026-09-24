const state = {
  graph: null,
  selected: null,
  motion: true,
  labels: true,
  zoom: 1,
  offset: { x: 0, y: 0 },
  dragging: false,
  lastPointer: null,
  raf: 0,
  lastFrame: 0,
};

const el = (id) => document.getElementById(id);
const canvas = el("networkCanvas");
const ctx = canvas.getContext("2d");
const canvasWrap = el("canvasWrap");

const demoRoot = "720575940000000001";
const demoLabel = "نمونه نمایشی";

function formatNumber(value) {
  return new Intl.NumberFormat("fa-IR").format(Number(value) || 0);
}

function shortId(value) {
  const text = String(value);
  return text.length > 20 ? `${text.slice(0, 8)}…${text.slice(-7)}` : text;
}

function getRoleLabel(role) {
  return role === "target" ? "TARGET" : role === "pre" ? "PRESYNAPTIC" : "POSTSYNAPTIC";
}

function setLoading(show) {
  el("canvasLoading").hidden = !show;
}

function setRangeFill() {
  const range = el("synapseRange");
  const percent = ((range.value - range.min) / (range.max - range.min)) * 100;
  range.style.background = `linear-gradient(90deg, var(--cyan) 0 ${percent}%, rgba(255,255,255,.14) ${percent}% 100%)`;
  el("synapseValue").value = range.value;
  el("synapseValue").textContent = formatNumber(range.value);
}

function drawRoundedCircle(x, y, r, color, glow = false) {
  ctx.save();
  if (glow) { ctx.shadowColor = color; ctx.shadowBlur = 17; }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawGraph();
}

function graphArea() {
  return { width: canvas.clientWidth, height: canvas.clientHeight };
}

function positionNodes(graph) {
  const { width, height } = graphArea();
  const center = graph.nodes.find((node) => node.role === "target") || graph.nodes[0];
  const others = graph.nodes.filter((node) => node !== center);
  const radius = Math.min(width, height) * 0.31;
  center.x = width / 2;
  center.y = height / 2;
  center.vx = 0;
  center.vy = 0;
  others.forEach((node, index) => {
    const angle = (index / Math.max(others.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const ring = radius * (index % 2 ? 1 : .77);
    node.x = width / 2 + Math.cos(angle) * ring;
    node.y = height / 2 + Math.sin(angle) * ring;
    node.vx = 0;
    node.vy = 0;
  });
  state.offset = { x: 0, y: 0 };
  state.zoom = 1;
}

function updateLayout(dt) {
  if (!state.graph || !state.motion) return;
  const nodes = state.graph.nodes;
  const center = nodes.find((node) => node.role === "target");
  if (!center) return;
  const others = nodes.filter((node) => node !== center);
  others.forEach((node, index) => {
    const desiredAngle = (index / Math.max(others.length, 1)) * Math.PI * 2 + state.lastFrame * .00018;
    const desiredRadius = Math.min(canvas.clientWidth, canvas.clientHeight) * (index % 2 ? .31 : .24);
    const targetX = center.x + Math.cos(desiredAngle) * desiredRadius;
    const targetY = center.y + Math.sin(desiredAngle) * desiredRadius;
    node.vx = (node.vx + (targetX - node.x) * .0007 * dt) * .96;
    node.vy = (node.vy + (targetY - node.y) * .0007 * dt) * .96;
    node.x += node.vx;
    node.y += node.vy;
  });
}

function toScreen(point) {
  return { x: (point.x + state.offset.x - canvas.clientWidth / 2) * state.zoom + canvas.clientWidth / 2, y: (point.y + state.offset.y - canvas.clientHeight / 2) * state.zoom + canvas.clientHeight / 2 };
}

function drawGraph() {
  const { width, height } = graphArea();
  ctx.clearRect(0, 0, width, height);
  if (!state.graph || !state.graph.nodes.length) return;
  const byId = new Map(state.graph.nodes.map((node) => [String(node.id), node]));

  state.graph.edges.forEach((edge) => {
    const source = byId.get(String(edge.source));
    const target = byId.get(String(edge.target));
    if (!source || !target) return;
    const a = toScreen(source); const b = toScreen(target);
    const weight = Math.max(1, Math.min(4.3, 0.8 + Math.log10(Number(edge.syn_count) + 1) * 1.25)) * state.zoom;
    ctx.save();
    ctx.globalAlpha = Math.min(.74, .23 + Number(edge.syn_count) / Math.max(state.graph.maxSynapses, 1) * .55);
    ctx.strokeStyle = edge.direction === "in" ? "#ff9d5c" : "#9e9dff";
    ctx.lineWidth = weight;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    const arrowSize = Math.max(4, 7 * state.zoom);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const endX = b.x - Math.cos(angle) * 13 * state.zoom;
    const endY = b.y - Math.sin(angle) * 13 * state.zoom;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath(); ctx.moveTo(endX, endY); ctx.lineTo(endX - Math.cos(angle - Math.PI / 6) * arrowSize, endY - Math.sin(angle - Math.PI / 6) * arrowSize); ctx.lineTo(endX - Math.cos(angle + Math.PI / 6) * arrowSize, endY - Math.sin(angle + Math.PI / 6) * arrowSize); ctx.closePath(); ctx.fill();
    ctx.restore();
  });

  state.graph.nodes.forEach((node) => {
    const point = toScreen(node);
    const isSelected = state.selected && String(state.selected.id) === String(node.id);
    const radius = (node.role === "target" ? 9 : 5.5) * state.zoom;
    const color = node.role === "target" ? "#56e5dd" : node.role === "pre" ? "#ff9d5c" : "#9e9dff";
    if (isSelected) {
      ctx.save(); ctx.globalAlpha = .35; ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(point.x, point.y, radius + 8 * state.zoom, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    drawRoundedCircle(point.x, point.y, radius, color, node.role === "target");
    if (state.labels && (node.role === "target" || state.zoom > .88)) {
      ctx.save(); ctx.direction = "ltr"; ctx.font = `${node.role === "target" ? 10 : 8}px IBM Plex Mono, monospace`; ctx.fillStyle = node.role === "target" ? "#edf4fb" : "#8ea4ba"; ctx.textAlign = "center"; ctx.fillText(node.role === "target" ? "TARGET" : shortId(node.id), point.x, point.y + radius + 17); ctx.restore();
    }
  });
}

function animationFrame(timestamp) {
  const dt = Math.min(50, timestamp - (state.lastFrame || timestamp));
  state.lastFrame = timestamp;
  updateLayout(dt);
  drawGraph();
  state.raf = requestAnimationFrame(animationFrame);
}

function updateInspector(node) {
  if (!node) return;
  state.selected = node;
  el("selectedNodeName").textContent = node.role === "target" ? (state.graph?.mode === "demo" ? demoLabel : "نورون هدف") : node.role === "pre" ? "نورون پیش‌سیناپسی" : "نورون پس‌سیناپسی";
  el("selectedNodeId").textContent = String(node.id);
  el("selectedNodeRole").textContent = getRoleLabel(node.role);
  el("selectedNodeEdges").textContent = formatNumber(node.degree || 0);
  el("selectedNeuropil").textContent = node.topNeuropil || "—";
  el("selectedSynapses").textContent = node.topSynapses ? formatNumber(node.topSynapses) : "—";
}

function bindGraph(graph) {
  state.graph = graph;
  const target = graph.nodes.find((node) => node.role === "target") || graph.nodes[0];
  positionNodes(graph);
  updateInspector(target);
  el("viewportMode").textContent = graph.mode === "full" ? "FULL FEATHER / PROOFREAD DATA" : "DEMO GRAPH / LOCAL DATA NOT FOUND";
  el("integrityStatus").textContent = graph.mode === "full" ? "VERIFIED" : "DEMO ONLY";
  el("integrityStatus").style.color = graph.mode === "full" ? "var(--green)" : "var(--orange)";
  el("canvasEmpty").hidden = true;
  drawGraph();
}

async function loadGraph() {
  const root = el("rootInput").value.trim() || "auto";
  const minSyn = el("synapseRange").value;
  const limit = el("limitSelect").value;
  setLoading(true); el("canvasEmpty").hidden = true;
  try {
    const response = await fetch(`/api/graph?root=${encodeURIComponent(root)}&min_synapses=${minSyn}&limit=${limit}`, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`graph_${response.status}`);
    const graph = await response.json();
    if (!graph.nodes?.length) { el("canvasEmpty").hidden = false; state.graph = null; drawGraph(); return; }
    if (graph.target_id) el("rootInput").value = graph.target_id;
    bindGraph(graph);
  } catch (error) {
    console.warn("Graph API unavailable; keeping the visual shell usable.", error);
    el("dataStatusText").textContent = "حالت آفلاین: گراف نمونه فعال است";
  } finally { setLoading(false); }
}

async function loadStatus() {
  try {
    const response = await fetch("/api/status", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("status");
    const status = await response.json();
    const full = status.available;
    el("topStatus").textContent = full ? "داده کامل متصل است" : "حالت نمونه فعال است";
    el("dataStatusText").textContent = full ? `فایل کامل متصل است · ${status.size_label}` : "فایل محلی پیدا نشد · گراف نمونه برای پیش‌نمایش فعال است";
    el("datasetProgressLabel").textContent = full ? "متصل و بررسی‌شده" : "در انتظار فایل";
    el("datasetProgress").style.width = full ? "100%" : "7%";
    el("datasetProgressLabel").style.color = full ? "var(--green)" : "var(--orange)";
    if (full) { el("rootInput").value = "auto"; el("rootHelp").textContent = "اولین root ID واقعی از فایل محلی انتخاب می‌شود."; }
  } catch (error) {
    el("topStatus").textContent = "حالت نمونه فعال است";
    el("dataStatusText").textContent = "سرور داده در دسترس نیست · شبیه‌ساز نمونه فعال است";
  }
}

function toggleButton(button, callback) {
  const enabled = !button.classList.contains("is-on");
  button.classList.toggle("is-on", enabled); button.setAttribute("aria-checked", String(enabled)); callback(enabled);
}

function hitTest(clientX, clientY) {
  if (!state.graph) return null;
  const rect = canvas.getBoundingClientRect(); const point = { x: clientX - rect.left, y: clientY - rect.top };
  return state.graph.nodes.find((node) => { const screen = toScreen(node); return Math.hypot(screen.x - point.x, screen.y - point.y) < Math.max(12, 10 * state.zoom); });
}

function bindInteractions() {
  el("searchButton").addEventListener("click", loadGraph);
  el("rootInput").addEventListener("keydown", (event) => { if (event.key === "Enter") loadGraph(); });
  el("synapseRange").addEventListener("input", () => { setRangeFill(); });
  el("synapseRange").addEventListener("change", loadGraph);
  el("limitSelect").addEventListener("change", loadGraph);
  el("motionToggle").addEventListener("click", () => toggleButton(el("motionToggle"), (on) => { state.motion = on; }));
  el("labelsToggle").addEventListener("click", () => toggleButton(el("labelsToggle"), (on) => { state.labels = on; drawGraph(); }));
  el("resetButton").addEventListener("click", () => { if (state.graph) { positionNodes(state.graph); drawGraph(); } });
  el("fitButton").addEventListener("click", () => { state.zoom = 1; state.offset = { x: 0, y: 0 }; drawGraph(); });
  el("zoomIn").addEventListener("click", () => { state.zoom = Math.min(2.6, state.zoom * 1.18); drawGraph(); });
  el("zoomOut").addEventListener("click", () => { state.zoom = Math.max(.45, state.zoom / 1.18); drawGraph(); });
  canvasWrap.addEventListener("wheel", (event) => { event.preventDefault(); state.zoom = Math.max(.45, Math.min(2.6, state.zoom * (event.deltaY > 0 ? .91 : 1.1))); drawGraph(); }, { passive: false });
  canvasWrap.addEventListener("pointerdown", (event) => { state.dragging = true; state.lastPointer = { x: event.clientX, y: event.clientY }; canvasWrap.classList.add("is-dragging"); canvasWrap.setPointerCapture(event.pointerId); });
  canvasWrap.addEventListener("pointermove", (event) => { if (!state.dragging) return; const dx = event.clientX - state.lastPointer.x; const dy = event.clientY - state.lastPointer.y; state.offset.x += dx / state.zoom; state.offset.y += dy / state.zoom; state.lastPointer = { x: event.clientX, y: event.clientY }; drawGraph(); });
  const endDrag = (event) => { if (!state.dragging) return; state.dragging = false; canvasWrap.classList.remove("is-dragging"); try { canvasWrap.releasePointerCapture(event.pointerId); } catch (_) {} };
  canvasWrap.addEventListener("pointerup", endDrag); canvasWrap.addEventListener("pointercancel", endDrag);
  canvasWrap.addEventListener("click", (event) => { if (state.dragging) return; const node = hitTest(event.clientX, event.clientY); if (node) { updateInspector(node); drawGraph(); } });
  window.addEventListener("resize", resizeCanvas);
}

setRangeFill();
bindInteractions();
resizeCanvas();
loadStatus().then(loadGraph);
state.raf = requestAnimationFrame(animationFrame);

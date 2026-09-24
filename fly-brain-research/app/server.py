"""
Live whole-brain fruit-fly arena server.
Complete FlyWire v783 connectome (138,639 neurons / 15.1M edges / 54.5M synapses)
running as a Shiu-et-al-2024 LIF network, embodied in a 2D foraging arena.
Serves a Persian RTL web UI + WebSocket live stream.
"""
import asyncio
import json
import threading
import time

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse

from flybrain_engine import Engine

W, H = 1000.0, 700.0
SENSE_R, F_MAX = 170.0, 150.0
EAT_R = 30.0
SPEED_BASE, TURN_GAIN = 420.0, 5.5
TICK_MS = 10.0
TICK_S = TICK_MS * 1e-3

app = FastAPI()

# ---------------- shared state ----------------
lock = threading.Lock()
eng = None
stage = "loading"          # loading -> calibrating -> ready
boot_info = {}
arena = {
    "fly": {"x": W / 2, "y": H / 2, "th": 0.0},
    "foods": [{"x": 260, "y": 210, "kind": "sugar"}, {"x": 720, "y": 480, "kind": "sugar"},
              {"x": 640, "y": 160, "kind": "sugar"}, {"x": 360, "y": 520, "kind": "bitter"}],
    "fed": 0, "bitter_hits": 0, "events": [], "ev_seq": 0,
    "meters": {"sugarL": 0, "sugarR": 0, "bitterL": 0, "bitterR": 0, "dnL": 0, "dnR": 0},
    "stats": {"spikes": 0, "active": 0, "bio_ms": 0.0},
}
ctl = {"running": True, "speed": 0.06, "invert": False, "explore": True, "ambient": True}
pending_opto = []


def boot():
    global eng, stage, boot_info
    try:
        eng = Engine()
        stage = "calibrating"
        cal = eng.calibrate(verbose=True)
        eng.classcode[eng.dnL] = 3
        eng.classcode[eng.dnR] = 3
        boot_info = cal
        # circuit laterality is mixed/nonlinear — default sign chosen empirically; user can toggle
        stage = "ready"
        normalize_pos()
        print(f"[boot] ready — DN readout: {cal['type']} "
              f"(ipsi sugar {cal['ipsiL']:.0f}/{cal['ipsiR']:.0f} Hz, bitter {cal['bitter']:.0f} Hz)", flush=True)
        threading.Thread(target=sim_loop, daemon=True).start()
    except Exception as e:
        stage = "error"
        boot_info = {"error": str(e)}
        print("[boot] FAILED:", e, flush=True)


def wrap(d, s):
    return ((d + s / 2) % s) - s / 2


def sim_loop():
    global pending_opto
    rng = np.random.default_rng(11)
    noise = 0.0
    last = time.time()
    acc = 0.0
    stat_t = time.time()
    while True:
        time.sleep(0.04)
        now = time.time()
        if stage != "ready" or not ctl["running"]:
            last = now
            continue
        acc = min(acc + (now - last) * 1000.0 * ctl["speed"], 120.0)
        last = now
        ticks = 0
        while acc >= TICK_MS and ticks < 8:
            with lock:
                fly = arena["fly"]
                foods = arena["foods"]
                if pending_opto:
                    _, nx, ny = pending_opto.pop(0)
                    d = np.sqrt((eng.nx_pos - nx) ** 2 + (eng.ny_pos - ny) ** 2)
                    near = np.nonzero(d < 0.045)[0]
                    if len(near) == 0:
                        near = np.argsort(d)[:20]
                    elif len(near) > 400:
                        near = near[np.argpartition(d[near], 400)[:400]]
                    eng.opto = (near.astype(np.int32), 150.0, eng.bio_ms + 400.0)
            # --- sensory: food -> GRN Poisson rates ---
            fx, fy, th = fly["x"], fly["y"], fly["th"]
            fwd = (np.cos(th), np.sin(th))
            rgt = (-np.sin(th), np.cos(th))
            sL = sR = bL = bR = 0.0
            for f in list(foods):
                dx, dy = wrap(f["x"] - fx, W), wrap(f["y"] - fy, H)
                d2 = dx * dx + dy * dy
                if d2 > SENSE_R * SENSE_R:
                    continue
                d = np.sqrt(d2) + 1e-6
                ux, uy = dx / d, dy / d
                side = ux * rgt[0] + uy * rgt[1]
                # direction carried entirely by the L/R ratio (as in firefly-brain)
                wgt = F_MAX * np.exp(-d / SENSE_R)
                r, l = wgt * (0.5 + 0.5 * side), wgt * (0.5 - 0.5 * side)
                if f["kind"] == "sugar":
                    sR, sL = sR + r, sL + l
                else:
                    bR, bL = bR + r, bL + l
            eng.drive = {"sugarL": min(sL, F_MAX), "sugarR": min(sR, F_MAX),
                         "bitterL": min(bL, F_MAX), "bitterR": min(bR, F_MAX)}
            # --- brain: run TICK_MS of biological time ---
            eng.run_ms(TICK_MS)
            # --- motor: DN rates -> turn & speed ---
            rL, rR = eng.group_rate(eng.dnL), eng.group_rate(eng.dnR)
            asym = (rR - rL) / (rR + rL + 1e-3)
            turn = TURN_GAIN * asym * (-1.0 if ctl["invert"] else 1.0)
            if ctl["explore"]:
                noise += (-noise / 0.6) * TICK_S + 1.4 * np.sqrt(TICK_S) * rng.standard_normal()
                turn += noise
            th = fly["th"] + turn * TICK_S
            act = min(1.0, 0.5 * (rL + rR) / max(eng.dn_norm, 1.0))
            sp = SPEED_BASE * (1.05 - 0.65 * act)   # slows when DN active -> tighter turning
            x = (fly["x"] + np.cos(th) * sp * TICK_S) % W
            y = (fly["y"] + np.sin(th) * sp * TICK_S) % H
            fly.update(x=x, y=y, th=th)
            # --- eating ---
            with lock:
                keep = []
                for f in foods:
                    d2 = wrap(f["x"] - x, W) ** 2 + wrap(f["y"] - y, H) ** 2
                    if d2 < EAT_R * EAT_R and f["kind"] == "sugar":
                        arena["fed"] += 1
                        arena["ev_seq"] += 1
                        arena["events"].append({"id": arena["ev_seq"], "kind": "eat", "x": f["x"], "y": f["y"]})
                    elif d2 < EAT_R * EAT_R and f["kind"] == "bitter":
                        arena["bitter_hits"] += 1
                        arena["ev_seq"] += 1
                        arena["events"].append({"id": arena["ev_seq"], "kind": "bitter", "x": f["x"], "y": f["y"]})
                        keep.append(f)
                    else:
                        keep.append(f)
                arena["foods"][:] = keep
                arena["meters"] = {"sugarL": sL, "sugarR": sR, "bitterL": bL, "bitterR": bR,
                                   "dnL": rL, "dnR": rR}
            acc -= TICK_MS
            ticks += 1
        if ticks >= 8:
            acc = 0.0
        if time.time() - stat_t > 1.0:
            stat_t = time.time()
            arena["stats"].update(spikes=eng.total_spikes, active=int((eng.rate > 5).sum()),
                                  bio_ms=eng.bio_ms)


def normalize_pos():
    p = eng.pos.astype(np.float64)
    nx = (p[:, 0] - p[:, 0].min()) / (np.ptp(p[:, 0]) + 1e-9)
    ny = (p[:, 1] - p[:, 1].min()) / (np.ptp(p[:, 1]) + 1e-9)
    eng.nx_pos, eng.ny_pos = nx.astype(np.float32), ny.astype(np.float32)


@app.get("/")
def index():
    return FileResponse("index.html", headers={"Cache-Control": "no-store"})


@app.get("/api/status")
def status():
    return {"stage": stage, "boot": {k: v for k, v in boot_info.items() if k not in ("dnL", "dnR", "top")}
            if isinstance(boot_info, dict) else {},
            "n": eng.N if eng else None, "edges": eng.n_edges if eng else 0,
            "syn": eng.n_syn if eng else 0}


@app.websocket("/ws")
async def ws(ws: WebSocket):
    await ws.accept()
    last_ev = 0
    prev = {"t": time.time(), "bio": 0.0, "spk": 0}
    await ws.send_text(json.dumps({"type": "hello", "stage": stage}))
    if stage == "ready":
        n = eng.N
        b = np.empty((n, 5), np.uint8)
        b[:, 0:2] = (eng.nx_pos * 4095).astype(np.int16).view(np.uint8).reshape(n, 2)
        b[:, 2:4] = (eng.ny_pos * 4095).astype(np.int16).view(np.uint8).reshape(n, 2)
        b[:, 4] = eng.classcode
        await ws.send_text(json.dumps({
            "type": "init", "n": n, "edges": eng.n_edges, "syn": eng.n_syn,
            "dn": boot_info["type"], "cal": {k: boot_info[k] for k in ("ipsiL", "ipsiR", "bitter", "norm")},
            "groups": {k: len(v) for k, v in eng.groups.items()},
            "world": [W, H], "senseR": SENSE_R, "eatR": EAT_R}))
        await ws.send_bytes(b.tobytes())
        last_ev = arena["ev_seq"]
    try:
        while True:
            # receive controls while sending snapshots every ~120 ms
            try:
                msg = await asyncio.wait_for(ws.receive_text(), timeout=0.12)
                m = json.loads(msg)
                t = m.get("type")
                if t == "food" and stage == "ready":
                    with lock:
                        if len(arena["foods"]) < 60:
                            arena["foods"].append({"x": float(np.clip(m["x"], 0, W)),
                                                   "y": float(np.clip(m["y"], 0, H)),
                                                   "kind": m.get("kind", "sugar")})
                elif t == "clear":
                    with lock:
                        arena["foods"][:] = []
                elif t == "reset":
                    with lock:
                        arena["fly"].update(x=W / 2, y=H / 2, th=0.0)
                elif t == "ctl":
                    for k in ("running", "speed", "invert", "explore"):
                        if k in m:
                            ctl[k] = m[k]
                elif t == "stim" and stage == "ready":
                    pending_opto.append((None, float(np.clip(m["x"], 0, 1)), float(np.clip(m["y"], 0, 1))))
            except asyncio.TimeoutError:
                pass
            if stage != "ready":
                await ws.send_text(json.dumps({"type": "stage", "stage": stage}))
                await asyncio.sleep(0.5)
                continue
            now = time.time()
            d_bio = eng.bio_ms - prev["bio"]
            d_spk = eng.total_spikes - prev["spk"]
            d_t = max(now - prev["t"], 1e-3)
            bio_rate = d_bio / d_t / 1000.0
            rate = eng.rate
            idx = np.nonzero(rate > 5.0)[0]
            if len(idx) > 3500:
                idx = idx[np.argpartition(-rate[idx], 3500)[:3500]]
            with lock:
                snap = {"type": "state", "fly": dict(arena["fly"]), "foods": [dict(f) for f in arena["foods"]],
                        "meters": dict(arena["meters"]),
                        "stats": {"bioRate": round(bio_rate, 4), "spikesPerSec": int(d_spk / d_t),
                                  "active": int(arena["stats"]["active"]), "fed": arena["fed"],
                                  "bitterHits": arena["bitter_hits"], "bioS": round(eng.bio_ms / 1000.0, 1),
                                  "totalSpikes": eng.total_spikes},
                        "ctl": dict(ctl),
                        "events": [e for e in arena["events"] if e["id"] > last_ev][-8:]}
                last_ev = arena["ev_seq"]
                arena["events"][:] = arena["events"][-50:]
            snap["brain"] = {"i": idx.astype(np.int32).tolist(),
                             "r": np.round(rate[idx], 1).tolist()}
            await ws.send_text(json.dumps(snap))
            prev = {"t": now, "bio": eng.bio_ms, "spk": eng.total_spikes}
    except (WebSocketDisconnect, Exception):
        pass


if __name__ == "__main__":
    import uvicorn
    threading.Thread(target=boot, daemon=True).start()
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="warning")

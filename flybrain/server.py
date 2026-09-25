"""
server.py — runs the whole brain in one thread and streams it to the browser.

  GET  /                 the 2D environment
  GET  /api/neurons.bin  x, y and class of all 139,255 neurons (1.1 MB, once)
  GET  /api/meta         label tables, group sizes, model parameters
  GET  /api/stream       server-sent events, one frame ~20x per second
  POST /api/cmd          place food, stimulate a cell class, change parameters

Spikes are streamed as delta-encoded varints in base64: with a few thousand
neurons firing per frame that is a handful of kilobytes, so the browser can
show every single neuron that fired without any subsampling.
"""
import base64
import json
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.expanduser("~/.pylibs"))
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from brain import FlyBrain, V_REST, V_THRESH, W_SYN, T_MBR, TAU, T_RFC, T_DLY  # noqa: E402
from world import World, ARENA_W, ARENA_H  # noqa: E402

WEB = os.path.join(HERE, "web")
BUILD = os.path.join(os.path.dirname(HERE), "data", "build")


def varint_b64(idx):
    """Sorted neuron indices -> delta varint -> base64 (about 1 byte per spike)."""
    out = bytearray()
    prev = 0
    for i in idx:
        d = int(i) - prev
        prev = int(i)
        while d >= 0x80:
            out.append((d & 0x7F) | 0x80)
            d >>= 7
        out.append(d)
    return base64.b64encode(bytes(out)).decode()


class Sim:
    def __init__(self):
        self.brain = FlyBrain(graph="full", dt=0.6)
        self.world = World(self.brain)
        self.lock = threading.Lock()
        self.cond = threading.Condition()
        self.frame = None
        self.frame_id = 0
        self.running = True
        self.paused = False
        self.ms_per_frame = 24.0
        self.manual = {}         # group -> Hz, set from the UI
        self.wall_per_frame = 0.0
        self.thread = threading.Thread(target=self.loop, daemon=True)
        self.thread.start()

    # ------------------------------------------------------------------ loop
    def loop(self):
        while self.running:
            if self.paused:
                time.sleep(0.05)
                continue
            t0 = time.time()
            with self.lock:
                b, w = self.brain, self.world
                w.sense()
                for gname, hz in self.manual.items():
                    if hz > 0:
                        b.set_drive(w.idx.get(gname, np.array([], dtype=np.int64)), hz)
                n_steps = max(1, int(round(self.ms_per_frame / b.dt)))
                fired = np.zeros(b.N, dtype=bool)
                n_spk = 0
                for _ in range(n_steps):
                    idx = b.step()
                    if idx.size:
                        fired[idx] = True
                        n_spk += idx.size
                motor = w.act(n_steps * b.dt)
                spk_idx = np.flatnonzero(fired)
                frame = self.pack(spk_idx, n_spk, motor, n_steps)
            self.wall_per_frame = time.time() - t0
            frame["wall_ms"] = round(self.wall_per_frame * 1000, 1)
            frame["speed_ratio"] = round((n_steps * self.brain.dt) / max(self.wall_per_frame * 1000, 1e-6), 3)
            with self.cond:
                self.frame = frame
                self.frame_id += 1
                self.cond.notify_all()
            # keep the loop from starving the http threads
            time.sleep(max(0.0, 0.045 - (time.time() - t0)))

    def pack(self, spk_idx, n_spk, motor, n_steps):
        b, w = self.brain, self.world
        body = w.body
        pops = {
            "photoreceptor": b.pop_rate(np.concatenate([w.idx["photoreceptor_left"], w.idx["photoreceptor_right"]])),
            "orn": b.pop_rate(np.concatenate([w.idx["orn_left"], w.idx["orn_right"]])),
            "mechano": b.pop_rate(np.concatenate([w.idx["mechano_left"], w.idx["mechano_right"]])),
            "visual_projection": b.pop_rate(w.idx["visual_projection"]),
            "kenyon": b.pop_rate(w.idx["kenyon"]),
            "central_complex": b.pop_rate(w.idx["central_complex"]),
            "mbon": b.pop_rate(w.idx["mbon"]),
            "dan": b.pop_rate(w.idx["dan"]),
            "dn": b.pop_rate(w.idx["dn_all"]),
            "motor": b.pop_rate(w.idx["motor"]),
            "feeding": b.pop_rate(w.idx.get("mn_feed", w.idx["mn9"])),
            "grooming": b.pop_rate(w.idx.get("dn_groom", w.idx["dn_all"])),
        }
        return {
            "t": round(b.t_ms, 1),
            "spk": varint_b64(spk_idx),
            "n_unique": int(spk_idx.size),
            "n_spk": int(n_spk),
            "steps": n_steps,
            "fly": {"x": round(body.x, 3), "y": round(body.y, 3), "th": round(body.th, 4),
                    "v": round(body.speed, 2), "w": round(body.omega, 3),
                    "prob": round(body.proboscis, 3), "groom": round(body.grooming, 3),
                    "meals": body.meals, "bumps": body.bumps},
            "obj": [{"k": o["kind"], "x": round(o["x"], 2), "y": round(o["y"], 2),
                     "r": o["r"], "a": round(o["amount"], 2)} for o in w.objects],
            "trail": w.trail[-260:],
            "motor": motor,
            "sens": w.sensor_state,
            "pops": {k: round(v, 2) for k, v in pops.items()},
            "paused": self.paused,
        }

    # ------------------------------------------------------------------ cmds
    def command(self, c):
        with self.lock:
            b, w = self.brain, self.world
            kind = c.get("cmd")
            if kind == "place":
                w.add_object(c["kind"], c["x"], c["y"])
            elif kind == "clear":
                w.clear_objects()
            elif kind == "reset_objects":
                w.reset_objects()
            elif kind == "fly":
                w.body.x, w.body.y = float(c["x"]), float(c["y"])
                w.trail.clear()
            elif kind == "cfg":
                if c["key"] in w.cfg:
                    w.cfg[c["key"]] = float(c["value"]) if not isinstance(w.cfg[c["key"]], bool) else bool(c["value"])
                    if c["key"] == "adapt_mV":
                        b.set_adaptation(w.cfg["adapt_mV"])
            elif kind == "stim":
                self.manual[c["group"]] = float(c["hz"])
            elif kind == "speed":
                self.ms_per_frame = max(1.0, min(120.0, float(c["value"])))
            elif kind == "pause":
                self.paused = bool(c["value"])
            elif kind == "reset_brain":
                b.reset_state()
            elif kind == "graph":
                b.load_graph(c["value"])
            elif kind == "wind":
                w.wind_dir = float(c.get("dir", 0.0))
                w.wind_speed = float(c.get("speed", 0.0))
        return {"ok": True}

    def info(self):
        b, w = self.brain, self.world
        return {
            "n_neurons": b.N,
            "n_edges": b.n_edges,
            "n_synapses": int(round(b.n_synapses)),
            "graph": b.graph_name,
            "dt": b.dt,
            "labels": b.meta["labels"],
            "group_sizes": b.meta["group_sizes"],
            "arena": [ARENA_W, ARENA_H],
            "params": {"V_rest": V_REST, "V_thresh": V_THRESH, "W_syn": W_SYN,
                       "T_mbr": T_MBR, "tau": TAU, "T_rfc": T_RFC, "T_dly": T_DLY},
            "cfg": w.cfg,
            "ms_per_frame": self.ms_per_frame,
        }


SIM = None


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "flybrain/1.0"

    def log_message(self, *a):
        pass

    def _send(self, code, ctype, body, extra=None):
        if isinstance(body, str):
            body = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/":
            path = "/index.html"
        if path == "/api/meta":
            return self._send(200, "application/json", json.dumps(SIM.info()))
        if path == "/api/neurons.bin":
            with open(os.path.join(BUILD, "neurons.bin"), "rb") as f:
                return self._send(200, "application/octet-stream", f.read())
        if path == "/api/stream":
            return self.stream()
        fp = os.path.join(WEB, path.lstrip("/"))
        if os.path.isfile(fp):
            ctype = {".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8",
                     ".css": "text/css; charset=utf-8"}.get(os.path.splitext(fp)[1], "application/octet-stream")
            with open(fp, "rb") as f:
                return self._send(200, ctype, f.read())
        self._send(404, "text/plain", "not found")

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(n) or b"{}")
        if self.path.split("?")[0] == "/api/cmd":
            return self._send(200, "application/json", json.dumps(SIM.command(body)))
        self._send(404, "text/plain", "not found")

    def stream(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache, no-transform")
        self.send_header("Connection", "keep-alive")
        self.send_header("X-Accel-Buffering", "no")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        last = -1
        try:
            while True:
                with SIM.cond:
                    SIM.cond.wait_for(lambda: SIM.frame_id != last, timeout=5.0)
                    if SIM.frame is None:
                        continue
                    last = SIM.frame_id
                    payload = json.dumps(SIM.frame, separators=(",", ":"))
                self.wfile.write(b"data: " + payload.encode() + b"\n\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, ValueError):
            pass


def main():
    global SIM
    port = int(os.environ.get("PORT", "8000"))
    print("loading the FlyWire FAFB v783 connectome ...", flush=True)
    SIM = Sim()
    info = SIM.info()
    print(f"  {info['n_neurons']:,} neurons | {info['n_edges']:,} connections | "
          f"{info['n_synapses']:,} synapses", flush=True)
    srv = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    srv.daemon_threads = True
    print(f"listening on http://0.0.0.0:{port}", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()

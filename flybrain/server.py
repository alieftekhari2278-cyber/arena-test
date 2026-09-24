"""Flask front end for the FlyWire 2D simulator.

Binary-first API so that streaming 139k neurons at ~20 Hz stays cheap:

  GET  /api/meta    JSON, once at boot
  GET  /api/layout  Float32[N*2] xy in 0..1, then Uint8[N] super-class codes
  GET  /api/frame   uint32 header length, UTF-8 JSON header, Uint32[k] spike ids
  POST /api/control JSON commands (play/pause/reset/speed/stim/sources)
"""

from __future__ import annotations

import json
import struct

import numpy as np
from flask import Flask, Response, jsonify, request, send_from_directory

from .simulation import Simulation

SUPER_COLORS = {
    "optic": "#3fb6f0",
    "sensory": "#ffd34d",
    "central": "#b98cff",
    "visual_projection": "#4de0b4",
    "ascending": "#8fa6c0",
    "sensory_ascending": "#c9b45a",
    "descending": "#ff6b5e",
    "visual_centrifugal": "#2f8f7a",
    "motor": "#ff3d6e",
    "endocrine": "#9aa6b2",
    "unknown": "#6b7684",
}


def create_app(sim: Simulation | None = None) -> Flask:
    sim = sim or Simulation()
    sim.start()

    app = Flask(__name__, static_folder="web", static_url_path="")

    @app.after_request
    def no_store(resp: Response) -> Response:
        if request.path.startswith("/api/"):
            resp.headers["Cache-Control"] = "no-store"
        return resp

    @app.get("/")
    def index():
        return send_from_directory(app.static_folder, "index.html")

    @app.get("/api/meta")
    def meta():
        cx = sim.cx
        counts = {
            name: int((cx.super_class == i).sum())
            for i, name in enumerate(cx.super_class_names)
        }
        return jsonify(
            {
                "dataset": "FlyWire FAFB v783",
                "citation": "Dorkenwald et al. 2024; Schlegel et al. 2024 (CC-BY-4.0)",
                "neurons": cx.n,
                "edges": cx.n_edges,
                "min_syn": cx.min_syn,
                "super_class_names": cx.super_class_names,
                "super_class_counts": counts,
                "colors": [
                    SUPER_COLORS.get(n, "#6b7684") for n in cx.super_class_names
                ],
                "populations": {k: int(len(v)) for k, v in sim.pop.items()},
                "lif": {
                    "v_rest": sim.net.p.v_rest,
                    "v_threshold": sim.net.p.v_threshold,
                    "tau_m_ms": sim.net.p.tau_m_ms,
                    "refractory_ms": sim.net.p.refractory_ms,
                    "synaptic_mv": sim.net.p.synaptic_mv,
                    "dt_ms": sim.net.p.dt_ms,
                },
                "world": sim.world.state(),
            }
        )

    @app.get("/api/layout")
    def layout():
        xy = np.ascontiguousarray(sim.layout, dtype=np.float32)
        sc = np.ascontiguousarray(sim.super_of, dtype=np.uint8)
        payload = xy.tobytes() + sc.tobytes()
        return Response(payload, mimetype="application/octet-stream")

    @app.get("/api/frame")
    def frame():
        info, spikes = sim.snapshot()
        head = json.dumps(info, separators=(",", ":")).encode("utf-8")
        payload = struct.pack("<I", len(head)) + head + spikes.tobytes()
        return Response(payload, mimetype="application/octet-stream")

    @app.post("/api/control")
    def control():
        cmd = request.get_json(force=True, silent=True) or {}
        action = cmd.get("action")

        if action == "play":
            sim.running = True
        elif action == "pause":
            sim.running = False
        elif action == "reset":
            sim.reset()
        elif action == "speed":
            sim.steps_per_frame = int(np.clip(int(cmd.get("value", 2)), 1, 12))
        elif action == "stim":
            name = str(cmd.get("population", ""))
            hz = float(cmd.get("hz", 0.0))
            if hz == 0.0:
                sim.manual_stim.pop(name, None)
            else:
                sim.manual_stim[name] = hz
        elif action == "add_source":
            sim.world.add_source(
                float(cmd.get("x", 0)),
                float(cmd.get("y", 0)),
                str(cmd.get("kind", "light")),
                float(cmd.get("strength", 1.0)),
            )
        elif action == "clear_sources":
            sim.world.clear_sources()
        elif action == "reset_sources":
            sim.world.reset_sources()
        elif action == "coupling":
            for key, value in (cmd.get("values") or {}).items():
                if hasattr(sim.cp, key):
                    setattr(sim.cp, key, float(value))
        else:
            return jsonify({"ok": False, "error": f"unknown action {action!r}"}), 400

        return jsonify({"ok": True})

    return app

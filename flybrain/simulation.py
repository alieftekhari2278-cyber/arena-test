"""Closed loop: 2D world -> real sensory neurons -> FlyWire brain -> descending
neurons -> motor command -> 2D world.

Every population below is selected from the published FlyWire/Schlegel
annotations, not invented:

  * photoreceptors  super_class=sensory, cell_class=visual        (11,392)
  * olfactory ORNs  super_class=sensory, cell_class=olfactory     ( 2,281)
  * descending      super_class=descending                        ( 1,303)

Sensory drive is injected as an external depolarisation into the ipsilateral
population; the motor command is read out from the smoothed firing rate of the
left and right descending populations. The mapping from descending rate to
(forward, turn) is a modelling choice, documented in docs/MODEL.md — everything
between the sensors and that readout is the measured connectome.
"""

from __future__ import annotations

import dataclasses
import threading
import time

import numpy as np

from .engine import Connectome, LIFNetwork, LIFParams
from .world import World


@dataclasses.dataclass
class CouplingParams:
    """Gains that translate between the world and the brain.

    Sensory side: world intensity (0..1) -> afferent firing rate in Hz.
    Motor side:   descending-population rate in Hz -> (forward, turn).
    """

    visual_rate_hz: float = 600.0   # photoreceptor rate at unit luminance
    odor_rate_hz: float = 500.0
    threat_rate_hz: float = 700.0
    rate_tau_s: float = 0.15        # descending-rate smoothing
    # Descending rates run 0-30 Hz in the closed loop, so these gains put
    # forward speed in 45-290 u/s and turn rate in roughly +/-2.5 rad/s.
    forward_gain: float = 3.0
    forward_bias: float = 90.0
    turn_gain: float = 3.2
    turn_sign: float = 1.0          # +1 approach, -1 avoid (see docs/MODEL.md)
    turn_bias: float = 0.0
    wander_hz: float = 0.35         # slow random drift when the brain is quiet


class Simulation:
    """Owns the connectome, the LIF net, the world, and the stepping thread."""

    def __init__(
        self,
        cx: Connectome | None = None,
        lif: LIFParams | None = None,
        coupling: CouplingParams | None = None,
        seed: int = 0,
    ):
        self.cx = cx or Connectome()
        self.net = LIFNetwork(self.cx, lif or LIFParams(), seed=seed)
        self.world = World(seed=seed)
        self.cp = coupling or CouplingParams()
        self.rng = np.random.default_rng(seed)

        c = self.cx
        self.pop = {
            "photo_L": c.select(super_class="sensory", cell_class="visual", side="left"),
            "photo_R": c.select(super_class="sensory", cell_class="visual", side="right"),
            "orn_L": c.select(super_class="sensory", cell_class="olfactory", side="left"),
            "orn_R": c.select(super_class="sensory", cell_class="olfactory", side="right"),
            "dn_L": c.select(super_class="descending", side="left"),
            "dn_R": c.select(super_class="descending", side="right"),
        }
        self.rate_L = 0.0
        self.rate_R = 0.0

        # Precomputed screen-space layout for the brain view (frontal XY).
        self.layout = self._layout()
        self.super_of = self.cx.super_class.astype(np.uint8)

        self.steps_per_frame = 2
        self.running = True
        self.manual_stim: dict[str, float] = {}
        self._lock = threading.Lock()
        self._thread: threading.Thread | None = None
        self._frame = 0
        self._last_spikes = np.empty(0, dtype=np.uint32)
        self._step_ms = 0.0
        self._sense: dict[str, float] = {}

    # -- layout ------------------------------------------------------------
    def _layout(self) -> np.ndarray:
        """Normalise FlyWire voxel coordinates into a 0..1 frontal projection."""
        p = self.cx.pos[:, :2].astype(np.float32).copy()
        lo = np.percentile(p, 0.2, axis=0)
        hi = np.percentile(p, 99.8, axis=0)
        p = (p - lo) / np.maximum(hi - lo, 1e-6)
        return np.clip(p, 0.0, 1.0)

    # -- one closed-loop tick ---------------------------------------------
    def tick(self) -> None:
        cp = self.cp
        s = self.world.sense()
        net = self.net

        drive = {
            "photo_L": cp.visual_rate_hz * s["eye_left"]
            + cp.threat_rate_hz * s["threat_left"],
            "photo_R": cp.visual_rate_hz * s["eye_right"]
            + cp.threat_rate_hz * s["threat_right"],
            "orn_L": cp.odor_rate_hz * s["odor_left"],
            "orn_R": cp.odor_rate_hz * s["odor_right"],
        }
        for name, hz in self.manual_stim.items():
            drive[name] = drive.get(name, 0.0) + hz

        t0 = time.perf_counter()
        for _ in range(self.steps_per_frame):
            net.step()
            # Afferents fire as Poisson processes; their spikes are delivered
            # downstream on the following step.
            for name, hz in drive.items():
                idx = self.pop.get(name)
                if idx is None:
                    idx = self.cx.select(super_class=name)
                net.force_poisson(idx, hz)
        self._step_ms = (time.perf_counter() - t0) * 1000.0 / self.steps_per_frame

        # Descending-neuron rate readout, in Hz, exponentially smoothed.
        dt = self.net.p.dt_ms * self.steps_per_frame / 1000.0
        alpha = float(np.clip(dt / max(cp.rate_tau_s, 1e-3), 0.0, 1.0))
        hz = 1000.0 / self.net.p.dt_ms
        inst_L = float(net.spikes[self.pop["dn_L"]].mean()) * hz if len(self.pop["dn_L"]) else 0.0
        inst_R = float(net.spikes[self.pop["dn_R"]].mean()) * hz if len(self.pop["dn_R"]) else 0.0
        self.rate_L += alpha * (inst_L - self.rate_L)
        self.rate_R += alpha * (inst_R - self.rate_R)

        forward = cp.forward_bias + cp.forward_gain * 0.5 * (self.rate_L + self.rate_R)
        turn = cp.turn_bias + cp.turn_sign * cp.turn_gain * (self.rate_R - self.rate_L)
        # A slow random walk keeps the agent exploring when nothing is in view.
        turn += float(self.rng.normal(0.0, cp.wander_hz))
        self.world.step(forward, turn, dt=max(dt, 0.02))

        self._sense = s
        self._frame += 1

    # -- background thread -------------------------------------------------
    def start(self) -> None:
        if self._thread is not None:
            return

        def loop() -> None:
            while True:
                if self.running:
                    with self._lock:
                        self.tick()
                        sp = np.flatnonzero(self.net.spikes).astype(np.uint32)
                        if sp.size > 9000:
                            sp = self.rng.choice(sp, 9000, replace=False).astype(np.uint32)
                        self._last_spikes = sp
                else:
                    time.sleep(0.02)

        self._thread = threading.Thread(target=loop, daemon=True, name="flybrain-sim")
        self._thread.start()

    # -- snapshots ---------------------------------------------------------
    def snapshot(self) -> tuple[dict, np.ndarray]:
        with self._lock:
            spikes = self._last_spikes.copy()
            meta = {
                "frame": self._frame,
                "sim_steps": self.net.steps,
                "sim_ms": round(self.net.steps * self.net.p.dt_ms, 1),
                "step_ms": round(self._step_ms, 2),
                "active": int(self.net.spikes.sum()),
                "active_pct": round(100.0 * float(self.net.spikes.mean()), 3),
                "spikes_sent": int(spikes.size),
                "rate_dn_left": round(self.rate_L, 4),
                "rate_dn_right": round(self.rate_R, 4),
                "sense": {k: round(v, 4) for k, v in self._sense.items()},
                "world": self.world.state(),
                "running": self.running,
                "steps_per_frame": self.steps_per_frame,
            }
        return meta, spikes

    def reset(self) -> None:
        with self._lock:
            self.net.reset()
            self.world.reset_agent()
            self.rate_L = self.rate_R = 0.0
            self._frame = 0

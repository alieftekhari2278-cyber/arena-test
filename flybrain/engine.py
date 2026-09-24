"""Leaky integrate-and-fire simulation over the real FlyWire v783 wiring.

Neuron and synapse parameters follow Shiu et al. (2024), "A leaky
integrate-and-fire computational model based on the connectome of the entire
adult Drosophila brain reveals insights into sensorimotor processing", so that
results here are comparable with the published whole-brain model:

    resting potential      -52 mV
    firing threshold       -45 mV
    reset potential        -52 mV
    membrane time constant  20 ms
    refractory period      2.2 ms
    synaptic weight        0.275 mV per synapse

Synaptic transmission is modelled as an instantaneous voltage step, scaled by
the number of synapses in the connection and signed by the presynaptic
neuron's neurotransmitter (Dale's law).
"""

from __future__ import annotations

import dataclasses
from pathlib import Path

import numpy as np

from . import sources


@dataclasses.dataclass
class LIFParams:
    v_rest: float = -52.0
    v_threshold: float = -45.0
    v_reset: float = -52.0
    tau_m_ms: float = 20.0
    refractory_ms: float = 2.2
    synaptic_mv: float = 0.275
    dt_ms: float = 1.0

    # Global gain on every synapse. This is a *modelling* parameter, not a
    # measured one, and it matters a lot. With synaptic_scale = 1.0 the raw
    # 0.275 mV step drives this reduced model into a self-sustaining global
    # ignition (~8% of the brain firing regardless of input), which destroys
    # any stimulus-specific response. Sweeping the gain shows a sharp
    # bifurcation near 0.15; below it the network is input-driven and
    # propagates signal with the correct anatomy (ipsilateral optic lobe,
    # contralateral descending bias), above it everything saturates.
    # 0.14 sits just under that bifurcation. See docs/MODEL.md.
    synaptic_scale: float = 0.14


class Connectome:
    """Node tables plus the CSR adjacency, loaded from the build artefact."""

    def __init__(self, path: Path | None = None):
        path = path or (sources.BUILD_DIR / "connectome.npz")
        if not path.exists():
            raise FileNotFoundError(
                f"{path} not found — run `python -m flybrain build` first"
            )
        z = np.load(path, allow_pickle=True)
        self.root_id: np.ndarray = z["root_id"]
        self.pos: np.ndarray = z["pos"]
        self.super_class: np.ndarray = z["super_class"]
        self.cell_class: np.ndarray = z["cell_class"]
        self.side: np.ndarray = z["side"]
        self.nt: np.ndarray = z["nt"]
        self.sign: np.ndarray = z["sign"]
        self.indptr: np.ndarray = z["indptr"]
        self.indices: np.ndarray = z["indices"]
        self.weight: np.ndarray = z["weight"]
        self.super_class_names: list[str] = list(z["super_class_names"])
        self.cell_class_names: list[str] = list(z["cell_class_names"])
        self.nt_names: list[str] = list(z["nt_names"])
        self.cell_type: np.ndarray = z["cell_type"]
        self.min_syn = int(z["min_syn"])

    @property
    def n(self) -> int:
        return len(self.root_id)

    @property
    def n_edges(self) -> int:
        return len(self.indices)

    def super_idx(self, name: str) -> int:
        return self.super_class_names.index(name)

    def cell_idx(self, name: str) -> int:
        return self.cell_class_names.index(name)

    def select(
        self,
        super_class: str | None = None,
        cell_class: str | None = None,
        side: str | None = None,
    ) -> np.ndarray:
        mask = np.ones(self.n, dtype=bool)
        if super_class is not None:
            if super_class not in self.super_class_names:
                return np.empty(0, dtype=np.int32)
            mask &= self.super_class == self.super_idx(super_class)
        if cell_class is not None:
            if cell_class not in self.cell_class_names:
                return np.empty(0, dtype=np.int32)
            mask &= self.cell_class == self.cell_idx(cell_class)
        if side is not None:
            mask &= self.side == {"left": 0, "right": 1, "center": 2}[side]
        return np.flatnonzero(mask).astype(np.int32)


class LIFNetwork:
    """Vectorised event-driven LIF over a `Connectome`."""

    def __init__(self, cx: Connectome, params: LIFParams | None = None, seed: int = 0):
        self.cx = cx
        self.p = params or LIFParams()
        self.rng = np.random.default_rng(seed)

        n = cx.n
        self.v = np.full(n, self.p.v_rest, dtype=np.float32)
        self.refrac = np.zeros(n, dtype=np.int16)
        self.spikes = np.zeros(n, dtype=bool)
        self.spike_count = np.zeros(n, dtype=np.int64)

        self.decay = np.float32(np.exp(-self.p.dt_ms / self.p.tau_m_ms))
        self.refrac_steps = int(round(self.p.refractory_ms / self.p.dt_ms))

        # Signed per-edge voltage step, precomputed once.
        src = np.repeat(
            np.arange(n, dtype=np.int32), np.diff(cx.indptr).astype(np.int64)
        )
        self.edge_mv = (
            cx.weight
            * cx.sign[src]
            * np.float32(self.p.synaptic_mv * self.p.synaptic_scale)
        ).astype(np.float32)
        del src

        self.external = np.zeros(n, dtype=np.float32)
        self.steps = 0

    # -- internals ---------------------------------------------------------
    def _synaptic_input(self, spiking: np.ndarray) -> np.ndarray:
        """Gather the outgoing edges of `spiking` and scatter-add into a vector."""
        out = np.zeros(self.cx.n, dtype=np.float32)
        if spiking.size == 0:
            return out
        starts = self.cx.indptr[spiking].astype(np.int64)
        counts = (self.cx.indptr[spiking + 1] - self.cx.indptr[spiking]).astype(np.int64)
        total = int(counts.sum())
        if total == 0:
            return out
        # Ragged range expansion: for each spiking row, emit starts[i]..ends[i].
        offsets = np.zeros(counts.size, dtype=np.int64)
        np.cumsum(counts[:-1], out=offsets[1:])
        flat = np.arange(total, dtype=np.int64) - np.repeat(offsets, counts)
        edge_ids = np.repeat(starts, counts) + flat
        np.add.at  # noqa: B018  (documented: bincount is ~20x faster below)
        return np.bincount(
            self.cx.indices[edge_ids],
            weights=self.edge_mv[edge_ids],
            minlength=self.cx.n,
        ).astype(np.float32)

    # -- public API --------------------------------------------------------
    def inject(self, idx: np.ndarray, millivolts: float | np.ndarray) -> None:
        """Add an external drive (mV per step) to the given neurons."""
        if len(idx):
            self.external[idx] += millivolts

    def clear_external(self) -> None:
        self.external.fill(0.0)

    def force_poisson(self, idx: np.ndarray, rate_hz: float) -> None:
        """Make `idx` fire as a Poisson process at `rate_hz`.

        Sensory afferents are driven this way rather than by current
        injection: a constant current pins them at the refractory ceiling
        (~450 Hz) and gives no graded control, whereas a rate directly
        expresses "how bright is this eye" in physiological units.
        Call after `step()` so the spikes are transmitted on the next step.
        """
        if rate_hz <= 0.0 or idx.size == 0:
            return
        p = min(rate_hz * self.p.dt_ms / 1000.0, 1.0)
        fired = self.rng.random(idx.size) < p
        hit = idx[fired]
        self.spikes[hit] = True
        self.spike_count[hit] += 1

    def step(self) -> np.ndarray:
        p = self.p
        spiking = np.flatnonzero(self.spikes).astype(np.int32)
        syn = self._synaptic_input(spiking)

        # Leak toward rest, then apply instantaneous synaptic + external steps.
        self.v = (self.v - p.v_rest) * self.decay + p.v_rest
        self.v += syn
        self.v += self.external

        active = self.refrac <= 0
        self.spikes = active & (self.v >= p.v_threshold)
        self.v[self.spikes] = p.v_reset
        self.refrac[self.spikes] = self.refrac_steps
        np.subtract(self.refrac, 1, out=self.refrac, where=self.refrac > 0)
        self.v[self.refrac > 0] = p.v_reset

        self.spike_count += self.spikes
        self.steps += 1
        return self.spikes

    def reset(self) -> None:
        self.v.fill(self.p.v_rest)
        self.refrac.fill(0)
        self.spikes.fill(False)
        self.spike_count.fill(0)
        self.external.fill(0.0)
        self.steps = 0

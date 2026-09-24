"""
brain.py — whole-brain leaky integrate-and-fire engine for FlyWire FAFB v783.

Every one of the 139,255 proofread neurons is simulated. Nothing is pooled,
clustered, averaged or dropped: `v`, `g` and the refractory clock are plain
float arrays of length 139,255, and the connection list is the complete
15,091,983-edge graph (54.5 M synapses) carrying the excitatory / inhibitory
sign predicted by Eckstein et al. 2024.

Model and parameters are those of
  Shiu, Sterne, Spiller et al., "A Drosophila computational brain model reveals
  sensorimotor processing", Nature 634, 210-219 (2024)
which in turn takes them from Kakaria & de Bivort 2017, Lazar et al. 2021,
Juergensen et al. 2021 and Paul et al. 2015:

    dv/dt = (V_rest - v + g) / T_mbr        (unless refractory)
    dg/dt = -g / tau                        (unless refractory)
    spike when v > V_thresh -> v = V_reset, g = 0, refractory for T_rfc
    presynaptic spike  ->  g_post += 0.275 mV * synapse_count * sign(pre)
                           after a fixed 1.8 ms axonal delay

The only thing that differs from the paper's Brian2 implementation is the
integration step: Brian2 runs at dt = 0.1 ms, here dt is configurable
(0.6 ms by default) and the linear sub-system is advanced with its exact
exponential propagator rather than with Euler steps, which keeps the same
time constants at a much larger step size.

Speed trick (no biology is lost): a spike only matters where it lands, so each
step touches the out-edges of the neurons that actually fired instead of the
whole 15 M-edge matrix. Cost per step is proportional to the number of spikes,
not to the size of the brain.
"""
import json
import os
import sys

sys.path.insert(0, os.path.expanduser("~/.pylibs"))
import numpy as np

BUILD = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "build")

# ------------------------------------------------------------------ parameters
V_REST = -52.0      # mV  resting potential          (Kakaria & de Bivort 2017)
V_RESET = -52.0     # mV  reset after a spike
V_THRESH = -45.0    # mV  spike threshold
T_MBR = 20.0        # ms  membrane time constant  (R 10 kOhm.cm^2 * C 2 uF/cm^2)
TAU = 5.0           # ms  synaptic decay          (Juergensen et al. 2021)
T_RFC = 2.2         # ms  refractory period       (Lazar et al. 2021)
T_DLY = 1.8         # ms  spike -> postsynaptic effect delay (Paul et al. 2015)
W_SYN = 0.275       # mV  per synapse             (the model's one free parameter)
F_POI = 250.0       # Poisson input scaling in the paper -> 68.75 mV kick = forced spike


class FlyBrain:
    def __init__(self, graph="full", dt=0.6, seed=0):
        self.dt = float(dt)
        self.rng = np.random.default_rng(seed)

        meta_path = os.path.join(BUILD, "meta.json")
        with open(meta_path) as f:
            self.meta = json.load(f)
        nz = np.load(os.path.join(BUILD, "neurons.npz"))
        self.root_id = nz["root_id"]
        self.N = int(self.root_id.size)
        self.pos = np.stack([nz["x"], nz["y"], nz["z"]], axis=1)
        self.super_code = nz["super_code"]
        self.class_code = nz["class_code"]
        self.side_code = nz["side_code"]
        self.nt_code = nz["nt_code"]

        self.load_graph(graph)

        # ---- state, one entry per real neuron
        self.v = np.full(self.N, V_REST, dtype=np.float32)
        self.g = np.zeros(self.N, dtype=np.float32)
        self.rfc = np.zeros(self.N, dtype=np.int16)        # refractory steps left
        self.spiked = np.zeros(self.N, dtype=bool)
        self.spike_count = np.zeros(self.N, dtype=np.int64)
        self.rate = np.zeros(self.N, dtype=np.float32)      # exponentially smoothed Hz
        self.t_ms = 0.0
        self.step_idx = 0

        # ---- external drive (Hz) per neuron, written by the environment
        self.drive = np.zeros(self.N, dtype=np.float32)
        self.silenced = np.zeros(self.N, dtype=bool)

        self._recompute_constants()

        # ---- delay line for synaptic input, T_DLY rounded to whole steps
        self.n_delay = max(1, int(round(T_DLY / self.dt)))
        self.ring = np.zeros((self.n_delay, self.N), dtype=np.float32)
        self.n_rfc = max(1, int(round(T_RFC / self.dt)))

        # ---- optional spike-frequency adaptation (NOT part of Shiu et al.;
        #      off by default, see docs). Each spike adds `adapt_mV` to a slow
        #      hyperpolarising current that decays with `adapt_tau` ms.
        self.adapt_mV = 0.0
        self.adapt_tau = 150.0
        self.adapt = np.zeros(self.N, dtype=np.float32)

        # ---- scratch buffers so the hot loop allocates nothing per step
        self._scratch = np.empty(self.N, dtype=np.float32)
        self._drive_idx = np.empty(0, dtype=np.int64)
        self._drive_p = np.empty(0, dtype=np.float32)
        self._drive_dirty = True

    # ------------------------------------------------------------------ setup
    def load_graph(self, which):
        gz = np.load(os.path.join(BUILD, f"graph_{'full' if which == 'full' else 't5'}.npz"))
        self.indptr = gz["indptr"].astype(np.int64)
        self.post = gz["post"]
        self.w = gz["w"]
        self.graph_name = which
        self.n_edges = int(self.post.size)
        self.n_synapses = float(np.abs(self.w).sum() / W_SYN)

    def _recompute_constants(self):
        dt = self.dt
        self.A = float(np.exp(-dt / T_MBR))
        self.B = float(np.exp(-dt / TAU))
        self.C = float((TAU / (T_MBR - TAU)) * (self.A - self.B))
        self.rate_decay = float(np.exp(-dt / 100.0))        # 100 ms smoothing window
        self._adapt_decay = float(np.exp(-dt / max(self.adapt_tau, 1e-3))) if hasattr(self, 'adapt_tau') else 1.0

    def set_adaptation(self, mV, tau=None):
        self.adapt_mV = float(mV)
        if tau:
            self.adapt_tau = float(tau)
        self._recompute_constants()

    def reset_state(self):
        self.adapt[:] = 0.0
        self.v[:] = V_REST
        self.g[:] = 0.0
        self.rfc[:] = 0
        self.ring[:] = 0.0
        self.rate[:] = 0.0
        self.spike_count[:] = 0
        self.t_ms = 0.0
        self.step_idx = 0

    # ------------------------------------------------------------------ step
    def step(self):
        """Advance the whole brain by dt. Returns the indices of neurons that fired."""
        dt = self.dt
        slot = self.step_idx % self.n_delay

        # 1. synaptic input that was emitted T_DLY ago arrives now
        self.g += self.ring[slot]
        self.ring[slot] = 0.0

        # 2. exact integration of the linear sub-system, frozen while refractory
        ref = np.flatnonzero(self.rfc)
        if ref.size:
            v_hold = self.v[ref]
            g_hold = self.g[ref]
        s = self._scratch
        np.multiply(self.g, self.C, out=s)          # s = C * g
        np.subtract(self.v, V_REST, out=self.v)
        np.multiply(self.v, self.A, out=self.v)
        np.add(self.v, V_REST, out=self.v)
        np.add(self.v, s, out=self.v)               # v = V_rest + (v-V_rest)A + gC
        np.multiply(self.g, self.B, out=self.g)     # g = g B
        if self.adapt_mV > 0.0:
            np.multiply(self.adapt, self._adapt_decay, out=self.adapt)
            np.subtract(self.v, self.adapt, out=self.v)
        if ref.size:
            self.v[ref] = v_hold
            self.g[ref] = g_hold

        # 3. external Poisson drive: in the paper each event is a 68.75 mV kick,
        #    i.e. an unconditional spike, and driven neurons have no refractoriness
        if self._drive_dirty:
            self._drive_idx = np.flatnonzero(self.drive > 0)
            self._drive_p = (1.0 - np.exp(-self.drive[self._drive_idx] * dt * 1e-3)).astype(np.float32)
            self._drive_dirty = False
        if self._drive_idx.size:
            hit = self._drive_idx[self.rng.random(self._drive_idx.size) < self._drive_p]
            if hit.size:
                self.v[hit] += W_SYN * F_POI
                self.rfc[hit] = 0

        # 4. threshold
        spiked = (self.v >= V_THRESH) & (self.rfc == 0)
        if self.silenced.any():
            spiked &= ~self.silenced
        self.spiked = spiked
        idx = np.flatnonzero(spiked)

        # 5. reset + refractory
        if idx.size:
            self.v[idx] = V_RESET
            self.g[idx] = 0.0
            self.rfc[idx] = self.n_rfc
            self.spike_count[idx] += 1
            if self.adapt_mV > 0.0:
                self.adapt[idx] += self.adapt_mV
        np.subtract(self.rfc, 1, out=self.rfc, where=self.rfc > 0)

        # 6. propagate: gather the out-edges of the neurons that fired
        if idx.size:
            starts = self.indptr[idx]
            ends = self.indptr[idx + 1]
            counts = (ends - starts).astype(np.int64)
            total = int(counts.sum())
            if total:
                offs = np.concatenate(([0], np.cumsum(counts)[:-1]))
                gather = np.repeat(starts - offs, counts) + np.arange(total, dtype=np.int64)
                contrib = np.bincount(self.post[gather], weights=self.w[gather], minlength=self.N)
                np.add(self.ring[slot], contrib, out=self.ring[slot], casting='unsafe')

        # 7. smoothed firing rate in Hz
        self.rate *= self.rate_decay
        if idx.size:
            self.rate[idx] += (1.0 - self.rate_decay) * (1000.0 / self.dt)

        self.step_idx += 1
        self.t_ms += dt
        return idx

    # ------------------------------------------------------------------ helpers
    def set_drive(self, indices, hz):
        if len(indices):
            self.drive[np.asarray(indices, dtype=np.int64)] = hz
            self._drive_dirty = True

    def clear_drive(self):
        self.drive[:] = 0.0
        self._drive_dirty = True

    def mark_drive_dirty(self):
        self._drive_dirty = True

    def group(self, name):
        return np.asarray(self.meta["groups"].get(name, []), dtype=np.int64)

    def pop_rate(self, indices):
        """Mean smoothed firing rate (Hz) of a population."""
        if len(indices) == 0:
            return 0.0
        return float(self.rate[indices].mean())


if __name__ == "__main__":
    import time as _t

    which = sys.argv[1] if len(sys.argv) > 1 else "full"
    b = FlyBrain(graph=which)
    print(f"neurons   : {b.N:,}")
    print(f"edges     : {b.n_edges:,}   synapses: {b.n_synapses:,.0f}")
    print(f"dt        : {b.dt} ms   delay {b.n_delay} steps   refractory {b.n_rfc} steps")
    mem = (b.post.nbytes + b.w.nbytes + b.indptr.nbytes) / 1e6
    print(f"graph RAM : {mem:.0f} MB")

    # Reproduce figure 1 of Shiu et al.: drive the 20 labellar sugar GRNs and
    # look for the proboscis motor neuron MN9 downstream.
    sugar = b.group("sugar_grn")
    mn9 = b.group("mn9")
    b.set_drive(sugar, 100.0)
    t0 = _t.time()
    n_steps = int(1000 / b.dt)
    for _ in range(n_steps):
        b.step()
    el = _t.time() - t0
    print(f"\n1000 ms of brain time in {el:.1f} s wall  ->  {n_steps / el:.0f} steps/s, "
          f"{1000 / el:.0f} ms brain per s wall")
    order = np.argsort(b.spike_count)[::-1][:25]
    labels = b.meta["labels"]
    print(f"\nactive neurons: {(b.spike_count > 0).sum():,} / {b.N:,}")
    print(f"MN9 spikes    : {b.spike_count[mn9].sum()}  ({b.rate[mn9].mean():.1f} Hz smoothed)")
    print("\ntop responders")
    for i in order:
        print(f"  {b.root_id[i]}  {b.spike_count[i]:5d} spikes  "
              f"{labels['super_class'][b.super_code[i]]:18s} {labels['class'][b.class_code[i]]}")

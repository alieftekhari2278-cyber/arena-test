#!/usr/bin/env python3
"""
Whole adult fruit-fly brain simulation — VERIFIED PROOF OF CONCEPT
==================================================================
Runs the complete FlyWire v783 connectome (138,639 neurons, 15,091,983
directed connections, 54,492,922 synapses — zero neurons removed) as a
leaky integrate-and-fire network, using the exact parameters of
Shiu et al. 2024, Nature 634:210 (philshiu/Drosophila_brain_model/model.py).

Event-driven propagation: only the rows of spiking neurons are touched,
so the full brain runs ~1000 steps/s on 2 CPU cores.

Usage:
    bash fetch_data.sh        # first: download data (~6 s)
    python3 fly_lif_core.py   # then: run 200 ms of biological time

This core is the engine that a 2D arena (HTML canvas + WebSocket) would
plug into: sensory Poisson drive in -> DN firing rates out.
"""
import os
import time

import numpy as np
import pandas as pd
import scipy.sparse as sp

CACHE = os.path.expanduser("~/.cache/flybrain/Drosophila_brain_model")
PATH_COMP = os.path.join(CACHE, "Completeness_783.csv")
PATH_CON = os.path.join(CACHE, "Connectivity_783.parquet")

# ---------------------------------------------------------------------------
# 1) Build the signed sparse weight matrix (all neurons, all edges)
# ---------------------------------------------------------------------------
t0 = time.time()
comp = pd.read_csv(PATH_COMP, index_col=0)
df = pd.read_parquet(
    PATH_CON,
    columns=["Presynaptic_Index", "Postsynaptic_Index",
             "Connectivity", "Excitatory", "Excitatory x Connectivity"],
)
N = len(comp)
W = sp.csr_matrix(
    (df["Excitatory x Connectivity"].values.astype(np.float32),
     (df["Presynaptic_Index"].values, df["Postsynaptic_Index"].values)),
    shape=(N, N),
)
W.sort_indices()
print(f"neurons={N:,} edges={W.nnz:,} synapses={int(df['Connectivity'].sum()):,} "
      f"RAM={(W.data.nbytes + W.indices.nbytes + W.indptr.nbytes) / 1e6:.0f} MB "
      f"(loaded in {time.time() - t0:.1f}s)")

# ---------------------------------------------------------------------------
# 2) LIF parameters — verbatim from Shiu et al. 2024 (model.py)
# ---------------------------------------------------------------------------
v0, vth, vrst = -52.0, -45.0, -52.0          # mV
t_mbr, tau, t_rfc, t_dly = 20.0, 5.0, 2.2, 1.8  # ms
w_syn = 0.275                                # mV per synapse
dt = 0.1                                     # ms (Brian2 default)
D = int(round(t_dly / dt))                   # axonal delay, in steps
REFR = int(round(t_rfc / dt))                # refractory, in steps

rng = np.random.default_rng(7)
v = np.full(N, v0, np.float32)               # membrane potential
g = np.zeros(N, np.float32)                  # synaptic conductance
last_spike = np.full(N, -1_000_000, np.int64)

# ring buffer for delayed synaptic delivery (1.8 ms)
NB = 512
buf_idx = [[] for _ in range(NB)]
buf_w = [[] for _ in range(NB)]
head = 0

# Poisson drive on the 100 highest out-degree neurons ("hub drive")
outdeg = np.asarray(W.getnnz(axis=1)).ravel()
inputs = np.argsort(-outdeg)[:100]
rate = 0.150 * dt                            # 150 Hz -> prob per step
inj = w_syn * 250                            # direct v injection (model.py)

# ---------------------------------------------------------------------------
# 3) Run
# ---------------------------------------------------------------------------
T = 200.0                                    # ms of biological time
steps = int(T / dt)
t0 = time.time()
total_spikes, active = 0, set()

for s in range(steps):
    # deliver delayed input
    for idx, w in zip(buf_idx[head], buf_w[head]):
        np.add.at(g, idx, w)
    buf_idx[head], buf_w[head] = [], []
    head = (head + 1) % NB

    # sensory Poisson drive -> v
    fired_in = inputs[rng.random(len(inputs)) < rate]
    v[fired_in] += inj

    # leaky integration
    v += (dt / t_mbr) * (v0 - v + g)
    g *= np.exp(-dt / tau)

    # spike threshold
    spk = np.nonzero((v > vth) & ((s - last_spike) > REFR))[0]
    if len(spk):
        total_spikes += len(spk)
        active.update(spk.tolist())
        v[spk] = vrst
        g[spk] = 0
        last_spike[spk] = s
        # propagate through the REAL connectome with 1.8 ms delay
        y = (sp.csr_matrix(
                 (np.ones(len(spk), np.float32),
                  (np.zeros(len(spk), np.int64), spk)),
                 shape=(1, N)) @ W).tocoo()
        slot = (head + D - 1) % NB
        buf_idx[slot].append(y.col)
        buf_w[slot].append(y.data * w_syn)

wall = time.time() - t0
print(f"ran {T:.0f} ms bio-time ({steps} steps @ dt={dt} ms) in {wall:.1f}s "
      f"-> {steps / wall:.0f} steps/s")
print(f"total spikes: {total_spikes:,} | distinct active neurons: "
      f"{len(active):,} ({100 * len(active) / N:.1f}% of brain)")

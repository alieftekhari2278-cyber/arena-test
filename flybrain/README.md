# flybrain — the whole FlyWire fly connectome, alive in a 2D world

A complete, unreduced spiking simulation of the adult *Drosophila* brain, wired into a
2D arena you can poke at in a browser.

```
139,255 neurons          every proofread FlyWire FAFB v783 neuron, no subsampling
 15,091,983 connections  signed, weighted by synapse count (Shiu et al. 2024)
 54,492,922 synapses     matches the published 54.5 M
```

Nothing is clustered, averaged or thrown away: every neuron has its own index, its own
membrane potential, its own refractory clock and its own pixel on screen.

<p align="center"><em>سند تحقیق فارسی: <a href="../docs/تحقیق-مغز-مگس.md">docs/تحقیق-مغز-مگس.md</a></em></p>

---

## Run it

```bash
bash flybrain/fetch_data.sh                       # ~158 MB of public connectome dumps
pip install --target ~/.pylibs numpy pyarrow
PYTHONPATH=~/.pylibs python3 flybrain/build_graph.py   # ~15 s  -> data/build/
PYTHONPATH=~/.pylibs python3 flybrain/calibrate.py     # motor read-outs -> meta.json
PYTHONPATH=~/.pylibs PORT=8000 python3 flybrain/server.py
```

Then open <http://localhost:8000>.

Self-test without the world (reproduces figure 1 of Shiu et al.):

```bash
PYTHONPATH=~/.pylibs python3 flybrain/brain.py full
```

## Files

| file | what it does |
|---|---|
| `fetch_data.sh` | downloads the Codex v783 export + the signed connectivity from Shiu et al. |
| `build_graph.py` | builds the CSC connectivity, the 2D neuron map, the sensory/motor groups, the retinotopy of photoreceptors **and** of visual projection neurons |
| `brain.py` | the LIF engine: exact exponential propagator, event-driven spike propagation, 1.8 ms delay ring, optional spike-frequency adaptation |
| `calibrate.py` | stimulates each sensory population and records which motor/descending neurons answer — the motor read-outs are derived from the data, not hand-picked |
| `world.py` | the 2D arena, the fly's body, the sensory encoders and the motor decoder |
| `server.py` | simulation thread + HTTP/SSE server |
| `web/` | the browser UI (Persian, RTL) |

## The model

Leaky integrate-and-fire, exactly the parameter set of
[Shiu et al., *Nature* 634:210–219 (2024)](https://www.nature.com/articles/s41586-024-07763-9):

```
dv/dt = (V_rest − v + g) / T_mbr          V_rest = V_reset = −52 mV
dg/dt = −g / τ                            V_thresh        = −45 mV
spike: v>V_thresh → v=V_reset, g=0,       T_mbr = 20 ms,  τ = 5 ms
       refractory 2.2 ms                  delay = 1.8 ms
g_post += 0.275 mV × syn_count × sign     ← the single free parameter
```

Two implementation choices make the whole brain run in real-ish time on 2 CPU cores
without changing the biology:

* **exact exponential integration** instead of small Euler steps — the linear subsystem
  is advanced with its analytic solution, so `dt = 0.6 ms` is as accurate as `0.1 ms`;
* **event-driven propagation** — per-step cost scales with the number of *spikes*, not
  with the size of the brain (`bincount` over the out-edges of the neurons that fired).

Measured: 30–36 % of real time with the full sensory loop running, ~5–7 k spikes/frame.

## What is data and what is engineering

Honest accounting, because this distinction is where most connectome demos overclaim.

**From the connectome (real data):** every neuron, every connection, every synapse count,
the excitatory/inhibitory sign, the 3D position of every cell, the cell-type annotations,
the identity of the sugar/water/bitter gustatory receptor neurons and of MN9, the
retinotopic ordering of photoreceptors, and the receptive-field centres of the visual
projection neurons (estimated from the synapse-weighted position of their presynaptic
optic-lobe partners).

**Engineered adapters (mine, and every comparable project's):** the 2D body and arena,
the Poisson rates that turn "there is sugar under my foot" into input spikes, injecting
vision at the visual projection neurons rather than at the photoreceptors, the mapping
from descending-neuron left/right asymmetry to yaw, and the optional adaptation current.

**Known to be broken / off by default:** photoreceptor→descending-neuron transmission
(the first two synapses of the visual pathway are graded, not spiking, in the real fly:
11,153 photoreceptors at 100 Hz light up 6,521 cells and reach **zero** descending
neurons), and olfactory drive (any ORN input ≥10 Hz locks the mushroom body into a
70 Hz self-sustaining attractor, which also destroys odour lateralisation).

**Cannot be claimed:** this fly does not learn. The LIF model has no synaptic plasticity,
no neuropeptides, no gap junctions and no internal state.

## Licence of the data

FlyWire connectome data: **CC BY-NC 4.0** (Dorkenwald et al. 2024, Schlegel et al. 2024).
Model parameters and the signed connectivity table: Shiu et al. 2024, MIT-licensed code.

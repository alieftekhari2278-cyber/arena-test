"""Reproducible checks on what the model does and does not do.

Run with ``python -m flybrain validate``. Every number printed here is
produced by the code in this repository from the real FlyWire v783 wiring;
nothing is hard-coded. The point is that claims about this simulator should be
checkable, not taken on trust.

Checks
------
1. dataset integrity   node/edge counts against the published release
2. signal propagation  a one-eye stimulus must stay in the ipsilateral optic lobe
3. descending bias     the descending readout must be *consistently* lateralised
4. stability           the operating gain must sit below the ignition bifurcation
5. closed loop         approach and avoid must separate in the 2D world
"""

from __future__ import annotations

import math

import numpy as np

from .engine import Connectome, LIFNetwork, LIFParams
from .simulation import CouplingParams, Simulation
from .world import LIGHT

PASS = "PASS"
FAIL = "FAIL"


def _line(name: str, ok: bool, detail: str) -> str:
    return f"  [{PASS if ok else FAIL}] {name:<34} {detail}"


def _open_loop(cx, scale, rate_L, rate_R, steps=600, warm=200, seed=1):
    """Drive one or both eyes at a fixed rate; return population rates in Hz."""
    net = LIFNetwork(cx, LIFParams(synaptic_scale=scale), seed=seed)
    pops = {
        "photo_L": cx.select(super_class="sensory", cell_class="visual", side="left"),
        "photo_R": cx.select(super_class="sensory", cell_class="visual", side="right"),
        "optic_L": cx.select(super_class="optic", side="left"),
        "optic_R": cx.select(super_class="optic", side="right"),
        "dn_L": cx.select(super_class="descending", side="left"),
        "dn_R": cx.select(super_class="descending", side="right"),
    }
    acc = {k: 0.0 for k in pops}
    acc["all"] = 0.0
    cnt = 0
    hz = 1000.0 / net.p.dt_ms
    for t in range(steps):
        net.step()
        net.force_poisson(pops["photo_L"], rate_L)
        net.force_poisson(pops["photo_R"], rate_R)
        if t >= warm:
            for k, idx in pops.items():
                acc[k] += float(net.spikes[idx].mean()) if idx.size else 0.0
            acc["all"] += float(net.spikes.mean())
            cnt += 1
    return {k: v / cnt * hz for k, v in acc.items()}


def run(verbose: bool = True) -> bool:
    cx = Connectome()
    results: list[tuple[str, bool, str]] = []

    # 1 -------------------------------------------------------------- data
    ok = cx.n == 139_255
    results.append(("neuron count == 139,255", ok, f"{cx.n:,}"))
    ok = cx.n_edges == 2_700_513
    results.append(
        ("edges == 2,700,513 (syn>=5)", ok, f"{cx.n_edges:,}")
    )
    exc = float((cx.sign > 0).mean())
    ok = 0.70 <= exc <= 0.80
    results.append(("excitatory fraction 70-80%", ok, f"{exc*100:.1f}%"))

    # 2 ------------------------------------------------- signal propagation
    r = _open_loop(cx, 0.14, 600.0, 0.0)
    ipsi, contra = r["optic_L"], r["optic_R"]
    ok = ipsi > 0.5 and contra < ipsi * 0.15
    results.append(
        ("left eye -> ipsilateral optic lobe", ok,
         f"L {ipsi:.2f} Hz vs R {contra:.2f} Hz"),
    )

    # 3 -------------------------------------------------- descending bias
    left = _open_loop(cx, 0.14, 600.0, 0.0)
    right = _open_loop(cx, 0.14, 0.0, 600.0)
    bias_l = left["dn_R"] - left["dn_L"]      # stim left  -> expect DN_R higher
    bias_r = right["dn_L"] - right["dn_R"]    # stim right -> expect DN_L higher
    ok = bias_l > 0 and bias_r > 0
    results.append(
        ("descending bias is contralateral", ok,
         f"stimL {bias_l:+.2f} Hz, stimR {bias_r:+.2f} Hz"),
    )

    # 4 -------------------------------------------------------- stability
    lo = _open_loop(cx, 0.14, 600.0, 0.0)["all"]
    hi = _open_loop(cx, 0.25, 600.0, 0.0)["all"]
    ok = lo < 40.0 < hi
    results.append(
        ("gain 0.14 below ignition", ok,
         f"{lo:.1f} Hz at 0.14 vs {hi:.1f} Hz at 0.25"),
    )

    # 5 -------------------------------------------------------- closed loop
    def chase(sign: float, seed: int, ticks: int = 700) -> tuple[float, float]:
        sim = Simulation(
            cx=cx,
            coupling=CouplingParams(turn_sign=sign, wander_hz=0.25),
            seed=seed,
        )
        w = sim.world
        w.clear_sources()
        w.add_source(w.width * 0.82, w.height * 0.5, LIGHT, 1.0)
        w.agent.x, w.agent.y, w.agent.theta = w.width * 0.18, w.height * 0.5, 0.0
        s = w.sources[0]
        total = 0.0
        near = 0
        for _ in range(ticks):
            sim.tick()
            d = math.hypot(w.agent.x - s.x, w.agent.y - s.y)
            total += d
            if d < 150.0:
                near += 1
        return total / ticks, near / ticks * 100.0

    ap = [chase(+1.0, s) for s in (1, 2, 3)]
    av = [chase(-1.0, s) for s in (1, 2, 3)]
    ap_mean = float(np.mean([a[0] for a in ap]))
    ap_near = float(np.mean([a[1] for a in ap]))
    av_mean = float(np.mean([a[0] for a in av]))
    av_near = float(np.mean([a[1] for a in av]))
    # Occupancy near the source is the robust statistic: a wandering agent can
    # brush past once by chance, but it cannot *stay* near. A 150-unit disc is
    # 10.4% of this arena, so that is the chance level to beat.
    chance = 10.4
    ok = ap_near > 2.5 * chance and av_near < chance and ap_mean < av_mean * 0.7
    results.append(
        ("approach separates from avoid", ok,
         f"near-source {ap_near:.0f}% vs {av_near:.0f}% (chance {chance}%), "
         f"mean dist {ap_mean:.0f} vs {av_mean:.0f}"),
    )

    if verbose:
        print("FlyWire 2D simulator — validation\n")
        for name, good, detail in results:
            print(_line(name, good, detail))
        n_ok = sum(1 for _, g, _ in results if g)
        print(f"\n  {n_ok}/{len(results)} checks passed")
    return all(g for _, g, _ in results)


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(0 if run() else 1)

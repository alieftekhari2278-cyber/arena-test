#!/usr/bin/env python3
"""
calibrate.py — find the motor read-outs in the data instead of hand-picking them.

Rather than deciding by hand which descending neurons mean "walk", "turn" or
"groom", we do what the paper does: drive a sensory population, let the whole
brain settle, and record which descending / motor neurons answer. The resulting
lists are written back into meta.json and the 2D world reads its motor commands
from them.

Protocols (all at 150 Hz, the range Shiu et al. use for GRN stimulation):
  sugar GRNs           -> feeding read-out          (expect MN9 among the top)
  bitter GRNs          -> aversive read-out
  antennal mechanosensory ("grooming" sub-class) -> grooming read-out
  photoreceptors, left / right eye separately     -> visual steering read-out
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.expanduser("~/.pylibs"))
import numpy as np
from brain import FlyBrain

BUILD = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "build")


def run(b, stim_groups, hz=150.0, ms=800.0):
    b.reset_state()
    b.clear_drive()
    for g in stim_groups:
        b.set_drive(b.group(g), hz)
    for _ in range(int(ms / b.dt)):
        b.step()
    return b.spike_count.copy() / (ms / 1000.0)      # Hz per neuron


def main():
    b = FlyBrain(graph="full", dt=0.6)
    meta = b.meta
    dn = np.asarray(meta["groups"]["dn_all"])
    motor = np.asarray(meta["groups"]["motor"])
    out = {}

    protocols = {
        "feed": ["sugar_grn"],
        "bitter": ["bitter_grn"],
        "groom": ["groom_sensory"],
        "vis_left": ["photoreceptor_left"],
        "vis_right": ["photoreceptor_right"],
    }
    rates = {}
    for name, gs in protocols.items():
        r = run(b, gs)
        rates[name] = r
        act = int((r > 1).sum())
        print(f"{name:10s} stim {', '.join(gs):22s} -> {act:6d} neurons above 1 Hz, "
              f"{int((r[dn] > 1).sum()):4d} DNs, {int((r[motor] > 1).sum()):3d} motor neurons")

    base = np.zeros_like(rates["feed"])
    for name in ("feed", "bitter", "groom"):
        r = rates[name]
        sel_dn = dn[r[dn] > 2.0]
        sel_mn = motor[r[motor] > 2.0]
        out[f"dn_{name}"] = sorted(int(i) for i in sel_dn)
        out[f"mn_{name}"] = sorted(int(i) for i in sel_mn)
        print(f"  read-out dn_{name}: {len(sel_dn)} DNs, mn_{name}: {len(sel_mn)} motor neurons")

    # visual steering: descending neurons that prefer one eye
    dl, dr = rates["vis_left"][dn], rates["vis_right"][dn]
    pref_l = dn[(dl > dr + 1.0)]
    pref_r = dn[(dr > dl + 1.0)]
    out["dn_vis_left"] = sorted(int(i) for i in pref_l)
    out["dn_vis_right"] = sorted(int(i) for i in pref_r)
    print(f"  read-out dn_vis_left: {len(pref_l)}, dn_vis_right: {len(pref_r)}")

    meta["groups"].update(out)
    meta["group_sizes"].update({k: len(v) for k, v in out.items()})
    meta["calibrated"] = True
    with open(os.path.join(BUILD, "meta.json"), "w") as f:
        json.dump(meta, f)
    print("meta.json updated")


if __name__ == "__main__":
    main()

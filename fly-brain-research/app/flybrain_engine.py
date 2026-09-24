"""
Whole adult fruit-fly brain — LIF engine over the complete FlyWire v783 connectome.
138,639 neurons, 15,091,983 directed edges, 54,492,922 synapses. Zero neurons removed.
Parameters verbatim from Shiu et al. 2024, Nature 634:210 (philshiu/Drosophila_brain_model).
"""
import json
import os
import time

import numpy as np
import pandas as pd
import scipy.sparse as sp

DATA = os.path.expanduser("~/.cache/flybrain")
COMP = os.path.join(DATA, "Drosophila_brain_model", "Completeness_783.csv")
CON = os.path.join(DATA, "Drosophila_brain_model", "Connectivity_783.parquet")
ANN = os.path.join(DATA, "flywire_annotations", "supplemental_files",
                   "Supplemental_file1_neuron_annotations.tsv")
CAL_CACHE = os.path.join(DATA, "calibration_783.json")

# --- Shiu et al. 2024 parameters ---
v0, vth, vrst = -52.0, -45.0, -52.0            # mV
t_mbr, tau_g, t_rfc, t_dly = 20.0, 5.0, 2.2, 1.8  # ms
w_syn = 0.275                                   # mV / synapse
dt = 0.1                                        # ms
f_poi = 250.0                                   # Poisson weight scaling
INJ = w_syn * f_poi                             # 68.75 mV direct kick to v
D = int(round(t_dly / dt))                      # delay steps
REFR = int(round(t_rfc / dt))
NB = 512                                        # ring-buffer slots
TAU_RATE = 200.0                                # ms, EMA for rate estimates
IMP = (1.0 - np.exp(-dt / TAU_RATE)) / (dt * 1e-3)   # ~5.0 → rate EMA ≈ Hz


class Engine:
    def __init__(self):
        t0 = time.time()
        comp = pd.read_csv(COMP, index_col=0)
        self.ids = comp.index.values.astype(np.int64)          # root ids
        self.N = len(self.ids)
        id2i = {int(r): i for i, r in enumerate(self.ids)}

        df = pd.read_parquet(CON, columns=["Presynaptic_Index", "Postsynaptic_Index",
                                           "Connectivity", "Excitatory x Connectivity"])
        self.W = sp.csr_matrix(
            (df["Excitatory x Connectivity"].values.astype(np.float32),
             (df["Presynaptic_Index"].values, df["Postsynaptic_Index"].values)),
            shape=(self.N, self.N))
        self.W.sort_indices()
        self.n_edges = int(self.W.nnz)
        self.n_syn = int(df["Connectivity"].sum())
        del df

        ann = pd.read_csv(ANN, sep="\t", low_memory=False)
        ann = ann[ann["root_id"].isin(id2i)].copy()
        ann["idx"] = ann["root_id"].map(id2i)
        self.ann = ann
        # positions in MODEL-index space (a few model neurons lack annotations)
        self.pos = np.full((self.N, 2), np.nan, np.float32)
        self.pos[ann["idx"].values.astype(np.int32)] = ann[["soma_x", "soma_y"]].values.astype(np.float32)
        nmiss = int(np.isnan(self.pos[:, 0]).sum())
        if nmiss:
            self.pos[np.isnan(self.pos[:, 0])] = np.nanmedian(self.pos, axis=0)
        sub = ann["cell_sub_class"].fillna("").astype(str)
        typ = ann["cell_type"].fillna("").astype(str)
        side = ann["side"].fillna("na").astype(str)
        cls = ann["cell_class"].fillna("").astype(str)

        def grp(sub_kw=None, typ_eq=None, side_eq=None, cls_kw=None):
            m = np.ones(len(ann), bool)
            if sub_kw: m &= sub.str.lower().str.contains(sub_kw)
            if typ_eq is not None: m &= typ == typ_eq
            if side_eq: m &= side == side_eq
            if cls_kw: m &= cls.str.lower().str.contains(cls_kw)
            return ann.loc[m, "idx"].values.astype(np.int32)

        self.groups = {
            "sugarL": grp(sub_kw="sugar", side_eq="left"),
            "sugarR": grp(sub_kw="sugar", side_eq="right"),
            "bitterL": grp(sub_kw="bitter", side_eq="left"),
            "bitterR": grp(sub_kw="bitter", side_eq="right"),
        }
        # DN table: type -> {side: idx list}
        is_dn = typ.str.startswith("DN")
        self.dn_table = {}
        for t, s, i in zip(typ[is_dn], side[is_dn], ann.loc[is_dn, "idx"]):
            self.dn_table.setdefault(t, {}).setdefault(s, []).append(int(i))
        # class code for rendering: 0 other 1 sugar 2 bitter 3 chosen-DN 4 other-DN 5 kenyon 6 visual
        self.classcode = np.zeros(self.N, np.uint8)
        self.classcode[self.groups["sugarL"]] = 1
        self.classcode[self.groups["sugarR"]] = 1
        self.classcode[self.groups["bitterL"]] = 2
        self.classcode[self.groups["bitterR"]] = 2
        for t, d in self.dn_table.items():
            for s, lst in d.items():
                self.classcode[np.array(lst, np.int32)] = 4
        self.classcode[ann.loc[cls == "Kenyon_Cell", "idx"].values.astype(np.int32)] = 5
        vis = ann.loc[cls.str.contains("visual|ME|LA|LOP?", regex=True), "idx"].values.astype(np.int32)
        self.classcode[vis] = 6

        # state
        self.rng = np.random.default_rng(7)
        # ambient background drive (engineering layer, toggleable): random neurons
        self.ambient_idx = self.rng.choice(self.N, 800, replace=False).astype(np.int32)
        self.ambient_rate = 0.0  # Hz; set by server
        self.reset()
        self.load_s = time.time() - t0

    def reset(self):
        self.v = np.full(self.N, v0, np.float32)
        self.g = np.zeros(self.N, np.float32)
        self.last = np.full(self.N, -10**9, np.int64)
        self.rate = np.zeros(self.N, np.float32)
        self.buf_i = [[] for _ in range(NB)]
        self.buf_w = [[] for _ in range(NB)]
        self.head = 0
        self.step_i = 0
        self.bio_ms = 0.0
        self.total_spikes = 0
        self.drive = {}          # name -> rate Hz (targets = self.groups[name])
        self.opto = None         # (idx array, rate, until_ms)

    # ---------------- core ----------------
    def run_ms(self, ms):
        n = int(round(ms / dt))
        decay = np.float32(np.exp(-dt / tau_g))
        rdecay = np.float32(np.exp(-dt / TAU_RATE))
        per = dt * 1e-3
        for _ in range(n):
            for idx, w in zip(self.buf_i[self.head], self.buf_w[self.head]):
                np.add.at(self.g, idx, w)
            self.buf_i[self.head] = []
            self.buf_w[self.head] = []
            self.head = (self.head + 1) % NB

            # sensory / optogenetic Poisson drive (driven neurons: no refractory, rfc=0)
            for name, rate in self.drive.items():
                if rate <= 0: continue
                idx = self.groups[name]
                hit = self.rng.random(len(idx)) < rate * per
                if hit.any():
                    v = self.v
                    v[idx[hit]] += INJ
                    self.last[idx[hit]] = -10**9
            if self.opto is not None and self.bio_ms < self.opto[2]:
                idx = self.opto[0]
                hit = self.rng.random(len(idx)) < self.opto[1] * per
                if hit.any():
                    self.v[idx[hit]] += INJ
                    self.last[idx[hit]] = -10**9
            if self.ambient_rate > 0:
                idx = self.ambient_idx
                hit = self.rng.random(len(idx)) < self.ambient_rate * per
                if hit.any():
                    self.v[idx[hit]] += INJ

            v = self.v
            v += (dt / t_mbr) * (v0 - v + self.g)
            self.g *= decay
            spk = np.nonzero((v > vth) & ((self.step_i - self.last) > REFR))[0]
            if len(spk):
                self.total_spikes += len(spk)
                v[spk] = vrst
                self.g[spk] = 0
                self.last[spk] = self.step_i
                self.rate[spk] += IMP
                y = (sp.csr_matrix((np.ones(len(spk), np.float32),
                                    (np.zeros(len(spk), np.int64), spk)),
                                   shape=(1, self.N)) @ self.W).tocoo()
                slot = (self.head + D - 1) % NB
                self.buf_i[slot].append(y.col)
                self.buf_w[slot].append(y.data * w_syn)
            self.rate *= rdecay
            self.step_i += 1
        self.bio_ms += n * dt

    def group_rate(self, idx):
        return float(self.rate[idx].mean()) if len(idx) else 0.0

    # ---------------- calibration ----------------
    def _probe(self, drives, ms=400.0):
        self.reset()
        self.drive = dict(drives)
        self.run_ms(ms)
        self.drive = {}
        return {t: {s: self.group_rate(np.array(ix, np.int32)) for s, ix in d.items()}
                for t, d in self.dn_table.items()}

    def calibrate(self, verbose=True):
        if os.path.exists(CAL_CACHE):
            cal = json.load(open(CAL_CACHE))
            self.dn_type = cal["type"]
            self.dnL = np.array(cal["dnL"], np.int32)
            self.dnR = np.array(cal["dnR"], np.int32)
            self.dn_norm = cal["norm"]
            self.dn_normL = cal.get("ipsiL", 60.0)
            self.dn_normR = cal.get("ipsiR", 60.0)
            return cal
        t0 = time.time()
        if verbose: print("calibrating: sugar LEFT drive ...", flush=True)
        rL = self._probe({"sugarL": 150.0})
        if verbose: print("calibrating: sugar RIGHT drive ...", flush=True)
        rR = self._probe({"sugarR": 150.0})
        if verbose: print("calibrating: bitter drive ...", flush=True)
        rB = self._probe({"bitterL": 150.0, "bitterR": 150.0})
        rows = []
        for t, d in self.dn_table.items():
            if "left" not in d or "right" not in d: continue
            ipsiL = rL[t].get("left", 0); ipsiR = rR[t].get("right", 0)
            bit = max(rB[t].get("left", 0), rB[t].get("right", 0))
            # harmonic mean rewards response; hard symmetry gate (<=1.6x L/R gain)
            # is essential for closed-loop steering with a raw L/R asymmetry readout
            hm = 2 * ipsiL * ipsiR / (ipsiL + ipsiR + 1e-9) if ipsiL + ipsiR > 0 else 0.0
            sym = abs(np.log2((ipsiL + 1) / (ipsiR + 1)))
            score = (hm - 1.5 * bit) if sym <= 0.678 else -1e9
            rows.append((t, score, ipsiL, ipsiR, bit, len(d["left"]), len(d["right"])))
        rows.sort(key=lambda r: -r[1])
        best = rows[0]
        self.dn_type = best[0]
        self.dnL = np.array(self.dn_table[best[0]]["left"], np.int32)
        self.dnR = np.array(self.dn_table[best[0]]["right"], np.int32)
        self.dn_norm = max(10.0, 0.5 * (best[2] + best[3]))
        bt = best[0]
        self.crossed = (rR[bt].get("left", 0) > rR[bt].get("right", 0)) or (rL[bt].get("right", 0) > rL[bt].get("left", 0))
        cal = {"type": self.dn_type, "score": best[1], "ipsiL": best[2], "ipsiR": best[3],
               "bitter": best[4], "norm": self.dn_norm,
               "dnL": self.dnL.tolist(), "dnR": self.dnR.tolist(),
               "top": [[r[0]] + [float(x) for x in r[1:]] for r in rows[:10]],
               "crossed": bool(getattr(self, "crossed", False)), "wall_s": time.time() - t0}
        json.dump(cal, open(CAL_CACHE, "w"))
        if verbose:
            print(f"chosen DN type: {self.dn_type} | ipsi L/R sugar: {best[2]:.0f}/{best[3]:.0f} Hz | bitter: {best[4]:.0f} Hz")
            print("top candidates (type, score, ipsiL, ipsiR, bitter):")
            for r in rows[:8]:
                print(f"   {r[0]:<10} {r[1]:8.1f}  {r[2]:7.1f} {r[3]:7.1f} {r[4]:7.1f}")
        self.reset()
        return cal


if __name__ == "__main__":
    t0 = time.time()
    eng = Engine()
    print(f"loaded {eng.N:,} neurons / {eng.n_edges:,} edges / {eng.n_syn:,} synapses in {eng.load_s:.1f}s")
    print("groups:", {k: len(v) for k, v in eng.groups.items()})
    cal = eng.calibrate()
    # sanity: feeding-style run, sugar both sides
    eng.reset(); eng.drive = {"sugarL": 150.0, "sugarR": 150.0}
    t1 = time.time(); eng.run_ms(300.0); wall = time.time() - t1
    print(f"\nsanity sugar run: 300ms bio in {wall:.1f}s wall ({300/wall:.2f}x)")
    print(f"  spikes: {eng.total_spikes:,} | active(>5Hz): {(eng.rate>5).sum():,}")
    print(f"  DN[{eng.dn_type}] L={eng.group_rate(eng.dnL):.0f}Hz R={eng.group_rate(eng.dnR):.0f}Hz")
    print(f"\ntotal boot: {time.time()-t0:.1f}s")

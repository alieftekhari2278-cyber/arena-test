#!/usr/bin/env python3
"""
build_graph.py — turn the public FlyWire FAFB v783 dumps into a compact,
memory-mappable spiking-network substrate.

Inputs (data/raw, see fetch_data.py):
  classification.csv.gz    Codex v783 : root_id, flow, super_class, class, sub_class, side, nerve
  neurons.csv.gz           Codex v783 : root_id, group, nt_type, nt scores
  coordinates.csv.gz       Codex v783 : root_id, position [x y z] in nm
  connections.csv.gz       Codex v783 : pre, post, neuropil, syn_count, nt  (>=5 synapse threshold)
  Connectivity_783.parquet Shiu et al. 2024 : 15,091,983 rows, every connection >=1 synapse,
                                              with the excitatory/inhibitory sign used in the paper
  Completeness_783.csv     Shiu et al. 2024 : the neuron list their indices refer to

Outputs (data/build):
  neurons.npz   per-neuron metadata + 2D coordinates for all 139,255 neurons
  graph_full.npz  CSC-by-presynaptic-neuron of ALL 15.09M connections (Shiu weights)
  graph_t5.npz    same graph restricted to connections of >=5 synapses (fast mode)
  meta.json     label tables + the sensory / motor neuron groups used by the 2D world
  neurons.bin   compact binary the browser downloads to draw every neuron

Nothing here subsamples neurons: every one of the 139,255 proofread FlyWire neurons
keeps its own index, its own membrane state and its own dot on the screen.
"""
import csv
import gzip
import json
import os
import sys
import time

sys.path.insert(0, os.path.expanduser("~/.pylibs"))
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
RAW = os.path.join(ROOT, "data", "raw")
OUT = os.path.join(ROOT, "data", "build")
os.makedirs(OUT, exist_ok=True)

W_SYN = 0.275  # mV per synapse (Shiu et al. 2024, the model's single free parameter)


def log(*a):
    print(f"[{time.strftime('%H:%M:%S')}]", *a, flush=True)


# ----------------------------------------------------------------- neurons
log("reading classification.csv.gz")
root_ids, flow, super_class, cls, sub_class, side = [], [], [], [], [], []
with gzip.open(os.path.join(RAW, "classification.csv.gz"), "rt") as f:
    for r in csv.DictReader(f):
        root_ids.append(int(r["root_id"]))
        flow.append(r["flow"])
        super_class.append(r["super_class"])
        cls.append(r["class"])
        sub_class.append(r["sub_class"])
        side.append(r["side"])

root_ids = np.array(root_ids, dtype=np.int64)
N = len(root_ids)
# canonical neuron index = FlyWire root_id in ascending order, so that every table
# (Codex, Shiu et al., the browser) can be joined with a single searchsorted
order = np.argsort(root_ids, kind="stable")
root_ids = root_ids[order]
flow = [flow[i] for i in order]
super_class = [super_class[i] for i in order]
cls = [cls[i] for i in order]
sub_class = [sub_class[i] for i in order]
side = [side[i] for i in order]
assert np.all(np.diff(root_ids) > 0), "duplicate root_id in classification.csv"
log(f"  {N} neurons")

def encode(values):
    labels = sorted(set(values))
    lut = {v: i for i, v in enumerate(labels)}
    return np.array([lut[v] for v in values], dtype=np.uint8), labels

super_code, super_labels = encode(super_class)
class_code, class_labels = encode(cls)
sub_code, sub_labels = encode(sub_class)
side_code, side_labels = encode(side)

# ----------------------------------------------------------------- neurotransmitter
log("reading neurons.csv.gz (neurotransmitter predictions)")
nt_by_id = {}
with gzip.open(os.path.join(RAW, "neurons.csv.gz"), "rt") as f:
    for r in csv.DictReader(f):
        nt_by_id[int(r["root_id"])] = r["nt_type"] or "UNK"
nt = [nt_by_id.get(int(i), "UNK") for i in root_ids]
nt_code, nt_labels = encode(nt)
# Eckstein et al. 2024 / Shiu et al. 2024: GABA and glutamate inhibit, everything else excites
INHIB = {"GABA", "GLUT"}
sign_by_neuron = np.array([-1.0 if v in INHIB else 1.0 for v in nt], dtype=np.float32)
log("  NT counts: " + ", ".join(f"{l}={int((nt_code==i).sum())}" for i, l in enumerate(nt_labels)))

# ----------------------------------------------------------------- coordinates
log("reading coordinates.csv.gz")
sumx = np.zeros(N, np.float64); sumy = np.zeros(N, np.float64)
sumz = np.zeros(N, np.float64); cnt = np.zeros(N, np.float64)
with gzip.open(os.path.join(RAW, "coordinates.csv.gz"), "rt") as f:
    for r in csv.DictReader(f):
        i = int(np.searchsorted(root_ids, int(r["root_id"])))
        if i >= N or root_ids[i] != int(r["root_id"]):
            continue
        p = r["position"].strip("[]").split()
        sumx[i] += float(p[0]); sumy[i] += float(p[1]); sumz[i] += float(p[2]); cnt[i] += 1
missing = cnt == 0
log(f"  neurons without coordinates: {int(missing.sum())}")
cnt[missing] = 1
px, py, pz = sumx / cnt, sumy / cnt, sumz / cnt
# fill the few missing ones with the centroid of their super_class
for c in np.unique(super_code):
    m = (super_code == c) & missing
    if m.any():
        ref = (super_code == c) & ~missing
        px[m], py[m], pz[m] = px[ref].mean(), py[ref].mean(), pz[ref].mean()

# ----------------------------------------------------------------- connections
def load_shiu():
    """All 15,091,983 connections with the paper's own excitatory/inhibitory sign."""
    import pyarrow.parquet as pq
    path = os.path.join(RAW, "Connectivity_783.parquet")
    pf = pq.ParquetFile(path)
    n_rows = pf.metadata.num_rows
    pre = np.empty(n_rows, np.int32)
    post = np.empty(n_rows, np.int32)
    wgt = np.empty(n_rows, np.float32)
    off = 0
    for rg in range(pf.num_row_groups):
        t = pf.read_row_group(rg, columns=["Presynaptic_ID", "Postsynaptic_ID", "Excitatory x Connectivity"])
        a = t.column(0).to_numpy()
        b = t.column(1).to_numpy()
        w = t.column(2).to_numpy().astype(np.float32)
        ia = np.searchsorted(root_ids, a)
        ib = np.searchsorted(root_ids, b)
        ok = (ia < N) & (ib < N)
        ok &= root_ids[np.clip(ia, 0, N - 1)] == a
        ok &= root_ids[np.clip(ib, 0, N - 1)] == b
        k = int(ok.sum())
        pre[off:off + k] = ia[ok]; post[off:off + k] = ib[ok]; wgt[off:off + k] = w[ok]
        off += k
        log(f"  row group {rg + 1}/{pf.num_row_groups}: kept {off:,}")
    return pre[:off], post[:off], wgt[:off]


def load_codex():
    """Codex connection table (>=5 synapses), used to cover neurons Shiu's file misses."""
    pre_l, post_l, w_l = [], [], []
    with gzip.open(os.path.join(RAW, "connections.csv.gz"), "rt") as f:
        rdr = csv.reader(f)
        next(rdr)
        for row in rdr:
            pre_l.append(int(row[0])); post_l.append(int(row[1])); w_l.append(int(row[3]))
    a = np.array(pre_l, np.int64); b = np.array(post_l, np.int64); w = np.array(w_l, np.float32)
    ia = np.searchsorted(root_ids, a); ib = np.searchsorted(root_ids, b)
    ok = (ia < N) & (ib < N)
    ok &= root_ids[np.clip(ia, 0, N - 1)] == a
    ok &= root_ids[np.clip(ib, 0, N - 1)] == b
    ia, ib, w = ia[ok].astype(np.int32), ib[ok].astype(np.int32), w[ok]
    # rows are per (pair, neuropil) -> collapse to one weight per ordered pair
    key = ia.astype(np.int64) * N + ib
    order = np.argsort(key, kind="stable")
    key, ia, ib, w = key[order], ia[order], ib[order], w[order]
    uniq, start = np.unique(key, return_index=True)
    tot = np.add.reduceat(w, start)
    ia, ib = ia[start], ib[start]
    return ia, ib, tot * sign_by_neuron[ia]


log("reading Connectivity_783.parquet (Shiu et al. full connection list)")
pre, post, wgt = load_shiu()
log(f"  {len(pre):,} connections mapped onto the 139,255-neuron index")

log("reading connections.csv.gz (Codex) to patch neurons missing from the Shiu table")
cpre, cpost, cw = load_codex()
log(f"  Codex pairs mapped: {len(cpre):,}")
covered = np.zeros(N, bool)
covered[pre] = True
covered[post] = True
extra = ~covered[cpre] | ~covered[cpost]
log(f"  neurons absent from Shiu's table: {int((~covered).sum())}; extra Codex edges added: {int(extra.sum()):,}")
pre = np.concatenate([pre, cpre[extra]])
post = np.concatenate([post, cpost[extra]])
wgt = np.concatenate([wgt, cw[extra]])

# weights in mV
wgt = (wgt * W_SYN).astype(np.float32)

# ----------------------------------------------------------------- CSC by presynaptic neuron
def build_csc(pre, post, wgt, name):
    order = np.argsort(pre, kind="stable")
    p, q, w = pre[order], post[order], wgt[order]
    counts = np.bincount(p, minlength=N)
    indptr = np.zeros(N + 1, np.int64)
    np.cumsum(counts, out=indptr[1:])
    path = os.path.join(OUT, name)
    np.savez(path, indptr=indptr, post=q.astype(np.int32), w=w.astype(np.float32))
    log(f"  wrote {name}: {len(q):,} edges, {os.path.getsize(path + '.npz') / 1e6:.0f} MB")
    return counts


log("building CSC (full graph)")
out_deg = build_csc(pre, post, wgt, "graph_full")

log("building CSC (>=5 synapses)")
keep = np.abs(wgt) >= 5 * W_SYN - 1e-6
build_csc(pre[keep], post[keep], wgt[keep], "graph_t5")

in_syn = np.bincount(post, weights=np.abs(wgt) / W_SYN, minlength=N)
out_syn = np.bincount(pre, weights=np.abs(wgt) / W_SYN, minlength=N)
log(f"  total synapses represented: {out_syn.sum():,.0f}")

# ----------------------------------------------------------------- 2D layout
# FlyWire coordinates are nanometres in the EM volume; x is medio-lateral,
# y dorso-ventral, z anterior-posterior. The frontal view (x, y) is the classic
# "fly brain portrait", so that is what the 2D brain map uses.
X = (px - px.min()) / (px.max() - px.min())
Y = (py - py.min()) / (py.max() - py.min())
Z = (pz - pz.min()) / (pz.max() - pz.min())

np.savez(os.path.join(OUT, "neurons"),
         root_id=root_ids, x=X.astype(np.float32), y=Y.astype(np.float32), z=Z.astype(np.float32),
         super_code=super_code, class_code=class_code, sub_code=sub_code,
         side_code=side_code, nt_code=nt_code, sign=sign_by_neuron,
         in_syn=in_syn.astype(np.float32), out_syn=out_syn.astype(np.float32))

# compact binary for the browser: x,y as uint16 + super/class/side codes
buf = np.empty(N, dtype=np.dtype([("x", "<u2"), ("y", "<u2"), ("s", "u1"), ("c", "u1"), ("sd", "u1"), ("nt", "u1")]))
buf["x"] = np.round(X * 65535).astype(np.uint16)
buf["y"] = np.round(Y * 65535).astype(np.uint16)
buf["s"] = super_code
buf["c"] = class_code
buf["sd"] = side_code
buf["nt"] = nt_code
buf.tofile(os.path.join(OUT, "neurons.bin"))
log(f"  wrote neurons.bin ({os.path.getsize(os.path.join(OUT, 'neurons.bin')) / 1e6:.1f} MB)")

# ----------------------------------------------------------------- neuron groups for the 2D world
def idx_of(ids):
    ids = np.asarray(sorted(set(int(i) for i in ids)), dtype=np.int64)
    j = np.searchsorted(root_ids, ids)
    j = j[(j < N)]
    j = j[root_ids[j] == ids[:len(j)]] if len(j) else j
    return sorted(int(v) for v in j)


# Gustatory / mechanosensory neuron identities published with Shiu et al. 2024
# (figures.ipynb of github.com/philshiu/Drosophila_brain_model)
SUGAR = [720575940624963786, 720575940630233916, 720575940637568838, 720575940638202345, 720575940617000768,
         720575940630797113, 720575940632889389, 720575940621754367, 720575940621502051, 720575940640649691,
         720575940639332736, 720575940616885538, 720575940639198653, 720575940620900446, 720575940617937543,
         720575940632425919, 720575940633143833, 720575940612670570, 720575940628853239, 720575940629176663,
         720575940611875570]
BITTER = [720575940621778381, 720575940602353632, 720575940617094208, 720575940619197093, 720575940626287336,
          720575940618600651, 720575940627692048, 720575940630195909, 720575940646212996, 720575940610483162,
          720575940645743412, 720575940627578156, 720575940622298631, 720575940621008895, 720575940629146711,
          720575940610259370, 720575940610481370, 720575940619028208, 720575940614281266, 720575940613061118,
          720575940604027168]
WATER = [720575940612950568, 720575940631898285, 720575940606002609, 720575940612579053, 720575940622902535,
         720575940616177458, 720575940660292225, 720575940622486922, 720575940613786774, 720575940629852866,
         720575940625861168, 720575940613996959, 720575940617857694, 720575940644965399, 720575940625203504,
         720575940630553415, 720575940635172191, 720575940634796536]
MN9 = [720575940660219265, 720575940645521262]  # proboscis extension motor neuron, left + right

groups = {
    "sugar_grn": idx_of(SUGAR),
    "bitter_grn": idx_of(BITTER),
    "water_grn": idx_of(WATER),
    "mn9": idx_of(MN9),
}

sc = {l: i for i, l in enumerate(super_labels)}
cc = {l: i for i, l in enumerate(class_labels)}
sbc = {l: i for i, l in enumerate(sub_labels)}
sd = {l: i for i, l in enumerate(side_labels)}

def where(mask):
    return np.flatnonzero(mask)

is_left = side_code == sd.get("left", 255)
is_right = side_code == sd.get("right", 255)

photo = where(sub_code == sbc["photo_receptor"])
groups["photoreceptor_left"] = sorted(int(i) for i in photo[is_left[photo]])
groups["photoreceptor_right"] = sorted(int(i) for i in photo[is_right[photo]])
orn = where((class_code == cc["olfactory"]) & (super_code == sc["sensory"]))
groups["orn_left"] = sorted(int(i) for i in orn[is_left[orn]])
groups["orn_right"] = sorted(int(i) for i in orn[is_right[orn]])
mech = where(class_code == cc["mechanosensory"])
groups["mechano_left"] = sorted(int(i) for i in mech[is_left[mech]])
groups["mechano_right"] = sorted(int(i) for i in mech[is_right[mech]])
bristle = where((sub_code == sbc["head_bristle"]) | (sub_code == sbc["eye_bristle"]))
groups["bristle_left"] = sorted(int(i) for i in bristle[is_left[bristle]])
groups["bristle_right"] = sorted(int(i) for i in bristle[is_right[bristle]])
wind = where(sub_code == sbc["wind_gravity"])
groups["wind_left"] = sorted(int(i) for i in wind[is_left[wind]])
groups["wind_right"] = sorted(int(i) for i in wind[is_right[wind]])
dn = where(super_code == sc["descending"])
groups["dn_left"] = sorted(int(i) for i in dn[is_left[dn]])
groups["dn_right"] = sorted(int(i) for i in dn[is_right[dn]])
groups["dn_all"] = sorted(int(i) for i in dn)
groups["motor"] = sorted(int(i) for i in where(super_code == sc["motor"]))
groups["visual_projection"] = sorted(int(i) for i in where(super_code == sc["visual_projection"]))
groups["kenyon"] = sorted(int(i) for i in where(class_code == cc["Kenyon_Cell"]))
groups["central_complex"] = sorted(int(i) for i in where(class_code == cc["CX"]))
groups["mbon"] = sorted(int(i) for i in where(class_code == cc["MBON"]))
groups["dan"] = sorted(int(i) for i in where(class_code == cc["DAN"]))
# mechanosensory neurons annotated "grooming" — the antennal bristle / JO cells
# that trigger the grooming sequence in figure 5 of Shiu et al. 2024
groups["groom_sensory"] = sorted(int(i) for i in where(sub_code == sbc["grooming"]))
groups["auditory"] = sorted(int(i) for i in where(sub_code == sbc["auditory"]))
groups["taste_peg"] = sorted(int(i) for i in where(sub_code == sbc["taste_peg"]))

# Putative glomerular odour channels. FlyWire does not label the glomerulus of
# every ORN, but ORNs of one glomerulus converge on the same projection
# neurons, so grouping ORNs by their strongest postsynaptic partner recovers
# channels that behave like glomeruli. Which channel an odour drives is an
# arbitrary choice of this demo — the fly's actual receptor chemistry is not
# in the connectome.
_g = np.load(os.path.join(OUT, "graph_full.npz"))
_indptr, _post, _w = _g["indptr"], _g["post"], _g["w"]
orn_all = sorted(groups["orn_left"] + groups["orn_right"])
top = {}
for i in orn_all:
    a, bb = int(_indptr[i]), int(_indptr[i + 1])
    if bb > a:
        j = int(_post[a + int(np.argmax(np.abs(_w[a:bb])))])
        top.setdefault(j, []).append(i)
clusters = sorted(top.values(), key=len, reverse=True)
N_CH = 6
for k in range(N_CH):
    groups[f"orn_ch{k}_left"] = []
    groups[f"orn_ch{k}_right"] = []
for n, cl in enumerate(clusters):
    k = n % N_CH
    for i in cl:
        groups[f"orn_ch{k}_{'left' if is_left[i] else 'right'}"].append(int(i))
log(f"  {len(clusters)} putative glomerular clusters -> {N_CH} odour channels")

# ---- retinotopy -------------------------------------------------------------
# Photoreceptors sit in a retinotopic lattice, so their own position inside the
# optic lobe gives an azimuth axis directly.
retino = {}
for eye in ("left", "right"):
    ids = np.array(groups[f"photoreceptor_{eye}"], dtype=np.int64)
    if len(ids) == 0:
        continue
    zz = Z[ids]  # anterior-posterior axis ~ azimuth within an optic lobe
    yy = Y[ids]
    az = (zz - zz.min()) / max(float(np.ptp(zz)), 1e-9)
    el = (yy - yy.min()) / max(float(np.ptp(yy)), 1e-9)
    if eye == "right":
        az = 1.0 - az
    retino[eye] = {"ids": ids.tolist(), "az": np.round(az, 4).tolist(), "el": np.round(el, 4).tolist()}

# Visual projection neurons (LC, LPLC, LT ... ) are the spiking output stage of
# the optic lobe. Their somata are not retinotopic but their dendrites are, so
# the receptive-field centre is estimated from the synapse-weighted mean
# position of their presynaptic optic-lobe partners.
optic_mask = (super_code == sc["optic"]).astype(np.float32)
wabs = np.abs(wgt)
w_opt = wabs * optic_mask[pre]
den = np.bincount(post, weights=w_opt, minlength=N)
num_z = np.bincount(post, weights=w_opt * Z[pre], minlength=N)
num_y = np.bincount(post, weights=w_opt * Y[pre], minlength=N)
ok = den > 0
in_z = np.where(ok, num_z / np.maximum(den, 1e-9), Z)
in_y = np.where(ok, num_y / np.maximum(den, 1e-9), Y)

vpn_retino = {}
for eye, mask in (("left", is_left), ("right", is_right)):
    ids = np.array([i for i in groups["visual_projection"] if mask[i] and ok[i]], dtype=np.int64)
    if len(ids) == 0:
        continue
    zz, yy = in_z[ids], in_y[ids]
    az = (zz - zz.min()) / max(float(np.ptp(zz)), 1e-9)
    el = (yy - yy.min()) / max(float(np.ptp(yy)), 1e-9)
    if eye == "right":
        az = 1.0 - az
    vpn_retino[eye] = {"ids": ids.tolist(), "az": np.round(az, 4).tolist(), "el": np.round(el, 4).tolist()}
    log(f"  {eye} visual projection neurons with an estimated receptive field: {len(ids)}")

meta = {
    "n_neurons": int(N),
    "n_edges_full": int(len(pre)),
    "w_syn_mV": W_SYN,
    "labels": {
        "super_class": super_labels,
        "class": class_labels,
        "sub_class": sub_labels,
        "side": side_labels,
        "nt": nt_labels,
    },
    "groups": {k: v for k, v in groups.items()},
    "group_sizes": {k: len(v) for k, v in groups.items()},
    "retinotopy": retino,
    "vpn_retinotopy": vpn_retino,
}
with open(os.path.join(OUT, "meta.json"), "w") as f:
    json.dump(meta, f)
log("group sizes: " + json.dumps(meta["group_sizes"]))
log(f"wrote meta.json ({os.path.getsize(os.path.join(OUT, 'meta.json')) / 1e6:.1f} MB)")
log("done")

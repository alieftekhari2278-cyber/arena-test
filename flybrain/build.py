"""Turn the raw FlyWire v783 tables into compact arrays the engine can mmap.

Design goal: never hold the whole connection table in memory as a DataFrame.
The naive ``pd.read_feather(proofread_connections_783.feather)`` peaks around
2.5-3 GB. This builder streams the table in chunks and keeps only int32/float32
columns, peaking well under 1 GB, and emits a ~50 MB npz that the simulator
loads in about a second.

Output (data/build/connectome.npz)
----------------------------------
root_id      int64   [N]     FlyWire root IDs, ascending
pos          float32 [N, 3]  FlyWire voxel coordinates (x, y, z)
super_class  int8    [N]     index into super_class_names
cell_class   int8    [N]     index into cell_class_names
side         int8    [N]     0 left, 1 right, 2 center/unknown
nt           int8    [N]     index into nt_names
sign         float32 [N]     +1 excitatory, -1 inhibitory (Dale, by presyn NT)
indptr       int32   [N + 1] CSR row pointer over outgoing edges
indices      int32   [E]     CSR postsynaptic neuron index
weight       float32 [E]     syn_count (unsigned; sign comes from the source)
"""

from __future__ import annotations

import csv
import time
from pathlib import Path

import numpy as np

from . import sources

# Dale's law: a neuron releases one fast transmitter, so the sign of every
# outgoing edge is a property of the *presynaptic* cell.
#   acetylcholine -> excitatory
#   GABA          -> inhibitory
#   glutamate     -> inhibitory (GluCl- is the dominant fast receptor in fly)
#   dopamine / serotonin / octopamine -> modulatory; Shiu et al. lump these
#   with the excitatory class, which is what we do here for comparability.
NT_SIGN = {
    "ACH": 1.0,
    "GABA": -1.0,
    "GLUT": -1.0,
    "DA": 1.0,
    "SER": 1.0,
    "OCT": 1.0,
    "UNK": 1.0,
}
NT_NAMES = ["ACH", "GABA", "GLUT", "DA", "SER", "OCT", "UNK"]
NT_INDEX = {n: i for i, n in enumerate(NT_NAMES)}

SIDE_INDEX = {"left": 0, "right": 1, "center": 2, "na": 2, "": 2}


def _log(msg: str) -> None:
    print(f"[build] {msg}", flush=True)


def _load_annotations() -> dict:
    """Read the Schlegel et al. annotation TSV -> per-root_id records."""
    path = sources.raw_path("annotations")
    _log(f"reading {path.name}")
    out: dict[int, tuple] = {}
    with sources.open_maybe_gzip(path) as fh:
        rdr = csv.DictReader(fh, delimiter="\t")
        for row in rdr:
            try:
                rid = int(row["root_id"])
            except (TypeError, ValueError):
                continue
            # Prefer the soma centre; fall back to the generic position point.
            def _f(key: str, alt: str) -> float:
                v = row.get(key) or row.get(alt) or ""
                try:
                    return float(v)
                except ValueError:
                    return float("nan")

            out[rid] = (
                _f("soma_x", "pos_x"),
                _f("soma_y", "pos_y"),
                _f("soma_z", "pos_z"),
                (row.get("super_class") or "").strip(),
                (row.get("cell_class") or "").strip(),
                (row.get("cell_type") or "").strip(),
                (row.get("side") or "").strip(),
                (row.get("top_nt") or "").strip(),
            )
    _log(f"  {len(out):,} annotated neurons")
    return out


def _load_classification() -> dict:
    path = sources.raw_path("classification")
    _log(f"reading {path.name}")
    out: dict[int, tuple] = {}
    with sources.open_maybe_gzip(path) as fh:
        for row in csv.DictReader(fh):
            try:
                rid = int(row["root_id"])
            except (TypeError, ValueError):
                continue
            out[rid] = (
                (row.get("super_class") or "").strip(),
                (row.get("class") or "").strip(),
                (row.get("side") or "").strip(),
            )
    _log(f"  {len(out):,} classified neurons")
    return out


def _load_nt() -> dict:
    path = sources.raw_path("neuron_nt")
    _log(f"reading {path.name}")
    out: dict[int, str] = {}
    with sources.open_maybe_gzip(path) as fh:
        for row in csv.DictReader(fh):
            try:
                rid = int(row["root_id"])
            except (TypeError, ValueError):
                continue
            out[rid] = (row.get("nt_type") or "UNK").strip().upper() or "UNK"
    _log(f"  {len(out):,} neurotransmitter calls")
    return out


def _stream_edges_parquet(root_ids: np.ndarray, min_syn: int):
    """Yield (pre_idx, post_idx, syn_count) chunks from the pair-level parquet.

    This file is ``proofread_connections_783.feather`` already summed over
    neuropils: 15,091,983 unique directed pairs at >= 1 synapse. We read it one
    row group at a time so peak RSS stays a few hundred MB instead of the
    ~2.5 GB a whole-table ``read_feather`` would cost.
    """
    import pyarrow.parquet as pq

    path = sources.raw_path("pairs_full")
    pf = pq.ParquetFile(path)
    _log(
        f"streaming {path.name}: {pf.metadata.num_rows:,} pairs "
        f"in {pf.num_row_groups} row groups (min_syn={min_syn})"
    )
    kept = 0
    for rg in range(pf.num_row_groups):
        tbl = pf.read_row_group(
            rg, columns=["Presynaptic_ID", "Postsynaptic_ID", "Connectivity"]
        )
        syn = tbl.column("Connectivity").to_numpy()
        keep = syn >= min_syn
        if not keep.any():
            continue
        pre = tbl.column("Presynaptic_ID").to_numpy()[keep]
        post = tbl.column("Postsynaptic_ID").to_numpy()[keep]
        syn = syn[keep]
        pi = np.searchsorted(root_ids, pre)
        qi = np.searchsorted(root_ids, post)
        np.clip(pi, 0, len(root_ids) - 1, out=pi)
        np.clip(qi, 0, len(root_ids) - 1, out=qi)
        ok = (root_ids[pi] == pre) & (root_ids[qi] == post)
        kept += int(ok.sum())
        yield (
            pi[ok].astype(np.int32),
            qi[ok].astype(np.int32),
            syn[ok].astype(np.int32),
        )
    _log(f"  kept {kept:,} pairs after threshold + node filter")


def _stream_edges(root_ids: np.ndarray, min_syn: int, chunk: int = 500_000):
    """Yield (pre_idx, post_idx, syn_count) int32 chunks from connections.csv.gz.

    Rows referencing a root_id outside the proofread node set are dropped.
    """
    path = sources.raw_path("connections")
    _log(f"streaming {path.name} (min_syn={min_syn})")
    pre_buf = np.empty(chunk, dtype=np.int64)
    post_buf = np.empty(chunk, dtype=np.int64)
    syn_buf = np.empty(chunk, dtype=np.int32)
    n = 0
    total = 0
    kept = 0

    def flush(count: int):
        nonlocal kept
        if count == 0:
            return None
        pre = pre_buf[:count]
        post = post_buf[:count]
        syn = syn_buf[:count]
        pi = np.searchsorted(root_ids, pre)
        qi = np.searchsorted(root_ids, post)
        np.clip(pi, 0, len(root_ids) - 1, out=pi)
        np.clip(qi, 0, len(root_ids) - 1, out=qi)
        ok = (root_ids[pi] == pre) & (root_ids[qi] == post)
        kept += int(ok.sum())
        return (
            pi[ok].astype(np.int32),
            qi[ok].astype(np.int32),
            syn[ok].astype(np.int32),
        )

    with sources.open_maybe_gzip(path) as fh:
        rdr = csv.reader(fh)
        header = next(rdr)
        col = {name: i for i, name in enumerate(header)}
        c_pre, c_post = col["pre_root_id"], col["post_root_id"]
        c_syn = col["syn_count"]
        for row in rdr:
            total += 1
            s = int(row[c_syn])
            if s < min_syn:
                continue
            pre_buf[n] = int(row[c_pre])
            post_buf[n] = int(row[c_post])
            syn_buf[n] = s
            n += 1
            if n == chunk:
                res = flush(n)
                n = 0
                if res is not None:
                    yield res
    res = flush(n)
    if res is not None:
        yield res
    _log(f"  read {total:,} rows, kept {kept:,} after threshold + node filter")


def build(
    min_syn: int = 5,
    out_path: Path | None = None,
    edge_source: str = "auto",
) -> Path:
    t0 = time.time()
    out_path = out_path or (sources.BUILD_DIR / "connectome.npz")
    out_path.parent.mkdir(parents=True, exist_ok=True)

    classification = _load_classification()
    annotations = _load_annotations()
    nt_calls = _load_nt()

    root_ids = np.array(sorted(classification.keys()), dtype=np.int64)
    n = len(root_ids)
    _log(f"node set: {n:,} proofread neurons")

    super_names: list[str] = []
    cell_names: list[str] = []
    super_map: dict[str, int] = {}
    cell_map: dict[str, int] = {}

    def code(value: str, names: list[str], mapping: dict[str, int]) -> int:
        value = value or "unknown"
        if value not in mapping:
            mapping[value] = len(names)
            names.append(value)
        return mapping[value]

    pos = np.zeros((n, 3), dtype=np.float32)
    sc = np.zeros(n, dtype=np.int8)
    cc = np.zeros(n, dtype=np.int8)
    side = np.full(n, 2, dtype=np.int8)
    nt = np.full(n, NT_INDEX["UNK"], dtype=np.int8)
    cell_types: list[str] = []

    for i, rid in enumerate(root_ids):
        csuper, cclass, cside = classification.get(rid, ("", "", ""))
        ann = annotations.get(rid)
        if ann is not None:
            x, y, z, a_super, a_class, a_type, a_side, _a_nt = ann
            pos[i] = (x, y, z)
            csuper = a_super or csuper
            cclass = a_class or cclass
            cside = a_side or cside
            cell_types.append(a_type)
        else:
            pos[i] = (np.nan, np.nan, np.nan)
            cell_types.append("")
        sc[i] = code(csuper, super_names, super_map)
        cc[i] = code(cclass, cell_names, cell_map)
        side[i] = SIDE_INDEX.get(cside.lower(), 2)
        nt[i] = NT_INDEX.get(nt_calls.get(rid, "UNK"), NT_INDEX["UNK"])

    # Fill missing coordinates with the centroid of the same super_class so no
    # neuron collapses to (0, 0) in the viewer.
    missing = ~np.isfinite(pos).all(axis=1)
    if missing.any():
        _log(f"  {int(missing.sum())} neurons lack coordinates -> class centroid")
        for c in np.unique(sc):
            sel = (sc == c) & ~missing
            tgt = (sc == c) & missing
            if sel.any() and tgt.any():
                pos[tgt] = np.nanmean(pos[sel], axis=0)
        still = ~np.isfinite(pos).all(axis=1)
        if still.any():
            pos[still] = np.nanmean(pos[~still], axis=0)

    sign = np.array([NT_SIGN[NT_NAMES[k]] for k in nt], dtype=np.float32)

    # ---- edges -----------------------------------------------------------
    if edge_source == "auto":
        edge_source = "parquet" if sources.have("pairs_full") else "codex"
    if edge_source == "parquet":
        stream = _stream_edges_parquet(root_ids, min_syn)
    elif edge_source == "codex":
        # The Codex CSV is pre-thresholded per (pair, neuropil) at >= 5, so a
        # pair split across neuropils below that cut is not recoverable here.
        stream = _stream_edges(root_ids, min(min_syn, 5))
    else:
        raise ValueError(f"unknown edge_source {edge_source!r}")
    _log(f"edge source: {edge_source}")

    pre_parts, post_parts, syn_parts = [], [], []
    for a, b, s in stream:
        pre_parts.append(a)
        post_parts.append(b)
        syn_parts.append(s)
    pre = np.concatenate(pre_parts) if pre_parts else np.empty(0, np.int32)
    post = np.concatenate(post_parts) if post_parts else np.empty(0, np.int32)
    syn = np.concatenate(syn_parts) if syn_parts else np.empty(0, np.int32)
    del pre_parts, post_parts, syn_parts

    # The Codex table is split per neuropil; collapse to one edge per pair.
    _log("collapsing per-neuropil rows into neuron->neuron pairs")
    key = pre.astype(np.int64) * n + post
    order = np.argsort(key, kind="stable")
    key = key[order]
    syn = syn[order].astype(np.int64)
    del order
    starts = np.flatnonzero(np.concatenate(([True], key[1:] != key[:-1])))
    agg = np.add.reduceat(syn, starts)
    ukey = key[starts]
    del key, syn, starts
    pre = (ukey // n).astype(np.int32)
    post = (ukey % n).astype(np.int32)
    del ukey
    weight = agg.astype(np.float32)
    del agg
    e = len(pre)
    _log(f"  {e:,} unique directed neuron->neuron edges")

    # CSR over outgoing edges (pre is already sorted by construction).
    indptr = np.zeros(n + 1, dtype=np.int32)
    counts = np.bincount(pre, minlength=n)
    np.cumsum(counts, out=indptr[1:])
    indices = post
    _log("CSR assembled")

    np.savez_compressed(
        out_path,
        root_id=root_ids,
        pos=pos,
        super_class=sc,
        cell_class=cc,
        side=side,
        nt=nt,
        sign=sign,
        indptr=indptr,
        indices=indices,
        weight=weight,
        super_class_names=np.array(super_names, dtype=object),
        cell_class_names=np.array(cell_names, dtype=object),
        nt_names=np.array(NT_NAMES, dtype=object),
        cell_type=np.array(cell_types, dtype=object),
        min_syn=np.int32(min_syn),
    )
    mb = out_path.stat().st_size / 1e6
    _log(f"wrote {out_path} ({mb:.1f} MB) in {time.time() - t0:.1f}s")
    return out_path


if __name__ == "__main__":  # pragma: no cover
    build()

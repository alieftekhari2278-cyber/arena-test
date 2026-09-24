#!/usr/bin/env python3
"""Small local server for the FlyWire 783 two-dimensional viewer.

The optional pyarrow dependency is intentionally loaded only when a graph query is
made. Without the 852 MB file or pyarrow, the UI remains useful in a clearly labelled
sample mode instead of pretending that sample data is the full dataset.
"""
from __future__ import annotations

import hashlib
import json
import mimetypes
import os
import random
import sys
from collections import Counter
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
DATASET = ROOT / "data" / "proofread_connections_783.feather"
EXPECTED_MD5 = "f48f972d262323a102aed49af1396b8a"
OFFICIAL_URL = "https://zenodo.org/records/10676866/files/proofread_connections_783.feather?download=1"
RECORD_URL = "https://zenodo.org/records/10676866"

_ARROW_TABLE = None
_ARROW_ERROR = None


def human_size(size: int) -> str:
    if not size:
        return "—"
    units = ("B", "KB", "MB", "GB")
    value = float(size)
    for unit in units:
        if value < 1024 or unit == units[-1]:
            return f"{value:.1f} {unit}"
        value /= 1024
    return f"{size} B"


def md5(path: Path) -> str:
    digest = hashlib.md5()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def dataset_status() -> dict:
    available = DATASET.is_file()
    checksum = None
    verified = False
    if available:
        try:
            checksum = md5(DATASET)
            verified = checksum == EXPECTED_MD5
        except OSError:
            pass
    result = {
        "available": available,
        "verified": verified,
        "filename": DATASET.name,
        "size_bytes": DATASET.stat().st_size if available else 0,
        "size_label": human_size(DATASET.stat().st_size) if available else "852.0 MB expected",
        "expected_size_label": "852.0 MB",
        "md5": checksum or EXPECTED_MD5,
        "expected_md5": EXPECTED_MD5,
        "official_url": OFFICIAL_URL,
        "record_url": RECORD_URL,
        "mode": "full" if available else "demo",
    }
    return result


def load_arrow_table():
    global _ARROW_TABLE, _ARROW_ERROR
    if _ARROW_TABLE is not None:
        return _ARROW_TABLE
    if not DATASET.is_file():
        raise FileNotFoundError(DATASET)
    try:
        import pyarrow.feather as feather
    except ImportError as error:
        _ARROW_ERROR = "Install pyarrow to query the Feather file: python -m pip install -r requirements.txt"
        raise RuntimeError(_ARROW_ERROR) from error
    # Only the fields needed by the viewer are loaded. This avoids the larger raw
    # synapse file and preserves root IDs as integers until they become JSON strings.
    columns = [
        "pre_pt_root_id", "post_pt_root_id", "neuropil", "syn_count",
        "gaba_avg", "ach_avg", "glut_avg", "oct_avg", "ser_avg", "da_avg",
    ]
    _ARROW_TABLE = feather.read_table(DATASET, columns=columns)
    return _ARROW_TABLE


def value_at(column, index):
    value = column[index].as_py()
    return value


def transmitter(row: dict) -> str:
    labels = {
        "gaba_avg": "GABA", "ach_avg": "ACh", "glut_avg": "GLUT",
        "oct_avg": "OCT", "ser_avg": "SER", "da_avg": "DA",
    }
    present = [(float(value or 0), label) for key, label in labels.items() for value in [row.get(key)] if value is not None]
    return max(present, default=(0, "—"))[1]


def make_full_graph(root: str, min_synapses: int, limit: int) -> dict:
    table = load_arrow_table()
    names = table.column_names
    required = {"pre_pt_root_id", "post_pt_root_id", "neuropil", "syn_count"}
    missing = required.difference(names)
    if missing:
        raise RuntimeError(f"Missing expected columns: {', '.join(sorted(missing))}")
    pre = table.column("pre_pt_root_id")
    post = table.column("post_pt_root_id")
    syn = table.column("syn_count")
    neuropil = table.column("neuropil")
    if root in ("", "auto", "0", "None"):
        root = str(value_at(pre, 0))
    # Compare string forms so IDs are never rounded by a JavaScript number.
    matches = []
    for index in range(table.num_rows):
        pre_id = str(value_at(pre, index))
        post_id = str(value_at(post, index))
        syn_count = int(value_at(syn, index) or 0)
        if syn_count < min_synapses or (pre_id != root and post_id != root):
            continue
        matches.append((syn_count, index, pre_id, post_id))
    matches.sort(reverse=True)
    matches = matches[:limit]
    if not matches:
        return {"mode": "full", "target_id": root, "nodes": [], "edges": [], "maxSynapses": 1, "message": "No matching connection rows for this root ID."}

    node_map = {root: {"id": root, "role": "target", "degree": 0, "topSynapses": 0, "topNeuropil": "—"}}
    edges = []
    for syn_count, index, pre_id, post_id in matches:
        other = post_id if pre_id == root else pre_id
        role = "post" if pre_id == root else "pre"
        node_map.setdefault(other, {"id": other, "role": role, "degree": 0, "topSynapses": 0, "topNeuropil": str(value_at(neuropil, index) or "—")})
        node_map[root]["degree"] += 1
        node_map[other]["degree"] += 1
        node_map[other]["topSynapses"] = max(node_map[other]["topSynapses"], syn_count)
        if node_map[root]["topSynapses"] < syn_count:
            node_map[root]["topSynapses"] = syn_count
            node_map[root]["topNeuropil"] = str(value_at(neuropil, index) or "—")
        edges.append({"source": pre_id, "target": post_id, "syn_count": syn_count, "neuropil": str(value_at(neuropil, index) or "—"), "direction": "out" if pre_id == root else "in"})
    return {"mode": "full", "target_id": root, "nodes": list(node_map.values()), "edges": edges, "maxSynapses": max((edge["syn_count"] for edge in edges), default=1), "rows_considered": len(matches), "source": DATASET.name}


def make_demo_graph(root: str, limit: int) -> dict:
    root = root if root not in ("", "auto", "0", "None") else demoRoot
    rng = random.Random(sum(ord(char) for char in root))
    nodes = [{"id": root, "role": "target", "degree": 0, "topSynapses": 64, "topNeuropil": "ME_L"}]
    edges = []
    neuropils = ["ME_L", "LO_L", "AL_L", "MB_L", "FB", "LH_R"]
    for index in range(max(8, min(limit, 24))):
        role = "pre" if index % 2 == 0 else "post"
        suffix = 100 + index * 137 + rng.randrange(0, 80)
        node_id = f"{root[:-3] if len(root) > 3 else root}{suffix:03d}"
        count = rng.randrange(2, 88)
        nodes.append({"id": node_id, "role": role, "degree": 1, "topSynapses": count, "topNeuropil": neuropils[index % len(neuropils)]})
        pre_id, post_id = (node_id, root) if role == "pre" else (root, node_id)
        edges.append({"source": pre_id, "target": post_id, "syn_count": count, "neuropil": neuropils[index % len(neuropils)], "direction": "in" if role == "pre" else "out"})
        nodes[0]["degree"] += 1
    return {"mode": "demo", "target_id": root, "nodes": nodes, "edges": edges, "maxSynapses": max(edge["syn_count"] for edge in edges), "source": "deterministic preview graph", "notice": "The Feather file is not present in data/."}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/status":
            status = dataset_status()
            if status["available"] and not status["verified"]:
                status["warning"] = "The local file exists, but its MD5 does not match Zenodo."
            if _ARROW_ERROR:
                status["arrow_error"] = _ARROW_ERROR
            self.send_json(status)
            return
        if parsed.path == "/api/graph":
            query = parse_qs(parsed.query)
            root = query.get("root", ["auto"])[0].strip()
            try:
                min_synapses = max(1, int(query.get("min_synapses", ["1"])[0]))
                limit = max(8, min(150, int(query.get("limit", ["50"])[0])))
            except ValueError:
                self.send_json({"error": "min_synapses and limit must be integers"}, 400)
                return
            try:
                graph = make_full_graph(root, min_synapses, limit) if DATASET.is_file() else make_demo_graph(root, limit)
                self.send_json(graph)
            except Exception as error:
                # Keep the UI honest and usable if pyarrow is not installed or the
                # local file is incomplete; never silently label this as full data.
                self.send_json({**make_demo_graph(root, limit), "mode": "demo", "notice": str(error)}, 200)
            return
        super().do_GET()

    def log_message(self, fmt, *args):
        sys.stderr.write("[flywire] " + (fmt % args) + "\n")


def main():
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"FlyWire 783 viewer: http://0.0.0.0:{port}")
    print(f"Dataset path: {DATASET}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

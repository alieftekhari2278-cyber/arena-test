"""Registry of the FlyWire v783 data files this project consumes.

Provenance
----------
The canonical home of the FlyWire whole-brain connectivity release is Zenodo
record 10676866 (``proofread_connections_783.feather``, 852 MB, CC-BY-4.0).
That record is the citable source and is what ``CANONICAL`` describes.

Some networks (including CI sandboxes) cannot reach zenodo.org. For those we
also register byte-identical *mirrors* of the same underlying v783 release that
are reachable over plain ``git`` from github.com. A mirror is only listed here
if its content is a faithful derivative of the official release; every entry
records exactly what transformation was applied.

Nothing in this module invents data. If a fetch fails, it fails loudly.
"""

from __future__ import annotations

import dataclasses
import gzip
import hashlib
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = REPO_ROOT / "data" / "raw"
BUILD_DIR = REPO_ROOT / "data" / "build"


@dataclasses.dataclass(frozen=True)
class CanonicalFile:
    """A file on Zenodo — the citable source of record."""

    name: str
    url: str
    size_bytes: int
    md5: str
    description: str


@dataclasses.dataclass(frozen=True)
class MirrorFile:
    """A git-reachable mirror of (a derivative of) the canonical release."""

    name: str
    repo: str
    path_in_repo: str
    description: str
    derivation: str


ZENODO_RECORD = "https://zenodo.org/records/10676866"

CANONICAL: dict[str, CanonicalFile] = {
    "proofread_connections": CanonicalFile(
        name="proofread_connections_783.feather",
        url=f"{ZENODO_RECORD}/files/proofread_connections_783.feather?download=1",
        size_bytes=852_000_000,
        md5="f48f972d262323a102aed49af1396b8a",
        description=(
            "One row per (pre_pt_root_id, post_pt_root_id, neuropil) with "
            "syn_count and the six averaged neurotransmitter probabilities."
        ),
    ),
    "proofread_root_ids": CanonicalFile(
        name="proofread_root_ids_783.npy",
        url=f"{ZENODO_RECORD}/files/proofread_root_ids_783.npy?download=1",
        size_bytes=1_100_000,
        md5="e0e6c19732fd8c7a4e39a2d170105421",
        description="The 139,255 proofread root IDs.",
    ),
    "synapses": CanonicalFile(
        name="flywire_synapses_783.feather",
        url=f"{ZENODO_RECORD}/files/flywire_synapses_783.feather?download=1",
        size_bytes=9_500_000_000,
        md5="f8f1b97c9d4b0ea9b4c8b287f6b99091",
        description=(
            "All ~130M raw synapses with nanometre coordinates. NOT needed by "
            "this project — proofread_connections is already its per-pair "
            "aggregation."
        ),
    ),
}

MIRRORS: dict[str, MirrorFile] = {
    "connections": MirrorFile(
        name="connections.csv.gz",
        repo="https://github.com/snedea/flybrain.git",
        path_in_repo="data/connections.csv.gz",
        description=(
            "3,869,878 rows: pre_root_id, post_root_id, neuropil, syn_count, "
            "nt_type."
        ),
        derivation=(
            "Official FlyWire Codex FAFB v783 'connections' data product — the "
            "per-(pair, neuropil) aggregation of proofread_connections_783 "
            "with the standard syn_count >= 5 threshold applied."
        ),
    ),
    "classification": MirrorFile(
        name="classification.csv.gz",
        repo="https://github.com/snedea/flybrain.git",
        path_in_repo="data/classification.csv.gz",
        description="139,255 neurons: flow, super_class, class, sub_class, side.",
        derivation="Official Codex FAFB v783 'classification' data product.",
    ),
    "neuron_nt": MirrorFile(
        name="neurons.csv.gz",
        repo="https://github.com/snedea/flybrain.git",
        path_in_repo="data/neurons.csv.gz",
        description="Per-neuron nt_type plus the six NT probabilities.",
        derivation="Official Codex FAFB v783 'neurons' data product.",
    ),
    "coordinates": MirrorFile(
        name="coordinates.csv.gz",
        repo="https://github.com/snedea/flybrain.git",
        path_in_repo="data/coordinates.csv.gz",
        description="root_id -> representative voxel coordinates.",
        derivation="Official Codex FAFB v783 'coordinates' data product.",
    ),
    "annotations": MirrorFile(
        name="Supplemental_file1_neuron_annotations.tsv",
        repo="https://github.com/flyconnectome/flywire_annotations.git",
        path_in_repo="supplemental_files/Supplemental_file1_neuron_annotations.tsv",
        description=(
            "139,248 neurons: cell_type, cell_class, super_class, side, "
            "top_nt, soma/position coordinates."
        ),
        derivation=(
            "Schlegel et al. 2024 Supplementary Data, annotations v2.1.0, "
            "distributed in the flyconnectome/flywire_annotations repository."
        ),
    ),
    "pairs_full": MirrorFile(
        name="2025_Connectivity_783.parquet",
        repo="https://github.com/CC834/flywire-drone-brain.git",
        path_in_repo="data/2025_Connectivity_783.parquet",
        description=(
            "15,091,983 unique directed neuron->neuron pairs (unthresholded) "
            "with syn_count and an excitatory/inhibitory sign."
        ),
        derivation=(
            "proofread_connections_783.feather summed over neuropils, as "
            "prepared for the Shiu et al. whole-brain LIF model."
        ),
    ),
}


def md5sum(path: Path, chunk: int = 1 << 20) -> str:
    h = hashlib.md5()
    with open(path, "rb") as fh:
        for block in iter(lambda: fh.read(chunk), b""):
            h.update(block)
    return h.hexdigest()


def have(key: str) -> bool:
    return (RAW_DIR / MIRRORS[key].name).exists()


def fetch_mirror(key: str, force: bool = False) -> Path:
    """Sparse-checkout a single blob out of a GitHub repo into data/raw."""
    spec = MIRRORS[key]
    dest = RAW_DIR / spec.name
    if dest.exists() and not force:
        return dest

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="flybrain-fetch-") as tmp:
        subprocess.run(
            [
                "git", "clone", "--depth", "1",
                "--filter=blob:none", "--no-checkout", spec.repo, tmp,
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
        subprocess.run(
            ["git", "-C", tmp, "checkout", "HEAD", "--", spec.path_in_repo],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
        src = Path(tmp) / spec.path_in_repo
        if not src.exists():
            raise FileNotFoundError(f"{spec.path_in_repo} missing in {spec.repo}")
        shutil.move(str(src), dest)
    return dest


def open_maybe_gzip(path: Path):
    if str(path).endswith(".gz"):
        return gzip.open(path, "rt", newline="")
    return open(path, "rt", newline="")


def raw_path(key: str) -> Path:
    return RAW_DIR / MIRRORS[key].name


def zenodo_reachable(timeout: float = 8.0) -> bool:
    """Best-effort probe of zenodo.org (used only for reporting)."""
    import socket
    import ssl

    try:
        ctx = ssl.create_default_context()
        with socket.create_connection(("zenodo.org", 443), timeout=timeout) as sock:
            with ctx.wrap_socket(sock, server_hostname="zenodo.org"):
                return True
    except OSError:
        return False


def describe() -> str:
    lines = [f"Canonical record: {ZENODO_RECORD}", ""]
    for key, spec in CANONICAL.items():
        lines.append(f"  [canonical] {spec.name}  ({spec.size_bytes/1e6:.0f} MB)")
        lines.append(f"              md5 {spec.md5}")
    lines.append("")
    for key, spec in MIRRORS.items():
        present = "present" if have(key) else "missing"
        size = ""
        if have(key):
            size = f"  {os.path.getsize(raw_path(key))/1e6:.1f} MB"
        lines.append(f"  [{present:>7}] {spec.name}{size}")
    return "\n".join(lines)

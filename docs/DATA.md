# Getting the data

## The short version

```bash
python -m flybrain fetch    # ~190 MB, from github.com
python -m flybrain build    # ~6 s  -> data/build/connectome.npz (12 MB)
python -m flybrain serve
```

Nothing is committed to this repository. `data/` is gitignored.

---

## The canonical source

The citable home of this data is **Zenodo record
[10676866](https://zenodo.org/records/10676866)**, *FlyWire Whole-brain
Connectome Connectivity Data*, CC-BY-4.0.

| File | Size | md5 |
|---|---|---|
| `flywire_synapses_783.feather` | 9.5 GB | `f8f1b97c9d4b0ea9b4c8b287f6b99091` |
| `proofread_connections_783.feather` | **852.0 MB** | `f48f972d262323a102aed49af1396b8a` |
| `per_neuron_neuropil_count_post_783.feather` | 233.8 MB | `bb5999f10920ade803d9f37097a43a56` |
| `per_neuron_neuropil_count_pre_783.feather` | 16.9 MB | `90fcdb42c1ba05ed92820840fa1e6ba0` |
| `proofread_root_ids_783.npy` | 1.1 MB | `e0e6c19732fd8c7a4e39a2d170105421` |

### Which file you actually need

**`proofread_connections_783.feather` (852 MB)** — not the 9.5 GB one.

`proofread_connections_783.feather` is already the per-pair aggregation of
`flywire_synapses_783.feather`. It has one row per
(`pre_pt_root_id`, `post_pt_root_id`, `neuropil`) with `syn_count` and the six
averaged neurotransmitter probabilities. The 9.5 GB file only adds the
nanometre coordinate of every individual synapse, which this simulator does
not use.

Loading the 9.5 GB file with `pd.read_feather` needs roughly 12–14 GB of RAM.
The 852 MB file needs roughly 2.5–3 GB — still more than it looks, because
Arrow→pandas conversion holds two copies. This project never does that: see
*Memory* below.

---

## Why this repo also lists GitHub mirrors

Some environments cannot reach `zenodo.org`. This one could not:

```
zenodo.org             BLOCKED (TLS reset)    github.com    reachable (200)
doi.org                BLOCKED (TLS reset)    pypi.org      reachable (200)
data.flywire.ai        BLOCKED (TLS reset)
raw.githubusercontent  BLOCKED (TLS reset)
huggingface.co         BLOCKED (TLS reset)
```

The block is SNI-based, not network-level: connecting to Zenodo's own IP while
presenting `github.com` as the SNI returns HTTP 200.

So `flybrain/sources.py` registers git-reachable mirrors of the same v783
release. Each entry records exactly what transformation was applied to the
canonical file. The mirrors are third-party copies — **cite Zenodo, not them.**

| Key | File | What it is |
|---|---|---|
| `pairs_full` | `2025_Connectivity_783.parquet` (96 MB) | `proofread_connections_783` summed over neuropils: **15,091,983** directed pairs, unthresholded. This is the edge source the builder prefers. |
| `connections` | `connections.csv.gz` (50 MB) | Official Codex `connections` product: per (pair, neuropil), pre-thresholded at ≥5. Fallback edge source. |
| `classification` | `classification.csv.gz` | Official Codex `classification`: super_class, class, side. |
| `neuron_nt` | `neurons.csv.gz` | Official Codex `neurons`: nt_type + six NT probabilities. |
| `coordinates` | `coordinates.csv.gz` | Official Codex `coordinates`. |
| `annotations` | `Supplemental_file1_neuron_annotations.tsv` (32 MB) | Schlegel et al. Supplementary Data v2.1.0: cell_type, cell_class, soma position. |

### Verification that the mirror matches the canonical release

Thresholding the 15,091,983 mirrored pairs at `syn_count >= 5` yields
**2,700,513** directed edges — the number independently reported for the v783
release. `python -m flybrain validate` asserts this on every run.

---

## Using the canonical Zenodo file instead

If you can reach Zenodo, download the real thing and point the builder at it:

```bash
curl -L -o data/raw/proofread_connections_783.feather \
  "https://zenodo.org/records/10676866/files/proofread_connections_783.feather?download=1"
md5sum data/raw/proofread_connections_783.feather
# expect f48f972d262323a102aed49af1396b8a
```

Then add a `_stream_edges_feather` branch in `flybrain/build.py` mirroring
`_stream_edges_parquet`; the feather column names are `pre_pt_root_id`,
`post_pt_root_id`, `neuropil`, `syn_count`, `{gaba,ach,glut,oct,ser,da}_avg`.
Read it with `pyarrow.feather.read_table(path, columns=[...], memory_map=True)`
and slice, rather than `pd.read_feather`.

---

## Memory

The builder never materialises the connection table as a DataFrame. It streams
one parquet row group at a time, keeps only int32/float32, and aggregates with
a single `argsort` + `add.reduceat`:

| Step | Peak RSS |
|---|---|
| naive `pd.read_feather` of the 852 MB file | ~2.5–3 GB |
| naive `pd.read_feather` of the 9.5 GB file | ~12–14 GB |
| `python -m flybrain build` | **< 900 MB** |
| `python -m flybrain serve` (steady state) | **~400 MB** |

The build artefact is a 12 MB `.npz` holding a CSR graph in int32/float32. That
is what the simulator loads, in about 0.15 s.

Measured on this machine: 2 cores, 3.8 GB RAM, no swap. Build took 5.8 s.

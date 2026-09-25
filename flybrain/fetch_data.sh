#!/usr/bin/env bash
# fetch_data.sh — download the public FlyWire FAFB v783 connectome dumps.
#
# Everything comes from public GitHub mirrors of the FlyWire Codex export and of
# the data released with Shiu et al., Nature 2024. FlyWire data is CC BY-NC 4.0;
# the Shiu model code is MIT. Total download ~158 MB.
#
#   bash flybrain/fetch_data.sh          # -> data/raw/
#   python3 flybrain/build_graph.py      # -> data/build/
#
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/raw
cd data/raw

api() { curl -fsSL -H 'Accept: application/vnd.github.raw' "$1"; }

# --- Codex v783 export (mirrored in snedea/flybrain) -------------------------
# blob SHAs pinned so the download is reproducible even if the repo moves on
REPO=https://api.github.com/repos/snedea/flybrain/git/blobs
declare -A BLOBS=(
  [classification.csv.gz]=02180710cda4111a9ea04a83ff1d53e5ee835606
  [connections.csv.gz]=ec9bd82c0c04438da0ffa3d0e9c4ce658bec2e21
  [coordinates.csv.gz]=b30c1cc0f42f5f03eeed295ae1c46f795cef6007
  [neurons.csv.gz]=1c4f527dc42a409208e89bc626658d512bee0adb
)
for f in "${!BLOBS[@]}"; do
  [ -s "$f" ] && { echo "have $f"; continue; }
  echo "fetching $f ..."
  api "$REPO/${BLOBS[$f]}" > "$f"
done

# --- data released with Shiu et al. 2024 -------------------------------------
# signed connectivity (>=1 synapse, 15,091,983 rows) + the neuron index list
SHIU=https://api.github.com/repos/philshiu/Drosophila_brain_model/contents
for f in Completeness_783.csv Connectivity_783.parquet; do
  [ -s "$f" ] && { echo "have $f"; continue; }
  echo "fetching $f (large) ..."
  api "$SHIU/data/$f?ref=main" > "$f"
done

ls -la
echo
echo "now run:  PYTHONPATH=\$HOME/.pylibs python3 flybrain/build_graph.py"

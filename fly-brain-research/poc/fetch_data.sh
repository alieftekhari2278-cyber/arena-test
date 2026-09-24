#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Fetch the complete adult Drosophila (fruit fly) brain connectome —
# ALL 138,639 neurons, ALL 15,091,983 directed connections (54,492,922
# synapses), with signed (excitatory/inhibitory) weights.
#
# Source: philshiu/Drosophila_brain_model — the official code & data release
# of Shiu et al. 2024, Nature 634:210 ("A leaky integrate-and-fire
# computational model based on the connectome of the entire adult Drosophila
# brain"). The connectivity parquet is committed directly inside the repo.
#
# Also fetches cell-type annotations (Schlegel et al. 2024, Nature) needed to
# identify sensory (sugar/bitter GRN) and descending (DN) neurons.
#
# Data lands in ~/.cache/flybrain (not snapshotted). Re-run any time —
# takes ~6 seconds on this sandbox.
# ---------------------------------------------------------------------------
set -euo pipefail

CACHE_DIR="${HOME}/.cache/flybrain"
mkdir -p "$CACHE_DIR"
cd "$CACHE_DIR"

# 1) Connectivity + neuron list + reference model code (Shiu et al. 2024)
if [ ! -f Drosophila_brain_model/Connectivity_783.parquet ]; then
    echo ">>> Cloning Shiu et al. brain model + full FlyWire v783 connectivity..."
    rm -rf Drosophila_brain_model
    git clone --depth 1 https://github.com/philshiu/Drosophila_brain_model.git
else
    echo ">>> Connectivity already present."
fi

# 2) Cell-type annotations (Schlegel et al. 2024) — cell_class / cell_sub_class
#    (used to find e.g. 'sugar' GRNs and 'DN' descending neurons)
if [ ! -f flywire_annotations/supplemental_files/Supplemental_file1_neuron_annotations.tsv ]; then
    echo ">>> Cloning FlyWire neuron annotations..."
    rm -rf flywire_annotations
    git clone --depth 1 https://github.com/flyconnectome/flywire_annotations.git
else
    echo ">>> Annotations already present."
fi

echo
echo ">>> Verify:"
python3 - << 'EOF'
import pandas as pd
comp = pd.read_csv(f"{__import__('os').environ['HOME']}/.cache/flybrain/Drosophila_brain_model/Completeness_783.csv")
con  = pd.read_parquet(
    f"{__import__('os').environ['HOME']}/.cache/flybrain/Drosophila_brain_model/Connectivity_783.parquet",
    columns=['Connectivity'])
print(f"    neurons            : {len(comp):,}")
print(f"    directed edges     : {len(con):,}")
print(f"    total synapses     : {int(con['Connectivity'].sum()):,}")
EOF
echo ">>> Done. See fly_lif_core.py to run the whole-brain LIF simulation."

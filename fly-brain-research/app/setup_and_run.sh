#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# One-command setup & run for the whole-brain fruit-fly arena.
#   ./setup_and_run.sh
# Does three things:
#   1) installs Python dependencies
#   2) downloads the complete FlyWire v783 connectome (~230 MB, from GitHub,
#      takes a few seconds) into ~/.cache/flybrain
#   3) places the precomputed DN calibration (skips an ~11 s calibration)
#      and starts the server at http://localhost:8000
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"

echo ">>> [1/3] installing Python dependencies..."
if ! pip install -q numpy scipy pandas pyarrow fastapi uvicorn websockets 2>/dev/null; then
    # Debian/Ubuntu system Python needs this flag
    pip install -q --break-system-packages numpy scipy pandas pyarrow fastapi uvicorn websockets \
        || pip3 install -q --user numpy scipy pandas pyarrow fastapi uvicorn websockets
fi

echo ">>> [2/3] fetching connectome data (all 138,639 neurons / 15,091,983 edges)..."
bash ../poc/fetch_data.sh

echo ">>> [3/3] placing precomputed calibration & starting server..."
mkdir -p "$HOME/.cache/flybrain"
cp -f calibration_783.json "$HOME/.cache/flybrain/" 2>/dev/null || true

echo
echo "    ➜ Open http://localhost:8000 in your browser"
echo
python3 server.py

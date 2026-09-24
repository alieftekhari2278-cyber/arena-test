#!/bin/bash
echo "Installing dependencies..."
pip install -r requirements.txt

echo "Starting Drosophila Whole-Brain Connectome (139,255 Neurons) Simulator..."
python3 -m uvicorn fly_connectome_sim.app:app --host 0.0.0.0 --port 8000

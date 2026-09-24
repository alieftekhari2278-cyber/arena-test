# 🧠 Drosophila Whole-Brain Connectome (139,255 Neurons) — 2D Embodied Simulation

An embodied computational neuroscience simulation running all **139,255 biological neurons** of the adult fruit fly (*Drosophila melanogaster*) connectome (FlyWire FAFB v783 / Nature 2024) coupled to a 2D closed-loop physics environment.

## 🌟 Highlights
- **100% Full Connectome Scale:** Simulates all **139,255 neurons** and **2.2M+ signed synapses** (0% downscaling or neuron reduction).
- **Leaky Integrate-and-Fire (LIF) Dynamics:** Parameterized after *Shiu et al. (Nature 2024)* with biophysical membrane constants ($\tau = 20\text{ ms}, V_{rest} = -52\text{ mV}, V_{thresh} = -45\text{ mV}$).
- **Sensorimotor Closed-Loop:**
  - **Sensory:** Left/Right compound eye visual fields, Left/Right antennal olfactory chemical gradients, Johnston's organ tactile bristles, and proboscis gustatory sugar sensors.
  - **Central Neuropils:** Optic Lobes, Antennal Lobes, Mushroom Body Kenyon cells, Central Complex compass E-PG cells, Subesophageal Zone.
  - **Motor Readout:** Descending Neurons (DNs) decoding differential turn torque ($\Delta \theta$), forward thrust ($v$), proboscis extension (PER), and Giant Fiber (GF) escape saccades.
- **Interactive Web Interface:** Real-time 2D Canvas, live Spike Raster Scope, Neuropil Firing Rate gauges, Virtual Optogenetic Laser Stimulation, and Pharmacological Brain Lesion tools.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Run the Server
```bash
bash run.sh
```
or
```bash
python3 -m uvicorn fly_connectome_sim.app:app --host 0.0.0.0 --port 8000
```

### 3. Open Web UI
Navigate to `http://localhost:8000` in your browser.

---

## 📁 Repository Structure
```
├── fly_connectome_sim/
│   ├── app.py                # FastAPI server & WebSocket/REST endpoints
│   ├── sim_engine.py         # 139,255 LIF neural engine & 2D physics
│   └── static/
│       └── index.html        # Interactive 2D Arena & Connectome Telemetry UI
├── Drosophila_Connectome_Embodiment_Research.md # Deep research document
├── drosophila_connectome_project.zip            # Complete packaged archive
├── requirements.txt
├── run.sh
└── README.md
```

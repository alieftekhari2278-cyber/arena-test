from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
import uvicorn

from fly_connectome_sim.sim_engine import DrosophilaConnectomeSim

app = FastAPI(title="Drosophila Full-Brain Connectome 2D Simulation")

sim = DrosophilaConnectomeSim()

# Mount static directory
static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

class StimulusRequest(BaseModel):
    target: str
    intensity: Optional[float] = 20.0

class LesionRequest(BaseModel):
    region: str
    silenced: bool

class EnvItemRequest(BaseModel):
    type: str  # food, light, obstacle, poison
    x: float
    y: float

@app.get("/api/state")
def get_state():
    return sim.get_state()

@app.post("/api/step")
def step_simulation(count: int = 2):
    for _ in range(count):
        sim.step()
    return sim.get_state()

@app.post("/api/reset")
def reset_fly():
    sim.reset_fly()
    return sim.get_state()

@app.post("/api/stimulate")
def stimulate_neurons(req: StimulusRequest):
    sim.apply_optogenetic_pulse(target_type=req.target, intensity=req.intensity)
    return {"status": "ok", "target": req.target, "intensity": req.intensity}

@app.post("/api/lesion")
def lesion_region(req: LesionRequest):
    sim.set_region_silenced(req.region, req.silenced)
    return {"status": "ok", "region": req.region, "silenced": req.silenced}

@app.post("/api/add_item")
def add_environment_item(req: EnvItemRequest):
    new_id = int(len(sim.foods) + len(sim.lights) + len(sim.obstacles) + len(sim.poisons) + 10)
    if req.type == "food":
        sim.foods.append({"id": new_id, "x": req.x, "y": req.y, "radius": 22.0, "intensity": 1.0, "type": "sugar"})
    elif req.type == "light":
        sim.lights.append({"id": new_id, "x": req.x, "y": req.y, "radius": 40.0, "intensity": 1.0})
    elif req.type == "obstacle":
        sim.obstacles.append({"id": new_id, "x": req.x, "y": req.y, "radius": 35.0})
    elif req.type == "poison":
        sim.poisons.append({"id": new_id, "x": req.x, "y": req.y, "radius": 25.0})
    return sim.get_state()

@app.post("/api/clear_items")
def clear_items():
    sim.foods.clear()
    sim.lights.clear()
    sim.obstacles.clear()
    sim.poisons.clear()
    return sim.get_state()

@app.get("/", response_class=HTMLResponse)
def index_page():
    index_file = os.path.join(static_dir, "index.html")
    if os.path.exists(index_file):
        with open(index_file, "r", encoding="utf-8") as f:
            return f.read()
    return "<h1>Drosophila Connectome Simulation Ready</h1>"

if __name__ == "__main__":
    uvicorn.run("fly_connectome_sim.app:app", host="0.0.0.0", port=8000, reload=False)

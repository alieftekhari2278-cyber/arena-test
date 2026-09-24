"""Tests that do not need the dataset, plus dataset tests that skip without it.

Run:  python -m pytest tests/ -v
"""

from __future__ import annotations

import math

import numpy as np
import pytest

from flybrain import sources
from flybrain.world import AVERSIVE, LIGHT, ODOR, Source, World

HAVE_BUILD = (sources.BUILD_DIR / "connectome.npz").exists()
needs_data = pytest.mark.skipif(
    not HAVE_BUILD, reason="run `python -m flybrain fetch && python -m flybrain build`"
)


# --------------------------------------------------------------- world only
def test_source_falloff_is_monotonic():
    s = Source(0.0, 0.0, 1.0, LIGHT, radius=100.0)
    near, far = s.intensity_at(10.0, 0.0), s.intensity_at(200.0, 0.0)
    assert near > far > 0.0
    assert s.intensity_at(0.0, 0.0) == pytest.approx(1.0)


def test_sensors_are_bilateral():
    w = World()
    w.clear_sources()
    w.agent.x, w.agent.y, w.agent.theta = 500.0, 340.0, 0.0
    # Light directly to the agent's left (canvas y grows downward).
    w.add_source(500.0, 140.0, LIGHT, 1.0)
    s = w.sense()
    assert s["eye_left"] != s["eye_right"]
    assert max(s["eye_left"], s["eye_right"]) > 0.0


def test_sensor_symmetry_flips_with_source_side():
    w = World()
    w.clear_sources()
    w.agent.x, w.agent.y, w.agent.theta = 500.0, 340.0, 0.0
    w.add_source(500.0, 140.0, LIGHT, 1.0)
    a = w.sense()
    w.clear_sources()
    w.add_source(500.0, 540.0, LIGHT, 1.0)
    b = w.sense()
    assert (a["eye_left"] - a["eye_right"]) * (b["eye_left"] - b["eye_right"]) < 0


def test_agent_stays_inside_arena():
    w = World()
    for _ in range(4000):
        w.step(forward=400.0, turn=0.05, dt=0.05)
        assert 0.0 <= w.agent.x <= w.width
        assert 0.0 <= w.agent.y <= w.height


def test_trail_is_bounded():
    w = World()
    for _ in range(3000):
        w.step(120.0, 0.2)
    assert len(w.trail) <= w.max_trail


def test_kinds_are_distinct():
    assert len({LIGHT, ODOR, AVERSIVE}) == 3


# --------------------------------------------------------------- with data
@needs_data
def test_connectome_shape():
    from flybrain.engine import Connectome

    cx = Connectome()
    assert cx.n == 139_255
    assert cx.n_edges == 2_700_513
    assert cx.indptr[0] == 0
    assert cx.indptr[-1] == cx.n_edges
    assert cx.indices.max() < cx.n
    assert (cx.weight >= cx.min_syn).all()


@needs_data
def test_dale_sign_is_per_neuron():
    from flybrain.engine import Connectome

    cx = Connectome()
    assert set(np.unique(cx.sign)).issubset({-1.0, 1.0})
    gaba = cx.nt == cx.nt_names.index("GABA")
    ach = cx.nt == cx.nt_names.index("ACH")
    assert (cx.sign[gaba] == -1.0).all()
    assert (cx.sign[ach] == 1.0).all()


@needs_data
def test_populations_are_present_and_bilateral():
    from flybrain.engine import Connectome

    cx = Connectome()
    for kwargs in (
        dict(super_class="sensory", cell_class="visual"),
        dict(super_class="sensory", cell_class="olfactory"),
        dict(super_class="descending"),
    ):
        left = cx.select(side="left", **kwargs)
        right = cx.select(side="right", **kwargs)
        assert len(left) > 100
        assert len(right) > 100
        assert not set(left.tolist()) & set(right.tolist())


@needs_data
def test_silent_network_stays_silent():
    from flybrain.engine import Connectome, LIFNetwork

    net = LIFNetwork(Connectome())
    for _ in range(50):
        net.step()
    assert net.spike_count.sum() == 0


@needs_data
def test_poisson_drive_produces_roughly_the_requested_rate():
    from flybrain.engine import Connectome, LIFNetwork

    cx = Connectome()
    net = LIFNetwork(cx, seed=3)
    idx = cx.select(super_class="sensory", cell_class="visual", side="left")
    steps = 500
    for _ in range(steps):
        net.step()
        net.force_poisson(idx, 200.0)
    observed = net.spike_count[idx].sum() / (len(idx) * steps) * 1000.0
    assert 150.0 < observed < 260.0


@needs_data
def test_stimulus_stays_ipsilateral():
    from flybrain.engine import Connectome, LIFNetwork

    cx = Connectome()
    net = LIFNetwork(cx, seed=1)
    pl = cx.select(super_class="sensory", cell_class="visual", side="left")
    ol = cx.select(super_class="optic", side="left")
    orr = cx.select(super_class="optic", side="right")
    for _ in range(400):
        net.step()
        net.force_poisson(pl, 600.0)
    left_rate = net.spike_count[ol].sum() / len(ol)
    right_rate = net.spike_count[orr].sum() / len(orr)
    assert left_rate > 10.0 * max(right_rate, 1e-9)


@needs_data
def test_simulation_tick_advances_and_stays_finite():
    from flybrain.simulation import Simulation

    sim = Simulation(seed=5)
    for _ in range(40):
        sim.tick()
    meta, spikes = sim.snapshot()
    assert meta["frame"] == 40
    assert math.isfinite(meta["world"]["x"])
    assert math.isfinite(meta["world"]["y"])
    assert np.isfinite(sim.net.v).all()
    assert spikes.dtype == np.uint32


@needs_data
def test_server_endpoints():
    from flybrain.server import create_app

    app = create_app()
    client = app.test_client()

    meta = client.get("/api/meta").get_json()
    assert meta["neurons"] == 139_255
    assert len(meta["colors"]) == len(meta["super_class_names"])

    layout = client.get("/api/layout").data
    assert len(layout) == 139_255 * 2 * 4 + 139_255

    frame = client.get("/api/frame").data
    import struct

    hlen = struct.unpack("<I", frame[:4])[0]
    assert (len(frame) - 4 - hlen) % 4 == 0

    assert client.post("/api/control", json={"action": "pause"}).get_json()["ok"]
    assert client.post("/api/control", json={"action": "bogus"}).status_code == 400

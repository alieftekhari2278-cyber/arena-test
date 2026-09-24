"""A small top-down 2D world for the connectome to act in.

Deliberately simple physics: the interesting dynamics are supposed to come from
the wiring diagram, not from the environment. The world exposes bilateral
sensor readings (left/right eye luminance, left/right antenna odour) and
accepts a (forward, turn) motor command.
"""

from __future__ import annotations

import dataclasses
import math

import numpy as np

LIGHT = "light"
ODOR = "odor"
AVERSIVE = "aversive"


@dataclasses.dataclass
class Source:
    x: float
    y: float
    strength: float
    kind: str = LIGHT
    radius: float = 240.0

    def intensity_at(self, x: float, y: float) -> float:
        d2 = (x - self.x) ** 2 + (y - self.y) ** 2
        return self.strength / (1.0 + d2 / (self.radius * self.radius))


@dataclasses.dataclass
class Agent:
    x: float
    y: float
    theta: float = 0.0
    speed: float = 0.0
    eye_angle: float = math.radians(55.0)
    antenna_angle: float = math.radians(20.0)


class World:
    """Rectangular arena with attractive/aversive point sources."""

    def __init__(
        self,
        width: float = 1000.0,
        height: float = 680.0,
        seed: int = 0,
    ):
        self.width = width
        self.height = height
        self.rng = np.random.default_rng(seed)
        self.agent = Agent(width * 0.5, height * 0.5, theta=0.0)
        self.sources: list[Source] = []
        self.trail: list[tuple[float, float]] = []
        self.max_trail = 900
        self.collisions = 0
        self.time_s = 0.0
        self.reset_sources()

    # -- setup -------------------------------------------------------------
    def reset_sources(self) -> None:
        self.sources = [
            Source(self.width * 0.78, self.height * 0.28, 1.0, LIGHT),
            Source(self.width * 0.22, self.height * 0.74, 0.85, ODOR),
            Source(self.width * 0.50, self.height * 0.15, 0.60, AVERSIVE, radius=170.0),
        ]

    def add_source(self, x: float, y: float, kind: str, strength: float = 1.0) -> None:
        self.sources.append(Source(float(x), float(y), float(strength), kind))

    def clear_sources(self) -> None:
        self.sources.clear()

    def reset_agent(self) -> None:
        a = self.agent
        a.x, a.y = self.width * 0.5, self.height * 0.5
        a.theta = float(self.rng.uniform(0, 2 * math.pi))
        a.speed = 0.0
        self.trail.clear()
        self.collisions = 0

    # -- sensing -----------------------------------------------------------
    def _directional(self, kinds: set[str], offset: float, acceptance: float) -> float:
        """Cosine-weighted sum of source intensity in one sensor's direction."""
        a = self.agent
        look = a.theta + offset
        total = 0.0
        for s in self.sources:
            if s.kind not in kinds:
                continue
            dx, dy = s.x - a.x, s.y - a.y
            dist = math.hypot(dx, dy)
            if dist < 1e-6:
                total += s.strength
                continue
            bearing = math.atan2(dy, dx) - look
            # wrap to [-pi, pi]
            bearing = (bearing + math.pi) % (2 * math.pi) - math.pi
            gain = math.cos(bearing)
            if gain <= 0.0:
                continue
            total += s.intensity_at(a.x, a.y) * (gain ** acceptance)
        return total

    def sense(self) -> dict[str, float]:
        a = self.agent
        return {
            "eye_left": self._directional({LIGHT}, +a.eye_angle, 1.5),
            "eye_right": self._directional({LIGHT}, -a.eye_angle, 1.5),
            "odor_left": self._directional({ODOR}, +a.antenna_angle, 1.0),
            "odor_right": self._directional({ODOR}, -a.antenna_angle, 1.0),
            "threat_left": self._directional({AVERSIVE}, +a.eye_angle, 1.5),
            "threat_right": self._directional({AVERSIVE}, -a.eye_angle, 1.5),
        }

    # -- actuation ---------------------------------------------------------
    def step(self, forward: float, turn: float, dt: float = 0.05) -> None:
        a = self.agent
        a.theta = (a.theta + turn * dt) % (2 * math.pi)
        a.speed = float(np.clip(forward, 0.0, 420.0))
        nx = a.x + math.cos(a.theta) * a.speed * dt
        ny = a.y + math.sin(a.theta) * a.speed * dt

        margin = 14.0
        hit = False
        if nx < margin:
            nx, hit = margin, True
        elif nx > self.width - margin:
            nx, hit = self.width - margin, True
        if ny < margin:
            ny, hit = margin, True
        elif ny > self.height - margin:
            ny, hit = self.height - margin, True
        if hit:
            self.collisions += 1
            # Bounce the heading away from the wall with a little noise.
            a.theta = (a.theta + math.pi + float(self.rng.normal(0, 0.4))) % (2 * math.pi)

        a.x, a.y = nx, ny
        self.time_s += dt
        self.trail.append((a.x, a.y))
        if len(self.trail) > self.max_trail:
            del self.trail[: len(self.trail) - self.max_trail]

    def state(self) -> dict:
        a = self.agent
        return {
            "x": round(a.x, 2),
            "y": round(a.y, 2),
            "theta": round(a.theta, 4),
            "speed": round(a.speed, 2),
            "collisions": self.collisions,
            "time_s": round(self.time_s, 2),
            "width": self.width,
            "height": self.height,
            "sources": [
                {"x": round(s.x, 1), "y": round(s.y, 1), "kind": s.kind,
                 "strength": s.strength, "radius": s.radius}
                for s in self.sources
            ],
        }

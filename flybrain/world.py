"""
world.py — a 2D arena, and the two adapters that wire the connectome into it.

The brain is real data. The body is not, and the two pieces that join them are
explicitly engineered, exactly as in every published embodiment of this
connectome (NeuroMechFly v2, Eon's virtual fly, flyvis + FlyGym, ...):

  IN   world -> sensory neurons
       vision      luminance per azimuth  -> 11,153 photoreceptors, placed on an
                                             azimuth axis taken from their own
                                             position inside the optic lobe
       olfaction   odour at each antenna  -> 2,251 olfactory receptor neurons
       taste       what the tarsi touch   -> the labellar sugar / water / bitter
                                             GRNs published with Shiu et al. 2024
       touch       wall contact           -> head and eye bristle neurons
       wind        headwind component     -> wind/gravity (Johnston's organ) neurons

  OUT  motor neurons -> world
       steering    left vs right descending-neuron population rate
       gait        total descending drive gates a baseline walking pattern
       feeding     MN9, the proboscis-extension motor neuron
       grooming    the 205 grooming-command descending neurons

Everything between IN and OUT — 139,255 neurons and 15 million connections —
is the fly. Nothing in this file touches it except by injecting Poisson spikes
into sensory cells and reading spikes out of motor cells.
"""
import math
import os
import sys

sys.path.insert(0, os.path.expanduser("~/.pylibs"))
import numpy as np

ARENA_W = 44.0   # mm
ARENA_H = 30.0   # mm
N_AZ = 96        # azimuth bins of the panoramic luminance map


class Body:
    def __init__(self):
        self.x = ARENA_W * 0.25
        self.y = ARENA_H * 0.5
        self.th = 0.0            # heading, radians, 0 = +x
        self.speed = 0.0         # mm/s
        self.omega = 0.0         # rad/s
        self.proboscis = 0.0     # 0..1
        self.grooming = 0.0      # 0..1
        self.meals = 0
        self.bumps = 0


class World:
    """2D arena + sensory encoding + motor decoding for a whole-brain LIF model."""

    def __init__(self, brain, cfg=None):
        self.b = brain
        self.body = Body()
        self.objects = []
        self.wind_dir = 0.0
        self.wind_speed = 0.0
        self.trail = []
        self.cfg = {
            # --- sensory gains (peak Poisson rate injected, Hz) ---
            "photo_hz": 20.0,      # photoreceptors R1-R8. They light up the optic
                                   # lobe but, being graded cells in reality, this
                                   # spiking model does not propagate them further.
            "vpn_hz": 90.0,        # visual projection neurons (LC/LPLC): the spiking
                                   # output stage of the optic lobe, driven here by
                                   # object contrast inside each receptive field.
            "olf_hz": 0.0,         # olfactory receptor neurons. Off by default: any
                                   # ORN drive sends the mushroom body into runaway
                                   # excitation in the untuned LIF model.
            "taste_hz": 160.0,     # gustatory receptor neurons (sugar/water/bitter)
            "touch_hz": 120.0,     # head and eye bristles
            "wind_hz": 60.0,       # Johnston's organ, wind and gravity cells
            "noise_hz": 0.0,       # optional spontaneous drive to every neuron
            # --- motor mapping ---
            "walk_gain": 1.0,      # scales the baseline gait that the DNs gate
            "turn_gain": 1.0,      # scales DN left/right asymmetry -> yaw
            "turn_sign": 1.0,      # +1: louder-left DNs steer right (avoidance)
                                   # -1: louder-left DNs steer left  (approach)
            "adapt_mV": 0.0,       # spike-frequency adaptation; 0 = exactly Shiu et al.
                                   # raise it to ~0.5 mV to tame the mushroom-body
                                   # runaway that any olfactory drive produces
            "motor_on": True,      # let the brain drive the body
        }
        if cfg:
            self.cfg.update(cfg)

        g = brain.meta["groups"]
        self.idx = {k: np.asarray(v, dtype=np.int64) for k, v in g.items()}
        self.eye = {}
        self.vpn = {}
        for store, key in ((self.eye, "retinotopy"), (self.vpn, "vpn_retinotopy")):
            r = brain.meta.get(key, {})
            for side in ("left", "right"):
                if side not in r:
                    continue
                ids = np.asarray(r[side]["ids"], dtype=np.int64)
                az = np.asarray(r[side]["az"], dtype=np.float32)
                if side == "left":
                    ang = np.deg2rad(-165.0 + 180.0 * az)
                else:
                    ang = np.deg2rad(165.0 - 180.0 * az)
                store[side] = {"ids": ids, "bin": np.clip(
                    ((ang + math.pi) / (2 * math.pi) * N_AZ).astype(np.int64), 0, N_AZ - 1)}
        brain.set_adaptation(self.cfg["adapt_mV"])

        self.lum = np.ones(N_AZ, dtype=np.float32)
        self.prev_lum = np.ones(N_AZ, dtype=np.float32)
        self.sensor_state = {}
        self.reset_objects()

    # ------------------------------------------------------------- objects
    def reset_objects(self):
        self.objects = [
            {"kind": "sugar", "x": 33.0, "y": 9.0, "r": 1.6, "amount": 1.0},
            {"kind": "sugar", "x": 30.0, "y": 22.0, "r": 1.6, "amount": 1.0},
            {"kind": "bitter", "x": 22.0, "y": 15.0, "r": 1.8, "amount": 1.0},
            {"kind": "water", "x": 12.0, "y": 24.0, "r": 1.5, "amount": 1.0},
            {"kind": "pillar", "x": 17.0, "y": 7.0, "r": 1.3, "amount": 1.0},
            {"kind": "pillar", "x": 26.0, "y": 26.0, "r": 1.3, "amount": 1.0},
        ]

    def add_object(self, kind, x, y):
        r = {"sugar": 1.6, "bitter": 1.8, "water": 1.5, "pillar": 1.3}.get(kind, 1.5)
        self.objects.append({"kind": kind, "x": float(x), "y": float(y), "r": r, "amount": 1.0})

    def clear_objects(self):
        self.objects = []

    # ------------------------------------------------------------- sensing
    def panorama(self):
        """Luminance in 96 azimuth bins around the fly. 1 = open space, 0 = black."""
        b = self.body
        lum = np.ones(N_AZ, dtype=np.float32)
        centres = (np.arange(N_AZ) + 0.5) / N_AZ * 2 * math.pi - math.pi   # -pi..pi, 0 = ahead
        for o in self.objects:
            dx, dy = o["x"] - b.x, o["y"] - b.y
            d = math.hypot(dx, dy)
            if d < 1e-3:
                continue
            rel = math.atan2(dy, dx) - b.th
            rel = (rel + math.pi) % (2 * math.pi) - math.pi
            half = math.atan2(o["r"], max(d, o["r"] + 1e-3))
            diff = np.abs((centres - rel + math.pi) % (2 * math.pi) - math.pi)
            shade = {"pillar": 0.05, "bitter": 0.35, "sugar": 0.45, "water": 0.55}.get(o["kind"], 0.3)
            inside = diff < half
            near = 1.0 / (1.0 + 0.06 * d * d)
            lum[inside] = np.minimum(lum[inside], shade + (1 - shade) * (1 - near))
        # arena walls darken the horizon when the fly gets close to them
        for wall_ang, dist in (
            (0.0, ARENA_W - b.x), (math.pi, b.x),
            (math.pi / 2, ARENA_H - b.y), (-math.pi / 2, b.y),
        ):
            if dist > 6.0:
                continue
            rel = (wall_ang - b.th + math.pi) % (2 * math.pi) - math.pi
            diff = np.abs((centres - rel + math.pi) % (2 * math.pi) - math.pi)
            w = np.exp(-(diff ** 2) / 0.6) * (1.0 - dist / 6.0)
            lum *= (1.0 - 0.85 * w)
        return lum

    def odour(self):
        """Concentration at the left and right antenna (sugar sources smell sweet)."""
        b = self.body
        out = []
        for sgn in (+1, -1):                    # left antenna, right antenna
            ax = b.x + 0.55 * math.cos(b.th) - sgn * 0.35 * math.sin(b.th)
            ay = b.y + 0.55 * math.sin(b.th) + sgn * 0.35 * math.cos(b.th)
            c = 0.0
            for o in self.objects:
                if o["kind"] not in ("sugar", "water"):
                    continue
                d2 = (o["x"] - ax) ** 2 + (o["y"] - ay) ** 2
                c += o["amount"] * math.exp(-d2 / (2 * 7.0 ** 2)) * (1.0 if o["kind"] == "sugar" else 0.35)
            out.append(min(1.0, c))
        return out

    def contact(self):
        """What the tarsi are standing on, and what the body is bumping into."""
        b = self.body
        touch = {"sugar": 0.0, "bitter": 0.0, "water": 0.0}
        bump_l = bump_r = 0.0
        for o in self.objects:
            d = math.hypot(o["x"] - b.x, o["y"] - b.y)
            if o["kind"] in touch and d < o["r"] + 0.7:
                touch[o["kind"]] = max(touch[o["kind"]], o["amount"])
            if o["kind"] == "pillar" and d < o["r"] + 0.9:
                rel = math.atan2(o["y"] - b.y, o["x"] - b.x) - b.th
                rel = (rel + math.pi) % (2 * math.pi) - math.pi
                if rel > 0:
                    bump_l = 1.0
                else:
                    bump_r = 1.0
        m = 0.8
        if b.x < m:
            bump_r = max(bump_r, 1.0) if math.cos(b.th) < 0 else bump_r
            bump_l = max(bump_l, 1.0) if math.cos(b.th) < 0 else bump_l
        if b.x > ARENA_W - m or b.y < m or b.y > ARENA_H - m:
            bump_l = max(bump_l, 0.8)
            bump_r = max(bump_r, 0.8)
        return touch, bump_l, bump_r

    def sense(self):
        """Write Poisson drive rates onto the real sensory neurons."""
        c = self.cfg
        br = self.b
        br.clear_drive()
        if c["noise_hz"] > 0:
            br.drive[:] = c["noise_hz"]
            br.mark_drive_dirty()

        lum = self.panorama()
        transient = np.abs(lum - self.prev_lum) * 6.0
        self.prev_lum = lum
        self.lum = lum
        # photoreceptors depolarise to light (graded in the real fly)
        photo_bins = c["photo_hz"] * np.clip(0.25 + 0.75 * lum + transient, 0.0, 3.0)
        for side, e in self.eye.items():
            br.drive[e["ids"]] = photo_bins[e["bin"]]
        # LC-type visual projection neurons answer to objects and to looming
        sal = np.clip((1.0 - lum) + transient, 0.0, 1.5)
        vpn_bins = c["vpn_hz"] * sal
        for side, e in self.vpn.items():
            br.drive[e["ids"]] = vpn_bins[e["bin"]]
        br.mark_drive_dirty()

        cl, cr = self.odour()
        if c["olf_hz"] > 0:
            # one putative glomerular channel carries the food odour
            br.set_drive(self.idx.get("orn_ch0_left", self.idx["orn_left"]), c["olf_hz"] * cl)
            br.set_drive(self.idx.get("orn_ch0_right", self.idx["orn_right"]), c["olf_hz"] * cr)

        touch, bump_l, bump_r = self.contact()
        br.set_drive(self.idx["sugar_grn"], c["taste_hz"] * touch["sugar"])
        br.set_drive(self.idx["bitter_grn"], c["taste_hz"] * touch["bitter"])
        br.set_drive(self.idx["water_grn"], c["taste_hz"] * touch["water"])
        br.set_drive(self.idx["bristle_left"], c["touch_hz"] * bump_l)
        br.set_drive(self.idx["bristle_right"], c["touch_hz"] * bump_r)
        # antennal mechanosensory cells of the grooming circuit (Shiu et al. fig. 5)
        br.set_drive(self.idx["groom_sensory"], c["touch_hz"] * max(bump_l, bump_r))

        if self.wind_speed > 0:
            rel = (self.wind_dir - self.body.th + math.pi) % (2 * math.pi) - math.pi
            head = max(0.0, math.cos(rel)) * self.wind_speed
            lat = math.sin(rel) * self.wind_speed
            br.set_drive(self.idx["wind_left"], c["wind_hz"] * max(0.0, head + lat))
            br.set_drive(self.idx["wind_right"], c["wind_hz"] * max(0.0, head - lat))

        self.sensor_state = {
            "odour": [round(cl, 3), round(cr, 3)],
            "taste": {k: round(v, 2) for k, v in touch.items()},
            "bump": [round(bump_l, 2), round(bump_r, 2)],
            "lum": np.round(lum, 3).tolist(),
        }

    # ------------------------------------------------------------- acting
    def act(self, dt_ms):
        """Read the motor side of the connectome and move the body."""
        b = self.body
        br = self.b
        dt = dt_ms * 1e-3

        rl = br.pop_rate(self.idx["dn_left"])
        rr = br.pop_rate(self.idx["dn_right"])
        dn = 0.5 * (rl + rr)
        # feeding and grooming read-outs were found by stimulating the sensory
        # population and recording which motor cells answered (see calibrate.py)
        feed_pop = self.idx.get("mn_feed", self.idx["mn9"])
        mn9 = br.pop_rate(feed_pop if len(feed_pop) else self.idx["mn9"])
        groom = br.pop_rate(self.idx.get("dn_groom", self.idx["dn_all"]))
        motor = br.pop_rate(self.idx["motor"])

        # steering: a descending population that is louder on one side turns the
        # fly to that side (ipsilateral turning, as for DNa02)
        asym = self.cfg["turn_sign"] * (rl - rr) / (rl + rr + 2.0)
        b.grooming = 0.9 * b.grooming + 0.1 * min(1.0, groom / 10.0)
        b.proboscis = 0.8 * b.proboscis + 0.2 * min(1.0, mn9 / 12.0)

        if self.cfg["motor_on"]:
            target_w = self.cfg["turn_gain"] * 7.0 * asym
            target_v = self.cfg["walk_gain"] * (1.5 + 13.0 * min(1.0, dn / 3.0))
            target_v *= (1.0 - 0.9 * b.grooming) * (1.0 - 0.8 * b.proboscis)
        else:
            target_w, target_v = 0.0, 0.0
        b.omega += (target_w - b.omega) * min(1.0, dt * 8)
        b.speed += (target_v - b.speed) * min(1.0, dt * 6)

        b.th = (b.th + b.omega * dt) % (2 * math.pi)
        nx = b.x + b.speed * math.cos(b.th) * dt
        ny = b.y + b.speed * math.sin(b.th) * dt
        hit = False
        for o in self.objects:
            if o["kind"] != "pillar":
                continue
            d = math.hypot(nx - o["x"], ny - o["y"])
            if d < o["r"] + 0.45:
                hit = True
        if nx < 0.6 or nx > ARENA_W - 0.6 or ny < 0.6 or ny > ARENA_H - 0.6:
            hit = True
        if hit:
            b.bumps += 1
            b.speed *= 0.2
            b.th = (b.th + 0.9) % (2 * math.pi)
        else:
            b.x, b.y = nx, ny

        # feeding: an extended proboscis on a sugar drop consumes it
        if b.proboscis > 0.35:
            for o in self.objects:
                if o["kind"] in ("sugar", "water") and o["amount"] > 0:
                    if math.hypot(o["x"] - b.x, o["y"] - b.y) < o["r"] + 0.7:
                        o["amount"] = max(0.0, o["amount"] - 0.25 * dt)
                        if o["amount"] <= 0.01:
                            b.meals += 1

        self.trail.append((round(b.x, 2), round(b.y, 2)))
        if len(self.trail) > 900:
            self.trail = self.trail[-900:]

        return {
            "dn_left": round(rl, 2), "dn_right": round(rr, 2),
            "mn9": round(mn9, 2), "groom": round(groom, 2), "motor": round(motor, 2),
            "asym": round(asym, 3),
        }

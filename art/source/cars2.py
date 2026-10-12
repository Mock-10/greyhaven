"""Phase 4 vehicles (docs/13 "Missing art"): pickup, sports car, armored SUV, log truck, SWAT van, police
helicopter (body, rotor frames and a ground shadow) and the armored cash truck.

Same language as cars.py: crisp planar greenhouses with visible pillars, flat inset lights, tight-radius
lower bodies and a 1 px outline from the renderer. Never rounded "bubble" shapes (user rule). Gold is
reserved for valuables and interactables, so none of these use it: the armored truck's rear door gets the
gold cue from the game's highlight when it is the target, not from its paint.

Run `python3 art/source/cars2.py` to write art/vehicles2.png/.json and the preview sheets under
art/drafts/vehicles2/ (renders in parallel; a few minutes)."""
import os, sys, json, warnings
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from sdf import Model, rbox, cyl_y, cyl_z, capsule, solid, RID, hash3, render
from cars import plane

DIRS = ['SE', 'S', 'SW', 'W', 'NW', 'N', 'NE', 'E']


# ---------------------------------------------------------------- shared helpers
def cyl_x(p, c, r, hh, rr=0.0):
    q = p - np.asarray(c, float)
    d1 = np.sqrt(q[:, 1] ** 2 + q[:, 2] ** 2) - r + rr
    d2 = np.abs(q[:, 0]) - hh + rr
    return np.minimum(np.maximum(d1, d2), 0.0) + np.sqrt(np.maximum(d1, 0) ** 2 + np.maximum(d2, 0) ** 2) - rr


def wheels(P, axles, wy, wr, w=2.7):
    d = np.full(len(P), 1e3)
    for ax in axles:
        for sy in (1, -1):
            d = np.minimum(d, cyl_y(P, (ax, sy * wy, wr), wr, w, 1.4))
    return d


def arches(P, axles, ay, wr):
    d = np.full(len(P), 1e3)
    for ax in axles:
        for sy in (1, -1):
            d = np.minimum(d, cyl_y(P, (ax, sy * ay, wr + 0.2), wr + 1.4, 3.4, 0.3))
    return d


def tire_mat(axles, wr):
    axles = np.asarray(axles, float)

    def m(p, n):
        x, z = p[:, 0], p[:, 2]
        dx = np.min(np.abs(x[:, None] - axles[None, :]), 1)
        r = np.sqrt(dx ** 2 + (z - wr) ** 2)
        k = wr / 6.6
        hub = (np.abs(n[:, 1]) > 0.75) & (r < 4.1 * k)
        ramp = np.where(hub, RID['lavlt'], RID['asph'])
        base = np.where(hub, 2.7 + (r < 1.4 * k) * 1.0 - ((r > 2.5 * k) & (r < 3.1 * k)) * 1.0, 0.9)
        return ramp, base, np.where(hub, 0.6, 0.0)
    return m


def lower_body(P, L, hw, top, axles, wr, zbot=5.2, hood_x=None, hood_k=0.075, nose_z=9.0, nose_k=0.22,
               tail_k=0.12, plan_r=4.5):
    """The tub under the beltline: rounded in plan only, a hood that falls toward the nose, cut wheel arches."""
    tub = rbox(P, (0, 0, (top + zbot) / 2), (L, hw, (top - zbot) / 2), 1.8)
    plan = rbox(P, (0, 0, 15), (L, hw, 80), plan_r)
    cuts = [tub, plan, plane(P, (L, 0, nose_z), (1, 0, nose_k)), plane(P, (-L, 0, nose_z), (-1, 0, tail_k))]
    if hood_x is not None:
        cuts.append(plane(P, (hood_x, 0, top), (hood_k, 0, 1)))
    b = np.maximum.reduce(cuts)
    return np.maximum(b, -arches(P, axles, hw - 1.0, wr))


class Green:
    """A planar greenhouse: raked windshield, rear glass, flat roof and tumblehome sides."""

    def __init__(self, belt, roof, ws_lo, ws_hi, rw_lo, rw_hi, cab_y, tumble):
        self.belt, self.roof = belt, roof
        self.ws_lo, self.ws_hi, self.rw_lo, self.rw_hi = ws_lo, ws_hi, rw_lo, rw_hi
        self.cab_y, self.tumble = cab_y, tumble

    def ws_x(self, z):
        return self.ws_lo + (self.ws_hi - self.ws_lo) * (z - self.belt) / (self.roof - self.belt)

    def rw_x(self, z):
        return self.rw_lo + (self.rw_hi - self.rw_lo) * (z - self.belt) / (self.roof - self.belt)

    def half(self, z):
        return self.cab_y - self.tumble * (z - self.belt)

    def dist(self, P):
        y, z = P[:, 1], P[:, 2]
        h = self.roof - self.belt
        ws = plane(P, (self.ws_lo, 0, self.belt), (h, 0, self.ws_lo - self.ws_hi))
        rw = plane(P, (self.rw_lo, 0, self.belt), (-h, 0, self.rw_hi - self.rw_lo))
        side = (np.abs(y) - self.half(z)) / np.sqrt(1 + self.tumble ** 2)
        return np.maximum.reduce([ws, rw, side, z - self.roof, (self.belt - 1.5) - z])


def glass_tone(x, y, z, z0, z1, lo=1.4, span=1.3, refl=0.7):
    r = np.abs(np.mod(x * 0.55 + y * 0.35 + z * 0.9, 9.0) - 4.5) < 1.1
    return lo + np.clip((z - z0) / max(z1 - z0, 1e-6), 0, 1) * span + r * refl


def paint(ramp, base, mask, rname, b):
    return np.where(mask, RID[rname], ramp), np.where(mask, b, base)


def lights(p, n, ramp, base, shine, L, hz, tz, hy, ty, gy=8.0, gz=None, bz=10.8, pz=(6.6, 9.6), wrap=True):
    """Flat inset lamps: headlights, tail lights, grille, dark bumpers and a plate (as cars._lights, sized)."""
    x, y, z = p[:, 0], p[:, 1], p[:, 2]
    front, rear = n[:, 0] > 0.6, n[:, 0] < -0.6
    hl = front & (np.abs(y) > hy[0]) & (np.abs(y) < hy[1]) & (z > hz[0]) & (z < hz[1])
    tl = rear & (np.abs(y) > ty[0]) & (np.abs(y) < ty[1]) & (z > tz[0]) & (z < tz[1])
    if wrap:
        hl |= (np.abs(n[:, 1]) > 0.6) & (x > L - 3.2) & (z > hz[0]) & (z < hz[1] - 0.4)
        tl |= (np.abs(n[:, 1]) > 0.6) & (x < -L + 2.2) & (z > tz[0]) & (z < tz[1] - 0.2)
    ramp, base = paint(ramp, base, hl, 'white', 4.4)
    ramp, base = paint(ramp, base, tl, 'red', 2.9)
    if gz is not None:
        gr = front & (np.abs(y) < gy) & (z > gz[0]) & (z < gz[1])
        ramp = np.where(gr, RID['asph'], ramp)
        base = np.where(gr, 0.9 + (np.mod(np.floor(z), 2) == 0) * 0.8, base)
    bump = (np.abs(n[:, 0]) > 0.6) & (z < bz)
    ramp, base = paint(ramp, base, bump, 'asph', 1.6)
    plate = (np.abs(n[:, 0]) > 0.6) & (np.abs(y) < 4.2) & (z > pz[0]) & (z < pz[1])
    ramp, base = paint(ramp, base, plate, 'white', 3.9)
    shine = np.where(hl | tl, 0.9, shine)
    return ramp, base, shine


def mirrors(P, x, y, z):
    return np.minimum(rbox(P, (x, y, z), (1.4, 1.1, 1.0), 0.4), rbox(P, (x, -y, z), (1.4, 1.1, 1.0), 0.4))


def none(P):
    return np.full(len(P), 1e3)


def lightbar_mat(p, n):
    y = p[:, 1]
    ramp = np.where(y > 0.6, RID['red'], np.where(y < -0.6, RID['navy'], RID['white']))
    return ramp, np.where(np.abs(y) <= 0.6, 3.6, 3.3), np.full(len(p), 0.8)


# ---------------------------------------------------------------- pickup
def pickup(color=('brick', 2.6)):
    """A full-size work pickup: long hood, upright cab, open bed with ribbed floor and a tailgate."""
    cr, cb = color
    L, HW, BELT, AX, WR = 50.0, 17.2, 21.5, (31.0, -29.0), 7.2
    g = Green(BELT, 34.0, 17.5, 8.0, -9.5, -9.0, 15.8, 0.16)

    def parts(P):
        body = lower_body(P, L, HW, BELT, AX, WR, zbot=6.0, hood_x=18.0, hood_k=0.06, nose_z=10.0, nose_k=0.12, tail_k=0.02)
        cavity = rbox(P, (-29.8, 0, BELT + 10), (18.6, HW - 2.4, 21.0), 0.6)
        cavity = np.maximum(cavity, 10.5 - P[:, 2])
        body = np.maximum(body, -cavity)
        return [body, g.dist(P), wheels(P, AX, HW - 2.0, WR), mirrors(P, 15.0, 17.6, 23.0)]

    def body_mat(p, n):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        N = len(p)
        ramp = np.full(N, RID[cr]); base = np.full(N, float(cb)); shine = np.full(N, 0.35)
        side = np.abs(n[:, 1]) > 0.55
        outer = side & (np.abs(y) > HW - 1.2)
        base = np.where(outer & (z > 16.6) & (z < 17.6), base + 0.7, base)          # character line
        base = np.where(outer & (z > 9.5) & (z < 16.6), base - 0.25, base)
        ramp, base = paint(ramp, base, outer & (z < 9.5), 'asph', 1.5)               # sill / rocker
        for xs in (18.0, -9.0, -11.2):
            base = np.where(outer & (np.abs(x - xs) < 0.4) & (z > 9.5) & (z < BELT), base - 1.0, base)
        base = np.where(outer & (np.abs(x - 11.0) < 1.6) & (np.abs(z - 19.0) < 0.45), base + 1.2, base)
        # the bed: dark ribbed floor and inner walls, light rail caps
        inside = (x < -10.6) & (x > -48.6) & (np.abs(y) < HW - 2.2) & (z < BELT - 0.4)
        floor = inside & (n[:, 2] > 0.7)
        ramp, base = paint(ramp, base, inside, 'asph', 2.0)
        base = np.where(floor, 1.6 + (np.mod(np.floor(y / 2.2), 2) == 0) * 0.7, base)
        rail = (n[:, 2] > 0.7) & (z > BELT - 0.9) & (x < -10.2)
        base = np.where(rail, base + 0.35, base)
        # tailgate: seam and a dark handle
        rear = n[:, 0] < -0.6
        base = np.where(rear & (np.abs(z - (BELT - 1.2)) < 0.35), base - 1.0, base)
        ramp, base = paint(ramp, base, rear & (np.abs(y) < 2.4) & (np.abs(z - 18.0) < 0.6), 'asph', 1.2)
        top = n[:, 2] > 0.7
        base = np.where(top & (np.abs(x - 18.6) < 0.35), base - 0.8, base)
        return lights(p, n, ramp, base, shine, L, (13.5, 17.0), (12.0, 18.5), (9.0, 15.6), (13.4, 16.6),
                      gy=8.6, gz=(10.5, 17.0), bz=10.4, pz=(7.0, 9.8))

    def cabin_mat(p, n):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        N = len(p)
        ramp = np.full(N, RID[cr]); base = np.full(N, float(cb) + 0.2); shine = np.full(N, 0.35)
        zin = (z > BELT + 0.6) & (z < g.roof - 1.1)
        half = g.half(z)
        ws_g = (n[:, 0] > 0.35) & (n[:, 2] > 0.2) & zin & (np.abs(y) < half - 1.3)
        rw_g = (n[:, 0] < -0.6) & zin & (np.abs(y) < half - 3.0) & (z < g.roof - 2.0)
        sd_g = (np.abs(n[:, 1]) > 0.7) & zin & (x < g.ws_x(z) - 1.8) & (x > -7.0) & (np.abs(x - 1.5) > 0.9)
        glass = ws_g | rw_g | sd_g
        ramp = np.where(glass, RID['glass'], ramp)
        base = np.where(glass, glass_tone(x, y, z, BELT, g.roof), base)
        shine = np.where(glass, 1.0, shine)
        trim = (np.abs(n[:, 1]) > 0.7) & (np.abs(z - (BELT + 0.4)) < 0.4)
        ramp, base = paint(ramp, base, trim & ~glass, 'night', 1.2)
        return ramp, base, shine

    return Model(parts, [body_mat, cabin_mat, tire_mat(AX, WR), solid('night', 1.4)], (-52, 52, -20, 20, 0, 35))


# ---------------------------------------------------------------- sports car
def sports(color=('red', 2.8)):
    """A low wedge coupe: knife-edge nose, steeply raked flat windshield, fastback glass and a rear wing."""
    cr, cb = color
    L, HW, BELT, AX, WR = 44.0, 18.0, 15.0, (27.5, -26.0), 6.6
    g = Green(BELT, 24.5, 9.5, -6.0, -33.0, -15.0, 15.0, 0.34)

    def parts(P):
        body = lower_body(P, L, HW, BELT, AX, WR, zbot=4.4, hood_x=6.0, hood_k=0.13, nose_z=6.0, nose_k=0.65,
                          tail_k=0.06, plan_r=3.5)
        wing = np.minimum(rbox(P, (-40.0, 0, 17.6), (2.4, 15.0, 0.5), 0.2),
                          np.minimum(rbox(P, (-39.6, 10.0, 16.0), (0.9, 0.7, 1.4), 0.2),
                                     rbox(P, (-39.6, -10.0, 16.0), (0.9, 0.7, 1.4), 0.2)))
        return [body, g.dist(P), wheels(P, AX, HW - 2.2, WR, 3.0), mirrors(P, 6.0, 17.4, 17.2), wing]

    def body_mat(p, n):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        N = len(p)
        ramp = np.full(N, RID[cr]); base = np.full(N, float(cb)); shine = np.full(N, 0.55)
        side = np.abs(n[:, 1]) > 0.55
        base = np.where(side & (z > 11.4) & (z < 12.2), base + 0.7, base)
        ramp, base = paint(ramp, base, side & (z < 7.4), 'asph', 1.4)
        # side intake behind the door
        intake = side & (x > -20.0) & (x < -12.5) & (z > 8.0) & (z < 11.0) & (z > 8.0 + (x + 20.0) * 0.1)
        ramp, base = paint(ramp, base, intake, 'asph', 0.8)
        for xs in (8.8, -12.0):
            base = np.where(side & (np.abs(x - xs) < 0.4) & (z > 7.4) & (z < BELT), base - 1.0, base)
        base = np.where(side & (np.abs(x - (-8.0)) < 1.4) & (np.abs(z - 13.2) < 0.45), base + 1.2, base)
        # black-out stripe across the hood
        top = n[:, 2] > 0.6
        base = np.where(top & (x > 10) & (np.abs(np.abs(y) - 4.0) < 0.9), base - 0.6, base)
        # headlights: a thin strip under the hood edge; tail lights: one full-width bar
        front, rear = n[:, 0] > 0.3, n[:, 0] < -0.6
        hl = front & (np.abs(y) > 7.0) & (np.abs(y) < 16.0) & (z > 8.6) & (z < 10.2)
        tl = rear & (np.abs(y) < 16.4) & (z > 10.6) & (z < 12.8)
        ramp, base = paint(ramp, base, hl, 'white', 4.4)
        ramp, base = paint(ramp, base, tl, 'red', 2.6 + (np.abs(y) > 10.5) * 0.6)
        shine = np.where(hl | tl, 0.9, shine)
        ramp, base = paint(ramp, base, (np.abs(n[:, 0]) > 0.3) & (z < 7.0), 'asph', 1.4)
        ramp, base = paint(ramp, base, rear & (np.abs(y) < 4.0) & (z > 7.4) & (z < 10.0), 'white', 3.9)
        return ramp, base, shine

    def cabin_mat(p, n):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        N = len(p)
        ramp = np.full(N, RID[cr]); base = np.full(N, float(cb) + 0.2); shine = np.full(N, 0.55)
        zin = (z > BELT + 0.5) & (z < g.roof - 0.8)
        half = g.half(z)
        ws_g = (n[:, 0] > 0.3) & (n[:, 2] > 0.3) & zin & (np.abs(y) < half - 1.2)
        rw_g = (n[:, 0] < -0.25) & (n[:, 2] > 0.3) & zin & (np.abs(y) < half - 1.5)
        sd_g = (np.abs(n[:, 1]) > 0.6) & zin & (x < g.ws_x(z) - 1.4) & (x > g.rw_x(z) + 4.0)
        glass = ws_g | rw_g | sd_g
        ramp = np.where(glass, RID['glass'], ramp)
        base = np.where(glass, glass_tone(x, y, z, BELT, g.roof, lo=1.2), base)
        shine = np.where(glass, 1.0, shine)
        return ramp, base, shine

    return Model(parts, [body_mat, cabin_mat, tire_mat(AX, WR), solid('night', 1.4), solid(cr, cb + 0.2, 0.5)],
                 (-46, 46, -20, 20, 0, 26))


# ---------------------------------------------------------------- armored SUV
def armored_suv(color=('night', 3.0)):
    """A heavy, square armored SUV: upright dark-tinted glass, thick pillars, a push bar and a rear spare."""
    cr, cb = color
    L, HW, BELT, AX, WR = 48.0, 18.2, 24.0, (30.0, -29.0), 8.0
    g = Green(BELT, 39.0, 23.0, 15.5, -46.0, -44.0, 16.8, 0.08)

    def parts(P):
        body = lower_body(P, L, HW, BELT, AX, WR, zbot=7.4, hood_x=25.0, hood_k=0.03, nose_z=11.0, nose_k=0.05,
                          tail_k=0.02, plan_r=3.0)
        bar = np.minimum(rbox(P, (49.4, 0, 13.5), (1.4, 13.0, 1.2), 0.3),
                         np.minimum(rbox(P, (49.4, 7.0, 15.5), (1.2, 1.1, 5.6), 0.3), rbox(P, (49.4, -7.0, 15.5), (1.2, 1.1, 5.6), 0.3)))
        bar = np.minimum(bar, rbox(P, (49.4, 0, 20.2), (1.2, 8.0, 1.0), 0.3))
        spare = cyl_x(P, (-49.6, 0, 22.0), 7.0, 1.8, 0.8)
        rails = np.minimum(rbox(P, (-12, 13.0, 39.6), (26.0, 0.8, 0.6), 0.2), rbox(P, (-12, -13.0, 39.6), (26.0, 0.8, 0.6), 0.2))
        return [body, g.dist(P), wheels(P, AX, HW - 2.0, WR, 3.2), mirrors(P, 21.0, 18.8, 27.0), bar, spare, rails]

    def body_mat(p, n):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        N = len(p)
        ramp = np.full(N, RID[cr]); base = np.full(N, float(cb)); shine = np.full(N, 0.6)
        side = np.abs(n[:, 1]) > 0.55
        base = np.where(side & (z > 19.0) & (z < 20.0), base + 0.6, base)
        ramp, base = paint(ramp, base, side & (z < 11.5), 'asph', 1.7)
        for xs in (23.6, -2.0, -26.0):
            base = np.where(side & (np.abs(x - xs) < 0.45) & (z > 11.5) & (z < BELT), base - 1.0, base)
        for xh in (16.0, -9.0):
            base = np.where(side & (np.abs(x - xh) < 1.6) & (np.abs(z - 21.6) < 0.5), base + 1.3, base)
        # step boards
        ramp, base = paint(ramp, base, side & (z > 9.0) & (z < 10.4) & (np.abs(x) < 20), 'lavlt', 1.6)
        top = n[:, 2] > 0.7
        base = np.where(top & (np.abs(x - 24.0) < 0.4), base - 0.8, base)
        return lights(p, n, ramp, base, shine, L, (17.0, 20.4), (17.5, 24.0), (10.0, 16.6), (14.5, 17.4),
                      gy=9.4, gz=(12.0, 20.4), bz=13.0, pz=(9.6, 12.6))

    def cabin_mat(p, n):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        N = len(p)
        ramp = np.full(N, RID[cr]); base = np.full(N, float(cb) + 0.2); shine = np.full(N, 0.6)
        zin = (z > BELT + 1.0) & (z < g.roof - 1.6)
        half = g.half(z)
        ws_g = (n[:, 0] > 0.35) & zin & (np.abs(y) < half - 2.0)
        rw_g = (n[:, 0] < -0.5) & zin & (np.abs(y) < half - 2.6) & (z > BELT + 3.0)
        sd_g = (np.abs(n[:, 1]) > 0.7) & zin & (x < g.ws_x(z) - 2.4) & (x > -43.0)
        sd_g &= (np.abs(x - (-2.0)) > 1.6) & (np.abs(x - (-26.0)) > 1.6)                # thick B and C pillars
        glass = ws_g | rw_g | sd_g
        ramp = np.where(glass, RID['glass'], ramp)
        base = np.where(glass, glass_tone(x, y, z, BELT, g.roof, lo=0.5, span=0.9, refl=0.6), base)  # dark tint
        shine = np.where(glass, 1.0, shine)
        return ramp, base, shine

    mats = [body_mat, cabin_mat, tire_mat(AX, WR), solid('night', 1.4), solid('asph', 2.2), tire_mat((-49.6,), 7.0),
            solid('lavlt', 1.8)]
    return Model(parts, mats, (-52, 52, -21, 21, 0, 41))


# ---------------------------------------------------------------- log truck
LOGS = [(-10.6, 21.8), (0.0, 21.8), (10.6, 21.8), (-5.3, 31.0), (5.3, 31.0), (0.0, 40.2)]


def log_truck(color=('brick', 2.7)):
    """Ashby Timber's log truck (docs/03): a conventional long-hood cab, exhaust stacks and fuel tanks, and a
    stake-bunk bed stacked with logs. Wheels: a steer axle, a drive tandem and a trailer tandem."""
    cr, cb = color
    WR = 8.2
    AX = (74.0, 22.0, 6.0, -62.0, -78.0)
    R = 5.0

    def parts(P):
        x, y, z = P[:, 0], P[:, 1], P[:, 2]
        frame = rbox(P, (-8.0, 0, 11.0), (88.0, 9.0, 2.6), 0.6)
        hood = rbox(P, (74.0, 0, 20.5), (17.0, 13.0, 10.0), 2.0)
        hood = np.maximum(hood, plane(P, (62.0, 0, 30.5), (0.06, 0, 1)))
        fender = rbox(P, (76.0, 0, 17.0), (15.0, 17.6, 3.6), 1.6)
        fender = np.maximum(fender, -arches(P, AX[:1], 16.6, WR))
        cab = rbox(P, (49.0, 0, 30.0), (12.0, 17.0, 19.0), 1.6)
        cab = np.maximum(cab, plane(P, (61.0, 0, 33.0), (16.0, 0, 3.0)))
        cab = np.maximum(cab, -arches(P, AX[:1], 16.6, WR))
        body = np.minimum.reduce([frame, hood, fender, cab])
        stacks = np.minimum(cyl_z(P, (35.6, 14.6, 33.0), 1.5, 21.0, 0.4), cyl_z(P, (35.6, -14.6, 33.0), 1.5, 21.0, 0.4))
        tanks = np.minimum(cyl_x(P, (47.0, 14.8, 13.4), 4.0, 8.0, 0.6), cyl_x(P, (47.0, -14.8, 13.4), 4.0, 8.0, 0.6))
        metal = np.minimum(stacks, tanks)
        bunks = np.full(len(P), 1e3)
        for bx in (28.0, -2.0, -44.0, -84.0):
            bunks = np.minimum(bunks, rbox(P, (bx, 0, 15.6), (1.6, 17.0, 1.6), 0.3))
            for sy in (1, -1):
                bunks = np.minimum(bunks, rbox(P, (bx, sy * 16.6, 27.0), (1.3, 1.1, 12.0), 0.3))
        logs = np.full(len(P), 1e3)
        for i, (ly, lz) in enumerate(LOGS):
            x0 = -92.0 + (i * 37 % 5) - 1.0
            x1 = 32.0 - (i * 23 % 6)
            logs = np.minimum(logs, cyl_x(P, ((x0 + x1) / 2, ly, lz), R - 0.2 * (i % 3), (x1 - x0) / 2, 0.8))
        guard = rbox(P, (34.4, 0, 30.0), (0.8, 14.0, 13.0), 0.3)                    # headache rack behind the cab
        return [body, wheels(P, AX, 15.4, WR, 3.4), metal, bunks, logs, guard]

    def body_mat(p, n):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        N = len(p)
        ramp = np.full(N, RID[cr]); base = np.full(N, float(cb)); shine = np.full(N, 0.35)
        ramp, base = paint(ramp, base, z < 13.8, 'asph', 1.7)                       # chassis rails
        side = np.abs(n[:, 1]) > 0.55
        front = n[:, 0] > 0.6
        # big chrome-less grille and square headlamps on the hood front
        gr = front & (x > 89) & (np.abs(y) < 9.0) & (z > 13.0) & (z < 28.0)
        ramp = np.where(gr, RID['asph'], ramp); base = np.where(gr, 0.9 + (np.mod(np.floor(z), 2) == 0) * 0.9, base)
        hl = front & (np.abs(y) > 10.0) & (np.abs(y) < 16.4) & (z > 16.0) & (z < 19.4)
        ramp, base = paint(ramp, base, hl, 'white', 4.4); shine = np.where(hl, 0.9, shine)
        bump = front & (z < 14.0)
        ramp, base = paint(ramp, base, bump, 'lavlt', 2.0)
        # cab: windshield, side windows, door seam and handle
        cabz = (x > 37.0) & (x < 61.5)
        ws = (n[:, 0] > 0.6) & (n[:, 2] > -0.2) & (x > 56) & (z > 33.0) & (z < 46.6) & (np.abs(y) < 15.0) & (x < 62)
        sw = side & cabz & (z > 33.0) & (z < 46.2) & (x > 47.0) & (x < 59.4 - (z - 33.0) * 0.18)
        bw = (n[:, 0] < -0.6) & cabz & (z > 35.0) & (z < 45.0) & (np.abs(y) < 9.0)
        glass = ws | sw | bw
        ramp = np.where(glass, RID['glass'], ramp)
        base = np.where(glass, glass_tone(x, y, z, 33.0, 47.0), base); shine = np.where(glass, 1.0, shine)
        base = np.where(side & cabz & ((np.abs(x - 46.4) < 0.4) | (np.abs(x - 60.0) < 0.4)) & (z > 14) & (z < 47), base - 1.0, base)
        base = np.where(side & (np.abs(x - 49.0) < 1.5) & (np.abs(z - 30.0) < 0.5), base + 1.2, base)
        # a cream coachline along the cab and hood
        ramp, base = paint(ramp, base, side & (z > 24.0) & (z < 25.6) & (x > 37), 'stone', 3.9)
        # hood centre seam + vents
        top = n[:, 2] > 0.7
        base = np.where(top & (x > 61) & (np.abs(y) < 0.4), base - 0.8, base)
        vent = side & (x > 66) & (x < 82) & (z > 21.0) & (z < 27.0) & (np.mod(np.floor(x), 3) == 0)
        base = np.where(vent, base - 0.8, base)
        rear_lt = (n[:, 0] < -0.6) & (x < -95) & (np.abs(y) > 5) & (z < 13.6)
        ramp, base = paint(ramp, base, rear_lt, 'red', 2.9)
        return ramp, base, shine

    def log_mat(p, n):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        N = len(p)
        end = np.abs(n[:, 0]) > 0.7
        # bark: dark streaky wood along the logs; cut ends: pale wood with growth rings
        streak = hash3(np.floor(x / 5.0), np.floor((y + z * 0.7) / 1.6), 1, 21)
        ramp = np.full(N, RID['wood']); base = 1.6 + (streak > 0.6) * 0.6 - (streak < 0.2) * 0.4
        best = np.full(N, 1e9)
        rr = np.zeros(N)
        for ly, lz in LOGS:
            d = np.sqrt((y - ly) ** 2 + (z - lz) ** 2)
            closer = d < best
            rr = np.where(closer, d, rr); best = np.minimum(best, d)
        ring = np.mod(rr, 1.8) < 0.6
        base = np.where(end, 3.7 - ring * 0.8 - (rr > R - 0.9) * 1.4, base)
        ramp = np.where(end & (rr > R - 0.9), RID['wood'], np.where(end, RID['clay'], ramp))
        return ramp, base, np.zeros(N)

    mats = [body_mat, tire_mat(AX, WR), solid('lavlt', 2.6, 0.6), solid('asph', 2.2), log_mat, solid('asph', 2.0)]
    return Model(parts, mats, (-96, 94, -21, 21, 0, 56))


# ---------------------------------------------------------------- SWAT van
def swat_van(color=('navy', 1.5)):
    """The 4-star police response (docs/05): a tall box van in dark police blue with a white band, a light
    bar, a push bumper, slit windows on the box and twin rear doors."""
    cr, cb = color
    L, HW, BELT, ROOF, AX, WR = 52.0, 18.6, 22.0, 44.0, (33.0, -32.0), 8.0
    WS_LO, WS_HI = 39.0, 29.0

    def parts(P):
        lower = lower_body(P, L, HW, BELT, AX, WR, zbot=7.0, hood_x=30.0, hood_k=0.08, nose_z=11.0, nose_k=0.12,
                           tail_k=0.0, plan_r=3.0)
        upper = rbox(P, (-6.5, 0, (BELT + ROOF) / 2), (45.5, HW - 0.2, (ROOF - BELT) / 2), 1.6)
        upper = np.maximum(upper, plane(P, (WS_LO, 0, BELT), (ROOF - BELT, 0, WS_LO - WS_HI)))
        upper = np.maximum(upper, rbox(P, (0, 0, 20), (L, HW, 60), 3.0))
        bar = rbox(P, (24.0, 0, ROOF + 1.0), (2.4, 12.0, 1.1), 0.5)
        push = np.minimum(rbox(P, (53.4, 0, 12.0), (1.4, 15.0, 2.6), 0.4),
                          np.minimum(rbox(P, (53.4, 9.0, 17.0), (1.2, 1.2, 5.0), 0.3), rbox(P, (53.4, -9.0, 17.0), (1.2, 1.2, 5.0), 0.3)))
        return [np.minimum(lower, upper), wheels(P, AX, HW - 2.2, WR, 3.2), mirrors(P, 31.0, 19.4, 27.0), bar, push]

    def body_mat(p, n):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        N = len(p)
        ramp = np.full(N, RID[cr]); base = np.full(N, float(cb)); shine = np.full(N, 0.35)
        side = np.abs(n[:, 1]) > 0.55
        ramp, base = paint(ramp, base, side & (z < 11.0), 'asph', 1.5)
        # white band, broken by the door seams, and a row of reflective markers above it
        band = side & (z > 23.5) & (z < 27.5) & (x < 30)
        ramp, base = paint(ramp, base, band, 'white', 3.4)
        marks = side & (z > 30.0) & (z < 34.0) & (x < 14) & (x > -44) & (np.mod(np.floor((x + 44) / 3.0), 4) == 0)
        ramp, base = paint(ramp, base, marks, 'white', 3.0)
        for xs in (30.6, 14.0, -51.0):
            base = np.where(side & (np.abs(x - xs) < 0.45) & (z > 11.0) & (z < ROOF - 1), base - 1.0, base)
        base = np.where(side & (np.abs(x - 24.0) < 1.6) & (np.abs(z - 22.0) < 0.5), base + 1.2, base)
        # glass: windshield, cab side windows, slits along the box, small rear-door windows
        zg = (z > BELT + 1.0) & (z < ROOF - 1.6)
        wsx = WS_LO - (WS_LO - WS_HI) * (z - BELT) / (ROOF - BELT)
        wsf = (n[:, 0] > 0.35) & (n[:, 2] > 0.2) & zg & (np.abs(y) < HW - 2.5)
        sdw = side & zg & (z > BELT + 2.0) & (z < ROOF - 4.0) & (x > 16.0) & (x < wsx - 1.8)
        slit = side & (z > 36.5) & (z < 39.0) & (x < 10) & (x > -44) & (np.mod(np.floor((x + 44) / 9.0), 2) == 0)
        rdw = (n[:, 0] < -0.6) & (z > 30.0) & (z < 38.0) & (np.abs(y) > 2.0) & (np.abs(y) < 13.0)
        glass = wsf | sdw | slit | rdw
        ramp = np.where(glass, RID['glass'], ramp)
        base = np.where(glass, glass_tone(x, y, z, BELT, ROOF, lo=1.0, span=1.1), base)
        shine = np.where(glass, 1.0, shine)
        rear = n[:, 0] < -0.6
        base = np.where(rear & (np.abs(y) < 0.45) & (z > 11.0), base - 1.1, base)
        ramp, base, shine = lights(p, n, ramp, base, shine, L, (14.0, 17.6), (14.0, 19.0), (10.0, 16.8), (14.0, 17.6),
                                   gy=9.0, gz=(11.5, 19.0), bz=11.0, pz=(7.6, 10.6))
        # corner beacons on the rear roof edge
        bc = rear & (z > ROOF - 4.2) & (np.abs(y) > 13.0)
        ramp = np.where(bc, np.where(y > 0, RID['red'], RID['navy']), ramp); base = np.where(bc, 3.6, base)
        shine = np.where(bc, 0.9, shine)
        return ramp, base, shine

    mats = [body_mat, tire_mat(AX, WR), solid('night', 1.4), lightbar_mat, solid('asph', 2.0)]
    return Model(parts, mats, (-54, 56, -21, 21, 0, 47))


# ---------------------------------------------------------------- armored truck
def armored_truck(color=('stone', 2.9), band=('navy', 2.0)):
    """The cash-in-transit truck (docs/04): short hood, an armored cab with small thick-framed windows and a
    tall steel box with gun ports, roof vents and heavy hinged rear doors (the safe-crack target)."""
    cr, cb = color
    L, HW, AX, WR = 56.0, 18.4, (37.0, -34.0), 8.4

    def parts(P):
        x, z = P[:, 0], P[:, 2]
        hood = rbox(P, (45.0, 0, 18.0), (11.0, 16.4, 9.6), 1.8)
        hood = np.maximum(hood, plane(P, (40.0, 0, 27.6), (0.08, 0, 1)))
        hood = np.maximum(hood, plane(P, (L, 0, 12.0), (1, 0, 0.12)))
        cab = rbox(P, (26.0, 0, 26.0), (9.8, HW - 0.4, 17.0), 1.6)
        cab = np.maximum(cab, plane(P, (35.0, 0, 28.0), (14.0, 0, 3.0)))
        box = rbox(P, (-20.0, 0, 28.0), (36.0, HW, 20.0), 1.4)
        lower = rbox(P, (0, 0, 9.0), (L - 1.0, HW - 1.0, 2.6), 0.6)
        body = np.minimum.reduce([hood, cab, box, lower])
        body = np.maximum(body, -arches(P, AX, HW - 1.0, WR))
        vents = np.minimum(rbox(P, (-8.0, 0, 48.6), (5.0, 6.0, 0.9), 0.3), rbox(P, (-36.0, 0, 48.6), (5.0, 6.0, 0.9), 0.3))
        bumper = np.minimum(rbox(P, (57.0, 0, 11.0), (1.6, 16.0, 2.4), 0.4), rbox(P, (-57.0, 0, 10.0), (1.4, 16.0, 2.0), 0.4))
        return [body, wheels(P, AX, HW - 2.2, WR, 3.4), mirrors(P, 34.0, 19.6, 30.0), vents, bumper]

    def body_mat(p, n):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        N = len(p)
        ramp = np.full(N, RID[cr]); base = np.full(N, float(cb)); shine = np.full(N, 0.3)
        side = np.abs(n[:, 1]) > 0.55
        ramp, base = paint(ramp, base, z < 11.6, 'asph', 1.6)
        ramp, base = paint(ramp, base, side & (z > 22.0) & (z < 27.0) & (x < 35.0), band[0], band[1])
        # rivet rows along the box panels
        riv = side & (x < 16) & (np.mod(np.floor(x), 6) == 0) & ((np.abs(z - 14.0) < 0.5) | (np.abs(z - 45.0) < 0.5))
        base = np.where(riv, base - 0.8, base)
        for xs in (-2.0, -30.0):
            base = np.where(side & (np.abs(x - xs) < 0.4) & (z > 12) & (z < 47), base - 0.9, base)
        # gun ports: small dark squares with a lighter frame
        for gx in (-12.0, -40.0):
            gp = side & (np.abs(x - gx) < 1.6) & (np.abs(z - 33.0) < 1.6)
            gf = side & (np.abs(x - gx) < 2.6) & (np.abs(z - 33.0) < 2.6) & ~gp
            ramp, base = paint(ramp, base, gp, 'night', 1.0)
            base = np.where(gf, base + 0.6, base)
        # cab: small armored windows with thick frames, door seam and handle
        cab = (x > 16.6) & (x < 36.0)
        sw = side & cab & (z > 30.0) & (z < 38.0) & (x > 22.0) & (x < 32.0)
        ws = (n[:, 0] > 0.6) & (x > 34.0) & (x < 36.6) & (z > 30.0) & (z < 39.6) & (np.abs(y) < 15.0) & (np.abs(y) > 0.8)
        glass = sw | ws
        ramp = np.where(glass, RID['glass'], ramp)
        base = np.where(glass, glass_tone(x, y, z, 30.0, 40.0, lo=0.9, span=1.0), base); shine = np.where(glass, 1.0, shine)
        base = np.where(side & cab & (np.abs(x - 19.6) < 0.4) & (z > 12) & (z < 41), base - 1.0, base)
        base = np.where(side & (np.abs(x - 22.0) < 1.4) & (np.abs(z - 27.6) < 0.5), base + 1.2, base)
        # grille + headlights on the hood front, tail lights low on the box
        front, rear = n[:, 0] > 0.6, n[:, 0] < -0.6
        gr = front & (x > 54) & (np.abs(y) < 9.0) & (z > 13.0) & (z < 25.0)
        ramp = np.where(gr, RID['asph'], ramp); base = np.where(gr, 0.9 + (np.mod(np.floor(z), 2) == 0) * 0.8, base)
        hl = front & (x > 54) & (np.abs(y) > 10.2) & (np.abs(y) < 15.4) & (z > 18.0) & (z < 21.6)
        ramp, base = paint(ramp, base, hl, 'white', 4.4)
        tl = rear & (np.abs(y) > 13.0) & (np.abs(y) < 17.4) & (z > 14.0) & (z < 19.0)
        ramp, base = paint(ramp, base, tl, 'red', 2.9)
        shine = np.where(hl | tl, 0.9, shine)
        # rear doors: centre seam, hinge straps at the edges and a dark lock wheel (no gold: the cue is the game's)
        door = rear & (x < -55.0) & (z > 12.0)
        base = np.where(door & (np.abs(y) < 0.5), base - 1.2, base)
        base = np.where(door & (np.abs(np.abs(y) - 15.6) < 1.0) & ((np.abs(z - 18.0) < 1.2) | (np.abs(z - 40.0) < 1.2)), base - 0.8, base)
        rr = np.sqrt((y - 3.6) ** 2 + (z - 28.0) ** 2)
        wheel = door & (rr < 2.8) & ((rr > 1.6) | (np.abs(y - 3.6) < 0.4) | (np.abs(z - 28.0) < 0.4))
        ramp, base = paint(ramp, base, wheel, 'asph', 2.4)
        ramp, base = paint(ramp, base, rear & (np.abs(y) < 4.2) & (z > 7.4) & (z < 10.6), 'white', 3.9)
        top = n[:, 2] > 0.7
        base = np.where(top & (x < 16) & (np.abs(np.abs(y) - 13.0) < 0.5), base - 0.6, base)
        return ramp, base, shine

    mats = [body_mat, tire_mat(AX, WR), solid('night', 1.4), solid('asph', 2.2), solid('asph', 1.8)]
    return Model(parts, mats, (-60, 60, -21, 21, 0, 51))


# ---------------------------------------------------------------- police helicopter
HUB = (2.0, 0.0, 41.4)        # main rotor hub, local coordinates
BLADE = 50.0                  # main rotor radius


def helicopter(color=('navy', 1.9)):
    """A light police helicopter (docs/05, 4 and 5 stars): faceted cabin with a raked flat windshield, engine
    deck, tapered tail boom with fin and tail rotor, skids, and a searchlight under the nose. The main rotor is
    a separate animated sprite (rotor()) mounted at HUB, so the body is drawn without it."""
    cr, cb = color

    def parts(P):
        pod = rbox(P, (3.0, 0, 20.0), (21.0, 10.4, 11.0), 3.0)
        pod = np.maximum(pod, plane(P, (14.0, 0, 31.0), (0.9, 0, 0.8)))       # raked windshield
        pod = np.maximum(pod, plane(P, (23.0, 0, 11.0), (1.0, 0, -0.7)))      # chin
        pod = np.maximum(pod, plane(P, (-18.0, 0, 13.0), (-1.0, 0, -0.9)))    # tapered underside aft
        side = (np.abs(P[:, 1]) - (10.4 - 0.32 * np.maximum(P[:, 2] - 21.0, 0))) / 1.05
        pod = np.maximum(pod, side)                                          # tumblehome above the windows
        deck = rbox(P, (-5.0, 0, 33.0), (11.0, 6.4, 3.4), 1.4)
        boom = capsule(P, (-16.0, 0, 24.0), (-74.0, 0, 27.5), 4.0, 1.8)
        fin = rbox(P, (-75.0, 0, 32.0), (3.6, 0.7, 8.0), 0.3)
        fin = np.maximum(fin, plane(P, (-71.0, 0, 30.0), (1.0, 0, 0.5)))
        stab = rbox(P, (-63.0, 0, 26.6), (2.8, 9.0, 0.6), 0.2)
        body = np.minimum.reduce([pod, deck, boom, fin, stab])
        mast = np.minimum(cyl_z(P, (HUB[0], 0, 38.5), 1.4, 2.6), cyl_z(P, (HUB[0], 0, 41.0), 2.4, 0.8, 0.3))
        trot = np.minimum(rbox(P, (-75.5, -1.6, 34.0), (6.5, 0.25, 0.8)), rbox(P, (-75.5, -1.6, 34.0), (0.8, 0.25, 6.5)))
        skids = np.full(len(P), 1e3)
        for sy in (1, -1):
            skids = np.minimum.reduce([skids, capsule(P, (-14.0, sy * 11.5, 1.3), (19.0, sy * 11.5, 1.3), 1.1),
                                       capsule(P, (19.0, sy * 11.5, 1.3), (23.5, sy * 11.5, 4.0), 1.1),
                                       capsule(P, (12.0, sy * 11.5, 1.3), (10.0, sy * 8.0, 11.0), 0.9),
                                       capsule(P, (-8.0, sy * 11.5, 1.3), (-8.0, sy * 8.0, 11.0), 0.9)])
        light = np.minimum(cyl_x(P, (20.5, 5.0, 8.4), 1.9, 1.6, 0.4), rbox(P, (17.0, 5.0, 9.6), (2.0, 1.0, 1.4), 0.3))
        return [body, mast, trot, skids, light]

    def body_mat(p, n):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        N = len(p)
        ramp = np.full(N, RID[cr]); base = np.full(N, float(cb)); shine = np.full(N, 0.5)
        # white upper cabin and a white stripe down the boom
        upper = (z > 19.5) & (x > -18.0)
        ramp, base = paint(ramp, base, upper, 'white', 2.9)
        deck = (z > 30.2) & (np.abs(y) < 7.0) & (x > -16.5) & (x < 6.5)
        ramp, base = paint(ramp, base, deck, 'lavlt', 2.5)
        stripe = (x < -18.0) & (np.abs(z - (25.7 + (x + 18) * -0.06)) < 1.0) & (np.abs(n[:, 1]) > 0.5)
        ramp, base = paint(ramp, base, stripe, 'white', 3.1)
        # glass: the big raked windshield and chin bubble panes, two side windows per side with a door pillar
        ws = (n[:, 0] > 0.35) & (z > 12.5) & (z < 30.0) & (np.abs(y) < 9.4)
        sw = (np.abs(n[:, 1]) > 0.6) & (z > 20.4) & (z < 28.6) & (x > -9.0) & (x < 19.0 - (z - 20.4) * 0.6) & (np.abs(x - 5.0) > 1.0)
        glass = ws | sw
        ramp = np.where(glass, RID['glass'], ramp)
        base = np.where(glass, glass_tone(x, y, z, 12.0, 30.0, lo=1.3, span=1.4), base); shine = np.where(glass, 1.0, shine)
        # door seams, engine deck louvres, anti-collision beacon on the fin
        sd = np.abs(n[:, 1]) > 0.6
        base = np.where(sd & (np.abs(x + 9.8) < 0.4) & (z > 10) & (z < 30), base - 1.0, base)
        lv = (z > 30.0) & (np.abs(n[:, 1]) > 0.6) & (x > -14) & (x < 4) & (np.mod(np.floor(x), 3) == 0)
        base = np.where(lv, base - 0.9, base)
        ramp, base = paint(ramp, base, (z > 39.0) & (x < -70.0), 'red', 3.4)
        ramp, base = paint(ramp, base, (x < -60.0) & (x > -66.0) & (np.abs(n[:, 2]) > 0.6) & (np.abs(y) > 7.0), 'red', 3.0)
        # unit number block on the boom
        num = sd & (x < -30.0) & (x > -42.0) & (z > 22.0) & (z < 24.4) & (np.mod(np.floor(x), 3) != 0)
        ramp, base = paint(ramp, base, num, 'white', 3.4)
        return ramp, base, shine

    def light_mat(p, n):
        front = n[:, 0] > 0.6
        return (np.where(front, RID['white'], RID['asph']), np.where(front, 4.4, 1.8), np.where(front, 0.9, 0.2))

    mats = [body_mat, solid('asph', 2.0, 0.4), solid('asph', 1.6), solid('lavlt', 1.6, 0.4), light_mat]
    return Model(parts, mats, (-82, 28, -15, 15, 0, 44))


def rotor():
    """Main rotor, 4 blades in the hub plane. Rendered at four 22.5 degree steps: a full turn is 4 frames."""
    def parts(P):
        d = rbox(P, (0, 0, 0), (BLADE, 1.7, 0.35), 0.15)
        d = np.minimum(d, rbox(P, (0, 0, 0), (1.7, BLADE, 0.35), 0.15))
        return [d, cyl_z(P, (0, 0, 0.4), 2.6, 0.9, 0.3)]
    return Model(parts, [solid('asph', 2.2, 0.3), solid('lavlt', 2.0, 0.5)], (-BLADE - 1, BLADE + 1, -BLADE - 1, BLADE + 1, -1.5, 1.5))


VEHICLES2 = {
    'pickup_brick': lambda: pickup(('brick', 2.6)),
    'pickup_sage': lambda: pickup(('sage', 2.6)),
    'pickup_stone': lambda: pickup(('stone', 2.7)),
    'sports_red': lambda: sports(('red', 2.8)),
    'sports_navy': lambda: sports(('navy', 2.7)),
    'sports_white': lambda: sports(('white', 3.0)),
    'armored_suv': lambda: armored_suv(('night', 3.0)),
    'armored_suv_police': lambda: armored_suv(('navy', 1.6)),
    'log_truck': lambda: log_truck(('brick', 2.7)),
    'swat_van': lambda: swat_van(('navy', 1.5)),
    'armored_truck': lambda: armored_truck(('stone', 2.9), ('navy', 2.0)),
    'helicopter': lambda: helicopter(('navy', 1.9)),
}


# ---------------------------------------------------------------- ground shadow (airborne vehicles)
SHADOW = (42, 30, 52, 102)   # cool plum #2a1e34 at ~40% (STYLE_GUIDE)


def ground_shadow(model, ang, pad=3, step=0.5):
    """The model's footprint cast straight down, drawn as a flat iso ground decal. Anchor = local origin."""
    x0, x1, y0, y1, z0, z1 = model.bbox
    gx, gy = np.meshgrid(np.arange(x0, x1, step), np.arange(y0, y1, step))
    gx = gx.ravel(); gy = gy.ravel()
    hit = np.zeros(len(gx), bool)
    for z in np.arange(z0 + 0.5, z1, 1.0):
        P = np.stack([gx, gy, np.full(len(gx), z)], 1)
        hit |= model.dist(P) < 0
    gx, gy = gx[hit], gy[hit]
    ca, sa = np.cos(ang), np.sin(ang)
    wx = gx * ca - gy * sa; wy = gx * sa + gy * ca
    SX = wx - wy; SY = (wx + wy) / 2
    xmin, ymin = np.floor(SX.min()), np.floor(SY.min())
    W = int(np.ceil(SX.max() - xmin)) + 2 * pad; Hh = int(np.ceil(SY.max() - ymin)) + 2 * pad
    img = np.zeros((Hh, W, 4), np.uint8)
    px = (SX - xmin + pad).astype(int); py = (SY - ymin + pad).astype(int)
    img[py, px] = SHADOW
    return img, int(round(pad - xmin)), int(round(pad - ymin))


# ---------------------------------------------------------------- packing
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRAFTS = os.path.join(ROOT, 'drafts', 'vehicles2')


def _job(args):
    warnings.filterwarnings('ignore')
    kind, key, ai = args
    if kind == 'veh':
        return args, render(VEHICLES2[key](), ang=ai * np.pi / 4)
    if kind == 'rotor':
        return args, render(rotor(), ang=ai * np.pi / 8, shadows=False)
    if kind == 'shadow':
        return args, ground_shadow(helicopter(), ai * np.pi / 4)


def rotor_blur(img, ox, oy, alpha=46):
    """A faint dithered disc under the blades so the spinning rotor reads at speed."""
    Hh, W = img.shape[:2]
    yy, xx = np.mgrid[0:Hh, 0:W]
    rx, ry = BLADE * np.sqrt(2), BLADE * np.sqrt(2) / 2
    inside = ((xx - ox) / rx) ** 2 + ((yy - oy) / ry) ** 2 < 1.0
    inside &= ((xx + yy) % 2 == 0) & (img[..., 3] == 0)
    out = img.copy()
    out[inside] = (54, 44, 57, alpha)
    return out


def pack(results):
    """One row per sprite set. Rows get their own cell size (frames carry their own rects)."""
    from PIL import Image
    rows = []
    for key in VEHICLES2:
        rows.append((key, [(DIRS[a], *results[('veh', key, a)]) for a in range(8)]))
    rows.append(('helicopter_shadow', [(DIRS[a], *results[('shadow', 'helicopter', a)]) for a in range(8)]))
    rot = []
    for f in range(4):
        im, ox, oy = results[('rotor', 'rotor', f)]
        rot.append((f'f{f}', rotor_blur(im, ox, oy), ox, oy))
    rows.append(('helicopter_rotor', rot))
    cells = []
    for _, r in rows:
        cells.append((max(im.shape[1] for _, im, _, _ in r) + 2, max(im.shape[0] for _, im, _, _ in r) + 2))
    width = max(cw * len(r) for (cw, _), (_, r) in zip(cells, rows))
    height = sum(ch for _, ch in cells)
    sheet = np.zeros((height, width, 4), np.uint8)
    frames = {}
    y = 0
    for (cw, ch), (rl, r) in zip(cells, rows):
        for ci, (cl, im, ox, oy) in enumerate(r):
            h, w = im.shape[:2]
            fx = ci * cw + (cw - w) // 2
            fy = y + (ch - h) if rl != 'helicopter_rotor' else y + (ch - h) // 2
            sheet[fy:fy + h, fx:fx + w] = im
            frames[f'{rl}/{cl}'] = {'x': ci * cw, 'y': y, 'w': cw, 'h': ch, 'anchor': [fx - ci * cw + ox, fy - y + oy]}
        y += ch
    mounts = {}
    for a in range(8):
        ang = a * np.pi / 4
        wx = HUB[0] * np.cos(ang) - HUB[1] * np.sin(ang); wy = HUB[0] * np.sin(ang) + HUB[1] * np.cos(ang)
        mounts[DIRS[a]] = [int(round(wx - wy)), int(round((wx + wy) / 2 - HUB[2]))]
    meta = {
        'image': 'vehicles2.png',
        'cell': [max(c[0] for c in cells), max(c[1] for c in cells)],
        'note': ("anchor = pixel inside the cell that sits on the object's ground point (footprint centre). "
                 "Directions: " + ','.join(DIRS) + ". Rows have their own cell sizes; use each frame's rect. "
                 "helicopter: the body anchors on the ground point under it; when airborne draw "
                 "helicopter_shadow/<dir> at the ground point and the body (and rotor) lifted by the altitude in px. "
                 "helicopter_rotor/f0-f3: the spinning main rotor, any direction, ~20 fps, anchored at the hub; draw "
                 "it over the body at body anchor + mounts.helicopter_rotor[dir]."),
        'mounts': {'helicopter_rotor': mounts},
        'frames': frames,
    }
    Image.fromarray(sheet, 'RGBA').save(os.path.join(ROOT, 'vehicles2.png'))
    json.dump(meta, open(os.path.join(ROOT, 'vehicles2.json'), 'w'), indent=1)
    return sheet, meta


def flat(img, bg=(146, 141, 154)):
    a = img[..., 3:4] / 255.0
    out = np.zeros(img.shape[:2] + (3,), np.uint8)
    out[...] = bg
    return (img[..., :3] * a + out * (1 - a)).astype(np.uint8)


def previews(sheet, meta, results):
    """Contact sheet at 2x, plus a scale line-up next to the existing sedan, van and a person."""
    from PIL import Image
    os.makedirs(DRAFTS, exist_ok=True)
    Image.fromarray(flat(sheet)).resize((sheet.shape[1] * 2, sheet.shape[0] * 2), Image.NEAREST).save(
        os.path.join(DRAFTS, 'vehicles2_sheet.png'))
    # line-up: existing sedan + van + a person from the art pack, then each new vehicle facing SE (and W)
    old = Image.open(os.path.join(ROOT, 'vehicles.png')).convert('RGBA')
    oj = json.load(open(os.path.join(ROOT, 'vehicles.json')))
    ch = Image.open(os.path.join(ROOT, 'characters.png')).convert('RGBA')
    cj = json.load(open(os.path.join(ROOT, 'characters.json')))

    def crop(img, f):
        return np.array(img.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h']))), f['anchor'][0], f['anchor'][1]

    pkey = next(k for k in cj['frames'] if k.endswith('/idle/SE'))
    for d in ('SE', 'W'):
        items = [crop(ch, cj['frames'][pkey]), crop(old, oj['frames']['sedan_clay/' + d]), crop(old, oj['frames']['van_white/' + d])]
        for key in ['pickup_brick', 'sports_red', 'armored_suv', 'swat_van', 'armored_truck', 'log_truck']:
            items.append(results[('veh', key, DIRS.index(d))])
        gap = 8
        W = sum(im.shape[1] for im, _, _ in items) + gap * (len(items) + 1)
        top = max(oy for _, _, oy in items); bot = max(im.shape[0] - oy for im, _, oy in items)
        canvas = np.zeros((top + bot + 2 * gap, W, 4), np.uint8)
        x = gap
        for im, ox, oy in items:
            y = gap + top - oy
            m = im[..., 3] > 0
            canvas[y:y + im.shape[0], x:x + im.shape[1]][m] = im[m]
            x += im.shape[1] + gap
        Image.fromarray(flat(canvas)).resize((canvas.shape[1] * 2, canvas.shape[0] * 2), Image.NEAREST).save(
            os.path.join(DRAFTS, f'vehicles2_lineup_{d}.png'))
    # the helicopter airborne: shadow on the ground, body lifted 48 px, rotor frame 1 on top, at 3x
    canvas = np.zeros((200, 260, 4), np.uint8)
    gx, gy = 150, 150

    def blit(im, ox, oy, ax, ay):
        h, w = im.shape[:2]
        y0, x0 = ay - oy, ax - ox
        a = im[..., 3:4] / 255.0
        reg = canvas[y0:y0 + h, x0:x0 + w].astype(float)
        reg[..., :3] = im[..., :3] * a + reg[..., :3] * (1 - a)
        reg[..., 3] = np.maximum(reg[..., 3], im[..., 3])
        canvas[y0:y0 + h, x0:x0 + w] = reg.astype(np.uint8)

    blit(*results[('shadow', 'helicopter', 0)], gx, gy)
    blit(*results[('veh', 'helicopter', 0)], gx, gy - 48)
    im, ox, oy = results[('rotor', 'rotor', 1)]
    mx, my = meta['mounts']['helicopter_rotor']['SE']
    blit(rotor_blur(im, ox, oy), ox, oy, gx + mx, gy - 48 + my)
    Image.fromarray(flat(canvas)).resize((260 * 3, 200 * 3), Image.NEAREST).save(os.path.join(DRAFTS, 'helicopter_airborne_3x.png'))


if __name__ == '__main__':
    from multiprocessing import Pool
    only = sys.argv[1:]
    jobs = [('veh', k, a) for k in VEHICLES2 for a in range(8) if not only or k in only]
    if not only:
        jobs += [('rotor', 'rotor', f) for f in range(4)] + [('shadow', 'helicopter', a) for a in range(8)]
    results = {}
    with Pool(os.cpu_count() or 2) as p:
        for args, res in p.imap_unordered(_job, jobs):
            results[args] = res
    if only:
        from PIL import Image
        os.makedirs(DRAFTS, exist_ok=True)
        for k in only:
            row = [results[('veh', k, a)][0] for a in range(8)]
            hh = max(r.shape[0] for r in row); ww = sum(r.shape[1] + 4 for r in row)
            c = np.zeros((hh, ww, 4), np.uint8); x = 0
            for r in row:
                c[hh - r.shape[0]:, x:x + r.shape[1]] = r; x += r.shape[1] + 4
            Image.fromarray(flat(c)).resize((ww * 3, hh * 3), Image.NEAREST).save(os.path.join(DRAFTS, f'_wip_{k}.png'))
        print('wip done')
    else:
        sheet, meta = pack(results)
        previews(sheet, meta, results)
        print('packed', sheet.shape)

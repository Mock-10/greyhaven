"""Buildings and props for the Phase 2 map growth (2026-10-11): the house row on Hedgerow Way with the Swiftish
Couriers depot, the Torque & Sons garage block with the shops and the used-car lot, and the woods with Ashby Timber.

Buildings follow infill.py's rules: model units at BLD_SCALE 2.6, one storey is 12 units, the front is local +y, every
face dressed (buildings across a street show their backs), `lit` lights some windows for the `_night` variant.
Props are in world units at scale 1 like street.py (a person is 40 units tall), front +y.

  house_sage, house_cream, house_blue, house_clay   one-storey gable houses with a porch and a chimney
  courier_depot   Swiftish Couriers: a low depot with two roller doors, a loading apron and an office door
  garage_torque   Torque & Sons Garage: two service bays (one open, a lift inside), an office corner
  dealer_office   a glass sales cabin with a USED CARS board on the roof
  site_trailer    Ashby Timber's site trailer: a portacabin on blocks with steps
  car_wash        Squeaky's Car Wash: a wash hall with a drive-through tunnel, roller brushes and a pay office

  props: mailbox, stump, log, log_pile, birch, fir, fern, rock, tyre_stack, pennants; segment: picket
"""
import numpy as np
from sdf import rbox, cyl_z, capsule, ell, smin, solid, RID, hash3, Model
from env import sign_text, _grid, _glass
from props2 import lump
from infill import _faces, _wall_texture, FH


def _siding(u, z, ramp, base, seed):
    """Horizontal clapboards: a dark lap line every 1.4 units, slight variation board to board."""
    N = len(u)
    board = np.floor(z / 1.4)
    h = hash3(np.floor(u / 9.0), board, 3, seed)
    return np.full(N, RID[ramp]), base + (h - 0.5) * 0.3 - (np.mod(z, 1.4) < 0.35) * 0.55


def _window(mask, z, z0, h, lit_mask, r, t, shine):
    """Fill a window: glass shading down the pane, or warm gold when lit."""
    r = np.where(mask, np.where(lit_mask, RID['gold'], RID['glass']), r)
    t = np.where(mask, np.where(lit_mask, 2.9, 1.3 + (z - z0) / h * 1.2), t)
    return r, t, np.where(mask, 0.9, shine)


# ------------------------------------------------------------------ houses
HOUSE_SCHEMES = {
    'sage': ('sage', 2.9, 'night', 2.0, 'white'),
    'cream': ('white', 3.2, 'plum', 1.9, 'navy'),
    'blue': ('blueg', 2.9, 'brick', 2.1, 'white'),
    'clay': ('clay', 2.8, 'lav', 1.9, 'white'),
}


def house(scheme='sage', lit=0.0, seed=1):
    """A one-storey suburban house, 2.7 x 1.8 tiles: siding, a gable roof along x, a front porch with two posts and
    steps, a chimney, a door with a gold handle and windows on every side."""
    wall, wt, roof, rt, trim = HOUSE_SCHEMES[scheme]
    hx, hy, E, RISE = 17.0, 11.0, 11.0, 8.5
    S = RISE / hy

    def ridge(y):
        return E + RISE - S * np.abs(y)

    def parts(P):
        x, y, z = P[:, 0], P[:, 1], P[:, 2]
        box = rbox(P, (0, 0, (E + RISE) / 2), (hx, hy, (E + RISE) / 2), 0.4)
        body = np.maximum(box, (z - ridge(y)) / np.sqrt(1 + S * S))
        slab = (np.abs(z - (ridge(y) + 0.9)) - 0.7) / np.sqrt(1 + S * S)
        roofd = np.maximum(slab, np.maximum(np.abs(x) - (hx + 1.6), np.abs(y) - (hy + 1.8)))
        chim = rbox(P, (hx * 0.45, -hy * 0.35, E + RISE), (1.8, 1.8, 5.5), 0.3)
        porch = rbox(P, (-hx * 0.3, hy + 3.2, 0.9), (6.5, 3.2, 0.9), 0.3)
        steps = rbox(P, (-hx * 0.3, hy + 7.0, 0.45), (3.0, 1.0, 0.45), 0.2)
        posts = np.minimum(rbox(P, (-hx * 0.3 - 5.6, hy + 5.6, 4.8), (0.45, 0.45, 4.4), 0.15),
                           rbox(P, (-hx * 0.3 + 5.6, hy + 5.6, 4.8), (0.45, 0.45, 4.4), 0.15))
        Q = P.copy(); Q[:, 2] = P[:, 2] + 0.25 * (P[:, 1] - hy)
        proof = rbox(Q, (-hx * 0.3, hy + 3.4, 10.8), (7.4, 3.8, 0.5), 0.3)
        base = rbox(P, (0, 0, 0.7), (hx + 0.4, hy + 0.4, 0.7), 0.2)
        return [body, roofd, chim, porch, steps, posts, proof, base]

    def wall_m(p, n):
        front, right, back, left = _faces(n)
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        u = np.where(front | back, x, y)
        r, t = _siding(u, z, wall, wt, seed)
        shine = np.zeros(len(p))
        # windows: front two right of the door, back three, a gable window at each end
        wins = np.zeros(len(p), bool)
        for c in (hx * 0.18, hx * 0.62):
            wins |= front & (np.abs(x - c) < 2.4) & (z > 3.6) & (z < 8.6)
        for c in (-hx * 0.6, 0.0, hx * 0.6):
            wins |= back & (np.abs(x - c) < 2.2) & (z > 3.6) & (z < 8.6)
        for c in (-hy * 0.35, hy * 0.35):
            wins |= (left | right) & (np.abs(y - c) < 2.0) & (z > 3.6) & (z < 8.6)
        wins |= (left | right) & (np.abs(y) < 1.6) & (z > 12.0) & (z < 15.0)
        frame = np.zeros(len(p), bool)
        for c in (hx * 0.18, hx * 0.62):
            frame |= front & (np.abs(x - c) < 3.0) & (z > 3.0) & (z < 9.2)
        for c in (-hx * 0.6, 0.0, hx * 0.6):
            frame |= back & (np.abs(x - c) < 2.8) & (z > 3.0) & (z < 9.2)
        for c in (-hy * 0.35, hy * 0.35):
            frame |= (left | right) & (np.abs(y - c) < 2.6) & (z > 3.0) & (z < 9.2)
        frame &= ~wins
        r = np.where(frame, RID[trim], r); t = np.where(frame, 3.5, t)
        lit_w = hash3(np.floor(u / 4.0), np.floor(z / 6.0), 5, seed + 9) < lit
        r, t, shine = _window(wins, z, 3.6, 5.0, lit_w, r, t, shine)
        bar = wins & (np.abs(np.mod(u + 40, 4.8 if True else 1) - 2.4) < 0.2)
        r = np.where(bar & ~lit_w, RID[trim], r); t = np.where(bar & ~lit_w, 3.5, t)
        # the front door under the porch, with a gold handle; a back door
        door = front & (np.abs(x + hx * 0.3) < 2.0) & (z > 1.4) & (z < 9.0)
        r = np.where(door, RID['wood'] if scheme != 'cream' else RID['navy'], r); t = np.where(door, 1.9 + (np.abs(x + hx * 0.3) > 1.6) * 0.5, t)
        knob = front & (np.abs(x + hx * 0.3 - 1.2) < 0.4) & (np.abs(z - 5.0) < 0.5)
        r = np.where(knob, RID['gold'], r); t = np.where(knob, 4.0, t)
        num = front & sign_text(x, z, str(seed % 9 + 1), -hx * 0.3 + 3.6, 7.6, px=0.55)
        r = np.where(num, RID['night'], r); t = np.where(num, 1.6, t)
        bdoor = back & (np.abs(x - hx * 0.3) < 1.9) & (z > 1.4) & (z < 8.8)
        r = np.where(bdoor, RID['wood'], r); t = np.where(bdoor, 1.8, t)
        # corner boards
        corner = (np.abs(np.abs(u) - np.where(front | back, hx, hy)) < 0.8) & (n[:, 2] < 0.5)
        r = np.where(corner & ~wins, RID[trim], r); t = np.where(corner & ~wins, 3.4, t)
        t = np.where(z < 1.6, t - 0.4, t)
        return r, t, shine

    def roof_m(p, n):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        row = np.floor((ridge(y) - z + np.abs(y) * S) / 1.1 + np.abs(y) * 0.9)
        sh = hash3(np.floor(x / 2.0 + (row % 2) * 0.5), row, 2, seed)
        t = rt + (sh - 0.5) * 0.7 - (np.mod(np.abs(y) * 0.9, 1.1) < 0.3) * 0.45
        ridgecap = np.abs(y) < 1.0
        t = np.where(ridgecap, t + 0.6, t)
        under = n[:, 2] < -0.3
        return np.full(len(p), RID[roof]), np.where(under, 1.2, t), np.zeros(len(p))

    def chim_m(p, n):
        z = p[:, 2]
        b = hash3(np.floor(p[:, 0] / 1.6), np.floor(z / 1.0), 4, seed)
        return np.full(len(p), RID['brick']), 2.1 + (b - 0.5) * 0.8 - (np.mod(z, 1.0) < 0.28) * 0.5, np.zeros(len(p))

    mats = [wall_m, roof_m, chim_m, solid('stone', 2.6), solid('stone', 2.9), solid(trim, 3.4), roof_m, solid('stone', 1.9)]
    return Model(parts, mats, (-hx - 3, hx + 3, -hy - 3, hy + 9, 0, E + RISE + 7))


# ------------------------------------------------------------------ the depot
def courier_depot(lit=0.0):
    """Swiftish Couriers: a long low depot, sage-render walls, two ribbed roller doors over a raised loading apron, a
    glass office door, a navy sign band and high windows along the sides."""
    hx, hy, H = 28.0, 16.0, 16.0

    def parts(P):
        body = rbox(P, (0, 0, H / 2), (hx, hy, H / 2), 0.5)
        parapet = rbox(P, (0, 0, H + 0.8), (hx + 0.5, hy + 0.5, 0.8), 0.3)
        band = rbox(P, (0, hy + 0.5, H - 2.6), (hx - 1.0, 0.7, 1.9), 0.3)
        apron = rbox(P, (-6.0, hy + 3.0, 0.8), (17.0, 3.0, 0.8), 0.3)
        bumpers = np.minimum.reduce([rbox(P, (cx, hy + 6.1, 1.4), (0.8, 0.3, 0.9), 0.2) for cx in (-20.0, -12.5, -4.0, 3.5)])
        units = np.minimum(rbox(P, (-12, -6, H + 2.4), (4.0, 3.0, 1.6), 0.6), rbox(P, (14, 4, H + 2.0), (2.8, 2.8, 1.2), 0.5))
        return [body, parapet, band, apron, bumpers, units]

    def body_m(p, n):
        front, right, back, left = _faces(n)
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        u = np.where(front | back, x, y)
        r, t = _wall_texture('render_sage', u, z, 21)
        shine = np.zeros(len(p))
        # two roller doors with ribs
        rd = front & ((np.abs(x + 16.0) < 6.0) | (np.abs(x - 0.0) < 6.0)) & (z < 11.0)
        r = np.where(rd, RID['lavlt'], r); t = np.where(rd, 2.2 + (np.mod(z, 1.2) < 0.5) * 0.7, t)
        rf = front & ((np.abs(np.abs(x + 16.0) - 6.4) < 0.5) | (np.abs(np.abs(x) - 6.4) < 0.5)) & (z < 11.6)
        r = np.where(rf, RID['night'], r); t = np.where(rf, 1.8, t)
        # office door and a window beside it
        od = front & (np.abs(x - 15.0) < 2.4) & (z < 9.0)
        r, t, shine = _window(od, z, 0.0, 9.0, np.full(len(p), lit > 0), r, t, shine)
        ow = front & (np.abs(x - 22.0) < 3.4) & (z > 3.6) & (z < 9.0)
        r, t, shine = _window(ow, z, 3.6, 5.4, np.full(len(p), lit > 0), r, t, shine)
        knob = front & (np.abs(x - 13.4) < 0.4) & (np.abs(z - 4.8) < 0.5)
        r = np.where(knob, RID['gold'], r); t = np.where(knob, 4.0, t)
        # high windows along the sides and back
        hw = (right | left | back) & (np.abs(np.mod(u + 40, 8.0) - 4.0) < 2.6) & (z > 10.0) & (z < 13.0) & (np.abs(u) < np.where(back, hx, hy) - 2)
        r, t, shine = _window(hw, z, 10.0, 3.0, hash3(np.floor((u + 40) / 8.0), 1, 1, 5) < lit * 0.6, r, t, shine)
        sd = right & (np.abs(y + 6.0) < 2.2) & (z < 9.0)
        r = np.where(sd, RID['teal'], r); t = np.where(sd, 1.8, t)
        t = np.where(z < 1.8, t - 0.4, t)
        return r, t, shine

    def band_m(p, n):
        f = n[:, 1] > 0.5
        txt = f & sign_text(p[:, 0], p[:, 2], 'SWIFTISH COURIERS', -1.0, H - 2.6)
        arrow = f & (np.abs(p[:, 2] - (H - 2.6)) < 1.0 - np.abs(p[:, 0] - 22.0) * 0.6) & (p[:, 0] > 20.5)
        return np.where(txt | arrow, RID['white'], RID['navy']), np.where(txt | arrow, 4.4, 1.6), np.zeros(len(p))

    mats = [body_m, solid('stone', 2.9), band_m, solid('stone', 2.4), solid('night', 1.6), solid('lavlt', 2.8, 0.4)]
    return Model(parts, mats, (-hx - 2, hx + 2, -hy - 2, hy + 8, 0, H + 6))


# ------------------------------------------------------------------ the garage
def garage_torque(lit=0.0):
    """Torque & Sons Garage: a brick workshop with two service bays (the left one open, a car lift and a lamp inside),
    an office corner with big windows, a red sign board and a stack of tyres by the wall."""
    hx, hy, H = 26.0, 16.0, 17.0

    def parts(P):
        body = rbox(P, (0, 0, H / 2), (hx, hy, H / 2), 0.5)
        Q = P.copy(); Q[:, 2] = P[:, 2] - 0.2 * (hy - np.abs(P[:, 1]))
        roof = rbox(Q, (0, 0, H + 0.6), (hx + 0.8, hy + 0.8, 0.6), 0.3)
        board = rbox(P, (-4.0, hy + 0.6, H - 2.4), (17.0, 0.7, 2.0), 0.3)
        # the open bay: a dark recess with a two-post lift inside
        recess = rbox(P, (-15.0, hy - 4.0, 5.6), (5.8, 4.6, 5.6), 0.2)
        lift = np.minimum(rbox(P, (-19.0, hy - 6.0, 5.0), (0.7, 0.7, 5.0), 0.2), rbox(P, (-11.0, hy - 6.0, 5.0), (0.7, 0.7, 5.0), 0.2))
        arms = rbox(P, (-15.0, hy - 6.0, 3.4), (4.6, 0.5, 0.35), 0.15)
        tyres = np.minimum.reduce([cyl_z(P, (hx + 2.2, hy - 3.0 - 4.6 * k, 0.9 + 1.7 * j), 1.9, 0.75, 0.6) for k in range(2) for j in range(3 - k)])
        return [np.maximum(body, -recess), roof, board, lift, arms, tyres]

    def body_m(p, n):
        front, right, back, left = _faces(n)
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        u = np.where(front | back, x, y)
        r, t = _wall_texture('redbrick', u, z, 17)
        shine = np.zeros(len(p))
        inside = (np.abs(x + 15.0) < 5.9) & (y < hy - 0.2) & (z < 11.3)
        r = np.where(inside, RID['night'], r); t = np.where(inside, 1.0 + (z > 10.0) * 2.0 * (lit > 0), t)
        floor = inside & (n[:, 2] > 0.5)
        r = np.where(floor, RID['asph'], r); t = np.where(floor, 1.6, t)
        rd = front & (np.abs(x - 0.0) < 6.0) & (z < 11.0)
        r = np.where(rd, RID['blueg'], r); t = np.where(rd, 2.0 + (np.mod(z, 1.2) < 0.5) * 0.7, t)
        frame = front & ((np.abs(np.abs(x + 15.0) - 6.2) < 0.6) | (np.abs(np.abs(x) - 6.4) < 0.5)) & (z < 11.8)
        r = np.where(frame, RID['night'], r); t = np.where(frame, 1.8, t)
        # office corner: big windows on the front and the right side, a door
        ow = (front & (x > 9.0) & (x < hx - 1.5) & (z > 3.4) & (z < 10.0) & ~(np.abs(x - 12.0) < 2.2)) | \
             (right & (y > 2.0) & (y < hy - 2.0) & (z > 3.4) & (z < 10.0))
        r, t, shine = _window(ow, z, 3.4, 6.6, np.full(len(p), lit > 0), r, t, shine)
        od = front & (np.abs(x - 12.0) < 2.0) & (z < 9.4)
        r = np.where(od, RID['teal'], r); t = np.where(od, 1.8, t)
        knob = front & (np.abs(x - 10.6) < 0.4) & (np.abs(z - 4.8) < 0.5)
        r = np.where(knob, RID['gold'], r); t = np.where(knob, 4.0, t)
        hw = (back | left) & (np.abs(np.mod(u + 40, 9.0) - 4.5) < 2.6) & (z > 9.0) & (z < 13.0) & (np.abs(u) < np.where(back, hx, hy) - 2)
        r, t, shine = _window(hw, z, 9.0, 4.0, hash3(np.floor((u + 40) / 9.0), 2, 1, 7) < lit * 0.5, r, t, shine)
        t = np.where(z < 1.8, t - 0.4, t)
        return r, t, shine

    def board_m(p, n):
        f = n[:, 1] > 0.5
        txt = f & sign_text(p[:, 0], p[:, 2], 'TORQUE & SONS GARAGE', -4.0, H - 2.4)
        return np.where(txt, RID['white'], RID['red']), np.where(txt, 4.4, 2.0), np.zeros(len(p))

    def lift_m(p, n):
        return np.full(len(p), RID['red']), np.full(len(p), 2.6 if lit > 0 else 2.0), np.full(len(p), 0.4)

    def tyre_m(p, n):
        side = np.abs(n[:, 2]) < 0.6
        return np.full(len(p), RID['night']), np.where(side, 1.6, 2.4), np.zeros(len(p))

    mats = [body_m, solid('lav', 2.0), board_m, lift_m, lift_m, tyre_m]
    return Model(parts, mats, (-hx - 2, hx + 6, -hy - 2, hy + 4, 0, H + 6))


# ------------------------------------------------------------------ the used-car lot's cabin
def dealer_office(lit=0.0):
    """A small sales cabin: glass on three sides, a flat roof and a USED CARS board on two posts above it."""
    hx, hy, H = 12.0, 9.0, 11.0

    def parts(P):
        body = rbox(P, (0, 0, H / 2), (hx, hy, H / 2), 0.4)
        roof = rbox(P, (0, 0, H + 0.6), (hx + 1.4, hy + 1.4, 0.6), 0.3)
        posts = np.minimum(capsule(P, (-7, 0, H), (-7, 0, H + 4.5), 0.45), capsule(P, (7, 0, H), (7, 0, H + 4.5), 0.45))
        board = rbox(P, (0, 0, H + 7.0), (11.5, 0.7, 2.6), 0.3)
        step = rbox(P, (4.0, hy + 1.2, 0.4), (3.0, 1.2, 0.4), 0.2)
        return [body, roof, posts, board, step]

    def body_m(p, n):
        front, right, back, left = _faces(n)
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        u = np.where(front | back, x, y)
        r = np.full(len(p), RID['white']); t = np.full(len(p), 3.2)
        shine = np.zeros(len(p))
        glass = (front | left | right) & (z > 2.4) & (z < 9.6) & (np.abs(u) < np.where(front, hx, hy) - 1.2)
        r, t, shine = _window(glass, z, 2.4, 7.2, np.full(len(p), lit > 0), r, t, shine)
        mull = glass & (np.abs(np.mod(u + 40, 6.0) - 3.0) < 0.25)
        r = np.where(mull, RID['night'], r); t = np.where(mull, 1.8, t)
        door = front & (np.abs(x - 4.0) < 2.2) & (z < 9.6)
        r = np.where(door & ~glass, RID['night'], r)
        knob = front & (np.abs(x - 2.6) < 0.35) & (np.abs(z - 4.8) < 0.5)
        r = np.where(knob, RID['gold'], r); t = np.where(knob, 4.0, t)
        stripe = (z < 2.4) & (z > 1.2)
        r = np.where(stripe, RID['red'], r); t = np.where(stripe, 2.4, t)
        return r, t, shine

    def board_m(p, n):
        f = np.abs(n[:, 1]) > 0.5
        u = np.where(n[:, 1] > 0, p[:, 0], -p[:, 0])
        txt = f & sign_text(u, p[:, 2], 'USED CARS', 0.0, H + 7.0, scale=1)
        return np.where(txt, RID['red'], RID['white']), np.where(txt, 2.4, 3.6), np.zeros(len(p))

    mats = [body_m, solid('night', 2.0), solid('lavlt', 2.6), board_m, solid('stone', 2.6)]
    return Model(parts, mats, (-hx - 3, hx + 3, -hy - 3, hy + 4, 0, H + 11))


# ------------------------------------------------------------------ the site trailer
def site_trailer(lit=0.0):
    """Ashby Timber's site office: a khaki portacabin raised on blocks, ribbed walls, two windows, a door with steps
    and a sign board."""
    hx, hy, H0, H = 15.0, 6.0, 2.2, 11.0

    def parts(P):
        body = rbox(P, (0, 0, (H0 + H) / 2), (hx, hy, (H - H0) / 2), 0.5)
        blocks = np.minimum.reduce([rbox(P, (bx, by, H0 / 2), (1.2, 1.2, H0 / 2), 0.2) for bx in (-12, 0, 12) for by in (-4, 4)])
        steps = np.minimum(rbox(P, (4.0, hy + 1.6, 0.8), (2.6, 1.6, 0.8), 0.2), rbox(P, (4.0, hy + 0.8, 1.9), (2.6, 0.8, 0.5), 0.2))
        rail = capsule(P, (6.8, hy + 3.2, 0), (6.8, hy + 0.2, 4.6), 0.3)
        board = rbox(P, (-6.0, hy + 0.5, H - 2.2), (7.6, 0.5, 1.5), 0.2)
        return [body, blocks, steps, rail, board]

    def body_m(p, n):
        front, right, back, left = _faces(n)
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        u = np.where(front | back, x, y)
        r = np.full(len(p), RID['khaki']); t = 2.6 + (np.mod(u, 1.6) < 0.5) * -0.5
        top = n[:, 2] > 0.5
        t = np.where(top, 2.9, t)
        shine = np.zeros(len(p))
        w = (front | back) & ((np.abs(x + 6.0) < 3.0) | (np.abs(x - 11.0) < 2.2)) & (z > 4.6) & (z < 8.6)
        r, t, shine = _window(w, z, 4.6, 4.0, np.full(len(p), lit > 0), r, t, shine)
        d = front & (np.abs(x - 4.0) < 1.8) & (z > H0) & (z < 9.4)
        r = np.where(d, RID['wood'], r); t = np.where(d, 1.8, t)
        knob = front & (np.abs(x - 2.8) < 0.35) & (np.abs(z - 5.8) < 0.5)
        r = np.where(knob, RID['gold'], r); t = np.where(knob, 4.0, t)
        dirt = (z < H0 + 1.4)
        t = np.where(dirt, t - 0.5, t)
        return r, t, shine

    def board_m(p, n):
        f = n[:, 1] > 0.5
        txt = f & sign_text(p[:, 0], p[:, 2], 'ASHBY TIMBER', -6.0, H - 2.2)
        return np.where(txt, RID['white'], RID['sage']), np.where(txt, 4.2, 1.8), np.zeros(len(p))

    mats = [body_m, solid('stone', 1.9), solid('stone', 2.4), solid('night', 2.0), board_m]
    return Model(parts, mats, (-hx - 2, hx + 2, -hy - 2, hy + 5, 0, H + 3))


# ------------------------------------------------------------------ the car wash (milestone 8)
def car_wash(lit=0.0):
    """Squeaky's Car Wash: a white wash hall with a drive-through tunnel on the left (two roller brushes and a
    spray arch inside, open front and back), a pay office on the right, a teal wave stripe, a sign board and three
    soap bubbles on the roof."""
    hx, hy, H = 26.0, 14.0, 14.0
    TX0, TX1 = -22.0, -4.0          # the tunnel's sides (x)

    def parts(P):
        body = rbox(P, (0, 0, H / 2), (hx, hy, H / 2), 0.5)
        tunnel = rbox(P, ((TX0 + TX1) / 2, 0, 5.4), ((TX1 - TX0) / 2, hy + 2, 5.4), 0.2)
        parapet = rbox(P, (0, 0, H + 0.7), (hx + 0.5, hy + 0.5, 0.7), 0.3)
        board = rbox(P, (-1.0, hy + 0.6, H - 2.0), (14.6, 0.7, 1.7), 0.3)
        brushes = np.minimum(cyl_z(P, (TX0 + 3.0, 4.0, 5.2), 2.2, 4.4, 0.6), cyl_z(P, (TX1 - 3.0, 4.0, 5.2), 2.2, 4.4, 0.6))
        arch = np.minimum.reduce([rbox(P, (TX0 + 0.8, -5.0, 5.0), (0.5, 0.5, 5.0), 0.2),
                                  rbox(P, (TX1 - 0.8, -5.0, 5.0), (0.5, 0.5, 5.0), 0.2),
                                  rbox(P, ((TX0 + TX1) / 2, -5.0, 9.6), ((TX1 - TX0) / 2 - 0.5, 0.5, 0.5), 0.2)])
        bubbles = np.minimum.reduce([ell(P, (8.0, -2.0, H + 4.0), (3.2, 3.2, 3.2)),
                                     ell(P, (13.0, 2.0, H + 2.6), (2.2, 2.2, 2.2)),
                                     ell(P, (4.6, 3.0, H + 2.2), (1.6, 1.6, 1.6))])
        return [np.maximum(body, -tunnel), parapet, board, brushes, arch, bubbles]

    def body_m(p, n):
        front, right, back, left = _faces(n)
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        u = np.where(front | back, x, y)
        r = np.full(len(p), RID['white']); t = 3.1 + (hash3(np.floor(u / 3), np.floor(z / 3), 3, 23) - 0.5) * 0.3
        shine = np.zeros(len(p))
        # the wave stripe: teal, its top edge rippling
        wave = (z > 1.6) & (z < 3.6 + 0.7 * np.sin(u * 0.55))
        r = np.where(wave, RID['teal'], r); t = np.where(wave, 2.6, t)
        # the tunnel: dark, wet tiled walls, a wet floor
        inside = (x > TX0 - 0.1) & (x < TX1 + 0.1) & (np.abs(y) < hy + 0.5) & (z < 10.9)
        r = np.where(inside, RID['blueg'], r)
        t = np.where(inside, 1.4 + (np.mod(z, 1.5) < 0.25) * -0.4 + (lit > 0) * 0.8, t)
        floor = inside & (n[:, 2] > 0.5)
        r = np.where(floor, RID['asph'], r); t = np.where(floor, 1.5 + (np.mod(x, 3.0) < 0.6) * 0.5, t)
        shine = np.where(floor, 0.6, shine)
        frame = (front | back) & (np.abs(np.abs(x - (TX0 + TX1) / 2) - (TX1 - TX0) / 2 - 0.4) < 0.6) & (z < 11.5)
        r = np.where(frame, RID['navy'], r); t = np.where(frame, 1.8, t)
        # yellow-and-night clearance bar over the tunnel mouth would be gold; gold is reserved, so use stripes of red
        bar = front & (x > TX0) & (x < TX1) & (np.abs(z - 11.4) < 0.5)
        r = np.where(bar, np.where(np.mod(x, 2.4) < 1.2, RID['red'], RID['white']), r); t = np.where(bar, 2.6, t)
        # the pay office: a window and a door with a gold handle (it's an entrance), windows down the right side
        ow = front & (x > 2.0) & (x < 13.0) & (z > 4.0) & (z < 9.6)
        r, t, shine = _window(ow, z, 4.0, 5.6, np.full(len(p), lit > 0), r, t, shine)
        od = front & (np.abs(x - 18.0) < 2.2) & (z < 9.4)
        r = np.where(od, RID['teal'], r); t = np.where(od, 1.8, t)
        knob = front & (np.abs(x - 16.4) < 0.4) & (np.abs(z - 4.8) < 0.5)
        r = np.where(knob, RID['gold'], r); t = np.where(knob, 4.0, t)
        sw = right & (np.abs(np.mod(y + 40, 9.0) - 4.5) < 2.4) & (z > 4.6) & (z < 9.4) & (np.abs(y) < hy - 2)
        r, t, shine = _window(sw, z, 4.6, 4.8, hash3(np.floor((y + 40) / 9.0), 3, 1, 9) < lit * 0.7, r, t, shine)
        hw = (back | left) & ~inside & (np.abs(np.mod(u + 40, 8.0) - 4.0) < 2.2) & (z > 6.0) & (z < 9.0) & (np.abs(u) < np.where(back, hx, hy) - 2)
        r, t, shine = _window(hw, z, 6.0, 3.0, np.zeros(len(p), bool), r, t, shine)
        t = np.where(z < 1.4, t - 0.5, t)
        return r, t, shine

    def board_m(p, n):
        f = n[:, 1] > 0.5
        txt = f & sign_text(p[:, 0], p[:, 2], "SQUEAKY'S CAR WASH", -1.0, H - 2.0)
        return np.where(txt, RID['white'], RID['teal']), np.where(txt, 4.4, 1.7 + (lit > 0) * 0.6), np.zeros(len(p))

    def brush_m(p, n):
        a = np.arctan2(p[:, 1] - 4.0, p[:, 0] - np.where(p[:, 0] < -13.0, TX0 + 3.0, TX1 - 3.0))
        strand = np.mod(a * 5.0 + p[:, 2] * 0.3, 1.0) < 0.45
        return np.full(len(p), RID['blueg']), np.where(strand, 3.0, 2.2), np.zeros(len(p))

    def bubble_m(p, n):
        hi = (n[:, 2] > 0.55) & (n[:, 0] < -0.1)
        return np.full(len(p), RID['glass']), np.where(hi, 4.4, 3.0), np.full(len(p), 0.9)

    mats = [body_m, solid('lav', 2.0), board_m, brush_m, solid('stone', 2.2), bubble_m]
    return Model(parts, mats, (-hx - 2, hx + 2, -hy - 4, hy + 4, 0, H + 9))


# name: (factory(lit), footprint half extents in model units (hx, hy), height in model units)
SPECS = {
    'house_sage': (lambda lit: house('sage', lit, 2), (17, 11), 26),
    'house_cream': (lambda lit: house('cream', lit, 4), (17, 11), 26),
    'house_blue': (lambda lit: house('blue', lit, 6), (17, 11), 26),
    'house_clay': (lambda lit: house('clay', lit, 7), (17, 11), 26),
    'courier_depot': (courier_depot, (28, 16), 18),
    'garage_torque': (garage_torque, (26, 16), 18),
    'dealer_office': (dealer_office, (12, 9), 20),
    'site_trailer': (site_trailer, (15, 6), 12),
    'car_wash': (car_wash, (26, 14), 23),
}


# ------------------------------------------------------------------ props (world units, scale 1)
def mailbox():
    """A kerbside mailbox on a wooden post, 13 units tall, the flag up."""
    def parts(P):
        post = rbox(P, (0, 0, 4.5), (0.7, 0.7, 4.5), 0.2)
        box = np.maximum(rbox(P, (0, 0, 10.0), (1.6, 3.2, 1.8), 0.4), -(P[:, 2] - 8.2))
        top = cyl_y_soft(P, (0, 0, 11.2), 1.6, 3.2)
        flag = rbox(P, (1.9, -1.2, 12.0), (0.15, 0.4, 1.5), 0.05)
        return [post, np.minimum(box, top), flag]
    return Model(parts, [solid('wood', 2.0), solid('navy', 2.4), solid('red', 2.8)], (-3, 3, -5, 5, 0, 15))


def cyl_y_soft(P, c, r, hh):
    q = P - np.array(c)
    d = np.sqrt(q[:, 0] ** 2 + q[:, 2] ** 2) - r
    return np.maximum(d, np.abs(q[:, 1]) - hh)


def picket(length=16.0):
    """A white picket fence segment along local x, 11 units tall."""
    def parts(P):
        x = P[:, 0]
        k = np.round(x / 2.0) * 2.0
        k = np.clip(k, -length / 2 + 1, length / 2 - 1)
        pick = np.maximum(np.abs(x - k) - 0.55, np.maximum(np.abs(P[:, 1]) - 0.35, np.abs(P[:, 2] - 5.0) - 5.0 + 0.6 * np.abs(x - k)))
        rails = np.minimum(rbox(P, (0, -0.5, 3.4), (length / 2, 0.3, 0.45), 0.1), rbox(P, (0, -0.5, 7.6), (length / 2, 0.3, 0.45), 0.1))
        return [pick, rails]
    return Model(parts, [solid('white', 3.3), solid('white', 2.8)], (-length / 2 - 1, length / 2 + 1, -2, 2, 0, 12))


def _bark(p, n, base=1.6):
    z = p[:, 2]
    return np.full(len(p), RID['wood']), base + (np.mod(np.arctan2(p[:, 1], p[:, 0]) * 3 + z * 0.2, 1.4) < 0.5) * -0.5, np.zeros(len(p))


def _rings(p, n):
    rr = np.sqrt(p[:, 0] ** 2 + p[:, 1] ** 2)
    top = n[:, 2] > 0.6
    ring = np.mod(rr, 1.3) < 0.4
    return np.where(top, RID['clay'], RID['wood']), np.where(top, 3.4 - ring * 0.6, 1.6), np.zeros(len(p))


def stump():
    def parts(P):
        s = cyl_z(P, (0, 0, 2.6), 4.2, 2.6, 0.6)
        roots = np.minimum.reduce([capsule(P, (0, 0, 0.8), (6.0 * np.cos(a), 6.0 * np.sin(a), 0.2), 1.3, 0.5) for a in (0.3, 2.0, 3.6, 5.1)])
        return [smin(s, roots, 1.2)]

    def m(p, n):
        r1, t1, s1 = _rings(p, n)
        r2, t2, s2 = _bark(p, n)
        top = n[:, 2] > 0.6
        return np.where(top & (p[:, 2] > 4.6), r1, r2), np.where(top & (p[:, 2] > 4.6), t1, t2), s1
    return Model(parts, [m], (-8, 8, -8, 8, 0, 7))


def log():
    """A felled log lying along x, 44 units long."""
    def parts(P):
        Q = P.copy(); Q[:, 2] -= 3.6
        body = np.maximum(np.sqrt(Q[:, 1] ** 2 + Q[:, 2] ** 2) - 3.6, np.abs(P[:, 0]) - 22.0)
        return [body]

    def m(p, n):
        end = np.abs(n[:, 0]) > 0.7
        rr = np.sqrt(p[:, 1] ** 2 + (p[:, 2] - 3.6) ** 2)
        ring = np.mod(rr, 1.2) < 0.35
        r = np.where(end, RID['clay'], RID['wood'])
        t = np.where(end, 3.4 - ring * 0.6, 1.5 + (np.mod(p[:, 0] * 0.7 + np.arctan2(p[:, 2] - 3.6, p[:, 1]) * 2, 1.6) < 0.5) * -0.4)
        return r, t, np.zeros(len(p))
    return Model(parts, [m], (-24, 24, -5, 5, 0, 8))


def log_pile():
    """Logs stacked in a pyramid (4-3-2) along x, 40 units long, ends to the camera's right."""
    def parts(P):
        d = np.full(len(P), 1e3)
        for row, n in enumerate((4, 3, 2)):
            for k in range(n):
                yc = (k - (n - 1) / 2) * 7.0
                zc = 3.5 + row * 6.0
                d = np.minimum(d, np.maximum(np.sqrt((P[:, 1] - yc) ** 2 + (P[:, 2] - zc) ** 2) - 3.4, np.abs(P[:, 0]) - 20.0 + row * 1.2))
        chock = np.minimum(rbox(P, (-16, 14.5, 2.5), (1.0, 1.0, 2.5), 0.2), rbox(P, (16, 14.5, 2.5), (1.0, 1.0, 2.5), 0.2))
        return [d, chock]

    def m(p, n):
        end = np.abs(n[:, 0]) > 0.7
        h = hash3(np.round(p[:, 1] / 7.0), np.round(p[:, 2] / 6.0), 1, 4)
        r = np.where(end, RID['clay'], RID['wood'])
        t = np.where(end, 3.3 + (h - 0.5) * 0.6 - (np.mod(np.sqrt((np.mod(p[:, 1] + 3.5, 7.0) - 3.5) ** 2 + (np.mod(p[:, 2] - 0.5, 6.0) - 3.0) ** 2), 1.1) < 0.3) * 0.6,
                     1.5 + (h - 0.5) * 0.5)
        return r, t, np.zeros(len(p))
    return Model(parts, [m, solid('wood', 1.9)], (-22, 22, -17, 17, 0, 20))


def birch(seed=2):
    """A slim birch: a white trunk with dark marks and a light, airy crown."""
    def parts(P):
        trunk = capsule(P, (0, 0, 0), (0.8, 0.4, 44), 1.7, 0.9)
        d = np.full(len(P), 1e3)
        for (cx, cy, cz, rx, ry, rz) in ((0, 0, 48, 9, 9, 11), (-5, 3, 40, 6, 6, 6), (5, -2, 42, 6, 6, 6.5), (1, 1, 58, 6, 6, 6)):
            d = smin(d, ell(P, (cx, cy, cz), (rx, ry, rz)), 2.5)
        d = d + 0.8 * np.sin(P[:, 0] * 1.4) * np.sin(P[:, 1] * 1.5) * np.sin(P[:, 2] * 1.3)
        return [trunk, d]

    def bark(p, n):
        z = p[:, 2]
        mark = hash3(np.floor(z / 1.6), np.floor(np.arctan2(p[:, 1], p[:, 0]) * 1.5), 2, seed) > 0.78
        return np.where(mark, RID['night'], RID['white']), np.where(mark, 1.6, 3.4), np.zeros(len(p))

    def leaf(p, n):
        c = hash3(np.floor(p[:, 0] / 2.4), np.floor(p[:, 1] / 2.4), np.floor(p[:, 2] / 2.4), seed)
        return np.where(c > 0.75, RID['khaki'], RID['sage']), 2.7 + (c - 0.5) * 0.9 + (p[:, 2] - 48) * 0.03, np.zeros(len(p))
    return Model(parts, [bark, leaf], (-14, 14, -14, 14, 0, 66))


def fir():
    """A tall dark fir, 90 units: narrow tiers of branches down to the ground."""
    def parts(P):
        trunk = capsule(P, (0, 0, 0), (0, 0, 20), 2.2, 1.6)
        d = np.full(len(P), 1e3)
        for z, r, h in ((14, 15, 11), (26, 12.5, 10), (38, 10, 9), (49, 7.5, 8), (59, 5, 8), (68, 3, 7)):
            d = np.minimum(d, ell(P, (0, 0, z + h * 0.3), (r, r, h)) + lump(P, 0.5, 1.8))
        return [trunk, d]

    def mat(p, n):
        z = p[:, 2]
        c = hash3(np.floor(p[:, 0] / 2), np.floor(p[:, 1] / 2), np.floor(z / 2), 8)
        return np.full(len(p), RID['teal']), 0.9 + (c - 0.5) * 0.7 + (z - 30) * 0.018 + (n[:, 2] > 0.5) * 0.3, np.zeros(len(p))
    return Model(parts, [solid('wood', 1.2), mat], (-17, 17, -17, 17, 0, 80))


def fern(seed=1):
    def parts(P):
        d = np.full(len(P), 1e3)
        for k in range(7):
            a = k * 0.9 + seed
            d = np.minimum(d, capsule(P, (0, 0, 1.0), (7.0 * np.cos(a), 7.0 * np.sin(a), 4.5 + (k % 3)), 1.1, 0.4))
        return [d]

    def m(p, n):
        c = hash3(np.floor(p[:, 0]), np.floor(p[:, 1]), np.floor(p[:, 2]), seed)
        return np.where(c > 0.8, RID['khaki'], RID['sage']), 2.0 + p[:, 2] * 0.12 + (c - 0.5) * 0.6, np.zeros(len(p))
    return Model(parts, [m], (-10, 10, -10, 10, 0, 9))


def rock(seed=3):
    def parts(P):
        d = ell(P, (0, 0, 2.6), (6.0, 4.6, 3.6)) + 0.6 * np.sin(P[:, 0] * 1.3 + seed) * np.sin(P[:, 1] * 1.7) * np.sin(P[:, 2] * 1.1)
        return [np.maximum(d, -P[:, 2])]

    def m(p, n):
        moss = (n[:, 2] > 0.6) & (hash3(np.floor(p[:, 0] / 1.5), np.floor(p[:, 1] / 1.5), 1, seed) > 0.6)
        return np.where(moss, RID['sage'], RID['stone']), np.where(moss, 2.2, 2.3 + p[:, 2] * 0.12), np.zeros(len(p))
    return Model(parts, [m], (-8, 8, -7, 7, 0, 7))


def tyre_stack():
    def parts(P):
        d = np.minimum.reduce([cyl_z(P, (0, 0, 1.6 + 3.0 * k), 5.0, 1.4, 1.0) for k in range(4)])
        hole = cyl_z(P, (0, 0, 7), 2.2, 9.0)
        return [np.maximum(d, -hole)]

    def m(p, n):
        side = np.abs(n[:, 2]) < 0.6
        tread = side & (np.mod(np.arctan2(p[:, 1], p[:, 0]) * 8, 1.0) < 0.35)
        return np.full(len(p), RID['night']), np.where(side, 1.5 - tread * 0.4, 2.3), np.zeros(len(p))
    return Model(parts, [m], (-7, 7, -7, 7, 0, 13))


def pennants():
    """A pole with a string of red and white pennants running off to the right (the used-car lot)."""
    def parts(P):
        pole = capsule(P, (0, 0, 0), (0, 0, 34), 0.6)
        flags = np.full(len(P), 1e3)
        for k in range(6):
            x0 = 1.5 + k * 3.6
            z0 = 33.0 - k * 1.6 + 0.08 * k * k
            tri = np.maximum(np.maximum(np.abs(P[:, 1]) - 0.15, P[:, 2] - z0), np.abs(P[:, 0] - x0) - 1.4 + (z0 - P[:, 2]) * 0.45)
            flags = np.minimum(flags, np.maximum(tri, z0 - 3.0 - P[:, 2]))
        return [pole, flags]

    def m(p, n):
        k = np.floor((p[:, 0] - 0.0) / 3.6) % 2
        return np.where(k == 0, RID['red'], RID['white']), np.where(k == 0, 2.6, 3.5), np.zeros(len(p))
    return Model(parts, [solid('lavlt', 2.6), m], (-2, 24, -2, 2, 0, 36))


PROPS = {
    'mailbox': mailbox, 'stump': stump, 'log': log, 'log_pile': log_pile, 'birch': birch, 'fir': fir,
    'fern': fern, 'rock': rock, 'tyre_stack': tyre_stack, 'pennants': pennants,
}
SEGMENTS = {'picket': lambda: picket(16.0)}
SEGMENT_LEN = {'picket': 16.0}

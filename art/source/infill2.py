"""More Downtown buildings for variety (user request, 2026-10-11: "at least 10 more diverse buildings").

Same rules as infill.py: model units at BLD_SCALE 2.6, one storey is 12 units, the front is local +y, every face
dressed because buildings across a street show their backs, `lit` lights some windows for the `_night` variant.
Shapes lean on curves where they suit (a round-cornered block, a streamlined diner, a spire), as the user asked.

  shop_diner      streamlined one-storey diner with rounded ends and a rooftop sign
  cinema          three storeys, a marquee and a blade sign
  chapel          stone nave with a gable roof, a front tower and spire, arched coloured windows
  deco_office     stepped art-deco office with stone piers and a crown
  glass_tower     a glass skyscraper with rounded corners and a crown
  brownstones     a row of three narrow brownstone houses with stoops and bay windows
  parking_garage  open concrete decks with parked cars showing, a P sign
  hotel           tall hotel with balconies, an entrance canopy and a blade sign
  library         classical library: columns, pediment, wide steps
  fire_station    red-brick fire station with two engine bays and a hose tower
  corner_round    five-storey block with one big rounded corner, shops below
  shop_florist    a one-storey flower shop with a glass conservatory and buckets of flowers
"""
import numpy as np
from sdf import rbox, cyl_z, capsule, solid, RID, hash3, Model
from env import sign_text, _grid, _glass
from infill import _faces, _wall_texture, FH


def _rrect2(x, y, hx, hy, r):
    """Signed distance to a rounded rectangle in the ground plane."""
    qx = np.abs(x) - (hx - r)
    qy = np.abs(y) - (hy - r)
    return np.sqrt(np.maximum(qx, 0) ** 2 + np.maximum(qy, 0) ** 2) + np.minimum(np.maximum(qx, qy), 0) - r


def _prism(P, hx, hy, z0, z1, r):
    """A rounded-rectangle footprint extruded from z0 to z1 (sharp top edge, round corners)."""
    d2 = _rrect2(P[:, 0], P[:, 1], hx, hy, r)
    dz = np.abs(P[:, 2] - (z0 + z1) / 2) - (z1 - z0) / 2
    return np.maximum(d2, dz)


def _uv(p, n, hx, hy):
    """Facade coordinate along each wall and the wall's half span (works for round corners too)."""
    front, right, back, left = _faces(n)
    u = np.where(front | back, p[:, 0], p[:, 1])
    span = np.where(front | back, hx, hy)
    return u, span, front, right, back, left


def _windows(u, span, z, z0, z1, lit, seed, ramp, base, pitch=6.5, ww=3.4, wh=7.0, fh=FH, n=None):
    win, rz, _, ci, fi = _grid(u + span, z, 0.0, z0, pitch, ww, (pitch - ww) / 2, fh, wh, (fh - wh) / 2)
    win &= (z > z0) & (z < z1) & (np.abs(u) < span - 1.4)
    if n is not None:
        win &= ~(n[:, 2] > 0.5) & ~(n[:, 2] < -0.5)
    r, t = _glass(win, rz, wh, lit, ci, fi, ramp, base, seed)
    return win, r, t


# ------------------------------------------------------------------ diner
def shop_diner(lit=0.0):
    hx, hy, H = 20.0, 10.0, 13.0

    def parts(P):
        body = _prism(P, hx, hy, 0.0, H, hy - 0.5)            # stadium plan: fully rounded ends
        roof = _prism(P, hx + 0.8, hy + 0.8, H, H + 1.2, hy + 0.3)
        base = _prism(P, hx + 0.4, hy + 0.4, 0.0, 1.6, hy)
        post = np.minimum(capsule(P, (-6, 0, H), (-6, 0, H + 6), 0.5), capsule(P, (6, 0, H), (6, 0, H + 6), 0.5))
        sign = rbox(P, (0, 0, H + 8.5), (11.0, 0.9, 3.0), 0.5)
        door = rbox(P, (hx - 9.0, hy + 1.4, 5.0), (2.8, 1.4, 5.0), 0.3)
        return [body, roof, base, post, sign, door]

    def body_m(p, n):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        r = np.full(len(p), RID['white']); t = np.full(len(p), 3.4)
        ribbon = (z > 4.8) & (z < 10.4) & ~(n[:, 2] > 0.5)
        stripe = (z > 2.4) & (z < 3.6)
        chrome = (np.abs(z - 4.2) < 0.4) | (np.abs(z - 11.0) < 0.4)
        dlit = lit > 0
        r = np.where(ribbon, RID['gold'] if dlit else RID['glass'], r)
        t = np.where(ribbon, 3.0 if dlit else 1.4 + (z - 4.8) * 0.15, t)
        mull = ribbon & (np.abs(np.mod(x + 40, 5.0) - 2.5) < 0.25)
        r = np.where(mull, RID['lavlt'], r); t = np.where(mull, 3.6, t)
        # booths and heads inside the window
        booth = ribbon & (z < 6.6) & (np.mod(x + 40, 5.0) < 3.0)
        r = np.where(booth, RID['red'], r); t = np.where(booth, 2.4, t)
        r = np.where(stripe, RID['red'], r); t = np.where(stripe, 2.6, t)
        r = np.where(chrome, RID['lavlt'], r); t = np.where(chrome, 4.0, t)
        return r, t, np.where(ribbon | chrome, 0.9, 0.0)

    def sign_m(p, n):
        side = (np.abs(n[:, 1]) > 0.5)
        u = np.where(n[:, 1] > 0, p[:, 0], -p[:, 0])
        txt = side & sign_text(u, p[:, 2], 'DINER', 0.0, H + 8.5, scale=2)
        edge = np.abs(p[:, 2] - (H + 8.5)) > 2.2
        r = np.where(txt, RID['white'], np.where(edge, RID['white'], RID['teal']))
        return r, np.where(txt, 4.4, np.where(edge, 3.6, 2.4)), np.zeros(len(p))

    def door_m(p, n):
        g = (n[:, 1] > 0.5) & (np.abs(p[:, 0] - (hx - 9.0)) < 2.0) & (p[:, 2] < 8.6)
        return np.where(g, RID['glass'], RID['lavlt']), np.where(g, 1.5, 3.8), np.where(g, 0.9, 0.5)

    mats = [body_m, solid('red', 2.4), solid('lavlt', 3.0), solid('lavlt', 3.2, 0.5), sign_m, door_m]
    return Model(parts, mats, (-hx - 2, hx + 2, -hy - 2, hy + 4, 0, H + 13))


# ------------------------------------------------------------------ cinema
def cinema(lit=0.0):
    hx, hy, H = 18.0, 12.0, 3 * FH + 4.0

    def parts(P):
        body = rbox(P, (0, 0, H / 2), (hx, hy, H / 2), 0.6)
        cornice = rbox(P, (0, 0, H + 0.8), (hx + 0.9, hy + 0.9, 0.8), 0.3)
        marquee = rbox(P, (0, hy + 3.2, 11.8), (hx - 2.0, 3.2, 1.9), 0.4)
        blade = rbox(P, (hx - 4.0, hy + 2.6, 26.0), (0.9, 2.6, 9.0), 0.4)
        base = rbox(P, (0, 0, 1.0), (hx + 0.5, hy + 0.5, 1.0), 0.3)
        return [body, cornice, marquee, blade, base]

    def body_m(p, n):
        u, span, front, right, back, left = _uv(p, n, hx, hy)
        z = p[:, 2]
        ramp, base = _wall_texture('render_lav', u, z, 21)
        r, t = ramp, base
        # the upper front: a blank wall with vertical ribs (the auditorium); windows elsewhere
        rib = front & (z > 15) & (np.abs(np.mod(u + 40, 6.0) - 3.0) < 0.5)
        r = np.where(rib, RID['stone'], r); t = np.where(rib, 3.4, t)
        win, r, t = _windows(u, span, z, 15.0, H - 2, lit, 22, r, t, n=n)
        upper = front & (z > 14.0)
        win &= ~upper
        r = np.where(upper, np.where(rib, RID['stone'], ramp), r)
        t = np.where(upper, np.where(rib, 3.4, base), t)
        # a frieze of coloured tiles under the cornice
        frieze = front & (z > H - 4.0) & (z < H - 1.5)
        r = np.where(frieze, np.where(np.mod(np.floor((p[:, 0] + 40) / 1.5), 2) == 0, RID['teal'], RID['white']), r)
        t = np.where(frieze, 2.8, t)
        # ground floor: glass doors and poster frames
        g = front & (z > 1.8) & (z < 9.6)
        doors = g & (np.abs(p[:, 0]) < 7.0)
        posters = g & (np.abs(np.abs(p[:, 0]) - 12.0) < 2.4) & (z > 2.6) & (z < 8.8)
        dlit = lit > 0
        r = np.where(doors, RID['gold'] if dlit else RID['glass'], r); t = np.where(doors, 3.0 if dlit else 1.4, t)
        dm = doors & (np.abs(np.mod(p[:, 0] + 7.0, 3.5) - 1.75) < 0.25)
        r = np.where(dm, RID['night'], r); t = np.where(dm, 1.8, t)
        pc = np.array([RID['plum'], RID['teal'], RID['navy']])
        pick = (hash3(np.floor(p[:, 0] / 8), 2, 3, 5) * 3).astype(int) % 3
        r = np.where(posters, pc[pick], r); t = np.where(posters, 2.6 + (z > 6) * 0.8, t)
        frame = posters & ((np.abs(np.abs(p[:, 0]) - 12.0) > 2.0) | (z < 3.0) | (z > 8.4))
        r = np.where(frame, RID['white'], r); t = np.where(frame, 3.6, t)
        return r, t, np.where(doors | win, 0.9, 0.0)

    def marquee_m(p, n):
        front = n[:, 1] > 0.5
        side_face = front
        txt = side_face & sign_text(p[:, 0], p[:, 2], 'NOW SHOWING', 0.0, 11.8)
        bulbs = side_face & (np.abs(np.mod(p[:, 0] + 40, 2.0) - 1.0) < 0.35) & (np.abs(p[:, 2] - 11.8) > 1.3)
        r = np.where(txt, RID['night'], np.where(bulbs, RID['khaki'], RID['white']))
        t = np.where(txt, 1.4, np.where(bulbs, 4.0 if lit > 0 else 3.2, 3.6))
        under = n[:, 2] < -0.5
        r = np.where(under, RID['khaki'] if lit > 0 else RID['lavlt'], r); t = np.where(under, 4.0 if lit > 0 else 2.4, t)
        return r, t, np.zeros(len(p))

    def blade_m(p, n):
        side = np.abs(n[:, 0]) > 0.5
        u = np.where(n[:, 0] > 0, -p[:, 1], p[:, 1])
        # the letters run down the blade, one above another
        txt = np.zeros(len(p), bool)
        for k, ch in enumerate('CINEMA'):
            txt |= side & sign_text(u, p[:, 2], ch, -(hy + 2.6) if False else 0.0, 33.0 - k * 2.6)
        txt &= np.abs(p[:, 1] - (hy + 2.6)) < 2.2
        r = np.where(txt, RID['white'], RID['red'])
        return r, np.where(txt, 4.4, 2.6), np.zeros(len(p))

    mats = [body_m, solid('stone', 3.2), marquee_m, blade_m, solid('stone', 2.0)]
    return Model(parts, mats, (-hx - 2, hx + 2, -hy - 2, hy + 10, 0, H + 4))


# ------------------------------------------------------------------ chapel
def chapel(lit=0.0):
    hx, hy, H = 11.0, 16.0, 18.0          # nave runs along y; the tower stands at the front (+y)

    def parts(P):
        nave = rbox(P, (0, -3.0, H / 2), (hx, hy - 3.0, H / 2), 0.4)
        # gable roof: a box sheared so its ridge runs along y
        Q = P.copy(); Q[:, 2] = P[:, 2] + 0.85 * np.abs(P[:, 0])
        roof = np.maximum(rbox(Q, (0, -3.0, H + 5.0), (hx + 6.5, hy - 2.0, 5.0), 0.3), -(P[:, 2] - H + 0.6))
        tower = rbox(P, (0, hy - 5.0, 15.0), (6.0, 5.0, 15.0), 0.3)
        belfry = rbox(P, (0, hy - 5.0, 33.0), (5.2, 4.2, 3.0), 0.3)
        # the spire: a square pyramid
        dz = P[:, 2] - 36.0
        k = np.clip(1.0 - dz / 22.0, 0.0, 1.0) * 5.4
        spire = np.maximum(np.maximum(np.abs(P[:, 0]) - k, np.abs(P[:, 1] - (hy - 5.0)) - k), np.maximum(-dz, dz - 22.0))
        spire = spire * 0.7
        cross = np.minimum(capsule(P, (0, hy - 5.0, 58), (0, hy - 5.0, 63), 0.35), capsule(P, (-1.4, hy - 5.0, 61.4), (1.4, hy - 5.0, 61.4), 0.35))
        steps = rbox(P, (0, hy + 1.2, 0.8), (4.0, 1.4, 0.8), 0.2)
        return [nave, roof, tower, belfry, spire, cross, steps]

    def stone_m(p, n):
        front, right, back, left = _faces(n)
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        u = np.where(front | back, x, y)
        ramp, base = _wall_texture('stone', u, z, 31)
        r, t = ramp, base
        # tall arched windows along the nave sides, a round window over the door
        side = right | left
        ac = np.mod(y + 40, 7.0) - 3.5
        arch = side & (np.abs(ac) < 1.6) & (z > 4.0) & ((z < 12.0) | ((z < 13.6) & (ac ** 2 + (z - 12.0) ** 2 * 1.4 < 2.6))) & (y < hy - 10.5) & (y > -hy + 4)
        stain = np.array([RID['plum'], RID['teal'], RID['navy'], RID['clay']])
        pick = (hash3(np.floor(z / 2.0), np.floor((y + 40) / 7.0), 1, 3) * 4).astype(int) % 4
        r = np.where(arch, stain[pick], r)
        t = np.where(arch, (3.4 if lit > 0 else 2.4) + (np.mod(z, 2.0) < 0.3) * -0.8, t)
        door = front & (np.abs(x) < 2.2) & (z > 1.6) & ((z < 8.0) | (x ** 2 + (z - 8.0) ** 2 < 4.8))
        r = np.where(door, RID['wood'], r); t = np.where(door, 1.6, t)
        rose = front & ((x ** 2 + (z - 15.0) ** 2) < 4.0) & (y > hy - 1.0)
        r = np.where(rose, stain[(np.floor(np.arctan2(z - 15.0, x) * 2.5) % 4).astype(int)], r); t = np.where(rose, 2.8, t)
        belfry_open = (np.abs(z - 33.0) < 2.0) & (np.abs(u - np.where(front | back, 0.0, hy - 5.0)) < 2.0) & ~(n[:, 2] > 0.5)
        r = np.where(belfry_open, RID['night'], r); t = np.where(belfry_open, 1.2, t)
        return r, t, np.where(arch, 0.6, 0.0)

    mats = [stone_m, solid('blueg', 2.0), stone_m, stone_m, solid('blueg', 2.2), solid('khaki', 3.4, 0.5), solid('stone', 2.6)]
    return Model(parts, mats, (-hx - 8, hx + 8, -hy - 2, hy + 4, 0, 66))


# ------------------------------------------------------------------ art-deco office
def deco_office(lit=0.0):
    hx, hy = 20.0, 17.0
    tiers = [(0.0, 52.0, hx, hy), (52.0, 74.0, hx - 4.0, hy - 4.0), (74.0, 88.0, hx - 8.0, hy - 8.0)]

    def parts(P):
        body = np.minimum.reduce([rbox(P, (0, 0, (a + b) / 2), (sx, sy, (b - a) / 2), 0.4) for a, b, sx, sy in tiers])
        crown = np.minimum(rbox(P, (0, 0, 91.0), (hx - 10.0, hy - 10.0, 3.0), 0.6), capsule(P, (0, 0, 94), (0, 0, 104), 0.6))
        base = rbox(P, (0, 0, 2.0), (hx + 0.7, hy + 0.7, 2.0), 0.3)
        door = rbox(P, (0, hy + 0.5, 7.0), (5.0, 0.8, 7.0), 0.3)
        return [body, crown, base, door]

    def body_m(p, n):
        front, right, back, left = _faces(n)
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        u = np.where(front | back, x, y)
        r = np.full(len(p), RID['stone']); t = np.full(len(p), 3.1)
        # vertical stone piers with dark recessed window bays between them
        bay = (np.abs(np.mod(u + 40, 5.0) - 2.5) < 1.5) & (z > 14.0) & ~(n[:, 2] > 0.5)
        tier_top = np.where(z < 52, 52, np.where(z < 74, 74, 88))
        bay &= (z < tier_top - 2.0)
        spandrel = bay & (np.mod(z - 14.0, FH) < 3.0)
        fi = np.floor((z - 14.0) / FH)
        islit = hash3(np.floor((u + 40) / 5.0), fi, 7, 41) < lit
        r = np.where(bay, np.where(islit, RID['gold'], RID['glass']), r)
        t = np.where(bay, np.where(islit, 2.8, 1.3 + np.mod(z - 14, FH) * 0.12), t)
        r = np.where(spandrel, RID['night'], r); t = np.where(spandrel, 2.0, t)
        chevron = spandrel & (np.abs(np.mod(u + 40, 5.0) - 2.5) < 0.5 + (np.mod(z - 14.0, FH)) * 0.3)
        r = np.where(chevron, RID['khaki'], r); t = np.where(chevron, 2.8, t)
        # a dark polished ground floor with a tall glass lobby
        g = z < 13.5
        r = np.where(g, RID['night'], r); t = np.where(g, 2.2, t)
        gw = g & (z > 3.0) & (z < 12.0) & (np.abs(np.mod(u + 40, 8.0) - 4.0) < 3.0) & ~(n[:, 2] > 0.5) & (np.abs(u) < hy - 2)
        r = np.where(gw, RID['glass'], r); t = np.where(gw, 1.6, t)
        return r, t, np.where(bay | gw, 0.9, 0.0)

    def door_m(p, n):
        f = n[:, 1] > 0.5
        g = f & (np.abs(p[:, 0]) < 4.0) & (p[:, 2] < 12.0)
        r = np.where(g, RID['gold'] if lit > 0 else RID['glass'], RID['khaki'])
        sun = f & (p[:, 2] > 10.0) & (np.abs(np.mod(np.arctan2(p[:, 2] - 10.0, p[:, 0]) * 6, 1.0) - 0.5) < 0.2)
        r = np.where(sun & ~g, RID['khaki'], r)
        return r, np.where(g, 1.6, 3.0), np.where(g, 0.9, 0.4)

    mats = [body_m, solid('stone', 3.4), solid('night', 2.0), door_m]
    return Model(parts, mats, (-hx - 2, hx + 2, -hy - 2, hy + 3, 0, 106))


# ------------------------------------------------------------------ glass tower
def glass_tower(lit=0.0):
    hx, hy, H = 18.0, 18.0, 150.0

    def parts(P):
        podium = _prism(P, hx + 3.0, hy + 3.0, 0.0, 14.0, 4.0)
        shaft = _prism(P, hx, hy, 14.0, H, 6.0)
        crown = _prism(P, hx - 3.0, hy - 3.0, H, H + 8.0, 4.0)
        mast = capsule(P, (4, -3, H + 8), (4, -3, H + 26), 0.5)
        canopy = rbox(P, (0, hy + 5.0, 13.0), (9.0, 2.4, 0.6), 0.3)
        return [podium, shaft, crown, mast, canopy]

    def glass_m(p, n):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        # facade coordinate around the rounded plan, so mullions wrap the corners
        ang = np.arctan2(y, x)
        u = ang * 22.0
        r = np.full(len(p), RID['glass']); t = 1.6 + 1.2 * np.clip((np.mod(z, 8.0)) / 8.0, 0, 1)
        refl = np.abs(np.mod(u * 0.35 + z * 0.12, 13.0) - 6.5) < 1.2
        t = t + refl * 0.7
        fi = np.floor(z / 8.0); ci = np.floor(u / 4.0)
        islit = hash3(ci, fi, 9, 51) < lit * 0.8
        r = np.where(islit, RID['gold'], r); t = np.where(islit, 2.6, t)
        mull = (np.mod(u, 4.0) < 0.45) | (np.mod(z, 8.0) < 0.5)
        r = np.where(mull, RID['blueg'], r); t = np.where(mull, 2.0, t)
        top = n[:, 2] > 0.5
        r = np.where(top, RID['lavlt'], r); t = np.where(top, 2.6, t)
        return r, t, np.where(mull | top, 0.2, 1.0)

    def podium_m(p, n):
        z = p[:, 2]
        g = (z > 2.0) & (z < 12.0) & ~(n[:, 2] > 0.5)
        dlit = lit > 0
        r = np.where(g, RID['gold'] if dlit else RID['glass'], RID['night'])
        t = np.where(g, 2.8 if dlit else 1.5 + (z - 2) * 0.1, 2.0)
        m = g & (np.abs(np.mod(np.arctan2(p[:, 1], p[:, 0]) * 25.0, 4.0) - 2.0) < 0.3)
        r = np.where(m, RID['night'], r)
        return r, t, np.where(g, 0.9, 0.0)

    mats = [podium_m, glass_m, solid('blueg', 2.6), solid('lavlt', 3.0), solid('night', 2.0)]
    return Model(parts, mats, (-hx - 4, hx + 4, -hy - 4, hy + 8, 0, H + 28))


# ------------------------------------------------------------------ brownstones
def brownstones(lit=0.0):
    hx, hy, H = 24.0, 12.0, 3 * FH + 3.0
    doors = [('red', -16.0), ('navy', 0.0), ('sage', 16.0)]

    def parts(P):
        body = rbox(P, (0, 0, H / 2), (hx, hy, H / 2), 0.5)
        cornice = rbox(P, (0, 0, H + 1.0), (hx + 1.2, hy + 1.2, 1.0), 0.4)
        bays = np.minimum.reduce([rbox(P, (cx + 4.0, hy + 1.4, 20.0), (3.2, 1.6, 7.0), 0.4) for _, cx in doors])
        stoops = np.minimum.reduce([rbox(P, (cx - 3.0, hy + 1.0 + k * 1.3, 2.6 - k * 0.8), (2.8, 1.3, 2.6 - k * 0.8), 0.2)
                                    for _, cx in doors for k in range(3)])
        rails = np.minimum.reduce([capsule(P, (cx - 3.0 + s * 2.9, hy + 0.5, 5.6), (cx - 3.0 + s * 2.9, hy + 4.4, 2.6), 0.25)
                                   for _, cx in doors for s in (-1, 1)])
        return [body, cornice, bays, stoops, rails]

    def body_m(p, n):
        front, right, back, left = _faces(n)
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        u = np.where(front | back, x, y)
        span = np.where(front | back, hx, hy)
        course = np.floor(z / 3.0)
        r = np.full(len(p), RID['clay']); t = 1.7 + (hash3(np.floor((u + 40) / 5.0), course, 3, 61) - 0.5) * 0.4 - (np.mod(z, 3.0) < 0.3) * 0.4
        # house dividers
        div = front & (np.abs(np.mod(x + hx, 16.0)) < 0.5)
        r = np.where(div, RID['stone'], r); t = np.where(div, 2.6, t)
        win, r, t = _windows(u, span, z, 0.0, H - 1.0, lit, 62, r, t, pitch=5.33, ww=2.6, wh=6.6, n=n)
        # keep the door bays clear on the ground floor
        for col, cx in doors:
            d = front & (np.abs(x - (cx - 3.0)) < 1.8) & (z > 5.2) & (z < 12.6)
            win &= ~(front & (np.abs(x - (cx - 3.0)) < 3.0) & (z < FH + 1))
            r = np.where(d, RID[col], r); t = np.where(d, 1.9 + (np.abs(x - (cx - 3.0)) > 1.3) * 0.5, t)
            fan = front & (np.abs(x - (cx - 3.0)) < 1.8) & (z >= 12.6) & (z < 13.8)
            r = np.where(fan, RID['gold'] if lit > 0 else RID['glass'], r)
        lint = (np.abs(np.mod(z, FH) - 10.4) < 0.45) & (z > 2) & ~(n[:, 2] > 0.5)
        r = np.where(lint & ~win, RID['stone'], r); t = np.where(lint & ~win, 3.0, t)
        return r, t, np.where(win, 0.9, 0.0)

    def bay_m(p, n):
        z = p[:, 2]
        side = ~(n[:, 2] > 0.5) & ~(n[:, 2] < -0.5)
        w = side & (np.abs(np.mod(z - 13.0, FH) - 3.4) < 3.0)
        islit = hash3(np.floor(p[:, 0] / 4), np.floor(z / FH), 1, 63) < lit
        r = np.where(w, np.where(islit, RID['gold'], RID['glass']), RID['stone'])
        return r, np.where(w, np.where(islit, 2.8, 1.5), 2.6), np.where(w, 0.9, 0.0)

    mats = [body_m, solid('stone', 2.9), bay_m, solid('stone', 2.2), solid('night', 1.6)]
    return Model(parts, mats, (-hx - 2, hx + 2, -hy - 2, hy + 6, 0, H + 4))


# ------------------------------------------------------------------ parking garage
def parking_garage(lit=0.0):
    hx, hy = 26.0, 18.0
    decks = [0.0, 9.0, 18.0, 27.0]
    H = 36.0

    def parts(P):
        slabs = np.minimum.reduce([rbox(P, (0, 0, z + 0.8), (hx, hy, 0.8), 0.2) for z in decks + [H - 1.6]])
        cols = np.full(len(P), 1e3)
        for cx in np.linspace(-hx + 1.5, hx - 1.5, 6):
            for cy in (-hy + 1.5, hy - 1.5):
                cols = np.minimum(cols, rbox(P, (cx, cy, H / 2), (0.9, 0.9, H / 2), 0.2))
        parapets = np.minimum.reduce([np.maximum(rbox(P, (0, 0, z + 2.6), (hx, hy, 1.0), 0.2), -rbox(P, (0, 0, z + 2.6), (hx - 0.8, hy - 0.8, 2.0), 0.0))
                                      for z in decks[1:] + [H - 1.6]])
        stair = rbox(P, (-hx + 4.0, -hy + 4.0, (H + 6) / 2), (4.0, 4.0, (H + 6) / 2), 0.4)
        # parked cars as simple rounded lumps on each deck, seen through the open sides
        cars = np.full(len(P), 1e3)
        for k, z in enumerate(decks):
            for j, cx in enumerate(np.linspace(-hx + 9, hx - 5, 5)):
                if hash3(k, j, 1, 71) < 0.35:
                    continue
                cy = (hy - 6.0) if (j + k) % 2 else -(hy - 8.0)
                cars = np.minimum(cars, rbox(P, (cx, cy, z + 3.0), (2.2, 4.0, 1.4), 0.9))
        sign = rbox(P, (hx - 3.0, hy + 0.8, 30.0), (2.8, 0.6, 2.8), 0.4)
        return [slabs, cols, parapets, stair, cars, sign]

    def stair_m(p, n):
        z = p[:, 2]
        w = (np.abs(np.mod(z, 9.0) - 5.0) < 2.4) & ~(n[:, 2] > 0.5) & (np.abs(np.mod(p[:, 0] + p[:, 1] + 40, 4.0) - 2.0) < 1.2)
        r = np.where(w, RID['gold'] if lit > 0 else RID['glass'], RID['lavlt'])
        return r, np.where(w, 2.6 if lit > 0 else 1.4, 2.2), np.zeros(len(p))

    def car_m(p, n):
        pick = (hash3(np.floor(p[:, 0] / 9.0), np.floor(p[:, 2] / 9.0), 2, 72) * 5).astype(int) % 5
        cols = np.array([RID['clay'], RID['teal'], RID['lavlt'], RID['navy'], RID['white']])
        return cols[pick], np.full(len(p), 2.6), np.full(len(p), 0.5)

    def sign_m(p, n):
        f = n[:, 1] > 0.5
        txt = f & sign_text(p[:, 0], p[:, 2], 'P', hx - 3.0, 30.0, scale=3)
        return np.where(txt, RID['white'], RID['navy']), np.where(txt, 4.4, 2.2), np.zeros(len(p))

    def slab_m(p, n):
        stripe = (n[:, 2] > 0.5) & (np.abs(np.mod(p[:, 0] + 40, 5.0) - 2.5) < 0.2) & (np.abs(p[:, 1]) > hy - 9)
        return np.where(stripe, RID['white'], RID['lavlt']), np.where(stripe, 3.4, 2.6 - (n[:, 2] < -0.5) * 0.8), np.zeros(len(p))

    mats = [slab_m, solid('lavlt', 2.3), solid('lavlt', 2.9), stair_m, car_m, sign_m]
    return Model(parts, mats, (-hx - 2, hx + 2, -hy - 2, hy + 3, 0, H + 8))


# ------------------------------------------------------------------ hotel
def hotel(lit=0.0):
    hx, hy, floors = 17.0, 13.0, 8
    H = floors * FH + 6.0

    def parts(P):
        body = rbox(P, (0, 0, H / 2), (hx, hy, H / 2), 0.6)
        top = rbox(P, (0, 0, H + 1.4), (hx + 1.0, hy + 1.0, 1.4), 0.4)
        balc = np.full(len(P), 1e3)
        for k in range(2, floors + 1):
            z = 6.0 + (k - 1) * FH
            balc = np.minimum(balc, rbox(P, (0, hy + 1.6, z), (hx - 2.0, 1.6, 0.35), 0.1))
            balc = np.minimum(balc, rbox(P, (0, hy + 3.0, z + 1.8), (hx - 2.0, 0.15, 0.2), 0.05))
        canopy = rbox(P, (0, hy + 4.5, 12.5), (7.0, 4.5, 0.7), 0.3)
        poles = np.minimum(capsule(P, (-6.2, hy + 8.4, 0), (-6.2, hy + 8.4, 12), 0.35), capsule(P, (6.2, hy + 8.4, 0), (6.2, hy + 8.4, 12), 0.35))
        blade = rbox(P, (-hx + 3.0, hy + 2.8, 50.0), (0.9, 2.8, 13.0), 0.4)
        return [body, top, balc, canopy, poles, blade]

    def body_m(p, n):
        u, span, front, right, back, left = _uv(p, n, hx, hy)
        z = p[:, 2]
        ramp, base = _wall_texture('render_blue', u, z, 81)
        win, r, t = _windows(u, span, z, 14.0, H - 2, lit, 82, ramp, base, pitch=5.6, ww=3.2, wh=7.4, n=n)
        # tall French windows on the front behind the balconies
        g = z < 13.0
        lob = front & g & (z > 2.0) & (np.abs(p[:, 0]) < 9.0)
        r = np.where(lob, RID['gold'] if lit > 0 else RID['glass'], r); t = np.where(lob, 3.0 if lit > 0 else 1.5, t)
        st = g & ~lob
        r = np.where(st, RID['stone'], r); t = np.where(st, 2.9, t)
        return r, t, np.where(win | lob, 0.9, 0.0)

    def canopy_m(p, n):
        f = n[:, 1] > 0.5
        txt = f & sign_text(p[:, 0], p[:, 2], 'HOTEL', 0.0, 12.5)
        return np.where(txt, RID['khaki'], RID['navy']), np.where(txt, 3.6, 1.8), np.zeros(len(p))

    def blade_m(p, n):
        side = np.abs(n[:, 0]) > 0.5
        u = np.where(n[:, 0] > 0, -(p[:, 1] - (hy + 2.8)), p[:, 1] - (hy + 2.8))
        txt = np.zeros(len(p), bool)
        for k, ch in enumerate('HOTEL'):
            txt |= side & sign_text(u, p[:, 2], ch, 0.0, 59.0 - k * 3.6, scale=1)
        return np.where(txt, RID['white'], RID['red']), np.where(txt, 4.4 if True else 3, 2.6), np.zeros(len(p))

    mats = [body_m, solid('stone', 3.2), solid('night', 2.0), canopy_m, solid('khaki', 3.0, 0.5), blade_m]
    return Model(parts, mats, (-hx - 2, hx + 2, -hy - 2, hy + 10, 0, H + 4))


# ------------------------------------------------------------------ library
def library(lit=0.0):
    hx, hy, H = 22.0, 15.0, 26.0

    def parts(P):
        body = rbox(P, (0, -2.0, H / 2), (hx, hy - 2.0, H / 2), 0.5)
        attic = rbox(P, (0, -2.0, H + 1.5), (hx + 0.8, hy - 1.2, 1.5), 0.3)
        # the portico: a pediment over six columns, on wide steps
        Q = P.copy(); Q[:, 2] = P[:, 2] + 0.45 * np.abs(P[:, 0])
        ped = np.maximum(rbox(Q, (0, hy + 1.5, H + 1.5), (14.0, 3.0, 4.5), 0.2), -(P[:, 2] - H + 1.0))
        entab = rbox(P, (0, hy + 1.5, H - 1.0), (14.0, 3.0, 1.6), 0.2)
        cols = np.minimum.reduce([cyl_z(P, (cx, hy + 2.8, 3.0 + (H - 5.0) / 2), 1.2, (H - 5.0) / 2, 0.2) for cx in np.linspace(-11, 11, 6)])
        steps = np.minimum.reduce([rbox(P, (0, hy + 3.0 + k * 1.5, 1.5 - k * 0.5), (15.0 + k, 2.6 + k * 0.4, 1.5 - k * 0.5), 0.1) for k in range(3)])
        return [body, attic, ped, entab, cols, steps]

    def body_m(p, n):
        front, right, back, left = _faces(n)
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        u = np.where(front | back, x, y)
        ramp, base = _wall_texture('stone', u, z, 91)
        r, t = ramp, base
        # tall round-headed windows
        c = np.mod(u + 40, 7.0) - 3.5
        w = (np.abs(c) < 1.8) & (z > 5.0) & ((z < 17.0) | (c ** 2 + (z - 17.0) ** 2 * 1.2 < 3.3)) & ~(n[:, 2] > 0.5)
        w &= np.abs(u) < np.where(front | back, hx, hy) - 2.5
        islit = hash3(np.floor((u + 40) / 7.0), 1, 2, 92) < lit
        r = np.where(w, np.where(islit, RID['gold'], RID['glass']), r); t = np.where(w, np.where(islit, 2.8, 1.4 + (z - 5) * 0.08), t)
        door = front & (np.abs(x) < 3.0) & (z < 11.0) & (z > 3.0)
        r = np.where(door, RID['wood'], r); t = np.where(door, 1.6, t)
        return r, t, np.where(w, 0.9, 0.0)

    def entab_m(p, n):
        f = n[:, 1] > 0.5
        txt = f & sign_text(p[:, 0], p[:, 2], 'LIBRARY', 0.0, H - 1.0)
        return np.where(txt, RID['night'], RID['stone']), np.where(txt, 1.8, 3.4), np.zeros(len(p))

    mats = [body_m, solid('stone', 3.1), solid('stone', 3.3), entab_m, solid('white', 3.0), solid('stone', 2.7)]
    return Model(parts, mats, (-hx - 2, hx + 2, -hy - 2, hy + 10, 0, H + 9))


# ------------------------------------------------------------------ fire station
def fire_station(lit=0.0):
    hx, hy, H = 20.0, 14.0, 2 * FH + 2.0

    def parts(P):
        body = rbox(P, (-3.0, 0, H / 2), (hx - 3.0, hy, H / 2), 0.5)
        cornice = rbox(P, (-3.0, 0, H + 0.8), (hx - 2.2, hy + 0.8, 0.8), 0.3)
        tower = rbox(P, (hx - 3.0, -hy + 6.0, 22.0), (3.0, 3.0, 22.0), 0.3)
        cap = rbox(P, (hx - 3.0, -hy + 6.0, 45.0), (3.8, 3.8, 1.0), 0.3)
        apron = rbox(P, (-3.0, hy + 2.5, 0.25), (hx - 4.0, 2.5, 0.25), 0.1)
        lamp = rbox(P, (-3.0, hy + 0.7, 19.0), (12.0, 0.6, 1.8), 0.3)
        return [body, cornice, tower, cap, apron, lamp]

    def body_m(p, n):
        u, span, front, right, back, left = _uv(p, n, hx, hy)
        x, z = p[:, 0], p[:, 2]
        ramp, base = _wall_texture('redbrick', u, z, 101)
        win, r, t = _windows(u, span, z, FH, H - 1.0, lit, 102, ramp, base, n=n)
        # two tall red engine-bay doors with window panels
        for cx in (-13.0, 1.0):
            d = front & (np.abs(x - cx) < 5.6) & (z < 11.0)
            pane = d & (np.abs(z - 8.2) < 1.3) & (np.abs(np.mod(x - cx + 6, 2.8) - 1.4) < 1.0)
            r = np.where(d, RID['red'], r); t = np.where(d, 2.4 + (np.mod(z, 1.6) < 0.5) * 0.5, t)
            r = np.where(pane, RID['glass'], r); t = np.where(pane, 1.6, t)
            frame = front & (np.abs(x - cx) < 6.3) & (np.abs(x - cx) >= 5.6) & (z < 11.7)
            r = np.where(frame, RID['stone'], r); t = np.where(frame, 3.2, t)
        win &= ~(front & (z < FH))
        return r, t, np.where(win, 0.9, 0.0)

    def tower_m(p, n):
        front, right, back, left = _faces(n)
        u = np.where(front | back, p[:, 0], p[:, 1])
        ramp, base = _wall_texture('redbrick', u, p[:, 2], 103)
        slit = (np.abs(u - np.where(front | back, hx - 3.0, -hy + 6.0)) < 0.6) & (np.mod(p[:, 2], 8.0) < 3.5) & (p[:, 2] > 8)
        return np.where(slit, RID['night'], ramp), np.where(slit, 1.4, base), np.zeros(len(p))

    def sign_m(p, n):
        f = n[:, 1] > 0.5
        txt = f & sign_text(p[:, 0], p[:, 2], 'FIRE STATION', -3.0, 19.0)
        return np.where(txt, RID['white'], RID['night']), np.where(txt, 4.4, 1.8), np.zeros(len(p))

    mats = [body_m, solid('stone', 3.1), tower_m, solid('stone', 3.0), solid('lavlt', 2.8), sign_m]
    return Model(parts, mats, (-hx - 2, hx + 2, -hy - 2, hy + 6, 0, 48))


# ------------------------------------------------------------------ round-cornered block
def corner_round(lit=0.0):
    hx, hy, floors = 16.0, 16.0, 5
    H = floors * FH + 2.0
    R = 9.0

    def round_corner(P, grow=0.0):
        # a box whose +x+y corner (the street corner) is a quarter circle of radius R
        x, y = P[:, 0], P[:, 1]
        box = np.maximum(np.abs(x) - (hx + grow), np.abs(y) - (hy + grow))
        cx, cy = hx - R, hy - R
        corner = (x > cx) & (y > cy)
        rd = np.sqrt((x - cx) ** 2 + (y - cy) ** 2) - (R + grow)
        return np.where(corner, np.maximum(box, rd), box)

    def parts(P):
        z = P[:, 2]
        body = np.maximum(round_corner(P), np.abs(z - H / 2) - H / 2)
        cornice = np.maximum(round_corner(P, 1.0), np.abs(z - (H + 0.8)) - 0.8)
        band = np.maximum(round_corner(P, 0.5), np.abs(z - FH) - 0.6)
        awn_z = 10.0
        awning = np.maximum(round_corner(P, 3.0), np.maximum(np.abs(z - awn_z) - 0.5, -round_corner(P, 0.2)))
        plant = rbox(P, (-hx * 0.3, -hy * 0.3, H + 3.0), (4.0, 3.0, 2.0), 0.5)
        return [body, cornice, band, awning, plant]

    def body_m(p, n):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        # facade coordinate wrapping around the curve
        cx, cy = hx - R, hy - R
        on_curve = (x > cx) & (y > cy)
        u = np.where(on_curve, cx + R * np.arctan2(y - cy, x - cx), np.where(np.abs(n[:, 1]) > np.abs(n[:, 0]), x, -y))
        ramp, base = _wall_texture('render_sage', u, z, 111)
        win, rz, _, ci, fi = _grid(u + 40, z, 0.0, FH, 5.2, 3.0, 1.1, FH, 6.8, 2.6)
        win &= (z > FH + 1) & (z < H - 1) & ~(n[:, 2] > 0.5)
        r, t = _glass(win, rz, 6.8, lit, ci, fi, ramp, base, 112)
        sill = (np.abs(np.mod(z - FH, FH) - 2.2) < 0.35) & (z > FH) & ~(n[:, 2] > 0.5)
        r = np.where(sill & ~win, RID['white'], r); t = np.where(sill & ~win, 3.6, t)
        g = (z < FH - 0.5) & (z > 2.0) & ~(n[:, 2] > 0.5) & (np.mod(u + 40, 6.0) < 4.6)
        dlit = lit > 0
        r = np.where(g, RID['gold'] if dlit else RID['glass'], r); t = np.where(g, 3.0 if dlit else 1.4 + (z - 2) * 0.1, t)
        return r, t, np.where(win | g, 0.9, 0.0)

    def awn_m(p, n):
        ang = np.arctan2(p[:, 1], p[:, 0])
        st = np.floor((p[:, 0] + p[:, 1] + ang * 3 + 80) / 2.4) % 2 == 0
        return np.where(st, RID['teal'], RID['white']), np.where(st, 2.6, 3.4), np.zeros(len(p))

    mats = [body_m, solid('white', 3.2), solid('white', 3.0), awn_m, solid('lavlt', 2.6)]
    return Model(parts, mats, (-hx - 4, hx + 4, -hy - 4, hy + 4, 0, H + 6))


# ------------------------------------------------------------------ flower shop
def shop_florist(lit=0.0):
    hx, hy, H = 13.0, 12.0, 12.0

    def parts(P):
        body = rbox(P, (0, -3.0, H / 2), (hx, hy - 3.0, H / 2), 0.4)
        # a glass conservatory on the front with a curved roof
        x, y, z = P[:, 0], P[:, 1], P[:, 2]
        yc = y - (hy - 3.0)
        vault = np.sqrt(np.maximum(yc, 0) ** 2 + np.maximum(z - 8.0, 0) ** 2)
        cons = np.maximum(np.maximum(np.abs(x) - (hx - 1.0), -yc), np.maximum(vault - 6.0, -z))
        cons = np.maximum(cons, z - 14.0)
        buckets = np.full(len(P), 1e3)
        for k, bx in enumerate(np.linspace(-hx + 2, hx - 2, 7)):
            buckets = np.minimum(buckets, cyl_z(P, (bx, hy + 4.4, 1.2), 1.1, 1.2, 0.2))
        blooms = np.full(len(P), 1e3)
        for k, bx in enumerate(np.linspace(-hx + 2, hx - 2, 7)):
            blooms = np.minimum(blooms, rbox(P, (bx, hy + 4.4, 3.2), (1.2, 1.2, 1.0), 1.0))
        board = rbox(P, (0, hy - 2.6, H + 1.6), (hx - 3.0, 0.6, 1.6), 0.3)
        return [body, cons, buckets, blooms, board]

    def body_m(p, n):
        u, span, front, right, back, left = _uv(p, n, hx, hy)
        ramp, base = _wall_texture('render_lav', u, p[:, 2], 121)
        w = ~front & (np.abs(np.mod(u + 40, 7.0) - 3.5) < 2.0) & (p[:, 2] > 4) & (p[:, 2] < 9) & ~(n[:, 2] > 0.5) & (np.abs(u) < span - 2)
        return np.where(w, RID['glass'], ramp), np.where(w, 1.3, base), np.where(w, 0.9, 0.0)

    def glass_m(p, n):
        x, z = p[:, 0], p[:, 2]
        frame = (np.abs(np.mod(x + 40, 4.0) - 2.0) < 0.25) | (z < 1.5) | (np.abs(z - 8.0) < 0.3)
        dlit = lit > 0
        inside = ~frame & (z < 6.0) & (hash3(np.floor(x / 1.5), np.floor(z / 1.5), 1, 122) > 0.45)
        cols = np.array([RID['red'], RID['plum'], RID['khaki'], RID['sage'], RID['white']])
        pick = (hash3(np.floor(x / 1.5), np.floor(z / 1.5), 2, 123) * 5).astype(int) % 5
        r = np.where(frame, RID['white'], np.where(inside, cols[pick], RID['gold'] if dlit else RID['glass']))
        t = np.where(frame, 3.6, np.where(inside, 3.0, 3.0 if dlit else 1.8 + z * 0.08))
        return r, t, np.where(frame, 0.2, 0.9)

    def bloom_m(p, n):
        pick = (hash3(np.floor(p[:, 0] / 3.7), 1, 1, 124) * 4).astype(int) % 4
        cols = np.array([RID['red'], RID['plum'], RID['khaki'], RID['white']])
        dots = hash3(np.floor(p[:, 0] / 0.8), np.floor(p[:, 2] / 0.8), np.floor(p[:, 1] / 0.8), 125) > 0.6
        return np.where(dots, RID['sage'], cols[pick]), np.where(dots, 2.4, 3.2), np.zeros(len(p))

    def board_m(p, n):
        f = n[:, 1] > 0.5
        txt = f & sign_text(p[:, 0], p[:, 2], 'FLOWERS', 0.0, H + 1.6)
        return np.where(txt, RID['white'], RID['sage']), np.where(txt, 4.4, 2.2), np.zeros(len(p))

    mats = [body_m, glass_m, solid('lavlt', 2.4), bloom_m, board_m]
    return Model(parts, mats, (-hx - 2, hx + 2, -hy - 2, hy + 7, 0, H + 6))


# name: (factory(lit), footprint half extents in model units (hx, hy), height in model units)
SPECS = {
    'shop_diner': (shop_diner, (20, 10), 22),
    'cinema': (cinema, (18, 12), 40),
    'chapel': (chapel, (11, 16), 40),
    'deco_office': (deco_office, (20, 17), 92),
    'glass_tower': (glass_tower, (21, 21), 150),
    'brownstones': (brownstones, (24, 12), 39),
    'parking_garage': (parking_garage, (26, 18), 38),
    'hotel': (hotel, (17, 13), 102),
    'library': (library, (22, 15), 30),
    'fire_station': (fire_station, (20, 14), 30),
    'corner_round': (corner_round, (16, 16), 62),
    'shop_florist': (shop_florist, (13, 12), 14),
}

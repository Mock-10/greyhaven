"""Furniture and decoration for the Phase 2 job interiors (M7): Torque & Sons garage, Swiftish Couriers depot,
Ashby Timber site trailer. Same SDF style and conventions as decor.py.

FACING CONVENTION (all models in this file):
  * The FRONT of every model faces local +y (the side a person uses / looks at).
  * Floor items: origin = footprint centre on the floor.
  * Wall-mounted items: origin = centre of the back plate ON the wall plane; the item sticks out toward local +y.
  * Use decor.face('+x' | '-x' | '+y' | '-y') to get the render angle that points the front at that world direction.
Gold stays reserved for valuables and interactables: nothing in this file uses the gold ramp.
"""
import numpy as np
from sdf import Model, ell, capsule, rbox, cyl_z, cyl_y, smin, solid, RID, hash3
import cars


def M(parts, mats, bbox):
    return Model(parts, mats, bbox)


def cyl_x(P, c, r, hh, rr=0.0):
    """Rounded cylinder with its axis along x."""
    return cyl_z(P[:, [1, 2, 0]], (c[1], c[2], c[0]), r, hh, rr)


def _tread(axis, c, r_hub=3.6):
    """Tyre material: dark rubber tread, a light hub disc on the flat faces."""
    def m(p, n):
        q = p - np.asarray(c, float)
        if axis == 'z':
            r = np.hypot(q[:, 0], q[:, 1]); flat = np.abs(n[:, 2]) > 0.7
        elif axis == 'x':
            r = np.hypot(q[:, 1], q[:, 2]); flat = np.abs(n[:, 0]) > 0.7
        else:
            r = np.hypot(q[:, 0], q[:, 2]); flat = np.abs(n[:, 1]) > 0.7
        hub = flat & (r < r_hub)
        ramp = np.where(hub, RID['lavlt'], RID['asph'])
        base = np.where(hub, 2.8 + (r < 1.2) * 0.8 - ((r > 2.3) & (r < 2.8)) * 1.0, 1.0 + flat * 0.4)
        return ramp, base, np.where(hub, 0.6, 0.0)
    return m


# ======================================================================= shared: lockers, clock, boards, posters
def lockers(n=4, color=('teal', 2.4)):
    """A bank of tall staff lockers, doors on the front (+y): vents, a number plate and a handle each."""
    w = 9.0
    L = n * w

    def parts(P):
        body = np.full(len(P), 1e3)
        for k in range(n):
            x = -L / 2 + w / 2 + k * w
            body = np.minimum(body, rbox(P, (x, 0, 25), (w / 2 - 0.25, 5, 22), 0.4))
        plinth = rbox(P, (0, -0.5, 1.5), (L / 2, 4.5, 1.5), 0.3)
        cap = rbox(P, (0, 0, 47.4), (L / 2 + 0.3, 5.3, 0.6), 0.3)
        return [body, plinth, cap]

    def dm(p, n_):
        x, z = p[:, 0], p[:, 2]
        front = n_[:, 1] > 0.5
        u = np.mod(x + L / 2, w)
        vent = front & (z > 38) & (z < 43) & (np.abs(u - w / 2) < 2.6) & (np.mod(z, 1.2) < 0.5)
        plate = front & (np.abs(u - w / 2) < 1.4) & (np.abs(z - 35) < 0.8)
        handle = front & (np.abs(u - (w - 2.2)) < 0.5) & (np.abs(z - 25) < 2.6)
        r = np.where(plate, RID['white'], np.where(handle, RID['night'], RID[color[0]]))
        b = np.where(plate, 4.2, np.where(handle, 1.6, np.where(vent, color[1] - 1.1, color[1])))
        return r, b, np.full(len(p), 0.35)
    return M(parts, [dm, solid('night', 1.8), solid(color[0], color[1] + 0.6)], (-L / 2 - 1, L / 2 + 1, -6, 6, 0, 48.5))


def locker_bench(length=30):
    """Slatted changing-room bench on two steel legs."""
    L = length

    def parts(P):
        seat = rbox(P, (0, 0, 8.5), (L / 2, 3.6, 0.8), 0.4)
        legs = np.minimum.reduce([rbox(P, (sx, 0, 4), (0.8, 3, 4), 0.2) for sx in (-L / 2 + 3, L / 2 - 3)])
        return [seat, legs]

    def sm(p, n):
        gap = np.mod(p[:, 1] + 10, 2.4) < 0.35
        return np.full(len(p), RID['wood']), 2.8 - gap * 1.0, np.zeros(len(p))
    return M(parts, [sm, solid('lavlt', 2.2, 0.4)], (-L / 2 - 1, L / 2 + 1, -5, 5, 0, 10))


def time_clock():
    """Wall-mounted punch clock with a rack of time cards beside it (CLOCK IN)."""
    def parts(P):
        box = rbox(P, (0, 1.8, 36), (4.2, 1.8, 5.2), 0.6)
        rack = rbox(P, (9, 0.6, 33), (3.2, 0.6, 8), 0.3)
        cards = np.minimum.reduce([rbox(P, (9 + dx, 1.2, z), (0.9, 0.4, 2.4), 0.1) for z in (37.5, 31.5, 25.5) for dx in (-1.4, 1.2)])
        return [box, rack, cards]

    def bm(p, n):
        x, z = p[:, 0], p[:, 2]
        front = n[:, 1] > 0.5
        dial = front & (np.hypot(x, z - 38) < 2.6)
        hand = dial & (((np.abs(x) < 0.35) & (z > 38)) | ((np.abs(z - 38) < 0.35) & (x > 0)))
        slot = front & (np.abs(x) < 2.4) & (np.abs(z - 33) < 0.45)
        r = np.where(dial, RID['white'], np.where(slot, RID['night'], RID['stone']))
        b = np.where(hand, 1.4, np.where(dial, 4.4, np.where(slot, 1.2, 2.8)))
        return r, b, np.where(dial, 0.6, 0.2)

    def cm(p, n):
        k = hash3(np.floor(p[:, 0] / 1.3), np.floor(p[:, 2] / 6), 1, 4)
        return np.where(k > 0.6, RID['khaki'], RID['white']), 3.8 + np.zeros(len(p)), np.zeros(len(p))
    return M(parts, [bm, solid('lavlt', 2.0), cm], (-6, 14, -1, 5, 23, 43))


def wall_map(kind='route', w=28, h=18):
    """Framed wall map. 'route': street grid with a delivery route and pins; 'forest': felling plots and tracks."""
    zc = 36.0

    def parts(P):
        return [rbox(P, (0, 0.6, zc), (w / 2 + 1, 0.6, h / 2 + 1), 0.3)]

    def m(p, n):
        x, z = p[:, 0], p[:, 2] - zc
        front = n[:, 1] > 0.5
        rim = front & ((np.abs(x) > w / 2 - 0.2) | (np.abs(z) > h / 2 - 0.2))
        N = len(p)
        if kind == 'route':
            ramp = np.full(N, RID['stone']); base = np.full(N, 4.0)
            street = (np.abs(np.mod(x + 3 * np.sin(z * 0.25), 7.0) - 3.5) < 0.45) | (np.abs(np.mod(z, 6.0) - 3.0) < 0.45)
            block = hash3(np.floor((x + 40) / 7.0), np.floor((z + 40) / 6.0), 1, 2) > 0.7
            route = (np.abs(z - (-3 + 0.35 * x)) < 0.55) & (x > -w / 2 + 3) & (x < w / 2 - 3)
            ramp = np.where(block, RID['sage'], ramp); base = np.where(block, 3.0, base)
            ramp = np.where(street, RID['white'], ramp); base = np.where(street, 4.6, base)
            ramp = np.where(route, RID['navy'], ramp); base = np.where(route, 2.4, base)
        else:
            ramp = np.full(N, RID['sage']); base = 2.6 + (hash3(np.floor((x + 40) / 2.2), np.floor((z + 40) / 2.2), 1, 5) > 0.5) * 0.5
            plot = (np.abs(np.mod(x + 40, 9.0) - 4.5) > 3.9) | (np.abs(np.mod(z + 40, 7.0) - 3.5) > 3.0)
            clear = hash3(np.floor((x + 40) / 9.0), np.floor((z + 40) / 7.0), 1, 8) > 0.66
            track = np.abs(z - 2.5 * np.sin(x * 0.3) + 1) < 0.55
            ramp = np.where(clear, RID['khaki'], ramp); base = np.where(clear, 3.8, base)
            ramp = np.where(plot, RID['night'], ramp); base = np.where(plot, 2.2, base)
            ramp = np.where(track, RID['clay'], ramp); base = np.where(track, 3.2, base)
        pins = np.zeros(N, bool)
        for k in range(5):
            px = (hash3(np.array([k]), 1, 1, 11)[0] - 0.5) * (w - 6)
            pz = (hash3(np.array([k]), 2, 1, 11)[0] - 0.5) * (h - 5)
            pins |= np.hypot(x - px, z - pz) < 0.9
        ramp = np.where(front & pins, RID['red'], ramp); base = np.where(front & pins, 3.6, base)
        ramp = np.where(rim | ~front, RID['wood'], ramp); base = np.where(rim | ~front, 1.8, base)
        return ramp, base, np.zeros(N)
    return M(parts, [m], (-w / 2 - 2, w / 2 + 2, -1, 3, zc - h / 2 - 2, zc + h / 2 + 2))


def wall_poster(color='red', w=10, h=14, seed=1, zc=38.0):
    """Plain printed poster (no gold): a colour field, a white headline bar and text lines."""
    def parts(P):
        return [rbox(P, (0, 0.25, zc), (w / 2, 0.25, h / 2), 0.1)]

    def m(p, n):
        x, z = p[:, 0], p[:, 2] - zc
        head = np.abs(z - h * 0.3) < 1.2
        lines = (z < 0) & (z > -h / 2 + 1.5) & (np.mod(z, 1.8) < 0.6) & (np.abs(x) < w / 2 - 1.5 - hash3(np.floor(z / 1.8), 1, 1, seed) * 2)
        pic = (np.abs(x) < w / 2 - 1.6) & (z > 0.6) & (z < h * 0.3 - 1.6)
        r = np.where(head | lines, RID['white'], np.where(pic, RID['night'], RID[color]))
        b = np.where(head, 4.4, np.where(lines, 3.8, np.where(pic, 2.6, 3.0)))
        return r, b, np.zeros(len(p))
    return M(parts, [m], (-w / 2 - 1, w / 2 + 1, -1, 2, zc - h / 2 - 1, zc + h / 2 + 1))


def sign_board(w=40, color='navy', zc=50.0):
    """Company name board high on the wall: dark plate, a light lettering strip and a stripe."""
    def parts(P):
        return [rbox(P, (0, 0.6, zc), (w / 2, 0.6, 3.6), 0.3)]

    def m(p, n):
        x, z = p[:, 0], p[:, 2] - zc
        letters = (np.abs(z - 0.6) < 1.4) & (np.abs(x) < w / 2 - 3) & (np.mod(x + 40, 3.0) < 2.0) & (hash3(np.floor((x + 40) / 3.0), 1, 1, 6) > 0.15)
        stripe = np.abs(z + 2.2) < 0.5
        r = np.where(letters | stripe, RID['white'], RID[color])
        b = np.where(letters, 4.6, np.where(stripe, 3.6, 2.2))
        return r, b, np.zeros(len(p))
    return M(parts, [m], (-w / 2 - 1, w / 2 + 1, -1, 2, zc - 5, zc + 5))


def first_aid():
    """Wall-mounted first-aid box: white with a red cross."""
    def parts(P):
        return [rbox(P, (0, 1.4, 34), (4, 1.4, 3.6), 0.5)]

    def m(p, n):
        x, z = p[:, 0], p[:, 2] - 34
        front = n[:, 1] > 0.5
        cross = front & (((np.abs(x) < 0.8) & (np.abs(z) < 2.2)) | ((np.abs(z) < 0.8) & (np.abs(x) < 2.2)))
        return np.where(cross, RID['red'], RID['white']), np.where(cross, 3.2, 4.0), np.zeros(len(p))
    return M(parts, [m], (-5, 5, -1, 4, 29, 39))


def hose_reel():
    """Wall-mounted air-hose reel with a coiled red hose."""
    def parts(P):
        plate = rbox(P, (0, 0.5, 36), (3.4, 0.5, 3.4), 0.3)
        drum = cyl_y(P, (0, 2.6, 36), 3.2, 1.6, 0.5)
        coil = cyl_y(P, (0, 2.6, 36), 4.0, 1.2, 0.8)
        drop = capsule(P, (2.4, 3.2, 32), (3, 3.6, 22), 0.5)
        return [plate, drum, coil, drop]
    return M(parts, [solid('night', 2.0), solid('lavlt', 2.6, 0.4), solid('red', 2.4), solid('red', 2.2)], (-6, 6, -1, 6, 20, 41))


# ======================================================================= garage (Torque & Sons)
def lift_post():
    """One post of a two-post car lift with its two swing arms. Arms reach toward local +y (the car).
    Place one on each side of the car, facing it, so the far post sorts behind the car and the near one in front."""
    def parts(P):
        post = rbox(P, (0, 0, 27), (3.2, 3.6, 27), 0.5)
        plate = rbox(P, (0, 1, 0.6), (5.5, 6.5, 0.6), 0.3)
        carriage = rbox(P, (0, 4.2, 12), (2.6, 1.2, 3.2), 0.4)
        arms = np.minimum(capsule(P, (0, 4.5, 11), (-16, 22, 11), 1.1), capsule(P, (0, 4.5, 11), (16, 22, 11), 1.1))
        pads = np.minimum(cyl_z(P, (-16, 22, 12), 2.2, 0.8, 0.3), cyl_z(P, (16, 22, 12), 2.2, 0.8, 0.3))
        ctrl = rbox(P, (3.6, 2.2, 32), (0.8, 1.6, 3), 0.3)
        return [post, plate, carriage, arms, pads, ctrl]

    def pm(p, n):
        z = p[:, 2]
        slot = (n[:, 1] > 0.5) & (np.abs(p[:, 0]) < 1.0) & (z > 6) & (z < 50)
        return np.full(len(p), RID['navy']), np.where(slot, 1.4, 2.6), np.full(len(p), 0.3)

    def cm(p, n):
        btn = (n[:, 0] > 0.5) & (np.abs(p[:, 2] - 33) < 1.6)
        return np.where(btn, RID['red'], RID['night']), np.where(btn, 3.6, 2.0), np.zeros(len(p))
    return M(parts, [pm, solid('night', 1.8), solid('lavlt', 2.4), solid('lavlt', 2.8, 0.5), solid('night', 1.4), cm],
             (-18, 18, -5, 25.5, 0, 55))


def lifted_car(color=('teal', 2.6)):
    """A customer's sedan for the lift (place with wz = lift height) or the spray booth."""
    return cars.sedan(color)


def masked_car(color=('sage', 2.4)):
    """Sedan in the spray booth: grey primer panels and masking paper over the glass."""
    base = cars.sedan(color)
    mats = list(base.mats)
    body, cabin = mats[0], mats[1]

    def bm(p, n):
        r, b, s = body(p, n)
        primer = (p[:, 0] > 8) & (np.abs(n[:, 2]) < 0.8) & (r == RID[color[0]])
        return np.where(primer, RID['stone'], r), np.where(primer, 2.8, b), np.where(primer, 0.0, s)

    def gm(p, n):
        r, b, s = cabin(p, n) if callable(cabin) else (np.full(len(p), RID[cabin[0]]), np.full(len(p), cabin[1]), np.full(len(p), cabin[2]))
        paper = r == RID['glass']
        crease = np.mod(p[:, 0] * 0.7 + p[:, 2], 4.0) < 0.6
        return np.where(paper, RID['khaki'], r), np.where(paper, 3.8 - crease * 0.8, b), np.where(paper, 0.0, s)
    mats[0], mats[1] = bm, gm
    return Model(base.parts, mats, base.bbox)


def workbench(length=44):
    """Steel-framed workbench with a wood top, a vice, a lower shelf and tools lying out. Front (+y) is the work side."""
    L = length

    def parts(P):
        top = rbox(P, (0, 0, 17), (L / 2, 7, 1.0), 0.4)
        legs = np.minimum.reduce([rbox(P, (sx, sy, 8), (0.8, 0.8, 8), 0.2) for sx in (-L / 2 + 2, L / 2 - 2) for sy in (-5.5, 5.5)])
        shelf = rbox(P, (0, 0, 4), (L / 2 - 1, 6, 0.5), 0.2)
        vice = np.minimum(rbox(P, (L / 2 - 6, 4, 19.6), (3, 2.4, 1.6), 0.4), rbox(P, (L / 2 - 6, 7.6, 19.6), (2.4, 0.8, 1.4), 0.3))
        tools = np.minimum.reduce([capsule(P, (-12, 2, 18.4), (-4, 4, 18.4), 0.5), capsule(P, (-6, -2, 18.4), (2, -4, 18.4), 0.6),
                                   rbox(P, (6, 0, 18.6), (2.4, 1.6, 0.8), 0.3)])
        rag = ell(P, (-15, -3, 18.2), (2.6, 2.0, 0.6))
        boxes = np.minimum(rbox(P, (-L / 2 + 8, 0, 6.8), (5, 4.5, 2.4), 0.4), rbox(P, (6, 0, 6.2), (4, 4, 1.8), 0.4))
        return [top, legs, shelf, vice, tools, rag, boxes]
    return M(parts, [solid('wood', 2.6), solid('lavlt', 2.2), solid('lavlt', 2.0), solid('navy', 2.2, 0.5), solid('night', 2.2, 0.6),
                     solid('clay', 2.8), solid('red', 2.2)], (-L / 2 - 1, L / 2 + 1, -8, 10, 0, 22))


def pegboard(w=32, h=18):
    """Wall pegboard with tool silhouettes: spanners, a hammer, screwdrivers, a saw."""
    zc = 36.0

    def parts(P):
        board = rbox(P, (0, 0.5, zc), (w / 2, 0.5, h / 2), 0.2)
        tools = np.full(len(P), 1e3)
        for k in range(5):
            x = -w / 2 + 3 + k * 1.6
            tools = np.minimum(tools, capsule(P, (x, 1.3, zc + 5), (x, 1.3, zc - 1 - k * 0.8), 0.45))
        tools = np.minimum(tools, capsule(P, (-3, 1.3, zc + 6), (-3, 1.3, zc - 4), 0.5))
        tools = np.minimum(tools, rbox(P, (-3, 1.5, zc + 5.5), (2.2, 0.6, 1.0), 0.3))
        for k, x in enumerate((3, 5.5, 8)):
            tools = np.minimum(tools, capsule(P, (x, 1.3, zc + 2), (x, 1.3, zc - 5), 0.35))
        tools = np.minimum(tools, rbox(P, (w / 2 - 4, 1.2, zc + 1), (2.2, 0.4, 5), 0.2))
        handles = np.minimum.reduce([rbox(P, (x, 1.6, zc + 3.5), (0.7, 0.6, 1.6), 0.3) for x in (3, 5.5, 8)])
        return [board, tools, handles]

    def bm(p, n):
        x, z = p[:, 0], p[:, 2]
        hole = (np.mod(x + 40, 2.0) < 0.6) & (np.mod(z, 2.0) < 0.6)
        return np.full(len(p), RID['clay']), 2.8 - hole * 1.0, np.zeros(len(p))
    return M(parts, [bm, solid('lavlt', 2.4, 0.6), solid('red', 2.8)], (-w / 2 - 1, w / 2 + 1, -1, 3, zc - h / 2 - 1, zc + h / 2 + 1))


def tool_chest(color='red'):
    """Rolling tool cabinet with a top chest; drawers on the front (+y)."""
    def parts(P):
        body = rbox(P, (0, 0, 11.5), (10, 6, 9.5), 0.6)
        chest = rbox(P, (0, -0.5, 25.5), (9.5, 5, 4.5), 0.6)
        casters = np.minimum.reduce([cyl_y(P, (sx, sy, 1.0), 1.0, 0.6, 0.2) for sx in (-8, 8) for sy in (-4.5, 4.5)])
        handles = np.minimum.reduce([rbox(P, (0, 6.3, z), (6, 0.4, 0.3), 0.15) for z in (19, 15.5, 12, 8.5, 5)] +
                                    [rbox(P, (0, 4.8, z), (5.5, 0.4, 0.3), 0.15) for z in (28, 24.5)])
        return [body, chest, casters, handles]

    def dm(p, n):
        front = n[:, 1] > 0.5
        z = p[:, 2]
        seam = front & ((np.mod(z - 3.25, 3.5) < 0.4) | (np.mod(z - 22.75, 3.5) < 0.4))
        return np.full(len(p), RID[color]), 2.4 - seam * 1.0, np.full(len(p), 0.4)
    return M(parts, [dm, dm, solid('night', 1.4), solid('lavlt', 3.4, 0.8)], (-11, 11, -8, 8, 0, 31))


def diag_cart():
    """Diagnostic scan cart: a monitor showing a trace, a code reader and a cable bundle. Screen faces +y."""
    def parts(P):
        shelves = np.minimum.reduce([rbox(P, (0, 0, z), (6.5, 5, 0.5), 0.3) for z in (3, 14)])
        posts = np.minimum.reduce([rbox(P, (sx, sy, 8), (0.5, 0.5, 7.5), 0.2) for sx in (-6, 6) for sy in (-4.5, 4.5)])
        wheels = np.minimum.reduce([cyl_y(P, (sx, sy, 1.0), 1.0, 0.5, 0.2) for sx in (-5.5, 5.5) for sy in (-4, 4)])
        mon = rbox(P, (0, -1, 21), (5.5, 1.0, 4.2), 0.4)
        stand = rbox(P, (0, -1.6, 16), (1, 1, 1.6), 0.3)
        reader = rbox(P, (3.5, 3, 15.2), (1.6, 2.4, 0.6), 0.3)
        cable = np.minimum(cyl_z(P, (-3, 1.5, 4.6), 3.0, 1.0, 0.8), capsule(P, (-5.5, 4, 4.6), (-7, 7, 0.6), 0.5))
        return [shelves, posts, wheels, mon, stand, reader, cable]

    def mm(p, n):
        x, z = p[:, 0], p[:, 2] - 21
        scr = (n[:, 1] > 0.5) & (np.abs(x) < 4.6) & (np.abs(z) < 3.3)
        trace = scr & (np.abs(z - 1.6 * np.sin(x * 1.4)) < 0.45)
        r = np.where(trace, RID['sage'], np.where(scr, RID['night'], RID['lavlt']))
        b = np.where(trace, 4.8, np.where(scr, 1.2, 2.4))
        return r, b, np.where(scr, 1.0, 0.2)
    return M(parts, [solid('red', 2.4), solid('lavlt', 2.4), solid('night', 1.4), mm, solid('night', 2.0), solid('teal', 2.6), solid('night', 1.8)],
             (-9, 9, -7, 9, 0, 27))


def floor_jack():
    """Low trolley jack with its long handle raised toward the back."""
    def parts(P):
        body = rbox(P, (0, 2, 3), (3.6, 7, 2.4), 0.8)
        saddle = cyl_z(P, (0, 8, 5.8), 1.8, 0.6, 0.2)
        wheels = np.minimum.reduce([cyl_x(P, (sx, sy, 1.2), 1.2, 0.6, 0.2) for sx in (-3.6, 3.6) for sy in (-3.5, 7.5)])
        handle = capsule(P, (0, -4, 3.6), (0, -12, 12), 0.6)
        return [body, saddle, wheels, handle]
    return M(parts, [solid('red', 2.6, 0.4), solid('night', 2.0), solid('night', 1.4), solid('lavlt', 2.6, 0.4)], (-5, 5, -13, 10, 0, 13))


def creeper():
    """Mechanic's creeper board on casters."""
    def parts(P):
        board = rbox(P, (0, 0, 2.6), (4.5, 10, 0.8), 0.6)
        pad = ell(P, (0, 7.5, 3.6), (3, 2, 0.8))
        casters = np.minimum.reduce([cyl_z(P, (sx, sy, 0.9), 0.9, 0.9, 0.3) for sx in (-3.5, 3.5) for sy in (-8, 8)])
        return [board, pad, casters]
    return M(parts, [solid('navy', 2.2, 0.3), solid('night', 2.2), solid('night', 1.4)], (-6, 6, -12, 12, 0, 5))


def oil_stain(seed=1, size=9.0):
    """Flat dark oil patch on the floor (place with z_bias -300)."""
    def parts(P):
        d = np.full(len(P), 1e3)
        for k in range(4):
            dx = (hash3(np.array([k]), 1, 1, seed)[0] - 0.5) * size
            dy = (hash3(np.array([k]), 2, 1, seed)[0] - 0.5) * size * 0.7
            r = size * (0.35 + hash3(np.array([k]), 3, 1, seed)[0] * 0.3)
            d = np.minimum(d, ell(P, (dx, dy, 0.1), (r, r * 0.8, 0.25)))
        return [d]

    def m(p, n):
        k = hash3(np.floor(p[:, 0] / 1.5), np.floor(p[:, 1] / 1.5), 1, seed)
        return np.full(len(p), RID['asph']), 1.6 + k * 0.6, np.full(len(p), 0.6)
    return M(parts, [m], (-size * 1.2, size * 1.2, -size, size, 0, 0.5))


def drain_pan():
    """Round oil drain pan."""
    def parts(P):
        pan = np.maximum(cyl_z(P, (0, 0, 1.2), 5, 1.2, 0.4), -cyl_z(P, (0, 0, 2.0), 4.2, 1.0, 0.3))
        oil = cyl_z(P, (0, 0, 1.0), 4.2, 0.2, 0.1)
        return [pan, oil]
    return M(parts, [solid('lavlt', 2.0, 0.3), solid('asph', 1.4, 0.9)], (-6, 6, -6, 6, 0, 3))


def tyre_stack(n=4, seed=1):
    """Stack of tyres lying flat."""
    def parts(P):
        d = np.full(len(P), 1e3)
        for k in range(n):
            dx = (hash3(np.array([k]), 1, 1, seed)[0] - 0.5) * 1.4
            d = np.minimum(d, cyl_z(P, (dx, dx * 0.6, 2.6 + k * 5.2), 6.6, 2.5, 1.4))
        return [d]
    return M(parts, [_tread('z', (0, 0, 0), 3.2)], (-8, 8, -8, 8, 0, n * 5.2 + 0.5))


def tyre_rack(n=4):
    """Low steel rack with tyres standing upright side by side (tread toward +y)."""
    L = n * 6.2 + 2

    def parts(P):
        rails = np.minimum.reduce([rbox(P, (0, sy, 3), (L / 2, 0.6, 0.6), 0.3) for sy in (-4, 4)])
        legs = np.minimum.reduce([rbox(P, (sx, sy, 1.5), (0.6, 0.6, 1.5), 0.2) for sx in (-L / 2 + 1, L / 2 - 1) for sy in (-4, 4)])
        tyres = np.minimum.reduce([cyl_x(P, (-L / 2 + 4.1 + k * 6.2, 0, 9.6), 6.6, 2.5, 1.4) for k in range(n)])
        return [rails, legs, tyres]
    return M(parts, [solid('lavlt', 2.4), solid('lavlt', 2.0), _tread('x', (0, 0, 9.6), 3.4)], (-L / 2 - 1, L / 2 + 1, -8, 8, 0, 17))


def tyre_changer():
    """Tyre changing machine: base cabinet, turntable with a tyre on it, the rear column and mount head. Pedals at the front (+y)."""
    def parts(P):
        base = rbox(P, (0, 0, 9), (7, 7, 9), 0.8)
        table = cyl_z(P, (0, 1, 18.6), 5.5, 0.6, 0.3)
        tyre = cyl_z(P, (0, 1, 21.6), 6.6, 2.5, 1.4)
        column = rbox(P, (0, -7.5, 21), (2, 2, 21), 0.5)
        arm = capsule(P, (0, -7.5, 38), (0, 0, 38), 1.0)
        head = capsule(P, (0, 0, 38), (0, 0.5, 26), 0.8)
        pedals = np.minimum.reduce([rbox(P, (x, 7.6, 1), (1, 1.6, 0.6), 0.3) for x in (-3, 0, 3)])
        return [base, table, tyre, column, arm, head, pedals]
    return M(parts, [solid('red', 2.4, 0.3), solid('lavlt', 3.0, 0.6), _tread('z', (0, 1, 21.6), 3.4), solid('red', 2.2, 0.3),
                     solid('lavlt', 2.6, 0.5), solid('night', 1.8), solid('night', 1.6)], (-9, 9, -10, 10, 0, 40))


def air_compressor():
    """Upright-tank workshop compressor: tank, motor, gauge and a coiled hose."""
    def parts(P):
        tank = cyl_z(P, (0, -1, 13), 5, 12, 2.5)
        motor = rbox(P, (0, 2.5, 27), (4, 3, 2.6), 0.8)
        gauge = cyl_y(P, (2.5, 4.6, 20), 1.4, 0.4, 0.2)
        hose = cyl_z(P, (-4.5, 3.5, 2), 3.2, 1.2, 0.9)
        feet = rbox(P, (0, -1, 0.5), (5.5, 5.5, 0.5), 0.2)
        return [tank, motor, gauge, hose, feet]
    return M(parts, [solid('red', 2.6, 0.5), solid('night', 2.0), solid('white', 4.0, 0.6), solid('navy', 2.2), solid('night', 1.6)], (-8, 7, -7, 7, 0, 30))


def paint_station():
    """Paint mixing bench for the spray booth: tins in several colours, a mixing scale and a spray gun on its hook."""
    def parts(P):
        top = rbox(P, (0, 0, 15), (11, 6, 0.8), 0.3)
        legs = np.minimum.reduce([rbox(P, (sx, sy, 7), (0.7, 0.7, 7), 0.2) for sx in (-10, 10) for sy in (-5, 5)])
        tins = np.minimum.reduce([cyl_z(P, (x, y, 17.6), 1.6, 1.8, 0.3) for x, y in ((-8, -2), (-4.5, -2.5), (-6, 1.6), (-2, 1))])
        scale = rbox(P, (3, 1, 16.4), (2.4, 2.4, 0.6), 0.3)
        gun = np.minimum(capsule(P, (8, 2, 17), (8, 2, 21), 0.6), smin(capsule(P, (8, 2, 21), (8, 5, 22), 0.7), cyl_z(P, (8, 1.4, 23.2), 1.3, 1.2, 0.3), 0.4))
        cans = np.minimum.reduce([cyl_z(P, (x, -2, 5.6), 2.2, 2.4, 0.4) for x in (-6, -1, 4)])
        return [top, legs, tins, scale, gun, cans]

    def tm(p, n):
        k = hash3(np.floor((p[:, 0] + 20) / 3.5), np.floor((p[:, 1] + 10) / 3.5), 1, 3)
        r = np.array([RID['red'], RID['navy'], RID['sage'], RID['white'], RID['plum']])[(k * 5).astype(int) % 5]
        lid = n[:, 2] > 0.6
        return np.where(lid, RID['lavlt'], r), np.where(lid, 3.6, 2.8), np.full(len(p), 0.4)
    return M(parts, [solid('lavlt', 2.6), solid('lavlt', 2.0), tm, solid('white', 3.6), solid('night', 2.2, 0.5), tm], (-12, 12, -7, 7, 0, 25))


def booth_fan():
    """Wall-mounted extractor grille of the spray booth."""
    zc = 42.0

    def parts(P):
        ring = cyl_y(P, (0, 1.2, zc), 9, 1.2, 0.5)
        hub = cyl_y(P, (0, 2.4, zc), 2, 0.6, 0.3)
        return [ring, hub]

    def gm(p, n):
        x, z = p[:, 0], p[:, 2] - zc
        r = np.hypot(x, z)
        front = n[:, 1] > 0.5
        grille = front & (r < 7.8) & (np.mod(r, 1.6) < 0.55)
        hole = front & (r < 7.8) & ~grille
        return np.where(hole, RID['night'], RID['white']), np.where(hole, 1.2, np.where(grille, 3.4, 3.0)), np.zeros(len(p))
    return M(parts, [gm, solid('lavlt', 2.6)], (-10, 10, -1, 4, zc - 10, zc + 10))


def filter_panels(w=40):
    """Wall-mounted intake filter panels with strip lights above (spray booth walls)."""
    zc = 32.0

    def parts(P):
        panel = rbox(P, (0, 0.4, zc), (w / 2, 0.4, 12), 0.2)
        light = rbox(P, (0, 1.0, zc + 15), (w / 2 - 2, 1.0, 1.0), 0.4)
        return [panel, light]

    def m(p, n):
        x, z = p[:, 0], p[:, 2] - zc
        seam = (np.mod(x + 40, 10.0) < 0.6) | (np.abs(z) > 11.2)
        return np.full(len(p), RID['white']), np.where(seam, 2.6, 3.8 + (np.mod(z, 2.0) < 0.5) * -0.3), np.zeros(len(p))
    return M(parts, [m, solid('white', 4.8, 1.0)], (-w / 2 - 1, w / 2 + 1, -1, 3, zc - 13, zc + 17))


def masking_stand():
    """Rolling stand with a roll of masking paper and tape."""
    def parts(P):
        frame = np.minimum(capsule(P, (-6, 0, 1), (-6, 0, 16), 0.6), capsule(P, (6, 0, 1), (6, 0, 16), 0.6))
        feet = np.minimum(rbox(P, (-6, 0, 0.8), (1, 4, 0.6), 0.2), rbox(P, (6, 0, 0.8), (1, 4, 0.6), 0.2))
        roll = cyl_x(P, (0, 0.6, 14), 2.6, 5.4, 0.4)
        sheet = rbox(P, (0, 2.8, 9.5), (5.2, 0.2, 4.5), 0.1)
        return [frame, feet, roll, sheet]
    return M(parts, [solid('lavlt', 2.4, 0.4), solid('night', 1.8), solid('khaki', 3.6), solid('khaki', 3.9)], (-8, 8, -5, 5, 0, 18))


def engine_stand():
    """An engine block bolted to a rolling stand, mid-rebuild, with its rocker cover off."""
    def parts(P):
        legs = np.minimum(capsule(P, (0, -6, 1), (0, 6, 1), 0.8), capsule(P, (-6, 0, 1), (6, 0, 1), 0.8))
        post = capsule(P, (0, -4, 1), (0, -4, 16), 1.0)
        casters = np.minimum.reduce([cyl_z(P, (x, y, 0.8), 0.8, 0.8, 0.3) for x, y in ((0, -6), (0, 6), (-6, 0), (6, 0))])
        block = rbox(P, (0, 1, 17), (5.5, 5, 5), 1.0)
        head = rbox(P, (0, 1, 23.4), (4.6, 4.2, 1.4), 0.6)
        pulley = cyl_y(P, (0, 6.6, 15), 2.4, 0.6, 0.3)
        return [legs, post, casters, block, head, pulley]

    def bm(p, n):
        fin = np.mod(p[:, 2], 2.0) < 0.6
        return np.full(len(p), RID['lavlt']), 2.2 - fin * 0.6, np.full(len(p), 0.5)
    return M(parts, [solid('red', 2.4), solid('red', 2.6), solid('night', 1.4), bm, solid('night', 2.4, 0.4), solid('night', 1.8)],
             (-8, 8, -8, 9, 0, 26))


# ======================================================================= depot (Swiftish Couriers)
def _parcel_mat(seed):
    def m(p, n):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        k = hash3(np.floor((x + 60) / 3.3), np.floor((z + 2) / 4.4), np.floor((y + 20) / 6), seed)
        top = n[:, 2] > 0.5
        tape = top & (np.abs(np.mod(x + 60, 6.6) - 3.3) < 0.5)
        label = (np.abs(n[:, 1]) > 0.5) & (np.abs(np.mod(x + 60, 6.6) - 2.0) < 1.0) & (np.abs(np.mod(z + 2, 4.4) - 2.2) < 0.8) & (k > 0.35)
        r = np.where(label, RID['white'], np.where(k > 0.85, RID['white'], np.where(k > 0.6, RID['khaki'], RID['clay'])))
        b = np.where(label, 4.4, np.where(k > 0.85, 3.4, 2.4 + top * 0.3 + tape * 0.8 + (k - 0.5) * 0.4))
        return r, b, np.zeros(len(p))
    return m


def parcels(n=5, seed=1, spread=8.0):
    """A loose pile of parcels of different sizes, taped, some with white labels."""
    def parts(P):
        d = np.full(len(P), 1e3)
        for k in range(n):
            h_ = lambda j: hash3(np.array([k]), j, 1, seed)[0]
            w, dd, hh = 2.4 + h_(1) * 2.6, 2.0 + h_(2) * 2.4, 1.6 + h_(3) * 2.4
            cx, cy = (h_(4) - 0.5) * spread * 2 * (0.9 if k else 0.2), (h_(5) - 0.5) * spread * 1.4 * (0.9 if k else 0.2)
            z0 = 0.0
            if k >= n - 2 and n > 3:          # the last ones sit on top of the pile
                z0, cx, cy = 3.6, cx * 0.4, cy * 0.4
            d = np.minimum(d, rbox(P, (cx, cy, z0 + hh), (w, dd, hh), 0.35))
        return [d]
    return M(parts, [_parcel_mat(seed)], (-spread - 6, spread + 6, -spread - 5, spread + 5, 0, 14))


def parcel_rack(length=40, seed=2):
    """Tall pallet racking (navy uprights, clay beams) loaded with parcels on three levels plus the floor."""
    L = length

    def parts(P):
        ups = np.minimum.reduce([rbox(P, (sx, sy, 25), (0.8, 0.8, 25), 0.2) for sx in (-L / 2 + 1, L / 2 - 1) for sy in (-6, 6)])
        brace = np.minimum.reduce([capsule(P, (sx, -6, z), (sx, 6, z + 8), 0.3) for sx in (-L / 2 + 1, L / 2 - 1) for z in (4, 20, 36)])
        beams = np.minimum.reduce([rbox(P, (0, sy, z), (L / 2 - 1, 0.6, 1.0), 0.2) for sy in (-6, 6) for z in (15, 30, 45)])
        decks = np.minimum.reduce([rbox(P, (0, 0, z + 1.1), (L / 2 - 1.2, 6, 0.2), 0.1) for z in (15, 30, 45)])
        boxes = np.full(len(P), 1e3)
        for s_, z in enumerate((0.2, 16.3, 31.3)):
            x, k = -L / 2 + 2.5, 0
            while x < L / 2 - 4:
                hv = lambda j: hash3(np.array([k]), np.array([s_]), j, seed)[0]
                w = 3.2 + hv(1) * 4.2
                h = 4 + hv(2) * 7.5
                if hv(3) > 0.15 and x + w < L / 2 - 2:
                    boxes = np.minimum(boxes, rbox(P, (x + w / 2, (hv(4) - 0.5) * 2, z + h / 2), (w / 2 - 0.25, 4.6, h / 2), 0.35))
                    if hv(5) > 0.6 and h < 8:
                        boxes = np.minimum(boxes, rbox(P, (x + w / 2, 0, z + h + 2), (w / 2 - 0.8, 3.6, 2), 0.35))
                x += w + 0.35; k += 1
        return [ups, brace, beams, decks, boxes]
    return M(parts, [solid('navy', 2.4, 0.3), solid('navy', 2.0), solid('clay', 2.8, 0.3), solid('lavlt', 2.2), _parcel_mat(seed)],
             (-L / 2 - 1, L / 2 + 1, -8, 8, 0, 51))


def roll_cage(seed=3, fill=3):
    """Wire roll cage on casters, half full of parcels; the open side faces +y."""
    def parts(P):
        x, y, z = P[:, 0], P[:, 1], P[:, 2]
        base = rbox(P, (0, 0, 2.5), (8, 6, 0.6), 0.3)
        casters = np.minimum.reduce([cyl_z(P, (sx, sy, 1.0), 1.0, 1.0, 0.3) for sx in (-7, 7) for sy in (-5, 5)])
        posts = np.minimum.reduce([rbox(P, (sx, sy, 18), (0.5, 0.5, 15.5), 0.2) for sx in (-7.8, 7.8) for sy in (-5.8, 5.8)])
        wires = np.full(len(P), 1e3)
        for xv in np.arange(-6, 7, 3.0):
            wires = np.minimum(wires, rbox(P, (xv, -5.8, 18), (0.25, 0.25, 15.5), 0.1))
        for zv in np.arange(8, 34, 6.0):
            wires = np.minimum(wires, rbox(P, (0, -5.8, zv), (7.8, 0.25, 0.25), 0.1))
            wires = np.minimum(wires, rbox(P, (-7.8, 0, zv), (0.25, 5.8, 0.25), 0.1))
            wires = np.minimum(wires, rbox(P, (7.8, 0, zv), (0.25, 5.8, 0.25), 0.1))
        boxes = np.full(len(P), 1e3)
        for k in range(fill):
            hv = lambda j: hash3(np.array([k]), j, 1, seed)[0]
            boxes = np.minimum(boxes, rbox(P, ((hv(1) - 0.5) * 6, (hv(2) - 0.5) * 3, 3.2 + k * 5 + 2.4), (3 + hv(3) * 3, 3 + hv(4) * 1.6, 2.4), 0.35))
        return [base, casters, posts, wires, boxes]
    return M(parts, [solid('lavlt', 2.4), solid('night', 1.4), solid('lavlt', 2.8, 0.5), solid('lavlt', 3.2, 0.5), _parcel_mat(seed)],
             (-9, 9, -7, 7, 0, 34))


def hand_truck():
    """Upright sack truck (dolly) with a parcel on the nose plate."""
    def parts(P):
        rails = np.minimum(capsule(P, (-3.5, -1, 2), (-3.5, -2.5, 30), 0.6), capsule(P, (3.5, -1, 2), (3.5, -2.5, 30), 0.6))
        grip = capsule(P, (-3.5, -2.5, 30), (3.5, -2.5, 30), 0.6)
        cross = np.minimum.reduce([capsule(P, (-3.5, -1.6, z), (3.5, -1.6, z), 0.4) for z in (10, 18)])
        nose = rbox(P, (0, 2, 0.6), (4, 3, 0.4), 0.2)
        wheels = np.minimum(cyl_x(P, (-5, -2, 2.6), 2.6, 0.8, 0.4), cyl_x(P, (5, -2, 2.6), 2.6, 0.8, 0.4))
        box = rbox(P, (0, 1.4, 5.2), (3.6, 3, 4.2), 0.4)
        return [rails, grip, cross, nose, wheels, box]
    return M(parts, [solid('red', 2.6, 0.4), solid('night', 2.0), solid('red', 2.2), solid('lavlt', 2.6), solid('night', 1.2), _parcel_mat(5)],
             (-7, 7, -5, 6, 0, 32))


def pallet_load(seed=4):
    """Wooden pallet with a shrink-wrapped stack of parcels."""
    def parts(P):
        deck = rbox(P, (0, 0, 2.6), (10, 8, 0.6), 0.2)
        blocks = np.minimum.reduce([rbox(P, (sx, sy, 1), (1.6, 1.6, 1), 0.2) for sx in (-8, 0, 8) for sy in (-6, 6)])
        stack = rbox(P, (0, 0, 13), (9.2, 7.2, 10), 1.6)
        return [deck, blocks, stack]

    def wm(p, n):
        base_m = _parcel_mat(seed)(p, n)
        sheen = np.mod(p[:, 0] * 0.6 + p[:, 2] * 0.9 + p[:, 1] * 0.4, 7.0) < 1.1
        return base_m[0], base_m[1] + 0.4 + sheen * 0.7, np.full(len(p), 0.8)
    return M(parts, [solid('wood', 3.0), solid('wood', 2.2), wm], (-11, 11, -9, 9, 0, 24))


def sort_table(length=40):
    """Steel sorting table with parcels, a scanner gun and a label roll. Work side (+y)."""
    L = length

    def parts(P):
        top = rbox(P, (0, 0, 16), (L / 2, 7, 0.7), 0.3)
        legs = np.minimum.reduce([rbox(P, (sx, sy, 8), (0.7, 0.7, 8), 0.2) for sx in (-L / 2 + 1.5, L / 2 - 1.5) for sy in (-6, 6)])
        rail = rbox(P, (0, 0, 3), (L / 2 - 1.5, 6, 0.4), 0.2)
        boxes = np.minimum.reduce([rbox(P, (x, y, 16.7 + h), (w, d, h), 0.35) for x, y, w, d, h in
                                   ((-L / 2 + 7, -2, 4, 3.4, 2.4), (-L / 2 + 13, 1, 2.6, 2.4, 1.6), (L / 2 - 8, -1.5, 3.4, 3.6, 3.0), (0, -3, 3, 2.4, 1.4))])
        gun = np.minimum(rbox(P, (5, 3, 17.6), (1.8, 0.8, 0.8), 0.4), capsule(P, (4, 3, 17.6), (3.4, 4.5, 17.2), 0.5))
        roll = cyl_z(P, (9, 3.5, 17.6), 1.5, 0.9, 0.3)
        return [top, legs, rail, boxes, gun, roll]
    return M(parts, [solid('lavlt', 3.0, 0.5), solid('lavlt', 2.0), solid('lavlt', 2.2), _parcel_mat(7), solid('night', 2.0), solid('white', 4.2)],
             (-L / 2 - 1, L / 2 + 1, -8, 8, 0, 24))


def conveyor(length=64, seed=6):
    """Roller conveyor running along x, with parcels riding on it."""
    L = length

    def parts(P):
        frame = np.minimum.reduce([rbox(P, (0, sy, 12), (L / 2, 0.6, 1.4), 0.3) for sy in (-5.5, 5.5)])
        legs = np.minimum.reduce([rbox(P, (sx, sy, 5.5), (0.7, 0.7, 5.5), 0.2) for sx in np.linspace(-L / 2 + 2, L / 2 - 2, 4) for sy in (-5.5, 5.5)])
        rollers = np.full(len(P), 1e3)
        for xv in np.arange(-L / 2 + 1.5, L / 2 - 1, 2.6):
            rollers = np.minimum(rollers, cyl_y(P, (xv, 0, 12.6), 1.0, 5, 0.2))
        boxes = np.full(len(P), 1e3)
        for k, xv in enumerate(np.arange(-L / 2 + 8, L / 2 - 6, 15.0)):
            hv = lambda j: hash3(np.array([k]), j, 1, seed)[0]
            boxes = np.minimum(boxes, rbox(P, (xv + (hv(1) - 0.5) * 4, (hv(2) - 0.5) * 2, 13.6 + 1.6 + hv(3) * 1.6), (2.6 + hv(4) * 1.6, 3.2, 1.6 + hv(3) * 1.6), 0.35))
        return [frame, legs, rollers, boxes]
    return M(parts, [solid('navy', 2.4, 0.3), solid('lavlt', 2.0), solid('lavlt', 3.2, 0.6), _parcel_mat(seed)], (-L / 2 - 1, L / 2 + 1, -7, 7, 0, 20))


def roll_door(width=48, height=44, open_to=30):
    """Wall-mounted roll-up loading door, raised to `open_to`, with the back of a courier van backed up to the dock.
    Back on the wall; origin at the bottom centre of the opening."""
    W, H = width, height

    def parts(P):
        jambs = np.minimum(rbox(P, (-W / 2 - 1.6, 0.8, H / 2), (1.6, 0.8, H / 2), 0.3), rbox(P, (W / 2 + 1.6, 0.8, H / 2), (1.6, 0.8, H / 2), 0.3))
        hood = rbox(P, (0, 2.2, H + 3), (W / 2 + 3, 2.2, 3), 0.8)
        curtain = rbox(P, (0, 0.5, (open_to + H) / 2), (W / 2, 0.5, (H - open_to) / 2), 0.1)
        dark = rbox(P, (0, 0.1, open_to / 2), (W / 2, 0.1, open_to / 2), 0.05)
        van = rbox(P, (0, 0.6, open_to / 2 + 2), (W / 2 - 5, 0.6, open_to / 2 - 1.5), 0.4)
        bumpers = np.minimum(rbox(P, (-W / 2 + 2, 2.0, 7), (1.6, 2.0, 3), 0.6), rbox(P, (W / 2 - 2, 2.0, 7), (1.6, 2.0, 3), 0.6))
        return [jambs, hood, curtain, dark, van, bumpers]

    def cm(p, n):
        slat = np.mod(p[:, 2], 2.4) < 0.5
        return np.full(len(p), RID['lavlt']), 3.0 - slat * 0.9, np.full(len(p), 0.3)

    def vm(p, n):
        x, z = p[:, 0], p[:, 2]
        win = (np.abs(np.abs(x) - (W / 4 - 2)) < W / 4 - 5) & (z > open_to - 11) & (z < open_to - 3)
        split = np.abs(x) < 0.5
        light = (np.abs(np.abs(x) - (W / 2 - 6.5)) < 1.2) & (z > 9) & (z < 15)
        stripe = (z > 7) & (z < 8.4)
        r = np.where(win, RID['glass'], np.where(light, RID['red'], np.where(stripe, RID['brick'], RID['white'])))
        b = np.where(win, 2.4, np.where(light, 3.8, np.where(split, 2.0, np.where(stripe, 3.0, 3.6))))
        return r, b, np.where(win | light, 0.8, 0.2)
    return M(parts, [solid('lavlt', 2.4), solid('lavlt', 2.0, 0.3), cm, solid('night', 0.4), vm, solid('night', 1.6)],
             (-W / 2 - 4, W / 2 + 4, -1, 5, 0, H + 7))


def floor_lines(length=48, width=40, color='white'):
    """Painted bay markings: two lane lines and a stop bar (flat; place with z_bias -300)."""
    def parts(P):
        lines = np.minimum(rbox(P, (-width / 2, 0, 0.1), (0.9, length / 2, 0.1), 0.05), rbox(P, (width / 2, 0, 0.1), (0.9, length / 2, 0.1), 0.05))
        bar = rbox(P, (0, -length / 2 + 1, 0.1), (width / 2, 1.2, 0.1), 0.05)
        return [lines, bar]

    def m(p, n):
        hatch = np.mod(p[:, 0] + 40, 4.0) < 2.0
        return np.where(hatch, RID[color], RID['red']), np.full(len(p), 3.6), np.zeros(len(p))
    return M(parts, [solid(color, 3.8), m], (-width / 2 - 2, width / 2 + 2, -length / 2 - 1, length / 2 + 1, 0, 0.4))


def parcel_scale():
    """Counter-top parcel scale with a display and a label printer beside it."""
    def parts(P):
        plate = rbox(P, (0, 1, 0.8), (3.4, 3, 0.8), 0.4)
        disp = rbox(P, (0, -2.6, 2.6), (2.2, 0.6, 1.6), 0.3)
        printer = rbox(P, (6, 0, 1.6), (2, 2.6, 1.6), 0.5)
        label = rbox(P, (6, 2.8, 1.4), (1.4, 0.4, 0.9), 0.1)
        return [plate, disp, printer, label]

    def dm(p, n):
        scr = n[:, 1] > 0.5
        return np.where(scr, RID['sage'], RID['night']), np.where(scr, 4.2, 2.0), np.where(scr, 1.0, 0.0)
    return M(parts, [solid('lavlt', 3.4, 0.6), dm, solid('white', 3.6), solid('white', 4.6)], (-5, 9, -4, 4, 0, 5))


def drop_box():
    """Customer parcel drop box (navy, with a pull-down flap)."""
    def parts(P):
        body = rbox(P, (0, 0, 12), (6, 5, 12), 1.0)
        flap = rbox(P, (0, 5.2, 19), (4, 0.5, 2), 0.3)
        return [body, flap]

    def bm(p, n):
        stripe = (n[:, 1] > 0.5) & (np.abs(p[:, 2] - 9) < 1.0)
        return np.where(stripe, RID['white'], RID['navy']), np.where(stripe, 4.2, 2.4), np.full(len(p), 0.3)
    return M(parts, [bm, solid('lavlt', 3.0, 0.5)], (-7, 7, -6, 7, 0, 25))


# ======================================================================= site trailer (Ashby Timber)
def plan_table():
    """Site plan table: a felling map spread out, rolled plans, a hard hat and a mug. Work side (+y)."""
    def parts(P):
        top = rbox(P, (0, 0, 16), (14, 8, 0.8), 0.4)
        legs = np.minimum.reduce([rbox(P, (sx, sy, 7.6), (0.8, 0.8, 7.6), 0.2) for sx in (-12, 12) for sy in (-6, 6)])
        sheet = rbox(P, (-1, 0.5, 17.0), (8, 5.5, 0.2), 0.05)
        rolls = np.minimum(cyl_x(P, (5, -5.5, 17.8), 1.0, 6, 0.3), cyl_x(P, (4, -3.2, 17.8), 0.9, 5, 0.3))
        hat = smin(ell(P, (10, 3.5, 18.6), (3, 3, 2.4)), cyl_z(P, (10, 3.5, 17.2), 3.8, 0.3, 0.2), 0.5)
        hat = np.maximum(hat, -(P[:, 2] - 16.9))
        mug = cyl_z(P, (-11, 4, 17.8), 1.1, 1.2, 0.3)
        return [top, legs, sheet, rolls, hat, mug]

    def mm(p, n):
        x, y = p[:, 0], p[:, 1]
        k = hash3(np.floor((x + 20) / 2.4), np.floor((y + 20) / 2.4), 1, 5)
        clear = hash3(np.floor((x + 20) / 5), np.floor((y + 20) / 4), 1, 2) > 0.6
        line = np.abs(y - 1.5 * np.sin(x * 0.5)) < 0.35
        r = np.where(line, RID['red'], np.where(clear, RID['khaki'], RID['sage']))
        return r, np.where(line, 3.4, 3.0 + (k > 0.5) * 0.4), np.zeros(len(p))
    return M(parts, [solid('wood', 2.6), solid('wood', 1.8), mm, solid('white', 3.8), solid('white', 4.0, 0.6), solid('teal', 3.0)],
             (-15, 15, -9, 9, 0, 22))


def gear_wall(n=4):
    """Wall rail of hooks: hard hats above, safety vests hanging below (red-orange, white reflective bands)."""
    w = n * 8.0

    def parts(P):
        rail = rbox(P, (0, 0.6, 42), (w / 2, 0.6, 0.8), 0.3)
        hats = np.full(len(P), 1e3)
        vests = np.full(len(P), 1e3)
        for k in range(n):
            x = -w / 2 + 4 + k * 8
            hat = smin(ell(P, (x, 3.2, 45.4), (3, 3, 2.4)), cyl_z(P, (x, 3.2, 44.0), 3.8, 0.3, 0.2), 0.5)
            hats = np.minimum(hats, np.maximum(hat, -(P[:, 2] - 43.7)))
            vests = np.minimum(vests, smin(rbox(P, (x, 1.4, 30.5), (3.2, 1.2, 5.5), 1.0), rbox(P, (x, 1.2, 37.5), (2.3, 1.0, 3.0), 0.8), 1.2))
        return [rail, hats, vests]

    def hm(p, n_):
        k = np.floor((p[:, 0] + w / 2) / 8)
        return np.where(np.mod(k, 2) == 0, RID['white'], RID['red']), np.where(np.mod(k, 2) == 0, 4.0, 3.2), np.full(len(p), 0.5)

    def vm(p, n_):
        band = (np.abs(p[:, 2] - 30) < 0.8) | (np.abs(p[:, 2] - 35) < 0.8)
        return np.where(band, RID['white'], RID['red']), np.where(band, 4.6, 3.0), np.zeros(len(p))
    return M(parts, [solid('wood', 1.8), hm, vm], (-w / 2 - 1, w / 2 + 1, -1, 7, 24, 49))


def chainsaw_rack():
    """Low steel shelf with two chainsaws, a fuel can and chain oil."""
    def parts(P):
        shelves = np.minimum.reduce([rbox(P, (0, 0, z), (10, 5, 0.5), 0.2) for z in (2, 11)])
        posts = np.minimum.reduce([rbox(P, (sx, sy, 6.5), (0.5, 0.5, 6.5), 0.2) for sx in (-9.5, 9.5) for sy in (-4.5, 4.5)])
        bodies = np.minimum.reduce([rbox(P, (x, 0, 14.4), (2.6, 3, 2.4), 0.8) for x in (-5, 4)])
        bars = np.minimum.reduce([rbox(P, (x, 4.8, 13.4), (0.5, 4.2, 1.2), 0.4) for x in (-5, 4)])
        handles = np.minimum.reduce([capsule(P, (x - 2, -1, 17.2), (x + 2, -1, 17.2), 0.5) for x in (-5, 4)])
        can = rbox(P, (-4, 0, 5.8), (2.6, 3.4, 3.4), 0.6)
        oil = cyl_z(P, (5, 0, 5.2), 1.8, 2.6, 0.4)
        return [shelves, posts, bodies, bars, handles, can, oil]
    return M(parts, [solid('lavlt', 2.4), solid('lavlt', 2.0), solid('clay', 3.2, 0.4), solid('lavlt', 3.4, 0.6), solid('night', 1.8),
                     solid('red', 2.6, 0.4), solid('sage', 2.8)], (-11, 11, -6, 10, 0, 19))


def boot_tray():
    """Rubber tray with muddy work boots."""
    def parts(P):
        tray = np.maximum(rbox(P, (0, 0, 0.6), (9, 4.5, 0.6), 0.3), -rbox(P, (0, 0, 1.0), (8.4, 3.9, 0.4), 0.1))
        boots = np.full(len(P), 1e3)
        for k, x in enumerate((-6.5, -3.5, 2, 5)):
            sh = 0.5 * (k % 2)
            boots = np.minimum(boots, smin(rbox(P, (x, 0.8 + sh, 1.6), (1.2, 2.6, 1.0), 0.6), rbox(P, (x, -1 + sh, 4), (1.1, 1.2, 3), 0.6), 0.6))
        return [tray, boots]

    def bm(p, n):
        mud = p[:, 2] < 1.6
        return np.where(mud, RID['clay'], RID['wood']), np.where(mud, 2.0, 1.8), np.zeros(len(p))
    return M(parts, [solid('asph', 1.6), bm], (-10, 10, -6, 6, 0, 8))


def space_heater():
    """Small electric heater with a glowing element grille."""
    def parts(P):
        body = rbox(P, (0, 0, 7), (5, 3, 6.5), 1.0)
        feet = rbox(P, (0, 0, 0.4), (5.5, 3.5, 0.4), 0.2)
        return [body, feet]

    def m(p, n):
        front = n[:, 1] > 0.5
        grille = front & (np.abs(p[:, 0]) < 3.8) & (np.abs(p[:, 2] - 6.5) < 4.2)
        bar = grille & (np.mod(p[:, 2], 1.6) < 0.6)
        r = np.where(bar, RID['red'], np.where(grille, RID['night'], RID['stone']))
        return r, np.where(bar, 4.2, np.where(grille, 1.4, 3.0)), np.where(bar, 1.0, 0.2)
    return M(parts, [m, solid('night', 1.6)], (-6, 6, -4, 4, 0, 14))


def site_radio():
    """Rugged site radio with a carry handle and an aerial (sits on a desk)."""
    def parts(P):
        body = rbox(P, (0, 0, 2.6), (3.4, 1.8, 2.4), 0.8)
        cage = np.minimum(capsule(P, (-3.6, 0, 1), (-3.6, 0, 6), 0.4), capsule(P, (3.6, 0, 1), (3.6, 0, 6), 0.4))
        bar = capsule(P, (-3.6, 0, 6), (3.6, 0, 6), 0.4)
        aerial = capsule(P, (2.6, -1, 6), (4.5, -2, 12), 0.2)
        return [body, cage, bar, aerial]

    def m(p, n):
        front = n[:, 1] > 0.5
        spk = front & (np.hypot(p[:, 0] + 1.4, p[:, 2] - 2.6) < 1.4)
        dial = front & (np.abs(p[:, 0] - 1.8) < 0.9) & (np.abs(p[:, 2] - 3.2) < 0.6)
        r = np.where(spk, RID['night'], np.where(dial, RID['sage'], RID['red']))
        return r, np.where(spk, 1.4, np.where(dial, 4.0, 2.8)), np.where(dial, 1.0, 0.3)
    return M(parts, [m, solid('night', 2.0), solid('night', 2.0), solid('night', 2.4)], (-5, 6, -3, 3, 0, 13))


DECOR_JOBS = {
    'lockers': lockers, 'locker_bench': locker_bench, 'time_clock': time_clock, 'wall_map': wall_map, 'wall_poster': wall_poster,
    'sign_board': sign_board, 'first_aid': first_aid, 'hose_reel': hose_reel,
    'lift_post': lift_post, 'lifted_car': lifted_car, 'masked_car': masked_car, 'workbench': workbench, 'pegboard': pegboard,
    'tool_chest': tool_chest, 'diag_cart': diag_cart, 'floor_jack': floor_jack, 'creeper': creeper, 'oil_stain': oil_stain,
    'drain_pan': drain_pan, 'engine_stand': engine_stand, 'tyre_stack': tyre_stack, 'tyre_rack': tyre_rack, 'tyre_changer': tyre_changer, 'air_compressor': air_compressor,
    'paint_station': paint_station, 'booth_fan': booth_fan, 'filter_panels': filter_panels, 'masking_stand': masking_stand,
    'parcels': parcels, 'parcel_rack': parcel_rack, 'roll_cage': roll_cage, 'hand_truck': hand_truck, 'pallet_load': pallet_load,
    'sort_table': sort_table, 'conveyor': conveyor, 'roll_door': roll_door, 'floor_lines': floor_lines, 'parcel_scale': parcel_scale,
    'drop_box': drop_box,
    'plan_table': plan_table, 'gear_wall': gear_wall, 'chainsaw_rack': chainsaw_rack, 'boot_tray': boot_tray, 'space_heater': space_heater,
    'site_radio': site_radio,
}

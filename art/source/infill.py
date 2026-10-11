"""Infill buildings for a closed-in city: shopfronts, walk-ups and mid-rise offices (Phase 1 milestone 1b).

Facades only (decided 2026-10-11): they can't be entered. In the isometric view only faces pointing +x or +y are
seen, so a building on the far side of a street shows its back. Every face is therefore dressed: the front (local
+y) has the shop or lobby, the other faces have windows, a back door, pipes and AC units.

Model units, rendered at env BLD_SCALE (2.6) like the other buildings. One storey is 12 units (31 world units).
"""
import numpy as np
from sdf import Model, rbox, cyl_z, capsule, solid, RID, hash3
from env import sign_text, _grid, _glass

FH = 12.0          # storey height


def _faces(n):
    front = n[:, 1] > 0.55
    right = n[:, 0] > 0.55
    back = n[:, 1] < -0.55
    left = n[:, 0] < -0.55
    return front, right, back, left


def _wall_texture(kind, u, z, seed):
    N = len(u)
    if kind == 'brick' or kind == 'redbrick' or kind == 'darkbrick':
        ramp = {'brick': 'clay', 'redbrick': 'brick', 'darkbrick': 'plum'}[kind]
        base = {'brick': 2.3, 'redbrick': 2.3, 'darkbrick': 2.6}[kind]
        course = np.floor(z / 1.6)
        h = hash3(np.floor(u / 2.8 + (course % 2) * 0.5), course, 1, seed)
        return np.full(N, RID[ramp]), base + (h - 0.5) * 0.8 + (np.mod(z, 1.6) < 0.4) * -0.6
    if kind == 'stone':
        blk = hash3(np.floor(u / 6.0 + (np.floor(z / 3.0) % 2) * 0.5), np.floor(z / 3.0), 2, seed)
        joint = (np.mod(z, 3.0) < 0.35)
        return np.full(N, RID['stone']), 2.5 + (blk - 0.5) * 0.5 - joint * 0.7
    if kind == 'render_sage':
        return np.full(N, RID['sage']), 2.9 + (hash3(np.floor(u / 3), np.floor(z / 3), 3, seed) - 0.5) * 0.4
    if kind == 'render_lav':
        return np.full(N, RID['lavlt']), 3.0 + (hash3(np.floor(u / 3), np.floor(z / 3), 3, seed) - 0.5) * 0.4
    if kind == 'render_blue':
        return np.full(N, RID['blueg']), 2.8 + (hash3(np.floor(u / 3), np.floor(z / 3), 3, seed) - 0.5) * 0.4
    if kind == 'concrete':
        return np.full(N, RID['lavlt']), 2.4 + (hash3(np.floor(u / 4), np.floor(z / 2), 3, seed) - 0.5) * 0.5
    raise KeyError(kind)


def shop_building(name, wall='brick', floors=2, hx=14.0, hy=12.0, awning=('red', 'white'), sign=('night', 'white'),
                  lit=0.0, seed=1, style='awning', trim='stone', roof=True):
    """A narrow shopfront building: a shop on the ground floor, flats or offices above."""
    H = floors * FH + 1.0

    def parts(P):
        body = rbox(P, (0, 0, H / 2), (hx, hy, H / 2), 0.6)
        base = rbox(P, (0, 0, 0.9), (hx + 0.5, hy + 0.5, 0.9), 0.3)
        cornice = rbox(P, (0, 0, H + 0.7), (hx + 0.8, hy + 0.8, 0.9), 0.4)
        band = rbox(P, (0, 0, FH), (hx + 0.4, hy + 0.4, 0.6), 0.2)
        if style == 'awning':
            Q = P.copy(); Q[:, 2] = P[:, 2] + 0.38 * (P[:, 1] - hy)
            awn = rbox(Q, (0, hy + 4.0, 9.6), (hx - 1.0, 4.0, 0.55), 0.3)
        else:
            awn = rbox(P, (0, hy + 1.6, 10.2), (hx - 1.0, 1.6, 0.5), 0.2)
        board = rbox(P, (0, hy + 0.6, FH - 1.6), (hx - 2.0, 0.7, 1.6), 0.3)
        ext = np.full(len(P), 1e3)
        if roof:
            ext = np.minimum(rbox(P, (-hx * 0.4, -hy * 0.3, H + 2.6), (3.0, 2.6, 1.5), 0.6), cyl_z(P, (hx * 0.45, -hy * 0.2, H + 3.0), 2.0, 2.0, 0.5))
        # drainpipe and back-wall AC unit
        pipe = capsule(P, (hx + 0.6, -hy + 2.0, 0), (hx + 0.6, -hy + 2.0, H), 0.45)
        ac = rbox(P, (hx + 1.6, -hy * 0.2, FH + 5.0), (1.3, 2.4, 1.8), 0.4)
        return [body, base, cornice, band, awn, board, ext, np.minimum(pipe, ac)]

    def body_m(p, n):
        front, right, back, left = _faces(n)
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        u = np.where(front | back, x, y)
        span = np.where(front | back, hx, hy)
        ramp, base = _wall_texture(wall, u, z, seed)
        # upper floors: a regular grid of windows on every face
        win, rz, _, ci, fi = _grid(u + span, z, 0.0, FH, 7.0, 3.6, 1.7, FH, 6.6, 3.0)
        win &= (z > FH + 0.8) & (z < H - 1.0) & (np.abs(u) < span - 1.6) & ~(n[:, 2] > 0.5)
        r, t = _glass(win, rz, 6.6, lit, ci + 13 * (front | back), fi, ramp, base, seed + 3)
        sill = (np.abs(np.mod(u + span - 1.7, 7.0) - 1.8) < 2.4) & (np.abs(np.mod(z - FH, FH) - 2.6) < 0.35) & (z > FH) & (np.abs(u) < span - 1.6)
        r = np.where(sill & ~win, RID['stone'], r); t = np.where(sill & ~win, 3.2, t)
        shine = np.where(win, 0.9, 0.0)
        # ground floor front: a display window and a glass door
        g = z < FH - 0.4
        disp = front & g & (z > 2.4) & (z < 8.6) & (x > -hx + 1.6) & (x < hx - 7.5)
        door = front & g & (x > hx - 6.2) & (x < hx - 1.6) & (z < 9.0)
        dlit = lit > 0
        r = np.where(disp, RID['gold'] if dlit else RID['glass'], r)
        t = np.where(disp, 3.0 if dlit else 1.3 + (z - 2.4) * 0.12, t)
        mull = disp & ((np.abs(np.mod(x + hx, 6.0) - 3.0) < 0.3) | (z < 2.9))
        r = np.where(mull, RID['night'], r); t = np.where(mull, 1.8, t)
        # goods in the window
        goods = disp & (z < 4.6) & (hash3(np.floor(x / 1.6), 1, 1, seed) > 0.35)
        gcol = np.array([RID['plum'], RID['sage'], RID['clay'], RID['white'], RID['navy']])
        r = np.where(goods, gcol[(hash3(np.floor(x / 1.6), 2, 1, seed) * 5).astype(int) % 5], r)
        t = np.where(goods, 3.0, t)
        r = np.where(door, RID['gold'] if dlit else RID['glass'], r); t = np.where(door, 2.6 if dlit else 1.2 + 0.06 * z, t)
        dfr = door & ((np.abs(x - (hx - 3.9)) < 0.3) | (z > 8.4))
        r = np.where(dfr, RID['night'], r); t = np.where(dfr, 1.6, t)
        knob = front & (np.abs(x - (hx - 5.4)) < 0.4) & (np.abs(z - 4.6) < 0.6)
        r = np.where(knob, RID['gold'], r); t = np.where(knob, 4.0, t)
        shine = np.where(disp | door, 0.9, shine)
        # ground floor sides and back: small barred windows and a back door
        sw = (right | left) & g & (np.abs(np.mod(y + hy, 9.0) - 4.5) < 1.8) & (z > 4.5) & (z < 8.5) & (np.abs(y) < hy - 2)
        r = np.where(sw, RID['glass'], r); t = np.where(sw, 1.2, t)
        bars = sw & (np.mod(y, 1.2) < 0.35)
        r = np.where(bars, RID['night'], r); t = np.where(bars, 1.6, t)
        bd = back & g & (np.abs(x + hx * 0.4) < 2.2) & (z < 8.5)
        r = np.where(bd, RID['teal'], r); t = np.where(bd, 1.7 + (np.abs(x + hx * 0.4) > 1.8) * 0.5, t)
        bw = back & g & (np.abs(x - hx * 0.35) < 2.6) & (z > 4.5) & (z < 8.5)
        r = np.where(bw, RID['glass'], r); t = np.where(bw, 1.2, t)
        # a little grime at the base of the walls
        t = np.where((z < 2.2) & ~(disp | door), t - 0.4, t)
        return r, t, shine

    def awn_m(p, n):
        if style != 'awning':
            return np.full(len(p), RID[awning[0]]), np.full(len(p), 2.3), np.zeros(len(p))
        st = np.floor((p[:, 0] + 40) / 2.4) % 2 == 0
        return np.where(st, RID[awning[0]], RID[awning[1]]), np.where(st, 2.6, 3.4), np.zeros(len(p))

    def board_m(p, n):
        front = n[:, 1] > 0.5
        txt = front & sign_text(p[:, 0], p[:, 2], name, 0.0, FH - 1.6) if name else np.zeros(len(p), bool)
        return np.where(txt, RID[sign[1]], RID[sign[0]]), np.where(txt, 4.4, 1.8 if sign[0] in ('night', 'navy', 'plum') else 2.6), np.zeros(len(p))

    tr = {'stone': ('stone', 3.0), 'white': ('white', 3.2), 'dark': ('night', 2.2)}[trim]
    mats = [body_m, solid('stone', 1.9), solid(*tr), solid(*tr), awn_m, board_m, solid('lavlt', 2.8), solid('night', 2.0)]
    return Model(parts, mats, (-hx - 2, hx + 3, -hy - 2, hy + 9, 0, H + 6))


def walkup(floors=4, wall='redbrick', hx=13.0, hy=14.0, lit=0.0, seed=4, door_col='navy'):
    """A narrow residential walk-up: a stoop and front door, bay windows above, a fire escape on the side."""
    H = floors * FH + 1.0

    def parts(P):
        body = rbox(P, (0, 0, H / 2), (hx, hy, H / 2), 0.6)
        base = rbox(P, (0, 0, 1.2), (hx + 0.5, hy + 0.5, 1.2), 0.3)
        cornice = rbox(P, (0, 0, H + 0.9), (hx + 1.2, hy + 1.2, 1.1), 0.5)
        stoop = np.minimum.reduce([rbox(P, (-hx * 0.35, hy + 1.2 + k * 1.3, 2.4 - k * 0.8), (3.6, 1.2 + 0.0, 2.4 - k * 0.8), 0.2) for k in range(3)])
        hood = rbox(P, (-hx * 0.35, hy + 1.6, 10.6), (3.6, 1.6, 0.5), 0.2)
        fire = np.full(len(P), 1e3)
        for k in range(1, floors):
            fz = k * FH + 1.0
            fire = np.minimum(fire, rbox(P, (hx + 1.6, 0, fz), (1.6, hy * 0.5, 0.35), 0.1))
            fire = np.minimum(fire, rbox(P, (hx + 3.0, 0, fz + 2.2), (0.2, hy * 0.5, 0.2), 0.1))
            fire = np.minimum(fire, capsule(P, (hx + 2.0, -hy * 0.45, fz), (hx + 2.0, hy * 0.35, fz + FH), 0.3))
        tank = cyl_z(P, (hx * 0.3, -hy * 0.3, H + 5), 3.0, 3.5, 0.6)
        return [body, base, cornice, stoop, hood, fire, tank]

    def body_m(p, n):
        front, right, back, left = _faces(n)
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        u = np.where(front | back, x, y)
        span = np.where(front | back, hx, hy)
        ramp, base = _wall_texture(wall, u, z, seed)
        win, rz, _, ci, fi = _grid(u + span, z, 0.0, 0.0, 6.5, 3.4, 1.55, FH, 7.0, 3.2)
        win &= (z > 2.5) & (z < H - 1.0) & (np.abs(u) < span - 1.4) & ~(n[:, 2] > 0.5)
        win &= ~(front & (np.abs(x + hx * 0.35) < 4.4) & (z < FH))
        r, t = _glass(win, rz, 7.0, lit, ci + 7 * (front | back), fi, ramp, base, seed + 5)
        lintel = (np.abs(np.mod(u + span - 1.55, 6.5) - 1.7) < 2.2) & (np.abs(np.mod(z, FH) - 10.6) < 0.5) & (np.abs(u) < span - 1.4) & (z > 2)
        r = np.where(lintel & ~win, RID['stone'], r); t = np.where(lintel & ~win, 3.1, t)
        door = front & (np.abs(x + hx * 0.35) < 2.0) & (z > 4.8) & (z < 13.2)
        r = np.where(door, RID[door_col], r); t = np.where(door, 1.8 + (np.abs(x + hx * 0.35) > 1.5) * 0.6, t)
        fan = front & (np.abs(x + hx * 0.35) < 2.0) & (z >= 13.2) & (z < 14.4)
        r = np.where(fan, RID['gold'] if lit > 0 else RID['glass'], r); t = np.where(fan, 3.0 if lit > 0 else 1.5, t)
        knob = front & (np.abs(x + hx * 0.35 - 1.2) < 0.4) & (np.abs(z - 8.6) < 0.5)
        r = np.where(knob, RID['gold'], r); t = np.where(knob, 4.0, t)
        bd = back & (np.abs(x - hx * 0.3) < 2.2) & (z > 2.2) & (z < 10)
        r = np.where(bd, RID['wood'], r); t = np.where(bd, 1.6, t)
        return r, t, np.where(win, 0.9, 0.0)

    mats = [body_m, solid('stone', 2.0), solid('stone', 3.0), solid('stone', 2.7), solid('night', 2.2), solid('night', 1.9), solid('wood', 2.0)]
    return Model(parts, mats, (-hx - 2, hx + 5, -hy - 2, hy + 6, 0, H + 10))


def midrise(floors=7, hx=22.0, hy=18.0, wall='stone', glass_band=True, lit=0.0, seed=7, crown='lavlt', name=None):
    """A mid-rise office block for the Downtown skyline: ribbon or punched windows, a glass lobby and a rooftop plant."""
    H = floors * FH + 4.0

    def parts(P):
        body = rbox(P, (0, 0, H / 2), (hx, hy, H / 2), 0.8)
        base = rbox(P, (0, 0, 2.0), (hx + 0.6, hy + 0.6, 2.0), 0.4)
        top = rbox(P, (0, 0, H + 1.0), (hx + 0.7, hy + 0.7, 1.0), 0.4)
        plant = np.minimum(rbox(P, (-hx * 0.3, -hy * 0.2, H + 5.0), (hx * 0.35, hy * 0.35, 3.0), 0.8), rbox(P, (hx * 0.4, hy * 0.3, H + 3.5), (3.0, 3.0, 1.6), 0.5))
        canopy = rbox(P, (0, hy + 2.6, 13.0), (8.5, 2.6, 0.7), 0.3)
        return [body, base, top, plant, canopy]

    def body_m(p, n):
        front, right, back, left = _faces(n)
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        u = np.where(front | back, x, y)
        span = np.where(front | back, hx, hy)
        ramp, base = _wall_texture(wall, u, z, seed)
        fz = z - 16.0
        if glass_band:
            win, rz, _, ci, fi = _grid(u + span, fz, 0.0, 0.0, 5.0, 4.2, 0.4, FH, 7.4, 2.3)
        else:
            win, rz, _, ci, fi = _grid(u + span, fz, 0.0, 0.0, 6.0, 3.4, 1.3, FH, 7.0, 2.5)
        win &= (z > 16.0) & (z < H - 2.0) & (np.abs(u) < span - 1.6) & ~(n[:, 2] > 0.5)
        r, t = _glass(win, rz, 7.4, lit, ci + 11 * (front | back), fi, ramp, base, seed + 9)
        # glass lobby on the front, a band of shop windows elsewhere on the ground floor
        lobby = front & (z > 2.5) & (z < 13.5) & (np.abs(x) < 8.0)
        gw = ~lobby & (z > 3.0) & (z < 12.5) & (np.abs(np.mod(u + span, 8.0) - 4.0) < 2.8) & (np.abs(u) < span - 2) & ~(n[:, 2] > 0.5)
        r = np.where(lobby | gw, RID['glass'], r)
        t = np.where(lobby | gw, 1.3 + (z - 3.0) * 0.09, t)
        if lit > 0:
            r = np.where(lobby, RID['gold'], r); t = np.where(lobby, 3.0, t)
        lm = lobby & ((np.abs(np.mod(x + 8, 4.0) - 2.0) < 0.25) | (np.abs(z - 9.5) < 0.3))
        r = np.where(lm, RID['night'], r); t = np.where(lm, 1.8, t)
        plinth = (z < 14.5) & (z > 13.5)
        r = np.where(plinth, RID['stone'], r); t = np.where(plinth, 3.2, t)
        return r, t, np.where(win | lobby | gw, 0.9, 0.0)

    def canopy_m(p, n):
        front = n[:, 1] > 0.5
        txt = front & sign_text(p[:, 0], p[:, 2], name, 0.0, 13.0) if name else np.zeros(len(p), bool)
        return np.where(txt, RID['white'], RID['night']), np.where(txt, 4.4, 2.0), np.zeros(len(p))

    mats = [body_m, solid('stone', 2.0), solid(crown, 3.2), solid('lavlt', 2.6), canopy_m]
    return Model(parts, mats, (-hx - 2, hx + 2, -hy - 2, hy + 6, 0, H + 9))


def workshop(lit=0.0, seed=3):
    """A small brick workshop with a roller door, for the industrial edge next to Marlo's."""
    hx, hy, H = 16.0, 12.0, 15.0

    def parts(P):
        body = rbox(P, (0, 0, H / 2), (hx, hy, H / 2), 0.6)
        Q = P.copy(); Q[:, 2] = P[:, 2] - 0.25 * (hy - np.abs(P[:, 1]))
        roof = rbox(Q, (0, 0, H + 0.6), (hx + 0.8, hy + 0.8, 0.6), 0.3)
        return [body, roof, rbox(P, (0, 0, 0.8), (hx + 0.5, hy + 0.5, 0.8), 0.3)]

    def body_m(p, n):
        front, right, back, left = _faces(n)
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        u = np.where(front | back, x, y)
        ramp, base = _wall_texture('redbrick', u, z, seed)
        rd = front & (np.abs(x + 3) < 7) & (z < 11)
        r = np.where(rd, RID['lavlt'], ramp); t = np.where(rd, 2.0 + (np.mod(z, 1.4) < 0.7) * 0.6, base)
        w = (right | back | left) & (np.abs(np.mod(u + 30, 8.0) - 4.0) < 2.2) & (z > 6) & (z < 11) & (np.abs(u) < 12)
        r = np.where(w, RID['gold'] if lit > 0 else RID['glass'], r); t = np.where(w, 2.8 if lit > 0 else 1.3, t)
        wd = front & (np.abs(x - 10) < 2.0) & (z < 9)
        r = np.where(wd, RID['night'], r); t = np.where(wd, 1.8, t)
        return r, t, np.zeros(len(p))
    return Model(parts, [body_m, solid('lav', 2.0), solid('stone', 1.8)], (-hx - 2, hx + 2, -hy - 2, hy + 2, 0, H + 6))


# name: (factory(lit) , footprint half extents in model units (hx, hy), height in model units)
_SPECS = {
    'shop_deli': (lambda lit: shop_building('DELI', 'brick', 2, awning=('sage', 'white'), sign=('night', 'white'), lit=lit, seed=1), (14, 12), 25),
    'shop_pawn': (lambda lit: shop_building('PAWN', 'darkbrick', 2, 12, 12, awning=('navy', 'navy'), sign=('navy', 'white'), lit=lit, seed=2, style='flat', trim='dark'), (12, 12), 25),
    'shop_barber': (lambda lit: shop_building('BARBER', 'render_sage', 3, 12, 12, awning=('red', 'white'), sign=('white', 'red'), lit=lit, seed=3, trim='white'), (12, 12), 37),
    'shop_noodles': (lambda lit: shop_building('NOODLES', 'redbrick', 2, 13, 12, awning=('red', 'red'), sign=('red', 'white'), lit=lit, seed=4, style='flat'), (13, 12), 25),
    'shop_pharmacy': (lambda lit: shop_building('PHARMACY', 'render_lav', 3, 16, 12, awning=('teal', 'white'), sign=('white', 'teal'), lit=lit, seed=5, trim='white'), (16, 12), 37),
    'shop_books': (lambda lit: shop_building('BOOKS', 'stone', 2, 12, 12, awning=('plum', 'plum'), sign=('plum', 'white'), lit=lit, seed=6, style='flat'), (12, 12), 25),
    'shop_cafe': (lambda lit: shop_building('CAFE', 'render_blue', 2, 13, 12, awning=('sage', 'white'), sign=('night', 'white'), lit=lit, seed=7, trim='white'), (13, 12), 25),
    'shop_tailor': (lambda lit: shop_building('TAILOR', 'brick', 3, 12, 12, awning=('khaki', 'white'), sign=('night', 'white'), lit=lit, seed=8), (12, 12), 37),
    'shop_hardware': (lambda lit: shop_building('HARDWARE', 'concrete', 1, 18, 12, awning=('red', 'red'), sign=('red', 'white'), lit=lit, seed=9, style='flat', roof=True), (18, 12), 13),
    'shop_bakery': (lambda lit: shop_building('BAKERY', 'render_lav', 2, 12, 12, awning=('clay', 'white'), sign=('white', 'brick'), lit=lit, seed=10, trim='white'), (12, 12), 25),
    'walkup_red': (lambda lit: walkup(4, 'redbrick', lit=lit, seed=4, door_col='navy'), (13, 14), 49),
    'walkup_tan': (lambda lit: walkup(3, 'brick', lit=lit, seed=5, door_col='red'), (13, 14), 37),
    'walkup_stone': (lambda lit: walkup(5, 'stone', 13, 13, lit=lit, seed=6, door_col='sage'), (13, 13), 61),
    'midrise_stone': (lambda lit: midrise(7, 22, 18, 'stone', True, lit=lit, seed=7), (22, 18), 88),
    'midrise_blue': (lambda lit: midrise(9, 18, 18, 'render_blue', True, lit=lit, seed=8, crown='white'), (18, 18), 112),
    'midrise_brick': (lambda lit: midrise(6, 20, 16, 'darkbrick', False, lit=lit, seed=9), (20, 16), 76),
    'workshop': (lambda lit: workshop(lit), (16, 12), 15),
}

BUILDINGS = {}
FOOTPRINTS = {}
for _k, (_f, _fp, _h) in _SPECS.items():
    BUILDINGS[_k] = (lambda f: (lambda: f(0.0)))(_f)
    BUILDINGS[_k + '_night'] = (lambda f, k: (lambda: f(0.42 if k.startswith(('walkup', 'midrise')) else 1.0)))(_f, _k)
    FOOTPRINTS[_k] = (_fp[0], _fp[1], _h)

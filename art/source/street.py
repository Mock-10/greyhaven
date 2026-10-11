"""Street furniture and alley clutter for the denser city (Phase 1 milestone 1b).

All models are in world units (a person is 40 units tall), front facing local +y like decor.py, and are rendered at
scale 1. Wall, fence and planter-bed pieces are short segments along local x so curves can be built from them at
any of 16 angles (see SEGMENT_ANGLES).
"""
import numpy as np
from sdf import Model, ell, capsule, rbox, cyl_z, smin, solid, RID, hash3
from env import sign_text

M = Model
SEGMENT_ANGLES = 16          # curved walls, fences and planter beds are rendered at 16 directions (22.5 degrees)


def _leaf(seed=3, base=2.3, alt='khaki'):
    def m(p, n):
        h = hash3(np.floor(p[:, 0] * 0.8), np.floor(p[:, 1] * 0.8), np.floor(p[:, 2] * 0.8), seed)
        return np.where(h > 0.82, RID[alt], RID['sage']), base + (h - 0.5) * 0.9 + (n[:, 2] > 0.6) * 0.5, np.zeros(len(p))
    return m


def _bumpy(P, a=0.45, f=1.9):
    return a * np.sin(P[:, 0] * f) * np.sin(P[:, 1] * f * 1.1) * np.sin(P[:, 2] * f * 0.9)


# ------------------------------------------------------------------ transit and kerbside
def bus_shelter():
    """Glass bus shelter, 44 x 14 units: back glass, an ad panel at one end, roof slab and a bench inside."""
    def parts(P):
        roof = rbox(P, (0, 0, 37.5), (23, 8, 1.2), 0.6)
        posts = np.minimum.reduce([rbox(P, (sx, sy, 18.5), (0.7, 0.7, 18.5), 0.3) for sx in (-21.5, 21.5) for sy in (-6.5, 5.5)])
        back = rbox(P, (0, -6.5, 20), (21, 0.4, 15), 0.2)
        ad = rbox(P, (-21.5, -0.5, 19), (0.8, 5.6, 14), 0.3)
        bench = np.minimum(rbox(P, (4, -3.5, 9), (12, 2.6, 0.7), 0.4), np.minimum(rbox(P, (-6, -3.5, 4.2), (0.6, 2, 4.2), 0.2), rbox(P, (14, -3.5, 4.2), (0.6, 2, 4.2), 0.2)))
        return [roof, posts, back, ad, bench]

    def glass(p, n):
        frame = (np.abs(p[:, 2] - 5.6) < 0.6) | (np.abs(p[:, 2] - 34.6) < 0.6)
        streak = hash3(np.floor((p[:, 0] + p[:, 2]) / 3.0), 1, 1, 4) > 0.8
        return np.where(frame, RID['lavlt'], RID['glass']), np.where(frame, 2.6, 3.0 + streak * 0.8), np.full(len(p), 0.8)

    def admat(p, n):
        x = p[:, 1]; z = p[:, 2]
        img = (np.abs(x + 0.5) < 4.6) & (np.abs(z - 19) < 12.5)
        band = img & (np.abs(z - 24) < 4)
        txt = img & sign_text(-x, z, 'SALE', 0.5, 13.0, px=1.0)
        r = np.where(band, RID['teal'], np.where(img, RID['white'], RID['night']))
        r = np.where(txt, RID['red'], r)
        return r, np.where(img, np.where(band, 3.0, 3.8), 2.0), np.zeros(len(p))
    return M(parts, [solid('night', 2.6), solid('night', 2.3), glass, admat, solid('wood', 2.4)], (-25, 25, -10, 10, 0, 40))


def phone_booth():
    def parts(P):
        body = rbox(P, (0, 0, 21), (6, 6, 21), 0.8)
        cap = rbox(P, (0, 0, 43.5), (6.6, 6.6, 1.5), 0.6)
        return [body, cap]

    def body_m(p, n):
        side = np.abs(n[:, 2]) < 0.5
        u = np.where(np.abs(n[:, 1]) > 0.5, p[:, 0], p[:, 1])
        pane = side & (np.abs(u) < 4.6) & (p[:, 2] > 8) & (p[:, 2] < 38)
        bar = pane & ((np.abs(np.mod(p[:, 2] - 8, 7.5)) < 0.5) | (np.abs(u) < 0.35))
        r = np.where(pane, RID['glass'], RID['navy'])
        r = np.where(bar, RID['navy'], r)
        t = np.where(pane, 2.6 + (p[:, 2] - 8) * 0.03, 2.6)
        return r, np.where(bar, 2.2, t), np.where(pane, 0.8, 0.2)

    def cap_m(p, n):
        side = np.abs(n[:, 2]) < 0.5
        u = np.where(np.abs(n[:, 1]) > 0.5, p[:, 0] * np.sign(n[:, 1]), -p[:, 1] * np.sign(n[:, 0]))
        txt = side & sign_text(u, p[:, 2], 'PHONE', 0.0, 43.5, px=1.0)
        return np.where(txt, RID['white'], RID['navy']), np.where(txt, 4.4, 2.2), np.zeros(len(p))
    return M(parts, [body_m, cap_m], (-8, 8, -8, 8, 0, 46))


def parking_meter():
    def parts(P):
        return [capsule(P, (0, 0, 0), (0, 0, 17), 0.7), rbox(P, (0, 0, 20), (2.2, 1.6, 3.2), 0.8)]

    def head(p, n):
        win = (n[:, 1] > 0.5) & (np.abs(p[:, 2] - 21) < 1.0) & (np.abs(p[:, 0]) < 1.2)
        return np.where(win, RID['white'], RID['lavlt']), np.where(win, 3.8, 2.6), np.full(len(p), 0.5)
    return M(parts, [solid('night', 2.4), head], (-3, 3, -3, 3, 0, 24))


def utility_box():
    def parts(P):
        return [rbox(P, (0, 0, 9), (6, 3.5, 9), 0.7), rbox(P, (0, 0, 18.4), (6.6, 4.1, 0.6), 0.3)]

    def m(p, n):
        tag = (n[:, 1] > 0.5) & (np.abs(p[:, 0] + 2) < 1.6) & (np.abs(p[:, 2] - 12) < 2.2) & (hash3(np.floor(p[:, 0] * 2), np.floor(p[:, 2] * 2), 1, 7) > 0.4)
        seam = (n[:, 1] > 0.5) & (np.abs(p[:, 0]) < 0.25)
        r = np.where(tag, RID['plum'], RID['sage'])
        return r, np.where(seam, 1.6, np.where(tag, 3.4, 2.4)), np.full(len(p), 0.3)
    return M(parts, [m, solid('sage', 2.9)], (-8, 8, -6, 6, 0, 20))


def bollard():
    """Street bollard. The band is white: gold is reserved for valuables and interactables."""
    def parts(P):
        return [smin(cyl_z(P, (0, 0, 5), 1.8, 5, 0.6), ell(P, (0, 0, 10), (1.8, 1.8, 1.2)), 0.6)]

    def m(p, n):
        band = np.abs(p[:, 2] - 8) < 0.8
        return np.where(band, RID['white'], RID['night']), np.where(band, 3.8, 2.2), np.full(len(p), 0.3)
    return M(parts, [m], (-3, 3, -3, 3, 0, 12))


def ad_column():
    """Round advertising column with posters and a domed cap."""
    def parts(P):
        col = cyl_z(P, (0, 0, 19), 7.0, 19, 0.6)
        cap = smin(cyl_z(P, (0, 0, 39.2), 8.0, 1.2, 0.5), ell(P, (0, 0, 40.5), (6, 6, 3.5)), 1.0)
        base = cyl_z(P, (0, 0, 1.2), 8.0, 1.2, 0.4)
        return [col, cap, base]

    def posters(p, n):
        a = np.arctan2(p[:, 1], p[:, 0])
        k = np.floor((a + np.pi) / (np.pi / 3))
        z = p[:, 2]
        inner = np.mod((a + np.pi) / (np.pi / 3), 1.0)
        edge = (inner < 0.06) | (z < 5) | (z > 34)
        cols = np.array([RID['red'], RID['white'], RID['teal'], RID['clay'], RID['navy'], RID['white']])
        r = cols[k.astype(int) % 6]
        stripe = (np.abs(z - 14 - 6 * hash3(k, 1, 1, 3)) < 2.5)
        r = np.where(stripe, RID['night'], r)
        r = np.where(edge, RID['sage'], r)
        return r, np.where(edge, 2.2, np.where(stripe, 1.8, 3.2)), np.zeros(len(p))
    return M(parts, [posters, solid('sage', 2.6), solid('sage', 2.0)], (-9, 9, -9, 9, 0, 45))


def sandwich_board():
    def parts(P):
        Q = P.copy(); Q[:, 1] = np.abs(P[:, 1]) - 0.22 * (14 - P[:, 2])
        return [rbox(Q, (0, 0.7, 7), (4.5, 0.5, 7), 0.3)]

    def m(p, n):
        board = (np.abs(p[:, 0]) < 3.6) & (p[:, 2] > 2.0) & (p[:, 2] < 12.5) & (np.abs(n[:, 1]) > 0.5)
        chalk = board & (np.mod(p[:, 2], 2.5) < 0.6) & (np.abs(p[:, 0]) < 2.6 - np.mod(p[:, 2] * 1.7, 1.5))
        r = np.where(chalk, RID['white'], np.where(board, RID['night'], RID['wood']))
        return r, np.where(chalk, 3.6, np.where(board, 1.4, 2.4)), np.zeros(len(p))
    return M(parts, [m], (-6, 6, -6, 6, 0, 15))


# ------------------------------------------------------------------ cafe, kiosk, fountain
def cafe_set(canopy=('sage', 'white')):
    """A round cafe table with two chairs facing it and a striped parasol."""
    def parts(P):
        top = cyl_z(P, (0, 0, 14.5), 6.0, 0.6, 0.3)
        leg = capsule(P, (0, 0, 0), (0, 0, 14), 0.8)
        foot = cyl_z(P, (0, 0, 0.4), 3.0, 0.4, 0.2)
        chairs = np.full(len(P), 1e3)
        for sx in (-1, 1):
            cx = sx * 9.5
            seat = rbox(P, (cx, 0, 9), (3.2, 3.2, 0.5), 0.4)
            back = rbox(P, (cx + sx * 3.0, 0, 13.5), (0.5, 3.2, 4.2), 0.3)
            legs = np.minimum.reduce([capsule(P, (cx + ax, ay, 0), (cx + ax, ay, 9), 0.35) for ax in (-2.6, 2.6) for ay in (-2.6, 2.6)])
            chairs = np.minimum(chairs, np.minimum(np.minimum(seat, back), legs))
        pole = capsule(P, (0, 0, 14), (0, 0, 34), 0.5)
        Q = P.copy(); rr = np.hypot(P[:, 0], P[:, 1])
        canopy_d = np.maximum(np.abs(P[:, 2] - (35.5 - rr * 0.32)) - 0.6, rr - 15)
        return [top, np.minimum(leg, foot), chairs, pole, canopy_d]

    def can(p, n):
        a = np.arctan2(p[:, 1], p[:, 0])
        st = np.floor((a + np.pi) / (np.pi / 4)) % 2 == 0
        return np.where(st, RID[canopy[0]], RID[canopy[1]]), np.where(st, 2.8, 3.6), np.zeros(len(p))
    return M(parts, [solid('white', 3.2), solid('night', 2.0), solid('night', 2.4), solid('lavlt', 2.6), can], (-16, 16, -16, 16, 0, 38))


def kiosk():
    """Newspaper kiosk, 30 x 18 units: magazines on the front, a striped awning and a roof sign."""
    def parts(P):
        body = rbox(P, (0, -1, 12), (14, 8, 12), 0.8)
        roof = rbox(P, (0, 0, 25), (15.5, 10, 1.0), 0.5)
        Q = P.copy(); Q[:, 2] = P[:, 2] + 0.35 * (P[:, 1] - 7.0)
        awn = rbox(Q, (0, 11, 20.5), (14.5, 4, 0.6), 0.3)
        sign = rbox(P, (0, 2, 29), (10, 0.8, 3), 0.3)
        racks = rbox(P, (0, 8, 8), (12.5, 1.6, 6), 0.4)
        return [body, roof, awn, sign, racks]

    def body_m(p, n):
        hatch = (n[:, 1] > 0.5) & (np.abs(p[:, 0]) < 11) & (p[:, 2] > 14) & (p[:, 2] < 20)
        return np.where(hatch, RID['night'], RID['teal']), np.where(hatch, 1.6, 2.4), np.zeros(len(p))

    def awn_m(p, n):
        st = np.floor((p[:, 0] + 30) / 3.0) % 2 == 0
        return np.where(st, RID['teal'], RID['white']), np.where(st, 2.4, 3.4), np.zeros(len(p))

    def sign_m(p, n):
        txt = (n[:, 1] > 0.5) & sign_text(p[:, 0], p[:, 2], 'NEWS', 0.0, 29, px=1.0, scale=1)
        return np.where(txt, RID['red'], RID['white']), np.where(txt, 2.8, 4.0), np.zeros(len(p))

    def rack_m(p, n):
        h = hash3(np.floor(p[:, 0] / 2.2), np.floor(p[:, 2] / 3.0), 1, 9)
        cols = np.array([RID['red'], RID['white'], RID['navy'], RID['clay'], RID['sage'], RID['white']])
        r = cols[(h * 6).astype(int) % 6]
        gap = np.mod(p[:, 2], 3.0) < 0.5
        return np.where(gap, RID['night'], r), np.where(gap, 1.4, 3.0 + h * 0.6), np.zeros(len(p))
    return M(parts, [body_m, solid('teal', 3.0), awn_m, sign_m, rack_m], (-17, 17, -11, 16, 0, 33))


def fountain():
    """Round plaza fountain, about 2.5 tiles across: a stone basin, water and a two-tier centre bowl."""
    R = 38.0

    def parts(P):
        rr = np.hypot(P[:, 0], P[:, 1])
        rim = np.maximum(np.abs(rr - R + 2.5) - 2.5, np.abs(P[:, 2] - 4) - 4) - 0.5
        water = np.maximum(rr - (R - 4.6), np.abs(P[:, 2] - 4.5) - 0.5)
        stem = cyl_z(P, (0, 0, 8), 3.0, 8, 0.8)
        bowl1 = np.maximum(np.abs(np.hypot(rr, (P[:, 2] - 18) * 2.2) - 13) - 1.0, P[:, 2] - 18)
        stem2 = cyl_z(P, (0, 0, 22), 1.6, 5, 0.6)
        bowl2 = np.maximum(np.abs(np.hypot(rr, (P[:, 2] - 28) * 2.2) - 6.5) - 0.8, P[:, 2] - 28)
        jet = smin(capsule(P, (0, 0, 27), (0, 0, 34), 1.1, 0.5), ell(P, (0, 0, 22), (9, 9, 1.4)), 1.5)
        return [rim, water, np.minimum(stem, stem2), np.minimum(bowl1, bowl2), jet]

    def water_m(p, n):
        rr = np.hypot(p[:, 0], p[:, 1])
        ripple = np.sin(rr * 0.9 + hash3(np.floor(p[:, 0] / 3), np.floor(p[:, 1] / 3), 1, 2) * 2) > 0.6
        spark = hash3(np.floor(p[:, 0]), np.floor(p[:, 1]), 2, 5) > 0.95
        return np.where(spark, RID['white'], RID['teal']), np.where(spark, 3.8, 2.4 + ripple * 0.6), np.full(len(p), 0.9)

    def jet_m(p, n):
        return np.full(len(p), RID['white']), 3.6 + (hash3(np.floor(p[:, 2]), np.floor(p[:, 0] * 2), 1, 3) > 0.6) * 0.6, np.full(len(p), 0.5)
    return M(parts, [solid('stone', 2.8), water_m, solid('stone', 2.4), solid('stone', 3.0), jet_m], (-R - 1, R + 1, -R - 1, R + 1, 0, 36))


# ------------------------------------------------------------------ segments for walls, fences and beds (along local x)
def low_wall(length=16.0, ramp='brick'):
    """A short garden or lot wall: brick courses and a stone cap. Segments chain into curves."""
    hl = length / 2

    def parts(P):
        return [rbox(P, (0, 0, 4.5), (hl, 2.5, 4.5), 0.3), rbox(P, (0, 0, 9.6), (hl + 0.2, 3.2, 0.8), 0.3)]

    def wall_m(p, n):
        course = np.floor(p[:, 2] / 1.6)
        u = p[:, 0] + p[:, 1]
        h = hash3(np.floor(u / 2.8 + (course % 2) * 0.5), course, 1, 6)
        return np.full(len(p), RID[ramp]), 2.2 + (h - 0.5) * 0.8 + (np.mod(p[:, 2], 1.6) < 0.4) * -0.6, np.zeros(len(p))
    return M(parts, [wall_m, solid('stone', 3.0)], (-hl - 1, hl + 1, -4, 4, 0, 11))


def railing(length=16.0):
    """Black iron railing segment with spear-top bars."""
    hl = length / 2

    def parts(P):
        rail = np.minimum(rbox(P, (0, 0, 13.5), (hl, 0.4, 0.4), 0.2), rbox(P, (0, 0, 2.5), (hl, 0.4, 0.4), 0.2))
        xs = np.arange(-hl + 1.0, hl, 2.0)
        bars = np.minimum.reduce([capsule(P, (x, 0, 0), (x, 0, 15), 0.3) for x in xs])
        posts = np.minimum(rbox(P, (-hl + 0.6, 0, 8), (0.8, 0.8, 8), 0.3), rbox(P, (hl - 0.6, 0, 8), (0.8, 0.8, 8), 0.3))
        return [np.minimum(rail, bars), posts]
    return M(parts, [solid('night', 2.6, 0.4), solid('night', 2.8, 0.4)], (-hl - 1, hl + 1, -2, 2, 0, 17))


def chain_fence(length=32.0):
    """Chain-link lot fence with posts and a top rail. The mesh is see-through: only the wires are solid."""
    hl = length / 2

    def parts(P):
        mesh = rbox(P, (0, 0, 10), (hl, 0.15, 9), 0.0)
        wire = (np.mod(P[:, 0] + P[:, 2], 2.4) < 0.5) | (np.mod(P[:, 0] - P[:, 2] + 100, 2.4) < 0.5)
        mesh = np.where(wire, mesh, np.maximum(mesh, 0.3))
        posts = np.minimum.reduce([capsule(P, (x, 0, 0), (x, 0, 20), 0.7) for x in (-hl + 0.7, 0, hl - 0.7)])
        top = capsule(P, (-hl, 0, 19.5), (hl, 0, 19.5), 0.45)
        return [mesh, np.minimum(posts, top)]
    return M(parts, [solid('lavlt', 3.0, 0.4), solid('lavlt', 2.8, 0.5)], (-hl - 1, hl + 1, -2, 2, 0, 21))


def planter_bed(length=16.0):
    """A raised stone planting bed segment with shrubs and a few flowers; chains into curved beds."""
    hl = length / 2

    def parts(P):
        box = rbox(P, (0, 0, 3.5), (hl, 5, 3.5), 0.6)
        shrub = smin(ell(P, (-hl * 0.45, 0, 8.5), (hl * 0.6, 4.2, 3.6)), ell(P, (hl * 0.45, 0.3, 8.8), (hl * 0.6, 4.2, 3.9)), 2.0) + _bumpy(P, 0.4, 2.0)
        fl = np.minimum.reduce([ell(P, (x, y, 11.6), (0.9, 0.9, 0.9)) for x, y in ((-hl * 0.6, 1.5), (-1, -2), (hl * 0.5, 2))])
        return [box, shrub, fl]
    return M(parts, [solid('stone', 2.7), _leaf(5, 2.2), solid('plum', 3.8)], (-hl - 1, hl + 1, -7, 7, 0, 14))


def hedge(length=16.0):
    hl = length / 2

    def parts(P):
        return [rbox(P, (0, 0, 6), (hl, 4, 6), 3.0) + _bumpy(P, 0.5, 1.7)]
    return M(parts, [_leaf(8, 2.0)], (-hl - 2, hl + 2, -6, 6, 0, 13))


# ------------------------------------------------------------------ alley clutter
def pallets(n=3):
    def parts(P):
        out = []
        for k in range(n):
            z0 = k * 2.6
            boards = np.minimum.reduce([rbox(P, (0, y, z0 + 2.2), (10, 1.3, 0.35), 0.1) for y in (-6.5, -3.2, 0, 3.2, 6.5)])
            blocks = np.minimum.reduce([rbox(P, (x, y, z0 + 0.9), (1.2, 1.2, 0.9), 0.1) for x in (-8.5, 0, 8.5) for y in (-6, 0, 6)])
            out.append(np.minimum(boards, blocks))
        return [np.minimum.reduce(out)]

    def m(p, n_):
        h = hash3(np.floor(p[:, 1] / 3.2), np.floor(p[:, 2] / 2.6), 1, 4)
        return np.full(len(p), RID['wood']), 2.4 + (h - 0.5) * 0.9, np.zeros(len(p))
    return M(parts, [m], (-12, 12, -9, 9, 0, n * 2.6 + 1))


def pipes():
    def parts(P):
        ps = [capsule(P, (-18, y, z), (18, y, z), r) for y, z, r in ((-3.2, 2.2, 2.2), (1.4, 2.2, 2.2), (-1.0, 5.8, 2.0))]
        return [np.minimum.reduce(ps)]

    def m(p, n):
        end = np.abs(p[:, 0]) > 17.4
        rust = hash3(np.floor(p[:, 0] / 2), np.floor(p[:, 2]), 2, 5) > 0.7
        return np.where(end, RID['night'], np.where(rust, RID['clay'], RID['lavlt'])), np.where(end, 1.2, 2.4), np.full(len(p), 0.5)
    return M(parts, [m], (-21, 21, -7, 6, 0, 9))


def ac_unit():
    def parts(P):
        return [rbox(P, (0, 0, 7), (8, 6, 7), 0.8), rbox(P, (0, 0, 0.6), (9, 7, 0.6), 0.2)]

    def m(p, n):
        front = n[:, 1] > 0.5
        rr = np.hypot(p[:, 0] + 1.5, p[:, 2] - 7.5)
        grille = front & (rr < 4.6)
        blades = grille & (np.abs(np.mod(np.arctan2(p[:, 2] - 7.5, p[:, 0] + 1.5) * 3 / np.pi, 2.0) - 1.0) < 0.4)
        vent = front & (p[:, 0] > 5) & (np.mod(p[:, 2], 2.0) < 0.6)
        r = np.where(grille, RID['night'], RID['white'])
        t = np.where(blades, 2.4, np.where(grille, 1.2, np.where(vent, 2.2, 2.9)))
        return np.where(blades, RID['lavlt'], r), t, np.full(len(p), 0.3)
    return M(parts, [m, solid('stone', 1.8)], (-10, 10, -8, 8, 0, 15))


def trash_bags(n=3, seed=2):
    def parts(P):
        rng = np.random.default_rng(seed)
        bags = []
        for k in range(n):
            x, y = rng.uniform(-6, 6), rng.uniform(-4, 4)
            r = rng.uniform(3.6, 4.6)
            bag = smin(ell(P, (x, y, r * 0.8), (r, r * 0.9, r * 0.85)), capsule(P, (x, y, r * 1.5), (x + 0.4, y, r * 1.9), 0.7), 0.8)
            bags.append(bag + _bumpy(P, 0.25, 2.4))
        return [np.minimum.reduce(bags)]
    return M(parts, [solid('night', 2.6, 0.7)], (-12, 12, -10, 10, 0, 12))


def bin_wheelie(col='sage'):
    def parts(P):
        Q = P.copy(); s = 1.0 + 0.04 * P[:, 2]
        Q[:, 0] = P[:, 0] / s; Q[:, 1] = P[:, 1] / s
        body = rbox(Q, (0, 0, 9), (4.5, 5, 9), 0.6)
        lid = rbox(P, (0, -0.3, 18.8), (5.4, 6.4, 0.6), 0.3)
        wheels = np.minimum(cyl_z(P, (-4, -5.5, 1.5), 1.5, 0.6, 0.2), cyl_z(P, (4, -5.5, 1.5), 1.5, 0.6, 0.2))
        return [body, lid, wheels]
    return M(parts, [solid(col, 2.4), solid(col, 3.0), solid('night', 1.6)], (-7, 7, -8, 8, 0, 20))


def boxes_alley(seed=4):
    def parts(P):
        rng = np.random.default_rng(seed)
        out = []
        for (x, y, z, s) in ((-4, 0, 0, 1.0), (5, -1, 0, 0.8), (-2, 1, 10, 0.7), (6, 4, 0, 0.6)):
            hx, hy, hz = 5 * s, 4.5 * s, 5 * s
            out.append(rbox(P, (x, y, z + hz), (hx, hy, hz), 0.3))
        return [np.minimum.reduce(out)]

    def m(p, n):
        tape = (np.abs(n[:, 2]) > 0.6) & (np.mod(np.abs(p[:, 0]) + 0.2, 10.0) < 0.9)
        h = hash3(np.floor(p[:, 0] / 9), np.floor(p[:, 2] / 9), 1, 3)
        return np.where(tape, RID['stone'], RID['clay']), np.where(tape, 3.2, 2.6 + (h - 0.5) * 0.6), np.zeros(len(p))
    return M(parts, [m], (-11, 11, -7, 9, 0, 18))


def puddle_cones():
    """Two traffic cones (for road works and the alley)."""
    def parts(P):
        cones = []
        for x in (-4, 4):
            r = 2.8 - 0.22 * P[:, 2]
            c = np.maximum(np.hypot(P[:, 0] - x, P[:, 1]) - np.maximum(r, 0.3), np.abs(P[:, 2] - 5.5) - 5.5)
            base = rbox(P, (x, 0, 0.4), (3.4, 3.4, 0.4), 0.3)
            cones.append(np.minimum(c, base))
        return [np.minimum.reduce(cones)]

    def m(p, n):
        band = np.abs(p[:, 2] - 6) < 1.0
        return np.where(band, RID['white'], RID['red']), np.where(band, 3.8, 3.0), np.zeros(len(p))
    return M(parts, [m], (-8, 8, -4, 4, 0, 12))


# ------------------------------------------------------------------ fuel station (milestone 3)
def gas_pump():
    """A fuel pump on a concrete island: a tall cabinet with a screen, a hose and a nozzle on the side."""
    def parts(P):
        island = rbox(P, (0, 0, 1.2), (9, 6, 1.2), 0.5)
        body = rbox(P, (0, 0, 13), (6, 3.6, 11), 0.8)
        head = rbox(P, (0, 0, 26.5), (6.6, 4.2, 2.6), 0.8)
        hose = capsule(P, (6.4, 1.5, 18), (8.2, 2.5, 8), 0.5)
        nozzle = rbox(P, (7.4, 2.8, 15.5), (0.8, 0.8, 2.2), 0.3)
        return [island, body, head, np.minimum(hose, nozzle)]

    def body_m(p, n):
        front = n[:, 1] > 0.5
        screen = front & (np.abs(p[:, 0]) < 3.6) & (np.abs(p[:, 2] - 19) < 2.6)
        keys = front & (np.abs(p[:, 0]) < 3.0) & (np.abs(p[:, 2] - 12.5) < 2.0) & (np.mod(p[:, 0] + 10, 1.5) < 0.8)
        stripe = np.abs(p[:, 2] - 7) < 1.2
        r = np.where(screen, RID['teal'], np.where(keys, RID['lavlt'], np.where(stripe, RID['red'], RID['white'])))
        t = np.where(screen, 3.4, np.where(keys, 2.2, np.where(stripe, 2.8, 3.1)))
        return r, t, np.where(screen, 0.8, 0.2)

    def head_m(p, n):
        front = n[:, 1] > 0.5
        txt = front & sign_text(p[:, 0], p[:, 2], 'FUEL', 0.0, 26.5, px=1.0)
        return np.where(txt, RID['white'], RID['red']), np.where(txt, 4.2, 2.6), np.zeros(len(p))
    return M(parts, [solid('stone', 2.4), body_m, head_m, solid('night', 1.8)], (-11, 11, -8, 8, 0, 31))


# ------------------------------------------------------------------ grass tufts and weeds (ground decals)
def tuft(n=7, h=7.0, spread=3.0, seed=1, flowers=None, ramp='sage'):
    """A small clump of grass blades leaning out from a common root. Baked into the ground as a decal, so it is
    rendered without the outer outline (render(..., outline=False)), like the floor clutter in the drafts."""
    rng = np.random.default_rng(seed)
    blades = []
    for k in range(n):
        a = rng.uniform(0, 2 * np.pi)
        r0 = rng.uniform(0, spread * 0.4)
        lean = rng.uniform(0.25, 0.7) * spread
        hh = h * rng.uniform(0.55, 1.0)
        x0, y0 = r0 * np.cos(a), r0 * np.sin(a)
        blades.append(((x0, y0, 0.0), (x0 + lean * np.cos(a), y0 + lean * np.sin(a), hh)))
    fl = []
    if flowers:
        for k in range(3):
            a = rng.uniform(0, 2 * np.pi)
            fl.append((spread * 0.6 * np.cos(a), spread * 0.6 * np.sin(a), h * rng.uniform(0.7, 1.0)))

    def parts(P):
        bl = np.minimum.reduce([capsule(P, a, b, 0.6, 0.32) for a, b in blades])
        out = [bl]
        out.append(np.minimum.reduce([ell(P, c, (0.6, 0.6, 0.6)) for c in fl]) if fl else np.full(len(P), 1e3))
        return out

    def bm(p, n_):
        t = 1.2 + p[:, 2] / max(h, 1) * 2.8
        hh = hash3(np.floor(p[:, 0] * 2), np.floor(p[:, 1] * 2), 1, seed)
        return np.where(hh > 0.8, RID['khaki'], RID[ramp]), t, np.zeros(len(p))
    return M(parts, [bm, solid(flowers or 'white', 3.9)], (-spread - 2, spread + 2, -spread - 2, spread + 2, 0, h + 1.5))


DECALS = {
    'tuft_a': lambda: tuft(11, 7.0, 3.0, 1), 'tuft_b': lambda: tuft(7, 5.0, 2.2, 2), 'tuft_tall': lambda: tuft(14, 10.0, 3.4, 3),
    'tuft_dry': lambda: tuft(9, 6.0, 2.8, 4, ramp='khaki'), 'weeds_white': lambda: tuft(9, 6.5, 3.0, 5, 'white'),
    'weeds_plum': lambda: tuft(9, 6.0, 3.0, 6, 'plum'),
}


PROPS = {
    'gas_pump': gas_pump,
    'bus_shelter': bus_shelter, 'phone_booth': phone_booth, 'parking_meter': parking_meter, 'utility_box': utility_box,
    'bollard': bollard, 'ad_column': ad_column, 'sandwich_board': sandwich_board,
    'cafe_set': cafe_set, 'cafe_set_red': lambda: cafe_set(('red', 'white')), 'kiosk': kiosk, 'fountain': fountain,
    'pallets': pallets, 'pipes': pipes, 'ac_unit': ac_unit, 'trash_bags': trash_bags,
    'bin_sage': lambda: bin_wheelie('sage'), 'bin_navy': lambda: bin_wheelie('navy'), 'boxes': boxes_alley, 'cones': puddle_cones,
}

# segments that are placed at any of SEGMENT_ANGLES directions to build straight runs and curves
SEGMENTS = {
    'wall_brick': lambda: low_wall(16.0, 'brick'), 'wall_stone': lambda: low_wall(16.0, 'stone'),
    'railing': lambda: railing(16.0), 'fence': lambda: chain_fence(32.0), 'bed': lambda: planter_bed(16.0),
    'hedge': lambda: hedge(16.0),
}
SEGMENT_LEN = {'wall_brick': 16.0, 'wall_stone': 16.0, 'railing': 16.0, 'fence': 32.0, 'bed': 16.0, 'hedge': 16.0}

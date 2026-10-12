"""Shop furniture for the Phase 2 interiors (M6b): the hardware store, the clothing store and the car dealer's
sales cabin. Same conventions as decor.py: the FRONT of every model faces local +y; floor items have their origin
at the footprint centre; wall-mounted items have the back plate on the wall plane and stick out toward +y.
"""
import numpy as np
from sdf import ell, capsule, rbox, cyl_z, cyl_y, smin, solid, RID, hash3
from decor import M

GARMENTS = np.array(['plum', 'teal', 'sage', 'clay', 'navy', 'stone', 'red', 'khaki', 'white'])


def _pick(seed, *keys, n=len(GARMENTS)):
    h = hash3(*[np.asarray(k, float) for k in keys], seed)
    return (h * n).astype(int) % n


# ======================================================================= clothing store
def clothing_rack(seed=1, length=30.0):
    """A chrome rail on two T-feet with garments hanging along it (length along x)."""
    L = length / 2

    def parts(P):
        legs = np.minimum(capsule(P, (-L, 0, 0.8), (-L, 0, 36), 0.55), capsule(P, (L, 0, 0.8), (L, 0, 36), 0.55))
        feet = np.minimum(capsule(P, (-L, -5, 0.6), (-L, 5, 0.6), 0.6), capsule(P, (L, -5, 0.6), (L, 5, 0.6), 0.6))
        rail = capsule(P, (-L, 0, 35.5), (L, 0, 35.5), 0.5)
        clothes = np.full(len(P), 1e3)
        x = -L + 2.2
        k = 0
        while x < L - 1.5:
            long_ = hash3(np.array([k]), np.array([2]), 1, seed)[0] > 0.6
            bot = 12.0 if long_ else 18.0
            g = rbox(P, (x, 0, (34 + bot) / 2), (1.0, 4.6, (34 - bot) / 2), 0.6)
            shoulders = ell(P, (x, 0, 33.2), (1.1, 4.6, 1.2))
            clothes = np.minimum(clothes, smin(g, shoulders, 0.8))
            x += 2.3
            k += 1
        return [np.minimum(np.minimum(legs, feet), rail), clothes]

    def cm(p, n):
        k = np.floor((p[:, 0] + L - 1.05) / 2.3)
        idx = _pick(seed, k, 1, 1)
        ramp = np.array([RID[g] for g in GARMENTS])[idx]
        fold = np.mod(p[:, 1] + 6, 2.2) < 0.5
        return ramp, 2.5 + (hash3(k, 3, 3, seed) - 0.5) * 0.9 - fold * 0.35, np.zeros(len(p))
    return M(parts, [solid('white', 3.3, 0.7), cm], (-L - 1, L + 1, -6, 6, 0, 37))


def mannequin(top=('plum', 2.6), bottom=('night', 2.4)):
    """A headless dress form on a stand, dressed in a top and trousers."""
    def parts(P):
        base = cyl_z(P, (0, 0, 0.6), 5.0, 0.6, 0.3)
        pole = capsule(P, (0, 0, 1), (0, 0, 18), 0.55)
        hips = ell(P, (0, 0, 20.5), (3.2, 4.2, 3.2))
        legs = np.minimum(capsule(P, (0, 2, 19), (0.3, 2.1, 9), 1.7, 1.3), capsule(P, (0, -2, 19), (0.3, -2.1, 9), 1.7, 1.3))
        torso = smin(ell(P, (0.2, 0, 28.5), (3.2, 4.4, 5.2)), capsule(P, (0, 4.2, 31.5), (0, -4.2, 31.5), 1.6), 1.2)
        arms = np.minimum(capsule(P, (0, 4.8, 31), (0.8, 5.4, 22.5), 1.1, 0.9), capsule(P, (0, -4.8, 31), (0.8, -5.4, 22.5), 1.1, 0.9))
        neck = capsule(P, (0, 0, 33), (0, 0, 36.5), 1.0)
        knob = ell(P, (0, 0, 37.3), (1.3, 1.3, 1.0))
        return [np.minimum(base, pole), smin(hips, legs, 1.2), smin(torso, arms, 0.8), np.minimum(neck, knob)]
    return M(parts, [solid('night', 1.8, 0.4), solid(*bottom), solid(*top), solid('stone', 3.4)], (-6, 6, -7, 7, 0, 39))


def display_table(seed=4, w=24.0, d=14.0):
    """A low wooden display table with stacks of folded clothes."""
    def parts(P):
        top = rbox(P, (0, 0, 12.6), (w / 2, d / 2, 0.8), 0.4)
        legs = np.minimum.reduce([rbox(P, (sx * (w / 2 - 1.6), sy * (d / 2 - 1.6), 6), (0.9, 0.9, 6), 0.3) for sx in (-1, 1) for sy in (-1, 1)])
        stacks = np.full(len(P), 1e3)
        for k, (sx, sy) in enumerate([(-7, -3), (0, -3), (7, -3), (-6, 3.2), (2, 3.2), (8, 3.2)]):
            h = 1.2 + hash3(np.array([k]), 1, 1, seed)[0] * 2.4
            stacks = np.minimum(stacks, rbox(P, (sx, sy, 13.4 + h), (2.6, 2.3, h), 0.4))
        return [np.minimum(top, legs), stacks]

    def sm(p, n):
        layer = np.floor((p[:, 2] - 13.4) / 0.9)
        k = np.floor((p[:, 0] + 12) / 6.5) + 7 * (p[:, 1] > 0)
        idx = _pick(seed, k, layer, 2)
        ramp = np.array([RID[g] for g in GARMENTS])[idx]
        return ramp, 2.6 + (np.mod(p[:, 2] - 13.4, 0.9) < 0.25) * -0.5, np.zeros(len(p))
    return M(parts, [solid('wood', 2.6), sm], (-w / 2 - 1, w / 2 + 1, -d / 2 - 1, d / 2 + 1, 0, 19))


def fitting_booth(curtain='plum'):
    """A changing booth: back and side panels, a curtain on a rail across the front (+y), drawn half open."""
    def parts(P):
        x, y, z = P[:, 0], P[:, 1], P[:, 2]
        back = rbox(P, (0, -11, 24), (12, 0.8, 24), 0.3)
        sides = np.minimum(rbox(P, (-11.5, 0, 24), (0.8, 11.5, 24), 0.3), rbox(P, (11.5, 0, 24), (0.8, 11.5, 24), 0.3))
        rail = capsule(P, (-11, 11, 47), (11, 11, 47), 0.5)
        folds = 11 + 0.8 * np.sin(x * 1.6)
        cur = np.maximum(np.abs(y - folds) - 0.7, np.maximum(z - 46.5, 2.0 - z))
        cur = np.maximum(cur, x - 2.0)                      # half open: the curtain covers the left half
        hook = rbox(P, (9, -10, 34), (1.4, 0.8, 0.5), 0.2)
        stool = cyl_z(P, (5, -5, 5.5), 3.0, 5.5, 0.6)
        return [np.minimum(back, sides), rail, cur, np.minimum(hook, stool)]

    def pm(p, n):
        inner = (n[:, 1] > 0.5) & (p[:, 1] < -9)
        return np.where(inner, RID['stone'], RID['white']), np.where(inner, 3.4, 3.0), np.zeros(len(p))

    def cm(p, n):
        return np.full(len(p), RID[curtain]), 2.6 + 0.5 * np.sin(p[:, 0] * 1.6), np.zeros(len(p))
    return M(parts, [pm, solid('white', 3.6, 0.6), cm, solid('wood', 2.4)], (-13, 13, -12, 12.5, 0, 48))


def shoe_shelf(seed=6):
    """A low stepped shelf of shoes, back to the wall."""
    def parts(P):
        steps = np.minimum.reduce([rbox(P, (0, 2 + k * 3.0, 4 + (2 - k) * 6), (14, 1.8, 0.6 + (2 - k) * 0.0), 0.3) for k in range(3)])
        body = rbox(P, (0, 1.5, 9), (14.5, 1.5, 9), 0.3)
        sides = np.minimum(rbox(P, (-14.5, 4.5, 9), (0.6, 4.5, 9), 0.3), rbox(P, (14.5, 4.5, 9), (0.6, 4.5, 9), 0.3))
        shoes = np.full(len(P), 1e3)
        for k in range(3):
            for j in range(5):
                x0 = -11 + j * 5.5
                z0 = 4 + (2 - k) * 6 + 1.2
                y0 = 2 + k * 3.0
                shoes = np.minimum(shoes, capsule(P, (x0 - 1, y0 - 0.6, z0), (x0 - 1, y0 + 1.6, z0 - 0.2), 0.9, 0.7))
                shoes = np.minimum(shoes, capsule(P, (x0 + 1.2, y0 - 0.6, z0), (x0 + 1.2, y0 + 1.6, z0 - 0.2), 0.9, 0.7))
        return [np.minimum(np.minimum(steps, body), sides), shoes]

    def sm(p, n):
        idx = _pick(seed, np.floor((p[:, 0] + 14) / 5.5), np.floor(p[:, 2] / 6), 3, n=5)
        ramp = np.array([RID['night'], RID['wood'], RID['clay'], RID['white'], RID['red']])[idx]
        return ramp, np.full(len(p), 2.6), np.full(len(p), 0.3)
    return M(parts, [solid('wood', 2.8), sm], (-15, 15, 0, 10, 0, 18))


# ======================================================================= hardware store
def tool_pegboard(seed=2):
    """A wall pegboard hung with tools (wall-mounted): hammers, wrenches, a saw, screwdrivers, tape."""
    def parts(P):
        board = rbox(P, (0, 0.6, 30), (15, 0.6, 12), 0.2)
        t = np.full(len(P), 1e3)
        # hammers
        for x in (-12, -9):
            t = np.minimum(t, capsule(P, (x, 1.6, 22), (x, 1.6, 33), 0.45))
            t = np.minimum(t, rbox(P, (x, 1.6, 33.8), (1.6, 0.7, 0.8), 0.3))
        # wrenches
        for k, x in enumerate((-5, -3, -1)):
            t = np.minimum(t, capsule(P, (x, 1.5, 24 + k), (x, 1.5, 34), 0.35))
            t = np.minimum(t, ell(P, (x, 1.5, 34.6), (0.9, 0.5, 0.9)))
        # saw
        t = np.minimum(t, np.maximum(rbox(P, (5.5, 1.4, 30), (4.5, 0.25, 2.6), 0.1), (P[:, 2] - 30) - (P[:, 0] - 1) * 0.55))
        t = np.minimum(t, rbox(P, (10.6, 1.6, 31.6), (1.3, 0.6, 1.8), 0.4))
        # screwdrivers
        for x in (3, 5, 7, 9, 11):
            t = np.minimum(t, capsule(P, (x, 1.6, 36), (x, 1.6, 40.5), 0.55))
        t = np.minimum(t, capsule(P, (-12, 1.6, 38), (-6, 1.6, 38), 0.6))
        return [board, t]

    def bm(p, n):
        hole = (np.mod(p[:, 0] + 30, 2.0) < 0.5) & (np.mod(p[:, 2], 2.0) < 0.5) & (n[:, 1] > 0.5)
        return np.full(len(p), RID['khaki']), 3.0 - hole * 1.2, np.zeros(len(p))

    def tm(p, n):
        x, z = p[:, 0], p[:, 2]
        handle = ((x < -7) & (z < 31)) | ((x > 2) & (z > 36)) | ((x > 9) & (x < 12.5) & (z < 33.8) & (z > 29.5))
        ramp = np.where(handle, np.where(x > 2, RID['red'], RID['wood']), RID['lavlt'])
        return ramp, np.where(handle, 2.6, 3.5), np.where(handle, 0.0, 0.8)
    return M(parts, [bm, tm], (-16, 16, -0.5, 3, 17, 43))


def paint_shelf(seed=3):
    """Metal shelving stocked with paint tins (rows of cylinders with coloured labels)."""
    def parts(P):
        posts = np.minimum.reduce([rbox(P, (sx, sy, 20), (0.6, 0.6, 20), 0.2) for sx in (-14, 14) for sy in (-5, 5)])
        shelves = np.minimum.reduce([rbox(P, (0, 0, z), (14.5, 5.5, 0.5), 0.2) for z in (2, 14, 26, 38)])
        tins = np.full(len(P), 1e3)
        for z in (2.5, 14.5, 26.5):
            for x in np.arange(-12, 13, 4.0):
                for y in (-2.2, 2.2):
                    tins = np.minimum(tins, cyl_z(P, (x, y, z + 3.2), 1.8, 3.2, 0.3))
        return [posts, shelves, tins]

    def tm(p, n):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        k = _pick(seed, np.floor((x + 14) / 4), np.floor(z / 12), 4, n=6)
        ramp = np.array([RID['red'], RID['navy'], RID['sage'], RID['white'], RID['khaki'], RID['teal']])[k]
        lid = n[:, 2] > 0.6
        band = (np.mod(z - 2.5, 12) > 1.4) & (np.mod(z - 2.5, 12) < 4.6)
        return np.where(lid | ~band, RID['lavlt'], ramp), np.where(lid, 3.6, np.where(band, 2.8, 3.2)), np.full(len(p), 0.6)
    return M(parts, [solid('blueg', 2.4), solid('blueg', 2.8), tm], (-16, 16, -7, 7, 0, 40))


def lumber_rack():
    """A floor rack of planks and timber laid flat on brackets (length along x)."""
    def parts(P):
        uprights = np.minimum.reduce([rbox(P, (x, -4, 18), (0.9, 0.9, 18), 0.2) for x in (-15, 0, 15)])
        arms = np.minimum.reduce([rbox(P, (x, 0, z), (0.6, 4.8, 0.5), 0.2) for x in (-15, 0, 15) for z in (8, 18, 28)])
        planks = np.full(len(P), 1e3)
        for z in (8.6, 18.6, 28.6):
            for k in range(3):
                planks = np.minimum(planks, rbox(P, (0, -2.4 + k * 2.6, z + 0.9 + (k % 2) * 1.8), (17, 1.1, 0.8), 0.2))
        return [np.minimum(uprights, arms), planks]

    def pm(p, n):
        grain = np.mod(p[:, 0] * 0.7 + np.sin(p[:, 1] * 3) * 2, 3.0) < 0.6
        return np.full(len(p), RID['wood']), 3.4 - grain * 0.5 + (n[:, 2] > 0.5) * 0.3, np.zeros(len(p))
    return M(parts, [solid('night', 2.4, 0.3), pm], (-18, 18, -6, 6, 0, 37))


def step_ladder():
    """An aluminium step ladder, opened (front legs toward +y)."""
    def parts(P):
        fr = np.minimum(capsule(P, (-4, 4, 0.5), (-3.4, 0, 30), 0.55), capsule(P, (4, 4, 0.5), (3.4, 0, 30), 0.55))
        bk = np.minimum(capsule(P, (-4, -4, 0.5), (-3.4, -0.4, 29), 0.5), capsule(P, (4, -4, 0.5), (3.4, -0.4, 29), 0.5))
        steps = np.minimum.reduce([rbox(P, (0, 4 - (z / 30) * 4 + 0.6, z), (3.8, 1.2, 0.35), 0.15) for z in (7, 14, 21)])
        top = rbox(P, (0, -0.2, 30.4), (4.2, 1.8, 0.6), 0.3)
        return [np.minimum(fr, bk), np.minimum(steps, top)]
    return M(parts, [solid('white', 3.4, 0.8), solid('red', 2.6)], (-5, 5, -5, 5, 0, 31))


def bulk_bins(seed=5):
    """A stand of open bins with nails, screws and bolts (front toward +y), price tags on the lips."""
    def parts(P):
        stand = rbox(P, (0, -1.5, 8), (13, 4.5, 8), 0.4)
        bins = np.full(len(P), 1e3)
        fill = np.full(len(P), 1e3)
        for r, (y, z) in enumerate(((2.5, 10.5), (-2.5, 16.5))):
            for c in range(4):
                x = -9.6 + c * 6.4
                outer = rbox(P, (x, y, z), (3.0, 2.6, 2.2), 0.3)
                inner = rbox(P, (x, y, z + 1.0), (2.4, 2.0, 2.2), 0.2)
                bins = np.minimum(bins, np.maximum(outer, -inner))
                fill = np.minimum(fill, rbox(P, (x, y, z + 0.6), (2.4, 2.0, 0.6 + hash3(np.array([c]), r, 1, seed)[0] * 0.5), 0.3))
        return [stand, bins, fill]

    def fm(p, n):
        g = hash3(np.floor(p[:, 0] * 1.4), np.floor(p[:, 1] * 1.4), 1, seed) > 0.5
        return np.full(len(p), RID['lavlt']), 3.0 + g * 0.8, np.full(len(p), 0.8)

    def bnm(p, n):
        tag = (n[:, 1] > 0.6) & (np.mod(p[:, 0] + 12.8, 6.4) > 2.2) & (np.mod(p[:, 0] + 12.8, 6.4) < 4.2)
        return np.where(tag, RID['white'], RID['red']), np.where(tag, 4.0, 2.5), np.zeros(len(p))
    return M(parts, [solid('blueg', 2.2), bnm, fm], (-14, 14, -7, 6, 0, 20))


def key_cutter():
    """A key-cutting machine for the counter top."""
    def parts(P):
        base = rbox(P, (0, 0, 1.5), (4.5, 3, 1.5), 0.4)
        body = rbox(P, (-1, -0.5, 4.5), (2.8, 2, 2), 0.5)
        wheel = cyl_y(P, (2.5, 0, 5), 2.0, 0.5, 0.2)
        keys = np.minimum.reduce([rbox(P, (-3 + k * 1.2, 2.6, 6.0), (0.35, 0.15, 1.2), 0.1) for k in range(5)])
        return [base, body, wheel, keys]
    return M(parts, [solid('blueg', 2.6, 0.5), solid('red', 2.6), solid('lavlt', 3.4, 0.9), solid('khaki', 3.6, 0.9)], (-5, 5, -4, 4, 0, 8))


# ======================================================================= the car dealer's cabin
def car_model_stand():
    """A scale model of a sedan on a low glass-topped plinth: the dealer's pride (front toward +y)."""
    def parts(P):
        plinth = rbox(P, (0, 0, 4.5), (5.5, 7.5, 4.5), 0.4)
        body = rbox(P, (0, 0, 11.2), (3.0, 6.6, 1.3), 0.8)
        cab = rbox(P, (0, -0.6, 13.4), (2.5, 3.2, 1.1), 0.7)
        wheels = np.minimum.reduce([ell(P, (sx * 2.9, sy * 4.2, 10.0), (0.7, 1.2, 1.2)) for sx in (-1, 1) for sy in (-1, 1)])
        return [plinth, body, cab, wheels]

    def cabm(p, n):
        glass = np.abs(n[:, 2]) < 0.6
        return np.where(glass, RID['glass'], RID['red']), np.where(glass, 3.4, 2.9), np.where(glass, 1.0, 0.9)
    return M(parts, [solid('night', 2.6, 0.4), solid('red', 2.8, 0.9), cabm, solid('asph', 1.2)], (-7, 7, -9, 9, 0, 16))


SHOP_DECOR = {
    'clothing_rack': clothing_rack, 'mannequin': mannequin, 'display_table': display_table,
    'fitting_booth': fitting_booth, 'shoe_shelf': shoe_shelf,
    'tool_pegboard': tool_pegboard, 'paint_shelf': paint_shelf, 'lumber_rack': lumber_rack,
    'step_ladder': step_ladder, 'bulk_bins': bulk_bins, 'key_cutter': key_cutter,
    'car_model_stand': car_model_stand,
}

"""Decoration + furniture library for interiors (and a few street items).

FACING CONVENTION (all models in this file):
  * The FRONT of every model faces local +y (the side a person uses / looks at).
  * Floor items: origin = footprint centre on the floor.
  * Wall-mounted items: origin = centre of the back plate ON the wall plane; the item sticks out toward local +y.
  * Use face('+x' | '-x' | '+y' | '-y') to get the render angle that points the front at that world direction.
"""
import numpy as np
from sdf import Model, ell, capsule, rbox, cyl_z, cyl_y, smin, solid, RID, hash3

FACE = {'+y': 0.0, '+x': -np.pi / 2, '-y': np.pi, '-x': np.pi / 2}


def face(d):
    return FACE[d]


def M(parts, mats, bbox):
    return Model(parts, mats, bbox)


def glassm(t=3.4):
    return lambda p, n: (np.full(len(p), RID['glass']), np.full(len(p), t), np.full(len(p), 1.0))


def leafm(seed=3, base=2.2, alt='khaki'):
    def m(p, n):
        h = hash3(np.floor(p[:, 0] / 1.8), np.floor(p[:, 1] / 1.8), np.floor(p[:, 2] / 1.8), seed)
        return np.where(h > 0.78, RID[alt], RID['sage']), base + (h - 0.5) * 0.9 + (p[:, 2] - 15) * 0.02, np.zeros(len(p))
    return m


# ======================================================================= plants
def plant_tall(seed=1):
    """Fiddle-leaf style tall plant in a ceramic pot."""
    def parts(P):
        pot = smin(cyl_z(P, (0, 0, 5), 4.2, 5, 1.0), cyl_z(P, (0, 0, 9.6), 4.8, 0.6, 0.3), 0.5)
        stem = capsule(P, (0, 0, 9), (0.5, 0.3, 30), 0.6)
        leaves = np.full(len(P), 1e3)
        for k in range(9):
            a = k * 2.4 + seed
            z = 16 + k * 2.6
            r = 4.5 - k * 0.2
            leaves = np.minimum(leaves, ell(P, (r * np.cos(a), r * np.sin(a), z), (3.2, 2.4, 1.6)))
        return [pot, stem, leaves]
    return M(parts, [solid('white', 3.2), solid('wood', 1.6), leafm(seed, 2.0)], (-10, 10, -10, 10, 0, 42))


def plant_snake():
    def parts(P):
        pot = cyl_z(P, (0, 0, 4), 3.6, 4, 0.8)
        blades = np.full(len(P), 1e3)
        for k, (dx, dy, h) in enumerate([(0, 0, 24), (1.6, 0.8, 19), (-1.5, 1, 21), (0.5, -1.6, 17), (-1, -1, 15), (1.8, -1, 13)]):
            blades = np.minimum(blades, capsule(P, (dx, dy, 7), (dx * 1.4, dy * 1.4, h), 0.9, 0.3))
        return [pot, blades]

    def bm(p, n):
        band = np.mod(p[:, 2], 3.0) < 0.9
        return np.where(band, RID['khaki'], RID['sage']), 1.7 + band * 0.8, np.zeros(len(p))
    return M(parts, [solid('night', 2.2), bm], (-6, 6, -6, 6, 0, 26))


def plant_small(seed=2):
    """Desk / shelf succulent."""
    def parts(P):
        pot = cyl_z(P, (0, 0, 1.6), 1.8, 1.6, 0.4)
        leaves = smin(ell(P, (0, 0, 4.2), (2.4, 2.4, 1.8)), ell(P, (0.6, -0.4, 5.6), (1.4, 1.4, 1.2)), 0.8)
        return [pot, leaves]
    return M(parts, [solid('clay', 2.8), leafm(seed, 2.6)], (-3, 3, -3, 3, 0, 7))


def plant_hanging():
    """Wall planter with trailing vines (wall-mounted)."""
    def parts(P):
        pot = cyl_z(P, (0, 3, 40), 3.2, 2.4, 0.6)
        hook = capsule(P, (0, 0, 44), (0, 3, 44), 0.4)
        vines = np.full(len(P), 1e3)
        for k, dx in enumerate((-2.4, -0.6, 1.2, 2.6)):
            vines = np.minimum(vines, capsule(P, (dx, 3 + 0.5 * k % 2, 40), (dx * 1.2, 4, 28 + k * 2), 0.8, 0.5))
        vines = smin(vines, ell(P, (0, 3, 42.5), (3.6, 3.6, 1.6)), 1.0)
        return [pot, hook, vines]
    return M(parts, [solid('white', 3.3), solid('night', 2.0), leafm(5, 2.3)], (-5, 5, -1, 8, 25, 46))


def ficus_tree():
    """Big lobby tree in a square planter."""
    def parts(P):
        box = rbox(P, (0, 0, 5), (7, 7, 5), 1.0)
        trunk = capsule(P, (0, 0, 9), (0.8, 0.4, 30), 1.0, 0.6)
        crown = np.full(len(P), 1e3)
        for (cx, cy, cz, r) in ((0, 0, 40, 9), (-5, 3, 34, 6), (5, -2, 35, 6), (1, 5, 32, 5), (-2, -5, 33, 5)):
            crown = smin(crown, ell(P, (cx, cy, cz), (r, r, r * 0.85)), 2.0)
        crown = crown + 0.5 * np.sin(P[:, 0] * 1.6) * np.sin(P[:, 1] * 1.7) * np.sin(P[:, 2] * 1.4)
        return [box, trunk, crown]
    return M(parts, [solid('stone', 2.6), solid('wood', 1.8), leafm(8, 2.0, 'khaki')], (-13, 13, -13, 13, 0, 50))


# ======================================================================= decorative objects
def vase_flowers(col='plum'):
    def parts(P):
        vase = smin(ell(P, (0, 0, 4), (2.6, 2.6, 4)), cyl_z(P, (0, 0, 8), 1.4, 1.6, 0.4), 1.0)
        stems = np.minimum.reduce([capsule(P, (0, 0, 8), (dx, dy, 13 + k), 0.3) for k, (dx, dy) in enumerate([(-1.5, 0.5), (1.2, 1), (0.3, -1.4), (-0.4, 1.6)])])
        heads = np.minimum.reduce([ell(P, (dx, dy, 13.5 + k), (1.2, 1.2, 1.0)) for k, (dx, dy) in enumerate([(-1.5, 0.5), (1.2, 1), (0.3, -1.4), (-0.4, 1.6)])])
        return [vase, stems, heads]
    return M(parts, [solid('teal', 3.0, 0.6), solid('sage', 2.0), solid(col, 3.9)], (-4, 4, -4, 4, 0, 19))


def vase_tall():
    def parts(P):
        return [smin(ell(P, (0, 0, 6), (3.4, 3.4, 6)), cyl_z(P, (0, 0, 13), 1.6, 3.0, 0.4), 1.4)]

    def m(p, n):
        band = (np.abs(p[:, 2] - 7) < 0.9) | (np.abs(p[:, 2] - 4) < 0.5)
        return np.where(band, RID['gold'], RID['navy']), np.where(band, 3.6, 2.4), np.full(len(p), 0.7)
    return M(parts, [m], (-5, 5, -5, 5, 0, 17))


def bowl_fruit():
    def parts(P):
        bowl = np.maximum(ell(P, (0, 0, 1.6), (3.6, 3.6, 2.0)), P[:, 2] - 2.4)
        fruit = np.minimum.reduce([ell(P, (dx, dy, 2.8 + k * 0.3), (1.2, 1.2, 1.2)) for k, (dx, dy) in enumerate([(-1.2, 0), (1, 0.6), (0.2, -1.2), (0, 0.8)])])
        return [bowl, fruit]

    def fm(p, n):
        k = hash3(np.floor(p[:, 0] / 1.6), np.floor(p[:, 1] / 1.6), 1, 3)
        return np.where(k > 0.5, RID['red'], RID['gold']), 3.2 + np.zeros(len(p)), np.full(len(p), 0.4)
    return M(parts, [solid('white', 3.6), fm], (-5, 5, -5, 5, 0, 5))


def books_row(n=6, seed=1):
    def parts(P):
        d = np.full(len(P), 1e3)
        x = -n * 0.9
        for k in range(n):
            h = 5 + hash3(np.array([k]), np.array([1]), 1, seed)[0] * 2.5
            w = 1.3 + hash3(np.array([k]), np.array([2]), 1, seed)[0] * 0.6
            d = np.minimum(d, rbox(P, (x + w / 2, 0, h / 2), (w / 2, 2.4, h / 2), 0.2))
            x += w + 0.15
        return [d]

    def m(p, n_):
        k = hash3(np.floor((p[:, 0] + 20) / 1.5), 1, 1, seed)
        ramps = np.array([RID['red'], RID['navy'], RID['sage'], RID['clay'], RID['plum'], RID['khaki'], RID['teal']])
        r = ramps[(k * 7).astype(int) % 7]
        spine = np.abs(p[:, 2] - 3.2) < 0.4
        return r, 2.3 + spine * 1.2, np.zeros(len(p))
    return M(parts, [m], (-n - 2, n + 2, -3, 3, 0, 9))


def bookshelf(seed=1):
    def parts(P):
        frame = rbox(P, (0, 0, 22), (11, 5, 22), 0.5)
        hollow = rbox(P, (0, 1.5, 23), (9.8, 5, 19.5), 0.2)
        body = np.maximum(frame, -hollow)
        shelves = np.minimum.reduce([rbox(P, (0, 0, z), (10, 4.5, 0.5), 0.2) for z in (3.5, 13.5, 23.5, 33.5)])
        books = np.full(len(P), 1e3)
        for s_, z in enumerate((4, 14, 24, 34)):
            x = -9.4
            k = 0
            while x < 9:
                h = 5 + hash3(np.array([k]), np.array([s_]), 1, seed)[0] * 3.5
                w = 1.2 + hash3(np.array([k]), np.array([s_]), 2, seed)[0] * 0.7
                lean = hash3(np.array([k]), np.array([s_]), 5, seed)[0] > 0.93
                if hash3(np.array([k]), np.array([s_]), 3, seed)[0] > 0.86:
                    x += 2.5; k += 1; continue
                books = np.minimum(books, rbox(P, (x + w / 2, 0.5, z + h / 2), (w / 2, 3.3, h / 2), 0.2))
                x += w + 0.12; k += 1
        deco = np.minimum(ell(P, (6.5, 1, 26.6), (1.4, 1.4, 2.4)), ell(P, (-6, 1, 6.4), (1.6, 1.6, 1.6)))
        return [body, shelves, books, deco]

    def bm(p, n_):
        k = hash3(np.floor((p[:, 0] + 20) / 1.4), np.floor(p[:, 2] / 10), 1, seed)
        ramps = np.array([RID['red'], RID['navy'], RID['sage'], RID['clay'], RID['plum'], RID['khaki'], RID['teal'], RID['white']])
        return ramps[(k * 8).astype(int) % 8], 2.3 + (np.abs(np.mod(p[:, 2], 10) - 6.5) < 0.5) * 1.1, np.zeros(len(p))
    return M(parts, [solid('wood', 2.0), solid('wood', 2.5), bm, solid('teal', 3.3, 0.6)], (-12, 12, -6, 6, 0, 45))


def floor_lamp():
    def parts(P):
        base = cyl_z(P, (0, 0, 0.6), 3.2, 0.6, 0.3)
        pole = capsule(P, (0, 0, 1), (0, 0, 34), 0.5)
        shade = np.maximum(cyl_z(P, (0, 0, 37), 4.2 - 0.25 * (P[:, 2] - 34) if False else 4.0, 3.6, 0.5), -cyl_z(P, (0, 0, 37), 3.2, 4.0, 0.0))
        bulb = ell(P, (0, 0, 35), (2, 2, 1.4))
        return [base, pole, shade, bulb]
    return M(parts, [solid('night', 2.2), solid('night', 2.4), solid('stone', 4.0, 0.3), solid('gold', 4.6, 0.6)], (-5, 5, -5, 5, 0, 42))


def table_lamp():
    def parts(P):
        base = smin(ell(P, (0, 0, 2.5), (2, 2, 2.5)), cyl_z(P, (0, 0, 5.5), 0.5, 1.5, 0.2), 0.6)
        shade = cyl_z(P, (0, 0, 9), 2.8, 2.2, 0.6)
        return [base, shade]
    return M(parts, [solid('clay', 3.0, 0.5), solid('stone', 4.3, 0.3)], (-4, 4, -4, 4, 0, 12))


def side_table(with_lamp=True):
    def parts(P):
        top = rbox(P, (0, 0, 11.5), (5, 5, 0.6), 0.4)
        legs = np.minimum.reduce([rbox(P, (sx, sy, 5.5), (0.5, 0.5, 5.5), 0.2) for sx in (-4, 4) for sy in (-4, 4)])
        shelf = rbox(P, (0, 0, 4), (4.4, 4.4, 0.4), 0.2)
        out = [top, legs, shelf]
        if with_lamp:
            out += [smin(ell(P, (0, 0, 14.5), (1.8, 1.8, 2.4)), cyl_z(P, (0, 0, 17), 0.4, 1.0, 0.2), 0.5), cyl_z(P, (0, 0, 20), 2.6, 2.0, 0.6)]
        return out
    mats = [solid('wood', 2.6), solid('wood', 1.8), solid('wood', 2.2)] + ([solid('clay', 3.0, 0.5), solid('stone', 4.3, 0.3)] if with_lamp else [])
    return M(parts, mats, (-6, 6, -6, 6, 0, 23))


def coffee_table():
    def parts(P):
        top = rbox(P, (0, 0, 8), (10, 6, 0.8), 0.6)
        legs = np.minimum.reduce([rbox(P, (sx, sy, 3.8), (0.7, 0.7, 3.8), 0.3) for sx in (-8.5, 8.5) for sy in (-4.5, 4.5)])
        mag = rbox(P, (-3, 1, 9.1), (3, 2.2, 0.3), 0.1)
        mug = cyl_z(P, (4, -1.5, 10.2), 1.1, 1.3, 0.3)
        remote = rbox(P, (2, 2.5, 9.1), (1.8, 0.6, 0.3), 0.2)
        return [top, legs, mag, mug, remote]

    def magm(p, n):
        stripe = np.abs(p[:, 0] + 3) < 1.4
        return np.where(stripe, RID['red'], RID['white']), np.where(stripe, 3.0, 3.8), np.zeros(len(p))
    return M(parts, [solid('wood', 2.8, 0.3), solid('wood', 1.8), magm, solid('teal', 3.2), solid('night', 1.6)], (-12, 12, -8, 8, 0, 12))


def armchair(color=('teal', 2.4)):
    def parts(P):
        seat = rbox(P, (0, 0, 6), (8, 8, 6), 2.0)
        back = rbox(P, (0, -7, 13), (8, 2.4, 8), 2.0)
        arms = np.minimum(rbox(P, (-7.5, 0, 9.5), (2.2, 8, 4.5), 1.6), rbox(P, (7.5, 0, 9.5), (2.2, 8, 4.5), 1.6))
        cush = rbox(P, (0, 1, 12.4), (5.6, 6, 1.5), 1.3)
        return [smin(smin(seat, back, 1.0), arms, 1.0), cush]
    return M(parts, [solid(color[0], color[1]), solid(color[0], color[1] + 0.5)], (-11, 11, -10, 10, 0, 22))


def sofa(color=('plum', 2.4), length=22):
    L = length

    def parts(P):
        seat = rbox(P, (0, 0, 6), (L, 9, 6), 2.0)
        back = rbox(P, (0, -7.5, 13), (L, 3, 8), 2.0)
        arms = np.minimum(rbox(P, (-L + 1, 0, 9.5), (3, 9.5, 5), 2.0), rbox(P, (L - 1, 0, 9.5), (3, 9.5, 5), 2.0))
        cush = np.minimum(rbox(P, (-L / 2 + 1.5, 1, 12.5), (L / 2 - 2.5, 7, 1.6), 1.4), rbox(P, (L / 2 - 1.5, 1, 12.5), (L / 2 - 2.5, 7, 1.6), 1.4))
        pil = np.minimum(ell(P, (-L + 6, -3.5, 16), (3, 1.6, 3)), ell(P, (L - 6, -3.5, 16), (3, 1.6, 3)))
        return [smin(smin(seat, back, 1.0), arms, 1.0), cush, pil]
    return M(parts, [solid(color[0], color[1]), solid(color[0], color[1] + 0.5), solid('khaki', 3.2)], (-L - 3, L + 3, -12, 11, 0, 22))


def tv_stand():
    """Low cabinet with a TV whose screen faces +y."""
    def parts(P):
        stand = rbox(P, (0, 0, 5), (15, 5, 5), 0.8)
        tv = rbox(P, (0, -1.5, 19), (13, 1.0, 8), 0.6)
        foot = rbox(P, (0, -1.5, 11), (3, 2, 1), 0.4)
        console = rbox(P, (-8, 1.5, 10.6), (3.5, 2.5, 0.6), 0.3)
        speaker = rbox(P, (12, 0, 14), (1.6, 1.6, 4), 0.5)
        return [stand, tv, foot, console, speaker]

    def tvm(p, n):
        scr = (n[:, 1] > 0.5) & (np.abs(p[:, 0]) < 11.8) & (np.abs(p[:, 2] - 19) < 6.8)
        refl = scr & (np.mod(p[:, 0] * 0.6 + p[:, 2], 9.0) < 1.6)
        return np.where(scr, RID['glass'], RID['night']), np.where(scr, 1.6 + (p[:, 2] - 13) * 0.1 + refl * 0.8, 1.6), np.where(scr, 1.0, 0.0)

    def standm(p, n):
        front = n[:, 1] > 0.5
        seam = front & (np.abs(p[:, 0]) < 0.4)
        return np.full(len(p), RID['wood']), 1.9 - seam * 0.8, np.zeros(len(p))
    return M(parts, [standm, tvm, solid('night', 1.6), solid('night', 2.0), solid('night', 1.8)], (-17, 17, -7, 7, 0, 28))


def office_chair():
    """Swivel chair. FRONT (+y) is the side you sit facing, so face it toward the desk."""
    def parts(P):
        seat = rbox(P, (0, 0, 10.5), (4.5, 4.5, 1.0), 0.8)
        back = rbox(P, (0, -4.5, 17), (4.2, 0.9, 5.5), 0.8)
        post = capsule(P, (0, 0, 2), (0, 0, 10), 0.6)
        base = np.minimum.reduce([capsule(P, (0, 0, 1.4), (4.5 * np.cos(a), 4.5 * np.sin(a), 1.0), 0.6) for a in np.linspace(0, 2 * np.pi, 5, endpoint=False)])
        arms = np.minimum(rbox(P, (-4.6, 0, 13.5), (0.5, 3, 0.4), 0.2), rbox(P, (4.6, 0, 13.5), (0.5, 3, 0.4), 0.2))
        return [seat, back, post, base, arms]
    return M(parts, [solid('night', 2.4), solid('night', 2.7), solid('lavlt', 2.6), solid('night', 1.8), solid('night', 2.2)], (-6, 6, -6, 6, 0, 23))


def wooden_chair():
    def parts(P):
        seat = rbox(P, (0, 0, 10), (3.6, 3.6, 0.7), 0.4)
        back = rbox(P, (0, -3.3, 16), (3.4, 0.6, 5.4), 0.3)
        legs = np.minimum.reduce([rbox(P, (sx, sy, 5), (0.5, 0.5, 5), 0.2) for sx in (-3, 3) for sy in (-3, 3)])
        return [seat, back, legs]
    return M(parts, [solid('wood', 2.6), solid('wood', 2.2), solid('wood', 1.8)], (-5, 5, -5, 5, 0, 22))


def coat_rack():
    def parts(P):
        pole = capsule(P, (0, 0, 0.5), (0, 0, 40), 0.6)
        feet = np.minimum.reduce([capsule(P, (0, 0, 1), (4 * np.cos(a), 4 * np.sin(a), 0.5), 0.5) for a in (0.3, 2.4, 4.5)])
        hooks = np.minimum.reduce([capsule(P, (0, 0, 38), (3 * np.cos(a), 3 * np.sin(a), 40), 0.4) for a in (0.5, 2.6, 4.7)])
        coat = smin(ell(P, (2.4, 1.2, 30), (3, 2.2, 7)), ell(P, (2.4, 1.2, 37), (2, 1.6, 2)), 1.0)
        hat = smin(cyl_z(P, (-2, -1.6, 41), 2.2, 1.2, 0.5), cyl_z(P, (-2, -1.6, 40), 3, 0.3, 0.2), 0.4)
        return [pole, feet, hooks, coat, hat]
    return M(parts, [solid('wood', 1.9), solid('wood', 1.7), solid('wood', 2.2), solid('khaki', 2.2), solid('night', 2.2)], (-6, 6, -6, 6, 0, 43))


def laundry_basket():
    def parts(P):
        b = np.maximum(cyl_z(P, (0, 0, 4), 4.2, 4, 0.6), -cyl_z(P, (0, 0, 5.5), 3.6, 4, 0.2))
        clothes = ell(P, (0, 0, 6.5), (3.8, 3.8, 2.2))
        return [b, clothes]

    def cm(p, n):
        k = hash3(np.floor(p[:, 0] / 2), np.floor(p[:, 1] / 2), 1, 4)
        return np.where(k > 0.5, RID['teal'], RID['white']), 3.0 + np.zeros(len(p)), np.zeros(len(p))
    return M(parts, [solid('stone', 3.2), cm], (-5, 5, -5, 5, 0, 9))


def trash_bin(col='lavlt'):
    def parts(P):
        return [np.maximum(cyl_z(P, (0, 0, 4), 3, 4, 0.5), -cyl_z(P, (0, 0, 5), 2.5, 4, 0.1)), ell(P, (0, 0, 7.5), (2.2, 2.2, 0.9))]
    return M(parts, [solid(col, 2.6), solid('white', 3.6)], (-4, 4, -4, 4, 0, 9))


def radiator():
    """Wall-mounted (back on the wall, front +y)."""
    def parts(P):
        return [rbox(P, (0, 1.6, 9), (12, 1.6, 5.5), 0.5)]

    def m(p, n):
        fin = np.mod(p[:, 0] + 20, 2.4) < 0.7
        return np.full(len(p), RID['white']), 3.2 - fin * 0.9, np.zeros(len(p))
    return M(parts, [m], (-13, 13, -1, 4, 2, 16))


def wall_shelf(items=('books', 'vase', 'plant')):
    """Floating shelf with knick-knacks (wall-mounted)."""
    def parts(P):
        shelf = rbox(P, (0, 2.5, 30), (11, 2.5, 0.5), 0.2)
        d = [shelf]
        bk = np.minimum.reduce([rbox(P, (-9 + k * 1.5, 2.3, 30.5 + 2.6 + (k % 2) * 0.5), (0.65, 1.8, 2.6 + (k % 2) * 0.5), 0.15) for k in range(5)])
        vase = smin(ell(P, (1.5, 2.5, 32.2), (1.4, 1.4, 1.8)), cyl_z(P, (1.5, 2.5, 34.2), 0.6, 0.8, 0.2), 0.5)
        pot = cyl_z(P, (7, 2.5, 31.4), 1.3, 0.9, 0.3)
        lf = ell(P, (7, 2.5, 33.2), (2, 1.8, 1.4))
        frame = rbox(P, (-3.5, 1.4, 32.3), (1.6, 0.4, 1.8), 0.2)
        return d + [bk, vase, pot, lf, frame]

    def bkm(p, n):
        k = hash3(np.floor((p[:, 0] + 20) / 1.5), 1, 1, 6)
        ramps = np.array([RID['red'], RID['navy'], RID['sage'], RID['clay'], RID['plum']])
        return ramps[(k * 5).astype(int) % 5], np.full(len(p), 2.6), np.zeros(len(p))
    return M(parts, [solid('wood', 2.6), bkm, solid('gold', 3.4, 0.9), solid('clay', 2.8), leafm(2, 2.4), solid('night', 2.0)], (-12, 12, -1, 6, 28, 37))


def kitchen_items():
    """Kettle + chopping board + utensil pot (placed on a counter)."""
    def parts(P):
        kettle = smin(ell(P, (-6, 0, 2.6), (2.2, 2.2, 2.6)), capsule(P, (-4, 0, 3), (-2.6, 0, 4.4), 0.4), 0.4)
        board = rbox(P, (1, 0.5, 0.3), (3, 2.2, 0.3), 0.2)
        veg = ell(P, (1.5, 0.5, 1.2), (1, 1, 0.8))
        pot = cyl_z(P, (6, 0, 2.2), 1.3, 2.2, 0.3)
        utens = np.minimum.reduce([capsule(P, (6 + dx, dy, 3), (6 + dx * 2, dy * 2, 6), 0.3) for dx, dy in ((-0.4, 0.2), (0.4, -0.2), (0, 0.5))])
        return [kettle, board, veg, pot, utens]
    return M(parts, [solid('red', 3.0, 0.8), solid('wood', 3.2), solid('sage', 3.2), solid('white', 3.4), solid('lavlt', 2.6)], (-9, 9, -4, 4, 0, 8))


def dish_rack():
    def parts(P):
        rack = rbox(P, (0, 0, 1.2), (3.5, 2.4, 1.2), 0.3)
        plates = np.minimum.reduce([cyl_y(P, (-2 + k * 1.2, 0, 3.4), 2.2, 0.25, 0.1) for k in range(4)])
        return [rack, plates]
    return M(parts, [solid('lavlt', 2.6), solid('white', 3.8)], (-5, 5, -4, 4, 0, 7))


def place_setting():
    def parts(P):
        plates = np.minimum(cyl_z(P, (-5, 0, 0.3), 2.2, 0.3, 0.1), cyl_z(P, (5, 0, 0.3), 2.2, 0.3, 0.1))
        glass_ = cyl_z(P, (0, 2, 1.5), 0.8, 1.5, 0.2)
        candle = cyl_z(P, (0, -1, 2), 0.6, 2, 0.2)
        return [plates, glass_, candle]
    return M(parts, [solid('white', 3.8), glassm(3.8), solid('gold', 4.4, 0.6)], (-8, 8, -4, 4, 0, 5))


def desk_clutter(seed=1):
    """Papers, mug, photo frame and pen cup for desks."""
    def parts(P):
        papers = rbox(P, (-3, 0.5, 0.4), (2.6, 3.2, 0.4), 0.1)
        mug = cyl_z(P, (3.5, 1.5, 1.4), 1.0, 1.4, 0.3)
        frame = rbox(P, (5, -1.5, 2.0), (1.4, 0.3, 1.8), 0.2)
        pens = cyl_z(P, (-6, -1.5, 1.4), 0.9, 1.4, 0.2)
        return [papers, mug, frame, pens]

    def fm(p, n):
        pic = (n[:, 1] > 0.5) & (np.abs(p[:, 0] - 5) < 1.0) & (np.abs(p[:, 2] - 2.0) < 1.3)
        return np.where(pic, RID['sage'], RID['night']), np.where(pic, 3.2, 2.0), np.zeros(len(p))
    return M(parts, [solid('white', 4.0), solid(['red', 'teal', 'gold'][seed % 3], 3.0), fm, solid('navy', 2.6)], (-8, 8, -4, 4, 0, 5))


def cardboard_boxes(n=3, seed=1):
    def parts(P):
        d = np.full(len(P), 1e3)
        z = 0
        for k in range(n):
            w = 5 + hash3(np.array([k]), 1, 1, seed)[0] * 2
            h = 4 + hash3(np.array([k]), 2, 1, seed)[0] * 2
            dx = (hash3(np.array([k]), 3, 1, seed)[0] - 0.5) * 2
            d = np.minimum(d, rbox(P, (dx, dx * 0.5, z + h / 2), (w, w * 0.8, h / 2), 0.4))
            z += h
        return [d]

    def m(p, n_):
        tape = (np.abs(p[:, 0]) < 0.8) & (n_[:, 2] > 0.5)
        return np.full(len(p), RID['khaki']), 2.6 + tape * 0.9 + (n_[:, 2] > 0.5) * 0.2, np.zeros(len(p))
    return M(parts, [m], (-9, 9, -8, 8, 0, 22))


def mop_bucket():
    def parts(P):
        bucket = np.maximum(rbox(P, (0, 0, 3.5), (4, 3, 3.5), 0.8), -rbox(P, (0, 0, 6), (3.2, 2.2, 2), 0.5))
        wheels = np.minimum.reduce([cyl_z(P, (sx, sy, 0.6), 0.7, 0.6, 0.2) for sx in (-3, 3) for sy in (-2.2, 2.2)])
        mop = capsule(P, (1, 0, 3), (-1, -2, 28), 0.45)
        water = rbox(P, (0, 0, 5.6), (3.2, 2.2, 0.2), 0.1)
        return [bucket, wheels, mop, water]
    return M(parts, [solid('gold', 3.0, 0.3), solid('night', 1.4), solid('wood', 2.4), solid('teal', 2.4)], (-6, 6, -6, 6, 0, 30))


def fire_extinguisher():
    def parts(P):
        body = capsule(P, (0, 2, 2), (0, 2, 9), 1.5)
        head = rbox(P, (0, 2, 10.5), (0.8, 0.8, 1.0), 0.3)
        hose = capsule(P, (0.6, 2.8, 10), (1.6, 3.6, 6), 0.3)
        bracket = rbox(P, (0, 0.3, 7), (1.6, 0.3, 2.2), 0.2)
        return [body, head, hose, bracket]
    return M(parts, [solid('red', 3.0, 0.7), solid('night', 2.0), solid('night', 1.6), solid('night', 2.0)], (-3, 3, -1, 5, 0, 12))


def server_rack():
    def parts(P):
        return [rbox(P, (0, 0, 22), (6.5, 7, 22), 0.6)]

    def m(p, n):
        x, z = p[:, 0], p[:, 2]
        front = n[:, 1] > 0.5
        unit = front & (np.mod(z, 3.0) < 2.4) & (z > 3) & (z < 41)
        led = unit & (np.abs(np.mod(x + 6, 2.2) - 1.1) < 0.35) & (np.abs(np.mod(z, 3.0) - 1.2) < 0.35) & (x > 2)
        k = hash3(np.floor(x), np.floor(z / 3), 1, 7)
        lc = np.where(k > 0.6, RID['sage'], np.where(k > 0.3, RID['gold'], RID['red']))
        r = np.where(led, lc, np.where(unit, RID['asph'], RID['night']))
        b = np.where(led, 4.6, np.where(unit, 2.2 + (np.mod(z, 3.0) < 0.5) * 0.6, 1.8))
        return r, b, np.where(led, 1.0, 0.0)
    return M(parts, [m], (-8, 8, -8, 8, 0, 45))


def cctv_desk():
    """Security desk with a bank of monitors (screens face +y) - interactable."""
    def parts(P):
        top = rbox(P, (0, 0, 16.5), (18, 7, 0.8), 0.4)
        sides = np.minimum(rbox(P, (-17, 0, 8), (0.8, 6.5, 8), 0.3), rbox(P, (17, 0, 8), (0.8, 6.5, 8), 0.3))
        mons = np.minimum.reduce([rbox(P, (cx, -4.5, cz), (5.2, 0.8, 3.4), 0.3) for cx in (-11, 0, 11) for cz in (21.5, 29)])
        stands = np.minimum.reduce([rbox(P, (cx, -5.5, 19.5), (0.6, 0.6, 3), 0.2) for cx in (-11, 0, 11)])
        kb = rbox(P, (0, 2, 17.6), (4, 1.6, 0.3), 0.2)
        mug = cyl_z(P, (10, 3, 18.6), 1.0, 1.3, 0.3)
        return [top, sides, mons, stands, kb, mug]

    def mm(p, n):
        x, z = p[:, 0], p[:, 2]
        scr = (n[:, 1] > 0.5) & (np.abs(np.mod(x + 16.5, 11.0) - 5.5) < 4.4) & (np.abs(np.mod(z - 18.1, 7.5) - 3.4) < 2.6)
        # little camera-feed pictures: floor + a figure
        fl = scr & (np.mod(z - 18.1, 7.5) < 2.2)
        fig = scr & (np.abs(np.mod(x + 16.5, 11.0) - (3 + hash3(np.floor((x + 16.5) / 11), np.floor((z - 18.1) / 7.5), 1, 3) * 5)) < 0.6) & (np.mod(z - 18.1, 7.5) < 4.2)
        r = np.where(scr, RID['sage'], RID['night'])
        b = np.where(fig, 4.8, np.where(fl, 2.6, np.where(scr, 3.4, 1.7)))
        return r, b, np.where(scr, 1.0, 0.0)
    return M(parts, [solid('lavlt', 2.6), solid('lavlt', 2.0), mm, solid('night', 2.0), solid('night', 2.4), solid('teal', 3.0)], (-19, 19, -8, 8, 0, 34))


def alarm_panel():
    """Wall-mounted security / alarm panel (interactable)."""
    def parts(P):
        box = rbox(P, (0, 1.2, 30), (5, 1.2, 7), 0.4)
        conduit = capsule(P, (0, 0.6, 37), (0, 0.6, 60), 0.6)
        return [box, conduit]

    def m(p, n):
        x, z = p[:, 0], p[:, 2]
        front = n[:, 1] > 0.5
        scr = front & (np.abs(x) < 3.4) & (np.abs(z - 33.5) < 1.6)
        keys = front & (np.abs(x + 0.8) < 2.6) & (z > 24.5) & (z < 30.5) & (np.mod(x + 10, 1.8) < 1.1) & (np.mod(z, 1.8) < 1.1)
        led = front & (np.abs(x - 3.6) < 0.6) & (np.abs(z - 28) < 0.6)
        r = np.where(scr, RID['sage'], np.where(keys, RID['lavlt'], np.where(led, RID['red'], RID['stone'])))
        b = np.where(scr, 4.2, np.where(keys, 3.8, np.where(led, 4.6, 2.8)))
        return r, b, np.where(scr | led, 1.0, 0.0)
    return M(parts, [m, solid('lavlt', 2.4)], (-6, 6, -1, 4, 22, 61))


def keycard_reader():
    def parts(P):
        return [rbox(P, (0, 0.6, 22), (1.6, 0.6, 2.4), 0.3)]

    def m(p, n):
        led = (n[:, 1] > 0.5) & (p[:, 2] > 23.4)
        return np.where(led, RID['red'], RID['night']), np.where(led, 4.5, 2.0), np.where(led, 1.0, 0.0)
    return M(parts, [m], (-3, 3, -1, 3, 18, 26))


def door_leaf(locked=True, color=('wood', 2.0), width=22):
    """Closed door standing in a doorway. FRONT (+y) faces the room you open it from."""
    W = width

    def parts(P):
        leaf = rbox(P, (0, 0, 23), (W / 2, 1.0, 23), 0.3)
        knob = ell(P, (W / 2 - 3, 1.4, 21), (0.9, 0.7, 0.9))
        plate = rbox(P, (0, 1.1, 36), (3, 0.2, 1.2), 0.1)
        return [leaf, knob, plate]

    def lm(p, n):
        z = p[:, 2]
        front = n[:, 1] > 0.5
        panel = front & ((np.abs(np.abs(p[:, 0]) - W / 4) < W / 4 - 1.6) & ((np.abs(z - 12) < 8.5) | (np.abs(z - 33) < 9)))
        return np.full(len(p), RID[color[0]]), color[1] + panel * 0.45, np.zeros(len(p))
    return M(parts, [lm, solid('gold', 4.0, 0.9), solid('white', 3.6)], (-W / 2 - 1, W / 2 + 1, -2, 3, 0, 47))


def security_gate(width=32):
    W = width

    def parts(P):
        bars = np.minimum.reduce([capsule(P, (x, 0, 1), (x, 0, 44), 0.55) for x in np.arange(-W / 2 + 2, W / 2 - 1, 3.0)])
        rails = np.minimum.reduce([rbox(P, (0, 0, z), (W / 2, 0.7, 0.8), 0.3) for z in (2, 22, 44)])
        lock = rbox(P, (W / 2 - 4, 1.4, 22), (2, 1, 2.6), 0.4)
        return [bars, rails, lock]
    return M(parts, [solid('lavlt', 2.6, 0.5), solid('lavlt', 2.2, 0.5), solid('gold', 3.4, 0.9)], (-W / 2 - 1, W / 2 + 1, -2, 3, 0, 46))


def waiting_chairs(n=3):
    def parts(P):
        d = np.full(len(P), 1e3); b = np.full(len(P), 1e3)
        for k in range(n):
            x = (k - (n - 1) / 2) * 9
            d = np.minimum(d, rbox(P, (x, 0, 10), (4, 4, 1), 0.8))
            b = np.minimum(b, rbox(P, (x, -4, 16), (4, 0.8, 5), 0.8))
        beam = rbox(P, (0, -1, 7.5), ((n - 1) / 2 * 9 + 3, 1, 0.6), 0.3)
        legs = np.minimum.reduce([capsule(P, (sx, -1, 7), (sx, -1, 0.5), 0.6) for sx in ((n - 1) / 2 * -9, (n - 1) / 2 * 9)])
        return [d, b, beam, legs]
    return M(parts, [solid('teal', 2.4), solid('teal', 2.7), solid('lavlt', 2.4), solid('lavlt', 2.0)], (-n * 5 - 2, n * 5 + 2, -6, 6, 0, 22))


def stanchions(n=3, span=14):
    def parts(P):
        posts = np.minimum.reduce([smin(capsule(P, (k * span, 0, 1), (k * span, 0, 14), 0.6), cyl_z(P, (k * span, 0, 0.5), 2, 0.5, 0.2), 0.5) for k in range(n)])
        ropes = np.full(len(P), 1e3)
        for k in range(n - 1):
            x0, x1 = k * span, (k + 1) * span
            mid = (x0 + x1) / 2
            ropes = np.minimum(ropes, smin(capsule(P, (x0, 0, 13.5), (mid, 0, 10.5), 0.5), capsule(P, (mid, 0, 10.5), (x1, 0, 13.5), 0.5), 0.6))
        return [posts, ropes]
    return M(parts, [solid('gold', 3.2, 1.0), solid('red', 2.6)], (-3, (n - 1) * span + 3, -3, 3, 0, 16))


def teller_counter(length=96, windows=3):
    L = length

    def parts(P):
        base = rbox(P, (0, 0, 10), (L / 2, 6, 10), 0.6)
        top = rbox(P, (0, 0, 20.6), (L / 2 + 0.5, 6.6, 0.8), 0.4)
        glass_ = rbox(P, (0, -1.5, 31), (L / 2, 0.5, 10), 0.2)
        posts = np.minimum.reduce([rbox(P, (x, -1.5, 31), (0.8, 0.9, 10.5), 0.3) for x in np.linspace(-L / 2, L / 2, windows + 1)])
        slots = np.minimum.reduce([rbox(P, (x, 1.5, 21.6), (3, 2, 0.4), 0.2) for x in (np.linspace(-L / 2, L / 2, windows + 1)[:-1] + L / windows / 2)])
        return [base, top, glass_, posts, slots]

    def bm(p, n):
        front = n[:, 1] > 0.5
        panel = front & (np.mod(p[:, 0] + L, L / windows) < 1.0)
        return np.full(len(p), RID['wood']), 2.2 - panel * 0.9, np.zeros(len(p))
    return M(parts, [bm, solid('stone', 3.6), lambda p, n: (np.full(len(p), RID['glass']), np.full(len(p), 3.9), np.full(len(p), 1.0)), solid('gold', 3.0, 0.8), solid('lavlt', 3.0)],
             (-L / 2 - 1, L / 2 + 1, -8, 8, 0, 42))


def exec_desk():
    """Manager's desk: big wood desk with leather top, lamp, papers; front (+y) is the visitor side."""
    def parts(P):
        top = rbox(P, (0, 0, 17), (16, 8, 1), 0.6)
        body = rbox(P, (0, -2, 8.5), (15.5, 6, 8.5), 0.8)
        lamp = smin(cyl_z(P, (-11, -4, 18.6), 1.4, 0.6, 0.2), capsule(P, (-11, -4, 19), (-9, -4, 25), 0.35), 0.3)
        shade = np.maximum(ell(P, (-8, -4, 25), (3, 1.6, 1.4)), -(P[:, 2] - 24.6))
        laptop = np.minimum(rbox(P, (3, -2, 18.3), (3.6, 2.6, 0.3), 0.2), rbox(P, (3, -4.7, 21), (3.6, 0.3, 2.6), 0.2))
        papers = rbox(P, (10, 1, 18.4), (2.6, 3, 0.4), 0.1)
        keycard = rbox(P, (-4, 3, 18.25), (1.2, 0.8, 0.15), 0.05)
        return [top, body, lamp, shade, laptop, papers, keycard]

    def bodym(p, n):
        front = n[:, 1] > 0.5
        panel = front & (np.abs(p[:, 0]) < 13) & (np.abs(p[:, 2] - 8.5) < 6)
        return np.full(len(p), RID['wood']), 1.8 + panel * 0.4, np.full(len(p), 0.2)

    def lap(p, n):
        scr = n[:, 1] > 0.5
        return np.where(scr, RID['glass'], RID['lavlt']), np.where(scr, 3.6, 2.6), np.where(scr, 1.0, 0.3)
    return M(parts, [solid('wood', 2.6, 0.4), bodym, solid('gold', 3.4, 0.9), solid('sage', 2.6), lap, solid('white', 4.0), solid('gold', 4.4, 1.0)],
             (-18, 18, -10, 10, 0, 28))


def whiteboard():
    """Wall-mounted whiteboard with scribbles."""
    def parts(P):
        return [rbox(P, (0, 0.6, 34), (14, 0.6, 9), 0.3), rbox(P, (0, 1.6, 25), (12, 1.0, 0.4), 0.2)]

    def m(p, n):
        x, z = p[:, 0], p[:, 2]
        front = n[:, 1] > 0.5
        rim = front & ((np.abs(x) > 13.2) | (np.abs(z - 34) > 8.2))
        line = front & ~rim & (np.abs(np.mod(z, 2.6) - 1.3) < 0.35) & (np.abs(x + 2 - np.mod(z * 3.1, 9)) < 6) & (z > 28)
        chart = front & ~rim & (x > 3) & (x < 12) & (z > 27) & (z < 27 + np.mod(np.floor(x), 4) * 1.6 + 1)
        r = np.where(rim, RID['lavlt'], np.where(line, RID['navy'], np.where(chart, RID['red'], RID['white'])))
        b = np.where(rim, 2.6, np.where(line, 2.6, np.where(chart, 3.0, 4.6)))
        return r, b, np.zeros(len(p))
    return M(parts, [m, solid('lavlt', 2.6)], (-15, 15, -1, 4, 23, 44))


def corkboard():
    def parts(P):
        return [rbox(P, (0, 0.5, 34), (10, 0.5, 7), 0.3)]

    def m(p, n):
        x, z = p[:, 0], p[:, 2]
        front = n[:, 1] > 0.5
        rim = front & ((np.abs(x) > 9.2) | (np.abs(z - 34) > 6.2))
        k = hash3(np.floor((x + 10) / 4.2), np.floor((z - 27) / 4.2), 1, 5)
        note = front & ~rim & (np.mod(x + 10, 4.2) > 0.6) & (np.mod(z - 27, 4.2) > 0.6) & (k > 0.35)
        nc = np.where(k > 0.8, RID['gold'], np.where(k > 0.6, RID['white'], np.where(k > 0.45, RID['clay'], RID['teal'])))
        r = np.where(rim, RID['wood'], np.where(note, nc, RID['clay']))
        b = np.where(rim, 1.8, np.where(note, 3.8, 2.0))
        return r, b, np.zeros(len(p))
    return M(parts, [m], (-11, 11, -1, 2, 26, 42))


def vending_machine(kind='snacks'):
    def parts(P):
        return [rbox(P, (0, 0, 22), (8, 7, 22), 0.8)]

    def m(p, n):
        x, z = p[:, 0], p[:, 2]
        front = n[:, 1] > 0.5
        glass_ = front & (x < 3.5) & (x > -7) & (z > 10) & (z < 40)
        item = glass_ & (np.mod(x + 7, 2.6) < 1.8) & (np.mod(z - 10, 5.0) < 3.2)
        k = hash3(np.floor((x + 7) / 2.6), np.floor((z - 10) / 5.0), 1, 2)
        ic = np.array([RID['red'], RID['gold'], RID['sage'], RID['navy'], RID['clay']])[(k * 5).astype(int) % 5]
        pad = front & (x > 4.4) & (x < 7) & (z > 24) & (z < 32)
        slot = front & (z > 4) & (z < 8) & (np.abs(x + 1.5) < 5)
        body = RID['red'] if kind == 'soda' else RID['navy']
        r = np.where(item, ic, np.where(glass_, RID['glass'], np.where(pad, RID['night'], np.where(slot, RID['night'], body))))
        b = np.where(item, 3.4, np.where(glass_, 3.4, np.where(pad | slot, 1.2, 2.4)))
        return r, b, np.where(glass_, 0.9, 0.0)
    return M(parts, [m], (-10, 10, -9, 9, 0, 45))


def coffee_machine():
    def parts(P):
        body = rbox(P, (0, 0, 4.5), (2.6, 2.4, 4.5), 0.6)
        pot = smin(cyl_z(P, (0, 2.6, 2.0), 1.6, 2.0, 0.5), cyl_z(P, (0, 2.6, 4.3), 1.0, 0.4, 0.2), 0.4)
        return [body, pot]
    return M(parts, [solid('night', 2.4, 0.4), glassm(3.0)], (-4, 4, -4, 6, 0, 10))


def chest_freezer():
    def parts(P):
        return [rbox(P, (0, 0, 7), (14, 6.5, 7), 0.8), rbox(P, (0, 0, 14.2), (13.4, 6, 0.4), 0.3)]

    def lid(p, n):
        x, y = p[:, 0], p[:, 1]
        inner = (np.abs(x) < 12.6) & (np.abs(y) < 5.2)
        tub = inner & (np.mod(x + 14, 3.4) < 2.6) & (np.mod(y + 6, 3.2) < 2.4)
        k = hash3(np.floor((x + 14) / 3.4), np.floor((y + 6) / 3.2), 1, 9)
        c = np.where(k > 0.66, RID['red'], np.where(k > 0.33, RID['white'], RID['gold']))
        return np.where(tub, c, RID['glass']), np.where(tub, 3.4, 3.8), np.full(len(p), 1.0)
    return M(parts, [solid('white', 3.3), lid], (-15, 15, -8, 8, 0, 15))


def news_rack():
    def parts(P):
        frame = rbox(P, (0, 0, 12), (7, 4, 12), 0.4)
        hollow = rbox(P, (0, 2, 13), (6.2, 4, 10.5), 0.2)
        mags = np.minimum.reduce([rbox(P, (x, 0.5 + t * 0.9, 4 + t * 7), (1.5, 0.4, 3), 0.1) for t in range(3) for x in (-4, 0, 4)])
        return [np.maximum(frame, -hollow), mags]

    def mm(p, n):
        k = hash3(np.floor((p[:, 0] + 8) / 4), np.floor(p[:, 2] / 7), 1, 4)
        return np.array([RID['red'], RID['navy'], RID['gold'], RID['sage'], RID['plum']])[(k * 5).astype(int) % 5], 3.2 + (np.mod(p[:, 2], 7) > 5.6) * 0.8, np.zeros(len(p))
    return M(parts, [solid('lavlt', 2.4), mm], (-8, 8, -5, 5, 0, 25))


def entrance_mat():
    def parts(P):
        return [rbox(P, (0, 0, 0.3), (10, 6, 0.3), 0.2)]

    def m(p, n):
        rib = np.mod(p[:, 0] + 20, 1.6) < 0.6
        return np.full(len(p), RID['asph']), 2.4 + rib * 0.6, np.zeros(len(p))
    return M(parts, [m], (-11, 11, -7, 7, 0, 1))


def rug(w=34, d=24, ramp=('brick', 2.3), border='khaki'):
    def parts(P):
        return [rbox(P, (0, 0, 0.4), (w / 2, d / 2, 0.4), 0.3)]

    def m(p, n):
        x, y = p[:, 0], p[:, 1]
        bd = (np.abs(x) > w / 2 - 2.5) | (np.abs(y) > d / 2 - 2.5)
        diamond = (np.abs(x) / (w / 2) + np.abs(y) / (d / 2)) < 0.45
        fringe = np.abs(x) > w / 2 - 0.8
        return np.where(bd, RID[border], RID[ramp[0]]), np.where(fringe, 3.6, np.where(bd, 2.4, ramp[1] + diamond * 0.6)), np.zeros(len(p))
    return M(parts, [m], (-w / 2 - 1, w / 2 + 1, -d / 2 - 1, d / 2 + 1, 0, 1.5))


def ledger_desk():
    """Small back-office desk with ledger, adding machine and lamp (store back room)."""
    def parts(P):
        top = rbox(P, (0, 0, 15), (10, 6, 0.8), 0.4)
        legs = np.minimum.reduce([rbox(P, (sx, sy, 7), (0.7, 0.7, 7), 0.2) for sx in (-8.5, 8.5) for sy in (-4.5, 4.5)])
        ledger = rbox(P, (-3, 1, 16.2), (3, 2.2, 0.4), 0.1)
        adder = rbox(P, (4, 0, 16.8), (2.4, 2.2, 1.0), 0.4)
        lamp = smin(cyl_z(P, (7, -3.5, 16), 1, 0.4, 0.2), capsule(P, (7, -3.5, 16), (6, -3, 21), 0.3), 0.3)
        shade = ell(P, (5, -2.6, 21), (2, 1.4, 1.1))
        money = rbox(P, (-3, 4, 16.2), (2, 1, 0.4), 0.1)
        return [top, legs, ledger, adder, lamp, shade, money]
    return M(parts, [solid('wood', 2.4), solid('wood', 1.8), solid('red', 2.4), solid('lavlt', 2.8), solid('night', 2.0), solid('sage', 2.8), solid('khaki', 3.0)],
             (-11, 11, -7, 7, 0, 23))


def storage_shelf(seed=2):
    """Metal stock shelving with boxes and cans."""
    def parts(P):
        posts = np.minimum.reduce([rbox(P, (sx, sy, 21), (0.6, 0.6, 21), 0.2) for sx in (-14, 14) for sy in (-5, 5)])
        shelves = np.minimum.reduce([rbox(P, (0, 0, z), (14.5, 5.5, 0.5), 0.2) for z in (2, 15, 28, 41)])
        boxes = np.full(len(P), 1e3)
        for s_, z in enumerate((2.5, 15.5, 28.5)):
            x = -13
            k = 0
            while x < 12:
                w = 3 + hash3(np.array([k]), np.array([s_]), 1, seed)[0] * 4
                h = 4 + hash3(np.array([k]), np.array([s_]), 2, seed)[0] * 6
                if hash3(np.array([k]), np.array([s_]), 3, seed)[0] > 0.2:
                    boxes = np.minimum(boxes, rbox(P, (x + w / 2, 0, z + h / 2), (w / 2 - 0.3, 4.2, h / 2), 0.4))
                x += w + 0.4; k += 1
        return [posts, shelves, boxes]

    def bm(p, n):
        k = hash3(np.floor((p[:, 0] + 20) / 3.5), np.floor(p[:, 2] / 13), 1, seed)
        r = np.where(k > 0.75, RID['red'], np.where(k > 0.5, RID['white'], RID['khaki']))
        return r, 2.6 + (n[:, 2] > 0.5) * 0.3, np.zeros(len(p))
    return M(parts, [solid('lavlt', 2.2), solid('lavlt', 2.6), bm], (-16, 16, -7, 7, 0, 43))


def broom():
    def parts(P):
        return [capsule(P, (0, 2, 2), (0, 0.5, 30), 0.45), rbox(P, (0, 2.4, 1.8), (3, 0.9, 1.8), 0.4)]
    return M(parts, [solid('wood', 2.4), solid('khaki', 2.4)], (-4, 4, -1, 4, 0, 31))


def dvr_rack():
    """Small shelf with the camera recorder (DVR) - 'wipe footage' interactable."""
    def parts(P):
        frame = rbox(P, (0, 0, 10), (7, 5, 10), 0.5)
        hollow = rbox(P, (0, 2, 11), (6.2, 5, 8.5), 0.2)
        dvr = rbox(P, (0, 0.5, 4.2), (5.6, 3.6, 1.6), 0.3)
        tapes = np.minimum.reduce([rbox(P, (-4 + k * 1.6, 0.5, 11 + 2.2), (0.6, 3, 2.2), 0.1) for k in range(6)])
        return [np.maximum(frame, -hollow), dvr, tapes]

    def dm(p, n):
        led = (n[:, 1] > 0.5) & (np.abs(p[:, 2] - 4.5) < 0.6) & (p[:, 0] > 3)
        disp = (n[:, 1] > 0.5) & (np.abs(p[:, 2] - 4.4) < 0.7) & (np.abs(p[:, 0] + 1) < 2.4)
        return np.where(led, RID['red'], np.where(disp, RID['sage'], RID['night'])), np.where(led | disp, 4.6, 1.8), np.where(led | disp, 1.0, 0.2)
    return M(parts, [solid('lavlt', 2.4), dm, solid('night', 2.2)], (-8, 8, -6, 6, 0, 21))


# ------------------------------------------------------------------ street decor (exteriors)
def news_box(col='red'):
    def parts(P):
        return [rbox(P, (0, 0, 9), (3.5, 3, 9), 0.6), rbox(P, (0, 0, 18.6), (3.8, 3.4, 0.6), 0.3)]

    def m(p, n):
        win = (n[:, 1] > 0.5) & (np.abs(p[:, 0]) < 2.6) & (np.abs(p[:, 2] - 12) < 3)
        return np.where(win, RID['white'], RID[col]), np.where(win, 3.8, 2.6), np.zeros(len(p))
    return M(parts, [m, solid(col, 3.0)], (-5, 5, -5, 5, 0, 20))


def bike_rack():
    def parts(P):
        loops = np.minimum.reduce([smin(capsule(P, (x, -3, 0), (x, -3, 7), 0.5), smin(capsule(P, (x, 3, 0), (x, 3, 7), 0.5), capsule(P, (x, -3, 7), (x, 3, 7), 0.5), 0.8), 0.8) for x in (-8, 0, 8)])
        return [loops]
    return M(parts, [solid('lavlt', 2.8, 0.6)], (-10, 10, -5, 5, 0, 9))


def bollard():
    def parts(P):
        return [smin(cyl_z(P, (0, 0, 5), 1.8, 5, 0.6), ell(P, (0, 0, 10), (1.8, 1.8, 1.2)), 0.6)]

    def m(p, n):
        band = np.abs(p[:, 2] - 8) < 0.8   # white, not gold: gold is reserved for valuables and interactables
        return np.where(band, RID['white'], RID['night']), np.where(band, 3.8, 2.2), np.full(len(p), 0.3)
    return M(parts, [m], (-3, 3, -3, 3, 0, 12))


def street_planter():
    def parts(P):
        box = rbox(P, (0, 0, 5), (10, 5, 5), 1.0)
        shrubs = smin(ell(P, (-4, 0, 12), (5, 4, 4)), ell(P, (4, 0, 12.5), (5, 4, 4.5)), 2) + 0.4 * np.sin(P[:, 0] * 1.9) * np.sin(P[:, 1] * 2.1) * np.sin(P[:, 2] * 1.7)
        flowers = np.minimum.reduce([ell(P, (x, y, 15.5), (0.9, 0.9, 0.9)) for x, y in ((-6, 1), (-2, -2), (3, 2), (6, -1))])
        return [box, shrubs, flowers]
    return M(parts, [solid('stone', 2.6), leafm(4, 2.2), solid('gold', 3.8)], (-12, 12, -7, 7, 0, 18))


def bus_stop_sign():
    def parts(P):
        return [capsule(P, (0, 0, 0), (0, 0, 34), 0.7), rbox(P, (0, 0, 36), (4, 0.5, 4), 0.4)]

    def m(p, n):
        bus = (np.abs(p[:, 0]) < 2.4) & (np.abs(p[:, 2] - 36) < 1.6) & (np.abs(n[:, 1]) > 0.5)
        return np.where(bus, RID['white'], RID['navy']), np.where(bus, 4.0, 2.4), np.zeros(len(p))
    return M(parts, [solid('lavlt', 2.4), m], (-5, 5, -2, 2, 0, 41))



# ======================================================================= bar + office lobby (added in Phase 1)
def bar_stool():
    """Round-seat bar stool. FRONT (+y) is the side you sit facing (face it toward the counter)."""
    def parts(P):
        seat = cyl_z(P, (0, 0, 15.5), 3.4, 1.1, 0.8)
        post = capsule(P, (0, 0, 1), (0, 0, 15), 0.6)
        ring = np.maximum(np.abs(np.hypot(P[:, 0], P[:, 1]) - 2.6) - 0.35, np.abs(P[:, 2] - 6.5) - 0.35)
        base = cyl_z(P, (0, 0, 0.6), 3.0, 0.6, 0.3)
        return [seat, post, ring, base]
    return M(parts, [solid('brick', 2.6, 0.3), solid('lavlt', 2.4, 0.6), solid('lavlt', 2.6, 0.6), solid('night', 2.2)], (-5, 5, -5, 5, 0, 17))


def bar_counter(length=96):
    """Bar counter with a dark wood front panel, brass-free foot rail and a dark top. FRONT (+y) is the customer side."""
    L = length

    def parts(P):
        base = rbox(P, (0, 0, 10), (L / 2, 6.5, 10), 0.6)
        top = rbox(P, (0, 0.5, 20.6), (L / 2 + 1, 7.6, 0.9), 0.5)
        rail = capsule(P, (-L / 2 + 2, 8.6, 3.2), (L / 2 - 2, 8.6, 3.2), 0.6)
        return [base, top, rail]

    def bm(p, n):
        front = n[:, 1] > 0.5
        panel = front & (np.mod(p[:, 0] + 200, 12.0) < 0.7)
        trim = front & (np.abs(p[:, 2] - 17.5) < 0.8)
        return np.full(len(p), RID['wood']), 1.7 - panel * 0.7 + trim * 0.6, np.zeros(len(p))
    return M(parts, [bm, solid('wood', 2.9, 0.5), solid('lavlt', 2.8, 0.7)], (-L / 2 - 2, L / 2 + 2, -8, 10, 0, 22))


def beer_taps(n=3):
    """A row of beer taps on a drip tray; stands on the counter (use wz = counter height)."""
    def parts(P):
        tray = rbox(P, (0, 0, 0.4), (n * 2.4, 2.2, 0.4), 0.2)
        column = rbox(P, (0, -0.8, 4.0), (n * 2.2, 0.9, 3.4), 0.4)
        handles = np.minimum.reduce([capsule(P, (x, 0.2, 7.5), (x, 0.4, 10.5), 0.55) for x in np.linspace(-(n - 1) * 2.2, (n - 1) * 2.2, n)])
        spouts = np.minimum.reduce([capsule(P, (x, 0.0, 5.2), (x, 1.3, 4.4), 0.35) for x in np.linspace(-(n - 1) * 2.2, (n - 1) * 2.2, n)])
        return [tray, column, handles, spouts]

    def hm(p, n_):
        k = np.floor((p[:, 0] + 10) / 4.4)
        return np.where(np.mod(k, 2) == 0, RID['red'], RID['white']), np.full(len(p), 3.2), np.full(len(p), 0.3)
    return M(parts, [solid('night', 2.2, 0.4), solid('lavlt', 3.2, 0.8), hm, solid('lavlt', 3.0, 0.8)], (-n * 2.6, n * 2.6, -3, 3, 0, 12))


def back_bar(length=64, seed=3):
    """Wall-mounted back bar: low cabinet, a mirror and two shelves of bottles. Back on the wall, sticks out toward +y."""
    L = length

    def parts(P):
        cab = rbox(P, (0, 5, 9), (L / 2, 5, 9), 0.6)
        mirror = rbox(P, (0, 0.6, 33), (L / 2 - 2, 0.6, 11), 0.2)
        shelves = np.minimum(rbox(P, (0, 2.6, 26), (L / 2, 2.6, 0.5), 0.2), rbox(P, (0, 2.6, 37), (L / 2, 2.6, 0.5), 0.2))
        bottles = np.full(len(P), 1e3)
        for row, z0 in ((0, 26.5), (1, 37.5)):
            xs = np.arange(-L / 2 + 3, L / 2 - 2, 3.1)
            for k, x in enumerate(xs):
                h = 3.4 + 1.4 * ((k * 7 + row * 3 + seed) % 3) / 2
                b = smin(cyl_z(P, (x, 2.6, z0 + h / 2), 1.1, h / 2, 0.4), capsule(P, (x, 2.6, z0 + h), (x, 2.6, z0 + h + 1.6), 0.4), 0.5)
                bottles = np.minimum(bottles, b)
        return [cab, mirror, shelves, bottles]

    def cm(p, n):
        front = n[:, 1] > 0.5
        door = front & (np.mod(p[:, 0] + 200, 16.0) < 0.6)
        return np.full(len(p), RID['wood']), 1.8 - door * 0.7, np.zeros(len(p))

    def bm(p, n):
        k = hash3(np.floor((p[:, 0] + 200) / 3.1), np.floor(p[:, 2] / 10), 1, seed)
        r = np.array([RID['sage'], RID['clay'], RID['khaki'], RID['glass'], RID['brick'], RID['teal']])[(k * 6).astype(int) % 6]
        return r, 2.8 + (p[:, 2] % 10 > 6) * 0.6, np.full(len(p), 0.9)
    return M(parts, [cm, glassm(2.6), solid('wood', 2.4), bm], (-L / 2 - 1, L / 2 + 1, -1, 11, 0, 46))


def booth(length=24, color=('brick', 2.2)):
    """High-backed booth bench. FRONT (+y) is the side you sit facing (toward the table)."""
    L = length

    def parts(P):
        seat = rbox(P, (0, 0, 6), (L / 2, 5, 6), 1.6)
        back = rbox(P, (0, -5.5, 15), (L / 2, 2.2, 14), 1.4)
        cush = rbox(P, (0, 0.6, 12.4), (L / 2 - 1.2, 4.4, 1.4), 1.2)
        return [smin(seat, back, 0.8), cush]
    return M(parts, [solid('wood', 1.8), solid(color[0], color[1] + 0.4)], (-L / 2 - 1, L / 2 + 1, -9, 7, 0, 30))


def pub_table(length=24):
    """Small table on a pedestal, with two glasses and a bowl of peanuts."""
    L = length

    def parts(P):
        top = rbox(P, (0, 0, 15), (L / 2, 6.5, 0.8), 0.5)
        post = capsule(P, (0, 0, 1), (0, 0, 14), 1.0)
        foot = rbox(P, (0, 0, 0.6), (5, 4, 0.6), 0.3)
        glasses = np.minimum(cyl_z(P, (-4, 1, 18), 1.2, 2.2, 0.3), cyl_z(P, (5, -1.5, 18), 1.2, 2.2, 0.3))
        bowl = ell(P, (1, 2, 16.4), (2.2, 2.2, 1.0))
        return [top, post, foot, glasses, bowl]

    def gm(p, n):
        beer = p[:, 2] < 19.2
        return np.where(beer, RID['khaki'], RID['glass']), np.where(beer, 3.6, 4.0), np.full(len(p), 1.0)
    return M(parts, [solid('wood', 2.6, 0.4), solid('night', 2.0), solid('night', 1.8), gm, solid('clay', 3.0)], (-L / 2 - 1, L / 2 + 1, -8, 8, 0, 21))


def jukebox():
    """Arched jukebox with a glass panel and coloured lights. FRONT (+y) faces the room."""
    def parts(P):
        body = smin(rbox(P, (0, 0, 13), (7, 5, 13), 1.2), cyl_y(P, (0, 0, 26), 7, 5, 1.2), 1.0)
        panel = rbox(P, (0, 5.0, 18), (5, 0.4, 6), 0.4)
        grille = rbox(P, (0, 5.0, 6), (5, 0.4, 3.6), 0.4)
        return [body, panel, grille]

    def bm(p, n):
        x, z = p[:, 0], p[:, 2]
        arch = (np.abs(np.hypot(x, z - 26) - 6.2) < 0.9) & (z > 22)
        side = (np.abs(np.abs(x) - 6.2) < 0.8) & (z > 3) & (z < 24)
        light = arch | side
        k = np.floor((np.arctan2(z - 26, x) + 4) * 3) + np.floor(z / 4)
        c = np.where(np.mod(k, 3) == 0, RID['red'], np.where(np.mod(k, 3) == 1, RID['teal'], RID['plum']))
        return np.where(light, c, RID['wood']), np.where(light, 4.4, 2.0), np.where(light, 0.6, 0.2)

    def pm(p, n):
        rec = (np.mod(p[:, 0] + 20, 2.5) < 1.2) & (np.mod(p[:, 2], 3.0) < 1.6)
        return np.where(rec, RID['white'], RID['glass']), np.where(rec, 3.6, 2.6), np.full(len(p), 1.0)
    return M(parts, [bm, pm, solid('night', 1.8)], (-9, 9, -7, 7, 0, 34))


def dartboard():
    """Wall-mounted dartboard in a dark cabinet. Back on the wall, sticks out toward +y."""
    def parts(P):
        cab = rbox(P, (0, 0.8, 36), (7, 0.8, 7), 0.4)
        board = cyl_y(P, (0, 2.0, 36), 5, 0.6, 0.3)
        return [cab, board]

    def dm(p, n):
        r = np.hypot(p[:, 0], p[:, 2] - 36)
        ang = np.floor((np.arctan2(p[:, 2] - 36, p[:, 0]) + np.pi) / (2 * np.pi) * 20)
        ring = (np.abs(r - 3.0) < 0.45) | (np.abs(r - 4.6) < 0.45)
        alt = np.mod(ang, 2) == 0
        ramp = np.where(r < 0.8, RID['red'], np.where(ring, np.where(alt, RID['red'], RID['sage']), np.where(alt, RID['night'], RID['stone'])))
        return ramp, np.where(alt & ~ring, 1.4, 3.4), np.zeros(len(p))
    return M(parts, [solid('wood', 1.6), dm], (-8, 8, -1, 3, 28, 44))


def neon_sign(color='teal', w=14, h=6):
    """Wall-mounted glowing sign (a beer brand, no text). Back on the wall, sticks out toward +y."""
    def parts(P):
        plate = rbox(P, (0, 0.4, 40), (w / 2, 0.4, h / 2), 0.3)
        tube = np.maximum(np.abs(np.hypot((P[:, 0]) / (w / 2 - 1.5), (P[:, 2] - 40) / (h / 2 - 1.2)) - 1.0) * 1.6 - 0.25, np.abs(P[:, 1] - 1.2) - 0.5)
        return [plate, tube]
    return M(parts, [solid('night', 1.6), solid(color, 4.8, 0.2)], (-w / 2 - 1, w / 2 + 1, -1, 2, 40 - h / 2 - 1, 40 + h / 2 + 1))


def reception_desk(length=40):
    """Lobby reception desk: tall front with a raised ledge, a monitor and a bell. FRONT (+y) is the visitor side."""
    L = length

    def parts(P):
        body = rbox(P, (0, 0, 10), (L / 2, 6, 10), 0.8)
        ledge = rbox(P, (0, 4.5, 22.5), (L / 2, 2.4, 0.8), 0.4)
        ledge_wall = rbox(P, (0, 5.5, 18), (L / 2, 1.0, 4), 0.4)
        top = rbox(P, (0, -1.5, 17.2), (L / 2 - 0.5, 4.5, 0.6), 0.3)
        mon = np.minimum(rbox(P, (-6, -1, 23), (4, 0.4, 3), 0.2), rbox(P, (-6, -1.6, 18.5), (0.6, 0.6, 1.2), 0.2))
        bell = smin(ell(P, (8, 4.5, 24.2), (1.2, 1.2, 0.9)), cyl_z(P, (8, 4.5, 23.4), 1.6, 0.2, 0.1), 0.3)
        plant = smin(cyl_z(P, (L / 2 - 4, 4.4, 24.6), 1.4, 1.4, 0.3), ell(P, (L / 2 - 4, 4.4, 28), (2.4, 2.4, 2.4)), 0.8)
        return [body, ledge, ledge_wall, top, mon, bell, plant]

    def bm(p, n):
        front = n[:, 1] > 0.5
        stripe = front & (np.abs(p[:, 2] - 12) < 1.0)
        return np.full(len(p), RID['stone']), 3.0 + stripe * -0.9, np.full(len(p), 0.2)

    def mm(p, n):
        scr = n[:, 1] < -0.5
        return np.where(scr, RID['glass'], RID['night']), np.where(scr, 3.4, 2.0), np.where(scr, 1.0, 0.2)
    return M(parts, [bm, solid('wood', 2.8, 0.4), solid('stone', 2.4), solid('wood', 2.4), mm, solid('lavlt', 3.6, 0.9), solid('sage', 2.6)],
             (-L / 2 - 1, L / 2 + 1, -8, 9, 0, 31))


def elevator_doors():
    """Wall-mounted elevator: brushed metal double doors with a frame and a floor indicator. Back on the wall."""
    def parts(P):
        frame = rbox(P, (0, 0.8, 24), (12, 0.8, 24), 0.3)
        doors = rbox(P, (0, 1.6, 22), (9.5, 0.4, 22), 0.2)
        ind = rbox(P, (0, 1.8, 46), (3, 0.3, 1.2), 0.2)
        btn = rbox(P, (14.5, 0.9, 21), (1.2, 0.5, 2.2), 0.2)
        return [frame, doors, ind, btn]

    def dm(p, n):
        seam = np.abs(p[:, 0]) < 0.35
        brush = np.mod(p[:, 2] * 1.3, 2.0) < 0.3
        return np.full(len(p), RID['lavlt']), 3.3 - seam * 1.4 + brush * 0.2, np.full(len(p), 0.7)

    def im(p, n):
        lit = np.abs(p[:, 0] + 1.5) < 0.6
        return np.where(lit, RID['red'], RID['night']), np.where(lit, 4.6, 1.6), np.zeros(len(p))
    return M(parts, [solid('lavlt', 2.4, 0.5), dm, im, solid('lavlt', 2.8, 0.6)], (-16, 16, -1, 3, 0, 49))


def pool_table():
    """Pool table (decoration only): wood frame, green felt, a few balls and a cue. Long axis along x."""
    def parts(P):
        legs = np.minimum.reduce([rbox(P, (sx, sy, 6), (1.6, 1.6, 6), 0.4) for sx in (-19, 19) for sy in (-9, 9)])
        body = rbox(P, (0, 0, 13), (22, 12, 2.6), 0.8)
        felt = rbox(P, (0, 0, 15.2), (19.5, 9.5, 0.6), 0.2)
        rails = np.maximum(rbox(P, (0, 0, 16.2), (22, 12, 1.2), 0.6), -rbox(P, (0, 0, 16.2), (19.5, 9.5, 2), 0.2))
        balls = np.minimum.reduce([ell(P, (x, y, 16.7), (1.0, 1.0, 1.0)) for x, y in ((8, 2), (10, -1), (10, 3), (12, 0.5), (-10, -3), (3, 5))])
        cue = capsule(P, (-16, -6, 16.6), (6, 7, 17.4), 0.45)
        return [legs, body, felt, rails, balls, cue]

    def bm(p, n):
        k = hash3(np.floor(p[:, 0]), np.floor(p[:, 1]), 1, 6)
        return np.array([RID['red'], RID['navy'], RID['white'], RID['night'], RID['clay'], RID['sage']])[(k * 6).astype(int) % 6], np.full(len(p), 3.4), np.full(len(p), 0.8)
    return M(parts, [solid('wood', 1.8), solid('wood', 2.2), solid('sage', 2.0), solid('wood', 2.6, 0.3), bm, solid('wood', 3.2)], (-24, 24, -14, 14, 0, 19))


# ======================================================================= laundering clutter (Phase 1, Dez's back room)
# Bills are sage/khaki paper with white bands. Gold stays reserved for interactables and loot cues.
def _billm(seed=1):
    def m(p, n):
        k = hash3(np.floor(p[:, 0] / 3.2), np.floor(p[:, 1] / 2.2), np.floor(p[:, 2] / 1.1), seed)
        band = np.abs(np.mod(p[:, 0] + 50, 6.4) - 3.2) < 0.55
        r = np.where(band & (n[:, 2] > 0.3), RID['white'], np.where(k > 0.5, RID['sage'], RID['khaki']))
        return r, np.where(band, 4.2, 3.0 + k * 0.6), np.zeros(len(p))
    return m


def cash_bundles(n=6, seed=1):
    """Banded bundles of bills stacked in a small pile (stands on a surface or the floor)."""
    def parts(P):
        d = np.full(len(P), 1e3)
        for k in range(n):
            row, col, lay = k % 2, (k // 2) % 2, k // 4
            d = np.minimum(d, rbox(P, (-3.4 + col * 6.8, -1.6 + row * 3.4, 0.8 + lay * 1.6), (3.2, 1.6, 0.75), 0.2))
        return [d]
    return M(parts, [_billm(seed)], (-8, 8, -4, 4, 0, 1.6 * (n // 4 + 1) + 1))


def loose_bills(n=7, spread=14, seed=2):
    """Bills scattered flat (on a floor or a table top)."""
    rng = np.random.default_rng(seed)
    pts = [(rng.uniform(-spread, spread), rng.uniform(-spread * 0.6, spread * 0.6), rng.uniform(0, np.pi)) for _ in range(n)]

    def parts(P):
        d = np.full(len(P), 1e3)
        for x, y, a in pts:
            c, s_ = np.cos(a), np.sin(a)
            lx = (P[:, 0] - x) * c + (P[:, 1] - y) * s_
            ly = -(P[:, 0] - x) * s_ + (P[:, 1] - y) * c
            q = np.stack([lx, ly, P[:, 2] - 0.25], 1)
            d = np.minimum(d, rbox(q, (0, 0, 0), (3.0, 1.4, 0.25), 0.1))
        return [d]

    def m(p, n_):
        k = hash3(np.floor(p[:, 0]), np.floor(p[:, 1]), 1, seed)
        return np.where(k > 0.5, RID['sage'], RID['khaki']), np.full(len(p), 3.3) + k * 0.4, np.zeros(len(p))
    return M(parts, [m], (-spread - 4, spread + 4, -spread * 0.6 - 4, spread * 0.6 + 4, 0, 1))


def money_counter():
    """Desktop bill-counting machine with a stack in the hopper. FRONT (+y) faces the operator."""
    def parts(P):
        body = rbox(P, (0, 0, 3.0), (4.2, 3.6, 3.0), 0.8)
        hopper = rbox(P, (0, -1.4, 6.6), (3.0, 1.4, 1.2), 0.3)
        stack = rbox(P, (0, -1.4, 7.4), (2.6, 1.0, 0.8), 0.1)
        tray = rbox(P, (0, 3.6, 1.2), (3.0, 1.4, 0.6), 0.2)
        display = rbox(P, (0, 3.5, 4.4), (2.0, 0.2, 0.8), 0.1)
        return [body, hopper, stack, tray, display]

    def dm(p, n):
        return np.full(len(p), RID['red']), np.full(len(p), 4.6), np.zeros(len(p))
    return M(parts, [solid('lavlt', 3.0, 0.4), solid('night', 2.0), _billm(4), solid('night', 2.2), dm], (-6, 6, -5, 6, 0, 9))


def cash_duffel():
    """An open duffel bag on the floor with bundles showing. FRONT (+y) is the open side."""
    def parts(P):
        bag = np.maximum(smin(ell(P, (0, 0, 5), (10, 5.5, 5)), rbox(P, (0, 0, 3), (9, 5, 3), 2), 1.5), -rbox(P, (0, 1.0, 9.5), (7.5, 3.4, 3), 1))
        cash = rbox(P, (0, 1.0, 7.0), (7.0, 3.0, 1.2), 0.3)
        handles = np.minimum(capsule(P, (-4, -4.6, 8.5), (4, -4.6, 8.5), 0.5), capsule(P, (-4, 5.0, 7.8), (4, 5.0, 7.8), 0.5))
        return [bag, cash, handles]
    return M(parts, [solid('night', 2.4, 0.2), _billm(7), solid('night', 1.8)], (-12, 12, -7, 7, 0, 11))


def counting_table():
    """Folding table for counting cash: plain top on steel legs."""
    def parts(P):
        top = rbox(P, (0, 0, 15), (14, 7, 0.6), 0.3)
        legs = np.minimum.reduce([capsule(P, (sx, sy, 0.5), (sx, sy, 14.5), 0.5) for sx in (-12.5, 12.5) for sy in (-5.5, 5.5)])
        return [top, legs]
    return M(parts, [solid('lavlt', 3.2), solid('lavlt', 2.2, 0.5)], (-15, 15, -8, 8, 0, 16))

DECOR = {
    # plants
    'plant_tall': plant_tall, 'plant_snake': plant_snake, 'plant_small': plant_small, 'plant_hanging': plant_hanging, 'ficus_tree': ficus_tree,
    # decorative
    'vase_flowers': vase_flowers, 'vase_tall': vase_tall, 'bowl_fruit': bowl_fruit, 'books_row': books_row, 'bookshelf': bookshelf,
    'wall_shelf': wall_shelf, 'floor_lamp': floor_lamp, 'table_lamp': table_lamp, 'side_table': side_table, 'coffee_table': coffee_table,
    'rug': rug, 'radiator': radiator, 'coat_rack': coat_rack, 'laundry_basket': laundry_basket, 'trash_bin': trash_bin,
    # furniture (front = +y)
    'sofa': sofa, 'armchair': armchair, 'tv_stand': tv_stand, 'office_chair': office_chair, 'wooden_chair': wooden_chair,
    'exec_desk': exec_desk, 'ledger_desk': ledger_desk, 'waiting_chairs': waiting_chairs, 'teller_counter': teller_counter,
    # kitchen / table
    'kitchen_items': kitchen_items, 'dish_rack': dish_rack, 'place_setting': place_setting, 'coffee_machine': coffee_machine,
    # office / store / utility
    'desk_clutter': desk_clutter, 'whiteboard': whiteboard, 'corkboard': corkboard, 'vending_machine': vending_machine,
    'chest_freezer': chest_freezer, 'news_rack': news_rack, 'entrance_mat': entrance_mat, 'cardboard_boxes': cardboard_boxes,
    'storage_shelf': storage_shelf, 'mop_bucket': mop_bucket, 'broom': broom, 'fire_extinguisher': fire_extinguisher,
    # security / heist
    'server_rack': server_rack, 'cctv_desk': cctv_desk, 'dvr_rack': dvr_rack, 'alarm_panel': alarm_panel, 'keycard_reader': keycard_reader,
    'door_leaf': door_leaf, 'security_gate': security_gate, 'stanchions': stanchions,
    # street
    'news_box': news_box, 'bike_rack': bike_rack, 'bollard': bollard, 'street_planter': street_planter, 'bus_stop_sign': bus_stop_sign,
    # bar + office lobby (Phase 1)
    'bar_stool': bar_stool, 'bar_counter': bar_counter, 'beer_taps': beer_taps, 'back_bar': back_bar, 'booth': booth, 'pub_table': pub_table,
    'jukebox': jukebox, 'dartboard': dartboard, 'neon_sign': neon_sign, 'reception_desk': reception_desk, 'elevator_doors': elevator_doors,
    'pool_table': pool_table, 'cash_bundles': cash_bundles, 'loose_bills': loose_bills, 'money_counter': money_counter,
    'cash_duffel': cash_duffel, 'counting_table': counting_table,
}

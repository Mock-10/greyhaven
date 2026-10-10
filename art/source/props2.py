import numpy as np
from sdf import Model, ell, capsule, rbox, cyl_z, smin, solid, RID, hash3


def lump(P, a=0.7, f=1.5):
    return a * np.sin(P[:, 0] * f) * np.sin(P[:, 1] * f * 1.1) * np.sin(P[:, 2] * f * 0.9)


def tree(seed=1, leaf='sage', base=2.2):
    def parts(P):
        trunk = smin(capsule(P, (0, 0, 0), (0.6, 0, 30), 3.0, 1.7), capsule(P, (0.3, 0, 16), (5.5, 2.5, 33), 1.2, 0.8), 1.0)
        trunk = smin(trunk, ell(P, (0, 0, 1.0), (4.8, 4.8, 2.2)), 1.5)
        cs = [(0, 0, 45, 13, 13, 10), (-8, 4, 40, 9, 9, 7.5), (8, -3, 41, 9, 9, 8), (3, 9, 38, 8.5, 8, 7), (-3, -9, 40, 8, 8, 7.5),
              (0, 0, 55, 9, 9, 7), (-6, -4, 52, 7, 7, 6), (6, 4, 51, 7, 7, 6)]
        cd = np.full(len(P), 1e3)
        for (cx, cy, cz, rx, ry, rz) in cs:
            cd = smin(cd, ell(P, (cx, cy, cz), (rx, ry, rz)), 3.0)
        cd = cd + lump(P, 0.9, 1.25)
        return [trunk, cd]

    def leaf_mat(p, n):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        clump = hash3(np.floor(x / 3.0), np.floor(y / 3.0), np.floor(z / 3.0), seed)
        t = base + (z - 45) * 0.045 + (clump - 0.5) * 1.1
        ramp = np.where(clump > 0.8, RID['khaki'], RID[leaf])
        t = np.where(clump > 0.8, t + 0.2, t)
        return ramp, t, np.zeros(len(p))

    def bark(p, n):
        z = p[:, 2]
        return np.full(len(p), RID['wood']), 1.4 + (np.mod(p[:, 0] * 1.3 + z * 0.3, 2.2) < 0.7) * -0.5 + (z > 28) * 0.3, np.zeros(len(p))
    return Model(parts, [bark, leaf_mat], (-18, 18, -18, 18, 0, 66))


def pine():
    def parts(P):
        trunk = capsule(P, (0, 0, 0), (0, 0, 14), 1.6, 1.2)
        d = np.full(len(P), 1e3)
        for z, r, h in ((9, 11, 9), (18, 9, 9), (27, 7, 8), (35, 5, 8), (43, 3, 8)):
            d = np.minimum(d, ell(P, (0, 0, z + h * 0.35), (r, r, h)) + lump(P, 0.4, 2.0))
        return [trunk, d]

    def mat(p, n):
        z = p[:, 2]
        c = hash3(np.floor(p[:, 0] / 2), np.floor(p[:, 1] / 2), np.floor(z / 2), 3)
        return np.full(len(p), RID['sage']), 0.9 + (c - 0.5) * 0.8 + (z - 20) * 0.02, np.zeros(len(p))
    return Model(parts, [solid('wood', 1.3), mat], (-13, 13, -13, 13, 0, 56))


def bush(berries=True):
    def parts(P):
        b = smin(ell(P, (0, 0, 6.5), (10, 9, 6.5)), ell(P, (-5, 3, 5.5), (6.5, 6.5, 5.2)), 2.5) + lump(P, 0.6, 1.8)
        bs = [ell(P, c, (0.9, 0.9, 0.9)) for c in ((6.2, 4, 10.5), (2, 7, 9), (7.5, -2, 8), (-1, -3, 12))] if berries else [np.full(len(P), 1e3)]
        return [b, np.minimum.reduce(bs)]

    def leaf(p, n):
        c = hash3(np.floor(p[:, 0] / 2.4), np.floor(p[:, 1] / 2.4), np.floor(p[:, 2] / 2.4), 5)
        return np.where(c > 0.82, RID['khaki'], RID['sage']), 1.9 + (c - 0.5) * 1.0 + (p[:, 2] - 6) * 0.08, np.zeros(len(p))
    return Model(parts, [leaf, solid('brick', 3.4, 0.5)], (-12, 12, -11, 11, 0, 15))


def planter():
    def parts(P):
        pot = rbox(P, (0, 0, 4.5), (8.5, 8.5, 4.5), 1.2)
        plant = ell(P, (0, 0, 11.5), (7.2, 7.2, 4.2)) + lump(P, 0.5, 2.0)
        fl = np.minimum.reduce([ell(P, c, (1.1, 1.1, 1.1)) for c in ((-3, 2, 14.5), (3, -1.5, 14), (1, 4, 14.3), (-1, -4, 14.2))])
        return [pot, plant, fl]

    def fmat(p, n):
        h = hash3(np.floor(p[:, 0] * 0.7), np.floor(p[:, 1] * 0.7), 1, 4)
        return np.where(h > 0.5, RID['plum'], RID['gold']), np.where(h > 0.5, 3.9, 3.8), np.zeros(len(p))
    return Model(parts, [solid('brick', 2.3), solid('sage', 2.5), fmat], (-10, 10, -10, 10, 0, 17))


def lamp():
    def parts(P):
        pole = capsule(P, (0, 0, 0), (0, 0, 40), 1.1, 0.8)
        base = capsule(P, (0, 0, 0), (0, 0, 5), 1.9, 1.3)
        arm = capsule(P, (0, 0, 40), (0, 6.5, 42), 0.7, 0.6)
        head = ell(P, (0, 7.5, 42.2), (2.6, 3.6, 1.2))
        bulb = ell(P, (0, 7.5, 41.2), (1.8, 2.6, 0.7))
        return [np.minimum(pole, base), arm, head, bulb]
    return Model(parts, [solid('night', 2.4), solid('night', 2.4), solid('lav', 2.6), solid('stone', 5.0, 0.4)], (-5, 5, -4, 14, 0, 46))


def bench():
    def parts(P):
        seat = rbox(P, (0, 0, 8.6), (13, 4.4, 0.9), 0.5)
        Q = P.copy(); Q[:, 2] += 0.22 * (P[:, 1] + 4.2)
        back = rbox(Q, (0, -4.4, 13.5), (13, 0.8, 3.6), 0.4)
        legs = np.minimum.reduce([rbox(P, (sx, sy, 4.2), (0.7, 0.7, 4.2), 0.25) for sx in (-11, 11) for sy in (-3.4, 3.4)])
        arms = np.minimum(rbox(P, (-12.4, 0, 11.4), (0.6, 4.2, 0.5), 0.2), rbox(P, (12.4, 0, 11.4), (0.6, 4.2, 0.5), 0.2))
        return [seat, back, legs, arms]

    def slat(p, n):
        return np.full(len(p), RID['wood']), 2.2 + (np.mod(p[:, 1] * 1.0 + p[:, 2], 2.4) < 0.5) * -0.8, np.zeros(len(p))
    return Model(parts, [slat, slat, solid('night', 2.2), solid('night', 2.6)], (-15, 15, -8, 7, 0, 19))


def trash_can():
    def parts(P):
        return [cyl_z(P, (0, 0, 7.5), 4.6, 7.5, 1.0), cyl_z(P, (0, 0, 15.2), 5.1, 0.8, 0.6)]

    def mat(p, n):
        a = np.arctan2(p[:, 1], p[:, 0])
        return np.full(len(p), RID['teal']), 2.1 + (np.mod(a * 4.0, 1.0) < 0.35) * 0.5 + (p[:, 2] < 2) * -0.6, np.zeros(len(p))
    return Model(parts, [mat, solid('lavlt', 2.7, 0.4)], (-6, 6, -6, 6, 0, 17))


def hydrant():
    def parts(P):
        b = smin(capsule(P, (0, 0, 0), (0, 0, 11), 3.0, 2.7), ell(P, (0, 0, 12.5), (3.6, 3.6, 2.0)), 1.0)
        n = capsule(P, (-4, 0, 7.5), (4, 0, 7.5), 1.6)
        top = capsule(P, (0, 0, 13), (0, 0, 16), 1.5, 1.0)
        return [np.minimum(b, np.minimum(n, top))]
    return Model(parts, [solid('red', 2.4, 0.4)], (-6, 6, -6, 6, 0, 18))


def mailbox():
    def parts(P):
        post = capsule(P, (0, 0, 0), (0, 0, 15), 1.0, 0.9)
        body = smin(rbox(P, (0, 0, 19.5), (5.2, 4.2, 3.6), 1.0), ell(P, (0, 0, 22.0), (5.2, 4.2, 2.8)), 1.5)
        flag = rbox(P, (0, 4.6, 22), (0.3, 0.4, 2.2), 0.1)
        return [post, body, flag]
    return Model(parts, [solid('night', 2.2), solid('navy', 2.5, 0.4), solid('red', 3.0)], (-7, 7, -6, 7, 0, 26))


def dumpster():
    def parts(P):
        body = rbox(P, (0, 0, 8.5), (16, 8.4, 7.0), 0.8)
        lid = rbox(P, (0, 0, 16.6), (16.6, 8.8, 1.2), 0.6)
        wheels = np.minimum(cyl_z(P, (-12, 8.6, 1.4), 1.8, 1.4, 0.5), cyl_z(P, (12, 8.6, 1.4), 1.8, 1.4, 0.5))
        return [body, lid, wheels]

    def bmat(p, n):
        x, z = p[:, 0], p[:, 2]
        rib = np.mod(x + 40, 5.0) < 0.9
        stk = (n[:, 1] > 0.5) & (np.abs(x - 2) < 5.5) & (z > 8) & (z < 12.5)
        r = np.where(stk, RID['white'], RID['sage']); t = np.where(stk, 3.8, 1.5 + rib * 0.6 + hash3(np.floor(x), np.floor(z), 2, 4) * 0.4)
        return r, t, np.zeros(len(p))
    return Model(parts, [bmat, solid('night', 2.0), solid('night', 1.0)], (-18, 18, -10, 12, 0, 19))


def crate(seed=3):
    def parts(P):
        return [rbox(P, (0, 0, 7.5), (7.5, 7.5, 7.5), 0.8)]

    def mat(p, n):
        z, x, y = p[:, 2], p[:, 0], p[:, 1]
        u = np.where(n[:, 1] > 0.55, x, y)
        plank = np.mod(z, 5.0) < 0.5
        base = 2.0 + hash3(np.floor(z / 5), 1, 3, seed) * 0.8 - plank * 0.9
        edge = (np.abs(u) > 6.3) | (z < 1.4) | (z > 13.6)
        base = np.where(edge, base - 0.5, base)
        return np.full(len(p), RID['wood']), base, np.zeros(len(p))
    return Model(parts, [mat], (-8.5, 8.5, -8.5, 8.5, 0, 15.5))


def barrel(c='teal'):
    def parts(P):
        return [smin(cyl_z(P, (0, 0, 8.5), 4.9, 8.5, 1.2), ell(P, (0, 0, 8.5), (5.7, 5.7, 7.0)), 1.5)]

    def mat(p, n):
        z = p[:, 2]
        band = (np.abs(z - 4) < 0.6) | (np.abs(z - 13) < 0.6)
        return np.where(band, RID['night'], RID[c]), np.where(band, 2.0, 2.2 + (p[:, 0] > 0) * -0.2), np.zeros(len(p))
    return Model(parts, [mat], (-7, 7, -7, 7, 0, 18))


def traffic_light(go='red'):
    def parts(P):
        pole = capsule(P, (0, 0, 0), (0, 0, 34), 1.2, 0.9)
        base = capsule(P, (0, 0, 0), (0, 0, 4), 2.0, 1.5)
        head = rbox(P, (0, 2.0, 41), (2.4, 2.4, 6.6), 0.9)
        lamps = np.minimum.reduce([ell(P, (0, 4.2, 41 + dz), (1.5, 0.9, 1.5)) for dz in (-4.4, 0, 4.4)])
        return [np.minimum(pole, base), head, lamps]

    def lm(p, n):
        z = p[:, 2]
        which = np.where(z > 43.5, 0, np.where(z > 39.5, 1, 2))
        on = {'red': 0, 'yellow': 1, 'green': 2}[go]
        ramps = np.array([RID['red'], RID['khaki'], RID['sage']])[which]
        t = np.where(which == on, 4.4, 1.0)
        return ramps, t, np.where(which == on, 0.8, 0.0)
    return Model(parts, [solid('night', 2.4), solid('night', 1.6), lm], (-4, 4, -4, 8, 0, 49))


def street_sign():
    def parts(P):
        pole = capsule(P, (0, 0, 0), (0, 0, 30), 0.8, 0.7)
        plate = rbox(P, (0, 0, 33), (5.2, 0.6, 3.6), 0.4)
        return [pole, plate]

    def pm(p, n):
        bar = (np.abs(p[:, 2] - 34.6) < 0.5) | (np.abs(p[:, 2] - 31.8) < 0.4)
        return np.where(bar, RID['white'], RID['sage']), np.where(bar, 3.8, 1.8), np.zeros(len(p))
    return Model(parts, [solid('lavlt', 2.4), pm], (-7, 7, -3, 3, 0, 38))


PROPS = {
    'tree_a': lambda: tree(1), 'tree_b': lambda: tree(2, 'khaki', 2.0), 'pine': pine, 'bush': bush, 'planter': planter,
    'lamp': lamp, 'bench': bench, 'trash_can': trash_can, 'hydrant': hydrant, 'mailbox': mailbox, 'dumpster': dumpster,
    'crate': crate, 'barrel_teal': lambda: barrel('teal'), 'barrel_brick': lambda: barrel('brick'),
    'traffic_light': traffic_light, 'street_sign': street_sign,
}


# =================================================================== INTERACTABLES
def atm():
    def parts(P):
        body = rbox(P, (0, 0, 17.5), (6.5, 6.5, 17.5), 1.2)
        hood = rbox(P, (0.8, 1.0, 36.5), (7.2, 7.4, 2.4), 1.2)
        return [body, hood]

    def mat(p, n):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        left = n[:, 1] > 0.55
        ramp = np.full(len(p), RID['blueg']); base = np.full(len(p), 2.1)
        scr = left & (np.abs(x) < 4.4) & (z > 21) & (z < 31)
        ramp = np.where(scr, RID['glass'], ramp); base = np.where(scr, 3.1 + (z - 21) * 0.05, base)
        txt = scr & (np.abs(z - 27) < 0.5) & (np.abs(x) < 2.8)
        ramp = np.where(txt, RID['sage'], ramp); base = np.where(txt, 4.8, base)
        key = left & (np.abs(x + 1) < 3.5) & (z > 13) & (z < 18.5) & (np.mod(x + 8, 2.0) < 1.2) & (np.mod(z, 2.0) < 1.2)
        ramp = np.where(key, RID['lavlt'], ramp); base = np.where(key, 4.2, base)
        slot = left & (np.abs(x) < 3.4) & (np.abs(z - 8.5) < 0.9)
        ramp = np.where(slot, RID['gold'], ramp); base = np.where(slot, 4.4, base)
        return ramp, base, np.where(scr, 1.0, 0.0)
    return Model(parts, [mat, solid('blueg', 2.9)], (-9, 9, -8, 10, 0, 40))


def safe():
    def parts(P):
        return [rbox(P, (0, 0, 10), (9.5, 9.5, 10), 1.3)]

    def mat(p, n):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        left = n[:, 1] > 0.55
        ramp = np.full(len(p), RID['night']); base = np.full(len(p), 2.3)
        door = left & (np.abs(x) < 7.5) & (z > 3) & (z < 17.2)
        ramp = np.where(door, RID['lavlt'], ramp); base = np.where(door, 1.5, base)
        r = np.sqrt(x ** 2 + (z - 10.2) ** 2)
        dial = left & (r < 3.7)
        ramp = np.where(dial, RID['gold'], ramp); base = np.where(dial, np.where(r < 2.2, 4.4, 3.0), base)
        tick = left & (r > 2.2) & (r < 3.7) & (np.abs(np.sin(np.arctan2(z - 10.2, x) * 6)) < 0.18)
        base = np.where(tick, 1.8, base)
        hd = left & (x > 3.8) & (x < 6.6) & (np.abs(z - 10.2) < 0.7)
        ramp = np.where(hd, RID['gold'], ramp); base = np.where(hd, 3.9, base)
        return ramp, base, np.where(dial | hd, 0.9, 0.0)
    return Model(parts, [mat], (-11, 11, -11, 11, 0, 21))


def gold_bars():
    def parts(P):
        d = np.full(len(P), 1e3)
        for (x, y, z) in ((-6, -3.3, 1.7), (6, -3.3, 1.7), (-6, 3.3, 1.7), (6, 3.3, 1.7), (0, 0, 5.1), (-6, 0, 5.1) if False else (6, 0, 5.1), (0, 0, 8.5)):
            Q = P.copy()
            d = np.minimum(d, rbox(Q, (x, y, z), (5.2, 2.7, 1.8), 0.9))
        return [d]

    def mat(p, n):
        top = n[:, 2] > 0.6
        return np.full(len(p), RID['gold']), 2.8 + top * 0.5 + (hash3(np.floor(p[:, 0]), np.floor(p[:, 1]), 1, 2) - 0.5) * 0.3, np.full(len(p), 1.3)
    return Model(parts, [mat], (-13, 13, -8, 8, 0, 12))


def cash_stack():
    def parts(P):
        d = np.full(len(P), 1e3)
        for (x, y, z) in ((-5.5, -4.2, 1.5), (5.5, -4.2, 1.5), (-5.5, 4.2, 1.5), (5.5, 4.2, 1.5), (0, -1, 4.5), (0, 2.5, 7.5)):
            d = np.minimum(d, rbox(P, (x, y, z), (5.0, 3.5, 1.5), 0.5))
        return [d]

    def mat(p, n):
        x = p[:, 0]
        band = np.abs(np.mod(x + 40, 11.0) - 5.5) < 0.9
        lines = np.mod(p[:, 2] * 1.8, 1.0) < 0.35
        r = np.where(band, RID['stone'], RID['khaki'])
        t = np.where(band, 4.2, 2.2 + lines * -0.4)
        return r, t, np.zeros(len(p))
    return Model(parts, [mat], (-12, 12, -9, 9, 0, 11))


def loot_bag():
    def parts(P):
        body = smin(ell(P, (0, 0, 7), (10, 7.5, 7)), ell(P, (0, 0, 11), (7.5, 5.5, 4)), 2.5)
        coins = np.minimum.reduce([cyl_z(P, (cx, cy, cz), 2.1, 0.5, 0.3) for (cx, cy, cz) in ((-3, 1, 14.2), (1, -2, 15.0), (3, 2, 14.4), (-1, 3, 15.6), (2, -3, 14.0))])
        bar = rbox(P, (0, 0.5, 15.8), (3.3, 1.7, 1.0), 0.4)
        strap = capsule(P, (-6, 0, 12), (-2, 0, 20), 0.7)
        return [body, coins, bar, strap]
    return Model(parts, [lambda p, n: (np.full(len(p), RID['stone']), 1.8 + (p[:, 2] > 11) * 0.3 + (np.mod(p[:, 0] + p[:, 1] * 0.5, 3.0) < 0.5) * -0.5, np.zeros(len(p))),
                         solid('gold', 3.6, 1.2), solid('gold', 3.4, 1.4), solid('wood', 2.0)], (-12, 12, -9, 9, 0, 22))


def crate_loot():
    def parts(P):
        body = rbox(P, (0, 0, 7.5), (7.5, 7.5, 7.5), 0.7)
        inner = rbox(P, (0, 0, 15.2), (6.2, 6.2, 1.2), 0.3)
        gold = np.minimum(rbox(P, (-1, 1, 15.8), (3.4, 2.4, 1.2), 0.6), rbox(P, (2, -2, 16.4), (2.8, 2.2, 1.0), 0.5))
        lid = rbox(P, (-1, -6.5, 17.5), (7.2, 0.8, 5.2), 0.4)
        return [body, inner, gold, lid]

    def mat(p, n):
        z = p[:, 2]
        plank = np.mod(z, 5.0) < 0.5
        return np.full(len(p), RID['wood']), 2.0 - plank * 0.9 + hash3(np.floor(z / 5), 1, 3, 3) * 0.7, np.zeros(len(p))
    return Model(parts, [mat, solid('night', 1.2), solid('gold', 3.6, 1.3), mat], (-9, 9, -9, 9, 0, 24))


def toolbox():
    def parts(P):
        body = rbox(P, (0, 0, 4.3), (9.5, 5.2, 4.3), 0.9)
        lid = rbox(P, (0, 0, 9.4), (9.8, 5.4, 1.2), 0.8)
        handle = np.maximum(ell(P, (0, 0, 10.8), (6.2, 0.9, 2.8)), -ell(P, (0, 0, 10.4), (4.8, 1.6, 1.8)))
        latch = rbox(P, (0, 5.4, 8.0), (1.2, 0.3, 1.4), 0.2)
        return [body, lid, handle, latch]
    return Model(parts, [solid('red', 2.2, 0.3), solid('red', 2.7, 0.3), solid('lavlt', 3.3, 0.6), solid('gold', 4.0, 1.0)], (-11, 11, -7, 7, 0, 14))


def filing_cabinet():
    def parts(P):
        return [rbox(P, (0, 0, 15.5), (6.2, 6.2, 15.5), 0.9), rbox(P, (-0.5, -0.5, 32.4), (4.4, 3.6, 1.3), 0.4)]

    def mat(p, n):
        z, x = p[:, 2], p[:, 0]
        left = n[:, 1] > 0.55
        ramp = np.full(len(p), RID['lavlt']); base = np.full(len(p), 2.3)
        seam = left & (np.abs(np.mod(z - 1.0, 10.0)) < 0.5) & (z > 1)
        base = np.where(seam, 0.8, base)
        hd = left & (np.abs(x) < 1.8) & (np.abs(np.mod(z - 6.0, 10.0)) < 0.6) & (z < 30)
        ramp = np.where(hd, RID['white'], ramp); base = np.where(hd, 4.8, base)
        lab = left & (np.abs(x) < 2.6) & (np.abs(np.mod(z - 2.8, 10.0)) < 0.7) & (z < 30)
        ramp = np.where(lab, RID['stone'], ramp); base = np.where(lab, 4.4, base)
        return ramp, base, np.zeros(len(p))

    def papers(p, n):
        stamp = (p[:, 2] > 33.2) & (np.abs(p[:, 0] + 1) < 1.1) & (np.abs(p[:, 1] + 0.5) < 1.1)
        return np.where(stamp, RID['red'], RID['white']), np.where(stamp, 3.2, 4.0), np.zeros(len(p))
    return Model(parts, [mat, papers], (-8, 8, -8, 8, 0, 36))


def desk():
    def parts(P):
        top = rbox(P, (0, 0, 12.2), (15, 8.5, 0.9), 0.5)
        legs = np.minimum.reduce([rbox(P, (sx, sy, 5.7), (0.9, 0.9, 5.7), 0.3) for sx in (-13.5, 13.5) for sy in (-7, 7)])
        mon = rbox(P, (-3, -2.5, 20.5), (0.9, 5.2, 4.2), 0.4)
        stand = capsule(P, (-3, -2.5, 13), (-3, -2.5, 17), 0.7)
        stack = rbox(P, (8, 1.5, 14.0), (3.8, 2.8, 1.2), 0.3)
        clip = rbox(P, (10.6, 1.5, 15.4), (0.4, 0.8, 1.0), 0.2)
        kb = rbox(P, (3, 1.5, 13.4), (3.6, 1.7, 0.4), 0.2)
        return [top, legs, mon, stand, stack, clip, kb]

    def monm(p, n):
        scr = (n[:, 0] > 0.5) & (np.abs(p[:, 1] + 2.5) < 4.4) & (np.abs(p[:, 2] - 20.5) < 3.4)
        return np.where(scr, RID['glass'], RID['night']), np.where(scr, 3.6, 1.8), np.where(scr, 1.0, 0.0)
    return Model(parts, [solid('wood', 2.5), solid('wood', 1.6), monm, solid('night', 2.2), solid('white', 4.0), solid('gold', 4.2, 1.0), solid('lavlt', 3.0)], (-17, 17, -10, 10, 0, 26))


def cash_register():
    def parts(P):
        counter = rbox(P, (0, 0, 6.0), (16, 8, 6.0), 0.8)
        top = rbox(P, (0, 0, 12.4), (16.6, 8.6, 0.8), 0.4)
        reg = rbox(P, (0, -1, 16.2), (6, 4.5, 2.8), 0.8)
        scr = rbox(P, (0, -4.2, 21.4), (3.6, 0.8, 2.6), 0.3)
        drawer = rbox(P, (0, 3.2, 14.0), (5.2, 1.8, 0.6), 0.3)
        cash = rbox(P, (0, 3.2, 14.9), (4.4, 1.2, 0.4), 0.2)
        return [counter, top, reg, scr, drawer, cash]

    def regm(p, n):
        left = n[:, 1] > 0.5
        key = left & (np.mod(p[:, 0] + 10, 2.4) < 1.4) & (np.abs(p[:, 2] - 15.5) < 0.9)
        return np.where(key, RID['gold'], RID['lavlt']), np.where(key, 4.2, 2.4), np.where(key, 0.9, 0.0)
    return Model(parts, [solid('wood', 1.8), solid('wood', 2.9), regm, lambda p, n: (np.full(len(p), RID['glass']), np.full(len(p), 3.4), np.full(len(p), 1.0)),
                         solid('lavlt', 2.7), solid('khaki', 2.6)], (-18, 18, -10, 10, 0, 25))


INTERACT = {
    'atm': atm, 'safe': safe, 'gold_bars': gold_bars, 'cash_stack': cash_stack, 'loot_bag': loot_bag,
    'crate_loot': crate_loot, 'toolbox': toolbox, 'filing_cabinet': filing_cabinet,
    'desk_paperwork': desk, 'cash_register': cash_register,
}

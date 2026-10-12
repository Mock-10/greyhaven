import numpy as np
from sdf import (Model, ell, capsule, rbox, cyl_z, smin, solid, RID, L, hash3)

S = 1.0   # overall scale: ~36px tall person (≈7.3 heads)


def human(skin_tone=2.6, upper=('lav', 1.6), lower=('night', 1.8), shoes=('night', 1.2),
          hair=('wood', 1.2), hair_style='short', sleeves='long', tie=False, shirt=None, hat=None,
          mask=False, hood=None, vest=None, case=False, bag=False, badge=False, jacket=False,
          belt=True, walk=0.0, lower_skin=False, skin_ramp='skin'):
    """Facing +x. Origin at the feet. `walk` in [-1,1] swings legs/arms."""
    w = walk
    # joint positions (units before scale)
    hipY, shY = 2.45, 3.95
    kneeL = np.array([0.4 + 2.2 * w, hipY, 10.6]); ankL = np.array([0.0 + 3.6 * w, hipY, 2.5])
    kneeR = np.array([0.4 - 2.2 * w, -hipY, 10.6]); ankR = np.array([0.0 - 3.6 * w, -hipY, 2.5])
    hipL = np.array([0.0, hipY, 19.2]); hipR = np.array([0.0, -hipY, 19.2])
    shL = np.array([0.0, shY, 30.6]); shR = np.array([0.0, -shY, 30.6])
    elL = np.array([0.0 - 1.8 * w, shY + 0.7, 23.6]); elR = np.array([0.0 + 1.8 * w, -shY - 0.7, 23.6])
    wrL = np.array([0.8 - 2.6 * w, shY + 0.8, 17.8]); wrR = np.array([0.8 + 2.6 * w, -shY - 0.8, 17.8])
    if case:
        wrR = np.array([1.2, -shY - 0.9, 17.6]); elR = np.array([0.6, -shY - 0.8, 23.6])

    def parts(p):
        P = p / S
        x, y, z = P[:, 0], P[:, 1], P[:, 2]
        out = []
        # ---- 0 skin: head, neck, hands, nose, ears
        head = smin(ell(P, (0.1, 0, 35.3), (2.6, 2.3, 2.9)), ell(P, (0.6, 0, 33.8), (2.1, 1.9, 2.0)), 1.2)
        neck = capsule(P, (0, 0, 31.4), (0.1, 0, 33.6), 1.25, 1.2)
        nose = ell(P, (2.8, 0, 34.8), (0.75, 0.55, 0.95))
        ears = np.minimum(ell(P, (0, 2.45, 35.0), (0.55, 0.45, 0.95)), ell(P, (0, -2.45, 35.0), (0.55, 0.45, 0.95)))
        handL = ell(P, wrL + (0.3, 0.1, -1.7), (1.0, 0.95, 1.9))
        handR = ell(P, wrR + (0.3, -0.1, -1.7), (1.0, 0.95, 1.9))
        skin = smin(smin(head, neck, 0.8), nose, 0.4)
        skin = np.minimum.reduce([skin, ears, handL, handR])
        if sleeves == 'short':
            skin = np.minimum.reduce([skin, capsule(P, elL, wrL, 1.3, 1.05), capsule(P, elR, wrR, 1.3, 1.05)])
        if lower_skin:
            for kn, an in ((kneeL, ankL), (kneeR, ankR)):
                skin = np.minimum(skin, capsule(P, kn - (0, 0, 0.5), an, 1.78, 1.28))
        out.append(skin * S)
        # ---- 1 hair
        cap = ell(P, (-0.25, 0, 35.6), (2.8, 2.52, 3.05))
        hl = 35.35 + 0.38 * x + 0.75 * np.maximum(np.abs(y) - 1.3, 0)
        hairc = np.maximum(cap, (hl - z) / 1.2)
        if hair_style == 'long':
            hairc = np.minimum(hairc, smin(ell(P, (-2.0, 0, 31.0), (1.5, 2.9, 5.2)), ell(P, (-1.8, 0, 35.2), (1.5, 2.7, 2.5)), 1.0))
        elif hair_style == 'bald':
            hairc = hairc + 20
        elif hair_style == 'bun':
            hairc = np.minimum(hairc, ell(P, (-2.2, 0, 38.0), (1.4, 1.4, 1.4)))
        out.append(hairc * S)
        # ---- 2 upper body (jacket / shirt)
        pel = ell(P, (0, 0, 19.8), (2.75, 3.5, 3.0))
        waist = ell(P, (0.0, 0, 23.4), (2.45, 3.1, 3.2))
        chest = ell(P, (0.25, 0, 28.0), (2.9, 3.85, 4.0))
        shoulders = capsule(P, shL + (0, -0.3, 0), shR + (0, 0.3, 0), 1.7)
        torso = smin(smin(waist, chest, 2.2), shoulders, 1.6)
        torso = smin(torso, pel, 2.0)
        if jacket:
            torso = smin(torso, ell(P, (0, 0, 18.8), (3.0, 4.35, 2.9)), 1.5)
        uarm = np.minimum(capsule(P, shL, elL, 1.4, 1.22), capsule(P, shR, elR, 1.4, 1.22))
        farm = np.minimum(capsule(P, elL, wrL, 1.22, 0.95), capsule(P, elR, wrR, 1.22, 0.95))
        up = smin(torso, uarm, 1.0)
        if sleeves == 'long':
            up = np.minimum(up, farm)
        out.append(up * S)
        # ---- 3 lower body
        def leg(hp, kn, an):
            th = capsule(P, hp, kn, 2.15, 1.7)
            cf = capsule(P, kn, an + (0, 0, 0.4), 1.65, 1.2)
            return smin(th, cf, 0.9)
        lowr = np.minimum(leg(hipL, kneeL, ankL), leg(hipR, kneeR, ankR))
        lowr = smin(lowr, ell(P, (0, 0, 18.4), (2.7, 3.3, 2.4)), 1.5)
        if lower_skin:
            lowr = np.maximum(lowr, (z - 10.2) * 1.0)         # shorts: only above the knee
        out.append(lowr * S)
        # ---- 4 shoes
        def shoe(an, sy):
            return capsule(P, an + (-0.5, 0.0, 0.0), an + (3.5, 0.0, -0.9), 1.65, 1.2)
        out.append(np.minimum(shoe(ankL, 1), shoe(ankR, -1)) * S)
        # ---- 5 headwear / hood / extras
        extra = np.full(len(P), 1e3)
        if hat == 'hard':
            dome = ell(P, (0, 0, 37.2), (3.3, 3.1, 2.3))
            dome = np.maximum(dome, (36.3 - z))
            brim = rbox(P, (1.9, 0, 36.7), (3.2, 3.2, 0.35), 0.3)
            extra = np.minimum(dome, brim)
        elif hat == 'cap':
            dome = np.maximum(ell(P, (-0.1, 0, 36.6), (3.15, 2.9, 2.4)), (36.1 - z))
            brim = rbox(P, (3.0, 0, 36.2), (1.8, 2.1, 0.3), 0.25)
            extra = np.minimum(dome, brim)
        if hood is not None:
            hd = smin(ell(P, (-1.0, 0, 34.8), (3.6, 3.4, 4.4)), ell(P, (-2.0, 0, 31.0), (3.0, 4.6, 2.4)), 1.5)
            opening = ell(P, (2.5, 0, 35.0), (2.4, 2.1, 2.5))
            hd = np.maximum(hd, -opening)
            extra = np.minimum(extra, hd)
        out.append(extra * S)
        # ---- 6 mask / face covering
        mk = np.full(len(P), 1e3)
        if mask:
            m = ell(P, (0.7, 0, 34.2), (2.55, 2.25, 2.0))
            mk = np.maximum(m, z - 35.15)
        out.append(mk * S)
        # ---- 7 prop: briefcase / duffel
        pr = np.full(len(P), 1e3)
        if case:
            pr = rbox(P, wrR + (0.3, -0.9, -5.6), (3.0, 0.9, 2.4), 0.5)
            hdl = capsule(P, wrR + (-0.8, -0.2, -2.0), wrR + (-0.8, -0.9, -3.9), 0.25)
            pr = np.minimum(pr, hdl)
        if bag:
            pr = ell(P, (-1.2, shY + 2.1, 17.0), (3.1, 1.9, 3.6))
            strap = capsule(P, shR + (0, 0.4, 0.5), (-0.8, shY + 2.0, 19.8), 0.45)
            strap = np.minimum(strap, capsule(P, shL + (0, -0.2, 0.5), (-0.8, shY + 2.0, 19.8), 0.45))
            pr = np.minimum(pr, strap)
        out.append(pr * S)
        return out

    def skin_mat(p, n):
        P = p / S
        x, y, z = P[:, 0], P[:, 1], P[:, 2]
        base = np.full(len(P), skin_tone)
        ramp = np.full(len(P), RID[skin_ramp])
        face = x > 1.35
        for sgn in (1, -1):
            eye = face & (np.abs(y - sgn * 1.05) < 0.62) & (np.abs(z - 35.45) < 0.5) & (z > 34.9)
            ramp = np.where(eye, RID['asph'], ramp); base = np.where(eye, 0.6, base)
            brow = face & (np.abs(y - sgn * 1.1) < 0.9) & (z > 36.35) & (z < 36.95)
            ramp = np.where(brow, RID[hair[0]], ramp); base = np.where(brow, hair[1] - 0.3, base)
        mouth = face & (np.abs(y) < 0.85) & (np.abs(z - 33.1) < 0.28)
        ramp = np.where(mouth, RID['clay'], ramp); base = np.where(mouth, 1.2, base)
        # a little warmth on the cheeks
        cheek = face & (np.abs(np.abs(y) - 1.5) < 0.5) & (np.abs(z - 34.2) < 0.55)
        base = np.where(cheek, base + 0.25, base)
        return ramp, base, np.zeros(len(P))

    def upper_mat(p, n):
        P = p / S
        x, y, z = P[:, 0], P[:, 1], P[:, 2]
        ramp = np.full(len(P), RID[upper[0]]); base = np.full(len(P), upper[1])
        if tie or shirt:
            vcut = (x > 1.2) & (z > 25.6) & (z < 31.8) & (np.abs(y) < 0.9 + (z - 25.6) * 0.38)
            sr = shirt if shirt else ('white', 3.4)
            ramp = np.where(vcut, RID[sr[0]], ramp); base = np.where(vcut, sr[1], base)
        if tie:
            t = (x > 1.6) & (np.abs(y) < 0.75) & (z > 22.5) & (z < 30.0) & (np.abs(y) < 0.35 + (30.0 - z) * 0.07)
            ramp = np.where(t, RID['red'], ramp); base = np.where(t, 2.4, base)
        if vest:
            vv = (z > 20.5) & (z < 31.2) & (np.abs(y) < 4.4) & (x > -2.4)
            ramp = np.where(vv, RID[vest[0]], ramp); base = np.where(vv, vest[1], base)
            stripe = vv & ((np.abs(z - 23.3) < 0.55) | (np.abs(z - 27.6) < 0.55))
            ramp = np.where(stripe, RID['white'], ramp); base = np.where(stripe, 4.0, base)
        if belt:
            bl = (z > 19.5) & (z < 20.5)
            base = np.where(bl, base - 0.9, base)
        if badge:
            bg = (x > 1.8) & (y < -1.2) & (y > -2.6) & (z > 26.0) & (z < 27.4)
            ramp = np.where(bg, RID['gold'], ramp); base = np.where(bg, 3.8, base)
        return ramp, base, np.where(vest is not None, 0.0, 0.0) + np.zeros(len(P))

    def lower_mat(p, n):
        P = p / S
        z = P[:, 2]
        ramp = np.full(len(P), RID[lower[0]]); base = np.full(len(P), lower[1])
        base = base + (z < 4.0) * -0.3
        return ramp, base, np.zeros(len(P))

    def hair_mat(p, n):
        return np.full(len(p), RID[hair[0]]), np.full(len(p), hair[1]), np.full(len(p), 0.0)

    def extra_mat(p, n):
        if hat == 'hard':
            return np.full(len(p), RID['white']), np.full(len(p), 3.6), np.full(len(p), 0.4)
        if hat == 'cap':
            return np.full(len(p), RID['navy']), np.full(len(p), 1.6), np.zeros(len(p))
        if hood is not None:
            return np.full(len(p), RID[hood[0]]), np.full(len(p), hood[1]), np.zeros(len(p))
        return np.full(len(p), RID['lav']), np.full(len(p), 2.0), np.zeros(len(p))

    def prop_mat(p, n):
        P = p / S
        if case:
            r = np.full(len(p), RID['wood']); b = np.full(len(p), 1.9)
            clasp = (np.abs(P[:, 0] - (wrR[0] + 0.3)) < 0.8) & (P[:, 2] < wrR[2] - 4.4) & (P[:, 2] > wrR[2] - 6.0) & (P[:, 1] < wrR[1] - 1.5)
            r = np.where(clasp, RID['gold'], r); b = np.where(clasp, 4.0, b)
            return r, b, np.zeros(len(p))
        # duffel bag
        r = np.full(len(p), RID['stone']); b = np.full(len(p), 1.7)
        zip_ = (np.abs(P[:, 2] - 19.6) < 0.45)
        r = np.where(zip_, RID['gold'], r); b = np.where(zip_, 3.7, b)
        # gold glimpse at the top opening
        top = (P[:, 2] > 19.0) & (np.abs(P[:, 0] + 1.2) < 1.5) & (P[:, 1] > shY + 1.5)
        r = np.where(top, RID['gold'], r); b = np.where(top, 3.4, b)
        return r, b, np.where(top, 0.8, 0.0)

    mats = [skin_mat, hair_mat, upper_mat, lower_mat, solid(shoes[0], shoes[1]), extra_mat, solid('asph', 1.1), prop_mat]
    bbox = (-6, 8, -10, 10, 0, 40)
    return Model(parts, mats, bbox)


# ------------------------------------------------------------------ costumes
def office_worker(walk=0.0):
    return human(skin_tone=2.7, upper=('teal', 2.1), lower=('blueg', 1.2), shoes=('night', 1.4), hair=('wood', 1.4),
                 tie=True, case=True, jacket=True, walk=walk)


def masked_thief(walk=0.0):
    return human(skin_tone=2.4, upper=('night', 2.5), lower=('blueg', 1.5), shoes=('lav', 1.2), hair=('night', 1.0),
                 mask=True, hood=('night', 2.8), bag=True, hair_style='bald', walk=walk)


def road_worker(walk=0.0):
    return human(skin_tone=2.4, upper=('khaki', 2.0), lower=('wood', 1.6), shoes=('wood', 1.0), hair=('wood', 1.8),
                 hat='hard', vest=('clay', 3.1), hair_style='short', walk=walk)


def civilian_a(walk=0.0):
    return human(skin_tone=3.1, upper=('sage', 2.4), lower=('blueg', 1.8), shoes=('wood', 1.4), hair=('khaki', 2.6),
                 hair_style='long', walk=walk)


def civilian_b(walk=0.0):
    return human(skin_tone=1.7, upper=('plum', 3.0), lower=('lav', 1.4), shoes=('night', 1.4), hair=('night', 0.8),
                 hair_style='bun', walk=walk)


def cop(walk=0.0):
    return human(skin_tone=2.8, upper=('navy', 2.0), lower=('navy', 1.2), shoes=('night', 1.0), hair=('wood', 0.8),
                 hat='cap', badge=True, jacket=True, walk=walk)


COSTUMES = {
    'office_worker': office_worker, 'masked_thief': masked_thief, 'road_worker': road_worker,
    'civilian_a': civilian_a, 'civilian_b': civilian_b, 'police_officer': cop,
}

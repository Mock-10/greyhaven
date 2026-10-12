import numpy as np
from sdf import (Model, ell, capsule, rbox, cyl_z, smin, solid, RID, L, hash3)

S = 1.0   # overall scale: ~36px tall person (≈7.3 heads)


def human(skin_tone=2.6, upper=('lav', 1.6), lower=('night', 1.8), shoes=('night', 1.2),
          hair=('wood', 1.2), hair_style='short', sleeves='long', tie=False, shirt=None, hat=None,
          mask=False, hood=None, vest=None, case=False, bag=False, badge=False, jacket=False,
          belt=True, walk=0.0, lower_skin=False, skin_ramp='skin', pose=None, held=None):
    """Facing +x. Origin at the feet. `walk` in [-1,1] swings legs/arms.

    pose (optional, actions.py): a dict overriding joints after they are computed. Leg keys (hipL/R, kneeL/R,
    ankL/R) are final positions; arm keys (shL/R, elL/R, wrL/R) are in the upright torso frame and bend with it.
    'lean' tips the upper body forward at the hips (the head moves forward by `lean` units), 'crouch' lowers the
    hips and torso by N units (the knees bend forward to keep the leg lengths) and 'head' offsets the head
    (a nod, in the torso frame). held (optional): f(P, joints) -> (distance, material) for a hand-held tool,
    added as an extra part; joints holds the final joints plus dirL/dirR (forearm directions), handL/handR
    (hand centres), 'body' (torso-frame direction -> world) and the pose itself."""
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
    upw = headw = None      # torso-frame / head-frame warps, only for posed models
    crouch = 0.0
    hold_j = None
    arms_posed = False
    if pose is not None or held is not None:
        pz = pose or {}
        jt = dict(kneeL=kneeL, kneeR=kneeR, ankL=ankL, ankR=ankR, hipL=hipL, hipR=hipR,
                  shL=shL, shR=shR, elL=elL, elR=elR, wrL=wrL, wrR=wrR)
        for k in jt:
            if k in pz:
                jt[k] = np.asarray(pz[k], float)
        crouch = float(pz.get('crouch', 0.0))
        th = float(np.arctan2(float(pz.get('lean', 0.0)), 17.0))
        hv = np.asarray(pz.get('head', (0.0, 0.0, 0.0)), float)
        br = float(pz.get('breath', 0.0))
        if br:      # an in-breath: shoulders, arms and head rise a little
            for k, f in (('shL', 1.0), ('shR', 1.0), ('elL', 0.75), ('elR', 0.75), ('wrL', 0.5), ('wrR', 0.5)):
                jt[k] = jt[k] + (0.0, 0.0, br * f)
            hv = hv + (0.0, 0.0, br)
        upw, headw, body = _bend(th, crouch, hv)
        piv = np.array([0.0, 0.0, 19.2])
        for k in ('shL', 'shR', 'elL', 'elR', 'wrL', 'wrR'):
            jt[k] = body(jt[k] - piv) + piv - (0.0, 0.0, crouch)
        for k in ('hipL', 'hipR'):
            if k not in pz:
                jt[k] = jt[k] - (0.0, 0.0, crouch)
        if crouch > 0:
            for s in 'LR':
                if 'knee' + s not in pz:
                    jt['knee' + s] = _knee(jt['hip' + s], jt['ank' + s])
        kneeL, kneeR, ankL, ankR = jt['kneeL'], jt['kneeR'], jt['ankL'], jt['ankR']
        hipL, hipR, shL, shR = jt['hipL'], jt['hipR'], jt['shL'], jt['shR']
        elL, elR, wrL, wrR = jt['elL'], jt['elR'], jt['wrL'], jt['wrR']
        dirL = (wrL - elL) / max(L(wrL - elL), 1e-6); dirR = (wrR - elR) / max(L(wrR - elR), 1e-6)
        hold_j = dict(jt, dirL=dirL, dirR=dirR, handL=wrL + dirL * 1.6, handR=wrR + dirR * 1.6, body=body, pose=pz)
        arms_posed = th != 0 or any(k in pz for k in ('elL', 'elR', 'wrL', 'wrR'))
    pelz = 18.4 - crouch

    def parts(p):
        P = p / S
        x, y, z = P[:, 0], P[:, 1], P[:, 2]
        Pu = P if upw is None else upw(P)
        Ph = Pu if headw is None else headw(Pu)
        out = []
        # ---- 0 skin: head, neck, hands, nose, ears
        head = smin(ell(Ph, (0.1, 0, 35.3), (2.6, 2.3, 2.9)), ell(Ph, (0.6, 0, 33.8), (2.1, 1.9, 2.0)), 1.2)
        neck = capsule(Ph, (0, 0, 31.4), (0.1, 0, 33.6), 1.25, 1.2)
        nose = ell(Ph, (2.8, 0, 34.8), (0.75, 0.55, 0.95))
        ears = np.minimum(ell(Ph, (0, 2.45, 35.0), (0.55, 0.45, 0.95)), ell(Ph, (0, -2.45, 35.0), (0.55, 0.45, 0.95)))
        if not arms_posed:
            handL = ell(P, wrL + (0.3, 0.1, -1.7), (1.0, 0.95, 1.9))
            handR = ell(P, wrR + (0.3, -0.1, -1.7), (1.0, 0.95, 1.9))
        else:   # posed: the hand follows the forearm
            dL, dR = hold_j['dirL'], hold_j['dirR']
            handL = capsule(P, wrL + dL * 0.7, wrL + dL * 2.5, 1.05, 1.0)
            handR = capsule(P, wrR + dR * 0.7, wrR + dR * 2.5, 1.05, 1.0)
        skin = smin(smin(head, neck, 0.8), nose, 0.4)
        skin = np.minimum.reduce([skin, ears, handL, handR])
        if sleeves == 'short':
            skin = np.minimum.reduce([skin, capsule(P, elL, wrL, 1.3, 1.05), capsule(P, elR, wrR, 1.3, 1.05)])
        if lower_skin:
            for kn, an in ((kneeL, ankL), (kneeR, ankR)):
                skin = np.minimum(skin, capsule(P, kn - (0, 0, 0.5), an, 1.78, 1.28))
        out.append(skin * S)
        # ---- 1 hair
        xh, yh, zh = Ph[:, 0], Ph[:, 1], Ph[:, 2]
        cap = ell(Ph, (-0.25, 0, 35.6), (2.8, 2.52, 3.05))
        hl = 35.35 + 0.38 * xh + 0.75 * np.maximum(np.abs(yh) - 1.3, 0)
        hairc = np.maximum(cap, (hl - zh) / 1.2)
        if hair_style == 'long':
            hairc = np.minimum(hairc, smin(ell(Ph, (-2.0, 0, 31.0), (1.5, 2.9, 5.2)), ell(Ph, (-1.8, 0, 35.2), (1.5, 2.7, 2.5)), 1.0))
        elif hair_style == 'bald':
            hairc = hairc + 20
        elif hair_style == 'bun':
            hairc = np.minimum(hairc, ell(Ph, (-2.2, 0, 38.0), (1.4, 1.4, 1.4)))
        out.append(hairc * S)
        # ---- 2 upper body (jacket / shirt)
        pel = ell(Pu, (0, 0, 19.8), (2.75, 3.5, 3.0))
        waist = ell(Pu, (0.0, 0, 23.4), (2.45, 3.1, 3.2))
        chest = ell(Pu, (0.25, 0, 28.0), (2.9, 3.85, 4.0))
        shoulders = capsule(P, shL + (0, -0.3, 0), shR + (0, 0.3, 0), 1.7)
        torso = smin(smin(waist, chest, 2.2), shoulders, 1.6)
        torso = smin(torso, pel, 2.0)
        if jacket:
            torso = smin(torso, ell(Pu, (0, 0, 18.8), (3.0, 4.35, 2.9)), 1.5)
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
        lowr = smin(lowr, ell(P, (0, 0, pelz), (2.7, 3.3, 2.4)), 1.5)
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
            dome = ell(Ph, (0, 0, 37.2), (3.3, 3.1, 2.3))
            dome = np.maximum(dome, (36.3 - zh))
            brim = rbox(Ph, (1.9, 0, 36.7), (3.2, 3.2, 0.35), 0.3)
            extra = np.minimum(dome, brim)
        elif hat == 'cap':
            dome = np.maximum(ell(Ph, (-0.1, 0, 36.6), (3.15, 2.9, 2.4)), (36.1 - zh))
            brim = rbox(Ph, (3.0, 0, 36.2), (1.8, 2.1, 0.3), 0.25)
            extra = np.minimum(dome, brim)
        if hood is not None:
            hd = smin(ell(Ph, (-1.0, 0, 34.8), (3.6, 3.4, 4.4)), ell(Ph, (-2.0, 0, 31.0), (3.0, 4.6, 2.4)), 1.5)
            opening = ell(Ph, (2.5, 0, 35.0), (2.4, 2.1, 2.5))
            hd = np.maximum(hd, -opening)
            extra = np.minimum(extra, hd)
        out.append(extra * S)
        # ---- 6 mask / face covering
        mk = np.full(len(P), 1e3)
        if mask:
            m = ell(Ph, (0.7, 0, 34.2), (2.55, 2.25, 2.0))
            mk = np.maximum(m, zh - 35.15)
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
        if held is not None:
            out.append(held(P, hold_j)[0] * S)
        return out

    def skin_mat(p, n):
        P = p / S
        if upw is not None:
            P = headw(upw(P))
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
        if upw is not None:
            P = upw(P)
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
    if held is not None:
        mats.append(held(np.zeros((1, 3)), hold_j)[1])     # (ramp, base, shine) or callable(p, n)
    if hold_j is not None:
        bbox = (-12, 17, -13, 13, 0, 50)
    return Model(parts, mats, bbox)


def _knee(hip, ank, thigh=8.609, shin=8.110):
    """Two-bone knee in the leg's x-z plane, bending forward (+x)."""
    d = np.array([ank[0] - hip[0], ank[2] - hip[2]])
    n = max(float(np.hypot(*d)), 1e-6)
    if n >= thigh + shin - 1e-3:
        t = thigh / (thigh + shin)
        return hip + (ank - hip) * t
    a = (thigh * thigh - shin * shin + n * n) / (2 * n)
    h = np.sqrt(max(thigh * thigh - a * a, 0.0))
    u = d / n
    v = np.array([-u[1], u[0]])          # perpendicular; pick the forward one
    if v[0] < 0:
        v = -v
    k = np.array([hip[0], hip[2]]) + u * a + v * h
    return np.array([k[0], (hip[1] + ank[1]) / 2, k[1]])


def _bend(th, crouch, hv):
    """Warps for a posed body: torso frame (bent forward by th at the hips, lowered by crouch) and head nod."""
    def body(v):
        v = np.asarray(v, float)
        c, s = np.cos(th), np.sin(th)
        return np.array([v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c])

    def upw(P):
        r = P - (0.0, 0.0, 19.2 - crouch)
        t = np.clip((r[:, 2] + 2.0) / 5.0, 0.0, 1.0)
        a = -th * t * t * (3 - 2 * t)
        c, s = np.cos(a), np.sin(a)
        return np.stack([r[:, 0] * c + r[:, 2] * s, r[:, 1], -r[:, 0] * s + r[:, 2] * c + 19.2], 1)

    def headw(P):
        if not hv.any():
            return P
        t = np.clip((P[:, 2] - 31.0) / 2.5, 0.0, 1.0)
        return P - hv[None, :] * (t * t * (3 - 2 * t))[:, None]

    return upw, headw, body


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

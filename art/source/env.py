"""Buildings, built from rounded boxes with decal windows, real gable roofs and soft shading."""
import numpy as np
from sdf import Model, ell, capsule, rbox, cyl_z, smin, solid, RID, hash3


def _face(n, p):
    """Which visible wall face a surface point is on: returns (is_left, is_right, u) with u the along-wall coord."""
    left = n[:, 1] > 0.55
    right = n[:, 0] > 0.55
    u = np.where(left, p[:, 0], p[:, 1])
    return left, right, u


def _grid(u, z, u0, z0, pw, ww, a, fh, wh, b):
    cu = np.mod(u - u0, pw); cz = np.mod(z - z0, fh)
    win = (cu >= a) & (cu < a + ww) & (cz >= b) & (cz < b + wh)
    return win, cu - a, cz - b, np.floor((u - u0) / pw), np.floor((z - z0) / fh)


def _glass(win, rel_z, wh, lit, ci, fi, ramp, base, seed=0):
    islit = hash3(ci, fi, 3, seed) < lit
    r = np.where(win, np.where(islit, RID['gold'], RID['glass']), ramp)
    t = np.where(win, np.where(islit, 2.5 + 0.7 * (rel_z < wh / 2), 1.1 + 1.5 * np.clip(rel_z / max(wh - 1, 1), 0, 1)), base)
    return r, t


# ------------------------------------------------------------------ office tower
def office_tower(lit=0.0):
    def parts(P):
        pod = rbox(P, (0, 0, 9.0), (28, 28, 9.0), 1.6)
        shaft = rbox(P, (0, 0, 67.0), (23, 23, 48.0), 1.2)
        upper = rbox(P, (0, 0, 126.0), (15.5, 15.5, 11.0), 1.0)
        crown = rbox(P, (0, 0, 138.6), (17, 17, 1.6), 0.7)
        canopy = rbox(P, (0, 30.0, 14.5), (11.5, 5.5, 1.2), 0.5)
        cpil = np.minimum(rbox(P, (-9.5, 33.5, 7.0), (0.8, 0.8, 7.0), 0.3), rbox(P, (9.5, 33.5, 7.0), (0.8, 0.8, 7.0), 0.3))
        ac = np.minimum(rbox(P, (-6, -4, 142.5), (7, 5.5, 2.4), 0.8), rbox(P, (7, 5, 141.6), (4.5, 4, 1.6), 0.6))
        ant = capsule(P, (8, 8, 140), (8, 8, 166), 0.55)
        return [pod, shaft, upper, crown, canopy, cpil, ac, ant]

    def pod_mat(p, n):
        left, right, u = _face(n, p)
        z = p[:, 2]
        ramp = np.full(len(p), RID['stone']); base = np.full(len(p), 2.5)
        win, rz, _, ci, fi = _grid(u, z, -28.0, 0.0, 12.0, 9.0, 2.0, 40.0, 10.0, 2.5)
        win &= (np.abs(u) < 26) & (left | right)
        r, t = _glass(win, rz, 10.0, 0.0, ci, fi, ramp, base)
        # revolving doors with gold handles on the left face
        door = left & (np.abs(p[:, 0]) < 5.2) & (z < 12.5)
        r = np.where(door, RID['glass'], r); t = np.where(door, 1.0 + 0.1 * z, t)
        mull = left & ((np.abs(p[:, 0]) < 0.4) | (np.abs(np.abs(p[:, 0]) - 5.0) < 0.4)) & (z < 12.5)
        r = np.where(mull, RID['lav'], r); t = np.where(mull, 2.0, t)
        hnd = left & ((np.abs(p[:, 0] - 1.2) < 0.4) | (np.abs(p[:, 0] + 1.2) < 0.4)) & (np.abs(z - 6.0) < 1.6)
        r = np.where(hnd, RID['gold'], r); t = np.where(hnd, 4.0, t)
        return r, t, np.where(win, 0.9, 0.0)

    def shaft_mat(p, n):
        left, right, u = _face(n, p)
        z = p[:, 2]
        ramp = np.full(len(p), RID['lavlt']); base = np.full(len(p), 2.5)
        win, rz, _, ci, fi = _grid(u, z, -23.0, 19.0, 8.0, 5.0, 1.5, 12.0, 7.0, 3.0)
        win &= (np.abs(u) < 21.5) & (left | right) & (z > 19.5) & (z < 114.5)
        r, t = _glass(win, rz, 7.0, lit, ci, fi, ramp, base, 5)
        slab = np.abs(np.mod(z - 19.0, 12.0) - 11.5) < 0.6
        t = np.where(~win & slab, t + 0.7, t)
        return r, t, np.where(win, 0.9, 0.0)

    def upper_mat(p, n):
        left, right, u = _face(n, p)
        z = p[:, 2]
        ramp = np.full(len(p), RID['lavlt']); base = np.full(len(p), 2.8)
        win, rz, _, ci, fi = _grid(u, z, -15.5, 115.0, 8.0, 5.0, 1.5, 10.0, 7.0, 2.0)
        win &= (np.abs(u) < 13.5) & (left | right) & (z > 115.5) & (z < 136.5)
        r, t = _glass(win, rz, 7.0, lit, ci, fi, ramp, base, 7)
        return r, t, np.where(win, 0.9, 0.0)

    def ant_mat(p, n):
        tip = p[:, 2] > 163.0
        return np.where(tip, RID['red'], RID['night']), np.where(tip, 3.4, 2.0), np.where(tip, 1.0, 0.0)

    mats = [pod_mat, shaft_mat, upper_mat, solid('stone', 3.1), solid('brick', 2.6), solid('lavlt', 3.6),
            solid('white', 3.3), ant_mat]
    return Model(parts, mats, (-30, 36, -30, 36, 0, 168))


# ------------------------------------------------------------------ corner store
def corner_store():
    def parts(P):
        wall = rbox(P, (0, 0, 15.0), (24, 15, 15.0), 0.9)
        base = rbox(P, (0, 0, 1.2), (24.8, 15.8, 1.2), 0.4)
        cornice = rbox(P, (0, 0, 30.4), (25.2, 16.2, 1.5), 0.6)
        # sloped awning (z falls as it leaves the wall)
        Q = P.copy(); Q[:, 2] = P[:, 2] + 0.34 * (P[:, 1] - 15.0)
        awn = rbox(Q, (0, 20.0, 23.2), (24.5, 5.5, 0.7), 0.4)
        sign = rbox(P, (0, 15.6, 28.2), (17.5, 0.8, 1.8), 0.3)
        roof_ac = np.minimum(rbox(P, (-8, -4, 33.4), (5, 4, 2.2), 0.7), rbox(P, (10, 2, 32.8), (3, 3, 1.5), 0.5))
        return [wall, base, cornice, awn, sign, roof_ac]

    def wall_mat(p, n):
        left, right, u = _face(n, p)
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        N = len(p)
        ramp = np.full(N, RID['brick']); base = np.full(N, 2.3)
        # brick courses
        course = np.floor(z / 1.7)
        off = (np.floor(u / 3.0 + (course % 2) * 0.5))
        h = hash3(off, course, 1, 4)
        base = base + (h - 0.5) * 0.9 + ((np.mod(z, 1.7) < 0.45)) * -0.6
        # display window on the left face
        dw = left & (x > -20) & (x < 7) & (z > 5.0) & (z < 17.5)
        mull = left & (x > -20) & (x < 7) & (((np.mod(x + 20, 9.0) < 0.7)) | (z < 5.8) | (z > 16.8))
        ramp = np.where(dw, RID['glass'], ramp); base = np.where(dw, 1.4 + (z - 5.0) * 0.12, base)
        ramp = np.where(dw & mull, RID['lavlt'], ramp); base = np.where(dw & mull, 2.4, base)
        # goods on display
        for gx, gr, gt in ((-17, 'gold', 3.6), (-12, 'plum', 3.0), (-7, 'sage', 3.0), (-2.5, 'clay', 3.4), (2.5, 'gold', 4.0)):
            g = left & (np.abs(x - gx) < 1.8) & (z > 6.0) & (z < 9.0 + (gx % 3))
            ramp = np.where(g, RID[gr], ramp); base = np.where(g, gt, base)
        # door
        dr = left & (x > 12) & (x < 20.5) & (z < 23)
        ramp = np.where(dr, RID['glass'], ramp); base = np.where(dr, 1.3 + 0.05 * z, base)
        frame = left & (x > 11.2) & (x < 21.3) & (z < 24) & ~dr
        ramp = np.where(frame, RID['lavlt'], ramp); base = np.where(frame, 3.0, base)
        hd = left & (np.abs(x - 18.3) < 0.5) & (np.abs(z - 11.0) < 1.6)
        ramp = np.where(hd, RID['gold'], ramp); base = np.where(hd, 4.0, base)
        # side windows on the right face
        sw = right & (np.abs(np.mod(y + 4.0, 11.0) - 3.0) < 3.0) & (z > 11) & (z < 21) & (np.abs(y) < 12)
        ramp = np.where(sw, RID['glass'], ramp); base = np.where(sw, 1.5 + (z - 11) * 0.12, base)
        return ramp, base, np.where(dw | dr | sw, 0.9, 0.0)

    def awn_mat(p, n):
        stripe = np.floor((p[:, 0] + 30) / 3.0) % 2 == 0
        return np.where(stripe, RID['red'], RID['white']), np.where(stripe, 2.6, 3.4), np.zeros(len(p))

    def sign_mat(p, n):
        x = p[:, 0]
        letters = (np.mod(x + 40, 3.0) < 1.7) & (np.abs(p[:, 2] - 28.2) < 0.9) & (n[:, 1] > 0.5)
        return np.where(letters, RID['gold'], RID['stone']), np.where(letters, 3.9, 2.4), np.where(letters, 0.6, 0.0)

    mats = [wall_mat, solid('stone', 2.2), solid('stone', 3.2), awn_mat, sign_mat, solid('white', 3.0)]
    return Model(parts, mats, (-26, 26, -17, 28, 0, 36))


# ------------------------------------------------------------------ house
def house(roof=('brick', 2.5)):
    SL = 0.78     # roof slope
    HR = 15.0     # ridge height above eaves

    def parts(P):
        x, y, z = P[:, 0], P[:, 1], P[:, 2]
        walls = rbox(P, (0, 0, 8.5), (21, 14, 8.5), 0.7)
        # gable roof along x
        slope = (z - (17.0 + HR - SL * np.abs(y) * 1.0)) / np.sqrt(1 + SL * SL)
        roofd = np.maximum(np.maximum(slope, 16.4 - z), np.abs(x) - 24.0)
        roofd = np.maximum(roofd, np.abs(y) - 18.5)
        chim = rbox(P, (10.0, -6.0, 26.0), (2.8, 2.8, 8.0), 0.4)
        chimcap = rbox(P, (10.0, -6.0, 34.3), (3.4, 3.4, 0.7), 0.3)
        porch = rbox(P, (-4.0, 18.0, 1.2), (7.5, 4.0, 1.2), 0.4)
        ppost = np.minimum(rbox(P, (-10.5, 21.2, 8.0), (0.6, 0.6, 6.8), 0.2), rbox(P, (2.5, 21.2, 8.0), (0.6, 0.6, 6.8), 0.2))
        proof = rbox(P, (-4.0, 18.5, 15.2), (8.5, 4.6, 0.7), 0.4)
        return [walls, roofd, chim, chimcap, porch, ppost, proof]

    def wall_mat(p, n):
        left, right, u = _face(n, p)
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        N = len(p)
        ramp = np.full(N, RID['stone']); base = np.full(N, 2.9)
        board = np.mod(z, 2.0) < 0.5
        base = np.where(board, base - 0.5, base)
        # windows on the left face
        for wx in (-15.0, 8.0):
            w = left & (np.abs(x - wx) < 4.2) & (z > 6.0) & (z < 13.5)
            ramp = np.where(w, RID['glass'], ramp); base = np.where(w, 1.3 + (z - 6) * 0.14, base)
            fr = left & (np.abs(x - wx) < 5.0) & (z > 5.3) & (z < 14.2) & ~w
            ramp = np.where(fr, RID['white'], ramp); base = np.where(fr, 3.6, base)
            cross = w & (np.abs(x - wx) < 0.3)
            ramp = np.where(cross, RID['white'], ramp); base = np.where(cross, 3.6, base)
        door = left & (np.abs(x + 4.0) < 3.0) & (z < 12.5)
        ramp = np.where(door, RID['brick'], ramp); base = np.where(door, 1.9 + z * 0.05, base)
        knob = left & (np.abs(x + 2.0) < 0.5) & (np.abs(z - 6.0) < 0.6)
        ramp = np.where(knob, RID['gold'], ramp); base = np.where(knob, 4.2, base)
        # gable end window (right face)
        gw = right & (np.abs(y - 3.0) < 3.8) & (z > 6.0) & (z < 13.0)
        ramp = np.where(gw, RID['glass'], ramp); base = np.where(gw, 1.3 + (z - 6) * 0.14, base)
        gfr = right & (np.abs(y - 3.0) < 4.6) & (z > 5.4) & (z < 13.8) & ~gw
        ramp = np.where(gfr, RID['white'], ramp); base = np.where(gfr, 3.6, base)
        return ramp, base, np.where(left & (ramp == RID['glass']) | gw, 0.8, 0.0)

    def roof_mat(p, n):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        row = np.floor((z + np.abs(y) * 0.0) / 1.2 + np.abs(y) * 0.3)
        sh = hash3(np.floor(x / 2.2 + (row % 2) * 0.5), row, 2, 11)
        base = roof[1] + (sh - 0.5) * 1.1 + (np.mod(z + np.abs(y) * 0.78, 1.5) < 0.4) * -0.5
        ridge = (z > 17 + HR - SL * np.abs(y) - 0.7) & (np.abs(y) < 1.4)
        base = np.where(ridge, base + 0.8, base)
        return np.full(len(p), RID[roof[0]]), base, np.zeros(len(p))

    def chim_mat(p, n):
        z = p[:, 2]
        brick = hash3(np.floor(p[:, 0] / 1.8), np.floor(z / 1.1), 4, 3)
        return np.full(len(p), RID['brick']), 2.2 + (brick - 0.5) * 0.9 + (np.mod(z, 1.1) < 0.3) * -0.5, np.zeros(len(p))

    mats = [wall_mat, roof_mat, chim_mat, solid('stone', 3.2), solid('wood', 2.2), solid('white', 3.3), roof_mat]
    return Model(parts, mats, (-26, 26, -20, 24, 0, 40))


# ------------------------------------------------------------------ warehouse
def warehouse():
    def parts(P):
        x, y, z = P[:, 0], P[:, 1], P[:, 2]
        walls = rbox(P, (0, 0, 13.5), (33, 22, 13.5), 0.6)
        slope = (z - (27.0 + 7.0 - 0.34 * np.abs(y))) / 1.06
        roofd = np.maximum(np.maximum(slope, 26.4 - z), np.maximum(np.abs(x) - 34.4, np.abs(y) - 23.5))
        base = rbox(P, (0, 0, 1.5), (33.6, 22.6, 1.5), 0.4)
        sky = np.minimum.reduce([rbox(P, (sx, 0, 33.6), (4.5, 7.0, 0.5), 0.2) for sx in (-20, 0, 20)])
        pipe = capsule(P, (33.8, -12, 1), (33.8, -12, 27), 0.9)
        lamp = rbox(P, (-24, 22.6, 18.5), (1.1, 1.3, 1.1), 0.4)
        return [walls, roofd, base, sky, pipe, lamp]

    def wall_mat(p, n):
        left, right, u = _face(n, p)
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        N = len(p)
        ramp = np.full(N, RID['blueg']); base = np.full(N, 2.2)
        corr = np.mod(u, 2.4) < 1.2
        base = np.where(corr, base + 0.55, base - 0.25)
        base = base + (z < 4) * -0.5 + (z > 24) * 0.2
        # rust streaks
        rs = hash3(np.floor(u / 3.0), 0, 5, 9) > 0.78
        ramp = np.where(rs & (z > 9) & (z < 25) & (hash3(np.floor(u), np.floor(z / 4), 2, 5) > 0.55), RID['clay'], ramp)
        # roller door
        dr = left & (x > -10) & (x < 10) & (z < 20)
        ramp = np.where(dr, RID['lavlt'], ramp); base = np.where(dr, 1.4 + (np.mod(z, 2.0) < 1.0) * 0.5 + z * 0.03, base)
        fr = left & (x > -11.4) & (x < 11.4) & (z < 21.4) & ~dr
        ramp = np.where(fr, RID['gold'], ramp); base = np.where(fr, 2.7, base)
        # side door + lamp
        sd = left & (x < -20) & (x > -25.5) & (z < 15.5)
        ramp = np.where(sd, RID['night'], ramp); base = np.where(sd, 1.8, base)
        sdk = left & (np.abs(x + 22.0) < 0.5) & (np.abs(z - 7.5) < 0.6)
        ramp = np.where(sdk, RID['gold'], ramp); base = np.where(sdk, 4.0, base)
        # painted number
        for i in range(3):
            nb = left & (np.abs(x - (16.5 + i * 4)) < 1.2) & (z > 11) & (z < 17)
            ramp = np.where(nb, RID['white'], ramp); base = np.where(nb, 4.2, base)
        # vents (right face)
        vt = right & (np.abs(np.mod(y + 14.0, 12.0) - 4.0) < 3.0) & (z > 15) & (z < 21) & (np.abs(y) < 16)
        ramp = np.where(vt, RID['night'], ramp); base = np.where(vt, 1.0 + (np.mod(z, 1.6) < 0.8) * 0.9, base)
        return ramp, base, np.zeros(N)

    def roof_mat(p, n):
        x, y = p[:, 0], p[:, 1]
        seam = np.mod(np.abs(y), 3.2) < 0.45
        return np.full(len(p), RID['lav']), 2.3 + seam * -0.8 + hash3(np.floor(x / 3), np.floor(y / 3), 1, 2) * 0.5, np.zeros(len(p))

    def sky_mat(p, n):
        return np.full(len(p), RID['glass']), np.full(len(p), 3.0), np.full(len(p), 1.0)

    def lamp_mat(p, n):
        return np.full(len(p), RID['gold']), np.full(len(p), 4.6), np.full(len(p), 0.6)

    mats = [wall_mat, roof_mat, solid('stone', 2.2), sky_mat, solid('clay', 2.0), lamp_mat]
    return Model(parts, mats, (-36, 36, -24, 26, 0, 40))


# ------------------------------------------------------------------ shipping container
def container(color='brick', base_t=2.3):
    def parts(P):
        return [rbox(P, (0, 0, 9.5), (23, 9.2, 9.5), 0.7)]

    def mat(p, n):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        left = n[:, 1] > 0.55; right = n[:, 0] > 0.55
        rib = np.mod(x + 40, 2.6) < 1.1
        base = np.full(len(p), base_t) + np.where(left, np.where(rib, 0.35, -0.35), 0.0)
        base = base + hash3(np.floor(x), np.floor(z / 2), 3, 7) * 0.5 - 0.25
        base = np.where(z < 1.4, base - 0.8, base)
        ramp = np.full(len(p), RID[color])
        # end doors on +x face
        rod = right & (np.abs(np.mod(y + 9.0, 4.6) - 2.3) < 0.35) & (z > 1.5) & (z < 17.5)
        ramp = np.where(rod, RID['lavlt'], ramp); base = np.where(rod, 3.4, base)
        lock = right & (np.abs(y) < 0.8) & (np.abs(z - 8.5) < 1.6)
        ramp = np.where(lock, RID['gold'], ramp); base = np.where(lock, 3.8, base)
        return ramp, base, np.zeros(len(p))

    return Model(parts, [mat], (-24, 24, -10, 10, 0, 20))


BUILDINGS = {
    'office_tower': lambda: office_tower(0.0),
    'office_tower_night': lambda: office_tower(0.32),
    'corner_store': corner_store,
    'house_brick': lambda: house(('brick', 2.5)),
    'house_slate': lambda: house(('blueg', 1.9)),
    'warehouse': warehouse,
    'container_brick': lambda: container('brick', 2.3),
    'container_teal': lambda: container('teal', 2.4),
    'container_khaki': lambda: container('khaki', 2.5),
}

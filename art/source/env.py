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
def office_tower(lit=0.0, name=None):
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

    def canopy_mat(p, n):
        if not name:
            return np.full(len(p), RID['brick']), np.full(len(p), 2.6), np.zeros(len(p))
        front = n[:, 1] > 0.5
        txt = front & sign_text(p[:, 0], p[:, 2], name, 0.0, 14.5)
        return np.where(txt, RID['white'], RID['brick']), np.where(txt, 4.6, 2.6), np.zeros(len(p))

    mats = [pod_mat, shaft_mat, upper_mat, solid('stone', 3.1), canopy_mat, solid('lavlt', 3.6),
            solid('white', 3.3), ant_mat]
    return Model(parts, mats, (-30, 36, -30, 36, 0, 168))


# ------------------------------------------------------------------ corner store
def corner_store(name=None, lit=0.0):
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
        ramp = np.where(dw, RID['gold'] if lit > 0 else RID['glass'], ramp); base = np.where(dw, 3.0 if lit > 0 else 1.4 + (z - 5.0) * 0.12, base)
        ramp = np.where(dw & mull, RID['lavlt'], ramp); base = np.where(dw & mull, 2.4, base)
        # goods on display
        for gx, gr, gt in ((-17, 'gold', 3.6), (-12, 'plum', 3.0), (-7, 'sage', 3.0), (-2.5, 'clay', 3.4), (2.5, 'gold', 4.0)):
            g = left & (np.abs(x - gx) < 1.8) & (z > 6.0) & (z < 9.0 + (gx % 3))
            ramp = np.where(g, RID[gr], ramp); base = np.where(g, gt, base)
        # door
        dr = left & (x > 12) & (x < 20.5) & (z < 23)
        ramp = np.where(dr, RID['gold'] if lit > 0 else RID['glass'], ramp); base = np.where(dr, 2.6 if lit > 0 else 1.3 + 0.05 * z, base)
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
        if name:
            txt = (n[:, 1] > 0.5) & sign_text(x, p[:, 2], name, 0.0, 28.2)
            return np.where(txt, RID['red'], RID['stone']), np.where(txt, 2.8, 3.4), np.zeros(len(p))
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


# ------------------------------------------------------------------ Phase 1: signs, bar, chop shop, apartment block
from pixfont import text_px as _text_px

# One font pixel in model units. Buildings render at BLD_SCALE 2.6, so this is about one screen pixel.
SIGN_PX = 1.0 / 2.6


def sign_text(u, z, text, u_center, z_center, px=SIGN_PX, scale=1):
    """Mask of the 3x5 pixel font laid out along a wall: u runs along the wall, z is height."""
    m = _text_px(text)
    if scale > 1:
        m = np.kron(m, np.ones((scale, scale), bool))
    h, w = m.shape
    col = np.floor((u - u_center) / px + w / 2).astype(int)
    row = np.floor((z_center - z) / px + h / 2).astype(int)
    ok = (col >= 0) & (col < w) & (row >= 0) & (row < h)
    out = np.zeros(len(u), bool)
    out[ok] = m[row[ok], col[ok]]
    return out


def bar_building(lit=0.0):
    """The Low Tide: a one-storey dark-brick pub with wood panelling, arched windows and a teal sign board."""
    def parts(P):
        wall = rbox(P, (0, 0, 13.0), (22, 15, 13.0), 0.8)
        base = rbox(P, (0, 0, 1.0), (22.6, 15.6, 1.0), 0.4)
        parapet = rbox(P, (0, 0, 26.8), (22.8, 15.8, 1.2), 0.5)
        board = rbox(P, (-4, 15.8, 21.4), (13.5, 0.7, 2.2), 0.3)
        lamp = rbox(P, (13.5, 16.0, 19.6), (0.9, 1.0, 0.9), 0.3)
        ac = np.minimum(rbox(P, (-10, -5, 29.6), (4, 3.5, 1.8), 0.6), rbox(P, (9, 4, 29.2), (2.6, 2.6, 1.4), 0.5))
        bin_ = rbox(P, (23.5, -9, 4), (1.6, 3, 4), 0.5)
        return [wall, base, parapet, board, lamp, ac, bin_]

    def wall_mat(p, n):
        left, right, u = _face(n, p)
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        N = len(p)
        ramp = np.full(N, RID['brick']); base = np.full(N, 1.8)
        course = np.floor(z / 1.6)
        h = hash3(np.floor(u / 2.8 + (course % 2) * 0.5), course, 1, 6)
        base = base + (h - 0.5) * 0.8 + (np.mod(z, 1.6) < 0.4) * -0.5
        # wood panelling below the windows on the front
        panel = left & (z < 6.5)
        ramp = np.where(panel, RID['wood'], ramp); base = np.where(panel, 1.6 + (np.mod(x + 40, 4.0) < 0.5) * -0.6, base)
        # two arched windows on the front, warm when lit
        win = np.zeros(N, bool)
        for cx in (-15.0, -3.0):
            arch = (np.abs(x - cx) < 4.2) & (z > 7) & ((z < 15) | ((x - cx) ** 2 + (z - 15) ** 2 < 4.2 ** 2))
            win |= left & arch
        mull = win & ((np.abs(np.mod(x + 40, 12.0) - 7.0) < 0.35) | (np.abs(z - 12.0) < 0.35))
        glow = hash3(np.floor(x / 4), 1, 1, 3) < lit
        ramp = np.where(win, np.where(glow, RID['gold'], RID['glass']), ramp)
        base = np.where(win, np.where(glow, 3.0, 1.2 + (z - 7) * 0.1), base)
        ramp = np.where(mull, RID['wood'], ramp); base = np.where(mull, 1.6, base)
        # door with a small round window
        dr = left & (x > 9.5) & (x < 16.5) & (z < 17)
        ramp = np.where(dr, RID['wood'], ramp); base = np.where(dr, 1.4 + (np.abs(x - 13) > 2.4) * 0.4, base)
        porth = dr & ((x - 13) ** 2 + (z - 12.5) ** 2 < 1.6 ** 2)
        ramp = np.where(porth, np.where(lit > 0, RID['gold'], RID['glass']), ramp); base = np.where(porth, 3.0, base)
        knob = left & (np.abs(x - 15.4) < 0.45) & (np.abs(z - 8) < 0.6)
        ramp = np.where(knob, RID['gold'], ramp); base = np.where(knob, 4.2, base)
        # side windows (right face)
        sw = right & (np.abs(np.mod(y + 30, 10.0) - 5.0) < 2.4) & (z > 9) & (z < 17) & (np.abs(y) < 12)
        sglow = hash3(np.floor((y + 30) / 10), 2, 1, 4) < lit * 0.8
        ramp = np.where(sw, np.where(sglow, RID['gold'], RID['glass']), ramp); base = np.where(sw, np.where(sglow, 2.8, 1.4), base)
        return ramp, base, np.where(win | sw, 0.9, 0.0)

    def board_mat(p, n):
        front = n[:, 1] > 0.5
        txt = front & sign_text(p[:, 0], p[:, 2], 'THE LOW TIDE', -4.0, 21.4, scale=1)
        rim = front & ((np.abs(p[:, 0] + 4) > 12.8) | (np.abs(p[:, 2] - 21.4) > 1.7))
        ramp = np.where(txt, RID['teal'], np.where(rim, RID['teal'], RID['night']))
        return ramp, np.where(txt, 4.9, np.where(rim, 3.0, 1.4)), np.zeros(len(p))

    def lamp_mat(p, n):
        return np.full(len(p), RID['gold']), np.full(len(p), 4.6 if lit > 0 else 3.2), np.full(len(p), 0.6)

    mats = [wall_mat, solid('stone', 2.0), solid('wood', 2.2), board_mat, lamp_mat, solid('lavlt', 3.0), solid('sage', 1.8)]
    return Model(parts, mats, (-24, 26, -17, 18, 0, 32))


def chop_shop(lit=0.0):
    """Marlo's Tow & Salvage: a rusty corrugated garage with an open roller door and a roof sign board."""
    def parts(P):
        x, y, z = P[:, 0], P[:, 1], P[:, 2]
        walls = rbox(P, (0, 0, 12.0), (28, 19, 12.0), 0.6)
        roof = rbox(P, (0, 0, 24.6), (29, 20, 0.8), 0.4)
        base = rbox(P, (0, 0, 1.2), (28.6, 19.6, 1.2), 0.4)
        posts = np.minimum(rbox(P, (-16, 15, 29), (0.6, 0.6, 5), 0.2), rbox(P, (16, 15, 29), (0.6, 0.6, 5), 0.2))
        board = rbox(P, (0, 15.4, 31.5), (20, 0.7, 3.0), 0.3)
        sign2 = rbox(P, (28.8, 2, 16), (0.6, 13, 2.4), 0.3)
        lamp = rbox(P, (-22, 19.8, 17), (1.0, 1.0, 1.0), 0.3)
        tyres = np.minimum.reduce([np.maximum(np.abs(np.hypot(x - 30.5, y + 12 + k * 0.0) - 2.2) - 0.9, np.abs(z - 1.0 - k * 1.9) - 0.9) for k in range(3)])
        return [walls, roof, base, posts, board, sign2, lamp, tyres]

    def wall_mat(p, n):
        left, right, u = _face(n, p)
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        N = len(p)
        ramp = np.full(N, RID['teal']); base = np.full(N, 1.9)
        corr = np.mod(u, 2.4) < 1.2
        base = np.where(corr, base + 0.5, base - 0.3)
        streak = hash3(np.floor(u / 1.2), 0, 2, 13)
        rust = (streak > 0.82) & (z < 4 + 14 * hash3(np.floor(u / 1.2), 1, 2, 7)) | ((z < 3.5) & (hash3(np.floor(u / 2), 2, 2, 5) > 0.5))
        ramp = np.where(rust, RID['clay'], ramp); base = np.where(rust, 1.6 + corr * 0.4, base)
        # open roller door: dark interior, half-raised door slats at the top, hazard stripes on the posts
        dr = left & (x > -18) & (x < 6) & (z < 18)
        slats = dr & (z > 13)
        ramp = np.where(dr, RID['night'], ramp); base = np.where(dr, 0.8 + (z < 2) * 0.6, base)
        ramp = np.where(slats, RID['lavlt'], ramp); base = np.where(slats, 1.6 + (np.mod(z, 1.6) < 0.8) * 0.6, base)
        haz = left & (((x > -19.6) & (x < -18)) | ((x > 6) & (x < 7.6))) & (z < 18)
        hs = np.mod(z + np.where(x < 0, 0, 1.5), 3.0) < 1.5
        ramp = np.where(haz, np.where(hs, RID['red'], RID['white']), ramp); base = np.where(haz, np.where(hs, 2.6, 4.0), base)
        # office door + window on the front
        od = left & (x > 13) & (x < 18.5) & (z < 15)
        ramp = np.where(od, RID['night'], ramp); base = np.where(od, 1.8, base)
        ow = left & (x > 20.5) & (x < 26) & (z > 8) & (z < 15)
        oglow = lit > 0
        ramp = np.where(ow, RID['gold'] if oglow else RID['glass'], ramp); base = np.where(ow, 2.8 if oglow else 1.4, base)
        knob = left & (np.abs(x - 17.4) < 0.45) & (np.abs(z - 7.5) < 0.6)
        ramp = np.where(knob, RID['gold'], ramp); base = np.where(knob, 4.0, base)
        return ramp, base, np.zeros(N)

    def board_mat(p, n):
        front = n[:, 1] > 0.5
        t1 = front & sign_text(p[:, 0], p[:, 2], "MARLO'S TOW", 0.0, 32.9)
        t2 = front & sign_text(p[:, 0], p[:, 2], '& SALVAGE', 0.0, 30.1)
        txt = t1 | t2
        rim = front & ((np.abs(p[:, 0]) > 19.3) | (np.abs(p[:, 2] - 31.5) > 2.5))
        return np.where(txt, RID['white'], np.where(rim, RID['red'], RID['navy'])), np.where(txt, 4.8, np.where(rim, 2.6, 1.6)), np.zeros(len(p))

    def sign2_mat(p, n):
        side = n[:, 0] > 0.5
        # on a +x face, screen left-to-right runs along -y
        txt = side & sign_text(-p[:, 1], p[:, 2], 'WE BUY ANY CAR*', -2.0, 16.0)
        return np.where(txt, RID['red'], RID['white']), np.where(txt, 2.8, 4.2), np.zeros(len(p))

    def lamp_mat(p, n):
        return np.full(len(p), RID['gold']), np.full(len(p), 4.6 if lit > 0 else 3.0), np.full(len(p), 0.6)

    mats = [wall_mat, solid('lav', 2.2), solid('stone', 1.9), solid('night', 1.8), board_mat, sign2_mat, lamp_mat, solid('night', 1.6)]
    return Model(parts, mats, (-30, 34, -21, 21, 0, 36))


def apartment_block(lit=0.0):
    """Drizzle Row Residences: a five-storey stone and brick block with balconies, an entrance canopy and a fire escape."""
    H = 62.0

    def parts(P):
        body = rbox(P, (0, 0, H / 2), (24, 17, H / 2), 0.9)
        base = rbox(P, (0, 0, 2.0), (24.8, 17.8, 2.0), 0.5)
        cornice = rbox(P, (0, 0, H + 0.8), (25, 18, 1.2), 0.5)
        canopy = rbox(P, (-6, 20.5, 13.5), (10, 3.6, 0.9), 0.4)
        cposts = np.minimum(rbox(P, (-15, 23.4, 6.5), (0.5, 0.5, 6.5), 0.2), rbox(P, (3, 23.4, 6.5), (0.5, 0.5, 6.5), 0.2))
        balc = np.full(len(P), 1e3)
        for fz in (24.0, 36.0, 48.0):
            for bx in (-16.0, 10.0):
                balc = np.minimum(balc, rbox(P, (bx, 18.6, fz), (4.6, 1.8, 0.5), 0.2))
                rail = np.maximum(rbox(P, (bx, 20.2, fz + 2.6), (4.6, 0.25, 2.2), 0.1), -rbox(P, (bx, 20.2, fz + 2.6), (4.2, 1, 1.8), 0.05))
                balc = np.minimum(balc, rail)
        fire = np.full(len(P), 1e3)
        for fz in (14.0, 26.0, 38.0, 50.0):
            fire = np.minimum(fire, rbox(P, (25.2, -4, fz), (1.4, 6, 0.4), 0.1))
            fire = np.minimum(fire, capsule(P, (26.4, -9.5, fz), (26.4, 1.5, fz + 12), 0.35))
        roof = np.minimum(rbox(P, (-10, -6, H + 3.4), (4.5, 4, 2.2), 0.7), cyl_z(P, (12, 4, H + 5), 3.2, 3.6, 0.6))
        return [body, base, cornice, canopy, cposts, balc, fire, roof]

    def body_mat(p, n):
        left, right, u = _face(n, p)
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        N = len(p)
        ramp = np.full(N, RID['clay']); base = np.full(N, 2.3)
        course = np.floor(z / 1.5)
        hb = hash3(np.floor(u / 2.6 + (course % 2) * 0.5), course, 1, 8)
        base = base + (hb - 0.5) * 0.7 + (np.mod(z, 1.5) < 0.35) * -0.5
        ground = z < 12.5
        ramp = np.where(ground, RID['stone'], ramp); base = np.where(ground, 2.4 + (np.mod(z, 3.0) < 0.3) * -0.6, base)
        slab = (np.abs(np.mod(z - 12.0, 12.0)) < 0.7) & (z > 11)
        ramp = np.where(slab & ~ground, RID['stone'], ramp); base = np.where(slab & ~ground, 2.8, base)
        win, rz, _, ci, fi = _grid(u, z, -24.0, 12.0, 6.5, 3.8, 1.3, 12.0, 7.0, 2.5)
        win &= (left | right) & (z > 12.5) & (z < H - 1) & (np.abs(u) < 22)
        r, t = _glass(win, rz, 7.0, lit, ci, fi, ramp, base, 11)
        sill = (left | right) & (np.abs(np.mod(u + 24.0 - 1.3, 6.5) - 1.9) < 2.3) & (np.abs(np.mod(z - 12.0, 12.0) - 2.2) < 0.4) & (z > 12.5) & (np.abs(u) < 22)
        r = np.where(sill, RID['stone'], r); t = np.where(sill, 3.2, t)
        # ground floor: entrance doors under the canopy, shop-like windows either side
        door = left & (np.abs(x + 6) < 4.0) & (z < 11)
        r = np.where(door, RID['glass'], r); t = np.where(door, 1.2 + 0.08 * z, t)
        dm = door & ((np.abs(x + 6) < 0.35) | (z > 10.3))
        r = np.where(dm, RID['wood'], r); t = np.where(dm, 1.8, t)
        gw = (left | right) & ~door & (np.abs(np.mod(u + 24, 10.0) - 5.0) < 3.0) & (z > 3.5) & (z < 9.5) & (np.abs(u) < 21) & ~(left & (np.abs(x + 6) < 6))
        r = np.where(gw, RID['glass'], r); t = np.where(gw, 1.3, t)
        return r, t, np.where(win | door | gw, 0.9, 0.0)

    def canopy_mat(p, n):
        front = n[:, 1] > 0.5
        txt = front & sign_text(p[:, 0], p[:, 2], 'DRIZZLE ROW', -6.0, 13.5)
        return np.where(txt, RID['white'], RID['navy']), np.where(txt, 4.6, 2.2), np.zeros(len(p))

    mats = [body_mat, solid('stone', 2.0), solid('stone', 3.0), canopy_mat, solid('night', 2.0), solid('night', 1.9),
            solid('night', 1.7), solid('lavlt', 2.8)]
    return Model(parts, mats, (-26, 28, -19, 25, 0, H + 10))


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
    'bar': lambda: bar_building(0.0),
    'bar_night': lambda: bar_building(1.0),
    'chop_shop': lambda: chop_shop(0.0),
    'chop_shop_night': lambda: chop_shop(1.0),
    'apartment_block': lambda: apartment_block(0.0),
    'apartment_block_night': lambda: apartment_block(0.4),
    'pellridge_tower': lambda: office_tower(0.0, 'PELLRIDGE'),
    'pellridge_tower_night': lambda: office_tower(0.32, 'PELLRIDGE'),
    'open_most_hours': lambda: corner_store('OPEN MOST HOURS'),
    'open_most_hours_night': lambda: corner_store('OPEN MOST HOURS', 1.0),
}

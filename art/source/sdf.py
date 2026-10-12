"""Smooth-form isometric pixel renderer.

Objects are signed-distance models (capsules, ellipsoids, rounded boxes ...) ray-marched
with a 2:1 isometric orthographic camera, shaded with a light direction, then snapped to
palette ramps with ordered dithering so gradients look hand-pixeled instead of voxel-blocky.

World axes: +x = down-right on screen, +y = down-left, +z = up.
Screen:  X = x - y ,  Y = (x + y)/2 - z       (a 32x32 footprint = one 64x32 tile)
"""
import numpy as np
from PIL import Image

SQ3 = np.sqrt(3.0)


def H(s):
    s = s.lstrip('#')
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


# ---------------------------------------------------------------------------
# PALETTE. The 20 swatches of Grey Weather are used exactly; every ramp below is
# anchored on them (marked *). Extra tints exist only to give highlights/shadows and
# one muted gold accent reserved for valuables + interactables.
#   lavender: bcafb6* a8a0aa* 928d9a* 7d7688* 695a75* 503f58* 3e3042* 2d222e*
#   blue-grey: 989ea1* 768c9c* 636e94* 515670* 40414e*
#   earth:    b1a599* a09b72* 758672* 57646e* a67c6a* 98585b* 6f3c50*
# ---------------------------------------------------------------------------
RAMP_HEX = {
    'lav':    ['2d222e', '3e3042', '503f58', '695a75', '7d7688', '928d9a'],
    'lavlt':  ['503f58', '695a75', '7d7688', '928d9a', 'a8a0aa', 'bcafb6'],
    'blueg':  ['40414e', '515670', '636e94', '768c9c', '989ea1', 'bcc3c4'],
    'stone':  ['5d5560', '7d7378', '988d8b', 'b1a599', 'c9bfb0', 'ded6c8'],
    'khaki':  ['4a4a38', '666747', '838459', 'a09b72', 'b9b48c', 'd2cca6'],
    'sage':   ['38453f', '4c5d52', '627462', '758672', '93a387', 'b3c0a3'],
    'teal':   ['2f3a44', '40505b', '57646e', '70838b', '8c9ea4', 'adbcc0'],
    'clay':   ['5d3c3a', '7d5249', 'a67c6a', 'bb9381', 'cfae9b', 'e2cab9'],
    'brick':  ['3f2536', '5a3046', '6f3c50', '98585b', 'b3726c', 'cc9084'],
    'plum':   ['2d222e', '3e3042', '503f58', '6f3c50', '8b4d63', 'a86a7c'],
    'gold':   ['6f5326', '946f2e', 'b98f3a', 'd8b45a', 'efd486', 'fbeab8'],
    'night':  ['241b28', '2d222e', '3a2e40', '483b50', '564a60', '655a70'],
    'wood':   ['3a2c2c', '523e3a', '6f5748', '8d7360', 'a98f78', 'c4ab92'],
    'skin':   ['6a4540', '8a5f55', 'a67c6a', 'c49a84', 'dab6a0', 'ecd0bf'],
    'white':  ['7d7688', '928d9a', 'a8a0aa', 'bcb4bc', 'd6cfd3', 'eee9e8'],
    'glass':  ['2d3248', '3d4768', '556489', '768caf', '9db0c9', 'c4d2de'],
    'red':    ['4e2736', '6f3545', '98454f', 'b95e5e', 'd08478', 'e5b0a2'],
    'navy':   ['262a40', '353c5e', '485682', '5e72a0', '8195c0', 'adbbdb'],
    'asph':   ['2d222e', '362c39', '423844', '504754', '605764', '726975'],
    # Marker ramps for palette-swapped player sprites (docs/11 character creator, pack_player.py). Never shipped
    # as colours: the game recolours each marker tone to the chosen skin, hair or outfit ramp at load.
    'mk_skin': ['ff0000', 'ff0028', 'ff0050', 'ff0078', 'ff00a0', 'ff00c8'],
    'mk_hair': ['00ff00', '00ff28', '00ff50', '00ff78', '00ffa0', '00ffc8'],
    'mk_top':  ['0000ff', '2800ff', '5000ff', '7800ff', 'a000ff', 'c800ff'],
    'mk_bot':  ['ff00ff', 'ff28ff', 'ff50ff', 'ff78ff', 'ffa0ff', 'ffc8ff'],
}
RAMP_ORDER = list(RAMP_HEX.keys())
RID = {n: i + 1 for i, n in enumerate(RAMP_ORDER)}
RAMP_RGB = np.zeros((len(RAMP_ORDER) + 1, 6, 3), np.uint8)
for n, i in RID.items():
    RAMP_RGB[i] = [H(c) for c in RAMP_HEX[n]]

BAYER = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) + 0.5) / 16.0


# ---------------------------------------------------------------- SDF primitives
def L(a):
    return np.sqrt((a * a).sum(-1))


def ell(p, c, r):
    r = np.asarray(r, float)
    q = (p - np.asarray(c, float)) / r
    k0 = L(q)
    k1 = L(q / r)
    return np.where(k1 > 1e-6, k0 * (k0 - 1.0) / np.maximum(k1, 1e-6), -r.min())


def capsule(p, a, b, r1, r2=None):
    r2 = r1 if r2 is None else r2
    a = np.asarray(a, float); b = np.asarray(b, float)
    pa = p - a; ba = b - a
    h = np.clip((pa @ ba) / (ba @ ba), 0.0, 1.0)
    return L(pa - ba[None, :] * h[:, None]) - (r1 + (r2 - r1) * h)


def rbox(p, c, hs, r=0.0):
    q = np.abs(p - np.asarray(c, float)) - (np.asarray(hs, float) - r)
    return L(np.maximum(q, 0.0)) + np.minimum(q.max(-1), 0.0) - r


def cyl_y(p, c, r, hh, rr=0.0):
    q = p - np.asarray(c, float)
    d1 = np.sqrt(q[:, 0] ** 2 + q[:, 2] ** 2) - r + rr
    d2 = np.abs(q[:, 1]) - hh + rr
    return np.minimum(np.maximum(d1, d2), 0.0) + np.sqrt(np.maximum(d1, 0) ** 2 + np.maximum(d2, 0) ** 2) - rr


def cyl_z(p, c, r, hh, rr=0.0):
    q = p - np.asarray(c, float)
    d1 = np.sqrt(q[:, 0] ** 2 + q[:, 1] ** 2) - r + rr
    d2 = np.abs(q[:, 2]) - hh + rr
    return np.minimum(np.maximum(d1, d2), 0.0) + np.sqrt(np.maximum(d1, 0) ** 2 + np.maximum(d2, 0) ** 2) - rr


def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0.0, 1.0)
    return b * (1 - h) + a * h - k * h * (1 - h)


def hash3(x, y, z, seed=0):
    xi = np.floor(x).astype(np.int64); yi = np.floor(y).astype(np.int64); zi = np.floor(z).astype(np.int64)
    h = (xi * 374761393 + yi * 668265263 + zi * 2147483647 + seed * 1442695041) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    h = h ^ (h >> 16)
    return (h & 0xFFFF) / 65535.0


def solid(ramp, base=2.4, shine=0.0):
    return (ramp, base, shine)


class Model:
    """parts(p)->list of distance arrays; mats[k] = (ramp, base, shine) or callable(p,n)->(ramp_ids,base,shine)."""

    def __init__(self, parts, mats, bbox):
        self.parts, self.mats, self.bbox = parts, mats, bbox

    def dist(self, p):
        return np.minimum.reduce(self.parts(p))

    def material(self, p, n):
        ds = np.stack(self.parts(p), 0)
        idx = ds.argmin(0)
        ramp = np.zeros(len(p), np.int64); base = np.zeros(len(p)); shine = np.zeros(len(p))
        for k, m in enumerate(self.mats):
            sel = idx == k
            if not sel.any():
                continue
            if callable(m):
                r, b, s = m(p[sel], n[sel])
            else:
                r, b, s = m
                r = RID[r]
            ramp[sel] = r; base[sel] = b; shine[sel] = s
        return ramp, base, shine


LIGHT = np.array([0.22, 0.58, 0.78]); LIGHT = LIGHT / np.linalg.norm(LIGHT)


def render(model, ang=0.0, ss=2, pad=3, shadows=True, ao=True, outline=True, maxit=80, light=LIGHT, dither=True):
    """Returns (rgba HxWx4 uint8, anchor_x, anchor_y) with anchor = pixel of the local origin."""
    ca, sa = np.cos(ang), np.sin(ang)

    def to_local(p):
        return np.stack([p[:, 0] * ca + p[:, 1] * sa, -p[:, 0] * sa + p[:, 1] * ca, p[:, 2]], 1)

    def rot_dir(v):
        return np.stack([v[:, 0] * ca + v[:, 1] * sa, -v[:, 0] * sa + v[:, 1] * ca, v[:, 2]], 1)

    dist_w = lambda p: model.dist(to_local(p))

    x0, x1, y0, y1, z0, z1 = model.bbox
    cs = np.array([[x, y, z] for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)], float)
    wx = cs[:, 0] * ca - cs[:, 1] * sa
    wy = cs[:, 0] * sa + cs[:, 1] * ca
    SX = wx - wy
    SY = (wx + wy) / 2 - cs[:, 2]
    xmin, xmax, ymin, ymax = SX.min(), SX.max(), SY.min(), SY.max()
    W = int(np.ceil(xmax - xmin)) + 2 * pad
    Hh = int(np.ceil(ymax - ymin)) + 2 * pad
    ox = pad - xmin
    oy = pad - ymin
    # sample grid
    gy, gx = np.mgrid[0:Hh * ss, 0:W * ss]
    X = ((gx + 0.5) / ss - ox).ravel()
    Y = ((gy + 0.5) / ss - oy).ravel()
    n = X.size
    base = np.stack([X, np.zeros(n), X / 2 - Y], 1)
    d = np.array([1.0, 1.0, 1.0])
    cw = np.array([(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2])
    cwx = cw[0] * ca - cw[1] * sa; cwy = cw[0] * sa + cw[1] * ca
    c = np.array([cwx, cwy, cw[2]])
    R = np.sqrt(((x1 - x0) / 2) ** 2 + ((y1 - y0) / 2) ** 2 + ((z1 - z0) / 2) ** 2) + 1.0
    q = base - c
    b = q @ d
    disc = b * b - 3.0 * ((q * q).sum(1) - R * R)
    ok = disc > 0
    sq = np.sqrt(np.maximum(disc, 0))
    s_hi = (-b + sq) / 3.0
    s_lo = (-b - sq) / 3.0
    s = s_hi.copy()
    active = ok.copy()
    hit = np.zeros(n, bool)
    s_hit = np.full(n, -1e9)
    for _ in range(maxit):
        idx = np.nonzero(active)[0]
        if idx.size == 0:
            break
        pts = base[idx] + s[idx, None] * d
        dd = dist_w(pts)
        h = dd < 0.03
        if h.any():
            hit[idx[h]] = True
            s_hit[idx[h]] = s[idx[h]]
            active[idx[h]] = False
        mv = idx[~h]
        s[mv] -= np.maximum(dd[~h], 0.05) * 0.92 / SQ3
        active[mv[s[mv] < s_lo[mv]]] = False

    hi = np.nonzero(hit)[0]
    P = base[hi] + s_hit[hi, None] * d
    e = 0.4
    def grad(P):
        gxv = dist_w(P + [e, 0, 0]) - dist_w(P - [e, 0, 0])
        gyv = dist_w(P + [0, e, 0]) - dist_w(P - [0, e, 0])
        gzv = dist_w(P + [0, 0, e]) - dist_w(P - [0, 0, e])
        g = np.stack([gxv, gyv, gzv], 1)
        return g / np.maximum(L(g), 1e-9)[:, None]
    N = grad(P)
    Pl = to_local(P); Nl = rot_dir(N)
    ramp, bt, shine = model.material(Pl, Nl)
    lam = np.clip(N @ light, 0, 1)
    tone = bt + (lam - 0.45) * 4.0
    if shadows:
        o = P + N * 0.7
        sh = np.zeros(len(hi))
        t = np.full(len(hi), 0.7)
        res = np.ones(len(hi))
        for _ in range(22):
            pt = o + light[None, :] * t[:, None]
            dd = dist_w(pt)
            res = np.minimum(res, np.clip(6.0 * dd / t, 0, 1))
            t += np.maximum(dd, 0.5)
            if (t > 70).all():
                break
        tone -= (1.0 - res) * 1.5
    if ao:
        occ = np.zeros(len(hi))
        for k, hgt in enumerate((1.2, 2.6, 4.5)):
            dd = dist_w(P + N * hgt)
            occ += np.clip((hgt - dd) / hgt, 0, 1) * (0.5 ** k)
        tone -= np.clip(occ, 0, 1.2) * 1.3
    if shine.any():
        Rv = 2 * (N @ light)[:, None] * N - light[None, :]
        vdir = d / SQ3
        spec = np.clip(Rv @ vdir, 0, 1) ** 18
        tone += shine * 3.0 * spec
    tone = np.clip(tone, 0, 5)
    full_tone = np.zeros(n); full_ramp = np.zeros(n, np.int64)
    full_tone[hi] = tone; full_ramp[hi] = ramp
    full_s = s_hit
    # --- downsample ss x ss -> 1
    def blk(a):
        return a.reshape(Hh, ss, W, ss).transpose(0, 2, 1, 3).reshape(Hh, W, ss * ss)
    hitb = blk(hit.astype(float)); sb = blk(full_s); tb = blk(full_tone); rb = blk(full_ramp.astype(float))
    cover = hitb.sum(-1)
    solid_px = cover >= (ss * ss) / 2.0
    front = np.argmax(sb, -1)
    rr = np.take_along_axis(rb, front[..., None], -1)[..., 0].astype(int)
    same = (rb == rr[..., None]) & (hitb > 0)
    tmean = (tb * same).sum(-1) / np.maximum(same.sum(-1), 1)
    rr = np.where(solid_px, rr, 0)
    py, px = np.mgrid[0:Hh, 0:W]
    thr = BAYER[py % 4, px % 4]
    lo = np.floor(tmean)
    fr = tmean - lo
    if dither:
        up = np.where(fr < 0.34, False, np.where(fr > 0.66, True, fr > thr))
    else:
        up = fr > 0.5
    ti = np.clip(lo + up, 0, 5).astype(int)
    rgb = RAMP_RGB[rr, ti]
    img = np.zeros((Hh, W, 4), np.uint8)
    img[..., :3] = rgb
    img[..., 3] = np.where(solid_px, 255, 0)
    if outline:
        img = add_outline(img, rr)
    return img, int(round(ox)), int(round(oy))


def add_outline(img, rid, strength=0.78):
    a = img[..., 3] > 0
    Hh, W = a.shape
    pad = np.pad(rid, 1)
    best = np.zeros_like(rid)
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        nb = pad[1 + dy:1 + dy + Hh, 1 + dx:1 + dx + W]
        best = np.where((best == 0) & (nb > 0), nb, best)
    edge = (~a) & (best > 0)
    out = img.copy()
    col = RAMP_RGB[best, 0].astype(float) * strength
    out[edge, :3] = col[edge].astype(np.uint8)
    out[edge, 3] = 255
    return out


def to_image(rgba, scale=1):
    im = Image.fromarray(rgba, 'RGBA')
    if scale != 1:
        im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    return im


# ------------------------------------------------------------------ interactable highlight
GOLD_HI = (251, 234, 184)   # gold ramp tone 5
GOLD_MID = (239, 212, 134)  # gold ramp tone 4
INK = (36, 27, 40)


def _dilate(m, d8=False):
    Hh, W = m.shape
    p = np.pad(m, 1)
    o = m.copy()
    offs = [(-1, 0), (1, 0), (0, -1), (0, 1)] + ([(-1, -1), (-1, 1), (1, -1), (1, 1)] if d8 else [])
    for dy, dx in offs:
        o |= p[1 + dy:1 + dy + Hh, 1 + dx:1 + dx + W]
    return o


def highlight(img, state='idle', valuable=False, frame=0):
    """Interactable cue. idle: thin warm-gold rim. hover: bright 2px rim + dark keyline + sparkles.
    Returns a new image padded by 4px on every side (anchor shifts by +4,+4)."""
    P = 4
    a = np.pad(img, ((P, P), (P, P), (0, 0)))
    al = a[..., 3] > 0
    out = a.copy()
    if state == 'idle':
        r1 = _dilate(al) & ~al
        # dashed shimmer that walks around the rim with `frame`
        py, px = np.nonzero(r1)
        on = ((px + py + frame * 2) // 3) % 3 != 0
        col = np.array(GOLD_MID)
        out[py[on], px[on], :3] = col; out[py[on], px[on], 3] = 255
        out[py[~on], px[~on], :3] = (148, 111, 46); out[py[~on], px[~on], 3] = 255
    else:
        d1 = _dilate(al); d2 = _dilate(d1, True)
        r1 = d1 & ~al; r2 = d2 & ~d1
        out[r1, :3] = GOLD_HI; out[r1, 3] = 255
        out[r2, :3] = INK; out[r2, 3] = 255
        # lift the object itself a touch so it reads as "selected"
        body = al
        out[body, :3] = np.clip(out[body, :3].astype(int) * 1.08 + 6, 0, 255).astype(np.uint8)
    if valuable:
        ys, xs = np.nonzero(al)
        if len(ys):
            rng = np.random.default_rng(7 + frame)
            for k in range(2 if state == 'idle' else 3):
                i = rng.integers(len(ys))
                y, x = ys[i], xs[i]
                for dy, dx, c in ((0, 0, (255, 255, 240)), (-1, 0, GOLD_HI), (1, 0, GOLD_HI), (0, -1, GOLD_HI), (0, 1, GOLD_HI)):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < out.shape[0] and 0 <= xx < out.shape[1] and out[yy, xx, 3]:
                        out[yy, xx, :3] = c
    return out, P


def scaled(m, s):
    """Uniformly scale a Model (geometry and material coordinates)."""
    def parts(P):
        return [d * s for d in m.parts(P / s)]
    mats = []
    for mt in m.mats:
        if callable(mt):
            mats.append((lambda f: (lambda p, n: f(p / s, n)))(mt))
        else:
            mats.append(mt)
    return Model(parts, mats, tuple(b * s for b in m.bbox))

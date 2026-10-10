"""Ground tiles, painted directly in tile space and projected to the 64x32 iso diamond."""
import numpy as np
from sdf import RID, RAMP_RGB, BAYER, hash3

TW, TH = 64, 32
THICK = {'asphalt': 2, 'sidewalk': 4, 'grass': 3, 'dirt': 3, 'planks': 3, 'water': 1, 'lot': 3}


def vnoise(u, v, scale, seed=0):
    uu, vv = u / scale, v / scale
    iu, iv = np.floor(uu), np.floor(vv)
    fu, fv = uu - iu, vv - iv
    fu = fu * fu * (3 - 2 * fu); fv = fv * fv * (3 - 2 * fv)
    a = hash3(iu, iv, 1, seed); b = hash3(iu + 1, iv, 1, seed)
    c = hash3(iu, iv + 1, 1, seed); d = hash3(iu + 1, iv + 1, 1, seed)
    return (a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + d * fu) * fv


def _quant(ramp, tone, px, py):
    tone = np.clip(tone, 0, 5)
    lo = np.floor(tone); fr = tone - lo
    thr = BAYER[py % 4, px % 4]
    up = np.where(fr < 0.3, False, np.where(fr > 0.7, True, fr > thr))
    ti = np.clip(lo + up, 0, 5).astype(int)
    return RAMP_RGB[ramp, ti]


def _asphalt(u, v, seed, wet=0.0):
    n1 = vnoise(u, v, 7.0, seed); n2 = vnoise(u, v, 2.6, seed + 3)
    t = 2.25 + 0.8 * n1 + 0.45 * n2
    h = hash3(np.floor(u), np.floor(v), 2, seed)
    t = t + (h > 0.955) * 1.0 - (h < 0.04) * 0.8
    crack = np.abs(vnoise(u * 0.9 + v * 0.35, v * 0.9 - u * 0.2, 11.0, seed + 8) - 0.5) < 0.011
    t = np.where(crack, t - 1.2, t)
    ramp = np.full(u.shape, RID['asph'])
    if wet > 0:
        pn = vnoise(u, v, 9.0, seed + 21)
        pud = pn > (1.0 - wet)
        edge = pud & (pn < (1.0 - wet) + 0.035)
        # puddles take the colour of the sky: cool, lighter, with soft ripples
        ramp = np.where(pud, RID['blueg'], ramp)
        t = np.where(pud, 1.9 + 0.8 * vnoise(u * 2.0 + v, v * 0.6, 5.0, seed + 5) + (h > 0.93) * 0.9, t)
        t = np.where(edge, 0.6, t)
    return ramp, t


def _paint(ramp, t, mask, name, tone, u, v, seed, wear=0.1):
    keep = mask & (hash3(np.floor(u * 1.3), np.floor(v * 1.3), 4, seed + 91) > wear)
    ramp = np.where(keep, RID[name], ramp)
    t = np.where(keep, tone + (hash3(np.floor(u), np.floor(v), 5, seed) > 0.8) * 0.5, t)
    return ramp, t


def texture(kind, u, v, seed):
    base = kind.split('_')[0]
    if kind in ('asphalt', 'asphalt_wet', 'intersection', 'manhole') or kind.startswith('road') or kind.startswith('cross'):
        wet = 0.0
        if kind == 'asphalt_wet':
            wet = 0.34
        ramp, t = _asphalt(u, v, seed, wet)
        if kind.startswith('road_x') or kind.startswith('road_y'):
            a, b = (u, v) if kind.startswith('road_x') else (v, u)
            tag = kind.split('_')[-1]          # e0 edge@b0, c1 centre@b32, c0 centre@b0, e1 edge@b32, p plain
            if tag in ('c0', 'c1'):
                bc = 0.0 if tag == 'c0' else 32.0
                dbl = (np.abs(b - bc) < 1.5) & (np.abs(b - bc) > 0.0)
                ramp, t = _paint(ramp, t, dbl, 'gold', 3.3, u, v, seed, 0.1)
            if tag in ('e0', 'e1'):
                be = 2.6 if tag == 'e0' else 29.4
                edge = (np.abs(b - be) < 0.9)
                ramp, t = _paint(ramp, t, edge, 'white', 3.4, u, v, seed, 0.18)
            if tag in ('d0', 'd1'):
                bd = 0.0 if tag == 'd0' else 32.0
                dash = (np.abs(b - bd) < 1.0) & (np.mod(a, 16.0) < 8.0)
                ramp, t = _paint(ramp, t, dash, 'white', 3.4, u, v, seed, 0.15)
        elif kind.startswith('cross'):
            a, b = (u, v) if kind.endswith('x') else (v, u)
            bars = (a > 5) & (a < 27) & (np.mod(b, 6.4) < 3.5) & (b > 2) & (b < 30)
            ramp, t = _paint(ramp, t, bars, 'white', 3.3, u, v, seed, 0.1)
        elif kind == 'intersection':
            sl = (v > 2.6) & (v < 4.2) & (u > 4) & (u < 28)
            ramp, t = _paint(ramp, t, sl, 'white', 3.0, u, v, seed, 0.14)
        elif kind == 'manhole':
            d = np.sqrt((u - 16) ** 2 + (v - 16) ** 2)
            disc = d < 5.8
            ramp = np.where(disc, RID['lavlt'], ramp)
            t = np.where(disc, 0.9 + (np.mod(np.floor(u) + np.floor(v), 3) == 0) * 0.7 + (d > 4.6) * 0.8, t)
            ring = (d >= 5.8) & (d < 6.6)
            t = np.where(ring, 0.6, t)
        return ramp, t
    if base == 'sidewalk':
        n = vnoise(u, v, 6.0, seed)
        t = 2.5 + 0.9 * n + (hash3(np.floor(u), np.floor(v), 2, seed) - 0.5) * 0.5
        joint = (np.mod(u, 16.0) < 0.9) | (np.mod(v, 16.0) < 0.9)
        t = np.where(joint, t - 1.1, t)
        ramp = np.full(u.shape, RID['stone'])
        moss = joint & (hash3(np.floor(u / 2), np.floor(v / 2), 3, seed) > 0.72)
        ramp = np.where(moss, RID['sage'], ramp); t = np.where(moss, 2.3, t)
        if kind.endswith('b'):
            crack = np.abs(vnoise(u * 0.8 - v * 0.4, v * 0.8 + u * 0.3, 9.0, seed + 5) - 0.5) < 0.014
            t = np.where(crack, t - 1.3, t)
            gum = hash3(np.floor(u / 2), np.floor(v / 2), 8, seed) > 0.97
            t = np.where(gum, t - 0.9, t)
        return ramp, t
    if base == 'grass':
        n = vnoise(u, v, 5.5, seed); n2 = vnoise(u, v, 2.2, seed + 4)
        t = 1.6 + 1.2 * n + 0.6 * n2
        h = hash3(np.floor(u), np.floor(v), 6, seed)
        ramp = np.full(u.shape, RID['sage'])
        blade = h > 0.9
        ramp = np.where(blade, RID['khaki'], ramp); t = np.where(blade, 2.3 + n * 0.8, t)
        t = t - (h < 0.07) * 0.9
        if kind.endswith('b'):
            for k, (nm, tn) in enumerate((('gold', 3.9), ('plum', 3.8), ('white', 4.0), ('gold', 3.8))):
                fl = hash3(np.floor(u / 3), np.floor(v / 3), 12 + k, seed) > 0.965
                ramp = np.where(fl, RID[nm], ramp); t = np.where(fl, tn, t)
        return ramp, t
    if base == 'dirt':
        n = vnoise(u, v, 5.0, seed); n2 = vnoise(u, v, 2.0, seed + 6)
        t = 1.9 + 1.1 * n + 0.5 * n2
        ramp = np.where(vnoise(u, v, 9.0, seed + 12) > 0.6, RID['clay'], RID['stone'])
        t = np.where(ramp == RID['clay'], t - 0.2, t - 0.3)
        peb = hash3(np.floor(u), np.floor(v), 7, seed) > 0.96
        ramp = np.where(peb, RID['lavlt'], ramp); t = np.where(peb, 3.0, t)
        return ramp, t
    if base == 'planks':
        a, b = (u, v) if kind.endswith('x') else (v, u)
        plank = np.floor(b / 4.0)
        t = 2.1 + (hash3(plank, np.floor(a / 14.0), 3, seed) - 0.5) * 1.1 + vnoise(u, v, 3.0, seed) * 0.5
        gap = np.mod(b, 4.0) < 0.85
        t = np.where(gap, 0.4, t)
        ends = np.mod(a + hash3(plank, 1, 1, seed) * 14, 14.0) < 0.8
        t = np.where(ends & ~gap, t - 0.9, t)
        nail = (np.mod(a + hash3(plank, 1, 1, seed) * 14, 14.0) > 1.6) & (np.mod(a + hash3(plank, 1, 1, seed) * 14, 14.0) < 2.5) & (np.abs(np.mod(b, 4.0) - 2.0) < 0.6)
        ramp = np.full(u.shape, RID['wood'])
        ramp = np.where(nail, RID['lavlt'], ramp); t = np.where(nail, 2.4, t)
        return ramp, t
    if base == 'water':
        w = np.sin((u + v) / 3.1 + 1.2) + np.sin(u / 4.6 - v / 6.1) + 0.6 * np.sin((u - v) / 2.1)
        t = 2.4 + 0.35 * w
        ramp = np.full(u.shape, RID['teal'])
        spark = hash3(np.floor(u / 2), np.floor(v / 1.0), 9, seed) > 0.95
        ramp = np.where(spark, RID['white'], ramp); t = np.where(spark, 3.6, t)
        foam = (u < 1.6) | (v < 1.6) | (u > 30.4) | (v > 30.4)
        ramp = np.where(foam & (hash3(np.floor(u), np.floor(v), 5, seed) > 0.4), RID['white'], ramp)
        t = np.where(foam, np.where(ramp == RID['white'], 3.2, t), t)
        return ramp, t
    if base == 'lot':
        n = vnoise(u, v, 6.0, seed)
        t = 2.0 + 0.9 * n + (hash3(np.floor(u), np.floor(v), 2, seed) - 0.5) * 0.5
        joint = (np.mod(u, 16.0) < 0.9) | (np.mod(v, 16.0) < 0.9)
        t = np.where(joint, t - 1.0, t)
        ramp = np.full(u.shape, RID['lavlt'])
        oil = vnoise(u, v, 4.0, seed + 7) > 0.86
        ramp = np.where(oil, RID['lav'], ramp); t = np.where(oil, 3.0 + hash3(np.floor(u), np.floor(v), 4, seed) * 0.6, t)
        if kind.endswith('lines'):
            ln = (np.mod(u, 10.5) < 1.0) & (v > 4) & (v < 28)
            ramp, t = _paint(ramp, t, ln, 'white', 3.3, u, v, seed, 0.2)
        return ramp, t
    # ---------------- interior floors
    if base == 'woodfloor':
        a_, b_ = (u, v) if kind.endswith('x') else (v, u)
        board = np.floor(b_ / 3.2)
        off = hash3(board, 1, 2, seed) * 20
        t = 2.6 + (hash3(board, np.floor((a_ + off) / 20.0), 3, seed) - 0.5) * 0.9 + vnoise(u, v, 2.5, seed) * 0.4
        t = np.where(np.mod(b_, 3.2) < 0.55, 1.2, t)
        t = np.where(np.mod(a_ + off, 20.0) < 0.6, t - 0.8, t)
        return np.full(u.shape, RID['wood']), t
    if base == 'linoleum':
        chk = (np.floor(u / 8.0) + np.floor(v / 8.0)) % 2 == 0
        ramp = np.where(chk, RID['white'], RID['lavlt'])
        t = np.where(chk, 3.2, 2.6) + (hash3(np.floor(u), np.floor(v), 4, seed) - 0.5) * 0.35
        scuff = vnoise(u, v, 5.0, seed + 3) > 0.78
        t = np.where(scuff, t - 0.5, t)
        return ramp, t
    if base == 'carpet':
        n = vnoise(u, v, 3.0, seed)
        t = 1.9 + n * 0.6 + (hash3(np.floor(u), np.floor(v), 5, seed) - 0.5) * 0.5
        pat = (np.mod(u + v, 8.0) < 0.9) | (np.mod(u - v + 64, 8.0) < 0.9)
        t = np.where(pat, t + 0.4, t)
        return np.full(u.shape, RID['blueg']), t
    if base == 'marble':
        n = vnoise(u * 1.3 + v * 0.4, v, 6.0, seed)
        vein = np.abs(vnoise(u * 0.7, v * 1.2, 4.0, seed + 9) - 0.5) < 0.02
        t = 3.1 + n * 0.7
        t = np.where(vein, 2.3, t)
        joint = (np.mod(u, 16.0) < 0.6) | (np.mod(v, 16.0) < 0.6)
        t = np.where(joint, 2.0, t)
        return np.full(u.shape, RID['stone']), t
    if base == 'concrete':
        n = vnoise(u, v, 5.0, seed)
        t = 2.3 + n * 0.8 + (hash3(np.floor(u), np.floor(v), 2, seed) - 0.5) * 0.4
        return np.full(u.shape, RID['lavlt']), t
    raise KeyError(kind)


def _thick(kind):
    if kind.startswith('sidewalk'):
        return 4
    if kind.startswith('grass'):
        return 3
    if kind.startswith('dirt'):
        return 3
    if kind.startswith('planks'):
        return 3
    if kind.startswith('water'):
        return 1
    if kind.startswith('lot'):
        return 3
    return 2


def make_tile(kind, seed=1, rim_line=True):
    th = _thick(kind)
    Hh = TH + th
    py, px = np.mgrid[0:Hh, 0:TW]
    X = px - 32 + 0.5; Y = py + 0.5
    inside = (np.abs(X) / 32.0 + np.abs(Y - 16) / 16.0) <= 1.0
    u = Y + X / 2; v = Y - X / 2
    ramp, t = texture(kind, np.clip(u, 0, 32), np.clip(v, 0, 32), seed)
    img = np.zeros((Hh, TW, 4), np.uint8)
    rgb = _quant(ramp, t, px, py)
    img[..., :3] = rgb
    img[..., 3] = np.where(inside, 255, 0)
    # side faces
    yedge = np.where(X < 0, 16 + (X + 32) / 2, 32 - X / 2)
    side = (~inside) & (Y > yedge) & (Y <= yedge + th) & (np.abs(X) <= 32)
    left = X < 0
    # sample the texture just under the rim and darken it
    base_ramp, base_t = ramp, t
    sh = np.where(left, 1.1, 1.8)
    sr = base_ramp.copy()
    if kind.startswith('sidewalk') or kind.startswith('lot'):
        sr = np.full(sr.shape, RID['stone'] if kind.startswith('sidewalk') else RID['lavlt'])
        st = np.where(left, 1.9, 1.2) + (hash3(px, py, 1, seed) - 0.5) * 0.5
    elif kind.startswith('grass') or kind.startswith('dirt'):
        sr = np.full(sr.shape, RID['clay'])
        st = np.where(left, 1.1, 0.5) + (hash3(px, py, 2, seed) - 0.5) * 0.6
    elif kind.startswith('planks'):
        sr = np.full(sr.shape, RID['wood'])
        st = np.where(left, 1.5, 0.8) + (np.mod(px, 4) == 0) * -0.5
    elif kind.startswith('water'):
        sr = np.full(sr.shape, RID['teal'])
        st = np.where(left, 1.0, 0.4)
    else:
        sr = np.full(sr.shape, RID['asph'])
        st = np.where(left, 2.0, 1.3)
    srgb = _quant(sr, st, px, py)
    img[side, :3] = srgb[side]
    img[side, 3] = 255
    # rim line along the diamond's lower edges for crispness
    yd = np.where(X < 0, 16 + (X + 32) / 2, 32 - X / 2)
    rim = inside & (Y > yd - 1.0) & (np.abs(X) < 31) & rim_line
    img[rim, :3] = (img[rim, :3].astype(float) * 0.82).astype(np.uint8)
    return img, 32, 0


TILES = ['asphalt', 'asphalt_wet', 'road_x_e0', 'road_x_c1', 'road_x_c0', 'road_x_e1', 'road_y_e0', 'road_y_c1', 'road_y_c0', 'road_y_e1',
         'road_x_d0', 'road_y_d0', 'crosswalk_x', 'crosswalk_y',
         'intersection', 'manhole', 'sidewalk_a', 'sidewalk_b', 'grass_a', 'grass_b', 'dirt_a', 'planks_x', 'planks_y',
         'water_a', 'lot_a', 'lot_lines']

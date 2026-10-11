"""Vector ground: streets, kerbs, sidewalks and paving drawn as shapes in world units (docs/14 "Vector ground").

Two halves, both mirrored exactly by the game (src/iso/vectorGround.ts):
  1. Material swatches. Every ground material has a repeating texture of PERIOD x PERIOD world units, rendered once
     in screen space (SW x SH pixels) with the ground2d.py texture code, so colours, noise and dithering match the
     tile art. A screen pixel (px, py) takes the swatch pixel (px mod SW, py mod SH): the projection maps a world
     period onto exactly that rectangle, so the texture lines up across swatch edges.
  2. Rasterising. Shapes are polygons in world units, painted in order (later on top). A pixel takes a shape's
     material when its centre is inside the projected polygon (even-odd rule, no anti-aliasing). Each material has
     a height in pixels; where a higher surface meets a lower one the higher one shows a kerb face below its edge,
     shaded light or dark by which way the edge faces, and the edge's last row is darkened like the tile rim.

Screen coordinates: X = x - y, Y = (x + y) / 2, with pixel (px, py) covering [px, px + 1) x [py, py + 1).
"""
import os, json
import numpy as np
from PIL import Image
import ground2d as G
from sdf import RID, RAMP_RGB, BAYER, hash3

PERIOD = 256.0                 # world units per swatch repeat (8 tiles)
SW, SH = int(2 * PERIOD), int(PERIOD)
VOID_H = -2                    # height of the outside of the map: the map edge shows a 2-4 px skirt like the tiles


# ------------------------------------------------------------------ periodic noise for swatches
def pvnoise(u, v, scale, seed=0):
    """ground2d.vnoise, but with a lattice that wraps every PERIOD units so swatches repeat seamlessly."""
    n = max(1, int(round(PERIOD / scale)))
    sc = PERIOD / n
    uu, vv = u / sc, v / sc
    iu, iv = np.floor(uu), np.floor(vv)
    fu, fv = uu - iu, vv - iv
    fu = fu * fu * (3 - 2 * fu); fv = fv * fv * (3 - 2 * fv)
    w = lambda a: np.mod(a, n)
    a = hash3(w(iu), w(iv), 1, seed); b = hash3(w(iu + 1), w(iv), 1, seed)
    c = hash3(w(iu), w(iv + 1), 1, seed); d = hash3(w(iu + 1), w(iv + 1), 1, seed)
    return (a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + d * fu) * fv


class _periodic:
    def __enter__(self):
        self.old = G.vnoise; G.vnoise = pvnoise

    def __exit__(self, *a):
        G.vnoise = self.old


# ------------------------------------------------------------------ materials
# name: (height px, side ramp, left tone, right tone)
MATERIALS = {
    'asphalt':     (0, 'asph', 2.0, 1.3),
    'asphalt_wet': (0, 'asph', 2.0, 1.3),
    'paint_white': (0, 'asph', 2.0, 1.3),
    'paint_gold':  (0, 'asph', 2.0, 1.3),
    'iron':        (0, 'asph', 2.0, 1.3),
    'lot':         (0, 'lavlt', 1.9, 1.2),
    'dirt':        (1, 'clay', 1.1, 0.5),
    'gravel':      (1, 'stone', 1.9, 1.2),
    'sidewalk':    (2, 'stone', 1.9, 1.2),
    'sidewalk_b':  (2, 'stone', 1.9, 1.2),
    'kerb':        (2, 'stone', 1.9, 1.2),
    'plaza':       (2, 'stone', 1.9, 1.2),
    'plaza_dark':  (2, 'lavlt', 1.9, 1.2),
    'brickpave':   (2, 'brick', 1.6, 1.0),
    'cobble':      (2, 'lavlt', 1.9, 1.2),
    'terrazzo':    (2, 'stone', 1.9, 1.2),
    'concrete':    (2, 'lavlt', 1.9, 1.2),
    'grate':       (2, 'stone', 1.9, 1.2),
    'grass':       (3, 'clay', 1.1, 0.5),
    'grass_b':     (3, 'clay', 1.1, 0.5),
    'soil':        (3, 'clay', 1.1, 0.5),
}
MAT_ORDER = list(MATERIALS)
MAT_ID = {m: i + 1 for i, m in enumerate(MAT_ORDER)}       # 0 is the outside of the map


def _tex(name, u, v, seed):
    """(ramp ids, tones) for a material at world-periodic (u, v)."""
    if name in ('asphalt', 'asphalt_wet', 'concrete', 'lot'):
        return G.texture({'lot': 'lot_a'}.get(name, name), u, v, seed)
    if name == 'paint_white' or name == 'paint_gold':
        r, t = G.texture('asphalt', u, v, seed)
        allm = np.ones(u.shape, bool)
        if name == 'paint_white':
            return G._paint(r, t, allm, 'white', 3.4, u, v, seed, 0.16)
        return G._paint(r, t, allm, 'gold', 3.3, u, v, seed, 0.1)
    if name == 'sidewalk':
        return G.texture('sidewalk_a', u, v, seed)
    if name == 'sidewalk_b':
        return G.texture('sidewalk_b', u, v, seed)
    if name in ('grass', 'grass_b'):
        return G.texture({'grass': 'grass_a', 'grass_b': 'grass_b'}[name], u, v, seed)
    if name == 'dirt':
        return G.texture('dirt_a', u, v, seed)
    if name == 'soil':
        n = pvnoise(u, v, 4.0, seed)
        t = 1.3 + 0.9 * n + (hash3(np.floor(u), np.floor(v), 2, seed) - 0.5) * 0.6
        r = np.full(u.shape, RID['wood'])
        leaf = hash3(np.floor(u / 2), np.floor(v / 2), 3, seed) > 0.9
        return np.where(leaf, RID['sage'], r), np.where(leaf, 2.2, t)
    if name == 'kerb':
        t = 3.0 + 0.5 * pvnoise(u, v, 5.0, seed) + (hash3(np.floor(u), np.floor(v), 2, seed) - 0.5) * 0.4
        return np.full(u.shape, RID['stone']), t
    if name in ('plaza', 'plaza_dark'):
        s = 32.0 if name == 'plaza' else 16.0
        cu, cv = np.floor(u / s), np.floor(v / s)
        slab = hash3(cu, cv, 3, seed)
        t = (3.0 if name == 'plaza' else 2.7) + (slab - 0.5) * 0.5 + 0.4 * pvnoise(u, v, 6.0, seed)
        joint = (np.mod(u, s) < 0.9) | (np.mod(v, s) < 0.9)
        t = np.where(joint, t - 1.0, t)
        r = np.full(u.shape, RID['stone'] if name == 'plaza' else RID['lavlt'])
        return r, t
    if name == 'brickpave':
        cu, cv = np.floor(u / 8.0), np.floor(v / 8.0)
        horiz = np.mod(cu + cv, 2) == 0
        a = np.where(horiz, u, v); b = np.where(horiz, v, u)
        brick = np.floor(b / 4.0)
        h = hash3(brick, np.floor(a / 8.0) + cu * 3, 4, seed)
        gap = (np.mod(b, 4.0) < 0.7) | (np.mod(a, 8.0) < 0.7)
        t = 3.1 + (h - 0.5) * 0.7 + 0.3 * pvnoise(u, v, 5.0, seed)
        r = np.where(h > 0.88, RID['clay'], RID['brick'])
        return r, np.where(gap, 2.0, np.where(h > 0.88, 2.6, t))
    if name == 'cobble':
        su, sv = u + 2.0 * (np.mod(np.floor(v / 4.0), 2)), v
        cu, cv = np.floor(su / 4.0), np.floor(sv / 4.0)
        fu, fv = np.mod(su, 4.0) - 2.0, np.mod(sv, 4.0) - 2.0
        edge = (np.abs(fu) > 1.45) | (np.abs(fv) > 1.45) | (np.abs(fu) + np.abs(fv) > 2.5)
        h = hash3(cu, cv, 5, seed)
        t = 2.5 + (h - 0.5) * 1.0 - (fu + fv) * 0.12
        r = np.where(h > 0.75, RID['stone'], RID['lavlt'])
        return r, np.where(edge, 1.0, t)
    if name == 'terrazzo':
        t = 3.3 + 0.3 * pvnoise(u, v, 4.0, seed)
        chip = hash3(np.floor(u * 1.5), np.floor(v * 1.5), 6, seed)
        r = np.where(chip > 0.9, RID['lavlt'], np.where(chip < 0.06, RID['brick'], RID['stone']))
        return r, np.where(chip > 0.9, 2.6, np.where(chip < 0.06, 3.2, t))
    if name == 'gravel':
        h = hash3(np.floor(u * 1.3), np.floor(v * 1.3), 7, seed)
        r = np.where(h > 0.7, RID['stone'], np.where(h < 0.2, RID['clay'], RID['lavlt']))
        return r, 2.0 + h * 1.4
    if name == 'grate':
        bar = (np.mod(u, 2.6) < 0.9) | (np.mod(v, 2.6) < 0.9)
        r = np.full(u.shape, RID['night'])
        return r, np.where(bar, 3.0 + (hash3(np.floor(u), np.floor(v), 2, seed) > 0.7) * 0.6, 0.5)
    if name == 'iron':
        hatch = (np.mod(u + v, 3.0) < 1.0) | (np.mod(u - v + 300, 3.0) < 1.0)
        return np.full(u.shape, RID['lavlt']), np.where(hatch, 1.6, 0.8)
    raise KeyError(name)


def swatch(name, seed=3):
    """The material's repeating swatch, SH x SW x 3 uint8, for screen pixels with origin at world (0, 0)."""
    py, px = np.mgrid[0:SH, 0:SW]
    X = px + 0.5; Y = py + 0.5
    x = Y + X / 2; y = Y - X / 2
    u = np.mod(x, PERIOD); v = np.mod(y, PERIOD)
    with _periodic():
        ramp, t = _tex(name, u, v, seed)
    return G._quant(ramp, t, px, py)


def write_swatches(out_png, out_json, seed=3):
    """Pack every material swatch into one sheet (one row each) plus a JSON index for the game."""
    sheet = np.zeros((SH * len(MAT_ORDER), SW, 3), np.uint8)
    for k, m in enumerate(MAT_ORDER):
        sheet[k * SH:(k + 1) * SH] = swatch(m, seed)
    Image.fromarray(sheet, 'RGB').save(out_png, optimize=True)
    meta = {'period': PERIOD, 'w': SW, 'h': SH, 'voidHeight': VOID_H,
            'materials': [{'name': m, 'id': MAT_ID[m], 'row': k, 'height': MATERIALS[m][0], 'side': MATERIALS[m][1],
                           'left': MATERIALS[m][2], 'right': MATERIALS[m][3]} for k, m in enumerate(MAT_ORDER)],
            'ramps': {n: [list(map(int, RAMP_RGB[i, k])) for k in range(6)] for n, i in RID.items()}}
    json.dump(meta, open(out_json, 'w'), indent=1)


_SWATCH_CACHE = {}


def _sw(name):
    if name not in _SWATCH_CACHE:
        _SWATCH_CACHE[name] = swatch(name)
    return _SWATCH_CACHE[name]


# ------------------------------------------------------------------ rasterising
def fill_polygon(buf, poly, value, x0, y0):
    """Set buf pixels whose centres are inside the world polygon (even-odd), for a buffer whose pixel (0, 0) is
    screen pixel (x0, y0). The same rule as src/iso/vectorGround.ts fillPolygon."""
    P = np.asarray(poly, float)
    if len(P) < 3:
        return
    sx = P[:, 0] - P[:, 1] - x0
    sy = (P[:, 0] + P[:, 1]) / 2 - y0
    H, W = buf.shape
    r0 = max(0, int(np.floor(sy.min() - 0.5)))
    r1 = min(H - 1, int(np.ceil(sy.max() - 0.5)))
    if r1 < r0:
        return
    ax, ay = sx, sy
    bx, by = np.roll(sx, -1), np.roll(sy, -1)
    rows = np.arange(r0, r1 + 1) + 0.5
    yc = rows[:, None]
    cross = ((ay[None, :] <= yc) & (by[None, :] > yc)) | ((by[None, :] <= yc) & (ay[None, :] > yc))
    with np.errstate(divide='ignore', invalid='ignore'):
        xi = ax[None, :] + (yc - ay[None, :]) * (bx - ax)[None, :] / (by - ay)[None, :]
    xi = np.where(cross, xi, np.inf)
    xi.sort(1)
    cnt = cross.sum(1)
    for k, row in enumerate(range(r0, r1 + 1)):
        n = cnt[k]
        if n < 2:
            continue
        xs = xi[k, :n]
        for a, b in zip(xs[0::2], xs[1::2]):
            c0 = max(0, int(np.ceil(a - 0.5)))
            c1 = min(W, int(np.ceil(b - 0.5)))
            if c1 > c0:
                buf[row, c0:c1] = value


def quant_rgb(ramp_ids, tone, px, py):
    return G._quant(ramp_ids, tone, px, py)


def compose(shapes, map_w, map_h, base, x0, y0, W, H, seed=3):
    """Render the ground for screen rect (x0, y0, W, H). Returns (rgba HxWx4, material id buffer).

    shapes: list of (material, polygon in world units). map_w/map_h in world units. base: material under all shapes.
    """
    py, px = np.mgrid[0:H, 0:W]
    gx = px + x0; gy = py + y0
    X = gx + 0.5; Y = gy + 0.5
    wx = Y + X / 2; wy = Y - X / 2
    inside = (wx >= 0) & (wy >= 0) & (wx < map_w) & (wy < map_h)
    mat = np.where(inside, MAT_ID[base], 0).astype(np.int16)
    for m, poly in shapes:
        buf = np.zeros((H, W), bool)
        fill_polygon(buf, poly, True, x0, y0)
        mat = np.where(buf & inside, MAT_ID[m], mat)
    # colour from the swatches
    rgb = np.zeros((H, W, 3), np.uint8)
    sxi = np.mod(gx, SW); syi = np.mod(gy, SH)
    for m in np.unique(mat):
        if m == 0:
            continue
        sel = mat == m
        rgb[sel] = _sw(MAT_ORDER[m - 1])[syi[sel], sxi[sel]]
    alpha = np.where(mat > 0, 255, 0).astype(np.uint8)
    heights = np.array([VOID_H] + [MATERIALS[m][0] for m in MAT_ORDER])
    h = heights[mat]
    # kerb faces: a pixel below a higher surface's edge shows that surface's side, up to the height difference
    maxd = int(heights.max() - VOID_H)
    face = np.zeros((H, W), bool)
    face_src = np.zeros((H, W), np.int16)
    face_left = np.zeros((H, W), bool)
    hp = np.full((H + 1, W + 6), VOID_H - 99)          # heights padded: one row on top, 3 columns each side
    hp[1:, 3:W + 3] = h
    cols = np.arange(W)[None, :] + 3
    for d in range(1, maxd + 1):
        up = np.full((H, W), VOID_H - 99); up_m = np.zeros((H, W), np.int16)
        up[d:] = h[:-d]; up_m[d:] = mat[:-d]
        sel = (~face) & (up_m > 0) & (up - h >= d)
        if not sel.any():
            continue
        # Which way the edge faces: look one row under the edge pixel, 3 px to each side. If the high surface
        # continues to the right but not to the left, the edge runs down to the right: a left (+y) face, lighter.
        rows = np.clip(np.arange(H) - d + 1, 0, H - 1)[:, None] + 1
        right_hi = hp[rows, cols + 3] >= up
        left_hi = hp[rows, cols - 3] >= up
        face |= sel
        face_src = np.where(sel, up_m, face_src)
        face_left = np.where(sel, right_hi & ~left_hi, face_left)
    if face.any():
        side = np.array([0] + [RID[MATERIALS[m][1]] for m in MAT_ORDER])
        lt = np.array([0] + [MATERIALS[m][2] for m in MAT_ORDER])
        rt = np.array([0] + [MATERIALS[m][3] for m in MAT_ORDER])
        noise = (hash3(gx, gy, 1, seed) - 0.5) * 0.5
        tone = np.where(face_left, lt[face_src], rt[face_src]) + noise
        frgb = quant_rgb(side[face_src], tone, gx, gy)
        rgb = np.where(face[..., None], frgb, rgb)
        alpha = np.where(face, 255, alpha)
    # rim: the last row of a surface above a lower one is darkened, like the tile rim line
    below = np.full((H, W), 99); below[:-1] = h[1:]
    rim = (mat > 0) & (below < h)
    rgb = np.where(rim[..., None], (rgb.astype(float) * 0.82).astype(np.uint8), rgb)
    out = np.dstack([rgb, alpha])
    return out, mat

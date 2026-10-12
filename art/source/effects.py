"""Phase 4 effects (docs/13 "Missing art"): muzzle flash, tracer, smoke, fire, explosion, hit spark, siren
light glow, plus the helicopter searchlight pool and rain splashes.

Drawn straight into pixels (no 3D model): each effect is a scalar field on the 1x pixel grid, snapped to a
palette ramp with the same 4x4 Bayer dithering the renderer uses, and faded by dithering pixels away rather
than by smooth alpha. Light pools (siren glow, searchlight) are the exception: flat colour in 4 quantised
alpha bands, meant to be drawn with additive blending, like the street-lamp pools (STYLE_GUIDE).

Colours come from palette.json ramps. Fire and flashes use cream, clay and red, never the gold ramp, which
stays reserved for valuables and interactables.

Run `python3 art/source/effects.py` to write art/effects.png/.json and the previews in art/drafts/effects/."""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
from sdf import RAMP_HEX, BAYER, H

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRAFTS = os.path.join(ROOT, 'drafts', 'effects')
DIRS = ['SE', 'S', 'SW', 'W', 'NW', 'N', 'NE', 'E']


def C(ramp, i):
    return H(RAMP_HEX[ramp][i])


# hot -> cool. Index 0 is the hottest (core), the last is the coolest edge.
FIRE = [C('white', 5), C('stone', 5), C('clay', 5), C('clay', 4), C('red', 4), C('red', 3), C('red', 2), C('brick', 2)]
FLASH = [C('white', 5), C('stone', 5), C('clay', 5), C('red', 5), C('red', 4), C('red', 3)]
SMOKE = [C('lavlt', 5), C('lavlt', 4), C('lavlt', 3), C('lavlt', 2), C('lav', 3), C('lav', 2)]
DARK_SMOKE = [C('lav', 4), C('lav', 3), C('lav', 2), C('night', 3), C('night', 2), C('night', 1)]
SPARK = [C('white', 5), C('stone', 5), C('clay', 5), C('clay', 4), C('red', 4)]
RAIN = [C('lavlt', 5), C('lavlt', 4)]


def screen_dir(a):
    """On-screen unit vector for direction index a (0 = SE), matching the vehicle/character facings."""
    t = a * np.pi / 4
    v = np.array([np.cos(t) - np.sin(t), (np.cos(t) + np.sin(t)) / 2])
    return v / np.linalg.norm(v)


def grid(w, h, cx, cy):
    yy, xx = np.mgrid[0:h, 0:w]
    return xx - cx + 0.5, yy - cy + 0.5, BAYER[yy % 4, xx % 4]


def shade(field, ramp, thr, cut=0.08, alpha=None):
    """field in [0,1] (1 = hottest/lightest). Pixels below `cut` vanish; `alpha` in [0,1] thins the sprite by
    dithering pixels away. Returns RGBA."""
    f = np.clip(field, 0, 1)
    n = len(ramp)
    pos = (1 - f) * (n - 1)
    lo = np.floor(pos)
    idx = np.clip(lo + ((pos - lo) > thr), 0, n - 1).astype(int)
    rgb = np.array(ramp, np.uint8)[idx]
    keep = f > cut
    if alpha is not None:
        keep &= np.broadcast_to(alpha, f.shape) > thr
    img = np.zeros(f.shape + (4,), np.uint8)
    img[..., :3] = rgb
    img[..., 3] = np.where(keep, 255, 0)
    return img


def noise2(x, y, seed, scale):
    """Smooth value noise (bilinear on a hashed lattice), in [0,1]."""
    def h(i, j):
        v = (i * 374761393 + j * 668265263 + seed * 1442695041) & 0xFFFFFFFF
        v = ((v ^ (v >> 13)) * 1274126177) & 0xFFFFFFFF
        return ((v ^ (v >> 16)) & 0xFFFF) / 65535.0
    gx, gy = x / scale, y / scale
    i, j = np.floor(gx).astype(np.int64), np.floor(gy).astype(np.int64)
    fx, fy = gx - i, gy - j
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy)
    a, b, c, d = h(i, j), h(i + 1, j), h(i, j + 1), h(i + 1, j + 1)
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def outline(img, col=C('brick', 0), strength=1.0):
    """1 px outer outline in the darkest tone (STYLE_GUIDE), for the solid effects."""
    a = img[..., 3] > 0
    p = np.pad(a, 1)
    nb = p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
    edge = nb & ~a
    out = img.copy()
    out[edge, :3] = col; out[edge, 3] = 255
    return out


# ---------------------------------------------------------------- muzzle flash (8 directions x 2 frames)
def muzzle_flash(a, f):
    w = h = 26
    X, Y, thr = grid(w, h, w / 2, h / 2)
    d = screen_dir(a); nrm = np.array([-d[1], d[0]])
    t = X * d[0] + Y * d[1]; s = X * nrm[0] + Y * nrm[1]
    L = 10.0 if f == 0 else 6.5
    core = np.exp(-(X ** 2 + Y ** 2) / (5.0 if f == 0 else 3.0))
    tt = np.clip(t / L, 0, 1)
    cone = np.where((t > 0) & (t < L), (1 - tt) * np.exp(-(s ** 2) / (2.6 * (1 - tt) + 0.3)), 0)
    prong = np.zeros_like(X)
    if f == 0:   # two short side prongs make the star shape of a shot
        for sg in (1, -1):
            u = X * (d[0] * 0.5 + nrm[0] * sg * 0.87) + Y * (d[1] * 0.5 + nrm[1] * sg * 0.87)
            v = X * (-(d[1] * 0.5 + nrm[1] * sg * 0.87)) + Y * (d[0] * 0.5 + nrm[0] * sg * 0.87)
            prong = np.maximum(prong, np.where((u > 0) & (u < 5), (1 - u / 5) * np.exp(-v ** 2 / 0.8), 0) * 0.8)
    fld = np.maximum.reduce([core, cone * 1.05, prong])
    img = shade(fld, FLASH, thr, cut=0.16)
    return img, w // 2, h // 2


# ---------------------------------------------------------------- tracer (8 directions)
def tracer(a):
    Lt = 22
    w = h = 2 * Lt + 6
    X, Y, thr = grid(w, h, w / 2, h / 2)
    d = screen_dir(a); nrm = np.array([-d[1], d[0]])
    t = -(X * d[0] + Y * d[1]); s = X * nrm[0] + Y * nrm[1]       # t grows back along the tail
    on = (t > -1.0) & (t < Lt) & (np.abs(s) < 0.75)
    head = (t > -1.2) & (t < 2.2) & (np.abs(s) < 1.25)
    fld = np.where(on, 0.9 - 0.75 * np.clip(t / Lt, 0, 1), 0)
    fld = np.where(head, 1.0, fld)
    alpha = np.where(head, 1.0, 1.15 - t / Lt)
    img = shade(fld, FLASH, thr, cut=0.05, alpha=alpha)
    return img, w // 2, h // 2


# ---------------------------------------------------------------- smoke puff (8 frames)
def smoke(f, n=8, dark=False):
    w, h = 36, 40
    k = f / (n - 1)
    X, Y, thr = grid(w, h, w / 2, h - 4)
    fld = np.full_like(X, -9.0)
    R = 4.0 + 10.0 * k ** 0.7
    rise = 14.0 * k
    for i, (ox, oy, r) in enumerate(((0, 0, 1.0), (-0.55, 0.25, 0.7), (0.6, 0.2, 0.75), (0.1, -0.5, 0.65))):
        cx, cy = ox * R, -rise - R * 0.8 + oy * R
        rr = r * R
        dd = np.sqrt((X - cx) ** 2 + (Y - cy) ** 2) / rr
        fld = np.maximum(fld, 1 - dd)
    nz = noise2(X + 40, Y + 40 + f * 3, 7, 3.5)
    body = fld + (nz - 0.5) * 0.35
    # light from the upper left: lighter on that side of each puff
    lightk = np.clip(0.55 - (X + Y) / (3.2 * R + 1), 0, 1)
    tone = np.clip(0.25 + 0.6 * lightk + 0.25 * body, 0, 1)
    alpha = np.where(body > 0.04, 1.25 - k * 1.05, 0)
    img = shade(np.where(body > 0.04, tone, 0), DARK_SMOKE if dark else SMOKE, thr, cut=0.02, alpha=alpha)
    return img, w // 2, h - 4


# ---------------------------------------------------------------- fire (looping, two sizes)
def fire(f, n=6, size='small'):
    w, h, fw, fh = (18, 28, 6.5, 22.0) if size == 'small' else (34, 46, 13.0, 38.0)
    X, Y, thr = grid(w, h, w / 2, h - 2)
    ph = 2 * np.pi * f / n
    up = -Y                                                         # height above the base
    # flame height per column: a few travelling waves, periodic over n frames so the loop is seamless
    tops = fh * (0.62 + 0.18 * np.sin(X * 0.9 + ph) + 0.12 * np.sin(X * 1.7 - 2 * ph + 1.3)
                 + 0.08 * np.sin(X * 2.9 + 3 * ph))
    width = fw * (1 - np.clip(up / (fh * 1.05), 0, 1) ** 1.3)
    inside = (np.abs(X + 1.2 * np.sin(up * 0.25 - ph)) < width) & (up < tops) & (up > -1.5)
    heat = np.clip(1 - np.abs(X) / (fw + 0.5), 0, 1) * np.clip(1 - up / (tops + 0.01), 0, 1)
    fld = np.where(inside, 0.15 + 0.95 * heat, 0)
    # loose embers / tongues breaking off above the body
    img = outline(shade(fld, FIRE, thr, cut=0.1), C('brick', 1))
    for e in range(3):
        ey = -((f + e * 2) % n) / n * fh * 0.5 - fh * 0.75
        ex = np.sin(e * 2.1 + ph) * fw * 0.6
        em = (np.abs(X - ex) < 0.8) & (np.abs(Y - ey) < 0.8 + (size != 'small')) & (img[..., 3] == 0)
        img[em, :3] = FIRE[3 + (e % 2)]; img[em, 3] = 255
    return img, w // 2, h - 2


# ---------------------------------------------------------------- explosion (10 frames, one shot)
def explosion(f):
    w, h = 84, 80
    cx, cy = w / 2, h - 14
    X, Y, thr = grid(w, h, cx, cy)
    if f == 0:   # white flash
        r = np.sqrt(X ** 2 + (Y * 1.2 + 6) ** 2)
        fld = np.clip(1.15 - r / 11.0, 0, 1)
        img = shade(fld, FLASH, thr, cut=0.1)
        return img, int(cx), int(cy)
    k = (f - 1) / 8.0                               # 0 .. 1 over frames 1-9
    R = 12 + 22 * (1 - (1 - k) ** 2)
    lift = 26 * k
    nz = noise2(X + 100, Y + 100 - f * 4, 3, 5.0) * 0.6 + noise2(X, Y - f * 2, 9, 2.5) * 0.4
    # the fireball: a squashed sphere on the ground that lifts into a rising cloud
    dx, dy = X, (Y + lift + R * 0.35) * 1.15
    rr = np.sqrt(dx ** 2 + dy ** 2) / R
    blob = 1 - rr + (nz - 0.5) * 0.55
    # a debris ring along the ground for the first frames
    ring = np.zeros_like(X)
    if f <= 4:
        g = np.sqrt(X ** 2 + (Y * 2) ** 2)
        rad = 14 + f * 7
        ring = np.where(np.abs(g - rad) < 2.2, 0.75, 0) * (noise2(X, Y, 5 + f, 1.6) > 0.55)
    heat = np.clip(1.25 - 1.15 * k - rr * 0.7, 0, 1)
    smoke_k = np.clip((k - 0.3) / 0.6, 0, 1)
    out = np.zeros((h, w, 4), np.uint8)
    body = blob > 0.02
    fire_px = body & (heat + (nz - 0.5) * 0.3 > 0.25 + 0.7 * smoke_k)
    lightk = np.clip(0.55 - (X + Y + lift) / (3.0 * R + 1), 0, 1)
    sm = shade(np.where(body, np.clip(0.2 + 0.6 * lightk + 0.2 * blob, 0, 1), 0), DARK_SMOKE, thr, cut=0.01,
               alpha={7: 0.85, 8: 0.6, 9: 0.35}.get(f, 1.0))
    fi = shade(np.where(fire_px, np.clip(heat * 1.1, 0.05, 1), 0), FIRE, thr, cut=0.02)
    out = np.where(sm[..., 3:4] > 0, sm, out)
    out = np.where(fi[..., 3:4] > 0, fi, out)
    if f < 8:
        out = outline(out, C('night', 0))
    rg = shade(ring, SMOKE, thr, cut=0.1)                   # dust kicked up along the ground, no outline
    out = np.where((rg[..., 3:4] > 0) & (out[..., 3:4] == 0), rg, out)
    return out, int(cx), int(cy)


# ---------------------------------------------------------------- hit spark (4 frames)
RAYS = [(0.3, 1.0), (1.4, 0.7), (2.3, 0.9), (3.5, 0.6), (4.3, 1.0), (5.4, 0.8)]


def hit_spark(f):
    w = h = 20
    X, Y, thr = grid(w, h, w / 2, h / 2)
    r = np.sqrt(X ** 2 + Y ** 2); th = np.arctan2(Y, X)
    fld = np.zeros_like(X)
    for ang, ln in RAYS:
        dth = np.abs((th - ang + np.pi) % (2 * np.pi) - np.pi)
        on = dth * r < 0.7
        L = ln * (3.5, 7.0, 8.5, 9.0)[f]
        r0 = (0.0, 1.0, 4.5, 7.0)[f]
        fld = np.where(on & (r >= r0) & (r <= L), np.maximum(fld, 1 - (r - r0) / (L - r0 + 0.5) * 0.6 - f * 0.12), fld)
    if f == 0:
        fld = np.maximum(fld, np.clip(1 - r / 2.6, 0, 1))
    img = shade(fld, SPARK, thr, cut=0.05)
    return img, w // 2, h // 2


# ---------------------------------------------------------------- light pools (additive)
BANDS = (0.62, 0.42, 0.26, 0.12)


def pool(rx, ry, col, level=1.0, hot=None):
    """A ground light pool: an iso ellipse in 4 flat alpha bands, dithered at each band edge."""
    w, h = int(2 * rx + 4), int(2 * ry + 4)
    X, Y, thr = grid(w, h, w / 2, h / 2)
    r = np.sqrt((X / rx) ** 2 + (Y / ry) ** 2)
    pos = np.clip(r, 0, 1) * len(BANDS)
    lo = np.floor(pos)
    band = np.clip(lo + ((pos - lo) > (1 - thr)), 0, len(BANDS)).astype(int)
    a = np.array(BANDS + (0.0,))[band] * level
    img = np.zeros((h, w, 4), np.uint8)
    img[..., :3] = col
    if hot is not None:
        img[band == 0, :3] = hot
    img[..., 3] = (np.clip(a, 0, 1) * 255).astype(np.uint8)
    return img, w // 2, h // 2


def siren_glow(col, hot, f):
    return pool(60, 30, col, (1.0, 0.7, 0.4)[f], hot)


def siren_flare(col, hot, f):
    """The flash at the light bar itself: a small 4-point star, drawn additively over the car."""
    w, h = 22, 14
    X, Y, thr = grid(w, h, w / 2, h / 2)
    k = (1.0, 0.6)[f]
    star = np.maximum(np.exp(-(Y ** 2) / 0.6) * np.clip(1 - np.abs(X) / (10 * k), 0, 1),
                      np.exp(-(X ** 2) / 0.5) * np.clip(1 - np.abs(Y) / (6 * k), 0, 1))
    star = np.maximum(star, np.clip(1 - np.sqrt(X ** 2 + (Y * 1.6) ** 2) / (4 * k), 0, 1))
    img = np.zeros((h, w, 4), np.uint8)
    img[..., :3] = col
    img[star > 0.6, :3] = hot
    a = np.where(star > 0.6, 1.0, np.where(star > 0.3, 0.6, np.where(star > 0.12, 0.3, 0)))
    img[..., 3] = (a * 255).astype(np.uint8)
    return img, w // 2, h // 2


# ---------------------------------------------------------------- rain splash (4 frames)
def rain_splash(f):
    w, h = 12, 8
    img = np.zeros((h, w, 4), np.uint8)
    cx, cy = 6, 5
    pts = {0: [(0, 0), (0, -1)],
           1: [(-2, 0), (2, 0), (-1, -2), (1, -2), (0, -3)],
           2: [(-3, 0), (3, 0), (-2, -1), (2, -1), (-3, -3), (3, -3)],
           3: [(-4, 0), (4, 0), (-2, 1), (2, 1), (0, 1), (-2, -1), (2, -1)]}[f]
    for i, (dx, dy) in enumerate(pts):
        img[cy + dy, cx + dx, :3] = RAIN[i % 2]
        img[cy + dy, cx + dx, 3] = 150 if f < 3 else 100
    return img, cx, cy


# ---------------------------------------------------------------- the catalogue
RED, RED_HOT = C('red', 4), C('red', 5)
BLUE, BLUE_HOT = C('navy', 4), C('navy', 5)
WARM, WARM_HOT = C('white', 4), C('white', 5)


def catalogue():
    """[(row label, [(frame key, img, ax, ay), ...])], plus the animation table."""
    rows, anims = [], {}
    for a, d in enumerate(DIRS):
        rows.append((f'muzzle_flash/{d}', [(f'muzzle_flash/{d}/{f}', *muzzle_flash(a, f)) for f in range(2)]))
    anims['muzzle_flash'] = {'frames': 2, 'fps': 30, 'loop': False, 'per_direction': True,
                             'anchor': 'barrel tip; draw over the shooter, 1-2 frames per shot'}
    rows.append(('tracer', [(f'tracer/{d}', *tracer(a)) for a, d in enumerate(DIRS)]))
    anims['tracer'] = {'frames': 1, 'per_direction': True, 'anchor': 'the bright head; move it along the shot for ~0.1 s'}
    rows.append(('smoke', [(f'smoke/{f}', *smoke(f)) for f in range(8)]))
    rows.append(('smoke_dark', [(f'smoke_dark/{f}', *smoke(f, dark=True)) for f in range(8)]))
    anims['smoke'] = {'frames': 8, 'fps': 8, 'loop': False, 'anchor': 'spawn point on the ground; the puff rises and thins'}
    anims['smoke_dark'] = {'frames': 8, 'fps': 8, 'loop': False, 'anchor': 'as smoke: wrecks, engine fires, after explosions'}
    rows.append(('fire_small', [(f'fire_small/{f}', *fire(f, size='small')) for f in range(6)]))
    rows.append(('fire_large', [(f'fire_large/{f}', *fire(f, size='large')) for f in range(6)]))
    anims['fire_small'] = {'frames': 6, 'fps': 10, 'loop': True, 'anchor': 'base of the flame on the burning surface'}
    anims['fire_large'] = {'frames': 6, 'fps': 10, 'loop': True, 'anchor': 'base of the flame'}
    rows.append(('explosion', [(f'explosion/{f}', *explosion(f)) for f in range(10)]))
    anims['explosion'] = {'frames': 10, 'fps': 14, 'loop': False, 'anchor': 'ground point of the blast; follow with smoke_dark + fire_large'}
    rows.append(('hit_spark', [(f'hit_spark/{f}', *hit_spark(f)) for f in range(4)]))
    anims['hit_spark'] = {'frames': 4, 'fps': 24, 'loop': False, 'anchor': 'impact point (bullet on metal, wall, ground)'}
    rows.append(('siren', [(f'siren_glow_red/{f}', *siren_glow(RED, RED_HOT, f)) for f in range(3)]
                 + [(f'siren_glow_blue/{f}', *siren_glow(BLUE, BLUE_HOT, f)) for f in range(3)]))
    rows.append(('siren_flare', [(f'siren_flare_red/{f}', *siren_flare(RED, RED_HOT, f)) for f in range(2)]
                 + [(f'siren_flare_blue/{f}', *siren_flare(BLUE, BLUE_HOT, f)) for f in range(2)]))
    anims['siren_glow_red'] = anims['siren_glow_blue'] = {
        'frames': 3, 'fps': 8, 'loop': True, 'blend': 'ADD',
        'anchor': 'ground under the light bar; alternate red and blue (red 0-1-2 while blue 2-1-0)'}
    anims['siren_flare_red'] = anims['siren_flare_blue'] = {'frames': 2, 'fps': 8, 'loop': True, 'blend': 'ADD',
                                                            'anchor': 'the light bar on the roof'}
    rows.append(('searchlight', [('searchlight/0', *pool(44, 22, WARM, 0.9, WARM_HOT))]))
    anims['searchlight'] = {'frames': 1, 'blend': 'ADD', 'anchor': 'centre of the helicopter searchlight pool on the ground'}
    rows.append(('rain_splash', [(f'rain_splash/{f}', *rain_splash(f)) for f in range(4)]))
    anims['rain_splash'] = {'frames': 4, 'fps': 16, 'loop': False, 'anchor': 'where the drop hits the ground'}
    return rows, anims


def pack():
    rows, anims = catalogue()
    cells = [(max(im.shape[1] for _, im, _, _ in r) + 2, max(im.shape[0] for _, im, _, _ in r) + 2) for _, r in rows]
    width = max(cw * len(r) for (cw, _), (_, r) in zip(cells, rows))
    height = sum(ch for _, ch in cells)
    sheet = np.zeros((height, width, 4), np.uint8)
    frames = {}
    y = 0
    for (cw, ch), (_, r) in zip(cells, rows):
        for ci, (key, im, ax, ay) in enumerate(r):
            hh, ww = im.shape[:2]
            fx = ci * cw + (cw - ww) // 2; fy = y + (ch - hh) // 2
            sheet[fy:fy + hh, fx:fx + ww] = im
            frames[key] = {'x': ci * cw, 'y': y, 'w': cw, 'h': ch, 'anchor': [fx - ci * cw + ax, fy - y + ay]}
        y += ch
    meta = {'image': 'effects.png', 'cell': [max(c[0] for c in cells), max(c[1] for c in cells)],
            'note': ("Effects. Frame keys: <effect>/<frame> or <effect>/<dir>/<frame> (dirs " + ','.join(DIRS) +
                     "). anchor = the effect's origin (see anims.<effect>.anchor). Rows have their own cell sizes; "
                     "use each frame's rect. blend ADD = draw with additive blending (light pools)."),
            'anims': anims, 'frames': frames}
    Image.fromarray(sheet, 'RGBA').save(os.path.join(ROOT, 'effects.png'))
    json.dump(meta, open(os.path.join(ROOT, 'effects.json'), 'w'), indent=1)
    return sheet, meta, rows


def flat(img, bg=(146, 141, 154)):
    a = img[..., 3:4] / 255.0
    out = np.zeros(img.shape[:2] + (3,), np.uint8); out[...] = bg
    return (img[..., :3] * a + out * (1 - a)).astype(np.uint8)


def previews(sheet, rows):
    os.makedirs(DRAFTS, exist_ok=True)
    # contact sheet at 3x on the lavender ground and on a dusk ground, side by side
    day = flat(sheet); dusk = flat(sheet, (62, 52, 72))
    both = np.concatenate([day, np.zeros((day.shape[0], 6, 3), np.uint8), dusk], 1)
    Image.fromarray(both).resize((both.shape[1] * 3, both.shape[0] * 3), Image.NEAREST).save(os.path.join(DRAFTS, 'effects_sheet.png'))
    demo_scene()


def _blit(canvas, im, ox, oy, ax, ay, add=False, tint=None):
    y0, x0 = ay - oy, ax - ox
    if y0 < 0:
        im = im[-y0:]; y0 = 0
    if x0 < 0:
        im = im[:, -x0:]; x0 = 0
    im = im[:canvas.shape[0] - y0, :canvas.shape[1] - x0]
    h, w = im.shape[:2]
    reg = canvas[y0:y0 + h, x0:x0 + w].astype(float)
    a = im[..., 3:4] / 255.0
    src = im[..., :3].astype(float)
    if tint is not None:
        src = src * np.array(tint)
    if add:
        reg = np.clip(reg + src * a, 0, 255)
    else:
        reg = src * a + reg * (1 - a)
    canvas[y0:y0 + h, x0:x0 + w] = reg.astype(np.uint8)


def demo_scene():
    """Effects in context, at rainy dusk and day: a police cruiser with its siren glow and flare, a burning
    wreck with smoke, an explosion, a gunshot with tracer and hit spark, the helicopter searchlight."""
    veh = Image.open(os.path.join(ROOT, 'vehicles.png')).convert('RGBA'); vj = json.load(open(os.path.join(ROOT, 'vehicles.json')))
    chs = Image.open(os.path.join(ROOT, 'characters.png')).convert('RGBA'); cj = json.load(open(os.path.join(ROOT, 'characters.json')))
    fx = Image.open(os.path.join(ROOT, 'effects.png')).convert('RGBA'); fj = json.load(open(os.path.join(ROOT, 'effects.json')))

    def fr(img, j, k):
        f = j['frames'][k]
        return np.array(img.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h']))), f['anchor'][0], f['anchor'][1]

    for mood, ground, mul in (('dusk', (70, 62, 82), (0.66, 0.66, 0.80)), ('day', (146, 141, 154), None)):
        W, Hh = 420, 200
        cv = np.zeros((Hh, W, 3), np.uint8); cv[...] = ground
        # a few diamond paving lines so the pools read as lying on the ground
        for yy in range(0, Hh, 16):
            for xx in range(W):
                for y2 in ((yy + xx // 2) % Hh, (yy - xx // 2) % Hh):
                    cv[y2, xx] = np.clip(np.array(ground) * 0.9, 0, 255)
        tint = mul
        # police cruiser: glow pools under it, car, flare on the bar
        _blit(cv, *fr(fx, fj, 'siren_glow_red/0'), 64, 122, add=True)
        _blit(cv, *fr(fx, fj, 'siren_glow_blue/2'), 104, 136, add=True)
        _blit(cv, *fr(veh, vj, 'police_car/SE'), 84, 128, tint=tint)
        _blit(cv, *fr(fx, fj, 'siren_flare_red/0'), 81, 96, add=True)
        # burning wreck (the beater) with fire and dark smoke
        _blit(cv, *fr(veh, vj, 'beater_brick/SW'), 190, 120, tint=(0.55, 0.5, 0.55) if tint is None else (0.4, 0.38, 0.48))
        _blit(cv, *fr(fx, fj, 'smoke_dark/5'), 186, 84)
        _blit(cv, *fr(fx, fj, 'fire_large/2'), 188, 112)
        _blit(cv, *fr(fx, fj, 'fire_small/4'), 204, 118)
        # explosion
        _blit(cv, *fr(fx, fj, 'explosion/3'), 290, 150)
        # a shooter, muzzle flash and tracer heading SE, a spark at the far end
        pk = next(k for k in cj['frames'] if k.endswith('/idle/SE'))
        _blit(cv, *fr(chs, cj, pk), 300, 80, tint=tint)
        _blit(cv, *fr(fx, fj, 'muzzle_flash/E/0'), 316, 60)
        _blit(cv, *fr(fx, fj, 'tracer/E'), 352, 60)
        _blit(cv, *fr(fx, fj, 'hit_spark/1'), 396, 60)
        # searchlight pool
        _blit(cv, *fr(fx, fj, 'searchlight/0'), 380, 160, add=True)
        Image.fromarray(cv).resize((W * 3, Hh * 3), Image.NEAREST).save(os.path.join(DRAFTS, f'effects_in_scene_{mood}_3x.png'))


if __name__ == '__main__':
    sheet, meta, rows = pack()
    previews(sheet, rows)
    print('packed', sheet.shape, len(meta['frames']), 'frames')

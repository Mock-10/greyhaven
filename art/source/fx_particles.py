"""Small particle sprites for the runtime effects layer (src/fx/): footstep and wheel dust, exhaust puffs, tyre
smoke, sparks, cash glints, glass chips, leaves, paper scraps, rain streaks, rain splashes and puddle ripples,
and skid-mark decals.

Like art/source/effects.py (the big effects: fire, explosions, siren glow), these are drawn straight into pixels
on the 1x grid: a scalar field snapped to a palette ramp with the 4x4 Bayer dithering the renderer uses, and
faded by dithering pixels away rather than by smooth alpha (STYLE_GUIDE "Light and shading"). Light comes from
the upper left, so puffs are lighter on that side. Gold appears only on the cash glint (valuables).

Run `python3 art/source/fx_particles.py` to write art/fx.png/.json and art/drafts/fx/fx_sheet_4x.png."""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
from sdf import RAMP_HEX, BAYER, H

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIRS = ['SE', 'S', 'SW', 'W', 'NW', 'N', 'NE', 'E']


def C(ramp, i):
    return H(RAMP_HEX[ramp][i])


DUST = [C('stone', 5), C('stone', 4), C('khaki', 4), C('khaki', 3), C('wood', 3)]
PUFF = [C('lavlt', 5), C('lavlt', 4), C('lavlt', 3), C('lav', 3)]
TYRE = [C('white', 5), C('lavlt', 5), C('lavlt', 4), C('lavlt', 3), C('lav', 3)]
SPARK = [C('white', 5), C('stone', 5), C('clay', 5), C('clay', 4)]
GOLD = [C('gold', 5), C('gold', 4), C('gold', 3)]
GLASS = [C('glass', 5), C('glass', 4), C('glass', 3), C('glass', 2)]
LEAF = [[C('sage', 4), C('sage', 3), C('sage', 2)], [C('khaki', 4), C('khaki', 3), C('clay', 2)]]
PAPER = [C('white', 5), C('white', 4), C('stone', 4)]
RAIN = [C('lavlt', 5), C('lavlt', 4), C('glass', 5)]
SKID = [C('asph', 0), C('night', 0)]


def grid(w, h, cx, cy):
    yy, xx = np.mgrid[0:h, 0:w]
    return xx - cx + 0.5, yy - cy + 0.5, BAYER[yy % 4, xx % 4]


def shade(field, ramp, thr, cut=0.08, alpha=None):
    """field in [0,1] (1 = lightest). Pixels at or below `cut` vanish; `alpha` thins by dithering pixels away."""
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


def noise(x, y, seed, scale):
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


def puff(f, n, w, h, r0, r1, ramp, seed, fade=1.0, squash=1.0):
    """A soft round puff that grows from r0 to r1 and thins out over n frames (anchor at its centre)."""
    k = f / (n - 1)
    X, Y, thr = grid(w, h, w / 2, h / 2)
    R = r0 + (r1 - r0) * k ** 0.6
    fld = np.full_like(X, -9.0)
    for ox, oy, r in ((0, 0, 1.0), (-0.5, 0.25, 0.7), (0.55, 0.2, 0.7), (0.1, -0.45, 0.62)):
        dd = np.sqrt((X - ox * R) ** 2 + ((Y - oy * R) / squash) ** 2) / (r * R)
        fld = np.maximum(fld, 1 - dd)
    body = fld + (noise(X + 30, Y + 30 + f * 2, seed, 2.5) - 0.5) * 0.4
    lightk = np.clip(0.6 - (X + Y) / (3.0 * R + 1), 0, 1)
    tone = np.clip(0.3 + 0.55 * lightk + 0.2 * body, 0, 1)
    alpha = np.where(body > 0.05, 1.0 - np.clip((k - 0.3) / 0.7, 0, 1) * fade, 0)
    return shade(np.where(body > 0.05, tone, 0), ramp, thr, cut=0.02, alpha=alpha), w // 2, h // 2


def dust(f):
    return puff(f, 6, 16, 14, 1.6, 5.0, DUST, 3, fade=0.95, squash=0.7)


def exhaust(f):
    return puff(f, 6, 14, 14, 1.4, 4.4, PUFF, 5, fade=0.95)


def tyre(f):
    return puff(f, 7, 28, 24, 2.5, 8.5, TYRE, 9, fade=0.95, squash=0.8)


def spark(f):
    """A hot point that cools: 3x3 cross, then 2 px, then a single dull pixel."""
    w = h = 5
    img = np.zeros((h, w, 4), np.uint8)
    pts = {0: [(2, 2, 0), (1, 2, 1), (3, 2, 1), (2, 1, 1), (2, 3, 1)], 1: [(2, 2, 1), (3, 2, 2)], 2: [(2, 2, 3)]}[f]
    for x, y, c in pts:
        img[y, x, :3] = SPARK[c]; img[y, x, 3] = 255
    return img, 2, 2


def glint(f):
    """Cash sparkle (valuables may use gold): a cross that flares and shrinks."""
    w = h = 9
    img = np.zeros((h, w, 4), np.uint8)
    arm = [1, 3, 2, 1][f]
    img[4, 4, :3] = C('white', 5) if f in (1, 2) else GOLD[0]; img[4, 4, 3] = 255
    for d in range(1, arm + 1):
        col = GOLD[min(d - 1, 2)]
        for x, y in ((4 + d, 4), (4 - d, 4), (4, 4 + d), (4, 4 - d)):
            img[y, x, :3] = col; img[y, x, 3] = 255
    if f == 2:
        for x, y in ((3, 3), (5, 5), (3, 5), (5, 3)):
            img[y, x, :3] = GOLD[2]; img[y, x, 3] = 255
    return img, 4, 4


def chip(f):
    """A tumbling glass or plastic chip: four rotations of a small shard."""
    shapes = [['.#.', '##.', '...'], ['##.', '.#.', '...'], ['.##', '...', '...'], ['#..', '##.', '...']]
    rows = shapes[f]
    img = np.zeros((3, 3, 4), np.uint8)
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch == '#':
                img[y, x, :3] = GLASS[(x + y + f) % 3]; img[y, x, 3] = 255
    return img, 1, 1


def leaf(f, kind):
    shapes = [['.##', '##.'], ['#.', '##', '.#'], ['##.', '.##'], ['.#', '##', '#.']]
    rows = shapes[f]
    h, w = len(rows), len(rows[0])
    img = np.zeros((h, w, 4), np.uint8)
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch == '#':
                img[y, x, :3] = LEAF[kind][(x + y) % 2 + (f % 2)]; img[y, x, 3] = 255
    return img, w // 2, h // 2


def paper(f):
    """A paper scrap flipping over: wide, edge-on, wide (back side), edge-on."""
    shapes = [['###', '###'], ['###'], ['##', '##', '##'], ['#', '#']]
    rows = shapes[f]
    h, w = len(rows), len(rows[0])
    img = np.zeros((h, w, 4), np.uint8)
    for y, r in enumerate(rows):
        for x in range(w):
            img[y, x, :3] = PAPER[0 if f == 0 else (1 if f == 2 else 2)]; img[y, x, 3] = 255
    return img, w // 2, h // 2


def streak(v):
    """A falling rain streak, slanted down-left like the reference rainy dusk (STYLE_GUIDE: 3-6 px, #bcafb6)."""
    L = [4, 6][v]
    w, h = L // 2 + 1, L
    img = np.zeros((h, w, 4), np.uint8)
    for y in range(h):
        x = w - 1 - y // 2
        img[y, x, :3] = H('#bcafb6'); img[y, x, 3] = 255
    return img, 0, h - 1


def splash(f):
    """A raindrop hitting the ground: a tiny crown, then a ring that spreads flat (iso ellipse) and fades."""
    w, h = 13, 9
    X, Y, thr = grid(w, h, w / 2, h - 3)
    img = np.zeros((h, w, 4), np.uint8)
    if f == 0:
        for x, y, c in ((6, 4, 0), (5, 4, 1), (7, 4, 1), (6, 3, 0), (5, 2, 1), (7, 2, 1)):
            img[y, x, :3] = RAIN[c]; img[y, x, 3] = 255
        return img, 6, 6
    r = [0, 2.2, 3.8, 5.2][f]
    e = np.sqrt(X ** 2 + (Y * 2) ** 2)
    ring = np.abs(e - r) < 0.75
    alpha = np.full_like(X, [1, 1.0, 0.7, 0.4][f])
    keep = ring & (alpha > thr)
    img[keep, :3] = RAIN[1 if f < 3 else 2]; img[keep, 3] = 255
    if f == 1:
        for x, y in ((4, 2), (8, 2)):
            img[y, x, :3] = RAIN[0]; img[y, x, 3] = 255
    return img, 6, 6


def skid(a):
    """A short dark tyre mark along on-screen direction a (0 = SE), drawn flat on the ground."""
    t = a * np.pi / 4
    d = np.array([np.cos(t) - np.sin(t), (np.cos(t) + np.sin(t)) / 2])
    d = d / np.linalg.norm(d)
    w = h = 11
    X, Y, thr = grid(w, h, w / 2, h / 2)
    along = X * d[0] + Y * d[1]
    across = -X * d[1] + Y * d[0]
    on = (np.abs(along) < 4.6) & (np.abs(across) < 1.0)
    alpha = 1.0 - np.abs(along) / 6.0
    keep = on & (alpha > thr * 0.9)
    img = np.zeros((h, w, 4), np.uint8)
    img[keep, :3] = SKID[0]; img[keep, 3] = 255
    return img, 5, 5


def frames():
    out = {}
    for f in range(6):
        out[f'dust/{f}'] = dust(f)
        out[f'exhaust/{f}'] = exhaust(f)
    for f in range(7):
        out[f'tyre/{f}'] = tyre(f)
    for f in range(3):
        out[f'spark/{f}'] = spark(f)
    for f in range(4):
        out[f'glint/{f}'] = glint(f)
        out[f'chip/{f}'] = chip(f)
        out[f'leaf/{f}'] = leaf(f, 0)
        out[f'leaf_dry/{f}'] = leaf(f, 1)
        out[f'paper/{f}'] = paper(f)
        out[f'splash/{f}'] = splash(f)
    for v in range(2):
        out[f'streak/{v}'] = streak(v)
    for a, dn in enumerate(DIRS):
        out[f'skid/{dn}'] = skid(a)
    return out


ANIMS = {
    'dust': {'frames': 6, 'note': 'footsteps, sprint starts and wheels on dirt; grows and thins (anchor: centre)'},
    'exhaust': {'frames': 6, 'note': 'tailpipe puff; drift up and back'},
    'tyre': {'frames': 7, 'note': 'tyre smoke from hard braking and skids'},
    'spark': {'frames': 3, 'note': 'hot point that cools (hotwire, metal hits, scrapes)'},
    'glint': {'frames': 4, 'note': 'cash sparkle; valuables only (gold)'},
    'chip': {'frames': 4, 'note': 'tumbling glass/plastic shard (crashes); cycle the frames while it flies'},
    'leaf': {'frames': 4, 'note': 'falling leaf, cycle while it drifts'},
    'leaf_dry': {'frames': 4, 'note': 'dry leaf'},
    'paper': {'frames': 4, 'note': 'paper scrap flipping'},
    'splash': {'frames': 4, 'note': 'raindrop hitting the ground (anchor: impact point)'},
    'streak': {'frames': 2, 'note': 'rain streak variants (anchor: bottom end); draw at ~45% opacity'},
    'skid': {'frames': 1, 'per_direction': True, 'note': 'tyre-mark decal on the ground, fades slowly'},
}


def pack(fr):
    """Shelf-pack frames (sorted by height) into one sheet; returns (sheet, json frames)."""
    keys = sorted(fr, key=lambda k: (-fr[k][0].shape[0], k))
    W = 128
    x = y = shelf = 0
    pos = {}
    for k in keys:
        im = fr[k][0]
        h, w = im.shape[:2]
        if x + w + 1 > W:
            x, y, shelf = 0, y + shelf + 1, 0
        pos[k] = (x, y)
        x += w + 1
        shelf = max(shelf, h)
    Ht = y + shelf
    sheet = np.zeros((Ht, W, 4), np.uint8)
    out = {}
    for k in sorted(fr):
        im, ax, ay = fr[k]
        h, w = im.shape[:2]
        px, py = pos[k]
        sheet[py:py + h, px:px + w] = im
        out[k] = {'x': px, 'y': py, 'w': w, 'h': h, 'anchor': [int(ax), int(ay)]}
    return sheet, out


def preview(fr, path, scale=4):
    groups = {}
    for k in fr:
        groups.setdefault(k.split('/')[0], []).append(k)
    rows = list(groups.values())
    cw, ch = 28, 22
    W = cw * max(len(r) for r in rows)
    Hh = ch * len(rows)
    bg = np.zeros((Hh, W, 4), np.uint8)
    bg[...] = (*H(RAMP_HEX['asph'][2]), 255)
    for ri, r in enumerate(rows):
        for ci, k in enumerate(r):
            im = fr[k][0]
            h, w = im.shape[:2]
            ox, oy = ci * cw + (cw - w) // 2, ri * ch + (ch - h) // 2
            a = im[..., 3:4] / 255.0
            bg[oy:oy + h, ox:ox + w, :3] = (im[..., :3] * a + bg[oy:oy + h, ox:ox + w, :3] * (1 - a)).astype(np.uint8)
    Image.fromarray(bg, 'RGBA').resize((W * scale, Hh * scale), Image.NEAREST).save(path)


def main():
    fr = frames()
    sheet, js = pack(fr)
    Image.fromarray(sheet, 'RGBA').save(os.path.join(ROOT, 'fx.png'), optimize=True)
    json.dump({'image': 'fx.png', 'cell': [0, 0],
               'note': 'Particle sprites for src/fx (art/source/fx_particles.py). Frame keys <kind>/<frame> or '
                       'skid/<DIR>; each frame has its own rect and anchor. Faded by dithering, never smooth alpha, '
                       'except the rain streaks (drawn at ~45%).',
               'anims': ANIMS, 'frames': js}, open(os.path.join(ROOT, 'fx.json'), 'w'), indent=1)
    os.makedirs(os.path.join(ROOT, 'drafts', 'fx'), exist_ok=True)
    preview(fr, os.path.join(ROOT, 'drafts', 'fx', 'fx_sheet_4x.png'))
    print('packed', len(js), 'frames', sheet.shape)


if __name__ == '__main__':
    main()

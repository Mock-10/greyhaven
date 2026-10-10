"""Compose a 20x20-tile district: downtown plaza, corner store, suburbs, industrial yard."""
import os, sys as _s; _s.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sys, warnings
warnings.filterwarnings('ignore')
import numpy as np
from PIL import Image, ImageDraw
import cache
from sdf import highlight, to_image
import ground2d as G

N = 28
T = 32
LX, LY, LZ = 0.22, 0.58, 0.78         # light (matches sdf.LIGHT)

# ------------------------------------------------------------------ tiny 3x5 pixel font
FONT = {
    'A': ['010', '101', '111', '101', '101'], 'B': ['110', '101', '110', '101', '110'], 'C': ['011', '100', '100', '100', '011'],
    'D': ['110', '101', '101', '101', '110'], 'E': ['111', '100', '110', '100', '111'], 'G': ['011', '100', '101', '101', '011'],
    'H': ['101', '101', '111', '101', '101'], 'I': ['111', '010', '010', '010', '111'], 'K': ['101', '101', '110', '101', '101'],
    'L': ['100', '100', '100', '100', '111'], 'M': ['101', '111', '111', '101', '101'], 'N': ['110', '101', '101', '101', '101'],
    'O': ['010', '101', '101', '101', '010'], 'P': ['110', '101', '110', '100', '100'], 'R': ['110', '101', '110', '101', '101'],
    'S': ['011', '100', '010', '001', '110'], 'T': ['111', '010', '010', '010', '010'], 'U': ['101', '101', '101', '101', '011'],
    'W': ['101', '101', '111', '111', '101'], 'Y': ['101', '101', '010', '010', '010'], ' ': ['000'] * 5,
    '$': ['011', '110', '010', '011', '110'],
}


from pixfont import text_px  # full font


def prompt(key, label):
    """Interaction prompt: [E] keycap + label on a dark rounded plate with a gold edge."""
    kt = text_px(key); lt = text_px(label)
    w = 3 + 7 + 3 + lt.shape[1] + 4
    h = 11
    img = np.zeros((h + 3, w, 4), np.uint8)
    plate = (45, 34, 46, 235); edge = (185, 143, 58, 255); gold = (239, 212, 134, 255); cream = (238, 233, 232, 255)
    img[1:h - 1, 0:w] = plate; img[0:h, 1:w - 1] = plate
    img[0, 1:w - 1] = edge; img[h - 1, 1:w - 1] = edge; img[1:h - 1, 0] = edge; img[1:h - 1, w - 1] = edge
    # pointer
    cx = w // 2
    img[h, cx - 2:cx + 3] = edge; img[h + 1, cx - 1:cx + 2] = edge; img[h + 2, cx] = edge
    img[h - 1, cx - 1:cx + 2] = plate
    # keycap
    img[2:9, 3:10] = gold; img[8, 3:10] = (148, 111, 46, 255)
    ys, xs = np.nonzero(kt)
    img[3 + ys, 5 + xs] = (45, 34, 46, 255)
    ys, xs = np.nonzero(lt)
    img[3 + ys, 13 + xs] = cream
    return img


# ------------------------------------------------------------------ map
ROAD = range(12, 16)
WALK = (10, 11, 16, 17)
LANE = {12: 'e0', 13: 'c1', 14: 'c0', 15: 'e1'}


def build_tiles():
    tiles = {}
    for i in range(N):
        for j in range(N):
            if i in ROAD and j in ROAD:
                k = 'manhole' if (i, j) == (13, 14) else 'asphalt'
            elif j in ROAD:
                k = 'crosswalk_x' if i in (11, 16) else 'road_x_' + LANE[j]
            elif i in ROAD:
                k = 'crosswalk_y' if j in (11, 16) else 'road_y_' + LANE[i]
            elif j in WALK or i in WALK:
                k = 'sidewalk_b' if (i * 7 + j * 3) % 5 == 0 else 'sidewalk_a'
            elif i < 10 and j < 10:
                k = 'sidewalk_b' if (i + j) % 4 == 0 else 'sidewalk_a'          # downtown plaza
            elif i >= 18 and j < 10:
                k = 'lot_lines' if j in (1, 2) else 'lot_a'                     # store lot
            elif i < 10 and j >= 18:
                k = 'grass_b' if (i * 5 + j) % 7 == 0 else 'grass_a'            # suburbs
            else:
                if j == 27 or i == 27:
                    k = 'water_a'
                elif j == 26 or i == 26:
                    k = 'planks_x' if j == 26 else 'planks_y'
                else:
                    k = 'dirt_a' if (i + j) % 3 else 'lot_a'
            tiles[(i, j)] = k
    return tiles


B = 2.6   # building scale (box shadow extents use it)


def placements():
    P = []
    a = P.append
    # ---- downtown plaza
    a(('bld/office_tower', 0, 0, 150, 140, ('box', 28 * B, 28 * B, 125 * B), {}))
    a(('prop/planter', 0, 0, 36, 286, ('blob', 13), {}))
    a(('prop/planter', 0, 0, 290, 36, ('blob', 13), {}))
    a(('prop/tree_a', 0, 0, 34, 40, ('blob', 26), {}))
    a(('int/atm', 0, 0, 262, 292, ('box', 7, 7, 34), {'hl': 'idle', 'prompt': ('E', 'USE ATM')}))
    a(('prop/bench', 0, 0, 96, 298, ('box', 17, 5, 12), {}))
    a(('prop/trash_can', 0, 0, 300, 236, ('blob', 5), {}))
    a(('char/office_worker', 0, 0.6, 178, 304, ('blob', 6), {}))
    a(('char/civilian_b', 2, -0.6, 352, 196, ('blob', 6), {}))
    a(('prop/tree_b', 0, 0, 44, 356, ('blob', 26), {}))
    a(('prop/lamp', 0, 0, 160, 370, ('blob', 4), {'lamp': True}))
    a(('prop/lamp', 0, 0, 370, 90, ('blob', 4), {'lamp': True}))
    a(('prop/traffic_light', 0, 0, 370, 370, ('blob', 5), {}))
    # ---- corner store + lot
    a(('bld/corner_store', 0, 0, 680, 252, ('box', 24 * B, 15 * B, 31 * B), {}))
    a(('veh/sedan_lav', 2, 0, 846, 120, ('box', 16, 40, 22), {'hl': 'idle', 'prompt': ('E', 'LOCKPICK')}))
    a(('prop/dumpster', 0, 0, 868, 236, ('box', 16, 8, 17), {}))
    a(('char/masked_thief', 0, 0.6, 700, 346, ('blob', 6), {}))
    a(('int/loot_bag', 0, 0, 744, 356, ('blob', 9), {'hl': 'hover', 'valuable': True, 'prompt': ('E', 'GRAB LOOT')}))
    a(('char/police_officer', 0, 0, 604, 352, ('blob', 6), {}))
    a(('prop/street_sign', 0, 0, 640, 336, ('blob', 4), {}))
    a(('prop/lamp', 0, 0, 800, 370, ('blob', 4), {'lamp': True}))
    a(('prop/traffic_light', 0, 0, 526, 370, ('blob', 5), {}))
    # ---- traffic
    a(('veh/police_car', 4, 0, 610, 416, ('box', 40, 16, 22), {}))
    a(('veh/taxi', 0, 0, 200, 480, ('box', 40, 16, 22), {}))
    a(('veh/sedan_clay', 0, 0, 790, 480, ('box', 40, 16, 22), {}))
    a(('veh/van_white', 6, 0, 416, 210, ('box', 16, 42, 28), {}))
    a(('veh/sedan_teal', 2, 0, 480, 720, ('box', 16, 40, 22), {}))
    # ---- suburbs: houses front onto the y-road (door face turned to +x)
    a(('bld/house_brick', 6, 0, 196, 660, ('box', 16 * B, 22 * B, 24 * B), {}))
    a(('bld/house_slate', 6, 0, 196, 826, ('box', 16 * B, 22 * B, 24 * B), {}))
    a(('prop/tree_a', 0, 0, 52, 610, ('blob', 26), {}))
    a(('prop/pine', 0, 0, 56, 770, ('blob', 18), {}))
    a(('prop/pine', 0, 0, 40, 860, ('blob', 18), {}))
    a(('prop/mailbox', 0, 0, 296, 620, ('blob', 4), {}))
    a(('prop/bush', 0, 0, 290, 728, ('blob', 12), {}))
    a(('prop/bush', 0, 0, 296, 880, ('blob', 12), {}))
    a(('char/civilian_a', 6, 0.6, 352, 760, ('blob', 6), {}))
    a(('prop/hydrant', 0, 0, 340, 540, ('blob', 4), {}))
    a(('prop/lamp', 0, 0, 364, 680, ('blob', 4), {'lamp': True}))
    a(('prop/traffic_light', 0, 0, 370, 526, ('blob', 5), {}))
    # ---- industrial yard
    a(('bld/warehouse', 0, 0, 720, 676, ('box', 34 * B, 23 * B, 30 * B), {}))
    a(('bld/container_teal', 0, 0, 664, 806, ('box', 23 * B, 9 * B, 20 * B), {}))
    a(('bld/container_brick', 2, 0, 832, 806, ('box', 9 * B, 23 * B, 20 * B), {}))
    a(('int/crate_loot', 0, 0, 756, 818, ('box', 8, 8, 15), {'hl': 'idle', 'valuable': True, 'prompt': ('E', 'SEARCH')}))
    a(('prop/crate', 0, 0, 600, 860, ('box', 8, 8, 15), {}))
    a(('prop/crate', 0, 0, 618, 872, ('box', 8, 8, 15), {}))
    a(('prop/barrel_teal', 0, 0, 604, 600, ('blob', 6), {}))
    a(('prop/barrel_brick', 0, 0, 620, 612, ('blob', 6), {}))
    a(('char/road_worker', 4, 0, 548, 552, ('blob', 6), {}))
    a(('prop/lamp', 0, 0, 548, 720, ('blob', 4), {'lamp': True}))
    a(('prop/traffic_light', 0, 0, 526, 526, ('blob', 5), {}))
    return P


# ------------------------------------------------------------------ compose
def compose(night=False, scale=2):
    MX = N * T + 24
    MY = 470
    W = 2 * N * T + 48
    Hh = N * T + MY + 40
    canvas = np.zeros((Hh, W, 4), np.uint8)
    bg = (46, 36, 48) if night else (83, 72, 89)
    canvas[...] = (*bg, 255)

    def scr(wx, wy, wz=0.0):
        return wx - wy + MX, (wx + wy) / 2 - wz + MY

    def blit(img, x, y, tint=None, keep=None):
        h, w = img.shape[:2]
        x = int(round(x)); y = int(round(y))
        x0, y0 = max(0, x), max(0, y)
        x1, y1 = min(W, x + w), min(Hh, y + h)
        if x1 <= x0 or y1 <= y0:
            return
        sub = img[y0 - y:y1 - y, x0 - x:x1 - x].astype(float)
        if tint is not None:
            t = sub[..., :3] * tint
            if keep is not None:
                k = keep[y0 - y:y1 - y, x0 - x:x1 - x][..., None]
                t = np.where(k, sub[..., :3], t)
            sub[..., :3] = t
        a = sub[..., 3:4] / 255.0
        dst = canvas[y0:y1, x0:x1, :3].astype(float)
        canvas[y0:y1, x0:x1, :3] = (sub[..., :3] * a + dst * (1 - a)).astype(np.uint8)

    tint_obj = np.array([0.66, 0.66, 0.80]) if night else None
    tint_tile = np.array([0.60, 0.62, 0.78]) if night else None

    # ground
    tiles = build_tiles()
    rng = np.random.default_rng(4)
    tcache = {}
    gmask = np.zeros((Hh, W), bool)
    for s in range(2 * N):
        for i in range(N):
            j = s - i
            if not (0 <= j < N):
                continue
            k = tiles[(i, j)]
            if night and k == 'asphalt' and rng.random() < 0.6:
                k = 'asphalt_wet'
            if night and k.startswith('road') and rng.random() < 0.25:
                pass
            seed = (i * 31 + j * 17) % 7
            if (k, seed) not in tcache:
                tcache[(k, seed)] = G.make_tile(k, seed)[0]
            im = tcache[(k, seed)]
            x, y = scr(i * T, j * T)
            blit(im, x - 32, y, tint_tile)
            xx0, yy0 = int(x - 32), int(y)
            gmask[yy0:yy0 + 32, xx0:xx0 + 64] |= _diamond()

    # shadows on the ground (multiply layer)
    sh = Image.new('L', (W, Hh), 0)
    d = ImageDraw.Draw(sh)
    pl = placements()
    for key, ai, walk, wx, wy, shd, fl in pl:
        if shd[0] == 'box':
            _, hx, hy, h = shd
            dx, dy = -LX / LZ * h, -LY / LZ * h
            corners = [(wx + sx * hx, wy + sy * hy) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
            pts = corners + [(cx + dx, cy + dy) for cx, cy in corners]
            # convex hull of the footprint + its projection
            from math import atan2
            S = [scr(px, py) for px, py in pts]
            cxm = sum(p[0] for p in S) / len(S); cym = sum(p[1] for p in S) / len(S)
            hull = _hull(S)
            d.polygon(hull, fill=150)
        else:
            r = shd[1]
            x, y = scr(wx - 2, wy - 3)
            d.ellipse([x - r * 1.15, y - r * 0.55, x + r * 1.15, y + r * 0.55], fill=170)
    sha = np.array(sh).astype(float) / 255.0 * gmask
    shadow_col = np.array([42, 30, 52], float)
    k = (sha * 0.42)[..., None]
    canvas[..., :3] = (canvas[..., :3] * (1 - k) + shadow_col * k).astype(np.uint8)

    # objects back-to-front
    prompts = []
    lamps = []
    pl.sort(key=lambda p: p[3] + p[4])
    for key, ai, walk, wx, wy, shd, fl in pl:
        if night and key == 'bld/office_tower':
            key = 'bld/office_tower_night'
        img, ox, oy = cache.get(key, ai, walk)
        keep = None
        if 'hl' in fl:
            hi_img, P = highlight(img, fl['hl'], fl.get('valuable', False), frame=1)
            keep = (hi_img[..., 3] > 0) & (np.pad(img[..., 3], ((P, P), (P, P))) == 0)
            if fl.get('valuable'):
                keep |= (hi_img[..., 0] > 245) & (hi_img[..., 1] > 225)
            img = hi_img; ox += P; oy += P
        x, y = scr(wx, wy)
        tint = tint_obj
        if night and key.startswith('bld/office_tower'):
            # lit windows stay warm
            gold = (img[..., 0] > 180) & (img[..., 1] > 130) & (img[..., 2] < 140)
            keep = gold if keep is None else keep | gold
        if night and 'hl' in fl:
            tint = np.array([0.86, 0.86, 0.94])
        blit(img, x - ox, y - oy, tint, keep)
        if 'prompt' in fl:
            top = np.nonzero(img[..., 3].any(1))[0][0]
            prompts.append((x - ox + img.shape[1] / 2, y - oy + top - 3, fl['prompt']))
        if fl.get('lamp'):
            lamps.append(scr(wx, wy + 16.5, 91.0))

    if night:
        _night_fx(canvas, lamps, tiles, scr)

    for px, py, (kk, lab) in prompts:
        pimg = prompt(kk, lab)
        blit(pimg, px - pimg.shape[1] / 2, py - pimg.shape[0])

    # crop to content
    diff = np.abs(canvas[..., :3].astype(int) - np.array(bg)).sum(-1) > 6
    ys, xs = np.nonzero(diff)
    y0, y1, x0, x1 = max(0, ys.min() - 16), min(Hh, ys.max() + 16), max(0, xs.min() - 16), min(W, xs.max() + 16)
    compose.last = {'x0': x0, 'y0': y0, 'MX': MX, 'MY': MY}
    return to_image(canvas[y0:y1, x0:x1], scale)


_DIA = None


def _diamond():
    global _DIA
    if _DIA is None:
        py, px = np.mgrid[0:32, 0:64]
        _DIA = (np.abs(px - 31.5) / 32.0 + np.abs(py - 15.5) / 16.0) <= 1.0
    return _DIA


def _hull(pts):
    pts = sorted(set((round(x, 2), round(y, 2)) for x, y in pts))
    if len(pts) < 3:
        return pts

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lower, upper = [], []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def _night_fx(canvas, lamps, tiles, scr):
    Hh, W = canvas.shape[:2]
    yy, xx = np.mgrid[0:Hh, 0:W]
    glow = np.zeros((Hh, W))
    for (lx, ly) in lamps:
        # bulb halo + pool of light on the ground below
        d1 = ((xx - lx) ** 2 + (yy - ly) ** 2)
        glow += 0.6 * np.exp(-d1 / (2 * 11.0 ** 2))
        gy = ly + 91
        d2 = ((xx - lx) / 1.0) ** 2 + ((yy - gy) / 0.5) ** 2
        glow += 0.5 * np.exp(-d2 / (2 * 36.0 ** 2))
    # quantise the glow into 4 bands with bayer dithering so it stays pixel-art
    from sdf import BAYER
    thr = BAYER[yy % 4, xx % 4]
    g = np.clip(glow, 0, 1) * 4
    band = np.floor(g + (g - np.floor(g) > thr) * 1.0) / 4.0
    warm = np.array([239, 205, 140], float)
    c = canvas[..., :3].astype(float)
    canvas[..., :3] = np.clip(c + (warm - c * 0.35) * band[..., None] * 0.8, 0, 255).astype(np.uint8)
    # rain: thin slanted streaks in the palette's pale lavender
    rng = np.random.default_rng(11)
    rain = np.array([188, 175, 182], float)
    for _ in range(int(W * Hh / 260)):
        x = rng.integers(0, W); y = rng.integers(0, Hh); L = rng.integers(3, 7)
        for k in range(L):
            yk, xk = y + k, x - k // 2
            if 0 <= yk < Hh and 0 <= xk < W:
                c0 = canvas[yk, xk, :3].astype(float)
                canvas[yk, xk, :3] = (c0 * 0.55 + rain * 0.45).astype(np.uint8)
    # splashes on the ground
    for _ in range(int(W * Hh / 900)):
        x = rng.integers(1, W - 1); y = rng.integers(MY_GUESS, Hh - 1)
        canvas[y, x - 1:x + 2, :3] = (canvas[y, x - 1:x + 2, :3].astype(float) * 0.5 + rain * 0.5).astype(np.uint8)


MY_GUESS = 470

if __name__ == '__main__':
    d = compose(False, 1); d.save('out/scene_overcast_day_1x.png')
    d.resize((d.width * 2, d.height * 2), Image.NEAREST).save('out/scene_overcast_day.png')
    n = compose(True, 1); n.save('out/scene_rainy_dusk_1x.png')
    n.resize((n.width * 2, n.height * 2), Image.NEAREST).save('out/scene_rainy_dusk.png')
    # close-ups at 3x: the store robbery corner and the suburbs
    for img, tag in ((d, 'day'), (n, 'dusk')):
        W, H = img.size
        img.crop((int(W * 0.56), int(H * 0.50), int(W * 0.98), int(H * 0.76))).resize((int(W * 0.42) * 3, int(H * 0.26) * 3), Image.NEAREST).save(f'out/closeup_store_{tag}.png')
    print('ok')

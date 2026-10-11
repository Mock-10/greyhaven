"""Render a vector-ground city map (ground shapes + placements) as a draft image, the way the game will draw it.

Objects are drawn in a topological order of their footprints (a box behind another along x or y draws first),
which is what the game's static depth sort does too. Writes art/drafts/<name>/<name>_{day,dusk}.png (1x and 2x)
and a debug render with footprints.
"""
import os, sys, math, heapq, warnings
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
warnings.filterwarnings('ignore')
import numpy as np
from PIL import Image, ImageDraw
import cache
import ground_vec as V
from sdf import BAYER

HERE = os.path.dirname(os.path.abspath(__file__))
LX, LY, LZ = 0.22, 0.58, 0.78
SEG_STEPS = 16


def _warm_job(args):
    key, ai, ang = args
    import warnings; warnings.filterwarnings('ignore')
    if ang is None:
        cache.get(key, ai, 0.0)
    else:
        cache.get(key, 0, 0.0, ang=ang)
    return key


def warm(PL, night_names, procs=4):
    jobs = set()
    for p in PL:
        key = p['sprite']
        if key.startswith('seg/'):
            jobs.add((key, 0, p['dir'] * 2 * math.pi / SEG_STEPS))
        else:
            jobs.add((key, p['dir'], None))
            if p.get('night') and key[4:] in night_names:
                jobs.add((key + '_night', p['dir'], None))
    todo = []
    for key, ai, ang in jobs:
        name = cache.key_name(key, ai if ang is None else int(round(ang * 1000)), 0.0)
        if not os.path.exists(os.path.join(cache.CACHE, name + '.png')):
            todo.append((key, ai, ang))
    print('rendering', len(todo), 'sprites', flush=True)
    if todo:
        from multiprocessing import Pool
        with Pool(procs) as pool:
            for k, _ in enumerate(pool.imap_unordered(_warm_job, sorted(todo, key=lambda j: j[0]))):
                if k % 20 == 0:
                    print(' ', k, flush=True)


def night_names():
    f = cache.factories()
    return {k[4:-6] for k in f if k.startswith('bld/') and k.endswith('_night')}


def get_img(p, night, nn):
    key = p['sprite']
    if night and p.get('night') and key[4:] in nn:
        key = key + '_night'
    if key.startswith('seg/'):
        return cache.get(key, 0, 0.0, ang=p['dir'] * 2 * math.pi / SEG_STEPS)
    return cache.get(key, p['dir'], 0.0)


def draw_order(PL, sprites):
    """Topological back-to-front order over objects whose sprites overlap on screen."""
    n = len(PL)
    fp = np.array([p['fp'] for p in PL], float)
    sb = np.array(sprites, float)       # screen bounds x0, y0, x1, y1
    key = fp[:, 0] + fp[:, 2] + fp[:, 1] + fp[:, 3]
    out_edges = [[] for _ in range(n)]
    indeg = np.zeros(n, int)
    for i in range(n):
        ov = (sb[:, 0] < sb[i, 2]) & (sb[:, 2] > sb[i, 0]) & (sb[:, 1] < sb[i, 3]) & (sb[:, 3] > sb[i, 1])
        ov[:i + 1] = False
        for j in np.nonzero(ov)[0]:
            a, b = fp[i], fp[j]
            ab = (a[2] <= b[0] + 0.01) or (a[3] <= b[1] + 0.01)
            ba = (b[2] <= a[0] + 0.01) or (b[3] <= a[1] + 0.01)
            if ab and not ba:
                first, second = i, j
            elif ba and not ab:
                first, second = j, i
            else:
                first, second = (i, j) if key[i] <= key[j] else (j, i)
            out_edges[first].append(second); indeg[second] += 1
    heap = [(key[i], i) for i in range(n) if indeg[i] == 0]
    heapq.heapify(heap)
    order = []
    done = np.zeros(n, bool)
    while len(order) < n:
        if not heap:       # a cycle: release the remaining object with the smallest key
            rest = [i for i in range(n) if not done[i]]
            i = min(rest, key=lambda k: key[k]); indeg[i] = 0
            heapq.heappush(heap, (key[i], i))
        _, i = heapq.heappop(heap)
        if done[i]:
            continue
        done[i] = True
        order.append(i)
        for j in out_edges[i]:
            indeg[j] -= 1
            if indeg[j] == 0 and not done[j]:
                heapq.heappush(heap, (key[j], j))
    return order


def _hull(pts):
    pts = sorted(set((round(x, 2), round(y, 2)) for x, y in pts))
    if len(pts) < 3:
        return pts

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0:
            lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(up) >= 2 and cross(up[-2], up[-1], p) <= 0:
            up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]


def render(SHAPES, PL, mapw, night=False, debug=False, procs=4, decals=()):
    nn = night_names()
    x0, y0 = int(-mapw - 40), -520
    W, H = int(2 * mapw + 80), int(mapw + 560)
    ground_img, mat = V.compose(SHAPES, mapw, mapw, 'asphalt', x0, y0, W, H)
    canvas = np.zeros((H, W, 3), float)
    bg = np.array((46, 36, 48) if night else (83, 72, 89), float)
    canvas[...] = bg
    a = ground_img[..., 3:4] / 255.0
    gtint = np.array([0.60, 0.62, 0.78]) if night else np.ones(3)
    canvas = ground_img[..., :3] * gtint * a + canvas * (1 - a)

    def scr(wx, wy, wz=0.0):
        return wx - wy - x0, (wx + wy) / 2 - wz - y0

    # ground decals (grass tufts, weeds) are part of the ground: drawn before the shadows, tinted like the ground
    for k, wx, wy in decals:
        img, ox, oy = cache.get('dec/' + k, 0, 0.0)
        x, y = scr(wx, wy)
        xi, yi = int(round(x - ox)), int(round(y - oy))
        h, w = img.shape[:2]
        sub = img.astype(float)
        al = sub[..., 3:4] / 255.0
        canvas[yi:yi + h, xi:xi + w] = sub[..., :3] * gtint * al + canvas[yi:yi + h, xi:xi + w] * (1 - al)

    # static shadows, multiplied onto the ground only
    sh = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(sh)
    for p in PL:
        s = p['shadow']
        wx, wy = p['x'], p['y']
        if s['kind'] in ('box', 'obox'):
            hx, hy, h = s['hx'], s['hy'], s['h']
            ang = s.get('ang', 0.0)
            ca, sa = math.cos(ang), math.sin(ang)
            corners = [(wx + ca * cx - sa * cy, wy + sa * cx + ca * cy) for cx, cy in ((-hx, -hy), (hx, -hy), (hx, hy), (-hx, hy))]
            dx, dy = -LX / LZ * h, -LY / LZ * h
            pts = corners + [(cx + dx, cy + dy) for cx, cy in corners]
            d.polygon(_hull([scr(px, py) for px, py in pts]), fill=150)
        else:
            r = s['r']
            x, y = scr(wx - 2, wy - 3)
            d.ellipse([x - r * 1.15, y - r * 0.55, x + r * 1.15, y + r * 0.55], fill=170)
    sha = np.array(sh).astype(float) / 255.0 * (mat > 0)
    k = (sha * 0.42)[..., None]
    canvas = canvas * (1 - k) + np.array([42, 30, 52], float) * gtint * k

    imgs = [get_img(p, night, nn) for p in PL]
    bounds = []
    for p, (img, ox, oy) in zip(PL, imgs):
        x, y = scr(p['x'], p['y'])
        bounds.append((x - ox, y - oy, x - ox + img.shape[1], y - oy + img.shape[0]))
    order = draw_order(PL, bounds)
    lamps = []
    otint = np.array([0.66, 0.66, 0.80]) if night else None
    for i in order:
        p = PL[i]
        img, ox, oy = imgs[i]
        x, y = scr(p['x'], p['y'])
        xi, yi = int(round(x - ox)), int(round(y - oy))
        h, w = img.shape[:2]
        xa, ya = max(0, xi), max(0, yi)
        xb, yb = min(W, xi + w), min(H, yi + h)
        if xb <= xa or yb <= ya:
            continue
        sub = img[ya - yi:yb - yi, xa - xi:xb - xi].astype(float)
        rgb = sub[..., :3]
        if night:
            keep = (rgb[..., 0] > 180) & (rgb[..., 1] > 130) & (rgb[..., 2] < 140) & p['sprite'].startswith('bld/')
            rgb = np.where(keep[..., None], rgb, rgb * otint)
        al = sub[..., 3:4] / 255.0
        canvas[ya:yb, xa:xb] = rgb * al + canvas[ya:yb, xa:xb] * (1 - al)
        if p.get('lamp'):
            a = p['dir'] * math.pi / 4      # the arm points along the lamp's local +y
            lamps.append(scr(p['x'] - 16.5 * math.sin(a), p['y'] + 16.5 * math.cos(a), 91.0))
    if night:
        canvas = _lamps(canvas, lamps)
    if debug:
        im = Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8))
        dr = ImageDraw.Draw(im)
        for p in PL:
            f = p['fp']
            pts = [scr(f[0], f[1]), scr(f[2], f[1]), scr(f[2], f[3]), scr(f[0], f[3])]
            dr.polygon(pts, outline=(255, 60, 60) if p['sprite'].startswith('bld') else (60, 255, 200))
        return im, (x0, y0)
    return Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8)), (x0, y0)


def _lamps(canvas, lamps):
    H, W = canvas.shape[:2]
    glow = np.zeros((H, W))
    for (lx, ly) in lamps:
        xa, xb = int(max(0, lx - 110)), int(min(W, lx + 110))
        ya, yb = int(max(0, ly - 40)), int(min(H, ly + 150))
        yy, xx = np.mgrid[ya:yb, xa:xb]
        d1 = (xx - lx) ** 2 + (yy - ly) ** 2
        g = 0.6 * np.exp(-d1 / (2 * 11.0 ** 2))
        d2 = (xx - lx) ** 2 + ((yy - ly - 91) / 0.5) ** 2
        g += 0.5 * np.exp(-d2 / (2 * 36.0 ** 2))
        glow[ya:yb, xa:xb] += g
    yy, xx = np.mgrid[0:H, 0:W]
    thr = BAYER[yy % 4, xx % 4]
    g = np.clip(glow, 0, 1) * 4
    band = np.floor(g + (g - np.floor(g) > thr) * 1.0) / 4.0
    warm = np.array([239, 205, 140], float)
    return np.clip(canvas + (warm - canvas * 0.35) * band[..., None] * 0.8, 0, 255)


def crop(im):
    a = np.asarray(im).astype(int)
    bgc = a[2, 2]
    diff = np.abs(a - bgc).sum(-1) > 6
    ys, xs = np.nonzero(diff)
    return im.crop((max(0, xs.min() - 12), max(0, ys.min() - 12), min(im.width, xs.max() + 12), min(im.height, ys.max() + 12)))


def render_all(SHAPES, PL, DOORS, mapw, name, procs=4, decals=()):
    out = os.path.join(HERE, '..', 'drafts', name)
    os.makedirs(out, exist_ok=True)
    nn = night_names()
    warm(PL + [{'sprite': 'dec/' + k, 'dir': 0} for k in sorted({k for k, _, _ in decals})], nn, procs)
    for night, tag in ((False, 'day'), (True, 'dusk')):
        im, _ = render(SHAPES, PL, mapw, night, decals=decals)
        im = crop(im)
        im.save(os.path.join(out, f'{name}_{tag}_1x.png'), optimize=True)
        im.resize((im.width * 2, im.height * 2), Image.NEAREST).save(os.path.join(out, f'{name}_{tag}.png'), optimize=True)
        print('saved', tag, im.size, flush=True)
    im, _ = render(SHAPES, PL, mapw, False, debug=True, decals=decals)
    crop(im).save(os.environ.get('DRAFT_DEBUG', os.path.join(out, f'{name}_debug.png')))

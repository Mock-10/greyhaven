"""Export the approved interior drafts (rooms.py) as game data: one atlas + JSON per interior.

The drafts compose a whole room into a single picture. The game needs each piece separately so it can
depth-sort the player among the furniture, open doors and hide rooms the player can't see (docs/19).
This runs each draft function with compose() intercepted (like check_layout.py) and writes:

  ../interiors/<id>.png   every sprite of the room, shelf-packed
  ../interiors/<id>.json  room size, partitions, doors, the sprites with their world positions and sort keys,
                          footprints for collision, usable objects (prompt labels), and NPC spots

Sprites:
  floor     floor tiles + furniture shadows + wall ambient occlusion, baked (they never change)
  walls     the two full-height back walls (one sprite, anchored at the room origin)
  stubs     the cut-down front walls (drawn over everything, like compose())
  segments  partition wall pieces, 16 units long, sorted with the furniture (sort key x + y - 2)
  items     furniture and decoration, sorted by x + y + z_bias like compose()
Characters in the drafts become NPC spots (costume, facing, position); the game draws and schedules them.

Usage: python3 export_interiors.py [room ...]   (default: every interior; the M7 job sites come from rooms_jobs.py)
"""
import os, sys, json, warnings
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
warnings.filterwarnings('ignore')
import numpy as np
from PIL import Image, ImageDraw
import check_layout as CL      # tags every model with its kind and provides capture()
import rooms
from rooms import T, WALL_H, WT, PART_H, partition_segments, front_stubs
from sdf import render
import ground2d as G
from scene import _hull

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'interiors')
ROOMS = ['apartment', 'store', 'tower_lobby', 'office_floor', 'bar', 'hardware', 'clothing', 'dealer', 'garage', 'depot',
         'site_trailer']


def capture(room):
    """Run a draft with characters replaced by markers, so NPC costumes survive the export."""
    real_ch = rooms.ch
    rooms.ch = lambda key, idx, walk=0.0: ('CHAR', key, idx, walk)
    try:
        return CL.capture(room)
    finally:
        rooms.ch = real_ch


def bake_floor(box):
    """Floor tiles, item shadows and wall AO exactly as compose() draws them, on a transparent canvas."""
    W, D_ = box['W'], box['D']
    W_t, D_t = W // T, D_ // T
    pad = 4
    MX = D_ + pad
    MY = pad
    Wc = W + D_ + 2 * pad
    Hc = (W + D_) // 2 + 2 * pad + 8
    canvas = np.zeros((Hc, Wc, 4), np.uint8)

    def scr(wx, wy, wz=0.0):
        return wx - wy + MX, (wx + wy) / 2 - wz + MY

    floor = box['floor']
    kinds = [[(floor(i, j) if callable(floor) else floor) for j in range(D_t)] for i in range(W_t)]
    tcache = {}
    for s in range(W_t + D_t):
        for i in range(W_t):
            j = s - i
            if 0 <= j < D_t:
                key = (kinds[i][j], (i * 7 + j * 3) % 5)
                if key not in tcache:
                    tcache[key] = G.make_tile(key[0], key[1], rim_line=False)[0]
                im = tcache[key]
                x, y = scr(i * T, j * T)
                x, y = int(round(x - 32)), int(round(y))
                h, w = im.shape[:2]
                a = im[..., 3:4] / 255.0
                dst = canvas[y:y + h, x:x + w]
                dst[..., :3] = (im[..., :3] * a + dst[..., :3] * (1 - a)).astype(np.uint8)
                dst[..., 3] = np.maximum(dst[..., 3], im[..., 3])
    # shadows (compose(): box shadows pushed away from the light, blobs, AO strips along walls)
    sh = Image.new('L', (Wc, Hc), 0)
    d = ImageDraw.Draw(sh)
    for it in box['items']:
        src, ang, wx, wy, shd, fl = it
        if shd is None or isinstance(src, tuple):
            continue
        if shd[0] == 'box':
            _, hx, hy, hgt = shd
            dx, dy = -0.28 * hgt * 0.6, -0.74 * hgt * 0.6
            corners = [(wx + sx * hx, wy + sy * hy) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
            pts = corners + [(cx + dx, cy + dy) for cx, cy in corners]
            d.polygon(_hull([scr(px, py) for px, py in pts]), fill=110)
        else:
            r = shd[1]
            xx, yy = scr(wx - 1, wy - 2)
            d.ellipse([xx - r * 1.15, yy - r * 0.55, xx + r * 1.15, yy + r * 0.55], fill=140)
    for t in range(0, 7):
        d.line([scr(0, t), scr(W, t)], fill=int(90 * (1 - t / 7)))
        d.line([scr(t, 0), scr(t, D_)], fill=int(90 * (1 - t / 7)))
    for (axis, pos, a0, a1, gaps) in box['partitions']:
        for t in range(1, 5):
            f = int(60 * (1 - t / 5))
            if axis == 'x':
                d.line([scr(a0, pos + WT / 2 + t), scr(a1, pos + WT / 2 + t)], fill=f)
            else:
                d.line([scr(pos + WT / 2 + t, a0), scr(pos + WT / 2 + t, a1)], fill=f)
    sha = (np.array(sh).astype(float) / 255.0 * 0.45)[..., None]
    sha = sha * (canvas[..., 3:4] > 0)
    canvas[..., :3] = (canvas[..., :3] * (1 - sha) + np.array([42, 30, 52]) * sha).astype(np.uint8)
    # anchor: the screen position of the room origin (world 0, 0, 0)
    return canvas, MX, MY, kinds


def door_gap(box, wx, wy):
    """The partition gap a door leaf stands in: (axis, pos, g0, g1)."""
    best = None
    for (axis, pos, a0, a1, gaps) in box['partitions']:
        for (g0, g1) in gaps:
            if axis == 'x' and abs(wy - pos) < 4 and g0 - 2 <= wx <= g1 + 2:
                best = ('x', pos, g0, g1)
            if axis == 'y' and abs(wx - pos) < 4 and g0 - 2 <= wy <= g1 + 2:
                best = ('y', pos, g0, g1)
    return best


def pack(images):
    """Shelf-pack {name: rgba} into one sheet. Returns (sheet, {name: (x, y, w, h)})."""
    order = sorted(images, key=lambda k: -images[k].shape[0])
    maxw = max(1024, max(im.shape[1] for im in images.values()) + 2)
    x = y = shelf = 0
    rects = {}
    for k in order:
        h, w = images[k].shape[:2]
        if x + w + 1 > maxw:
            x, y, shelf = 0, y + shelf + 1, 0
        rects[k] = (x, y, w, h)
        x += w + 1
        shelf = max(shelf, h)
    sheet = np.zeros((y + shelf + 1, maxw, 4), np.uint8)
    for k, (x, y, w, h) in rects.items():
        sheet[y:y + h, x:x + w] = images[k]
    return sheet, rects


def export(room):
    box = capture(room)
    W, D_ = box['W'], box['D']
    images, frames = {}, {}

    def add(name, img, ox, oy):
        images[name] = img
        frames[name] = {'anchor': [float(ox), float(oy)]}

    floor_img, fx, fy, kinds = bake_floor(box)
    add('floor', floor_img, fx, fy)
    wimg, wox, woy = render(box['walls'])
    add('walls', wimg, wox, woy)
    simg, sox, soy = render(front_stubs(W, D_, gaps=box.get('stub_gaps', ())))
    add('stubs', simg, sox, soy)

    segments = []
    for (axis, pos, a0, a1, gaps) in box['partitions']:
        for k, (m, sx, sy) in enumerate(partition_segments(axis, pos, a0, a1, gaps)):
            img, ox, oy = render(m, outline=False)
            name = f'seg_{axis}{pos}_{k}'
            add(name, img, ox, oy)
            segments.append({'frame': name, 'x': sx, 'y': sy, 'axis': axis, 'pos': pos})

    items, npcs = [], []
    rcache = {}
    for n, it in enumerate(box['items']):
        src, ang, wx, wy, shd, fl = it
        if isinstance(src, tuple) and src[0] == 'CHAR':
            _, key, idx, walk = src
            npcs.append({'costume': key.split('/')[1], 'dir': int(idx), 'walk': float(walk), 'x': wx, 'y': wy,
                         'zBias': fl.get('z_bias', 0)})
            continue
        kind = getattr(src, 'kind', 'item')
        ck = (id(src), round(float(ang), 4))
        if ck not in rcache:
            rcache[ck] = render(src, ang=ang)
        img, ox, oy = rcache[ck]
        name = f'item_{n}_{kind}'
        add(name, img, ox, oy)
        entry = {'frame': name, 'kind': kind, 'x': wx, 'y': wy, 'wz': fl.get('wz', 0.0), 'zBias': fl.get('z_bias', 0),
                 'ang': float(ang)}
        if shd is not None:
            entry['shadow'] = {'kind': shd[0], 'hx': shd[1], 'hy': shd[2], 'h': shd[3]} if shd[0] == 'box' else {'kind': 'blob', 'r': shd[1]}
        if 'prompt' in fl:
            entry['prompt'] = fl['prompt'][1]
        if fl.get('valuable'):
            entry['valuable'] = True
        if kind == 'door_leaf':
            g = door_gap(box, wx, wy)
            if g:
                entry['door'] = {'axis': g[0], 'pos': g[1], 'g0': g[2], 'g1': g[3]}
        items.append(entry)

    sheet, rects = pack(images)
    os.makedirs(OUT, exist_ok=True)
    Image.fromarray(sheet, 'RGBA').save(os.path.join(OUT, f'{room}.png'), optimize=True)
    for name, (x, y, w, h) in rects.items():
        frames[name].update({'x': x, 'y': y, 'w': w, 'h': h})
    data = {
        'id': room, 'image': f'{room}.png', 'W': W, 'D': D_, 'wallH': WALL_H, 'wallT': WT, 'partH': PART_H,
        'floorKinds': kinds,
        'partitions': [{'axis': a, 'pos': p, 'a0': a0, 'a1': a1, 'gaps': [list(g) for g in gaps]} for (a, p, a0, a1, gaps) in box['partitions']],
        'stubGaps': [list(g) for g in box.get('stub_gaps', ())],
        'segments': segments, 'items': items, 'npcs': npcs,
        'frames': {k: {'x': v['x'], 'y': v['y'], 'w': v['w'], 'h': v['h'], 'anchor': v['anchor']} for k, v in frames.items()},
    }
    json.dump(data, open(os.path.join(OUT, f'{room}.json'), 'w'), indent=1)
    print(f'{room}: {len(items)} items, {len(segments)} wall pieces, {len(npcs)} npcs, sheet {sheet.shape[1]}x{sheet.shape[0]}')


if __name__ == '__main__':
    for r in sys.argv[1:] or ROOMS:
        export(r)

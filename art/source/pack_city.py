"""Pack the art a vector-ground city map needs into ../city.png + ../city.json and ../ground.png + ../ground.json.

city atlas: every (sprite, direction) the map places that the older atlases don't already hold: street props in any
of 8 directions, wall/fence/bed segments in any of 16, infill buildings (and their _night variants) and ground decals.
Frame keys are '<kind>/<name>/<dir>' (dir is the number used in the map data). Shelf-packed, anchor = ground point.

ground sheet: one repeating swatch per ground material (ground_vec.py), two columns, with a JSON index.

Usage: python3 pack_city.py [map.json ...]    (default: src/maps/downtown.json)
"""
import os, sys, json, math, warnings
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
warnings.filterwarnings('ignore')
import numpy as np
from PIL import Image
import cache
import ground_vec as V

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.normpath(os.path.join(HERE, '..'))
ROOT = os.path.normpath(os.path.join(ART, '..'))
SHEET_W = 2048
SEG_STEPS = 16


def existing_frames():
    """(kind, name, dir) combos the game can already draw from the older atlases."""
    have = set()
    props = json.load(open(os.path.join(ART, 'props.json')))
    for k in props['frames']:
        have.add(('prop', k.split('/')[1], 0))
    b2 = json.load(open(os.path.join(ART, 'buildings2.json')))
    dirs = ['SE', 'S', 'SW', 'W', 'NW', 'N', 'NE', 'E']
    for k in b2['frames']:
        name, d = k.split('/')
        have.add(('bld', name, dirs.index(d)))
    return have


def needed(maps):
    have = existing_frames()
    night = {k[4:-6] for k in cache.factories() if k.startswith('bld/') and k.endswith('_night')}
    want = set()
    for path in maps:
        m = json.load(open(path))
        for p in m['placements']:
            kind, name = p['sprite'].split('/')
            if kind not in ('prop', 'seg', 'bld'):
                continue
            combos = [(kind, name, p['dir'])]
            if kind == 'bld' and p.get('night') and name in night:
                combos.append((kind, name + '_night', p['dir']))
            for c in combos:
                if c not in have:
                    want.add(c)
        for d in m['ground'].get('decals', []):
            want.add(('dec', d['k'], 0))
    return sorted(want)


def render_one(c):
    kind, name, d = c
    key = f'{kind}/{name}'
    if kind == 'seg':
        return cache.get(key, 0, 0.0, ang=d * 2 * math.pi / SEG_STEPS)
    return cache.get(key, d, 0.0)


def _job(c):
    import warnings; warnings.filterwarnings('ignore')
    render_one(c)
    return c


def pack_atlas(combos, procs=4):
    todo = [c for c in combos if not os.path.exists(os.path.join(cache.CACHE, cache.key_name(f'{c[0]}/{c[1]}', c[2] if c[0] != 'seg' else int(round(c[2] * 2 * math.pi / SEG_STEPS * 1000)), 0.0) + '.png'))]
    if todo:
        from multiprocessing import Pool
        with Pool(procs) as pool:
            for _ in pool.imap_unordered(_job, todo):
                pass
    items = []
    for c in combos:
        img, ox, oy = render_one(c)
        if c[0] == 'bld':
            # buildings keep their full frame: the day and _night frames must line up pixel for pixel (lit windows)
            items.append((c, img, ox, oy))
            continue
        # trim fully transparent borders (keeps the anchor right)
        a = img[..., 3] > 0
        ys, xs = np.nonzero(a)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        items.append((c, img[y0:y1, x0:x1], ox - x0, oy - y0))
    items.sort(key=lambda it: (-it[1].shape[0], it[0]))
    x = y = shelf = 0
    pos = []
    for c, img, ax, ay in items:
        h, w = img.shape[:2]
        if x + w + 1 > SHEET_W:
            y += shelf + 1; x = 0; shelf = 0
        pos.append((c, img, ax, ay, x, y))
        x += w + 1; shelf = max(shelf, h)
    H = y + shelf
    sheet = np.zeros((H, SHEET_W, 4), np.uint8)
    frames = {}
    for c, img, ax, ay, px, py in pos:
        h, w = img.shape[:2]
        sheet[py:py + h, px:px + w] = img
        frames[f'{c[0]}/{c[1]}/{c[2]}'] = {'x': int(px), 'y': int(py), 'w': int(w), 'h': int(h), 'anchor': [int(round(ax)), int(round(ay))]}
    Image.fromarray(sheet, 'RGBA').save(os.path.join(ART, 'city.png'), optimize=True)
    json.dump({'image': 'city.png', 'cell': [0, 0],
               'note': 'City art packed by art/source/pack_city.py. Frame key <kind>/<name>/<dir>: prop dirs 0-7, seg dirs '
                       '0-15 (22.5 degree steps), bld dirs 0-7 with _night variants, dec = ground decals (no outline). '
                       'anchor = ground point inside the frame.',
               'frames': frames}, open(os.path.join(ART, 'city.json'), 'w'), indent=0)
    print('city atlas', len(frames), 'frames', sheet.shape, os.path.getsize(os.path.join(ART, 'city.png')) // 1024, 'KB')


def pack_ground(seed=3):
    cols = 2
    rows = math.ceil(len(V.MAT_ORDER) / cols)
    sheet = np.zeros((rows * V.SH, cols * V.SW, 3), np.uint8)
    mats = []
    for k, m in enumerate(V.MAT_ORDER):
        r, c = k // cols, k % cols
        sheet[r * V.SH:(r + 1) * V.SH, c * V.SW:(c + 1) * V.SW] = V.swatch(m, seed)
        h, side, lt, rt = V.MATERIALS[m]
        mats.append({'name': m, 'id': V.MAT_ID[m], 'x': c * V.SW, 'y': r * V.SH, 'height': h, 'side': side, 'left': lt, 'right': rt})
    Image.fromarray(sheet, 'RGB').save(os.path.join(ART, 'ground.png'), optimize=True)
    from sdf import RID, RAMP_RGB
    json.dump({'image': 'ground.png', 'period': V.PERIOD, 'w': V.SW, 'h': V.SH, 'voidHeight': V.VOID_H, 'seed': seed,
               'materials': mats,
               'ramps': {n: [[int(v) for v in RAMP_RGB[i, k]] for k in range(6)] for n, i in RID.items() if not n.startswith('mk_')}},
              open(os.path.join(ART, 'ground.json'), 'w'), indent=0)
    print('ground sheet', sheet.shape, os.path.getsize(os.path.join(ART, 'ground.png')) // 1024, 'KB')


if __name__ == '__main__':
    maps = sys.argv[1:] or [os.path.join(ROOT, 'src', 'maps', 'downtown.json')]
    pack_atlas(needed(maps))
    pack_ground()

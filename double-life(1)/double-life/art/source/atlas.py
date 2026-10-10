"""Pack every sprite into game-ready atlases (1x PNG + JSON with frame rects and ground anchors)."""
import os, sys, json, warnings
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
warnings.filterwarnings('ignore')
import numpy as np
from PIL import Image
import cache, ground2d as G
from sdf import highlight, RAMP_HEX, RAMP_ORDER, to_image

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pack')
os.makedirs(OUT, exist_ok=True)
DIRS = ['SE', 'S', 'SW', 'W', 'NW', 'N', 'NE', 'E']   # screen-facing direction for each 45-degree step


def pack_grid(name, rows, note):
    """rows: list of (row_label, [(col_label, img, ox, oy), ...])"""
    cw = max(im.shape[1] for _, r in rows for _, im, _, _ in r) + 2
    ch = max(im.shape[0] for _, r in rows for _, im, _, _ in r) + 2
    ncol = max(len(r) for _, r in rows)
    sheet = np.zeros((ch * len(rows), cw * ncol, 4), np.uint8)
    frames = {}
    for ri, (rl, r) in enumerate(rows):
        for ci, (cl, im, ox, oy) in enumerate(r):
            h, w = im.shape[:2]
            x = ci * cw + (cw - w) // 2
            y = ri * ch + (ch - h)
            sheet[y:y + h, x:x + w] = im
            frames[f'{rl}/{cl}'] = {'x': ci * cw, 'y': ri * ch, 'w': cw, 'h': ch,
                                    'anchor': [x - ci * cw + ox, y - ri * ch + oy]}
    Image.fromarray(sheet, 'RGBA').save(os.path.join(OUT, name + '.png'))
    json.dump({'image': name + '.png', 'cell': [cw, ch], 'note': note, 'frames': frames},
              open(os.path.join(OUT, name + '.json'), 'w'), indent=1)
    return sheet


def preview(sheet, name, scale=3, bg=(146, 141, 154)):
    p = np.zeros_like(sheet); p[...] = (*bg, 255)
    a = sheet[..., 3:4] / 255.0
    p[..., :3] = (sheet[..., :3] * a + p[..., :3] * (1 - a)).astype(np.uint8)
    to_image(p, scale).save(os.path.join(OUT, 'preview', name + '.png'))


os.makedirs(os.path.join(OUT, 'preview'), exist_ok=True)
F = cache.factories()
ANCHOR = 'anchor = pixel inside the cell that sits on the object\'s ground point (feet / footprint centre).'

# characters: row per costume x pose, 8 directions
rows = []
for k in [k for k in F if k.startswith('char/')]:
    for pose, w in (('idle', 0.0), ('walk1', 0.6), ('walk2', -0.6)):
        rows.append((f"{k[5:]}/{pose}", [(DIRS[a], *cache.get(k, a, w)) for a in range(8)]))
s = pack_grid('characters', rows, ANCHOR + ' Walk cycle: idle -> walk1 -> idle -> walk2. Directions: ' + ','.join(DIRS))
preview(s, 'characters', 3)

rows = [(k[4:], [(DIRS[a], *cache.get(k, a)) for a in range(8)]) for k in F if k.startswith('veh/')]
s = pack_grid('vehicles', rows, ANCHOR + ' Directions: ' + ','.join(DIRS))
preview(s, 'vehicles', 2)

rows = []
for k in [k for k in F if k.startswith('bld/')]:
    angs = (0, 2, 6) if ('house' in k or 'container' in k) else (0,)
    rows.append((k[4:], [(DIRS[a], *cache.get(k, a)) for a in angs]))
s = pack_grid('buildings', rows, ANCHOR + ' Footprint centre. Houses/containers also rotated.')
preview(s, 'buildings', 1)

items = [(k[5:], *cache.get(k, 0)) for k in F if k.startswith('prop/')]
rows = [('props', items[i:i + 8]) for i in range(0, len(items), 8)]
rows = [(f'props{n}', r) for n, (_, r) in enumerate(rows)]
s = pack_grid('props', rows, ANCHOR)
preview(s, 'props', 2)

VAL = {'gold_bars', 'cash_stack', 'loot_bag', 'crate_loot'}
rows = []
for k in [k for k in F if k.startswith('int/')]:
    im, ox, oy = cache.get(k, 0)
    nm = k[4:]
    cols = [('normal', np.pad(im, ((4, 4), (4, 4), (0, 0))), ox + 4, oy + 4)]
    for st in ('idle', 'hover'):
        for fr in (0, 1, 2):
            if st == 'hover' and fr > 0:
                continue
            h, P = highlight(im, st, nm in VAL, frame=fr)
            cols.append((f'{st}{fr if st == "idle" else ""}', h, ox + P, oy + P))
    rows.append((nm, cols))
s = pack_grid('interactables', rows, ANCHOR + ' States: normal, idle0-2 (animated gold shimmer when in range), hover (targeted).')
preview(s, 'interactables', 3)

tl = [(k, *G.make_tile(k, 3)) for k in G.TILES]
rows = [(f'row{n}', tl[i:i + 6]) for n, i in enumerate(range(0, len(tl), 6))]
s = pack_grid('tiles', rows, '64x32 iso diamond; anchor = top vertex of the diamond. Side faces hang below for curbs.')
preview(s, 'tiles', 3)

# palette
pal = {n: ['#' + c for c in RAMP_HEX[n]] for n in RAMP_ORDER}
json.dump({'note': 'Each ramp dark->light. Grey Weather swatches are used exactly; gold is reserved for valuables and interactables.',
           'ramps': pal}, open(os.path.join(OUT, 'palette.json'), 'w'), indent=1)
S = 16
img = np.zeros((len(RAMP_ORDER) * S, 6 * S, 3), np.uint8)
for r, n in enumerate(RAMP_ORDER):
    for c, hx in enumerate(RAMP_HEX[n]):
        img[r * S:(r + 1) * S, c * S:(c + 1) * S] = [int(hx[i:i + 2], 16) for i in (0, 2, 4)]
Image.fromarray(img).save(os.path.join(OUT, 'palette.png'))
print('packed')

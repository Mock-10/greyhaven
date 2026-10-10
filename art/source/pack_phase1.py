"""Pack the Phase 1 building art into ../buildings2.png + ../buildings2.json.

Same frame format as the other atlases ('name/DIR' -> cell rect + ground anchor), but each building gets a
row sized to itself instead of one shared cell, which keeps the sheet small. All four orientations are
rendered (SE, SW, NW, NE); only fronts facing +x or +y (SE, NE) show their entrance to the camera.

Usage: python3 pack_phase1.py [procs]
"""
import os, sys, json, warnings
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
warnings.filterwarnings('ignore')
import numpy as np
from PIL import Image
import cache

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..')
DIRS = ['SE', 'S', 'SW', 'W', 'NW', 'N', 'NE', 'E']
ANGLES = (0, 2, 4, 6)
BUILDINGS = ['pellridge_tower', 'pellridge_tower_night', 'open_most_hours', 'open_most_hours_night', 'bar', 'bar_night', 'chop_shop', 'chop_shop_night',
             'apartment_block', 'apartment_block_night']


def main(procs=4):
    jobs = [('bld/' + b, a, 0.0) for b in BUILDINGS for a in ANGLES]
    cache.warm(jobs, procs=procs)
    rows = []
    for b in BUILDINGS:
        rows.append((b, [(DIRS[a], *cache.get('bld/' + b, a)) for a in ANGLES]))
    sheet_w = 0
    sheet_h = 0
    layout = []
    for name, cols in rows:
        cw = max(im.shape[1] for _, im, _, _ in cols) + 2
        ch = max(im.shape[0] for _, im, _, _ in cols) + 2
        layout.append((name, cols, cw, ch, sheet_h))
        sheet_w = max(sheet_w, cw * len(cols))
        sheet_h += ch
    sheet = np.zeros((sheet_h, sheet_w, 4), np.uint8)
    frames = {}
    for name, cols, cw, ch, y0 in layout:
        for ci, (d, im, ox, oy) in enumerate(cols):
            h, w = im.shape[:2]
            x = ci * cw + (cw - w) // 2
            y = y0 + (ch - h)
            sheet[y:y + h, x:x + w] = im
            frames[f'{name}/{d}'] = {'x': ci * cw, 'y': y0, 'w': cw, 'h': ch, 'anchor': [x - ci * cw + ox, y - y0 + oy]}
    Image.fromarray(sheet, 'RGBA').save(os.path.join(OUT, 'buildings2.png'), optimize=True)
    json.dump({'image': 'buildings2.png', 'cell': [0, 0],
               'note': 'Phase 1 buildings, one row per building sized to it (cell is per frame). anchor = pixel inside '
                       'the cell on the footprint centre. Directions SE, SW, NW, NE; *_night variants have lit windows.',
               'frames': frames}, open(os.path.join(OUT, 'buildings2.json'), 'w'), indent=1)
    print('packed', len(frames), 'frames', sheet.shape)


if __name__ == '__main__':
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 4)

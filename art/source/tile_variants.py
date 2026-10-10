"""Pack every ground tile in all 7 seeded variants (the reference scenes pick seed (i*31 + j*17) % 7).

The main tiles atlas only holds seed 3. This sheet lets the game draw the same per-tile variation as
scene.py. Output: ../tiles_var.png + ../tiles_var.json, frames keyed '<kind>/s<seed>', same cell and
anchor format as the other atlases (anchor = top vertex of the diamond).
"""
import os, sys, json, warnings
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
warnings.filterwarnings('ignore')
import numpy as np
from PIL import Image
import ground2d as G

SEEDS = 7
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..')


def main():
    tiles = {(k, s): G.make_tile(k, s) for k in G.TILES for s in range(SEEDS)}
    cw = max(im.shape[1] for im, _, _ in tiles.values()) + 2
    ch = max(im.shape[0] for im, _, _ in tiles.values()) + 2
    sheet = np.zeros((ch * len(G.TILES), cw * SEEDS, 4), np.uint8)
    frames = {}
    for ri, k in enumerate(G.TILES):
        for s in range(SEEDS):
            im, ox, oy = tiles[(k, s)]
            h, w = im.shape[:2]
            x = s * cw + (cw - w) // 2
            y = ri * ch + (ch - h)
            sheet[y:y + h, x:x + w] = im
            frames[f'{k}/s{s}'] = {'x': s * cw, 'y': ri * ch, 'w': cw, 'h': ch,
                                   'anchor': [x - s * cw + ox, y - ri * ch + oy]}
    Image.fromarray(sheet, 'RGBA').save(os.path.join(OUT, 'tiles_var.png'))
    json.dump({'image': 'tiles_var.png', 'cell': [cw, ch],
               'note': '64x32 iso diamond in 7 seeded variants per kind (seed = (i*31 + j*17) % 7 in the reference '
                       'scenes); anchor = top vertex of the diamond. Side faces hang below for curbs.',
               'frames': frames}, open(os.path.join(OUT, 'tiles_var.json'), 'w'), indent=1)
    print('packed', len(frames), 'tile variants')


if __name__ == '__main__':
    main()

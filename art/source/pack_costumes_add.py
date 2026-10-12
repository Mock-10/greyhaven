"""Add new costumes to ../characters.png + ../characters.json without repacking the whole sheet (Phase 5: the
Saltgate Union rival). Costumes in humans.COSTUMES that the sheet doesn't hold yet get their idle / walk1 / walk2
rows appended at the bottom, in the sheet's own cell size; run pack_steps.py afterwards for the in-between poses.

Usage: python3 pack_costumes_add.py
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
POSES = (('idle', 0.0), ('walk1', 0.6), ('walk2', -0.6))


def main():
    j = json.load(open(os.path.join(OUT, 'characters.json')))
    have = {k.split('/')[0] for k in j['frames']}
    new = [k for k in cache.factories() if k.startswith('char/') and k[5:] not in have]
    if not new:
        print('nothing to add')
        return
    cw, ch = j['cell']
    old = np.array(Image.open(os.path.join(OUT, 'characters.png')).convert('RGBA'))
    rows = [(f'{k[5:]}/{pose}', [(DIRS[a], *cache.get(k, a, w)) for a in range(8)]) for k in new for pose, w in POSES]
    add = np.zeros((ch * len(rows), old.shape[1], 4), np.uint8)
    y0 = old.shape[0]
    for ri, (rl, r) in enumerate(rows):
        for ci, (cl, im, ox, oy) in enumerate(r):
            h, w = im.shape[:2]
            assert w <= cw and h <= ch, f'{rl}/{cl} larger than the cell'
            x = ci * cw + (cw - w) // 2
            y = ri * ch + (ch - h)
            add[y:y + h, x:x + w] = im
            j['frames'][f'{rl}/{cl}'] = {'x': ci * cw, 'y': y0 + ri * ch, 'w': cw, 'h': ch,
                                         'anchor': [x - ci * cw + ox, y - ri * ch + oy]}
    Image.fromarray(np.concatenate([old, add], 0), 'RGBA').save(os.path.join(OUT, 'characters.png'), optimize=True)
    json.dump(j, open(os.path.join(OUT, 'characters.json'), 'w'), indent=1)
    print('added', [k[5:] for k in new], 'rows', len(rows))


if __name__ == '__main__':
    main()

"""Pack in-between walk poses into ../characters_steps.png + ../characters_steps.json.

The main characters atlas has idle (walk 0), walk1 (+0.6) and walk2 (-0.6). These extra poses at +0.4 (step1)
and -0.4 (step2) let the game play a smoother 8-frame cycle:
    idle -> step1 -> walk1 -> step1 -> idle -> step2 -> walk2 -> step2
Frames are keyed '<costume>/<pose>/<DIR>' exactly like the main atlas.

Usage: python3 pack_steps.py [procs]
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
POSES = (('step1', 0.4), ('step2', -0.4))


def main(procs=4):
    costumes = [k for k in cache.factories() if k.startswith('char/')]
    jobs = [(k, a, w) for k in costumes for _, w in POSES for a in range(8)]
    cache.warm(jobs, procs=procs)
    rows = [(f'{k[5:]}/{pose}', [(DIRS[a], *cache.get(k, a, w)) for a in range(8)]) for k in costumes for pose, w in POSES]
    # same cell as the main characters atlas so frames line up with it
    main_json = json.load(open(os.path.join(OUT, 'characters.json')))
    cw, ch = main_json['cell']
    assert all(im.shape[1] <= cw and im.shape[0] <= ch for _, r in rows for _, im, _, _ in r), 'pose larger than the main cell'
    sheet = np.zeros((ch * len(rows), cw * 8, 4), np.uint8)
    frames = {}
    for ri, (rl, r) in enumerate(rows):
        for ci, (cl, im, ox, oy) in enumerate(r):
            h, w = im.shape[:2]
            x = ci * cw + (cw - w) // 2
            y = ri * ch + (ch - h)
            sheet[y:y + h, x:x + w] = im
            frames[f'{rl}/{cl}'] = {'x': ci * cw, 'y': ri * ch, 'w': cw, 'h': ch, 'anchor': [x - ci * cw + ox, y - ri * ch + oy]}
    Image.fromarray(sheet, 'RGBA').save(os.path.join(OUT, 'characters_steps.png'), optimize=True)
    json.dump({'image': 'characters_steps.png', 'cell': [cw, ch],
               'note': 'In-between walk poses (step1 = walk +0.4, step2 = walk -0.4) for the 8-frame cycle '
                       'idle, step1, walk1, step1, idle, step2, walk2, step2. Same cell and anchor rules as characters.json.',
               'frames': frames}, open(os.path.join(OUT, 'characters_steps.json'), 'w'), indent=1)
    print('packed', len(frames), 'frames', sheet.shape)


if __name__ == '__main__':
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 4)

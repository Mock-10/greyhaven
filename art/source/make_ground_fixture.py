"""Write tests/fixtures/vector_ground.json: a small vector-ground scene composed by ground_vec.py with flat test
swatches, so the TypeScript compositor (src/iso/vectorGround.ts) can be checked against it pixel for pixel."""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import ground_vec as V
from citygeo import rect, round_corners, disc

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))


def flat(m):
    i = V.MAT_ID[m]
    a = np.zeros((V.SH, V.SW, 3), np.uint8)
    a[...] = ((i * 37) % 256, (i * 91) % 256, 120 + i)
    return a


def fnv(b):
    h = 0x811c9dc5
    for x in b:
        h ^= int(x); h = (h * 0x01000193) & 0xFFFFFFFF
    return h


for m in V.MAT_ORDER:
    V._SWATCH_CACHE[m] = flat(m)
shapes = [
    ('kerb', round_corners(rect(8, 6, 90, 70), 20)),
    ('sidewalk', round_corners(rect(11, 9, 87, 67), 17)),
    ('grass', disc(50, 40, 18, 3)),
    ('lot', rect(60, 20, 96, 34)),
    ('paint_white', rect(0, 80, 96, 82)),
]
x0, y0, W, H = -104, -6, 208, 112
img, mat = V.compose(shapes, 96, 96, 'asphalt', x0, y0, W, H)
out = {'mapW': 96, 'mapH': 96, 'base': 'asphalt', 'rect': [x0, y0, W, H],
       'shapes': [{'m': m, 'p': [[float(x), float(y)] for x, y in p]} for m, p in shapes],
       'hash': fnv(img.tobytes()), 'matHash': fnv(mat.astype(np.uint8).tobytes()),
       'samples': [[int(x), int(y), [int(v) for v in img[y, x]]] for x, y in ((104, 20), (60, 50), (150, 60), (104, 105), (30, 90))]}
json.dump(out, open(os.path.join(ROOT, 'tests', 'fixtures', 'vector_ground.json'), 'w'))
print('fixture', out['hash'], out['matHash'])

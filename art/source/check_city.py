"""Check an authored city map: overlapping footprints, buildings on roads, and the density rule (docs/01).

Density rule: no walkable open patch larger than about 3 x 3 tiles without a prop or a change in paving, except roads,
parking lots and designed open spaces. A tile is "dressed" when a non-building object stands on it or its paving
changes inside it (kerbstones don't count). Reports every 3 x 3 window of walkable tiles where none is dressed.

Usage: python3 check_city.py            (checks src/maps/downtown.json)
"""
import os, sys, json
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
T = 32
RES = 4                     # world units per raster pixel
ROADLIKE = {'asphalt', 'asphalt_wet', 'paint_white', 'paint_gold', 'iron', 'lot'}


def material_grid(m):
    n = m['width'] * T // RES
    mats = ['asphalt'] + sorted({s['m'] for s in m['ground']['shapes']})
    idx = {k: i for i, k in enumerate(mats)}
    im = Image.new('L', (n, n), idx[m['ground']['base']])
    d = ImageDraw.Draw(im)
    for s in m['ground']['shapes']:
        pts = [(x / RES, y / RES) for x, y in s['p']]
        if len(pts) >= 3:
            d.polygon(pts, fill=idx[s['m']])
    return np.array(im).T, mats       # [x, y]


def footprint(p):
    s = p['shadow']
    if s['kind'] == 'box':
        return (p['x'] - s['hx'], p['y'] - s['hy'], p['x'] + s['hx'], p['y'] + s['hy'])
    if s['kind'] == 'obox':
        import math
        a = s['ang']; hx, hy = s['hx'], s['hy']
        ex = abs(hx * math.cos(a)) + abs(hy * math.sin(a)); ey = abs(hx * math.sin(a)) + abs(hy * math.cos(a))
        return (p['x'] - ex, p['y'] - ey, p['x'] + ex, p['y'] + ey)
    r = s['r'] if not p['sprite'].startswith(('prop/tree', 'prop/pine')) else 4
    return (p['x'] - r, p['y'] - r, p['x'] + r, p['y'] + r)


def check(path):
    return check_dict(json.load(open(path)))


def check_dict(m):
    N = m['width']
    grid, mats = material_grid(m)
    issues = []
    blds = [p for p in m['placements'] if p['sprite'].startswith('bld/')]
    fps = [footprint(p) for p in blds]
    # buildings must not overlap each other (1 unit tolerance) or stand on a road
    for i in range(len(blds)):
        a = fps[i]
        for j in range(i + 1, len(blds)):
            b = fps[j]
            ox = min(a[2], b[2]) - max(a[0], b[0]); oy = min(a[3], b[3]) - max(a[1], b[1])
            if ox > 1 and oy > 1:
                issues.append(f"overlap: {blds[i]['sprite']} @({blds[i]['x']/T:.1f},{blds[i]['y']/T:.1f}) and {blds[j]['sprite']} @({blds[j]['x']/T:.1f},{blds[j]['y']/T:.1f}) by {ox:.0f}x{oy:.0f}")
        x0, y0, x1, y1 = [int(v / RES) for v in a]
        sub = grid[max(0, x0):x1, max(0, y0):y1]
        roadish = np.isin(sub, [mats.index(k) for k in ('asphalt', 'paint_white', 'paint_gold') if k in mats]).mean() if sub.size else 0
        if roadish > 0.02:
            issues.append(f"on road: {blds[i]['sprite']} @({blds[i]['x']/T:.1f},{blds[i]['y']/T:.1f}) {roadish*100:.0f}%")
    # props overlapping buildings
    for p in m['placements']:
        if p['sprite'].startswith('bld/') or p['sprite'].startswith('veh/'):
            continue
        f = footprint(p)
        for b, bf in zip(blds, fps):
            ox = min(f[2], bf[2]) - max(f[0], bf[0]); oy = min(f[3], bf[3]) - max(f[1], bf[1])
            if ox > 2 and oy > 2:
                issues.append(f"prop in building: {p['sprite']} @({p['x']/T:.1f},{p['y']/T:.1f}) in {b['sprite']}")
    # density
    walk = np.zeros((N, N), bool); dressed = np.zeros((N, N), bool)
    occupied = np.zeros((N, N), bool)
    kerb = mats.index('kerb') if 'kerb' in mats else -1
    road_ids = [mats.index(k) for k in ROADLIKE if k in mats]
    step = T // RES
    for i in range(N):
        for j in range(N):
            cell = grid[i * step:(i + 1) * step, j * step:(j + 1) * step]
            c = cell[step // 2, step // 2]
            walk[i, j] = c not in road_ids
            u = set(np.unique(cell).tolist()) - {kerb}
            dressed[i, j] = len(u) > 1
    for p, f in [(p, footprint(p)) for p in m['placements']]:
        i0, j0 = int(max(0, f[0] // T)), int(max(0, f[1] // T))
        i1, j1 = int(min(N - 1, f[2] // T)), int(min(N - 1, f[3] // T))
        if p['sprite'].startswith('bld/'):
            occupied[i0:i1 + 1, j0:j1 + 1] |= True
            # only tiles fully covered count as occupied
            fi0, fj0 = int(np.ceil(f[0] / T)), int(np.ceil(f[1] / T))
            fi1, fj1 = int(f[2] // T), int(f[3] // T)
            occupied[i0:i1 + 1, j0:j1 + 1] = False
            occupied[max(0, fi0):fi1, max(0, fj0):fj1] = True
        else:
            dressed[i0:i1 + 1, j0:j1 + 1] = True
    walk &= ~occupied
    bare = walk & ~dressed
    bad = []
    for i in range(N - 2):
        for j in range(N - 2):
            if bare[i:i + 3, j:j + 3].all():
                bad.append((i, j))
    return issues, bad, bare


if __name__ == '__main__':
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'src', 'maps', 'downtown.json')
    issues, bad, bare = check(path)
    for s in issues:
        print(s)
    print(f'{len(issues)} placement issues, {len(bad)} bare 3x3 windows')
    for i, j in bad[:60]:
        print(f'  bare window at tiles i {i}..{i + 2}, j {j}..{j + 2}')
    sys.exit(1 if issues or bad else 0)

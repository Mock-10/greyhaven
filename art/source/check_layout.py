"""Layout checker for interior drafts: overlapping furniture, clipping walls, floating clutter, facing.

Usage: python3 check_layout.py [room ...]      (room = a draft function in rooms.py, e.g. bar)

It runs each draft function with compose() intercepted, so it sees exactly the items the draft places.
Footprints come from each model's bounding box, rotated by its facing, so they are slightly generous;
only penetrations deeper than TOL world units are reported.

Checks:
  * overlap   - two floor-standing pieces whose footprints overlap (furniture on top of furniture)
  * wall      - a floor piece crossing the back walls, the room edge or a partition wall
  * surface   - an item placed on a surface (wz > 0) that has no surface under it at that height
  * facing    - a seat (chair, stool, booth, sofa, armchair) whose front does not point at the nearest
                desk / table / counter / TV within reach (docs/18 facing rules); listed for review
"""
import os, sys, warnings
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
warnings.filterwarnings('ignore')
import numpy as np
import decor as D
import interiors as I
import props2
import rooms

TOL = 1.5
SEATS = {'office_chair', 'wooden_chair', 'bar_stool', 'booth', 'armchair', 'sofa'}
TARGETS = {'exec_desk', 'ledger_desk', 'cubicle', 'pub_table', 'bar_counter', 'coffee_table', 'table_chairs', 'tv_stand',
           'reception_desk', 'side_table', 'counting_table', 'pool_table'}
# seats that face something other than a table on purpose (lounge seating, waiting areas)
FREE_SEATS = {'armchair'}


def _tag(module):
    for name in dir(module):
        f = getattr(module, name)
        if callable(f) and not name.startswith('_') and getattr(f, '__module__', None) == module.__name__:
            def wrap(*a, _f=f, _n=name, **k):
                m = _f(*a, **k)
                try:
                    m.kind = _n
                except AttributeError:
                    pass
                return m
            setattr(module, name, wrap)


for mod in (D, I, props2):
    _tag(mod)


class Captured(Exception):
    pass


def capture(room):
    box = {}

    def fake_compose(W_t, D_t, floor, walls, items, partitions=(), stub_gaps=(), **kw):
        box.update(W=W_t * rooms.T, D=D_t * rooms.T, items=items, partitions=partitions, floor=floor, walls=walls, stub_gaps=stub_gaps)
        raise Captured
    real = rooms.compose
    rooms.compose = fake_compose
    try:
        getattr(rooms, room)()
    except Captured:
        pass
    finally:
        rooms.compose = real
    return box


def footprint(item):
    model, ang, wx, wy, shadow, fl = item
    if isinstance(model, tuple):            # a character image: a person stands on about a 10 x 10 spot
        x0, x1, y0, y1, z0, z1 = -5, 5, -5, 5, 0, 40
        kind = 'person'
    else:
        x0, x1, y0, y1, z0, z1 = model.bbox
        kind = getattr(model, 'kind', '?')
    c, s = np.cos(ang), np.sin(ang)
    pts = np.array([[x, y] for x, y in ((x0, y0), (x1, y0), (x1, y1), (x0, y1))])
    world = np.stack([pts[:, 0] * c - pts[:, 1] * s + wx, pts[:, 0] * s + pts[:, 1] * c + wy], 1)
    return dict(kind=kind, poly=world, z0=z0 + fl.get('wz', 0.0), z1=z1 + fl.get('wz', 0.0), wz=fl.get('wz', 0.0),
                flat=(z1 - z0) <= 1.6 or fl.get('z_bias', 0) == -300, ang=ang, x=wx, y=wy, fl=fl)


def penetration(a, b):
    """Smallest overlap depth along the separating axes of two convex polygons (<= 0: apart)."""
    best = np.inf
    for poly in (a, b):
        for k in range(len(poly)):
            e = poly[(k + 1) % len(poly)] - poly[k]
            nrm = np.array([-e[1], e[0]]) / (np.hypot(*e) + 1e-9)
            pa, pb = a @ nrm, b @ nrm
            best = min(best, min(pa.max(), pb.max()) - max(pa.min(), pb.min()))
    return best


def nearest_on(poly, p):
    """Closest point to p on a convex polygon (p itself when inside)."""
    if penetration(poly, rect(p[0] - 0.01, p[0] + 0.01, p[1] - 0.01, p[1] + 0.01)) > 0:
        return poly.mean(0)
    best, bd = None, np.inf
    for k in range(len(poly)):
        a_, b_ = poly[k], poly[(k + 1) % len(poly)]
        t = np.clip((p - a_) @ (b_ - a_) / ((b_ - a_) @ (b_ - a_) + 1e-9), 0, 1)
        q = a_ + t * (b_ - a_)
        d = np.hypot(*(q - p))
        if d < bd:
            best, bd = q, d
    return best


def rect(x0, x1, y0, y1):
    return np.array([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], float)


def walls_of(box):
    W, D_ = box['W'], box['D']
    out = [('back wall A', rect(0, W, -rooms.WT, 0)), ('back wall B', rect(-rooms.WT, 0, 0, D_)),
           ('front edge', rect(0, W, D_, D_ + rooms.WT)), ('right edge', rect(W, W + rooms.WT, 0, D_))]
    for axis, pos, a0, a1, gaps in box['partitions']:
        spans, a = [], a0
        cuts = sorted(gaps)
        for g0, g1 in cuts:
            if g0 > a:
                spans.append((a, g0))
            a = max(a, g1)
        if a < a1:
            spans.append((a, a1))
        for s0, s1 in spans:
            r = rect(s0, s1, pos - rooms.WT / 2, pos + rooms.WT / 2) if axis == 'x' else rect(pos - rooms.WT / 2, pos + rooms.WT / 2, s0, s1)
            out.append((f'partition {axis}={pos}', r))
    return out


def check(room):
    box = capture(room)
    fps = [footprint(it) for it in box['items']]
    floor = [f for f in fps if f['wz'] == 0 and f['z0'] < 10 and not f['flat'] and f['kind'] != 'door_leaf']
    issues = []
    for i in range(len(floor)):
        for j in range(i + 1, len(floor)):
            a, b = floor[i], floor[j]
            if 'person' in (a['kind'], b['kind']) and ({a['kind'], b['kind']} & SEATS):
                continue                     # a person may stand at a stool or sit-stand behind a chair
            d = penetration(a['poly'], b['poly'])
            if d > TOL:
                issues.append(f"overlap  {a['kind']} @({a['x']:.0f},{a['y']:.0f}) x {b['kind']} @({b['x']:.0f},{b['y']:.0f}): {d:.1f}")
    for f in floor:
        if f['kind'] == 'person':
            continue
        for name, w in walls_of(box):
            d = penetration(f['poly'], w)
            # wall-mounted pieces sit against the back walls by design
            if d > TOL and not (name.startswith('back wall') and d < rooms.WT + 2):
                issues.append(f"wall     {f['kind']} @({f['x']:.0f},{f['y']:.0f}) crosses {name}: {d:.1f}")
    for f in fps:
        if f['wz'] <= 0:
            continue
        cx, cy = f['poly'].mean(0)
        # a supporting piece contains the spot and reaches at least the surface height (a cubicle's
        # panels rise above its desk top, so only a lower bound on its height can be checked)
        under = [g for g in fps if g is not f and g['wz'] == 0 and g['z1'] >= f['wz'] - 2
                 and penetration(g['poly'], rect(cx - 0.5, cx + 0.5, cy - 0.5, cy + 0.5)) > 0]
        if not under:
            issues.append(f"surface  {f['kind']} @({f['x']:.0f},{f['y']:.0f}) wz={f['wz']} has nothing under it")
    for f in fps:
        if f['kind'] not in SEATS or f['kind'] in FREE_SEATS:
            continue
        targets = [g for g in fps if g['kind'] in TARGETS]
        if not targets:
            continue
        p = np.array([f['x'], f['y']], float)
        g = min(targets, key=lambda g: np.hypot(*(nearest_on(g['poly'], p) - p)))
        gc = nearest_on(g['poly'], p)
        dist = np.hypot(gc[0] - f['x'], gc[1] - f['y'])
        if dist > 48:
            continue
        front = np.array([-np.sin(f['ang']), np.cos(f['ang'])])
        to = (gc - (f['x'], f['y'])) / (dist + 1e-9)
        ang = np.degrees(np.arccos(np.clip(front @ to, -1, 1)))
        if ang > 60:
            issues.append(f"facing   {f['kind']} @({f['x']:.0f},{f['y']:.0f}) faces {ang:.0f} deg away from {g['kind']} @({gc[0]:.0f},{gc[1]:.0f})")
    return issues


if __name__ == '__main__':
    rooms_ = sys.argv[1:] or ['tower_lobby', 'office_floor', 'bar']
    total = 0
    for r in rooms_:
        issues = check(r)
        total += len(issues)
        print(f'== {r}: {len(issues)} issue(s)')
        for s in issues:
            print('  ' + s)
    sys.exit(1 if total else 0)

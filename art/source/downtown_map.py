"""The test Downtown ("The Ledger"), 70 x 48 tiles (48 x 48 until 2026-10-11, then widened east for Gullsway), authored as vector ground plus placements (Phase 1 milestone 1b).

This one file is the source of truth for the map. It writes:
  - src/maps/downtown.json: ground shapes, placements, doors, street spans and spawn, read by the game;
  - art/drafts/downtown/*.png: the draft renders (day and dusk) for approval.

Layout (tiles): Overcast Avenue runs east-west at j = 18..22, Drizzle Row at j = 35..39. Pewter Street runs north-south
at i = 18..22. Millwright Road runs north-south at i = 34..38, then bends east to i = 39..43 between j = 23 and 33.
Gullsway (towards the Docks) runs north-south at i = 60..64 and bends east past Drizzle Row.
Roads are 4 tiles wide with 2-tile sidewalks. Only faces pointing +x or +y can be seen, so every entrance that matters
faces south or east; buildings across a street show their dressed backs.

Usage: python3 downtown_map.py [--no-render] [--procs N]
"""
import os, sys, json, math, warnings
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
warnings.filterwarnings('ignore')
import numpy as np
from citygeo import arc, disc, rect, round_corners, stroke, dashes, offset, along, resample, ellipse, point_in_poly
import infill
import street

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
T = 32.0
NW, NH = 70, 48     # map size in tiles: x (east) and y (south)
N = NW
MAPW = NW * T       # world width (x)
MAPH = NH * T       # world height (y)
HW = 2 * T          # road half width
SWK = 2 * T         # sidewalk width
KERB = 3.0          # kerbstone strip
R_CORNER = 44.0     # kerb radius at street corners
B = 2.6             # building model scale


def tc(t):
    return t * T


# ------------------------------------------------------------------ roads
def smooth(s):
    s = np.clip(s, 0.0, 1.0)
    return s * s * (3 - 2 * s)


def mill_x(y):
    """Millwright Road's centre line x at world y (the bend)."""
    return tc(36 + 5 * smooth((y / T - 23.0) / 10.0))


def gull_x(y):
    """Gullsway's centre line x at world y: straight, then bending east toward the Docks past Drizzle Row."""
    return tc(62 + 3 * smooth((y / T - 40.0) / 8.0))


Y_SAMPLES = np.linspace(-T, MAPH + T, 401)
ROADS_Y = {
    'PEWTER STREET': np.stack([np.full_like(Y_SAMPLES, tc(20)), Y_SAMPLES], 1),
    'MILLWRIGHT ROAD': np.stack([mill_x(Y_SAMPLES), Y_SAMPLES], 1),
    'GULLSWAY': np.stack([gull_x(Y_SAMPLES), Y_SAMPLES], 1),
}
ROADS_X = {'OVERCAST AVENUE': tc(20), 'DRIZZLE ROW': tc(37)}


def y_edge(name, y, side, d):
    """x of the line `d` units from a north-south road's centre line, measured along the normal, at world y.
    side +1 is east of the road, -1 west."""
    line = offset(ROADS_Y[name], -side * d)     # the centre line runs +y: its left is -x
    return float(np.interp(y, line[:, 1], line[:, 0]))


def y_edge_line(name, y0, y1, side, d):
    line = offset(ROADS_Y[name], -side * d)
    sel = (line[:, 1] > y0) & (line[:, 1] < y1)
    pts = [[float(np.interp(y0, line[:, 1], line[:, 0])), y0]] + line[sel].tolist() + [[float(np.interp(y1, line[:, 1], line[:, 0])), y1]]
    return pts


# ------------------------------------------------------------------ blocks
class Block:
    """A city block between roads (or the map edge). Sides: 'w', 'e' are a road name or None (map edge);
    'n', 's' likewise for the x-roads."""

    def __init__(self, name, w, e, n, s, sidewalks=None):
        self.name, self.w, self.e, self.n, self.s = name, w, e, n, s
        self.sidewalks = sidewalks if sidewalks is not None else {k for k in 'wens' if getattr(self, k)}

    def y_range(self, d):
        y0 = ROADS_X[self.n] + HW + d if self.n else -2.0
        y1 = ROADS_X[self.s] - HW - d if self.s else MAPH + 2.0
        return y0, y1

    def poly(self, d=0.0, radius=None, sides=None):
        """Outline inset by d from the kerb on road sides (sides: which sides to inset, default the road sides)."""
        sides = sides if sides is not None else {k for k in 'wens' if getattr(self, k)}
        dn = d if 'n' in sides else 0.0
        ds = d if 's' in sides else 0.0
        y0 = (ROADS_X[self.n] + HW + dn) if self.n else -2.0
        y1 = (ROADS_X[self.s] - HW - ds) if self.s else MAPH + 2.0
        if self.e:
            east = y_edge_line(self.e, y0, y1, -1, HW + (d if 'e' in sides else 0.0))
        else:
            east = [[MAPW + 2.0, y0], [MAPW + 2.0, y1]]
        if self.w:
            west = y_edge_line(self.w, y0, y1, +1, HW + (d if 'w' in sides else 0.0))
        else:
            west = [[-2.0, y0], [-2.0, y1]]
        pts = [west[0]] + east + west[::-1][:-1]
        # corners: NW = 0, NE = 1, SE = len(east), SW = len(east) + 1
        ne, se, sw = 1, len(east), len(east) + 1
        corners = []
        r = R_CORNER - d if radius is None else radius
        if self.n and self.w and 'n' in sides and 'w' in sides: corners.append(0)
        if self.n and self.e and 'n' in sides and 'e' in sides: corners.append(ne)
        if self.s and self.e and 's' in sides and 'e' in sides: corners.append(se)
        if self.s and self.w and 's' in sides and 'w' in sides: corners.append(sw)
        if r > 1:
            pts = round_corners(pts, r, corners)
        return pts

    def interior(self):
        return self.poly(SWK, radius=0, sides=self.sidewalks)

    def side_line(self, side, d):
        """The block's side `side` as a polyline `d` units in from the kerb, ordered so the block is on the right
        when walking along it (clockwise on screen)."""
        y0, y1 = self.y_range(d)
        if side == 'n':
            x0 = y_edge(self.w, y0, +1, HW + d) if self.w else 0.0
            x1 = y_edge(self.e, y0, -1, HW + d) if self.e else MAPW
            return [[x0, y0], [x1, y0]]
        if side == 's':
            x0 = y_edge(self.w, y1, +1, HW + d) if self.w else 0.0
            x1 = y_edge(self.e, y1, -1, HW + d) if self.e else MAPW
            return [[x1, y1], [x0, y1]]
        if side == 'e':
            return y_edge_line(self.e, y0, y1, -1, HW + d)
        if side == 'w':
            return y_edge_line(self.w, y0, y1, +1, HW + d)[::-1]


P, M, G = 'PEWTER STREET', 'MILLWRIGHT ROAD', 'GULLSWAY'
O, D = 'OVERCAST AVENUE', 'DRIZZLE ROW'
BLOCKS = {
    'nw': Block('nw', None, P, None, O),
    'n': Block('n', P, M, None, O),
    'ne': Block('ne', M, G, None, O),
    'w': Block('w', None, P, O, D),
    'mid': Block('mid', P, M, O, D),
    'e': Block('e', M, G, O, D, sidewalks={'n', 's'}),
    'sw': Block('sw', None, P, D, None),
    's': Block('s', P, M, D, None),
    'se': Block('se', M, G, D, None, sidewalks={'n'}),
    # the far side of Gullsway: the town's eastern edge, an embankment toward The Works
    'gn': Block('gn', G, None, None, O, sidewalks={'w', 's'}),
    'gm': Block('gm', G, None, O, D, sidewalks={'w', 'n', 's'}),
    'gs': Block('gs', G, None, D, None, sidewalks={'w', 'n'}),
}

# ------------------------------------------------------------------ output collections
SHAPES = []          # (material, polygon)
PL = []              # placements (dicts in the game's Placement shape plus a footprint for sorting)
DOORS = []
RNG = np.random.default_rng(7)


def ground(mat, poly):
    SHAPES.append((mat, [[round(float(x), 2), round(float(y), 2)] for x, y in poly]))


# shadows / footprints of props, in world units: ('blob', r) or ('box', hx, hy, h)
PROP = {
    'lamp': ('blob', 4), 'bench': ('box', 17, 5, 12), 'trash_can': ('blob', 5), 'hydrant': ('blob', 4),
    'mailbox': ('blob', 4), 'planter': ('blob', 13), 'tree_a': ('blob', 26), 'tree_b': ('blob', 26), 'pine': ('blob', 18),
    'bush': ('blob', 12), 'dumpster': ('box', 16, 8, 17), 'crate': ('box', 8, 8, 15), 'barrel_teal': ('blob', 6),
    'barrel_brick': ('blob', 6), 'traffic_light': ('blob', 5), 'street_sign': ('blob', 4),
    'gas_pump': ('box', 9, 6, 28), 'bus_shelter': ('box', 23, 8, 38), 'phone_booth': ('box', 6, 6, 44), 'parking_meter': ('blob', 2.5),
    'utility_box': ('box', 6, 3.5, 18), 'bollard': ('blob', 2), 'ad_column': ('blob', 8), 'sandwich_board': ('blob', 4),
    'cafe_set': ('blob', 12), 'cafe_set_red': ('blob', 12), 'kiosk': ('box', 15, 9, 26), 'fountain': ('blob', 38),
    'pallets': ('box', 10, 8, 8), 'pipes': ('box', 18, 5, 7), 'ac_unit': ('box', 8, 6, 14), 'trash_bags': ('blob', 8),
    'bin_sage': ('box', 5, 6, 19), 'bin_navy': ('box', 5, 6, 19), 'boxes': ('box', 9, 6, 14), 'cones': ('blob', 5),
    'news_box': ('box', 4, 3.5, 19), 'news_box_blue': ('box', 4, 3.5, 19), 'bike_rack': ('box', 9, 4, 8),
    'street_planter': ('box', 10, 5, 12), 'bus_stop_sign': ('blob', 2),
}
NONSOLID = {'tree_a', 'tree_b', 'pine', 'bush', 'cones', 'trash_bags'}
BUILDING = {
    'pellridge_tower': (28, 28, 125), 'open_most_hours': (24, 15, 31), 'apartment_block': (24, 17, 64),
    'bar': (22, 15, 28), 'chop_shop': (28, 19, 25),
}
BUILDING.update(infill.FOOTPRINTS)
SEG_THICK = {'wall_brick': (3.2, 10), 'wall_stone': (3.2, 10), 'railing': (1.0, 15), 'fence': (1.0, 20), 'bed': (5.0, 12),
             'hedge': (4.5, 12)}


def _fp_box(x, y, hx, hy):
    return [x - hx, y - hy, x + hx, y + hy]


def prop(kind, x, y, dir=0, solid=None, **kw):
    sh = PROP[kind]
    shadow = {'kind': 'blob', 'r': sh[1]} if sh[0] == 'blob' else {'kind': 'box', 'hx': sh[1], 'hy': sh[2], 'h': sh[3]}
    if sh[0] == 'box' and dir in (2, 6):
        shadow['hx'], shadow['hy'] = shadow['hy'], shadow['hx']
    r = sh[1]
    fp = _fp_box(x, y, r, r) if sh[0] == 'blob' else _fp_box(x, y, shadow['hx'], shadow['hy'])
    if kind.startswith('tree') or kind == 'pine':
        fp = _fp_box(x, y, 4, 4)        # the trunk: the crown is above the ground
    p = {'sprite': f'prop/{kind}', 'dir': int(dir) % 8, 'x': round(float(x), 2), 'y': round(float(y), 2), 'shadow': shadow,
         'solid': (kind not in NONSOLID) if solid is None else solid, 'fp': fp}
    if kind == 'lamp':
        p['lamp'] = True
    p.update(kw)
    PL.append(p)
    return p


def building(name, x, y, dir=0, door=None, front=None, solid=True):
    """Place a building by its footprint centre. door = (offset along the front in model units, target, label)."""
    hx, hy, h = BUILDING[name]
    hx, hy = hx * B, hy * B
    if dir in (2, 6):
        hx, hy = hy, hx
    p = {'sprite': f'bld/{name}', 'dir': dir, 'x': round(float(x), 2), 'y': round(float(y), 2),
         'shadow': {'kind': 'box', 'hx': round(hx, 2), 'hy': round(hy, 2), 'h': round(h * B, 2)}, 'solid': solid, 'night': True,
         'fp': _fp_box(x, y, hx, hy)}
    PL.append(p)
    if door:
        dx, target, label = door
        if dir == 0:
            DOORS.append({'x': round(x + dx * B, 2), 'y': round(y + hy + 10, 2), 'target': target, 'label': f'ENTER {label}'})
        elif dir == 6:
            DOORS.append({'x': round(x + hx + 10, 2), 'y': round(y - dx * B, 2), 'target': target, 'label': f'ENTER {label}'})
    return p


def front_y(name, fy, dir=0):
    """Centre y for a building whose front (+y) face sits on world y = fy."""
    hx, hy, _ = BUILDING[name]
    return fy - (hx if dir in (2, 6) else hy) * B


def half(name, dir=0):
    hx, hy, _ = BUILDING[name]
    return (hy * B, hx * B) if dir in (2, 6) else (hx * B, hy * B)


def row(names, x0, fy, dir=0, gap=0.0, doors=None):
    """A terrace of buildings along x with their fronts on y = fy, starting at x0. Returns the end x."""
    x = x0
    for k, nm in enumerate(names):
        hx, hy = half(nm, dir)
        cy = fy - hy if dir == 0 else fy + hy
        building(nm, x + hx, cy, dir, door=(doors or {}).get(k))
        x += 2 * hx + gap
    return x


def col(names, fx, y0, dir=6, gap=0.0):
    """A terrace along y with fronts on x = fx (dir 6 faces +x)."""
    y = y0
    for nm in names:
        hx, hy = half(nm, dir)
        building(nm, fx - hx if dir == 6 else fx + hx, y + hy, dir)
        y += 2 * hy + gap
    return y


def segments(kind, pts, closed=False):
    """Wall, fence, railing, bed or hedge segments along a polyline, at the nearest of 16 angles."""
    L = street.SEGMENT_LEN[kind]
    line = resample(pts, 1.0)
    seg = np.linalg.norm(np.diff(line, axis=0), axis=1)
    total = float(seg.sum())
    n = max(1, int(round(total / L)))
    step = total / n
    thick, h = SEG_THICK[kind]
    for (p, d, t) in along(line, step, start=step / 2, end=total):
        ang = math.atan2(d[1], d[0])
        k = int(round(ang / (2 * math.pi / street.SEGMENT_ANGLES))) % street.SEGMENT_ANGLES
        a = k * 2 * math.pi / street.SEGMENT_ANGLES
        hx = abs(L / 2 * math.cos(a)) + abs(thick * math.sin(a))
        hy = abs(L / 2 * math.sin(a)) + abs(thick * math.cos(a))
        PL.append({'sprite': f'seg/{kind}', 'dir': k, 'x': round(float(p[0]), 2), 'y': round(float(p[1]), 2),
                   'shadow': {'kind': 'obox', 'hx': L / 2, 'hy': thick, 'h': h, 'ang': round(a, 4)}, 'solid': True,
                   'fp': _fp_box(p[0], p[1], hx, hy)})


def car(name, x, y, dir, interact=None, parked=False):
    """A car. `parked` cars can be stolen and driven (milestone 3): the game turns them into vehicles."""
    along_y = dir in (2, 6)
    hx, hy = (16, 40) if along_y else (40, 16)
    p = {'sprite': f'veh/{name}', 'dir': dir, 'x': x, 'y': y, 'shadow': {'kind': 'box', 'hx': hx, 'hy': hy, 'h': 22},
         'solid': True, 'fp': _fp_box(x, y, hx, hy)}
    if parked:
        p['parked'] = True
    PL.append(p)
    return p


def lawn(poly, radius=24.0, edge=2.5, mat='grass'):
    """A patch of grass with a stone edging and rounded corners."""
    P = np.asarray(poly, float)
    if radius > 0 and len(P) == 4:
        x0, y0 = P.min(0); x1, y1 = P.max(0)
        ground('kerb', round_corners(rect(x0 - edge, y0 - edge, x1 + edge, y1 + edge), radius + edge))
        ground(mat, round_corners(rect(x0, y0, x1, y1), radius))
    else:
        ground('kerb', poly)
        ground(mat, poly)


def tree_pit(x, y, kind='tree_a'):
    ground('grate', rect(x - 14, y - 14, x + 14, y + 14))
    ground('soil', rect(x - 8, y - 8, x + 8, y + 8))
    prop(kind, x, y)


# ------------------------------------------------------------------ ground: blocks, kerbs, sidewalks
def lay_blocks():
    for b in BLOCKS.values():
        ground('kerb', b.poly(0))
        ground('sidewalk', b.poly(KERB))
    # sidewalks only where the block has them: the yard by Millwright Road is fenced at the kerb
    ground('gravel', BLOCKS['e'].poly(KERB + 2, radius=0, sides={'n', 's', 'w', 'e'}))


def lay_markings():
    # x-roads: double centre line in gold, white edge lines, between the crossings
    xs = [tc(20), None]
    for name, cy in ROADS_X.items():
        cxs = [float(np.interp(cy, l[:, 1], l[:, 0])) for l in ROADS_Y.values()]
        gaps = [(c - HW - 40, c + HW + 40) for c in cxs]
        spans = []
        x = 0.0
        for g0, g1 in sorted(gaps):
            spans.append((x, g0)); x = g1
        spans.append((x, MAPW))
        for a, b in spans:
            if b - a < 8:
                continue
            for dy in (-2.2, 2.2):
                ground('paint_gold', rect(a, cy + dy - 0.8, b, cy + dy + 0.8))
            for dy in (-HW + 4, HW - 4):
                ground('paint_white', rect(a, cy + dy - 0.9, b, cy + dy + 0.9))
        # crosswalks across the x-road on both sides of each crossing
        for c in cxs:
            for x0 in (c - HW - 36, c + HW + 4):
                for k in range(9):
                    yy = cy - HW + 8 + k * 14
                    ground('paint_white', rect(x0, yy, x0 + 32, yy + 7))
                # stop lines
            ground('paint_white', rect(c - HW - 44, cy, c - HW - 40, cy + HW - 6))
            ground('paint_white', rect(c + HW + 40, cy - HW + 6, c + HW + 44, cy))
    # y-roads, following the bend
    for name, line in ROADS_Y.items():
        gaps = [(ROADS_X[O] - HW - 40, ROADS_X[O] + HW + 40), (ROADS_X[D] - HW - 40, ROADS_X[D] + HW + 40)]
        spans = [(-T, gaps[0][0]), (gaps[0][1], gaps[1][0]), (gaps[1][1], MAPH + T)]
        for a, b in spans:
            sel = line[(line[:, 1] >= a) & (line[:, 1] <= b)]
            if len(sel) < 2:
                continue
            for dd in (-2.2, 2.2):
                ground('paint_gold', stroke(offset(sel, dd), 1.6))
            for dd in (-HW + 4, HW - 4):
                ground('paint_white', stroke(offset(sel, dd), 1.8))
        for cy in ROADS_X.values():
            for y0 in (cy - HW - 36, cy + HW + 4):
                cx = float(np.interp(y0 + 16, line[:, 1], line[:, 0]))
                for k in range(9):
                    xx = cx - HW + 8 + k * 14
                    ground('paint_white', rect(xx, y0, xx + 7, y0 + 32))
            cx = float(np.interp(cy, line[:, 1], line[:, 0]))
            ground('paint_white', rect(cx - HW + 6, cy - HW - 44, cx, cy - HW - 40))
            ground('paint_white', rect(cx, cy + HW + 40, cx + HW - 6, cy + HW + 44))
    # manholes, drains and puddles on the roads
    for (x, y) in ((tc(20), tc(20)), (tc(9), tc(37.6)), (tc(30), tc(19.2)), (mill_x(tc(28)), tc(28)), (tc(20.8), tc(6)),
                   (tc(45), tc(36.5)), (tc(20), tc(44))):
        ground('kerb', disc(x, y, 7.2))
        ground('iron', disc(x, y, 6.0))
    for name, cy in ROADS_X.items():
        for x in np.arange(tc(3), MAPW, tc(7)):
            for side in (-1, 1):
                y = cy + side * (HW - 3)
                ground('grate', rect(x - 6, y - 2.5, x + 6, y + 2.5))
    for (x, y, rx, ry) in ((tc(11), tc(21.2), 22, 9), (tc(26), tc(36.2), 30, 11), (tc(44), tc(18.8), 18, 8), (tc(19.2), tc(30), 9, 20),
                           (mill_x(tc(44)) + 20, tc(44), 10, 18), (tc(6), tc(38.6), 16, 7)):
        ground('asphalt_wet', ellipse(x, y, rx, ry))


def paving_patches():
    """Break the sidewalk paving up: cracked slabs, a few stains."""
    for b in BLOCKS.values():
        for side in sorted(b.sidewalks):
            line = b.side_line(side, SWK / 2)
            for (p, d, t) in along(line, 72, start=30):
                if RNG.random() < 0.55:
                    w = 16 * RNG.integers(1, 3); l = 16 * RNG.integers(2, 4)
                    x0 = np.floor(p[0] / 16) * 16; y0 = np.floor(p[1] / 16) * 16
                    if abs(d[0]) > abs(d[1]):
                        ground('sidewalk_b', rect(x0, y0 - 8, x0 + l, y0 - 8 + w))
                    else:
                        ground('sidewalk_b', rect(x0 - 8, y0, x0 - 8 + w, y0 + l))


# ------------------------------------------------------------------ street dressing
NO_GO = []           # (x, y, r) where kerb-side props must not go: doors, crossings, driveways


def keep_clear(x, y, r):
    NO_GO.append((x, y, r))


def clear(x, y, r=10):
    return all((x - a) ** 2 + (y - b) ** 2 > (r + c) ** 2 for a, b, c in NO_GO)


KERB_MIX = ['tree', 'hydrant', 'news', 'parking_meter', 'planter', 'tree', 'bike_rack', 'trash_can', 'bollards', 'tree', 'bench', 'utility_box']


def dress_sidewalks():
    """Lamps and kerb-side furniture every few metres along every sidewalk, leaving doors and crossings clear."""
    k = 0
    for b in BLOCKS.values():
        for side in sorted(b.sidewalks):
            line = b.side_line(side, 10)
            seg = np.linalg.norm(np.diff(np.asarray(line, float), axis=0), axis=1).sum()
            for (p, d, t) in along(line, 48, start=40, end=seg - 40):
                x, y = p
                nx, ny = d[1], -d[0]           # the normal pointing back toward the road
                if not clear(x, y, 12):
                    continue
                if int(t // 48) % 4 == 1:
                    lp = prop('lamp', x, y, dir=_dir_toward(nx, ny))
                    keep_clear(x, y, 14)
                    continue
                kind = KERB_MIX[k % len(KERB_MIX)]; k += 1
                ix, iy = x - nx * 4, y - ny * 4      # a little further in from the kerb
                if kind == 'tree':
                    tree_pit(ix - nx * 6, iy - ny * 6, 'tree_a' if k % 3 else 'tree_b')
                elif kind == 'news':
                    prop('news_box', ix + d[0] * 5, iy + d[1] * 5, dir=_dir_toward(nx, ny))
                    prop('news_box_blue', ix - d[0] * 5, iy - d[1] * 5, dir=_dir_toward(nx, ny))
                elif kind == 'bollards':
                    for s in (-12, 0, 12):
                        prop('bollard', x + d[0] * s, y + d[1] * s)
                elif kind == 'bike_rack':
                    prop('bike_rack', ix, iy, dir=0 if abs(d[0]) > abs(d[1]) else 2)
                elif kind == 'utility_box':
                    prop('utility_box', ix, iy, dir=_dir_toward(nx, ny))
                elif kind == 'planter':
                    prop('street_planter', ix, iy, dir=0 if abs(d[0]) > abs(d[1]) else 2)
                elif kind == 'bench':
                    prop('bench', ix - nx * 6, iy - ny * 6, dir=_dir_toward(nx, ny))
                else:
                    prop(kind, ix, iy)
                keep_clear(ix, iy, 10)


def _dir_toward(nx, ny):
    """Sprite direction (0..7) whose front (+y local) points along (nx, ny)."""
    a = math.atan2(-nx, ny)          # render angle with (-sin a, cos a) = (nx, ny)
    return int(round(a / (math.pi / 4))) % 8


def corners_furniture():
    """Traffic lights and street signs on the corners of every crossing."""
    for cy in ROADS_X.values():
        for name in ROADS_Y:
            cx = float(np.interp(cy, ROADS_Y[name][:, 1], ROADS_Y[name][:, 0]))
            for sx in (-1, 1):
                for sy in (-1, 1):
                    x = cx + sx * (HW + 10); y = cy + sy * (HW + 10)
                    prop('traffic_light', x, y)
                    keep_clear(x, y, 60)
                    if sx == sy:
                        prop('street_sign', x + sx * 14, y)


# ------------------------------------------------------------------ the blocks themselves
def block_nw():
    """Pellridge Tower and its curved plaza, opening onto the corner of Overcast Avenue and Pewter Street."""
    b = BLOCKS['nw']
    inner = b.interior()
    ground('concrete', inner)
    tower = building('pellridge_tower', tc(7.4), tc(6.3), 0, door=(0, 'tower_lobby', 'PELLRIDGE TOWER'))
    door_x, door_y = DOORS[-1]['x'], DOORS[-1]['y']
    keep_clear(door_x, door_y, 30)
    # the plaza: everything south of the tower out to the corner, ring paving around the fountain
    plaza = round_corners(rect(tc(3.0), tc(8.6), tc(16), tc(16)), 0)
    ground('plaza', plaza)
    ground('plaza', rect(tc(13.4), tc(10.2), tc(16), tc(16)))
    F = (tc(7.4), tc(12.35))
    for r, m in ((3.65, 'cobble'), (3.4, 'plaza_dark'), (3.15, 'plaza'), (2.0, 'plaza_dark'), (1.75, 'cobble'), (1.5, 'plaza')):
        ground(m, disc(F[0], F[1], tc(r), 4))
    ground('terrazzo', rect(door_x - 26, tc(8.55), door_x + 26, tc(9.6)))
    prop('fountain', F[0], F[1])
    # curved planting beds around the fountain, leaving paths to the door, the avenue, Pewter Street and the west
    for a0, a1 in ((18, 72), (108, 162), (198, 252), (288, 342)):
        pts = arc(F[0], F[1], tc(2.85), math.radians(a0), math.radians(a1), 2)
        segments('bed', pts)
    # benches facing the fountain, between the beds and the basin
    for a in (45, 135, 225, 315):
        t = math.radians(a)
        bx, by = F[0] + tc(2.3) * math.cos(t), F[1] + tc(2.3) * math.sin(t)
        prop('bench', bx, by, dir=_dir_toward(-math.cos(t), -math.sin(t)))
    for a in (0, 180):
        t = math.radians(a)
        tree_pit(F[0] + tc(2.85) * math.cos(t), F[1] + tc(2.85) * math.sin(t), 'tree_b')
    for a in (68, 112):
        t = math.radians(a)
        prop('lamp', F[0] + tc(3.4) * math.cos(t), F[1] + tc(3.4) * math.sin(t), dir=_dir_toward(-math.cos(t), -math.sin(t)))
    # the ATM by the tower door, a bus shelter and a kiosk on the plaza's edge
    PL.append({'sprite': 'int/atm', 'dir': 0, 'x': door_x + 52, 'y': tc(9.0), 'shadow': {'kind': 'box', 'hx': 7, 'hy': 7, 'h': 34},
               'solid': True, 'interact': {'id': 'atm_plaza', 'label': 'USE ATM'}, 'fp': _fp_box(door_x + 52, tc(9.0), 7, 7)})
    lawn(rect(tc(3.15), tc(8.75), tc(4.6), tc(10.6)), 16)
    prop('kiosk', tc(14.6), tc(11.2), dir=6)
    prop('ad_column', tc(11.9), tc(15.2))
    prop('bush', tc(3.7), tc(9.4)); prop('planter', tc(11.2), tc(9.2))
    prop('trash_can', tc(10.3), tc(9.3))
    # west and north: the skyline behind the tower, a service alley behind it
    building('midrise_stone', tc(1.5), tc(12.2), 6)
    building('shop_books', tc(1.0), front_y('shop_books', tc(16)), 0)
    building('midrise_blue', tc(2.0), tc(3.6), 0)
    building('deco_office', tc(12.4), tc(2.2), 0)
    building('brownstones', tc(14.85), tc(7.8), 6)
    ground('cobble', rect(tc(10.1), tc(3.7), tc(13.6), tc(8.4)))
    prop('dumpster', tc(11.0), tc(4.3)); prop('pallets', tc(12.6), tc(4.4)); prop('ac_unit', tc(10.6), tc(5.6), dir=6)
    prop('bin_sage', tc(12.9), tc(5.6)); prop('trash_bags', tc(11.6), tc(5.4)); prop('boxes', tc(10.7), tc(7.4))
    lawn(rect(tc(3.8), tc(0.4), tc(10.0), tc(3.75)), 30)
    lawn(rect(tc(3.65), tc(5.25), tc(5.0), tc(8.3)), 14)
    prop('pine', tc(4.4), tc(2.5)); prop('bush', tc(4.3), tc(6.2)); prop('bush', tc(0.9), tc(6.6))
    prop('tree_a', tc(7.0), tc(1.5)); prop('bush', tc(8.9), tc(2.9)); prop('bush', tc(5.6), tc(3.2))
    prop('planter', tc(15.0), tc(1.3))


def block_n():
    """Open Most Hours with a cafe and a pawn shop on Overcast Avenue, a small walled parking lot behind."""
    b = BLOCKS['n']
    ground('concrete', b.interior())
    fy = ROADS_X[O] - HW - SWK
    row(['open_most_hours', 'shop_cafe', 'shop_pawn'], tc(24.0), fy, doors={0: (16.25, 'store', 'OPEN MOST HOURS')})
    keep_clear(DOORS[-1]['x'], DOORS[-1]['y'], 30)
    # cafe terrace on brick paving
    ground('brickpave', rect(tc(28.1), fy, tc(30.15), fy + 38))
    prop('cafe_set', tc(28.55), fy + 18); prop('cafe_set', tc(29.7), fy + 18)
    keep_clear(tc(29.1), fy + 18, 40)
    prop('sandwich_board', tc(28.0), fy + 8)
    ground('terrazzo', rect(tc(30.6), fy, tc(31.6), fy + 10))
    # the lot: road level, a lowered driveway from Pewter Street, walls and a hedge around it
    lot = rect(tc(24.2), tc(4.3), tc(31.9), tc(13.2))
    ground('kerb', rect(tc(24.2) - 3, tc(4.3) - 3, tc(31.9) + 3, tc(13.2) + 3))
    ground('lot', lot)
    ground('lot', rect(tc(21.9), tc(7.4), tc(24.4), tc(9.8)))
    keep_clear(tc(23), tc(8.6), 48)
    for x in np.arange(tc(24.2), tc(31.95), tc(1.4)):
        ground('paint_white', rect(x - 0.9, tc(4.5), x + 0.9, tc(7.0)))
        ground('paint_white', rect(x - 0.9, tc(10.5), x + 0.9, tc(13.0)))
    segments('hedge', [[tc(24.4), tc(4.1)], [tc(31.8), tc(4.1)]])
    segments('wall_brick', [[tc(31.95), tc(4.4)], [tc(31.95), tc(13.1)]])
    segments('wall_brick', [[tc(24.1), tc(9.9)], [tc(24.1), tc(13.1)]])
    segments('wall_brick', [[tc(24.1), tc(4.4)], [tc(24.1), tc(7.3)]])
    for name, x, y, dr in (('sedan_lav', 24.9, 5.75, 2), ('sedan_teal', 27.7, 5.75, 2), ('van_white', 30.5, 5.8, 2),
                           ('sedan_clay', 26.3, 11.75, 6), ('taxi', 29.1, 11.75, 6)):
        car(name, tc(x) + 0.0, tc(y), dr, parked=True)
    prop('lamp', tc(28.0), tc(9.0)); prop('trash_can', tc(31.5), tc(8.3))
    # north edge: a walk-up, the hardware store facing the lot, bins
    building('walkup_tan', tc(25.4), tc(2.0), 0)
    building('shop_hardware', tc(29.0), front_y('shop_hardware', tc(3.7)), 0)
    prop('dumpster', tc(31.3), tc(2.0)); prop('bin_navy', tc(31.0), tc(3.2)); prop('pallets', tc(32.4), tc(1.2))


def block_ne():
    """A row of shops on Overcast Avenue, a service alley behind, offices and walk-ups to the north; a pocket lawn
    along Gullsway."""
    b = BLOCKS['ne']
    ground('concrete', b.interior())
    fy = ROADS_X[O] - HW - SWK
    x0 = y_edge(M, fy, +1, HW + SWK) + 2
    xe = y_edge(G, fy, -1, HW + SWK)
    end = row(['shop_pharmacy', 'shop_noodles', 'cinema', 'shop_tailor', 'shop_bakery', 'shop_deli'], x0, fy)
    # the corner building on Gullsway has a rounded corner facing the crossing
    building('corner_round', xe - half('corner_round')[0], front_y('corner_round', fy), 0)
    cr0 = xe - 2 * half('corner_round')[0]
    ground('brickpave', rect(end + 2, fy - tc(2.0), cr0 - 2, fy))
    prop('phone_booth', end + 14, fy - 10)
    if cr0 - end > 60:
        tree_pit((end + cr0) / 2, fy - 40, 'tree_b')
    # the alley behind the shops, out to the Gullsway sidewalk
    ay0, ay1 = fy - tc(3.85), fy - tc(1.95)
    ground('cobble', rect(x0, ay0, xe, ay1))
    for x, kind in ((tc(41.0), 'dumpster'), (tc(42.3), 'bin_sage'), (tc(43.2), 'ac_unit'), (tc(44.4), 'pallets'), (tc(45.6), 'trash_bags'),
                    (tc(46.6), 'boxes'), (tc(47.4), 'pipes'), (tc(48.8), 'bin_navy'), (tc(49.7), 'ac_unit'), (tc(51.0), 'dumpster'),
                    (tc(52.2), 'trash_bags')):
        prop(kind, x, ay1 - 12, dir=0)
    building('walkup_stone', tc(41.25), tc(4.0), 0)
    building('walkup_red', tc(41.25), tc(9.2), 0)
    building('midrise_stone', tc(44.6), tc(8.7), 0)
    building('midrise_blue', tc(45.6), tc(3.1), 0)
    building('walkup_tan', tc(49.3), tc(2.6), 0)
    building('midrise_brick', tc(49.85), tc(8.75), 0)
    lawn(rect(tc(42.55), tc(4.75), tc(51.2), tc(7.1)), 20)
    lawn(rect(tc(46.55), tc(7.2), tc(48.05), tc(10.0)), 12)
    # the glass tower on its own plaza, the tallest thing in the Ledger
    ground('plaza', rect(tc(51.7), tc(0.4), xe - 4, tc(11.95)))
    building('glass_tower', tc(55.3), tc(5.0), 0)
    ground('terrazzo', rect(tc(54.1), tc(6.75), tc(56.5), tc(8.0)))
    lawn(rect(tc(51.9), tc(9.0), tc(53.6), tc(11.6)), 14)
    lawn(rect(xe - tc(1.6), tc(0.8), xe - 8, tc(4.0)), 14)
    prop('tree_a', tc(43.8), tc(5.9)); prop('bush', tc(46.0), tc(6.3)); prop('bench', tc(45.0), tc(6.6), dir=0)
    prop('bush', tc(47.3), tc(8.8)); tree_pit(tc(42.9), tc(1.0), 'pine')
    prop('tree_b', tc(49.9), tc(5.9)); prop('bench', tc(48.4), tc(6.4), dir=0)
    prop('tree_a', tc(52.6), tc(10.2)); prop('bush', tc(53.1), tc(11.0)); prop('pine', xe - tc(0.9), tc(2.2))
    prop('bush', tc(47.6), tc(0.8)); prop('bush', tc(50.6), tc(0.6))
    for x in (tc(53.6), tc(57.0)):
        prop('planter', x, tc(9.4))
    prop('bench', tc(55.3), tc(10.4), dir=0); prop('ad_column', tc(57.6), tc(11.0)); prop('bike_rack', tc(52.6), tc(8.3), dir=2)


def block_w():
    """Drizzle Row Residences and a residential terrace on Drizzle Row; shops back onto it from Overcast Avenue."""
    b = BLOCKS['w']
    ground('concrete', b.interior())
    fy = ROADS_X[D] - HW - SWK
    building('walkup_stone', tc(1.25), front_y('walkup_stone', fy), 0)
    building('apartment_block', tc(4.55), front_y('apartment_block', fy) - 2, 0, door=(-6, 'apartment', 'DRIZZLE ROW RESIDENCES'))
    keep_clear(DOORS[-1]['x'], DOORS[-1]['y'], 30)
    row(['walkup_tan', 'library'], tc(6.6), fy)
    building('shop_barber', y_edge(P, fy, -1, HW + SWK) - half('shop_barber', 6)[0], fy - half('shop_barber', 6)[1], 6)
    # the north side: backs of the Overcast Avenue shops (their fronts face the avenue)
    ny = ROADS_X[O] + HW + SWK
    row(['midrise_brick', 'shop_hardware', 'walkup_tan', 'shop_noodles'], tc(0.3), ny, dir=4)
    # a shared back yard between the two rows: concrete, bins, a washing line of crates, a tree
    yard = rect(tc(0.2), ny + tc(2.65), tc(15.9), fy - tc(2.85))
    ground('concrete', yard)
    for x, kind in ((tc(1.6), 'bin_navy'), (tc(3.0), 'trash_bags'), (tc(6.0), 'ac_unit'), (tc(8.4), 'pallets'), (tc(11.2), 'bin_sage'),
                    (tc(12.6), 'boxes'), (tc(14.6), 'dumpster')):
        prop(kind, x, ny + tc(2.65) + 14)
    lawn(rect(tc(0.6), ny + tc(3.1), tc(15.4), fy - tc(3.05)), 20)
    prop('tree_a', tc(4.5), ny + tc(3.9)); prop('tree_b', tc(11.8), ny + tc(4.1)); prop('bench', tc(8.0), ny + tc(3.9), dir=0)
    prop('bush', tc(14.6), ny + tc(4.3)); prop('bush', tc(1.6), ny + tc(4.2))
    # a pocket lawn at the corner where the avenue row ends
    lawn(rect(tc(11.0), ny + 8, tc(15.85), ny + tc(2.5)), 20)
    prop('tree_b', tc(13.4), ny + tc(1.2)); prop('bush', tc(11.8), ny + tc(1.9)); prop('bench', tc(14.6), ny + tc(1.6), dir=6)
    # planting strips along the kerb of Drizzle Row's residential stretch
    for xa, xb in ((6.6, 10.4), (11.4, 14.2)):
        lawn(rect(tc(xa), fy + 30, tc(xb), fy + 52), 8, 2.0)
    # the apartment's street spot (docs/09: "1 street spot"; your cars, bought or stolen, wait here after a load):
    # a lay-by cut into the sidewalk west of the residences, white end lines
    ky = ROADS_X[D] - HW
    ground('kerb', rect(tc(0.25), fy + 14, tc(3.45), ky))
    ground('asphalt', rect(tc(0.35), fy + 17, tc(3.35), ky + 1))
    for x in (tc(0.45), tc(3.25)):
        ground('paint_white', rect(x - 0.9, fy + 20, x + 0.9, ky - 2))
    keep_clear(tc(1.85), fy + 42, 64)
    ZONES.append({'id': 'home_parking', 'x0': tc(0.35), 'y0': fy + 17, 'x1': tc(3.35), 'y1': ky,
                  'slots': [{'x': tc(1.85), 'y': round((fy + 17 + ky) / 2, 1), 'dir': 0}]})


def block_mid():
    """The Low Tide and its neighbours on Drizzle Row; Ledger Lane, a cobbled lane, cuts through behind them."""
    b = BLOCKS['mid']
    ground('concrete', b.interior())
    fy = ROADS_X[D] - HW - SWK
    building('bar', tc(25.9), front_y('bar', fy), 0, door=(13, 'bar', 'THE LOW TIDE'))
    keep_clear(DOORS[-1]['x'], DOORS[-1]['y'], 30)
    row(['shop_pawn', 'shop_barber', 'walkup_tan'], tc(27.72), fy)
    # the lane
    ly0, ly1 = tc(27.25), tc(28.65)
    xw = y_edge(P, tc(28), +1, HW) - 2
    xe = y_edge(M, tc(28), -1, HW) + 2
    lane = rect(xw, ly0, xe, ly1)
    ground('kerb', rect(xw, ly0 - 3, xe, ly1 + 3))
    ground('cobble', lane)
    for x in (xw + 18, xe - 18):
        for dy in (-12, 0, 12):
            prop('bollard', x, (ly0 + ly1) / 2 + dy)
    # north of the lane, fronts facing it
    ny = ROADS_X[O] + HW + SWK
    building('shop_books', tc(25.1), front_y('shop_books', ly0 - 2), 0)
    building('hotel', tc(28.7), front_y('hotel', ly0 - 2), 0)
    building('walkup_stone', tc(31.75), front_y('walkup_stone', ly0 - 2), 0)
    prop('sandwich_board', tc(25.6), ly0 + 8)
    prop('planter', tc(27.1), ly0 + 10); prop('planter', tc(30.4), ly0 + 10)
    prop('lamp', tc(29.5), ly1 - 4, dir=4)
    wy0, wy1 = ROADS_X[O] + HW + SWK + 6, ly0 - 8
    wedge = [[tc(33.0), wy0]] + y_edge_line(M, wy0, wy1, -1, HW + SWK + 4) + [[tc(33.0), wy1]]
    lawn(wedge, 0)
    prop('bush', tc(33.6), wy0 + 30); prop('tree_a', tc(34.2), (wy0 + wy1) / 2 + 6)
    prop('cones', tc(34.0), ly1 - 10)
    # a curved garden where the block meets the bend: it follows the kerb line of Millwright Road
    gy0, gy1 = ly1 + 10, fy - 6
    edge = y_edge_line(M, gy0, gy1, -1, HW + SWK + 4)
    gx = tc(34.0)
    bed = [[gx, gy0]] + edge + [[gx, gy1]]
    ground('kerb', [[gx - 3, gy0 - 3]] + y_edge_line(M, gy0 - 3, gy1 + 3, -1, HW + SWK + 1) + [[gx - 3, gy1 + 3]])
    ground('grass', bed)
    segments('hedge', y_edge_line(M, gy0 + 8, gy1 - 8, -1, HW + SWK + 12))
    prop('tree_b', gx + 26, gy0 + 34); prop('bush', gx + 14, gy1 - 30); prop('bush', gx + 40, gy1 - 60)
    prop('bench', gx + 30, gy1 - 16, dir=0)


MARLO_SPOT = (tc(48.75), tc(30.75), tc(51.95), tc(32.55))   # the white dotted sale spot in Marlo's side yard
ZONES = []


def dotted_rect(x0, y0, x1, y1, dash=8.0, gap=4.0, w=2.6):
    """A white dotted outline (painted dashes) around a rectangle."""
    for (ax, ay, bx, by) in ((x0, y0, x1, y0), (x1, y0, x1, y1), (x1, y1, x0, y1), (x0, y1, x0, y0)):
        L = math.hypot(bx - ax, by - ay)
        t = 0.0
        while t < L - 1:
            t1 = min(L, t + dash)
            px0, py0 = ax + (bx - ax) * t / L, ay + (by - ay) * t / L
            px1, py1 = ax + (bx - ax) * t1 / L, ay + (by - ay) * t1 / L
            ground('paint_white', rect(min(px0, px1) - w / 2, min(py0, py1) - w / 2, max(px0, px1) + w / 2, max(py0, py1) + w / 2))
            t = t1 + gap


def block_e():
    """Marlo's Tow & Salvage. The yard runs between Millwright Road and Gullsway behind chain-link fences. Beside the
    shop, Marlo's own fenced section holds the white dotted sale spot (it faces the camera, so it is never hidden
    behind the building); a gate on Gullsway leads straight to it. Junk cars and the workshop fill the yard behind."""
    b = BLOCKS['e']
    fy = ROADS_X[D] - HW - SWK
    building('chop_shop', tc(45.6), front_y('chop_shop', fy), 0, door=(15.75, 'chop_shop', "MARLO'S TOW & SALVAGE"))
    keep_clear(DOORS[-1]['x'], DOORS[-1]['y'], 30)
    gk = lambda y: y_edge(G, y, -1, HW + 8)
    xe = gk(tc(28))
    ground('dirt', rect(tc(42.5), tc(24.2), xe + 8, tc(30.1)))
    ground('lot', rect(tc(43.4), tc(26.6), tc(48.0), tc(29.9)))
    # Marlo's section: a concrete pad beside the shop with the dotted spot, fenced off from the yard to the north
    sx0, sy0, sx1, sy1 = MARLO_SPOT
    ground('concrete', rect(tc(47.95), tc(30.15), xe + 8, fy))
    dotted_rect(sx0, sy0, sx1, sy1)
    ZONES.append({'id': 'marlo_spot', 'x0': sx0, 'y0': sy0, 'x1': sx1, 'y1': sy1,
                  'npc': {'x': tc(47.75), 'y': tc(31.6)}})
    segments('fence', [[tc(48.0), tc(30.1)], [gk(tc(30.1)) - 2, tc(30.1)]])
    prop('crate', tc(52.9), tc(32.7)); prop('barrel_brick', tc(48.4), tc(32.75)); prop('bin_navy', tc(48.35), tc(30.5))
    # the gate from Gullsway: a lowered drive across the kerb into Marlo's section
    gy0, gy1 = tc(30.4), tc(32.8)
    ground('lot', [[xe - 4, gy0]] + y_edge_line(G, gy0, gy1, -1, HW - 1) + [[xe - 4, gy1]])
    keep_clear(xe, (gy0 + gy1) / 2, 50)
    # fences along both kerbs (gates near the north on Millwright, and the Gullsway gate) and across the north
    segments('fence', y_edge_line(M, tc(26.4), fy - 4, +1, HW + 8))
    segments('fence', [[y_edge(M, tc(24.2), +1, HW + 8) + 4, tc(24.25)], [gk(tc(24.25)), tc(24.25)]])
    segments('fence', y_edge_line(G, tc(24.3), gy0 - 4, -1, HW + 8))
    segments('fence', y_edge_line(G, gy1 + 4, fy - 4, -1, HW + 8))
    building('workshop', tc(51.7), tc(25.75), 0)
    building('workshop', tc(56.4), tc(25.75), 0)
    for x, y, kind in ((55.0, 28.6, 'crate'), (55.6, 29.2, 'barrel_brick'), (58.4, 28.2, 'pallets'), (57.6, 31.4, 'pipes'),
                       (58.6, 33.2, 'boxes'), (54.8, 33.0, 'barrel_teal')):
        prop(kind, tc(x), tc(y))
    for name, x, y, dr in (('sedan_clay', 44.6, 27.6, 1), ('van_white', 50.9, 28.6, 0), ('sedan_khaki', 46.8, 28.9, 3)):
        car(name, tc(x), tc(y), dr)
    for x, y, kind in ((43.0, 25.0, 'barrel_teal'), (43.4, 25.4, 'barrel_brick'), (53.4, 28.4, 'crate'), (53.6, 28.9, 'crate'),
                       (46.0, 25.3, 'pipes'), (42.9, 32.2, 'cones'), (44.4, 24.9, 'dumpster'), (48.2, 25.1, 'pallets'),
                       (53.6, 25.0, 'barrel_teal'), (53.5, 26.4, 'crate'), (49.2, 27.0, 'boxes'), (53.4, 29.6, 'trash_bags')):
        prop(kind, tc(x), tc(y))


def block_sw():
    """A pocket park on Drizzle Row with a bus shelter; walk-ups along the south edge show their backs."""
    b = BLOCKS['sw']
    ground('concrete', b.interior())
    ny = ROADS_X[D] + HW + SWK
    park = round_corners(rect(tc(1.0), ny + 6, tc(9.5), tc(46.6)), 40)
    ground('kerb', round_corners(rect(tc(1.0) - 3, ny + 3, tc(9.5) + 3, tc(46.6) + 3), 43))
    ground('grass', park)
    ground('grass_b', ellipse(tc(4.0), tc(44.0), tc(2.0), tc(1.2)))
    path = [[tc(9.6), ny + tc(1.4)], [tc(6.5), ny + tc(2.4)], [tc(4.4), ny + tc(4.4)], [tc(4.1), tc(46.7)]]
    ground('gravel', stroke(resample(path, 4), 40))
    for x, y, k in ((2.0, 42.6, 'tree_a'), (8.0, 45.0, 'tree_b'), (1.8, 46.2, 'pine'), (7.4, 42.4, 'bush'), (2.6, 44.6, 'bush')):
        prop(k, tc(x), tc(y))
    prop('bench', tc(5.6), tc(44.3), dir=2); prop('bench', tc(3.0), tc(42.2), dir=1)
    prop('lamp', tc(5.4), tc(42.6)); prop('trash_can', tc(6.1), tc(44.9))
    segments('railing', [[tc(1.0), ny + 2], [tc(5.6), ny + 2]])
    segments('railing', [[tc(7.6), ny + 2], [tc(9.4), ny + 2]])
    prop('bus_shelter', tc(12.8), ny - 22, dir=4)
    prop('bus_stop_sign', tc(14.4), ny - tc(1.6))
    keep_clear(tc(12.8), ny - 22, 60)
    col(['chapel', 'police_precinct'], tc(16.0), ny + 2, dir=6)
    # St. Brine's Mission (Phase 2): the shelter where an evicted player sleeps and saves, at the chapel's door
    ch = [p_ for p_ in PL if p_['sprite'] == 'bld/chapel'][-1]
    ZONES.append({'id': 'shelter', 'x0': ch['fp'][0], 'y0': ch['fp'][1], 'x1': ch['fp'][2], 'y1': ch['fp'][3],
                  'npc': {'x': tc(16.5), 'y': round(ch['y'], 1)}})
    # Greyhaven PD, Precinct 1 (milestone 4): officers come out of its door, the cruiser starts on Pewter Street
    pre = [p_ for p_ in PL if p_['sprite'] == 'bld/police_precinct'][-1]
    ZONES.append({'id': 'precinct', 'x0': pre['fp'][0], 'y0': pre['fp'][1], 'x1': pre['fp'][2], 'y1': pre['fp'][3],
                  'npc': {'x': tc(16.5), 'y': round(pre['y'] + 6, 1)},
                  'slots': [{'x': tc(19.0), 'y': round(pre['y'], 1), 'dir': 2}]})
    keep_clear(tc(16.8), pre['y'] + 6, 40)
    building('shop_tailor', tc(11.4), tc(46.7), 4)


def block_s():
    """Shops on Millwright Road (their fronts face east), offices behind, an alley between."""
    b = BLOCKS['s']
    ground('concrete', b.interior())
    ny = ROADS_X[D] + HW + SWK
    fx = y_edge(M, tc(44), -1, HW + SWK)
    col(['shop_diner', 'shop_florist'], fx, ny, dir=6)
    ground('brickpave', rect(fx, ny + 4, fx + 38, ny + tc(2.0)))
    prop('cafe_set_red', fx + 18, ny + 30)
    keep_clear(fx + 18, ny + 30, 34)
    building('parking_garage', tc(26.25), tc(44.25), 4)
    building('fire_station', tc(30.15), tc(44.6), 4)
    ground('cobble', rect(tc(33.3), ny, fx - tc(1.95), MAPH))
    lawn(rect(tc(24.3), tc(46.35), tc(33.0), MAPH + 4), 20)
    prop('tree_b', tc(25.2), tc(47.2)); prop('bush', tc(28.0), tc(47.4)); prop('tree_a', tc(31.2), tc(47.3))
    for y, kind in ((ny + 20, 'dumpster'), (ny + 50, 'bin_navy'), (ny + 80, 'ac_unit'), (ny + 110, 'pallets'), (ny + 150, 'boxes'), (ny + 180, 'trash_bags')):
        prop(kind, tc(33.75), y, dir=6)


def block_se():
    """Pump & Go, the fuel station: a drive-through forecourt at road level between Millwright Road and Gullsway.
    The kiosk stands at the back with its door and windows facing the pumps; two pumps on an island under a tall
    canopy (the roof is an overhead object: it draws over cars under it and fades while you're under it)."""
    ny = ROADS_X[D] + HW + SWK
    xr = y_edge(M, tc(44), +1, HW) - 1
    gl = y_edge_line(G, ny, MAPH + 4, -1, HW - 1)
    ground('lot', [[xr, ny]] + gl + [[xr, MAPH + 4]])
    # the kiosk and its apron
    kx = tc(44.45)
    building('fuel_kiosk', kx, front_y('fuel_kiosk', ny + tc(1.75)), 0)
    keep_clear(kx, ny + tc(2.0), 30)
    ground('concrete', rect(tc(43.1), ny + 2, tc(46.6), ny + tc(2.45)))
    ground('kerb', rect(tc(43.1), ny + tc(2.45), tc(46.6), ny + tc(2.55)))
    prop('trash_can', tc(43.4), ny + tc(2.1)); prop('news_box', tc(46.2), ny + tc(2.1))
    prop('sandwich_board', tc(45.6), ny + tc(2.25)); prop('boxes', tc(46.3), ny + tc(0.9), dir=2)
    # two pump islands under one wide canopy (widened 2026-10-11): a lane each side of each island, so four cars
    # fill up at once; the canopy rests on posts standing on the islands
    cx, cy = tc(53.4), tc(45.0)
    import infill as _inf
    roof = building('fuel_canopy', cx, cy, 0, solid=False)
    roof['over'] = True
    k = 0
    for ix in (cx - tc(2.2), cx + tc(2.2)):
        ground('kerb', rect(ix - tc(1.85), cy - 9, ix + tc(1.85), cy + 9))
        ground('concrete', rect(ix - tc(1.8), cy - 6.5, ix + tc(1.8), cy + 6.5))
        for px in (ix - tc(1.55), ix + tc(1.55)):
            building('canopy_post', px, cy, 0)
        for px in (ix - tc(0.6), ix + tc(0.6)):
            prop('gas_pump', px, cy)
            PL[-1]['interact'] = {'id': f'pump{k}', 'label': 'REFUEL'}
            k += 1
        prop('bin_sage', ix, cy - 4)
    # lane markings: dashes along both lanes and stop bars at the island ends
    for ly in (cy - tc(1.45), cy + tc(1.45)):
        for j in range(9):
            x = tc(48.6) + j * tc(1.1)
            ground('paint_white', rect(x, ly - 0.9, x + 14, ly + 0.9))
    # two parking bays for the kiosk east of the canopy, the air and water post
    for x in (tc(58.4), tc(59.8)):
        ground('paint_white', rect(x - 0.9, ny + 6, x + 0.9, ny + tc(1.6)))
    prop('utility_box', tc(57.9), ny + 14, dir=6); prop('bin_navy', tc(57.3), ny + 12)
    # the south edge: a planting strip with a low wall, and the price sign corner
    lawn(rect(tc(43.6), tc(47.7), gl[-1][0] - tc(1.2), MAPH + 4), 10)
    segments('wall_brick', [[tc(43.7), tc(47.62)], [tc(58.5), tc(47.62)]])
    for x in (44.6, 47.4, 50.2, 53.0, 55.8, 58.6):
        prop('bush', tc(x), tc(47.95))
    prop('ad_column', tc(43.9), tc(46.3))
    prop('cones', tc(60.2), tc(46.9))


def block_gullsway_edge():
    """The far side of Gullsway is the town's eastern edge: a sidewalk, then a grass embankment with trees and a
    chain-link fence toward The Works."""
    for name in ('gn', 'gm', 'gs'):
        b = BLOCKS[name]
        inner = b.interior()
        ground('grass', inner)
        y0, y1 = b.y_range(SWK)
        segments('fence', [[MAPW - 6, y0 + 10], [MAPW - 6, y1 - 10]])
    for (x, y, k) in ((67.6, 2.0, 'pine'), (67.2, 6.0, 'tree_a'), (67.8, 10.4, 'pine'), (67.1, 13.8, 'bush'), (67.7, 25.0, 'tree_b'),
                      (67.2, 28.4, 'bush'), (67.8, 31.0, 'pine'), (67.4, 34.0, 'bush'), (68.6, 43.6, 'bush'), (67.5, 12.2, 'bush'),
                      (67.4, 4.2, 'bush'), (67.5, 8.3, 'bush'), (67.5, 26.8, 'bush'), (67.9, 29.7, 'tree_a'), (68.6, 15.0, 'tree_b'),
                      (68.8, 22.5, 'bush')):
        prop(k, tc(x), tc(y))
    prop('bus_shelter', tc(66.6), tc(8.0), dir=6)
    keep_clear(tc(66.6), tc(8.0), 50)
    prop('bus_stop_sign', tc(66.4), tc(10.1))


FILL = {
    'yard': ['bin_sage', 'boxes', 'ac_unit', 'pallets', 'trash_bags', 'barrel_teal', 'bike_rack', 'crate', 'bin_navy', 'pipes'],
    'paved': ['street_planter', 'bench', 'planter', 'bike_rack', 'bollard', 'trash_can', 'news_box', 'tree'],
    'green': ['bush', 'tree_a', 'bush', 'pine'],
}


def autofill(max_rounds=200):
    """Dress every bare 3 x 3 patch (docs/01 density rule): put a prop on the window's middle tile, chosen to suit
    the ground there (yard clutter, street furniture or planting)."""
    import check_city
    counters = {k: 0 for k in FILL}
    for _ in range(max_rounds):
        m = {'width': NW, 'height': NH, 'ground': {'base': 'asphalt', 'shapes': [{'m': a, 'p': b} for a, b in SHAPES]},
             'placements': [{k: v for k, v in p.items() if k != 'fp'} for p in PL]}
        issues, bad, bare = check_city.check_dict(m)
        if not bad:
            return
        i, j = bad[0]
        # the most central bare tile of the window whose middle is clear of buildings
        spot = None
        for di, dj in ((1, 1), (0, 1), (1, 0), (2, 1), (1, 2), (0, 0), (2, 2), (0, 2), (2, 0)):
            x, y = tc(i + di + 0.5), tc(j + dj + 0.5)
            if not any(f[0] - 16 < x < f[2] + 16 and f[1] - 16 < y < f[3] + 16 for f in (p['fp'] for p in PL if p['sprite'].startswith('bld/'))):
                spot = (x, y); break
        if spot is None:
            print('autofill: no clear spot in window', i, j); return
        x, y = spot
        mat = _mat_at(x, y)
        group = 'green' if mat.startswith('grass') else ('paved' if mat in ('plaza', 'plaza_dark', 'sidewalk', 'sidewalk_b', 'terrazzo', 'brickpave') else 'yard')
        kind = FILL[group][counters[group] % len(FILL[group])]; counters[group] += 1
        if kind == 'tree':
            tree_pit(x, y, 'tree_b')
        elif kind == 'bollard':
            for s_ in (-10, 0, 10):
                prop('bollard', x + s_, y - s_)
        else:
            prop(kind, x, y, dir=int(RNG.integers(0, 4)) * 2)


def _mat_at(x, y):
    for m, poly in reversed(SHAPES):
        if point_in_poly(x, y, poly):
            return m
    return 'asphalt'


DECALS = []          # grass tufts and weeds baked into the ground: (kind, x, y)
DECAL_KINDS = {
    'lawn': ['tuft_a', 'tuft_tall', 'tuft_a', 'weeds_white', 'tuft_b', 'weeds_plum'],
    'paved': ['tuft_b', 'tuft_a', 'tuft_dry', 'tuft_b', 'weeds_white'],
    'rough': ['tuft_dry', 'tuft_b', 'tuft_dry', 'tuft_a'],
}


def scatter_decals(seed=11):
    """Grass tufts and weeds: thick along lawn edges and in tree pits, a few in the open lawn, and here and there
    in the paving at the foot of walls, along kerbs, in alleys and in the rough yard."""
    import check_city
    rng = np.random.default_rng(seed)
    m = {'width': NW, 'height': NH, 'ground': {'base': 'asphalt', 'shapes': [{'m': a, 'p': b} for a, b in SHAPES]}}
    grid, mats = check_city.material_grid(m)
    R = check_city.RES
    blds = [p['fp'] for p in PL if p['sprite'].startswith('bld/')]
    solids = [p['fp'] for p in PL if not p['sprite'].startswith('bld/') and p.get('solid')]
    GX_, GY_ = grid.shape

    def mat(x, y):
        i, j = int(x // R), int(y // R)
        return mats[grid[min(GX_ - 1, max(0, i)), min(GY_ - 1, max(0, j))]]

    road = {'asphalt', 'asphalt_wet', 'paint_white', 'paint_gold', 'iron'}
    counts = {k: 0 for k in DECAL_KINDS}
    for y in np.arange(4, MAPH - 4, 8.0):
        for x in np.arange(4, MAPW - 4, 8.0):
            x2, y2 = x + rng.uniform(-3, 3), y + rng.uniform(-3, 3)
            m0 = mat(x2, y2)
            if m0 in road or m0 == 'kerb' or m0 == 'grate':
                continue
            if any(f[0] - 3 < x2 < f[2] + 3 and f[1] - 3 < y2 < f[3] + 3 for f in blds):
                continue
            near = {mat(x2 + dx, y2 + dy) for dx, dy in ((7, 0), (-7, 0), (0, 7), (0, -7))}
            near_wall = any(f[0] - 12 < x2 < f[2] + 12 and f[1] - 12 < y2 < f[3] + 12 for f in blds)
            if m0 in ('grass', 'grass_b'):
                p, group = (0.32 if near - {'grass', 'grass_b'} else 0.05), 'lawn'
            elif m0 == 'soil':
                p, group = 0.45, 'lawn'
            elif m0 in ('dirt', 'gravel'):
                p, group = 0.09, 'rough'
            elif m0 == 'lot':
                p, group = (0.12 if near - {'lot', 'paint_white'} else 0.0), 'rough'
            else:
                p = 0.10 if near_wall else (0.035 if near & (road | {'kerb'}) else (0.03 if m0 in ('cobble', 'concrete') else 0.006))
                group = 'paved'
            if rng.random() >= p:
                continue
            if any(f[0] - 1 < x2 < f[2] + 1 and f[1] - 1 < y2 < f[3] + 1 for f in solids):
                continue
            kinds = DECAL_KINDS[group]
            DECALS.append((kinds[counts[group] % len(kinds)], round(float(x2), 1), round(float(y2), 1)))
            counts[group] += 1 + int(rng.integers(0, 2))


def build():
    lay_blocks()
    paving_patches()
    for f in (block_nw, block_n, block_ne, block_w, block_mid, block_e, block_sw, block_s, block_se, block_gullsway_edge):
        f()
    corners_furniture()
    lay_markings()
    dress_sidewalks()
    autofill()
    scatter_decals()


# ------------------------------------------------------------------ export
STREETS = []


def street_spans():
    for name, cy in ROADS_X.items():
        STREETS.append({'name': name, 'x0': 0, 'x1': MAPW, 'y0': cy - HW - SWK, 'y1': cy + HW + SWK})
    for name, line in ROADS_Y.items():
        for y0 in np.arange(0, MAPH, T):
            xs = line[(line[:, 1] >= y0) & (line[:, 1] <= y0 + T)][:, 0]
            if len(xs) == 0:
                continue
            STREETS.append({'name': name, 'x0': float(xs.min() - HW - SWK), 'x1': float(xs.max() + HW + SWK), 'y0': float(y0), 'y1': float(y0 + T)})


def walkways():
    """Pedestrian paths (milestone 4): a line along every sidewalk a little in from the kerb, nudged around the
    solid street furniture, as polylines in world units."""
    solids = [p_['fp'] for p_ in PL if p_.get('solid') and not p_['sprite'].startswith('veh/')]
    out = []
    for b in BLOCKS.values():
        for side in sorted(b.sidewalks):
            line = resample(b.side_line(side, SWK * 0.55), 10.0)
            if len(line) < 2:
                continue
            pts = []
            for k, (x, y) in enumerate(line):
                a = line[max(0, k - 1)]; c = line[min(len(line) - 1, k + 1)]
                dx, dy = c[0] - a[0], c[1] - a[1]
                L = math.hypot(dx, dy) or 1.0
                nx, ny = -dy / L, dx / L
                for o in (0, 6, -6, 12, -12, 18, -18):
                    px_, py_ = x + nx * o, y + ny * o
                    if not any(f[0] - 7 < px_ < f[2] + 7 and f[1] - 7 < py_ < f[3] + 7 for f in solids):
                        pts.append([round(float(px_), 1), round(float(py_), 1)])
                        break
                else:
                    pts.append(None)
            # split at points that couldn't be cleared
            run = []
            for q in pts + [None]:
                if q is None:
                    if len(run) >= 4:
                        out.append(run)
                    run = []
                else:
                    run.append(q)
    return out


def lanes():
    """Traffic lanes (milestone 4), one each way per road, in driving order, right-hand traffic."""
    out = []
    for name, cy in ROADS_X.items():
        out.append({'road': name, 'p': [[-T, cy + T], [MAPW + T, cy + T]]})          # eastbound
        out.append({'road': name, 'p': [[MAPW + T, cy - T], [-T, cy - T]]})          # westbound
    for name, line in ROADS_Y.items():
        sb = offset(line, T)                # south-bound keeps to the west (+ offset is west)
        nb = offset(line, -T)[::-1]
        for ln in (sb, nb):
            r = resample(ln, 16.0)
            out.append({'road': name, 'p': [[round(float(x), 1), round(float(y), 1)] for x, y in r]})
    return out


def crossings():
    out = []
    for cy in ROADS_X.values():
        for name, line in ROADS_Y.items():
            out.append({'x': round(float(np.interp(cy, line[:, 1], line[:, 0])), 1), 'y': cy})
    return out


def export(path):
    out = {
        'id': 'downtown', 'name': 'THE LEDGER', 'width': NW, 'height': NH,
        'ground': {'base': 'asphalt', 'shapes': [{'m': m, 'p': p} for m, p in SHAPES],
                   'decals': [{'k': k, 'x': x, 'y': y} for k, x, y in DECALS]},
        'placements': [{k: v for k, v in p.items() if k != 'fp'} for p in PL],
        'doors': DOORS, 'streets': STREETS, 'zones': ZONES,
        'walkways': walkways(), 'lanes': lanes(), 'crossings': crossings(),
        'spawn': {'x': tc(9), 'y': ROADS_X[O] - HW - 20},
    }
    json.dump(out, open(path, 'w'), separators=(',', ':'))
    print('wrote', path, len(SHAPES), 'shapes', len(PL), 'placements', os.path.getsize(path) // 1024, 'KB')


build()
street_spans()

if __name__ == '__main__':
    export(os.path.join(ROOT, 'src', 'maps', 'downtown.json'))
    if '--no-render' not in sys.argv:
        import draft_city
        draft_city.render_all(SHAPES, PL, DOORS, (MAPW, MAPH), 'downtown', decals=DECALS, procs=int(sys.argv[sys.argv.index('--procs') + 1]) if '--procs' in sys.argv else 4)

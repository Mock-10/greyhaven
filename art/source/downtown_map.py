"""The test Downtown ("The Ledger"), 48 x 48 tiles, authored as vector ground plus placements (Phase 1 milestone 1b).

This one file is the source of truth for the map. It writes:
  - src/maps/downtown.json: ground shapes, placements, doors, street spans and spawn, read by the game;
  - art/drafts/downtown/*.png: the draft renders (day and dusk) for approval.

Layout (tiles): Overcast Avenue runs east-west at j = 18..22, Drizzle Row at j = 35..39. Pewter Street runs north-south
at i = 18..22. Millwright Road runs north-south at i = 34..38, then bends east to i = 39..43 between j = 23 and 33.
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
N = 48
MAPW = N * T
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


Y_SAMPLES = np.linspace(-T, MAPW + T, 401)
ROADS_Y = {
    'PEWTER STREET': np.stack([np.full_like(Y_SAMPLES, tc(20)), Y_SAMPLES], 1),
    'MILLWRIGHT ROAD': np.stack([mill_x(Y_SAMPLES), Y_SAMPLES], 1),
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
        y1 = ROADS_X[self.s] - HW - d if self.s else MAPW + 2.0
        return y0, y1

    def poly(self, d=0.0, radius=None, sides=None):
        """Outline inset by d from the kerb on road sides (sides: which sides to inset, default the road sides)."""
        sides = sides if sides is not None else {k for k in 'wens' if getattr(self, k)}
        dn = d if 'n' in sides else 0.0
        ds = d if 's' in sides else 0.0
        y0 = (ROADS_X[self.n] + HW + dn) if self.n else -2.0
        y1 = (ROADS_X[self.s] - HW - ds) if self.s else MAPW + 2.0
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


P, M = 'PEWTER STREET', 'MILLWRIGHT ROAD'
O, D = 'OVERCAST AVENUE', 'DRIZZLE ROW'
BLOCKS = {
    'nw': Block('nw', None, P, None, O),
    'n': Block('n', P, M, None, O),
    'ne': Block('ne', M, None, None, O),
    'w': Block('w', None, P, O, D),
    'mid': Block('mid', P, M, O, D),
    'e': Block('e', M, None, O, D, sidewalks={'n', 's'}),
    'sw': Block('sw', None, P, D, None),
    's': Block('s', P, M, D, None),
    'se': Block('se', M, None, D, None),
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
    'bus_shelter': ('box', 23, 8, 38), 'phone_booth': ('box', 6, 6, 44), 'parking_meter': ('blob', 2.5),
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


def building(name, x, y, dir=0, door=None, front=None):
    """Place a building by its footprint centre. door = (offset along the front in model units, target, label)."""
    hx, hy, h = BUILDING[name]
    hx, hy = hx * B, hy * B
    if dir in (2, 6):
        hx, hy = hy, hx
    p = {'sprite': f'bld/{name}', 'dir': dir, 'x': round(float(x), 2), 'y': round(float(y), 2),
         'shadow': {'kind': 'box', 'hx': round(hx, 2), 'hy': round(hy, 2), 'h': round(h * B, 2)}, 'solid': True, 'night': True,
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


def car(name, x, y, dir, interact=None):
    along_y = dir in (2, 6)
    hx, hy = (16, 40) if along_y else (40, 16)
    p = {'sprite': f'veh/{name}', 'dir': dir, 'x': x, 'y': y, 'shadow': {'kind': 'box', 'hx': hx, 'hy': hy, 'h': 22},
         'solid': True, 'fp': _fp_box(x, y, hx, hy)}
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
    ground('gravel', BLOCKS['e'].poly(KERB + 2, radius=0, sides={'n', 's', 'w'}))


def lay_markings():
    # x-roads: double centre line in gold, white edge lines, between the crossings
    xs = [tc(20), None]
    for name, cy in ROADS_X.items():
        gaps = [(tc(20) - HW - 40, tc(20) + HW + 40)]
        mx = mill_x(cy)
        gaps.append((mx - HW - 40, mx + HW + 40))
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
        for c in (tc(20), mx):
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
        spans = [(-T, gaps[0][0]), (gaps[0][1], gaps[1][0]), (gaps[1][1], MAPW + T)]
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
        for side in b.sidewalks:
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
    building('midrise_brick', tc(12.6), tc(2.3), 0)
    building('walkup_stone', tc(14.85), tc(6.5), 6)
    building('walkup_red', tc(14.8), tc(9.05), 6)
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
        car(name, tc(x) + 0.0, tc(y), dr)
    prop('lamp', tc(28.0), tc(9.0)); prop('trash_can', tc(31.5), tc(8.3))
    # north edge: a walk-up, the hardware store facing the lot, bins
    building('walkup_tan', tc(25.4), tc(2.0), 0)
    building('shop_hardware', tc(29.0), front_y('shop_hardware', tc(3.7)), 0)
    prop('dumpster', tc(31.3), tc(2.0)); prop('bin_navy', tc(31.0), tc(3.2)); prop('pallets', tc(32.4), tc(1.2))


def block_ne():
    """A row of shops on Overcast Avenue, a service alley behind, offices and walk-ups to the north."""
    b = BLOCKS['ne']
    ground('concrete', b.interior())
    fy = ROADS_X[O] - HW - SWK
    x0 = y_edge(M, fy, +1, HW + SWK) + 2
    end = row(['shop_pharmacy', 'shop_noodles', 'shop_bakery'], x0, fy)
    # corner pocket at the map edge: a phone booth and a bench under a tree
    ground('brickpave', rect(end + 2, fy - tc(2.0), MAPW, fy))
    tree_pit(end + 22, fy - 40, 'tree_b')
    prop('phone_booth', end + 14, fy - 10)
    prop('bench', MAPW - 18, fy - 34, dir=6)
    # the alley behind the shops
    ay0, ay1 = fy - tc(3.85), fy - tc(1.95)
    ground('cobble', rect(x0, ay0, MAPW, ay1))
    for x, kind in ((tc(41.0), 'dumpster'), (tc(42.3), 'bin_sage'), (tc(43.2), 'ac_unit'), (tc(44.4), 'pallets'), (tc(45.6), 'trash_bags'),
                    (tc(46.6), 'boxes'), (tc(47.4), 'pipes')):
        prop(kind, x, ay1 - 12, dir=0)
    building('walkup_stone', tc(41.25), tc(4.0), 0)
    building('walkup_red', tc(41.25), tc(9.2), 0)
    building('midrise_stone', tc(44.6), tc(8.7), 0)
    building('midrise_blue', tc(45.6), tc(3.1), 0)
    lawn(rect(tc(42.55), tc(4.75), MAPW, tc(7.1)), 20)
    lawn(rect(tc(46.55), tc(7.2), MAPW, tc(10.0)), 16)
    prop('tree_a', tc(43.8), tc(5.9)); prop('bush', tc(46.0), tc(6.3)); prop('bench', tc(45.0), tc(6.6), dir=0)
    prop('bush', tc(47.3), tc(8.8)); tree_pit(tc(42.9), tc(1.0), 'pine')


def block_w():
    """Drizzle Row Residences and a residential terrace on Drizzle Row; shops back onto it from Overcast Avenue."""
    b = BLOCKS['w']
    ground('concrete', b.interior())
    fy = ROADS_X[D] - HW - SWK
    building('walkup_stone', tc(1.25), front_y('walkup_stone', fy), 0)
    building('apartment_block', tc(4.55), front_y('apartment_block', fy) - 2, 0, door=(-6, 'apartment', 'DRIZZLE ROW RESIDENCES'))
    keep_clear(DOORS[-1]['x'], DOORS[-1]['y'], 30)
    row(['walkup_tan', 'walkup_red', 'shop_deli'], tc(6.6), fy)
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
    for xa, xb in ((0.4, 3.2), (6.6, 10.4), (11.4, 14.2)):
        lawn(rect(tc(xa), fy + 30, tc(xb), fy + 52), 8, 2.0)


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
    building('midrise_stone', tc(28.75), front_y('midrise_stone', ly0 - 2), 0)
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


def block_e():
    """Marlo's Tow & Salvage: the yard runs up to Millwright Road behind a chain-link fence."""
    b = BLOCKS['e']
    fy = ROADS_X[D] - HW - SWK
    building('chop_shop', tc(45.6), front_y('chop_shop', fy), 0, door=(15.75, 'chop_shop', "MARLO'S TOW & SALVAGE"))
    keep_clear(DOORS[-1]['x'], DOORS[-1]['y'], 30)
    ground('dirt', rect(tc(42.5), tc(24.2), MAPW, tc(29.0)))
    ground('lot', rect(tc(44.6), tc(29.0), MAPW, fy))
    # fence along the curved kerb, with a gate gap near the north
    fence = y_edge_line(M, tc(26.4), fy - 4, +1, HW + 8)
    segments('fence', fence)
    segments('fence', [[y_edge(M, tc(24.2), +1, HW + 8) + 4, tc(24.25)], [MAPW, tc(24.25)]])
    building('workshop', tc(46.4), tc(25.9), 0)
    for name, x, y, dr in (('sedan_clay', 43.6, 27.0, 1), ('van_white', 47.0, 28.2, 0)):
        car(name, tc(x), tc(y), dr)
    for x, y, kind in ((43.0, 25.0, 'barrel_teal'), (43.4, 25.4, 'barrel_brick'), (45.0, 28.6, 'crate'), (45.4, 29.1, 'crate'),
                       (43.6, 29.2, 'pipes'), (42.9, 32.2, 'cones'), (44.4, 24.9, 'dumpster')):
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
    col(['walkup_red', 'walkup_tan'], tc(16.0), ny + 2, dir=6)
    building('shop_tailor', tc(11.4), tc(46.7), 4)


def block_s():
    """Shops on Millwright Road (their fronts face east), offices behind, an alley between."""
    b = BLOCKS['s']
    ground('concrete', b.interior())
    ny = ROADS_X[D] + HW + SWK
    fx = y_edge(M, tc(44), -1, HW + SWK)
    col(['shop_cafe', 'shop_noodles', 'shop_bakery'], fx, ny, dir=6)
    ground('brickpave', rect(fx, ny + 4, fx + 38, ny + tc(2.0)))
    prop('cafe_set_red', fx + 18, ny + 30)
    keep_clear(fx + 18, ny + 30, 34)
    building('midrise_brick', tc(26.7), tc(44.2), 4)
    building('walkup_red', tc(29.4), tc(44.5), 4)
    building('walkup_stone', tc(31.7), tc(44.4), 4)
    ground('cobble', rect(tc(33.3), ny, fx - tc(1.95), MAPW))
    lawn(rect(tc(24.3), tc(46.35), tc(33.0), MAPW + 4), 20)
    prop('tree_b', tc(25.2), tc(47.2)); prop('bush', tc(28.0), tc(47.4)); prop('tree_a', tc(31.2), tc(47.3))
    for y, kind in ((ny + 20, 'dumpster'), (ny + 50, 'bin_navy'), (ny + 80, 'ac_unit'), (ny + 110, 'pallets'), (ny + 150, 'boxes'), (ny + 180, 'trash_bags')):
        prop(kind, tc(33.75), y, dir=6)


def block_se():
    b = BLOCKS['se']
    ground('concrete', b.interior())
    ny = ROADS_X[D] + HW + SWK
    xw = y_edge(M, tc(44), +1, HW + SWK)
    building('walkup_tan', xw + half('walkup_tan', 4)[0] + 2, tc(45.0), 4)
    prop('dumpster', MAPW - 18, ny + tc(2.25))
    lawn(rect(xw + 6, ny + 8, MAPW + 4, ny + tc(1.9)), 18)
    prop('bush', xw + 24, ny + 30); prop('tree_b', MAPW - 40, ny + 30)


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
        m = {'width': N, 'ground': {'base': 'asphalt', 'shapes': [{'m': a, 'p': b} for a, b in SHAPES]},
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


def build():
    lay_blocks()
    paving_patches()
    for f in (block_nw, block_n, block_ne, block_w, block_mid, block_e, block_sw, block_s, block_se):
        f()
    corners_furniture()
    lay_markings()
    dress_sidewalks()
    autofill()


# ------------------------------------------------------------------ export
STREETS = []


def street_spans():
    for name, cy in ROADS_X.items():
        STREETS.append({'name': name, 'x0': 0, 'x1': MAPW, 'y0': cy - HW - SWK, 'y1': cy + HW + SWK})
    for name, line in ROADS_Y.items():
        for y0 in np.arange(0, MAPW, T):
            xs = line[(line[:, 1] >= y0) & (line[:, 1] <= y0 + T)][:, 0]
            if len(xs) == 0:
                continue
            STREETS.append({'name': name, 'x0': float(xs.min() - HW - SWK), 'x1': float(xs.max() + HW + SWK), 'y0': float(y0), 'y1': float(y0 + T)})


def export(path):
    out = {
        'id': 'downtown', 'name': 'THE LEDGER', 'width': N, 'height': N,
        'ground': {'base': 'asphalt', 'shapes': [{'m': m, 'p': p} for m, p in SHAPES]},
        'placements': [{k: v for k, v in p.items() if k != 'fp'} for p in PL],
        'doors': DOORS, 'streets': STREETS,
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
        draft_city.render_all(SHAPES, PL, DOORS, MAPW, 'downtown', procs=int(sys.argv[sys.argv.index('--procs') + 1]) if '--procs' in sys.argv else 4)

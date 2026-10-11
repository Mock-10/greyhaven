"""HUD drafts: full mockup over the game view, minigame panel mockup, and a HUD component kit."""
import os, sys, warnings
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
warnings.filterwarnings('ignore')
import numpy as np
from PIL import Image
from pixfont import draw_text, text_width
from sdf import RAMP_RGB, RID, to_image
import scene

VW, VH = 640, 360            # internal resolution (x3 = 1920x1080)

# ------------------------------------------------------------------ palette roles
def R(ramp, t):
    return tuple(int(c) for c in RAMP_RGB[RID[ramp], t])

PLATE = (45, 34, 46)
PLATE_HI = (62, 48, 66)
EDGE = (185, 143, 58)
GOLD = R('gold', 4); GOLD_HI = R('gold', 5); GOLD_LO = R('gold', 2)
CREAM = R('white', 5)
MUTED = R('lavlt', 4)
DIRTY = R('red', 4)
HP = R('red', 3); HP_LO = R('red', 1)
ARM = R('blueg', 4); ARM_LO = R('blueg', 1)
INK = (36, 27, 40)
POLICE_R = R('red', 4); POLICE_B = R('navy', 4)


# ------------------------------------------------------------------ primitives
def blend(img, y0, y1, x0, x1, col, a=1.0):
    H, W = img.shape[:2]
    y0, y1, x0, x1 = max(0, y0), min(H, y1), max(0, x0), min(W, x1)
    if y1 <= y0 or x1 <= x0:
        return
    sub = img[y0:y1, x0:x1, :3].astype(float)
    img[y0:y1, x0:x1, :3] = (sub * (1 - a) + np.array(col[:3]) * a).astype(np.uint8)
    img[y0:y1, x0:x1, 3] = 255


def px(img, x, y, col):
    if 0 <= y < img.shape[0] and 0 <= x < img.shape[1]:
        img[y, x, :3] = col[:3]; img[y, x, 3] = 255


def plate(img, x, y, w, h, edge=EDGE, alpha=0.9):
    """Rounded dark plate with a 1px gold edge (same as the interaction prompts)."""
    blend(img, y + 1, y + h - 1, x, x + w, PLATE, alpha)
    blend(img, y, y + h, x + 1, x + w - 1, PLATE, alpha)
    blend(img, y, y + 1, x + 1, x + w - 1, edge)
    blend(img, y + h - 1, y + h, x + 1, x + w - 1, edge)
    blend(img, y + 1, y + h - 1, x, x + 1, edge)
    blend(img, y + 1, y + h - 1, x + w - 1, x + w, edge)


def bar(img, x, y, w, h, frac, col, col_lo, segs=0):
    blend(img, y, y + h, x, x + w, INK)
    fw = int(round((w - 2) * frac))
    blend(img, y + 1, y + h - 1, x + 1, x + 1 + fw, col)
    blend(img, y + 1, y + 2, x + 1, x + 1 + fw, tuple(min(255, c + 30) for c in col))
    blend(img, y + h - 2, y + h - 1, x + 1, x + 1 + fw, col_lo)
    if segs:
        for k in range(1, segs):
            sx = x + 1 + int((w - 2) * k / segs)
            blend(img, y + 1, y + h - 1, sx, sx + 1, INK, 0.6)


def sprite(img, x, y, rows, pal):
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch != '.' and ch in pal:
                px(img, x + i, y + j, pal[ch])


def circle_mask(r):
    yy, xx = np.mgrid[-r:r + 1, -r:r + 1]
    return (xx + 0.5) ** 2 + (yy + 0.5) ** 2 <= r * r


# ------------------------------------------------------------------ icon sprites
STAR = ['....#....', '...#o#...', '...#o#...', '#########', '.#ooooo#.', '..#ooo#..', '.#oo#oo#.', '.#o#.#o#.', '.##...##.']
STAR_FILL = [r.replace('o', 'g').replace('#', 'G') for r in STAR]
STAR_EMPTY = [r.replace('o', 'd').replace('#', 'e') for r in STAR]
STAR_FLASH = [r.replace('o', 'w').replace('#', 'G') for r in STAR]
STAR_PAL = {'g': GOLD, 'G': GOLD_LO, 'd': PLATE_HI, 'e': (92, 79, 98), 'w': GOLD_HI}

W_PISTOL = ['..............', '.############.', '.#mmmmmmmmmhh#', '.#mmmmmmmmm##.', '.#####mm#.....', '.....#mmgm#...', '.....#mm##....', '....#mm#......', '....#mm#......', '....####......']
W_BAT = ['..............', '..........###.', '........##www#', '......##wwww#.', '....##wwww##..', '..##wwww##....', '.#hh##.##.....', '#hh#..........', '.##...........']
W_KNIFE = ['..............', '..........##..', '........##mm#.', '......##mmm#..', '....##mmm##...', '...#ggg##.....', '..#hh#........', '.#hh#.........', '..##..........']
W_SHOTGUN = ['.................', '.###############.', '#mmmmmmmmmmmmmmm#', '.#hhhh###########', '#hhhh#.#ww#......', '#hh##..####......', '.##..............']
W_SMG = ['...............', '.#############.', '.#mmmmmmmmmmmm#', '.##mmmmmm######', '..#hh#mm#......', '..#hh##m#......', '...##.#mm#.....', '......####.....']
W_RIFLE = ['..................', '....#.............', '.################.', '#hhh#mmmmmmmmmmmmm#', '#hhhh###mm########', '.###.#mm#.#mm#....', '.....###..###.....']
W_PAL = {'#': INK, 'm': R('lavlt', 3), 'h': R('wood', 2), 'w': R('wood', 4), 'g': GOLD}

ICON_CLEAN = ['#########', '#ccccccc#', '#c.ccc.c#', '#cc$$$cc#', '#c.ccc.c#', '#ccccccc#', '#########']
ICON_DIRTY = ['#########', '#rrrrrrr#', '#r.rrr.r#', '#rr$$$rr#', '#r.rrr.r#', '#rrrrrrr#', '#########']
# shop item icons (milestone 3): 14 x 13, palette ITEM_PAL. No gold: gold is reserved for valuables.
ITEM_SODA = ['....######....', '...#ssssss#...', '...#wwwwwW#...', '...#rrrrrR#...', '...#rrrrrR#...', '...#wwwwwW#...', '...#wrrwwW#...', '...#wwwwwW#...', '...#rrrrrR#...', '...#rrrrrR#...', '...#rrrrrR#...', '...#ssssss#...', '....######....']
ITEM_CHIPS = ['..##########..', '..#kKkKkKkK#..', '..#kkkkkkkk#..', '.#kkkkkkkkkk#.', '.#krrrrrrrrk#.', '.#krwwwwwwrk#.', '.#krwyywwwrk#.', '.#krwwyyywrk#.', '.#krrrrrrrrk#.', '.#kkkkkkkkkk#.', '.#kkkkkkkkKK#.', '.#kkkkkkkKKK#.', '..##########..']
ITEM_SANDWICH = ['..............', '..##..........', '..#b##........', '..#bbb##......', '..#bbbbb##....', '..#bbbbbbb##..', '..#gGgGgGgGg#.', '..#tTtTtTtTtt#', '..#bbbbbbbbbb#', '..#BBBBBBBBBB#', '..############', '..............', '..............']
ITEM_FUEL = ['...######.....', '...#....#.....', '...######.....', '..#rrrrrrr#...', '..#rRRRRRr##..', '..#rRrrrRr#s#.', '..#rrRrRrr#s#.', '..#rrrRrrr##..', '..#rrRrRrr#...', '..#rRrrrRr#...', '..#rRRRRRr#...', '..#rrrrrrr#...', '..#########...']
ITEM_PAL = {'#': INK, 's': R('lavlt', 4), 'w': R('white', 5), 'W': R('white', 3), 'r': R('red', 3), 'R': R('red', 2), 'k': R('khaki', 4), 'K': R('khaki', 2), 'y': R('clay', 3), 'b': R('stone', 4), 'B': R('clay', 3), 'g': R('sage', 4), 'G': R('sage', 2), 't': R('red', 3), 'T': R('red', 2), '.': None}
ICON_PAL = {'#': INK, 'c': R('khaki', 4), 'r': R('red', 3), '$': R('sage', 1), '.': None}

MOON = ['..###..', '.##....', '##.....', '##.....', '##.....', '.##....', '..###..']
SUN = ['#..#..#', '.#####.', '.#ooo#.', '##ooo##', '.#ooo#.', '.#####.', '#..#..#']

PHONE = ['#####', '#ccc#', '#ccc#', '#ccc#', '#ccc#', '#####', '##.##']


# ------------------------------------------------------------------ radar
def draw_radar(img, cx, cy, r, pwx, pwy, tiles, buildings, blips, s=0.13, search=None, flash=True):
    """Iso-oriented radar (same projection as the world). pwx/pwy: player world position."""
    cols = {
        'road': R('asph', 1), 'walk': R('lavlt', 3), 'grass': R('sage', 2), 'water': R('teal', 3),
        'lot': R('lav', 2), 'dirt': R('clay', 1), 'plank': R('wood', 2),
    }
    m = circle_mask(r)
    for j in range(-r, r + 1):
        for i in range(-r, r + 1):
            if not m[j + r, i + r]:
                continue
            X, Y = i / s, j / s
            wx = pwx + Y + X / 2
            wy = pwy + Y - X / 2
            ti, tj = int(np.floor(wx / 32)), int(np.floor(wy / 32))
            k = tiles.get((ti, tj))
            if k is None:
                c = INK
            elif k.startswith(('road', 'asphalt', 'cross', 'inter', 'manhole')):
                c = cols['road']
                if k.startswith(('road_x_c', 'road_y_c')) and ((k.endswith('c1') and (wy if 'x' in k else wx) % 32 > 30) or (k.endswith('c0') and (wy if 'x' in k else wx) % 32 < 2)):
                    c = GOLD_LO
            elif k.startswith('sidewalk'):
                c = cols['walk']
            elif k.startswith('grass'):
                c = cols['grass']
            elif k.startswith('water'):
                c = cols['water']
            elif k.startswith('planks'):
                c = cols['plank']
            elif k.startswith('dirt'):
                c = cols['dirt']
            else:
                c = cols['lot']
            for (bx, by, hx, hy) in buildings:
                if abs(wx - bx) <= hx and abs(wy - by) <= hy:
                    c = R('lavlt', 4)
                    if abs(wx - bx) > hx - 6 or abs(wy - by) > hy - 6:
                        c = R('lavlt', 2)
                    break
            px(img, cx + i, cy + j, c)
    # search circle (wanted)
    if search is not None:
        sx, sy, sr = search
        for a in np.linspace(0, 2 * np.pi, 160):
            wx, wy = sx + sr * np.cos(a), sy + sr * np.sin(a)
            X = (wx - pwx - (wy - pwy)) * s; Y = ((wx - pwx) + (wy - pwy)) / 2 * s
            ix, iy = int(round(cx + X)), int(round(cy + Y))
            if (ix - cx) ** 2 + (iy - cy) ** 2 < (r - 1) ** 2:
                px(img, ix, iy, POLICE_R if (a * 8) % 2 < 1 else POLICE_B)
    # blips
    for (kind, wx, wy) in blips:
        X = (wx - pwx - (wy - pwy)) * s; Y = ((wx - pwx) + (wy - pwy)) / 2 * s
        d = np.hypot(X, Y)
        clamp = d > r - 4
        if clamp:
            X, Y = X / d * (r - 4), Y / d * (r - 4)
        ix, iy = int(round(cx + X)), int(round(cy + Y))
        if kind == 'police':
            for dy in range(-2, 3):
                for dx in range(-2, 3):
                    edge = abs(dx) == 2 or abs(dy) == 2
                    px(img, ix + dx, iy + dy, INK if edge else (POLICE_R if dx <= 0 else POLICE_B))
        elif kind == 'objective':
            for dy in range(-2, 3):
                for dx in range(-2, 3):
                    if abs(dx) + abs(dy) <= 2:
                        px(img, ix + dx, iy + dy, INK if abs(dx) + abs(dy) == 2 else GOLD)
        elif kind == 'home':
            sprite(img, ix - 3, iy - 3, ['...#...', '..#c#..', '.#ccc#.', '#ccccc#', '.#c#c#.', '.#c#c#.', '.#####.'], {'#': INK, 'c': CREAM})
        elif kind == 'shop':
            sprite(img, ix - 2, iy - 2, ['#####', '#ggg#', '#g#g#', '#ggg#', '#####'], {'#': INK, 'g': R('sage', 4)})
    # player arrow (center), pointing in the movement direction
    sprite(img, cx - 3, cy - 3, ['...#...', '..#w#..', '.#www#.', '#wwwww#', '...w...', '...w...', '.......'], {'#': INK, 'w': CREAM})
    # ring
    for a in np.linspace(0, 2 * np.pi, 400):
        px(img, int(round(cx + (r + 1) * np.cos(a))), int(round(cy + (r + 1) * np.sin(a))), EDGE)
        px(img, int(round(cx + (r + 2) * np.cos(a))), int(round(cy + (r + 2) * np.sin(a))), INK)


# ------------------------------------------------------------------ HUD layers
def hud_top_left(img, x, y, weapon=W_PISTOL, ammo='12/48', hp=0.68, armor=0.4, label='9MM'):
    plate(img, x, y, 112, 36)
    sprite(img, x + 5, y + 5, weapon, W_PAL)
    draw_text(img, x + 26 - 4 + 12, y + 7, ammo.split('/')[0], CREAM, INK, scale=2)
    draw_text(img, x + 26 + 12 + text_width(ammo.split('/')[0], 2) + 1, y + 12, '/' + ammo.split('/')[1], MUTED)
    draw_text(img, x + 108 - text_width(label), y + 7, label, MUTED)
    # bars
    sprite(img, x + 5, y + 21, ['.#.#.', '#####', '#####', '.###.', '..#..'], {'#': HP})
    bar(img, x + 13, y + 21, 94, 5, hp, HP, HP_LO)
    sprite(img, x + 5, y + 28, ['#####', '#####', '#####', '.###.', '..#..'], {'#': ARM})
    bar(img, x + 13, y + 28, 94, 4, armor, ARM, ARM_LO, segs=2)


def hud_stars(img, cx, y, n, flash=False):
    w = 5 * 11 + 6
    plate(img, cx - w // 2 - 2, y, w + 4, 15)
    for k in range(5):
        spr = STAR_FILL if k < n else STAR_EMPTY
        if flash and k < n:
            spr = STAR_FLASH
        sprite(img, cx - w // 2 + 4 + k * 11, y + 3, spr, STAR_PAL)


def hud_top_right(img, xr, y, day='MON', clock='21:40', clean='1,240', dirty='380', night=True):
    w = 92
    x = xr - w
    plate(img, x, y, w, 36)
    sprite(img, x + 5, y + 4, MOON if night else SUN, {'#': R('stone', 5), 'o': GOLD})
    draw_text(img, x + 15, y + 5, day, MUTED)
    draw_text(img, x + 15 + text_width(day) + 4, y + 5, clock, CREAM)
    sprite(img, x + 5, y + 14, ICON_CLEAN, ICON_PAL)
    draw_text(img, x + 17, y + 15, '$' + clean, CREAM, INK)
    sprite(img, x + 5, y + 24, ICON_DIRTY, ICON_PAL)
    draw_text(img, x + 17, y + 25, '$' + dirty, DIRTY, INK)
    draw_text(img, x + w - 4 - text_width('DIRTY'), y + 25, 'DIRTY', (120, 86, 98))
    draw_text(img, x + w - 4 - text_width('CLEAN'), y + 15, 'CLEAN', (120, 112, 120))


def hud_objective(img, cx, y, text):
    w = text_width(text) + 18
    plate(img, cx - w // 2, y, w, 13)
    for k in range(3):
        px(img, cx - w // 2 + 5 + k, y + 6 - (1 if k == 1 else 0), GOLD)
    sprite(img, cx - w // 2 + 4, y + 4, ['.#.', '###', '.#.', '...', '.#.'][:3] and ['#..', '##.', '###', '##.', '#..'], {'#': GOLD})
    draw_text(img, cx - w // 2 + 12, y + 4, text, CREAM)


def hud_toast(img, xr, y, who, text):
    w = max(text_width(who), text_width(text)) + 22
    x = xr - w
    plate(img, x, y, w, 20, edge=R('lavlt', 2))
    sprite(img, x + 5, y + 5, PHONE, {'#': INK, 'c': R('glass', 4)})
    draw_text(img, x + 14, y + 4, who, GOLD)
    draw_text(img, x + 14, y + 11, text, CREAM)


def hud_hint_keys(img, x, y, items):
    """Small key hints strip, e.g. [M] MASK  [P] PHONE."""
    cx = x
    for key, label in items:
        kw = text_width(key) + 4
        blend(img, y, y + 9, cx, cx + kw, GOLD); blend(img, y + 8, y + 9, cx, cx + kw, GOLD_LO)
        draw_text(img, cx + 2, y + 2, key, PLATE)
        draw_text(img, cx + kw + 3, y + 2, label, MUTED, INK)
        cx += kw + 6 + text_width(label) + 8


# ------------------------------------------------------------------ minigame panel (lockpick)
def lockpick_panel(img, cx, cy):
    w, h = 176, 128
    x, y = cx - w // 2, cy - h // 2
    blend(img, 0, img.shape[0], 0, img.shape[1], (20, 14, 24), 0.35)    # dim the world
    plate(img, x, y, w, h, alpha=0.96)
    draw_text(img, x + 8, y + 7, 'LOCKPICK', GOLD, INK, scale=2)
    draw_text(img, x + w - 8 - text_width('TIER 0'), y + 9, 'TIER 0', MUTED)
    # dial
    dcx, dcy, r = x + 54, y + 72, 34
    yy, xx = np.mgrid[-r - 3:r + 4, -r - 3:r + 4]
    d = np.sqrt((xx + 0.5) ** 2 + (yy + 0.5) ** 2)
    ang = (np.degrees(np.arctan2(yy + 0.5, xx + 0.5)) + 90) % 360
    good = (ang > 200) & (ang < 260)
    great = (ang > 226) & (ang < 240)
    for j in range(yy.shape[0]):
        for i in range(yy.shape[1]):
            dd = d[j, i]; X = dcx + xx[j, i]; Y = dcy + yy[j, i]
            if dd <= r - 9:
                px(img, X, Y, PLATE_HI if dd > r - 12 else PLATE)
            elif dd <= r - 1:
                c = R('lav', 2)
                if great[j, i]:
                    c = GOLD
                elif good[j, i]:
                    c = CREAM
                px(img, X, Y, c)
            elif dd <= r + 1:
                px(img, X, Y, INK)
    # needle
    a = np.radians(214 - 90)
    for t in np.linspace(0, r - 2, 60):
        px(img, int(round(dcx + t * np.cos(a))), int(round(dcy + t * np.sin(a))), HP)
        px(img, int(round(dcx + t * np.cos(a))) + 1, int(round(dcy + t * np.sin(a))), HP)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            px(img, dcx + dx, dcy + dy, GOLD)
    # right column: progress + checks + tool
    rx = x + 100
    draw_text(img, rx, y + 34, 'PROGRESS', MUTED)
    bar(img, rx, y + 42, 66, 7, 0.55, GOLD, GOLD_LO)
    draw_text(img, rx, y + 56, 'CHECKS', MUTED)
    for k in range(2):
        c = GOLD if k == 0 else PLATE_HI
        blend(img, y + 64, y + 70, rx + k * 10, rx + k * 10 + 7, c)
    draw_text(img, rx, y + 78, 'TOOL', MUTED)
    draw_text(img, rx, y + 86, 'BASIC PICKS', CREAM)
    bar(img, rx, y + 94, 66, 4, 0.7, R('sage', 3), R('sage', 1), segs=10)
    # key hints
    hud_hint_keys(img, x + 8, y + h - 16, [('SPACE', 'HIT'), ('ESC', 'ABORT')])
    draw_text(img, x + 100, y + h - 14, 'NOISE', MUTED)
    for k in range(3):
        blend(img, y + h - 14, y + h - 9, x + 124 + k * 6, x + 128 + k * 6, HP if k == 0 else PLATE_HI)


# ------------------------------------------------------------------ compose
def world_crop(img_full, meta, wx, wy, w=VW, h=VH, off=(0, 0)):
    sx = wx - wy + meta['MX'] - meta['x0']
    sy = (wx + wy) / 2 + meta['MY'] - meta['y0']
    x0 = int(sx - w / 2 + off[0]); y0 = int(sy - h / 2 + off[1])
    return img_full[y0:y0 + h, x0:x0 + w].copy()


def buildings_for_radar():
    out = []
    for key, ai, walk, wx, wy, shd, fl in scene.placements():
        if key.startswith('bld/') and shd[0] == 'box':
            hx, hy = (shd[1], shd[2]) if ai in (0, 4) else (shd[2], shd[1])
            if ai in (0, 4) or ai in (2, 6):
                hx, hy = shd[1], shd[2]
            out.append((wx, wy, hx, hy))
    return out


def main():
    os.makedirs('out/hud', exist_ok=True)
    day = np.array(scene.compose(False, 1)); meta = dict(scene.compose.last)
    PADW = 420
    bgc = np.array([83, 72, 89, 255], np.uint8)
    padded = np.zeros((day.shape[0] + 2 * PADW, day.shape[1] + 2 * PADW, 4), np.uint8); padded[...] = bgc
    padded[PADW:PADW + day.shape[0], PADW:PADW + day.shape[1]] = day
    day = padded; meta['x0'] -= PADW; meta['y0'] -= PADW
    tiles = scene.build_tiles()
    blds = buildings_for_radar()

    # ---- mockup 1: escaping after a store robbery, 2 stars, dusk-ish clock
    v = world_crop(day, meta, 700, 346, off=(-40, -40))
    hud_top_left(v, 6, 6, W_PISTOL, '12/48', 0.68, 0.4)
    hud_stars(v, VW // 2, 6, 2, flash=False)
    hud_top_right(v, VW - 6, 6, 'MON', '21:40', '1,240', '380', night=True)
    draw_radar(v, 46, VH - 46, 38, 700, 346, tiles, blds,
               [('police', 610, 416), ('police', 604, 352), ('objective', 744, 356), ('home', 196, 660), ('shop', 680, 252)],
               search=(650, 330, 150))
    hud_objective(v, VW // 2, VH - 20, 'LOSE THE COPS: STAY OUT OF THE SEARCH AREA')
    hud_toast(v, VW - 6, VH - 52, 'DEZ', "BACK ROOM'S OPEN AFTER 6.")
    hud_hint_keys(v, VW - 168, VH - 20, [('M', 'MASK'), ('P', 'PHONE'), ('I', 'BAG')])
    to_image(v, 3).save('out/hud/hud_mockup_street.png')

    # ---- mockup 2: lockpicking the parked car (minigame panel open, 0 stars, night)
    v2 = world_crop(day, meta, 800, 180, off=(-60, 0))
    hud_top_left(v2, 6, 6, W_KNIFE, '-/-', 1.0, 0.0, label='MELEE')
    hud_stars(v2, VW // 2, 6, 0)
    hud_top_right(v2, VW - 6, 6, 'TUE', '02:15', '1,240', '0', night=True)
    draw_radar(v2, 46, VH - 46, 38, 846, 120, tiles, blds, [('objective', 846, 120), ('home', 196, 660)])
    lockpick_panel(v2, 150, VH // 2 + 10)
    to_image(v2, 3).save('out/hud/hud_mockup_lockpick.png')

    # ---- HUD kit sheet (4x)
    K = np.zeros((250, 420, 4), np.uint8); K[...] = (*R('lav', 3), 255)
    draw_text(K, 8, 6, 'DOUBLE LIFE  HUD KIT', CREAM, INK, scale=2)
    draw_text(K, 8, 24, 'STARS: EMPTY / WANTED / SEARCHING (FLASH FRAME)', MUTED, INK)
    for k, spr in enumerate((STAR_EMPTY, STAR_FILL, STAR_FLASH)):
        sprite(K, 10 + k * 14, 33, spr, STAR_PAL)
    draw_text(K, 8, 48, 'WEAPON ICONS', MUTED, INK)
    for k, w in enumerate((W_BAT, W_KNIFE, W_PISTOL, W_SMG, W_SHOTGUN, W_RIFLE)):
        sprite(K, 10 + k * 22, 57, w, W_PAL)
    draw_text(K, 8, 72, 'MONEY: CLEAN / DIRTY', MUTED, INK)
    sprite(K, 10, 81, ICON_CLEAN, ICON_PAL); sprite(K, 24, 81, ICON_DIRTY, ICON_PAL)
    draw_text(K, 8, 94, 'BARS: HEALTH / ARMOR (2 PLATES)', MUTED, INK)
    bar(K, 10, 103, 90, 5, 0.68, HP, HP_LO); bar(K, 10, 111, 90, 4, 0.5, ARM, ARM_LO, segs=2)
    draw_text(K, 8, 122, 'PROMPTS: READY / MISSING REQUIREMENT', MUTED, INK)
    pr = scene.prompt('E', 'LOCKPICK')
    K[131:131 + pr.shape[0], 10:10 + pr.shape[1]][pr[..., 3] > 0] = pr[pr[..., 3] > 0]
    pr2 = scene.prompt('E', 'LOCKPICK - NEEDS PICKS')
    m2 = pr2[..., 3] > 0
    pr2c = pr2.copy()
    lab = (pr2c[..., 0] > 200) & (pr2c[..., 1] > 200) & (pr2c[..., 2] > 200)
    pr2c[lab, :3] = DIRTY
    K[131:131 + pr2.shape[0], 70:70 + pr2.shape[1]][m2] = pr2c[m2]
    draw_text(K, 8, 152, 'RADAR BLIPS', MUTED, INK)
    leg = np.zeros((14, 200, 4), np.uint8)
    draw_radar(K, 34, 200, 26, 700, 346, tiles, blds, [('police', 640, 380), ('objective', 744, 356), ('home', 196, 660), ('shop', 680, 252)], search=(650, 330, 150))
    draw_text(K, 70, 176, 'ARROW  PLAYER', CREAM, INK)
    draw_text(K, 70, 186, 'RED/BLUE  POLICE + SEARCH AREA', CREAM, INK)
    draw_text(K, 70, 196, 'GOLD  OBJECTIVE', GOLD, INK)
    draw_text(K, 70, 206, 'HOUSE  HOME / SAVE', CREAM, INK)
    draw_text(K, 70, 216, 'GREEN  SHOP', R('sage', 4), INK)
    hud_toast(K, 410, 170, 'MS. HOLLIS', 'SHIFT STARTS AT 8. DON\'T BE LATE.')
    hud_objective(K, 320, 200, 'CLOCK IN AT THE TOWER')
    hud_hint_keys(K, 230, 222, [('E', 'USE'), ('M', 'MASK'), ('P', 'PHONE')])
    to_image(K, 4).save('out/hud/hud_kit.png')
    print('hud done')


if __name__ == '__main__':
    main()

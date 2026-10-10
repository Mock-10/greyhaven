"""Interior drafts: cutaway rooms (Project Zomboid style) with furniture built in the same SDF pipeline."""
import os, sys, warnings
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
warnings.filterwarnings('ignore')
import numpy as np
from PIL import Image, ImageDraw
from sdf import (Model, ell, capsule, rbox, cyl_z, cyl_y, smin, solid, RID, hash3, render, highlight, to_image, scaled)
import cache, ground2d as G
from scene import prompt, _hull

T = 32
WALL_H = 62          # ceiling height (~2.7 m; person = 40)
STUB_H = 7           # cut-down front walls
WT = 5               # wall thickness


# ===================================================================== walls
def back_walls(W, D, paper=('lavlt', 3.0), doors=(), windows=(), pictures=(), trim='wood'):
    """Back walls of a W x D room (world units). Wall A runs along x at y=0 (inner face +y).
    Wall B runs along y at x=0 (inner face +x).
    doors / windows / pictures: list of (wall, start, end) along that wall in world units
    (pictures: (wall, centre, width, height, ramp))."""
    H = WALL_H

    def parts(P):
        a = rbox(P, ((W - WT) / 2, -WT / 2, H / 2), ((W + WT) / 2, WT / 2, H / 2), 0.3)
        b = rbox(P, (-WT / 2, (D - WT) / 2, H / 2), (WT / 2, (D + WT) / 2, H / 2), 0.3)
        d = np.minimum(a, b)
        for dd in doors:
            w, s0, s1 = dd[:3]
            if w == 'A':
                d = np.maximum(d, -rbox(P, ((s0 + s1) / 2, -WT / 2, 23), ((s1 - s0) / 2, WT, 23), 0.2))
            else:
                d = np.maximum(d, -rbox(P, (-WT / 2, (s0 + s1) / 2, 23), (WT, (s1 - s0) / 2, 23), 0.2))
        # door frames + door leaves set into the opening (slightly ajar look via darker inset)
        fr = np.full(len(P), 1e3)
        for dd in doors:
            w, s0, s1 = dd[:3]
            if w == 'A':
                fr = np.minimum(fr, rbox(P, ((s0 + s1) / 2, -WT + 0.8, 23), ((s1 - s0) / 2, 0.8, 23), 0.2))
            else:
                fr = np.minimum(fr, rbox(P, (-WT + 0.8, (s0 + s1) / 2, 23), (0.8, (s1 - s0) / 2, 23), 0.2))
        return [d, fr]

    def wall_mat(p, n):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        N = len(p)
        top = n[:, 2] > 0.6
        innerA = (n[:, 1] > 0.6) & (y > -1.0)
        innerB = (n[:, 0] > 0.6) & (x > -1.0)
        inner = innerA | innerB
        u = np.where(innerA, x, y)
        ramp = np.full(N, RID[paper[0]]); base = np.full(N, paper[1])
        # subtle wallpaper stripes
        stripe = inner & (np.mod(u, 6.0) < 1.2)
        base = np.where(stripe, base + 0.35, base)
        # baseboard + crown
        bb = inner & (z < 3.5)
        ramp = np.where(bb, RID[trim], ramp); base = np.where(bb, 2.0, base)
        cr = inner & (z > WALL_H - 2.5)
        ramp = np.where(cr, RID['white'], ramp); base = np.where(cr, 3.5, base)
        # windows
        for (w, s0, s1) in windows:
            on = innerA if w == 'A' else innerB
            win = on & (u > s0) & (u < s1) & (z > 18) & (z < 46)
            frame = on & (u > s0 - 1.5) & (u < s1 + 1.5) & (z > 16.5) & (z < 47.5) & ~win
            mull = win & (np.abs(u - (s0 + s1) / 2) < 0.7)
            ramp = np.where(frame | mull, RID['white'], ramp); base = np.where(frame | mull, 3.6, base)
            g = win & ~mull
            # sky gradient with a hint of the grey city outside
            skyline = hash3(np.floor(u / 5.0), 1, 1, 7) * 10 + 22
            bld = g & (z < skyline)
            ramp = np.where(g, RID['glass'], ramp)
            base = np.where(g, 2.4 + (z - 18) * 0.06, base)
            ramp = np.where(bld, RID['blueg'], ramp); base = np.where(bld, 1.6 + (np.mod(u, 4.0) < 1.0) * 0.8, base)
            sill = on & (u > s0 - 2.5) & (u < s1 + 2.5) & (z > 15) & (z < 16.6)
            ramp = np.where(sill, RID['white'], ramp); base = np.where(sill, 4.0, base)
        # pictures / posters
        for (w, c, pw, ph, pr) in pictures:
            on = innerA if w == 'A' else innerB
            fr = on & (np.abs(u - c) < pw / 2 + 1) & (np.abs(z - 34) < ph / 2 + 1)
            art = on & (np.abs(u - c) < pw / 2) & (np.abs(z - 34) < ph / 2)
            ramp = np.where(fr, RID['wood'], ramp); base = np.where(fr, 1.6, base)
            ramp = np.where(art, RID[pr], ramp); base = np.where(art, 2.4 + (z - 34) * 0.12, base)
        # cut top of the walls: dark section like Project Zomboid
        ramp = np.where(top, RID['night'], ramp); base = np.where(top, 2.6, base)
        # outer faces (rarely seen)
        outer = ~inner & ~top
        ramp = np.where(outer, RID['lav'], ramp); base = np.where(outer, 2.6, base)
        return ramp, base, np.zeros(N)

    def door_mat(p, n):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        N = len(p)
        ramp = np.full(N, RID['wood']); base = 1.8 + (np.mod(z, 12) < 0.7) * -0.6; sh = np.zeros(N)
        for dd in doors:
            w, s0, s1 = dd[:3]
            kind = dd[3] if len(dd) > 3 else 'door'
            u = x if w == 'A' else y
            on = (u >= s0 - 1) & (u <= s1 + 1)
            if kind == 'open':
                ramp = np.where(on, RID['night'], ramp); base = np.where(on, 0.5, base)
            else:
                knob = on & (np.abs(u - (s1 - 3.0)) < 1.1) & (np.abs(z - 21) < 1.1)
                panel = on & ((np.abs(u - s0) < 1.2) | (np.abs(u - s1) < 1.2) | (z > 44.5))
                ramp = np.where(knob, RID['gold'], ramp); base = np.where(knob, 4.2, np.where(panel, 2.6, base))
                sh = np.where(knob, 0.8, sh)
        return ramp, base, sh

    return Model(parts, [wall_mat, door_mat], (-WT - 1, W + 1, -WT - 1, D + 1, 0, WALL_H + 1))


def front_stubs(W, D, paper=('lavlt', 3.0), gaps=()):
    def parts(P):
        a = rbox(P, ((W + WT) / 2, D + WT / 2, STUB_H / 2), ((W + WT) / 2 + 0.01, WT / 2, STUB_H / 2), 0.3)
        b = rbox(P, (W + WT / 2, (D + WT) / 2, STUB_H / 2), (WT / 2, (D + WT) / 2, STUB_H / 2), 0.3)
        d = np.minimum(a, b)
        for (w, s0, s1) in gaps:
            if w == 'A':
                d = np.maximum(d, -rbox(P, ((s0 + s1) / 2, D + WT / 2, STUB_H / 2), ((s1 - s0) / 2, WT, STUB_H), 0.2))
            else:
                d = np.maximum(d, -rbox(P, (W + WT / 2, (s0 + s1) / 2, STUB_H / 2), (WT, (s1 - s0) / 2, STUB_H), 0.2))
        return [d]

    def mat(p, n):
        top = n[:, 2] > 0.6
        return np.where(top, RID['night'], RID[paper[0]]), np.where(top, 2.6, paper[1] - 0.6), np.zeros(len(p))
    return Model(parts, [mat], (-1, W + WT + 1, -1, D + WT + 1, 0, STUB_H + 1))


# ===================================================================== furniture
def bed():
    def parts(P):
        frame = rbox(P, (0, 0, 4.5), (24, 16, 4.5), 1.0)
        mat = rbox(P, (1, 0, 10.5), (22, 15, 2.2), 1.6)
        head = rbox(P, (-24.5, 0, 12), (1.5, 16.5, 12), 0.8)
        pillow = np.minimum(ell(P, (-17, -7, 13.5), (4.5, 6, 1.8)), ell(P, (-17, 7, 13.5), (4.5, 6, 1.8)))
        blanket = rbox(P, (6, 0, 12.6), (16.5, 15.6, 0.9), 0.7)
        return [frame, mat, head, pillow, blanket]

    def blanket(p, n):
        x = p[:, 0]
        fold = x < -9.5
        stripe = (np.mod(x + 40, 6.0) < 1.0) & ~fold
        return np.where(fold, RID['white'], RID['teal']), np.where(fold, 3.6, 2.3 + stripe * 0.5), np.zeros(len(p))
    return Model(parts, [solid('wood', 2.0), solid('white', 3.2), solid('wood', 2.4), solid('white', 3.9), blanket], (-27, 26, -18, 18, 0, 25))


def nightstand():
    def parts(P):
        box = rbox(P, (0, 0, 6.5), (5.5, 5.5, 6.5), 0.7)
        lampb = capsule(P, (0, 0, 13), (0, 0, 18), 0.9, 0.6)
        shade = cyl_z(P, (0, 0, 20.5), 3.2, 2.5, 0.8)
        return [box, lampb, shade]
    return Model(parts, [solid('wood', 2.2), solid('night', 2.0), solid('stone', 4.3, 0.3)], (-7, 7, -7, 7, 0, 24))


def sofa(color=('plum', 2.4)):
    def parts(P):
        seat = rbox(P, (0, 0, 6), (22, 9, 6), 2.0)
        back = rbox(P, (0, -7.5, 13), (22, 3, 8), 2.0)
        arms = np.minimum(rbox(P, (-21, 0, 9.5), (3, 9.5, 5), 2.0), rbox(P, (21, 0, 9.5), (3, 9.5, 5), 2.0))
        cush = np.minimum(rbox(P, (-9, 1, 12.5), (9.5, 7, 1.6), 1.4), rbox(P, (9, 1, 12.5), (9.5, 7, 1.6), 1.4))
        return [smin(smin(seat, back, 1.0), arms, 1.0), cush]
    return Model(parts, [solid(color[0], color[1]), solid(color[0], color[1] + 0.5)], (-25, 25, -12, 11, 0, 22))


def tv_stand():
    def parts(P):
        stand = rbox(P, (0, 0, 5), (14, 5, 5), 0.8)
        tv = rbox(P, (0, -1, 19), (13, 1.2, 8), 0.6)
        foot = rbox(P, (0, -1, 11), (3, 2, 1), 0.4)
        return [stand, tv, foot]

    def tvm(p, n):
        scr = (n[:, 1] > 0.5) & (np.abs(p[:, 0]) < 11.8) & (np.abs(p[:, 2] - 19) < 6.8)
        return np.where(scr, RID['glass'], RID['night']), np.where(scr, 2.0 + (p[:, 2] - 13) * 0.12, 1.6), np.where(scr, 1.0, 0.0)
    return Model(parts, [solid('wood', 1.8), tvm, solid('night', 1.6)], (-16, 16, -7, 7, 0, 28))


def kitchen_run(length=60):
    L = length

    def parts(P):
        base = rbox(P, (L / 2, 0, 9.5), (L / 2, 7.5, 9.5), 0.6)
        top = rbox(P, (L / 2, 0.5, 19.8), (L / 2 + 0.5, 8.2, 0.8), 0.4)
        upper = rbox(P, (L / 2, -5.5, 42), (L / 2, 3.5, 7.5), 0.6)
        sink = rbox(P, (L * 0.3, 1, 20.6), (6, 4.5, 0.6), 0.6)
        tap = capsule(P, (L * 0.3, -4, 20.5), (L * 0.3, -1.5, 25), 0.6)
        stove = rbox(P, (L * 0.75, 0.5, 20.7), (7, 6.5, 0.4), 0.3)
        return [base, top, upper, sink, tap, stove]

    def cab(p, n):
        x, z = p[:, 0], p[:, 2]
        front = n[:, 1] > 0.5
        seam = front & (np.mod(x, 12.0) < 0.6)
        knob = front & (np.abs(np.mod(x, 12.0) - 10) < 0.8) & (np.abs(z - 15) < 1.0)
        return np.where(knob, RID['gold'], RID['white']), np.where(knob, 4.0, 3.0 - seam * 1.0), np.where(knob, 0.7, 0.0)

    def stovem(p, n):
        x, y = p[:, 0], p[:, 1]
        ring = (np.abs(np.sqrt((np.mod(x, 7.0) - 3.5) ** 2 + (np.mod(y + 20, 6.5) - 3.25) ** 2) - 2.0) < 0.6)
        return np.where(ring, RID['night'], RID['asph']), np.where(ring, 0.8, 1.8), np.zeros(len(p))
    return Model(parts, [cab, solid('stone', 3.6), cab, solid('lavlt', 2.0, 0.6), solid('lavlt', 3.4, 0.8), stovem], (-1, L + 1, -10, 10, 0, 51))


def fridge():
    def parts(P):
        return [rbox(P, (0, 0, 21), (7.5, 7, 21), 1.2)]

    def m(p, n):
        z = p[:, 2]
        front = n[:, 1] > 0.5
        seam = front & (np.abs(z - 27) < 0.5)
        hd = front & (np.abs(p[:, 0] - 5.5) < 0.6) & (((z > 29) & (z < 36)) | ((z > 17) & (z < 24)))
        mag = front & (np.abs(p[:, 0] + 2) < 1.4) & (np.abs(z - 33) < 1.4)
        r = np.where(hd, RID['lavlt'], np.where(mag, RID['red'], RID['white']))
        b = np.where(seam, 2.2, np.where(hd, 4.0, np.where(mag, 3.0, 3.3)))
        return r, b, np.full(len(p), 0.2)
    return Model(parts, [m], (-9, 9, -9, 9, 0, 43))


def table_chairs():
    def parts(P):
        top = rbox(P, (0, 0, 16), (11, 8, 0.8), 0.5)
        legs = np.minimum.reduce([rbox(P, (sx, sy, 7.6), (0.7, 0.7, 7.6), 0.2) for sx in (-9.5, 9.5) for sy in (-6.5, 6.5)])
        ch = np.full(len(P), 1e3)
        for sx in (-14.5, 14.5):
            ch = np.minimum(ch, rbox(P, (sx, 0, 10), (3.5, 4, 0.7), 0.4))
            ch = np.minimum(ch, rbox(P, (sx + np.sign(sx) * 3.2, 0, 15), (0.6, 4, 5), 0.3))
            ch = np.minimum.reduce([ch] + [rbox(P, (sx + dx, dy, 5), (0.5, 0.5, 5), 0.2) for dx in (-3, 3) for dy in (-3.3, 3.3)])
        mug = cyl_z(P, (3, 2, 18.2), 1.4, 1.6, 0.3)
        return [top, legs, ch, mug]
    return Model(parts, [solid('wood', 2.6), solid('wood', 1.7), solid('wood', 2.1), solid('clay', 3.2)], (-20, 20, -10, 10, 0, 21))


def wardrobe():
    def parts(P):
        return [rbox(P, (0, 0, 24), (11, 7, 24), 0.8)]

    def m(p, n):
        x, z = p[:, 0], p[:, 2]
        front = n[:, 1] > 0.5
        seam = front & (np.abs(x) < 0.4)
        hd = front & (np.abs(np.abs(x) - 1.6) < 0.5) & (np.abs(z - 25) < 2.2)
        panel = front & (np.abs(np.abs(x) - 5.5) < 4.2) & (np.mod(z, 23.0) > 2) & (np.mod(z, 23.0) < 21)
        return np.where(hd, RID['gold'], RID['wood']), np.where(hd, 4.0, 2.2 - seam * 1.0 + panel * 0.3), np.where(hd, 0.8, 0.0)
    return Model(parts, [m], (-12, 12, -8, 8, 0, 49))


def rug(w=34, d=24, ramp=('brick', 2.3)):
    def parts(P):
        return [rbox(P, (0, 0, 0.5), (w / 2, d / 2, 0.5), 0.4)]

    def m(p, n):
        x, y = p[:, 0], p[:, 1]
        border = (np.abs(x) > w / 2 - 2.5) | (np.abs(y) > d / 2 - 2.5)
        diamond = (np.abs(x) / (w / 2) + np.abs(y) / (d / 2)) < 0.45
        return np.where(border, RID['khaki'], RID[ramp[0]]), np.where(border, 2.4, ramp[1] + diamond * 0.6), np.zeros(len(p))
    return Model(parts, [m], (-w / 2 - 1, w / 2 + 1, -d / 2 - 1, d / 2 + 1, 0, 2))


def floor_stash():
    """Loose floorboard stash (interactable)."""
    def parts(P):
        return [rbox(P, (0, 0, 0.6), (5.5, 3.2, 0.6), 0.2), rbox(P, (0, 0, 1.0), (4.5, 2.4, 0.3), 0.1)]
    return Model(parts, [solid('wood', 1.6), solid('gold', 3.2, 0.8)], (-7, 7, -5, 5, 0, 2))


def shelf_unit(length=40, goods_seed=1):
    L = length

    def parts(P):
        frame = rbox(P, (0, 0, 17), (L / 2, 5, 17), 0.5)
        hollow = rbox(P, (0, 0, 18), (L / 2 - 1.5, 5.5, 15.5), 0.2)
        body = np.maximum(frame, -hollow)
        shelves = np.minimum.reduce([rbox(P, (0, 0, z), (L / 2 - 1, 4.5, 0.5), 0.2) for z in (3.5, 13, 22.5, 32)])
        goods = np.full(len(P), 1e3)
        for k, z in enumerate((4.3, 13.8, 23.3)):
            for i in range(int(L // 5)):
                cx = -L / 2 + 3 + i * 5
                h = 2.5 + hash3(np.array([i]), np.array([k]), 1, goods_seed)[0] * 4.0
                for sy in (-2.3, 2.3):
                    goods = np.minimum(goods, rbox(P, (cx, sy, z + h / 2), (1.9, 1.9, h / 2), 0.4))
        return [body, shelves, goods]

    def gm(p, n):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        k = hash3(np.floor((x + 60) / 5.0), np.floor(z / 9.5), np.floor((y + 6) / 4.6), goods_seed)
        ramps = np.array([RID['red'], RID['sage'], RID['gold'], RID['navy'], RID['clay'], RID['plum'], RID['white'], RID['khaki']])
        r = ramps[(k * 8).astype(int) % 8]
        lab = (np.abs(np.mod(z, 9.5) - 3.2) < 0.7)
        return r, 2.6 + lab * 0.9, np.zeros(len(p))
    return Model(parts, [solid('lavlt', 2.6), solid('lavlt', 3.2), gm], (-L / 2 - 1, L / 2 + 1, -6, 6, 0, 35))


def drinks_fridge(doors=3):
    L = doors * 12

    def parts(P):
        return [rbox(P, (0, 0, 22), (L / 2, 7, 22), 0.8)]

    def m(p, n):
        x, z = p[:, 0], p[:, 2]
        front = n[:, 1] > 0.5
        glass = front & (np.mod(x + L / 2, 12.0) > 1.2) & (np.mod(x + L / 2, 12.0) < 10.8) & (z > 6) & (z < 40)
        shelfl = glass & (np.mod(z - 6, 8.5) < 0.6)
        bottle = glass & ~shelfl & (np.mod(x + L / 2, 2.4) < 1.5) & (np.mod(z - 6, 8.5) < 6.0)
        k = hash3(np.floor((x + 40) / 2.4), np.floor(z / 8.5), 2, 4)
        br = np.array([RID['sage'], RID['red'], RID['gold'], RID['teal'], RID['clay']])[(k * 5).astype(int) % 5]
        glow = front & (z > 40) & (z < 43.5)
        r = np.where(bottle, br, np.where(glass, RID['glass'], np.where(glow, RID['white'], RID['night'])))
        b = np.where(bottle, 3.0, np.where(glass, 3.6, np.where(glow, 4.5, 2.0)))
        return r, b, np.where(glass, 0.9, 0.0)
    return Model(parts, [m], (-L / 2 - 1, L / 2 + 1, -8, 8, 0, 45))


def wall_camera():
    def parts(P):
        arm = capsule(P, (0, -3, 50), (0, 2, 48), 0.6)
        body = rbox(P, (0, 3.5, 47), (1.6, 3.2, 1.6), 0.8)
        return [arm, body]

    def m(p, n):
        led = (p[:, 1] > 6.0) & (np.abs(p[:, 2] - 47.5) < 0.9)
        return np.where(led, RID['red'], RID['white']), np.where(led, 4.5, 3.2), np.where(led, 1.0, 0.0)
    return Model(parts, [solid('night', 2.0), m], (-3, 3, -4, 8, 44, 52))


def office_chair():
    def parts(P):
        seat = rbox(P, (0, 0, 10.5), (4.5, 4.5, 1.0), 0.8)
        back = rbox(P, (-4.5, 0, 17), (0.9, 4.2, 5.5), 0.8)
        post = capsule(P, (0, 0, 2), (0, 0, 10), 0.6)
        base = np.minimum.reduce([capsule(P, (0, 0, 1.4), (4.5 * np.cos(a), 4.5 * np.sin(a), 1.0), 0.6) for a in np.linspace(0, 2 * np.pi, 5, endpoint=False)])
        return [seat, back, post, base]
    return Model(parts, [solid('night', 2.4), solid('night', 2.6), solid('lavlt', 2.6), solid('night', 1.8)], (-6, 6, -6, 6, 0, 23))


def cubicle(desk_lit=True):
    """Desk with three partition panels (back + two sides)."""
    def parts(P):
        pb = rbox(P, (0, -12, 15), (17, 0.9, 15), 0.4)
        ps = np.minimum(rbox(P, (-17, -2, 15), (0.9, 10.5, 15), 0.4), rbox(P, (17, -2, 15), (0.9, 10.5, 15), 0.4))
        top = rbox(P, (0, -4.5, 16.5), (16, 7, 0.8), 0.4)
        ped = rbox(P, (11, -4.5, 8), (4, 6, 8), 0.5)
        mon = rbox(P, (-2, -9.5, 24), (6.5, 0.7, 4.3), 0.4)
        stand = capsule(P, (-2, -9.5, 17), (-2, -9.5, 20), 0.6)
        papers = rbox(P, (9, -3, 17.8), (3.2, 2.4, 0.6), 0.2)
        mug = cyl_z(P, (-11, -2, 18.6), 1.2, 1.4, 0.3)
        return [pb, ps, top, ped, mon, stand, papers, mug]

    def panel(p, n):
        fabric = hash3(np.floor(p[:, 0] * 1.5), np.floor(p[:, 2] * 1.5), 3, 2) * 0.4
        trim = p[:, 2] > 28.6
        return np.where(trim, RID['lavlt'], RID['teal']), np.where(trim, 3.2, 2.1 + fabric), np.zeros(len(p))

    def monm(p, n):
        scr = (n[:, 1] > 0.5) & (np.abs(p[:, 0] + 2) < 5.6) & (np.abs(p[:, 2] - 24) < 3.5)
        txt = scr & (np.mod(p[:, 2], 1.6) < 0.6) & (p[:, 0] < 1)
        return np.where(scr, RID['glass'], RID['night']), np.where(txt, 4.4, np.where(scr, 3.2, 1.6)), np.where(scr, 1.0, 0.0)
    return Model(parts, [panel, panel, solid('stone', 3.4), solid('stone', 2.6), monm, solid('night', 2.0), solid('white', 4.0), solid('red', 3.0)],
                 (-19, 19, -14, 4, 0, 31))


def copier():
    def parts(P):
        body = rbox(P, (0, 0, 10), (8, 7, 10), 1.0)
        top = rbox(P, (0, 0, 21), (7.5, 6.5, 1.2), 0.6)
        tray = rbox(P, (9, 0, 13), (2, 5, 0.5), 0.2)
        return [body, top, tray]
    return Model(parts, [solid('white', 3.0), solid('lavlt', 2.6), solid('white', 3.9)], (-10, 12, -9, 9, 0, 23))


def water_cooler():
    def parts(P):
        base = rbox(P, (0, 0, 9), (4.5, 4.5, 9), 0.8)
        jug = smin(cyl_z(P, (0, 0, 22.5), 3.8, 4.5, 1.6), ell(P, (0, 0, 27.5), (2.6, 2.6, 1.5)), 1.0)
        return [base, jug]
    return Model(parts, [solid('white', 3.2), lambda p, n: (np.full(len(p), RID['glass']), np.full(len(p), 3.8), np.full(len(p), 1.0))], (-6, 6, -6, 6, 0, 30))


def vault_door():
    """Huge round vault door standing open, hinged on the wall (rendered as its own object)."""
    def parts(P):
        door = cyl_y(P, (0, 0, 26), 24, 3.2, 1.0)
        door = smin(door, cyl_y(P, (0, 2.8, 26), 18, 1.2, 0.6), 0.5)
        hub = cyl_y(P, (0, 4.5, 26), 5, 1.4, 0.6)
        spokes = np.minimum.reduce([capsule(P, (0, 5, 26), (11 * np.cos(a), 5, 26 + 11 * np.sin(a)), 0.9) for a in np.linspace(0, 2 * np.pi, 3, endpoint=False) + 0.4])
        bolts = np.minimum.reduce([cyl_y(P, (21 * np.cos(a), -0.5, 26 + 21 * np.sin(a)), 1.6, 3.6, 0.4) for a in np.linspace(0, 2 * np.pi, 10, endpoint=False)])
        return [door, hub, spokes, bolts]

    def dm(p, n):
        r = np.sqrt(p[:, 0] ** 2 + (p[:, 2] - 26) ** 2)
        ring = (np.abs(r - 19.5) < 0.7)
        return np.full(len(p), RID['lavlt']), 2.8 - ring * 1.0 + (n[:, 1] < -0.5) * -0.4, np.full(len(p), 0.5)
    return Model(parts, [dm, solid('gold', 3.4, 1.2), solid('gold', 3.0, 1.0), solid('lavlt', 3.6, 0.6)], (-26, 26, -6, 8, 0, 52))


def deposit_wall(cols=8, rows=8):
    L = cols * 5.0

    def parts(P):
        return [rbox(P, (0, 0, rows * 2.6 + 2), (L / 2, 4, rows * 2.6 + 2), 0.4)]

    def m(p, n):
        x, z = p[:, 0], p[:, 2]
        front = n[:, 1] > 0.5
        cx = np.mod(x + L / 2, 5.0); cz = np.mod(z - 2, 5.2)
        seam = front & ((cx < 0.5) | (cz < 0.5))
        key = front & (np.abs(cx - 2.5) < 0.6) & (np.abs(cz - 2.6) < 0.6)
        opened = front & (hash3(np.floor((x + L / 2) / 5.0), np.floor((z - 2) / 5.2), 3, 9) > 0.86) & ~seam
        r = np.where(key, RID['gold'], np.where(opened, RID['night'], RID['stone']))
        b = np.where(key, 3.8, np.where(opened, 1.2, 2.9 - seam * 1.2))
        return r, b, np.where(key, 0.8, 0.3)
    return Model(parts, [m], (-L / 2 - 1, L / 2 + 1, -5, 5, 0, rows * 5.2 + 6))


def money_cart():
    def parts(P):
        cart = rbox(P, (0, 0, 9), (10, 6, 3.5), 0.6)
        legs = np.minimum.reduce([capsule(P, (sx, sy, 0.8), (sx, sy, 6), 0.5) for sx in (-8, 8) for sy in (-4.5, 4.5)])
        wheels = np.minimum.reduce([cyl_y(P, (sx, sy, 1.0), 1.0, 0.5, 0.2) for sx in (-8, 8) for sy in (-4.5, 4.5)])
        cash = np.minimum.reduce([rbox(P, (cx, cy, 13.8 + k * 2.2), (3.6, 2.4, 1.0), 0.3) for k, (cx, cy) in enumerate([(-5, -2), (0, 2), (5, -2), (-2, 1), (3, 0)])])
        return [cart, legs, wheels, cash]

    def cm(p, n):
        band = np.abs(np.mod(p[:, 0] + 40, 7.2) - 3.6) < 0.6
        return np.where(band, RID['stone'], RID['khaki']), np.where(band, 4.2, 2.3), np.zeros(len(p))
    return Model(parts, [solid('lavlt', 2.6, 0.5), solid('lavlt', 2.2), solid('night', 1.2), cm], (-12, 12, -8, 8, 0, 25))


def counter_run(length=50, glass_top=False):
    L = length

    def parts(P):
        base = rbox(P, (0, 0, 9.5), (L / 2, 6, 9.5), 0.6)
        top = rbox(P, (0, 0, 19.7), (L / 2 + 0.6, 6.6, 0.8), 0.4)
        return [base, top]

    def bm(p, n):
        front = n[:, 1] > 0.5
        panel = front & (np.mod(p[:, 0] + 40, 10.0) < 0.6)
        return np.full(len(p), RID['wood']), 2.0 - panel * 0.8, np.zeros(len(p))
    return Model(parts, [bm, solid('stone', 3.4)], (-L / 2 - 1, L / 2 + 1, -8, 8, 0, 21))


def potted_plant():
    def parts(P):
        pot = cyl_z(P, (0, 0, 4), 3.6, 4, 0.8)
        leaves = smin(ell(P, (0, 0, 13), (6, 6, 6)), ell(P, (1, -1, 19), (4, 4, 4)), 2.0) + 0.5 * np.sin(P[:, 0] * 1.7) * np.sin(P[:, 1] * 1.9) * np.sin(P[:, 2] * 1.5)
        return [pot, leaves]
    return Model(parts, [solid('clay', 2.4), lambda p, n: (np.where(hash3(np.floor(p[:, 0] / 2), np.floor(p[:, 1] / 2), np.floor(p[:, 2] / 2), 4) > 0.75, RID['khaki'], RID['sage']), 2.2 + (p[:, 2] - 13) * 0.07, np.zeros(len(p)))], (-8, 8, -8, 8, 0, 24))


# ===================================================================== room composer
def compose_room(W_t, D_t, floor, walls, items, stubs_gaps=(), pad=24, bg=(36, 28, 40), title=None, scale=3):
    """W_t, D_t in tiles. items: list of (img_or_model, ang, wx, wy, shadow, flags)."""
    W, D = W_t * T, D_t * T
    MX = D + pad + 8
    MY = WALL_H + pad + 10
    Wc = W + D + 2 * pad + 16
    Hc = (W + D) // 2 + WALL_H + 2 * pad + 30
    canvas = np.zeros((Hc, Wc, 4), np.uint8); canvas[...] = (*bg, 255)

    def scr(wx, wy, wz=0.0):
        return wx - wy + MX, (wx + wy) / 2 - wz + MY

    def blit(img, x, y):
        h, w = img.shape[:2]
        x = int(round(x)); y = int(round(y))
        x0, y0 = max(0, x), max(0, y); x1, y1 = min(Wc, x + w), min(Hc, y + h)
        if x1 <= x0 or y1 <= y0:
            return
        sub = img[y0 - y:y1 - y, x0 - x:x1 - x].astype(float)
        a = sub[..., 3:4] / 255.0
        dst = canvas[y0:y1, x0:x1, :3].astype(float)
        canvas[y0:y1, x0:x1, :3] = (sub[..., :3] * a + dst * (1 - a)).astype(np.uint8)

    # floor
    for s in range(W_t + D_t):
        for i in range(W_t):
            j = s - i
            if 0 <= j < D_t:
                k = floor(i, j) if callable(floor) else floor
                im = G.make_tile(k, (i * 7 + j * 3) % 5, rim_line=False)[0]
                x, y = scr(i * T, j * T)
                blit(im, x - 32, y)
    # back walls
    wimg, wox, woy = render(walls)
    x, y = scr(0, 0)
    blit(wimg, x - wox, y - woy)
    # contact/ambient shadows on the floor
    sh = Image.new('L', (Wc, Hc), 0); d = ImageDraw.Draw(sh)
    for it in items:
        shd = it[4]
        wx, wy = it[2], it[3]
        if shd is None:
            continue
        if shd[0] == 'box':
            _, hx, hy, hgt = shd
            dx, dy = -0.28 * hgt * 0.6, -0.74 * hgt * 0.6
            corners = [(wx + sx * hx, wy + sy * hy) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
            pts = corners + [(cx + dx, cy + dy) for cx, cy in corners]
            d.polygon(_hull([scr(px, py) for px, py in pts]), fill=120)
        else:
            r = shd[1]; xx, yy = scr(wx - 1, wy - 2)
            d.ellipse([xx - r * 1.15, yy - r * 0.55, xx + r * 1.15, yy + r * 0.55], fill=150)
    # wall-base ambient occlusion strip
    for t in range(0, 7):
        d.line([scr(0, t), scr(W, t)], fill=int(90 * (1 - t / 7)))
        d.line([scr(t, 0), scr(t, D)], fill=int(90 * (1 - t / 7)))
    sha = (np.array(sh).astype(float) / 255.0 * 0.45)[..., None]
    canvas[..., :3] = (canvas[..., :3] * (1 - sha) + np.array([42, 30, 52]) * sha).astype(np.uint8)
    # objects
    prompts = []
    for it in sorted(items, key=lambda it: it[2] + it[3] + it[5].get('z_bias', 0)):
        src, ang, wx, wy, shd, fl = it
        if isinstance(src, tuple):
            img, ox, oy = src
        else:
            img, ox, oy = render(src, ang=ang)
        if 'hl' in fl:
            img, P = highlight(img, fl['hl'], fl.get('valuable', False), frame=1)
            ox += P; oy += P
        wz = fl.get('wz', 0.0)
        x, y = scr(wx, wy, wz)
        blit(img, x - ox, y - oy)
        if 'prompt' in fl:
            top = np.nonzero(img[..., 3].any(1))[0][0]
            prompts.append((x - ox + img.shape[1] / 2, y - oy + top - 3, fl['prompt']))
    # front stubs
    stubs = front_stubs(W, D, gaps=stubs_gaps)
    simg, sox, soy = render(stubs)
    x, y = scr(0, 0)
    blit(simg, x - sox, y - soy)
    for px, py, (kk, lab) in prompts:
        pimg = prompt(kk, lab)
        blit(pimg, px - pimg.shape[1] / 2, py - pimg.shape[0])
    diff = np.abs(canvas[..., :3].astype(int) - np.array(bg)).sum(-1) > 6
    ys, xs = np.nonzero(diff)
    c = canvas[max(0, ys.min() - 12):ys.max() + 12, max(0, xs.min() - 12):xs.max() + 12]
    return c


def ch(key, ang, walk=0.0):
    return cache.get(key, ang, walk)


# ===================================================================== the four drafts
def apartment():
    W_t, D_t = 7, 6
    W, D = W_t * T, D_t * T
    walls = back_walls(W, D, paper=('stone', 2.7), doors=[('B', 140, 162)], windows=[('A', 24, 64), ('A', 120, 160)],
                       pictures=[('B', 60, 18, 12, 'teal'), ('A', 196, 12, 16, 'clay')])
    floor = lambda i, j: 'woodfloor_x'
    it = []
    it.append((bed(), 0, 34, 34, ('box', 24, 16, 12), {'hl': 'idle', 'prompt': ('E', 'SLEEP / SAVE')}))
    it.append((nightstand(), 0, 10, 62, ('box', 5, 5, 12), {}))
    it.append((wardrobe(), 0, 92, 9, ('box', 11, 7, 30), {'hl': 'idle', 'prompt': ('E', 'CHANGE OUTFIT')}))
    it.append((kitchen_run(62), 0, 140, 9, None, {}))
    it.append((fridge(), 0, 212, 10, ('box', 7, 7, 30), {}))
    it.append((rug(40, 30, ('brick', 2.2)), 0, 120, 110, None, {'z_bias': -200}))
    it.append((sofa(('plum', 2.5)), np.pi / 2, 92, 124, ('box', 9, 22, 12), {}))
    it.append((tv_stand(), -np.pi / 2, 166, 118, ('box', 5, 14, 12), {}))
    it.append((table_chairs(), 0, 178, 52, ('box', 11, 8, 10), {}))
    it.append((floor_stash(), 0, 50, 150, None, {'hl': 'idle', 'valuable': True, 'prompt': ('E', 'STASH'), 'z_bias': -200}))
    it.append((potted_plant(), 0, 12, 176, ('blob', 6), {}))
    it.append((ch('char/office_worker', 1, 0.0)) + (0,) if False else (ch('char/office_worker', 1, 0.0), 0, 120, 70, ('blob', 6), {}))
    return compose_room(W_t, D_t, floor, walls, it, stubs_gaps=[('A', 150, 172)])


def store():
    W_t, D_t = 8, 6
    W, D = W_t * T, D_t * T
    walls = back_walls(W, D, paper=('white', 2.6), doors=[('B', 30, 52)], pictures=[('A', 70, 26, 10, 'red'), ('A', 180, 22, 12, 'sage')])
    floor = lambda i, j: 'linoleum_a'
    it = []
    it.append((drinks_fridge(4), 0, 90, 9, ('box', 24, 7, 30), {}))
    it.append((drinks_fridge(3), 0, 176, 9, ('box', 18, 7, 30), {}))
    it.append((shelf_unit(56, 2), 0, 112, 78, ('box', 28, 5, 24), {}))
    it.append((shelf_unit(56, 5), 0, 112, 122, ('box', 28, 5, 24), {}))
    it.append((counter_run(56), np.pi / 2, 220, 110, ('box', 6, 28, 14), {}))
    it.append((scaled(__import__('props2').cash_register(), 1.0), np.pi / 2, 222, 110, None,
               {'hl': 'hover', 'prompt': ('E', 'ROB REGISTER'), 'z_bias': 2}) if False else
              (render(scaled(_register_only(), 1.35), ang=np.pi / 2), 0, 218, 100, None, {'hl': 'hover', 'prompt': ('E', 'ROB REGISTER'), 'wz': 20.5, 'z_bias': 20}))
    it.append((ch('char/civilian_b', 3, 0.0), 0, 242, 130, ('blob', 6), {'z_bias': 30}))
    it.append((ch('char/masked_thief', 7, 0.0), 0, 190, 128, ('blob', 6), {}))
    it.append((wall_camera(), 0, 246, 8, None, {'hl': 'idle', 'prompt': ('E', 'DISABLE CAMERA')}))
    it.append((scaled(__import__('props2').safe(), 1.2), 0, 22, 112, ('box', 11, 11, 20), {'hl': 'idle', 'prompt': ('E', 'CRACK SAFE')}))
    it.append((potted_plant(), 0, 238, 20, ('blob', 6), {}))
    return compose_room(W_t, D_t, floor, walls, it, stubs_gaps=[('A', 150, 190)])


def _register_only():
    def parts(P):
        reg = rbox(P, (0, 0, 3.0), (6, 4.5, 2.8), 0.8)
        scr_ = rbox(P, (0, -3.4, 8.4), (3.6, 0.8, 2.6), 0.3)
        drawer = rbox(P, (0, 5.4, 1.2), (5.2, 1.8, 0.8), 0.3)
        cash = rbox(P, (0, 5.4, 2.2), (4.4, 1.2, 0.4), 0.2)
        return [reg, scr_, drawer, cash]

    def regm(p, n):
        key = (n[:, 1] > 0.5) & (np.mod(p[:, 0] + 10, 2.4) < 1.4) & (np.abs(p[:, 2] - 2.4) < 0.9)
        return np.where(key, RID['gold'], RID['lavlt']), np.where(key, 4.2, 2.4), np.where(key, 0.9, 0.0)
    return Model(parts, [regm, lambda p, n: (np.full(len(p), RID['glass']), np.full(len(p), 3.6), np.full(len(p), 1.0)), solid('lavlt', 2.7), solid('khaki', 2.8)], (-8, 8, -6, 8, 0, 12))


def office():
    W_t, D_t = 9, 7
    W, D = W_t * T, D_t * T
    walls = back_walls(W, D, paper=('lavlt', 3.3), doors=[('B', 180, 202)], windows=[('A', 20, 70), ('A', 90, 140), ('A', 160, 210), ('A', 230, 280), ('B', 30, 80), ('B', 100, 150)])
    floor = lambda i, j: 'carpet_a'
    it = []
    for cx, cy in ((90, 90), (130, 90), (90, 160), (130, 160)):
        pass
    # two rows of two cubicles facing +y
    for k, (cx, cy) in enumerate(((96, 86), (136, 86), (96, 160), (136, 160))):
        it.append((cubicle(), 0, cx, cy, ('box', 17, 9, 18), {}))
        it.append((office_chair(), np.pi / 2, cx - 2, cy + 7, ('blob', 5), {}))
    # filing cabinets along wall B
    fc = scaled(__import__('props2').filing_cabinet(), 1.0)
    for k, y in enumerate((40, 54, 68)):
        flags = {'hl': 'idle', 'prompt': ('E', 'FILE PAPERWORK')} if k == 1 else {}
        it.append((fc, -np.pi / 2, 9, y, ('box', 6, 6, 24), flags))
    it.append((copier(), np.pi / 2, 230, 14, ('box', 8, 7, 16), {}))
    it.append((water_cooler(), 0, 262, 12, ('blob', 5), {}))
    it.append((potted_plant(), 0, 12, 12, ('blob', 6), {}))
    it.append((potted_plant(), 0, 270, 200, ('blob', 6), {}))
    it.append((ch('char/office_worker', 4, 0.0), 0, 22, 54, ('blob', 6), {}))
    it.append((ch('char/civilian_a', 2, 0.6), 0, 200, 120, ('blob', 6), {}))
    return compose_room(W_t, D_t, floor, walls, it, stubs_gaps=[('B', 120, 150)])


def vault():
    W_t, D_t = 7, 6
    W, D = W_t * T, D_t * T
    walls = back_walls(W, D, paper=('stone', 2.4), doors=[('B', 70, 122, 'open')], trim='lavlt')
    floor = lambda i, j: 'marble_a'
    it = []
    it.append((vault_door(), -np.pi / 2, 9, 152, ('box', 6, 24, 40), {}))
    it.append((deposit_wall(8, 8), 0, 70, 6, None, {'hl': 'idle', 'prompt': ('E', 'DRILL BOXES')}))
    it.append((deposit_wall(7, 8), 0, 160, 6, None, {}))
    G_ = __import__('props2')
    it.append((G_.gold_bars(), 0, 120, 100, ('box', 12, 7, 6), {'hl': 'hover', 'valuable': True, 'prompt': ('E', 'GRAB GOLD')}))
    it.append((G_.gold_bars(), 0.3, 150, 120, ('box', 12, 7, 6), {'hl': 'idle', 'valuable': True}))
    it.append((G_.cash_stack(), 0, 186, 82, ('box', 10, 8, 6), {'hl': 'idle', 'valuable': True}))
    it.append((money_cart(), 0, 196, 150, ('box', 10, 6, 12), {}))
    it.append((ch('char/masked_thief', 1, 0.0), 0, 112, 132, ('blob', 6), {}))
    return compose_room(W_t, D_t, floor, walls, it, stubs_gaps=[('A', 90, 140)], bg=(30, 23, 34))


if __name__ == '__main__':
    os.makedirs('out/interiors', exist_ok=True)
    for name, fn in (('apartment', apartment), ('store', store), ('office', office), ('vault', vault)):
        c = fn()
        to_image(c, 1).save(f'out/interiors/interior_{name}_1x.png')
        to_image(c, 3).save(f'out/interiors/interior_{name}.png')
        print(name, c.shape)

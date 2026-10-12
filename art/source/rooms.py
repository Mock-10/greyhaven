"""Interior drafts v2: multi-room buildings, dense decoration, correct facing.

Coordinates: W along x (back wall A at y=0), D along y (back wall B at x=0). Units: 32 = 1 tile, person = 40 tall.
Facing: every model's front is local +y; use decor.face('+x'|'-x'|'+y'|'-y').
Characters: cache angle index 0 = facing +x, 2 = +y, 4 = -x, 6 = -y.
"""
import os, sys, warnings
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
warnings.filterwarnings('ignore')
import numpy as np
from PIL import Image, ImageDraw
from sdf import Model, rbox, solid, RID, RAMP_RGB, hash3, render, highlight, to_image, scaled
import cache, ground2d as G
import decor as D
import decor_shops as DS
import interiors as I
import props2
from scene import prompt, _hull
from pixfont import draw_text, text_width

T = 32
WALL_H = 62
WT = 5
STUB_H = 7
PART_H = 11
F = D.face


# ======================================================================= back walls with decals
def back_walls(W, D_, paper=('lavlt', 3.0), trim='wood', doors=(), windows=(), decals=()):
    H = WALL_H

    def parts(P):
        a = rbox(P, ((W - WT) / 2, -WT / 2, H / 2), ((W + WT) / 2, WT / 2, H / 2), 0.3)
        b = rbox(P, (-WT / 2, (D_ - WT) / 2, H / 2), (WT / 2, (D_ + WT) / 2, H / 2), 0.3)
        d = np.minimum(a, b)
        for dd in doors:
            w, s0, s1 = dd[:3]
            if w == 'A':
                d = np.maximum(d, -rbox(P, ((s0 + s1) / 2, -WT / 2, 23), ((s1 - s0) / 2, WT, 23), 0.2))
            else:
                d = np.maximum(d, -rbox(P, (-WT / 2, (s0 + s1) / 2, 23), (WT, (s1 - s0) / 2, 23), 0.2))
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
        on_ = {'A': innerA, 'B': innerB}
        ramp = np.full(N, RID[paper[0]]); base = np.full(N, float(paper[1]))
        stripe = inner & (np.mod(u, 6.0) < 1.2)
        base = np.where(stripe, base + 0.35, base)
        bb = inner & (z < 3.5)
        ramp = np.where(bb, RID[trim], ramp); base = np.where(bb, 2.0, base)
        cr = inner & (z > WALL_H - 2.5)
        ramp = np.where(cr, RID['white'], ramp); base = np.where(cr, 3.5, base)

        def put(mask, r, b):
            nonlocal ramp, base
            ramp = np.where(mask, RID[r] if isinstance(r, str) else r, ramp)
            base = np.where(mask, b, base)

        for (w, s0, s1) in windows:
            on = on_[w]
            win = on & (u > s0) & (u < s1) & (z > 18) & (z < 46)
            frame = on & (u > s0 - 1.5) & (u < s1 + 1.5) & (z > 16.5) & (z < 47.5) & ~win
            mull = win & (np.abs(u - (s0 + s1) / 2) < 0.7)
            put(frame | mull, 'white', 3.6)
            g = win & ~mull
            skyline = hash3(np.floor(u / 5.0), 1, 1, 7) * 10 + 22
            bld = g & (z < skyline)
            put(g, 'glass', 2.4 + (z - 18) * 0.06)
            put(bld, 'blueg', 1.6 + (np.mod(u, 4.0) < 1.0) * 0.8)
            sill = on & (u > s0 - 2.5) & (u < s1 + 2.5) & (z > 15) & (z < 16.6)
            put(sill, 'white', 4.0)

        for dc in decals:
            kind, w = dc[0], dc[1]
            on = on_[w]
            if kind == 'painting':
                _, _, c, zc, pw, ph, style = dc
                fr = on & (np.abs(u - c) < pw / 2 + 1.2) & (np.abs(z - zc) < ph / 2 + 1.2)
                art = on & (np.abs(u - c) < pw / 2) & (np.abs(z - zc) < ph / 2)
                put(fr, 'gold' if style in ('portrait', 'sea') else 'wood', 2.6 if style in ('portrait', 'sea') else 1.7)
                lu = (u - c) / (pw / 2); lz = (z - zc) / (ph / 2)
                if style == 'landscape':
                    hill = lz < -0.1 + 0.25 * np.sin(lu * 3.0 + 1)
                    hill2 = lz < -0.45 + 0.2 * np.sin(lu * 5.0)
                    sun = (lu - 0.45) ** 2 + (lz - 0.35) ** 2 < 0.05
                    put(art, 'glass', 3.6 + lz * 0.6)
                    put(art & hill, 'sage', 2.6); put(art & hill2, 'khaki', 2.4); put(art & sun, 'gold', 4.4)
                elif style == 'sea':
                    wave = lz < -0.1 + 0.12 * np.sin(lu * 9)
                    put(art, 'stone', 4.0 + lz * 0.4); put(art & wave, 'teal', 2.6 + lz); put(art & (np.abs(lu + 0.3) < 0.08) & (lz > -0.1) & (lz < 0.5), 'white', 4.2)
                elif style == 'portrait':
                    put(art, 'night', 2.2)
                    face_ = ((lu / 0.35) ** 2 + ((lz - 0.15) / 0.45) ** 2) < 1
                    body = (np.abs(lu) < 0.6 - lz * 0.2) & (lz < -0.35)
                    put(art & body, 'brick', 2.2); put(art & face_, 'skin', 3.2)
                else:   # abstract
                    put(art, 'white', 4.2)
                    put(art & (lu < -0.2) & (lz > -0.2), 'red', 3.0)
                    put(art & (lu > 0.1) & (lz < 0.1), 'navy', 2.6)
                    put(art & (np.abs(lu - 0.25) < 0.25) & (lz > 0.35), 'gold', 3.8)
                    put(art & (np.abs(lz + 0.15) < 0.06), 'night', 1.6)
            elif kind == 'clock':
                _, _, c, zc, r = dc
                d = np.sqrt((u - c) ** 2 + (z - zc) ** 2)
                put(on & (d < r + 0.8), 'night', 2.0)
                put(on & (d < r), 'white', 4.4)
                hand = on & (d < r * 0.8) & ((np.abs(u - c) < 0.45) & (z > zc) | (np.abs(z - zc) < 0.45) & (u > c))
                put(hand, 'night', 1.4)
            elif kind == 'poster':
                _, _, c, zc, pw, ph, r = dc
                po = on & (np.abs(u - c) < pw / 2) & (np.abs(z - zc) < ph / 2)
                put(po, r, 3.0)
                put(po & (np.abs(z - (zc + ph * 0.2)) < 1.0), 'white', 4.4)
                put(po & (np.abs(z - (zc - ph * 0.15)) < 0.5) & (np.abs(u - c) < pw * 0.35), 'white', 4.0)
                put(po & (z > zc + ph * 0.35), 'gold' if r != 'gold' else 'red', 3.6)
            elif kind == 'exit':
                _, _, c, zc = dc
                sg = on & (np.abs(u - c) < 4.5) & (np.abs(z - zc) < 1.8)
                put(sg, 'sage', 3.6)
                put(sg & (np.abs(z - zc) < 0.7) & (np.mod(u - c + 10, 1.8) < 1.1) & (np.abs(u - c) < 3.4), 'white', 5.0)
            elif kind == 'fusebox':
                _, _, c, zc = dc
                put(on & (np.abs(u - c) < 4) & (np.abs(z - zc) < 5), 'lavlt', 2.6)
                put(on & (np.abs(u - c) < 3) & (np.abs(z - zc - 1) < 2.6) & (np.mod(u, 1.4) < 0.7), 'night', 1.6)
                put(on & (np.abs(u - c - 2) < 0.8) & (np.abs(z - zc + 3) < 0.8), 'gold', 4.0)
            elif kind == 'calendar':
                _, _, c, zc = dc
                cal = on & (np.abs(u - c) < 4) & (np.abs(z - zc) < 5)
                put(cal, 'white', 4.3)
                put(cal & (z > zc + 2.6), 'red', 3.0)
                put(cal & (z < zc + 1.5) & (np.mod(u, 1.6) < 0.5) & (np.mod(z, 1.6) < 0.5), 'night', 2.4)
            elif kind == 'curtains':
                _, _, s0, s1, r = dc
                cu = on & (((u > s0 - 6) & (u < s0 - 1.5)) | ((u > s1 + 1.5) & (u < s1 + 6))) & (z > 12) & (z < 50)
                fold = np.mod(u, 2.0) < 0.8
                put(cu, r, 2.6 + fold * 0.6)
                put(on & (u > s0 - 7) & (u < s1 + 7) & (np.abs(z - 50.5) < 0.8), 'night', 2.0)
            elif kind == 'tiles':
                _, _, u0, u1, z0, z1 = dc
                t_ = on & (u > u0) & (u < u1) & (z > z0) & (z < z1)
                put(t_, 'white', 3.6 - ((np.mod(u, 4.0) < 0.5) | (np.mod(z, 4.0) < 0.5)) * 0.9)
            elif kind == 'logo':
                _, _, c, zc, pw = dc
                lg = on & (np.abs(u - c) < pw / 2) & (np.abs(z - zc) < 4)
                put(lg, 'night', 2.2)
                put(lg & (np.abs(z - zc) < 1.4) & (np.abs(u - c) < pw / 2 - 2), 'gold', 4.2)
                put(on & (np.abs(u - c + pw / 2 - 3) < 1.8) & (np.abs(z - zc) < 2.6), 'gold', 3.6)
            elif kind == 'warning':
                _, _, c, zc = dc
                sg = on & (np.abs(u - c) < 5) & (np.abs(z - zc) < 3.5)
                put(sg, 'gold', 3.6)
                put(sg & (np.abs(u - c) < 0.6) & (z > zc - 1.5), 'night', 1.6)
            elif kind == 'mirror':
                _, _, c, zc, pw, ph = dc
                put(on & (np.abs(u - c) < pw / 2 + 1) & (np.abs(z - zc) < ph / 2 + 1), 'gold', 2.8)
                put(on & (np.abs(u - c) < pw / 2) & (np.abs(z - zc) < ph / 2), 'glass', 4.0 + (np.mod(u + z, 7) < 1.2) * 0.8)

        put(top, 'night', 2.6)
        outer = ~inner & ~top
        put(outer, 'lav', 2.6)
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

    return Model(parts, [wall_mat, door_mat], (-WT - 1, W + 1, -WT - 1, D_ + 1, 0, WALL_H + 1))


# ======================================================================= internal partition walls (cut down)
def partition_segments(axis, pos, a0, a1, gaps=(), paper=('lavlt', 3.0), seg=16, h=PART_H):
    """Wall along `axis` ('x' = runs along x at y=pos; 'y' = runs along y at x=pos), cut down to h.
    Returns list of (model, sort_x, sort_y) segments with doorway gaps removed."""
    out = []
    a = a0
    while a < a1 - 0.01:
        b = min(a + seg, a1)
        # trim against gaps
        pieces = [(a, b)]
        for (g0, g1) in gaps:
            nxt = []
            for (s0, s1) in pieces:
                if g1 <= s0 or g0 >= s1:
                    nxt.append((s0, s1))
                else:
                    if g0 > s0:
                        nxt.append((s0, g0))
                    if g1 < s1:
                        nxt.append((g1, s1))
            pieces = nxt
        for (s0, s1) in pieces:
            if s1 - s0 < 0.5:
                continue
            c = (s0 + s1) / 2; hl = (s1 - s0) / 2
            if axis == 'x':
                fn = (lambda c=c, hl=hl: (lambda P: [rbox(P, (c, pos, h / 2), (hl + 0.6, WT / 2, h / 2), 0.05)]))()
                bbox = (s0 - 1, s1 + 1, pos - WT, pos + WT, 0, h + 1)
                sx, sy = c, pos
            else:
                fn = (lambda c=c, hl=hl: (lambda P: [rbox(P, (pos, c, h / 2), (WT / 2, hl + 0.6, h / 2), 0.05)]))()
                bbox = (pos - WT, pos + WT, s0 - 1, s1 + 1, 0, h + 1)
                sx, sy = pos, c

            def mat(p, n, paper=paper):
                top = n[:, 2] > 0.6
                bb = p[:, 2] < 3.0
                r = np.where(top, RID['night'], np.where(bb, RID['wood'], RID[paper[0]]))
                b = np.where(top, 2.6, np.where(bb, 2.0, paper[1] - 0.3))
                return r, b, np.zeros(len(p))
            out.append((Model(fn, [mat], bbox), sx, sy))
        a = b
    return out


def front_stubs(W, D_, paper=('lavlt', 3.0), gaps=()):
    return I.front_stubs(W, D_, paper=paper, gaps=gaps)


# ======================================================================= composer
def compose(W_t, D_t, floor, walls, items, partitions=(), stub_gaps=(), markers=(), legend=None, title=None, pad=24, bg=(36, 28, 40), sight=None):
    W, D_ = W_t * T, D_t * T
    MX = D_ + pad + 8
    MY = WALL_H + pad + 10
    Wc = W + D_ + 2 * pad + 16
    Hc = (W + D_) // 2 + WALL_H + 2 * pad + 30
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

    tcache = {}
    for s in range(W_t + D_t):
        for i in range(W_t):
            j = s - i
            if 0 <= j < D_t:
                k = floor(i, j) if callable(floor) else floor
                key = (k, (i * 7 + j * 3) % 5)
                if key not in tcache:
                    tcache[key] = G.make_tile(k, key[1], rim_line=False)[0]
                x, y = scr(i * T, j * T)
                blit(tcache[key], x - 32, y)
    wimg, wox, woy = render(walls)
    x, y = scr(0, 0)
    blit(wimg, x - wox, y - woy)
    import sight as SG
    from sdf import BAYER
    sstate = None
    if sight is not None:
        sstate = SG.compute(W, D_, partitions, sight['viewer'], sight.get('closed', ()), sight.get('remembered', ()))
        slab = SG.labels(W, D_, partitions)
        room_unseen = {r: bool((sstate[slab == r] == SG.HID).all()) for r in np.unique(slab)}
        vmask_img = Image.new('L', (Wc, Hc), 0); vd = ImageDraw.Draw(vmask_img)
        Cc = SG.CELL
        for (i, j) in zip(*np.nonzero(sstate == SG.VIS)):
            vd.polygon([scr(i * Cc, j * Cc), scr((i + 1) * Cc, j * Cc), scr((i + 1) * Cc, (j + 1) * Cc), scr(i * Cc, (j + 1) * Cc)], fill=255)
        VISMASK = np.array(vmask_img) > 0

        def hides_visible(pts):
            im = Image.new('L', (Wc, Hc), 0); ImageDraw.Draw(im).polygon(pts, fill=255)
            return bool((np.array(im)[VISMASK] > 0).any())
        lidA = np.array([30, 23, 34], float); lidB = np.array([44, 34, 50], float)
        dim_m = np.array([0.52, 0.5, 0.62])
        C = SG.CELL

        def poly_mask(pts):
            im = Image.new('L', (Wc, Hc), 0); ImageDraw.Draw(im).polygon(pts, fill=255)
            return np.array(im) > 0
        # back walls over unseen / remembered cells
        nxC, nyC = sstate.shape
        for i in range(nxC):
            st = sstate[i, 0]
            if st != SG.VIS:
                m = poly_mask([scr(i * C, 0, 0), scr((i + 1) * C, 0, 0), scr((i + 1) * C, 0, WALL_H + 0.5), scr(i * C, 0, WALL_H + 0.5)])
                m &= canvas[..., 3] > 0
                if st == SG.HID:
                    canvas[m, :3] = (canvas[m, :3] * 0.18 + lidB * 0.82).astype(np.uint8)
                else:
                    canvas[m, :3] = (canvas[m, :3] * dim_m).astype(np.uint8)
        for j in range(nyC):
            st = sstate[0, j]
            if st != SG.VIS:
                m = poly_mask([scr(0, j * C, 0), scr(0, (j + 1) * C, 0), scr(0, (j + 1) * C, WALL_H + 0.5), scr(0, j * C, WALL_H + 0.5)])
                if st == SG.HID:
                    canvas[m, :3] = (canvas[m, :3] * 0.18 + lidB * 0.82).astype(np.uint8)
                else:
                    canvas[m, :3] = (canvas[m, :3] * dim_m).astype(np.uint8)
        # remembered floor dimmed
        for i in range(nxC):
            for j in range(nyC):
                if sstate[i, j] == SG.MEM:
                    m = poly_mask([scr(i * C, j * C), scr((i + 1) * C, j * C), scr((i + 1) * C, (j + 1) * C), scr(i * C, (j + 1) * C)])
                    canvas[m, :3] = (canvas[m, :3] * dim_m).astype(np.uint8)
    # shadows
    sh = Image.new('L', (Wc, Hc), 0); d = ImageDraw.Draw(sh)
    for it in items:
        shd = it[4]
        if shd is None:
            continue
        wx, wy = it[2], it[3]
        if shd[0] == 'box':
            _, hx, hy, hgt = shd
            dx, dy = -0.28 * hgt * 0.6, -0.74 * hgt * 0.6
            corners = [(wx + sx * hx, wy + sy * hy) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
            pts = corners + [(cx + dx, cy + dy) for cx, cy in corners]
            d.polygon(_hull([scr(px, py) for px, py in pts]), fill=110)
        else:
            r = shd[1]; xx, yy = scr(wx - 1, wy - 2)
            d.ellipse([xx - r * 1.15, yy - r * 0.55, xx + r * 1.15, yy + r * 0.55], fill=140)
    for t in range(0, 7):
        d.line([scr(0, t), scr(W, t)], fill=int(90 * (1 - t / 7)))
        d.line([scr(t, 0), scr(t, D_)], fill=int(90 * (1 - t / 7)))
    for (axis, pos, a0, a1, gaps) in partitions:
        for t in range(1, 5):
            f = int(60 * (1 - t / 5))
            if axis == 'x':
                d.line([scr(a0, pos + WT / 2 + t), scr(a1, pos + WT / 2 + t)], fill=f)
            else:
                d.line([scr(pos + WT / 2 + t, a0), scr(pos + WT / 2 + t, a1)], fill=f)
    sha = (np.array(sh).astype(float) / 255.0 * 0.45)[..., None]
    canvas[..., :3] = (canvas[..., :3] * (1 - sha) + np.array([42, 30, 52]) * sha).astype(np.uint8)
    # objects + partition segments sorted together
    draw = []
    for it in items:
        src, ang, wx, wy, shd, fl = it
        if sstate is not None:
            stv = SG.cell_state(sstate, wx, wy)
            live = isinstance(src, tuple) or fl.get('valuable') or fl.get('live')
            if stv == SG.HID or (stv == SG.MEM and live):
                continue
            if stv == SG.MEM:
                fl = dict(fl); fl['dim'] = True
                fl.pop('hl', None); fl.pop('prompt', None)
                it = (src, ang, wx, wy, shd, fl)
        draw.append((wx + wy + fl.get('z_bias', 0), 'item', it))
    if sstate is not None:
        nxC, nyC = sstate.shape
        for i in range(nxC):
            for j in range(nyC):
                if sstate[i, j] == SG.HID:
                    C = SG.CELL
                    zl = PART_H + 0.6; kind_ = 'lid'
                    edge = any(0 <= i + di < nxC and 0 <= j + dj < nyC and sstate[i + di, j + dj] != SG.HID for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                    key = (i + 0.5) * C + (j + 0.5) * C + 1
                    draw.append((key, 'lid', (i, j, edge, zl, kind_)))
    for (axis, pos, a0, a1, gaps) in partitions:
        for (m, sx, sy) in partition_segments(axis, pos, a0, a1, gaps):
            if sstate is not None:
                if axis == 'x':
                    sides = (SG.cell_state(sstate, sx, pos - 4), SG.cell_state(sstate, sx, pos + 4))
                else:
                    sides = (SG.cell_state(sstate, pos - 4, sy), SG.cell_state(sstate, pos + 4, sy))
                if sides[0] == SG.HID and sides[1] == SG.HID:
                    continue
            draw.append((sx + sy - 2, 'wall', (m, sx, sy)))
    draw.sort(key=lambda t: t[0])
    prompts = []
    rcache = {}
    for _, kind, obj in draw:
        if kind == 'lid':
            i, j, edge, zl, kind_ = obj
            C = SG.CELL
            pts = [scr(i * C, j * C, zl), scr((i + 1) * C, j * C, zl), scr((i + 1) * C, (j + 1) * C, zl), scr(i * C, (j + 1) * C, zl)]
            xs_ = [int(round(p[0])) for p in pts]; ys_ = [int(round(p[1])) for p in pts]
            x0_, x1_, y0_, y1_ = min(xs_), max(xs_) + 1, min(ys_), max(ys_) + 1
            x1_ += 1; y1_ += 1
            im = Image.new('L', (x1_ - x0_ + 1, y1_ - y0_ + 1), 0)
            ImageDraw.Draw(im).polygon([(px_ - x0_, py_ - y0_) for px_, py_ in zip(xs_, ys_)], fill=255, outline=255)
            m = np.array(im) > 0
            yy, xx = np.nonzero(m)
            Y = yy + y0_; X = xx + x0_
            ok = (Y >= 0) & (Y < Hc) & (X >= 0) & (X < Wc)
            Y, X = Y[ok], X[ok]
            thr = BAYER[Y % 4, X % 4]
            colA = lidB if edge else lidA
            colB = lidB * 1.25 if edge else lidB
            pick = (thr > (0.55 if edge else 0.8))[:, None]
            canvas[Y, X, :3] = np.where(pick, colB, colA).astype(np.uint8)
            continue
        if kind == 'wall':
            m, sx, sy = obj
            img, ox, oy = render(m, outline=False)
            x, y = scr(0, 0)
            blit(img, x - ox, y - oy)
            continue
        src, ang, wx, wy, shd, fl = obj
        if isinstance(src, tuple):
            img, ox, oy = src
        else:
            key = (id(src), ang)
            img, ox, oy = render(src, ang=ang)
        if 'hl' in fl:
            img, P = highlight(img, fl['hl'], fl.get('valuable', False), frame=1)
            ox += P; oy += P
        if fl.get('dim'):
            img = img.copy(); img[..., :3] = (img[..., :3] * np.array([0.52, 0.5, 0.62])).astype(np.uint8)
        x, y = scr(wx, wy, fl.get('wz', 0.0))
        blit(img, x - ox, y - oy)
        if 'prompt' in fl:
            top = np.nonzero(img[..., 3].any(1))[0][0]
            prompts.append((x - ox + img.shape[1] / 2, y - oy + top - 3, fl['prompt']))
    simg, sox, soy = render(front_stubs(W, D_, gaps=stub_gaps))
    x, y = scr(0, 0)
    blit(simg, x - sox, y - soy)
    for px_, py_, (kk, lab) in prompts:
        pimg = prompt(kk, lab)
        blit(pimg, px_ - pimg.shape[1] / 2, py_ - pimg.shape[0])
    # numbered markers
    gold = tuple(int(c) for c in RAMP_RGB[RID['gold'], 4]); ink = (36, 27, 40)
    for (num, wx, wy, wz) in markers:
        cx, cy = scr(wx, wy, wz)
        cx, cy = int(cx), int(cy)
        rr = 6
        yy, xx = np.mgrid[-rr - 1:rr + 2, -rr - 1:rr + 2]
        dd = np.sqrt(xx ** 2 + yy ** 2)
        for j in range(yy.shape[0]):
            for i in range(yy.shape[1]):
                X, Y = cx + xx[j, i], cy + yy[j, i]
                if 0 <= X < Wc and 0 <= Y < Hc:
                    if dd[j, i] <= rr - 0.5:
                        canvas[Y, X, :3] = gold
                    elif dd[j, i] <= rr + 0.8:
                        canvas[Y, X, :3] = ink
        s = str(num)
        draw_text(canvas, cx - text_width(s) // 2, cy - 2, s, ink)
    diff = np.abs(canvas[..., :3].astype(int) - np.array(bg)).sum(-1) > 6
    ys, xs = np.nonzero(diff)
    c = canvas[max(0, ys.min() - 12):ys.max() + 12, max(0, xs.min() - 12):xs.max() + 12].copy()
    if legend:
        lw = max(max(text_width(t) for t in legend[1:]) + 30, text_width(legend[0]) * 2 + 10)
        lh = 14 + len(legend) * 10
        L = np.zeros((max(lh + 20, c.shape[0]), c.shape[1] + lw + 12, 4), np.uint8); L[...] = (*bg, 255)
        L[:c.shape[0], :c.shape[1]] = c
        lx = c.shape[1] + 2; ly = 16
        draw_text(L, lx, ly, legend[0], gold, ink, scale=2); ly += 16
        for t in legend[1:]:
            col = (220, 140, 128) if t.startswith('!') else (238, 233, 232)
            if t[:1].isdigit():
                n = t.split(' ')[0]
                yy, xx = np.mgrid[-5:6, -5:6]
                m = (xx ** 2 + yy ** 2) <= 25
                for j in range(11):
                    for i in range(11):
                        if m[j, i]:
                            L[ly + 2 + j - 5 + 2, lx + 5 + i - 5, :3] = gold
                draw_text(L, lx + 5 - text_width(n) // 2, ly + 2, n, ink)
                draw_text(L, lx + 14, ly + 2, t[len(n) + 1:], col)
            else:
                draw_text(L, lx, ly + 2, t.lstrip('!'), col)
            ly += 10
        c = L
    return c


def ch(key, idx, walk=0.0):
    return cache.get(key, idx, walk)


def it(model, facing, wx, wy, shadow=None, **fl):
    ang = F(facing) if isinstance(facing, str) else facing
    return (model, ang, wx, wy, shadow, fl)


# ======================================================================= ROOM 1: starter apartment
def apartment():
    W_t, D_t = 7, 6
    W, D_ = W_t * T, D_t * T
    walls = back_walls(W, D_, paper=('stone', 2.7), doors=[('B', 150, 172)], windows=[('A', 16, 52)],
                       decals=[('curtains', 'A', 16, 52, 'teal'),
                               ('painting', 'B', 108, 42, 30, 14, 'landscape'),
                               ('painting', 'A', 118, 36, 14, 18, 'abstract'),
                               ('tiles', 'A', 128, 190, 21, 34),
                               ('clock', 'A', 212, 46, 3.6),
                               ('mirror', 'B', 136, 34, 8, 16),
                               ('calendar', 'B', 66, 40)])
    floor = lambda i, j: 'woodfloor_x'
    S = []
    # bedroom corner: bed head against wall B
    S.append(it(I.bed(), 0.0, 36, 34, ('box', 24, 16, 12), hl='idle', prompt=('E', 'SLEEP / SAVE')))
    S.append(it(I.nightstand(), '+x', 9, 62, ('box', 5, 5, 12)))
    S.append(it(D.rug(30, 14, ('teal', 2.2), 'stone'), '+y', 38, 62, None, z_bias=-300))
    S.append(it(D.wall_shelf(), '+y', 66, 0))
    S.append(it(I.wardrobe(), '+y', 88, 9, ('box', 11, 7, 30), hl='idle', prompt=('E', 'CHANGE OUTFIT')))
    S.append(it(D.laundry_basket(), '+y', 108, 14, ('blob', 4)))
    S.append(it(D.radiator(), '+y', 118, 0))
    # kitchen along wall A
    S.append(it(I.kitchen_run(62), '+y', 128, 9))
    S.append(it(D.dish_rack(), '+y', 141, 10, None, wz=20.6, z_bias=2))
    S.append(it(D.kitchen_items(), '+y', 160, 10, None, wz=20.6, z_bias=2))
    S.append(it(I.fridge(), '+y', 206, 10, ('box', 7, 7, 30)))
    S.append(it(D.trash_bin(), '+y', 214, 28, ('blob', 3)))
    # dining: chairs face the table
    S.append(it(I.table_chairs(), '+y', 168, 66, ('box', 11, 8, 10)))
    S.append(it(D.bowl_fruit(), '+y', 165, 64, None, wz=16.8, z_bias=4))
    S.append(it(D.vase_flowers('gold'), '+y', 172, 69, None, wz=16.8, z_bias=5))
    # living room: TV against wall B facing +x, sofa facing -x toward it
    S.append(it(D.rug(36, 46, ('brick', 2.2)), '+y', 52, 112, None, z_bias=-300))
    S.append(it(D.tv_stand(), '+x', 9, 112, ('box', 5, 15, 12)))
    S.append(it(D.coffee_table(), '+x', 52, 112, ('box', 6, 10, 8)))
    S.append(it(D.sofa(('plum', 2.5)), '-x', 96, 112, ('box', 9, 22, 12)))
    S.append(it(D.armchair(('teal', 2.4)), '-y', 50, 156, ('box', 8, 8, 12)))
    S.append(it(D.side_table(), '-x', 98, 144, ('blob', 4)))
    S.append(it(D.floor_lamp(), '+y', 98, 80, ('blob', 3)))
    S.append(it(D.plant_tall(1), '+y', 10, 80, ('blob', 6)))
    S.append(it(D.plant_snake(), '+y', 212, 178, ('blob', 4)))
    S.append(it(D.plant_tall(9), '+y', 132, 182, ('blob', 6)))
    S.append(it(D.coat_rack(), '+y', 10, 184, ('blob', 3)))
    S.append(it(D.entrance_mat(), '+y', 161, 184, None, z_bias=-300))
    S.append(it(I.floor_stash(), '+y', 190, 128, None, hl='idle', valuable=True, prompt=('E', 'STASH'), z_bias=-300))
    S.append(it(ch('char/office_worker', 2, 0.0), 0, 132, 98, ('blob', 6)))
    return compose(W_t, D_t, floor, walls, S, stub_gaps=[('A', 150, 172)])


# ======================================================================= ROOM 2: corner store with back room + security room
def store():
    W_t, D_t = 8, 7
    W, D_ = W_t * T, D_t * T
    walls = back_walls(W, D_, paper=('white', 2.6),
                       decals=[('fusebox', 'A', 102, 34), ('calendar', 'A', 30, 38), ('poster', 'A', 150, 46, 10, 12, 'navy'),
                               ('clock', 'A', 126, 48, 3.2), ('warning', 'A', 98, 50),
                               ('poster', 'A', 212, 50, 22, 8, 'red'),
                               ('poster', 'B', 104, 40, 14, 18, 'gold'), ('poster', 'B', 150, 40, 14, 18, 'sage'),
                               ('exit', 'B', 206, 54), ('clock', 'B', 182, 48, 3.4)])
    floor = lambda i, j: ('concrete_a' if (j < 2 and i < 5) else 'linoleum_a')
    parts_ = [('x', 72, 0, 176, [(70, 92), (130, 152)]), ('y', 112, 0, 72, []), ('y', 176, 0, 72, [])]
    S = []
    # --- back room (locked): stock + safe + ledger desk
    S.append(it(D.storage_shelf(2), '+y', 56, 8, ('box', 15, 6, 30)))
    S.append(it(props2.safe(), '+x', 14, 22, ('box', 9, 9, 18), hl='idle', prompt=('E', 'CRACK SAFE')))
    S.append(it(D.cardboard_boxes(3, 1), '+y', 96, 16, ('box', 7, 6, 14)))
    S.append(it(D.cardboard_boxes(2, 4), '+y', 98, 44, ('box', 7, 6, 10)))
    S.append(it(D.ledger_desk(), '-y', 56, 54, ('box', 10, 6, 12)))
    S.append(it(D.wooden_chair(), '-y', 56, 66, ('blob', 4)))
    S.append(it(D.mop_bucket(), '+y', 82, 62, ('blob', 4)))
    S.append(it(D.broom(), '+x', 0, 50))
    S.append(it(D.door_leaf(True, ('night', 2.2)), '+y', 81, 72, None, hl='idle', prompt=('E', 'LOCKPICK DOOR'), z_bias=3))
    # --- security room: cameras + DVR
    S.append(it(D.server_rack(), '+y', 121, 10, ('box', 6, 7, 30)))
    S.append(it(D.cctv_desk(), '+y', 152, 9, ('box', 18, 7, 16), hl='hover', prompt=('E', 'DISABLE CAMERAS')))
    S.append(it(D.office_chair(), '-y', 150, 30, ('blob', 5)))
    S.append(it(D.coffee_machine(), '+y', 165, 8, None, wz=17.3, z_bias=3))
    S.append(it(D.dvr_rack(), '-x', 168, 52, ('box', 6, 6, 14), hl='idle', prompt=('E', 'WIPE FOOTAGE')))
    S.append(it(D.trash_bin(), '+y', 124, 60, ('blob', 3)))
    # --- shop floor
    S.append(it(I.drinks_fridge(4), '+y', 208, 9, ('box', 24, 7, 30)))
    S.append(it(D.plant_tall(4), '+y', 246, 12, ('blob', 6)))
    S.append(it(I.shelf_unit(56, 2), '+y', 84, 116, ('box', 28, 5, 24)))
    S.append(it(I.shelf_unit(56, 5), '+y', 84, 158, ('box', 28, 5, 24)))
    S.append(it(D.news_rack(), '+x', 10, 104, ('box', 5, 7, 18)))
    S.append(it(scaled(props2.atm(), 1.0), '+x', 10, 136, ('box', 7, 7, 30)))
    S.append(it(D.fire_extinguisher(), '+x', 0, 168))
    S.append(it(D.chest_freezer(), '+x', 18, 196, ('box', 7, 14, 10)))
    S.append(it(D.chest_freezer(), '+y', 150, 104, ('box', 14, 7, 10)))
    S.append(it(I.counter_run(64), '-x', 216, 150, ('box', 6, 32, 14)))
    S.append(it(I.render(scaled(I._register_only(), 1.35), ang=np.pi / 2) if False else scaled(I._register_only(), 1.35), '-x', 214, 136, None,
                hl='hover', prompt=('E', 'ROB REGISTER'), wz=20.5, z_bias=30))
    S.append(it(D.vase_flowers('red'), '-x', 214, 176, None, wz=20.5, z_bias=31))
    S.append(it(D.coffee_machine(), '+x', 248, 108, None, z_bias=0) if False else it(D.trash_bin('teal'), '+y', 186, 212, ('blob', 3)))
    S.append(it(D.entrance_mat(), '+y', 170, 212, None, z_bias=-300))
    S.append(it(D.plant_snake(), '+y', 246, 212, ('blob', 4)))
    S.append(it(I.wall_camera(), '+y', 236, 8))
    S.append(it(ch('char/civilian_b', 4, 0.0), 0, 240, 150, ('blob', 6), z_bias=40))
    S.append(it(ch('char/masked_thief', 0, 0.0), 0, 194, 150, ('blob', 6)))
    S.append(it(ch('char/civilian_a', 6, 0.6), 0, 120, 186, ('blob', 6)))
    return compose(W_t, D_t, floor, walls, S, partitions=parts_, stub_gaps=[('A', 150, 190)])


# ======================================================================= ROOM 3: office floor
def office():
    W_t, D_t = 9, 7
    W, D_ = W_t * T, D_t * T
    walls = back_walls(W, D_, paper=('lavlt', 3.3), doors=[('B', 192, 214)],
                       windows=[('A', 22, 68), ('A', 92, 138), ('A', 162, 208), ('B', 20, 70)],
                       decals=[('clock', 'A', 216, 52, 3.6), ('whiteboard_dummy', 'B', 0, 0) if False else ('painting', 'A', 80, 54, 10, 6, 'abstract'),
                               ('exit', 'B', 203, 54), ('poster', 'A', 270, 48, 12, 12, 'teal'), ('painting', 'B', 168, 38, 22, 14, 'sea')])
    floor = lambda i, j: 'carpet_a'
    S = []
    S.append(it(D.plant_tall(2), '+y', 10, 10, ('blob', 6)))
    fc = props2.filing_cabinet()
    for k, y in enumerate((80, 94, 108)):
        fl = dict(hl='idle', prompt=('E', 'FILE PAPERWORK')) if k == 1 else {}
        S.append(it(fc, '+x', 8, y, ('box', 6, 6, 24), **fl))
    S.append(it(D.whiteboard(), '+x', 0, 140))
    S.append(it(D.bookshelf(5), '+x', 6, 176, ('box', 5, 11, 30)))
    # cubicles (open side +y); chairs face -y toward the monitors
    for k, (cx, cy) in enumerate(((86, 70), (126, 70), (86, 140), (126, 140))):
        S.append(it(I.cubicle(), '+y', cx, cy, ('box', 17, 9, 18)))
        S.append(it(D.office_chair(), '-y', cx - 2, cy + 7, ('blob', 5)))
        S.append(it(D.desk_clutter(k), '+y', cx + 2, cy - 3, None, wz=17.3, z_bias=3))
        S.append(it(D.plant_small(k), '+y', cx - 13, cy - 8, None, wz=17.3, z_bias=3))
        S.append(it(D.trash_bin(), '+y', cx + 14, cy + 8, ('blob', 3)))
    # manager area: desk faces +y (visitor side); manager chair behind facing +y; visitors face -y
    S.append(it(D.rug(54, 40, ('navy', 2.2), 'stone'), '+y', 220, 160, None, z_bias=-300))
    S.append(it(D.exec_desk(), '+y', 220, 150, ('box', 16, 8, 14)))
    S.append(it(D.office_chair(), '+y', 220, 136, ('blob', 5)))
    S.append(it(D.wooden_chair(), '-y', 210, 168, ('blob', 4)))
    S.append(it(D.wooden_chair(), '-y', 230, 168, ('blob', 4)))
    S.append(it(D.vase_tall(), '+y', 232, 147, None, wz=18, z_bias=3))
    S.append(it(D.plant_tall(6), '+y', 196, 96, ('blob', 6)))
    # break corner along wall A
    S.append(it(I.copier(), '+y', 222, 12, ('box', 8, 7, 16)))
    S.append(it(D.vending_machine('soda'), '+y', 246, 10, ('box', 8, 7, 30)))
    S.append(it(I.water_cooler(), '+y', 266, 11, ('blob', 5)))
    S.append(it(D.side_table(False), '+y', 280, 40, ('blob', 4)))
    S.append(it(D.coffee_machine(), '+y', 280, 39, None, wz=12.1, z_bias=2))
    S.append(it(D.armchair(('sage', 2.3)), '-y', 262, 66, ('box', 8, 8, 12)))
    S.append(it(D.armchair(('sage', 2.3)), '-x', 274, 92, ('box', 8, 8, 12)))
    S.append(it(D.ficus_tree(), '+y', 132, 206, ('blob', 10)))
    S.append(it(D.plant_snake(), '+y', 276, 206, ('blob', 4)))
    S.append(it(D.coat_rack(), '+y', 186, 200, ('blob', 3)))
    S.append(it(D.corkboard(), '+y', 150, 0))
    S.append(it(ch('char/office_worker', 4, 0.0), 0, 22, 94, ('blob', 6)))
    S.append(it(ch('char/civilian_a', 2, 0.6), 0, 170, 110, ('blob', 6)))
    return compose(W_t, D_t, floor, walls, S, stub_gaps=[('B', 120, 150)])


# ======================================================================= ROOM 4: bank heist (multi-room)
def bank(sight=None, vault_open=False, markers_on=True, legend_override=None, viewer_char=None):
    W_t, D_t = 12, 10
    W, D_ = W_t * T, D_t * T
    walls = back_walls(W, D_, paper=('stone', 2.6), trim='wood',
                       decals=[('painting', 'A', 256, 38, 20, 14, 'portrait'), ('alarm_dummy', 'A', 0, 0) if False else ('fusebox', 'A', 140, 40),
                               ('logo', 'A', 340, 42, 50), ('clock', 'A', 372, 48, 3.6), ('warning', 'B', 140, 46), ('warning', 'A', 110, 48),
                               ('painting', 'B', 220, 38, 26, 14, 'landscape'), ('painting', 'B', 272, 38, 20, 16, 'sea'),
                               ('poster', 'A', 230, 40, 8, 10, 'navy'), ('calendar', 'A', 290, 40)])
    def floor(i, j):
        x, y = i * T, j * T
        if x < 128 and y < 112:
            return 'marble_a'
        if x < 128 and y < 176:
            return 'concrete_a'
        if 128 <= x < 208 and y < 96:
            return 'carpet_a'
        if 208 <= x < 304 and y < 96:
            return 'woodfloor_x'
        return 'marble_a'
    parts_ = [('x', 96, 128, 304, [(148, 172), (244, 268)]), ('y', 208, 0, 96, []), ('y', 304, 0, 96, []),
              ('y', 128, 0, 176, []), ('x', 112, 0, 128, [(40, 92)]), ('x', 176, 0, 128, [(46, 80)])]
    S = []
    # --- vault
    S.append(it(I.deposit_wall(8, 8), '+y', 66, 6))
    S.append(it(I.deposit_wall(7, 8), '+x', 6, 58))
    S.append(it(props2.gold_bars(), '+y', 70, 62, ('box', 12, 7, 6), hl='idle', valuable=True, prompt=('E', 'GRAB GOLD')))
    S.append(it(props2.gold_bars(), '+y', 96, 80, ('box', 12, 7, 6), hl='idle', valuable=True))
    S.append(it(props2.cash_stack(), '+y', 40, 88, ('box', 10, 8, 6), hl='idle', valuable=True))
    S.append(it(I.money_cart(), '+y', 104, 40, ('box', 10, 6, 12)))
    if vault_open:
        S.append(it(I.vault_door(), '+x', 30, 138, None, z_bias=4))
    else:
        S.append(it(I.vault_door(), '+y', 66, 112, None, z_bias=4))
    # --- corridor + gate
    S.append(it(D.security_gate(34), '+y', 63, 176, None, z_bias=3))
    S.append(it(D.keycard_reader(), '+y', 88, 177))
    S.append(it(D.fire_extinguisher(), '+x', 0, 150))
    S.append(it(D.cardboard_boxes(2, 7), '+y', 110, 128, ('box', 6, 6, 10)))
    # --- security room
    S.append(it(D.server_rack(), '+y', 138, 10, ('box', 6, 7, 30)))
    S.append(it(D.cctv_desk(), '+y', 172, 9, ('box', 18, 7, 16)))
    S.append(it(D.office_chair(), '-y', 172, 30, ('blob', 5)))
    S.append(it(D.alarm_panel(), '+y', 198, 0, None, hl='hover', prompt=('E', 'DISABLE ALARMS')))
    S.append(it(D.dvr_rack(), '+x', 136, 66, ('box', 6, 6, 14)))
    S.append(it(D.door_leaf(True, ('lavlt', 2.4)), '+y', 160, 96, None, z_bias=3))
    S.append(it(D.keycard_reader(), '+y', 176, 97))
    S.append(it(ch('char/masked_thief', 6, 0.0), 0, 196, 22, ('blob', 6)))
    # --- manager office
    S.append(it(D.bookshelf(2), '+y', 226, 7, ('box', 11, 5, 30)))
    S.append(it(D.bookshelf(7), '+y', 286, 7, ('box', 11, 5, 30)))
    S.append(it(D.rug(50, 30, ('red', 2.0), 'khaki'), '+y', 256, 52, None, z_bias=-300))
    S.append(it(D.exec_desk(), '+y', 256, 44, ('box', 16, 8, 14), hl='idle', prompt=('E', 'TAKE KEYCARD')))
    S.append(it(D.office_chair(), '+y', 256, 30, ('blob', 5)))
    S.append(it(D.wooden_chair(), '-y', 246, 66, ('blob', 4)))
    S.append(it(D.wooden_chair(), '-y', 266, 66, ('blob', 4)))
    S.append(it(D.plant_tall(3), '+y', 296, 84, ('blob', 6)))
    S.append(it(props2.safe(), '+x', 218, 80, ('box', 9, 9, 18)))
    S.append(it(D.vase_tall(), '+y', 244, 42, None, wz=18, z_bias=3))
    # --- lobby corner + lobby
    S.append(it(D.ficus_tree(), '+y', 362, 26, ('blob', 10)))
    S.append(it(D.plant_tall(5), '+y', 320, 14, ('blob', 6)))
    S.append(it(D.teller_counter(120, 4), '+y', 290, 150, ('box', 60, 6, 20)))
    S.append(it(ch('char/civilian_a', 2, 0.0), 0, 262, 126, ('blob', 6), z_bias=-30))
    S.append(it(ch('char/civilian_b', 2, 0.0), 0, 318, 126, ('blob', 6), z_bias=-30))
    S.append(it(D.stanchions(4, 18), '+y', 250, 200, None))
    S.append(it(D.rug(70, 50, ('navy', 2.3), 'gold'), '+y', 200, 250, None, z_bias=-300))
    S.append(it(D.waiting_chairs(3), '+x', 12, 230, ('box', 5, 14, 12)))
    S.append(it(D.side_table(), '+x', 12, 262, ('blob', 4)))
    S.append(it(D.waiting_chairs(3), '+x', 12, 292, ('box', 5, 14, 12)))
    S.append(it(D.plant_tall(7), '+y', 12, 196, ('blob', 6)))
    S.append(it(D.ficus_tree(), '+y', 372, 300, ('blob', 10)))
    S.append(it(D.vase_flowers('plum'), '+y', 12, 262, None, wz=12.1, z_bias=2))
    S.append(it(D.stanchions(2, 16), '+y', 228, 290, None))
    S.append(it(D.entrance_mat(), '+y', 245, 308, None, z_bias=-300))
    S.append(it(D.trash_bin(), '+y', 210, 306, ('blob', 3)))
    S.append(it(D.trash_bin(), '+y', 282, 306, ('blob', 3)))
    S.append(it(D.news_rack(), '-y', 120, 306, ('box', 7, 5, 18)))
    S.append(it(D.plant_tall(11), '+y', 90, 306, ('blob', 6)))
    S.append(it(D.armchair(('navy', 2.2)), '-y', 140, 260, ('box', 8, 8, 12)))
    S.append(it(D.armchair(('navy', 2.2)), '-y', 166, 280, ('box', 8, 8, 12)))
    S.append(it(D.coffee_table(), '+y', 150, 242, ('box', 10, 6, 8)))
    S.append(it(D.vase_flowers('gold'), '+y', 150, 242, None, wz=8.8, z_bias=2))
    S.append(it(D.plant_snake(), '+y', 340, 306, ('blob', 4)))
    S.append(it(D.stanchions(3, 16), '+y', 310, 200, None))
    S.append(it(I.wall_camera(), '+y', 330, 8))
    S.append(it(ch('char/police_officer', 0, 0.0), 0, 150, 220, ('blob', 6)))
    S.append(it(ch('char/masked_thief', 2, 0.0), 0, 220, 236, ('blob', 6)))
    S.append(it(ch('char/office_worker', 6, 0.0), 0, 270, 252, ('blob', 6)))
    S.append(it(ch('char/civilian_a', 6, 0.0), 0, 300, 236, ('blob', 6)))
    markers = [(1, 248, 250, 48), (2, 256, 44, 30), (3, 198, 4, 44), (4, 63, 176, 52), (5, 66, 112, 56), (6, 70, 60, 20), (7, 245, 316, 6)]
    legend = ['BANK HEIST - SET PIECE',
              '1 LOBBY: CONTROL THE CROWD (HOSTAGE METER)',
              '2 MANAGER: TAKE KEYCARD + VAULT CODE',
              '3 SECURITY ROOM: KILL ALARMS + CAMERAS',
              '4 CORRIDOR GATE: SWIPE KEYCARD',
              '5 VAULT DOOR: DRILL (SLOW) OR CHARGE (LOUD)',
              '6 VAULT: BOXES, GOLD, CASH CART (HEAVY)',
              '7 ESCAPE: FRONT, ALLEY, OR SEWER (ROAD JOB)',
              '',
              '!SKIP STEP 3 = SILENT ALARM AT STEP 5',
              '!POLICE ARRIVE IN 60 S AT 4 STARS']
    if viewer_char is not None:
        S.append(it(ch('char/masked_thief', viewer_char[2], 0.0), 0, viewer_char[0], viewer_char[1], ('blob', 6)))
    if legend_override is not None:
        legend = legend_override
    return compose(W_t, D_t, floor, walls, S, partitions=parts_, stub_gaps=[('A', 220, 270)],
                   markers=markers if markers_on else (), legend=legend, sight=sight)


def bank_sight_lobby():
    sight = {'viewer': (220, 236), 'closed': [('x', 96, 148, 172), ('x', 112, 40, 92)], 'remembered': []}
    legend = ['SIGHT: STANDING IN THE LOBBY',
              'SEEN: LOBBY, MANAGER OFFICE (OPEN DOOR),',
              '      A SLICE OF CORRIDOR THROUGH THE GATE',
              'UNSEEN: SECURITY ROOM (DOOR SHUT),',
              '        VAULT (VAULT DOOR SHUT)',
              '',
              '!THE GOLD AND CASH ARE NOT SHOWN',
              '!UNTIL THE VAULT IS OPENED']
    return bank(sight=sight, markers_on=False, legend_override=legend)


def bank_sight_vault():
    sight = {'viewer': (66, 150), 'closed': [('x', 96, 148, 172)],
             'remembered': [(220, 236), (170, 40), (256, 44)]}
    legend = ['SIGHT: VAULT DOOR OPEN, IN THE CORRIDOR',
              'SEEN: CORRIDOR, VAULT, LOBBY STRIP',
              '      THROUGH THE GATE',
              'REMEMBERED: ROOMS VISITED EARLIER -',
              '  LAYOUT DIMMED, PEOPLE AND LOOT HIDDEN',
              '  (THEY MAY HAVE MOVED)',
              '',
              '!GUARDS ONLY SEE YOU BY THE SAME RULES']
    return bank(sight=sight, vault_open=True, markers_on=False, legend_override=legend, viewer_char=(70, 150, 6))



# ======================================================================= Phase 1: Pellridge Tower ground floor (lobby + server room)
def tower_lobby():
    W_t, D_t = 8, 6
    W, D_ = W_t * T, D_t * T
    walls = back_walls(W, D_, paper=('stone', 3.0),
                       windows=[('B', 30, 70), ('B', 110, 150)],
                       decals=[('painting', 'A', 60, 42, 30, 12, 'landscape'), ('clock', 'A', 150, 48, 3.6), ('painting', 'B', 90, 40, 12, 16, 'abstract'),
                               ('fusebox', 'A', 236, 36), ('warning', 'A', 220, 48), ('exit', 'A', 20, 54),
                               ('calendar', 'A', 250, 40)])
    floor = lambda i, j: ('concrete_a' if (i >= 6 and j < 3) else 'marble_a')
    parts_ = [('y', 192, 0, 96, []), ('x', 96, 192, 256, [(206, 228)])]
    S = []
    # lobby: elevator on wall A, reception facing the entrance, waiting chairs, plants
    S.append(it(D.elevator_doors(), '+y', 128, 0, None, hl='idle', prompt=('E', 'ELEVATOR')))
    S.append(it(D.rug(60, 36, ('navy', 2.2), 'stone'), '+y', 96, 132, None, z_bias=-300))
    S.append(it(D.reception_desk(44), '+y', 96, 92, ('box', 22, 8, 22)))
    S.append(it(D.office_chair(), '+y', 96, 78, ('blob', 5)))
    S.append(it(D.waiting_chairs(3), '+x', 12, 140, ('box', 6, 16, 12)))
    S.append(it(D.coffee_table(), '+x', 34, 140, ('box', 6, 10, 8)))
    S.append(it(D.vase_flowers('red'), '+x', 34, 140, None, wz=9.6, z_bias=3))
    S.append(it(D.plant_tall(3), '+y', 12, 12, ('blob', 6)))
    S.append(it(D.plant_tall(7), '+y', 176, 12, ('blob', 6)))
    S.append(it(D.ficus_tree(), '+y', 172, 178, ('blob', 10)))
    S.append(it(D.plant_snake(), '+y', 12, 182, ('blob', 4)))
    S.append(it(D.stanchions(3, 14), '+y', 150, 120, None))
    S.append(it(D.trash_bin(), '+y', 150, 92, ('blob', 3)))
    S.append(it(D.entrance_mat(), '+y', 96, 184, None, z_bias=-300))
    S.append(it(D.plant_tall(11), '+y', 178, 148, ('blob', 6)))
    S.append(it(D.waiting_chairs(2), '-y', 128, 178, ('box', 12, 6, 12)))
    # server room (key card): racks along wall A, a terminal, alarm panel
    S.append(it(D.door_leaf(True, ('lavlt', 2.4)), '+y', 217, 96, None, hl='idle', prompt=('E', 'KEY CARD'), z_bias=3))
    S.append(it(D.keycard_reader(), '+y', 236, 96, None, wz=0, z_bias=4))
    for k, x in enumerate((206, 222, 238)):
        S.append(it(D.server_rack(), '+y', x, 9, ('box', 6, 7, 30)))
    S.append(it(D.server_rack(), '-x', 248, 40, ('box', 6, 7, 30)))
    S.append(it(D.ledger_desk(), '+x', 204, 56, ('box', 6, 10, 12)))
    S.append(it(D.office_chair(), '-x', 216, 56, ('blob', 5)))
    S.append(it(D.fire_extinguisher(), '+y', 250, 0))
    S.append(it(D.cardboard_boxes(2, 3), '+y', 246, 78, ('box', 7, 6, 10)))
    S.append(it(ch('char/civilian_b', 2, 0.0), 0, 98, 76, ('blob', 6)))
    S.append(it(ch('char/office_worker', 4, 0.6), 0, 120, 150, ('blob', 6)))
    return compose(W_t, D_t, floor, walls, S, partitions=parts_, stub_gaps=[('A', 78, 114)])


# ======================================================================= Phase 1: Pellridge Tower office floor (open office + manager's office)
def office_floor():
    W_t, D_t = 9, 7
    W, D_ = W_t * T, D_t * T
    walls = back_walls(W, D_, paper=('lavlt', 3.3),
                       windows=[('A', 22, 68), ('A', 92, 138), ('A', 162, 208), ('B', 20, 70)],
                       decals=[('clock', 'A', 216, 52, 3.6), ('painting', 'A', 80, 54, 10, 6, 'abstract'),
                               ('poster', 'A', 270, 48, 12, 12, 'teal'), ('painting', 'B', 168, 38, 22, 14, 'sea'), ('calendar', 'B', 100, 40)])
    floor = lambda i, j: 'carpet_a'
    parts_ = [('x', 112, 192, 288, []), ('y', 192, 112, 224, [(140, 162)])]
    S = []
    S.append(it(D.elevator_doors(), '+x', 0, 196, None, hl='idle', prompt=('E', 'ELEVATOR')))
    S.append(it(D.plant_tall(2), '+y', 10, 10, ('blob', 6)))
    fc = props2.filing_cabinet()
    for k, y in enumerate((76, 92, 108)):
        fl = dict(hl='idle', prompt=('E', 'FILE PAPERWORK')) if k == 1 else {}
        S.append(it(fc, '+x', 8, y, ('box', 6, 6, 24), **fl))
    S.append(it(D.whiteboard(), '+x', 0, 140, None, hl='idle', prompt=('E', 'MEETING')))
    S.append(it(D.bookshelf(5), '+x', 6, 168, ('box', 5, 11, 30)))
    # cubicles (open side +y); chairs face -y toward the monitors; your desk is the front-left one
    for k, (cx, cy) in enumerate(((76, 70), (124, 70), (76, 140), (124, 140))):
        fl = dict(hl='idle', prompt=('E', 'DATA ENTRY')) if k == 2 else {}
        S.append(it(I.cubicle(), '+y', cx, cy, ('box', 17, 9, 18), **fl))
        S.append(it(D.office_chair(), '-y', cx - 2, cy + 10, ('blob', 5)))
        S.append(it(D.desk_clutter(k), '+y', cx + 2, cy - 3, None, wz=17.3, z_bias=3))
        S.append(it(D.plant_small(k), '+y', cx - 13, cy - 8, None, wz=17.3, z_bias=3))
        S.append(it(D.trash_bin(), '+y', cx + 14, cy + 9, ('blob', 3)))
    # break corner along wall A
    S.append(it(I.copier(), '+y', 210, 12, ('box', 8, 7, 16), hl='idle', prompt=('E', 'STAMP AND SIGN')))
    S.append(it(D.vending_machine('soda'), '+y', 236, 10, ('box', 8, 7, 30)))
    S.append(it(I.water_cooler(), '+y', 256, 11, ('blob', 5)))
    S.append(it(D.side_table(False), '+y', 276, 40, ('blob', 4)))
    S.append(it(D.coffee_machine(), '+y', 276, 39, None, wz=12.1, z_bias=2))
    S.append(it(D.armchair(('sage', 2.3)), '-y', 252, 70, ('box', 8, 8, 12)))
    S.append(it(D.armchair(('sage', 2.3)), '-x', 274, 82, ('box', 8, 8, 12)))
    S.append(it(D.corkboard(), '+y', 160, 0))
    S.append(it(D.ficus_tree(), '+y', 150, 206, ('blob', 10)))
    S.append(it(D.coat_rack(), '+y', 100, 210, ('blob', 3)))
    S.append(it(I.table_chairs(), '+y', 56, 196, ('box', 11, 8, 10)))
    S.append(it(D.bowl_fruit(), '+y', 54, 194, None, wz=16.8, z_bias=4))
    # manager's office: desk faces +y (visitor side), manager's chair behind, visitor chairs face the desk
    S.append(it(D.door_leaf(False, ('wood', 2.2)), '-x', 192, 151, None, z_bias=3))
    S.append(it(D.rug(56, 40, ('navy', 2.2), 'stone'), '+y', 244, 176, None, z_bias=-300))
    S.append(it(D.exec_desk(), '+y', 244, 160, ('box', 16, 8, 14), hl='idle', prompt=('E', 'CLOCK IN')))
    S.append(it(D.office_chair(), '+y', 244, 143, ('blob', 5)))
    S.append(it(D.wooden_chair(), '-y', 234, 182, ('blob', 4)))
    S.append(it(D.wooden_chair(), '-y', 254, 182, ('blob', 4)))
    S.append(it(D.bookshelf(2), '+y', 268, 122, ('box', 11, 5, 30)))
    S.append(it(D.plant_tall(6), '+y', 206, 124, ('blob', 6)))
    S.append(it(D.plant_snake(), '+y', 278, 212, ('blob', 4)))
    S.append(it(ch('char/civilian_a', 2, 0.0), 0, 244, 141, ('blob', 6)))
    S.append(it(ch('char/office_worker', 6, 0.0), 0, 22, 94, ('blob', 6)))
    S.append(it(ch('char/civilian_b', 2, 0.6), 0, 160, 110, ('blob', 6)))
    return compose(W_t, D_t, floor, walls, S, partitions=parts_)


# ======================================================================= Phase 1: The Low Tide (bar + Dez's back room)
def bar():
    W_t, D_t = 10, 7
    W, D_ = W_t * T, D_t * T
    walls = back_walls(W, D_, paper=('brick', 2.5),
                       windows=[('B', 150, 196)],
                       decals=[('clock', 'A', 132, 50, 3.4), ('poster', 'A', 166, 44, 12, 16, 'red'),
                               ('painting', 'B', 120, 40, 18, 12, 'sea'), ('mirror', 'B', 44, 40, 10, 14),
                               ('calendar', 'A', 300, 40), ('fusebox', 'A', 210, 36), ('exit', 'B', 214, 54)])
    # Dez's back room: 4 x 4 tiles in the corner behind the staff door
    floor = lambda i, j: ('concrete_a' if (i >= 6 and j < 4) else 'woodfloor_x')
    parts_ = [('y', 192, 0, 128, []), ('x', 128, 192, 320, [(226, 248)])]
    S = []
    # the bar: back bar on wall A, counter in front of it, stools face the counter
    S.append(it(D.back_bar(96, 3), '+y', 72, 0))
    S.append(it(D.bar_counter(104), '+y', 76, 44, ('box', 52, 8, 22)))
    S.append(it(D.beer_taps(3), '+y', 52, 44, None, wz=21.5, z_bias=4, hl='idle', prompt=('E', 'BAR SHIFT')))
    S.append(it(D.vase_tall(), '+y', 112, 44, None, wz=21.5, z_bias=4))
    for x in (38, 58, 78, 98, 118):
        S.append(it(D.bar_stool(), '-y', x, 62, ('blob', 4)))
    S.append(it(D.neon_sign('teal', 16, 6), '+y', 146, 0))
    S.append(it(D.jukebox(), '+y', 174, 10, ('box', 8, 6, 32)))
    S.append(it(D.dartboard(), '+x', 0, 76))
    # booths along wall B, facing their tables
    for ty in (124, 190):
        S.append(it(D.booth(26), '+y', 24, ty - 20, ('box', 13, 8, 28)))
        S.append(it(D.pub_table(22), '+y', 24, ty, ('box', 11, 7, 16)))
        S.append(it(D.booth(26), '-y', 24, ty + 20, ('box', 13, 8, 28)) if ty + 20 < 214 else it(D.wooden_chair(), '-y', 24, ty + 14, ('blob', 4)))
    S.append(it(D.neon_sign('red', 12, 5), '+x', 0, 150))
    # standing table and the pool table
    S.append(it(D.side_table(False), '+y', 150, 96, ('blob', 4)))
    S.append(it(D.bar_stool(), '-x', 162, 96, ('blob', 4)))
    S.append(it(D.bar_stool(), '+x', 138, 96, ('blob', 4)))
    S.append(it(D.pool_table(), '+y', 120, 176, ('box', 22, 12, 18)))
    S.append(it(D.plant_tall(5), '+y', 306, 146, ('blob', 6)))
    S.append(it(D.plant_snake(), '+y', 306, 210, ('blob', 4)))
    S.append(it(D.coat_rack(), '+y', 214, 206, ('blob', 3)))
    S.append(it(D.trash_bin(), '+y', 176, 64, ('blob', 3)))
    S.append(it(D.armchair(('plum', 2.4)), '-x', 296, 178, ('box', 8, 8, 12)))
    S.append(it(D.entrance_mat(), '+y', 254, 214, None, z_bias=-300))
    # Dez's back room: the laundering desk, a counting table, cash everywhere
    S.append(it(D.door_leaf(True, ('wood', 1.8)), '+y', 237, 128, None, hl='idle', prompt=('E', 'STAFF ONLY'), z_bias=3))
    S.append(it(D.ledger_desk(), '+y', 252, 48, ('box', 10, 6, 12), hl='idle', prompt=('E', 'LAUNDER')))
    S.append(it(D.money_counter(), '-y', 246, 47, None, wz=15.8, z_bias=6))
    S.append(it(D.cash_bundles(6, 1), '+y', 258, 47, None, wz=15.8, z_bias=7))
    S.append(it(D.wooden_chair(), '-y', 252, 70, ('blob', 4)))
    S.append(it(D.counting_table(), '+y', 284, 96, ('box', 15, 8, 16)))
    S.append(it(D.cash_bundles(10, 3), '+y', 278, 95, None, wz=15.6, z_bias=6))
    S.append(it(D.loose_bills(6, 9, 4), '+y', 290, 96, None, wz=15.6, z_bias=5))
    S.append(it(D.wooden_chair(), '-y', 284, 114, ('blob', 4)))
    S.append(it(props2.safe(), '+y', 300, 20, ('box', 9, 9, 18)))
    S.append(it(D.cash_duffel(), '+y', 218, 96, ('box', 10, 6, 10)))
    S.append(it(D.loose_bills(7, 14, 2), '+y', 236, 82, None, z_bias=-200))
    S.append(it(D.loose_bills(4, 8, 9), '+y', 292, 64, None, z_bias=-200))
    S.append(it(D.cardboard_boxes(3, 2), '+y', 210, 14, ('box', 7, 6, 14)))
    S.append(it(D.cardboard_boxes(2, 5), '-x', 308, 112, ('box', 7, 6, 10)))
    S.append(it(D.floor_lamp(), '+y', 204, 52, ('blob', 3)))
    S.append(it(ch('char/civilian_b', 2, 0.0), 0, 254, 34, ('blob', 6), z_bias=20))
    # people: bartender behind the counter, patrons
    S.append(it(ch('char/civilian_a', 2, 0.0), 0, 86, 24, ('blob', 6)))
    S.append(it(ch('char/office_worker', 6, 0.0), 0, 78, 74, ('blob', 6)))
    S.append(it(ch('char/road_worker', 4, 0.0), 0, 150, 176, ('blob', 6)))
    S.append(it(ch('char/civilian_b', 6, 0.0), 0, 150, 112, ('blob', 6)))
    return compose(W_t, D_t, floor, walls, S, partitions=parts_, stub_gaps=[('A', 240, 270)])


# ======================================================================= Phase 2: Hedgerow Way shops (milestone 6b)
def hardware():
    """The hardware store: a long shop floor (paint, tools, timber, bins of fixings), the counter by the door with the
    key cutter, and a locked stockroom in the back corner."""
    W_t, D_t = 8, 6
    W, D_ = W_t * T, D_t * T
    walls = back_walls(W, D_, paper=('khaki', 3.0),
                       windows=[('B', 120, 170)],
                       decals=[('poster', 'A', 214, 46, 18, 10, 'red'), ('clock', 'A', 244, 50, 3.4),
                               ('warning', 'A', 98, 50), ('fusebox', 'A', 20, 36), ('calendar', 'A', 50, 40),
                               ('exit', 'B', 186, 54), ('poster', 'B', 96, 42, 12, 14, 'navy')])
    floor = lambda i, j: ('concrete_a' if (i < 3 and j < 2) else 'linoleum_a')
    parts_ = [('x', 64, 0, 96, [(56, 78)]), ('y', 96, 0, 64, [])]
    S = []
    # --- the stockroom (locked): shelving, boxes, timber offcuts
    S.append(it(D.storage_shelf(3), '+y', 30, 8, ('box', 15, 6, 30)))
    S.append(it(D.storage_shelf(6), '+y', 64, 8, ('box', 15, 6, 30)))
    S.append(it(D.cardboard_boxes(3, 6), '+x', 12, 46, ('box', 7, 6, 14)))
    S.append(it(D.cardboard_boxes(2, 2), '+y', 82, 44, ('box', 7, 6, 10)))
    S.append(it(D.broom(), '+x', 0, 30))
    S.append(it(D.door_leaf(True, ('wood', 2.0)), '+y', 67, 64, None, hl='idle', prompt=('E', 'STAFF ONLY'), z_bias=3))
    # --- along wall A: paint, the tool wall, the ladder
    S.append(it(DS.paint_shelf(3), '+y', 124, 8, ('box', 15, 6, 30)))
    S.append(it(DS.paint_shelf(8), '+y', 158, 8, ('box', 15, 6, 30)))
    S.append(it(DS.tool_pegboard(2), '+y', 206, 0))
    S.append(it(DS.step_ladder(), '+y', 186, 18, ('blob', 4)))
    S.append(it(DS.bulk_bins(5), '+y', 214, 14, ('box', 13, 6, 16)))
    S.append(it(D.plant_tall(8), '+y', 244, 14, ('blob', 6)))
    # --- along wall B: the tool wall, timber
    S.append(it(DS.tool_pegboard(7), '+x', 0, 104))
    S.append(it(DS.lumber_rack(), '+x', 10, 158, ('box', 6, 17, 30)))
    # --- the aisles
    S.append(it(I.shelf_unit(48, 3), '+y', 86, 102, ('box', 24, 5, 24)))
    S.append(it(I.shelf_unit(48, 7), '+y', 86, 144, ('box', 24, 5, 24)))
    S.append(it(DS.bulk_bins(9), '-y', 152, 104, ('box', 13, 6, 16)))
    S.append(it(I.shelf_unit(40, 11), '+y', 150, 158, ('box', 20, 5, 24)))
    S.append(it(D.cardboard_boxes(3, 9), '+y', 46, 180, ('box', 7, 6, 14)))
    S.append(it(D.cardboard_boxes(2, 7), '+y', 104, 182, ('box', 7, 6, 10)))
    S.append(it(D.cardboard_boxes(2, 5), '+y', 176, 62, ('box', 7, 6, 10)))
    # --- the counter by the door: the till (SHOP) and the key cutter; the clerk behind it
    S.append(it(I.counter_run(64), '-x', 212, 112, ('box', 6, 32, 14)))
    S.append(it(scaled(I._register_only(), 1.35), '-x', 210, 96, None, hl='hover', prompt=('E', 'SHOP'), wz=20.5, z_bias=30))
    S.append(it(DS.key_cutter(), '-x', 210, 124, None, wz=20.5, z_bias=31))
    S.append(it(D.trash_bin(), '+y', 248, 62, ('blob', 3)))
    S.append(it(D.entrance_mat(), '+y', 196, 184, None, z_bias=-300))
    S.append(it(D.plant_snake(), '+y', 246, 182, ('blob', 4)))
    S.append(it(I.wall_camera(), '+y', 236, 8))
    S.append(it(ch('char/road_worker', 4, 0.0), 0, 238, 108, ('blob', 6), z_bias=40))
    S.append(it(ch('char/civilian_a', 6, 0.6), 0, 120, 176, ('blob', 6)))
    return compose(W_t, D_t, floor, walls, S, partitions=parts_, stub_gaps=[('A', 180, 214)])


def clothing():
    """The clothing store: racks and tables of clothes, mannequins in the window, fitting booths along the side wall
    (CHANGE OUTFIT), shoes on the back wall and the till by the door."""
    W_t, D_t = 8, 6
    W, D_ = W_t * T, D_t * T
    walls = back_walls(W, D_, paper=('lav', 3.2),
                       windows=[('A', 150, 200)],
                       decals=[('mirror', 'B', 150, 34, 8, 18), ('painting', 'A', 60, 44, 22, 12, 'abstract'),
                               ('clock', 'A', 232, 50, 3.4), ('poster', 'A', 112, 46, 12, 16, 'plum'),
                               ('calendar', 'B', 186, 40), ('exit', 'A', 20, 54)])
    floor = lambda i, j: 'woodfloor_x'
    S = []
    # fitting booths on wall B, curtains toward the shop
    S.append(it(DS.fitting_booth('plum'), '+x', 13, 30, ('box', 12, 13, 30), hl='idle', prompt=('E', 'CHANGE OUTFIT')))
    S.append(it(DS.fitting_booth('teal'), '+x', 13, 60))
    S.append(it(D.armchair(('plum', 2.4)), '+x', 12, 96, ('box', 8, 8, 12)))
    S.append(it(D.plant_tall(2), '+y', 12, 120, ('blob', 6)))
    # shoes and a rail along wall A
    S.append(it(DS.shoe_shelf(6), '+y', 60, 0, ('box', 15, 5, 18)))
    S.append(it(DS.clothing_rack(3, 40), '+y', 112, 12, ('box', 21, 6, 30)))
    S.append(it(DS.mannequin(('red', 2.6), ('night', 2.2)), '+y', 160, 14, ('blob', 6)))
    S.append(it(DS.mannequin(('navy', 2.2), ('navy', 2.0)), '+y', 182, 14, ('blob', 6)))
    S.append(it(D.plant_snake(), '+y', 206, 12, ('blob', 4)))
    # the floor: racks and tables
    S.append(it(DS.clothing_rack(5, 30), '+y', 72, 80, ('box', 16, 6, 30)))
    S.append(it(DS.clothing_rack(8, 30), '+y', 72, 116, ('box', 16, 6, 30)))
    S.append(it(DS.display_table(4), '+y', 130, 80, ('box', 13, 8, 16)))
    S.append(it(DS.display_table(9), '+y', 130, 122, ('box', 13, 8, 16)))
    S.append(it(DS.clothing_rack(2, 30), '+x', 178, 100, ('box', 6, 16, 30)))
    S.append(it(D.rug(40, 24, ('plum', 2.2), 'stone'), '+y', 100, 162, None, z_bias=-300))
    S.append(it(DS.mannequin(('teal', 2.4), ('blueg', 1.8)), '-y', 54, 172, ('blob', 6)))
    S.append(it(DS.mannequin(('clay', 2.4), ('wood', 1.8)), '-y', 76, 178, ('blob', 6)))
    # the till by the door, the clerk behind it
    S.append(it(I.counter_run(56), '-x', 214, 92, ('box', 6, 28, 14)))
    S.append(it(scaled(I._register_only(), 1.35), '-x', 212, 80, None, hl='hover', prompt=('E', 'BUY CLOTHES'), wz=20.5, z_bias=30))
    S.append(it(D.vase_flowers('plum'), '-x', 212, 106, None, wz=20.5, z_bias=31))
    S.append(it(D.trash_bin(), '+y', 248, 130, ('blob', 3)))
    S.append(it(DS.display_table(12), '+y', 142, 166, ('box', 13, 8, 16)))
    S.append(it(D.coat_rack(), '+y', 12, 150, ('blob', 3)))
    S.append(it(D.entrance_mat(), '+y', 192, 184, None, z_bias=-300))
    S.append(it(D.plant_tall(6), '+y', 244, 182, ('blob', 6)))
    S.append(it(ch('char/civilian_b', 4, 0.0), 0, 238, 92, ('blob', 6), z_bias=40))
    S.append(it(ch('char/office_worker', 2, 0.6), 0, 100, 148, ('blob', 6)))
    return compose(W_t, D_t, floor, walls, S, stub_gaps=[('A', 176, 210)])


def dealer():
    """The used-car lot's sales cabin: glass all round, the salesman's desk (BUY A CAR) with two visitor chairs,
    brochures, coffee and water, a model car on a plinth."""
    W_t, D_t = 5, 4
    W, D_ = W_t * T, D_t * T
    walls = back_walls(W, D_, paper=('white', 3.0),
                       windows=[('A', 12, 70), ('A', 94, 150), ('B', 14, 100)],
                       decals=[('calendar', 'A', 82, 44), ('poster', 'B', 112, 44, 14, 10, 'red'), ('clock', 'A', 154, 50, 3.0)])
    floor = lambda i, j: 'carpet_a'
    S = []
    S.append(it(D.rug(44, 30, ('navy', 2.2), 'stone'), '+y', 72, 64, None, z_bias=-300))
    S.append(it(D.exec_desk(), '+y', 72, 50, ('box', 16, 8, 14), hl='idle', prompt=('E', 'BUY A CAR')))
    S.append(it(D.office_chair(), '+y', 72, 33, ('blob', 5)))
    S.append(it(D.desk_clutter(3), '+y', 76, 47, None, wz=17.3, z_bias=3))
    S.append(it(D.wooden_chair(), '-y', 62, 72, ('blob', 4)))
    S.append(it(D.wooden_chair(), '-y', 82, 72, ('blob', 4)))
    S.append(it(props2.filing_cabinet(), '+y', 112, 10, ('box', 6, 6, 24)))
    S.append(it(D.plant_tall(4), '+y', 12, 12, ('blob', 6)))
    S.append(it(D.waiting_chairs(2), '+x', 10, 36, ('box', 6, 12, 12)))
    S.append(it(D.trash_bin(), '+y', 100, 22, ('blob', 3)))
    S.append(it(D.floor_lamp(), '+y', 128, 100, ('blob', 3)))
    S.append(it(D.news_rack(), '+x', 8, 64, ('box', 5, 7, 18)))
    S.append(it(I.water_cooler(), '+y', 148, 12, ('blob', 5)))
    S.append(it(D.side_table(False), '-x', 148, 44, ('blob', 4)))
    S.append(it(D.coffee_machine(), '-x', 148, 43, None, wz=12.1, z_bias=2))
    S.append(it(DS.car_model_stand(), '+y', 22, 104, ('box', 6, 8, 16)))
    S.append(it(D.plant_snake(), '+y', 148, 108, ('blob', 4)))
    S.append(it(D.entrance_mat(), '+y', 104, 120, None, z_bias=-300))
    S.append(it(ch('char/office_worker', 2, 0.0), 0, 72, 31, ('blob', 6), z_bias=10))
    return compose(W_t, D_t, floor, walls, S, stub_gaps=[('A', 90, 118)])

if __name__ == '__main__':
    os.makedirs('out/interiors_v2', exist_ok=True)
    which = sys.argv[1:] or ['apartment', 'store', 'office', 'bank', 'bank_sight_lobby', 'bank_sight_vault']
    for name in which:
        c = globals()[name]()
        to_image(c, 1).save(f'out/interiors_v2/interior_{name}_1x.png')
        to_image(c, 3).save(f'out/interiors_v2/interior_{name}.png')
        print(name, c.shape)

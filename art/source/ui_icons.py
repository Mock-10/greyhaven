"""UI icons (UI redesign, user request 2026-10-12: "use more images, it's better for conveying information").

Every icon is a small SDF model rendered with the game's own renderer (sdf.render: same light, ramps, dithering and
outline as the world art), scaled to fill its cell and packed into one atlas:

  item/*     32 x 32  shop cards, the bag, the trunk search grid (soda ... repair kit, loot)
  app/*      40 x 40  the phone's home screen (messages, bank, job board, contacts, bag) and service senders
  hud/*      16 x 16  HUD panels (health, armor, clean and dirty cash, sun, moon, fuel, condition)
  face/*     32 x 32  contact portraits (the head and shoulders of a person model from humans.py)

Gold stays reserved for valuables (the watch) and interactables (CLAUDE.md rule 2).
`python3 ui_icons.py` writes art/ui_icons.png + .json and a contact sheet in art/drafts/hud/ui_icons_sheet.png.
"""
import json, os, sys, warnings
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
warnings.filterwarnings('ignore')
import numpy as np
from PIL import Image
from sdf import Model, RID, capsule, cyl_z, ell, rbox, render, scaled, smin, solid
from props2 import lump
import humans

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))


def mat(fn):
    """A material callable from a per-point rule returning (ramp name array, base array, shine array)."""
    def m(p, n):
        r, b, s = fn(p, n)
        return np.vectorize(lambda k: RID[k])(r) if r.dtype.kind in 'UO' else r, b, s
    return m


def rot_x(P, a):
    c, s = np.cos(a), np.sin(a)
    return np.stack([P[:, 0], P[:, 1] * c - P[:, 2] * s, P[:, 1] * s + P[:, 2] * c], 1)


def rot_z(P, a):
    c, s = np.cos(a), np.sin(a)
    return np.stack([P[:, 0] * c - P[:, 1] * s, P[:, 0] * s + P[:, 1] * c, P[:, 2]], 1)


def full(n, v):
    return np.full(n, v, dtype=object) if isinstance(v, str) else np.full(n, v, float)


# ------------------------------------------------------------------ items
def soda():
    def parts(P):
        return [cyl_z(P, (0, 0, 6), 3.0, 6.0, 0.8)]
    def m(p, n):
        z = p[:, 2]
        band = (z > 4.4) & (z < 7.4)
        rim = (z > 11.2) | (z < 0.8)
        r = np.where(rim, 'blueg', np.where(band, 'white', 'red'))
        b = np.where(rim, 3.6, np.where(band, 4.2, 2.9))
        return r, b, np.where(rim, 0.8, 0.3)
    return Model(parts, [mat(m)], (-3.5, 3.5, -3.5, 3.5, 0, 12.5))


def chips():
    def parts(P):
        body = rbox(P, (0, 0, 7), (5.2, 1.7, 6.0), 1.6) + lump(P, 0.25, 1.4)
        seam = rbox(P, (0, 0, 13.3), (5.4, 0.5, 0.7), 0.3)
        return [smin(body, seam, 0.8)]
    def m(p, n):
        z = p[:, 2]
        band = (z > 5.0) & (z < 9.0)
        r = np.where(band, 'red', 'khaki')
        return r, np.where(band, 3.0, 3.6), full(len(p), 0.2)
    return Model(parts, [mat(m)], (-6, 6, -2.5, 2.5, 0, 14.5))


def sandwich():
    def wedge(P, z0, z1, rr):
        box = rbox(P, (0, 0, (z0 + z1) / 2), (6.5, 6.5, (z1 - z0) / 2), rr)
        return np.maximum(box, (P[:, 0] + P[:, 1]) / np.sqrt(2) - 1.2)
    def parts(P):
        return [smin(wedge(P, 0, 2.2, 0.8), wedge(P, 4.4, 6.6, 0.9), 0.3), wedge(P, 2.0, 3.4, 0.4), wedge(P, 3.2, 4.6, 0.4)]
    return Model(parts, [solid('stone', 3.6), solid('sage', 3.2), solid('red', 3.0)], (-7, 4, -7, 4, 0, 7))


def fuel_can():
    def parts(P):
        body = rbox(P, (0, 0, 7), (2.6, 6.0, 7.0), 1.0)
        handle = np.minimum(capsule(P, (0, -4.5, 14.6), (0, 0.5, 14.6), 0.8),
                            np.minimum(capsule(P, (0, -4.5, 13.6), (0, -4.5, 14.6), 0.8), capsule(P, (0, 0.5, 13.6), (0, 0.5, 14.6), 0.8)))
        spout = capsule(P, (0, 4.0, 13.6), (0, 5.4, 16.0), 0.9)
        return [body, np.minimum(handle, spout)]
    def m(p, n):
        x = p[:, 1]
        emboss = (np.abs(np.abs(x) - 2.5) < 0.5) & (p[:, 2] > 3) & (p[:, 2] < 11)
        return np.where(emboss, 'red', 'red'), np.where(emboss, 2.2, 3.1), full(len(p), 0.4)
    return Model(parts, [mat(m), solid('night', 2.6, 0.3)], (-3, 3, -6.5, 6.5, 0, 17))


def first_aid():
    def parts(P):
        box = rbox(P, (0, 0, 5), (6.5, 3.0, 5.0), 1.0)
        handle = capsule(P, (-2.2, 0, 10.6), (2.2, 0, 10.6), 0.8)
        return [box, handle]
    def m(p, n):
        x, y, z = p[:, 0], p[:, 1], p[:, 2] - 5
        front = n[:, 1] > 0.6
        cross = front & (((np.abs(x) < 1.1) & (np.abs(z) < 3.3)) | ((np.abs(z) < 1.1) & (np.abs(x) < 3.3)))
        lid = np.abs(z - 2.6) < 0.3
        r = np.where(cross, 'red', 'white')
        return r, np.where(cross, 3.0, np.where(lid, 3.3, 4.5)), full(len(p), 0.2)
    return Model(parts, [mat(m), solid('night', 2.4)], (-7, 7, -3.5, 3.5, 0, 12))


def lockpicks():
    def parts(P):
        pouch = rbox(P, (0, 0, 4.5), (5.0, 1.0, 4.5), 0.9)
        picks = np.minimum.reduce([capsule(P, (-2.5 + k * 2.5, 0, 6), (-3.4 + k * 3.2, 0, 15.0 - abs(k - 1) * 1.5), 0.42)
                                   for k in range(3)])
        tips = np.minimum(ell(P, (-3.4, 0, 15.0), (0.9, 0.5, 0.5)), ell(P, (2.9, 0, 15.0), (0.5, 0.5, 0.9)))
        return [pouch, np.minimum(picks, tips)]
    return Model(parts, [solid('wood', 2.6), solid('blueg', 4.2, 0.9)], (-6, 6, -1.5, 1.5, 0, 16.5))


def toolbox():
    def parts(P):
        box = rbox(P, (0, 0, 3.6), (7.5, 3.2, 3.6), 0.6)
        lid = rbox(P, (0, 0, 7.6), (7.0, 2.8, 0.9), 0.5)
        handle = np.minimum.reduce([capsule(P, (-3, 0, 8.4), (-3, 0, 10.6), 0.6), capsule(P, (3, 0, 8.4), (3, 0, 10.6), 0.6),
                                    capsule(P, (-3, 0, 10.6), (3, 0, 10.6), 0.7)])
        latch = rbox(P, (0, 3.2, 6.3), (1.0, 0.4, 0.7), 0.2)
        return [np.minimum(box, lid), np.minimum(handle, latch)]
    return Model(parts, [solid('red', 3.0, 0.3), solid('blueg', 3.8, 0.8)], (-8, 8, -4, 4, 0, 11.5))


def repair_kit():
    def parts(P):
        Q = rot_x(P - [0, 0, 7], 0.0)
        a = 0.65
        W = rot_z(Q, 0.0)
        shaft = capsule(W, (-6 * np.cos(a), 0, -6 * np.sin(a)), (5 * np.cos(a), 0, 5 * np.sin(a)), 0.9)
        hc = np.array([6.6 * np.cos(a), 0, 6.6 * np.sin(a)])
        head = np.maximum(cyl_y_soft(W, hc, 2.4, 0.9), -cyl_y_soft(W, hc + [0.9 * np.cos(a), 0, 0.9 * np.sin(a)], 1.2, 2.0))
        wrench = smin(shaft, head, 0.6)
        b = -a
        sd_shaft = capsule(W, (-1.0 * np.cos(b), 0.6, -1.0 * np.sin(b)), (6.0 * np.cos(b), 0.6, 6.0 * np.sin(b)), 0.45)
        sd_handle = capsule(W, (-6.0 * np.cos(b), 0.6, -6.0 * np.sin(b)), (-1.2 * np.cos(b), 0.6, -1.2 * np.sin(b)), 1.3)
        return [wrench, sd_shaft, sd_handle]
    return Model(parts, [solid('blueg', 3.9, 0.9), solid('blueg', 4.4, 0.9), solid('red', 3.0, 0.3)],
                 (-8, 8, -2.5, 2.5, -1, 15))


def cyl_y_soft(P, c, r, hh):
    q = P - np.asarray(c, float)
    d1 = np.sqrt(q[:, 0] ** 2 + q[:, 2] ** 2) - r
    d2 = np.abs(q[:, 1]) - hh
    return np.minimum(np.maximum(d1, d2), 0.0) + np.sqrt(np.maximum(d1, 0) ** 2 + np.maximum(d2, 0) ** 2)


def phone():
    def parts(P):
        Q = rot_x(P - [0, 0, 7], -0.6)
        return [rbox(Q, (0, 0, 0), (3.4, 0.6, 6.6), 0.9)]
    def m(p, n):
        Q = rot_x(p - [0, 0, 7], -0.6)
        screen = (Q[:, 1] > 0.3) & (np.abs(Q[:, 0]) < 2.6) & (np.abs(Q[:, 2]) < 5.4)
        return np.where(screen, 'glass', 'night'), np.where(screen, 3.4, 2.4), np.where(screen, 1.0, 0.3)
    return Model(parts, [mat(m)], (-4.5, 4.5, -2.5, 2.5, -0.5, 15))


def wallet():
    def parts(P):
        body = rbox(P, (0, 0, 3.6), (5.8, 1.4, 3.6), 1.0)
        bills = rbox(P, (0.8, 0, 7.4), (4.2, 0.8, 1.4), 0.3)
        return [body, bills]
    def m(p, n):
        fold = np.abs(p[:, 2] - 4.6) < 0.35
        return np.where(fold, 'wood', 'wood'), np.where(fold, 1.6, 2.6), full(len(p), 0.3)
    return Model(parts, [mat(m), solid('sage', 3.6)], (-6.5, 6.5, -2, 2, 0, 9))


def cash():
    def parts(P):
        stack = rbox(P, (0, 0, 2.2), (7.0, 3.6, 2.2), 0.5)
        strap = rbox(P, (0, 0, 2.2), (1.4, 3.8, 2.4), 0.3)
        return [stack, strap]
    def m(p, n):
        z = p[:, 2]
        edge = np.abs(n[:, 2]) < 0.6
        layer = edge & (np.mod(z, 0.9) < 0.3)
        return np.where(layer, 'sage', 'sage'), np.where(layer, 2.4, np.where(edge, 3.4, 3.7)), full(len(p), 0.1)
    return Model(parts, [mat(m), solid('white', 4.3)], (-7.5, 7.5, -4, 4, 0, 5))


def watch():
    def parts(P):
        Q = rot_x(P - [0, 0, 8], -0.5)
        case_ = cyl_y_soft(Q, (0, 0, 0), 3.6, 0.9)
        strap = np.minimum(rbox(Q, (0, -0.2, 5.8), (1.9, 0.5, 2.6), 0.4), rbox(Q, (0, -0.2, -5.8), (1.9, 0.5, 2.6), 0.4))
        crown = cyl_y_soft(rot_z(Q - [4.0, 0, 0], 0), (0, 0, 0), 0.6, 0.5)
        return [np.minimum(case_, crown), strap]
    def m(p, n):
        Q = rot_x(p - [0, 0, 8], -0.5)
        face = (Q[:, 1] > 0.5) & (np.sqrt(Q[:, 0] ** 2 + Q[:, 2] ** 2) < 2.7)
        hand = face & (((np.abs(Q[:, 0]) < 0.35) & (Q[:, 2] > 0) & (Q[:, 2] < 2.0)) |
                       ((np.abs(Q[:, 2]) < 0.35) & (Q[:, 0] > 0) & (Q[:, 0] < 1.5)))
        r = np.where(hand, 'night', np.where(face, 'white', 'gold'))
        return r, np.where(face & ~hand, 4.5, np.where(hand, 1.4, 3.4)), np.where(face, 0.4, 1.0)
    return Model(parts, [mat(m), solid('night', 2.2)], (-4.8, 4.8, -1.5, 1.5, -0.2, 16.5))


def junk():
    def parts(P):
        return [ell(P, (0, 0, 4.2), (5.0, 4.4, 4.2)) + lump(P, 0.9, 1.3) + lump(P[:, [1, 2, 0]], 0.5, 2.3)]
    return Model(parts, [solid('stone', 3.4)], (-6.5, 6.5, -6, 6, -1, 10))


# ------------------------------------------------------------------ phone apps and services
def envelope():
    def parts(P):
        Q = rot_x(P - [0, 0, 6], -0.6)
        return [rbox(Q, (0, 0, 0), (7.5, 0.5, 5.0), 0.4)]
    def m(p, n):
        Q = rot_x(p - [0, 0, 6], -0.6)
        flap = (Q[:, 1] > 0.2) & (np.abs(Q[:, 2] - (2.6 - np.abs(Q[:, 0]) * 0.62)) < 0.35)
        lower = (Q[:, 1] > 0.2) & (np.abs(Q[:, 2] - (-4.6 + np.abs(Q[:, 0]) * 0.55)) < 0.3) & (np.abs(Q[:, 0]) > 2.5)
        line = flap | lower
        return np.where(line, 'white', 'white'), np.where(line, 2.3, 4.6), full(len(p), 0.1)
    return Model(parts, [mat(m)], (-8, 8, -2, 2, 0, 12))


def bank():
    def parts(P):
        steps = np.minimum(rbox(P, (0, 0, 0.6), (8.5, 6.5, 0.6), 0.2), rbox(P, (0, 0, 1.6), (7.8, 5.8, 0.5), 0.2))
        cols = np.minimum.reduce([cyl_z(P, (x, 4.6, 6.0), 0.8, 4.0, 0.2) for x in (-5.4, -1.8, 1.8, 5.4)] +
                                 [cyl_z(P, (7.0, y, 6.0), 0.8, 4.0, 0.2) for y in (-3.0, 0.8)])
        hall = rbox(P, (-0.6, -1.0, 6.0), (6.4, 4.4, 4.0), 0.1)
        beam = rbox(P, (0, 0, 10.6), (8.0, 6.0, 0.7), 0.2)
        roof = np.maximum(rbox(P, (0, 0, 13.0), (8.0, 6.0, 1.8), 0.1), P[:, 2] - 14.8 + np.abs(P[:, 1]) * 0.3)
        return [np.minimum(steps, beam), cols, hall, roof]
    return Model(parts, [solid('stone', 4.0), solid('white', 4.4), solid('stone', 2.6), solid('lavlt', 3.6)],
                 (-9, 9, -7, 7, 0, 15))


def clipboard():
    def parts(P):
        Q = rot_x(P - [0, 0, 7.5], -0.55)
        board = rbox(Q, (0, 0, 0), (5.6, 0.5, 7.4), 0.6)
        paper = rbox(Q, (0, 0.55, -0.6), (4.6, 0.15, 6.0), 0.1)
        clip = rbox(Q, (0, 0.8, 6.6), (2.2, 0.6, 1.0), 0.4)
        return [board, paper, clip]
    def pm(p, n):
        Q = rot_x(p - [0, 0, 7.5], -0.55)
        z = Q[:, 2]
        lines = (np.mod(z + 6, 1.8) < 0.4) & (z < 3.5) & (np.abs(Q[:, 0]) < 3.6)
        tick = (Q[:, 0] < -2.6) & lines
        r = np.where(tick, 'sage', 'white')
        return r, np.where(lines, 2.4, 4.6), full(len(p), 0.0)
    return Model(parts, [solid('wood', 3.0), mat(pm), solid('blueg', 4.0, 0.9)], (-6.5, 6.5, -2.5, 2.5, -0.5, 16))


def address_book():
    def parts(P):
        Q = rot_x(P - [0, 0, 7], -0.55)
        cover = rbox(Q, (0, 0, 0), (5.2, 1.4, 7.0), 0.5)
        pages = rbox(Q, (0.4, 0.0, 0), (5.0, 1.0, 6.6), 0.2)
        tabs = np.minimum.reduce([rbox(Q, (5.4, 0, z), (0.6, 0.7, 0.8), 0.2) for z in (4.0, 1.0, -2.0)])
        return [cover, pages, tabs]
    def cm(p, n):
        Q = rot_x(p - [0, 0, 7], -0.55)
        label = (Q[:, 1] > 1.0) & (np.abs(Q[:, 0]) < 2.6) & (np.abs(Q[:, 2] - 2.4) < 1.4)
        return np.where(label, 'white', 'navy'), np.where(label, 4.2, 2.8), full(len(p), 0.2)
    return Model(parts, [mat(cm), solid('white', 4.4), solid('red', 3.2)], (-6.5, 6.5, -2.5, 2.5, -0.5, 15))


def duffel():
    def parts(P):
        Q = P - [0, 0, 5]
        body = smin(ell(Q, (0, 0, 0), (8.0, 4.4, 4.6)), rbox(Q, (0, 0, -2.5), (7.0, 4.0, 2.0), 1.5), 1.5)
        handles = np.minimum(capsule(Q, (-2.5, 1.5, 4.2), (2.5, 1.5, 4.2), 0.6), capsule(Q, (-2.5, -1.5, 4.2), (2.5, -1.5, 4.2), 0.6))
        caps = np.minimum(ell(Q, (-7.6, 0, 0), (1.0, 3.6, 3.8)), ell(Q, (7.6, 0, 0), (1.0, 3.6, 3.8)))
        return [body, np.minimum(handles, caps)]
    return Model(parts, [solid('navy', 2.9, 0.2), solid('night', 2.4)], (-9, 9, -5, 5, 0, 11))


def cot():
    """The shelter: a camp bed with a pillow and a folded blanket."""
    def parts(P):
        frame = rbox(P, (0, 0, 3.0), (8.0, 3.6, 0.8), 0.4)
        legs = np.minimum.reduce([capsule(P, (x, y, 0), (x, y, 2.6), 0.4) for x in (-7, 7) for y in (-3, 3)])
        pillow = ell(P, (-5.8, 0, 4.4), (1.8, 3.0, 1.0))
        blanket = rbox(P, (2.0, 0, 4.2), (5.0, 3.8, 0.7), 0.5)
        return [np.minimum(frame, legs), pillow, blanket]
    return Model(parts, [solid('blueg', 2.8), solid('white', 4.5), solid('sage', 2.8)], (-9, 9, -4.5, 4.5, -0.5, 6))


def axe():
    """Ashby Timber: a felling axe, handle down."""
    def parts(P):
        handle = capsule(P, (0, 0, 0.5), (0, 0, 15.0), 0.75)
        head = np.maximum(rbox(P, (2.4, 0, 13.6), (3.4, 0.7, 1.9), 0.3), (P[:, 0] - 2.0) * 0.5 - (P[:, 2] - 13.6) * 0.0 - 2.6)
        blade = np.maximum(ell(P, (5.2, 0, 13.6), (1.4, 0.6, 3.4)), -(P[:, 0] - 4.2))
        return [handle, np.minimum(head, blade)]
    return Model(parts, [solid('wood', 3.0), solid('blueg', 3.9, 0.9)], (-1.5, 7, -1.2, 1.2, 0, 17.5))


def parcel():
    """Swiftish Couriers: a taped cardboard box with a label."""
    def parts(P):
        return [rbox(P, (0, 0, 4.6), (6.0, 4.6, 4.6), 0.4)]
    def m(p, n):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        tape = (np.abs(y) < 1.0) & (n[:, 2] > 0.7) | (np.abs(y) < 1.0) & (z > 6.5) & (np.abs(n[:, 0]) > 0.7)
        label = (n[:, 1] > 0.7) & (np.abs(x - 1.5) < 2.4) & (np.abs(z - 3.6) < 1.6)
        r = np.where(label, 'white', np.where(tape, 'stone', 'clay'))
        return r, np.where(label, 4.3, np.where(tape, 4.0, 3.2)), full(len(p), 0.1)
    return Model(parts, [mat(m)], (-6.5, 6.5, -5, 5, 0, 9.5))


# ------------------------------------------------------------------ HUD
def heart():
    def parts(P):
        Q = facing(P)
        x, y, z = Q[:, 0], Q[:, 1], Q[:, 2]
        lobes = np.minimum(ell(Q, (-2.3, 0, 1.8), (3.0, 2.2, 3.0)), ell(Q, (2.3, 0, 1.8), (3.0, 2.2, 3.0)))
        point = np.maximum(rbox(Q, (0, 0, -1.2), (4.6, 2.0, 4.4), 1.0), (np.abs(x) - (z + 5.4) * 0.85) * 0.75)
        return [smin(lobes, point, 1.0)]
    return Model(parts, [solid('red', 3.2, 0.6)], (-6, 6, -2.5, 2.5, -0.5, 12))


def vest():
    def parts(P):
        Q = rot_x(P - [0, 0, 6], -0.5)
        body = rbox(Q, (0, 0, 0), (5.0, 1.8, 6.0), 1.2)
        neck = ell(Q, (0, 0, 6.5), (2.4, 3.0, 2.6))
        arms = np.minimum(ell(Q, (-5.6, 0, 3.2), (2.0, 3.0, 3.0)), ell(Q, (5.6, 0, 3.2), (2.0, 3.0, 3.0)))
        return [np.maximum(body, -np.minimum(neck, arms))]
    def m(p, n):
        plate = (np.abs(p[:, 2] - 5) < 2.4) & (np.abs(p[:, 0]) < 3.6)
        return np.where(plate, 'blueg', 'blueg'), np.where(plate, 3.8, 2.6), full(len(p), 0.3)
    return Model(parts, [mat(m)], (-6, 6, -2.5, 2.5, -0.5, 13))


def bills(ramp):
    def parts(P):
        T = rot_x(P - [0, 0, 4], FACE_TILT)
        a = rbox(rot_z(T, 0.25), (0, 0, 0), (6.0, 0.6, 3.2), 0.3)
        b = rbox(rot_z(T, -0.15), (0.5, 1.3, 0.4), (6.0, 0.6, 3.2), 0.3)
        return [np.minimum(a, b)]
    def m(p, n):
        T = rot_z(rot_x(p - [0, 0, 4], FACE_TILT), -0.15)
        mark = (T[:, 1] > 1.6) & (np.sqrt((T[:, 0] - 0.5) ** 2 + (T[:, 2] - 0.4) ** 2) < 1.5)
        return np.where(mark, ramp, ramp), np.where(mark, 2.0, 3.6), full(len(p), 0.1)
    return Model(parts, [mat(m)], (-7.5, 7.5, -6, 6, -4, 10))


FACE_TILT = -0.6155   # with ang -45 degrees, local +y then points straight at the camera (1, 1, 1)


def facing(P, c=(0, 0, 6)):
    """Model space of a flat badge whose front (+y) faces the camera."""
    return rot_x(P - np.asarray(c, float), FACE_TILT)


def disc(Q, r, t=0.8):
    return cyl_y_soft(Q, (0, 0, 0), r, t)


def sun():
    def parts(P):
        Q = facing(P)
        core = disc(Q, 3.4, 1.0)
        rays = np.minimum.reduce([capsule(Q, (4.6 * np.cos(a), 0, 4.6 * np.sin(a)), (6.6 * np.cos(a), 0, 6.6 * np.sin(a)), 0.9, 0.5)
                                  for a in np.linspace(0, 2 * np.pi, 8, endpoint=False)])
        return [core, rays]
    return Model(parts, [solid('khaki', 4.7, 0.4), solid('khaki', 4.1)], (-8, 8, -8, 8, -2, 14))


def moon():
    def parts(P):
        Q = facing(P)
        return [np.maximum(disc(Q, 5.6, 1.0), -cyl_y_soft(Q, (2.6, 0, 1.8), 4.6, 2.0))]
    return Model(parts, [solid('lavlt', 4.3, 0.3)], (-7, 7, -7, 7, -2, 14))


def pump():
    def parts(P):
        body = rbox(P, (0, 0, 6), (4.0, 2.6, 6.0), 0.8)
        screen = rbox(P, (0, 2.4, 9.0), (2.8, 0.4, 1.8), 0.2)
        hose = np.minimum(capsule(P, (4.0, 0, 8.5), (5.6, 0, 6.0), 0.8), capsule(P, (5.6, 0, 6.0), (5.6, 0, 2.0), 0.8))
        return [body, screen, hose]
    return Model(parts, [solid('red', 3.0), solid('glass', 3.6, 0.8), solid('night', 2.2)], (-4.5, 6.5, -3.2, 3.2, 0, 12.5))


def wrench_small():
    def parts(P):
        a = 0.8
        shaft = capsule(P, (-5 * np.cos(a), 0, -5 * np.sin(a) + 6), (4 * np.cos(a), 0, 4 * np.sin(a) + 6), 1.0)
        hc = np.array([5.6 * np.cos(a), 0, 5.6 * np.sin(a) + 6])
        head = np.maximum(cyl_y_soft(P, hc, 2.6, 1.0), -cyl_y_soft(P, hc + [1.2 * np.cos(a), 0, 1.2 * np.sin(a)], 1.4, 2.0))
        return [smin(shaft, head, 0.6)]
    return Model(parts, [solid('blueg', 4.0, 0.9)], (-6, 7, -1.5, 1.5, 0, 13))


# ------------------------------------------------------------------ portraits
def rot_y(P, a):
    c, s = np.cos(a), np.sin(a)
    return np.stack([P[:, 0] * c + P[:, 2] * s, P[:, 1], -P[:, 0] * s + P[:, 2] * c], 1)


def bust(model, z0=28.0, tilt=-0.5):
    """Head and shoulders: the person model cut below the chest and leaned back so the face meets the camera."""
    pivot = np.array([0.0, 0.0, 30.0])
    def tr(P):
        return rot_y(P - pivot, -tilt) + pivot
    def parts(P):
        Q = tr(P)
        return [np.maximum(d, z0 - Q[:, 2]) for d in model.parts(Q)]
    mats = [(lambda f: (lambda p, n: f(tr(p), n)))(m) if callable(m) else m for m in model.mats]
    x0, x1, y0, y1, _, z1 = model.bbox
    return Model(parts, mats, (x0 - 4, x1 + 4, y0, y1, z0 - 4, z1 + 2))


FACES = {
    'hollis': lambda: humans.human(skin_tone=3.0, upper=('navy', 2.0), hair=('night', 1.2), hair_style='bun', jacket=True),
    'dez': lambda: humans.human(skin_tone=1.8, upper=('night', 2.2), hair=('night', 0.8), vest=('plum', 2.6)),
    'marlo': lambda: humans.human(skin_tone=2.5, upper=('khaki', 2.2), hair=('wood', 1.0), hat='cap'),
    'hr': lambda: humans.human(skin_tone=3.2, upper=('teal', 2.4), hair=('khaki', 2.8), hair_style='long', jacket=True),
    'landlord': lambda: humans.human(skin_tone=2.6, upper=('wood', 2.2), hair=('white', 3.0), hair_style='bald'),
    'player': lambda: humans.office_worker(),
}

# name -> (model factory, view angle, cell size)
ICONS = {
    'item/soda': (soda, 0.6, 32), 'item/chips': (chips, -0.6, 32), 'item/sandwich': (sandwich, 0.8, 32),
    'item/fuel_can': (fuel_can, 0.4, 32), 'item/first_aid': (first_aid, -0.6, 32), 'item/lockpicks': (lockpicks, -0.6, 32),
    'item/toolbox': (toolbox, 0.6, 32), 'item/repair_kit': (repair_kit, -0.6, 32), 'item/phone': (phone, -0.6, 32),
    'item/wallet': (wallet, -0.6, 32), 'item/cash': (cash, 0.5, 32), 'item/watch': (watch, -0.6, 32),
    'item/junk': (junk, 0.3, 32),
    'app/messages': (envelope, -0.6, 40), 'app/bank': (bank, 0.6, 40), 'app/jobs': (clipboard, -0.6, 40),
    'app/contacts': (address_book, -0.6, 40),
    'job/lumber': (axe, -0.6, 32), 'job/delivery': (parcel, 0.6, 32), 'app/bag': (duffel, 0.5, 40), 'app/shelter': (cot, 0.6, 40),
    'hud/health': (heart, -0.785, 16), 'hud/armor': (vest, -0.6, 16), 'hud/clean': (lambda: bills('sage'), -0.785, 16),
    'hud/dirty': (lambda: bills('red'), -0.785, 16), 'hud/sun': (sun, -0.785, 16), 'hud/moon': (moon, -0.785, 16),
    'hud/fuel': (pump, -0.6, 16), 'hud/condition': (wrench_small, -0.6, 16),
}
for k, f in FACES.items():
    ICONS[f'face/{k}'] = ((lambda f=f: bust(f())), 0.785, 32)


def fit(factory, ang, size):
    """Render, then re-render scaled so the icon fills its cell (1 px margin), centred."""
    m = factory()
    img, _, _ = render(m, ang=ang, ss=3, pad=2)
    ys, xs = np.nonzero(img[..., 3])
    h, w = ys.max() - ys.min() + 1, xs.max() - xs.min() + 1
    s = (size - 2) / max(h, w)
    for _ in range(4):
        img, _, _ = render(scaled(m, s), ang=ang, ss=3, pad=2)
        ys, xs = np.nonzero(img[..., 3])
        h, w = ys.max() - ys.min() + 1, xs.max() - xs.min() + 1
        if max(h, w) <= size - 1:
            break
        s *= (size - 2) / max(h, w)
    crop = img[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    cell = np.zeros((size, size, 4), np.uint8)
    oy, ox = (size - crop.shape[0]) // 2, (size - crop.shape[1]) // 2
    cell[oy:oy + crop.shape[0], ox:ox + crop.shape[1]] = crop
    return cell


def main():
    names = list(ICONS)
    only = sys.argv[1].split(',') if len(sys.argv) > 1 else None
    cells = {}
    for n in names:
        if only and not any(n.startswith(o) for o in only):
            continue
        f, ang, size = ICONS[n]
        cells[n] = fit(f, ang, size)
        print('rendered', n)
    if only:
        sheet_preview(cells)
        return
    # pack in rows by size, 42 px pitch
    W = 42 * 8
    x = y = row_h = 0
    frames = {}
    for n in names:
        c = cells[n]
        h, w = c.shape[:2]
        if x + w > W:
            x, y = 0, y + row_h + 2
            row_h = 0
        frames[n] = {'x': x, 'y': y, 'w': w, 'h': h}
        x += w + 2
        row_h = max(row_h, h)
    atlas = np.zeros((y + row_h, W, 4), np.uint8)
    for n, fr in frames.items():
        atlas[fr['y']:fr['y'] + fr['h'], fr['x']:fr['x'] + fr['w']] = cells[n]
    Image.fromarray(atlas, 'RGBA').save(os.path.join(ROOT, 'art', 'ui_icons.png'))
    json.dump({'image': 'ui_icons.png', 'frames': frames}, open(os.path.join(ROOT, 'art', 'ui_icons.json'), 'w'), indent=1)
    sheet_preview(cells)
    print('wrote art/ui_icons.png', atlas.shape)


def sheet_preview(cells):
    """Every icon at 4x on a plate background, for checking by eye."""
    names = list(cells)
    cols = 8
    rows = (len(names) + cols - 1) // cols
    pv = np.zeros((rows * 44, cols * 44, 4), np.uint8)
    pv[...] = (45, 34, 46, 255)
    for k, n in enumerate(names):
        c = cells[n]
        y, x = (k // cols) * 44 + 2, (k % cols) * 44 + 2
        a = c[..., 3:4] / 255.0
        sub = pv[y:y + c.shape[0], x:x + c.shape[1], :3]
        pv[y:y + c.shape[0], x:x + c.shape[1], :3] = (c[..., :3] * a + sub * (1 - a)).astype(np.uint8)
    Image.fromarray(pv).resize((pv.shape[1] * 4, pv.shape[0] * 4), Image.NEAREST).save(
        os.path.join(ROOT, 'art', 'drafts', 'hud', 'ui_icons_sheet.png'))


if __name__ == '__main__':
    main()

"""Geometry helpers for authoring outdoor maps in world units: rounded blocks, curves, strokes and arcs.

Everything returns plain polygons ([[x, y], ...] in world units) for ground_vec.py and the game's vector ground.
"""
import numpy as np

T = 32.0


def arc(cx, cy, r, a0, a1, step=6.0):
    """Points on an arc from angle a0 to a1 (radians), about every `step` units."""
    n = max(2, int(np.ceil(abs(a1 - a0) * r / step)) + 1)
    a = np.linspace(a0, a1, n)
    return [[cx + r * np.cos(t), cy + r * np.sin(t)] for t in a]


def disc(cx, cy, r, step=5.0):
    return arc(cx, cy, r, 0, 2 * np.pi, step)[:-1]


def ellipse(cx, cy, rx, ry, step=5.0):
    n = max(12, int(np.ceil(2 * np.pi * max(rx, ry) / step)))
    a = np.linspace(0, 2 * np.pi, n, endpoint=False)
    return [[cx + rx * np.cos(t), cy + ry * np.sin(t)] for t in a]


def rect(x0, y0, x1, y1):
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]


def round_corners(poly, radius, which=None, step=5.0):
    """Replace the chosen convex corners (indices into poly) with arcs of `radius` tangent to both edges."""
    P = [np.asarray(p, float) for p in poly]
    n = len(P)
    which = set(range(n)) if which is None else set(which)
    out = []
    for i in range(n):
        p = P[i]
        if i not in which or radius <= 0:
            out.append(list(p)); continue
        a = P[i - 1]; b = P[(i + 1) % n]
        d1 = a - p; d2 = b - p
        l1 = np.linalg.norm(d1); l2 = np.linalg.norm(d2)
        d1 /= l1; d2 /= l2
        cosang = np.clip(d1 @ d2, -1, 1)
        ang = np.arccos(cosang)
        if ang > np.pi - 0.05:
            out.append(list(p)); continue
        t = radius / np.tan(ang / 2)
        t = min(t, l1 * 0.5, l2 * 0.5)
        r = t * np.tan(ang / 2)
        s = p + d1 * t; e = p + d2 * t
        bis = d1 + d2; bis /= np.linalg.norm(bis)
        c = p + bis * (r / np.sin(ang / 2))
        a0 = np.arctan2(s[1] - c[1], s[0] - c[0]); a1 = np.arctan2(e[1] - c[1], e[0] - c[0])
        da = (a1 - a0 + np.pi) % (2 * np.pi) - np.pi
        out.extend(arc(c[0], c[1], r, a0, a0 + da, step))
    return out


def stroke(line, width, cap=0.0):
    """A polyline thickened to `width` as one polygon (left side, then the right side reversed)."""
    L = np.asarray(line, float)
    if len(L) < 2:
        return []
    d = np.gradient(L, axis=0)
    d /= np.linalg.norm(d, axis=1)[:, None]
    nrm = np.stack([-d[:, 1], d[:, 0]], 1)
    if cap:
        L = L.copy(); L[0] -= d[0] * cap; L[-1] += d[-1] * cap
    left = L + nrm * width / 2; right = L - nrm * width / 2
    return [list(p) for p in left] + [list(p) for p in right[::-1]]


def resample(line, step):
    """Points along a polyline every `step` units (keeps the end point)."""
    L = np.asarray(line, float)
    seg = np.linalg.norm(np.diff(L, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)])
    t = np.arange(0, s[-1], step)
    t = np.append(t, s[-1])
    return np.stack([np.interp(t, s, L[:, 0]), np.interp(t, s, L[:, 1])], 1)


def dashes(line, width, on, off, phase=0.0):
    """Dashed stroke: a list of polygons."""
    L = np.asarray(line, float)
    seg = np.linalg.norm(np.diff(L, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)])
    out = []
    t = -phase
    while t < s[-1]:
        a, b = max(0, t), min(s[-1], t + on)
        if b > a + 0.5:
            ts = np.linspace(a, b, max(2, int((b - a) / 4) + 1))
            pts = np.stack([np.interp(ts, s, L[:, 0]), np.interp(ts, s, L[:, 1])], 1)
            out.append(stroke(pts, width))
        t += on + off
    return out


def offset(line, dist):
    """Offset a polyline sideways by `dist` (positive = left of the direction of travel)."""
    L = np.asarray(line, float)
    d = np.gradient(L, axis=0)
    d /= np.linalg.norm(d, axis=1)[:, None]
    nrm = np.stack([-d[:, 1], d[:, 0]], 1)
    return L + nrm * dist


def along(line, step, start=0.0, end=None):
    """(point, unit direction) every `step` units along a polyline."""
    L = np.asarray(line, float)
    seg = np.linalg.norm(np.diff(L, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)])
    end = s[-1] if end is None else min(end, s[-1])
    out = []
    t = start
    while t <= end + 1e-6:
        x = np.interp(t, s, L[:, 0]); y = np.interp(t, s, L[:, 1])
        k = min(len(seg) - 1, max(0, np.searchsorted(s, t) - 1))
        d = (L[k + 1] - L[k]) / max(seg[k], 1e-9)
        out.append((np.array([x, y]), d, t))
        t += step
    return out


def point_in_poly(x, y, poly):
    P = np.asarray(poly, float)
    xs, ys = P[:, 0], P[:, 1]
    xs2, ys2 = np.roll(xs, -1), np.roll(ys, -1)
    c = ((ys <= y) & (ys2 > y)) | ((ys2 <= y) & (ys > y))
    with np.errstate(divide='ignore', invalid='ignore'):
        xi = xs + (y - ys) * (xs2 - xs) / (ys2 - ys)
    return int(np.sum(c & (x < xi))) % 2 == 1

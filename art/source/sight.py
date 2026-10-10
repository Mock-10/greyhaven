"""Line-of-sight for interiors: which cells the player can see, remembers, or has never seen.

Model (same as the game should use):
  * Walls = partition lines. Closed doors block sight. Open doorways, gates (bars) and glass do not.
  * The player's current room is always fully visible.
  * Other cells are visible if an unblocked ray reaches them from the player's eye.
  * Cells of rooms seen before (and not visible now) are REMEMBERED: static furniture dimmed,
    live things (people, loot, alarms state) hidden.
  * Everything else is UNSEEN: covered by a dark lid at the height of the cut walls.
"""
import numpy as np

VIS, MEM, HID = 2, 1, 0
CELL = 8


def wall_lines(partitions, closed=(), with_gaps_closed=False):
    """Return list of (axis, pos, a0, a1) solid segments."""
    out = []
    for (axis, pos, a0, a1, gaps) in partitions:
        if with_gaps_closed:
            out.append((axis, pos, a0, a1))
            continue
        cur = a0
        for (g0, g1) in sorted(gaps):
            if g0 > cur:
                out.append((axis, pos, cur, g0))
            cur = max(cur, g1)
        if cur < a1:
            out.append((axis, pos, cur, a1))
    for (axis, pos, g0, g1) in closed:
        out.append((axis, pos, g0, g1))
    return out


def _blocked(vx, vy, cx, cy, lines):
    """Vectorised: is the segment V->C blocked by any line?"""
    b = np.zeros(cx.shape, bool)
    for (axis, pos, a0, a1) in lines:
        if axis == 'x':
            s = (vy - pos) * (cy - pos)
            cross = s < 0
            t = np.where(cross, (pos - vy) / np.where(cy - vy == 0, 1e-9, cy - vy), 0)
            xa = vx + t * (cx - vx)
            b |= cross & (xa >= a0) & (xa <= a1)
        else:
            s = (vx - pos) * (cx - pos)
            cross = s < 0
            t = np.where(cross, (pos - vx) / np.where(cx - vx == 0, 1e-9, cx - vx), 0)
            ya = vy + t * (cy - vy)
            b |= cross & (ya >= a0) & (ya <= a1)
    return b


def room_of(px, py, W, D, all_walls):
    """Flood fill the room containing (px,py) with every doorway treated as a wall."""
    nx, ny = int(W // CELL), int(D // CELL)
    seen = np.zeros((nx, ny), bool)
    sx, sy = int(px // CELL), int(py // CELL)
    stack = [(sx, sy)]
    seen[sx, sy] = True
    while stack:
        i, j = stack.pop()
        c = np.array([(i + 0.5) * CELL]), np.array([(j + 0.5) * CELL])
        for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            a, b_ = i + di, j + dj
            if 0 <= a < nx and 0 <= b_ < ny and not seen[a, b_]:
                if not _blocked(c[0][0], c[1][0], np.array([(a + 0.5) * CELL]), np.array([(b_ + 0.5) * CELL]), all_walls)[0]:
                    seen[a, b_] = True
                    stack.append((a, b_))
    return seen


def labels(W, D, partitions):
    """Room id per cell (flood fill with every doorway treated as a wall)."""
    allw = wall_lines(partitions, (), with_gaps_closed=True)
    nx, ny = int(W // CELL), int(D // CELL)
    lab = np.full((nx, ny), -1, int)
    rid = 0
    for i in range(nx):
        for j in range(ny):
            if lab[i, j] < 0:
                m = room_of((i + 0.5) * CELL, (j + 0.5) * CELL, W, D, allw)
                lab[m & (lab < 0)] = rid
                rid += 1
    return lab


def compute(W, D, partitions, viewer, closed=(), remembered_points=(), view_range=420):
    nx, ny = int(W // CELL), int(D // CELL)
    gi, gj = np.mgrid[0:nx, 0:ny]
    cx = (gi + 0.5) * CELL; cy = (gj + 0.5) * CELL
    vx, vy = viewer
    lines = wall_lines(partitions, closed)
    allw = wall_lines(partitions, (), with_gaps_closed=True)
    vis = ~_blocked(vx, vy, cx, cy, lines) & (np.hypot(cx - vx, cy - vy) <= view_range)
    vis |= room_of(vx, vy, W, D, allw)
    state = np.full((nx, ny), HID, np.int8)
    for (rx, ry) in remembered_points:
        state[room_of(rx, ry, W, D, allw)] = MEM
    state[vis] = VIS
    return state


def cell_state(state, wx, wy):
    nx, ny = state.shape
    i = min(max(int(wx // CELL), 0), nx - 1); j = min(max(int(wy // CELL), 0), ny - 1)
    return state[i, j]

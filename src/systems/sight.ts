// Line of sight inside buildings (docs/19), ported from art/source/sight.py.
//  - The room is a grid of 8-unit cells. Walls are partition lines; closed doors are extra lines in their gap.
//  - The player's current room (flood fill with every doorway treated as a wall) is always visible.
//  - Other cells are visible when an unblocked ray reaches their centre (within the indoor sight range).
//  - Cells of rooms seen before and not visible now are remembered; everything else is unseen.
// Pure code, no Phaser: the same rules apply to NPC sight later.

export const CELL = 8;
export const VIS = 2;
export const MEM = 1;
export const HID = 0;

export type Axis = 'x' | 'y';

/** A wall line: along `axis` at the other coordinate `pos`, from a0 to a1. 'x' runs along x at y = pos. */
export interface Line {
  axis: Axis;
  pos: number;
  a0: number;
  a1: number;
}

export interface Partition {
  axis: Axis;
  pos: number;
  a0: number;
  a1: number;
  gaps: [number, number][];
}

/** Solid wall pieces of the partitions (gaps left open), plus closed doors filling their gaps. */
export function wallLines(
  partitions: readonly Partition[],
  closed: readonly Line[] = [],
  gapsClosed = false,
): Line[] {
  const out: Line[] = [];
  for (const p of partitions) {
    if (gapsClosed) {
      out.push({ axis: p.axis, pos: p.pos, a0: p.a0, a1: p.a1 });
      continue;
    }
    let cur = p.a0;
    for (const [g0, g1] of [...p.gaps].sort((a, b) => a[0] - b[0])) {
      if (g0 > cur) out.push({ axis: p.axis, pos: p.pos, a0: cur, a1: g0 });
      cur = Math.max(cur, g1);
    }
    if (cur < p.a1) out.push({ axis: p.axis, pos: p.pos, a0: cur, a1: p.a1 });
  }
  return out.concat(closed);
}

/** Is the segment from (vx, vy) to (cx, cy) blocked by any line? */
export function blocked(vx: number, vy: number, cx: number, cy: number, lines: readonly Line[]): boolean {
  for (const l of lines) {
    if (l.axis === 'x') {
      if ((vy - l.pos) * (cy - l.pos) >= 0) continue;
      const t = (l.pos - vy) / (cy - vy);
      const xa = vx + t * (cx - vx);
      if (xa >= l.a0 && xa <= l.a1) return true;
    } else {
      if ((vx - l.pos) * (cx - l.pos) >= 0) continue;
      const t = (l.pos - vx) / (cx - vx);
      const ya = vy + t * (cy - vy);
      if (ya >= l.a0 && ya <= l.a1) return true;
    }
  }
  return false;
}

export interface Grid {
  nx: number;
  ny: number;
}

export function gridOf(W: number, D: number): Grid {
  return { nx: Math.floor(W / CELL), ny: Math.floor(D / CELL) };
}

const idx = (g: Grid, i: number, j: number) => i * g.ny + j;

/** Room id per cell: flood fill with every doorway treated as a wall. */
export function roomLabels(W: number, D: number, partitions: readonly Partition[]): Int32Array {
  const g = gridOf(W, D);
  const walls = wallLines(partitions, [], true);
  const lab = new Int32Array(g.nx * g.ny).fill(-1);
  let rid = 0;
  for (let i = 0; i < g.nx; i++) {
    for (let j = 0; j < g.ny; j++) {
      if ((lab[idx(g, i, j)] as number) >= 0) continue;
      const stack: [number, number][] = [[i, j]];
      lab[idx(g, i, j)] = rid;
      while (stack.length) {
        const [a, b] = stack.pop() as [number, number];
        const cx = (a + 0.5) * CELL;
        const cy = (b + 0.5) * CELL;
        for (const [da, db] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const na = a + da;
          const nb = b + db;
          if (na < 0 || nb < 0 || na >= g.nx || nb >= g.ny || (lab[idx(g, na, nb)] as number) >= 0) continue;
          if (blocked(cx, cy, (na + 0.5) * CELL, (nb + 0.5) * CELL, walls)) continue;
          lab[idx(g, na, nb)] = rid;
          stack.push([na, nb]);
        }
      }
      rid++;
    }
  }
  return lab;
}

export function cellOf(g: Grid, x: number, y: number): { i: number; j: number } {
  return {
    i: Math.min(Math.max(Math.floor(x / CELL), 0), g.nx - 1),
    j: Math.min(Math.max(Math.floor(y / CELL), 0), g.ny - 1),
  };
}

export function roomAt(labels: Int32Array, g: Grid, x: number, y: number): number {
  const c = cellOf(g, x, y);
  return labels[idx(g, c.i, c.j)] as number;
}

/**
 * Visibility per cell (VIS / MEM / HID) for a viewer. `remembered` lists room ids seen before.
 * Returns the state grid and the rooms that are (at least partly) visible now.
 */
export function computeSight(
  W: number,
  D: number,
  partitions: readonly Partition[],
  labels: Int32Array,
  viewer: { x: number; y: number },
  closed: readonly Line[],
  remembered: ReadonlySet<number>,
  range = 420,
): { state: Uint8Array; visibleRooms: Set<number> } {
  const g = gridOf(W, D);
  const lines = wallLines(partitions, closed);
  const here = roomAt(labels, g, viewer.x, viewer.y);
  const state = new Uint8Array(g.nx * g.ny);
  const visibleRooms = new Set<number>([here]);
  for (let i = 0; i < g.nx; i++) {
    for (let j = 0; j < g.ny; j++) {
      const k = idx(g, i, j);
      const room = labels[k] as number;
      const cx = (i + 0.5) * CELL;
      const cy = (j + 0.5) * CELL;
      const vis =
        room === here ||
        (Math.hypot(cx - viewer.x, cy - viewer.y) <= range && !blocked(viewer.x, viewer.y, cx, cy, lines));
      if (vis) {
        state[k] = VIS;
        visibleRooms.add(room);
      } else state[k] = remembered.has(room) ? MEM : HID;
    }
  }
  return { state, visibleRooms };
}

export function stateAt(state: Uint8Array, g: Grid, x: number, y: number): number {
  const c = cellOf(g, x, y);
  return state[idx(g, c.i, c.j)] as number;
}

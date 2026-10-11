// Pedestrians (docs/01 "NPC crowd", milestone 4): people walk the sidewalk paths, cross to the next sidewalk at
// the corners, flee from crime and call it in when they saw it (the call itself is handled by systems/wanted.ts).
// Pure code: positions and modes only, the view lives in world/streetLife.ts.

import { BALANCE } from '../config/balance';
import type { Rng } from '../core/rng';
import { makePath, nearestOn, pointAt, type Path } from './paths';

export type PedMode = 'walk' | 'cross' | 'flee' | 'call';

export interface Ped {
  id: number;
  costume: string;
  path: number;
  s: number;
  dir: 1 | -1;
  speed: number;
  x: number;
  y: number;
  /** Facing, a unit vector in world space. */
  fx: number;
  fy: number;
  mode: PedMode;
  /** Crossing: the point walked to, then the path and end joined there. */
  cross: { x: number; y: number; path: number; s: number; dir: 1 | -1 } | null;
  /** Fleeing: from where, and for how much longer. */
  threat: { x: number; y: number } | null;
  fleeT: number;
}

export interface Link {
  path: number;
  /** Which end of that path: its start or its end. */
  atEnd: boolean;
}

export interface Walkways {
  paths: Path[];
  /** links[path][0] from the path's start, links[path][1] from its end. */
  links: [Link[], Link[]][];
}

export function buildWalkways(raw: readonly [number, number][][], reach = BALANCE.crowd.linkReach): Walkways {
  const paths = raw.map((pts) => makePath(pts));
  const end = (p: Path, atEnd: boolean) => pointAt(p, atEnd ? p.len : 0);
  const links = paths.map(
    (p, i) =>
      ([false, true] as const).map((fromEnd) => {
        const a = end(p, fromEnd);
        const out: Link[] = [];
        paths.forEach((q, j) => {
          if (j === i) return;
          for (const atEnd of [false, true]) {
            const b = end(q, atEnd);
            if (Math.hypot(a.x - b.x, a.y - b.y) <= reach) out.push({ path: j, atEnd });
          }
        });
        return out;
      }) as [Link[], Link[]],
  );
  return { paths, links };
}

export function spawnPed(w: Walkways, id: number, costume: string, path: number, s: number, rng: Rng): Ped {
  const C = BALANCE.crowd;
  const p = pointAt(w.paths[path] as Path, s);
  const dir = rng.chance(0.5) ? 1 : -1;
  return {
    id,
    costume,
    path,
    s,
    dir,
    speed: C.walkSpeed * (1 + (rng.next() * 2 - 1) * C.walkVariance),
    x: p.x,
    y: p.y,
    fx: p.dx * dir,
    fy: p.dy * dir,
    mode: 'walk',
    cross: null,
    threat: null,
    fleeT: 0,
  };
}

/** Send someone running away from a threat (a crime, a crash, a car driving at them). */
export function startFlee(ped: Ped, from: { x: number; y: number }): void {
  if (ped.mode === 'call') return;
  ped.mode = 'flee';
  ped.threat = { ...from };
  ped.fleeT = BALANCE.crowd.fleeSeconds;
}

/** One step for one person. `blocked` tells whether a world point is inside something solid. */
export function stepPed(
  ped: Ped,
  w: Walkways,
  dt: number,
  rng: Rng,
  blocked?: (x: number, y: number) => boolean,
): void {
  const C = BALANCE.crowd;
  if (ped.mode === 'call') return;
  if (ped.mode === 'flee') {
    const t = ped.threat as { x: number; y: number };
    const dx = ped.x - t.x;
    const dy = ped.y - t.y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = ped.x + (dx / d) * C.fleeSpeed * dt;
    const ny = ped.y + (dy / d) * C.fleeSpeed * dt;
    if (!blocked?.(nx, ny)) {
      ped.x = nx;
      ped.y = ny;
    }
    ped.fx = dx / d;
    ped.fy = dy / d;
    ped.fleeT -= dt;
    if (ped.fleeT <= 0) rejoin(ped, w);
    return;
  }
  if (ped.mode === 'cross' && ped.cross) {
    const c = ped.cross;
    const dx = c.x - ped.x;
    const dy = c.y - ped.y;
    const d = Math.hypot(dx, dy);
    const step = ped.speed * dt;
    if (d <= step) {
      ped.path = c.path;
      ped.s = c.s;
      ped.dir = c.dir;
      ped.mode = 'walk';
      ped.cross = null;
    } else {
      ped.x += (dx / d) * step;
      ped.y += (dy / d) * step;
      ped.fx = dx / d;
      ped.fy = dy / d;
    }
    return;
  }
  const path = w.paths[ped.path] as Path;
  ped.s += ped.dir * ped.speed * dt;
  if (ped.s < 0 || ped.s > path.len) {
    const atEnd = ped.s > path.len;
    ped.s = atEnd ? path.len : 0;
    const options = (w.links[ped.path] as [Link[], Link[]])[atEnd ? 1 : 0];
    if (options.length && !rng.chance(C.turnBackChance)) {
      const l = options[rng.int(0, options.length - 1)] as Link;
      const q = w.paths[l.path] as Path;
      const s = l.atEnd ? q.len : 0;
      const p = pointAt(q, s);
      ped.mode = 'cross';
      ped.cross = { x: p.x, y: p.y, path: l.path, s, dir: l.atEnd ? -1 : 1 };
      return;
    }
    ped.dir = atEnd ? -1 : 1;
  }
  const p = pointAt(path, ped.s);
  ped.x = p.x;
  ped.y = p.y;
  ped.fx = p.dx * ped.dir;
  ped.fy = p.dy * ped.dir;
}

/** Back onto the nearest sidewalk after fleeing. */
function rejoin(ped: Ped, w: Walkways): void {
  let best = { path: 0, s: 0, d: Infinity };
  w.paths.forEach((p, i) => {
    const n = nearestOn(p, ped.x, ped.y);
    if (n.d < best.d) best = { path: i, s: n.s, d: n.d };
  });
  const p = pointAt(w.paths[best.path] as Path, best.s);
  ped.mode = 'cross';
  ped.threat = null;
  ped.cross = { x: p.x, y: p.y, path: best.path, s: best.s, dir: ped.dir };
}

/** How many people should be about at this minute of the day. */
export function crowdTarget(minuteOfDay: number): number {
  const h = Math.floor(minuteOfDay / 60) % 24;
  return BALANCE.crowd.byHour[h] as number;
}

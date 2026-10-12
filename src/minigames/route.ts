// Route (delivery, docs/06): three routes are drawn over the street grid from the depot to the drop; pick the shortest
// (keys 1–3 or a click) within 5 seconds. A few drops per task. Every route runs along the streets, so its length is
// the number of blocks it covers: the shortest stays between the start and end rows, the others swing wide.

import { BALANCE_JOBS } from '../config/balanceJobs';
import type { Rng } from '../core/rng';
import type { Grade } from '../systems/career';
import type { MinigameLogic } from './logic';
import { shareGrade } from './jobGrade';

export interface GridPoint {
  x: number;
  y: number;
}

export interface Route {
  /** Corners along the streets, in grid blocks, from the depot (x = 0) to the drop (x = gridW). */
  points: GridPoint[];
  /** Length in blocks. */
  length: number;
}

export interface RouteRound {
  routes: Route[];
  /** Index of the shortest route. */
  best: number;
}

/** Length of a path along the streets, in blocks. */
export function routeLength(points: readonly GridPoint[]): number {
  let n = 0;
  for (let k = 1; k < points.length; k++) {
    const a = points[k - 1] as GridPoint;
    const b = points[k] as GridPoint;
    n += Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
  }
  return n;
}

/** Depot row `ay` to drop row `by`, turning down street x1 to row `wy`, then down street x2 to the drop's row. */
function path(W: number, ay: number, by: number, wy: number, x1: number, x2: number): GridPoint[] {
  const raw = [
    { x: 0, y: ay },
    { x: x1, y: ay },
    { x: x1, y: wy },
    { x: x2, y: wy },
    { x: x2, y: by },
    { x: W, y: by },
  ];
  // drop repeated corners and corners in the middle of a straight run
  const pts = raw.filter((p, k) => k === 0 || p.x !== raw[k - 1]!.x || p.y !== raw[k - 1]!.y);
  return pts.filter((p, k) => {
    const a = pts[k - 1];
    const b = pts[k + 1];
    if (!a || !b) return true;
    return !((a.x === p.x && p.x === b.x) || (a.y === p.y && p.y === b.y));
  });
}

export function makeRound(rng: Rng): RouteRound {
  const R = BALANCE_JOBS.route;
  const W = R.gridW;
  const H = R.gridH;
  // depot and drop rows sit in the middle band, so every route has room to swing wide above and below
  const ay = rng.int(2, H - 2);
  const by = rng.int(2, H - 2);
  const lo = Math.min(ay, by);
  const hi = Math.max(ay, by);
  const between = rng.int(lo, hi);
  const wide = (d: number) =>
    rng.chance(0.5) ? (lo - d >= 0 ? lo - d : hi + d) : hi + d <= H ? hi + d : lo - d;
  // the shortest, one 2 blocks longer, and one 2 or 4 longer (on the other side when it can be)
  const near = wide(1);
  let far = rng.chance(0.5) ? wide(1) : wide(2);
  if (far === near) far = near < lo ? hi + 1 : lo - 1;
  const rows = [between, near, far];
  const used = new Set<string>();
  const routes = rows.map((wy) => {
    let x1 = 1;
    let x2 = W - 1;
    for (let tries = 0; tries < 20; tries++) {
      x1 = rng.int(1, W - 3);
      x2 = rng.int(x1 + 1, W - 1);
      if (!used.has(`${x1},${x2}`)) break;
    }
    used.add(`${x1},${x2}`);
    const points = path(W, ay, by, wy, x1, x2);
    return { points, length: routeLength(points) };
  });
  const order = rng.shuffle([0, 1, 2]);
  const shuffled = order.map((k) => routes[k] as Route);
  return { routes: shuffled, best: order.indexOf(0) };
}

export class RouteGame implements MinigameLogic {
  readonly rounds: RouteRound[];
  round = 0;
  /** Whether each drop's pick was the shortest (a timeout counts as wrong). */
  readonly picks: boolean[] = [];
  /** Seconds taken over each pick. */
  readonly times: number[] = [];
  /** Seconds spent on the current drop. */
  t = 0;
  readonly seconds: number;
  last: { route: number; ok: boolean; t: number } | null = null;
  done = false;
  grade: Grade | null = null;

  constructor(rng: Rng) {
    const R = BALANCE_JOBS.route;
    this.rounds = Array.from({ length: R.rounds }, () => makeRound(rng));
    this.seconds = R.seconds;
  }

  get current(): RouteRound | null {
    return this.done ? null : (this.rounds[this.round] ?? null);
  }

  get right(): number {
    return this.picks.filter(Boolean).length;
  }

  /** Pick route `k` (0-based) for the current drop. */
  pick(k: number): void {
    const r = this.current;
    if (!r || k < 0 || k >= r.routes.length) return;
    this.record(k === r.best, k);
  }

  private record(ok: boolean, route: number): void {
    this.picks.push(ok);
    this.times.push(this.t);
    this.last = { route, ok, t: 0 };
    this.t = 0;
    this.round++;
    if (this.round >= this.rounds.length) this.finish();
  }

  private finish(): void {
    this.done = true;
    const avg = this.times.reduce((a, b) => a + b, 0) / Math.max(1, this.times.length);
    this.grade = shareGrade(this.right, this.rounds.length, avg <= BALANCE_JOBS.route.fastAvg);
  }

  update(dt: number): void {
    if (this.last) this.last.t += dt;
    if (this.done) return;
    this.t += dt;
    if (this.t >= this.seconds) {
      this.t = this.seconds;
      this.record(false, -1);
    }
  }
}

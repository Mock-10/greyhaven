// M7 lumberjack and delivery tasks (docs/06, docs/03): chop, load / stack and route.
import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { BALANCE_JOBS } from '../src/config/balanceJobs';
import { ChopGame } from '../src/minigames/chop';
import { LoadGame, type LoadMode } from '../src/minigames/load';
import { RouteGame, makeRound, routeLength } from '../src/minigames/route';

describe('chop', () => {
  /** Wait for the swing to finish, put the cursor `off` from the sweet spot and swing. */
  const swingAt = (g: ChopGame, off: number) => {
    g.update(1);
    g.cursor = Math.min(1, Math.max(0, g.spot + off));
    g.swing();
  };

  it('fells the tree in three great swings: excellent', () => {
    const g = new ChopGame(new Rng(1));
    while (!g.done) swingAt(g, 0);
    expect(g.swings).toBe(BALANCE_JOBS.chop.depth / 2);
    expect(g.grade).toBe('excellent');
  });

  it('is good with only good hits, ok with one glance, and fails when the swings run out', () => {
    const good = new ChopGame(new Rng(2));
    while (!good.done) swingAt(good, BALANCE_JOBS.chop.good - 0.01);
    expect(good.greats).toBe(0);
    expect(good.grade).toBe('good');

    const ok = new ChopGame(new Rng(3));
    swingAt(ok, 0.5);
    expect(ok.misses).toBe(1);
    while (!ok.done) swingAt(ok, 0);
    expect(ok.grade).toBe('ok');

    const fail = new ChopGame(new Rng(4));
    while (!fail.done) swingAt(fail, 0.6);
    expect(fail.swings).toBe(BALANCE_JOBS.chop.maxSwings);
    expect(fail.grade).toBe('fail');
  });

  it('ignores a swing while the axe is still moving, and speeds up after each swing', () => {
    const g = new ChopGame(new Rng(5));
    const v = g.speed;
    swingAt(g, 0);
    g.swing();
    expect(g.swings).toBe(1);
    expect(g.speed).toBeGreaterThan(v);
  });

  it('sweeps the cursor back and forth inside the bar', () => {
    const g = new ChopGame(new Rng(6));
    let max = 0;
    let min = 1;
    for (let k = 0; k < 600; k++) {
      g.update(1 / 60);
      max = Math.max(max, g.cursor);
      min = Math.min(min, g.cursor);
      expect(g.cursor).toBeGreaterThanOrEqual(0);
      expect(g.cursor).toBeLessThanOrEqual(1);
    }
    expect(max).toBeGreaterThan(0.95);
    expect(min).toBeLessThan(0.05);
  });
});

describe('load / stack', () => {
  /** A simple packer: drop each piece where it lands lowest (turning crates when that helps). */
  const pack = (g: LoadGame) => {
    while (!g.done) {
      let best = { x: 0, y: Infinity, turn: false };
      for (const turn of g.mode === 'crates' ? [false, true] : [false]) {
        if (turn) g.turn();
        const p = g.current!;
        for (let x = 0; x + p.w <= g.cols; x++) {
          const y = g.landing(p, x);
          if (y !== null && y + p.h < best.y) best = { x, y: y + p.h, turn };
        }
        if (turn) g.turn();
      }
      if (best.turn) g.turn();
      g.moveTo(best.x);
      g.drop();
    }
    return g;
  };

  it('fills about the share of the bed the balance asks for, with the right shapes', () => {
    for (const mode of ['crates', 'logs'] as LoadMode[]) {
      const g = new LoadGame(new Rng(1), mode);
      const cap = g.cols * g.rows;
      expect(g.totalCells).toBeLessThanOrEqual(cap * BALANCE_JOBS.load.fill);
      expect(g.totalCells).toBeGreaterThan(cap * BALANCE_JOBS.load.fill - 4);
      if (mode === 'logs') expect(g.queue.every((p) => p.h === 1 && p.w >= 2)).toBe(true);
    }
  });

  it('drops pieces onto the floor and onto each other', () => {
    const g = new LoadGame(new Rng(2), 'crates');
    const first = g.current!;
    g.moveTo(0);
    g.drop();
    expect(g.placed[0]).toMatchObject({ x: 0, y: 0 });
    expect(g.height(0)).toBe(first.h);
    g.moveTo(0);
    g.drop();
    expect(g.placed[1]!.y).toBe(first.h);
  });

  it('leaves behind a piece that would stick out over the top', () => {
    const g = new LoadGame(new Rng(3), 'logs');
    for (let k = 0; k < g.rows && !g.done; k++) {
      g.moveTo(0);
      g.drop();
    }
    expect(g.height(0)).toBe(g.rows);
    if (!g.done) {
      g.moveTo(0);
      g.drop();
      expect(g.leftBehind.length).toBe(1);
      expect(g.last?.ok).toBe(false);
    }
  });

  it('a careful packer loads everything for most seeds, and a careless one does worse', () => {
    let full = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const g = pack(new LoadGame(new Rng(seed), seed % 2 ? 'crates' : 'logs'));
      if (g.leftBehind.length === 0) {
        full++;
        expect(g.grade).toBe('excellent');
      }
    }
    expect(full).toBeGreaterThanOrEqual(25);
    const careless = new LoadGame(new Rng(4), 'crates');
    while (!careless.done) careless.drop();
    expect(['poor', 'fail']).toContain(careless.grade);
  });

  it('turns crates but not logs, and leaves the rest on the dock when time runs out', () => {
    const c = new LoadGame(new Rng(5), 'crates');
    while (c.current!.w === c.current!.h) c.drop();
    const p = c.current!;
    c.turn();
    expect(c.current).toEqual({ w: p.h, h: p.w });
    const l = new LoadGame(new Rng(6), 'logs');
    const before = l.current;
    l.turn();
    expect(l.current).toEqual(before);
    l.update(999);
    expect(l.leftBehind.length).toBe(l.queue.length);
    expect(l.grade).toBe('fail');
  });
});

describe('route', () => {
  it('draws three street routes with one clear shortest', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const r = makeRound(new Rng(seed));
      expect(r.routes.length).toBe(3);
      const lengths = r.routes.map((q) => q.length);
      const best = lengths[r.best]!;
      expect(lengths.filter((n) => n === best).length).toBe(1);
      expect(Math.min(...lengths)).toBe(best);
      for (const q of r.routes) {
        expect(q.length).toBe(routeLength(q.points));
        expect(q.points[0]!.x).toBe(0);
        expect(q.points.at(-1)!.x).toBe(BALANCE_JOBS.route.gridW);
        for (const p of q.points) {
          expect(p.y).toBeGreaterThanOrEqual(0);
          expect(p.y).toBeLessThanOrEqual(BALANCE_JOBS.route.gridH);
        }
        // along the streets only: every leg is straight
        q.points.slice(1).forEach((p, k) => {
          const a = q.points[k]!;
          expect(p.x === a.x || p.y === a.y).toBe(true);
        });
      }
      // the three routes start and end at the same places
      expect(new Set(r.routes.map((q) => `${q.points[0]!.y}/${q.points.at(-1)!.y}`)).size).toBe(1);
    }
  });

  it('grades quick right picks excellent, slow ones good, and times out a drop after five seconds', () => {
    const g = new RouteGame(new Rng(2));
    while (!g.done) {
      g.update(1);
      g.pick(g.current!.best);
    }
    expect(g.grade).toBe('excellent');

    const slow = new RouteGame(new Rng(3));
    while (!slow.done) {
      slow.update(3);
      slow.pick(slow.current!.best);
    }
    expect(slow.grade).toBe('good');

    const t = new RouteGame(new Rng(4));
    t.update(BALANCE_JOBS.route.seconds + 0.01);
    expect(t.picks).toEqual([false]);
    expect(t.round).toBe(1);
    t.pick(t.current!.best);
    t.pick(t.current!.best);
    expect(t.grade).toBe('ok');
  });

  it('fails when every pick is wrong', () => {
    const g = new RouteGame(new Rng(5));
    while (!g.done) g.pick((g.current!.best + 1) % 3);
    expect(g.grade).toBe('fail');
  });
});

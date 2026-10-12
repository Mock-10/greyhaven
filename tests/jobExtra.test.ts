// M7 follow-up tasks (docs/03): fell direction (lumberjack), doorstep and signature (delivery).
import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { BALANCE_JOBS } from '../src/config/balanceJobs';
import { FellGame, angleDiff } from '../src/minigames/fell';
import { DoorstepGame } from '../src/minigames/doorstep';
import { SignatureGame } from '../src/minigames/signature';

describe('fell direction', () => {
  /** Sweep the aim until the fall would land `off` degrees off the lane, then cut. */
  const cutAt = (g: FellGame, off: number) => {
    const tr = g.tree!;
    for (let k = 0; k < 10000; k++) {
      const fall = g.aim + tr.lean + tr.wind;
      if (Math.abs(angleDiff(fall, tr.lane) - off) < 0.6) break;
      g.update(1 / 240);
      g.t = 0; // keep the tree standing while the test hunts
    }
    g.cut();
  };

  it('measures angles the short way round', () => {
    expect(angleDiff(10, 350)).toBe(20);
    expect(angleDiff(350, 10)).toBe(-20);
    expect(FellGame.judge(3)).toBe('great');
    expect(FellGame.judge(-9)).toBe('good');
    expect(FellGame.judge(18)).toBe('ok');
    expect(FellGame.judge(40)).toBe('miss');
  });

  it('is excellent when every tree goes down the middle of the lane', () => {
    const g = new FellGame(new Rng(1));
    while (!g.done) cutAt(g, 0);
    expect(g.trees.every((t) => t.result === 'great')).toBe(true);
    expect(g.grade).toBe('excellent');
  });

  it('lets lean and wind push a straight aim off line', () => {
    const g = new FellGame(new Rng(2));
    const tr = g.tree!;
    g.offset = 0;
    g.cut();
    expect(angleDiff(tr.fall!, tr.lane)).toBeCloseTo(tr.lean + tr.wind, 5);
    expect(Math.abs(tr.lean)).toBeGreaterThanOrEqual(BALANCE_JOBS.fell.leanMin);
  });

  it('a tree left standing falls on its own, off the lane', () => {
    const g = new FellGame(new Rng(3));
    g.update(BALANCE_JOBS.fell.seconds + 0.01);
    expect(g.round).toBe(1);
    expect(g.trees[0]!.result).toBe('miss');
    while (!g.done) g.update(1);
    expect(g.grade).toBe('fail');
  });

  it('keeps the aim inside the sweep', () => {
    const g = new FellGame(new Rng(4));
    for (let k = 0; k < 500; k++) {
      g.update(1 / 60);
      g.t = 0;
      expect(Math.abs(g.offset)).toBeLessThanOrEqual(BALANCE_JOBS.fell.sweep + 1e-9);
    }
  });
});

describe('doorstep', () => {
  /** Walk to the parcel's door and hand it over, stepping in real time. */
  const deliver = (g: DoorstepGame) => {
    const want = g.parcels[g.parcel]!;
    while (g.at !== want) {
      g.move(want - g.at);
      g.update(BALANCE_JOBS.doorstep.stepTime);
    }
    g.deliver();
  };

  it('numbers the houses upwards with no repeats, and labels each parcel with one of them', () => {
    const g = new DoorstepGame(new Rng(1));
    expect(g.numbers.length).toBe(BALANCE_JOBS.doorstep.houses);
    g.numbers.slice(1).forEach((n, k) => expect(n).toBeGreaterThan(g.numbers[k]!));
    expect(new Set(g.parcels).size).toBe(BALANCE_JOBS.doorstep.parcels);
    expect(g.label).toBe(g.numbers[g.parcels[0]!]);
  });

  it('is excellent with no wrong doors, and counts a wrong door without losing the parcel', () => {
    const g = new DoorstepGame(new Rng(2));
    while (!g.done) deliver(g);
    expect(g.grade).toBe('excellent');

    const e = new DoorstepGame(new Rng(3));
    const want = e.parcels[0]!;
    if (e.at === want) e.move(want > 0 ? -1 : 1);
    e.update(1);
    e.deliver();
    expect(e.errors).toBe(1);
    expect(e.parcel).toBe(0);
    while (!e.done) deliver(e);
    expect(e.grade).toBe('good');
  });

  it('walks to a clicked door and hands the parcel over on arrival', () => {
    const g = new DoorstepGame(new Rng(4));
    const want = g.parcels[0]!;
    g.goTo(want);
    for (let k = 0; k < 20 && g.parcel === 0; k++) g.update(BALANCE_JOBS.doorstep.stepTime);
    expect(g.at).toBe(want);
    expect(g.parcel).toBe(1);
  });

  it('steps one house at a time and stops at the ends', () => {
    const g = new DoorstepGame(new Rng(5));
    const from = g.at;
    g.move(1);
    g.move(1);
    expect(Math.abs(g.at - from)).toBeLessThanOrEqual(1);
    for (let k = 0; k < 20; k++) {
      g.move(-1);
      g.update(1);
    }
    expect(g.at).toBe(0);
  });

  it('fails when the time runs out before two parcels', () => {
    const g = new DoorstepGame(new Rng(6));
    g.update(999);
    expect(g.grade).toBe('fail');
  });
});

describe('signature', () => {
  /** Trace the line, `off` pad units off it, in `n` pen moves. */
  const trace = (g: SignatureGame, off: number) => {
    const L = g.line;
    g.penDown(L[0]!.x, L[0]!.y + off);
    for (const p of L) g.penMove(p.x, p.y + off);
    g.penUp();
  };

  it('keeps the line on the pad', () => {
    const g = new SignatureGame(new Rng(1));
    for (const p of g.line) {
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(g.aspect);
    }
  });

  it('grades a faithful trace excellent and ends when the pen lifts', () => {
    const g = new SignatureGame(new Rng(2));
    trace(g, 0);
    expect(g.coverage).toBe(1);
    expect(g.accuracy).toBe(1);
    expect(g.done).toBe(true);
    expect(g.grade).toBe('excellent');
  });

  it('marks down a trace that drifts off the line', () => {
    const g = new SignatureGame(new Rng(3));
    trace(g, BALANCE_JOBS.signature.tolerance * 1.5);
    expect(['poor', 'fail']).toContain(g.grade);
  });

  it('marks down half a signature', () => {
    const g = new SignatureGame(new Rng(4));
    const half = g.line.slice(0, g.line.length / 2);
    g.penDown(half[0]!.x, half[0]!.y);
    for (const p of half) g.penMove(p.x, p.y);
    g.penUp();
    expect(g.coverage).toBeLessThan(0.6);
    expect(['ok', 'poor', 'fail']).toContain(g.grade);
  });

  it('fills in a fast flick, ignores moves with the pen up, and fails an empty pad', () => {
    const g = new SignatureGame(new Rng(5));
    g.penMove(0.5, 0.1);
    expect(g.samples).toBe(0);
    g.penDown(g.line[0]!.x, g.line[0]!.y);
    g.penMove(g.line.at(-1)!.x, g.line.at(-1)!.y);
    expect(g.samples).toBeGreaterThan(10);
    const empty = new SignatureGame(new Rng(6));
    empty.update(999);
    expect(empty.grade).toBe('fail');
  });
});

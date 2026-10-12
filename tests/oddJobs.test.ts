// Weekend odd jobs (docs/02, docs/03): the gig rules and payout, and the car wash and bar shift minigames.
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { BALANCE_ODD } from '../src/config/balanceOdd';
import { Rng } from '../src/core/rng';
import { DRINKS, GIG_IDS } from '../src/data/oddJobs';
import { BarShiftGame } from '../src/minigames/barShift';
import { CarWashGame } from '../src/minigames/carWash';
import type { Grade } from '../src/systems/career';
import { MINUTES_PER_DAY } from '../src/systems/clock';
import {
  canStartGig,
  createOddJobs,
  finishGig,
  gigPayout,
  gigTasksLeft,
  openGigs,
  quitGig,
  recordGigTask,
  startGig,
} from '../src/systems/oddJobs';
import {
  beginAudit,
  createSurface,
  endAudit,
  overlaps,
  type DrawnRect,
  type Surface,
} from '../src/ui/hudDraw';
import {
  ODD_PANEL_SIZE,
  barGlass,
  barSeat,
  barTap,
  carWashArea,
  carWashBucket,
  drawBarShift,
  drawCarWash,
  drawGigPay,
  type OddPanelKind,
} from '../src/ui/panelsOdd';

/** Total minutes at a day (1 = Monday) and hh:mm. */
const at = (day: number, h: number, m = 0) => (day - 1) * MINUTES_PER_DAY + h * 60 + m;
const SAT = 6;
const SUN = 7;

describe('gig rules', () => {
  it('runs on the weekend only, inside each gig’s hours', () => {
    const o = createOddJobs();
    expect(canStartGig(o, 'carWash', at(1, 11))).toEqual({ ok: false, reason: 'weekday' });
    expect(canStartGig(o, 'carWash', at(5, 11))).toEqual({ ok: false, reason: 'weekday' });
    expect(canStartGig(o, 'carWash', at(SAT, 8, 59))).toEqual({ ok: false, reason: 'early' });
    expect(canStartGig(o, 'carWash', at(SAT, 9))).toEqual({ ok: true });
    expect(canStartGig(o, 'carWash', at(SUN, 16))).toEqual({ ok: false, reason: 'tooLate' });
    expect(canStartGig(o, 'barShift', at(SAT, 15, 59))).toEqual({ ok: false, reason: 'early' });
    expect(canStartGig(o, 'barShift', at(SUN, 21, 59))).toEqual({ ok: true });
    expect(canStartGig(o, 'barShift', at(SUN, 22))).toEqual({ ok: false, reason: 'tooLate' });
    // the next weekend too
    expect(canStartGig(o, 'carWash', at(SAT + 7, 10))).toEqual({ ok: true });
    expect(openGigs(o, at(SAT, 10))).toEqual(['carWash']);
    expect(openGigs(o, at(SAT, 17))).toEqual(['barShift']);
    expect(openGigs(o, at(3, 17))).toEqual([]);
  });

  it('plays a gig through: tasks, pay, once a day each', () => {
    const o = createOddJobs();
    expect(startGig(o, 'carWash', at(SAT, 10)).ok).toBe(true);
    expect(canStartGig(o, 'barShift', at(SAT, 17))).toEqual({ ok: false, reason: 'onGig' });
    expect(finishGig(o, 1)).toEqual({ ok: false });
    expect(gigTasksLeft(o)).toBe(BALANCE_ODD.gigs.carWash.tasks);
    for (let k = 0; k < BALANCE_ODD.gigs.carWash.tasks; k++) expect(recordGigTask(o, 'good')).toBe(true);
    expect(recordGigTask(o, 'good')).toBe(false);
    const r = finishGig(o, 1);
    expect(r).toMatchObject({ ok: true, id: 'carWash', ...gigPayout(1, ['good', 'good', 'good']) });
    expect(o.gig).toBeNull();
    expect(canStartGig(o, 'carWash', at(SAT, 12))).toEqual({ ok: false, reason: 'alreadyWorked' });
    // the other gig is still open that evening, and the car wash again on Sunday
    expect(canStartGig(o, 'barShift', at(SAT, 17))).toEqual({ ok: true });
    expect(canStartGig(o, 'carWash', at(SUN, 10))).toEqual({ ok: true });
  });

  it('quitting part way pays nothing and uses up the day', () => {
    const o = createOddJobs();
    startGig(o, 'barShift', at(SUN, 18));
    recordGigTask(o, 'excellent');
    expect(quitGig(o)).toBe(true);
    expect(quitGig(o)).toBe(false);
    expect(o.gig).toBeNull();
    expect(canStartGig(o, 'barShift', at(SUN, 19))).toEqual({ ok: false, reason: 'alreadyWorked' });
  });

  it('pays 60% of the rank’s shift pay, plus tips by the typical grade', () => {
    const P = BALANCE.careers.payByRank;
    for (let rank = 1; rank <= 5; rank++)
      expect(gigPayout(rank, ['poor']).pay).toBe(Math.round((P[rank - 1] as number) * 0.6));
    expect(gigPayout(1, ['poor', 'poor', 'poor'])).toEqual({ pay: 108, tips: 0, total: 108 });
    expect(gigPayout(1, ['fail', 'fail', 'fail'])).toEqual({ pay: 108, tips: 0, total: 108 });
    expect(gigPayout(1, ['ok', 'ok', 'good'])).toEqual({ pay: 108, tips: 5, total: 113 });
    expect(gigPayout(1, ['good', 'good', 'excellent'])).toEqual({ pay: 108, tips: 11, total: 119 });
    expect(gigPayout(5, ['excellent', 'excellent', 'excellent'])).toEqual({ pay: 420, tips: 84, total: 504 });
    // out-of-range ranks clamp; tips never fall as grades rise
    expect(gigPayout(0, ['ok']).pay).toBe(108);
    expect(gigPayout(9, ['ok']).pay).toBe(420);
    const order: Grade[] = ['fail', 'poor', 'ok', 'good', 'excellent'];
    const tips = order.map((g) => gigPayout(3, [g, g, g]).tips);
    expect([...tips].sort((a, b) => a - b)).toEqual(tips);
  });

  it('pays less than the same rank’s weekday shift', () => {
    for (let rank = 1; rank <= 5; rank++)
      expect(gigPayout(rank, ['excellent']).total).toBeLessThan(
        BALANCE.careers.payByRank[rank - 1] as number,
      );
  });
});

/** Scrub the dirtiest spot until the car is clean, dunking when the sponge runs dry. */
function washBot(g: CarWashGame, dt = 1 / 30): void {
  while (!g.done) {
    if (g.dry) g.dunk();
    let best = -1;
    for (let k = 0; k < g.dirt.length; k++)
      if (!g.isClean(k) && (best < 0 || g.dirt[k]! > g.dirt[best]!)) best = k;
    if (best >= 0) g.aim(((best % g.cols) + 0.5) / g.cols, (Math.floor(best / g.cols) + 0.5) / g.rows);
    g.scrub(true);
    g.update(dt);
  }
}

describe('car wash', () => {
  it('lays out mud and stubborn spots, more on later cars', () => {
    const W = BALANCE_ODD.carWash;
    for (let seed = 1; seed <= 20; seed++) {
      const g = new CarWashGame(new Rng(seed));
      expect(g.dirtyCells).toBeGreaterThan(10);
      expect(g.spot.filter(Boolean).length).toBe(W.spots);
      expect(g.dirt.every((d) => d >= 0 && d <= W.stubborn)).toBe(true);
    }
    let first = 0;
    let third = 0;
    for (let seed = 1; seed <= 20; seed++) {
      first += new CarWashGame(new Rng(seed), 0).dirtyCells;
      third += new CarWashGame(new Rng(seed), 2).dirtyCells;
    }
    expect(third).toBeGreaterThan(first);
  });

  it('a steady scrubber gets every car clean in time', () => {
    for (let seed = 1; seed <= 20; seed++) {
      for (let car = 0; car < BALANCE_ODD.gigs.carWash.tasks; car++) {
        const g = new CarWashGame(new Rng(seed * 7 + car), car);
        washBot(g);
        expect(g.cleaned, `seed ${seed} car ${car}`).toBe(1);
        expect(['good', 'excellent']).toContain(g.grade);
        expect(g.dunks).toBeGreaterThan(0);
      }
    }
  });

  it('a dry sponge does nothing until it is dunked', () => {
    const g = new CarWashGame(new Rng(3));
    g.suds = 0;
    const before = [...g.dirt];
    g.aim(0.5, 0.8);
    g.scrub(true);
    g.update(0.5);
    expect(g.dirt).toEqual(before);
    g.dunk();
    g.dunk(); // a second press while dunking is ignored
    expect(g.dunks).toBe(1);
    g.update(BALANCE_ODD.carWash.dunkTime / 2);
    expect(g.suds).toBe(0);
    g.update(BALANCE_ODD.carWash.dunkTime);
    expect(g.suds).toBe(1);
    g.update(0.3);
    expect(g.dirt.reduce((a, b) => a + b, 0)).toBeLessThan(before.reduce((a, b) => a + b, 0));
    expect(g.suds).toBeLessThan(1);
  });

  it('grades by how much is clean when the time runs out', () => {
    const idle = new CarWashGame(new Rng(4));
    idle.update(BALANCE_ODD.carWash.seconds + 1);
    expect(idle.done).toBe(true);
    expect(idle.grade).toBe('fail');
    // clean all but a few cells by hand, then let the clock run out
    const W = BALANCE_ODD.carWash;
    const g = new CarWashGame(new Rng(5));
    const dirty = g.dirt.map((_, k) => k).filter((k) => !g.isClean(k));
    const leave = Math.floor(dirty.length * (1 - W.okShare));
    dirty.slice(leave).forEach((k) => (g.dirt[k] = 0));
    g.update(W.seconds);
    expect(g.grade).toBe('ok');
    // finished early with time to spare is excellent; at the buzzer it's good
    const fast = new CarWashGame(new Rng(6));
    fast.dirt.fill(0);
    fast.update(0.01);
    expect(fast.grade).toBe('excellent');
    const late = new CarWashGame(new Rng(6));
    late.update(W.seconds * (1 - W.excellentTimeShare) + 0.5);
    late.dirt.fill(0);
    late.update(0.01);
    expect(late.grade).toBe('good');
  });

  it('the sponge stays on the car and moves on the keys', () => {
    const g = new CarWashGame(new Rng(7));
    g.aim(-1, 3);
    expect(g.sponge).toEqual({ x: 0, y: 1 });
    g.move(1, -1, 0.2);
    expect(g.sponge.x).toBeCloseTo(BALANCE_ODD.carWash.spongeSpeed * 0.2);
    expect(g.sponge.y).toBeLessThan(1);
  });
});

/** Pour each waiting patron's drink to the line, oldest first. */
function barBot(g: BarShiftGame, dt = 1 / 60, target: number = BALANCE_ODD.barShift.line): void {
  while (!g.done) {
    if (!g.pouring && g.cooldown === 0) {
      const next = [...g.waiting].sort((a, b) => b.waited - a.waited)[0];
      if (next) {
        g.select(next.drink);
        g.pour(true);
      }
    } else if (g.pouring && g.fill >= target - (DRINKS[g.tap]!.rate * dt) / 2) g.pour(false);
    g.update(dt);
  }
}

describe('bar shift', () => {
  it('orders every drink each rush', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = new BarShiftGame(new Rng(seed));
      expect(g.patrons.length).toBe(BALANCE_ODD.barShift.patrons);
      for (let d = 0; d < DRINKS.length; d++) expect(g.patrons.some((p) => p.drink === d)).toBe(true);
    }
  });

  it('a quick, clean pourer serves the whole rush excellently', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = new BarShiftGame(new Rng(seed));
      barBot(g);
      expect(g.missed, `seed ${seed}`).toBe(0);
      expect(g.patrons.every((p) => p.result === 'perfect')).toBe(true);
      expect(g.grade).toBe('excellent');
    }
  });

  it('short pours still serve, for less', () => {
    const g = new BarShiftGame(new Rng(2));
    barBot(g, 1 / 60, 0.5);
    expect(g.missed).toBe(0);
    expect(g.patrons.every((p) => p.result === 'short')).toBe(true);
    expect(g.grade).toBe('poor');
  });

  it('nobody served is a fail; patrons wait for a free stool', () => {
    const B = BALANCE_ODD.barShift;
    const g = new BarShiftGame(new Rng(3));
    g.update(B.gap * B.seats + 0.1);
    expect(g.waiting.length).toBe(B.seats);
    expect(g.queued).toBe(1);
    while (!g.done) g.update(0.1);
    expect(g.missed).toBe(B.patrons);
    expect(g.grade).toBe('fail');
  });

  it('holding too long spills; the wrong drink is wasted', () => {
    const B = BALANCE_ODD.barShift;
    const g = new BarShiftGame(new Rng(4));
    g.update(0.01);
    const p = g.waiting[0]!;
    g.select(p.drink);
    g.pour(true);
    for (let k = 0; k < 200 && g.pouring; k++) g.update(0.05);
    expect(g.spills).toBe(1);
    expect(g.pouring).toBe(false);
    expect(g.cooldown).toBeGreaterThan(0);
    g.pour(true); // still mopping
    expect(g.pouring).toBe(false);
    g.update(B.spillTime);
    expect(p.result).toBeNull();
    // a drink nobody wants is wasted
    const w = new BarShiftGame(new Rng(4));
    for (const q of w.patrons) q.drink = 0;
    w.update(0.01);
    w.select(2);
    w.pour(true);
    w.update(0.5);
    w.pour(false);
    expect(w.wrong).toBe(1);
    expect(w.last?.kind).toBe('wrong');
    expect(w.served).toBe(0);
  });

  it('judges a pour by how close it stops to the line', () => {
    const B = BALANCE_ODD.barShift;
    expect(BarShiftGame.judge(B.line)).toBe('perfect');
    expect(BarShiftGame.judge(B.line - B.great - 0.01)).toBe('fine');
    expect(BarShiftGame.judge(B.line + B.good - 0.005)).toBe('fine');
    expect(BarShiftGame.judge(B.line - B.good - 0.01)).toBe('short');
    expect(BarShiftGame.judge(0.97)).toBe('short');
  });

  it('can’t change taps mid-pour', () => {
    const g = new BarShiftGame(new Rng(5));
    g.select(1);
    g.pour(true);
    g.select(2);
    expect(g.tap).toBe(1);
    g.select(9);
    expect(g.tap).toBe(1);
  });
});

const X = 40;
const Y = 30;

/** Draw a panel under the layout audit: no text or picture overlaps another, and nothing leaves the panel. */
function check(kind: OddPanelKind, draw: (s: Surface) => void): DrawnRect[] {
  const s = createSurface(640, 360);
  beginAudit();
  draw(s);
  const rects = endAudit();
  expect(rects.length, `${kind}: nothing recorded`).toBeGreaterThan(3);
  const bad = overlaps(rects).map(([a, b]) => `${a.what} @${a.x},${a.y} overlaps ${b.what} @${b.x},${b.y}`);
  expect(bad, kind).toEqual([]);
  const P = ODD_PANEL_SIZE[kind];
  for (const r of rects)
    expect(
      r.x >= X && r.y >= Y && r.x + r.w <= X + P.w && r.y + r.h <= Y + P.h,
      `${kind}: ${r.what} leaves the panel`,
    ).toBe(true);
  return rects;
}

describe('odd-job panel layouts never overlap', () => {
  it('car wash: scrubbing, dry, dunking, and done', () => {
    const g = new CarWashGame(new Rng(11), 2);
    check('carWash', (s) => drawCarWash(s, X, Y, g, 'CAR 3/3', 2));
    g.aim(0.4, 0.7);
    g.scrub(true);
    g.update(1);
    check('carWash', (s) => drawCarWash(s, X, Y, g, 'CAR 3/3', 2));
    g.suds = 0;
    check('carWash', (s) => drawCarWash(s, X, Y, g, 'CAR 3/3', 2));
    g.dunk();
    check('carWash', (s) => drawCarWash(s, X, Y, g, 'CAR 3/3', 2));
    g.update(99);
    check('carWash', (s) => drawCarWash(s, X, Y, g, 'CAR 3/3', 2));
    // the click targets sit inside the panel and apart
    const A = carWashArea(X, Y, g);
    const B = carWashBucket(X, Y);
    expect(A.x + A.w).toBeLessThanOrEqual(X + ODD_PANEL_SIZE.carWash.w - 8);
    expect(B.y).toBeGreaterThan(A.y + A.h);
  });

  it('car wash: no dirt off the car', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = new CarWashGame(new Rng(seed), 2);
      g.dirt.forEach((d, k) => {
        if (!g.body[k]) expect(d).toBe(0);
      });
    }
  });

  it('bar shift: a full counter, pouring, every flash, and done', () => {
    const B = BALANCE_ODD.barShift;
    const g = new BarShiftGame(new Rng(12));
    check('barShift', (s) => drawBarShift(s, X, Y, g, 'RUSH 1/3'));
    g.update(B.gap * (B.seats + 1) + 0.1); // every stool taken and one waiting
    g.patrons[0]!.waited = B.patience * 0.8;
    g.select(2);
    g.pour(true);
    g.update(0.6);
    check('barShift', (s) => drawBarShift(s, X, Y, g, 'RUSH 1/3'));
    for (const kind of ['perfect', 'fine', 'short', 'missed'] as const) {
      g.last = { kind, seat: 2, t: 0 };
      check('barShift', (s) => drawBarShift(s, X, Y, g, 'RUSH 1/3'));
    }
    for (const kind of ['spill', 'wrong'] as const) {
      g.last = { kind, tap: 1, t: 0 };
      check('barShift', (s) => drawBarShift(s, X, Y, g, 'RUSH 1/3'));
    }
    g.update(99);
    check('barShift', (s) => drawBarShift(s, X, Y, g, 'RUSH 1/3'));
    for (let k = 0; k < DRINKS.length; k++) {
      const t = barTap(X, Y, k);
      expect(t.x + t.w).toBeLessThan(barGlass(X, Y).x);
    }
    for (let k = 0; k < B.seats; k++) {
      const r = barSeat(X, Y, k);
      expect(r.x + r.w).toBeLessThanOrEqual(X + ODD_PANEL_SIZE.barShift.w - 4);
    }
  });

  it('gig pay card', () => {
    for (const id of GIG_IDS) {
      const grades: Grade[] = ['excellent', 'poor', 'good'];
      check('gigPay', (s) => drawGigPay(s, X, Y, id, grades, gigPayout(5, grades)));
    }
  });
});

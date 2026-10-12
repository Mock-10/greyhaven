// M7 mechanic tasks (docs/06, docs/03): diagnose, bolt torque, tyre change and respray.
import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { BALANCE_JOBS } from '../src/config/balanceJobs';
import { FAULTS } from '../src/data/faults';
import { DiagnoseGame } from '../src/minigames/diagnose';
import { BoltTorqueGame, starOrder } from '../src/minigames/boltTorque';
import { TyreChangeGame, TYRE_STEPS, type ArrowDir } from '../src/minigames/tyreChange';
import { ResprayGame } from '../src/minigames/respray';
import { jobTier } from '../src/minigames/jobGrade';

describe('diagnose', () => {
  it('offers four different parts per car, one of them the fault, and no two faults share a symptom', () => {
    const g = new DiagnoseGame(new Rng(1));
    expect(g.cars.length).toBe(BALANCE_JOBS.diagnose.rounds);
    for (const c of g.cars) {
      expect(new Set(c.options).size).toBe(BALANCE_JOBS.diagnose.options);
      expect(c.options).toContain(c.fault);
    }
    const symptoms = FAULTS.flatMap((f) => f.symptoms.map((s) => s.text));
    expect(new Set(symptoms).size).toBe(symptoms.length);
    expect(new Set(g.cars.map((c) => c.fault)).size).toBe(g.cars.length);
  });

  it('is excellent when every car is right and quick, ok with one wrong, and a timeout ends it', () => {
    const g = new DiagnoseGame(new Rng(2));
    while (!g.done) g.pick(g.car!.options.indexOf(g.car!.fault));
    expect(g.grade).toBe('excellent');

    const slow = new DiagnoseGame(new Rng(3));
    slow.update(slow.timeTotal * 0.8);
    while (!slow.done) slow.pick(slow.car!.options.indexOf(slow.car!.fault));
    expect(slow.grade).toBe('good');

    const one = new DiagnoseGame(new Rng(4));
    one.pick((one.car!.options.indexOf(one.car!.fault) + 1) % 4);
    while (!one.done) one.pick(one.car!.options.indexOf(one.car!.fault));
    expect(one.right).toBe(2);
    expect(one.grade).toBe('ok');

    const late = new DiagnoseGame(new Rng(5));
    late.pick(late.car!.options.indexOf(late.car!.fault));
    late.update(999);
    expect(late.done).toBe(true);
    expect(late.grade).toBe('poor');
  });

  it('ignores picks out of range', () => {
    const g = new DiagnoseGame(new Rng(6));
    g.pick(7);
    g.pick(-1);
    expect(g.answers).toEqual([]);
  });
});

/** Turn the needle to `deg` off the zone centre and hit. */
function hitAt(g: BoltTorqueGame, off: number): void {
  g.needle = (g.zone + off + 360) % 360;
  g.hit();
}

describe('bolt torque', () => {
  it('tightens the nuts across the hub in a star pattern', () => {
    expect(starOrder(5)).toEqual([0, 2, 4, 1, 3]);
    expect(starOrder(4)).toEqual([0, 2, 1, 3]);
    for (const n of [4, 5, 6]) expect([...starOrder(n)].sort()).toEqual([...Array(n).keys()]);
  });

  it('has at least four nuts, and more at higher tiers', () => {
    expect(new BoltTorqueGame(new Rng(1), 0).bolts).toBe(BALANCE_JOBS.boltTorque.minBolts);
    expect(new BoltTorqueGame(new Rng(1), 4).bolts).toBe(6);
    expect(jobTier(1)).toBe(1);
    expect(jobTier(9)).toBe(BALANCE_JOBS.tierByRank.at(-1));
  });

  it('grades by greats and misses, and strips the stud after too many misses', () => {
    const ex = new BoltTorqueGame(new Rng(2), 1);
    while (!ex.done) hitAt(ex, 0);
    expect(ex.state.every((s) => s === 'great')).toBe(true);
    expect(ex.grade).toBe('excellent');

    const good = new BoltTorqueGame(new Rng(3), 1);
    while (!good.done) hitAt(good, good.good / 2 - 1);
    expect(good.grade).toBe('good');

    const ok = new BoltTorqueGame(new Rng(4), 1);
    hitAt(ok, 180);
    expect(ok.state.every((s) => s === 'loose')).toBe(true);
    while (!ok.done) hitAt(ok, 0);
    expect(ok.grade).toBe('ok');

    const fail = new BoltTorqueGame(new Rng(5), 1);
    while (!fail.done) hitAt(fail, 180);
    expect(fail.misses).toBe(BALANCE_JOBS.boltTorque.maxMisses);
    expect(fail.grade).toBe('fail');
  });

  it('sweeps the needle at the tier speed', () => {
    const g = new BoltTorqueGame(new Rng(6), 2);
    g.update(0.25);
    expect(g.needle).toBeCloseTo(1.2 * 360 * 0.25, 5);
  });
});

describe('tyre change', () => {
  const play = (g: TyreChangeGame) => {
    while (!g.done) g.press(g.keys[g.pos]!);
  };

  it('has the six steps, each two or three arrows', () => {
    const g = new TyreChangeGame(new Rng(1));
    expect(g.steps.length).toBe(TYRE_STEPS.length);
    for (const s of g.steps) expect(s.length).toBeGreaterThanOrEqual(2);
  });

  it('is excellent clean and quick, and marks down errors', () => {
    const g = new TyreChangeGame(new Rng(2));
    play(g);
    expect(g.grade).toBe('excellent');

    const e = new TyreChangeGame(new Rng(3));
    const wrong: ArrowDir = e.keys[0] === 'up' ? 'down' : 'up';
    e.press(wrong);
    e.press(wrong);
    expect(e.pos).toBe(0);
    play(e);
    expect(e.errors).toBe(2);
    expect(e.grade).toBe('ok');
  });

  it('is poor when time runs out late in the job and a fail early on', () => {
    const late = new TyreChangeGame(new Rng(4));
    while (late.progress < 0.7) late.press(late.keys[late.pos]!);
    late.update(999);
    expect(late.grade).toBe('poor');
    const early = new TyreChangeGame(new Rng(5));
    early.update(999);
    expect(early.grade).toBe('fail');
  });
});

describe('respray', () => {
  /** Sweep the panel in `passes` even rows at the keyboard nozzle speed. */
  const sweep = (passes: number) => {
    const g = new ResprayGame();
    const dt = 1 / 60;
    g.aim(0, 0.5 / passes);
    g.spray(true);
    let dir = 1;
    let row = 0;
    while (!g.done) {
      g.move(dir, 0, dt);
      g.update(dt);
      if ((dir > 0 && g.nozzle.x >= 1) || (dir < 0 && g.nozzle.x <= 0)) {
        row++;
        dir = -dir;
        if (row >= passes) g.finish();
        else g.aim(g.nozzle.x, (row + 0.5) / passes);
      }
    }
    return g;
  };

  it('grades a neat four-pass sweep excellent within the time, and a sparse one lower', () => {
    const g = sweep(4);
    expect(g.grade).toBe('excellent');
    expect(g.timeLeft).toBeGreaterThan(0);
    expect(['good', 'ok']).toContain(sweep(3).grade);
    expect(['poor', 'fail']).toContain(sweep(1).grade);
  });

  it('makes paint run when the nozzle sits still', () => {
    const g = new ResprayGame();
    g.aim(0.5, 0.5);
    g.spray(true);
    g.update(1.5);
    expect(g.runs).toBeGreaterThan(0);
    g.finish();
    expect(['poor', 'fail']).toContain(g.grade);
  });

  it('paints nothing without the trigger and fails an untouched panel', () => {
    const g = new ResprayGame();
    g.aim(0.5, 0.5);
    g.update(5);
    expect(g.coat.every((c) => c === 0)).toBe(true);
    g.update(999);
    expect(g.grade).toBe('fail');
  });

  it('keeps the nozzle on the panel', () => {
    const g = new ResprayGame();
    g.move(-1, -1, 10);
    expect(g.nozzle).toEqual({ x: 0, y: 0 });
    g.aim(5, 5);
    expect(g.nozzle).toEqual({ x: 1, y: 1 });
  });
});

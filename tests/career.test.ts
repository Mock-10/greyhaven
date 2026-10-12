import { describe, expect, it } from 'vitest';
import {
  canClockIn,
  clockIn,
  clockOut,
  createCareer,
  hasKeyCard,
  payFor,
  rankTitle,
  recordTask,
  shiftXp,
  tasksLeft,
} from '../src/systems/career';

const day = (n: number, hh: number, mm = 0) => (n - 1) * 1440 + hh * 60 + mm;

describe('careers (docs/03)', () => {
  it('clocks in between 08:00 and 10:00 on weekdays, late after 09:00', () => {
    const c = createCareer();
    expect(canClockIn(c, day(1, 7, 59))).toEqual({ ok: false, reason: 'early' });
    expect(canClockIn(c, day(1, 8, 30))).toEqual({ ok: true, late: false });
    expect(canClockIn(c, day(1, 9, 15))).toEqual({ ok: true, late: true });
    expect(canClockIn(c, day(1, 10, 0))).toEqual({ ok: false, reason: 'tooLate' });
    expect(canClockIn(c, day(6, 8, 30))).toEqual({ ok: false, reason: 'weekend' }); // Saturday
  });

  it('runs a 3-task shift and pays $180 at rank 1, 80% when late', () => {
    const c = createCareer();
    expect(clockIn(c, day(1, 8, 10)).ok).toBe(true);
    expect(tasksLeft(c)).toBe(3);
    expect(clockOut(c, 0)).toBeNull(); // tasks not done
    recordTask(c, 'filing', 'good');
    recordTask(c, 'dataEntry', 'good');
    recordTask(c, 'filing', 'excellent');
    expect(recordTask(c, 'filing', 'good')).toBe(false); // no fourth task
    const r = clockOut(c, 0);
    expect(r).toMatchObject({ pay: 180, xp: 11, promoted: false });
    expect(payFor(1, true)).toBe(144);
    expect(canClockIn(c, day(1, 9, 0))).toEqual({ ok: false, reason: 'alreadyWorked' });
  });

  it('maps a shift to XP by its typical grade', () => {
    expect(shiftXp(['poor', 'poor', 'ok'])).toBe(6);
    expect(shiftXp(['ok', 'ok', 'good'])).toBe(9);
    expect(shiftXp(['good', 'good', 'excellent'])).toBe(11);
    expect(shiftXp(['excellent', 'excellent', 'excellent'])).toBe(14);
    expect(shiftXp(['fail', 'ok', 'ok'])).toBe(6);
  });

  it('promotes to rank 2 at 40 XP with the $250 bonus and the key card', () => {
    const c = createCareer();
    expect(rankTitle(c)).toBe('CLERK');
    let promotedOn = 0;
    for (let d = 1; d <= 5 && !promotedOn; d++) {
      clockIn(c, day(d, 8, 30));
      for (let k = 0; k < 3; k++) recordTask(c, 'filing', 'excellent');
      const r = clockOut(c, 0);
      if (r?.promoted) {
        promotedOn = d;
        expect(r.bonus).toBe(250);
        expect(r.newRank).toBe(2);
      }
    }
    expect(promotedOn).toBe(3); // 14 XP a day: 42 XP after day 3
    expect(c.jobs.office.xp).toBe(2); // the extra XP carries over
    expect(rankTitle(c)).toBe('ANALYST');
    expect(hasKeyCard(c)).toBe(true);
  });
});

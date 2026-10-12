import { describe, expect, it } from 'vitest';
import {
  arrestEffects,
  clockIn,
  clockOut,
  closeWeek,
  coverShift,
  coverable,
  createCareer,
  recordTask,
  tasksLeft,
  xpNeeded,
} from '../src/systems/career';
import { runCalendar, type CalendarState } from '../src/systems/days';
import { createFinance, credit, deposit, moveBackIn, moveInCost, withdraw } from '../src/systems/finance';

const at = (day: number, hh: number, mm = 0) => (day - 1) * 1440 + hh * 60 + mm;

function world(bank = 0): CalendarState {
  return { money: { clean: 100, dirty: 0, bank }, finance: createFinance(), career: createCareer() };
}

describe('bank (docs/02, decided 2026-10-11)', () => {
  it('deposits and withdraws clean cash only within what is there, and keeps a statement', () => {
    const w = world(50);
    expect(deposit(w.money, w.finance, 0, 500)).toBe(100); // only what is carried
    expect(w.money).toMatchObject({ clean: 0, bank: 150 });
    expect(withdraw(w.money, w.finance, 1, 200)).toBe(0); // not enough in the bank
    expect(withdraw(w.money, w.finance, 2, 100)).toBe(100);
    expect(w.money).toMatchObject({ clean: 100, bank: 50 });
    expect(w.finance.ledger.map((e) => e.amount)).toEqual([-100, 100]);
  });

  it('keeps only the newest statement lines', () => {
    const w = world();
    for (let k = 0; k < 40; k++) credit(w.money, w.finance, k, 'PAY', 1);
    expect(w.finance.ledger.length).toBe(24);
    expect(w.finance.ledger[0]?.at).toBe(39);
  });
});

describe('rent (docs/02)', () => {
  it('takes $350 from the bank on Monday 06:00', () => {
    const w = world(400);
    const msgs = runCalendar(w, at(1, 7), at(8, 7));
    expect(w.money.bank).toBe(50);
    expect(w.finance.rent.owed).toBe(0);
    expect(msgs.some((m) => m.text === 'RENT PAID: $350.')).toBe(true);
    // the Sunday-evening reminder came first
    expect(msgs.some((m) => m.text.startsWith('RENT $350 DUE MONDAY'))).toBe(true);
  });

  it('builds +$50 a day while late, pays it off once the bank covers it', () => {
    const w = world(0);
    runCalendar(w, at(1, 7), at(8, 7)); // due day 8 (Monday), missed
    expect(w.finance.rent.owed).toBe(350);
    runCalendar(w, at(8, 7), at(10, 7)); // two late days
    expect(w.finance.rent.owed).toBe(450);
    w.money.bank = 1000;
    runCalendar(w, at(10, 7), at(11, 7)); // the next morning's retry pays fee + debt
    expect(w.finance.rent.owed).toBe(0);
    expect(w.money.bank).toBe(1000 - 500);
    expect(w.finance.rent.unpaidSince).toBeNull();
  });

  it('evicts after two missed weeks, and moving back in costs a week plus storage', () => {
    const w = world(0);
    const msgs = runCalendar(w, at(1, 7), at(22, 7)); // due days 8 and 15, eviction day 22
    expect(w.finance.rent.evicted).toBe(true);
    expect(w.finance.rent.storage).toBe(true);
    expect(w.finance.rent.owed).toBe(0);
    expect(msgs.at(-1)?.text).toContain('EVICTED');
    // no rent while evicted
    runCalendar(w, at(22, 7), at(30, 7));
    expect(w.finance.rent.owed).toBe(0);
    expect(moveInCost(w.finance)).toBe(550);
    expect(moveBackIn(w.money, w.finance, at(30, 8))).toBe(false); // empty bank
    w.money.bank = 600;
    expect(moveBackIn(w.money, w.finance, at(30, 8))).toBe(true);
    expect(w.money.bank).toBe(50);
    expect(w.finance.rent.evicted).toBe(false);
  });

  it('is not evicted on day 21 (13 days late)', () => {
    const w = world(0);
    runCalendar(w, at(1, 7), at(21, 7));
    expect(w.finance.rent.evicted).toBe(false);
    expect(w.finance.rent.owed).toBe(350 * 2 + 50 * 12);
  });
});

describe('careers over the week (docs/03)', () => {
  const work = (c: ReturnType<typeof createCareer>, d: number) => {
    clockIn(c, at(d, 8, 30));
    while (tasksLeft(c) > 0) recordTask(c, 'filing', 'excellent');
    return clockOut(c, at(d, 12));
  };

  it('a missed workday costs 5 XP (never below 0); day 1 and weekends never count', () => {
    const w = world(1000);
    w.career.jobs.office.xp = 7;
    runCalendar(w, at(1, 7), at(1, 11)); // day 1: the guided first day
    expect(w.career.missed).toEqual([]);
    runCalendar(w, at(1, 11), at(2, 11)); // day 2 missed
    expect(w.career.jobs.office.xp).toBe(2);
    runCalendar(w, at(2, 11), at(3, 11)); // day 3 missed: floors at 0
    expect(w.career.jobs.office.xp).toBe(0);
    runCalendar(w, at(5, 11), at(8, 7)); // Sat, Sun don't count
    expect(w.career.missed).toEqual([2, 3]);
  });

  it('a worked day is not missed; HR covers a recent miss and gives the XP back', () => {
    const w = world();
    work(w.career, 2);
    runCalendar(w, at(2, 7), at(3, 11));
    expect(w.career.missed).toEqual([3]);
    const xp = w.career.jobs.office.xp;
    expect(coverShift(w.career, 4)).toBe(true);
    expect(w.career.jobs.office.xp).toBe(xp + 5);
    expect(w.career.missed).toEqual([]);
    w.career.missed = [1];
    expect(coverable(w.career, 9)).toEqual([]); // older than 7 days
  });

  it('pays a 15% clean-record bonus on Monday for a week with no arrest', () => {
    const w = world();
    for (let d = 1; d <= 5; d++) work(w.career, d);
    expect(w.career.week.pay).toBe(3 * 180 + 2 * 260); // promoted after day 3
    runCalendar(w, at(5, 13), at(8, 7));
    expect(w.money.bank).toBe(159); // bonus 159 went in; rent 350 couldn't be paid from it
    expect(w.finance.rent.owed).toBe(350);
    expect(w.finance.ledger.some((e) => e.text === 'CLEAN-RECORD BONUS' && e.amount === 159)).toBe(true);
    expect(w.career.week).toEqual({ pay: 0, offense: false });
  });

  it('an arrest freezes XP for 3 days, adds a task and 10% to the XP bar for 2 days, and costs the bonus', () => {
    const c = createCareer();
    arrestEffects(c, at(2, 22), at(4, 6)); // arrested Tue night, 2 days in jail
    expect(c.week.offense).toBe(true);
    expect(closeWeek(c)).toBe(0);
    clockIn(c, at(4, 8, 30));
    expect(tasksLeft(c)).toBe(4);
    while (tasksLeft(c) > 0) recordTask(c, 'filing', 'excellent');
    const r = clockOut(c, at(4, 12));
    expect(r).toMatchObject({ xp: 0, frozen: true, pay: 180 });
    expect(xpNeeded(c, 1, at(5, 12))).toBe(44);
    expect(xpNeeded(c, 1, at(6, 0))).toBe(40); // back to normal after the second day
    clockIn(c, at(8, 8, 30));
    expect(tasksLeft(c)).toBe(3);
  });
});

import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import {
  addStars,
  arrest,
  blockedBy,
  canSee,
  emptyWanted,
  reportCrime,
  searchRadius,
  tickWanted,
} from '../src/systems/wanted';

const DAY = 24 * 60;

describe('wanted level (docs/05)', () => {
  it('stacks stars up to 5 and centres the search on the crime', () => {
    const w = emptyWanted();
    addStars(w, 1, { x: 100, y: 100 });
    expect(w.stars).toBe(1);
    addStars(w, 9, { x: 200, y: 100 });
    expect(w.stars).toBe(5);
    expect(w.lastKnown).toEqual({ x: 200, y: 100 });
  });

  it('raises the stars once per crime, however many witnesses call it in', () => {
    const w = emptyWanted();
    const seen = new Set<number>();
    expect(reportCrime(w, seen, 1, 1, { x: 0, y: 0 })).toBe(true);
    expect(reportCrime(w, seen, 1, 1, { x: 40, y: 0 })).toBe(false);
    expect(reportCrime(w, seen, 1, 1, { x: 80, y: 0 })).toBe(false);
    expect(w.stars).toBe(1);
    expect(w.lastKnown).toEqual({ x: 80, y: 0 });
    // a second crime stacks
    expect(reportCrime(w, seen, 2, 1, { x: 0, y: 0 })).toBe(true);
    expect(w.stars).toBe(2);
  });

  it('only counts the escape timer down out of sight and outside the circle', () => {
    const w = emptyWanted();
    addStars(w, 1, { x: 0, y: 0 });
    const inside = { x: 10, y: 0 };
    for (let k = 0; k < 100; k++) tickWanted(w, 1, false, inside);
    expect(w.stars).toBe(1);
    const outside = { x: searchRadius(1) + 50, y: 0 };
    tickWanted(w, 1, true, outside); // seen: the circle moves onto the player and the timer resets
    expect(w.lastKnown).toEqual(outside);
    const far = { x: outside.x + searchRadius(1) + 50, y: 0 };
    let cleared = false;
    for (let t = 0; t <= BALANCE.wanted.escapeSeconds[0]! + 1 && !cleared; t++)
      cleared = tickWanted(w, 1, false, far);
    expect(cleared).toBe(true);
    expect(w.stars).toBe(0);
  });

  it('fines a first offense and keeps the dirty cash', () => {
    const money = { clean: 1000, dirty: 700 };
    const rec = { arrests: [] as number[] };
    const o = arrest(money, rec, 2, 3 * DAY, false);
    expect(o).toMatchObject({ repeat: false, fine: 500, paid: 500, jailDays: 0, seized: 0 });
    expect(money).toEqual({ clean: 500, dirty: 700 });
    expect(rec.arrests).toEqual([3 * DAY]);
  });

  it('jails a repeat offense, seizes dirty cash, and surrendering takes 30% and a day off', () => {
    const money = { clean: 100, dirty: 700 };
    const rec = { arrests: [1 * DAY] };
    const o = arrest(money, rec, 2, 10 * DAY, true);
    expect(o).toMatchObject({ repeat: true, fine: 350, paid: 100, jailDays: 0, seized: 700 });
    expect(money).toEqual({ clean: 0, dirty: 0 });
    // more than 14 days later it's a first offense again
    const m2 = { clean: 1000, dirty: 50 };
    expect(arrest(m2, { arrests: [1 * DAY] }, 1, 20 * DAY, false).repeat).toBe(false);
    const m3 = { clean: 5000, dirty: 50 };
    expect(arrest(m3, { arrests: [1 * DAY] }, 3, 5 * DAY, false)).toMatchObject({ jailDays: 2, fine: 1200 });
  });

  it('sees along clear lines only: buildings block', () => {
    const wall = [[40, -20, 60, 20]] as const;
    expect(blockedBy({ x: 0, y: 0 }, { x: 100, y: 0 }, wall)).toBe(true);
    expect(blockedBy({ x: 0, y: 30 }, { x: 100, y: 30 }, wall)).toBe(false);
    expect(canSee({ x: 0, y: 0 }, { x: 100, y: 0 }, 10, [])).toBe(true);
    expect(canSee({ x: 0, y: 0 }, { x: 1000, y: 0 }, 10, [])).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { capLeft, cutFor, launder } from '../src/systems/laundering';

describe('laundering with Dez (docs/02)', () => {
  it('takes a 35% cut on a clean count', () => {
    const money = { clean: 0, dirty: 400 };
    const log = { day: 0, amount: 0 };
    const r = launder(money, log, 1, 'excellent');
    expect(r).toEqual({ washed: 400, paid: 260, cut: 0.35 });
    expect(money).toEqual({ clean: 260, dirty: 0 });
  });

  it('adds the miscount cut', () => {
    expect(cutFor('fail')).toBeCloseTo(0.5);
    expect(cutFor('good')).toBeCloseTo(0.37);
  });

  it('stops at the $1,500 daily cap and resets the next day', () => {
    const money = { clean: 0, dirty: 2000 };
    const log = { day: 0, amount: 0 };
    expect(launder(money, log, 1, 'excellent').washed).toBe(1500);
    expect(capLeft(log, 1)).toBe(0);
    expect(launder(money, log, 1, 'excellent').washed).toBe(0);
    expect(capLeft(log, 2)).toBe(1500);
    expect(launder(money, log, 2, 'excellent').washed).toBe(500);
    expect(money.dirty).toBe(0);
  });
});

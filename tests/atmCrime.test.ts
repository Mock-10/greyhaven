import { describe, expect, it } from 'vitest';
import { BALANCE_CRIME } from '../src/config/balanceCrime';
import { Rng } from '../src/core/rng';
import { atmMethods, atmReady, atmStars, canBuyDrill, robAtm } from '../src/systems/atmCrime';

const A = BALANCE_CRIME.atm;

describe('ATM robbery (docs/04)', () => {
  it('is 2★, 3★ downtown', () => {
    expect(atmStars(false)).toBe(2);
    expect(atmStars(true)).toBe(3);
  });

  it('a clean hack pays $800–1,500, silently', () => {
    for (let seed = 1; seed < 30; seed++) {
      const money = { dirty: 0 };
      const r = robAtm(new Rng(seed), 'hack', 'excellent', money, { downtown: false, masked: true });
      expect(r.cash).toBeGreaterThanOrEqual(A.cash[0]);
      expect(r.cash).toBeLessThanOrEqual(A.cash[1]);
      expect(money.dirty).toBe(r.cash);
      expect(r.reports).toEqual([]);
      expect(r.noiseTiles).toBe(0);
      expect(r.identified).toBe(false);
    }
  });

  it('a failed hack pays nothing and trips the alarm', () => {
    const r = robAtm(new Rng(1), 'hack', 'fail', { dirty: 0 }, { downtown: true, masked: true });
    expect(r.cash).toBe(0);
    expect(r.reports).toEqual([{ key: 'atm', stars: 3 }]);
  });

  it('the camera identifies an unmasked robber', () => {
    expect(
      robAtm(new Rng(1), 'hack', 'good', { dirty: 0 }, { downtown: false, masked: false }).identified,
    ).toBe(true);
  });

  it('the drill is loud and wears out; a fail costs 2 uses', () => {
    const money = { dirty: 0 };
    const r = robAtm(new Rng(2), 'drill', 'ok', money, { downtown: false, masked: true, drillUses: 5 });
    expect(r.cash).toBeGreaterThan(0);
    expect(r.noiseTiles).toBe(A.drillNoiseTiles);
    expect(r.drillUses).toBe(4);
    expect(
      robAtm(new Rng(2), 'drill', 'fail', money, { downtown: false, masked: true, drillUses: 4 }).drillUses,
    ).toBe(2);
  });

  it('no drill, no drilling', () => {
    expect(atmMethods(0)).toEqual(['hack']);
    expect(atmMethods(3)).toEqual(['hack', 'drill']);
    const r = robAtm(new Rng(2), 'drill', 'excellent', { dirty: 0 }, { downtown: false, masked: true });
    expect(r.cash).toBe(0);
  });

  it('the drill is sold from Known; an emptied ATM waits 2 days for a refill', () => {
    expect(canBuyDrill(1799)).toBe(false);
    expect(canBuyDrill(1800)).toBe(true);
    expect(atmReady(null, 0)).toBe(true);
    expect(atmReady(100, 100 + A.refillMinutes - 1)).toBe(false);
    expect(atmReady(100, 100 + A.refillMinutes)).toBe(true);
  });
});

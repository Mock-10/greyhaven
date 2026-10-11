import { describe, expect, it } from 'vitest';
import { buy, priceOf } from '../src/systems/shop';
import { sleepUntil } from '../src/systems/clock';

describe('corner store basics', () => {
  it('sells for clean cash only and heals when eaten', () => {
    const w = { money: { clean: 10, dirty: 500 }, health: 80, inventory: { fuelCans: 0 } };
    expect(buy(w, 'fuel_can')).toEqual({ ok: false, text: 'NOT ENOUGH CLEAN CASH' });
    expect(w.money.dirty).toBe(500);
    const r = buy(w, 'chips');
    expect(r.ok).toBe(true);
    expect(w.money.clean).toBe(10 - priceOf('chips'));
    expect(w.health).toBe(90);
  });

  it('carries a fuel can and caps health at the maximum', () => {
    const w = { money: { clean: 100, dirty: 0 }, health: 95, inventory: { fuelCans: 0 } };
    buy(w, 'fuel_can');
    expect(w.inventory.fuelCans).toBe(1);
    buy(w, 'sandwich');
    expect(w.health).toBe(100);
  });
});

describe('sleep', () => {
  it('wakes at 06:00 the next day, or the same morning after midnight', () => {
    expect(sleepUntil(22 * 60, 360)).toBe(1440 + 360);
    expect(sleepUntil(1440 + 2 * 60, 360)).toBe(1440 + 360);
    expect(sleepUntil(1440 + 7 * 60, 360)).toBe(2 * 1440 + 360);
  });
});

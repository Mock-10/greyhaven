import { describe, expect, it } from 'vitest';
import { emptyInventory } from '../src/core/store';
import { buy, lockTool, priceOf, useFirstAid, wearLockpicks } from '../src/systems/shop';
import { sleepUntil } from '../src/systems/clock';

describe('corner store basics', () => {
  it('sells for clean cash only and heals when eaten', () => {
    const w = { money: { clean: 10, dirty: 500 }, health: 80, inventory: emptyInventory() };
    expect(buy(w, 'fuel_can')).toEqual({ ok: false, text: 'NOT ENOUGH CLEAN CASH' });
    expect(w.money.dirty).toBe(500);
    const r = buy(w, 'chips');
    expect(r.ok).toBe(true);
    expect(w.money.clean).toBe(10 - priceOf('chips'));
    expect(w.health).toBe(90);
  });

  it('carries a fuel can and caps health at the maximum', () => {
    const w = { money: { clean: 100, dirty: 0 }, health: 95, inventory: emptyInventory() };
    buy(w, 'fuel_can');
    expect(w.inventory.fuelCans).toBe(1);
    buy(w, 'sandwich');
    expect(w.health).toBe(100);
  });
});

describe('Phase 2 items', () => {
  it('first-aid kits are carried and restore full health from the bag', () => {
    const w = { money: { clean: 200, dirty: 0 }, health: 30, inventory: emptyInventory() };
    expect(buy(w, 'first_aid').ok).toBe(true);
    expect(w.inventory.firstAid).toBe(1);
    expect(w.money.clean).toBe(140);
    expect(useFirstAid(w)).toEqual({ ok: true, text: 'FIRST AID +70 HP' });
    expect(w.health).toBe(100);
    expect(useFirstAid(w).ok).toBe(false);
  });

  it('lockpicks come as a set of 10 uses that wear out (a failure costs 2)', () => {
    const w = { money: { clean: 200, dirty: 0 }, health: 100, inventory: emptyInventory() };
    expect(lockTool(w.inventory)).toBe('none');
    buy(w, 'lockpicks');
    expect(w.inventory.lockpicks).toBe(10);
    expect(lockTool(w.inventory)).toBe('basic');
    wearLockpicks(w.inventory, false);
    expect(w.inventory.lockpicks).toBe(9);
    for (let k = 0; k < 4; k++) wearLockpicks(w.inventory, true);
    expect(wearLockpicks(w.inventory, true)).toBe(true); // 9 - 8 - 2 → broken
    expect(lockTool(w.inventory)).toBe('none');
  });

  it('only one toolbox can be carried', () => {
    const w = { money: { clean: 500, dirty: 0 }, health: 100, inventory: emptyInventory() };
    expect(buy(w, 'toolbox').ok).toBe(true);
    expect(buy(w, 'toolbox')).toEqual({ ok: false, text: 'YOU ALREADY HAVE A TOOLBOX' });
    expect(w.money.clean).toBe(380);
  });
});

describe('sleep', () => {
  it('wakes at 06:00 the next day, or the same morning after midnight', () => {
    expect(sleepUntil(22 * 60, 360)).toBe(1440 + 360);
    expect(sleepUntil(1440 + 2 * 60, 360)).toBe(1440 + 360);
    expect(sleepUntil(1440 + 7 * 60, 360)).toBe(2 * 1440 + 360);
  });
});

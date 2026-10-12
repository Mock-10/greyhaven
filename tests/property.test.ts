import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { createState } from '../src/core/store';
import { runCalendar } from '../src/systems/days';
import { createCombat, giveWeapon } from '../src/systems/combat';
import {
  addonBlock,
  addonCost,
  buyAddon,
  buyHome,
  chargeTax,
  homeOf,
  moveDirty,
  parkingOf,
  stashFree,
  stashGoods,
  stashSlots,
  stashWeapon,
  unstashGoods,
  unstashWeapon,
} from '../src/systems/property';

const P = BALANCE.property;

function rich() {
  const st = createState(1, 'downtown', { x: 0, y: 0 });
  st.money.bank = 100000;
  return st;
}

describe('property (docs/09)', () => {
  it('buys a home with clean money, once', () => {
    const st = rich();
    expect(buyHome(st.property, st.money, st.finance, 0, 'linden4')).toBe(true);
    expect(st.money.bank).toBe(100000 - P.types.smallHouse.price);
    expect(buyHome(st.property, st.money, st.finance, 0, 'linden4')).toBe(false);
    st.money.bank = 0;
    st.money.dirty = 1e6;
    expect(buyHome(st.property, st.money, st.finance, 0, 'linden10')).toBe(false); // dirty doesn't count
  });

  it('add-ons need a free slot, the rep tier, and a built station', () => {
    const st = rich();
    buyHome(st.property, st.money, st.finance, 0, 'linden4');
    const h = homeOf(st.property, 'linden4')!;
    expect(addonBlock(h, 'workbench', 0)).toBe('tier');
    expect(addonBlock(h, 'press', 3)).toBe('notYet');
    expect(buyAddon(h, 'stashRoom', 0, 1, st.money, st.finance, 0)).toBe(true);
    expect(addonBlock(h, 'stashRoom', 0)).toBe('owned');
    expect(buyAddon(h, 'garageBay', 0, 1, st.money, st.finance, 0)).toBe(true);
    // a small house has two slots
    expect(addonBlock(h, 'workbench', 1)).toBe('slots');
    expect(parkingOf(h)).toBe(P.types.smallHouse.parking + P.garageBayParking);
    expect(stashSlots(h)).toBe(P.stashSlots + P.stashRoomSlots);
  });

  it('the garage bay is 30% off for a rank 4 mechanic', () => {
    expect(addonCost('garageBay', 3)).toBe(P.addons.garageBay.cost);
    expect(addonCost('garageBay', 4)).toBe(Math.round(P.addons.garageBay.cost * 0.7));
    expect(addonCost('workbench', 5)).toBe(P.addons.workbench.cost);
  });

  it('the stash holds dirty cash without slots, and items one slot each', () => {
    const st = rich();
    buyHome(st.property, st.money, st.finance, 0, 'linden4');
    const h = homeOf(st.property, 'linden4')!;
    st.money.dirty = 500;
    expect(moveDirty(h, st.money, 800)).toBe(500);
    expect(h.stash.dirty).toBe(500);
    expect(moveDirty(h, st.money, -200)).toBe(200);
    expect(st.money.dirty).toBe(200);
    const goods = [{ kind: 'laptop' as const, value: 300 }];
    expect(stashGoods(h, goods, 0)).toBe(true);
    expect(goods).toHaveLength(0);
    const c = createCombat();
    giveWeapon(c, 'pistol', false, 12, false);
    const slot = c.slots.findIndex((w) => w?.id === 'pistol');
    expect(stashWeapon(h, c, slot)).toBe(true);
    expect(stashFree(h)).toBe(P.stashSlots - 2);
    expect(unstashWeapon(h, c, 0)).toBe(true);
    expect(unstashGoods(h, goods, 0)).toBe(true);
    expect(stashFree(h)).toBe(P.stashSlots);
  });

  it('tax goes with Monday rent; what the bank can not cover is owed', () => {
    const st = rich();
    buyHome(st.property, st.money, st.finance, 0, 'linden10');
    st.money.bank = 10;
    expect(chargeTax(st.property, st.money, st.finance, 0)).toEqual({
      paid: 0,
      owed: P.types.familyHouse.weeklyTax,
    });
    st.money.bank = 1000;
    expect(chargeTax(st.property, st.money, st.finance, 0)!.paid).toBe(2 * P.types.familyHouse.weeklyTax);
    expect(st.property.taxOwed).toBe(0);
  });

  it('the calendar charges the tax on Monday morning', () => {
    const st = rich();
    buyHome(st.property, st.money, st.finance, 0, 'linden4');
    const before = st.money.bank;
    // a full week from the start covers one Monday 06:00
    const msgs = runCalendar(st, 0, 7 * 1440);
    expect(msgs.some((m) => m.text.startsWith('PROPERTY TAX PAID'))).toBe(true);
    expect(st.money.bank).toBeLessThanOrEqual(before - P.types.smallHouse.weeklyTax);
  });
});

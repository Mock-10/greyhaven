import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { Rng } from '../src/core/rng';
import { createState } from '../src/core/store';
import { coloursOf } from '../src/data/vehicles';
import { payClean, repair, repairCost, respray, upgrade, upgradeCost } from '../src/systems/carService';
import { createCombat, giveWeapon } from '../src/systems/combat';
import {
  searchTrunk,
  storeGoods,
  storeWeapon,
  takeGoods,
  takeWeapon,
  trunkFree,
  trunkSlots,
} from '../src/systems/trunk';
import { onStrip, parkedCar, stats, topSpeed } from '../src/systems/vehicle';

const V = BALANCE.vehicles;
const car = () => ({ ...parkedCar('c', 'sedan_teal', 0, 0, 0), owned: true });

describe('car service (docs/08)', () => {
  it('prices repairs from 5% to 40% of value by the damage, 20% off for mechanics', () => {
    const v = car();
    expect(repairCost(v, false)).toBe(0);
    const value = V.types.sedan.value;
    v.health = stats(v).health * 0.5;
    const half = value * (V.repairShare[0] + (V.repairShare[1] - V.repairShare[0]) * 0.5);
    expect(repairCost(v, false)).toBe(Math.round(half));
    expect(repairCost(v, true)).toBe(Math.round(half * (1 - V.mechanicDiscount)));
    repair(v);
    expect(v.health).toBe(stats(v).health);
  });

  it('fits upgrades level by level up to the top; armor raises health', () => {
    const v = car();
    const h0 = stats(v).health;
    expect(upgradeCost(v, 'engine')).toBe(V.upgrades.engine.costs[0]);
    upgrade(v, 'engine');
    expect(stats(v).topSpeed).toBeCloseTo(V.types.sedan.topSpeed * (1 + V.upgrades.engine.perLevel));
    upgrade(v, 'armor');
    expect(v.health).toBe(stats(v).health);
    expect(stats(v).health).toBeGreaterThan(h0);
    upgrade(v, 'hidden');
    expect(upgradeCost(v, 'hidden')).toBeNull();
  });

  it('resprays to a new colour of the same model and clears the hot status', () => {
    const v = car();
    v.hotUntil = 9999;
    const m = respray(v, new Rng(3));
    expect(m).not.toBe('sedan_teal');
    expect(coloursOf('sedan_teal')).toContain(m);
    expect(v.hotUntil).toBe(0);
  });

  it('pays clean money from the bank first, then cash', () => {
    const st = createState(1, 'downtown', { x: 0, y: 0 });
    st.money.bank = 300;
    st.money.clean = 200;
    expect(payClean(st.money, st.finance, 0, 'X', 400)).toBe(true);
    expect(st.money.bank).toBe(0);
    expect(st.money.clean).toBe(100);
    expect(payClean(st.money, st.finance, 0, 'X', 400)).toBe(false);
  });

  it('spike strips burst the tyres: half speed until the garage repairs them', () => {
    const v = car();
    expect(onStrip(v, { x: 10, y: 0, hx: 40, hy: 5, ang: Math.PI / 2 })).toBe(true);
    expect(onStrip(v, { x: 200, y: 0, hx: 40, hy: 5, ang: Math.PI / 2 })).toBe(false);
    const full = topSpeed(v);
    v.flat = true;
    expect(topSpeed(v)).toBeCloseTo(full * V.flat.speed);
    expect(repairCost(v, false)).toBe(V.flat.repair);
    repair(v);
    expect(v.flat).toBeUndefined();
  });
});

describe('your own trunk (docs/08)', () => {
  it('stores weapons and goods, one slot each, up to the trunk size', () => {
    const v = car();
    const c = createCombat();
    giveWeapon(c, 'pistol', false, 12, false);
    const goods = [
      { kind: 'laptop' as const, value: 300 },
      { kind: 'jewellery' as const, value: 500 },
    ];
    const slot = c.slots.findIndex((w) => w?.id === 'pistol');
    expect(storeWeapon(c, v, slot)).toBe(true);
    expect(c.slots[slot]).toBeNull();
    expect(storeGoods(goods, v, 0)).toBe(true);
    expect(trunkFree(v)).toBe(trunkSlots(v) - 2);
    expect(takeWeapon(c, v, 0)).toBe(true);
    expect(c.slots[slot]?.id).toBe('pistol');
    expect(takeGoods(goods, v, 0)).toBe(true);
    expect(goods).toHaveLength(2);
    for (let k = 0; k < trunkSlots(v); k++) storeGoods([{ kind: 'console', value: 50 }], v, 0);
    expect(trunkFree(v)).toBe(0);
    expect(storeGoods(goods, v, 0)).toBe(false);
  });

  it('a police search takes goods and unregistered guns; the hidden compartment usually passes', () => {
    const v = car();
    v.stash = {
      weapons: [
        { id: 'pistol', registered: true, clip: 0 },
        { id: 'bat', registered: false, clip: 0 },
      ],
      goods: [{ kind: 'laptop', value: 300 }],
    };
    expect(searchTrunk(v, new Rng(1))).toBe(2);
    expect(v.stash.weapons.map((w) => w.id)).toEqual(['pistol']);
    let passed = 0;
    for (let s = 1; s <= 200; s++) {
      const h = { ...car(), mods: { engine: 0, brakes: 0, armor: 0, tires: 0, hidden: 1 } };
      h.stash = { weapons: [], goods: [{ kind: 'laptop', value: 1 }] };
      if (searchTrunk(h, new Rng(s)) === 0) passed++;
    }
    expect(passed / 200).toBeGreaterThan(V.hiddenPassChance - 0.12);
    expect(passed / 200).toBeLessThan(V.hiddenPassChance + 0.12);
  });
});

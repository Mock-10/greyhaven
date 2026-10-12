// Property (docs/09, Phase 5): homes bought outright with clean money, each a save and sleep point with a stash (dirty
// cash and items) and a hideout under it whose stations come with the add-ons. Weekly tax goes with Monday's rent.
// Pure code: the world shows it (scenes/WorldScene.ts, world/propertyPages.ts).

import { BALANCE } from '../config/balance';
import { ADDONS, HOMES, type AddonId, type HomeId } from '../data/property';
import type { Goods } from './burglary';
import { drawnWeapon, giveWeapon, selectSlot, type CombatState, type OwnedWeapon } from './combat';
import { payClean } from './carService';
import { record, type Finance, type Money } from './finance';

const P = () => BALANCE.property;

export interface Stash {
  dirty: number;
  goods: Goods[];
  weapons: OwnedWeapon[];
}

export interface OwnedHome {
  id: HomeId;
  addons: AddonId[];
  stash: Stash;
}

export interface PropertyState {
  homes: OwnedHome[];
  /** Tax that the bank couldn't cover on a Monday; taken with the next week's (no foreclosure, assumed). */
  taxOwed: number;
}

export function createProperty(): PropertyState {
  return { homes: [], taxOwed: 0 };
}

export function homeOf(p: PropertyState, id: HomeId): OwnedHome | null {
  return p.homes.find((h) => h.id === id) ?? null;
}

export function typeOf(id: HomeId) {
  return P().types[HOMES[id].type];
}

/** Buy a home on the market with clean money (the bank first, then carried cash). */
export function buyHome(p: PropertyState, m: Money, f: Finance, at: number, id: HomeId): boolean {
  if (homeOf(p, id)) return false;
  if (!payClean(m, f, at, `HOME, ${HOMES[id].address}`, typeOf(id).price)) return false;
  p.homes.push({ id, addons: [], stash: { dirty: 0, goods: [], weapons: [] } });
  return true;
}

/** An add-on's price: the garage bay is 30% off for a mechanic of rank 4 or more (docs/09). */
export function addonCost(id: AddonId, mechanicRank: number): number {
  const base = P().addons[id].cost;
  return id === 'garageBay' && mechanicRank >= P().mechanicBayRank
    ? Math.round(base * (1 - P().mechanicBayDiscount))
    : base;
}

export type AddonBlock = 'owned' | 'slots' | 'tier' | 'notYet';

/** Why an add-on can't be bought here, or null. */
export function addonBlock(h: OwnedHome, id: AddonId, repTier: number): AddonBlock | null {
  if (h.addons.includes(id)) return 'owned';
  if (!ADDONS[id].ready) return 'notYet';
  if (repTier < P().addons[id].tier) return 'tier';
  if (h.addons.length >= typeOf(h.id).slots) return 'slots';
  return null;
}

export function buyAddon(
  h: OwnedHome,
  id: AddonId,
  repTier: number,
  mechanicRank: number,
  m: Money,
  f: Finance,
  at: number,
): boolean {
  if (addonBlock(h, id, repTier)) return false;
  if (!payClean(m, f, at, `HIDEOUT, ${ADDONS[id].name}`, addonCost(id, mechanicRank))) return false;
  h.addons.push(id);
  return true;
}

export function parkingOf(h: OwnedHome): number {
  return typeOf(h.id).parking + (h.addons.includes('garageBay') ? P().garageBayParking : 0);
}

// ---- the stash ----

export function stashSlots(h: OwnedHome): number {
  return P().stashSlots + (h.addons.includes('stashRoom') ? P().stashRoomSlots : 0);
}

export function stashUsed(h: OwnedHome): number {
  return h.stash.goods.length + h.stash.weapons.length;
}

export function stashFree(h: OwnedHome): number {
  return Math.max(0, stashSlots(h) - stashUsed(h));
}

/** Dirty cash in or out (no slots). Returns the amount moved. */
export function moveDirty(h: OwnedHome, m: Money, amount: number): number {
  const n = Math.trunc(amount);
  if (n > 0) {
    const k = Math.min(n, m.dirty);
    m.dirty -= k;
    h.stash.dirty += k;
    return k;
  }
  const k = Math.min(-n, h.stash.dirty);
  h.stash.dirty -= k;
  m.dirty += k;
  return k;
}

export function stashGoods(h: OwnedHome, carried: Goods[], i: number): boolean {
  const g = carried[i];
  if (!g || stashFree(h) <= 0) return false;
  h.stash.goods.push(g);
  carried.splice(i, 1);
  return true;
}

export function unstashGoods(h: OwnedHome, carried: Goods[], i: number): boolean {
  const g = h.stash.goods[i];
  if (!g) return false;
  carried.push(g);
  h.stash.goods.splice(i, 1);
  return true;
}

export function stashWeapon(h: OwnedHome, c: CombatState, slot: number): boolean {
  const w = c.slots[slot];
  if (!w || stashFree(h) <= 0) return false;
  h.stash.weapons.push(w);
  c.slots[slot] = null;
  if (!drawnWeapon(c)) selectSlot(c, -1);
  return true;
}

/** A stored weapon back into a free slot of its kind (never a second of the same). */
export function unstashWeapon(h: OwnedHome, c: CombatState, i: number): boolean {
  const w = h.stash.weapons[i];
  if (!w) return false;
  const r = giveWeapon(c, w.id, w.registered, 0, false);
  if (!r.ok) return false;
  c.slots[r.slot] = { ...w };
  h.stash.weapons.splice(i, 1);
  return true;
}

// ---- tax ----

export function weeklyTax(p: PropertyState): number {
  return p.homes.reduce((t, h) => t + typeOf(h.id).weeklyTax, 0);
}

/** Monday 06:00: this week's tax plus anything owed, from the bank if it covers it all. Returns what was paid (or
 *  null with no homes). */
export function chargeTax(
  p: PropertyState,
  m: Money,
  f: Finance,
  at: number,
): { paid: number; owed: number } | null {
  const due = weeklyTax(p) + p.taxOwed;
  if (due <= 0) return null;
  if (m.bank >= due) {
    m.bank -= due;
    record(f, at, 'PROPERTY TAX', -due);
    p.taxOwed = 0;
    return { paid: due, owed: 0 };
  }
  p.taxOwed = due;
  return { paid: 0, owed: due };
}

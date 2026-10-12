// Property (docs/09, Phase 5): homes bought outright with clean money, each a save and sleep point with a stash (dirty
// cash and items) and a hideout under it whose stations come with the add-ons. Weekly tax goes with Monday's rent.
// Pure code: the world shows it (scenes/WorldScene.ts, world/propertyPages.ts).

import { BALANCE } from '../config/balance';
import { ADDONS, HOMES, type AddonId, type HomeId } from '../data/property';
import type { Goods } from './burglary';
import { drawnWeapon, giveWeapon, selectSlot, type CombatState, type OwnedWeapon } from './combat';
import { payClean } from './carService';
import type { OpId, OpState } from './operations';
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
  /** The hideout's operations (systems/operations.ts, Phase 5 M16), once their add-ons are built. */
  ops?: Partial<Record<OpId, OpState>>;
}

export interface PropertyState {
  homes: OwnedHome[];
  /** Tax that the bank couldn't cover on a Monday; taken with the next week's (no foreclosure, assumed). */
  taxOwed: number;
  /** The rented apartment's stash (docs/09: every home has one). */
  apartment: Stash;
}

export function emptyStash(): Stash {
  return { dirty: 0, goods: [], weapons: [] };
}

export function createProperty(): PropertyState {
  return { homes: [], taxOwed: 0, apartment: emptyStash() };
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
  p.homes.push({ id, addons: [], stash: emptyStash(), ops: {} });
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

/** A stash and how many items it holds: a home's (docs/09), or the rented apartment's. */
export interface StashBox {
  stash: Stash;
  cap: number;
}

export type StashPlace = HomeId | 'apartment';

export function stashSlots(h: OwnedHome): number {
  return P().stashSlots + (h.addons.includes('stashRoom') ? P().stashRoomSlots : 0);
}

/** The stash at a place, or null for a home you don't own. */
export function stashAt(p: PropertyState, where: StashPlace): StashBox | null {
  if (where === 'apartment') return { stash: p.apartment, cap: P().stashSlots };
  const h = homeOf(p, where);
  return h ? { stash: h.stash, cap: stashSlots(h) } : null;
}

export function stashUsed(s: Stash): number {
  return s.goods.length + s.weapons.length;
}

export function stashFree(b: StashBox): number {
  return Math.max(0, b.cap - stashUsed(b.stash));
}

/** Dirty cash in (positive) or out (negative); it takes no slots. Returns the amount moved. */
export function moveDirty(s: Stash, m: Money, amount: number): number {
  const n = Math.trunc(amount);
  if (n > 0) {
    const k = Math.min(n, m.dirty);
    m.dirty -= k;
    s.dirty += k;
    return k;
  }
  const k = Math.min(-n, s.dirty);
  s.dirty -= k;
  m.dirty += k;
  return k;
}

export function stashGoods(b: StashBox, carried: Goods[], i: number): boolean {
  const g = carried[i];
  if (!g || stashFree(b) <= 0) return false;
  b.stash.goods.push(g);
  carried.splice(i, 1);
  return true;
}

export function unstashGoods(s: Stash, carried: Goods[], i: number): boolean {
  const g = s.goods[i];
  if (!g) return false;
  carried.push(g);
  s.goods.splice(i, 1);
  return true;
}

export function stashWeapon(b: StashBox, c: CombatState, slot: number): boolean {
  const w = c.slots[slot];
  if (!w || stashFree(b) <= 0) return false;
  b.stash.weapons.push(w);
  c.slots[slot] = null;
  if (!drawnWeapon(c)) selectSlot(c, -1);
  return true;
}

/** A stored weapon back into a free slot of its kind (never a second of the same). */
export function unstashWeapon(s: Stash, c: CombatState, i: number): boolean {
  const w = s.weapons[i];
  if (!w) return false;
  const r = giveWeapon(c, w.id, w.registered, 0, false);
  if (!r.ok) return false;
  c.slots[r.slot] = { ...w };
  s.weapons.splice(i, 1);
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

// Your own car's trunk (docs/08 "Trunks", Phase 4): weapons and burglary goods kept in the car, one trunk slot each,
// and the police search when you're booked out of it (the hidden compartment passes it most of the time). Pure code.

import { BALANCE } from '../config/balance';
import type { Rng } from '../core/rng';
import type { Goods } from './burglary';
import { drawnWeapon, giveWeapon, selectSlot, type CombatState } from './combat';
import type { TrunkStash, Vehicle } from './vehicle';

export function stashOf(v: Vehicle): TrunkStash {
  if (!v.stash) v.stash = { weapons: [], goods: [] };
  return v.stash;
}

export function trunkSlots(v: Pick<Vehicle, 'type'>): number {
  return BALANCE.vehicles.trunkSlots[v.type];
}

export function trunkUsed(v: Vehicle): number {
  const s = v.stash;
  return s ? s.weapons.length + s.goods.length : 0;
}

export function trunkFree(v: Vehicle): number {
  return Math.max(0, trunkSlots(v) - trunkUsed(v));
}

/** Put the weapon in loadout slot `slot` in the trunk (its clip stays with it; reserve ammo stays on you). */
export function storeWeapon(c: CombatState, v: Vehicle, slot: number): boolean {
  const w = c.slots[slot];
  if (!w || trunkFree(v) <= 0) return false;
  stashOf(v).weapons.push(w);
  c.slots[slot] = null;
  if (!drawnWeapon(c)) selectSlot(c, -1);
  return true;
}

/** Take a stored weapon back: only into a free slot of its kind, never a second of the same. */
export function takeWeapon(c: CombatState, v: Vehicle, i: number): boolean {
  const s = stashOf(v);
  const w = s.weapons[i];
  if (!w) return false;
  const r = giveWeapon(c, w.id, w.registered, 0, false);
  if (!r.ok) return false;
  c.slots[r.slot] = { ...w };
  s.weapons.splice(i, 1);
  return true;
}

export function storeGoods(carried: Goods[], v: Vehicle, i: number): boolean {
  const g = carried[i];
  if (!g || trunkFree(v) <= 0) return false;
  stashOf(v).goods.push(g);
  carried.splice(i, 1);
  return true;
}

export function takeGoods(carried: Goods[], v: Vehicle, i: number): boolean {
  const s = stashOf(v);
  const g = s.goods[i];
  if (!g) return false;
  carried.push(g);
  s.goods.splice(i, 1);
  return true;
}

/** Booked out of this car (docs/08): the police search the trunk and take the goods and unregistered weapons,
 *  unless a hidden compartment passes the search. Returns how many items were taken. */
export function searchTrunk(v: Vehicle, rng: Rng): number {
  const s = v.stash;
  if (!s || trunkUsed(v) === 0) return 0;
  if ((v.mods?.hidden ?? 0) > 0 && rng.chance(BALANCE.vehicles.hiddenPassChance)) return 0;
  const taken = s.goods.length + s.weapons.filter((w) => !w.registered).length;
  s.goods = [];
  s.weapons = s.weapons.filter((w) => w.registered);
  return taken;
}

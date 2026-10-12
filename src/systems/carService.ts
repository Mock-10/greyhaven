// The mechanic's services for your car (docs/08, Phase 4): repairs by the damage, the upgrades in levels, and the
// respray that changes the colour and clears a stolen car's hot status. Clean money: the bank first, then carried
// clean cash (like the car dealer). Pure code.

import { BALANCE } from '../config/balance';
import { coloursOf } from '../data/vehicles';
import type { Rng } from '../core/rng';
import { record, type Finance, type Money } from './finance';
import { NO_MODS, stats, type CarMods, type Vehicle } from './vehicle';

export type UpgradeId = keyof CarMods;
export const UPGRADES: readonly UpgradeId[] = ['engine', 'brakes', 'armor', 'tires', 'hidden'];

export const UPGRADE_NAMES: Record<UpgradeId, string> = {
  engine: 'ENGINE',
  brakes: 'BRAKES',
  armor: 'ARMOR',
  tires: 'TIRES',
  hidden: 'HIDDEN COMPARTMENT',
};

/** Pay clean money: the bank first (a statement line), then carried cash. False when the two don't cover it. */
export function payClean(m: Money, f: Finance, at: number, what: string, price: number): boolean {
  if (m.bank + m.clean < price) return false;
  const fromBank = Math.min(m.bank, price);
  if (fromBank > 0) {
    m.bank -= fromBank;
    record(f, at, what, -fromBank);
  }
  m.clean -= price - fromBank;
  return true;
}

/** What a full repair costs: 5% of the car's value for a scratch up to 40% for a near-wreck; −20% for mechanics. */
export function repairCost(v: Vehicle, mechanic: boolean): number {
  const S = stats(v);
  const missing = Math.max(0, 1 - v.health / S.health);
  const tyres = v.flat ? BALANCE.vehicles.flat.repair : 0;
  if (missing <= 0) return Math.round(tyres * (mechanic ? 1 - BALANCE.vehicles.mechanicDiscount : 1));
  const [lo, hi] = BALANCE.vehicles.repairShare;
  const base = BALANCE.vehicles.types[v.type].value * (lo + (hi - lo) * missing) + tyres;
  return Math.round(base * (mechanic ? 1 - BALANCE.vehicles.mechanicDiscount : 1));
}

export function repair(v: Vehicle): void {
  v.health = stats(v).health;
  v.wrecked = false;
  v.burning = undefined;
  v.flat = undefined;
}

/** The next level's price, or null at the top. */
export function upgradeCost(v: Vehicle, id: UpgradeId): number | null {
  const level = (v.mods ?? NO_MODS)[id];
  return BALANCE.vehicles.upgrades[id].costs[level] ?? null;
}

/** Fit the next level. Armor raises the car's health with it (the new health is kept full). */
export function upgrade(v: Vehicle, id: UpgradeId): void {
  const mods = { ...(v.mods ?? NO_MODS) };
  const before = stats(v).health;
  mods[id] += 1;
  v.mods = mods;
  if (id === 'armor') v.health += stats(v).health - before;
}

/** A new colour of the same car, never the one it has; the hot status goes (docs/08). */
export function respray(v: Vehicle, rng: Rng): string {
  const others = coloursOf(v.model).filter((m) => m !== v.model);
  if (others.length) v.model = rng.pick(others);
  v.hotUntil = 0;
  return v.model;
}

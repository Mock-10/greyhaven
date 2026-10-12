// The used-car lot (docs/08, docs/02 vehicle prices): buying a beater or a sedan with clean money. The bank card
// pays first, then carried clean cash. The car is registered to you: unlocked, keyed, full tank, never hot, and it
// waits in the lot's pickup bay. Pure code.

import { BALANCE } from '../config/balance';
import { typeOfModel, TYPE_LABEL } from '../data/vehicles';
import { record, type Finance, type Money } from './finance';
import { parkedCar, type Vehicle } from './vehicle';

export function carPrice(model: string, discount = 0): number {
  return Math.round(BALANCE.vehicles.types[typeOfModel(model)].value * (1 - discount));
}

/** Can the buyer afford it with the bank and carried clean cash together? */
export function canAfford(m: Money, price: number): boolean {
  return m.bank + m.clean >= price;
}

/** Pay the dealer: the bank first (a statement line), then carried clean cash. False when it can't be covered. */
export function payDealer(m: Money, f: Finance, at: number, model: string, discount = 0): boolean {
  const price = carPrice(model, discount);
  if (!canAfford(m, price)) return false;
  const fromBank = Math.min(m.bank, price);
  m.bank -= fromBank;
  m.clean -= price - fromBank;
  record(f, at, `USED CARS: ${TYPE_LABEL[typeOfModel(model)]}`, -price);
  return true;
}

/** Is the pickup bay clear (no other car within the clearance)? */
export function bayFree(vehicles: readonly Vehicle[], slot: { x: number; y: number }): boolean {
  const r = BALANCE.dealer.bayClearance;
  return !vehicles.some((v) => !v.wrecked && Math.hypot(v.x - slot.x, v.y - slot.y) < r);
}

/** A newly bought car in the bay: owned, unlocked, keyed, full tank. */
export function boughtCar(id: string, model: string, slot: { x: number; y: number; dir: number }): Vehicle {
  const v = parkedCar(id, model, slot.x, slot.y, slot.dir);
  v.owned = true;
  v.locked = false;
  v.running = true;
  v.fuel = BALANCE.vehicles.types[v.type].tank * BALANCE.dealer.fullTank;
  return v;
}

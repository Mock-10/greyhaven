// Buying from a shop (Phase 1 corner store). Clean money only: the cashier refuses dirty cash (docs/02).

import { BALANCE } from '../config/balance';
import { ITEMS, type ItemId } from '../data/items';

export interface Wallet {
  money: { clean: number; dirty: number };
  health: number;
  inventory: { fuelCans: number };
}

export type BuyResult = { ok: true; text: string } | { ok: false; text: string };

export function priceOf(id: ItemId): number {
  return BALANCE.shop[id].price;
}

/** Buy one item: pay in clean cash, then eat it (heal) or carry it. */
export function buy(w: Wallet, id: ItemId): BuyResult {
  const price = priceOf(id);
  if (w.money.clean < price) return { ok: false, text: 'NOT ENOUGH CLEAN CASH' };
  w.money.clean -= price;
  const item = ITEMS[id];
  if (item.use === 'eat') {
    const before = w.health;
    w.health = Math.min(BALANCE.player.maxHealth, w.health + BALANCE.shop[id].heal);
    return {
      ok: true,
      text: w.health > before ? `ATE ${item.name} +${w.health - before} HP` : `ATE ${item.name}`,
    };
  }
  w.inventory.fuelCans += 1;
  return { ok: true, text: `BOUGHT A ${item.name}` };
}

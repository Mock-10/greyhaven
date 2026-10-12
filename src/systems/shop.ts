// Buying from a legal shop (docs/02). Clean carried cash only: the cashier refuses dirty cash, and the bank card
// isn't taken at the counter (ATMs stand next to the shops).

import { BALANCE } from '../config/balance';
import type { Inventory } from '../core/store';
import { ITEMS, type ItemId } from '../data/items';

export interface Wallet {
  money: { clean: number; dirty: number };
  health: number;
  inventory: Inventory;
  /** Share off the price (the office expense account, systems/career.ts legalDiscount). */
  discount?: number;
}

export type BuyResult = { ok: true; text: string } | { ok: false; text: string };

export function priceOf(id: ItemId, discount = 0): number {
  return Math.round(BALANCE.shop[id].price * (1 - discount));
}

/** Buy one item: pay in clean cash, then eat it (heal) or put it in the bag. */
export function buy(w: Wallet, id: ItemId): BuyResult {
  const price = priceOf(id, w.discount);
  const item = ITEMS[id];
  if (item.single && item.slot && w.inventory[item.slot] > 0)
    return { ok: false, text: `YOU ALREADY HAVE A ${item.name}` };
  if (w.money.clean < price) return { ok: false, text: 'NOT ENOUGH CLEAN CASH' };
  w.money.clean -= price;
  if (item.use === 'eat') {
    const before = w.health;
    w.health = Math.min(BALANCE.player.maxHealth, w.health + BALANCE.shop[id].heal);
    return {
      ok: true,
      text: w.health > before ? `ATE ${item.name} +${w.health - before} HP` : `ATE ${item.name}`,
    };
  }
  if (item.slot) w.inventory[item.slot] += BALANCE.shop[id].adds;
  return { ok: true, text: `BOUGHT ${item.name}` };
}

/** Use a first-aid kit from the bag: full health. */
export function useFirstAid(w: Wallet): BuyResult {
  if (w.inventory.firstAid <= 0) return { ok: false, text: 'NO FIRST-AID KIT' };
  if (w.health >= BALANCE.player.maxHealth) return { ok: false, text: 'ALREADY AT FULL HEALTH' };
  w.inventory.firstAid -= 1;
  const gained = BALANCE.player.maxHealth - w.health;
  w.health = BALANCE.player.maxHealth;
  return { ok: true, text: `FIRST AID +${Math.round(gained)} HP` };
}

/** Which lockpicking tool the player has (docs/06): a basic set while it has uses left. */
export function lockTool(inv: Inventory): 'none' | 'basic' {
  return inv.lockpicks > 0 ? 'basic' : 'none';
}

/** Wear the lockpicks after an attempt: 1 use, 2 for a failure (docs/06). Returns true when the set just broke. */
export function wearLockpicks(inv: Inventory, failed: boolean): boolean {
  if (inv.lockpicks <= 0) return false;
  const T = BALANCE.minigames.tools;
  inv.lockpicks = Math.max(0, inv.lockpicks - (failed ? T.failUses : 1));
  return inv.lockpicks === 0;
}

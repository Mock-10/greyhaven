// The clothing store and the wardrobe (docs/02 Phase 2 shops, docs/11 outfits). Outfits are bought once with
// clean carried cash (like every legal shop, systems/shop.ts) and kept in the wardrobe; changing is free at the
// apartment wardrobe or a fitting booth. Pure code.

import { BALANCE } from '../config/balance';
import { OUTFITS, outfitOf, type Look } from '../data/looks';
import type { BuyResult } from './shop';

/** The outfits the clothing store sells, in rack order. */
export const CLOTHING_STOCK: readonly string[] = OUTFITS.filter((o) => o.from === 'clothing').map(
  (o) => o.id,
);

export function outfitPrice(id: string, discount = 0): number {
  return Math.round((BALANCE.clothing[id] ?? 0) * (1 - discount));
}

/** Buy an outfit: pay in clean cash and hang it in the wardrobe (you can change into it right away). */
export function buyOutfit(money: { clean: number }, wardrobe: string[], id: string, discount = 0): BuyResult {
  const name = outfitOf(id).name;
  if (wardrobe.includes(id)) return { ok: false, text: `YOU ALREADY OWN THE ${name}` };
  const price = outfitPrice(id, discount);
  if (money.clean < price) return { ok: false, text: 'NOT ENOUGH CLEAN CASH' };
  money.clean -= price;
  wardrobe.push(id);
  return { ok: true, text: `BOUGHT THE ${name}` };
}

/** The look in another owned outfit, or null when it isn't in the wardrobe. */
export function wearOutfit(look: Look, wardrobe: readonly string[], id: string): Look | null {
  if (!wardrobe.includes(id)) return null;
  return { ...look, outfit: id };
}

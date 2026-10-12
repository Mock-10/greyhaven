// The clothing store's till, the wardrobe and the used-car lot's desk as list pages (ui/listPanel.ts), with a
// picture per outfit and per car (docs/11 redesign). The pages change the game state through the context and are
// rebuilt after every action, so prices and balances stay current.

import type { GameState } from '../core/store';
import { outfitOf } from '../data/looks';
import { DEALER_STOCK, MODEL_COLOUR, TYPE_LABEL, typeOfModel } from '../data/vehicles';
import { CLOTHING_STOCK, buyOutfit, outfitPrice } from '../systems/clothing';
import { canAfford, carPrice } from '../systems/dealer';
import type { IconName } from '../ui/icons';
import type { ListPage, ListRow } from '../ui/listPanel';

export interface ShopCtx {
  state: GameState;
  /** Change into an owned outfit (the world repaints the player). */
  wear: (outfit: string) => void;
  /** Buy a car: returns what the salesman says. */
  buyCar: (model: string) => string;
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

/** The clothing store: each outfit with its price; owned ones say so. Buying puts it on straight away. */
export function clothingPage(ctx: ShopCtx): ListPage {
  const st = ctx.state;
  const rows: ListRow[] = CLOTHING_STOCK.map((id) => {
    const o = outfitOf(id);
    const owned = st.wardrobe.includes(id);
    const price = outfitPrice(id);
    return {
      label: o.name,
      icon: `outfit/${id}` as IconName,
      sub: owned ? (st.look.outfit === id ? 'WEARING IT' : 'IN YOUR WARDROBE') : 'BUY AND WEAR',
      detail: owned ? 'OWNED' : money(price),
      enabled: owned || st.money.clean >= price,
      act: () => {
        if (owned) {
          ctx.wear(id);
          return { say: `YOU PUT ON THE ${o.name}` };
        }
        const r = buyOutfit(st.money, st.wardrobe, id);
        if (r.ok) ctx.wear(id);
        return { say: r.text };
      },
    };
  });
  return { title: 'CLOTHING', right: `CASH ${money(st.money.clean)}`, lines: ['CLEAN CASH ONLY.'], rows };
}

/** The wardrobe (or a fitting booth): every owned outfit, the one you wear marked. */
export function wardrobePage(ctx: ShopCtx): ListPage {
  const st = ctx.state;
  const rows: ListRow[] = st.wardrobe.map((id) => {
    const o = outfitOf(id);
    const on = st.look.outfit === id;
    return {
      label: o.name,
      icon: `outfit/${id}` as IconName,
      sub: on ? 'WEARING IT' : 'CHANGE INTO IT',
      enabled: !on,
      act: () => {
        ctx.wear(id);
        return { say: `YOU PUT ON THE ${o.name}` };
      },
    };
  });
  return { title: 'WARDROBE', right: `${rows.length} OUTFITS`, rows };
}

/** The used-car lot: beaters and sedans by colour; the bank card pays first, then clean cash. */
export function dealerPage(ctx: ShopCtx): ListPage {
  const st = ctx.state;
  const rows: ListRow[] = DEALER_STOCK.map((model) => {
    const price = carPrice(model);
    return {
      label: `${TYPE_LABEL[typeOfModel(model)]}, ${MODEL_COLOUR[model] ?? ''}`,
      icon: `car/${model}` as IconName,
      sub: 'FULL TANK, YOUR NAME ON IT',
      detail: money(price),
      enabled: canAfford(st.money, price),
      act: () => ({ say: ctx.buyCar(model) }),
    };
  });
  return {
    title: 'USED CARS',
    right: `BANK + CASH ${money(st.money.bank + st.money.clean)}`,
    lines: ['CLEAN MONEY. CARD FIRST, THEN CASH.'],
    rows,
  };
}

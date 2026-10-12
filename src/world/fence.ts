// The fence at the pawn shop (docs/04 "Fence", docs/10: tier 0 service): buys stolen goods (burglary goods, trunk
// phones and watches) for dirty cash, and sells masks and, from Known, the ATM drill. A list page like the shops
// (world/shops.ts); the pawn shop's interior comes later, so the fence deals at the shop's door.

import { BALANCE_CRIME } from '../config/balanceCrime';
import type { GameState } from '../core/store';
import { MASKS } from '../data/masks';
import { canBuyDrill } from '../systems/atmCrime';
import { fencePrice, sellToFence } from '../systems/burglary';
import type { ListPage, ListRow } from '../ui/listPanel';

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

/** Pay a price from carried dirty cash first, then clean. False when the two together don't cover it. */
export function payCash(m: { clean: number; dirty: number }, price: number): boolean {
  if (m.dirty + m.clean < price) return false;
  const fromDirty = Math.min(m.dirty, price);
  m.dirty -= fromDirty;
  m.clean -= price - fromDirty;
  return true;
}

/** What the fence would pay for everything stolen in the bag. */
export function stolenValue(st: GameState): number {
  const F = BALANCE_CRIME.fence;
  return (
    st.goods.reduce((t, g) => t + fencePrice(g), 0) +
    st.inventory.phones * F.phone +
    st.inventory.watches * F.watch
  );
}

export function fencePage(st: GameState): ListPage {
  const F = BALANCE_CRIME.fence;
  const A = BALANCE_CRIME.atm;
  const items = st.goods.length + st.inventory.phones + st.inventory.watches;
  const worth = stolenValue(st);
  const rows: ListRow[] = [
    {
      label: 'SELL STOLEN GOODS',
      icon: 'item/watch',
      sub: items ? `${items} ITEM${items > 1 ? 'S' : ''}` : 'NOTHING TO SELL',
      detail: items ? money(worth) : undefined,
      enabled: items > 0,
      act: () => ({ say: `+${money(sellToFence(st.money, st.inventory, st.goods))} DIRTY. PLEASURE.` }),
    },
  ];
  for (const m of MASKS) {
    const price = F.masks[m.id] ?? 0;
    const owned = st.masks.includes(m.id);
    rows.push({
      label: m.name,
      icon: 'item/mask',
      sub: owned ? 'YOURS. M PUTS IT ON' : 'HIDES YOUR FACE',
      detail: owned ? 'OWNED' : money(price),
      enabled: !owned && st.money.dirty + st.money.clean >= price,
      act: () => {
        if (!payCash(st.money, price)) return { say: 'CASH FIRST.' };
        st.masks.push(m.id);
        return { say: `THE ${m.name}. PRESS M TO WEAR IT.` };
      },
    });
  }
  const drillOpen = canBuyDrill(st.crime.rep);
  rows.push({
    label: 'ATM DRILL',
    icon: 'item/drill',
    sub: !drillOpen
      ? 'WHEN YOU ARE KNOWN'
      : st.inventory.drill > 0
        ? `${st.inventory.drill} USES LEFT`
        : 'LOUD BUT SURE',
    detail: money(A.drillPrice),
    enabled: drillOpen && st.inventory.drill === 0 && st.money.dirty >= A.drillPrice,
    act: () => {
      if (st.money.dirty < A.drillPrice) return { say: 'DIRTY CASH ONLY FOR THAT.' };
      st.money.dirty -= A.drillPrice;
      st.inventory.drill = A.drillUses;
      return { say: `${A.drillUses} GOOD HOLES IN IT. DON'T GET CAUGHT.` };
    },
  });
  return {
    title: 'THE FENCE',
    icon: 'face/fence',
    right: `DIRTY ${money(st.money.dirty)}`,
    lines: ['NO RECEIPTS, NO QUESTIONS.'],
    rows,
  };
}

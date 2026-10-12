// Your own car's trunk (docs/08 "Trunks", Phase 4) as a list page (ui/listPanel.ts): what's in it, to take out, and
// what you carry, to put in. One trunk slot per weapon or item of goods.

import type { GameState } from '../core/store';
import { GOODS_NAMES, type GoodsKind } from '../data/burglary';
import { TYPE_LABEL } from '../data/vehicles';
import { WEAPONS } from '../data/weapons';
import type { Goods } from '../systems/burglary';
import {
  storeGoods,
  storeWeapon,
  takeGoods,
  takeWeapon,
  trunkFree,
  trunkSlots,
  trunkUsed,
} from '../systems/trunk';
import type { Vehicle } from '../systems/vehicle';
import type { IconName } from '../ui/icons';
import type { ListPage, ListRow } from '../ui/listPanel';

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

const GOODS_ICON: Record<GoodsKind, IconName> = {
  jewellery: 'item/watch',
  electronics: 'item/phone',
  laptop: 'item/phone',
  silverware: 'item/junk',
  console: 'item/phone',
  cash_tin: 'item/cash',
};

const goodsRow = (g: Goods, sub: string, act: () => boolean, enabled: boolean, fail: string): ListRow => ({
  label: GOODS_NAMES[g.kind],
  icon: GOODS_ICON[g.kind],
  sub,
  detail: money(g.value),
  enabled,
  act: () => (act() ? undefined : { say: fail }),
});

export function trunkPage(st: GameState, v: Vehicle): ListPage {
  const c = st.combat;
  const rows: ListRow[] = [];
  const stash = v.stash ?? { weapons: [], goods: [] };
  stash.weapons.forEach((w, i) =>
    rows.push({
      label: WEAPONS[w.id].name,
      icon: `weapon/${w.id}` as IconName,
      sub: 'IN THE TRUNK: TAKE',
      detail: w.registered ? 'REGISTERED' : undefined,
      act: () => (takeWeapon(c, v, i) ? undefined : { say: 'NO FREE SLOT FOR IT.' }),
    }),
  );
  stash.goods.forEach((g, i) =>
    rows.push(goodsRow(g, 'IN THE TRUNK: TAKE', () => takeGoods(st.goods, v, i), true, '')),
  );
  const room = trunkFree(v) > 0;
  c.slots.forEach((w, slot) => {
    if (!w) return;
    rows.push({
      label: WEAPONS[w.id].name,
      icon: `weapon/${w.id}` as IconName,
      sub: 'ON YOU: STORE',
      enabled: room,
      act: () => (storeWeapon(c, v, slot) ? undefined : { say: 'THE TRUNK IS FULL.' }),
    });
  });
  st.goods.forEach((g, i) =>
    rows.push(goodsRow(g, 'ON YOU: STORE', () => storeGoods(st.goods, v, i), room, 'THE TRUNK IS FULL.')),
  );
  return {
    title: 'TRUNK',
    right: `${trunkUsed(v)}/${trunkSlots(v)}`,
    lines: [
      `${TYPE_LABEL[v.type]}. ${rows.length ? 'WEAPONS AND GOODS, ONE SLOT EACH.' : 'EMPTY, AND NOTHING ON YOU TO STORE.'}`,
    ],
    rows,
  };
}

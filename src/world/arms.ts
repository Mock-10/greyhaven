// The arms dealer's van (docs/07: "dealers sell to everyone", decisions 2026-10-11: an open van in a back alley).
// Weapons, ammo for what you carry, and body armor, for dirty cash. A list page like the shops (world/shops.ts),
// with a picture of each weapon.

import { BALANCE_COMBAT } from '../config/balanceCombat';
import type { GameState } from '../core/store';
import { AMMO_NAMES, DEALER_STOCK, WEAPONS, type AmmoId } from '../data/weapons';
import { buyAmmo, buyArmor, buyWeapon, reserveOf, statsOf } from '../systems/combat';
import type { IconName } from '../ui/icons';
import type { ListPage, ListRow } from '../ui/listPanel';

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

export function armsPage(st: GameState): ListPage {
  const c = st.combat;
  const rows: ListRow[] = DEALER_STOCK.map((id) => {
    const def = WEAPONS[id];
    const owned = c.slots.some((w) => w?.id === id);
    const price = statsOf(id).price;
    return {
      label: def.name,
      icon: `weapon/${id}` as IconName,
      sub: owned ? 'YOU HAVE ONE' : def.ammo ? `${AMMO_NAMES[def.ammo]} AMMO` : 'MELEE, SILENT',
      detail: owned ? 'OWNED' : money(price),
      enabled: !owned && st.money.dirty >= price,
      act: () => ({ say: buyWeapon(c, st.money, id, 'dealer').text }),
    };
  });
  // ammo for each kind your guns use
  const ammo = [
    ...new Set(c.slots.flatMap((w) => (w && WEAPONS[w.id].ammo ? [WEAPONS[w.id].ammo as AmmoId] : []))),
  ];
  for (const a of ammo) {
    const A = BALANCE_COMBAT.ammo[a];
    rows.push({
      label: `${AMMO_NAMES[a]} AMMO`,
      icon: 'item/ammo',
      sub: `${A.pack} ROUNDS, YOU HAVE ${reserveOf(c, a)}`,
      detail: money(A.price),
      enabled: st.money.dirty >= A.price && reserveOf(c, a) < A.max,
      act: () => ({ say: buyAmmo(c, st.money, a, 'dealer').text }),
    });
  }
  const V = BALANCE_COMBAT.armor;
  rows.push({
    label: 'BODY ARMOR',
    icon: 'item/armor',
    sub: st.player.armor >= V.absorbs ? 'YOU WEAR A FULL VEST' : `STOPS ${V.absorbs} DAMAGE`,
    detail: money(V.price),
    enabled: st.player.armor < V.absorbs && st.money.dirty >= V.price,
    act: () => ({ say: buyArmor(st.player, st.money).text }),
  });
  return {
    title: 'ARMS DEALER',
    icon: 'face/dealer',
    right: `DIRTY ${money(st.money.dirty)}`,
    lines: ['DIRTY CASH. NO NAMES.'],
    rows,
  };
}

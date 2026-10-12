// Torque & Sons' service desk for your car (docs/08, Phase 4): repair, the upgrades and the respray, as a list page
// (ui/listPanel.ts). The world finds the car (the one you drove up in) and applies the respray's star drop.

import { BALANCE } from '../config/balance';
import type { GameState } from '../core/store';
import { MODEL_COLOUR, TYPE_LABEL } from '../data/vehicles';
import {
  UPGRADES,
  UPGRADE_NAMES,
  payClean,
  repair,
  repairCost,
  upgrade,
  upgradeCost,
} from '../systems/carService';
import { NO_MODS, stats, type Vehicle } from '../systems/vehicle';
import { hasIcon } from '../ui/icons';
import type { ListPage, ListRow } from '../ui/listPanel';

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

export interface ServiceCtx {
  state: GameState;
  car: Vehicle;
  /** Respray: a new colour, hot cleared, −1★ when unseen (the world does the colour and the stars). */
  respray: () => string;
}

export function servicePage(ctx: ServiceCtx): ListPage {
  const { state: st, car: v } = ctx;
  const mechanic = st.career.current === 'mechanic';
  const pay = (what: string, price: number) => payClean(st.money, st.finance, st.minutes, what, price);
  const rows: ListRow[] = [];
  const rc = repairCost(v, mechanic);
  rows.push({
    label: 'REPAIR',
    icon: 'item/repair_kit',
    sub: rc ? `${Math.round((v.health / stats(v).health) * 100)}% NOW${mechanic ? ', STAFF -20%' : ''}` : 'NOT A SCRATCH',
    detail: rc ? money(rc) : undefined,
    enabled: rc > 0 && st.money.bank + st.money.clean >= rc,
    act: () => {
      if (!pay('GARAGE, REPAIR', rc)) return { say: 'CLEAN MONEY ONLY. NOT ENOUGH.' };
      repair(v);
      return { say: 'GOOD AS NEW.' };
    },
  });
  const mods = v.mods ?? NO_MODS;
  const U = BALANCE.vehicles.upgrades;
  for (const id of UPGRADES) {
    const cost = upgradeCost(v, id);
    const max = U[id].costs.length;
    rows.push({
      label: UPGRADE_NAMES[id],
      icon: 'item/toolbox',
      sub: `LEVEL ${mods[id]}/${max}`,
      detail: cost === null ? 'TOP' : money(cost),
      enabled: cost !== null && st.money.bank + st.money.clean >= cost,
      act: () => {
        if (cost === null) return { say: 'AS GOOD AS IT GETS.' };
        if (!pay(`GARAGE, ${UPGRADE_NAMES[id]}`, cost)) return { say: 'CLEAN MONEY ONLY. NOT ENOUGH.' };
        upgrade(v, id);
        return { say: `${UPGRADE_NAMES[id]} LEVEL ${mods[id] + 1}.` };
      },
    });
  }
  const R = BALANCE.vehicles.resprayPrice;
  const carIcon = `car/${v.model}`;
  rows.push({
    label: 'RESPRAY',
    icon: hasIcon(carIcon) ? carIcon : 'item/repair_kit',
    sub: v.hotUntil > st.minutes ? 'CLEARS THE HOT PLATES' : 'A NEW COLOUR',
    detail: money(R),
    enabled: st.money.bank + st.money.clean >= R,
    act: () => {
      if (!pay('GARAGE, RESPRAY', R)) return { say: 'CLEAN MONEY ONLY. NOT ENOUGH.' };
      const m = ctx.respray();
      return { say: `NOW ${MODEL_COLOUR[m] ?? 'NEW'}. NOBODY WILL KNOW.` };
    },
  });
  return {
    title: 'CAR SERVICE',
    icon: 'item/repair_kit',
    right: `${TYPE_LABEL[v.type]} ${MODEL_COLOUR[v.model] ?? ''}`,
    lines: ['CLEAN MONEY: THE BANK, THEN CASH.'],
    rows,
  };
}

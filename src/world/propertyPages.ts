// Property list pages (docs/09, Phase 5; ui/listPanel.ts): the FOR SALE sign, a stash (your homes' and the
// apartment's), the hideout's plans table (add-ons) and the workbench.

import { BALANCE } from '../config/balance';
import type { GameState } from '../core/store';
import { GOODS_NAMES, type GoodsKind } from '../data/burglary';
import { ADDONS, ADDON_IDS, HOMES, PROPERTY_TYPES, type HomeId } from '../data/property';
import { WEAPONS } from '../data/weapons';
import { payClean } from '../systems/carService';
import {
  addonBlock,
  addonCost,
  buyAddon,
  buyHome,
  homeOf,
  moveDirty,
  parkingOf,
  stashGoods,
  stashUsed,
  stashWeapon,
  typeOf,
  unstashGoods,
  unstashWeapon,
  type OwnedHome,
  type StashBox,
} from '../systems/property';
import { stats, type Vehicle } from '../systems/vehicle';
import { MODEL_COLOUR, TYPE_LABEL } from '../data/vehicles';
import { hasIcon } from '../ui/icons';
import { tierFor } from '../systems/reputation';
import { assign, fire, hire, hireBlock, type CrewMember } from '../systems/crew';
import { ROLE_NAMES } from '../data/crew';
import type { IconName } from '../ui/icons';
import type { ListAction, ListPage, ListRow } from '../ui/listPanel';
import { OP_NAMES, minutesLeft, opOf, startPress, type OpId } from '../systems/operations';

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const P = () => BALANCE.property;

const GOODS_ICON: Record<GoodsKind, IconName> = {
  jewellery: 'item/watch',
  electronics: 'item/phone',
  laptop: 'item/phone',
  silverware: 'item/junk',
  console: 'item/phone',
  cash_tin: 'item/cash',
};

/** The FOR SALE sign on a Linden Avenue lawn: what the house is, and BUY. */
export function salePage(st: GameState, id: HomeId, bought: () => void): ListPage {
  const def = HOMES[id];
  const T = typeOf(id);
  const owned = !!homeOf(st.property, id);
  const cash = st.money.bank + st.money.clean;
  return {
    title: owned ? 'YOUR HOME' : 'FOR SALE',
    icon: 'app/home',
    right: PROPERTY_TYPES[def.type].name,
    lines: [
      def.address,
      `TAX ${money(T.weeklyTax)} A WEEK. PARKING ${T.parking}. ADD-ON SLOTS ${T.slots}.`,
      'A SAVE POINT, A BED, A STASH, A BASEMENT.',
    ],
    rows: [
      {
        label: owned ? 'BOUGHT' : 'BUY THE HOUSE',
        icon: 'app/home',
        sub: 'CLEAN MONEY: THE BANK, THEN CASH',
        detail: money(T.price),
        enabled: !owned && cash >= T.price,
        act: () => {
          if (!buyHome(st.property, st.money, st.finance, st.minutes, id))
            return { say: 'CLEAN MONEY ONLY. NOT ENOUGH.' };
          bought();
          return { say: `THE KEYS TO ${def.address}. WELCOME HOME.` };
        },
      },
    ],
  };
}

/** A stash: dirty cash in and out (no slots), then what's stored (take) and what you carry (store). */
export function stashPage(st: GameState, box: StashBox, title: string): ListPage {
  const s = box.stash;
  const c = st.combat;
  const rows: ListRow[] = [];
  const room = stashUsed(s) < box.cap;
  rows.push({
    label: 'PUT IN DIRTY CASH',
    icon: 'hud/dirty',
    sub: `YOU CARRY ${money(st.money.dirty)}`,
    enabled: st.money.dirty > 0,
    act: () => ({ say: `+${money(moveDirty(s, st.money, st.money.dirty))} IN THE STASH.` }),
  });
  rows.push({
    label: 'TAKE OUT DIRTY CASH',
    icon: 'hud/dirty',
    sub: `IN THE STASH ${money(s.dirty)}`,
    enabled: s.dirty > 0,
    act: () => ({ say: `${money(moveDirty(s, st.money, -s.dirty))} TAKEN.` }),
  });
  s.weapons.forEach((w, i) =>
    rows.push({
      label: WEAPONS[w.id].name,
      icon: `weapon/${w.id}` as IconName,
      sub: 'STORED: TAKE',
      act: () => (unstashWeapon(s, c, i) ? undefined : { say: 'NO FREE SLOT FOR IT.' }),
    }),
  );
  s.goods.forEach((g, i) =>
    rows.push({
      label: GOODS_NAMES[g.kind],
      icon: GOODS_ICON[g.kind],
      sub: 'STORED: TAKE',
      detail: money(g.value),
      act: () => void unstashGoods(s, st.goods, i),
    }),
  );
  c.slots.forEach((w, slot) => {
    if (!w) return;
    rows.push({
      label: WEAPONS[w.id].name,
      icon: `weapon/${w.id}` as IconName,
      sub: 'ON YOU: STORE',
      enabled: room,
      act: () => (stashWeapon(box, c, slot) ? undefined : { say: 'THE STASH IS FULL.' }),
    });
  });
  st.goods.forEach((g, i) =>
    rows.push({
      label: GOODS_NAMES[g.kind],
      icon: GOODS_ICON[g.kind],
      sub: 'ON YOU: STORE',
      detail: money(g.value),
      enabled: room,
      act: () => (stashGoods(box, st.goods, i) ? undefined : { say: 'THE STASH IS FULL.' }),
    }),
  );
  return {
    title,
    icon: 'addon/stashRoom',
    right: `${stashUsed(s)}/${box.cap}`,
    lines: [`DIRTY CASH ${money(s.dirty)}.`, 'WEAPONS AND GOODS: ONE SLOT EACH.'],
    rows,
  };
}

const BLOCK_TEXT = {
  owned: 'BUILT',
  slots: 'NO FREE SLOT',
  tier: 'NEEDS MORE REP',
  notYet: 'COMING SOON',
} as const;

/** The plans table in the hideout: the add-ons, their price and what each needs. */
export function plansPage(st: GameState, id: HomeId, built: () => void): ListPage {
  const h = homeOf(st.property, id);
  if (!h) return { title: 'PLANS', rows: [] };
  const tier = tierFor(st.crime.rep);
  const mech = st.career.jobs.mechanic.rank;
  const T = typeOf(id);
  const rows: ListRow[] = ADDON_IDS.map((a) => {
    const why = addonBlock(h, a, tier);
    const cost = addonCost(a, mech);
    return {
      label: ADDONS[a].name,
      icon: `addon/${a}` as IconName,
      sub: why === 'tier' ? `${ADDONS[a].effect} (REP TIER ${P().addons[a].tier})` : ADDONS[a].effect,
      detail: why ? BLOCK_TEXT[why] : money(cost),
      enabled: !why && st.money.bank + st.money.clean >= cost,
      act: () => {
        if (!buyAddon(h, a, tier, mech, st.money, st.finance, st.minutes))
          return { say: 'CLEAN MONEY ONLY. NOT ENOUGH.' };
        built();
        return { say: `${ADDONS[a].name} BUILT.` };
      },
    };
  });
  return {
    title: 'PLANS',
    icon: 'app/home',
    right: `${h.addons.length}/${T.slots} SLOTS`,
    lines: [
      `${HOMES[id].address}. THE GARAGE HOLDS ${parkingOf(h)} CAR${parkingOf(h) > 1 ? 'S' : ''}.`,
      'CLEAN MONEY: THE BANK, THEN CASH.',
    ],
    rows,
  };
}

export interface GarageCtx {
  state: GameState;
  home: OwnedHome;
  /** The car standing on the driveway, or null. */
  onDriveway: () => Vehicle | null;
  store: () => boolean;
  takeOut: (v: Vehicle) => boolean;
}

/** The driveway garage (docs/09): cars kept here keep their health, fuel and trunk. */
export function garagePage(ctx: GarageCtx): ListPage {
  const st = ctx.state;
  const h = ctx.home;
  const stored = st.vehicles.filter((v) => v.storedAt === h.id);
  const cap = parkingOf(h);
  const out = ctx.onDriveway();
  const rows: ListRow[] = [];
  if (out)
    rows.push({
      label: `STORE THE ${TYPE_LABEL[out.type]}`,
      icon: hasIcon(`car/${out.model}`) ? (`car/${out.model}` as IconName) : 'addon/garageBay',
      sub: stored.length < cap ? 'OFF THE STREET, SAFE' : 'THE GARAGE IS FULL',
      enabled: stored.length < cap,
      act: () => (ctx.store() ? { say: 'STORED.' } : { say: 'GET OUT OF IT FIRST.' }),
    });
  for (const v of stored)
    rows.push({
      label: `${TYPE_LABEL[v.type]} ${MODEL_COLOUR[v.model] ?? ''}`.trim(),
      icon: hasIcon(`car/${v.model}`) ? (`car/${v.model}` as IconName) : 'addon/garageBay',
      sub: out ? 'THE DRIVEWAY IS TAKEN' : 'TAKE IT OUT',
      detail: `${Math.round((v.health / stats(v).health) * 100)}%`,
      enabled: !out,
      act: () => (ctx.takeOut(v) ? { close: true } : { say: 'THE DRIVEWAY IS TAKEN.' }),
    });
  return {
    title: 'GARAGE',
    icon: 'addon/garageBay',
    right: `${stored.length}/${cap}`,
    lines: [
      HOMES[h.id].address,
      rows.length ? 'STORED CARS KEEP THEIR FUEL AND TRUNK.' : 'NO CAR HERE OR STORED.',
    ],
    rows,
  };
}

export interface WorkbenchCtx {
  state: GameState;
  /** Respray the car on the driveway (null when there's none). */
  respray: (() => string) | null;
}

/** The workbench (docs/09: craft and repair tools, respray at home): tools at half the store's price. */
export function workbenchPage(ctx: WorkbenchCtx): ListPage {
  const st = ctx.state;
  const S = BALANCE.shop;
  const share = P().craftShare;
  const inv = st.inventory;
  const craft = (label: string, icon: IconName, price: number, give: () => void): ListRow => {
    const cost = Math.round(price * share);
    return {
      label,
      icon,
      sub: 'CRAFTED FROM PARTS',
      detail: money(cost),
      enabled: st.money.bank + st.money.clean >= cost,
      act: () => {
        if (!payClean(st.money, st.finance, st.minutes, `WORKBENCH, ${label}`, cost))
          return { say: 'CLEAN MONEY ONLY. NOT ENOUGH.' };
        give();
        return { say: `${label} MADE.` };
      },
    };
  };
  const R = BALANCE.vehicles.resprayPrice;
  const rows: ListRow[] = [
    craft('LOCKPICKS', 'item/lockpicks', S.lockpicks.price, () => (inv.lockpicks += S.lockpicks.adds)),
    craft('REPAIR KIT', 'item/repair_kit', S.repair_kit.price, () => (inv.repairKits += S.repair_kit.adds)),
    craft('FUEL CAN', 'item/fuel_can', S.fuel_can.price, () => (inv.fuelCans += S.fuel_can.adds)),
    {
      label: 'RESPRAY THE CAR OUTSIDE',
      icon: 'addon/garageBay',
      sub: ctx.respray ? 'NEW COLOUR, HOT PLATES GONE' : 'NO CAR ON THE DRIVEWAY',
      detail: money(R),
      enabled: !!ctx.respray && st.money.bank + st.money.clean >= R,
      act: () => {
        if (!ctx.respray) return { say: 'PARK ON THE DRIVEWAY FIRST.' };
        if (!payClean(st.money, st.finance, st.minutes, 'WORKBENCH, RESPRAY', R))
          return { say: 'CLEAN MONEY ONLY. NOT ENOUGH.' };
        return { say: `RESPRAYED. NOW ${ctx.respray()}.` };
      },
    },
  ];
  return { title: 'WORKBENCH', icon: 'addon/workbench', lines: ['TOOLS FOR HALF THE STORE PRICE.'], rows };
}

export interface OpsCtx {
  state: GameState;
  home: OwnedHome;
  op: OpId;
  /** The press's fake cash is counted first (the money count's bonus); the chop bay pays straight out. */
  collect: () => ListAction | void;
  /** Chop bay: the stolen car on this home's driveway, and feeding it in. */
  car: Vehicle | null;
  chop: (() => boolean) | null;
}

const hoursLeft = (min: number) =>
  min >= 120 ? `${Math.round(min / 60)} HOURS` : `${Math.max(1, Math.round(min))} MIN`;

/** An operation's station (docs/09): what it's doing, collect what's waiting, restock it. */
export function opsPage(ctx: OpsCtx): ListPage {
  const st = ctx.state;
  const h = ctx.home;
  const op = opOf(h, ctx.op);
  if (!op) return { title: OP_NAMES[ctx.op], rows: [] };
  const O = BALANCE.property.ops;
  const left = minutesLeft(op, ctx.op, st.minutes);
  const rows: ListRow[] = [];
  if (op.ready > 0)
    rows.push({
      label: 'COLLECT',
      icon: 'hud/dirty',
      sub: ctx.op === 'press' ? 'COUNT THE NOTES FOR A BONUS' : 'DIRTY CASH',
      detail: money(op.ready),
      act: () => ctx.collect(),
    });
  if (ctx.op === 'press') {
    const price = O.press.supplies;
    rows.push({
      label: 'RESTOCK THE PRESS',
      icon: 'addon/press',
      sub:
        op.since !== null
          ? `RUNNING: ${hoursLeft(left)} LEFT`
          : `PAPER AND INK. ${money(O.press.output)} IN 2 DAYS`,
      detail: money(price),
      enabled: op.since === null && st.money.dirty + h.stash.dirty >= price,
      act: () =>
        startPress(h, st.money, st.minutes)
          ? { say: 'THE PRESS IS RUNNING.' }
          : { say: 'DIRTY CASH ONLY: CARRIED, THEN THE STASH.' },
    });
  } else {
    const car = ctx.car;
    rows.push({
      label: car ? `CHOP THE ${TYPE_LABEL[car.type]}` : 'NO CAR TO CHOP',
      icon: car && hasIcon(`car/${car.model}`) ? (`car/${car.model}` as IconName) : 'addon/chopBay',
      sub:
        op.since !== null
          ? `WORKING: ${hoursLeft(left)} LEFT`
          : car
            ? 'THE STOLEN CAR ON THE DRIVEWAY. READY IN A DAY'
            : 'DRIVE A STOLEN CAR ONTO THE DRIVEWAY',
      enabled: op.since === null && !!car && !!ctx.chop,
      act: () => (ctx.chop?.() ? { say: 'IN IT GOES. COME BACK TOMORROW.' } : { say: 'NOT THAT ONE.' }),
    });
  }
  const status =
    op.since !== null
      ? `RUNNING, ${hoursLeft(left)} LEFT.`
      : op.ready > 0
        ? 'DONE. COLLECT IT.'
        : 'STALLED. RESTOCK IT.';
  return {
    title: OP_NAMES[ctx.op],
    icon: `addon/${ctx.op}` as IconName,
    right: HOMES[h.id].address,
    lines: [status, ctx.op === 'press' ? 'FAKE CASH COUNTS AS DIRTY.' : 'PAID AS DIRTY CASH.'],
    rows,
  };
}

const crewIcon = (face: number) => `face/crew${face}` as IconName;
const pct = (n: number) => `${Math.round(n * 100)}%`;

const HIRE_TEXT = {
  room: 'BUILD A CREW ROOM FIRST',
  tier: `NEEDS REP TIER ${BALANCE.property.crew.tier}`,
  cap: `CREW FULL (${BALANCE.property.crew.cap})`,
  money: 'NOT ENOUGH DIRTY CASH',
} as const;

/** The crew booth at The Low Tide (docs/09): today's candidates, their fee and weekly wage, in dirty cash. */
export function hirePage(st: GameState, candidates: readonly CrewMember[]): ListPage {
  const tier = tierFor(st.crime.rep);
  const rows: ListRow[] = candidates.map((c) => {
    const why = hireBlock(st.property, st.money, c, tier);
    return {
      label: c.name,
      icon: crewIcon(c.face),
      sub: `${ROLE_NAMES[c.role]}, SKILL +${pct(c.skill)}. $${c.wage} A WEEK`,
      detail: why ? HIRE_TEXT[why] : money(c.fee),
      enabled: !why,
      act: () =>
        hire(st.property, st.money, c.id, tier)
          ? { say: `${c.name} IS IN. FIND THEM AT YOUR CREW TABLE.` }
          : { say: 'NOT NOW.' },
    };
  });
  const crew = st.property.crew.members.length;
  return {
    title: 'CREW FOR HIRE',
    icon: 'face/gang',
    right: `${crew}/${BALANCE.property.crew.cap} HIRED`,
    lines: [
      rows.length ? 'NEW FACES EVERY DAY. FEE AND WAGES IN DIRTY CASH.' : 'NOBODY LEFT TODAY. TRY TOMORROW.',
      'WAGES COME OUT OF THE CREW ROOM STASH ON MONDAYS.',
    ],
    rows,
  };
}

/** The crew table in the hideout: post operators to this home's operations, or let people go. */
export function crewPage(st: GameState, home: HomeId): ListPage {
  const p = st.property;
  const h = homeOf(p, home);
  const rows: ListRow[] = [];
  for (const c of p.crew.members) {
    const post = c.post ? `${OP_NAMES[c.post.op]}, ${HOMES[c.post.home].address}` : 'NO POST';
    const unpaid = c.unpaidSince !== null ? ' UNPAID!' : '';
    // operators run the press (the chop bay needs cars you bring)
    const canPress = !!h?.addons.includes('press');
    rows.push({
      label: c.name,
      icon: crewIcon(c.face),
      sub: `${ROLE_NAMES[c.role]} +${pct(c.skill)}: ${post}.${unpaid}`,
      detail: `$${c.wage}/WK`,
      enabled: canPress,
      act: () => {
        const on = c.post?.home === home && c.post.op === 'press';
        assign(p, c.id, on ? null : { home, op: 'press' });
        return { say: on ? `${c.name} IS OFF THE PRESS.` : `${c.name} RUNS THE PRESS NOW.` };
      },
    });
  }
  for (const c of p.crew.members)
    rows.push({
      label: `LET ${c.name.split(' ')[0]} GO`,
      icon: crewIcon(c.face),
      sub: 'NO NOTICE, NO HARD FEELINGS',
      act: () => {
        fire(p, c.id);
        return { say: `${c.name} IS GONE.` };
      },
    });
  return {
    title: 'THE CREW',
    icon: 'face/gang',
    right: `${p.crew.members.length}/${BALANCE.property.crew.cap}`,
    lines: [
      rows.length
        ? 'PICK SOMEONE TO PUT THEM ON THE PRESS, OR TAKE THEM OFF.'
        : 'NOBODY YET. HIRE AT THE LOW TIDE.',
      `OPERATORS BANK THE BATCH IN THE STASH, TAKE ${pct(BALANCE.property.crew.operatorCut)}, AND RESTOCK.`,
    ],
    rows,
  };
}

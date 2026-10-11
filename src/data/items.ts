// Item and shop catalogue (docs/02 Phase 2 shops, decided 2026-10-11). Prices and effects are numbers, so they
// live in balance.ts (BALANCE.shop); this is the list, what each item does, and what each shop stocks.

import type { Inventory } from '../core/store';

export type ItemId =
  | 'soda'
  | 'chips'
  | 'sandwich'
  | 'fuel_can'
  | 'first_aid'
  | 'lockpicks'
  | 'toolbox'
  | 'repair_kit';

export interface ItemDef {
  id: ItemId;
  name: string;
  /** Eaten on the spot (heals) or carried in the bag. */
  use: 'eat' | 'carry';
  /** Where a carried item goes in the bag, and how much one purchase adds. */
  slot?: keyof Inventory;
  /** Short effect line for the shop card. */
  effect: string;
  /** Only one can be carried (the toolbox). */
  single?: boolean;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  soda: { id: 'soda', name: 'SODA', use: 'eat', effect: '+5 HP' },
  chips: { id: 'chips', name: 'CHIPS', use: 'eat', effect: '+10 HP' },
  sandwich: { id: 'sandwich', name: 'SANDWICH', use: 'eat', effect: '+25 HP' },
  fuel_can: { id: 'fuel_can', name: 'FUEL CAN', use: 'carry', slot: 'fuelCans', effect: '10 FUEL' },
  first_aid: { id: 'first_aid', name: 'FIRST AID', use: 'carry', slot: 'firstAid', effect: 'FULL HP' },
  lockpicks: { id: 'lockpicks', name: 'LOCKPICKS', use: 'carry', slot: 'lockpicks', effect: '10 USES' },
  toolbox: { id: 'toolbox', name: 'TOOLBOX', use: 'carry', slot: 'toolbox', effect: 'HOTWIRE +', single: true },
  repair_kit: { id: 'repair_kit', name: 'REPAIR KIT', use: 'carry', slot: 'repairKits', effect: 'CAR TO 50%' },
};

export type ShopId = 'store' | 'hardware';

/** What each shop stocks, in menu order. */
export const SHOP_STOCK: Record<ShopId, readonly ItemId[]> = {
  store: ['soda', 'chips', 'sandwich', 'fuel_can', 'first_aid'],
  hardware: ['lockpicks', 'toolbox', 'repair_kit'],
};

// Shop catalogue (docs/18, decided 2026-10-11: the corner store sells a few basics in Phase 1 — snacks that
// heal and a fuel can, for clean cash only). The full catalogue arrives with the Phase 2 economy.
// Prices and effects are numbers, so they live in balance.ts (BALANCE.shop); this is the list.

export type ItemId = 'soda' | 'chips' | 'sandwich' | 'fuel_can';

export interface ItemDef {
  id: ItemId;
  name: string;
  /** Eaten on the spot (heals) or carried (inventory). */
  use: 'eat' | 'carry';
}

export const ITEMS: Record<ItemId, ItemDef> = {
  soda: { id: 'soda', name: 'SODA', use: 'eat' },
  chips: { id: 'chips', name: 'CHIPS', use: 'eat' },
  sandwich: { id: 'sandwich', name: 'SANDWICH', use: 'eat' },
  fuel_can: { id: 'fuel_can', name: 'FUEL CAN', use: 'carry' },
};

/** What each shop stocks, in menu order. */
export const SHOP_STOCK: Record<'store', readonly ItemId[]> = {
  store: ['soda', 'chips', 'sandwich', 'fuel_can'],
};

// House burglary catalogue (docs/04, decided 2026-10-11: 3 layouts, no pets). Each layout lists its rooms, each
// room's share of the house's goods, and what kind of goods turn up there. Values are rolled in systems/burglary.ts.

export type GoodsKind = 'jewellery' | 'electronics' | 'laptop' | 'silverware' | 'console' | 'cash_tin';

export const GOODS_NAMES: Record<GoodsKind, string> = {
  jewellery: 'JEWELLERY',
  electronics: 'ELECTRONICS',
  laptop: 'LAPTOP',
  silverware: 'SILVERWARE',
  console: 'GAME CONSOLE',
  cash_tin: 'CASH TIN',
};

/** Jewellery is the gold (worth more) item in the search grid; the rest glint as usual. */
export const GOLD_GOODS: readonly GoodsKind[] = ['jewellery'];

export interface RoomDef {
  name: string;
  /** Share of the house's goods value found here (weights, normalised per layout). */
  weight: number;
  /** Goods that can turn up in this room. */
  goods: readonly GoodsKind[];
  /** Items in this room's search grid. */
  items: readonly [number, number];
}

export type LayoutId = 'bungalow' | 'family' | 'townhouse';

export interface LayoutDef {
  id: LayoutId;
  rooms: readonly RoomDef[];
}

export const LAYOUTS: Record<LayoutId, LayoutDef> = {
  bungalow: {
    id: 'bungalow',
    rooms: [
      { name: 'LIVING ROOM', weight: 3, goods: ['electronics', 'console'], items: [1, 2] },
      { name: 'KITCHEN', weight: 1, goods: ['silverware', 'cash_tin'], items: [1, 2] },
      { name: 'BEDROOM', weight: 4, goods: ['jewellery', 'cash_tin', 'laptop'], items: [1, 3] },
    ],
  },
  family: {
    id: 'family',
    rooms: [
      { name: 'LIVING ROOM', weight: 3, goods: ['electronics', 'console'], items: [1, 2] },
      { name: 'KITCHEN', weight: 1, goods: ['silverware', 'cash_tin'], items: [1, 2] },
      { name: 'MAIN BEDROOM', weight: 4, goods: ['jewellery', 'cash_tin'], items: [1, 3] },
      { name: 'KIDS ROOM', weight: 2, goods: ['console', 'electronics', 'laptop'], items: [1, 2] },
    ],
  },
  townhouse: {
    id: 'townhouse',
    rooms: [
      { name: 'LIVING ROOM', weight: 2, goods: ['electronics', 'silverware'], items: [1, 2] },
      { name: 'STUDY', weight: 3, goods: ['laptop', 'electronics', 'cash_tin'], items: [1, 2] },
      { name: 'BEDROOM', weight: 4, goods: ['jewellery', 'cash_tin'], items: [1, 3] },
    ],
  },
};

export const LAYOUT_IDS = Object.keys(LAYOUTS) as LayoutId[];

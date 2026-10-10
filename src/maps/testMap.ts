// The Phase 0 test map: the 28 × 28 tile district of the reference scene (art/scene_overcast_day.png),
// ported from art/source/scene.py (build_tiles() and placements()) with the same numbers, so the game
// renders the same picture. Downtown plaza (north), corner store and lot (east), suburbs (west),
// industrial yard and docks edge (south).

import type { MapData, Placement } from './types';

const N = 28;
const B = 2.6; // building scale (box shadow extents use it)
const ROAD = [12, 13, 14, 15];
const WALK = [10, 11, 16, 17];
const LANE: Record<number, string> = { 12: 'e0', 13: 'c1', 14: 'c0', 15: 'e1' };

/** Reference tile variant: scene.py picks seed (i * 31 + j * 17) % 7 per tile. */
export function tileSeed(i: number, j: number): number {
  return (i * 31 + j * 17) % 7;
}

function buildTiles(): string[][] {
  const t: string[][] = [];
  for (let i = 0; i < N; i++) {
    const col: string[] = [];
    for (let j = 0; j < N; j++) {
      const ri = ROAD.includes(i);
      const rj = ROAD.includes(j);
      let k: string;
      if (ri && rj) k = i === 13 && j === 14 ? 'manhole' : 'asphalt';
      else if (rj) k = i === 11 || i === 16 ? 'crosswalk_x' : `road_x_${LANE[j]}`;
      else if (ri) k = j === 11 || j === 16 ? 'crosswalk_y' : `road_y_${LANE[i]}`;
      else if (WALK.includes(j) || WALK.includes(i))
        k = (i * 7 + j * 3) % 5 === 0 ? 'sidewalk_b' : 'sidewalk_a';
      else if (i < 10 && j < 10) k = (i + j) % 4 === 0 ? 'sidewalk_b' : 'sidewalk_a';
      else if (i >= 18 && j < 10) k = j === 1 || j === 2 ? 'lot_lines' : 'lot_a';
      else if (i < 10 && j >= 18) k = (i * 5 + j) % 7 === 0 ? 'grass_b' : 'grass_a';
      else if (j === 27 || i === 27) k = 'water_a';
      else if (j === 26 || i === 26) k = j === 26 ? 'planks_x' : 'planks_y';
      else k = (i + j) % 3 ? 'dirt_a' : 'lot_a';
      col.push(k);
    }
    t.push(col);
  }
  return t;
}

type Row = [Placement['sprite'], number, number, number, number, Placement['shadow'], Partial<Placement>?];

const box = (hx: number, hy: number, h: number) => ({ kind: 'box', hx, hy, h }) as const;
const blob = (r: number) => ({ kind: 'blob', r }) as const;

// Same order as scene.py placements(); the order breaks depth ties and decides shadow overlap.
const ROWS: Row[] = [
  // downtown plaza
  ['bld/office_tower', 0, 0, 150, 140, box(28 * B, 28 * B, 125 * B), { solid: true }],
  ['prop/planter', 0, 0, 36, 286, blob(13), { solid: true }],
  ['prop/planter', 0, 0, 290, 36, blob(13), { solid: true }],
  ['prop/tree_a', 0, 0, 34, 40, blob(26)],
  ['int/atm', 0, 0, 262, 292, box(7, 7, 34), { cue: 'idle', prompt: ['E', 'USE ATM'], solid: true }],
  ['prop/bench', 0, 0, 96, 298, box(17, 5, 12), { solid: true }],
  ['prop/trash_can', 0, 0, 300, 236, blob(5), { solid: true }],
  ['char/office_worker', 0, 0.6, 178, 304, blob(6)],
  ['char/civilian_b', 2, -0.6, 352, 196, blob(6)],
  ['prop/tree_b', 0, 0, 44, 356, blob(26)],
  ['prop/lamp', 0, 0, 160, 370, blob(4), { lamp: true }],
  ['prop/lamp', 0, 0, 370, 90, blob(4), { lamp: true }],
  ['prop/traffic_light', 0, 0, 370, 370, blob(5)],
  // corner store + lot
  ['bld/corner_store', 0, 0, 680, 252, box(24 * B, 15 * B, 31 * B), { solid: true }],
  ['veh/sedan_lav', 2, 0, 846, 120, box(16, 40, 22), { cue: 'idle', prompt: ['E', 'LOCKPICK'], solid: true }],
  ['prop/dumpster', 0, 0, 868, 236, box(16, 8, 17), { solid: true }],
  ['char/masked_thief', 0, 0.6, 700, 346, blob(6)],
  ['int/loot_bag', 0, 0, 744, 356, blob(9), { cue: 'hover', valuable: true, prompt: ['E', 'GRAB LOOT'] }],
  ['char/police_officer', 0, 0, 604, 352, blob(6)],
  ['prop/street_sign', 0, 0, 640, 336, blob(4)],
  ['prop/lamp', 0, 0, 800, 370, blob(4), { lamp: true }],
  ['prop/traffic_light', 0, 0, 526, 370, blob(5)],
  // traffic
  ['veh/police_car', 4, 0, 610, 416, box(40, 16, 22), { solid: true }],
  ['veh/taxi', 0, 0, 200, 480, box(40, 16, 22), { solid: true }],
  ['veh/sedan_clay', 0, 0, 790, 480, box(40, 16, 22), { solid: true }],
  ['veh/van_white', 6, 0, 416, 210, box(16, 42, 28), { solid: true }],
  ['veh/sedan_teal', 2, 0, 480, 720, box(16, 40, 22), { solid: true }],
  // suburbs: houses front onto the y-road (door face turned to +x)
  ['bld/house_brick', 6, 0, 196, 660, box(16 * B, 22 * B, 24 * B), { solid: true }],
  ['bld/house_slate', 6, 0, 196, 826, box(16 * B, 22 * B, 24 * B), { solid: true }],
  ['prop/tree_a', 0, 0, 52, 610, blob(26)],
  ['prop/pine', 0, 0, 56, 770, blob(18)],
  ['prop/pine', 0, 0, 40, 860, blob(18)],
  ['prop/mailbox', 0, 0, 296, 620, blob(4)],
  ['prop/bush', 0, 0, 290, 728, blob(12)],
  ['prop/bush', 0, 0, 296, 880, blob(12)],
  ['char/civilian_a', 6, 0.6, 352, 760, blob(6)],
  ['prop/hydrant', 0, 0, 340, 540, blob(4)],
  ['prop/lamp', 0, 0, 364, 680, blob(4), { lamp: true }],
  ['prop/traffic_light', 0, 0, 370, 526, blob(5)],
  // industrial yard
  ['bld/warehouse', 0, 0, 720, 676, box(34 * B, 23 * B, 30 * B), { solid: true }],
  ['bld/container_teal', 0, 0, 664, 806, box(23 * B, 9 * B, 20 * B), { solid: true }],
  ['bld/container_brick', 2, 0, 832, 806, box(9 * B, 23 * B, 20 * B), { solid: true }],
  [
    'int/crate_loot',
    0,
    0,
    756,
    818,
    box(8, 8, 15),
    { cue: 'idle', valuable: true, prompt: ['E', 'SEARCH'], solid: true },
  ],
  ['prop/crate', 0, 0, 600, 860, box(8, 8, 15), { solid: true }],
  ['prop/crate', 0, 0, 618, 872, box(8, 8, 15), { solid: true }],
  ['prop/barrel_teal', 0, 0, 604, 600, blob(6), { solid: true }],
  ['prop/barrel_brick', 0, 0, 620, 612, blob(6), { solid: true }],
  ['char/road_worker', 4, 0, 548, 552, blob(6)],
  ['prop/lamp', 0, 0, 548, 720, blob(4), { lamp: true }],
  ['prop/traffic_light', 0, 0, 526, 526, blob(5)],
];

export const TEST_MAP: MapData = {
  id: 'test_reference',
  width: N,
  height: N,
  tiles: buildTiles(),
  placements: ROWS.map(([sprite, dir, walk, x, y, shadow, extra]) => ({
    sprite,
    dir,
    walk,
    x,
    y,
    shadow,
    ...extra,
  })),
  // On the plaza, between the office tower's front and the ATM.
  spawn: { x: 250, y: 240 },
};

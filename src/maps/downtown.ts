// Downtown ("The Ledger"), the Phase 1 district: 48 × 48 tiles.
//
// In the isometric view only faces pointing +x or +y can be seen, so every entrance faces a street that
// lies south (+y) or east (+x) of its building:
//   - north of Overcast Avenue: Pellridge Tower and its plaza, Open Most Hours, a parking lot
//   - north of Drizzle Row: Drizzle Row Residences, The Low Tide, Marlo's Tow & Salvage
// Roads are 4 tiles wide (two lanes) with 2-tile sidewalks on each side (docs/01).

import type { DoorTarget, MapData, Placement, StreetSpan } from './types';

const N = 48;
const B = 2.6; // building model scale (art/source/cache.py BLD_SCALE)
const T = 32;

// Road bands, in tiles. x-roads run along world x (constant j), y-roads along world y (constant i).
const X_ROADS = [
  { name: 'OVERCAST AVENUE', j0: 18 },
  { name: 'DRIZZLE ROW', j0: 38 },
];
const Y_ROADS = [
  { name: 'PEWTER STREET', i0: 18 },
  { name: 'MILLWRIGHT ROAD', i0: 34 },
];
const LANE = ['e0', 'c1', 'c0', 'e1'];

const inBand = (v: number, b0: number, w: number) => v >= b0 && v < b0 + w;

/** Ground tiles. Order of rules: roads, crosswalks, sidewalks, then each block's own ground. */
function buildTiles(): string[][] {
  const tiles: string[][] = [];
  for (let i = 0; i < N; i++) {
    const col: string[] = [];
    for (let j = 0; j < N; j++) {
      const xr = X_ROADS.find((r) => inBand(j, r.j0, 4));
      const yr = Y_ROADS.find((r) => inBand(i, r.i0, 4));
      const xWalk = X_ROADS.some((r) => inBand(j, r.j0 - 2, 2) || inBand(j, r.j0 + 4, 2));
      const yWalk = Y_ROADS.some((r) => inBand(i, r.i0 - 2, 2) || inBand(i, r.i0 + 4, 2));
      let k: string;
      if (xr && yr) k = (i + j) % 11 === 0 ? 'manhole' : 'asphalt';
      else if (xr) {
        // crosswalks on the sidewalk-side tiles just before each crossing
        const nearCross = Y_ROADS.some((r) => i === r.i0 - 1 || i === r.i0 + 4);
        k = nearCross ? 'crosswalk_x' : `road_x_${LANE[j - xr.j0]}`;
      } else if (yr) {
        const nearCross = X_ROADS.some((r) => j === r.j0 - 1 || j === r.j0 + 4);
        k = nearCross ? 'crosswalk_y' : `road_y_${LANE[i - yr.i0]}`;
      } else if (xWalk || yWalk) k = (i * 7 + j * 3) % 5 === 0 ? 'sidewalk_b' : 'sidewalk_a';
      else k = blockGround(i, j);
      col.push(k);
    }
    tiles.push(col);
  }
  return tiles;
}

function blockGround(i: number, j: number): string {
  // Pellridge plaza (paved) with a lawn strip along the west edge
  if (i < 16 && j < 16)
    return i < 2
      ? (i * 5 + j) % 7 === 0
        ? 'grass_b'
        : 'grass_a'
      : (i + j) % 4 === 0
        ? 'sidewalk_b'
        : 'sidewalk_a';
  // parking lot behind and beside the store (lot lines every 3 tiles)
  if (i >= 24 && i < 32 && j < 16) return j < 9 ? (i % 3 === 0 ? 'lot_lines' : 'lot_a') : 'sidewalk_a';
  if (i >= 40 && j < 16) return i % 3 === 1 ? 'lot_lines' : 'lot_a';
  // residential block: small lawn around the apartment block
  if (i < 16 && j >= 24 && j < 36) return (i * 5 + j) % 7 === 0 ? 'grass_b' : 'grass_a';
  // the bar block: a small lot for deliveries behind, paving in front
  if (i >= 24 && i < 32 && j >= 24 && j < 36)
    return j < 27 ? 'lot_a' : (i + j) % 4 === 0 ? 'sidewalk_b' : 'sidewalk_a';
  // Marlo's yard: dirt and old lot
  if (i >= 40 && j >= 24 && j < 36) return ((i * 73856093) ^ (j * 19349663)) % 7 === 0 ? 'lot_a' : 'dirt_a';
  // southern edge: lawn and trees
  return (i * 5 + j) % 7 === 0 ? 'grass_b' : 'grass_a';
}

type Row = Omit<Placement, 'walk'> & { walk?: number };
const P: Row[] = [];
const box = (hx: number, hy: number, h: number) => ({ kind: 'box', hx, hy, h }) as const;
const blob = (r: number) => ({ kind: 'blob', r }) as const;
const tc = (t: number) => t * T; // tile edge → world units

// ------------------------------------------------------------------ buildings
// SE (dir 0): the front (+y) faces south. Footprint half extents swap for NE (dir 6), whose front faces +x.
interface Bld {
  sprite: Placement['sprite'];
  x: number;
  y: number;
  hx: number;
  hy: number;
  h: number;
  door: { dx: number; target: DoorTarget; label: string };
}
const BUILDINGS: Bld[] = [
  {
    sprite: 'bld/pellridge_tower',
    x: tc(8),
    y: tc(7.5),
    hx: 28 * B,
    hy: 28 * B,
    h: 125 * B,
    door: { dx: 0, target: 'tower_lobby', label: 'PELLRIDGE TOWER' },
  },
  {
    sprite: 'bld/open_most_hours',
    x: tc(28),
    y: tc(12.5),
    hx: 24 * B,
    hy: 15 * B,
    h: 31 * B,
    door: { dx: 16.25 * B, target: 'store', label: 'OPEN MOST HOURS' },
  },
  {
    sprite: 'bld/apartment_block',
    x: tc(8),
    y: tc(31),
    hx: 24 * B,
    hy: 17 * B,
    h: 64 * B,
    door: { dx: -6 * B, target: 'apartment', label: 'DRIZZLE ROW RESIDENCES' },
  },
  {
    sprite: 'bld/bar',
    x: tc(28),
    y: tc(32),
    hx: 22 * B,
    hy: 15 * B,
    h: 28 * B,
    door: { dx: 13 * B, target: 'bar', label: 'THE LOW TIDE' },
  },
  {
    sprite: 'bld/chop_shop',
    x: tc(44),
    y: tc(30.5),
    hx: 28 * B,
    hy: 19 * B,
    h: 25 * B,
    door: { dx: 15.75 * B, target: 'chop_shop', label: "MARLO'S TOW & SALVAGE" },
  },
];
const DOORS: { x: number; y: number; target: DoorTarget; label: string }[] = [];
for (const b of BUILDINGS) {
  P.push({
    sprite: b.sprite,
    dir: 0,
    x: b.x,
    y: b.y,
    shadow: box(b.hx, b.hy, b.h),
    solid: true,
    night: true,
  });
  // The door hotspot is on the pavement just in front of the entrance.
  const door = {
    x: b.x + b.door.dx,
    y: b.y + b.hy + 10,
    target: b.door.target,
    label: `ENTER ${b.door.label}`,
  };
  DOORS.push(door);
}

// ------------------------------------------------------------------ street furniture
/** Props along every sidewalk: lamps, then a repeating mix of furniture between them. */
function sidewalkProps(): void {
  const seen = new Set<string>();
  const add = (p: Row) => {
    const key = `${Math.round(p.x / 8)},${Math.round(p.y / 8)}`;
    if (seen.has(key)) return;
    seen.add(key);
    P.push(p);
  };
  const MIX = ['trash_can', 'bench', 'hydrant', 'planter', 'mailbox', 'tree_b'] as const;
  // x-roads: props on the outer sidewalk tile row (next to the block), lamps on the curb row
  for (const r of X_ROADS) {
    for (const side of [-1, 1] as const) {
      const curbJ = side < 0 ? r.j0 - 1 : r.j0 + 4;
      const backJ = side < 0 ? r.j0 - 2 : r.j0 + 5;
      for (let i = 1; i < N - 1; i++) {
        if (Y_ROADS.some((y) => i >= y.i0 - 2 && i < y.i0 + 6)) continue; // keep corners clear
        const x = tc(i) + 16;
        // lamps every 8 tiles, staggered between the two sides of the street
        if (i % 8 === (side < 0 ? 3 : 7))
          add({
            sprite: 'prop/lamp',
            dir: 0,
            x,
            y: tc(curbJ) + (side < 0 ? 8 : 24),
            shadow: blob(4),
            lamp: true,
            solid: true,
          });
        else if (i % 6 === 0) {
          const kind = MIX[(i + r.j0 + (side > 0 ? 3 : 0)) % MIX.length] as string;
          add({
            sprite: `prop/${kind}`,
            dir: 0,
            x,
            y: tc(backJ) + 16,
            shadow: kind.startsWith('tree')
              ? blob(26)
              : kind === 'bench'
                ? box(17, 5, 12)
                : blob(kind === 'planter' ? 13 : 5),
            solid: !kind.startsWith('tree'),
          });
        }
      }
    }
  }
  for (const r of Y_ROADS) {
    for (const side of [-1, 1] as const) {
      const curbI = side < 0 ? r.i0 - 1 : r.i0 + 4;
      const backI = side < 0 ? r.i0 - 2 : r.i0 + 5;
      for (let j = 1; j < N - 1; j++) {
        if (X_ROADS.some((x) => j >= x.j0 - 2 && j < x.j0 + 6)) continue;
        const y = tc(j) + 16;
        if (j % 8 === (side < 0 ? 3 : 7))
          add({
            sprite: 'prop/lamp',
            dir: 0,
            x: tc(curbI) + (side < 0 ? 8 : 24),
            y,
            shadow: blob(4),
            lamp: true,
            solid: true,
          });
        else if (j % 6 === 0) {
          const kind = MIX[(j + r.i0 + (side > 0 ? 1 : 4)) % MIX.length] as string;
          add({
            sprite: `prop/${kind}`,
            dir: 0,
            x: tc(backI) + 16,
            y,
            shadow: kind.startsWith('tree')
              ? blob(26)
              : kind === 'bench'
                ? box(17, 5, 12)
                : blob(kind === 'planter' ? 13 : 5),
            solid: !kind.startsWith('tree'),
          });
        }
      }
    }
  }
  // traffic lights and street signs on the four corners of every crossing
  for (const xr of X_ROADS) {
    for (const yr of Y_ROADS) {
      const corners = [
        [yr.i0 - 1, xr.j0 - 1],
        [yr.i0 + 4, xr.j0 - 1],
        [yr.i0 - 1, xr.j0 + 4],
        [yr.i0 + 4, xr.j0 + 4],
      ] as const;
      corners.forEach(([ci, cj], k) => {
        const x = tc(ci) + (ci < yr.i0 ? 26 : 6);
        const y = tc(cj) + (cj < xr.j0 ? 26 : 6);
        add({ sprite: 'prop/traffic_light', dir: 0, x, y, shadow: blob(5), solid: true });
        if (k % 2 === 0)
          add({
            sprite: 'prop/street_sign',
            dir: 0,
            x: x + (ci < yr.i0 ? -14 : 14),
            y,
            shadow: blob(4),
            solid: true,
          });
      });
    }
  }
}

// ------------------------------------------------------------------ blocks
function plaza(): void {
  // Pellridge plaza: planters, trees and benches around the tower forecourt, an ATM by the door
  const items: [string, number, number][] = [
    ['tree_a', 2.5, 3],
    ['tree_a', 2.5, 13],
    ['tree_b', 14, 2.5],
    ['planter', 4, 15],
    ['planter', 12.5, 15],
    ['bench', 5.5, 14.5],
    ['bench', 10.5, 14.5],
    ['trash_can', 13.8, 14],
    ['lamp', 2.5, 8],
    ['planter', 14.5, 7.5],
    ['bush', 1, 6],
    ['bush', 1, 10],
    ['pine', 1, 1],
  ];
  for (const [kind, ti, tj] of items) {
    const shadow = kind.startsWith('tree')
      ? blob(26)
      : kind === 'pine'
        ? blob(18)
        : kind === 'bench'
          ? box(17, 5, 12)
          : kind === 'planter'
            ? blob(13)
            : kind === 'bush'
              ? blob(12)
              : blob(5);
    P.push({
      sprite: `prop/${kind}` as Placement['sprite'],
      dir: 0,
      x: tc(ti),
      y: tc(tj),
      shadow,
      solid: !['tree_a', 'tree_b', 'pine', 'bush'].includes(kind),
      lamp: kind === 'lamp',
    });
  }
  P.push({
    sprite: 'int/atm',
    dir: 0,
    x: tc(13.5),
    y: tc(12),
    shadow: box(7, 7, 34),
    solid: true,
    interact: { id: 'atm_plaza', label: 'USE ATM' },
  });
}

function storeBlock(): void {
  // parking lot west of the store: parked cars (some can be stolen in milestone 3), a dumpster behind
  const cars: [string, number, number, number][] = [
    ['sedan_lav', 25, 2, 2],
    ['sedan_teal', 28, 2, 2],
    ['van_white', 31, 2.2, 2],
    ['sedan_clay', 25, 6.5, 6],
    ['taxi', 30.5, 6.5, 6],
  ];
  for (const [name, ti, tj, dir] of cars) {
    const along = dir === 2 || dir === 6;
    P.push({
      sprite: `veh/${name}` as Placement['sprite'],
      dir,
      x: tc(ti),
      y: tc(tj),
      shadow: along ? box(16, 40, 22) : box(40, 16, 22),
      solid: true,
    });
  }
  P.push({ sprite: 'prop/dumpster', dir: 0, x: tc(31), y: tc(10), shadow: box(16, 8, 17), solid: true });
  P.push({ sprite: 'prop/crate', dir: 0, x: tc(24.6), y: tc(10.3), shadow: box(8, 8, 15), solid: true });
  // the east lot by Millwright Road
  const lot: [string, number, number, number][] = [
    ['sedan_khaki', 41.5, 3, 2],
    ['van_sage', 44.5, 3.2, 2],
    ['sedan_teal', 41.5, 9, 2],
    ['sedan_lav', 46, 12, 2],
  ];
  for (const [name, ti, tj, dir] of lot)
    P.push({
      sprite: `veh/${name}` as Placement['sprite'],
      dir,
      x: tc(ti),
      y: tc(tj),
      shadow: box(16, 40, 22),
      solid: true,
    });
  P.push({ sprite: 'prop/lamp', dir: 0, x: tc(43), y: tc(7), shadow: blob(4), lamp: true, solid: true });
}

function residentialBlock(): void {
  const items: [string, number, number][] = [
    ['tree_a', 2, 25.5],
    ['tree_b', 14, 25.5],
    ['pine', 1.5, 34.5],
    ['bush', 14, 34],
    ['bush', 3, 29],
    ['mailbox', 12.5, 35],
    ['tree_a', 14.5, 30],
  ];
  for (const [kind, ti, tj] of items) {
    const shadow = kind.startsWith('tree')
      ? blob(26)
      : kind === 'pine'
        ? blob(18)
        : kind === 'bush'
          ? blob(12)
          : blob(4);
    P.push({
      sprite: `prop/${kind}` as Placement['sprite'],
      dir: 0,
      x: tc(ti),
      y: tc(tj),
      shadow,
      solid: kind === 'mailbox',
    });
  }
}

function barBlock(): void {
  P.push({ sprite: 'prop/dumpster', dir: 0, x: tc(25), y: tc(25.3), shadow: box(16, 8, 17), solid: true });
  P.push({ sprite: 'prop/barrel_brick', dir: 0, x: tc(30.5), y: tc(25.4), shadow: blob(6), solid: true });
  P.push({ sprite: 'prop/barrel_teal', dir: 0, x: tc(31.1), y: tc(25.9), shadow: blob(6), solid: true });
  P.push({ sprite: 'prop/planter', dir: 0, x: tc(24.8), y: tc(35), shadow: blob(13), solid: true });
  P.push({ sprite: 'prop/bench', dir: 0, x: tc(31), y: tc(35.2), shadow: box(17, 5, 12), solid: true });
}

function chopBlock(): void {
  // Marlo's yard: junk cars, crates, barrels and a road worker on a smoke break
  const junk: [string, number, number, number][] = [
    ['sedan_clay', 41.5, 26, 0],
    ['van_white', 46, 26.2, 0],
  ];
  for (const [name, ti, tj, dir] of junk)
    P.push({
      sprite: `veh/${name}` as Placement['sprite'],
      dir,
      x: tc(ti),
      y: tc(tj),
      shadow: box(40, 16, 22),
      solid: true,
    });
  const items: [string, number, number][] = [
    ['crate', 40.6, 34.6],
    ['crate', 41.2, 35.2],
    ['barrel_teal', 47, 34],
    ['barrel_brick', 47.2, 33.2],
    ['dumpster', 47, 29],
  ];
  for (const [kind, ti, tj] of items) {
    const shadow = kind === 'crate' ? box(8, 8, 15) : kind === 'dumpster' ? box(16, 8, 17) : blob(6);
    P.push({
      sprite: `prop/${kind}` as Placement['sprite'],
      dir: 0,
      x: tc(ti),
      y: tc(tj),
      shadow,
      solid: true,
    });
  }
}

function southEdge(): void {
  for (let i = 1; i < N; i += 4) {
    const kind = i % 8 === 1 ? 'pine' : 'tree_a';
    P.push({
      sprite: `prop/${kind}` as Placement['sprite'],
      dir: 0,
      x: tc(i) + 10,
      y: tc(46.5),
      shadow: blob(kind === 'pine' ? 18 : 26),
      solid: false,
    });
  }
  for (let i = 3; i < N; i += 8)
    P.push({ sprite: 'prop/bush', dir: 0, x: tc(i), y: tc(45), shadow: blob(12), solid: false });
}

plaza();
storeBlock();
residentialBlock();
barBlock();
chopBlock();
sidewalkProps();
southEdge();

/** Street spans for the HUD's street-name readout, in world units. */
export const STREETS: StreetSpan[] = [
  ...X_ROADS.map((r) => ({ name: r.name, x0: 0, x1: tc(N), y0: tc(r.j0 - 2), y1: tc(r.j0 + 6) })),
  ...Y_ROADS.map((r) => ({ name: r.name, x0: tc(r.i0 - 2), x1: tc(r.i0 + 6), y0: 0, y1: tc(N) })),
];

export const DOWNTOWN: MapData = {
  id: 'downtown',
  name: 'THE LEDGER',
  width: N,
  height: N,
  tiles: buildTiles(),
  placements: P.map((p) => ({ walk: 0, ...p })),
  doors: DOORS,
  streets: STREETS,
  // on Overcast Avenue's north sidewalk, outside Pellridge Tower
  spawn: { x: tc(9), y: tc(17) },
};

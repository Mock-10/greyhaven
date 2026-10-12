// What ground is at a world point, for tile maps and vector-ground maps alike (radar, map tests).

import groundJson from '../../art/ground.json';
import { TILE } from '../config/constants';
import { worldGrid } from '../iso/vectorGround';
import type { MapData } from './types';

const NAMES: string[] = [];
const IDS = new Map<string, number>();
for (const m of groundJson.materials) {
  NAMES[m.id] = m.name;
  IDS.set(m.name, m.id);
}

/** World units per cell of the coarse material grid made for vector maps. */
export const GROUND_GRID_RES = 8;

const cache = new WeakMap<MapData, (x: number, y: number) => string | undefined>();

/** A function giving the ground kind (tile kind or material name) at world (x, y), or undefined off the map. */
export function groundSampler(map: MapData): (x: number, y: number) => string | undefined {
  const hit = cache.get(map);
  if (hit) return hit;
  let fn: (x: number, y: number) => string | undefined;
  if (map.ground) {
    const shapes = map.ground.shapes.map((s) => {
      const mat = IDS.get(s.m);
      if (mat === undefined) throw new Error(`unknown ground material ${s.m}`);
      return { mat, poly: s.p };
    });
    const base = IDS.get(map.ground.base) as number;
    const g = worldGrid(shapes, map.width * TILE, map.height * TILE, base, GROUND_GRID_RES);
    fn = (x, y) => {
      const i = Math.floor(x / g.res);
      const j = Math.floor(y / g.res);
      if (i < 0 || j < 0 || i >= g.w || j >= g.h) return undefined;
      return NAMES[g.data[j * g.w + i] as number];
    };
  } else {
    const tiles = map.tiles ?? [];
    fn = (x, y) => tiles[Math.floor(x / TILE)]?.[Math.floor(y / TILE)];
  }
  cache.set(map, fn);
  return fn;
}

/** The district name at a world point: the first district area containing it, else the map's own name. */
export function districtAt(map: MapData, x: number, y: number): string {
  const d = map.districts?.find((q) => x >= q.x0 && x < q.x1 && y >= q.y0 && y < q.y1);
  return d?.name ?? map.name ?? '';
}

import { describe, expect, it } from 'vitest';
import groundJson from '../art/ground.json';
import { parseAtlas } from '../src/assets/atlasFormat';
import { ATLASES } from '../src/assets/manifest';
import { DIRS } from '../src/config/constants';
import { DOWNTOWN } from '../src/maps/downtown';
import { groundSampler } from '../src/maps/groundQuery';
import type { Placement } from '../src/maps/types';

const T = 32;
const NW = 70;
const NH = 96;
const ground = groundSampler(DOWNTOWN);
const ROAD = new Set(['asphalt', 'asphalt_wet', 'paint_white', 'paint_gold', 'iron']);

function box(p: Placement): [number, number, number, number] {
  const s = p.shadow;
  if (s.kind === 'box') return [p.x - s.hx, p.y - s.hy, p.x + s.hx, p.y + s.hy];
  if (s.kind === 'obox') {
    const ex = Math.abs(s.hx * Math.cos(s.ang)) + Math.abs(s.hy * Math.sin(s.ang));
    const ey = Math.abs(s.hx * Math.sin(s.ang)) + Math.abs(s.hy * Math.cos(s.ang));
    return [p.x - ex, p.y - ey, p.x + ex, p.y + ey];
  }
  const r = /^prop\/(tree|pine)/.test(p.sprite) ? 4 : s.r;
  return [p.x - r, p.y - r, p.x + r, p.y + r];
}

const solidsHit = (x: number, y: number, r = 6) =>
  DOWNTOWN.placements.filter((p) => {
    if (!p.solid) return false;
    const s = p.shadow;
    if (s.kind === 'blob') return (x - p.x) ** 2 + (y - p.y) ** 2 < (r + s.r) ** 2;
    const a = s.kind === 'obox' ? s.ang : 0;
    const u = (x - p.x) * Math.cos(a) + (y - p.y) * Math.sin(a);
    const v = -(x - p.x) * Math.sin(a) + (y - p.y) * Math.cos(a);
    const cu = Math.max(-s.hx, Math.min(u, s.hx));
    const cv = Math.max(-s.hy, Math.min(v, s.hy));
    return (u - cu) ** 2 + (v - cv) ** 2 < r * r;
  });

describe('Downtown map (vector ground)', () => {
  it('is 70 x 96 tiles of known ground materials (48 until the Phase 2 map growth)', () => {
    expect(DOWNTOWN.width).toBe(NW);
    expect(DOWNTOWN.height).toBe(NH);
    const known = new Set(groundJson.materials.map((m) => m.name));
    expect(known.has(DOWNTOWN.ground!.base)).toBe(true);
    for (const s of DOWNTOWN.ground!.shapes) {
      expect(known.has(s.m), s.m).toBe(true);
      expect(s.p.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('places only sprites that exist, including night variants and ground decals', () => {
    const all = new Set<string>();
    for (const a of Object.values(ATLASES)) for (const k of Object.keys(a.json.frames)) all.add(k);
    const props = new Set(Object.keys(ATLASES.props.json.frames).map((k) => k.split('/')[1]));
    const cityHas = (k: string) => parseAtlas(ATLASES.city.json).has(k);
    for (const p of DOWNTOWN.placements) {
      const [kind, name] = p.sprite.split('/') as [string, string];
      const d = DIRS[p.dir % 8];
      const inCity = cityHas(`${kind}/${name}/${p.dir}`);
      if (kind === 'seg') expect(inCity, p.sprite).toBe(true);
      else if (kind === 'prop')
        expect(inCity || (p.dir === 0 && props.has(name)), `${p.sprite} ${p.dir}`).toBe(true);
      else if (kind === 'int') expect(all.has(`${name}/normal`), p.sprite).toBe(true);
      else expect(inCity || all.has(`${name}/${d}`), `${p.sprite}/${d}`).toBe(true);
      if (p.night)
        expect(cityHas(`bld/${name}_night/${p.dir}`) || all.has(`${name}_night/${d}`), `${name}_night`).toBe(
          true,
        );
    }
    for (const dc of DOWNTOWN.ground!.decals ?? []) expect(cityHas(`dec/${dc.k}/0`), dc.k).toBe(true);
  });

  it('keeps buildings and parked cars off the roads', () => {
    for (const p of DOWNTOWN.placements) {
      if (!(p.sprite.startsWith('bld/') || p.sprite.startsWith('veh/')) || p.solid === false) continue;
      const [x0, y0, x1, y1] = box(p);
      for (const [x, y] of [
        [x0 + 3, y0 + 3],
        [x1 - 3, y0 + 3],
        [x1 - 3, y1 - 3],
        [x0 + 3, y1 - 3],
        [(x0 + x1) / 2, (y0 + y1) / 2],
      ] as const) {
        if (x < 0 || y < 0 || x >= NW * T || y >= NH * T) continue;
        const k = ground(x, y);
        expect(
          k !== undefined && ROAD.has(k) && k !== 'paint_white',
          `${p.sprite} on ${k} at ${x},${y}`,
        ).toBe(false);
      }
    }
  });

  it('does not overlap buildings', () => {
    const blds = DOWNTOWN.placements.filter((p) => p.sprite.startsWith('bld/') && p.solid !== false).map(box);
    for (let i = 0; i < blds.length; i++)
      for (let j = i + 1; j < blds.length; j++) {
        const a = blds[i]!;
        const b = blds[j]!;
        const ox = Math.min(a[2], b[2]) - Math.max(a[0], b[0]);
        const oy = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
        expect(ox > 1 && oy > 1, `buildings ${i} and ${j}`).toBe(false);
      }
  });

  it('spawns the player on open pavement', () => {
    expect(solidsHit(DOWNTOWN.spawn.x, DOWNTOWN.spawn.y)).toEqual([]);
    expect(ground(DOWNTOWN.spawn.x, DOWNTOWN.spawn.y)).toMatch(/^(sidewalk|kerb|plaza|terrazzo)/);
  });

  it('has a reachable street door for every interior', () => {
    const doors = DOWNTOWN.doors ?? [];
    expect(doors.map((d) => d.target).sort()).toEqual([
      'apartment',
      'bar',
      'chop_shop',
      'clothing',
      'dealer',
      'hardware',
      'store',
      'tower_lobby',
    ]);
    // the used-car lot's pickup bay holds a bought car (milestone 6b)
    const bay = DOWNTOWN.zones?.find((z) => z.id === 'dealer_pickup')?.slots?.[0];
    expect(bay).toBeDefined();
    expect(solidsHit(bay!.x, bay!.y)).toEqual([]);
    for (const d of doors) {
      expect(solidsHit(d.x, d.y), d.label).toEqual([]);
      expect(ROAD.has(ground(d.x, d.y) ?? 'asphalt'), d.label).toBe(false);
    }
  });

  it('has a parking lot with cars to steal, including the taxi and the van', () => {
    const cars = DOWNTOWN.placements.filter((p) => p.sprite.startsWith('veh/'));
    expect(cars.filter((c) => ground(c.x, c.y) === 'lot').length).toBeGreaterThanOrEqual(4);
    const stealable = cars.filter((c) => c.parked).map((c) => c.sprite);
    expect(stealable).toContain('veh/taxi');
    expect(stealable).toContain('veh/van_white');
  });

  it('gives Marlo a dotted sale spot in plain view, reachable from Gullsway', () => {
    const z = DOWNTOWN.zones?.find((q) => q.id === 'marlo_spot');
    expect(z).toBeDefined();
    const cx = (z!.x0 + z!.x1) / 2;
    const cy = (z!.y0 + z!.y1) / 2;
    // a car fits: about 2.5 x 1 tiles
    expect(z!.x1 - z!.x0).toBeGreaterThan(80);
    expect(z!.y1 - z!.y0).toBeGreaterThan(36);
    // nothing solid in it, and painted outline around it
    expect(solidsHit(cx, cy, 30)).toEqual([]);
    // painted dashes along the outline (the ground sampler's grid is too coarse for 2.6-unit lines)
    const dashes = DOWNTOWN.ground!.shapes.filter(
      (sh) =>
        sh.m === 'paint_white' &&
        sh.p.every(([x, y]) => x >= z!.x0 - 3 && x <= z!.x1 + 3 && y >= z!.y0 - 3 && y <= z!.y1 + 3),
    );
    expect(dashes.length).toBeGreaterThan(20);
    // no building stands in front of it on screen (larger x + y, overlapping screen x)
    for (const p of DOWNTOWN.placements.filter((q) => q.sprite.startsWith('bld/'))) {
      const [x0, y0, x1, y1] = box(p);
      const front = x0 + y0 > z!.x1 + z!.y1;
      const sx = [x0 - y1, x1 - y0];
      const overlaps = sx[0]! < z!.x1 - z!.y0 && sx[1]! > z!.x0 - z!.y1;
      expect(front && overlaps, p.sprite).toBe(false);
    }
    // the drive from Gullsway's kerb to the spot is clear
    for (let x = cx; x < cx + 6 * T; x += 8) expect(solidsHit(x, cy, 16), `x ${x}`).toEqual([]);
  });

  it('puts the fuel canopy overhead with posts tall enough to drive under', () => {
    const roof = DOWNTOWN.placements.find((p) => p.sprite === 'bld/fuel_canopy')!;
    expect(roof.over).toBe(true);
    expect(roof.solid).toBe(false);
    expect(DOWNTOWN.placements.filter((p) => p.sprite === 'bld/canopy_post').length).toBe(4);
    const pumps = DOWNTOWN.placements.filter((p) => p.interact?.id.startsWith('pump'));
    expect(pumps.length).toBe(4);
    const kiosk = DOWNTOWN.placements.find((p) => p.sprite === 'bld/fuel_kiosk')!;
    // the kiosk's front (+y) faces the pumps
    expect(kiosk.dir).toBe(0);
    for (const p of pumps) expect(p.y).toBeGreaterThan(kiosk.y);
  });

  it('names its streets, including the bend', () => {
    const names = new Set((DOWNTOWN.streets ?? []).map((s) => s.name));
    for (const n of ['OVERCAST AVENUE', 'DRIZZLE ROW', 'PEWTER STREET', 'MILLWRIGHT ROAD', 'GULLSWAY'])
      expect(names.has(n), n).toBe(true);
  });

  it('follows the density rule: no bare 3 x 3 patch of walkable ground (docs/01)', () => {
    const walk: boolean[][] = [];
    const dressed: boolean[][] = [];
    for (let i = 0; i < NW; i++) {
      walk.push([]);
      dressed.push([]);
      for (let j = 0; j < NH; j++) {
        const c = ground(i * T + 16, j * T + 16) ?? 'asphalt';
        walk[i]!.push(!ROAD.has(c) && c !== 'lot');
        const kinds = new Set<string>();
        for (let a = 2; a < T; a += 4)
          for (let b = 2; b < T; b += 4) kinds.add(ground(i * T + a, j * T + b) ?? '');
        kinds.delete('kerb');
        dressed[i]!.push(kinds.size > 1);
      }
    }
    for (const p of DOWNTOWN.placements) {
      const [x0, y0, x1, y1] = box(p);
      if (p.sprite.startsWith('bld/')) {
        // tiles the building covers completely are not walkable
        for (let i = Math.ceil(x0 / T); i < Math.floor(x1 / T); i++)
          for (let j = Math.ceil(y0 / T); j < Math.floor(y1 / T); j++) if (walk[i]) walk[i]![j] = false;
      } else
        for (let i = Math.max(0, Math.floor(x0 / T)); i <= Math.min(NW - 1, Math.floor(x1 / T)); i++)
          for (let j = Math.max(0, Math.floor(y0 / T)); j <= Math.min(NH - 1, Math.floor(y1 / T)); j++)
            dressed[i]![j] = true;
    }
    const bare: string[] = [];
    for (let i = 0; i + 2 < NW; i++)
      for (let j = 0; j + 2 < NH; j++) {
        let all = true;
        for (let a = 0; a < 3 && all; a++)
          for (let b = 0; b < 3 && all; b++) all = walk[i + a]![j + b]! && !dressed[i + a]![j + b]!;
        if (all) bare.push(`${i},${j}`);
      }
    expect(bare).toEqual([]);
  });
});

describe('Phase 2 map growth', () => {
  it('names the districts: Downtown north of Hedgerow Way, Hedgerow Park and Far Acres south of it', async () => {
    const { districtAt } = await import('../src/maps/groundQuery');
    expect(districtAt(DOWNTOWN, 10 * 32, 20 * 32)).toBe('THE LEDGER');
    expect(districtAt(DOWNTOWN, 16 * 32, 74 * 32)).toBe('HEDGEROW PARK');
    expect(districtAt(DOWNTOWN, 54 * 32, 74 * 32)).toBe('FAR ACRES');
  });

  it('places the new buildings: the garage, the depot, the dealer cabin, the site trailer and a house row', () => {
    const names = DOWNTOWN.placements.map((p) => p.sprite);
    for (const b of [
      'bld/garage_torque',
      'bld/courier_depot',
      'bld/dealer_office',
      'bld/site_trailer',
      'bld/shop_clothing',
    ])
      expect(names, b).toContain(b);
    expect(names.filter((n) => n.startsWith('bld/house_')).length).toBeGreaterThanOrEqual(5);
  });
});

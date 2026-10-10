import { describe, expect, it } from 'vitest';
import { parseAtlas } from '../src/assets/atlasFormat';
import { ATLASES } from '../src/assets/manifest';
import { DIRS } from '../src/config/constants';
import { DOWNTOWN } from '../src/maps/downtown';

const T = 32;
const tileAt = (x: number, y: number) => DOWNTOWN.tiles[Math.floor(x / T)]?.[Math.floor(y / T)];
const solidsHit = (x: number, y: number, r = 6) =>
  DOWNTOWN.placements.filter((p) => {
    if (!p.solid) return false;
    if (p.shadow.kind === 'box') {
      const cx = Math.max(p.x - p.shadow.hx, Math.min(x, p.x + p.shadow.hx));
      const cy = Math.max(p.y - p.shadow.hy, Math.min(y, p.y + p.shadow.hy));
      return (x - cx) ** 2 + (y - cy) ** 2 < r * r;
    }
    return (x - p.x) ** 2 + (y - p.y) ** 2 < (r + p.shadow.r) ** 2;
  });

describe('Downtown map', () => {
  it('is 48 x 48 tiles of known ground kinds', () => {
    expect(DOWNTOWN.tiles).toHaveLength(48);
    const frames = parseAtlas(ATLASES.tiles.json);
    for (const col of DOWNTOWN.tiles) for (const k of col) expect(frames.has(`${k}/s0`), k).toBe(true);
  });

  it('places only sprites that exist, including night variants', () => {
    const all = new Set<string>();
    for (const a of Object.values(ATLASES)) for (const k of Object.keys(a.json.frames)) all.add(k);
    const props = new Set(Object.keys(ATLASES.props.json.frames).map((k) => k.split('/')[1]));
    for (const p of DOWNTOWN.placements) {
      const [kind, name] = p.sprite.split('/') as [string, string];
      const d = DIRS[p.dir];
      if (kind === 'prop') expect(props.has(name), p.sprite).toBe(true);
      else if (kind === 'int') expect(all.has(`${name}/normal`), p.sprite).toBe(true);
      else expect(all.has(`${name}/${d}`), `${p.sprite}/${d}`).toBe(true);
      if (p.night) expect(all.has(`${name}_night/${d}`), `${name}_night`).toBe(true);
    }
  });

  it('keeps buildings and parked cars off the roads', () => {
    for (const p of DOWNTOWN.placements) {
      if (!(p.sprite.startsWith('bld/') || p.sprite.startsWith('veh/')) || p.shadow.kind !== 'box') continue;
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
        [0, 0],
      ] as const) {
        const k = tileAt(p.x + sx * (p.shadow.hx - 2), p.y + sy * (p.shadow.hy - 2));
        expect(k?.startsWith('road') || k?.startsWith('crosswalk'), `${p.sprite} on ${k}`).toBe(false);
      }
    }
  });

  it('spawns the player on open pavement', () => {
    expect(solidsHit(DOWNTOWN.spawn.x, DOWNTOWN.spawn.y)).toEqual([]);
    expect(tileAt(DOWNTOWN.spawn.x, DOWNTOWN.spawn.y)).toMatch(/^sidewalk/);
  });

  it('has a reachable street door for every Phase 1 interior', () => {
    const doors = DOWNTOWN.doors ?? [];
    expect(doors.map((d) => d.target).sort()).toEqual([
      'apartment',
      'bar',
      'chop_shop',
      'store',
      'tower_lobby',
    ]);
    for (const d of doors) expect(solidsHit(d.x, d.y), d.label).toEqual([]);
  });

  it('names its streets', () => {
    expect((DOWNTOWN.streets ?? []).map((s) => s.name)).toContain('OVERCAST AVENUE');
  });
});

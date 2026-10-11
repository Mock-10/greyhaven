import { describe, expect, it } from 'vitest';
import { opaqueBounds, parseAtlas, type AtlasJson } from '../src/assets/atlasFormat';
import { ATLASES } from '../src/assets/manifest';
import { TEST_MAP, tileSeed } from '../src/maps/testMap';
import { DIRS } from '../src/config/constants';

describe('atlas format', () => {
  it('parses every art-pack atlas with anchors inside their cells', () => {
    for (const [key, a] of Object.entries(ATLASES)) {
      const frames = parseAtlas(a.json);
      expect(frames.size, key).toBeGreaterThan(0);
      for (const f of frames.values()) {
        expect(f.ax >= 0 && f.ax < f.w && f.ay >= 0 && f.ay < f.h, `${key}:${f.name}`).toBe(true);
      }
    }
  });

  it('has 8 directions × 3 poses for every character costume', () => {
    const frames = parseAtlas(ATLASES.characters.json);
    for (const costume of [
      'office_worker',
      'masked_thief',
      'road_worker',
      'civilian_a',
      'civilian_b',
      'police_officer',
    ])
      for (const pose of ['idle', 'walk1', 'walk2'])
        for (const d of DIRS)
          expect(frames.has(`${costume}/${pose}/${d}`), `${costume}/${pose}/${d}`).toBe(true);
  });

  it('measures opaque bounds inside a cell', () => {
    const w = 4;
    const data = new Uint8ClampedArray(w * 4 * 4);
    data[(1 * w + 2) * 4 + 3] = 255;
    data[(2 * w + 3) * 4 + 3] = 255;
    expect(opaqueBounds(data, w, { x: 0, y: 0, w: 4, h: 4 })).toEqual({ x: 2, y: 1, w: 2, h: 2 });
    expect(opaqueBounds(data, w, { x: 0, y: 3, w: 4, h: 1 })).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });

  it('rejects empty frames', () => {
    const bad: AtlasJson = {
      image: 'x.png',
      cell: [1, 1],
      frames: { a: { x: 0, y: 0, w: 0, h: 1, anchor: [0, 0] } },
    };
    expect(() => parseAtlas(bad)).toThrow();
  });
});

describe('test map', () => {
  it('is the 28 × 28 reference district', () => {
    expect(TEST_MAP.tiles!).toHaveLength(28);
    expect(TEST_MAP.tiles!.every((c) => c.length === 28)).toBe(true);
    expect(TEST_MAP.tiles![13]?.[14]).toBe('manhole');
    expect(TEST_MAP.tiles![27]?.[20]).toBe('water_a');
    expect(TEST_MAP.tiles![27]?.[5]).toBe('lot_a');
    expect(TEST_MAP.placements).toHaveLength(50);
  });

  it('only uses tiles that exist in the variant atlas', () => {
    const frames = parseAtlas(ATLASES.tiles.json);
    TEST_MAP.tiles!.forEach((col, i) =>
      col.forEach((k, j) => expect(frames.has(`${k}/s${tileSeed(i, j)}`), `${k} at ${i},${j}`).toBe(true)),
    );
  });

  it('only places sprites that exist in the atlases', () => {
    const names = (a: keyof typeof ATLASES) => new Set([...parseAtlas(ATLASES[a].json).keys()]);
    const sets = {
      bld: names('buildings'),
      prop: new Set([...names('props')].map((k) => k.split('/')[1])),
      int: names('interactables'),
      char: names('characters'),
      veh: names('vehicles'),
    };
    for (const p of TEST_MAP.placements) {
      const [kind, name] = p.sprite.split('/') as [keyof typeof sets, string];
      const d = DIRS[p.dir];
      const want =
        kind === 'bld' || kind === 'veh'
          ? `${name}/${d}`
          : kind === 'char'
            ? `${name}/idle/${d}`
            : kind === 'int'
              ? `${name}/normal`
              : name;
      expect(sets[kind].has(want), p.sprite).toBe(true);
    }
  });
});

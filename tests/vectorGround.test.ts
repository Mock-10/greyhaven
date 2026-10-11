import { describe, expect, it } from 'vitest';
import fixture from './fixtures/vector_ground.json';
import { groundMaterials, materialIdOf } from './groundTestUtil';
import { composeGround, fillShape, hash3, projectShape, quantise, worldGrid } from '../src/iso/vectorGround';
import groundJson from '../art/ground.json';

const fnv = (b: Uint8Array | Uint8ClampedArray) => {
  let h = 0x811c9dc5;
  for (const x of b) {
    h ^= x;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
};

describe('vector ground', () => {
  it('hash3 matches art/source/sdf.py', () => {
    // values computed with sdf.hash3
    expect(hash3(0, 0, 1, 3)).toBeCloseTo(0.29861905851834897, 10);
    expect(hash3(-5, 7, 1, 3)).toBeGreaterThanOrEqual(0);
    expect(hash3(-5, 7, 1, 3)).toBeLessThanOrEqual(1);
    expect(hash3(12.7, 3.2, 2, 9)).toBe(hash3(12, 3, 2, 9));
  });

  it('dithers tones like ground2d._quant', () => {
    const ramp = [[0], [1], [2], [3], [4], [5]] as unknown as number[][];
    expect(quantise(ramp, 2.1, 0, 0)[0]).toBe(2);
    expect(quantise(ramp, 2.9, 0, 0)[0]).toBe(3);
    expect(quantise(ramp, 9, 0, 0)[0]).toBe(5);
    expect(quantise(ramp, -1, 0, 0)[0]).toBe(0);
  });

  it('fills pixel centres inside a polygon (even-odd)', () => {
    // a world square 0..32 is a 64 x 32 diamond with its top vertex at screen (0, 0)
    const s = projectShape(1, [
      [0, 0],
      [32, 0],
      [32, 32],
      [0, 32],
    ]);
    const W = 80;
    const H = 40;
    const buf = new Uint8Array(W * H);
    fillShape(buf, W, H, -40, 0, s, 1);
    const count = buf.reduce((a, v) => a + v, 0);
    expect(count).toBe(32 * 32); // the diamond's area: one pixel per world unit squared / 2 x 2
    expect(buf[16 * W + 40]).toBe(1); // centre
    expect(buf[0 * W + 0]).toBe(0);
  });

  it('composes the same pixels as art/source/ground_vec.py', () => {
    const mats = groundMaterials();
    const flat = (id: number) => [(id * 37) % 256, (id * 91) % 256, 120 + id];
    const shapes = fixture.shapes.map((s) => projectShape(materialIdOf(s.m), s.p as [number, number][]));
    const [x, y, w, h] = fixture.rect as [number, number, number, number];
    const { rgba, mat } = composeGround(
      {
        shapes,
        mapW: fixture.mapW,
        mapH: fixture.mapH,
        baseMat: materialIdOf(fixture.base),
        materials: mats,
        voidHeight: groundJson.voidHeight,
        seed: groundJson.seed,
        sample: (m, _gx, _gy, out, k) => {
          const c = flat(m);
          out[k] = c[0] as number;
          out[k + 1] = c[1] as number;
          out[k + 2] = c[2] as number;
        },
      },
      x,
      y,
      w,
      h,
    );
    for (const [sx, sy, px] of fixture.samples as [number, number, number[]][]) {
      const k = (sy * w + sx) * 4;
      expect([rgba[k], rgba[k + 1], rgba[k + 2], rgba[k + 3]], `pixel ${sx},${sy}`).toEqual(px);
    }
    expect(fnv(mat)).toBe(fixture.matHash);
    expect(fnv(rgba)).toBe(fixture.hash);
  });

  it('builds a coarse world grid of materials', () => {
    const g = worldGrid(
      [
        {
          mat: 7,
          poly: [
            [16, 16],
            [48, 16],
            [48, 48],
            [16, 48],
          ],
        },
      ],
      64,
      64,
      1,
      8,
    );
    expect(g.w).toBe(8);
    expect(g.data[3 * 8 + 3]).toBe(7);
    expect(g.data[0]).toBe(1);
    expect(g.data[6 * 8 + 6]).toBe(1);
  });
});

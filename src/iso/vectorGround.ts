// Vector ground (docs/14 "Vector ground"): streets, kerbs, sidewalks and paving are polygons in world units,
// rasterised into a material buffer at pixel centres (even-odd, no anti-aliasing). Each pixel takes its colour
// from its material's repeating swatch; where a higher surface meets a lower one the higher one shows a kerb face
// below its edge, and the edge's last row is darkened like the tile rim. This mirrors art/source/ground_vec.py
// exactly (the draft renders and the game must agree), and has no Phaser in it so it can be unit tested.

/** 4×4 ordered dither thresholds, indexed [py % 4][px % 4] (art/source/sdf.py BAYER). */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((r) => r.map((v) => (v + 0.5) / 16));

/** art/source/sdf.py hash3: a 16-bit hash of integer cell coordinates, in [0, 1]. */
export function hash3(x: number, y: number, z: number, seed = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  let h =
    (Math.imul(xi, 374761393) +
      Math.imul(yi, 668265263) +
      Math.imul(zi, 2147483647) +
      Math.imul(seed, 1442695041)) >>>
    0;
  h = Math.imul((h ^ (h >>> 13)) >>> 0, 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return (h & 0xffff) / 65535;
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

/** art/source/ground2d.py _quant for one pixel: tone (0–5) on a 6-step ramp, dithered by screen position. */
export function quantise(
  ramp: readonly (readonly number[])[],
  tone: number,
  px: number,
  py: number,
): number[] {
  const t = Math.min(5, Math.max(0, tone));
  const lo = Math.floor(t);
  const fr = t - lo;
  const thr = (BAYER[mod(py, 4)] as number[])[mod(px, 4)] as number;
  const up = fr < 0.3 ? 0 : fr > 0.7 ? 1 : fr > thr ? 1 : 0;
  return ramp[Math.min(5, Math.max(0, lo + up))] as number[];
}

export interface GroundMaterial {
  name: string;
  /** Material id in buffers (0 is the outside of the map). */
  id: number;
  /** Surface height in pixels; a higher surface shows a kerb face over a lower one. */
  height: number;
  /** Ramp for the kerb face, and its tone on left (+y) and right (+x) faces. */
  side: readonly (readonly number[])[];
  left: number;
  right: number;
}

/** A ground polygon projected to screen space once, with its bounding box. */
export interface ScreenShape {
  mat: number;
  xs: Float64Array;
  ys: Float64Array;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Project world polygons (screenX = x − y, screenY = (x + y) / 2). */
export function projectShape(mat: number, poly: readonly (readonly [number, number])[]): ScreenShape {
  const n = poly.length;
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let k = 0; k < n; k++) {
    const [x, y] = poly[k] as [number, number];
    const sx = x - y;
    const sy = (x + y) / 2;
    xs[k] = sx;
    ys[k] = sy;
    if (sx < x0) x0 = sx;
    if (sx > x1) x1 = sx;
    if (sy < y0) y0 = sy;
    if (sy > y1) y1 = sy;
  }
  return { mat, xs, ys, x0, y0, x1, y1 };
}

/**
 * Set buf pixels whose centres lie inside the screen polygon (even-odd rule), for a W × H buffer whose pixel
 * (0, 0) is screen pixel (ox, oy). The same rule as ground_vec.py fill_polygon.
 */
export function fillShape(
  buf: Uint8Array,
  W: number,
  H: number,
  ox: number,
  oy: number,
  s: ScreenShape,
  value: number,
): void {
  const n = s.xs.length;
  if (n < 3) return;
  const r0 = Math.max(0, Math.floor(s.y0 - oy - 0.5));
  const r1 = Math.min(H - 1, Math.ceil(s.y1 - oy - 0.5));
  const xi: number[] = [];
  for (let row = r0; row <= r1; row++) {
    const yc = row + 0.5 + oy;
    xi.length = 0;
    for (let k = 0; k < n; k++) {
      const ay = s.ys[k] as number;
      const by = s.ys[(k + 1) % n] as number;
      if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) {
        const ax = s.xs[k] as number;
        const bx = s.xs[(k + 1) % n] as number;
        xi.push(ax + ((yc - ay) * (bx - ax)) / (by - ay) - ox);
      }
    }
    if (xi.length < 2) continue;
    xi.sort((a, b) => a - b);
    const base = row * W;
    for (let k = 0; k + 1 < xi.length; k += 2) {
      const c0 = Math.max(0, Math.ceil((xi[k] as number) - 0.5));
      const c1 = Math.min(W, Math.ceil((xi[k + 1] as number) - 0.5));
      for (let c = c0; c < c1; c++) buf[base + c] = value;
    }
  }
}

export interface ComposeInput {
  shapes: readonly ScreenShape[];
  /** Map size in world units. */
  mapW: number;
  mapH: number;
  baseMat: number;
  /** Materials indexed by id (index 0 unused). */
  materials: readonly (GroundMaterial | undefined)[];
  voidHeight: number;
  seed: number;
  /** Colour of material `mat` at global screen pixel (gx, gy): the swatch lookup. */
  sample: (mat: number, gx: number, gy: number, out: Uint8ClampedArray, k: number) => void;
}

/** The deepest kerb face needed: the highest surface above the void outside the map. */
export function maxFace(inp: Pick<ComposeInput, 'materials' | 'voidHeight'>): number {
  let hmax = inp.voidHeight;
  for (const m of inp.materials) if (m && m.height > hmax) hmax = m.height;
  return hmax - inp.voidHeight;
}

/**
 * Compose the ground for screen rect (x, y, w, h). Returns RGBA pixels and the material id of each pixel
 * (0 outside the map). The work area is padded so faces and rims near the rect's edges come out the same as
 * in a full-map render.
 */
export function composeGround(
  inp: ComposeInput,
  x: number,
  y: number,
  w: number,
  h: number,
): { rgba: Uint8ClampedArray; mat: Uint8Array } {
  const D = maxFace(inp);
  const PL = 3;
  const PT = D;
  const PB = 1;
  const W = w + 2 * PL;
  const H = h + PT + PB;
  const ox = x - PL;
  const oy = y - PT;
  // materials: inside-map test at pixel centres, then shapes in order
  const mat = new Uint8Array(W * H);
  for (let r = 0; r < H; r++) {
    const Y = r + oy + 0.5;
    for (let c = 0; c < W; c++) {
      const X = c + ox + 0.5;
      const wx = Y + X / 2;
      const wy = Y - X / 2;
      if (wx >= 0 && wy >= 0 && wx < inp.mapW && wy < inp.mapH) mat[r * W + c] = inp.baseMat;
    }
  }
  const tmp = new Uint8Array(W * H);
  for (const s of inp.shapes) {
    if (s.x1 < ox || s.x0 > ox + W || s.y1 < oy || s.y0 > oy + H) continue;
    tmp.fill(0);
    fillShape(tmp, W, H, ox, oy, s, 1);
    for (let k = 0; k < tmp.length; k++) if (tmp[k] && mat[k]) mat[k] = s.mat;
  }
  const heightOf = (m: number) => (m === 0 ? inp.voidHeight : (inp.materials[m]?.height ?? 0));
  const hgt = new Int16Array(W * H);
  for (let k = 0; k < mat.length; k++) hgt[k] = heightOf(mat[k] as number);

  const out = new Uint8ClampedArray(w * h * 4);
  const outMat = new Uint8Array(w * h);
  const NONE = inp.voidHeight - 99;
  const hAt = (r: number, c: number) =>
    r < 0 || r >= H || c < 0 || c >= W ? NONE : (hgt[r * W + c] as number);
  for (let r = 0; r < h; r++) {
    const R = r + PT;
    const gy = y + r;
    for (let c = 0; c < w; c++) {
      const C = c + PL;
      const gx = x + c;
      const k = (r * w + c) * 4;
      const m = mat[R * W + C] as number;
      const hh = hgt[R * W + C] as number;
      outMat[r * w + c] = m;
      // kerb face: the nearest higher surface edge above this pixel, within the height difference
      let faced = false;
      for (let d = 1; d <= D; d++) {
        const um = R - d >= 0 ? (mat[(R - d) * W + C] as number) : 0;
        if (um === 0) continue;
        const up = hgt[(R - d) * W + C] as number;
        if (up - hh < d) continue;
        const rr = Math.min(H - 1, Math.max(0, R - d + 1));
        const rightHi = hAt(rr, C + 3) >= up;
        const leftHi = hAt(rr, C - 3) >= up;
        const face = inp.materials[um] as GroundMaterial;
        const noise = (hash3(gx, gy, 1, inp.seed) - 0.5) * 0.5;
        const tone = (rightHi && !leftHi ? face.left : face.right) + noise;
        const rgb = quantise(face.side, tone, gx, gy);
        out[k] = rgb[0] as number;
        out[k + 1] = rgb[1] as number;
        out[k + 2] = rgb[2] as number;
        out[k + 3] = 255;
        faced = true;
        break;
      }
      if (!faced) {
        if (m === 0) continue; // outside the map: transparent
        inp.sample(m, gx, gy, out, k);
        out[k + 3] = 255;
      }
      // rim: the last row of a surface above a lower one is darkened
      if (m !== 0) {
        const below = R + 1 < H ? (hgt[(R + 1) * W + C] as number) : 99;
        if (below < hh) {
          out[k] = Math.floor((out[k] as number) * 0.82);
          out[k + 1] = Math.floor((out[k + 1] as number) * 0.82);
          out[k + 2] = Math.floor((out[k + 2] as number) * 0.82);
        }
      }
    }
  }
  return { rgba: out, mat: outMat };
}

/**
 * Coarse material grid in world space (for the radar and map checks): cell (i, j) holds the material at
 * world point ((i + 0.5)·res, (j + 0.5)·res). Same even-odd rule, without projection.
 */
export function worldGrid(
  shapes: readonly { mat: number; poly: readonly (readonly [number, number])[] }[],
  mapW: number,
  mapH: number,
  baseMat: number,
  res: number,
): { w: number; h: number; res: number; data: Uint8Array } {
  const w = Math.ceil(mapW / res);
  const h = Math.ceil(mapH / res);
  const data = new Uint8Array(w * h).fill(baseMat);
  const xi: number[] = [];
  for (const s of shapes) {
    const n = s.poly.length;
    if (n < 3) continue;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of s.poly) {
      y0 = Math.min(y0, p[1]);
      y1 = Math.max(y1, p[1]);
    }
    const j0 = Math.max(0, Math.floor(y0 / res - 0.5));
    const j1 = Math.min(h - 1, Math.ceil(y1 / res - 0.5));
    for (let j = j0; j <= j1; j++) {
      const yc = (j + 0.5) * res;
      xi.length = 0;
      for (let k = 0; k < n; k++) {
        const a = s.poly[k] as readonly [number, number];
        const b = s.poly[(k + 1) % n] as readonly [number, number];
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc))
          xi.push(a[0] + ((yc - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
      }
      if (xi.length < 2) continue;
      xi.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xi.length; k += 2) {
        const i0 = Math.max(0, Math.ceil((xi[k] as number) / res - 0.5));
        const i1 = Math.min(w, Math.ceil((xi[k + 1] as number) / res - 0.5));
        for (let i = i0; i < i1; i++) data[j * w + i] = s.mat;
      }
    }
  }
  return { w, h, res, data };
}

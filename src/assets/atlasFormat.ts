// The art pack's atlas format (docs/13). Each .json holds `cell` [w, h] and `frames`; a frame key is
// `name/variant/direction` (or `name/state`) with its cell rect and an `anchor` [ax, ay]: the pixel
// inside the cell that sits on the object's ground point. Ground tiles anchor on the diamond's top vertex.
// Pure code, no Phaser, so it can be unit tested.

export interface AtlasJson {
  image: string;
  cell: [number, number];
  note?: string;
  frames: Record<string, { x: number; y: number; w: number; h: number; anchor: [number, number] }>;
}

export interface FrameDef {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  ax: number;
  ay: number;
}

export function parseAtlas(json: AtlasJson): Map<string, FrameDef> {
  const out = new Map<string, FrameDef>();
  for (const [name, f] of Object.entries(json.frames)) {
    if (f.w <= 0 || f.h <= 0) throw new Error(`atlas ${json.image}: frame ${name} has no size`);
    const [ax, ay] = f.anchor;
    out.set(name, { name, x: f.x, y: f.y, w: f.w, h: f.h, ax, ay });
  }
  return out;
}

/** Rect of a frame's opaque pixels, relative to the frame's cell. Empty frames give w = h = 0. */
export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Opaque bounds of one cell inside an RGBA sheet. */
export function opaqueBounds(
  data: Uint8ClampedArray | Uint8Array,
  sheetWidth: number,
  cell: { x: number; y: number; w: number; h: number },
): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let y = 0; y < cell.h; y++) {
    const row = (cell.y + y) * sheetWidth;
    for (let x = 0; x < cell.w; x++) {
      if ((data[(row + cell.x + x) * 4 + 3] as number) > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (minX === Infinity) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

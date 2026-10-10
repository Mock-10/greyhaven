// Fixed engine constants. These are facts about the art pack and the projection, not tunable
// gameplay numbers (those live in balance.ts).

/** World units per tile edge. 1 tile = 32 world units ≈ 1.4 m. */
export const TILE = 32;
/** Width and height of a ground tile's diamond on screen, in art pixels. */
export const TILE_W = 64;
export const TILE_H = 32;

/** Internal UI resolution (docs/11): the HUD is laid out on a 640 × 360 grid and scaled by whole numbers. */
export const UI_BASE_W = 640;
export const UI_BASE_H = 360;

/** Screen-facing direction names, one per 45° step of the render angle (art/source/atlas.py DIRS). */
export const DIRS = ['SE', 'S', 'SW', 'W', 'NW', 'N', 'NE', 'E'] as const;
export type Dir = (typeof DIRS)[number];

/** Background behind the map (art/source/scene.py, overcast day). */
export const BG_DAY = 0x534859;

/** Ground shadow colour: cool plum multiply (STYLE_GUIDE: #2a1e34 at about 40%). */
export const SHADOW_RGB: readonly [number, number, number] = [42, 30, 52];

/** Light direction in world space (STYLE_GUIDE; art/source/sdf.py LIGHT before normalising). */
export const LIGHT: readonly [number, number, number] = [0.22, 0.58, 0.78];

/** Palette colours used by code-drawn UI. Every value comes from art/palette.json. */
export const PAL = {
  night0: 0x241b28,
  plate: 0x2d222e, // lav 0 / night 1: panel plates
  lav2: 0x503f58,
  lav4: 0x7d7688,
  lav5: 0x928d9a,
  lavlt5: 0xbcafb6,
  cream: 0xeee9e8, // white 5
  white4: 0xd6cfd3,
  red3: 0xb95e5e,
  goldDark: 0x946f2e, // gold 1 — reserved for interactables and valuables
  gold: 0xb98f3a, // gold 2
  goldMid: 0xefd486, // gold 4
  goldHi: 0xfbeab8, // gold 5
  ink: 0x241b28,
} as const;

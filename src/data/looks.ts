// The player's look (docs/11 character creator): hair style, skin tone, hair colour, outfit and name. The player
// sprites are rendered once per hair style with marker ramps (art/source/pack_player.py); the game recolours each
// marker tone to the chosen ramp (src/assets/playerLook.ts). Every colour here is a Grey Weather palette swatch
// (art/palette.json), shifted along its ramp to make lighter or darker versions. Prices live in BALANCE.clothing.

import palette from '../../art/palette.json';

export type HairStyle = 'short' | 'long' | 'bun' | 'bald';
export const HAIR_STYLES: readonly HairStyle[] = ['short', 'long', 'bun', 'bald'];

/** Six colours, dark to light, that replace the six marker tones. */
export type Ramp = readonly [string, string, string, string, string, string];

export interface Swatch {
  id: string;
  name: string;
  ramp: Ramp;
}

const RAMPS = palette.ramps as Record<string, string[]>;

/** A palette ramp moved `by` tones (negative = darker); the ends repeat. */
export function shifted(name: string, by = 0): Ramp {
  const r = RAMPS[name];
  if (!r) throw new Error(`unknown ramp ${name}`);
  const at = (k: number) => r[Math.max(0, Math.min(5, k + by))] as string;
  return [at(0), at(1), at(2), at(3), at(4), at(5)];
}

/** docs/11: six skin tones from the skin ramp (and the warm wood and clay ramps for the deeper ones). */
export const SKIN_TONES: readonly Swatch[] = [
  { id: 'porcelain', name: 'PORCELAIN', ramp: shifted('skin', 1) },
  { id: 'fair', name: 'FAIR', ramp: shifted('skin', 0) },
  { id: 'tan', name: 'TAN', ramp: shifted('clay', 0) },
  { id: 'olive', name: 'OLIVE', ramp: shifted('wood', 1) },
  { id: 'brown', name: 'BROWN', ramp: shifted('skin', -1) },
  { id: 'deep', name: 'DEEP', ramp: shifted('wood', 0) },
];

/** docs/11: five hair colours (dark brown, black, khaki-blonde, grey, plum-red). */
export const HAIR_COLOURS: readonly Swatch[] = [
  { id: 'brown', name: 'DARK BROWN', ramp: shifted('wood', -1) },
  { id: 'black', name: 'BLACK', ramp: shifted('night', 0) },
  { id: 'blonde', name: 'KHAKI BLONDE', ramp: shifted('khaki', 1) },
  { id: 'grey', name: 'GREY', ramp: shifted('white', -1) },
  { id: 'red', name: 'PLUM RED', ramp: shifted('brick', 0) },
];

export interface Outfit {
  id: string;
  name: string;
  top: Ramp;
  bottom: Ramp;
  /** Where it comes from: one of the three starting outfits, the clothing store, or a work locker (a uniform,
   *  never in the wardrobe: it comes off at a locker or a wardrobe, docs/03). */
  from: 'start' | 'clothing' | 'uniform';
}

/** docs/11: three casual starting outfits; the clothing store sells the rest (docs/02, Phase 2 shops). */
export const OUTFITS: readonly Outfit[] = [
  {
    id: 'teal_jacket',
    name: 'TEAL JACKET',
    top: shifted('teal', 0),
    bottom: shifted('blueg', -1),
    from: 'start',
  },
  {
    id: 'sage_casual',
    name: 'SAGE CASUAL',
    top: shifted('sage', 0),
    bottom: shifted('blueg', 0),
    from: 'start',
  },
  { id: 'plum_knit', name: 'PLUM KNIT', top: shifted('plum', 1), bottom: shifted('lav', 0), from: 'start' },
  {
    id: 'grey_hoodie',
    name: 'GREY HOODIE',
    top: shifted('stone', -1),
    bottom: shifted('asph', 1),
    from: 'clothing',
  },
  {
    id: 'work_khaki',
    name: 'WORK KHAKIS',
    top: shifted('khaki', 0),
    bottom: shifted('wood', 0),
    from: 'clothing',
  },
  {
    id: 'white_shirt',
    name: 'WHITE SHIRT',
    top: shifted('white', 1),
    bottom: shifted('lav', 0),
    from: 'clothing',
  },
  {
    id: 'red_jacket',
    name: 'RED JACKET',
    top: shifted('red', 0),
    bottom: shifted('night', 1),
    from: 'clothing',
  },
  {
    id: 'clay_coat',
    name: 'CLAY COAT',
    top: shifted('clay', 0),
    bottom: shifted('wood', -1),
    from: 'clothing',
  },
  {
    id: 'navy_suit',
    name: 'NAVY SUIT',
    top: shifted('navy', -1),
    bottom: shifted('navy', -1),
    from: 'clothing',
  },
  // work uniforms (Phase 2 M7): one per job with a locker (data/jobs.ts `uniform`)
  {
    id: 'coveralls',
    name: 'TORQUE & SONS COVERALLS',
    top: shifted('blueg', -1),
    bottom: shifted('blueg', -2),
    from: 'uniform',
  },
  {
    id: 'flannel',
    name: 'ASHBY TIMBER FLANNEL',
    top: shifted('red', -1),
    bottom: shifted('khaki', -1),
    from: 'uniform',
  },
  {
    id: 'courier',
    name: 'SWIFTISH COURIERS UNIFORM',
    top: shifted('clay', 1),
    bottom: shifted('navy', 0),
    from: 'uniform',
  },
];

export interface Look {
  name: string;
  style: HairStyle;
  skin: string;
  hair: string;
  outfit: string;
}

export const DEFAULT_LOOK: Look = {
  name: 'ALEX',
  style: 'short',
  skin: 'fair',
  hair: 'brown',
  outfit: 'teal_jacket',
};

/** Starting outfits are always owned. */
export const STARTING_OUTFITS: readonly string[] = OUTFITS.filter((o) => o.from === 'start').map((o) => o.id);

export function skinOf(look: Look): Swatch {
  return SKIN_TONES.find((s) => s.id === look.skin) ?? (SKIN_TONES[1] as Swatch);
}

export function hairOf(look: Look): Swatch {
  return HAIR_COLOURS.find((s) => s.id === look.hair) ?? (HAIR_COLOURS[0] as Swatch);
}

export function outfitOf(id: string): Outfit {
  return OUTFITS.find((o) => o.id === id) ?? (OUTFITS[0] as Outfit);
}

/** The costume key the world draws the player with (sprites.ts: 'player/<style>'). */
export function playerCostume(look: Look): string {
  return `player/${look.style}`;
}

/** The name field (docs/11: 16 characters): the letters the pixel font has, upper case, trimmed. */
export function cleanName(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9 .'-]/g, '')
    .replace(/\s+/g, ' ')
    .trimStart()
    .slice(0, 16);
}

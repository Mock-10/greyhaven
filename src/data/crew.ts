// Crew for hire (docs/09 "Crews", decisions 2026-10-11: random names and portraits generated from the character
// art). Names are drawn from these lists; portraits are the face/crew0..7 icons (art/source/ui_icons.py).

export const CREW_FIRST = [
  'NIKO',
  'ROSA',
  'TEDDY',
  'MAREN',
  'OSKAR',
  'JUNE',
  'DMITRI',
  'LETTY',
  'CAL',
  'IMOGEN',
  'RUFUS',
  'SAL',
] as const;

export const CREW_NICK = [
  'TWO-TONE',
  'SPARKS',
  'THE MOLE',
  'BIG HANDS',
  'QUIET',
  'GREASE',
  'LUCKY',
  'NINE',
  'PAPERS',
  'SMOKE',
] as const;

export const CREW_FACES = 8;

export type CrewRole = 'operator' | 'driver';

export const ROLE_NAMES: Record<CrewRole, string> = { operator: 'OPERATOR', driver: 'DRIVER' };

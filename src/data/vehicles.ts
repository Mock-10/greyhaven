// Vehicle catalogue (docs/08): which car type each sprite model is, and its name on the HUD. Stats live in
// BALANCE.vehicles.types.

import type { BALANCE } from '../config/balance';

export type VehicleType = keyof typeof BALANCE.vehicles.types;

export const MODEL_TYPE: Record<string, VehicleType> = {
  sedan_clay: 'sedan',
  sedan_teal: 'sedan',
  sedan_khaki: 'sedan',
  sedan_lav: 'sedan',
  taxi: 'taxi',
  van_white: 'van',
  van_sage: 'van',
  police_car: 'police',
  swat_van: 'swat',
  armored_suv_police: 'armored',
  beater_khaki: 'beater',
  beater_brick: 'beater',
  pickup_brick: 'pickup',
  pickup_sage: 'pickup',
  pickup_stone: 'pickup',
  sports_red: 'sports',
  sports_navy: 'sports',
  sports_white: 'sports',
  armored_suv: 'armoredSuv',
};

export const TYPE_LABEL: Record<VehicleType, string> = {
  sedan: 'SEDAN',
  taxi: 'TAXI',
  van: 'VAN',
  police: 'POLICE',
  swat: 'SWAT VAN',
  armored: 'ARMORED',
  beater: 'BEATER',
  pickup: 'PICKUP',
  sports: 'SPORTS',
  armoredSuv: 'ARMORED SUV',
};

export function typeOfModel(model: string): VehicleType {
  return MODEL_TYPE[model] ?? 'sedan';
}

/** What the used-car lot sells (docs/02: "beater and sedan to start"), one row per colour. */
export const DEALER_STOCK: readonly string[] = [
  'beater_khaki',
  'beater_brick',
  'sedan_teal',
  'sedan_clay',
  'sedan_khaki',
  'sedan_lav',
  // Phase 4 (docs/08 catalogue; assumed sold at the same lot)
  'pickup_sage',
  'pickup_brick',
  'pickup_stone',
  'sports_red',
  'sports_navy',
  'sports_white',
  'armored_suv',
];

/** Colour names for the dealer's list. */
export const MODEL_COLOUR: Record<string, string> = {
  beater_khaki: 'KHAKI',
  beater_brick: 'BRICK',
  sedan_teal: 'TEAL',
  sedan_clay: 'CLAY',
  sedan_khaki: 'KHAKI',
  sedan_lav: 'LAVENDER',
  pickup_sage: 'SAGE',
  pickup_brick: 'BRICK',
  pickup_stone: 'STONE',
  sports_red: 'RED',
  sports_navy: 'NAVY',
  sports_white: 'WHITE',
  armored_suv: 'BLACK',
};

/** Every colour of a type, for the respray (docs/08). */
export function coloursOf(model: string): string[] {
  const t = typeOfModel(model);
  return Object.keys(MODEL_TYPE).filter((m) => MODEL_TYPE[m] === t);
}

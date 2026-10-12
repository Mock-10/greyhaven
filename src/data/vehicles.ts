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
  beater_khaki: 'beater',
  beater_brick: 'beater',
};

export const TYPE_LABEL: Record<VehicleType, string> = {
  sedan: 'SEDAN',
  taxi: 'TAXI',
  van: 'VAN',
  police: 'POLICE',
  beater: 'BEATER',
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
];

/** Colour names for the dealer's list. */
export const MODEL_COLOUR: Record<string, string> = {
  beater_khaki: 'KHAKI',
  beater_brick: 'BRICK',
  sedan_teal: 'TEAL',
  sedan_clay: 'CLAY',
  sedan_khaki: 'KHAKI',
  sedan_lav: 'LAVENDER',
};

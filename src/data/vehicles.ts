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
};

export const TYPE_LABEL: Record<VehicleType, string> = {
  sedan: 'SEDAN',
  taxi: 'TAXI',
  van: 'VAN',
  police: 'POLICE',
};

export function typeOfModel(model: string): VehicleType {
  return MODEL_TYPE[model] ?? 'sedan';
}

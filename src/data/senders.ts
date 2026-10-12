// The picture each message sender shows (UI redesign 2026-10-12): a portrait for people, an object for services and
// actions. Anyone not listed gets the envelope (art/source/ui_icons.py).

import type { IconName } from '../ui/icons';

export const SENDER_ICON: Readonly<Record<string, IconName>> = {
  'MS. HOLLIS': 'face/hollis',
  DEZ: 'face/dez',
  MARLO: 'face/marlo',
  HR: 'face/hr',
  LANDLORD: 'face/landlord',
  BANK: 'app/bank',
  ATM: 'app/bank',
  PAYROLL: 'item/cash',
  SHELTER: 'app/shelter',
  HOME: 'app/shelter',
  AUTOSAVE: 'app/shelter',
  TRUNK: 'item/wallet',
  LOCKPICK: 'item/lockpicks',
  HOTWIRE: 'item/toolbox',
  'FUEL CAN': 'item/fuel_can',
  'PUMP & GO': 'hud/fuel',
  CAR: 'hud/condition',
  'CAR ALARM': 'hud/condition',
  'REPAIR KIT': 'item/repair_kit',
  'FIRST AID': 'item/first_aid',
  STASH: 'app/bag',
  WARDROBE: 'face/player',
  WITNESS: 'item/phone',
  POLICE: 'hud/armor',
};

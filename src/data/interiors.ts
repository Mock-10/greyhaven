// What each interior means in the game (docs/18 answers): names, opening hours, what the draft's prompts do
// in Phase 1, door rules, NPC roles and schedules, entrances and elevator links. The geometry and sprites
// come from art/interiors/<id>.json (art/source/export_interiors.py).

import type { GigId } from './oddJobs';
import type { DoorTarget } from '../maps/types';
import type { ShopId } from './items';
import type { TaskId } from './jobs';

export type InteriorId =
  | 'apartment'
  | 'store'
  | 'tower_lobby'
  | 'office_floor'
  | 'bar'
  | 'hardware'
  | 'clothing'
  | 'dealer'
  | 'garage'
  | 'depot'
  | 'site_trailer';

export type Action =
  | { kind: 'sleep' }
  | { kind: 'job'; task: TaskId }
  /** The time clock of the job whose site this interior is (data/jobs.ts `site`). */
  | { kind: 'clock' }
  /** A work locker: the site's uniform, or back into your own clothes. */
  | { kind: 'locker' }
  | { kind: 'elevator'; to: InteriorId }
  | { kind: 'shop'; shop?: ShopId }
  | { kind: 'launder' }
  /** The clothing store's till: buy outfits (systems/clothing.ts). */
  | { kind: 'clothes' }
  /** A wardrobe or fitting booth: change into an outfit you own. */
  | { kind: 'wardrobe' }
  /** The car dealer's desk: buy a car (systems/dealer.ts). */
  | { kind: 'dealer' }
  /** A weekend odd job's task spot (data/oddJobs.ts): the bar's taps. */
  | { kind: 'gig'; gig: GigId }
  | { kind: 'later'; who: string; text: string };

/** How a door leaf behaves: always openable, locked, or open only under a condition. */
export type DoorRule =
  | { kind: 'open' }
  | { kind: 'locked'; label: string }
  | { kind: 'keycard'; minRank: number }
  | { kind: 'staffHours'; from: number; to: number; closedLabel: string };

/** Minutes of the day; `to` may be past midnight (e.g. 16:00–02:00 is 960–120). */
export interface Hours {
  from: number;
  to: number;
}

export interface NpcRole {
  role: string;
  /** Present during these hours; null = this draft figure is not used in the game. */
  hours: Hours | null;
}

export interface InteriorDef {
  id: InteriorId;
  name: string;
  /** The street door that leads here (null for upper floors). */
  street: DoorTarget | null;
  /** Opening hours for walking in from the street (null = always open). */
  hours: Hours | null;
  /** Where you arrive through the street door, and the exit hotspot. */
  entrance: { x: number; y: number } | null;
  /** Arrival point when coming up or down in the elevator. */
  elevator?: { x: number; y: number };
  /** The draft's prompt labels: what they do now (null hides the prompt; the object is just furniture). */
  actions: Record<string, { label: string; action: Action } | null>;
  /** Door leaves in the order they appear in the export. */
  doors: DoorRule[];
  /** NPC spots in the order they appear in the export. */
  npcs: NpcRole[];
}

const h = (a: number, b: number): Hours => ({ from: a * 60, to: b * 60 });
const ALWAYS: Hours = { from: 0, to: 24 * 60 };

export const INTERIORS: Record<InteriorId, InteriorDef> = {
  apartment: {
    id: 'apartment',
    name: 'APARTMENT 3B',
    street: 'apartment',
    hours: null,
    entrance: { x: 161, y: 178 },
    actions: {
      'SLEEP / SAVE': { label: 'SLEEP', action: { kind: 'sleep' } },
      'CHANGE OUTFIT': { label: 'CHANGE OUTFIT', action: { kind: 'wardrobe' } },
      STASH: {
        label: 'STASH',
        action: { kind: 'later', who: 'STASH', text: 'THE STASH OPENS WITH PROPERTY IN PHASE 5.' },
      },
    },
    doors: [],
    npcs: [{ role: 'draft stand-in for the player', hours: null }],
  },
  store: {
    id: 'store',
    name: 'OPEN MOST HOURS',
    street: 'store',
    hours: h(7, 21),
    entrance: { x: 170, y: 210 },
    actions: {
      // Phase 1 sells a few basics (decided 2026-10-11); robbery comes in Phase 3
      'ROB REGISTER': { label: 'SHOP', action: { kind: 'shop' } },
      'LOCKPICK DOOR': null,
      'CRACK SAFE': null,
      'DISABLE CAMERAS': null,
      'WIPE FOOTAGE': null,
    },
    doors: [{ kind: 'locked', label: 'STAFF ONLY' }],
    npcs: [
      { role: 'clerk', hours: h(7, 21) },
      { role: 'draft stand-in (robber)', hours: null },
      { role: 'customer', hours: h(9, 19) },
    ],
  },
  tower_lobby: {
    id: 'tower_lobby',
    name: 'PELLRIDGE TOWER',
    street: 'tower_lobby',
    hours: h(8, 18),
    entrance: { x: 96, y: 178 },
    elevator: { x: 128, y: 26 },
    actions: {
      ELEVATOR: { label: 'ELEVATOR UP', action: { kind: 'elevator', to: 'office_floor' } },
    },
    doors: [{ kind: 'keycard', minRank: 2 }],
    npcs: [
      { role: 'receptionist', hours: h(8, 18) },
      { role: 'visitor', hours: null },
    ],
  },
  office_floor: {
    id: 'office_floor',
    name: 'PELLRIDGE MUTUAL - FLOOR 4',
    street: null,
    hours: null,
    entrance: null,
    elevator: { x: 24, y: 196 },
    actions: {
      ELEVATOR: { label: 'ELEVATOR DOWN', action: { kind: 'elevator', to: 'tower_lobby' } },
      'FILE PAPERWORK': { label: 'FILE PAPERWORK', action: { kind: 'job', task: 'filing' } },
      'DATA ENTRY': { label: 'DATA ENTRY', action: { kind: 'job', task: 'dataEntry' } },
      'STAMP AND SIGN': { label: 'STAMP AND SIGN', action: { kind: 'job', task: 'stampSign' } },
      MEETING: { label: 'MEETING', action: { kind: 'job', task: 'meeting' } },
      'CLOCK IN': { label: 'CLOCK IN', action: { kind: 'clock' } },
    },
    doors: [{ kind: 'open' }],
    npcs: [
      { role: 'Ms. Hollis', hours: h(8, 18) },
      { role: 'draft stand-in at the cabinets', hours: null },
      { role: 'coworker', hours: h(8, 18) },
    ],
  },
  bar: {
    id: 'bar',
    name: 'THE LOW TIDE',
    street: 'bar',
    hours: h(16, 2),
    entrance: { x: 255, y: 210 },
    actions: {
      LAUNDER: {
        label: 'LAUNDER',
        action: { kind: 'launder' },
      },
      'BAR SHIFT': { label: 'BAR SHIFT', action: { kind: 'gig', gig: 'barShift' } },
    },
    doors: [{ kind: 'staffHours', from: 18 * 60, to: 2 * 60, closedLabel: 'STAFF ONLY' }],
    npcs: [
      { role: 'Dez', hours: h(18, 2) },
      { role: 'bartender', hours: h(16, 2) },
      { role: 'regular', hours: h(17, 2) },
      { role: 'pool player', hours: h(19, 1) },
      { role: 'regular', hours: h(20, 2) },
    ],
  },
  // Phase 2 shops on Hedgerow Way (milestone 6b). Plain trade names, like the infill signs: business names need
  // the user's approval (docs/01 "Names"). Shops close at 21:00 (docs/01); the dealer keeps office hours.
  hardware: {
    id: 'hardware',
    name: 'HARDWARE',
    street: 'hardware',
    hours: h(8, 21),
    entrance: { x: 197, y: 180 },
    actions: {
      SHOP: { label: 'SHOP', action: { kind: 'shop', shop: 'hardware' } },
    },
    doors: [{ kind: 'locked', label: 'STAFF ONLY' }],
    npcs: [
      { role: 'clerk', hours: h(8, 21) },
      { role: 'customer', hours: h(9, 18) },
    ],
  },
  clothing: {
    id: 'clothing',
    name: 'CLOTHING',
    street: 'clothing',
    hours: h(9, 21),
    entrance: { x: 193, y: 180 },
    actions: {
      'BUY CLOTHES': { label: 'BUY CLOTHES', action: { kind: 'clothes' } },
      'CHANGE OUTFIT': { label: 'CHANGE OUTFIT', action: { kind: 'wardrobe' } },
    },
    doors: [],
    npcs: [
      { role: 'clerk', hours: h(9, 21) },
      { role: 'shopper', hours: h(10, 19) },
    ],
  },
  dealer: {
    id: 'dealer',
    name: 'USED CARS',
    street: 'dealer',
    hours: h(9, 18),
    entrance: { x: 104, y: 116 },
    actions: {
      'BUY A CAR': { label: 'BUY A CAR', action: { kind: 'dealer' } },
    },
    doors: [],
    npcs: [{ role: 'salesman', hours: h(9, 18) }],
  },
  // Phase 2 jobs (milestone 7; docs/03 decisions): the garage keeps 08:00-18:00, the depot and the site office too
  garage: {
    id: 'garage',
    name: 'TORQUE & SONS GARAGE',
    street: 'garage',
    hours: h(8, 18),
    entrance: { x: 32, y: 244 },
    actions: {
      'CLOCK IN': { label: 'CLOCK IN', action: { kind: 'clock' } },
      LOCKER: { label: 'LOCKER', action: { kind: 'locker' } },
      DIAGNOSE: { label: 'DIAGNOSE', action: { kind: 'job', task: 'diagnose' } },
      'TORQUE BOLTS': { label: 'TORQUE BOLTS', action: { kind: 'job', task: 'boltTorque' } },
      'CHANGE TYRE': { label: 'CHANGE TYRE', action: { kind: 'job', task: 'tyreChange' } },
      RESPRAY: { label: 'RESPRAY', action: { kind: 'job', task: 'respray' } },
    },
    doors: [],
    npcs: [
      { role: 'shop foreman', hours: h(8, 18) },
      { role: 'mechanic', hours: h(8, 18) },
    ],
  },
  depot: {
    id: 'depot',
    name: 'SWIFTISH COURIERS',
    street: 'depot',
    hours: h(8, 18),
    entrance: { x: 52, y: 244 },
    actions: {
      'CLOCK IN': { label: 'CLOCK IN', action: { kind: 'clock' } },
      LOCKER: { label: 'LOCKER', action: { kind: 'locker' } },
      'LOAD VAN': { label: 'LOAD VAN', action: { kind: 'job', task: 'loadVan' } },
      'PLAN ROUTE': { label: 'PLAN ROUTE', action: { kind: 'job', task: 'route' } },
    },
    doors: [{ kind: 'open' }],
    npcs: [
      { role: 'dispatch', hours: h(8, 18) },
      { role: 'customer', hours: h(9, 17) },
      { role: 'loader', hours: h(8, 18) },
      { role: 'courier', hours: h(8, 16) },
    ],
  },
  site_trailer: {
    id: 'site_trailer',
    name: 'ASHBY TIMBER - SITE OFFICE',
    street: 'site_trailer',
    hours: h(8, 18),
    entrance: { x: 112, y: 116 },
    actions: {
      'CLOCK IN': { label: 'CLOCK IN', action: { kind: 'clock' } },
      LOCKER: { label: 'LOCKER', action: { kind: 'locker' } },
    },
    doors: [],
    npcs: [
      { role: 'site boss', hours: h(8, 18) },
      { role: 'crew', hours: h(8, 17) },
    ],
  },
};

/** The interior a street door leads to, if any. */
export function interiorForDoor(target: DoorTarget): InteriorDef | null {
  return Object.values(INTERIORS).find((d) => d.street === target) ?? null;
}

/** Is a minute of the day inside opening hours (which may run past midnight)? */
export function isOpen(hours: Hours | null, minuteOfDay: number): boolean {
  if (!hours) return true;
  if (hours === ALWAYS) return true;
  const m = ((minuteOfDay % 1440) + 1440) % 1440;
  return hours.from <= hours.to ? m >= hours.from && m < hours.to : m >= hours.from || m < hours.to;
}

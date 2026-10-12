// What each interior means in the game (docs/18 answers): names, opening hours, what the draft's prompts do
// in Phase 1, door rules, NPC roles and schedules, entrances and elevator links. The geometry and sprites
// come from art/interiors/<id>.json (art/source/export_interiors.py).

import type { OpId } from '../systems/operations';
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
  | 'site_trailer'
  | 'house_bungalow'
  | 'house_family'
  | 'house_townhouse'
  | 'pawn'
  | 'precinct'
  | 'home_small'
  | 'home_family'
  | 'hideout';

export type CrimeStep = 'register' | 'safe' | 'cctv' | 'wipe';

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
  /** Search a burglary house's room (index into data/burglary.ts LAYOUTS[layout].rooms). */
  | { kind: 'burgle'; room: number }
  /** The house alarm's keypad by the front door. */
  | { kind: 'housePanel' }
  /** The fence's counter at the pawn shop (world/fence.ts). */
  | { kind: 'fence' }
  /** Precinct 1's front desk: your record. */
  | { kind: 'frontDesk' }
  /** A step of a store robbery (systems/robbery.ts): the register, the safe, the CCTV desk, the DVR. */
  | { kind: 'crime'; step: CrimeStep }
  /** A stash: the apartment's or a home's (docs/09, Phase 5). */
  | { kind: 'stash' }
  /** Down to the hideout under a home you own, and back up. */
  | { kind: 'basement' }
  | { kind: 'upstairs' }
  /** The hideout's plans table (buy add-ons) and workbench. */
  | { kind: 'plans' }
  | { kind: 'workbench' }
  /** An operation's station (systems/operations.ts): the press, the chop bay. */
  | { kind: 'op'; op: OpId }
  /** The Low Tide's crew booth (hire) and the hideout's crew table (posts, firing): docs/09 crews. */
  | { kind: 'hireCrew' }
  | { kind: 'crew' }
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
  /** More prompts at the same spot as a draft prompt (TAB picks between them): the store's register robbery. */
  extra?: Record<string, { label: string; action: Action }[]>;
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
      STASH: { label: 'STASH', action: { kind: 'stash' } },
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
      // the till sells the basics; TAB at it picks the robbery (Phase 3, docs/04 "Store robbery layout")
      'ROB REGISTER': { label: 'SHOP', action: { kind: 'shop' } },
      'LOCKPICK DOOR': null,
      'CRACK SAFE': { label: 'CRACK SAFE', action: { kind: 'crime', step: 'safe' } },
      'DISABLE CAMERAS': { label: 'DISABLE CAMERAS', action: { kind: 'crime', step: 'cctv' } },
      'WIPE FOOTAGE': { label: 'WIPE FOOTAGE', action: { kind: 'crime', step: 'wipe' } },
    },
    extra: { 'ROB REGISTER': [{ label: 'ROB THE REGISTER', action: { kind: 'crime', step: 'register' } }] },
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
      'HIRE CREW': { label: 'HIRE CREW', action: { kind: 'hireCrew' } },
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
  // the pawn shop on Overcast Avenue: the fence's counter (docs/04, Phase 3)
  pawn: {
    id: 'pawn',
    name: 'PAWN SHOP',
    street: 'pawn',
    hours: h(10, 22),
    entrance: { x: 161, y: 146 },
    actions: { 'THE FENCE': { label: 'THE FENCE', action: { kind: 'fence' } } },
    doors: [],
    npcs: [{ role: 'the fence', hours: h(10, 22) }],
  },
  // Greyhaven PD Precinct 1: the walkable front desk (docs/18 decisions, Phase 3); released prisoners walk out here
  precinct: {
    id: 'precinct',
    name: 'PRECINCT 1',
    street: 'precinct',
    hours: null,
    entrance: { x: 197, y: 180 },
    actions: { 'FRONT DESK': { label: 'FRONT DESK', action: { kind: 'frontDesk' } } },
    doors: [],
    npcs: [{ role: 'desk sergeant', hours: null }],
  },
  // the Phase 3 burglary houses on Linden Avenue (docs/04, docs/18 decisions): entered by picking the front door
  house_bungalow: house('house_bungalow', { x: 211, y: 178 }, ['LIVING ROOM', 'KITCHEN', 'BEDROOM']),
  house_family: house('house_family', { x: 261, y: 210 }, [
    'LIVING ROOM',
    'KITCHEN',
    'MAIN BEDROOM',
    'KIDS ROOM',
  ]),
  house_townhouse: house('house_townhouse', { x: 71, y: 210 }, ['LIVING ROOM', 'STUDY', 'BEDROOM']),
  // Phase 5 (docs/09): the houses you can own, and the hideout under them (art/source/rooms_property.py)
  home_small: home('home_small', { x: 211, y: 178 }, { x: 26, y: 80 }),
  home_family: home('home_family', { x: 261, y: 210 }, { x: 26, y: 88 }),
  hideout: {
    id: 'hideout',
    name: 'THE BASEMENT',
    street: null,
    hours: null,
    // no street door: the stairs are the way out
    entrance: null,
    elevator: { x: 26, y: 176 },
    actions: {
      UPSTAIRS: { label: 'UPSTAIRS', action: { kind: 'upstairs' } },
      PLANS: { label: 'PLANS', action: { kind: 'plans' } },
      WORKBENCH: { label: 'WORKBENCH', action: { kind: 'workbench' } },
      'STASH ROOM': { label: 'STASH', action: { kind: 'stash' } },
      PRESS: { label: 'THE PRESS', action: { kind: 'op', op: 'press' } },
      'CHOP BAY': { label: 'THE CHOP BAY', action: { kind: 'op', op: 'chopBay' } },
      CREW: { label: 'THE CREW', action: { kind: 'crew' } },
    },
    // the stash room's door; the world opens it once the add-on is built
    doors: [{ kind: 'locked', label: 'LOCKED: BUILD THE STASH ROOM (PLANS)' }],
    npcs: [],
  },
};

/** A home you own: the bed, the wardrobe, the stash, and the door down to the hideout. */
function home(
  id: InteriorId,
  entrance: { x: number; y: number },
  basement: { x: number; y: number },
): InteriorDef {
  return {
    id,
    name: 'HOME',
    street: null,
    hours: null,
    entrance,
    elevator: basement,
    actions: {
      'SLEEP / SAVE': { label: 'SLEEP', action: { kind: 'sleep' } },
      'CHANGE OUTFIT': { label: 'CHANGE OUTFIT', action: { kind: 'wardrobe' } },
      STASH: { label: 'STASH', action: { kind: 'stash' } },
      BASEMENT: { label: 'BASEMENT', action: { kind: 'basement' } },
    },
    doors: [],
    npcs: [],
  };
}

/** The interior a street door leads to, if any. */
/** A burglary house: a SEARCH prompt per room (in data/burglary.ts order), the keypad, the owner's spot. */
function house(id: InteriorId, entrance: { x: number; y: number }, rooms: readonly string[]): InteriorDef {
  const actions: InteriorDef['actions'] = {
    'ALARM PANEL': { label: 'ALARM PANEL', action: { kind: 'housePanel' } },
  };
  rooms.forEach(
    (r, k) => (actions[`SEARCH ${r}`] = { label: `SEARCH ${r}`, action: { kind: 'burgle', room: k } }),
  );
  return {
    id,
    name: 'A HOUSE ON LINDEN AVENUE',
    street: null,
    hours: null,
    entrance,
    actions,
    doors: [],
    npcs: [{ role: 'owner', hours: null }],
  };
}

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

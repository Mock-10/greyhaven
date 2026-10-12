// The one serialisable game state (docs/14). Phaser objects only display it.
// Phase 1 milestone 1 holds the player, the clock, money and the wanted level. The save system
// (milestone 4) serialises exactly this object, together with SAVE_VERSION and its migrations.

import { BALANCE } from '../config/balance';
import { createCareer, type CareerState } from '../systems/career';
import { createOddJobs, type OddJobState } from '../systems/oddJobs';
import { createOnboarding, type OnboardState } from '../systems/onboarding';
import { createFinance, type Finance, type Money } from '../systems/finance';
import type { InteriorId } from '../data/interiors';
import { DEFAULT_LOOK, STARTING_OUTFITS, playerCostume, type Look } from '../data/looks';
import type { LaunderLog } from '../systems/laundering';
import type { Vehicle } from '../systems/vehicle';
import { emptyWanted, type WantedState } from '../systems/wanted';
import { createCrime, type CrimeState } from '../systems/reputation';
import { emptyHeat, type HeatState } from '../systems/identify';
import type { Goods } from '../systems/burglary';
import { createCombat, type CombatState } from '../systems/combat';
import { createProperty, type PropertyState } from '../systems/property';

/** Where the player is: out on the street map, or inside an interior. */
export type Area = { kind: 'street' } | { kind: 'interior'; id: InteriorId };

export interface PlayerState {
  x: number;
  y: number;
  /** Facing index into DIRS (0 = +x … 7). */
  dir: number;
  moving: boolean;
  sprinting: boolean;
  health: number;
  armor: number;
  /** Costume key: 'player/<hair style>' for the palette-swapped player (docs/11), or a characters-atlas costume. */
  costume: string;
}

/** What the player carries (docs/11 bag). Tools count uses left (docs/06 durability). */
export interface Inventory {
  fuelCans: number;
  firstAid: number;
  repairKits: number;
  /** Uses left on the basic lockpick set (0 = no lockpicks). */
  lockpicks: number;
  /** A toolbox: the basic tool for hotwiring (0 or 1). */
  toolbox: number;
  /** Stolen goods from trunks (phones, watches), for the fence (Phase 3). */
  phones: number;
  watches: number;
  /** Uses left on the ATM drill (Phase 3; 0 = none). */
  drill: number;
}

/** When each store, house and ATM was last hit (in-game minutes), for restocking (Phase 3). */
export interface CrimeLog {
  stores: Record<string, number>;
  houses: Record<string, number>;
  atms: Record<string, number>;
}

export function emptyCrimeLog(): CrimeLog {
  return { stores: {}, houses: {}, atms: {} };
}

export function emptyInventory(): Inventory {
  return {
    fuelCans: 0,
    firstAid: 0,
    repairKits: 0,
    lockpicks: 0,
    toolbox: 0,
    phones: 0,
    watches: 0,
    drill: 0,
  };
}

export interface GameState {
  seed: number;
  /** In-game minutes since 00:00 on day 1 (Monday). */
  minutes: number;
  /** Map the player is on. */
  map: string;
  player: PlayerState;
  /** The character creator's choices and the outfit being worn (docs/11; data/looks.ts). */
  look: Look;
  /** Outfits the player owns (the starting three plus clothing-store buys), worn by changing at a wardrobe. */
  wardrobe: string[];
  /** Carried clean, dirty, and banked clean cash (docs/02). */
  money: Money;
  /** Bank statement and rent (systems/finance.ts). */
  finance: Finance;
  /** The calendar's fixed moments (rent, missed shifts, the weekly bonus) have run up to this minute. */
  calendarAt: number;
  wanted: WantedState;
  area: Area;
  /** Street position to return to when leaving an interior. */
  streetReturn: { x: number; y: number } | null;
  career: CareerState;
  /** Weekend gigs (car wash, bar shift): the gig in progress and the last day each was worked. */
  oddJobs: OddJobState;
  /** The guided first day (docs/11). */
  onboarding: OnboardState;
  inventory: Inventory;
  /** Phone messages, newest first (the phone's MESSAGES app). */
  messages: { at: number; who: string; text: string }[];
  /** Rooms seen per interior, for the remembered state (docs/19, saved with the game: docs/12 `sight`). */
  sight: Partial<Record<InteriorId, number[]>>;
  /** Cars in the world that can be driven (docs/08); parked map cars join on first load. */
  vehicles: Vehicle[];
  /** Id of the car the player is driving, or null on foot. */
  driving: string | null;
  /** The car the player drove last: after loading a save it waits in the home street spot (docs/09). */
  lastCar: string | null;
  /** Dirty cash washed today, for the launderer's daily cap (docs/02). */
  laundered: LaunderLog;
  /** Offense record (docs/05): the in-game minute of every arrest; the last 14 days decide first vs repeat. */
  record: { arrests: number[] };
  /** Criminal reputation, its waiting payouts and the crime contacts (systems/reputation.ts). */
  crime: CrimeState;
  /** The face on file: identifications by source (systems/identify.ts, docs/12 "heat states"). */
  heat: HeatState;
  crimeLog: CrimeLog;
  /** Burglary goods carried for the fence. */
  goods: Goods[];
  /** Masks owned (data ids) and the one worn, or null (docs/05). */
  masks: string[];
  maskOn: string | null;
  /** Weapons, ammo and what's drawn (systems/combat.ts, docs/12 `loadout`). */
  combat: CombatState;
  /** Homes owned, their add-ons and stashes, tax owed (systems/property.ts, docs/09). */
  property: PropertyState;
  /** Real seconds played, for the save summary and local play stats (docs/12). */
  playtime: number;
}

export interface Settings {
  /** Sight lines (docs/19). Visual only. Stored apart from save slots (docs/12). */
  sightLines: boolean;
  /** Preferred integer zoom, or 0 for "fit the window". */
  zoom: number;
  /** Real minutes per in-game day (docs/01: 15, 20 or 30). */
  dayLengthMinutes: number;
}

export const DEFAULT_SETTINGS: Settings = {
  sightLines: true,
  zoom: 0,
  dayLengthMinutes: BALANCE.clock.dayLengthMinutes,
};

export function createState(
  seed: number,
  map: string,
  spawn: { x: number; y: number },
  startMinute?: number,
): GameState {
  const minutes = startMinute ?? BALANCE.clock.startMinute;
  return {
    seed,
    minutes,
    map,
    player: {
      x: spawn.x,
      y: spawn.y,
      dir: 2,
      moving: false,
      sprinting: false,
      health: BALANCE.player.maxHealth,
      armor: 0,
      costume: playerCostume(DEFAULT_LOOK),
    },
    look: { ...DEFAULT_LOOK },
    wardrobe: [...STARTING_OUTFITS],
    money: {
      clean: BALANCE.economy.startClean,
      dirty: BALANCE.economy.startDirty,
      bank: BALANCE.economy.startBank,
    },
    finance: createFinance(),
    calendarAt: minutes,
    wanted: emptyWanted(),
    area: { kind: 'street' },
    streetReturn: null,
    career: createCareer(),
    oddJobs: createOddJobs(),
    onboarding: createOnboarding(),
    inventory: emptyInventory(),
    messages: [],
    sight: {},
    vehicles: [],
    driving: null,
    lastCar: null,
    laundered: { day: 0, amount: 0 },
    record: { arrests: [] },
    crime: createCrime(),
    heat: emptyHeat(),
    crimeLog: emptyCrimeLog(),
    goods: [],
    masks: [],
    maskOn: null,
    combat: createCombat(),
    property: createProperty(),
    playtime: 0,
  };
}

const SETTINGS_KEY = 'doublelife.settings';

/** Settings live in localStorage (docs/14). Storage can be unavailable in private windows. */
export function loadSettings(): Settings {
  try {
    const raw = globalThis.localStorage?.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    globalThis.localStorage?.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // Storage unavailable: settings stay in memory for this session.
  }
}

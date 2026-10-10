// The one serialisable game state (docs/14). Phaser objects only display it.
// Phase 1 milestone 1 holds the player, the clock, money and the wanted level. The save system
// (milestone 4) serialises exactly this object, together with SAVE_VERSION and its migrations.

import { BALANCE } from '../config/balance';

export interface PlayerState {
  x: number;
  y: number;
  /** Facing index into DIRS (0 = +x … 7). */
  dir: number;
  moving: boolean;
  sprinting: boolean;
  health: number;
  armor: number;
  /** Costume key in the characters atlas. */
  costume: string;
}

export interface GameState {
  seed: number;
  /** In-game minutes since 00:00 on day 1 (Monday). */
  minutes: number;
  /** Map the player is on. */
  map: string;
  player: PlayerState;
  money: { clean: number; dirty: number };
  wanted: { stars: number };
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
  return {
    seed,
    minutes: startMinute ?? BALANCE.clock.startMinute,
    map,
    player: {
      x: spawn.x,
      y: spawn.y,
      dir: 2,
      moving: false,
      sprinting: false,
      health: BALANCE.player.maxHealth,
      armor: 0,
      costume: 'office_worker',
    },
    money: { clean: BALANCE.economy.startClean, dirty: BALANCE.economy.startDirty },
    wanted: { stars: 0 },
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

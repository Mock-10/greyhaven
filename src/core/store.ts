// The one serialisable game state (docs/14). Phaser objects only display it.
// Phase 0 holds just enough for the test map: the debug walker and the view settings.
// The full save shape (docs/12) arrives with the save system in Phase 1, together with SAVE_VERSION.

export interface WalkerState {
  x: number;
  y: number;
  dir: number; // index into DIRS
  moving: boolean;
}

export interface GameState {
  seed: number;
  walker: WalkerState;
}

export interface Settings {
  /** Sight lines (docs/19). Visual only. Stored apart from save slots (docs/12). */
  sightLines: boolean;
  /** Preferred integer zoom, or 0 for "fit the window". */
  zoom: number;
}

export const DEFAULT_SETTINGS: Settings = { sightLines: true, zoom: 0 };

export function createState(seed: number, spawn: { x: number; y: number }): GameState {
  return { seed, walker: { x: spawn.x, y: spawn.y, dir: 0, moving: false } };
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

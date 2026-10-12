// Default key bindings (docs/11). Rebinding arrives with the settings menu.
export const KEYS = {
  up: 'W',
  left: 'A',
  down: 'S',
  right: 'D',
  sprint: 'SHIFT',
  recenter: 'C',
  use: 'E',
  cycle: 'TAB',
  /** Get in and out of cars (docs/11). */
  vehicle: 'F',
  handbrake: 'SPACE',
  debugOverlay: 'F3',
  /** Skip the guided first day (docs/11). */
  skipGuide: 'F2',
  /** Sight lines on/off (docs/19) until the settings menu exists. */
  sightLines: 'L',
  /** The phone and the bag (docs/11). */
  phone: 'P',
  bag: 'I',
} as const;

// A read-only window hook for the screenshot script and the smoke test (docs/14: boot with a URL
// parameter and wait for a "ready" flag). It exposes state, never cheats.

export interface DebugHook {
  ready: boolean;
  started: boolean;
  scene: string;
  zoom: number;
  fps: number;
  /** Camera pan offset from the player, in art pixels. */
  pan: { x: number; y: number };
  /** In-game minutes since day 1 00:00. */
  minutes: number;
  /** Id of the usable object E would use, if any. */
  target: string | null;
  walker: { x: number; y: number; depth: number; dir: string } | null;
  /** 'street' or the id of the interior the player is in. */
  area: string;
  /** Clean cash, office rank, shift tasks left (-1 when off shift), and an open minigame or menu. */
  clean: number;
  rank: number;
  tasksLeft: number;
  minigame: string | null;
  /** The open minigame's logic object (needle, wires, bills), read by tests to play it like a person would. */
  minigameState: unknown;
  /** Dirty cash, the car being driven, and every drivable car (milestone 3). */
  dirty: number;
  /** Wanted stars (milestone 4). */
  stars: number;
  driving: string | null;
  cars: {
    id: string;
    x: number;
    y: number;
    locked: boolean;
    running: boolean;
    fuel: number;
    heading: number;
    speed: number;
    health: number;
  }[];
  /** Depth of a placed object by sprite key (first match). */
  depthOf: (sprite: string) => number | null;
  /** Current opacity of a placed object by sprite key (first match), for occlusion checks. */
  alphaOf: (sprite: string) => number | null;
  errors: string[];
}

declare global {
  interface Window {
    __DL__: DebugHook;
  }
}

export function installHook(): DebugHook {
  const hook: DebugHook = {
    ready: false,
    started: false,
    scene: 'boot',
    zoom: 0,
    fps: 0,
    pan: { x: 0, y: 0 },
    minutes: 0,
    target: null,
    walker: null,
    area: 'street',
    clean: 0,
    rank: 1,
    tasksLeft: -1,
    minigame: null,
    minigameState: null,
    dirty: 0,
    stars: 0,
    driving: null,
    cars: [],
    depthOf: () => null,
    alphaOf: () => null,
    errors: [],
  };
  window.__DL__ = hook;
  window.addEventListener('error', (e) => hook.errors.push(String(e.message)));
  window.addEventListener('unhandledrejection', (e) => hook.errors.push(String(e.reason)));
  return hook;
}

export function hook(): DebugHook {
  return window.__DL__;
}

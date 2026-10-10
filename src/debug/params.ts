// Debug URL parameters (docs/14). Harmless and view-only, so they are allowed in every build:
//   ?scene=title|world|reference   which screen to open (default: title over the world)
//   ?seed=<n>                      RNG seed
//   ?zoom=<n>                      start at this integer zoom
//   ?debug=1                       start with the F3 overlay on
//   ?x=<world>&y=<world>           start the player here (world units)
//   ?time=HH:MM                    start the clock at this time (for screenshots of dusk and night)
// Cheats are never read from the URL.

export type SceneParam = 'title' | 'world' | 'reference';

export interface Params {
  scene: SceneParam;
  seed: number;
  zoom: number;
  debug: boolean;
  spawn: { x: number; y: number } | null;
  /** Start minute of the day from ?time=HH:MM, or null. */
  minute: number | null;
}

export function parseParams(search: string): Params {
  const q = new URLSearchParams(search);
  const scene = q.get('scene');
  const int = (k: string, lo: number, hi: number): number | null => {
    const v = Number.parseInt(q.get(k) ?? '', 10);
    return Number.isFinite(v) && v >= lo && v <= hi ? v : null;
  };
  const x = int('x', -100000, 100000);
  const y = int('y', -100000, 100000);
  const tm = /^(\d{1,2}):(\d{2})$/.exec(q.get('time') ?? '');
  const minute = tm && Number(tm[1]) < 24 && Number(tm[2]) < 60 ? Number(tm[1]) * 60 + Number(tm[2]) : null;
  return {
    scene: scene === 'world' || scene === 'reference' ? scene : 'title',
    seed: int('seed', 0, 2 ** 31 - 1) ?? 1,
    zoom: int('zoom', 1, 4) ?? 0,
    debug: q.get('debug') === '1',
    spawn: x !== null && y !== null ? { x, y } : null,
    minute,
  };
}

// The cheat console (docs/14: F1 console for balancing; decided 2026-10-11: on the Pages build too, behind a
// hidden combo, Ctrl + Shift + F1). Commands are parsed here as pure data; WorldScene applies them.

export type Cheat =
  | { kind: 'cash'; clean: number }
  | { kind: 'dirty'; amount: number }
  | { kind: 'bank'; amount: number }
  | { kind: 'item'; item: string; count: number }
  | { kind: 'time'; minute: number }
  | { kind: 'day'; day: number }
  | { kind: 'rank'; rank: number }
  | { kind: 'job'; job: string }
  | { kind: 'tp'; x: number; y: number }
  | { kind: 'car'; model: string; x: number | null; y: number | null; dir: number }
  | { kind: 'stars'; stars: number }
  | { kind: 'heal' }
  | { kind: 'gun'; weapon: string }
  | { kind: 'help' };

export const CHEAT_HELP =
  'CASH N · DIRTY N · BANK N · ITEM NAME N · TIME HH:MM · DAY N · RANK 1-5 · JOB NAME · STARS 0-5 · TP X Y · CAR MODEL [X Y DIR] · HEAL · GUN NAME';

const num = (s: string | undefined): number | null => {
  if (s === undefined || s.trim() === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** Parse one console line. Returns an error message for anything it doesn't understand. */
export function parseCheat(line: string): Cheat | { error: string } {
  const [cmd = '', ...args] = line.trim().toLowerCase().split(/\s+/);
  const a = args.map(num);
  switch (cmd) {
    case 'cash':
      return a[0] === null || a[0] === undefined ? { error: 'CASH N' } : { kind: 'cash', clean: a[0] };
    case 'dirty':
      return a[0] === null || a[0] === undefined ? { error: 'DIRTY N' } : { kind: 'dirty', amount: a[0] };
    case 'bank':
      return a[0] === null || a[0] === undefined ? { error: 'BANK N' } : { kind: 'bank', amount: a[0] };
    case 'item':
      return args[0] && typeof a[1] === 'number'
        ? { kind: 'item', item: args[0], count: Math.max(0, Math.floor(a[1])) }
        : { error: 'ITEM NAME N (LOCKPICKS, FIRSTAID, REPAIRKITS, FUELCANS, TOOLBOX)' };
    case 'time': {
      const m = /^(\d{1,2}):(\d{2})$/.exec(args[0] ?? '');
      if (!m) return { error: 'TIME HH:MM' };
      const h = Number(m[1]);
      const min = Number(m[2]);
      if (h > 23 || min > 59) return { error: 'TIME HH:MM' };
      return { kind: 'time', minute: h * 60 + min };
    }
    case 'day':
      return a[0] && a[0] >= 1 ? { kind: 'day', day: Math.floor(a[0]) } : { error: 'DAY N (1 = MONDAY)' };
    case 'rank':
      return a[0] && a[0] >= 1 && a[0] <= 5
        ? { kind: 'rank', rank: Math.floor(a[0]) }
        : { error: 'RANK 1-5' };
    case 'job':
      return args[0] ? { kind: 'job', job: args[0] } : { error: 'JOB OFFICE|MECHANIC|LUMBERJACK|DELIVERY' };
    case 'tp':
      return typeof a[0] === 'number' && typeof a[1] === 'number'
        ? { kind: 'tp', x: a[0], y: a[1] }
        : { error: 'TP X Y (WORLD UNITS)' };
    case 'car':
      if (!args[0]) return { error: 'CAR MODEL [X Y DIR]' };
      return {
        kind: 'car',
        model: args[0],
        x: a[1] ?? null,
        y: a[2] ?? null,
        dir: Math.floor(a[3] ?? 0) % 8,
      };
    case 'stars':
      return a[0] !== null && a[0] !== undefined && a[0] >= 0 && a[0] <= 5
        ? { kind: 'stars', stars: Math.floor(a[0]) }
        : { error: 'STARS 0-5' };
    case 'heal':
      return { kind: 'heal' };
    case 'gun':
      return args[0] ? { kind: 'gun', weapon: args[0] } : { error: 'GUN PISTOL|SHOTGUN|SMG|...' };
    case 'help':
    case '?':
      return { kind: 'help' };
    default:
      return { error: `UNKNOWN: ${cmd.toUpperCase()}. TRY HELP` };
  }
}

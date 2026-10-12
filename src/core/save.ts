// Save files (docs/12): the whole GameState as plain JSON, with a version, a summary for the slot list and a
// checksum. Pure code: storage lives in core/storage.ts, the menus in scenes/MenuScene.ts.

import type { GameState } from './store';
import { ONBOARD_STEPS } from '../data/onboarding';

/** Bump whenever the save shape changes, and add a migration below plus its test (CLAUDE.md rule 5). */
export const SAVE_VERSION = 5;

export const SLOTS = ['slot1', 'slot2', 'slot3'] as const;
export const AUTO_SLOTS = ['auto1', 'auto2'] as const;
export type SlotId = (typeof SLOTS)[number] | (typeof AUTO_SLOTS)[number];

export interface SaveMeta {
  slot: SlotId;
  /** Real time of saving, ms since 1970. */
  savedAt: number;
  /** In-game minutes since day 1 00:00, real seconds played, and a few numbers for the slot list. */
  minutes: number;
  playtime: number;
  clean: number;
  dirty: number;
  rank: number;
  /** A small screenshot as a PNG data URL (docs/12), when one could be taken. */
  thumb?: string;
}

export interface SaveFile {
  game: 'doublelife';
  version: number;
  meta: SaveMeta;
  state: GameState;
  checksum: string;
}

/** FNV-1a over the JSON text: catches damaged or hand-edited files on import (not a security measure). */
export function checksum(state: unknown): string {
  const text = JSON.stringify(state);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** A save of the current state. Active stars are always 0 in a save (docs/12). */
export function makeSave(state: GameState, slot: SlotId, now: number, thumb?: string): SaveFile {
  const copy = JSON.parse(JSON.stringify(state)) as GameState;
  copy.wanted = { stars: 0, seen: false, lastKnown: null, escape: 0 };
  copy.driving = null;
  const meta: SaveMeta = {
    slot,
    savedAt: now,
    minutes: copy.minutes,
    playtime: Math.round(copy.playtime),
    clean: copy.money.clean,
    dirty: copy.money.dirty,
    rank: copy.career.jobs[copy.career.current]?.rank ?? 1,
  };
  if (thumb) meta.thumb = thumb;
  return { game: 'doublelife', version: SAVE_VERSION, meta, state: copy, checksum: checksum(copy) };
}

type Obj = Record<string, unknown>;

/** Migrations: MIGRATIONS[n] turns a version-n state into a version n+1 state. */
export const MIGRATIONS: Record<number, (state: Obj) => Obj> = {
  /** 1 → 2 (Phase 2 money and phone): a bank balance, the statement and rent, calendar progress, arrest effects and
   *  the week on the career, a fuller bag, and the phone's message log. */
  1: (s) => {
    const money = s.money as Obj;
    const career = s.career as Obj;
    const shift = career.shift as Obj | null;
    const inv = (s.inventory ?? {}) as Obj;
    return {
      ...s,
      money: { ...money, bank: 0 },
      finance: { ledger: [], rent: { owed: 0, unpaidSince: null, evicted: false, storage: false } },
      calendarAt: s.minutes,
      career: {
        ...career,
        jobs: {
          mechanic: { rank: 1, xp: 0 },
          lumberjack: { rank: 1, xp: 0 },
          delivery: { rank: 1, xp: 0 },
          ...(career.jobs as Obj),
        },
        shift: shift ? { ...shift, tasks: 3 } : null,
        freezeUntil: 0,
        extraUntil: 0,
        missed: [],
        week: { pay: 0, offense: false },
      },
      inventory: {
        fuelCans: typeof inv.fuelCans === 'number' ? inv.fuelCans : 0,
        firstAid: 0,
        repairKits: 0,
        lockpicks: 0,
        toolbox: 0,
        phones: 0,
        watches: 0,
      },
      messages: [],
    };
  },
  /** 2 → 3 (Phase 2 M6b, the character creator and the clothing store): a look (the old office-worker sprite
   *  becomes the default look in the teal jacket) and a wardrobe with the three starting outfits. */
  2: (s) => {
    const player = s.player as Obj;
    return {
      ...s,
      player: { ...player, costume: 'player/short' },
      look: { name: 'ALEX', style: 'short', skin: 'fair', hair: 'brown', outfit: 'teal_jacket' },
      wardrobe: ['teal_jacket', 'sage_casual', 'plum_knit'],
    };
  },
  /** 3 → 4 (Phase 2 M7, the three new jobs): a shift in progress remembers the tasks done (delivery steps run in
   *  order, once each). An office shift saved mid-way has done none that matter. */
  3: (s) => {
    const career = s.career as Obj;
    const shift = career.shift as Obj | null;
    return { ...s, career: { ...career, shift: shift ? { ...shift, done: [] } : null } };
  },
  /** 4 → 5 (Phase 2 M8, odd jobs and the guided first day): no gig in progress, and the guide counts as done for a
   *  game that's already under way. */
  4: (s) => ({
    ...s,
    oddJobs: { gig: null, lastDay: { carWash: 0, barShift: 0 } },
    onboarding: { step: ONBOARD_STEPS.length, skipped: false, tipSent: true },
  }),
};

/** Bring a save up to SAVE_VERSION, one migration at a time. Throws for saves from a newer game. */
export function migrate(
  file: SaveFile,
  migrations: Record<number, (s: Obj) => Obj> = MIGRATIONS,
  target = SAVE_VERSION,
): SaveFile {
  if (file.version > target) throw new Error('This save comes from a newer version of the game.');
  let state = file.state as unknown as Obj;
  for (let v = file.version; v < target; v++) {
    const step = migrations[v];
    if (!step) throw new Error(`No migration from save version ${v}.`);
    state = step(state);
  }
  const out = state as unknown as GameState;
  return { ...file, version: target, state: out, checksum: checksum(out) };
}

/** Check an imported file: the right shape, a known version and a matching checksum. */
export function validate(raw: unknown): { ok: true; file: SaveFile } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'NOT A SAVE FILE' };
  const f = raw as Partial<SaveFile>;
  if (f.game !== 'doublelife' || typeof f.version !== 'number' || !f.state || !f.meta)
    return { ok: false, error: 'NOT A DOUBLE LIFE SAVE' };
  if (f.version > SAVE_VERSION) return { ok: false, error: 'SAVE FROM A NEWER VERSION' };
  if (checksum(f.state) !== f.checksum) return { ok: false, error: 'SAVE FILE IS DAMAGED' };
  const s = f.state as Partial<GameState>;
  if (typeof s.minutes !== 'number' || !s.player || !s.money)
    return { ok: false, error: 'SAVE FILE IS INCOMPLETE' };
  try {
    return { ok: true, file: migrate(f as SaveFile) };
  } catch (e) {
    return { ok: false, error: String((e as Error).message).toUpperCase() };
  }
}

/** The autosave slot to write next: the empty one, else the older one (the last 2 are kept, docs/12). */
export function nextAutoSlot(metas: Partial<Record<SlotId, SaveMeta>>): SlotId {
  const [a, b] = AUTO_SLOTS;
  const ma = metas[a];
  const mb = metas[b];
  if (!ma) return a;
  if (!mb) return b;
  return ma.savedAt <= mb.savedAt ? a : b;
}

/** `doublelife-save-<slot>-<date>.json` (docs/12). */
export function exportName(file: SaveFile): string {
  const d = new Date(file.meta.savedAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `doublelife-save-${file.meta.slot}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

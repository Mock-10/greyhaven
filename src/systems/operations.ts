// Operations in the hideout (docs/09 "Operations", Phase 5 M16): the counterfeit press and the chop bay. They only
// run while stocked: a cycle starts when you restock, finishes after its time, and then the operation stalls with its
// output waiting to be collected. Every night an operation runs while you're a known face or above 3★, a police raid
// may seize its batch, and the stash too unless the stash room hides it. Pure code.

import { BALANCE } from '../config/balance';
import type { Rng } from '../core/rng';
import { ADDONS, HOMES, type AddonId } from '../data/property';
import { MINUTES_PER_DAY } from './clock';
import type { Money } from './finance';
import type { OwnedHome, PropertyState } from './property';

export type OpId = 'press' | 'chopBay';
export const OP_IDS: readonly OpId[] = ['press', 'chopBay'];

export interface OpState {
  /** In-game minute the running batch started, or null when stalled. */
  since: number | null;
  /** What the running batch will be worth (dirty dollars). */
  batch: number;
  /** Output waiting to be collected. */
  ready: number;
}

const O = () => BALANCE.property.ops;

export function opOf(h: OwnedHome, id: OpId): OpState | null {
  if (!h.addons.includes(id as AddonId)) return null;
  h.ops ??= {};
  return (h.ops[id] ??= { since: null, batch: 0, ready: 0 });
}

export function cycleMinutes(id: OpId): number {
  return O()[id].cycleMinutes;
}

/** Minutes until the running batch is done (0 when stalled). */
export function minutesLeft(op: OpState, id: OpId, now: number): number {
  return op.since === null ? 0 : Math.max(0, op.since + cycleMinutes(id) - now);
}

/** Pay dirty money for supplies: carried cash first, then the home's stash. */
export function payDirty(h: OwnedHome, m: Money, price: number): boolean {
  if (m.dirty + h.stash.dirty < price) return false;
  const carried = Math.min(m.dirty, price);
  m.dirty -= carried;
  h.stash.dirty -= price - carried;
  return true;
}

/** Restock the press: $1,000 of dirty supplies start a 2-day run worth $2,600 in fake cash (docs/09). */
export function startPress(h: OwnedHome, m: Money, now: number): boolean {
  const op = opOf(h, 'press');
  if (!op || op.since !== null) return false;
  if (!payDirty(h, m, O().press.supplies)) return false;
  op.since = now;
  op.batch = O().press.output;
  return true;
}

/** Feed the chop bay a stolen car: a day later, 1.5× what the chop shop would pay, as dirty money (docs/09). */
export function startChop(h: OwnedHome, chopValue: number, now: number): boolean {
  const op = opOf(h, 'chopBay');
  if (!op || op.since !== null) return false;
  op.since = now;
  op.batch = Math.round(chopValue * O().chopBay.factor);
  return true;
}

/** Take what's waiting. The press's fake cash gets the money count's bonus (a share by grade). */
export function collect(h: OwnedHome, id: OpId, bonusShare = 0): number {
  const op = opOf(h, id);
  if (!op || op.ready <= 0) return 0;
  const n = Math.round(op.ready * (1 + bonusShare));
  op.ready = 0;
  return n;
}

export interface OpEvent {
  who: string;
  text: string;
}

const NAME: Record<OpId, string> = { press: 'THE PRESS', chopBay: 'THE CHOP BAY' };

/** Time passing (from, to]: finished batches wait to be collected and the operation stalls until restocked. */
export function runOps(p: PropertyState, to: number): OpEvent[] {
  const out: OpEvent[] = [];
  for (const h of p.homes)
    for (const id of OP_IDS) {
      const op = h.ops?.[id];
      if (!op || op.since === null || op.since + cycleMinutes(id) > to) continue;
      op.ready += op.batch;
      op.batch = 0;
      op.since = null;
      out.push({ who: HOMES[h.id].address, text: `${NAME[id]} IS DONE. COLLECT IT AND RESTOCK.` });
    }
  return out;
}

/** Is any operation stalled at this home (built, not running)? The radar shows it red (docs/09). */
export function stalled(h: OwnedHome): boolean {
  return OP_IDS.some((id) => h.addons.includes(id as AddonId) && (h.ops?.[id]?.since ?? null) === null);
}

/**
 * Each night at the raid hour in (from, to], while you're a known face or above 3★: a 5% chance per running
 * operation that the police raid it and seize its batch, and the stash's dirty cash and goods unless the home has a
 * stash room (docs/09).
 */
export function nightlyRaids(
  p: PropertyState,
  from: number,
  to: number,
  risky: boolean,
  rng: Rng,
): OpEvent[] {
  const out: OpEvent[] = [];
  if (!risky || !(to > from)) return out;
  const at = O().raidMinute;
  const nights = Math.floor((to - at) / MINUTES_PER_DAY) - Math.floor((from - at) / MINUTES_PER_DAY);
  for (let n = 0; n < nights; n++)
    for (const h of p.homes)
      for (const id of OP_IDS) {
        const op = h.ops?.[id];
        if (!op || op.since === null || !rng.chance(O().raidChance)) continue;
        op.since = null;
        op.batch = 0;
        let text = `RAIDED. THEY TOOK ${NAME[id]}'S BATCH.`;
        if (!h.addons.includes('stashRoom') && (h.stash.dirty > 0 || h.stash.goods.length > 0)) {
          h.stash.dirty = 0;
          h.stash.goods = [];
          text += ' AND THE STASH.';
        }
        out.push({ who: HOMES[h.id].address, text });
      }
  return out;
}

export const OP_NAMES: Record<OpId, string> = { press: ADDONS.press.name, chopBay: ADDONS.chopBay.name };

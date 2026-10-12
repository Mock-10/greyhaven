// Trunk looting (docs/04: tier 0, lockpick (easy) → quick search, $20–120 plus items, 1★ if seen; brought forward
// to Phase 2 for the guided first day). What a trunk holds is rolled once, when it's opened. Cash is dirty money;
// phones and watches are stolen goods for the fence (Phase 3); a spare set of lockpicks goes in the bag.
// "Sometimes product or a gun" arrives with those systems (Phases 3–4).

import { BALANCE } from '../config/balance';
import type { Inventory } from '../core/store';
import type { Rng } from '../core/rng';

export type LootKind = 'cash' | 'wallet' | 'phone' | 'lockpicks' | 'watch' | 'junk';

export interface LootItem {
  kind: LootKind;
  /** Dirty cash for cash and wallets; 0 for goods and junk. */
  value: number;
}

/** Valuables glint in the search panel; junk doesn't. The watch is the gold (worth more) item. */
export function glints(k: LootKind): boolean {
  return k !== 'junk';
}

/** Roll a trunk: 2–4 valuables (cash always among them) plus junk to fill the search grid. */
export function rollTrunk(rng: Rng): LootItem[] {
  const L = BALANCE.crime.trunk;
  const n = rng.int(L.valuables[0], L.valuables[1]);
  const kinds: LootKind[] = [];
  const table = Object.entries(L.weights) as [LootKind, number][];
  const total = table.reduce((s, [, w]) => s + w, 0);
  for (let k = 0; k < n; k++) {
    let r = rng.next() * total;
    const pick = table.find(([, w]) => (r -= w) < 0)?.[0] ?? 'cash';
    kinds.push(pick);
  }
  if (!kinds.some((k) => k === 'cash' || k === 'wallet')) kinds[0] = 'wallet';
  // the cash total is $20–120, split between the bills and wallets
  const money = kinds.filter((k) => k === 'cash' || k === 'wallet').length;
  let left = rng.int(L.cash[0], L.cash[1]);
  const items: LootItem[] = kinds.map((kind) => ({ kind, value: 0 }));
  let seen = 0;
  for (const it of items) {
    if (it.kind !== 'cash' && it.kind !== 'wallet') continue;
    seen++;
    const share = seen === money ? left : Math.round(left * (0.3 + 0.4 * rng.next()));
    it.value = share;
    left -= share;
  }
  const junk = rng.int(L.junk[0], L.junk[1]);
  for (let k = 0; k < junk; k++) items.push({ kind: 'junk', value: 0 });
  return rng.shuffle(items);
}

/** Put what was grabbed where it belongs. Returns the dirty cash and a short summary. */
export function takeLoot(
  items: readonly LootItem[],
  money: { dirty: number },
  inv: Inventory,
): { cash: number; summary: string } {
  let cash = 0;
  const parts: string[] = [];
  const count = (k: LootKind) => items.filter((i) => i.kind === k).length;
  for (const it of items) if (it.kind === 'cash' || it.kind === 'wallet') cash += it.value;
  money.dirty += cash;
  if (cash > 0) parts.push(`$${cash} DIRTY`);
  if (count('phone')) {
    inv.phones += count('phone');
    parts.push(count('phone') > 1 ? `${count('phone')} PHONES` : 'A PHONE');
  }
  if (count('watch')) {
    inv.watches += count('watch');
    parts.push(count('watch') > 1 ? `${count('watch')} WATCHES` : 'A WATCH');
  }
  if (count('lockpicks')) {
    inv.lockpicks += BALANCE.crime.trunk.lockpickUses * count('lockpicks');
    parts.push('LOCKPICKS');
  }
  return { cash, summary: parts.length ? parts.join(', ') : 'NOTHING' };
}

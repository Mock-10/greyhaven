// Light rivals (docs/04 "Rivals (light)", Phase 5 M17): the Saltgate Union hits a hideout. From street rep tier 2,
// each night at 22:00 every running operation has a 4% chance of a hit: a phone alert, and an in-game hour to go
// and fight off 3–5 of them at the front door. If they're still standing when the hour is up, they take that
// operation's batch. The stash room is never hit. Pure code; the world draws them (world/rivals.ts).

import { BALANCE } from '../config/balance';
import type { Rng } from '../core/rng';
import { HOMES, type HomeId } from '../data/property';
import { MINUTES_PER_DAY } from './clock';
import { OP_NAMES, type OpId } from './operations';
import type { PropertyState } from './property';

export interface Hit {
  home: HomeId;
  op: OpId;
  /** In-game minute the hour runs out. */
  until: number;
  /** Rivals still standing. */
  left: number;
}

const R = () => BALANCE.property.rivals;

export interface RivalEvent {
  who: string;
  text: string;
}

/** Each night at the hit hour in (from, to]: maybe a hit per running operation (one hit per home at a time). */
export function nightlyHits(
  p: PropertyState,
  from: number,
  to: number,
  repTier: number,
  rng: Rng,
): RivalEvent[] {
  const out: RivalEvent[] = [];
  if (repTier < R().tier || !(to > from)) return out;
  const at = R().hitMinute;
  const first = Math.floor((from - at) / MINUTES_PER_DAY) + 1;
  const last = Math.floor((to - at) / MINUTES_PER_DAY);
  for (let d = first; d <= last; d++) {
    const when = d * MINUTES_PER_DAY + at;
    for (const h of p.homes) {
      if (p.hits.some((q) => q.home === h.id)) continue;
      for (const [id, op] of Object.entries(h.ops ?? {}) as [OpId, NonNullable<typeof h.ops>[OpId]][]) {
        if (!op || op.since === null || !rng.chance(R().hitChance)) continue;
        const [lo, hi] = R().count;
        p.hits.push({ home: h.id, op: id, until: when + R().defendMinutes, left: rng.int(lo, hi) });
        out.push({
          who: 'UNKNOWN NUMBER',
          text: `SALTGATE UNION AT ${HOMES[h.id].address}. ${OP_NAMES[id]} IS OURS IN AN HOUR.`,
        });
        break;
      }
    }
  }
  return out;
}

/** The hour is up: rivals still standing take the operation's batch (running and waiting) and leave. */
export function resolveHits(p: PropertyState, now: number): RivalEvent[] {
  const out: RivalEvent[] = [];
  for (const hit of [...p.hits]) {
    if (now < hit.until) continue;
    p.hits = p.hits.filter((q) => q !== hit);
    const op = p.homes.find((h) => h.id === hit.home)?.ops?.[hit.op];
    if (op) {
      op.since = null;
      op.batch = 0;
      op.ready = 0;
    }
    out.push({ who: HOMES[hit.home].address, text: `THE SALTGATE UNION TOOK ${OP_NAMES[hit.op]}'S BATCH.` });
  }
  return out;
}

/** A rival went down at this home: the last one ends the hit. Returns true when the hit is beaten. */
export function rivalDown(p: PropertyState, home: HomeId): boolean {
  const hit = p.hits.find((q) => q.home === home);
  if (!hit) return false;
  hit.left = Math.max(0, hit.left - 1);
  if (hit.left > 0) return false;
  p.hits = p.hits.filter((q) => q !== hit);
  return true;
}

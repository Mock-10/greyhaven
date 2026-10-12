// Crews (docs/09 "Crews", Phase 5 M17): hired at The Low Tide from street rep tier 2 once a home has a crew room,
// paid a weekly wage from that home's stash, gone after 3 days unpaid. Operators are posted to an operation and keep
// it running for a cut (systems/operations.ts runOps). Drivers come with smuggling. Pure code.

import { BALANCE } from '../config/balance';
import type { Rng } from '../core/rng';
import { CREW_FACES, CREW_FIRST, CREW_NICK, type CrewRole } from '../data/crew';
import type { HomeId } from '../data/property';
import type { Money } from './finance';
import type { OpId } from './operations';
import type { OwnedHome, PropertyState } from './property';

export interface CrewMember {
  id: number;
  name: string;
  /** Portrait: face/crew<face>. */
  face: number;
  role: CrewRole;
  /** Operator: the output bonus share (0–20%). */
  skill: number;
  fee: number;
  wage: number;
  /** An operator's post, or null. */
  post: { home: HomeId; op: OpId } | null;
  /** In-game minute the wage first went unpaid, or null when paid up. */
  unpaidSince: number | null;
}

export interface CrewState {
  members: CrewMember[];
  /** Who's at the bar today, and which day that was rolled for. */
  candidates: CrewMember[];
  candidatesDay: number;
  nextId: number;
}

const C = () => BALANCE.property.crew;

export function createCrew(): CrewState {
  return { members: [], candidates: [], candidatesDay: -1, nextId: 1 };
}

/** The home whose crew room the crew meets in (the first with one), or null. */
export function crewHome(p: PropertyState): OwnedHome | null {
  return p.homes.find((h) => h.addons.includes('crewRoom')) ?? null;
}

const round10 = (n: number) => Math.round(n / 10) * 10;

/** Today's candidates at the bar: rolled once a day (operators until smuggling brings drivers). */
export function candidatesFor(c: CrewState, rng: Rng, day: number): CrewMember[] {
  if (c.candidatesDay === day) return c.candidates;
  const K = C();
  c.candidates = [];
  for (let k = 0; k < K.candidates; k++) {
    const role: CrewRole = 'operator';
    const skill = K.operatorSkill[0] + rng.next() * (K.operatorSkill[1] - K.operatorSkill[0]);
    const share = skill / K.operatorSkill[1];
    c.candidates.push({
      id: c.nextId++,
      name: `${rng.pick(CREW_FIRST)} "${rng.pick(CREW_NICK)}"`,
      face: rng.int(0, CREW_FACES - 1),
      role,
      skill: Math.round(skill * 100) / 100,
      // the better ones cost more
      fee: round10(K.hireFee[0] + (K.hireFee[1] - K.hireFee[0]) * (0.3 * rng.next() + 0.7 * share)),
      wage: round10(K.wage[0] + (K.wage[1] - K.wage[0]) * (0.3 * rng.next() + 0.7 * share)),
      post: null,
      unpaidSince: null,
    });
  }
  c.candidatesDay = day;
  return c.candidates;
}

export type HireBlock = 'room' | 'tier' | 'cap' | 'money';

export function hireBlock(p: PropertyState, m: Money, who: CrewMember, repTier: number): HireBlock | null {
  const h = crewHome(p);
  if (!h) return 'room';
  if (repTier < C().tier) return 'tier';
  if (p.crew.members.length >= C().cap) return 'cap';
  if (m.dirty + h.stash.dirty < who.fee) return 'money';
  return null;
}

/** Hire a candidate: the fee in dirty cash, carried first, then the crew room home's stash. */
export function hire(p: PropertyState, m: Money, id: number, repTier: number): boolean {
  const who = p.crew.candidates.find((q) => q.id === id);
  if (!who || hireBlock(p, m, who, repTier)) return false;
  const h = crewHome(p) as OwnedHome;
  const carried = Math.min(m.dirty, who.fee);
  m.dirty -= carried;
  h.stash.dirty -= who.fee - carried;
  p.crew.candidates = p.crew.candidates.filter((q) => q !== who);
  p.crew.members.push(who);
  return true;
}

export function fire(p: PropertyState, id: number): void {
  p.crew.members = p.crew.members.filter((q) => q.id !== id);
}

/** Post an operator to an operation (one operator each), or take them off it (op null). */
export function assign(p: PropertyState, id: number, post: { home: HomeId; op: OpId } | null): boolean {
  const who = p.crew.members.find((q) => q.id === id);
  if (!who || who.role !== 'operator') return false;
  if (post) {
    const h = p.homes.find((q) => q.id === post.home);
    if (!h?.addons.includes(post.op)) return false;
    for (const q of p.crew.members)
      if (q.post && q.post.home === post.home && q.post.op === post.op) q.post = null;
  }
  who.post = post;
  return true;
}

export function operatorAt(p: PropertyState, home: HomeId, op: OpId): CrewMember | null {
  return p.crew.members.find((q) => q.post?.home === home && q.post.op === op) ?? null;
}

export interface CrewEvent {
  who: string;
  text: string;
}

/** Monday 06:00: the week's wages from the crew room home's stash; unpaid ones start counting. */
export function payWages(p: PropertyState, at: number): CrewEvent[] {
  const out: CrewEvent[] = [];
  const h = crewHome(p);
  for (const q of p.crew.members) {
    if (h && h.stash.dirty >= q.wage) {
      h.stash.dirty -= q.wage;
      q.unpaidSince = null;
    } else {
      q.unpaidSince ??= at;
      out.push({ who: q.name, text: `WHERE'S MY $${q.wage}? PUT IT IN THE STASH.` });
    }
  }
  return out;
}

/** Every morning: whoever has gone unpaid for 3 days walks. */
export function quitters(p: PropertyState, at: number): CrewEvent[] {
  const out: CrewEvent[] = [];
  const limit = C().quitDays * 1440;
  for (const q of [...p.crew.members]) {
    if (q.unpaidSince === null || at - q.unpaidSince < limit) continue;
    fire(p, q.id);
    out.push({ who: q.name, text: 'NO PAY, NO WORK. I QUIT.' });
  }
  return out;
}

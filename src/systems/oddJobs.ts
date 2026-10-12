// Weekend odd jobs (docs/02, docs/03): a car wash gig and a bar shift, Saturday and Sunday only, open to everyone.
// A gig is a few tasks (cars or rushes at the counter); at the end it pays 60% of the shift pay of your current
// job's rank, plus tips by how well it went. No promotion XP. Pure functions over a plain state object so they can
// be tested and saved.

import { BALANCE } from '../config/balance';
import { BALANCE_ODD } from '../config/balanceOdd';
import { GIG_IDS, type GigId } from '../data/oddJobs';
import type { Grade } from './career';
import { calendar } from './clock';

const GRADE_SCORE: Record<Grade, number> = { fail: 0, poor: 0, ok: 1, good: 2, excellent: 3 };

export interface Gig {
  id: GigId;
  /** Day number (1-based) the gig belongs to. */
  day: number;
  grades: Grade[];
  tasks: number;
}

export interface OddJobState {
  gig: Gig | null;
  /** Last day each gig was finished, so each can be worked once a day. */
  lastDay: Record<GigId, number>;
}

export function createOddJobs(): OddJobState {
  return { gig: null, lastDay: { carWash: 0, barShift: 0 } };
}

export type GigStartResult =
  { ok: true } | { ok: false; reason: 'weekday' | 'early' | 'tooLate' | 'alreadyWorked' | 'onGig' };

export function canStartGig(o: OddJobState, id: GigId, minutes: number): GigStartResult {
  const H = BALANCE_ODD.gigs[id];
  const cal = calendar(minutes);
  if (o.gig) return { ok: false, reason: 'onGig' };
  if (o.lastDay[id] === cal.day) return { ok: false, reason: 'alreadyWorked' };
  if (!BALANCE_ODD.days.includes((cal.day - 1) % 7)) return { ok: false, reason: 'weekday' };
  if (cal.minute < H.from) return { ok: false, reason: 'early' };
  if (cal.minute >= H.until) return { ok: false, reason: 'tooLate' };
  return { ok: true };
}

export function startGig(o: OddJobState, id: GigId, minutes: number): GigStartResult {
  const r = canStartGig(o, id, minutes);
  if (r.ok) o.gig = { id, day: calendar(minutes).day, grades: [], tasks: BALANCE_ODD.gigs[id].tasks };
  return r;
}

export function gigTasksLeft(o: OddJobState): number {
  return o.gig ? Math.max(0, o.gig.tasks - o.gig.grades.length) : 0;
}

/** Record a finished task. Returns false when not on a gig or its tasks are already done. */
export function recordGigTask(o: OddJobState, grade: Grade): boolean {
  if (!o.gig || gigTasksLeft(o) === 0) return false;
  o.gig.grades.push(grade);
  return true;
}

/** The gig's typical grade as 0–3 (poor, OK, good, excellent): the rounded-down average, fail counted as poor. */
export function gigScore(grades: readonly Grade[]): number {
  if (grades.length === 0) return 0;
  const avg = grades.reduce((s, g) => s + GRADE_SCORE[g], 0) / grades.length;
  return Math.min(3, Math.floor(avg + 1e-9));
}

export interface GigPayout {
  /** The side-gig rate: 60% of the shift pay at the rank (clean). */
  pay: number;
  /** Tips by the typical grade (clean). */
  tips: number;
  total: number;
}

/** What a gig pays at a rank (1–5) for its task grades. Pure. */
export function gigPayout(rank: number, grades: readonly Grade[]): GigPayout {
  const P = BALANCE.careers.payByRank;
  const base = P[Math.max(0, Math.min(P.length - 1, rank - 1))] as number;
  const pay = Math.round(base * BALANCE_ODD.payShare);
  const tips = grades.length ? Math.round(pay * (BALANCE_ODD.tipShare[gigScore(grades)] as number)) : 0;
  return { pay, tips, total: pay + tips };
}

export type GigEndResult = { ok: false } | ({ ok: true; id: GigId } & GigPayout);

/** Finish the gig once its tasks are done: the payout at the rank. Returns ok false when not finished. */
export function finishGig(o: OddJobState, rank: number): GigEndResult {
  const g = o.gig;
  if (!g || gigTasksLeft(o) > 0) return { ok: false };
  o.gig = null;
  o.lastDay[g.id] = g.day;
  return { ok: true, id: g.id, ...gigPayout(rank, g.grades) };
}

/** Walk off a gig part way: nothing is paid and the gig can't be started again that day. */
export function quitGig(o: OddJobState): boolean {
  if (!o.gig) return false;
  o.lastDay[o.gig.id] = o.gig.day;
  o.gig = null;
  return true;
}

/** The gigs that can be started now (for the phone's job list). */
export function openGigs(o: OddJobState, minutes: number): GigId[] {
  return GIG_IDS.filter((id) => canStartGig(o, id, minutes).ok);
}

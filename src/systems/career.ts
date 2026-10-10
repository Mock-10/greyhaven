// Careers (docs/03): clocking in, shift tasks, pay, promotion XP and ranks. Pure functions over plain
// state objects so they can be tested and saved.

import { BALANCE } from '../config/balance';
import { JOBS, type JobId, type TaskId } from '../data/jobs';
import { calendar } from './clock';

/** Minigame grades (docs/06). Fail counts as Poor for a job task. */
export type Grade = 'fail' | 'poor' | 'ok' | 'good' | 'excellent';
const GRADE_SCORE: Record<Grade, number> = { fail: 0, poor: 0, ok: 1, good: 2, excellent: 3 };

export interface Shift {
  job: JobId;
  /** Day number (1-based) the shift belongs to. */
  day: number;
  late: boolean;
  grades: Grade[];
}

export interface CareerState {
  current: JobId;
  /** Rank (1–5) and XP toward the next rank, per job; kept when switching jobs. */
  jobs: Record<JobId, { rank: number; xp: number }>;
  shift: Shift | null;
  /** Last day a shift was completed, so a job can't be worked twice in one day. */
  lastShiftDay: number;
}

export function createCareer(): CareerState {
  return { current: 'office', jobs: { office: { rank: 1, xp: 0 } }, shift: null, lastShiftDay: 0 };
}

export type ClockInResult =
  | { ok: true; late: boolean }
  | { ok: false; reason: 'weekend' | 'early' | 'tooLate' | 'alreadyWorked' | 'onShift' };

export function canClockIn(c: CareerState, minutes: number): ClockInResult {
  const B = BALANCE.careers;
  const cal = calendar(minutes);
  if (c.shift) return { ok: false, reason: 'onShift' };
  if (c.lastShiftDay === cal.day) return { ok: false, reason: 'alreadyWorked' };
  if (!B.workdays.includes((cal.day - 1) % 7)) return { ok: false, reason: 'weekend' };
  if (cal.minute < B.clockInFrom) return { ok: false, reason: 'early' };
  if (cal.minute >= B.clockInUntil) return { ok: false, reason: 'tooLate' };
  return { ok: true, late: cal.minute >= B.lateAfter };
}

export function clockIn(c: CareerState, minutes: number): ClockInResult {
  const r = canClockIn(c, minutes);
  if (r.ok) c.shift = { job: c.current, day: calendar(minutes).day, late: r.late, grades: [] };
  return r;
}

export function tasksLeft(c: CareerState): number {
  if (!c.shift) return 0;
  return Math.max(0, JOBS[c.shift.job].tasksPerShift - c.shift.grades.length);
}

/** Record a finished task. Returns false when not on shift or the shift's tasks are already done. */
export function recordTask(c: CareerState, _task: TaskId, grade: Grade): boolean {
  if (!c.shift || tasksLeft(c) === 0) return false;
  c.shift.grades.push(grade);
  return true;
}

/** XP for a shift by its typical grade: the rounded-down average of its task grades (docs/03 table). */
export function shiftXp(grades: readonly Grade[]): number {
  if (grades.length === 0) return 0;
  const avg = grades.reduce((s, g) => s + GRADE_SCORE[g], 0) / grades.length;
  return BALANCE.careers.shiftXp[Math.min(3, Math.floor(avg + 1e-9))] as number;
}

export function payFor(rank: number, late: boolean): number {
  const base = BALANCE.careers.payByRank[rank - 1] as number;
  return Math.round(base * (late ? BALANCE.careers.lateMultiplier : 1));
}

export interface ShiftResult {
  pay: number;
  xp: number;
  promoted: boolean;
  newRank: number;
  bonus: number;
}

/** Clock out after all tasks: pay, XP and any promotion (XP over the threshold carries over). */
export function clockOut(c: CareerState): ShiftResult | null {
  const s = c.shift;
  if (!s || tasksLeft(c) > 0) return null;
  const B = BALANCE.careers;
  const job = c.jobs[s.job];
  const pay = payFor(job.rank, s.late);
  const xp = shiftXp(s.grades);
  job.xp += xp;
  let promoted = false;
  let bonus = 0;
  while (job.rank < 5 && job.xp >= (B.xpToNext[job.rank - 1] as number)) {
    job.xp -= B.xpToNext[job.rank - 1] as number;
    bonus += B.promotionBonus[job.rank - 1] as number;
    job.rank += 1;
    promoted = true;
  }
  c.lastShiftDay = s.day;
  c.shift = null;
  return { pay, xp, promoted, newRank: job.rank, bonus };
}

export function rankTitle(c: CareerState, job: JobId = c.current): string {
  return JOBS[job].ranks[c.jobs[job].rank - 1] as string;
}

export function hasKeyCard(c: CareerState): boolean {
  return c.jobs.office.rank >= BALANCE.careers.keyCardRank;
}

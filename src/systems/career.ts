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
  /** Tasks this shift needs (one more during the extra-work days after an arrest). */
  tasks: number;
}

export interface CareerState {
  current: JobId;
  /** Rank (1–5) and XP toward the next rank, per job; kept when switching jobs. */
  jobs: Record<JobId, { rank: number; xp: number }>;
  shift: Shift | null;
  /** Last day a shift was completed, so a job can't be worked twice in one day. */
  lastShiftDay: number;
  /** Arrest effects (docs/03), as in-game minutes: no promotion XP before `freezeUntil`; an extra task and a
   *  higher XP bar before `extraUntil`. */
  freezeUntil: number;
  extraUntil: number;
  /** Days of missed shifts that HR hasn't covered yet. */
  missed: number[];
  /** This week's job pay and whether the week had an arrest (the clean-record bonus). */
  week: { pay: number; offense: boolean };
}

export function createCareer(): CareerState {
  return {
    current: 'office',
    jobs: {
      office: { rank: 1, xp: 0 },
      mechanic: { rank: 1, xp: 0 },
      lumberjack: { rank: 1, xp: 0 },
      delivery: { rank: 1, xp: 0 },
    },
    shift: null,
    lastShiftDay: 0,
    freezeUntil: 0,
    extraUntil: 0,
    missed: [],
    week: { pay: 0, offense: false },
  };
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
  if (r.ok) {
    const extra = minutes < c.extraUntil ? BALANCE.careers.extraTasks : 0;
    c.shift = {
      job: c.current,
      day: calendar(minutes).day,
      late: r.late,
      grades: [],
      tasks: JOBS[c.current].tasksPerShift + extra,
    };
  }
  return r;
}

export function tasksLeft(c: CareerState): number {
  if (!c.shift) return 0;
  return Math.max(0, c.shift.tasks - c.shift.grades.length);
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
  /** The promotion freeze after an arrest swallowed the XP. */
  frozen: boolean;
}

/** XP needed for the next rank, 10% more during the extra-work days after an arrest (docs/03). */
export function xpNeeded(c: CareerState, rank: number, now: number): number {
  const base = BALANCE.careers.xpToNext[rank - 1] as number;
  return now < c.extraUntil ? Math.ceil(base * BALANCE.careers.extraXpFactor) : base;
}

/** Clock out after all tasks: pay, XP and any promotion (XP over the threshold carries over). */
export function clockOut(c: CareerState, now: number): ShiftResult | null {
  const s = c.shift;
  if (!s || tasksLeft(c) > 0) return null;
  const B = BALANCE.careers;
  const job = c.jobs[s.job];
  const pay = payFor(job.rank, s.late);
  const frozen = now < c.freezeUntil;
  const xp = frozen ? 0 : shiftXp(s.grades);
  job.xp += xp;
  c.week.pay += pay;
  let promoted = false;
  let bonus = 0;
  while (job.rank < 5 && job.xp >= xpNeeded(c, job.rank, now)) {
    job.xp -= xpNeeded(c, job.rank, now);
    bonus += B.promotionBonus[job.rank - 1] as number;
    job.rank += 1;
    promoted = true;
  }
  c.lastShiftDay = s.day;
  c.shift = null;
  return { pay, xp, promoted, newRank: job.rank, bonus, frozen };
}

/** Is `day` (1-based) a workday? */
export function isWorkday(day: number): boolean {
  return BALANCE.careers.workdays.includes((day - 1) % 7);
}

/**
 * The clock-in window closed on a workday (10:00): if no shift was worked or started, it's a missed shift — no pay,
 * −5 promotion XP (never below 0, never a demotion). Returns true when a shift was missed.
 */
export function checkMissed(c: CareerState, day: number): boolean {
  const B = BALANCE.careers;
  if (day < B.missedFromDay || !isWorkday(day)) return false;
  if (c.lastShiftDay === day || c.shift?.day === day) return false;
  const job = c.jobs[c.current];
  job.xp = Math.max(0, job.xp - B.missedXp);
  c.missed.push(day);
  return true;
}

/** Missed shifts HR can still cover (the last `hrCoverWindowDays` days). */
export function coverable(c: CareerState, today: number): number[] {
  return c.missed.filter((d) => today - d < BALANCE.careers.hrCoverWindowDays);
}

/** HR covers the oldest coverable missed shift: the XP penalty is returned (docs/02 HR bribe). */
export function coverShift(c: CareerState, today: number): boolean {
  const d = coverable(c, today)[0];
  if (d === undefined) return false;
  c.missed.splice(c.missed.indexOf(d), 1);
  const job = c.jobs[c.current];
  job.xp += BALANCE.careers.missedXp;
  return true;
}

export function frozen(c: CareerState, now: number): boolean {
  return now < c.freezeUntil;
}

/**
 * An arrest (docs/03): a 3-day promotion freeze from the arrest, extra work until the end of the second day after
 * release, no clean-record bonus this week, and any shift in progress is lost.
 */
export function arrestEffects(c: CareerState, arrestedAt: number, releasedAt: number): void {
  const B = BALANCE.careers;
  c.freezeUntil = Math.max(c.freezeUntil, arrestedAt + B.freezeDays * 1440);
  c.extraUntil = Math.max(c.extraUntil, (Math.floor(releasedAt / 1440) + B.extraDays) * 1440);
  c.week.offense = true;
  c.shift = null;
}

/** Monday 06:00: the clean-record bonus for the week just ended (0 after an arrest), then a new week starts. */
export function closeWeek(c: CareerState): number {
  const bonus = c.week.offense ? 0 : Math.round(c.week.pay * BALANCE.careers.cleanRecordShare);
  c.week = { pay: 0, offense: false };
  return bonus;
}

export function rankTitle(c: CareerState, job: JobId = c.current): string {
  return JOBS[job].ranks[c.jobs[job].rank - 1] as string;
}

export function hasKeyCard(c: CareerState): boolean {
  return c.jobs.office.rank >= BALANCE.careers.keyCardRank;
}

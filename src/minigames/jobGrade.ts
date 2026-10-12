// Shared grading for the M7 job minigames (docs/06: Fail, Poor, OK, Good, Excellent; docs/03: a job counts Fail as
// Poor). Kept apart from logic.ts so the job tasks can be built and tested on their own.

import { BALANCE_JOBS } from '../config/balanceJobs';
import type { Grade } from '../systems/career';

/** Grade a score given as a share of a perfect run (0–1). */
export function scoreGrade(ratio: number): Grade {
  const G = BALANCE_JOBS.grades;
  if (ratio >= G.excellent) return 'excellent';
  if (ratio >= G.good) return 'good';
  if (ratio >= G.ok) return 'ok';
  if (ratio >= G.poor) return 'poor';
  return 'fail';
}

/** Grade a run of answers: all right is excellent with time to spare, else good; two thirds or more OK; any poor. */
export function shareGrade(right: number, total: number, spare: boolean): Grade {
  const r = total ? right / total : 0;
  if (r >= 1) return spare ? 'excellent' : 'good';
  if (r >= 2 / 3 - 1e-9) return 'ok';
  if (r > 0) return 'poor';
  return 'fail';
}

/** The core-skill-check tier a job task uses at a rank (1–5). */
export function jobTier(rank: number): number {
  const T = BALANCE_JOBS.tierByRank;
  return T[Math.max(0, Math.min(T.length - 1, rank - 1))] as number;
}

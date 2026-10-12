// ATM robbery (docs/04: tier 2, ATM hack (memory) or drill (hold), $800–1,500, 2★ or 3★ downtown; docs/10: the
// ATM drill is sold by the fence at Known, $900). Pure code: the scene runs the minigame and the witnesses.
//
// - Hack: silent. A failed hack trips the ATM's alarm, which calls the police.
// - Drill: needs the drill tool. Loud: witnesses hear it from further away than they can see. Each use wears it.
// Every ATM has a camera (docs/05): unmasked, the player is identified. An emptied ATM waits for a refill.

import { BALANCE_CRIME } from '../config/balanceCrime';
import type { Rng } from '../core/rng';
import type { Grade } from './career';
import { hasService, identifiedBy, type CrimeReport, type Footage } from './reputation';

const A = () => BALANCE_CRIME.atm;

export type AtmMethod = 'hack' | 'drill';

/** Stars when an ATM robbery is reported (docs/04: 3★ downtown). */
export function atmStars(downtown: boolean): number {
  return downtown ? A().downtownStars : A().stars;
}

/** Can this ATM be robbed now? `robbedAt` is the in-game minute it was last emptied. */
export function atmReady(robbedAt: number | null | undefined, now: number): boolean {
  return robbedAt === null || robbedAt === undefined || now - robbedAt >= A().refillMinutes;
}

/** Which methods the player has: the hack always; the drill with uses left on one in the bag. */
export function atmMethods(drillUses: number): AtmMethod[] {
  return drillUses > 0 ? ['hack', 'drill'] : ['hack'];
}

/** The fence sells the drill from Known (docs/10). */
export function canBuyDrill(rep: number): boolean {
  return hasService(rep, 'atmDrill');
}

export interface AtmResult {
  cash: number;
  /** Reports that go to the police whether or not anyone saw it (the ATM's alarm). */
  reports: CrimeReport[];
  /** Stars a witness or officer who sees (or hears) it will report. */
  stars: number;
  /** How far witnesses notice it, in tiles: 0 means only by sight. */
  noiseTiles: number;
  identified: boolean;
  /** Drill uses left after this job (unchanged for a hack). */
  drillUses: number;
}

/**
 * Rob an ATM with the given method and minigame grade. Rolls the cassette ($800–1,500) and pays the grade's share
 * as dirty cash. A failed hack trips the alarm; the drill always makes noise and wears down (a fail costs 2 uses,
 * docs/06). The camera identifies an unmasked player (or one in uniform).
 */
export function robAtm(
  rng: Rng,
  method: AtmMethod,
  grade: Grade,
  money: { dirty: number },
  opts: { downtown: boolean; masked: boolean; uniform?: boolean; drillUses?: number },
): AtmResult {
  const stars = atmStars(opts.downtown);
  let drillUses = opts.drillUses ?? 0;
  const footage: Footage = { recording: true, unmaskedOnTape: !opts.masked, wiped: false };
  const identified = identifiedBy(footage, opts.uniform ?? false);
  if (method === 'drill' && drillUses <= 0) {
    return { cash: 0, reports: [], stars, noiseTiles: 0, identified: false, drillUses };
  }
  const cash = Math.round(rng.int(A().cash[0], A().cash[1]) * A().grabShare[grade]);
  money.dirty += cash;
  const reports: CrimeReport[] = [];
  if (method === 'hack' && grade === 'fail') reports.push({ key: 'atm', stars });
  if (method === 'drill') drillUses = Math.max(0, drillUses - (grade === 'fail' ? 2 : 1));
  return {
    cash,
    reports,
    stars,
    noiseTiles: method === 'drill' ? A().drillNoiseTiles : 0,
    identified,
    drillUses,
  };
}

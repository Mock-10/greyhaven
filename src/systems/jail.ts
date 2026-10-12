// Arrest, bribes, jail and seizure (docs/05 "Arrest", docs/02 "Fines and bribes"). An arrest runs in three steps:
// `sentence` works out what the court hands down, the jail screen offers the lawyer and judge bribes, and `book`
// moves the money, seizes what a repeat offense loses and says when the player walks out. The on-scene phone bribe
// (1–3★) clears a chase before it gets that far. Pure code; replaces wanted.arrest once the world switches over.

import { BALANCE } from '../config/balance';
import { BALANCE_POLICE } from '../config/balancePolice';
import type { ChaseState } from './response';
import { emptyWanted, type WantedState } from './wanted';

const B = () => BALANCE_POLICE.bribes;
const J = () => BALANCE_POLICE.jail;
const W = () => BALANCE.wanted;

export interface BribeResult {
  ok: boolean;
  text: string;
}

// ---- before the arrest ----

/** The "Surrender? [Y]" prompt: at 2★ and below, and whenever the player is cornered (docs/05). */
export function canSurrender(stars: number, cornered: boolean): boolean {
  return stars > 0 && (cornered || stars <= J().surrenderUpTo);
}

/** The on-scene police bribe for this star level, in dirty cash, or null when none is offered (4–5★). */
export function onScenePrice(stars: number): number | null {
  if (stars <= 0) return null;
  return B().onScene[Math.min(stars, W().maxStars) - 1] ?? null;
}

/** Bribe an officer on the phone (docs/05): 1–3★ clear at once for the tier's price, once per chase. */
export function bribeOnScene(chase: ChaseState, w: WantedState, money: { dirty: number }): BribeResult {
  const price = onScenePrice(w.stars);
  if (price === null)
    return { ok: false, text: w.stars > 0 ? 'NOBODY WILL TAKE IT AT THIS LEVEL' : 'NOT WANTED' };
  if (chase.bribe) return { ok: false, text: 'ALREADY TRIED THAT THIS CHASE' };
  if (money.dirty < price) return { ok: false, text: 'NOT ENOUGH DIRTY CASH' };
  money.dirty -= price;
  chase.bribe = true;
  Object.assign(w, emptyWanted());
  return { ok: true, text: `PAID $${price}. THE CALL GOT LOST.` };
}

// ---- the sentence ----

/** An arrest in the last 14 in-game days makes this one a repeat offense (docs/05). */
export function isRepeat(record: { arrests: readonly number[] }, now: number): boolean {
  const window = W().recordDays * 24 * 60;
  return record.arrests.some((m) => now - m < window);
}

export interface Sentence {
  stars: number;
  repeat: boolean;
  surrendered: boolean;
  /** Clean-cash fine (−30% when surrendered). */
  fine: number;
  /** Jail days (repeat offenses only; −1 when surrendered, −1 with a lawyer, 0 after the judge). */
  jailDays: number;
  lawyer: boolean;
  judge: boolean;
}

/** What the court hands down for an arrest at `stars` (docs/05, docs/02 table). Moves nothing. */
export function sentence(
  record: { arrests: readonly number[] },
  stars: number,
  now: number,
  surrendered: boolean,
): Sentence {
  const k = Math.max(1, Math.min(stars, W().maxStars)) - 1;
  const repeat = isRepeat(record, now);
  const fine = Math.round((W().fines[k] as number) * (surrendered ? 1 - W().surrenderFineCut : 1));
  const jailDays = repeat ? Math.max(0, (W().jailDays[k] as number) - (surrendered ? 1 : 0)) : 0;
  return { stars: k + 1, repeat, surrendered, fine, jailDays, lawyer: false, judge: false };
}

// ---- the jail screen ----

/** The lawyer is offered while there is jail time to cut. */
export function lawyerOffered(s: Sentence): boolean {
  return s.jailDays > 0 && !s.lawyer && !s.judge;
}

/** The judge is offered while there is jail time, to Connected (rep tier 3) and above (docs/02, docs/10). */
export function judgeOffered(s: Sentence, repTier: number): boolean {
  return s.jailDays > 0 && !s.judge && repTier >= B().judgeTier;
}

/** Hire a lawyer: $1,500 clean from the bank, carried clean cash covering any shortfall; −1 jail day. */
export function hireLawyer(s: Sentence, money: { clean: number; bank: number }): BribeResult {
  if (!lawyerOffered(s)) return { ok: false, text: 'NO JAIL TIME TO CUT' };
  const price = B().lawyer;
  if (money.bank + money.clean < price) return { ok: false, text: 'NOT ENOUGH CLEAN MONEY' };
  const fromBank = Math.min(money.bank, price);
  money.bank -= fromBank;
  money.clean -= price - fromBank;
  s.lawyer = true;
  s.jailDays = Math.max(0, s.jailDays - B().lawyerDays);
  return { ok: true, text: `LAWYER PAID $${price}. ONE DAY LESS.` };
}

/** Bribe the judge: $5,000 dirty from carried cash (before the seizure); the jail time is dropped. */
export function bribeJudge(s: Sentence, money: { dirty: number }, repTier: number): BribeResult {
  if (!judgeOffered(s, repTier))
    return { ok: false, text: s.jailDays > 0 ? 'THE JUDGE DOES NOT KNOW YOU' : 'NO JAIL TIME TO DROP' };
  const price = B().judge;
  if (money.dirty < price) return { ok: false, text: 'NOT ENOUGH DIRTY CASH' };
  money.dirty -= price;
  s.judge = true;
  s.jailDays = 0;
  return { ok: true, text: `THE JUDGE TOOK $${price}. A FINE INSTEAD.` };
}

// ---- booking ----

export interface Booking {
  /** What was actually paid of the fine (fines take carried clean cash only, docs/02). */
  paid: number;
  /** Carried dirty cash seized (repeat offenses only). */
  seizedCash: number;
  /** Illegal items seized, by kind (product, unregistered weapons): what the precinct lockers hold. */
  seizedItems: Record<string, number>;
  jailDays: number;
  /** In-game minute the player walks out of Precinct 1. */
  releaseAt: number;
}

/**
 * Book the arrest: pay what can be paid of the fine from carried clean cash, and on a repeat offense seize all
 * carried dirty cash and every illegal item in `illegal` (its counts are zeroed; the hideout stash is never passed
 * in, so it stays safe). Records the arrest. A first offense walks out an hour later; jail ends at 06:00 after the
 * jail days. A repeat offense still seizes after the judge: the judge changes the sentence, not the booking.
 */
export function book(
  s: Sentence,
  money: { clean: number; dirty: number },
  record: { arrests: number[] },
  illegal: Record<string, number>,
  now: number,
): Booking {
  const paid = Math.min(s.fine, Math.max(0, money.clean));
  money.clean -= paid;
  let seizedCash = 0;
  const seizedItems: Record<string, number> = {};
  if (s.repeat) {
    seizedCash = Math.max(0, money.dirty);
    money.dirty -= seizedCash;
    for (const [k, n] of Object.entries(illegal)) {
      if (n > 0) seizedItems[k] = n;
      illegal[k] = 0;
    }
  }
  record.arrests.push(now);
  return { paid, seizedCash, seizedItems, jailDays: s.jailDays, releaseAt: releaseAt(now, s.jailDays) };
}

/** First offense: an hour after the arrest. Jail: 06:00 on the day the jail days run out. */
export function releaseAt(now: number, jailDays: number): number {
  if (jailDays <= 0) return now + J().firstOffenseMinutes;
  return (Math.floor(now / 1440) + jailDays) * 1440 + J().releaseMinute;
}

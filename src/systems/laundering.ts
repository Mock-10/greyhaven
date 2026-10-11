// Laundering with Dez (docs/02): a 35% cut, a $1,500 daily cap, and a money count whose grade adds to the cut
// (docs/06 "Money count": miscounts cost a %). Pure code.

import { BALANCE } from '../config/balance';
import type { Grade } from './career';

/** Dirty dollars washed on a given in-game day. */
export interface LaunderLog {
  day: number;
  amount: number;
}

/** How much more Dez takes today. */
export function capLeft(log: LaunderLog, day: number): number {
  return Math.max(0, BALANCE.laundering.dailyCap - (log.day === day ? log.amount : 0));
}

/** The cut for a money-count grade. */
export function cutFor(grade: Grade): number {
  return BALANCE.laundering.cut + BALANCE.laundering.miscountCut[grade];
}

/**
 * Wash as much dirty cash as today's cap allows. Moves the money and updates the log; returns what was washed
 * and what came back clean.
 */
export function launder(
  money: { clean: number; dirty: number },
  log: LaunderLog,
  day: number,
  grade: Grade,
): { washed: number; paid: number; cut: number } {
  const washed = Math.min(money.dirty, capLeft(log, day));
  const cut = cutFor(grade);
  const paid = Math.floor(washed * (1 - cut));
  money.dirty -= washed;
  money.clean += paid;
  if (log.day !== day) {
    log.day = day;
    log.amount = 0;
  }
  log.amount += washed;
  return { washed, paid, cut };
}

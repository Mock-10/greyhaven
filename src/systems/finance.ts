// Money that isn't in your pocket (docs/02, decided 2026-10-11): the bank account, the statement, and rent on the
// starter apartment. Pure code over plain state objects, so it saves and tests simply.
// Clean cash is either carried or banked. Pay goes to the bank; ATMs move clean cash in and out; dirty cash
// never enters the bank. Rent is taken from the bank on Monday 06:00; late fees build daily, and two missed weeks
// mean eviction (the shelter still lets you sleep and save).

import { BALANCE } from '../config/balance';

export interface Money {
  /** Carried clean cash: shops take it; death and arrest touch only carried cash. */
  clean: number;
  dirty: number;
  bank: number;
}

export interface LedgerEntry {
  /** In-game minute. */
  at: number;
  text: string;
  /** Signed change to the bank balance. */
  amount: number;
}

export interface RentState {
  /** Unpaid rent and late fees. */
  owed: number;
  /** In-game minute the oldest unpaid rent fell due, or null when paid up. */
  unpaidSince: number | null;
  evicted: boolean;
  /** Belongings are in city storage (the fee is paid on moving back in). */
  storage: boolean;
}

export interface Finance {
  ledger: LedgerEntry[];
  rent: RentState;
}

export function createFinance(): Finance {
  return { ledger: [], rent: { owed: 0, unpaidSince: null, evicted: false, storage: false } };
}

/** Add a statement line (newest first, capped). */
export function record(f: Finance, at: number, text: string, amount: number): void {
  f.ledger.unshift({ at, text, amount });
  f.ledger.length = Math.min(f.ledger.length, BALANCE.economy.ledgerSize);
}

/** Pay into the bank (wages, bonuses). */
export function credit(m: Money, f: Finance, at: number, text: string, amount: number): void {
  if (amount <= 0) return;
  m.bank += amount;
  record(f, at, text, amount);
}

/** Take from the bank if it covers the whole amount. */
export function debit(m: Money, f: Finance, at: number, text: string, amount: number): boolean {
  if (amount > m.bank) return false;
  m.bank -= amount;
  record(f, at, text, -amount);
  return true;
}

/** ATM deposit: carried clean cash into the bank. Returns the amount moved. */
export function deposit(m: Money, f: Finance, at: number, amount: number): number {
  const n = Math.max(0, Math.min(Math.floor(amount), m.clean));
  if (n === 0) return 0;
  m.clean -= n;
  m.bank += n;
  record(f, at, 'ATM DEPOSIT', n);
  return n;
}

/** ATM withdrawal: only whole amounts the bank can cover. Returns the amount moved. */
export function withdraw(m: Money, f: Finance, at: number, amount: number): number {
  const n = Math.floor(amount);
  if (n <= 0 || n > m.bank) return 0;
  m.bank -= n;
  m.clean += n;
  record(f, at, 'ATM WITHDRAWAL', -n);
  return n;
}

export type RentEvent =
  | { kind: 'paid'; amount: number }
  | { kind: 'missed'; owed: number }
  | { kind: 'late'; owed: number; daysLeft: number }
  | { kind: 'evicted' };

/** Try to clear the whole debt from the bank. */
export function payOwed(m: Money, f: Finance, at: number): boolean {
  const r = f.rent;
  if (r.owed <= 0) return true;
  if (!debit(m, f, at, 'RENT, DRIZZLE ROW 4B', r.owed)) return false;
  r.owed = 0;
  r.unpaidSince = null;
  return true;
}

/** Monday 06:00: this week's rent falls due and is taken from the bank if it covers everything owed. */
export function rentDue(m: Money, f: Finance, at: number): RentEvent | null {
  const r = f.rent;
  if (r.evicted) return null;
  r.owed += BALANCE.rent.weekly;
  if (r.unpaidSince === null) r.unpaidSince = at;
  const owed = r.owed;
  if (payOwed(m, f, at)) return { kind: 'paid', amount: owed };
  return { kind: 'missed', owed: r.owed };
}

/**
 * Every day at 06:00 (after any rent fell due): a late fee for each day rent stays unpaid, an automatic retry from
 * the bank, and eviction once the oldest unpaid rent is `evictDays` old.
 */
export function rentDaily(m: Money, f: Finance, at: number, dueToday: boolean): RentEvent | null {
  const R = BALANCE.rent;
  const r = f.rent;
  if (r.evicted || r.owed <= 0 || r.unpaidSince === null) return null;
  const days = Math.round((at - r.unpaidSince) / 1440);
  if (days >= R.evictDays) {
    r.evicted = true;
    r.storage = true;
    r.owed = 0;
    r.unpaidSince = null;
    return { kind: 'evicted' };
  }
  if (days > 0 && !dueToday) {
    r.owed += R.lateFeePerDay;
    if (payOwed(m, f, at)) return { kind: 'paid', amount: 0 };
    return { kind: 'late', owed: r.owed, daysLeft: R.evictDays - days };
  }
  return null;
}

/** The cost of moving back in after an eviction: a week's rent up front, plus storage if belongings are there. */
export function moveInCost(f: Finance): number {
  return BALANCE.rent.weekly + (f.rent.storage ? BALANCE.rent.storageFee : 0);
}

export function moveBackIn(m: Money, f: Finance, at: number): boolean {
  const r = f.rent;
  if (!r.evicted) return false;
  if (!debit(m, f, at, 'MOVE IN, DRIZZLE ROW 4B', moveInCost(f))) return false;
  r.evicted = false;
  r.storage = false;
  r.owed = 0;
  r.unpaidSince = null;
  return true;
}

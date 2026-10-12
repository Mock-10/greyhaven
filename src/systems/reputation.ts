// Criminal reputation (docs/04 "Criminal reputation", docs/10 Track B) and the face on file (docs/05
// "Identification and heat"). Pure code: the crime state is part of the save (docs/12 `crime`).
//
// Reputation is earned from completed crimes: payout ÷ 6 plus 20 per crime. A crime finished while wanted waits for
// the outcome: escaping (the stars clear) pays it with a 25% bonus, an arrest loses it.

import { BALANCE_CRIME } from '../config/balanceCrime';
import {
  CONTACTS,
  TIER_SERVICES,
  TIER_UP_TEXT,
  type ContactId,
  type RepTier,
  type ServiceId,
} from '../data/reputation';

export interface CrimeState {
  /** Reputation points earned so far. */
  rep: number;
  /** Payouts of crimes finished while wanted: their reputation waits for the escape or the arrest. */
  pending: number[];
  /** Crime contacts in the phone. */
  contacts: ContactId[];
  /** In-game minute until which the player is a "known face" (0 = not on file). */
  knownFaceUntil: number;
}

export function createCrime(): CrimeState {
  return { rep: 0, pending: [], contacts: contactsFor(0), knownFaceUntil: 0 };
}

const R = () => BALANCE_CRIME.reputation;

/** The tier a reputation total reaches. */
export function tierFor(rep: number): RepTier {
  let tier = 0;
  R().tiers.forEach((need, k) => {
    if (rep >= need) tier = k;
  });
  return tier as RepTier;
}

/** Progress toward the next tier, for the phone: points needed and the share done (1 at Boss). */
export function tierProgress(rep: number): { tier: RepTier; next: number | null; share: number } {
  const tier = tierFor(rep);
  const from = R().tiers[tier] ?? 0;
  const next = R().tiers[tier + 1];
  if (next === undefined) return { tier, next: null, share: 1 };
  return { tier, next, share: (rep - from) / (next - from) };
}

/** Is a service open at this reputation (docs/10)? */
export function hasService(rep: number, service: ServiceId): boolean {
  const tier = tierFor(rep);
  for (let k = 0; k <= tier; k++) if (TIER_SERVICES[k as RepTier].includes(service)) return true;
  return false;
}

/** The crime contacts open at a tier, in phone order. */
export function contactsFor(tier: RepTier): ContactId[] {
  return CONTACTS.filter((c) => c.tier <= tier).map((c) => c.id);
}

/** Reputation for one crime's payout (docs/04), before the escape bonus. */
export function repFor(payout: number): number {
  return Math.round(Math.max(0, payout) / R().payoutDivisor + R().perCrime);
}

/** What a reputation award changed: the points, the tiers either side, and any new contacts and phone text. */
export interface RepChange {
  gained: number;
  tierBefore: RepTier;
  tierAfter: RepTier;
  newContacts: ContactId[];
  /** Phone messages for each tier reached (empty when the tier didn't change). */
  messages: string[];
}

function award(c: CrimeState, points: number): RepChange {
  const tierBefore = tierFor(c.rep);
  c.rep += points;
  const tierAfter = tierFor(c.rep);
  const newContacts = contactsFor(tierAfter).filter((id) => !c.contacts.includes(id));
  c.contacts.push(...newContacts);
  const messages: string[] = [];
  for (let t = tierBefore + 1; t <= tierAfter; t++) messages.push(TIER_UP_TEXT[t as RepTier]);
  return { gained: points, tierBefore, tierAfter, newContacts, messages };
}

/**
 * A crime is done (the loot is in hand). Unwanted, the reputation comes at once; wanted, it waits for `starsCleared`
 * or `arrested`. Returns the change, or null while it waits.
 */
export function completeCrime(c: CrimeState, payout: number, wanted: boolean): RepChange | null {
  if (wanted) {
    c.pending.push(Math.max(0, payout));
    return null;
  }
  return award(c, repFor(payout));
}

/** The stars cleared: every crime waiting on this chase pays its reputation with the escape bonus. */
export function starsCleared(c: CrimeState): RepChange | null {
  if (c.pending.length === 0) return null;
  const points = c.pending.reduce((s, p) => s + Math.round(repFor(p) * (1 + R().escapeBonus)), 0);
  c.pending = [];
  return award(c, points);
}

/** Arrested: the crimes of this chase earn nothing. Returns the reputation lost. */
export function arrested(c: CrimeState): number {
  const lost = c.pending.reduce((s, p) => s + repFor(p), 0);
  c.pending = [];
  return lost;
}

/** Identified (unmasked on camera that wasn't wiped, seen by police, or in a work uniform): a known face for 2 days. */
export function markIdentified(c: CrimeState, now: number): void {
  c.knownFaceUntil = Math.max(c.knownFaceUntil, now + BALANCE_CRIME.identification.knownFaceMinutes);
}

export function isKnownFace(c: CrimeState, now: number): boolean {
  return now < c.knownFaceUntil;
}

// ---- Shared by the crime systems (robbery, burglary, ATM) ----

/**
 * A crime reaching the police. `key` names the crime within one job so the scene can give each key one crime id
 * (wanted.reportCrime: several reports of the same crime raise its stars once). Alarms report through the scene's
 * usual alarm delay (BALANCE.wanted.alarmSeconds).
 */
export interface CrimeReport {
  key: string;
  stars: number;
}

/** What a building's cameras hold (docs/05): recording stops when disabled; a wipe erases what's on the DVR. */
export interface Footage {
  recording: boolean;
  unmaskedOnTape: boolean;
  wiped: boolean;
}

export function freshFootage(hasCameras = true): Footage {
  return { recording: hasCameras, unmaskedOnTape: false, wiped: false };
}

/** The player is in front of the cameras. Unmasked on a recording camera puts their face on tape. */
export function filmed(f: Footage, masked: boolean): void {
  if (f.recording && !masked) f.unmaskedOnTape = true;
}

/** Disable cameras: they stop recording for the rest of the job. */
export function disableCameras(f: Footage): void {
  f.recording = false;
}

/** Wipe the DVR: what's on tape is gone, so this building can't identify the player (docs/05). */
export function wipeFootage(f: Footage): void {
  f.unmaskedOnTape = false;
  f.wiped = true;
}

/** Identified by this job: unmasked on tape, or wearing the work uniform with its name tag (docs/04: 100%). */
export function identifiedBy(f: Footage | null, uniform: boolean): boolean {
  return uniform || (f?.unmaskedOnTape ?? false);
}

/** Has a robbed place had time to fill up again? */
export function restocked(robbedAt: number | null | undefined, now: number, minutes: number): boolean {
  return robbedAt === null || robbedAt === undefined || now - robbedAt >= minutes;
}

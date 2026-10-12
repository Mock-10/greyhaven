// Store robbery (docs/04 "Store robbery layout"). Pure state: the scene runs the minigames and moves the player
// between the three rooms, and calls these with the grades. Every corner store has the shop floor (clerk, customers,
// cameras), a locked back room with the safe, and a security room with the CCTV desk and the DVR.
//
// Ways to play it (docs/04):
// - Smash-and-grab: intimidate, grab the register, leave. Fast, 2★, identified if unmasked on camera.
// - Clean job: cameras, register, back room. More money and no identification, but the clerk's silent alarm is a
//   risk for every second the job runs.
// - Night job: the store is closed and the register empty. Pick the back door, cut the alarm panel within 10 s,
//   then the safe and the footage. No clerk, so no report unless the alarm goes off or someone sees it.

import { BALANCE_CRIME } from '../config/balanceCrime';
import type { Rng } from '../core/rng';
import type { Grade } from './career';
import {
  disableCameras,
  filmed,
  freshFootage,
  identifiedBy,
  wipeFootage,
  type CrimeReport,
  type Footage,
} from './reputation';

export type RobberyMode = 'open' | 'night';

export interface RobberyState {
  mode: RobberyMode;
  /** Seconds since the robbery started. */
  t: number;
  /** Wearing the work uniform: identified whatever happens to the tape (docs/04). */
  uniform: boolean;
  footage: Footage;
  /** The clerk's intimidation grade (open stores), or null before it / at night. */
  nerve: Grade | null;
  /** When the clerk pressed the silent alarm (seconds into the robbery), or null. */
  alarmPressedAt: number | null;
  /** Cash still in the register and whether it's open. */
  register: number;
  registerOpen: boolean;
  /** The back-room door (the outside back door at night). */
  backDoorOpen: boolean;
  /** Cash still in the safe and whether it's open. */
  safe: number;
  safeOpen: boolean;
  /** Night job: when the alarm panel goes off unless it's cut (seconds into the robbery), and its state. */
  panelDeadline: number | null;
  panel: 'armed' | 'cut' | 'tripped' | 'none';
  /** Dirty cash taken so far. */
  take: number;
  /** Crimes already reported, by key, so each goes out once. */
  reported: string[];
  /** The player walked out. */
  done: boolean;
}

const B = () => BALANCE_CRIME.robbery;

/** Start a robbery. The register and safe are rolled now; at night the takings are in the safe, not the register. */
export function startRobbery(
  rng: Rng,
  mode: RobberyMode,
  opts: { uniform?: boolean; cameras?: boolean } = {},
): RobberyState {
  return {
    mode,
    t: 0,
    uniform: opts.uniform ?? false,
    footage: freshFootage(opts.cameras ?? true),
    nerve: null,
    alarmPressedAt: null,
    register: mode === 'open' ? rng.int(B().registerCash[0], B().registerCash[1]) : 0,
    registerOpen: false,
    backDoorOpen: false,
    safe: rng.int(B().safeCash[0], B().safeCash[1]),
    safeOpen: false,
    panelDeadline: null,
    panel: mode === 'night' ? 'armed' : 'none',
    take: 0,
    reported: [],
    done: false,
  };
}

function report(s: RobberyState, key: string, stars: number, out: CrimeReport[]): void {
  if (s.reported.includes(key)) return;
  s.reported.push(key);
  out.push({ key, stars });
}

function pressAlarm(s: RobberyState): void {
  if (s.alarmPressedAt === null) s.alarmPressedAt = s.t;
}

/**
 * Intimidate the clerk (open stores). Anything but a fail opens the register; how well it went sets the chance the
 * clerk hits the silent alarm now and for every second after. A fail means the clerk panicked and pressed it.
 * Returns true when the register opened.
 */
export function intimidate(s: RobberyState, grade: Grade, rng: Rng): boolean {
  if (s.mode !== 'open' || s.done) return false;
  s.nerve = grade;
  if (rng.chance(B().alarmOnIntimidate[grade])) pressAlarm(s);
  if (grade === 'fail') return false;
  s.registerOpen = true;
  return true;
}

/** Grab from the open register (a search grid). Moves the cash into dirty money and returns it. */
export function grabRegister(s: RobberyState, grade: Grade, money: { dirty: number }): number {
  if (!s.registerOpen || s.done) return 0;
  const cash = Math.round(s.register * B().grabShare[grade]);
  s.register -= cash;
  s.take += cash;
  money.dirty += cash;
  return cash;
}

/** The back door was picked (the lockpick minigame is the scene's). At night this arms the alarm panel's timer. */
export function openBackDoor(s: RobberyState): void {
  if (s.backDoorOpen || s.done) return;
  s.backDoorOpen = true;
  if (s.mode === 'night' && s.panel === 'armed') s.panelDeadline = s.t + B().nightPanelSeconds;
}

/** Cut the alarm panel (night job, the alarm bypass minigame). Too late or a failed bypass sets the alarm off. */
export function cutPanel(s: RobberyState, success: boolean): CrimeReport[] {
  const out: CrimeReport[] = [];
  if (s.panel !== 'armed' || s.panelDeadline === null) return out;
  if (success && s.t <= s.panelDeadline) {
    s.panel = 'cut';
    s.panelDeadline = null;
  } else tripPanel(s, out);
  return out;
}

function tripPanel(s: RobberyState, out: CrimeReport[]): void {
  s.panel = 'tripped';
  s.panelDeadline = null;
  report(s, 'robbery', B().nightAlarmStars, out);
}

/** Crack the safe in the back room. Takes the share the grade allows; a fail leaves it shut. */
export function crackSafe(s: RobberyState, grade: Grade, money: { dirty: number }): number {
  if (!s.backDoorOpen || s.done || s.safe <= 0) return 0;
  const share = B().safeShare[grade];
  if (share <= 0) return 0;
  s.safeOpen = true;
  const cash = Math.round(s.safe * share);
  s.safe -= cash;
  s.take += cash;
  money.dirty += cash;
  return cash;
}

/** The CCTV desk: disable the cameras (security guard rank 3 does it without the minigame). */
export function cctvDisable(s: RobberyState): void {
  disableCameras(s.footage);
}

/** The DVR: wipe the footage. Clears this store's identification, even if the player was unmasked. */
export function cctvWipe(s: RobberyState): void {
  wipeFootage(s.footage);
}

/** The player is on the shop floor in front of the cameras this step. */
export function onShopFloor(s: RobberyState, masked: boolean): void {
  if (!s.done) filmed(s.footage, masked);
}

/**
 * One step of the robbery clock. The clerk may press the silent alarm (more likely the worse the intimidation went);
 * 20 s after it's pressed the police get the robbery (2★) plus the alarm's +1★. At night an uncut panel goes off
 * when its 10 s run out. Returns any reports to pass to the wanted level.
 */
export function tickRobbery(s: RobberyState, dt: number, rng: Rng): CrimeReport[] {
  const out: CrimeReport[] = [];
  if (s.done) return out;
  s.t += dt;
  if (s.mode === 'open' && s.nerve !== null && s.alarmPressedAt === null) {
    if (rng.chance(1 - Math.pow(1 - B().alarmPerSecond[s.nerve], dt))) pressAlarm(s);
  }
  if (s.alarmPressedAt !== null && s.t - s.alarmPressedAt >= B().silentAlarmSeconds) {
    report(s, 'robbery', B().stars, out);
    report(s, 'silentAlarm', B().silentAlarmStars, out);
  }
  if (s.panel === 'armed' && s.panelDeadline !== null && s.t > s.panelDeadline) tripPanel(s, out);
  return out;
}

/** Seconds left on the clerk's silent alarm, for the HUD, or null when it hasn't been pressed or already went off. */
export function silentAlarmLeft(s: RobberyState): number | null {
  if (s.alarmPressedAt === null || s.reported.includes('silentAlarm')) return null;
  return Math.max(0, B().silentAlarmSeconds - (s.t - s.alarmPressedAt));
}

export interface RobberyResult {
  take: number;
  identified: boolean;
  reports: CrimeReport[];
}

/**
 * The player walks out. At an open store the clerk calls it in (2★) once anything was attempted; at night nothing is
 * reported unless the alarm went off. Identified when unmasked on tape that wasn't wiped, or in uniform.
 */
export function leaveStore(s: RobberyState): RobberyResult {
  const out: CrimeReport[] = [];
  if (!s.done) {
    s.done = true;
    if (s.mode === 'open' && (s.nerve !== null || s.take > 0)) report(s, 'robbery', B().stars, out);
  }
  return { take: s.take, identified: identifiedBy(s.footage, s.uniform), reports: out };
}

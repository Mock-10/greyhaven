// The guided first day (docs/11 "Onboarding", decisions 2026-10-11: no bus or taxi step; step 5 is trunk looting).
// Each step shows a hint on the objective strip and ends on one game event. The hints can be skipped.

export type OnboardEvent =
  | 'leftHome'
  | 'jobBoard'
  | 'clockedIn'
  | 'shiftDone'
  | 'bought'
  | 'looted'
  | 'clear'
  | 'slept';

export interface OnboardStep {
  id: string;
  /** The objective-strip hint while this step is on. */
  hint: string;
  /** The event that finishes the step. Later events also count (a player who clocks in first skips the job board). */
  until: OnboardEvent;
}

export const ONBOARD_STEPS: readonly OnboardStep[] = [
  { id: 'move', hint: 'WALK WITH W A S D, THEN HEAD OUT TO THE STREET', until: 'leftHome' },
  { id: 'job', hint: 'PRESS P: PICK A JOB ON THE JOB BOARD', until: 'jobBoard' },
  { id: 'work', hint: 'FOLLOW THE GOLD MARK TO WORK AND CLOCK IN', until: 'clockedIn' },
  { id: 'shift', hint: 'DO THE TASKS, THEN CLOCK OUT FOR YOUR PAY', until: 'shiftDone' },
  { id: 'shop', hint: 'PAY DAY: BUY SOMETHING IN A STORE WITH CLEAN CASH', until: 'bought' },
  { id: 'trunk', hint: "DEZ'S TIP: PICK THE TRUNK OF A PARKED CAR (E AT THE BACK)", until: 'looted' },
  { id: 'cops', hint: 'IF ANYONE SAW YOU, LOSE THE STARS: STAY OUT OF SIGHT', until: 'clear' },
  { id: 'sleep', hint: 'GO HOME AND SLEEP: THE GAME SAVES. RENT IS DUE EACH WEEK', until: 'slept' },
];

/** The order events happen in a normal first day, to let a later event finish earlier steps. */
export const ONBOARD_ORDER: readonly OnboardEvent[] = ONBOARD_STEPS.map((s) => s.until);

/** What Dez says when the trunk step starts (the evening tip, docs/11 step 5). */
export const DEZ_TIP = 'EASIER MONEY THAN A DESK, KID. PARKED CARS, TRUNKS FULL OF STUFF. PICK ONE. QUIETLY.';

/** The hint shown before the evening tip arrives. */
export const ONBOARD_WAIT_HINT = 'FREE TIME UNTIL THE EVENING';

/** Under the hint: how to skip the guide. */
export const ONBOARD_SKIP = 'F2: SKIP THE GUIDE';

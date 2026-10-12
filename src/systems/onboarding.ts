// The guided first day (docs/11): a step machine over plain state so it saves and tests. The world reports game
// events; the current step ends on its own event or any later one in the day's order.

import { BALANCE } from '../config/balance';
import { ONBOARD_ORDER, ONBOARD_STEPS, ONBOARD_WAIT_HINT, type OnboardEvent } from '../data/onboarding';
import { calendar } from './clock';

export interface OnboardState {
  /** Index into ONBOARD_STEPS; ONBOARD_STEPS.length when finished. */
  step: number;
  skipped: boolean;
  /** Dez's evening tip has been sent (it starts the trunk step). */
  tipSent: boolean;
}

export function createOnboarding(): OnboardState {
  return { step: 0, skipped: false, tipSent: false };
}

/** A finished guide (old saves, or a skip). */
export function finishedOnboarding(): OnboardState {
  return { step: ONBOARD_STEPS.length, skipped: false, tipSent: true };
}

export function onboardingActive(o: OnboardState): boolean {
  return !o.skipped && o.step < ONBOARD_STEPS.length;
}

export function currentStepId(o: OnboardState): string | null {
  return onboardingActive(o) ? (ONBOARD_STEPS[o.step]?.id ?? null) : null;
}

/** Report an event. Returns true when it moved the guide on. */
export function onboardEvent(o: OnboardState, ev: OnboardEvent): boolean {
  if (!onboardingActive(o)) return false;
  const at = ONBOARD_ORDER.indexOf(ev);
  if (at < o.step) return false;
  // the trunk step waits for Dez's tip; looting before it still counts once the tip is out
  if (ONBOARD_STEPS[at]?.id === 'trunk' && !o.tipSent) return false;
  o.step = at + 1;
  return true;
}

/** Whether Dez's tip is due now: the shop step is done and it is evening. Marks it sent. */
export function tipDue(o: OnboardState, minutes: number): boolean {
  if (!onboardingActive(o) || o.tipSent || currentStepId(o) !== 'trunk') return false;
  if (calendar(minutes).minute < BALANCE.onboarding.tipAt) return false;
  o.tipSent = true;
  return true;
}

/** The objective-strip hint for now, or null when the guide is off. */
export function onboardHint(o: OnboardState): string | null {
  if (!onboardingActive(o)) return null;
  const s = ONBOARD_STEPS[o.step]!;
  if (s.id === 'trunk' && !o.tipSent) return ONBOARD_WAIT_HINT;
  return s.hint;
}

export function skipOnboarding(o: OnboardState): void {
  o.skipped = true;
}

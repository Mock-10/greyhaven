import { describe, expect, it } from 'vitest';
import { ONBOARD_STEPS, ONBOARD_WAIT_HINT } from '../src/data/onboarding';
import {
  createOnboarding,
  currentStepId,
  onboardEvent,
  onboardHint,
  onboardingActive,
  skipOnboarding,
  tipDue,
} from '../src/systems/onboarding';

const at = (day: number, hh: number) => (day - 1) * 1440 + hh * 60;

describe('the guided first day (docs/11)', () => {
  it('walks the steps in order, each on its own event', () => {
    const o = createOnboarding();
    expect(currentStepId(o)).toBe('move');
    expect(onboardHint(o)).toBe(ONBOARD_STEPS[0]!.hint);
    expect(onboardEvent(o, 'bought')).toBe(true); // a later event skips ahead...
    expect(currentStepId(o)).toBe('trunk');
    expect(onboardEvent(o, 'leftHome')).toBe(false); // ...and earlier ones no longer count
  });

  it("holds the trunk step until Dez's evening tip", () => {
    const o = createOnboarding();
    for (const ev of ['leftHome', 'jobBoard', 'clockedIn', 'shiftDone', 'bought'] as const)
      onboardEvent(o, ev);
    expect(currentStepId(o)).toBe('trunk');
    expect(onboardHint(o)).toBe(ONBOARD_WAIT_HINT);
    expect(onboardEvent(o, 'looted')).toBe(false);
    expect(tipDue(o, at(1, 14))).toBe(false);
    expect(tipDue(o, at(1, 17))).toBe(true);
    expect(tipDue(o, at(1, 18))).toBe(false); // sent once
    expect(onboardEvent(o, 'looted')).toBe(true);
    expect(currentStepId(o)).toBe('cops');
    onboardEvent(o, 'clear');
    onboardEvent(o, 'slept');
    expect(onboardingActive(o)).toBe(false);
    expect(onboardHint(o)).toBeNull();
  });

  it('can be skipped', () => {
    const o = createOnboarding();
    skipOnboarding(o);
    expect(onboardingActive(o)).toBe(false);
    expect(onboardEvent(o, 'leftHome')).toBe(false);
  });
});

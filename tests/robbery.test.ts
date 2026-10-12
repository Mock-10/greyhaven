import { describe, expect, it } from 'vitest';
import { BALANCE_CRIME } from '../src/config/balanceCrime';
import { Rng } from '../src/core/rng';
import {
  cctvDisable,
  cctvWipe,
  crackSafe,
  cutPanel,
  grabRegister,
  intimidate,
  leaveStore,
  onShopFloor,
  openBackDoor,
  silentAlarmLeft,
  startRobbery,
  tickRobbery,
} from '../src/systems/robbery';
import { FixedRng } from './crimeTestUtil';

const R = BALANCE_CRIME.robbery;
/** next() = 0.99: no chance roll ever passes, so the clerk never presses the alarm on their own. */
const calm = () => new FixedRng(0.99);

describe('store robbery (docs/04)', () => {
  it('rolls the register and the safe in range; at night the register is empty', () => {
    for (let seed = 1; seed < 40; seed++) {
      const s = startRobbery(new Rng(seed), 'open');
      expect(s.register).toBeGreaterThanOrEqual(R.registerCash[0]);
      expect(s.register).toBeLessThanOrEqual(R.registerCash[1]);
      expect(s.safe).toBeGreaterThanOrEqual(R.safeCash[0]);
      expect(s.safe).toBeLessThanOrEqual(R.safeCash[1]);
      expect(startRobbery(new Rng(seed), 'night').register).toBe(0);
    }
  });

  it('smash-and-grab: intimidate, grab, leave = 2★ and identified when unmasked on camera', () => {
    const s = startRobbery(new Rng(3), 'open');
    const money = { dirty: 0 };
    onShopFloor(s, false);
    expect(intimidate(s, 'good', calm())).toBe(true);
    const cash = grabRegister(s, 'excellent', money);
    expect(cash).toBeGreaterThanOrEqual(250);
    expect(money.dirty).toBe(cash);
    const r = leaveStore(s);
    expect(r).toEqual({ take: cash, identified: true, reports: [{ key: 'robbery', stars: 2 }] });
  });

  it('grabs only part of the register on a poor grade', () => {
    const s = startRobbery(new Rng(3), 'open');
    const full = s.register;
    intimidate(s, 'excellent', calm());
    expect(grabRegister(s, 'poor', { dirty: 0 })).toBe(Math.round(full / 3));
  });

  it('a failed intimidation keeps the register shut and sets off the silent alarm', () => {
    const s = startRobbery(new Rng(3), 'open');
    expect(intimidate(s, 'fail', calm())).toBe(false);
    expect(grabRegister(s, 'excellent', { dirty: 0 })).toBe(0);
    expect(silentAlarmLeft(s)).toBe(R.silentAlarmSeconds);
  });

  it('the silent alarm reports the robbery plus 1★ after 20 s, once', () => {
    const s = startRobbery(new Rng(3), 'open');
    intimidate(s, 'fail', calm());
    expect(tickRobbery(s, 19, calm())).toEqual([]);
    const out = tickRobbery(s, 1, calm());
    expect(out).toEqual([
      { key: 'robbery', stars: 2 },
      { key: 'silentAlarm', stars: 1 },
    ]);
    expect(tickRobbery(s, 5, calm())).toEqual([]);
    expect(leaveStore(s).reports).toEqual([]);
    expect(silentAlarmLeft(s)).toBeNull();
  });

  it('a longer job is a riskier job: the clerk presses the alarm sooner or later', () => {
    const s = startRobbery(new Rng(5), 'open');
    const rng = new Rng(9);
    intimidate(s, 'good', new FixedRng(0.99));
    let pressed = false;
    for (let k = 0; k < 30 * 600 && !pressed; k++) {
      tickRobbery(s, 1 / 30, rng);
      pressed = s.alarmPressedAt !== null;
    }
    expect(pressed).toBe(true);
  });

  it('an excellent intimidation never trips the alarm at the counter', () => {
    const s = startRobbery(new Rng(5), 'open');
    intimidate(s, 'excellent', new FixedRng(0));
    expect(s.alarmPressedAt).toBeNull();
  });

  it('clean job: cameras off, register, back room safe = more money, not identified', () => {
    const s = startRobbery(new Rng(7), 'open');
    const money = { dirty: 0 };
    cctvDisable(s);
    onShopFloor(s, false);
    intimidate(s, 'excellent', calm());
    const reg = grabRegister(s, 'excellent', money);
    expect(crackSafe(s, 'good', money)).toBe(0); // the back room is still locked
    openBackDoor(s);
    const safe = crackSafe(s, 'good', money);
    expect(safe).toBeGreaterThanOrEqual(600);
    expect(crackSafe(s, 'good', money)).toBe(0); // empty now
    const r = leaveStore(s);
    expect(r.take).toBe(reg + safe);
    expect(money.dirty).toBe(reg + safe);
    expect(r.identified).toBe(false);
  });

  it('wiping the footage clears an unmasked face; the uniform still identifies', () => {
    const s = startRobbery(new Rng(7), 'open');
    onShopFloor(s, false);
    cctvWipe(s);
    expect(leaveStore(s).identified).toBe(false);
    const u = startRobbery(new Rng(7), 'open', { uniform: true });
    onShopFloor(u, true);
    expect(leaveStore(u).identified).toBe(true);
  });

  it('a failed safe crack leaves it shut', () => {
    const s = startRobbery(new Rng(7), 'open');
    openBackDoor(s);
    expect(crackSafe(s, 'fail', { dirty: 0 })).toBe(0);
    expect(s.safeOpen).toBe(false);
  });

  it('walking in and out without trying anything reports nothing', () => {
    expect(leaveStore(startRobbery(new Rng(1), 'open')).reports).toEqual([]);
  });

  describe('night job', () => {
    it('cut the panel within 10 s and nobody is called', () => {
      const s = startRobbery(new Rng(2), 'night');
      const money = { dirty: 0 };
      openBackDoor(s);
      tickRobbery(s, 8, calm());
      expect(cutPanel(s, true)).toEqual([]);
      expect(s.panel).toBe('cut');
      tickRobbery(s, 30, calm());
      crackSafe(s, 'excellent', money);
      const r = leaveStore(s);
      expect(r.reports).toEqual([]);
      expect(r.take).toBe(money.dirty);
      expect(r.take).toBeGreaterThan(0);
    });

    it('a late panel goes off: 2★', () => {
      const s = startRobbery(new Rng(2), 'night');
      openBackDoor(s);
      expect(tickRobbery(s, 10.5, calm())).toEqual([{ key: 'robbery', stars: 2 }]);
      expect(s.panel).toBe('tripped');
      expect(cutPanel(s, true)).toEqual([]);
    });

    it('a failed bypass sets it off at once', () => {
      const s = startRobbery(new Rng(2), 'night');
      openBackDoor(s);
      expect(cutPanel(s, false)).toEqual([{ key: 'robbery', stars: 2 }]);
    });

    it('there is no clerk to intimidate', () => {
      const s = startRobbery(new Rng(2), 'night');
      expect(intimidate(s, 'excellent', calm())).toBe(false);
    });
  });
});

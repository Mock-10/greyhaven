import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { Rng } from '../src/core/rng';
import { createState } from '../src/core/store';
import {
  collect,
  minutesLeft,
  nightlyRaids,
  opOf,
  runOps,
  stalled,
  startChop,
  startPress,
} from '../src/systems/operations';
import { buyAddon, buyHome, homeOf } from '../src/systems/property';

const O = BALANCE.property.ops;

function withOps() {
  const st = createState(1, 'downtown', { x: 0, y: 0 });
  st.money.bank = 200000;
  st.crime.rep = 100000;
  buyHome(st.property, st.money, st.finance, 0, 'linden10');
  const h = homeOf(st.property, 'linden10')!;
  buyAddon(h, 'press', 3, 1, st.money, st.finance, 0);
  buyAddon(h, 'chopBay', 3, 1, st.money, st.finance, 0);
  return { st, h };
}

describe('operations (docs/09)', () => {
  it('only built operations exist; built ones start stalled', () => {
    const { h } = withOps();
    expect(opOf(h, 'press')).not.toBeNull();
    expect(stalled(h)).toBe(true);
    const st2 = createState(1, 'downtown', { x: 0, y: 0 });
    st2.money.bank = 50000;
    buyHome(st2.property, st2.money, st2.finance, 0, 'linden4');
    expect(opOf(homeOf(st2.property, 'linden4')!, 'press')).toBeNull();
  });

  it('the press: $1,000 dirty supplies (carried, then the stash), $2,600 two days later, then it stalls', () => {
    const { st, h } = withOps();
    st.money.dirty = 400;
    h.stash.dirty = 500;
    expect(startPress(h, st.money, 0)).toBe(false);
    h.stash.dirty = 700;
    expect(startPress(h, st.money, 0)).toBe(true);
    expect(st.money.dirty).toBe(0);
    expect(h.stash.dirty).toBe(100);
    expect(startPress(h, st.money, 10)).toBe(false); // already running
    expect(minutesLeft(opOf(h, 'press')!, 'press', 1440)).toBe(O.press.cycleMinutes - 1440);
    expect(runOps(st.property, O.press.cycleMinutes - 1)).toEqual([]);
    const ev = runOps(st.property, O.press.cycleMinutes);
    expect(ev).toHaveLength(1);
    expect(opOf(h, 'press')!.ready).toBe(O.press.output);
    expect(collect(h, 'press', O.countBonus.excellent)).toBe(Math.round(O.press.output * 1.15));
    expect(collect(h, 'press')).toBe(0);
  });

  it('the chop bay pays 1.5x the chop price a day later', () => {
    const { st, h } = withOps();
    expect(startChop(h, 1000, 0)).toBe(true);
    runOps(st.property, O.chopBay.cycleMinutes);
    expect(collect(h, 'chopBay')).toBe(1500);
  });

  it('raids come at night only while risky, take the batch, and the stash unless there is a stash room', () => {
    const { st, h } = withOps();
    st.money.dirty = 1000;
    startPress(h, st.money, 0);
    h.stash.dirty = 5000;
    expect(nightlyRaids(st.property, 0, 30 * 1440, false, new Rng(1))).toEqual([]);
    // enough nights for a 5% chance to come up
    const ev = nightlyRaids(st.property, 0, 200 * 1440, true, new Rng(1));
    expect(ev.length).toBe(1);
    expect(opOf(h, 'press')!.since).toBeNull();
    expect(h.stash.dirty).toBe(0);
  });
});

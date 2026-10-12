import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { Rng } from '../src/core/rng';
import { createState } from '../src/core/store';
import { assign, candidatesFor, hire, hireBlock, operatorAt, payWages, quitters } from '../src/systems/crew';
import { runCalendar } from '../src/systems/days';
import { opOf, runOps, startPress } from '../src/systems/operations';
import { buyAddon, buyHome, homeOf } from '../src/systems/property';

const K = BALANCE.property.crew;
const O = BALANCE.property.ops;

function setup(crewRoom = true) {
  const st = createState(1, 'downtown', { x: 0, y: 0 });
  st.money.bank = 200000;
  buyHome(st.property, st.money, st.finance, 0, 'linden10');
  const h = homeOf(st.property, 'linden10')!;
  buyAddon(h, 'press', 3, 1, st.money, st.finance, 0);
  if (crewRoom) buyAddon(h, 'crewRoom', 3, 1, st.money, st.finance, 0);
  return { st, h };
}

describe('crews (docs/09)', () => {
  it('the bar rolls a few candidates a day, with fees and wages in the docs ranges', () => {
    const { st } = setup();
    const a = candidatesFor(st.property.crew, new Rng(4), 3);
    expect(a).toHaveLength(K.candidates);
    expect(candidatesFor(st.property.crew, new Rng(99), 3)).toBe(a); // same day, same people
    for (const c of a) {
      expect(c.fee).toBeGreaterThanOrEqual(K.hireFee[0]);
      expect(c.fee).toBeLessThanOrEqual(K.hireFee[1]);
      expect(c.wage).toBeGreaterThanOrEqual(K.wage[0]);
      expect(c.wage).toBeLessThanOrEqual(K.wage[1]);
      expect(c.skill).toBeLessThanOrEqual(K.operatorSkill[1]);
    }
  });

  it('hiring needs a crew room, rep tier 2, a free place and the dirty fee', () => {
    const { st } = setup(false);
    const [c] = candidatesFor(st.property.crew, new Rng(4), 1);
    expect(hireBlock(st.property, st.money, c!, 2)).toBe('room');
    const { st: s2, h } = setup();
    const [d] = candidatesFor(s2.property.crew, new Rng(4), 1);
    expect(hireBlock(s2.property, s2.money, d!, 1)).toBe('tier');
    expect(hireBlock(s2.property, s2.money, d!, 2)).toBe('money');
    s2.money.dirty = 500;
    h.stash.dirty = 5000;
    expect(hire(s2.property, s2.money, d!.id, 2)).toBe(true);
    expect(s2.money.dirty).toBe(0);
    expect(h.stash.dirty).toBe(5500 - d!.fee);
    expect(s2.property.crew.members).toHaveLength(1);
  });

  it('an operator banks the press batch in the stash (cut and skill) and restocks from it', () => {
    const { st, h } = setup();
    const [c] = candidatesFor(st.property.crew, new Rng(4), 1);
    h.stash.dirty = 10000;
    hire(st.property, st.money, c!.id, 2);
    expect(assign(st.property, c!.id, { home: 'linden10', op: 'press' })).toBe(true);
    expect(operatorAt(st.property, 'linden10', 'press')?.id).toBe(c!.id);
    st.money.dirty = 1000;
    startPress(h, st.money, 0);
    const before = h.stash.dirty;
    runOps(st.property, O.press.cycleMinutes);
    const take = Math.round(O.press.output * (1 + c!.skill) * (1 - K.operatorCut));
    expect(h.stash.dirty).toBe(before + take - O.press.supplies);
    expect(opOf(h, 'press')!.since).toBe(O.press.cycleMinutes); // running again
    expect(opOf(h, 'press')!.ready).toBe(0);
  });

  it('wages come out of the stash on Monday; three days unpaid and they quit', () => {
    const { st, h } = setup();
    const [c] = candidatesFor(st.property.crew, new Rng(4), 1);
    h.stash.dirty = c!.fee + c!.wage;
    hire(st.property, st.money, c!.id, 2);
    expect(payWages(st.property, 0)).toEqual([]);
    expect(h.stash.dirty).toBe(0);
    expect(payWages(st.property, 7 * 1440)).toHaveLength(1);
    expect(quitters(st.property, 9 * 1440)).toEqual([]);
    expect(quitters(st.property, 10 * 1440)).toHaveLength(1);
    expect(st.property.crew.members).toHaveLength(0);
  });

  it('the calendar runs wages on Monday mornings', () => {
    const { st, h } = setup();
    const [c] = candidatesFor(st.property.crew, new Rng(4), 1);
    h.stash.dirty = c!.fee;
    hire(st.property, st.money, c!.id, 2);
    const msgs = runCalendar(st, 0, 7 * 1440);
    expect(msgs.some((m) => m.who === c!.name)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { Rng } from '../src/core/rng';
import { createState } from '../src/core/store';
import { opOf, startPress } from '../src/systems/operations';
import { buyAddon, buyHome, homeOf } from '../src/systems/property';
import { nightlyHits, resolveHits, rivalDown } from '../src/systems/rivals';

const R = BALANCE.property.rivals;

function running() {
  const st = createState(1, 'downtown', { x: 0, y: 0 });
  st.money.bank = 100000;
  buyHome(st.property, st.money, st.finance, 0, 'linden10');
  const h = homeOf(st.property, 'linden10')!;
  buyAddon(h, 'press', 3, 1, st.money, st.finance, 0);
  st.money.dirty = 1000;
  startPress(h, st.money, 0);
  return { st, h };
}

describe('rival hits (docs/04)', () => {
  it('none below rep tier 2; at tier 2 a running operation gets hit sooner or later, one hit per home', () => {
    const { st } = running();
    expect(nightlyHits(st.property, 0, 200 * 1440, 1, new Rng(2))).toEqual([]);
    const ev = nightlyHits(st.property, 0, 200 * 1440, 2, new Rng(2));
    expect(ev).toHaveLength(1);
    const hit = st.property.hits[0]!;
    expect(hit.left).toBeGreaterThanOrEqual(R.count[0]);
    expect(hit.left).toBeLessThanOrEqual(R.count[1]);
    expect((hit.until - R.defendMinutes) % 1440).toBe(R.hitMinute);
  });

  it('beat them all inside the hour and the batch is safe', () => {
    const { st, h } = running();
    st.property.hits.push({ home: 'linden10', op: 'press', until: 100, left: 2 });
    expect(rivalDown(st.property, 'linden10')).toBe(false);
    expect(rivalDown(st.property, 'linden10')).toBe(true);
    expect(resolveHits(st.property, 200)).toEqual([]);
    expect(opOf(h, 'press')!.since).not.toBeNull();
  });

  it('when the hour is up they take the batch', () => {
    const { st, h } = running();
    opOf(h, 'press')!.ready = 500;
    st.property.hits.push({ home: 'linden10', op: 'press', until: 100, left: 3 });
    expect(resolveHits(st.property, 99)).toEqual([]);
    expect(resolveHits(st.property, 100)).toHaveLength(1);
    expect(opOf(h, 'press')).toMatchObject({ since: null, batch: 0, ready: 0 });
    expect(st.property.hits).toEqual([]);
  });
});

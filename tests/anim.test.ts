import { describe, expect, it } from 'vitest';
import { Anim, approach, backOut, cubicOut, frameAt, pingPong, stepped } from '../src/anim/ease';
import { Presence } from '../src/ui/anim/transition';

describe('easing', () => {
  it('runs 0 → 1 and clamps', () => {
    for (const e of [cubicOut, backOut]) {
      expect(e(0)).toBeCloseTo(0);
      expect(e(1)).toBeCloseTo(1);
      expect(e(2)).toBeCloseTo(1);
    }
    expect(Math.max(...Array.from({ length: 50 }, (_, k) => backOut(k / 49)))).toBeGreaterThan(1);
  });

  it('steps an ease into levels', () => {
    const s = stepped(cubicOut, 4);
    for (let k = 0; k <= 20; k++) expect((s(k / 20) * 4) % 1).toBe(0);
  });

  it('ping-pongs and approaches', () => {
    expect(pingPong(0.5, 1)).toBeCloseTo(1);
    expect(pingPong(1, 1)).toBeCloseTo(0);
    expect(approach(0, 10, 0.5, 0.5)).toBeCloseTo(5);
  });

  it('picks flipbook frames', () => {
    expect(frameAt(0, 10, 4, false)).toBe(0);
    expect(frameAt(0.35, 10, 4, false)).toBe(3);
    expect(frameAt(9, 10, 4, false)).toBe(3);
    expect(frameAt(0.45, 10, 4, true)).toBe(0);
  });
});

describe('Anim', () => {
  it('animates to a target and retargets from where it is', () => {
    const a = new Anim(0, 1);
    a.retarget(100);
    a.update(0.5);
    const mid = a.value;
    expect(mid).toBeGreaterThan(50);
    a.retarget(0);
    expect(a.value).toBeCloseTo(mid);
    a.update(1);
    expect(a.value).toBe(0);
    expect(a.done).toBe(true);
  });
});

describe('Presence', () => {
  it('opens, closes and reports closed only at the end', () => {
    const p = new Presence(0.2, 0.1);
    p.update(0.1);
    expect(p.t).toBeCloseTo(0.5);
    expect(p.opening).toBe(true);
    p.update(0.2);
    expect(p.t).toBe(1);
    p.close();
    expect(p.closed).toBe(false);
    p.update(0.05);
    expect(p.closed).toBe(false);
    p.update(0.06);
    expect(p.closed).toBe(true);
  });
});

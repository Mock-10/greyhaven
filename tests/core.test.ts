import { describe, expect, it, vi } from 'vitest';
import { FixedStep } from '../src/core/clock';
import { EventBus } from '../src/core/eventBus';
import { Rng } from '../src/core/rng';
import { createState } from '../src/core/store';
import { parseParams } from '../src/debug/params';

describe('seeded rng', () => {
  it('repeats for the same seed and differs for another', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const c = new Rng(43);
    const sa = Array.from({ length: 5 }, () => a.next());
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(sa);
    expect(Array.from({ length: 5 }, () => c.next())).not.toEqual(sa);
    expect(sa.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it('draws integers in range', () => {
    const r = new Rng(1);
    for (let k = 0; k < 200; k++) {
      const v = r.int(3, 5);
      expect(v >= 3 && v <= 5 && Number.isInteger(v)).toBe(true);
    }
    expect(() => r.pick([])).toThrow();
  });
});

describe('fixed timestep', () => {
  it('ticks at a fixed rate whatever the frame time', () => {
    const step = new FixedStep(30, 0.25);
    let ticks = 0;
    step.advance(0.1, () => ticks++);
    expect(ticks).toBe(3);
    step.advance(0.01, () => ticks++);
    expect(ticks).toBe(3);
  });

  it('caps a long stall instead of spiralling', () => {
    const step = new FixedStep(30, 0.25);
    let ticks = 0;
    step.advance(10, () => ticks++);
    expect(ticks).toBe(7);
  });
});

describe('event bus', () => {
  it('delivers events and unsubscribes', () => {
    const bus = new EventBus<{ ping: number }>();
    const fn = vi.fn();
    const off = bus.on('ping', fn);
    bus.emit('ping', 1);
    off();
    bus.emit('ping', 2);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1);
  });
});

describe('state and params', () => {
  it('keeps the game state a plain serialisable object', () => {
    const s = createState(7, 'downtown', { x: 1, y: 2 });
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    expect(s.money.clean).toBeGreaterThan(0);
    expect(s.wanted.stars).toBe(0);
  });

  it('reads debug URL parameters and ignores junk', () => {
    expect(parseParams('')).toEqual({
      scene: 'title',
      seed: 1,
      zoom: 0,
      debug: false,
      spawn: null,
      minute: null,
    });
    expect(parseParams('?scene=world&seed=9&zoom=3&debug=1&x=10&y=20&time=21:30')).toEqual({
      scene: 'world',
      seed: 9,
      zoom: 3,
      debug: true,
      spawn: { x: 10, y: 20 },
      minute: 21 * 60 + 30,
    });
    expect(parseParams('?time=25:00').minute).toBeNull();
    expect(parseParams('?scene=cheat&zoom=9&seed=-4').scene).toBe('title');
    expect(parseParams('?zoom=9').zoom).toBe(0);
  });
});

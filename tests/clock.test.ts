import { describe, expect, it } from 'vitest';
import {
  advance,
  calendar,
  darkness,
  formatClock,
  gameMinutesPerSecond,
  phaseOf,
  tintAt,
} from '../src/systems/clock';

describe('clock', () => {
  it('runs a full day in the chosen number of real minutes (docs/01)', () => {
    expect(gameMinutesPerSecond(20)).toBeCloseTo(1.2); // 1 in-game hour = 50 real seconds
    expect(advance(0, 20 * 60, 20)).toBeCloseTo(24 * 60);
    expect(advance(0, 15 * 60, 15)).toBeCloseTo(24 * 60);
    expect(advance(0, 30 * 60, 30)).toBeCloseTo(24 * 60);
  });

  it('names days and formats the clock', () => {
    expect(calendar(7 * 60)).toEqual({ day: 1, minute: 420, weekday: 'MON' });
    expect(calendar(24 * 60 * 6 + 5).weekday).toBe('SUN');
    expect(calendar(24 * 60 * 7).weekday).toBe('MON');
    expect(formatClock(21 * 60 + 40)).toBe('21:40');
    expect(formatClock(5)).toBe('00:05');
  });

  it('splits the day into the documented phases', () => {
    expect(phaseOf(7 * 60)).toBe('morning');
    expect(phaseOf(12 * 60)).toBe('day');
    expect(phaseOf(19 * 60)).toBe('evening');
    expect(phaseOf(23 * 60)).toBe('night');
    expect(phaseOf(3 * 60)).toBe('night');
  });

  it('is light by day, dark at night, and ramps at dusk and dawn', () => {
    expect(darkness(12 * 60)).toBe(0);
    expect(darkness(23 * 60)).toBe(1);
    expect(darkness(2 * 60)).toBe(1);
    const dusk = darkness(19 * 60 + 45);
    expect(dusk).toBeGreaterThan(0);
    expect(dusk).toBeLessThan(1);
    expect(darkness(6 * 60)).toBeGreaterThan(darkness(6 * 60 + 30));
  });

  it('mixes white and the night tint', () => {
    expect(tintAt(0, [0.66, 0.66, 0.8])).toBe(0xffffff);
    expect(tintAt(1, [0.5, 0.5, 1])).toBe(((128 << 16) | (128 << 8) | 255) >>> 0);
  });
});

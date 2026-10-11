import { describe, expect, it } from 'vitest';
import {
  applyDeadzone,
  approach,
  clampCenter,
  clampLength,
  fitZoom,
  scrollFor,
  stepZoom,
} from '../src/iso/cameraMath';

const LEVELS = [1, 2, 3, 4];

describe('camera maths', () => {
  it('picks the largest integer zoom that still shows 640 × 360 art pixels', () => {
    expect(fitZoom(1920, 1080, LEVELS, 640, 360)).toBe(3);
    expect(fitZoom(1280, 720, LEVELS, 640, 360)).toBe(2);
    expect(fitZoom(2560, 1440, LEVELS, 640, 360)).toBe(4);
    expect(fitZoom(3840, 2160, LEVELS, 640, 360)).toBe(4);
    expect(fitZoom(800, 600, LEVELS, 640, 360)).toBe(1);
  });

  it('steps zoom by whole levels and stops at the ends', () => {
    expect(stepZoom(2, 1, LEVELS)).toBe(3);
    expect(stepZoom(4, 1, LEVELS)).toBe(4);
    expect(stepZoom(1, -1, LEVELS)).toBe(1);
    expect(stepZoom(2.4, 1, LEVELS)).toBe(2);
  });

  it('always scrolls by whole art pixels', () => {
    const s = scrollFor({ x: 100.3, y: 50.7 }, 1281, 721, 3);
    expect(Number.isInteger(s.x) && Number.isInteger(s.y)).toBe(true);
    expect(scrollFor({ x: 100, y: 50 }, 1280, 720, 2)).toEqual({ x: -220, y: -130 });
  });

  it('limits the pan distance', () => {
    expect(clampLength({ x: 3, y: 4 }, 10)).toEqual({ x: 3, y: 4 });
    const c = clampLength({ x: 30, y: 40 }, 10);
    expect(Math.hypot(c.x, c.y)).toBeCloseTo(10);
  });

  it('only follows once the target leaves the deadzone', () => {
    expect(applyDeadzone({ x: 0, y: 0 }, { x: 10, y: -5 }, 48, 32)).toEqual({ x: 0, y: 0 });
    expect(applyDeadzone({ x: 0, y: 0 }, { x: 40, y: -30 }, 48, 32)).toEqual({ x: 16, y: -14 });
  });

  it('approaches a value smoothly', () => {
    expect(approach(0, 10, 8, 0)).toBe(0);
    const v = approach(0, 10, 8, 0.1);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(10);
  });
});

describe('camera bounds', () => {
  const b = { x: -100, y: 0, w: 200, h: 100 };
  it('keeps the view over the map plus a margin', () => {
    expect(clampCenter({ x: -500, y: 50 }, 40, 20, b, 10)).toEqual({ x: -90, y: 50 });
    expect(clampCenter({ x: 0, y: 500 }, 40, 20, b, 10)).toEqual({ x: 0, y: 100 });
  });
  it('centres a view bigger than the map', () => {
    expect(clampCenter({ x: 70, y: 0 }, 400, 300, b, 10)).toEqual({ x: 0, y: 50 });
  });
});

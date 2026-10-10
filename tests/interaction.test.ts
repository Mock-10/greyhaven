import { describe, expect, it } from 'vitest';
import { selectTarget } from '../src/systems/interaction';

const cands = [
  { id: 'ahead', x: 30, y: 0 },
  { id: 'behind', x: -20, y: 0 },
  { id: 'far', x: 200, y: 0 },
];

describe('interaction targeting', () => {
  it('only considers objects in range', () => {
    const t = selectTarget(cands, 0, 0, { x: 1, y: 0 }, 48, 0.6);
    expect(t.inRange.sort()).toEqual(['ahead', 'behind']);
  });

  it('prefers the object in front, even if a bit further away', () => {
    expect(selectTarget(cands, 0, 0, { x: 1, y: 0 }, 48, 0.6).target).toBe('ahead');
    expect(selectTarget(cands, 0, 0, { x: -1, y: 0 }, 48, 0.6).target).toBe('behind');
  });

  it('cycles through the objects in range with Tab', () => {
    const a = selectTarget(cands, 0, 0, { x: 1, y: 0 }, 48, 0.6, 0).target;
    const b = selectTarget(cands, 0, 0, { x: 1, y: 0 }, 48, 0.6, 1).target;
    const c = selectTarget(cands, 0, 0, { x: 1, y: 0 }, 48, 0.6, 2).target;
    expect(a).not.toBe(b);
    expect(c).toBe(a);
  });

  it('has no target when nothing is near', () => {
    expect(selectTarget(cands, 1000, 1000, { x: 1, y: 0 }, 48, 0.6)).toEqual({ inRange: [], target: null });
  });
});

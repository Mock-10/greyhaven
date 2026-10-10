import { describe, expect, it } from 'vitest';
import {
  depthAgainstFootprints,
  depthOf,
  relationToFootprint,
  sortBackToFront,
  type Footprint,
} from '../src/iso/depthSort';

// The office tower on the test map: centre (150, 140), half extents 72.8.
const tower: Footprint = { minX: 77.2, minY: 67.2, maxX: 222.8, maxY: 212.8, depth: 290 };

describe('depth sorting', () => {
  it('sorts by the world x + y of the ground anchor, stable on ties', () => {
    const items = [
      { id: 'a', x: 10, y: 10 },
      { id: 'b', x: 0, y: 5 },
      { id: 'c', x: 15, y: 5 },
      { id: 'd', x: 1, y: 1 },
    ];
    expect(sortBackToFront(items).map((i) => i.id)).toEqual(['d', 'b', 'a', 'c']);
    expect(depthOf(3, 4)).toBe(7);
  });

  it('knows which side of a building footprint a point is on', () => {
    expect(relationToFootprint(240, 150, tower)).toBe('front');
    expect(relationToFootprint(150, 230, tower)).toBe('front');
    expect(relationToFootprint(60, 150, tower)).toBe('behind');
    expect(relationToFootprint(150, 50, tower)).toBe('behind');
    expect(relationToFootprint(150, 150, tower)).toBe('overlap');
  });

  it('puts a character beside a tall building on the correct side', () => {
    // Walking along the tower's +y face: by anchor alone (60 + 230 = 290) this would tie with the tower.
    expect(depthAgainstFootprints(60, 230, [tower])).toBeGreaterThan(tower.depth);
    // Standing behind its −x face, with a larger x + y than the tower's anchor.
    expect(depthAgainstFootprints(70, 260, [tower])).toBeGreaterThan(tower.depth);
    expect(depthAgainstFootprints(60, 200, [tower])).toBeLessThan(tower.depth);
    expect(depthAgainstFootprints(150, 30, [tower])).toBeLessThan(tower.depth);
  });

  it('leaves the depth alone when no footprint overlaps', () => {
    expect(depthAgainstFootprints(500, 500, [])).toBe(1000);
  });
});

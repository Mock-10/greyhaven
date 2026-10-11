import { describe, expect, it } from 'vitest';
import {
  blocked,
  computeSight,
  gridOf,
  HID,
  MEM,
  roomAt,
  roomLabels,
  stateAt,
  VIS,
  wallLines,
  type Partition,
} from '../src/systems/sight';

// The bank-style layout from docs/19 in miniature: a lobby, and a back room behind a wall with a door gap.
// Room 128 x 96 units; wall along x at y = 48, from x 64 to 128, with a door gap at x 88..104.
const W = 128;
const D = 96;
const parts: Partition[] = [
  { axis: 'x', pos: 48, a0: 64, a1: 128, gaps: [[88, 104]] },
  { axis: 'y', pos: 64, a0: 0, a1: 48, gaps: [] },
];
const door = { axis: 'x' as const, pos: 48, a0: 88, a1: 104 };

describe('sight', () => {
  it('splits the building into rooms at the walls and doorways', () => {
    const lab = roomLabels(W, D, parts);
    const g = gridOf(W, D);
    expect(roomAt(lab, g, 100, 20)).not.toBe(roomAt(lab, g, 100, 80)); // back room vs lobby
    expect(roomAt(lab, g, 20, 20)).toBe(roomAt(lab, g, 100, 80)); // the west half is open to the lobby
  });

  it('blocks rays through walls but not through open doorways', () => {
    const lines = wallLines(parts);
    expect(blocked(100, 80, 70, 20, lines)).toBe(true);
    expect(blocked(96, 80, 96, 20, lines)).toBe(false);
    expect(blocked(96, 80, 96, 20, wallLines(parts, [door]))).toBe(true);
  });

  it('hides the back room behind a closed door and shows it through an open one', () => {
    const lab = roomLabels(W, D, parts);
    const g = gridOf(W, D);
    const viewer = { x: 96, y: 80 };
    const closed = computeSight(W, D, parts, lab, viewer, [door], new Set());
    expect(stateAt(closed.state, g, 100, 20)).toBe(HID);
    expect(stateAt(closed.state, g, 20, 80)).toBe(VIS);
    const open = computeSight(W, D, parts, lab, viewer, [], new Set());
    expect(stateAt(open.state, g, 96, 20)).toBe(VIS);
    // a corner of the back room the doorway can't see stays hidden
    expect(stateAt(open.state, g, 124, 4)).not.toBe(VIS);
  });

  it('always shows the room the player is in, and remembers rooms seen before', () => {
    const lab = roomLabels(W, D, parts);
    const g = gridOf(W, D);
    const back = roomAt(lab, g, 100, 20);
    const inside = computeSight(W, D, parts, lab, { x: 120, y: 10 }, [door], new Set());
    expect(stateAt(inside.state, g, 70, 44)).toBe(VIS);
    expect(inside.visibleRooms.has(back)).toBe(true);
    const later = computeSight(W, D, parts, lab, { x: 96, y: 80 }, [door], new Set([back]));
    expect(stateAt(later.state, g, 100, 20)).toBe(MEM);
  });
});

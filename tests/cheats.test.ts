import { describe, expect, it } from 'vitest';
import { parseCheat } from '../src/debug/cheats';

describe('cheat console', () => {
  it('parses money, time, rank, teleports and cars', () => {
    expect(parseCheat('cash 500')).toEqual({ kind: 'cash', clean: 500 });
    expect(parseCheat(' DIRTY  1200 ')).toEqual({ kind: 'dirty', amount: 1200 });
    expect(parseCheat('bank 900')).toEqual({ kind: 'bank', amount: 900 });
    expect(parseCheat('item lockpicks 10')).toEqual({ kind: 'item', item: 'lockpicks', count: 10 });
    expect(parseCheat('item lockpicks')).toHaveProperty('error');
    expect(parseCheat('time 18:30')).toEqual({ kind: 'time', minute: 18 * 60 + 30 });
    expect(parseCheat('day 3')).toEqual({ kind: 'day', day: 3 });
    expect(parseCheat('rank 2')).toEqual({ kind: 'rank', rank: 2 });
    expect(parseCheat('tp 100 200')).toEqual({ kind: 'tp', x: 100, y: 200 });
    expect(parseCheat('car taxi')).toEqual({ kind: 'car', model: 'taxi', x: null, y: null, dir: 0 });
    expect(parseCheat('car van_white 10 20 2')).toEqual({
      kind: 'car',
      model: 'van_white',
      x: 10,
      y: 20,
      dir: 2,
    });
    expect(parseCheat('help')).toEqual({ kind: 'help' });
    expect(parseCheat('stars 2')).toEqual({ kind: 'stars', stars: 2 });
  });

  it('rejects bad input with a hint', () => {
    for (const bad of ['cash', 'time 25:00', 'rank 9', 'tp 1', 'car', 'fly'])
      expect('error' in parseCheat(bad), bad).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { DataEntryGame, FilingGame, TRAY_COLOURS } from '../src/minigames/logic';

describe('filing minigame', () => {
  it('grades a perfect run excellent', () => {
    const g = new FilingGame(new Rng(1));
    while (!g.done) g.file(TRAY_COLOURS.indexOf(g.current!));
    expect(g.correct).toBe(g.papers.length);
    expect(g.grade).toBe('excellent');
  });

  it('counts misfiles and papers that land unfiled', () => {
    const g = new FilingGame(new Rng(2));
    g.file((TRAY_COLOURS.indexOf(g.current!) + 1) % 3); // wrong tray
    g.update(100); // the next paper lands
    while (!g.done) g.file(TRAY_COLOURS.indexOf(g.current!));
    expect(g.misfiled).toBe(1);
    expect(g.missed).toBe(1);
    expect(['ok', 'good']).toContain(g.grade);
  });

  it('drops each paper faster than the last', () => {
    const g = new FilingGame(new Rng(3));
    expect(g.speed(5)).toBeGreaterThan(g.speed(0));
  });
});

describe('data entry minigame', () => {
  it('grades a clean, quick run excellent', () => {
    const g = new DataEntryGame(new Rng(4));
    while (!g.done) {
      g.key(g.word[g.pos]!);
      g.update(0.1);
    }
    expect(g.grade).toBe('excellent');
  });

  it('marks down errors', () => {
    const g = new DataEntryGame(new Rng(5));
    g.key('Z');
    g.key('Z');
    while (!g.done) g.key(g.word[g.pos]!);
    expect(g.errors).toBe(2);
    expect(g.grade).toBe('ok');
  });

  it('fails when the time runs out early', () => {
    const g = new DataEntryGame(new Rng(6));
    g.update(100);
    expect(g.done).toBe(true);
    expect(g.grade).toBe('fail');
  });
});

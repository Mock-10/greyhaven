import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { BALANCE } from '../src/config/balance';
import { DataEntryGame, DuffelGame, FilingGame, TRAY_COLOURS } from '../src/minigames/logic';

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

describe('duffel minigame (Dez)', () => {
  it('grades a quick clean bagging excellent and ends when the last clean stack goes in', () => {
    const g = new DuffelGame(new Rng(5));
    expect(g.stacks.filter((s) => s.dyed).length).toBe(BALANCE.minigames.duffel.dyed);
    g.stacks.forEach((s, k) => {
      if (!s.dyed) g.bag(k);
    });
    expect(g.done).toBe(true);
    expect(g.grade).toBe('excellent');
  });

  it('is good when slow, ok with one dyed stack in the bag, and fails when time runs out early', () => {
    const slow = new DuffelGame(new Rng(6));
    slow.update(slow.timeTotal * 0.8);
    slow.stacks.forEach((s, k) => !s.dyed && slow.bag(k));
    expect(slow.grade).toBe('good');

    const dyed = new DuffelGame(new Rng(7));
    dyed.bag(dyed.stacks.findIndex((s) => s.dyed));
    dyed.stacks.forEach((s, k) => !s.dyed && dyed.bag(k));
    expect(dyed.dyedBagged).toBe(1);
    expect(dyed.grade).toBe('ok');

    const late = new DuffelGame(new Rng(8));
    late.bag(late.stacks.findIndex((s) => !s.dyed));
    late.update(999);
    expect(late.grade).toBe('fail');
  });

  it('ignores a stack bagged twice', () => {
    const g = new DuffelGame(new Rng(9));
    const k = g.stacks.findIndex((s) => !s.dyed);
    g.bag(k);
    g.bag(k);
    expect(g.cleanBagged).toBe(1);
  });
});

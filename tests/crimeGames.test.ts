import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import {
  AtmHackGame,
  BypassGame,
  DrillGame,
  IntimidateGame,
  SafeCrackGame,
  WipeGame,
} from '../src/minigames/crime';

const run = (g: { update(dt: number): void; done: boolean }, step: (t: number) => void, max = 60) => {
  for (let t = 0; t < max && !g.done; t += 0.05) {
    step(t);
    g.update(0.05);
  }
};

describe('crime minigames (docs/06)', () => {
  it('intimidate: holding in the band passes, holding flat out hits the alarm', () => {
    const ok = new IntimidateGame(new Rng(1));
    run(ok, () => ok.hold(ok.nerve < (ok.band[0] + ok.band[1]) / 2));
    expect(ok.grade).not.toBe('fail');
    const hard = new IntimidateGame(new Rng(1));
    run(hard, () => hard.hold(true));
    expect(hard.grade).toBe('fail');
    const idle = new IntimidateGame(new Rng(1));
    run(idle, () => idle.hold(false));
    expect(idle.grade).toBe('fail');
  });

  it('safe crack: setting each number on the click opens it; three misses fail', () => {
    const g = new SafeCrackGame(new Rng(2));
    run(g, () => {
      if (g.clicking) g.press();
      else g.turn(1, 0.05);
    });
    expect(g.set).toBe(g.targets.length);
    expect(['excellent', 'good']).toContain(g.grade);
    const bad = new SafeCrackGame(new Rng(2));
    while (bad.clicking) bad.turn(1, 0.05);
    bad.press();
    bad.press();
    bad.press();
    expect(bad.grade).toBe('fail');
  });

  it('ATM hack: repeating the sequence passes every round; a wrong arrow fails', () => {
    const g = new AtmHackGame(new Rng(3));
    for (let i = 0; i < 400 && !g.done; i++) {
      g.update(0.05);
      if (g.showT === null) g.key(g.sequence[g.entered]!);
    }
    expect(g.round).toBe(g.rounds);
    expect(g.grade).not.toBe('fail');
    const bad = new AtmHackGame(new Rng(3));
    while (bad.showT !== null) bad.update(0.05);
    bad.key(bad.sequence[0] === 'up' ? 'down' : 'up');
    expect(bad.grade).toBe('fail');
  });

  it('drill: pulsing past the red line drills through; holding flat out jams it', () => {
    const g = new DrillGame();
    run(g, () => g.hold(g.heat < g.red));
    expect(g.grade).toBe('excellent');
    const hot = new DrillGame();
    run(hot, () => hot.hold(true));
    expect(hot.jams).toBeGreaterThan(0);
  });

  it('wipe: holding inside the window erases the tape', () => {
    const g = new WipeGame(new Rng(4));
    run(g, () => {
      g.move(Math.sign(g.window - g.marker), 0.05);
      g.hold(true);
    });
    expect(g.grade).not.toBe('fail');
    expect(g.progress).toBe(1);
  });

  it('bypass: the right order cuts the panel; a wrong wire trips it; time runs out', () => {
    const g = new BypassGame(new Rng(5), 10);
    for (const k of g.order) g.snip(k);
    expect(g.grade).not.toBe('fail');
    const bad = new BypassGame(new Rng(5), 10);
    bad.snip(bad.order[1]!);
    expect(bad.grade).toBe('fail');
    const slow = new BypassGame(new Rng(5), 2);
    run(slow, () => undefined);
    expect(slow.grade).toBe('fail');
  });
});

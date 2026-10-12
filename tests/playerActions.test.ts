import { describe, expect, it } from 'vitest';
import actionsJson from '../art/player_actions.json';
import playerJson from '../art/player.json';
import {
  ACTIONS,
  actionFrameKey,
  contextAction,
  PlayerActions,
  type ActionName,
} from '../src/anim/playerActions';
import { FX } from '../src/config/balanceFx';

const frames = new Set(Object.keys(actionsJson.frames));

describe('player action sprites', () => {
  it('has every frame of every action, for every hair style and facing', () => {
    for (const style of playerJson.styles)
      for (const [name, a] of Object.entries(ACTIONS))
        for (let k = 0; k < a.frames; k++)
          for (let d = 0; d < 8; d++)
            expect(frames.has(actionFrameKey(style, name as ActionName, k, d))).toBe(true);
  });

  it('uses the same marker colours as the walk sprites, so one look paints both', () => {
    expect(actionsJson.markers).toEqual(playerJson.markers);
  });
});

describe('PlayerActions', () => {
  it('shows nothing while walking or just stopped, then breathes', () => {
    const a = new PlayerActions();
    a.update(0.1, true);
    expect(a.current()).toBeNull();
    a.update(FX.actions.breatheAfter + 0.01, false);
    expect(a.current()?.action).toBe('breathe');
    a.update(0.1, true);
    expect(a.current()).toBeNull();
  });

  it('plays a reach once, and holds a tool while its panel is open', () => {
    const a = new PlayerActions();
    a.play('use');
    expect(a.frame('short', 0)).toBe('short/use0/SE');
    a.update(FX.actions.useSeconds + 0.01, false);
    expect(a.current()).toBeNull();
    a.hold('lockpick');
    a.update(0.3, false);
    expect(a.current()).toEqual({ action: 'lockpick', k: 1 });
    a.hold(null);
    expect(a.current()).toBeNull();
  });

  it('walks the carry cycle in the walk order', () => {
    const a = new PlayerActions();
    a.hold('carry');
    const seen = Array.from({ length: 8 }, (_, k) => {
      const b = new PlayerActions();
      b.hold('carry');
      b.update(k / 8 + 0.001, false);
      return b.current()?.k;
    });
    expect(seen).toEqual(ACTIONS.carry.cycle);
    expect(a.current()?.k).toBe(0);
  });

  it('maps open panels to what the hands do', () => {
    expect(contextAction('lockpick')).toBe('lockpick');
    expect(contextAction('phone')).toBe('phone');
    expect(contextAction('fell')).toBe('chop');
    expect(contextAction('shop')).toBeNull();
    expect(contextAction(null)).toBeNull();
  });
});

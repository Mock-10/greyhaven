import { describe, expect, it } from 'vitest';
import {
  checksum,
  exportName,
  makeSave,
  migrate,
  nextAutoSlot,
  SAVE_VERSION,
  validate,
  type SaveFile,
} from '../src/core/save';
import { createState } from '../src/core/store';

const state = () => {
  const s = createState(7, 'downtown', { x: 100, y: 200 });
  s.money = { clean: 900, dirty: 450 };
  s.wanted.stars = 2;
  return s;
};

describe('saves (docs/12)', () => {
  it('round-trips the whole state as JSON, with stars cleared and a valid checksum', () => {
    const file = makeSave(state(), 'slot1', Date.UTC(2026, 9, 11));
    const back = validate(JSON.parse(JSON.stringify(file)));
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.file.state.money).toEqual({ clean: 900, dirty: 450 });
    expect(back.file.state.wanted.stars).toBe(0);
    expect(back.file.meta).toMatchObject({ slot: 'slot1', clean: 900, dirty: 450, rank: 1 });
    expect(back.file.version).toBe(SAVE_VERSION);
  });

  it('rejects damaged, foreign and newer files', () => {
    const file = makeSave(state(), 'slot2', 0);
    const damaged = JSON.parse(JSON.stringify(file)) as SaveFile;
    damaged.state.money.clean = 999999;
    expect(validate(damaged)).toMatchObject({ ok: false, error: 'SAVE FILE IS DAMAGED' });
    expect(validate({ hello: 1 })).toMatchObject({ ok: false });
    expect(validate(null)).toMatchObject({ ok: false });
    expect(validate({ ...file, version: SAVE_VERSION + 1 })).toMatchObject({
      ok: false,
      error: 'SAVE FROM A NEWER VERSION',
    });
  });

  it('migrates one version at a time and refuses a gap', () => {
    const file = makeSave(state(), 'slot1', 0);
    const old = { ...file, version: 1 };
    const steps = {
      1: (s: Record<string, unknown>) => ({ ...s, added: 'v2' }),
      2: (s: Record<string, unknown>) => ({ ...s, added: `${s.added}+v3` }),
    };
    const up = migrate(old, steps, 3);
    expect(up.version).toBe(3);
    expect((up.state as unknown as { added: string }).added).toBe('v2+v3');
    expect(up.checksum).toBe(checksum(up.state));
    expect(() => migrate(old, { 1: steps[1] }, 3)).toThrow();
    expect(() => migrate({ ...file, version: 9 }, {}, 3)).toThrow();
  });

  it('rotates the two autosaves, keeping the newest', () => {
    expect(nextAutoSlot({})).toBe('auto1');
    const a = makeSave(state(), 'auto1', 100).meta;
    expect(nextAutoSlot({ auto1: a })).toBe('auto2');
    const b = makeSave(state(), 'auto2', 200).meta;
    expect(nextAutoSlot({ auto1: a, auto2: b })).toBe('auto1');
    expect(nextAutoSlot({ auto1: { ...a, savedAt: 300 }, auto2: b })).toBe('auto2');
  });

  it('names exported files after the slot and the date', () => {
    expect(exportName(makeSave(state(), 'slot3', Date.UTC(2026, 9, 11, 12)))).toBe(
      'doublelife-save-slot3-2026-10-11.json',
    );
  });
});

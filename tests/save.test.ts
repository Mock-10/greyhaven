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
  s.money = { clean: 900, dirty: 450, bank: 120 };
  s.wanted.stars = 2;
  return s;
};

describe('saves (docs/12)', () => {
  it('round-trips the whole state as JSON, with stars cleared and a valid checksum', () => {
    const file = makeSave(state(), 'slot1', Date.UTC(2026, 9, 11));
    const back = validate(JSON.parse(JSON.stringify(file)));
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.file.state.money).toEqual({ clean: 900, dirty: 450, bank: 120 });
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

  it('migrates a version 1 save to version 2 (bank, rent, career week, bag, messages)', () => {
    const v1 = {
      seed: 3,
      minutes: 3000,
      map: 'downtown',
      player: { x: 1, y: 2, dir: 0, moving: false, sprinting: false, health: 80, armor: 0, costume: 'office_worker' },
      money: { clean: 400, dirty: 90 },
      wanted: { stars: 0, seen: false, lastKnown: null, escape: 0 },
      area: { kind: 'street' },
      streetReturn: null,
      career: {
        current: 'office',
        jobs: { office: { rank: 2, xp: 7 } },
        shift: { job: 'office', day: 3, late: false, grades: ['ok'] },
        lastShiftDay: 2,
      },
      inventory: { fuelCans: 2 },
      sight: {},
      vehicles: [],
      driving: null,
      lastCar: null,
      laundered: { day: 0, amount: 0 },
      record: { arrests: [] },
      playtime: 50,
    };
    const old = { game: 'doublelife', version: 1, meta: {}, state: v1, checksum: '' } as unknown as SaveFile;
    old.checksum = checksum(v1);
    const r = validate(old);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const st = r.file.state;
    expect(r.file.version).toBe(SAVE_VERSION);
    expect(st.money).toEqual({ clean: 400, dirty: 90, bank: 0 });
    expect(st.finance.rent).toEqual({ owed: 0, unpaidSince: null, evicted: false, storage: false });
    expect(st.calendarAt).toBe(3000);
    expect(st.career.shift?.tasks).toBe(3);
    expect(st.career.week).toEqual({ pay: 0, offense: false });
    expect(st.career.jobs.office).toEqual({ rank: 2, xp: 7 });
    expect(st.career.jobs.delivery).toEqual({ rank: 1, xp: 0 });
    expect(st.inventory.fuelCans).toBe(2);
    expect(st.inventory.lockpicks).toBe(0);
    expect(st.messages).toEqual([]);
    // the migrated state has every field a new game has
    const fresh = createState(1, 'downtown', { x: 0, y: 0 });
    expect(Object.keys(st).sort()).toEqual(Object.keys(fresh).sort());
    expect(Object.keys(st.career).sort()).toEqual(Object.keys(fresh.career).sort());
    expect(Object.keys(st.inventory).sort()).toEqual(Object.keys(fresh.inventory).sort());
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

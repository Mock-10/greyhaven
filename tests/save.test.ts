import { ONBOARD_STEPS } from '../src/data/onboarding';
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
import { NO_MODS, parkedCar } from '../src/systems/vehicle';

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
      player: {
        x: 1,
        y: 2,
        dir: 0,
        moving: false,
        sprinting: false,
        health: 80,
        armor: 0,
        costume: 'office_worker',
      },
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

  it('migrates a version 2 save to version 3 (the look and the wardrobe)', () => {
    const fresh = createState(1, 'downtown', { x: 0, y: 0 });
    const v2 = JSON.parse(JSON.stringify(fresh)) as Record<string, unknown>;
    delete v2.look;
    delete v2.wardrobe;
    (v2.player as Record<string, unknown>).costume = 'office_worker';
    const old = { game: 'doublelife', version: 2, meta: {}, state: v2, checksum: '' } as unknown as SaveFile;
    old.checksum = checksum(v2);
    const r = validate(old);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const st = r.file.state;
    expect(st.look).toEqual({
      name: 'ALEX',
      style: 'short',
      skin: 'fair',
      hair: 'brown',
      outfit: 'teal_jacket',
    });
    expect(st.wardrobe).toEqual(['teal_jacket', 'sage_casual', 'plum_knit']);
    expect(st.player.costume).toBe('player/short');
    expect(Object.keys(st).sort()).toEqual(Object.keys(fresh).sort());
  });

  it('migrates a version 3 save to version 4 (the shift remembers its tasks)', () => {
    const fresh = createState(1, 'downtown', { x: 0, y: 0 });
    const v3 = JSON.parse(JSON.stringify(fresh)) as Record<string, unknown>;
    (v3.career as Record<string, unknown>).shift = {
      job: 'office',
      day: 2,
      late: false,
      grades: ['good'],
      tasks: 3,
    };
    const old = { game: 'doublelife', version: 3, meta: {}, state: v3, checksum: '' } as unknown as SaveFile;
    old.checksum = checksum(v3);
    const r = validate(old);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.file.version).toBe(SAVE_VERSION);
    expect(r.file.state.career.shift).toEqual({
      job: 'office',
      day: 2,
      late: false,
      grades: ['good'],
      done: [],
      tasks: 3,
    });
    // no shift in progress stays no shift
    const idle = JSON.parse(JSON.stringify(fresh)) as Record<string, unknown>;
    const old2 = {
      game: 'doublelife',
      version: 3,
      meta: {},
      state: idle,
      checksum: checksum(idle),
    } as unknown as SaveFile;
    const r2 = validate(old2);
    expect(r2.ok && r2.file.state.career.shift).toBe(null);
  });

  it('migrates a version 4 save to version 5 (odd jobs, and the guide counts as done)', () => {
    const fresh = createState(1, 'downtown', { x: 0, y: 0 });
    const v4 = JSON.parse(JSON.stringify(fresh)) as Record<string, unknown>;
    delete v4.oddJobs;
    delete v4.onboarding;
    const old = {
      game: 'doublelife',
      version: 4,
      meta: {},
      state: v4,
      checksum: checksum(v4),
    } as unknown as SaveFile;
    const r = validate(old);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.file.version).toBe(SAVE_VERSION);
    expect(r.file.state.oddJobs).toEqual({ gig: null, lastDay: { carWash: 0, barShift: 0 } });
    expect(r.file.state.onboarding.step).toBe(ONBOARD_STEPS.length);
    expect(Object.keys(r.file.state).sort()).toEqual(Object.keys(fresh).sort());
  });

  it('migrates a version 5 save to version 6 (crime, heat, masks)', () => {
    const fresh = createState(1, 'downtown', { x: 0, y: 0 });
    const v5 = JSON.parse(JSON.stringify(fresh)) as Record<string, unknown>;
    for (const k of ['crime', 'heat', 'crimeLog', 'goods', 'masks', 'maskOn']) delete v5[k];
    delete (v5.inventory as Record<string, unknown>).drill;
    const old = {
      game: 'doublelife',
      version: 5,
      meta: {},
      state: v5,
      checksum: checksum(v5),
    } as unknown as SaveFile;
    const r = validate(old);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.file.version).toBe(SAVE_VERSION);
    expect(r.file.state.crime).toEqual(fresh.crime);
    expect(r.file.state.heat).toEqual({ ids: [] });
    expect(r.file.state.inventory.drill).toBe(0);
    expect(r.file.state.maskOn).toBeNull();
    expect(Object.keys(r.file.state).sort()).toEqual(Object.keys(fresh).sort());
  });

  it('migrates a version 6 save to version 7 (an empty loadout)', () => {
    const fresh = createState(1, 'downtown', { x: 0, y: 0 });
    const v6 = JSON.parse(JSON.stringify(fresh)) as Record<string, unknown>;
    delete v6.combat;
    const old = {
      game: 'doublelife',
      version: 6,
      meta: {},
      state: v6,
      checksum: checksum(v6),
    } as unknown as SaveFile;
    const r = validate(old);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.file.version).toBe(SAVE_VERSION);
    expect(r.file.state.combat).toEqual(fresh.combat);
    expect(Object.keys(r.file.state).sort()).toEqual(Object.keys(fresh).sort());
  });

  it('migrates a version 7 save to version 8 (cars get no upgrades and an empty trunk)', () => {
    const fresh = createState(1, 'downtown', { x: 0, y: 0 });
    const v7 = JSON.parse(JSON.stringify(fresh)) as Record<string, unknown>;
    v7.vehicles = [{ ...parkedCar('car1', 'sedan_teal', 10, 20, 0), owned: true, burning: 1 }];
    const old = {
      game: 'doublelife',
      version: 7,
      meta: {},
      state: v7,
      checksum: checksum(v7),
    } as unknown as SaveFile;
    const r = validate(old);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.file.version).toBe(SAVE_VERSION);
    const car = r.file.state.vehicles[0]!;
    expect(car.mods).toEqual(NO_MODS);
    expect(car.stash).toEqual({ weapons: [], goods: [] });
    expect(car.burning).toBeUndefined();
    expect(car.owned).toBe(true);
  });

  it('migrates a version 8 save to version 9 (no homes owned)', () => {
    const fresh = createState(1, 'downtown', { x: 0, y: 0 });
    const v8 = JSON.parse(JSON.stringify(fresh)) as Record<string, unknown>;
    delete v8.property;
    const old = {
      game: 'doublelife',
      version: 8,
      meta: {},
      state: v8,
      checksum: checksum(v8),
    } as unknown as SaveFile;
    const r = validate(old);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.file.version).toBe(SAVE_VERSION);
    expect(r.file.state.property).toEqual(fresh.property);
    expect(Object.keys(r.file.state).sort()).toEqual(Object.keys(fresh).sort());
  });

  it('migrates a version 9 save to version 10 (homes get no operations)', () => {
    const fresh = createState(1, 'downtown', { x: 0, y: 0 });
    const v9 = JSON.parse(JSON.stringify(fresh)) as Record<string, unknown>;
    v9.property = {
      homes: [{ id: 'linden4', addons: ['stashRoom'], stash: { dirty: 5, goods: [], weapons: [] } }],
      taxOwed: 0,
      apartment: { dirty: 0, goods: [], weapons: [] },
    };
    const old = {
      game: 'doublelife',
      version: 9,
      meta: {},
      state: v9,
      checksum: checksum(v9),
    } as unknown as SaveFile;
    const r = validate(old);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.file.version).toBe(SAVE_VERSION);
    expect(r.file.state.property.homes[0]).toEqual({
      id: 'linden4',
      addons: ['stashRoom'],
      stash: { dirty: 5, goods: [], weapons: [] },
      ops: {},
    });
  });

  it('migrates a version 10 save to version 11 (no crew, no rival hits)', () => {
    const fresh = createState(1, 'downtown', { x: 0, y: 0 });
    const v10 = JSON.parse(JSON.stringify(fresh)) as Record<string, Record<string, unknown>>;
    delete v10.property!.crew;
    delete v10.property!.hits;
    const old = {
      game: 'doublelife',
      version: 10,
      meta: {},
      state: v10,
      checksum: checksum(v10),
    } as unknown as SaveFile;
    const r = validate(old);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.file.version).toBe(SAVE_VERSION);
    expect(r.file.state.property).toEqual(fresh.property);
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

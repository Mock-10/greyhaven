import { describe, expect, it } from 'vitest';
import { createState } from '../src/core/store';
import { INTERIORS } from '../src/data/interiors';
import { JOBS, TASKS, jobAtSite, jobOfTask, type JobId, type TaskId } from '../src/data/jobs';
import { OUTFITS } from '../src/data/looks';
import DOWNTOWN from '../src/maps/downtown.json';
import type { MapData } from '../src/maps/types';
import {
  canClockIn,
  clockIn,
  createCareer,
  deliveryDrops,
  legalDiscount,
  legalPrice,
  recordTask,
  taskBlock,
} from '../src/systems/career';
import { buyOutfit, outfitPrice } from '../src/systems/clothing';
import { carPrice, payDealer } from '../src/systems/dealer';
import { createFinance } from '../src/systems/finance';
import { buy, priceOf } from '../src/systems/shop';
import { lockerPage, type ShopCtx } from '../src/world/shops';

const day = (n: number, hh: number, mm = 0) => (n - 1) * 1440 + hh * 60 + mm;
const MAP = DOWNTOWN as unknown as MapData;

describe('the four jobs (docs/03, milestone 7)', () => {
  it('has a site, a boss, tasks and three perks for every job; every task has a job', () => {
    for (const id of Object.keys(JOBS) as JobId[]) {
      const J = JOBS[id];
      expect(J.hiring).toBe(true);
      expect(INTERIORS[J.site as keyof typeof INTERIORS]).toBeDefined();
      expect(jobAtSite(J.site)).toBe(id);
      expect(J.tasks.length).toBeGreaterThanOrEqual(3);
      expect(J.tasksPerShift).toBeGreaterThanOrEqual(3);
      expect(J.tasksPerShift).toBeLessThanOrEqual(4);
      expect(J.perks).toHaveLength(3);
      if (J.uniform) expect(OUTFITS.find((o) => o.id === J.uniform)?.from).toBe('uniform');
    }
    for (const t of Object.keys(TASKS) as TaskId[]) expect(JOBS[jobOfTask(t)].tasks).toContain(t);
  });

  it("every interior task prompt belongs to the job whose site it's in", () => {
    for (const def of Object.values(INTERIORS))
      for (const a of Object.values(def.actions)) {
        if (a?.action.kind !== 'job') continue;
        expect(JOBS[jobOfTask(a.action.task)].site).toBe(def.id);
      }
  });

  it('clocks in only at your own job, and the shift draws on that job', () => {
    const c = createCareer();
    c.current = 'mechanic';
    expect(canClockIn(c, day(1, 8, 30), 'office')).toEqual({ ok: false, reason: 'otherJob' });
    expect(clockIn(c, day(1, 8, 30), 'mechanic').ok).toBe(true);
    expect(c.shift).toMatchObject({ job: 'mechanic', tasks: 3, done: [] });
    expect(taskBlock(c, 'filing')).toBe('otherJob');
    expect(taskBlock(c, 'respray')).toBeNull();
    recordTask(c, 'respray', 'good');
    recordTask(c, 'respray', 'ok'); // a mechanic can respray twice
    expect(c.shift?.done).toEqual(['respray', 'respray']);
  });

  it('runs a delivery in order: van and route at the depot, then each stop once', () => {
    const c = createCareer();
    c.current = 'delivery';
    expect(taskBlock(c, 'loadVan')).toBe('noShift');
    clockIn(c, day(2, 8, 30), 'delivery');
    expect(c.shift?.tasks).toBe(4);
    expect(taskBlock(c, 'doorstep')).toBe('needs');
    recordTask(c, 'loadVan', 'good');
    expect(taskBlock(c, 'loadVan')).toBe('done');
    expect(taskBlock(c, 'signature')).toBe('needs');
    recordTask(c, 'route', 'good');
    expect(taskBlock(c, 'doorstep')).toBeNull();
    recordTask(c, 'doorstep', 'ok');
    expect(taskBlock(c, 'doorstep')).toBe('done');
    recordTask(c, 'signature', 'excellent');
    expect(taskBlock(c, 'signature')).toBe('shiftDone');
  });

  it('keeps the office meeting for senior analysts and up', () => {
    const c = createCareer();
    clockIn(c, day(1, 8, 30));
    expect(taskBlock(c, 'meeting')).toBe('rank');
    expect(taskBlock(c, 'stampSign')).toBeNull();
    c.jobs.office.rank = 3;
    expect(taskBlock(c, 'meeting')).toBeNull();
  });

  it('picks two different Linden Avenue stops a day, and the map has the houses', () => {
    const drops = (MAP.zones ?? []).filter((z) => z.id.startsWith('drop_'));
    expect(drops.length).toBeGreaterThanOrEqual(4);
    const seen = new Set<string>();
    for (let d = 1; d <= 30; d++) {
      const [a, b] = deliveryDrops(d, drops.length);
      expect(a).not.toBe(b);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(drops.length);
      seen.add(`${a},${b}`);
    }
    expect(seen.size).toBeGreaterThan(5);
    for (const t of ['chop', 'fell', 'loadLogs'])
      expect((MAP.zones ?? []).some((z) => z.id === `job_${t}` && z.npc)).toBe(true);
  });

  it('gives the office expense account 10% off at rank 4 in every legal shop', () => {
    const c = createCareer();
    expect(legalDiscount(c)).toBe(0);
    c.jobs.office.rank = 4;
    const d = legalDiscount(c);
    expect(d).toBe(0.1);
    expect(legalPrice(300, d)).toBe(270);
    expect(outfitPrice('navy_suit', d)).toBe(270);
    expect(carPrice('beater_khaki', d)).toBe(1350);
    expect(priceOf('sandwich', d)).toBe(Math.round(priceOf('sandwich') * 0.9));
    const money = { clean: 270, dirty: 0, bank: 0 };
    expect(buyOutfit(money, [], 'navy_suit', d).ok).toBe(true);
    expect(money.clean).toBe(0);
    const m2 = { clean: 0, dirty: 0, bank: 1350 };
    expect(payDealer(m2, createFinance(), 0, 'beater_khaki', d)).toBe(true);
    expect(m2.bank).toBe(0);
    const st = createState(1, 'downtown', MAP.spawn);
    st.money.clean = priceOf('sandwich', d);
    expect(buy({ money: st.money, inventory: st.inventory, health: 50, discount: d }, 'sandwich').ok).toBe(
      true,
    );
  });

  it("the locker offers the job's uniform on top, then your own clothes", () => {
    const st = createState(1, 'downtown', MAP.spawn);
    st.career.current = 'mechanic';
    const ctx: ShopCtx = { state: st, wear: (o) => (st.look.outfit = o), buyCar: () => '' };
    const page = lockerPage(ctx, 'mechanic');
    expect(page.rows[0]).toMatchObject({ label: 'UNIFORM', enabled: true });
    expect(page.rows.length).toBe(1 + st.wardrobe.length);
    page.rows[0]!.act?.();
    expect(st.look.outfit).toBe('coveralls');
    expect(lockerPage(ctx, 'mechanic').rows[0]).toMatchObject({ sub: 'WEARING IT', enabled: false });
    // someone else's locker: you can't take their uniform
    expect(lockerPage(ctx, 'delivery').rows[0]).toMatchObject({ enabled: false });
  });
});

import { describe, expect, it } from 'vitest';
import { BALANCE_CRIME } from '../src/config/balanceCrime';
import { Rng } from '../src/core/rng';
import { LAYOUTS, LAYOUT_IDS } from '../src/data/burglary';
import {
  burglaryStars,
  cutHousePanel,
  fencePrice,
  isNight,
  leaveHouse,
  occupancyHint,
  ownerSees,
  pickDoor,
  rollHouse,
  rollOccupant,
  rollRooms,
  scareOwner,
  searchRoom,
  sellToFence,
  startBurglary,
  tickBurglary,
  type House,
} from '../src/systems/burglary';
import { FixedRng } from './crimeTestUtil';

const B = BALANCE_CRIME.burglary;
const house = (alarm = false): House => ({ id: 'h1', layout: 'family', alarm });

describe('house burglary (docs/04)', () => {
  it('rolls $200–900 of goods spread over every room of the layout', () => {
    for (let seed = 1; seed < 60; seed++) {
      for (const id of LAYOUT_IDS) {
        const rooms = rollRooms(new Rng(seed), id);
        expect(rooms).toHaveLength(LAYOUTS[id].rooms.length);
        const total = rooms.flatMap((r) => r.goods).reduce((t, g) => t + g.value, 0);
        expect(total).toBeGreaterThanOrEqual(B.goods[0]);
        expect(total).toBeLessThanOrEqual(B.goods[1]);
        for (const r of rooms) expect(r.goods.length).toBeGreaterThan(0);
      }
    }
  });

  it('alarms about 1 in 3 houses', () => {
    const rng = new Rng(11);
    let alarmed = 0;
    for (let k = 0; k < 3000; k++) if (rollHouse(rng, `h${k}`).alarm) alarmed++;
    expect(alarmed / 3000).toBeGreaterThan(0.29);
    expect(alarmed / 3000).toBeLessThan(0.38);
  });

  it('reads occupancy from the driveway by day; owners sleep at night', () => {
    const noon = 12 * 60;
    expect(isNight(noon)).toBe(false);
    expect(isNight(23 * 60)).toBe(true);
    expect(isNight(3 * 60)).toBe(true);
    expect(rollOccupant(new FixedRng(0), noon, false)).toBe('empty');
    expect(rollOccupant(new FixedRng(0), noon, true)).toBe('awake');
    expect(rollOccupant(new FixedRng(0.99), noon, true)).toBe('empty');
    expect(rollOccupant(new FixedRng(0), 2 * 60, false)).toBe('asleep');
    expect(occupancyHint('awake', true, false)).toBe('maybe');
    expect(occupancyHint('empty', true, true)).toBe('empty');
    expect(occupancyHint('asleep', false, true)).toBe('home');
  });

  it('is 1★, or 2★ with the owner home', () => {
    expect(burglaryStars(startBurglary(new Rng(1), house(), 'empty'))).toBe(1);
    expect(burglaryStars(startBurglary(new Rng(1), house(), 'asleep'))).toBe(2);
  });

  it('empty house: pick, search every room, leave with the goods', () => {
    const s = startBurglary(new Rng(4), house(), 'empty');
    const money = { dirty: 0 };
    expect(searchRoom(s, 0, 'excellent', money)).toEqual([]); // door still locked
    expect(pickDoor(s, 'fail')).toBe(false);
    expect(pickDoor(s, 'good')).toBe(true);
    const all = s.rooms.flatMap((r) => r.goods).reduce((t, g) => t + g.value, 0);
    s.rooms.forEach((_, k) => searchRoom(s, k, 'excellent', money));
    expect(searchRoom(s, 0, 'excellent', money)).toEqual([]); // searched once
    let reports = 0;
    for (let k = 0; k < 600; k++) reports += tickBurglary(s, 0.1, new Rng(k)).length;
    expect(reports).toBe(0);
    const r = leaveHouse(s);
    expect(r.payout).toBe(all);
    expect(r.cash).toBe(money.dirty);
    expect(r.cash + r.goodsValue).toBe(all);
    expect(r.identified).toBe(false);
  });

  it('a poor search takes the most valuable third of a room', () => {
    const s = startBurglary(new Rng(8), { id: 'h', layout: 'bungalow', alarm: false }, 'empty');
    pickDoor(s, 'excellent');
    const room = s.rooms[2]!;
    const before = [...room.goods].sort((a, b) => b.value - a.value);
    const taken = searchRoom(s, 2, 'poor', { dirty: 0 });
    expect(taken).toEqual(before.slice(0, Math.round(before.length / 3)));
  });

  it('noise wakes a sleeping owner, whose call gets through 6–10 s later at 2★', () => {
    const s = startBurglary(new Rng(4), house(), 'asleep');
    const money = { dirty: 0 };
    pickDoor(s, 'fail');
    pickDoor(s, 'fail');
    pickDoor(s, 'good');
    searchRoom(s, 0, 'fail', money);
    expect(s.noise).toBeGreaterThanOrEqual(1);
    expect(tickBurglary(s, 0.1, new Rng(1))).toEqual([]);
    expect(s.occupant).toBe('calling');
    let out: unknown[] = [];
    for (let k = 0; k < 120 && out.length === 0; k++) out = tickBurglary(s, 0.1, new Rng(1));
    expect(out).toEqual([{ key: 'burglary', stars: 2 }]);
    expect(s.t).toBeGreaterThanOrEqual(6);
    expect(s.t).toBeLessThanOrEqual(10.3);
  });

  it('a quiet burglar does not wake them: noise fades', () => {
    const s = startBurglary(new Rng(4), house(), 'asleep');
    pickDoor(s, 'good');
    for (let k = 0; k < 3; k++) {
      searchRoom(s, k, 'good', { dirty: 0 });
      tickBurglary(s, 20, new Rng(1));
    }
    expect(s.occupant).toBe('asleep');
  });

  it('an owner who is scared off never gets through', () => {
    const s = startBurglary(new Rng(4), house(), 'awake');
    ownerSees(s, new Rng(1));
    expect(s.occupant).toBe('calling');
    expect(scareOwner(s)).toBe(true);
    let n = 0;
    for (let k = 0; k < 200; k++) n += tickBurglary(s, 0.1, new Rng(k)).length;
    expect(n).toBe(0);
  });

  it('the alarm panel must be cut within 10 s', () => {
    const ok = startBurglary(new Rng(4), house(true), 'empty');
    pickDoor(ok, 'good');
    tickBurglary(ok, 9, new Rng(1));
    expect(cutHousePanel(ok, true)).toEqual([]);
    expect(tickBurglary(ok, 60, new Rng(1))).toEqual([]);

    const late = startBurglary(new Rng(4), house(true), 'empty');
    pickDoor(late, 'good');
    expect(tickBurglary(late, 10.5, new Rng(1))).toEqual([{ key: 'burglary', stars: 1 }]);

    const botched = startBurglary(new Rng(4), house(true), 'asleep');
    pickDoor(botched, 'good');
    expect(cutHousePanel(botched, false)).toEqual([{ key: 'burglary', stars: 2 }]);
    tickBurglary(botched, 0.1, new Rng(1));
    expect(botched.occupant).toBe('calling'); // the siren wakes them too
  });

  it('the uniform identifies (docs/04)', () => {
    const s = startBurglary(new Rng(4), house(), 'empty', { uniform: true });
    expect(leaveHouse(s).identified).toBe(true);
  });
});

describe('the fence', () => {
  it('buys goods, phones and watches for dirty cash', () => {
    const money = { dirty: 10 };
    const stolen = { phones: 2, watches: 1 };
    const goods = [
      { kind: 'laptop' as const, value: 300 },
      { kind: 'jewellery' as const, value: 210 },
    ];
    expect(fencePrice(goods[0]!)).toBe(300);
    const paid = sellToFence(money, stolen, goods);
    expect(paid).toBe(510 + 2 * BALANCE_CRIME.fence.phone + BALANCE_CRIME.fence.watch);
    expect(money.dirty).toBe(10 + paid);
    expect(stolen).toEqual({ phones: 0, watches: 0 });
    expect(goods).toEqual([]);
  });
});

// House burglary (docs/04: tier 1, lockpick → search rooms (timed) → fence goods, $200–900 in goods, 1★ if seen
// and 2★ if the owner is home; decided 2026-10-11: 3 layouts, sleeping owners woken by noise, about 1 in 3 houses
// alarmed, occupancy read from the driveway). Pure state: the scene runs the minigames and the house interior.
// Also the fence's side of it: what the pawn shop pays for stolen goods.

import { BALANCE_CRIME } from '../config/balanceCrime';
import type { Rng } from '../core/rng';
import { LAYOUTS, LAYOUT_IDS, type GoodsKind, type LayoutId } from '../data/burglary';
import type { Grade } from './career';
import type { CrimeReport } from './reputation';

const B = () => BALANCE_CRIME.burglary;

/** A house in the world: its layout and whether it has an alarm panel. Fixed for the house. */
export interface House {
  id: string;
  layout: LayoutId;
  alarm: boolean;
}

/** Give a house its layout and alarm (once, when the world first meets it; saved with it). */
export function rollHouse(rng: Rng, id: string): House {
  return { id, layout: rng.pick(LAYOUT_IDS), alarm: rng.chance(B().alarmChance) };
}

export type Occupant = 'empty' | 'awake' | 'asleep';

export function isNight(minuteOfDay: number): boolean {
  const m = ((minuteOfDay % 1440) + 1440) % 1440;
  return m >= B().nightStart || m < B().nightEnd;
}

/**
 * Who's home when the player arrives (decided 2026-10-11). By day a house with no cars outside is empty, one with
 * cars outside may have someone in (awake). At night the owners are usually home and asleep.
 */
export function rollOccupant(rng: Rng, minuteOfDay: number, carsOutside: boolean): Occupant {
  if (isNight(minuteOfDay)) return rng.chance(B().homeChanceNight) ? 'asleep' : 'empty';
  if (!carsOutside) return 'empty';
  return rng.chance(B().homeChanceDayWithCars) ? 'awake' : 'empty';
}

/** What the player can tell from the street: the driveway, or the occupant itself with the delivery rank 3 perk. */
export function occupancyHint(
  occupant: Occupant,
  carsOutside: boolean,
  perk: boolean,
): 'empty' | 'maybe' | 'home' {
  if (perk) return occupant === 'empty' ? 'empty' : 'home';
  return carsOutside ? 'maybe' : 'empty';
}

export interface Goods {
  kind: GoodsKind;
  value: number;
}

export interface RoomLoot {
  goods: Goods[];
  searched: boolean;
}

export interface BurglaryState {
  house: House;
  /** Seconds since the job started. */
  t: number;
  uniform: boolean;
  occupant: Occupant | 'calling' | 'scared';
  /** When an owner's call gets through (seconds into the job). */
  callAt: number | null;
  /** 0–1; a sleeping owner wakes at 1. */
  noise: number;
  doorOpen: boolean;
  panel: 'armed' | 'cut' | 'tripped' | 'none';
  panelDeadline: number | null;
  rooms: RoomLoot[];
  /** What the player has taken: goods for the fence. Cash from cash tins goes straight to dirty money. */
  bag: Goods[];
  cash: number;
  reported: string[];
  done: boolean;
}

/** Roll the house's goods ($200–900 in all, docs/04), spread over its rooms by weight. */
export function rollRooms(rng: Rng, layout: LayoutId): RoomLoot[] {
  const rooms = LAYOUTS[layout].rooms;
  const total = rng.int(B().goods[0], B().goods[1]);
  const weights = rooms.reduce((s, r) => s + r.weight, 0);
  let left = total;
  return rooms.map((room, k) => {
    const roomValue = k === rooms.length - 1 ? left : Math.round((total * room.weight) / weights);
    left -= roomValue;
    const n = rng.int(room.items[0], room.items[1]);
    const goods: Goods[] = [];
    let roomLeft = roomValue;
    for (let i = 0; i < n; i++) {
      const value = i === n - 1 ? roomLeft : Math.round(roomLeft * (0.3 + 0.4 * rng.next()));
      roomLeft -= value;
      goods.push({ kind: rng.pick(room.goods), value });
    }
    return { goods, searched: false };
  });
}

export function startBurglary(
  rng: Rng,
  house: House,
  occupant: Occupant,
  opts: { uniform?: boolean } = {},
): BurglaryState {
  return {
    house,
    t: 0,
    uniform: opts.uniform ?? false,
    occupant,
    callAt: null,
    noise: 0,
    doorOpen: false,
    panel: house.alarm ? 'armed' : 'none',
    panelDeadline: null,
    rooms: rollRooms(rng, house.layout),
    bag: [],
    cash: 0,
    reported: [],
    done: false,
  };
}

/** Is someone in (docs/04: 2★ instead of 1★)? */
export function ownerHome(s: BurglaryState): boolean {
  return s.occupant !== 'empty';
}

/** Stars when this burglary is reported, by a witness, the owner or the alarm. */
export function burglaryStars(s: BurglaryState): number {
  return ownerHome(s) ? B().ownerHomeStars : B().stars;
}

function report(s: BurglaryState, key: string, out: CrimeReport[]): void {
  if (s.reported.includes(key)) return;
  s.reported.push(key);
  out.push({ key, stars: burglaryStars(s) });
}

function addNoise(s: BurglaryState, n: number): void {
  s.noise = Math.min(1, s.noise + n);
}

/** The front or back door lockpick. Any grade but a fail opens it; noise either way. Arms the alarm panel's timer. */
export function pickDoor(s: BurglaryState, grade: Grade): boolean {
  if (s.doorOpen || s.done) return s.doorOpen;
  addNoise(s, grade === 'fail' ? B().noise.lockpickFail : B().noise.lockpick);
  if (grade === 'fail') return false;
  s.doorOpen = true;
  if (s.panel === 'armed') s.panelDeadline = s.t + B().alarmPanelSeconds;
  return true;
}

function tripPanel(s: BurglaryState, out: CrimeReport[]): void {
  s.panel = 'tripped';
  s.panelDeadline = null;
  addNoise(s, B().noise.panelFail);
  report(s, 'burglary', out);
}

/** Cut the alarm panel (alarm bypass). A fail or a late cut sets it off: the police are called and anyone wakes. */
export function cutHousePanel(s: BurglaryState, success: boolean): CrimeReport[] {
  const out: CrimeReport[] = [];
  if (s.panel !== 'armed' || s.panelDeadline === null) return out;
  if (success && s.t <= s.panelDeadline) {
    s.panel = 'cut';
    s.panelDeadline = null;
  } else tripPanel(s, out);
  return out;
}

/**
 * Search a room (the timed search grid). The grade sets how much of the room's goods were grabbed, most valuable
 * first. Cash tins go straight into dirty money; the rest goes in the bag for the fence. Each room is searched once.
 */
export function searchRoom(s: BurglaryState, room: number, grade: Grade, money: { dirty: number }): Goods[] {
  const r = s.rooms[room];
  if (!r || r.searched || !s.doorOpen || s.done) return [];
  r.searched = true;
  addNoise(s, grade === 'fail' ? B().noise.searchFail : B().noise.search);
  const sorted = [...r.goods].sort((a, b) => b.value - a.value);
  const taken = sorted.slice(0, Math.round(sorted.length * B().grabShare[grade]));
  for (const g of taken) {
    if (g.kind === 'cash_tin') {
      s.cash += g.value;
      money.dirty += g.value;
    } else s.bag.push(g);
  }
  r.goods = sorted.filter((g) => !taken.includes(g));
  return taken;
}

function startCall(s: BurglaryState, rng: Rng): void {
  if (s.occupant === 'calling' || s.occupant === 'scared') return;
  s.occupant = 'calling';
  s.callAt = s.t + rng.range(B().ownerCallSeconds[0], B().ownerCallSeconds[1]);
}

/** An awake owner sees the player (the scene's line of sight): they start phoning the police. */
export function ownerSees(s: BurglaryState, rng: Rng): void {
  if (s.occupant === 'awake' && !s.done) startCall(s, rng);
}

/** Scare the owner off the phone (docs/05: get within 2 tiles and press E). No call goes through. */
export function scareOwner(s: BurglaryState): boolean {
  if (s.occupant !== 'calling') return false;
  s.occupant = 'scared';
  s.callAt = null;
  return true;
}

/**
 * One step. Noise fades while the player is quiet; a sleeping owner woken by noise picks up the phone, and the call
 * gets through 6–10 s later. An alarm panel not cut in time goes off.
 */
export function tickBurglary(s: BurglaryState, dt: number, rng: Rng): CrimeReport[] {
  const out: CrimeReport[] = [];
  if (s.done) return out;
  s.t += dt;
  if (s.panel === 'armed' && s.panelDeadline !== null && s.t > s.panelDeadline) tripPanel(s, out);
  if (s.occupant === 'asleep' && s.noise >= 1) startCall(s, rng);
  if (s.occupant === 'calling' && s.callAt !== null && s.t >= s.callAt) {
    s.callAt = null;
    report(s, 'burglary', out);
  }
  s.noise = Math.max(0, s.noise - B().noiseFade * dt);
  return out;
}

export interface BurglaryResult {
  /** Dirty cash found (cash tins). */
  cash: number;
  /** Goods for the fence, and what they'll fetch. */
  goods: Goods[];
  goodsValue: number;
  /** The payout reputation is earned on (docs/04: payout in goods). */
  payout: number;
  identified: boolean;
}

/** The player leaves the house with what they took. Houses have no cameras: only the work uniform identifies. */
export function leaveHouse(s: BurglaryState): BurglaryResult {
  s.done = true;
  const goodsValue = s.bag.reduce((t, g) => t + g.value, 0);
  return { cash: s.cash, goods: [...s.bag], goodsValue, payout: s.cash + goodsValue, identified: s.uniform };
}

// ---- The fence (docs/04 decisions: the pawn shop buys stolen goods) ----

/** What the fence pays for one burglary item. */
export function fencePrice(g: Goods): number {
  return Math.round(g.value * BALANCE_CRIME.fence.goodsShare);
}

/**
 * Sell everything stolen to the fence: burglary goods plus trunk phones and watches. Pays dirty cash, empties the
 * goods and the stolen-goods counts, and returns the total.
 */
export function sellToFence(
  money: { dirty: number },
  stolen: { phones: number; watches: number },
  goods: Goods[],
): number {
  const F = BALANCE_CRIME.fence;
  const total =
    goods.reduce((t, g) => t + fencePrice(g), 0) + stolen.phones * F.phone + stolen.watches * F.watch;
  money.dirty += total;
  stolen.phones = 0;
  stolen.watches = 0;
  goods.length = 0;
  return total;
}

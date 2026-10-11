// The wanted level (docs/05): stars, being seen, the search circle, the escape timer, and what an arrest costs.
// Pure code. Police movement lives in world/police.ts; witnesses are people from systems/crowd.ts.

import { BALANCE } from '../config/balance';
import { TILE } from '../config/constants';

export interface WantedState {
  stars: number;
  /** Police can see the player right now. */
  seen: boolean;
  /** Where the police last saw the player (or where the crime was reported): the search circle's centre. */
  lastKnown: { x: number; y: number } | null;
  /** Seconds left out of sight and outside the circle before the stars clear. */
  escape: number;
}

export function emptyWanted(): WantedState {
  return { stars: 0, seen: false, lastKnown: null, escape: 0 };
}

const W = () => BALANCE.wanted;

export function escapeSecondsFor(stars: number): number {
  return W().escapeSeconds[Math.max(0, Math.min(stars, W().maxStars) - 1)] ?? 0;
}

export function searchRadius(stars: number): number {
  return (W().searchTiles[Math.max(0, Math.min(stars, W().maxStars) - 1)] ?? 0) * TILE;
}

/** A crime was detected (a witness's call got through, an officer saw it, an alarm): stars stack, capped at 5. */
export function addStars(w: WantedState, n: number, at: { x: number; y: number }): void {
  w.stars = Math.min(W().maxStars, w.stars + n);
  w.lastKnown = { ...at };
  w.escape = escapeSecondsFor(w.stars);
}

/**
 * One step. While police see the player the circle follows them and the timer resets; out of sight the stars
 * flash, and the timer only runs while the player is outside the circle. Returns true when the stars just cleared.
 */
export function tickWanted(w: WantedState, dt: number, seenNow: boolean, player: { x: number; y: number }): boolean {
  if (w.stars <= 0) return false;
  w.seen = seenNow;
  if (seenNow) {
    w.lastKnown = { ...player };
    w.escape = escapeSecondsFor(w.stars);
    return false;
  }
  const c = w.lastKnown ?? player;
  if (Math.hypot(player.x - c.x, player.y - c.y) > searchRadius(w.stars)) w.escape -= dt;
  if (w.escape <= 0) {
    Object.assign(w, emptyWanted());
    return true;
  }
  return false;
}

export interface ArrestOutcome {
  repeat: boolean;
  fine: number;
  /** What was actually paid (you can't pay more clean cash than you carry). */
  paid: number;
  jailDays: number;
  /** Dirty cash taken (repeat offenses only, docs/05). */
  seized: number;
}

/**
 * What an arrest costs (docs/05, docs/02). First offense: the fine for the stars. Repeat offense (an arrest in the
 * last 14 in-game days): jail days plus the fine, and all carried dirty cash is seized. Surrendering cuts the fine
 * by 30% and the jail by a day. Records the arrest and moves the money.
 */
export function arrest(
  money: { clean: number; dirty: number },
  record: { arrests: number[] },
  stars: number,
  now: number,
  surrendered: boolean,
): ArrestOutcome {
  const k = Math.max(1, Math.min(stars, W().maxStars)) - 1;
  const window = W().recordDays * 24 * 60;
  const repeat = record.arrests.some((m) => now - m < window);
  const fine = Math.round((W().fines[k] as number) * (surrendered ? 1 - W().surrenderFineCut : 1));
  const jailDays = repeat ? Math.max(0, (W().jailDays[k] as number) - (surrendered ? 1 : 0)) : 0;
  const paid = Math.min(fine, Math.max(0, money.clean));
  money.clean -= paid;
  const seized = repeat ? money.dirty : 0;
  money.dirty -= seized;
  record.arrests.push(now);
  return { repeat, fine, paid, jailDays, seized };
}

/** Does the segment from a to b pass through any of these boxes (building footprints)? Sight lines outdoors. */
export function blockedBy(
  a: { x: number; y: number },
  b: { x: number; y: number },
  boxes: readonly (readonly [number, number, number, number])[],
): boolean {
  for (const [x0, y0, x1, y1] of boxes) {
    // slab test
    let t0 = 0;
    let t1 = 1;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    let ok = true;
    for (const [p, d, lo, hi] of [
      [a.x, dx, x0, x1],
      [a.y, dy, y0, y1],
    ] as const) {
      if (Math.abs(d) < 1e-9) {
        if (p < lo || p > hi) ok = false;
      } else {
        let ta = (lo - p) / d;
        let tb = (hi - p) / d;
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta);
        t1 = Math.min(t1, tb);
        if (t0 > t1) ok = false;
      }
      if (!ok) break;
    }
    if (ok) return true;
  }
  return false;
}

/** Can someone at `eye` see `target` within `rangeTiles`, with nothing in between? */
export function canSee(
  eye: { x: number; y: number },
  target: { x: number; y: number },
  rangeTiles: number,
  boxes: readonly (readonly [number, number, number, number])[],
): boolean {
  if (Math.hypot(eye.x - target.x, eye.y - target.y) > rangeTiles * TILE) return false;
  return !blockedBy(eye, target, boxes);
}

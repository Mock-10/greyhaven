// Bolt torque (mechanic, docs/06): the core skill check, but each check is one bolt. A needle sweeps the dial; press
// Space inside the zone to torque the next nut in a star pattern. Great zone: torqued just right; good zone: torqued;
// a miss over-torques (the nut stays loose and the zone moves). Too many misses strip the stud: a fail.

import { BALANCE } from '../config/balance';
import { BALANCE_JOBS } from '../config/balanceJobs';
import type { Rng } from '../core/rng';
import type { Grade } from '../systems/career';
import type { MinigameLogic } from './logic';

/** The order a mechanic tightens `n` nuts round a hub: across the wheel, never next to the last one. */
export function starOrder(n: number): number[] {
  if (n % 2 === 1) return Array.from({ length: n }, (_, k) => (k * 2) % n);
  const half = n / 2;
  return Array.from({ length: n }, (_, k) => (k % 2 === 0 ? k / 2 : half + (k - 1) / 2));
}

export type BoltState = 'loose' | 'good' | 'great';

export class BoltTorqueGame implements MinigameLogic {
  readonly speed: number;
  readonly good: number;
  readonly great: number;
  /** Nuts on the hub, and the order they are torqued in. */
  readonly bolts: number;
  readonly order: number[];
  readonly state: BoltState[];
  /** How many nuts are done (an index into `order`). */
  step = 0;
  /** Needle angle in degrees, 0 at the top, clockwise. */
  needle = 0;
  /** Centre of the current zone, degrees. */
  zone = 0;
  greats = 0;
  misses = 0;
  flash: { ok: boolean; t: number } | null = null;
  done = false;
  grade: Grade | null = null;

  constructor(
    private rng: Rng,
    tier = 1,
  ) {
    const t = BALANCE.minigames.skillTiers[tier] ?? BALANCE.minigames.skillTiers[0]!;
    this.speed = t.speed;
    this.good = t.good;
    this.great = t.great;
    this.bolts = Math.max(BALANCE_JOBS.boltTorque.minBolts, t.checks);
    this.order = starOrder(this.bolts);
    this.state = this.order.map(() => 'loose');
    this.newZone();
  }

  /** The nut being torqued now (its place round the hub), or null when done. */
  get bolt(): number | null {
    return this.done ? null : (this.order[this.step] ?? null);
  }

  get progress(): number {
    return this.step / this.bolts;
  }

  private newZone(): void {
    // keep the zone away from the needle so the player has time to react (as the lockpick does)
    this.zone = (this.needle + 120 + this.rng.next() * 180) % 360;
  }

  hit(): void {
    const b = this.bolt;
    if (b === null) return;
    const d = Math.abs(((this.needle - this.zone + 540) % 360) - 180);
    if (d <= this.good / 2) {
      const great = d <= this.great / 2;
      this.state[b] = great ? 'great' : 'good';
      if (great) this.greats++;
      this.step++;
      this.flash = { ok: true, t: 0 };
    } else {
      this.misses++;
      this.flash = { ok: false, t: 0 };
    }
    if (this.step >= this.bolts) this.finish(true);
    else if (this.misses >= BALANCE_JOBS.boltTorque.maxMisses) this.finish(false);
    else this.newZone();
  }

  private finish(ok: boolean): void {
    this.done = true;
    if (!ok) this.grade = 'fail';
    else if (this.misses === 0) this.grade = this.greats >= Math.ceil(this.bolts / 2) ? 'excellent' : 'good';
    else this.grade = this.misses === 1 ? 'ok' : 'poor';
  }

  update(dt: number): void {
    if (this.flash) this.flash.t += dt;
    if (this.done) return;
    this.needle = (this.needle + this.speed * 360 * dt) % 360;
  }
}

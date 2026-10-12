// Car effects (docs/08, docs/13): exhaust from a running engine, skid marks and tyre smoke under hard braking,
// handbrake turns and sharp turns at speed, dust on soft ground, and chips, sparks and a camera shake on a
// crash. Pure: give it the car each frame, get back what to spawn.

import { FX } from '../config/balanceFx';
import type { FxEvent } from './events';
import { Emitter } from './particles';
import { FX_PRESETS } from '../data/fxPresets';

export interface CarFxInput {
  x: number;
  y: number;
  heading: number;
  /** Signed speed along the heading (world units a second). */
  speed: number;
  running: boolean;
  halfLength: number;
  halfWidth: number;
  /** -1–1 (negative brakes). */
  throttle: number;
  handbrake: boolean;
  /** Impact speed this frame (vehicle.drive's return), 0 when nothing was hit. */
  impact: number;
  /** Dirt, grass or gravel under the car. */
  soft: boolean;
}

export interface CarFxOut {
  events: FxEvent[];
  /** Screen-pixel camera shake to start (0 = none). */
  shake: number;
  /** True while the tyres are skidding (the sound layer can screech). */
  skidding: boolean;
}

const dirOf = (heading: number): number => ((Math.round(heading / (Math.PI / 4)) % 8) + 8) % 8;

export class CarFx {
  private exhaust = new Emitter(FX_PRESETS.exhaust, 0);
  private smoke = new Emitter(FX_PRESETS.tyreSmoke, 0);
  private dust = new Emitter(FX_PRESETS.wheelDust, 0);
  private prev: { speed: number; heading: number } | null = null;
  private skidRun = 0;

  update(dt: number, c: CarFxInput): CarFxOut {
    const W = FX.world;
    const events: FxEvent[] = [];
    const cos = Math.cos(c.heading);
    const sin = Math.sin(c.heading);
    /** A point on the car: `along` the heading from the centre, `side` to its right. */
    const at = (along: number, side: number) => ({
      x: c.x + cos * along - sin * side,
      y: c.y + sin * along + cos * side,
    });
    const vx = cos * c.speed;
    const vy = sin * c.speed;
    // exhaust from the tailpipe (rear, a little to one side)
    this.exhaust.rate = c.running ? W.exhaustIdle + Math.max(0, c.throttle) * W.exhaustThrottle : 0;
    const nEx = this.exhaust.tick(dt);
    if (nEx > 0) {
      const p = at(-c.halfLength * 0.95, c.halfWidth * 0.45);
      events.push({
        preset: 'exhaust',
        x: p.x,
        y: p.y,
        z: 3,
        n: nEx,
        opts: { angle: c.heading + Math.PI, vx: vx * 0.3, vy: vy * 0.3 },
      });
    }
    // skids: hard braking, the handbrake or a sharp turn at speed
    let skidding = false;
    const speed = Math.abs(c.speed);
    if (this.prev && dt > 0) {
      const decel = (Math.abs(this.prev.speed) - speed) / dt;
      let dh = c.heading - this.prev.heading;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      const turnRate = Math.abs(dh) / dt;
      // braking forward (not reversing) counts even when a slow frame hides the deceleration
      skidding =
        speed > W.skidSpeed &&
        (c.throttle >= 0 || c.speed > 0) &&
        (decel > W.skidDecel || c.throttle < -0.5 || c.handbrake || turnRate > W.skidTurn) &&
        c.impact === 0;
    }
    if (skidding) {
      this.skidRun += speed * dt;
      while (this.skidRun >= W.skidEvery) {
        this.skidRun -= W.skidEvery;
        for (const side of [-1, 1]) {
          const p = at(-c.halfLength * 0.6, side * c.halfWidth * 0.8);
          events.push({ preset: 'skid', x: p.x, y: p.y, z: 0, n: 1, opts: { dir: dirOf(c.heading) } });
        }
      }
      this.smoke.rate = W.tyreSmokeRate;
    } else {
      this.skidRun = 0;
      this.smoke.rate = 0;
    }
    const nSm = this.smoke.tick(dt);
    if (nSm > 0) {
      const p = at(-c.halfLength * 0.6, 0);
      events.push({
        preset: 'tyreSmoke',
        x: p.x,
        y: p.y,
        z: 2,
        n: nSm,
        opts: { vx: vx * 0.2, vy: vy * 0.2 },
      });
    }
    // dust off the wheels on soft ground
    this.dust.rate = c.soft && speed > W.dustSpeed ? W.wheelDustRate * Math.min(1, speed / 200) : 0;
    const nDu = this.dust.tick(dt);
    if (nDu > 0) {
      const p = at(-c.halfLength * 0.7, 0);
      events.push({
        preset: 'wheelDust',
        x: p.x,
        y: p.y,
        z: 1,
        n: nDu,
        opts: { angle: c.heading + Math.PI },
      });
    }
    // a crash: chips and sparks off the front (or the back when reversing), and a shake
    let shake = 0;
    if (c.impact > W.crashMin) {
      const k = c.impact / 100;
      const p = at(Math.sign(c.speed || 1) * c.halfLength, 0);
      const n = (per: number) => Math.min(W.crashMaxEach, Math.max(1, Math.round(per * k)));
      const away = c.heading + (c.speed < 0 ? 0 : Math.PI);
      events.push({ preset: 'chips', x: p.x, y: p.y, z: 6, n: n(W.crashChipsPer100), opts: { angle: away } });
      events.push({
        preset: 'sparks',
        x: p.x,
        y: p.y,
        z: 4,
        n: n(W.crashSparksPer100),
        opts: { angle: away },
      });
      events.push({ preset: 'wheelDust', x: p.x, y: p.y, z: 1, n: 2 });
      shake = Math.min(W.crashShakeMax, Math.max(1, Math.round(W.crashShakePer100 * k)));
    }
    this.prev = { speed: c.speed, heading: c.heading };
    return { events, shake, skidding };
  }

  reset(): void {
    this.prev = null;
    this.skidRun = 0;
  }
}

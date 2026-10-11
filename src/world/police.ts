// The police in the street (docs/05, milestone 4: one cruiser and two officers at 1–2★). The cruiser drives the
// roads to the reported spot or after the player's car; the officers get out, search the circle, chase the player on
// foot and try to bust them. Their sight decides whether the stars flash (systems/wanted.ts).

import type Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { DIRS, TILE } from '../config/constants';
import type { Rng } from '../core/rng';
import { characterFrame, vehicleFrame } from '../assets/sprites';
import { facingFromWorld, worldToScreen } from '../iso/projection';
import type { Obb } from '../iso/staticDepth';
import { moveWithCollision, type CollisionRules, type Solid } from '../systems/movement';
import { route, type RoadGraph } from '../systems/roads';
import { canSee, searchRadius, type WantedState } from '../systems/wanted';
import { dirOf, drive, exitSpots, parkedCar, stats, type Vehicle } from '../systems/vehicle';

type Box = readonly [number, number, number, number];

export interface PoliceHost {
  place(sprite: Phaser.GameObjects.Sprite, x: number, y: number, r: number): void;
  ensureWalkAnims(costume: string): void;
  carShadow(model: string, dir: number): string;
  layer: Phaser.GameObjects.Layer;
  groundLayer: Phaser.GameObjects.Layer;
  rng: Rng;
  roads: RoadGraph;
  /** Static solids plus other cars (the cruiser collides with them). */
  solids(): Solid[];
  rules: CollisionRules;
  /** Building footprints: they block sight. */
  buildings: readonly Box[];
  /** Where the cruiser starts: Precinct 1. */
  base: { x: number; y: number; dir: number };
}

interface Officer {
  x: number;
  y: number;
  fx: number;
  fy: number;
  inCar: boolean;
  goal: { x: number; y: number } | null;
  goalT: number;
  sprite: Phaser.GameObjects.Sprite;
}

export interface PlayerView {
  x: number;
  y: number;
  /** In a car going faster than walking pace. */
  driving: boolean;
  /** The car's speed, or 0 on foot. */
  speed: number;
}

export class Police {
  cruiser: {
    v: Vehicle;
    sprite: Phaser.GameObjects.Sprite;
    shadow: Phaser.GameObjects.Image;
    path: { x: number; y: number }[];
    planned: { x: number; y: number } | null;
    planT: number;
    stuckT: number;
    reverseT: number;
  } | null = null;
  officers: Officer[] = [];
  private fade = 0;

  constructor(
    private scene: Phaser.Scene,
    private host: PoliceHost,
  ) {}

  get active(): boolean {
    return this.cruiser !== null;
  }

  /** Where the police are, for the radar. */
  blips(): { x: number; y: number }[] {
    const out = this.officers.filter((o) => !o.inCar).map((o) => ({ x: o.x, y: o.y }));
    if (this.cruiser) out.push({ x: this.cruiser.v.x, y: this.cruiser.v.y });
    return out;
  }

  private spawn(): void {
    const b = this.host.base;
    const v = parkedCar('police', 'police_car', b.x, b.y, b.dir);
    v.locked = false;
    v.running = true;
    const ref = vehicleFrame('police_car', b.dir);
    const sprite = this.scene.add.sprite(0, 0, ref.atlas, ref.frame);
    this.host.layer.add(sprite);
    const shadow = this.scene.add.image(0, 0, this.host.carShadow('police_car', b.dir)).setDepth(1e6 - 2);
    this.host.groundLayer.add(shadow);
    this.cruiser = { v, sprite, shadow, path: [], planned: null, planT: 0, stuckT: 0, reverseT: 0 };
    this.host.ensureWalkAnims('police_officer');
    for (let k = 0; k < BALANCE.police.officers; k++) {
      const s = this.scene.add.sprite(0, 0, 'characters', characterFrame('police_officer', 'idle', 0).frame);
      s.setVisible(false);
      this.host.layer.add(s);
      this.officers.push({ x: b.x, y: b.y, fx: 1, fy: 0, inCar: true, goal: null, goalT: 0, sprite: s });
    }
    this.fade = 0;
  }

  destroy(): void {
    if (this.cruiser) {
      this.cruiser.sprite.destroy();
      this.cruiser.shadow.destroy();
    }
    for (const o of this.officers) o.sprite.destroy();
    this.cruiser = null;
    this.officers = [];
  }

  /** Can any officer (or the cruiser's crew) see this point? */
  sees(p: { x: number; y: number }): boolean {
    const range = BALANCE.wanted.policeSightTiles;
    const eyes = this.officers.map((o) =>
      o.inCar && this.cruiser ? { x: this.cruiser.v.x, y: this.cruiser.v.y } : o,
    );
    return eyes.some((e) => canSee(e, p, range, this.host.buildings));
  }

  /**
   * One step. Returns how many officers are close enough to bust the player (docs/05: within 1.5 tiles while on
   * foot or in a stopped car).
   */
  update(dt: number, w: WantedState, player: PlayerView): number {
    if (w.stars > 0 && !this.cruiser) this.spawn();
    const c = this.cruiser;
    if (!c) return 0;
    if (w.stars === 0) {
      // the chase is over: they fade away
      this.fade += dt;
      const a = Math.max(0, 1 - this.fade / 2);
      c.sprite.setAlpha(a);
      c.shadow.setAlpha(a);
      for (const o of this.officers) o.sprite.setAlpha(a);
      if (a <= 0) this.destroy();
      return 0;
    }
    const P = BALANCE.police;
    const target = w.seen || !w.lastKnown ? { x: player.x, y: player.y } : w.lastKnown;
    const aboard = this.officers.every((o) => o.inCar);
    // officers on foot go back to the car when the player drives off
    if (player.driving && !aboard) {
      for (const o of this.officers)
        if (!o.inCar) {
          o.goal = { x: c.v.x, y: c.v.y };
          if (Math.hypot(o.x - c.v.x, o.y - c.v.y) < 40) o.inCar = true;
        }
    }
    if (aboard) this.driveCruiser(dt, target, player, w);
    else {
      c.v.speed = 0;
    }
    // get out when close to a player on foot, or at the reported spot
    const dTarget = Math.hypot(c.v.x - target.x, c.v.y - target.y);
    if (
      aboard &&
      !player.driving &&
      Math.abs(c.v.speed) < 30 &&
      (dTarget < P.arriveDistance * 3 || this.pathLeft(c) < P.arriveDistance)
    ) {
      const spots = exitSpots(c.v, BALANCE.walker.radius);
      this.officers.forEach((o, k) => {
        const s = spots[k] ?? spots[0]!;
        o.x = s.x;
        o.y = s.y;
        o.inCar = false;
      });
    }
    let busting = 0;
    for (const o of this.officers) {
      o.sprite.setVisible(!o.inCar);
      if (o.inCar) continue;
      if (!player.driving) {
        const chase = w.seen || this.sees(player);
        if (chase) o.goal = { x: player.x, y: player.y };
        else {
          o.goalT -= dt;
          if (!o.goal || o.goalT <= 0 || Math.hypot(o.goal.x - o.x, o.goal.y - o.y) < 12) {
            const r = searchRadius(w.stars) * this.host.rng.next() * 0.8;
            const a = this.host.rng.next() * Math.PI * 2;
            const ctr = w.lastKnown ?? player;
            o.goal = { x: ctr.x + Math.cos(a) * r, y: ctr.y + Math.sin(a) * r };
            o.goalT = P.searchPointSeconds;
          }
        }
      }
      if (o.goal) {
        const dx = o.goal.x - o.x;
        const dy = o.goal.y - o.y;
        const d = Math.hypot(dx, dy);
        const run = w.seen || player.driving ? P.runSpeed : P.walkSpeed;
        if (d > 4) {
          const step = Math.min(d, run * dt);
          const m = moveWithCollision(
            o.x,
            o.y,
            (dx / d) * step,
            (dy / d) * step,
            this.host.solids(),
            this.host.rules,
          );
          o.x = m.x;
          o.y = m.y;
          o.fx = dx / d;
          o.fy = dy / d;
        }
        const dir = facingFromWorld(o.fx, o.fy);
        const anim = `walk-police_officer-${DIRS[dir]}`;
        if (d > 4) {
          if (o.sprite.anims.currentAnim?.key !== anim) o.sprite.play(anim, true);
          o.sprite.anims.timeScale = run > P.walkSpeed ? BALANCE.walker.sprintFpsMultiplier : 1;
        } else {
          o.sprite.stop();
          o.sprite.setFrame(characterFrame('police_officer', 'idle', dir).frame);
        }
      }
      this.host.place(o.sprite, o.x, o.y, BALANCE.walker.radius);
      const near = Math.hypot(o.x - player.x, o.y - player.y) <= BALANCE.wanted.bustTiles * TILE;
      if (near && (!player.driving || player.speed < BALANCE.wanted.stoppedCarSpeed)) busting++;
    }
    this.drawCruiser();
    return busting;
  }

  private driveCruiser(
    dt: number,
    target: { x: number; y: number },
    player: PlayerView,
    w: WantedState,
  ): void {
    const c = this.cruiser!;
    const P = BALANCE.police;
    c.planT -= dt;
    const moved = !c.planned || Math.hypot(c.planned.x - target.x, c.planned.y - target.y) > 3 * TILE;
    if (c.planT <= 0 || moved) {
      c.path = route(this.host.roads, c.v, target);
      c.planned = { ...target };
      c.planT = 1.5;
    }
    // close and in sight: drive straight at the player's car
    const direct = player.driving && w.seen && Math.hypot(player.x - c.v.x, player.y - c.v.y) < 6 * TILE;
    while (c.path.length > 1 && Math.hypot(c.path[0]!.x - c.v.x, c.path[0]!.y - c.v.y) < P.lookAhead)
      c.path.shift();
    const aim = direct ? target : (c.path[0] ?? target);
    const left = direct ? Math.hypot(target.x - c.v.x, target.y - c.v.y) : this.pathLeft(c);
    const want = Math.atan2(aim.y - c.v.y, aim.x - c.v.x);
    let diff = want - c.v.heading;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    let throttle = left < P.arriveDistance && !player.driving ? -1 : Math.abs(diff) > 1.6 ? 0.4 : 1;
    let steer = Math.max(-1, Math.min(1, diff * 2.2));
    if (c.reverseT > 0) {
      c.reverseT -= dt;
      throttle = -1;
      steer = -steer;
    }
    if (throttle < 0 && c.v.speed <= 0 && c.reverseT <= 0) throttle = 0;
    drive(c.v, { throttle, steer, handbrake: false }, dt, this.host.solids(), this.host.rules);
    // stuck against something: back up a little
    if (throttle > 0 && Math.abs(c.v.speed) < 10) c.stuckT += dt;
    else c.stuckT = 0;
    if (c.stuckT > 1.2) {
      c.reverseT = 0.9;
      c.stuckT = 0;
    }
  }

  private pathLeft(c: NonNullable<Police['cruiser']>): number {
    let d = 0;
    let prev = { x: c.v.x, y: c.v.y };
    for (const p of c.path) {
      d += Math.hypot(p.x - prev.x, p.y - prev.y);
      prev = p;
    }
    return d;
  }

  private drawCruiser(): void {
    const c = this.cruiser!;
    const dir = dirOf(c.v.heading);
    const ref = vehicleFrame('police_car', dir);
    if (c.sprite.frame.name !== ref.frame) {
      c.sprite.setFrame(ref.frame);
      c.shadow.setTexture(this.host.carShadow('police_car', dir));
    }
    const s = worldToScreen(c.v.x, c.v.y);
    c.shadow.setPosition(Math.round(s.x), Math.round(s.y));
    this.host.place(c.sprite, c.v.x, c.v.y, stats(c.v).halfLength * 0.7);
  }

  /** The cruiser as a turned box, for collisions and sorting. */
  cruiserBox(): Obb | null {
    const c = this.cruiser;
    if (!c) return null;
    const S = stats(c.v);
    return { x: c.v.x, y: c.v.y, hx: S.halfLength, hy: S.halfWidth, ang: c.v.heading };
  }
}

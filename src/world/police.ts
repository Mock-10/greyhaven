// The police in the street (docs/05). Milestone 4 sent one cruiser and two officers; Phase 3 runs the full 1–5★
// response from systems/response.ts: cruisers, SWAT vans and armored SUVs leave Precinct 1 one after another with
// their crews, a helicopter circles over the player from 4★, and roadblocks go up across the road ahead from 3★.
// Each unit drives the roads to the reported spot or after the player's car; the crews get out, search the circle,
// chase the player on foot and try to bust them. Their sight decides whether the stars flash (systems/wanted.ts).

import type Phaser from 'phaser';
import vehicles2Json from '../../art/vehicles2.json';
import { FX_TEXTURE } from '../fx/fxAssets';
import { BALANCE } from '../config/balance';
import { DIRS, TILE } from '../config/constants';
import type { Rng } from '../core/rng';
import { characterFrame, vehicleFrame } from '../assets/sprites';
import { facingFromWorld, worldToScreen } from '../iso/projection';
import type { Obb } from '../iso/staticDepth';
import { moveWithCollision, type CollisionRules, type Solid } from '../systems/movement';
import { pointAt } from '../systems/paths';
import { escalate, planResponse, roadblockChancePerMinute, type ResponsePlan } from '../systems/response';
import { onRoad, route, type RoadGraph } from '../systems/roads';
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
  /** Static solids plus other cars (the units collide with them). */
  solids(): Solid[];
  rules: CollisionRules;
  /** Building footprints: they block sight. */
  buildings: readonly Box[];
  /** Where the units start: Precinct 1. */
  base: { x: number; y: number; dir: number };
}

export interface Officer {
  x: number;
  y: number;
  fx: number;
  fy: number;
  inCar: boolean;
  goal: { x: number; y: number } | null;
  goalT: number;
  sprite: Phaser.GameObjects.Sprite;
}

export interface Unit {
  model: string;
  v: Vehicle;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  crew: Officer[];
  path: { x: number; y: number }[];
  planned: { x: number; y: number } | null;
  planT: number;
  stuckT: number;
  reverseT: number;
  /** A roadblock: parked across the road, never drives. */
  parked: boolean;
  /** The roadblock's spike strip (docs/05 3★): across the road on the side the player comes from. */
  spikes?: { x: number; y: number; ang: number; img: Phaser.GameObjects.Image };
  /** Where this unit aims, off the shared target so they spread out. */
  offset: { x: number; y: number };
}

interface Heli {
  x: number;
  y: number;
  ang: number;
  dir: number;
  body: Phaser.GameObjects.Sprite;
  rotor: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Sprite;
  t: number;
}

export interface PlayerView {
  x: number;
  y: number;
  /** In a car going faster than walking pace. */
  driving: boolean;
  /** The car's speed, or 0 on foot. */
  speed: number;
  /** The car's heading (for roadblocks ahead). */
  heading?: number;
}

const MODEL = { cruiser: 'police_car', swat: 'swat_van', armored: 'armored_suv_police' } as const;
type Kind = keyof typeof MODEL;

export class Police {
  units: Unit[] = [];
  helis: Heli[] = [];
  /** Units still to leave the precinct, in order. */
  private queue: Kind[] = [];
  private spawnT = 0;
  private plan: ResponsePlan | null = null;
  private fade = 0;

  constructor(
    private scene: Phaser.Scene,
    private host: PoliceHost,
  ) {}

  get active(): boolean {
    return this.units.length > 0 || this.helis.length > 0;
  }

  /** Every officer on the street (for sorting and the radar). */
  get officers(): Officer[] {
    return this.units.flatMap((u) => u.crew);
  }

  /** Where the police are, for the radar. */
  blips(): { x: number; y: number }[] {
    const out = this.officers.filter((o) => !o.inCar).map((o) => ({ x: o.x, y: o.y }));
    for (const u of this.units) out.push({ x: u.v.x, y: u.v.y });
    for (const h of this.helis) out.push({ x: h.x, y: h.y });
    return out;
  }

  /** The stars changed: queue the units the response is short of (the response stacks, docs/05). */
  private respond(stars: number): void {
    const rng = this.host.rng;
    const next = this.plan ? escalate(this.plan, stars, rng) : planResponse(stars, rng);
    const have = (k: Kind) =>
      this.units.filter((u) => !u.parked && u.model === MODEL[k]).length +
      this.queue.filter((q) => q === k).length;
    const want: Record<Kind, number> = { cruiser: next.cruisers, swat: next.swatVans, armored: next.armored };
    for (const k of ['cruiser', 'swat', 'armored'] as const)
      for (let n = have(k); n < want[k]; n++) this.queue.push(k);
    while (this.helis.length < next.helicopters) this.spawnHeli();
    this.plan = next;
  }

  private makeUnit(kind: Kind, x: number, y: number, dir: number, parked: boolean): Unit {
    const model = MODEL[kind];
    const v = parkedCar(`police${this.units.length}`, model, x, y, dir);
    v.locked = false;
    v.running = !parked;
    const ref = vehicleFrame(model, dir);
    const sprite = this.scene.add.sprite(0, 0, ref.atlas, ref.frame);
    this.host.layer.add(sprite);
    const shadow = this.scene.add.image(0, 0, this.host.carShadow(model, dir)).setDepth(1e6 - 2);
    this.host.groundLayer.add(shadow);
    this.host.ensureWalkAnims('police_officer');
    const n =
      kind === 'cruiser' ? BALANCE.policeRules.officersPerCruiser : BALANCE.policeRules.officersPerVan;
    const crew: Officer[] = [];
    for (let k = 0; k < n; k++) {
      const s = this.scene.add.sprite(0, 0, 'characters', characterFrame('police_officer', 'idle', 0).frame);
      s.setVisible(false);
      this.host.layer.add(s);
      crew.push({ x, y, fx: 1, fy: 0, inCar: true, goal: null, goalT: 0, sprite: s });
    }
    const spread = BALANCE.police.spreadUnits;
    const a = this.host.rng.next() * Math.PI * 2;
    const k = this.units.length;
    const unit: Unit = {
      model,
      v,
      sprite,
      shadow,
      crew,
      path: [],
      planned: null,
      planT: 0,
      stuckT: 0,
      reverseT: 0,
      parked,
      offset: k === 0 ? { x: 0, y: 0 } : { x: Math.cos(a) * spread, y: Math.sin(a) * spread },
    };
    this.units.push(unit);
    return unit;
  }

  private spawnHeli(): void {
    const b = this.host.base;
    const body = this.scene.add.sprite(0, 0, 'vehicles2', 'helicopter/S');
    const rotor = this.scene.add.sprite(0, 0, 'vehicles2', 'helicopter_rotor/f0');
    const shadow = this.scene.add.sprite(0, 0, 'vehicles2', 'helicopter_shadow/S');
    // the helicopter flies over everything: above the street layer's sort range
    body.setDepth(2e6);
    rotor.setDepth(2e6 + 1);
    this.host.layer.add(body);
    this.host.layer.add(rotor);
    this.host.groundLayer.add(shadow);
    shadow.setDepth(1e6 - 1);
    this.helis.push({ x: b.x, y: b.y, ang: 0, dir: 2, body, rotor, shadow, t: 0 });
  }

  destroy(): void {
    for (const u of this.units) {
      u.spikes?.img.destroy();
      u.sprite.destroy();
      u.shadow.destroy();
      for (const o of u.crew) o.sprite.destroy();
    }
    for (const h of this.helis) {
      h.body.destroy();
      h.rotor.destroy();
      h.shadow.destroy();
    }
    this.units = [];
    this.helis = [];
    this.queue = [];
    this.plan = null;
  }

  /** Can any officer, unit crew or helicopter see this point? Helicopters look over the buildings. */
  sees(p: { x: number; y: number }): boolean {
    const range = BALANCE.wanted.policeSightTiles;
    for (const u of this.units)
      for (const o of u.crew) {
        const e = o.inCar ? { x: u.v.x, y: u.v.y } : o;
        if (canSee(e, p, range, this.host.buildings)) return true;
      }
    const H = BALANCE.police.heli;
    return this.helis.some((h) => Math.hypot(h.x - p.x, h.y - p.y) <= H.sightTiles * TILE);
  }

  /**
   * One step. Returns how many officers are close enough to bust the player (docs/05: within 1.5 tiles while on
   * foot or in a stopped car).
   */
  update(dt: number, w: WantedState, player: PlayerView): number {
    if (w.stars > 0 && (this.plan === null || w.stars > this.plan.stars)) this.respond(w.stars);
    if (w.stars === 0) {
      this.queue = [];
      this.plan = null;
      if (!this.active) return 0;
      // the chase is over: they fade away
      this.fade += dt;
      const a = Math.max(0, 1 - this.fade / 2);
      for (const u of this.units) {
        u.sprite.setAlpha(a);
        u.shadow.setAlpha(a);
        for (const o of u.crew) o.sprite.setAlpha(a);
      }
      for (const h of this.helis) {
        h.body.setAlpha(a);
        h.rotor.setAlpha(a);
        h.shadow.setAlpha(a);
      }
      if (a <= 0) this.destroy();
      return 0;
    }
    this.fade = 0;
    // dispatch: one unit at a time from the precinct, so they don't spawn inside each other
    this.spawnT -= dt;
    if (this.queue.length > 0 && this.spawnT <= 0) {
      const b = this.host.base;
      this.makeUnit(this.queue.shift()!, b.x, b.y, b.dir, false);
      this.spawnT = BALANCE.police.spawnGapSeconds;
    }
    this.roadblocks(dt, w, player);
    const target = w.seen || !w.lastKnown ? { x: player.x, y: player.y } : w.lastKnown;
    let busting = 0;
    for (const u of this.units) busting += this.updateUnit(u, dt, w, player, target);
    for (const h of this.helis) this.updateHeli(h, dt, target);
    return busting;
  }

  /** 3★+: a roadblock may go up across the road ahead of a driving player (docs/05). */
  private roadblocks(dt: number, w: WantedState, player: PlayerView): void {
    const R = BALANCE.police.roadblock;
    // far-away roadblocks are cleared
    for (const u of [...this.units])
      if (u.parked && Math.hypot(u.v.x - player.x, u.v.y - player.y) > R.despawnTiles * TILE)
        this.removeUnit(u);
    const max = this.plan?.roadblocks ?? 0;
    const up = this.units.filter((u) => u.parked).length;
    if (!player.driving || up >= max || player.heading === undefined) return;
    const chance = 1 - Math.pow(1 - roadblockChancePerMinute(w.stars, false), dt / 60);
    if (this.host.rng.chance(chance)) this.placeRoadblock(player);
  }

  /** A cruiser across the road ahead of the driving player, its crew out, the spike strip down (also a cheat). */
  placeRoadblock(player: PlayerView): void {
    const R = BALANCE.police.roadblock;
    if (player.heading === undefined) return;
    const ax = player.x + Math.cos(player.heading) * R.aheadTiles * TILE;
    const ay = player.y + Math.sin(player.heading) * R.aheadTiles * TILE;
    const r = onRoad(this.host.roads, ax, ay);
    const line = this.host.roads.lines[r.line];
    if (!line || r.d > 2 * TILE) return;
    const p = pointAt(line.path, r.s);
    const q = pointAt(line.path, r.s + 8);
    // across the road: the car's heading is the road's direction turned a quarter
    const along = Math.atan2(q.y - p.y, q.x - p.x);
    const dir = dirOf(along + Math.PI / 2);
    const u = this.makeUnit('cruiser', p.x, p.y, dir, true);
    u.v.heading = (dir * Math.PI) / 4;
    // the spike strip a little up the road, towards the player
    const gap = R.spikeGapTiles * TILE;
    const near = [pointAt(line.path, r.s - gap), pointAt(line.path, r.s + gap)].sort(
      (a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y),
    )[0]!;
    const sp = worldToScreen(near.x, near.y);
    const img = this.scene.add.image(
      Math.round(sp.x),
      Math.round(sp.y),
      FX_TEXTURE.fx,
      `spikes/${DIRS[dir]}`,
    );
    img.setDepth(1e6 - 3);
    this.host.groundLayer.add(img);
    u.spikes = { x: near.x, y: near.y, ang: (dir * Math.PI) / 4, img };
    const spots = exitSpots(u.v, BALANCE.walker.radius);
    u.crew.forEach((o, k) => {
      const s = spots[k] ?? spots[0]!;
      o.x = s.x;
      o.y = s.y;
      o.inCar = false;
    });
  }

  /** An officer went down (combat): off the street; the combat layer draws the body. */
  removeOfficer(sprite: Phaser.GameObjects.Sprite): void {
    for (const u of this.units) {
      const o = u.crew.find((q) => q.sprite === sprite);
      if (!o) continue;
      o.sprite.destroy();
      u.crew = u.crew.filter((q) => q !== o);
    }
  }

  /** The spike strips down, as turned boxes (the driven car's tyres burst crossing one, docs/08). */
  spikeStrips(): Obb[] {
    const R = BALANCE.police.roadblock;
    return this.units.flatMap((u) =>
      u.spikes
        ? [
            {
              x: u.spikes.x,
              y: u.spikes.y,
              hx: R.spikeHalfTiles * TILE,
              hy: R.spikeHalfWidth,
              ang: u.spikes.ang,
            },
          ]
        : [],
    );
  }

  private removeUnit(u: Unit): void {
    u.spikes?.img.destroy();
    u.sprite.destroy();
    u.shadow.destroy();
    for (const o of u.crew) o.sprite.destroy();
    this.units = this.units.filter((q) => q !== u);
  }

  private updateUnit(
    u: Unit,
    dt: number,
    w: WantedState,
    player: PlayerView,
    shared: { x: number; y: number },
  ): number {
    const P = BALANCE.police;
    const target = { x: shared.x + u.offset.x, y: shared.y + u.offset.y };
    const aboard = u.crew.every((o) => o.inCar);
    // crews on foot go back to the car when the player drives off (roadblock crews hold their spot)
    if (player.driving && !aboard && !u.parked) {
      for (const o of u.crew)
        if (!o.inCar) {
          o.goal = { x: u.v.x, y: u.v.y };
          if (Math.hypot(o.x - u.v.x, o.y - u.v.y) < 40) o.inCar = true;
        }
    }
    if (u.parked) u.v.speed = 0;
    else if (aboard) this.driveUnit(u, dt, target, player, w);
    else u.v.speed = 0;
    // get out when close to a player on foot, or at the reported spot
    const dTarget = Math.hypot(u.v.x - target.x, u.v.y - target.y);
    if (
      aboard &&
      !u.parked &&
      !player.driving &&
      Math.abs(u.v.speed) < 30 &&
      (dTarget < P.arriveDistance * 3 || this.pathLeft(u) < P.arriveDistance)
    ) {
      const spots = exitSpots(u.v, BALANCE.walker.radius);
      u.crew.forEach((o, k) => {
        const s = spots[k % spots.length] ?? spots[0]!;
        o.x = s.x;
        o.y = s.y;
        o.inCar = false;
      });
    }
    let busting = 0;
    for (const o of u.crew) {
      o.sprite.setVisible(!o.inCar);
      if (o.inCar) continue;
      if (!player.driving || u.parked) {
        const chase = w.seen || this.sees(player);
        if (chase && !(u.parked && player.driving)) o.goal = { x: player.x, y: player.y };
        else if (!u.parked) {
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
    this.drawUnit(u);
    return busting;
  }

  private driveUnit(
    u: Unit,
    dt: number,
    target: { x: number; y: number },
    player: PlayerView,
    w: WantedState,
  ): void {
    const P = BALANCE.police;
    u.planT -= dt;
    const moved = !u.planned || Math.hypot(u.planned.x - target.x, u.planned.y - target.y) > 3 * TILE;
    if (u.planT <= 0 || moved) {
      u.path = route(this.host.roads, u.v, target);
      u.planned = { ...target };
      u.planT = 1.5;
    }
    // close and in sight: drive straight at the player's car
    const direct = player.driving && w.seen && Math.hypot(player.x - u.v.x, player.y - u.v.y) < 6 * TILE;
    while (u.path.length > 1 && Math.hypot(u.path[0]!.x - u.v.x, u.path[0]!.y - u.v.y) < P.lookAhead)
      u.path.shift();
    const aim = direct ? { x: player.x, y: player.y } : (u.path[0] ?? target);
    const left = direct ? Math.hypot(player.x - u.v.x, player.y - u.v.y) : this.pathLeft(u);
    const want = Math.atan2(aim.y - u.v.y, aim.x - u.v.x);
    let diff = want - u.v.heading;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    let throttle = left < P.arriveDistance && !player.driving ? -1 : Math.abs(diff) > 1.6 ? 0.4 : 1;
    let steer = Math.max(-1, Math.min(1, diff * 2.2));
    if (u.reverseT > 0) {
      u.reverseT -= dt;
      throttle = -1;
      steer = -steer;
    }
    if (throttle < 0 && u.v.speed <= 0 && u.reverseT <= 0) throttle = 0;
    drive(u.v, { throttle, steer, handbrake: false }, dt, this.host.solids(), this.host.rules);
    // stuck against something: back up a little
    if (throttle > 0 && Math.abs(u.v.speed) < 10) u.stuckT += dt;
    else u.stuckT = 0;
    if (u.stuckT > 1.2) {
      u.reverseT = 0.9;
      u.stuckT = 0;
    }
  }

  /** The helicopter circles the target (the player when seen, else the last known spot) at its altitude. */
  private updateHeli(h: Heli, dt: number, target: { x: number; y: number }): void {
    const H = BALANCE.police.heli;
    h.t += dt;
    h.ang += dt * 0.6;
    const gx = target.x + Math.cos(h.ang) * H.orbit;
    const gy = target.y + Math.sin(h.ang) * H.orbit;
    const dx = gx - h.x;
    const dy = gy - h.y;
    const d = Math.hypot(dx, dy);
    if (d > 1) {
      const step = Math.min(d, H.speed * dt);
      h.x += (dx / d) * step;
      h.y += (dy / d) * step;
      h.dir = facingFromWorld(dx, dy);
    }
    const name = DIRS[h.dir] as string;
    const s = worldToScreen(h.x, h.y);
    const sx = Math.round(s.x);
    const sy = Math.round(s.y);
    h.shadow.setFrame(`helicopter_shadow/${name}`);
    h.shadow.setPosition(sx, sy);
    h.body.setFrame(`helicopter/${name}`);
    h.body.setPosition(sx, sy - H.altitudePx);
    const mount = MOUNTS[name] ?? [0, -40];
    h.rotor.setFrame(`helicopter_rotor/f${Math.floor(h.t * H.rotorFps) % 4}`);
    h.rotor.setPosition(sx + mount[0], sy - H.altitudePx + mount[1]);
  }

  private pathLeft(u: Unit): number {
    let d = 0;
    let prev = { x: u.v.x, y: u.v.y };
    for (const p of u.path) {
      d += Math.hypot(p.x - prev.x, p.y - prev.y);
      prev = p;
    }
    return d;
  }

  private drawUnit(u: Unit): void {
    const dir = dirOf(u.v.heading);
    const ref = vehicleFrame(u.model, dir);
    if (u.sprite.frame.name !== ref.frame) {
      u.sprite.setFrame(ref.frame);
      u.shadow.setTexture(this.host.carShadow(u.model, dir));
    }
    const s = worldToScreen(u.v.x, u.v.y);
    u.shadow.setPosition(Math.round(s.x), Math.round(s.y));
    this.host.place(u.sprite, u.v.x, u.v.y, stats(u.v).halfLength * 0.7);
  }

  /** Every unit as a turned box, for collisions and sorting. */
  boxes(): { obb: Obb; sprite: Phaser.GameObjects.Sprite }[] {
    return this.units.map((u) => {
      const S = stats(u.v);
      return {
        obb: { x: u.v.x, y: u.v.y, hx: S.halfLength, hy: S.halfWidth, ang: u.v.heading },
        sprite: u.sprite,
      };
    });
  }
}

/** Where the rotor hub sits on the body, per facing (art/vehicles2.json mounts). */
const MOUNTS = vehicles2Json.mounts.helicopter_rotor as unknown as Record<string, [number, number]>;

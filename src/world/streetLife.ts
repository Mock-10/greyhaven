// Street life (docs/01 "NPC crowd", milestone 4): the pedestrians and the ambient traffic around the camera. The
// rules are in systems/crowd.ts and systems/traffic.ts; this draws them and spawns and removes them as the view moves.

import type Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { DIRS } from '../config/constants';
import type { Rng } from '../core/rng';
import { characterFrame, vehicleFrame } from '../assets/sprites';
import { CROWD_COSTUMES, TRAFFIC_MODELS } from '../data/crowd';
import { typeOfModel } from '../data/vehicles';
import { facingFromWorld, worldToScreen } from '../iso/projection';
import type { Rect } from '../iso/shadows';
import type { Obb } from '../iso/staticDepth';
import type { MapData } from '../maps/types';
import { buildWalkways, crowdTarget, spawnPed, stepPed, type Ped, type Walkways } from '../systems/crowd';
import { pointAt } from '../systems/paths';
import { buildLanes, stepTraffic, trafficTarget, type Lane, type TrafficCar } from '../systems/traffic';
import { dirOf, stats } from '../systems/vehicle';

export interface StreetHost {
  /** Sort a moving sprite among the static objects (WorldScene does it for the player). */
  place(sprite: Phaser.GameObjects.Sprite, x: number, y: number, r: number): void;
  ensureWalkAnims(costume: string): void;
  /** The visible area in art pixels. */
  view(): Rect;
  /** Things in the way of traffic that aren't traffic: the player, the player's car, parked cars, the police. */
  obstacles(): Obb[];
  /** A moving shadow texture key for a car of this model and direction. */
  carShadow(model: string, dir: number): string;
  layer: Phaser.GameObjects.Layer;
  groundLayer: Phaser.GameObjects.Layer;
  rng: Rng;
}

interface PedView {
  ped: Ped;
  sprite: Phaser.GameObjects.Sprite;
}
interface CarView {
  car: TrafficCar;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
}

export class StreetLife {
  readonly walk: Walkways;
  readonly lanes: Lane[];
  peds: PedView[] = [];
  cars: CarView[] = [];
  private nextId = 1;
  private t = 0;

  constructor(
    private scene: Phaser.Scene,
    map: MapData,
    private host: StreetHost,
  ) {
    this.walk = buildWalkways(map.walkways ?? []);
    this.lanes = buildLanes(map.lanes ?? [], map.crossings ?? []);
  }

  /** Real seconds of traffic-light time. */
  get time(): number {
    return this.t;
  }

  private inView(x: number, y: number, margin: number): boolean {
    const v = this.host.view();
    const s = worldToScreen(x, y);
    return (
      s.x > v.x - margin && s.x < v.x + v.w + margin && s.y > v.y - margin - 40 && s.y < v.y + v.h + margin
    );
  }

  update(dt: number, minuteOfDay: number, visible: boolean): void {
    this.t += dt;
    const C = BALANCE.crowd;
    // people: keep the right number about, appearing just outside the view
    if (this.walk.paths.length) {
      const want = crowdTarget(minuteOfDay);
      for (let tries = 0; this.peds.length < want && tries < 6; tries++) this.trySpawnPed();
    }
    for (const pv of this.peds) {
      stepPed(pv.ped, this.walk, dt, this.host.rng);
      this.drawPed(pv, dt);
    }
    this.peds = this.peds.filter((pv) => {
      const keep = pv.ped.call !== null || this.inView(pv.ped.x, pv.ped.y, C.despawnMarginPx);
      if (!keep) pv.sprite.destroy();
      return keep;
    });
    // traffic
    if (this.lanes.length) {
      const want = trafficTarget(minuteOfDay);
      // at the start, fill the lanes; after that, cars come in at the lanes' ends
      if (this.t <= dt * 1.5)
        for (let k = 0; k < want * 3 && this.cars.length < want; k++) this.trySpawnCar(true);
      else if (this.cars.length < want) this.trySpawnCar(false);
    }
    const obstacles = this.host.obstacles();
    this.cars = this.cars.filter((cv) => {
      const alive = stepTraffic(cv.car, this.lanes, dt, this.t, (x, y, dx, dy, reach) =>
        this.ahead(cv.car, x, y, dx, dy, reach, obstacles),
      );
      if (!alive) {
        cv.sprite.destroy();
        cv.shadow.destroy();
        return false;
      }
      this.drawCar(cv);
      return true;
    });
    for (const pv of this.peds) pv.sprite.setVisible(visible);
    for (const cv of this.cars) {
      cv.sprite.setVisible(visible);
      cv.shadow.setVisible(visible);
    }
  }

  private trySpawnPed(): void {
    const rng = this.host.rng;
    const path = rng.int(0, this.walk.paths.length - 1);
    const p = this.walk.paths[path];
    if (!p) return;
    const s = rng.next() * p.len;
    const pt = pointAt(p, s);
    // just outside the view, so nobody pops into sight (or anywhere near it at the very start)
    const C = BALANCE.crowd;
    if (this.inView(pt.x, pt.y, 0) && this.t > 1) return;
    if (!this.inView(pt.x, pt.y, C.spawnMarginPx + 200)) return;
    const costume = CROWD_COSTUMES[rng.int(0, CROWD_COSTUMES.length - 1)] as string;
    this.host.ensureWalkAnims(costume);
    const ped = spawnPed(this.walk, this.nextId++, costume, path, s, rng);
    const sprite = this.scene.add.sprite(0, 0, 'characters', characterFrame(costume, 'idle', 0).frame);
    this.host.layer.add(sprite);
    this.peds.push({ ped, sprite });
  }

  private trySpawnCar(anywhere: boolean): void {
    const rng = this.host.rng;
    const lane = rng.int(0, this.lanes.length - 1);
    const L = this.lanes[lane] as Lane;
    const s0 = anywhere ? rng.next() * L.path.len * 0.9 : 0;
    // the spot must be clear of other traffic
    if (this.cars.some((c) => c.car.lane === lane && Math.abs(c.car.s - s0) < BALANCE.traffic.length * 2))
      return;
    const model = TRAFFIC_MODELS[rng.int(0, TRAFFIC_MODELS.length - 1)] as string;
    const p = pointAt(L.path, s0);
    const car: TrafficCar = {
      id: `traffic${this.nextId++}`,
      model,
      lane,
      s: s0,
      speed: BALANCE.traffic.cruise * 0.6,
      x: p.x,
      y: p.y,
      heading: Math.atan2(p.dy, p.dx),
    };
    const ref = vehicleFrame(model, dirOf(car.heading));
    const sprite = this.scene.add.sprite(0, 0, ref.atlas, ref.frame);
    this.host.layer.add(sprite);
    const shadow = this.scene.add
      .image(0, 0, this.host.carShadow(model, dirOf(car.heading)))
      .setDepth(1e6 - 2);
    this.host.groundLayer.add(shadow);
    this.cars.push({ car, sprite, shadow });
  }

  /** Distance to the nearest thing in front of a traffic car, across the lane's width. */
  private ahead(
    self: TrafficCar,
    x: number,
    y: number,
    dx: number,
    dy: number,
    reach: number,
    obstacles: readonly Obb[],
  ): number {
    const T = BALANCE.traffic;
    let best = Infinity;
    const test = (ox: number, oy: number, r: number) => {
      const rx = ox - x;
      const ry = oy - y;
      const along = rx * dx + ry * dy;
      const across = Math.abs(-rx * dy + ry * dx);
      if (along > 0 && along < reach && across < T.laneHalfWidth + r) best = Math.min(best, along - r);
    };
    for (const c of this.cars) if (c.car !== self) test(c.car.x, c.car.y, T.length / 2);
    for (const o of obstacles) test(o.x, o.y, Math.max(o.hx, o.hy) * 0.8);
    return best;
  }

  private drawPed(pv: PedView, dt: number): void {
    const { ped, sprite } = pv;
    const dir = facingFromWorld(ped.fx, ped.fy);
    const anim = `walk-${ped.costume}-${DIRS[dir]}`;
    if (sprite.anims.currentAnim?.key !== anim) sprite.play(anim, true);
    sprite.anims.timeScale =
      ped.mode === 'flee' ? BALANCE.walker.sprintFpsMultiplier : (ped.speed / BALANCE.walker.walkSpeed) * 0.9;
    this.host.place(sprite, ped.x, ped.y, BALANCE.walker.radius);
    void dt;
  }

  private drawCar(cv: CarView): void {
    const { car, sprite, shadow } = cv;
    const dir = dirOf(car.heading);
    const ref = vehicleFrame(car.model, dir);
    if (sprite.frame.name !== ref.frame) {
      sprite.setFrame(ref.frame);
      shadow.setTexture(this.host.carShadow(car.model, dir));
    }
    const s = worldToScreen(car.x, car.y);
    shadow.setPosition(Math.round(s.x), Math.round(s.y));
    const { halfLength } = stats({ type: typeOfModel(car.model) });
    this.host.place(sprite, car.x, car.y, halfLength * 0.7);
  }

  /** Traffic cars as turned boxes, for the player's car to collide with and for sorting. */
  carBoxes(): { obb: Obb; sprite: Phaser.GameObjects.Sprite }[] {
    return this.cars.map((cv) => {
      const { halfLength, halfWidth } = stats({ type: typeOfModel(cv.car.model) });
      return {
        obb: { x: cv.car.x, y: cv.car.y, hx: halfLength, hy: halfWidth, ang: cv.car.heading },
        sprite: cv.sprite,
      };
    });
  }

  destroy(): void {
    for (const pv of this.peds) pv.sprite.destroy();
    for (const cv of this.cars) {
      cv.sprite.destroy();
      cv.shadow.destroy();
    }
    this.peds = [];
    this.cars = [];
  }
}

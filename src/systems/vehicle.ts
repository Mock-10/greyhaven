// Cars (docs/08): arcade driving with fuel and damage. Pure code, no Phaser.
// Heading is continuous (radians, world space: 0 = +x); the sprite snaps to the nearest of 8 directions.

import { BALANCE } from '../config/balance';
import { typeOfModel, type VehicleType } from '../data/vehicles';
import { collides, type CollisionRules, type Solid } from './movement';

export interface Vehicle {
  id: string;
  /** Sprite name in the vehicles atlas (sedan_lav, taxi ...). */
  model: string;
  /** Car type: sets the stats (BALANCE.vehicles.types) and the chop price. */
  type: VehicleType;
  x: number;
  y: number;
  heading: number;
  /** Signed speed along the heading, world units per second. */
  speed: number;
  fuel: number;
  health: number;
  locked: boolean;
  /** The engine can be started (hotwired or keyed). */
  running: boolean;
  /** Stolen: hot until this in-game minute (docs/08). */
  hotUntil: number;
  wrecked: boolean;
  /** The trunk has been searched (docs/12: a looted car stays looted). */
  looted?: boolean;
  /** Bought by the player (the car dealer, M6): never a crime to open or drive. */
  owned?: boolean;
  /** Mechanic upgrades (docs/08, Phase 4): levels per upgrade; missing means none. */
  mods?: CarMods;
  /** What the player keeps in this car's trunk (docs/08, Phase 4): weapons and burglary goods. */
  stash?: { weapons: { id: string; registered: boolean; clip: number }[]; goods: { kind: string; value: number }[] };
  /** Seconds since it hit zero health; it explodes after BALANCE.vehicles.explodeSeconds (docs/08). */
  burning?: number;
}

/** docs/08 upgrade levels. */
export interface CarMods {
  engine: number;
  brakes: number;
  armor: number;
  tires: number;
  hidden: number;
}

export const NO_MODS: CarMods = { engine: 0, brakes: 0, armor: 0, tires: 0, hidden: 0 };

export interface DriveInput {
  throttle: number; // -1..1 (negative brakes, then reverses)
  steer: number; // -1..1 (left / right on screen: turns the car's heading)
  handbrake: boolean;
}

/** The stats of a car's type. */
export function stats(v: Pick<Vehicle, 'type'> & { mods?: CarMods }) {
  const base = BALANCE.vehicles.types[v.type];
  const m = v.mods;
  if (!m) return base;
  const U = BALANCE.vehicles.upgrades;
  const engine = 1 + m.engine * U.engine.perLevel;
  return {
    ...base,
    topSpeed: base.topSpeed * engine,
    accel: base.accel * engine,
    brake: base.brake * (1 + m.brakes * U.brakes.perLevel),
    health: Math.round(base.health * (1 + m.armor * U.armor.perLevel)),
    turnRate: base.turnRate * (1 + m.tires * U.tires.perLevel),
  };
}

/** The sprite direction (0–7) for a heading. */
export function dirOf(heading: number): number {
  return ((Math.round(heading / (Math.PI / 4)) % 8) + 8) % 8;
}

/** Points around the body (corners and mid-sides) used for collision. */
export function hullPoints(v: Pick<Vehicle, 'x' | 'y' | 'heading' | 'type'>): { x: number; y: number }[] {
  const { halfLength: L, halfWidth: W } = stats(v);
  const c = Math.cos(v.heading);
  const s = Math.sin(v.heading);
  const pts: [number, number][] = [
    [L, W],
    [L, -W],
    [-L, W],
    [-L, -W],
    [L, 0],
    [-L, 0],
    [0, W],
    [0, -W],
  ];
  return pts.map(([u, w]) => ({ x: v.x + u * c - w * s, y: v.y + u * s + w * c }));
}

/** The car as a turned box, for other things to collide with. */
export function vehicleSolid(v: Vehicle): Solid {
  const { halfLength, halfWidth } = stats(v);
  return { kind: 'obox', x: v.x, y: v.y, hx: halfLength, hy: halfWidth, r: 0, ang: v.heading };
}

export function topSpeed(v: Vehicle): number {
  const V = BALANCE.vehicles;
  const S = stats(v);
  return S.topSpeed * (v.health < S.health * V.fireShare ? V.limpFactor : 1);
}

/**
 * One simulation step. Returns the impact speed when the car hit something (0 otherwise). Out of fuel, the car
 * coasts; wrecked or not running, it only rolls to a stop.
 */
export function drive(
  v: Vehicle,
  inp: DriveInput,
  dt: number,
  solids: readonly Solid[],
  rules: CollisionRules,
): number {
  const sp = stats(v);
  const powered = v.running && !v.wrecked && v.fuel > 0;
  const th = powered ? inp.throttle : 0;
  if (th > 0) {
    v.speed = Math.min(topSpeed(v), v.speed + sp.accel * th * dt);
    v.fuel = Math.max(0, v.fuel - sp.fuelPerSecond * th * dt);
  } else if (th < 0) {
    if (v.speed > 0) v.speed = Math.max(0, v.speed + sp.brake * th * dt);
    else {
      v.speed = Math.max(-sp.reverseSpeed, v.speed + sp.accel * th * dt);
      v.fuel = Math.max(0, v.fuel - sp.fuelPerSecond * -th * 0.5 * dt);
    }
  } else {
    const d = sp.drag * dt * (inp.handbrake ? 4 : 1);
    v.speed = Math.abs(v.speed) <= d ? 0 : v.speed - Math.sign(v.speed) * d;
  }
  if (inp.handbrake && th !== 0) v.speed *= Math.max(0, 1 - 2.5 * dt);
  // steering tightens at low speed and flips when reversing (docs/08)
  const grip = Math.min(1, Math.abs(v.speed) / 60);
  const turn = inp.steer * sp.turnRate * grip * (inp.handbrake ? 1.5 : 1) * Math.sign(v.speed || 1) * dt;
  const prev = { x: v.x, y: v.y, heading: v.heading };
  const heading = v.heading + turn;
  const mx = Math.cos(heading) * v.speed * dt;
  const my = Math.sin(heading) * v.speed * dt;
  const free = (x: number, y: number, h: number) =>
    !hullPoints({ x, y, heading: h, type: v.type }).some((p) =>
      collides(p.x, p.y, solids, { ...rules, radius: 1 }),
    );
  const V = BALANCE.vehicles;
  if (free(prev.x + mx, prev.y + my, heading)) {
    v.x += mx;
    v.y += my;
    v.heading = heading;
    return 0;
  }
  // glancing blows slide along the wall (keeping the part of the speed along it); head-on hits bounce back
  const slides: [number, number, number][] = [
    [mx, 0, Math.abs(Math.cos(heading))],
    [0, my, Math.abs(Math.sin(heading))],
  ];
  slides.sort((p, q) => q[2] - p[2]);
  for (const [sx, sy, keep] of slides) {
    if (keep < V.slideMinShare || !free(prev.x + sx, prev.y + sy, heading)) continue;
    const lost = Math.abs(v.speed) * Math.sqrt(1 - keep * keep);
    v.x += sx;
    v.y += sy;
    v.heading = heading;
    v.speed *= keep;
    if (lost > V.minImpactSpeed) damage(v, (lost - V.minImpactSpeed) * V.damagePerSpeed);
    return lost;
  }
  const impact = Math.abs(v.speed);
  // turning on the spot is allowed when only the move is blocked
  if (free(prev.x, prev.y, heading)) v.heading = heading;
  v.speed = -v.speed * V.bounce;
  if (impact > V.minImpactSpeed) damage(v, (impact - V.minImpactSpeed) * V.damagePerSpeed);
  return impact;
}

export function damage(v: Vehicle, amount: number): void {
  v.health = Math.max(0, v.health - amount);
  if (v.health === 0) {
    v.wrecked = true;
    v.running = false;
    v.speed = 0;
  }
}

/** Fill the tank at a pump for clean cash: as much as the tank takes and the cash allows. Returns units added. */
export function refuel(v: Vehicle, money: { clean: number }): number {
  const room = stats(v).tank - v.fuel;
  const affordable = Math.floor(money.clean / BALANCE.vehicles.fuelPrice);
  const units = Math.max(0, Math.min(Math.floor(room), affordable));
  v.fuel += units;
  money.clean -= units * BALANCE.vehicles.fuelPrice;
  return units;
}

/** Pour a jerry can into the tank (docs/08: 10 units). */
export function pourCan(v: Vehicle, inv: { fuelCans: number }): boolean {
  if (inv.fuelCans <= 0 || v.fuel >= stats(v).tank) return false;
  inv.fuelCans--;
  v.fuel = Math.min(stats(v).tank, v.fuel + BALANCE.vehicles.canUnits);
  return true;
}

/** A repair kit from the bag (docs/08: $150, repairs a car to 50%): only on a car below that and not wrecked. */
export function repairKit(v: Vehicle, inv: { repairKits: number }): boolean {
  const to = stats(v).health * BALANCE.tools.repairKitTo;
  if (inv.repairKits <= 0 || v.wrecked || v.health >= to) return false;
  inv.repairKits--;
  v.health = to;
  return true;
}

/** Can a repair kit help this car? */
export function needsRepair(v: Vehicle): boolean {
  return !v.wrecked && v.health < stats(v).health * BALANCE.tools.repairKitTo;
}

/** The point behind the car where its trunk is opened (the rear, `trunkReach` of the car's length back). */
export function trunkSpot(v: Pick<Vehicle, 'x' | 'y' | 'heading' | 'type'>): { x: number; y: number } {
  const back = 2 * stats(v).halfLength * BALANCE.crime.trunk.reach;
  return { x: v.x - Math.cos(v.heading) * back, y: v.y - Math.sin(v.heading) * back };
}

/**
 * What Marlo pays for a car (decided 2026-10-11): 15–30% of its type's value, at an early rate and cap below the
 * full-rate reputation tier, then less for a battered one (40% at 0 health).
 */
export function chopPrice(v: Pick<Vehicle, 'type' | 'health'>, roll: number, repTier = 0): number {
  const C = BALANCE.crime.chop;
  const [lo, hi] = C.share as [number, number];
  let base = stats(v).value * (lo + (hi - lo) * roll);
  if (repTier < C.fullRateTier) base = Math.min(C.earlyCap, base * C.earlyFactor);
  return Math.round(base * (0.4 + 0.6 * (v.health / stats(v).health)));
}

/** A car parked in a marked spot: its centre inside the rectangle (give or take `slack`) and stopped. */
export function parkedIn(
  v: Pick<Vehicle, 'x' | 'y' | 'speed'>,
  r: { x0: number; y0: number; x1: number; y1: number },
  slack = BALANCE.vehicles.spotSlack,
): boolean {
  return (
    v.x >= r.x0 - slack &&
    v.x <= r.x1 + slack &&
    v.y >= r.y0 - slack &&
    v.y <= r.y1 + slack &&
    Math.abs(v.speed) < BALANCE.vehicles.saleMaxSpeed
  );
}

/** Distance from a point to the car's body (0 inside it). */
export function distToCar(v: Pick<Vehicle, 'x' | 'y' | 'heading' | 'type'>, x: number, y: number): number {
  const { halfLength, halfWidth } = stats(v);
  const c = Math.cos(v.heading);
  const s = Math.sin(v.heading);
  const dx = x - v.x;
  const dy = y - v.y;
  const u = Math.abs(dx * c + dy * s) - halfLength;
  const w = Math.abs(-dx * s + dy * c) - halfWidth;
  return Math.hypot(Math.max(0, u), Math.max(0, w));
}

/** Where the driver can step out: beside the doors first (left, then right), then behind and in front. */
export function exitSpots(
  v: Pick<Vehicle, 'x' | 'y' | 'heading' | 'type'>,
  radius: number,
): { x: number; y: number }[] {
  const { halfLength, halfWidth } = stats(v);
  const c = Math.cos(v.heading);
  const s = Math.sin(v.heading);
  const side = halfWidth + radius + 3;
  const end = halfLength + radius + 3;
  const local: [number, number][] = [
    [0, -side],
    [0, side],
    [-end, 0],
    [end, 0],
    [halfLength * 0.6, -side],
    [-halfLength * 0.6, side],
  ];
  return local.map(([u, w]) => ({ x: v.x + u * c - w * s, y: v.y + u * s + w * c }));
}

/** A parked car from the map: locked, engine off, part-full tank (docs/08). */
export function parkedCar(id: string, model: string, x: number, y: number, dir: number): Vehicle {
  const type = typeOfModel(model);
  const S = BALANCE.vehicles.types[type];
  return {
    id,
    model,
    type,
    x,
    y,
    heading: (dir * Math.PI) / 4,
    speed: 0,
    fuel: S.tank * BALANCE.vehicles.parkedFuel,
    health: S.health,
    locked: true,
    running: false,
    hotUntil: 0,
    wrecked: false,
  };
}

/**
 * After loading a save, the car the player drove last waits in the home street spot (decided 2026-10-11: "a
 * parking spot outside that allows for spawning saved vehicles whether stolen or bought"). Other cars stay where
 * they were. Returns the car that was moved, if any.
 */
export function parkAtHome(
  vehicles: Vehicle[],
  lastCar: string | null,
  slots: readonly { x: number; y: number; dir: number }[],
): Vehicle | null {
  const v = vehicles.find((c) => c.id === lastCar && !c.wrecked);
  const slot = slots[0];
  if (!v || !slot) return null;
  v.x = slot.x;
  v.y = slot.y;
  v.heading = (slot.dir * Math.PI) / 4;
  v.speed = 0;
  return v;
}

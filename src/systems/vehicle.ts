// Cars (docs/08): arcade driving with fuel and damage. Pure code, no Phaser.
// Heading is continuous (radians, world space: 0 = +x); the sprite snaps to the nearest of 8 directions.

import { BALANCE } from '../config/balance';
import { collides, type CollisionRules, type Solid } from './movement';

export interface Vehicle {
  id: string;
  /** Sprite name in the vehicles atlas (sedan_lav, taxi ...). */
  model: string;
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
}

export interface DriveInput {
  throttle: number; // -1..1 (negative brakes, then reverses)
  steer: number; // -1..1 (left / right on screen: turns the car's heading)
  handbrake: boolean;
}

const S = () => BALANCE.vehicles.sedan;

/** The sprite direction (0–7) for a heading. */
export function dirOf(heading: number): number {
  return ((Math.round(heading / (Math.PI / 4)) % 8) + 8) % 8;
}

/** Points around the body (corners and mid-sides) used for collision. */
export function hullPoints(v: Pick<Vehicle, 'x' | 'y' | 'heading'>): { x: number; y: number }[] {
  const { halfLength: L, halfWidth: W } = S();
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
  const { halfLength, halfWidth } = S();
  return { kind: 'obox', x: v.x, y: v.y, hx: halfLength, hy: halfWidth, r: 0, ang: v.heading };
}

export function topSpeed(v: Vehicle): number {
  const V = BALANCE.vehicles;
  return S().topSpeed * (v.health < V.limpBelow ? V.limpFactor : 1);
}

/**
 * One simulation step. Returns the impact speed when the car hit something (0 otherwise). Out of fuel, the car
 * coasts; wrecked or not running, it only rolls to a stop.
 */
export function drive(v: Vehicle, inp: DriveInput, dt: number, solids: readonly Solid[], rules: CollisionRules): number {
  const sp = S();
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
  v.heading += turn;
  v.x += Math.cos(v.heading) * v.speed * dt;
  v.y += Math.sin(v.heading) * v.speed * dt;
  const hit = hullPoints(v).some((p) => collides(p.x, p.y, solids, { ...rules, radius: 1 }));
  if (!hit) return 0;
  const impact = Math.abs(v.speed);
  v.x = prev.x;
  v.y = prev.y;
  v.heading = prev.heading;
  v.speed = -v.speed * BALANCE.vehicles.bounce;
  damage(v, impact * BALANCE.vehicles.damagePerSpeed);
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
  const room = S().tank - v.fuel;
  const affordable = Math.floor(money.clean / BALANCE.vehicles.fuelPrice);
  const units = Math.max(0, Math.min(Math.floor(room), affordable));
  v.fuel += units;
  money.clean -= units * BALANCE.vehicles.fuelPrice;
  return units;
}

/** Pour a jerry can into the tank (docs/08: 10 units). */
export function pourCan(v: Vehicle, inv: { fuelCans: number }): boolean {
  if (inv.fuelCans <= 0 || v.fuel >= S().tank) return false;
  inv.fuelCans--;
  v.fuel = Math.min(S().tank, v.fuel + BALANCE.vehicles.canUnits);
  return true;
}

/** What Marlo pays for a car (docs/04: $150–400 dirty), less for a battered one. */
export function chopPrice(v: Vehicle, roll: number): number {
  const [lo, hi] = BALANCE.crime.chopPayout as [number, number];
  return Math.round((lo + (hi - lo) * roll) * (0.4 + 0.6 * (v.health / S().health)));
}

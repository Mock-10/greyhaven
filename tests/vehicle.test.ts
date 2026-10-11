import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import type { CollisionRules, Solid } from '../src/systems/movement';
import {
  chopPrice,
  damage,
  dirOf,
  distToCar,
  drive,
  exitSpots,
  parkedCar,
  pourCan,
  refuel,
  topSpeed,
} from '../src/systems/vehicle';

const S = BALANCE.vehicles.sedan;
const rules: CollisionRules = { radius: 6, mapW: 4000, mapH: 4000, smallScale: 0.6, smallSlack: 2 };
const go = { throttle: 1, steer: 0, handbrake: false };

function running() {
  const v = parkedCar('c', 'sedan_lav', 500, 500, 0);
  v.locked = false;
  v.running = true;
  return v;
}

describe('driving', () => {
  it('snaps the heading to 8 sprite directions', () => {
    expect(dirOf(0)).toBe(0);
    expect(dirOf(Math.PI / 2)).toBe(2);
    expect(dirOf(-Math.PI / 4)).toBe(7);
    expect(dirOf(Math.PI * 2 + 0.1)).toBe(0);
  });

  it('accelerates to top speed along its heading and burns fuel', () => {
    const v = running();
    const fuel = v.fuel;
    for (let k = 0; k < 30 * 5; k++) drive(v, go, 1 / 30, [], rules);
    expect(v.speed).toBeCloseTo(S.topSpeed);
    expect(v.x).toBeGreaterThan(500);
    expect(v.y).toBeCloseTo(500);
    expect(v.fuel).toBeLessThan(fuel);
  });

  it('does not move when locked out of fuel or not hotwired, and coasts to a stop', () => {
    const v = parkedCar('c', 'sedan_lav', 500, 500, 0);
    drive(v, go, 1, [], rules);
    expect(v.speed).toBe(0);
    const w = running();
    w.speed = 100;
    w.fuel = 0;
    for (let k = 0; k < 60; k++) drive(w, go, 1 / 30, [], rules);
    expect(w.speed).toBeLessThan(100);
    for (let k = 0; k < 120; k++) drive(w, go, 1 / 30, [], rules);
    expect(w.speed).toBe(0);
  });

  it('steers only when moving, and the other way in reverse', () => {
    const v = running();
    drive(v, { throttle: 0, steer: 1, handbrake: false }, 1 / 30, [], rules);
    expect(v.heading).toBe(0);
    v.speed = 100;
    drive(v, { throttle: 0, steer: 1, handbrake: false }, 1 / 30, [], rules);
    expect(v.heading).toBeGreaterThan(0);
    const r = running();
    r.speed = -60;
    drive(r, { throttle: 0, steer: 1, handbrake: false }, 1 / 30, [], rules);
    expect(r.heading).toBeLessThan(0);
  });

  it('bounces off a wall, taking damage by impact speed', () => {
    const v = running();
    v.speed = 200;
    const wall: Solid = { kind: 'box', x: 552, y: 500, hx: 10, hy: 100, r: 0 };
    const impact = drive(v, go, 1 / 30, [wall], rules);
    expect(impact).toBeGreaterThan(190);
    expect(v.speed).toBeLessThan(0);
    expect(v.x).toBe(500);
    expect(v.health).toBeCloseTo(
      S.health - (impact - BALANCE.vehicles.minImpactSpeed) * BALANCE.vehicles.damagePerSpeed,
    );
  });

  it('slides along a wall it hits at a shallow angle, and scrapes do no damage', () => {
    const v = running();
    v.heading = Math.PI / 6;
    v.speed = 60;
    const wall: Solid = { kind: 'box', x: 500, y: 543, hx: 300, hy: 10, r: 0 };
    for (let k = 0; k < 10; k++) drive(v, go, 1 / 30, [wall], rules);
    expect(v.x).toBeGreaterThan(510);
    expect(v.health).toBe(S.health);
  });

  it('limps below 25% and wrecks at 0', () => {
    const v = running();
    damage(v, 80);
    expect(topSpeed(v)).toBeCloseTo(S.topSpeed * BALANCE.vehicles.limpFactor);
    damage(v, 50);
    expect(v.wrecked).toBe(true);
    expect(v.running).toBe(false);
  });
});

describe('fuel, chop and exits', () => {
  it('refuels for clean cash only as far as the tank and the cash allow', () => {
    const v = running();
    v.fuel = 10;
    const money = { clean: 1000 };
    expect(refuel(v, money)).toBe(30);
    expect(money.clean).toBe(1000 - 30 * BALANCE.vehicles.fuelPrice);
    v.fuel = 0;
    const poor = { clean: 7 };
    expect(refuel(v, poor)).toBe(2);
    expect(poor.clean).toBe(1);
  });

  it('pours a fuel can', () => {
    const v = running();
    v.fuel = 5;
    const inv = { fuelCans: 1 };
    expect(pourCan(v, inv)).toBe(true);
    expect(v.fuel).toBe(15);
    expect(pourCan(v, inv)).toBe(false);
  });

  it('pays $150–400 at the chop shop, less for a wreck', () => {
    const v = running();
    expect(chopPrice(v, 0)).toBe(150);
    expect(chopPrice(v, 1)).toBe(400);
    damage(v, 50);
    expect(chopPrice(v, 1)).toBeLessThan(400);
  });

  it('measures distance to the body and finds exits beside the doors', () => {
    const v = parkedCar('c', 'sedan_lav', 0, 0, 2);
    expect(distToCar(v, 0, 0)).toBe(0);
    expect(distToCar(v, 0, S.halfLength + 10)).toBeCloseTo(10);
    expect(distToCar(v, S.halfWidth + 5, 0)).toBeCloseTo(5);
    const [first] = exitSpots(v, 6);
    expect(distToCar(v, first!.x, first!.y)).toBeGreaterThan(6);
  });
});

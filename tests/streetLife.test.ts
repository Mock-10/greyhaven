import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { Rng } from '../src/core/rng';
import { DOWNTOWN } from '../src/maps/downtown';
import { buildWalkways, crowdTarget, spawnPed, startFlee, stepPed } from '../src/systems/crowd';
import { buildLanes, lightFor, stepTraffic, trafficTarget, type TrafficCar } from '../src/systems/traffic';

describe('pedestrians', () => {
  const w = buildWalkways(DOWNTOWN.walkways ?? []);

  it('has sidewalk paths joined at the corners', () => {
    expect(w.paths.length).toBeGreaterThan(10);
    const joined = w.links.filter(([a, b]) => a.length + b.length > 0).length;
    expect(joined / w.paths.length).toBeGreaterThan(0.8);
  });

  it('walks along a path and crosses to another at its end', () => {
    const rng = new Rng(3);
    const ped = spawnPed(w, 1, 'civilian_a', 0, 0, rng);
    ped.dir = 1;
    const seen = new Set<number>([0]);
    for (let k = 0; k < 30 * 120; k++) {
      stepPed(ped, w, 1 / 30, rng);
      seen.add(ped.path);
    }
    expect(seen.size).toBeGreaterThan(1);
    expect(Number.isFinite(ped.x) && Number.isFinite(ped.y)).toBe(true);
  });

  it('flees away from a threat, then goes back to the sidewalk', () => {
    const rng = new Rng(4);
    const ped = spawnPed(w, 1, 'civilian_b', 2, 20, rng);
    const before = { x: ped.x, y: ped.y };
    startFlee(ped, { x: ped.x - 30, y: ped.y });
    stepPed(ped, w, 1, rng);
    expect(ped.x).toBeGreaterThan(before.x + 50);
    for (let k = 0; k < 30 * 10; k++) stepPed(ped, w, 1 / 30, rng);
    expect(['walk', 'cross']).toContain(ped.mode);
  });

  it('is busier at commute time than at night', () => {
    expect(crowdTarget(8 * 60)).toBeGreaterThan(crowdTarget(3 * 60));
  });
});

describe('traffic', () => {
  const lanes = buildLanes(DOWNTOWN.lanes ?? [], DOWNTOWN.crossings ?? []);

  it('has a lane each way on every road with stop lines before the crossings', () => {
    expect(lanes.length).toBe(10);
    for (const l of lanes) expect(l.stops.length).toBeGreaterThanOrEqual(1);
  });

  it('alternates the lights: one direction red while the other is green', () => {
    for (let t = 0; t < 60; t += 0.5) {
      const ew = lightFor(t, 0, true);
      const ns = lightFor(t, 0, false);
      expect(ew === 'green' && ns === 'green').toBe(false);
      if (ew === 'green') expect(ns).toBe('red');
    }
  });

  it('stops at a red light and keeps its distance from a car ahead', () => {
    const lane = lanes.findIndex((l) => l.ew);
    const stop = lanes[lane]!.stops[0]!;
    const car: TrafficCar = {
      id: 't',
      model: 'taxi',
      lane,
      s: stop.s - 300,
      speed: 150,
      x: 0,
      y: 0,
      heading: 0,
    };
    // find a time when this crossing is red for east-west traffic for a good while
    let t = 0;
    while (lightFor(t, stop.crossing, true) !== 'red' || lightFor(t + 6, stop.crossing, true) !== 'red')
      t += 0.25;
    for (let k = 0; k < 30 * 6; k++) stepTraffic(car, lanes, 1 / 30, t + k / 30, () => Infinity);
    expect(car.s).toBeLessThanOrEqual(stop.s + 1);
    expect(car.s).toBeGreaterThan(stop.s - 40);
    expect(car.speed).toBeLessThan(5);
    // an obstacle 100 units ahead: the car stops short of it
    const c2: TrafficCar = { id: 'u', model: 'taxi', lane, s: 10, speed: 150, x: 0, y: 0, heading: 0 };
    const start = c2.s;
    for (let k = 0; k < 30 * 4; k++)
      stepTraffic(
        c2,
        lanes,
        1 / 30,
        lightFor(0, 0, true) === 'green' ? 0 : 0,
        (_x, _y, _dx, _dy) => start + 140 - c2.s,
      );
    expect(c2.s - start).toBeLessThan(140 - BALANCE.traffic.length / 2);
  });

  it('runs more cars by day than at night', () => {
    expect(trafficTarget(17 * 60)).toBeGreaterThan(trafficTarget(3 * 60));
  });
});

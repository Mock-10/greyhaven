import { pointAt } from '../src/systems/paths';
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
    // downtown: one each way; Hedgerow Way, Ashby Road and Linden Avenue: two each way (user rule, 2026-10-11)
    expect(lanes.length).toBe(20);
    for (const l of lanes) expect(l.stops.length).toBeGreaterThanOrEqual(1);
    const roads = (r: string) => lanes.filter((l) => l.road === r).length;
    expect(roads('HEDGEROW WAY')).toBe(4);
    // stops are in driving order and lie on the lane
    for (const l of lanes)
      for (let k = 1; k < l.stops.length; k++) expect(l.stops[k]!.s).toBeGreaterThan(l.stops[k - 1]!.s);
  });

  it('serves the Phase 2 roads: Ashby Road and Linden Avenue have lanes, and every lane runs edge to edge', () => {
    expect(lanes.some((l) => l.road === 'ASHBY ROAD')).toBe(true);
    expect(lanes.some((l) => l.road === 'LINDEN AVENUE')).toBe(true);
    const W = DOWNTOWN.width * 32;
    const H = DOWNTOWN.height * 32;
    const outside = (x: number, y: number) => x < 0 || y < 0 || x > W || y > H;
    for (const l of lanes) {
      const a = pointAt(l.path, 0);
      const b = pointAt(l.path, l.path.len);
      expect(outside(a.x, a.y) && outside(b.x, b.y), l.road).toBe(true);
    }
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
    const lane = lanes.findIndex((l) => l.stops[0]?.ew);
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

describe('police routes', () => {
  it('drives along the roads, turning at crossings, to the road point nearest the goal', async () => {
    const { buildRoads, route, onRoad } = await import('../src/systems/roads');
    const g = buildRoads(DOWNTOWN.roads ?? DOWNTOWN.lanes ?? [], DOWNTOWN.crossings ?? []);
    expect(g.lines.length).toBe(8); // 4 east-west roads and 4 north-south roads (Ashby Road carries on Millwright)

    const from = { x: 19 * 32, y: 44 * 32 }; // the precinct on Pewter Street
    const to = { x: 50 * 32, y: 30 * 32 }; // Marlo's yard
    const r = route(g, from, to);
    expect(r.length).toBeGreaterThan(10);
    const end = r[r.length - 1]!;
    const goal = onRoad(g, to.x, to.y);
    const gp = g.lines[goal.line]!;
    expect(Math.hypot(end.x - to.x, end.y - to.y)).toBeLessThan(goal.d + 30);
    void gp;
    // every waypoint is near a road
    for (const p of r) expect(onRoad(g, p.x, p.y).d).toBeLessThan(40);
    // consecutive waypoints are close together (no jumps across blocks)
    for (let k = 1; k < r.length; k++)
      expect(Math.hypot(r[k]!.x - r[k - 1]!.x, r[k]!.y - r[k - 1]!.y)).toBeLessThan(80);
  });
});

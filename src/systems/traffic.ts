// Ambient traffic (docs/01, milestone 4): cars follow their lane, keep their distance from whatever is ahead and
// stop at red lights. Pure code; the cars are drawn by world/streetLife.ts and collide as turned boxes.

import { BALANCE } from '../config/balance';
import { makePath, nearestOn, pointAt, type Path } from './paths';

export interface Lane {
  path: Path;
  road: string;
  /** Along this lane: where to stop for each crossing, which crossing it is, and which light phase it follows there
   *  (east–west or north–south, from the lane's direction at the stop: a turning lane can follow both). */
  stops: { s: number; crossing: number; ew: boolean }[];
}

/** A lane as the map stores it: a route from map edge to map edge (several per road since multi-lane roads), with
 *  its stop lines when the map script worked them out (`c` is the crossing's index). */
export interface LaneData {
  road: string;
  p: [number, number][];
  stops?: { s: number; c: number }[];
}

export interface TrafficCar {
  id: string;
  model: string;
  lane: number;
  s: number;
  speed: number;
  x: number;
  y: number;
  heading: number;
}

export function buildLanes(raw: readonly LaneData[], crossings: readonly { x: number; y: number }[]): Lane[] {
  const T = BALANCE.traffic;
  return raw.map((l) => {
    const path = makePath(l.p);
    // stop lines from the map, or (older maps, one lane each way) a fixed distance before each crossing passed
    const found =
      l.stops?.map((q) => ({ s: q.s, crossing: q.c })) ??
      crossings
        .map((c, k) => ({ n: nearestOn(path, c.x, c.y), k }))
        .filter((q) => q.n.d < 48)
        .map((q) => ({ s: q.n.s - T.stopBack, crossing: q.k }));
    const stops = found
      .filter((q) => q.s > 0)
      .map((q) => {
        const at = pointAt(path, q.s);
        return { ...q, ew: Math.abs(at.dx) > Math.abs(at.dy) };
      })
      .sort((p, q) => p.s - q.s);
    return { path, road: l.road, stops };
  });
}

/** Light at a crossing for one direction, at real time `t` seconds: green, yellow or red. */
export function lightFor(t: number, crossing: number, ew: boolean): 'green' | 'yellow' | 'red' {
  const T = BALANCE.traffic;
  const half = T.green + T.yellow;
  const phase = (((t + crossing * T.offset) % (2 * half)) + 2 * half) % (2 * half);
  const mine = ew ? phase : (phase + half) % (2 * half);
  if (mine < T.green) return 'green';
  if (mine < half) return 'yellow';
  return 'red';
}

/**
 * Move one car along its lane. `ahead(x, y, dx, dy, reach)` returns the distance to the nearest obstacle in front
 * (other cars, the player, a parked car), or Infinity. Returns false once the car has left the lane's end.
 */
export function stepTraffic(
  car: TrafficCar,
  lanes: readonly Lane[],
  dt: number,
  t: number,
  ahead: (x: number, y: number, dx: number, dy: number, reach: number) => number,
): boolean {
  const T = BALANCE.traffic;
  const lane = lanes[car.lane] as Lane;
  const here = pointAt(lane.path, car.s);
  // the furthest the car may drive: the gap to what's ahead, and the stop line of a red or yellow light
  let room = ahead(here.x, here.y, here.dx, here.dy, T.lookAhead) - T.length / 2 - T.gap;
  for (const st of lane.stops) {
    const d = st.s - car.s;
    if (d < -4 || d > T.lookAhead * 2) continue;
    const light = lightFor(t, st.crossing, st.ew);
    // a car already at the line when it turns yellow carries on
    if (light === 'red' || (light === 'yellow' && d > (car.speed * car.speed) / (2 * T.brake) - 6))
      room = Math.min(room, d);
  }
  const want = Math.max(0, Math.min(T.cruise, Math.sqrt(Math.max(0, 2 * T.brake * Math.max(0, room)))));
  if (car.speed < want) car.speed = Math.min(want, car.speed + T.accel * dt);
  else car.speed = Math.max(want, car.speed - T.brake * dt);
  // never roll past the stop line or into what's ahead, whatever the step size
  car.s += Math.min(car.speed * dt, Math.max(0, room));
  if (room <= 0) car.speed = 0;
  if (car.s >= lane.path.len) return false;
  const p = pointAt(lane.path, car.s);
  car.x = p.x;
  car.y = p.y;
  car.heading = Math.atan2(p.dy, p.dx);
  return true;
}

/**
 * How many cars should be about at this minute of the day, on lanes this long in all (world units): the same
 * density per length of road whatever the map's size (M6a: the 70 × 96 map has about 2.7× Downtown's lanes).
 */
export function trafficTarget(minuteOfDay: number, laneUnits: number = BALANCE.traffic.perLaneUnits): number {
  const T = BALANCE.traffic;
  const perRef = T.byHour[Math.floor(minuteOfDay / 60) % 24] as number;
  return Math.min(T.maxCars, Math.round((perRef * laneUnits) / T.perLaneUnits));
}

/** The total length of these lanes, in world units. */
export function laneUnits(lanes: readonly Lane[]): number {
  return lanes.reduce((sum, l) => sum + l.path.len, 0);
}

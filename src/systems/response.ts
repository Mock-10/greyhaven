// The 1–5★ police response (docs/05 "Star levels and police response"), the star escalations from fighting police
// (docs/07, docs/08), and the once-per-chase escape speed-ups (docs/05 "Search and losing stars", docs/03 perks).
// Pure code: the world spawns and steers the units this plans, and owns the WantedState it changes.

import { BALANCE_POLICE, type PoliceWeapon } from '../config/balancePolice';
import { BALANCE } from '../config/balance';
import type { Rng } from '../core/rng';
import { knownFace, type HeatState } from './identify';
import { addStars, emptyWanted, escapeSecondsFor, type WantedState } from './wanted';

const P = () => BALANCE_POLICE;

function tierOf(stars: number) {
  const k = Math.max(1, Math.min(stars, BALANCE.wanted.maxStars)) - 1;
  return P().response[k]!;
}

/** What the dispatcher sends for a star level. */
export interface ResponsePlan {
  stars: number;
  cruisers: number;
  /** Officers on foot from the cruisers, vans and armored vehicles. */
  officers: number;
  /** 1★ investigates the reported spot; 2★ and up chase. */
  chase: boolean;
  weapon: PoliceWeapon;
  roadblocks: number;
  spikeStrips: boolean;
  swatVans: number;
  helicopters: number;
  armored: number;
  /** Seconds before the first unit leaves the precinct. */
  dispatchSeconds: number;
}

export interface ResponseOptions {
  /** The report came from the hood: fewer and slower police (docs/01). */
  hood?: boolean;
}

/** Roll the response for a star level (docs/05 table). No stars, no response. */
export function planResponse(stars: number, rng: Rng, opts: ResponseOptions = {}): ResponsePlan {
  if (stars <= 0)
    return {
      stars: 0,
      cruisers: 0,
      officers: 0,
      chase: false,
      weapon: 'pistol',
      roadblocks: 0,
      spikeStrips: false,
      swatVans: 0,
      helicopters: 0,
      armored: 0,
      dispatchSeconds: 0,
    };
  const t = tierOf(stars);
  let cruisers = rng.int(t.cruisers[0], t.cruisers[1]);
  let dispatchSeconds = P().dispatchSeconds;
  if (opts.hood) {
    cruisers = Math.max(1, cruisers - P().hood.cruiserCut);
    dispatchSeconds *= P().hood.dispatchFactor;
  }
  return {
    stars: Math.min(stars, BALANCE.wanted.maxStars),
    cruisers,
    officers: cruisers * P().officersPerCruiser + (t.swatVans + t.armored) * P().officersPerVan,
    chase: t.chase,
    weapon: t.weapon,
    roadblocks: t.roadblocks,
    spikeStrips: t.spikeStrips,
    swatVans: t.swatVans,
    helicopters: t.helicopters,
    armored: t.armored,
    dispatchSeconds,
  };
}

/**
 * The stars went up: the new plan never sends fewer units than are already out (stars stack, so the response does
 * too). The world spawns the difference (`reinforcements`).
 */
export function escalate(
  current: ResponsePlan,
  stars: number,
  rng: Rng,
  opts: ResponseOptions = {},
): ResponsePlan {
  if (stars <= current.stars) return current;
  const next = planResponse(stars, rng, opts);
  const cruisers = Math.max(current.cruisers, next.cruisers);
  return {
    ...next,
    cruisers,
    officers: cruisers * P().officersPerCruiser + (next.swatVans + next.armored) * P().officersPerVan,
  };
}

/** The units to add to go from one plan to the next. */
export function reinforcements(
  from: ResponsePlan,
  to: ResponsePlan,
): { cruisers: number; swatVans: number; helicopters: number; armored: number; roadblocks: number } {
  const d = (a: number, b: number) => Math.max(0, b - a);
  return {
    cruisers: d(from.cruisers, to.cruisers),
    swatVans: d(from.swatVans, to.swatVans),
    helicopters: d(from.helicopters, to.helicopters),
    armored: d(from.armored, to.armored),
    roadblocks: d(from.roadblocks, to.roadblocks),
  };
}

/** docs/07: police warn at 1★ and only shoot at 2★ and above, or once the player has shot first. */
export function policeShoot(stars: number, playerShotFirst: boolean): boolean {
  return stars > 0 && (playerShotFirst || stars >= P().shootFromStars);
}

/** Chance per real minute of a new roadblock on the player's route (docs/05 3★+, docs/04 smuggling at 2★+). */
export function roadblockChancePerMinute(stars: number, smuggling: boolean): number {
  if (stars > 0 && tierOf(stars).roadblocks > 0) return P().roadblockChancePerMinute;
  if (smuggling && stars >= P().smugglingRoadblockFromStars) return P().roadblockChancePerMinute;
  return 0;
}

// ---- star escalations ----

/** Raise the stars to at least `min` (never lowers them). Returns true when they went up. */
export function raiseTo(w: WantedState, min: number, at: { x: number; y: number }): boolean {
  if (w.stars >= min) {
    w.lastKnown = { ...at };
    return false;
  }
  addStars(w, min - w.stars, at);
  return true;
}

/** docs/07: shooting at police raises the level to at least 3★. */
export function shotAtPolice(w: WantedState, at: { x: number; y: number }): boolean {
  return raiseTo(w, P().shotPoliceMinStars, at);
}

/** docs/07: killing an officer raises the level to at least 4★. */
export function killedOfficer(w: WantedState, at: { x: number; y: number }): boolean {
  return raiseTo(w, P().killedPoliceMinStars, at);
}

/** docs/08: stealing a police cruiser adds 1★. */
export function stoleCruiser(w: WantedState, at: { x: number; y: number }): void {
  addStars(w, P().stoleCruiserStars, at);
}

// ---- the chase ----

/** What has been used up in this chase (reset when the stars clear). */
export interface ChaseState {
  vehicle: boolean;
  outfit: boolean;
  highVis: boolean;
  crush: boolean;
  bribe: boolean;
  /** The known-face +1★ on sight has been charged this chase. */
  knownFace: boolean;
  /** Seconds at 4★ in police sight, towards "sustained 4★ chaos". */
  chaos: number;
}

export function emptyChase(): ChaseState {
  return {
    vehicle: false,
    outfit: false,
    highVis: false,
    crush: false,
    bribe: false,
    knownFace: false,
    chaos: 0,
  };
}

/** Drop the stars by n; at 0 the wanted level clears. The escape timer never grows past the new level's. */
export function dropStars(w: WantedState, n: number): void {
  const stars = w.stars - n;
  if (stars <= 0) {
    Object.assign(w, emptyWanted());
    return;
  }
  w.stars = stars;
  w.escape = Math.min(w.escape, escapeSecondsFor(stars));
}

function cutTimer(chase: ChaseState, key: 'vehicle' | 'outfit', w: WantedState): boolean {
  if (w.stars <= 0 || w.seen || chase[key]) return false;
  chase[key] = true;
  w.escape *= 1 - P().speedUps.timerCut;
  return true;
}

/** Changed vehicle while unseen: −25% of the remaining escape timer, once per chase. */
export function changedVehicle(chase: ChaseState, w: WantedState): boolean {
  return cutTimer(chase, 'vehicle', w);
}

/** Changed mask or clothes while unseen: −25% of the remaining escape timer, once per chase. */
export function changedOutfit(chase: ChaseState, w: WantedState): boolean {
  return cutTimer(chase, 'outfit', w);
}

/** Road worker rank 4 high-vis disguise: −1★ the moment it goes on, once per chase (docs/03). */
export function putOnHighVis(chase: ChaseState, w: WantedState): boolean {
  if (w.stars <= 0 || chase.highVis) return false;
  chase.highVis = true;
  dropStars(w, P().speedUps.highVisStars);
  return true;
}

/** Scrap yard rank 2: crushing a hot car while unseen clears 1★, once per chase (docs/03). */
export function crushedHotCar(chase: ChaseState, w: WantedState): boolean {
  if (w.stars <= 0 || w.seen || chase.crush) return false;
  chase.crush = true;
  dropStars(w, P().speedUps.crushStars);
  return true;
}

/** Entering an owned property unseen clears a 1–2★ wanted level at once (docs/05). */
export function enteredOwnedProperty(w: WantedState, seenEntering: boolean): boolean {
  if (w.stars <= 0 || seenEntering || w.stars > P().speedUps.propertyClearsUpTo) return false;
  Object.assign(w, emptyWanted());
  return true;
}

/**
 * Police see the player. A known face carrying a visible weapon gets +1★ on sight (docs/05), once per chase.
 * Returns true when the stars went up.
 */
export function policeSighting(
  chase: ChaseState,
  w: WantedState,
  heat: HeatState,
  now: number,
  visibleWeapon: boolean,
  at: { x: number; y: number },
): boolean {
  if (chase.knownFace || !visibleWeapon || !knownFace(heat, now)) return false;
  chase.knownFace = true;
  addStars(w, P().heat.knownFaceSightingStars, at);
  return true;
}

/**
 * One step of "sustained 4★ chaos" (docs/05): time at 4★ in police sight adds up, and past the threshold the level
 * goes to 5★. Returns true on the step it does.
 */
export function tickChaos(chase: ChaseState, w: WantedState, dt: number): boolean {
  if (w.stars !== 4 || !w.seen) return false;
  chase.chaos += dt;
  if (chase.chaos < P().chaosSecondsTo5) return false;
  addStars(w, 1, w.lastKnown ?? { x: 0, y: 0 });
  return true;
}

// Identification and heat (docs/05 "Identification and heat", docs/04 store layout and "Planning crimes with the
// day job"): who can put a face to a crime, the security cameras and their DVRs, the "known face" status, and the
// witness modifiers that follow from it. Pure code; the world decides when a crime happens and who sees it.

import { BALANCE_POLICE } from '../config/balancePolice';
import { darkness } from './clock';
import { canSee } from './wanted';

const H = () => BALANCE_POLICE.heat;

/** Who saw the crime: a camera, an officer, or a witness who phoned it in. */
export type SeenBy = 'camera' | 'police' | 'witness';

/** What the player wore at the time. A work uniform carries a name tag (docs/04, docs/03). */
export interface Disguise {
  masked: boolean;
  uniform: boolean;
}

/**
 * Does this sighting identify the player? A work uniform always does, mask or not (docs/04: "identified 100% of the
 * time"). Otherwise a mask always hides the face, and an unmasked face is identified by a camera or an officer
 * (docs/05). A witness alone never identifies a face; they only report the crime.
 */
export function identifies(by: SeenBy, d: Disguise): boolean {
  if (d.uniform) return true;
  if (d.masked) return false;
  return by === 'camera' || by === 'police';
}

/** One identification on file: where it came from and the in-game minute it last happened. */
export interface IdRecord {
  /** 'police', 'witness' (uniform name tag), or 'camera:<building id>' (footage on that building's DVR). */
  source: string;
  at: number;
}

/** The player's face on file (saved with the game: docs/12 "heat states"). */
export interface HeatState {
  ids: IdRecord[];
}

export function emptyHeat(): HeatState {
  return { ids: [] };
}

export function cameraSource(building: string): string {
  return `camera:${building}`;
}

/** File (or refresh) an identification. One record per source; the newest time wins. */
export function fileIdentification(heat: HeatState, source: string, now: number): void {
  const old = heat.ids.find((r) => r.source === source);
  if (old) old.at = Math.max(old.at, now);
  else heat.ids.push({ source, at: now });
}

/** A sighting during a crime: files it when it identifies the player. Returns true when it did. */
export function sighted(heat: HeatState, by: SeenBy, d: Disguise, now: number, building?: string): boolean {
  if (!identifies(by, d)) return false;
  fileIdentification(heat, by === 'camera' && building ? cameraSource(building) : by, now);
  return true;
}

/** The in-game minute the known-face status ends, or 0 when the player isn't a known face. */
export function knownFaceUntil(heat: HeatState, now: number): number {
  let until = 0;
  for (const r of heat.ids) until = Math.max(until, r.at + H().knownFaceMinutes);
  return until > now ? until : 0;
}

/** A "known face" for 2 in-game days after the last identification (docs/05). */
export function knownFace(heat: HeatState, now: number): boolean {
  return knownFaceUntil(heat, now) > 0;
}

/**
 * Wiping a building's DVR erases the identification from that building (docs/04, docs/05), even if the player was
 * unmasked. Police and witness identifications stay. Returns true when something was erased.
 */
export function wipeFootage(heat: HeatState, building: string): boolean {
  const n = heat.ids.length;
  heat.ids = heat.ids.filter((r) => r.source !== cameraSource(building));
  return heat.ids.length < n;
}

/** Drop identifications that no longer make the player a known face (keeps the save small). */
export function pruneHeat(heat: HeatState, now: number): void {
  heat.ids = heat.ids.filter((r) => r.at + H().knownFaceMinutes > now);
}

// ---- cameras ----

/** A wall camera, ATM camera or bank camera. `facing` is the angle of its view in world x/y (radians). */
export interface SecurityCamera {
  x: number;
  y: number;
  facing: number;
}

/** A building's cameras and the DVR they feed (docs/05: the DVR sits in that building's security room). */
export interface CameraSystem {
  building: string;
  cameras: SecurityCamera[];
  /** Cut at the CCTV desk (wire minigame): off for the rest of the robbery (docs/04). */
  cut: boolean;
  /** Seconds left of a timed shutdown (security guard rank 3: 60 s, docs/03). */
  offSeconds: number;
}

export function cameraSystem(building: string, cameras: SecurityCamera[]): CameraSystem {
  return { building, cameras, cut: false, offSeconds: 0 };
}

export function recording(sys: CameraSystem): boolean {
  return !sys.cut && sys.offSeconds <= 0;
}

export function tickCameras(sys: CameraSystem, dt: number): void {
  if (sys.offSeconds > 0) sys.offSeconds = Math.max(0, sys.offSeconds - dt);
}

/** The wire minigame at the CCTV desk: cameras stop recording for the rest of the robbery. */
export function cutCameras(sys: CameraSystem): void {
  sys.cut = true;
}

/** Security guard rank 3 perk: a store's cameras go off for 60 seconds (docs/03). */
export function guardDisable(sys: CameraSystem): void {
  sys.offSeconds = Math.max(sys.offSeconds, BALANCE_POLICE.camera.guardDisableSeconds);
}

/** The building fixes its cameras (the world decides when; e.g. once the robbery is over). */
export function restoreCameras(sys: CameraSystem): void {
  sys.cut = false;
  sys.offSeconds = 0;
}

/** Is the target inside this camera's cone and range, with nothing in the way? */
export function cameraSees(
  cam: SecurityCamera,
  target: { x: number; y: number },
  boxes: readonly (readonly [number, number, number, number])[] = [],
): boolean {
  const C = BALANCE_POLICE.camera;
  const dx = target.x - cam.x;
  const dy = target.y - cam.y;
  if (dx !== 0 || dy !== 0) {
    let d = Math.atan2(dy, dx) - cam.facing;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    if (Math.abs(d) > (C.fovDegrees * Math.PI) / 360) return false;
  }
  return canSee(cam, target, C.rangeTiles, boxes);
}

export interface Recorded {
  /** A working camera saw the crime (the footage exists). */
  recorded: boolean;
  /** ...and it identified the player (unmasked or in uniform). */
  identified: boolean;
}

/**
 * A crime happened at `target` inside this building. If a recording camera sees it, the footage goes to the DVR
 * and, when it shows a face (or a uniform), the identification is filed under this building.
 */
export function recordCrime(
  sys: CameraSystem,
  heat: HeatState,
  target: { x: number; y: number },
  d: Disguise,
  now: number,
  boxes: readonly (readonly [number, number, number, number])[] = [],
): Recorded {
  if (!recording(sys) || !sys.cameras.some((c) => cameraSees(c, target, boxes)))
    return { recorded: false, identified: false };
  return { recorded: true, identified: sighted(heat, 'camera', d, now, sys.building) };
}

// ---- witnesses ----

/** Daylight for the mask and uniform rules: the same 0.5 darkness line the world uses for night sight. */
export function daylight(minuteOfDay: number): boolean {
  return darkness(minuteOfDay) <= H().daylightDarkness;
}

/** A masked player in daylight draws the eyes of witnesses within 5 tiles (docs/05). */
export function watchesMask(masked: boolean, minuteOfDay: number, distanceTiles: number): boolean {
  return masked && daylight(minuteOfDay) && distanceTiles <= H().maskWatchTiles;
}

export interface WitnessContext {
  /** The player is a known face right now. */
  knownFace: boolean;
  /** This witness is watching a masked player (watchesMask). */
  watchingMask: boolean;
  /** The postal uniform perk applies: postal rank 1+, daytime, in the Suburbs (docs/03). */
  postalUniform: boolean;
}

/** How long a witness's call takes: 30% faster for a known face, 30% slower under the postal uniform perk. */
export function callSeconds(base: number, ctx: WitnessContext): number {
  let t = base;
  if (ctx.knownFace) t *= 1 - H().knownFaceCallCut;
  if (ctx.postalUniform) t *= 1 + H().postalUniformCallSlow;
  return t;
}

/** The chance a witness calls at all: +25% while they watch a masked player in daylight (capped at 1). */
export function callChance(base: number, ctx: WitnessContext): number {
  return Math.min(1, base * (ctx.watchingMask ? 1 + H().maskCallBonus : 1));
}

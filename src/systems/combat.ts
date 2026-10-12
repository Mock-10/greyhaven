// Weapons and combat (docs/07): the loadout, ammo, firing and reloading, hitscan shots, melee swings, grenade
// blasts, health and armor, looting, the dealer and gun-store purchases, and the police combat rules (docs/05).
// Pure code on plain state: the world scene aims, draws the tracers and moves the police; this decides what
// happens. Angles are radians in the world's x/y ground plane; distances are world units unless named in tiles.

import { BALANCE_COMBAT, type WeaponStats } from '../config/balanceCombat';
import { BALANCE } from '../config/balance';
import { TILE } from '../config/constants';
import type { Rng } from '../core/rng';
import {
  AMMO_NAMES,
  GUN_STORE_AMMO,
  GUN_STORE_STOCK,
  WEAPONS,
  type AmmoId,
  type SlotKind,
  type WeaponId,
} from '../data/weapons';
import { addStars, type WantedState } from './wanted';

const B = () => BALANCE_COMBAT;

export interface OwnedWeapon {
  id: WeaponId;
  /** Bought at the legal gun store: not seized in jail (docs/07). Dealer and looted weapons are unregistered. */
  registered: boolean;
  /** Rounds in the clip (0 for melee). */
  clip: number;
}

/** The player's weapons (docs/07, docs/12 `loadout`). One serialisable object, saved with the game. */
export interface CombatState {
  /** Loadout slots, keys 1–4 (docs/11): melee, firearm, firearm, heavy. */
  slots: (OwnedWeapon | null)[];
  /** Reserve rounds per ammo type, shared by the weapons that use it (pistol and SMG share 9mm). */
  ammo: Partial<Record<AmmoId, number>>;
  /** Index of the drawn slot, or -1 when holstered (fists). */
  drawn: number;
  /** Weapon raised with the right mouse button: needed to intimidate, tighter aim (docs/07). */
  raised: boolean;
  /** Seconds until the next shot or swing. */
  cooldown: number;
  /** Seconds left on a reload, 0 when not reloading. */
  reloading: number;
  /** Seconds since the player last fired or was hurt; health regenerates once this passes the delay. */
  calm: number;
}

/** What each loadout slot holds, from the docs/07 counts: 1 melee, 2 firearms, 1 heavy. */
export function slotKinds(): SlotKind[] {
  const L = B().loadout;
  return [
    ...Array<SlotKind>(L.melee).fill('melee'),
    ...Array<SlotKind>(L.firearm).fill('firearm'),
    ...Array<SlotKind>(L.heavy).fill('heavy'),
  ];
}

export function createCombat(): CombatState {
  return {
    slots: slotKinds().map(() => null),
    ammo: {},
    drawn: -1,
    raised: false,
    cooldown: 0,
    reloading: 0,
    calm: B().health.regenDelaySeconds,
  };
}

/** Fill in a saved or partial combat state (save migrations: older saves have none). */
export function normalizeCombat(raw: Partial<CombatState> | null | undefined): CombatState {
  const c = createCombat();
  if (!raw) return c;
  const kinds = slotKinds();
  c.slots = kinds.map((kind, k) => {
    const w = raw.slots?.[k];
    return w && WEAPONS[w.id]?.slot === kind
      ? { id: w.id, registered: !!w.registered, clip: w.clip | 0 }
      : null;
  });
  for (const [a, n] of Object.entries(raw.ammo ?? {}) as [AmmoId, number][])
    if (a in B().ammo && n > 0) c.ammo[a] = Math.min(n | 0, B().ammo[a].max);
  c.drawn = raw.drawn !== undefined && c.slots[raw.drawn] ? raw.drawn : -1;
  return c;
}

export function statsOf(id: WeaponId | null): WeaponStats {
  return id ? B().weapons[id] : B().fists;
}

export function drawnWeapon(c: CombatState): OwnedWeapon | null {
  return c.drawn >= 0 ? (c.slots[c.drawn] ?? null) : null;
}

export function reserveOf(c: CombatState, ammo: AmmoId | null): number {
  return ammo ? (c.ammo[ammo] ?? 0) : 0;
}

/** Add rounds to the reserve, capped at what a player can carry. Returns the rounds actually added. */
export function addAmmo(c: CombatState, ammo: AmmoId, rounds: number): number {
  const have = reserveOf(c, ammo);
  const next = Math.min(B().ammo[ammo].max, have + Math.max(0, rounds));
  c.ammo[ammo] = next;
  return next - have;
}

// ------------------------------------------------------------------ switching and raising

/** Draw slot `k` (keys 1–4 → 0–3); an empty slot, or the drawn one again, holsters. Cancels a reload. */
export function selectSlot(c: CombatState, k: number): void {
  c.drawn = c.slots[k] && c.drawn !== k ? k : -1;
  c.reloading = 0;
  if (c.drawn < 0) c.raised = false;
}

/** Mouse wheel: step to the next filled slot (or fists) in direction `step` (+1 / −1). */
export function cycleWeapon(c: CombatState, step: 1 | -1): void {
  const order = [-1, ...c.slots.map((_, k) => k).filter((k) => c.slots[k])];
  const at = Math.max(0, order.indexOf(c.drawn));
  const next = order[(at + step + order.length) % order.length] ?? -1;
  c.drawn = next;
  c.reloading = 0;
  if (next < 0) c.raised = false;
}

/** Right mouse button. Fists can't be raised. */
export function setRaised(c: CombatState, raised: boolean): void {
  c.raised = raised && drawnWeapon(c) !== null;
}

/** Aiming a weapon intimidates (docs/05 witnesses, docs/04 hostage meter). */
export function canIntimidate(c: CombatState): boolean {
  return c.raised && drawnWeapon(c) !== null;
}

/** docs/05 "visible weapon": anything drawn, or a carried weapon that can't be hidden (only the pistol and the
 *  knife can). */
export function visibleWeapon(c: CombatState): boolean {
  if (drawnWeapon(c)) return true;
  return c.slots.some((w) => w && !WEAPONS[w.id].concealable);
}

/** Walking speed factor: the LMG slows you while drawn (docs/07). */
export function moveFactor(c: CombatState): number {
  const w = drawnWeapon(c);
  return w && WEAPONS[w.id].slows ? B().lmgMoveFactor : 1;
}

// ------------------------------------------------------------------ health and armor

export interface Vitals {
  health: number;
  armor: number;
}

export interface HurtResult {
  /** Damage taken by the armor and by health. */
  armor: number;
  health: number;
  /** Health reached 0: down (docs/05 death). */
  down: boolean;
}

/** Take damage: armor absorbs it first until it breaks, the rest comes off health (docs/07). */
export function hurt(v: Vitals, c: CombatState | null, amount: number): HurtResult {
  const dmg = Math.max(0, amount);
  const toArmor = Math.min(v.armor, dmg);
  v.armor -= toArmor;
  const toHealth = Math.min(v.health, dmg - toArmor);
  v.health -= toHealth;
  if (c) c.calm = 0;
  return { armor: toArmor, health: toHealth, down: v.health <= 0 };
}

/** Share of a full vest left, for the HUD armor bar. */
export function armorShare(v: Vitals): number {
  return Math.max(0, Math.min(1, v.armor / B().armor.absorbs));
}

/** Waking in hospital (docs/05 death): full health; items, weapons and ammo are kept. */
export function revive(v: Vitals, c: CombatState): void {
  v.health = BALANCE.player.maxHealth;
  c.raised = false;
  c.reloading = 0;
  c.cooldown = 0;
  c.calm = B().health.regenDelaySeconds;
}

// ------------------------------------------------------------------ the fixed-step tick

/** Timers, reload completion and out-of-combat regeneration (docs/07: up to 50 HP after 10 s of calm). */
export function tickCombat(c: CombatState, v: Vitals, dt: number): void {
  c.cooldown = Math.max(0, c.cooldown - dt);
  if (c.reloading > 0) {
    c.reloading -= dt;
    if (c.reloading <= 0) finishReload(c);
  }
  c.calm += dt;
  const H = B().health;
  if (c.calm >= H.regenDelaySeconds && v.health > 0 && v.health < H.regenCap)
    v.health = Math.min(H.regenCap, v.health + H.regenPerSecond * dt);
}

/** Start a reload if the clip isn't full and there's reserve. Returns true when one started. */
export function reload(c: CombatState): boolean {
  const w = drawnWeapon(c);
  if (!w || c.reloading > 0) return false;
  const def = WEAPONS[w.id];
  const s = statsOf(w.id);
  if (!def.ammo || w.clip >= s.clip || reserveOf(c, def.ammo) <= 0) return false;
  c.reloading = s.reload;
  return true;
}

function finishReload(c: CombatState): void {
  c.reloading = 0;
  const w = drawnWeapon(c);
  const ammo = w && WEAPONS[w.id].ammo;
  if (!w || !ammo) return;
  const take = Math.min(statsOf(w.id).clip - w.clip, reserveOf(c, ammo));
  w.clip += take;
  c.ammo[ammo] = reserveOf(c, ammo) - take;
}

// ------------------------------------------------------------------ firing

export interface Shot {
  /** Direction of each ray (pellets for the shotgun), with the spread applied. */
  angles: number[];
  /** Reach in world units. */
  range: number;
  /** Damage per ray. */
  damage: number;
}

export type FireResult =
  | { kind: 'none'; why: 'cooldown' | 'reloading' | 'held' }
  | { kind: 'empty'; reloading: boolean }
  | { kind: 'swing'; weapon: WeaponId | null; range: number; arc: number; damage: number; silent: true }
  | { kind: 'shot'; weapon: WeaponId; shot: Shot; silent: boolean; explosive: boolean };

/**
 * Pull the trigger (left click) aiming at `angle`. `held` is true when the button was already down last tick:
 * only automatic weapons keep firing then. An empty clip starts a reload when there's reserve.
 */
export function fire(c: CombatState, rng: Rng, angle: number, held: boolean): FireResult {
  if (c.reloading > 0) return { kind: 'none', why: 'reloading' };
  if (c.cooldown > 0) return { kind: 'none', why: 'cooldown' };
  const w = drawnWeapon(c);
  const def = w ? WEAPONS[w.id] : null;
  if (held && !def?.automatic) return { kind: 'none', why: 'held' };
  const s = statsOf(w?.id ?? null);
  c.calm = 0;
  if (!w || !def?.ammo) {
    c.cooldown = 1 / s.rate;
    return {
      kind: 'swing',
      weapon: w?.id ?? null,
      range: s.range * TILE,
      arc: ((s.arc ?? 0) * Math.PI) / 180,
      damage: s.damage,
      silent: true,
    };
  }
  if (w.clip <= 0) return { kind: 'empty', reloading: reload(c) };
  w.clip -= 1;
  c.cooldown = 1 / s.rate;
  const spread = ((c.raised ? s.spreadRaised : s.spreadHip) * Math.PI) / 180;
  const angles: number[] = [];
  for (let k = 0; k < s.pellets; k++) angles.push(angle + rng.range(-spread, spread));
  if (w.clip === 0) reload(c);
  return {
    kind: 'shot',
    weapon: w.id,
    shot: { angles, range: s.range * TILE, damage: s.damage },
    silent: !!def.silent,
    explosive: !!def.explosive,
  };
}

/** A police officer's shot with their star-level weapon (docs/07): the same weapons, wider spread. */
export function policeShot(stars: number, rng: Rng, angle: number): Shot {
  return npcShot(policeWeapon(stars), rng, angle);
}

/** A shot from someone else's gun (police, rivals): their spread is wider than the player's hip fire. */
export function npcShot(id: WeaponId, rng: Rng, angle: number): Shot {
  const s = statsOf(id);
  const spread = (s.spreadHip * B().police.spreadFactor * Math.PI) / 180;
  const angles: number[] = [];
  for (let k = 0; k < s.pellets; k++) angles.push(angle + rng.range(-spread, spread));
  return { angles, range: s.range * TILE, damage: s.damage };
}

// ------------------------------------------------------------------ hit tests

export type Box = readonly [number, number, number, number];

export interface Target {
  id: string;
  x: number;
  y: number;
  /** Hit radius in world units. */
  r: number;
}

export interface TraceResult {
  /** The target hit, or null when a wall or car stopped the ray or it ran out of range. */
  hit: string | null;
  /** Where the ray ended: the hit, the blocker's face, or full range (for the tracer and the grenade blast). */
  at: { x: number; y: number };
  blocked: boolean;
}

/** Distance along the ray (unit direction d) to where it enters the box, or Infinity. */
function rayBox(o: { x: number; y: number }, dx: number, dy: number, [x0, y0, x1, y1]: Box): number {
  let t0 = 0;
  let t1 = Infinity;
  for (const [p, d, lo, hi] of [
    [o.x, dx, x0, x1],
    [o.y, dy, y0, y1],
  ] as const) {
    if (Math.abs(d) < 1e-9) {
      if (p < lo || p > hi) return Infinity;
      continue;
    }
    let ta = (lo - p) / d;
    let tb = (hi - p) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return Infinity;
  }
  return t0;
}

/** Distance along the ray to where it enters the circle, or Infinity. */
function rayCircle(o: { x: number; y: number }, dx: number, dy: number, t: Target): number {
  const fx = o.x - t.x;
  const fy = o.y - t.y;
  const b = fx * dx + fy * dy;
  const c = fx * fx + fy * fy - t.r * t.r;
  if (c <= 0) return 0;
  const disc = b * b - c;
  if (disc < 0) return Infinity;
  const hit = -b - Math.sqrt(disc);
  return hit >= 0 ? hit : Infinity;
}

/**
 * Hitscan (docs/07): the ray from `from` at `angle` hits the nearest target in range unless a building or car
 * (`blockers`, ground boxes) is closer. Bullets don't damage cars (only the grenade launcher does).
 */
export function traceShot(
  from: { x: number; y: number },
  angle: number,
  range: number,
  targets: readonly Target[],
  blockers: readonly Box[],
): TraceResult {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let wall = range;
  for (const b of blockers) wall = Math.min(wall, rayBox(from, dx, dy, b));
  let best: string | null = null;
  let bestT = wall;
  for (const t of targets) {
    const d = rayCircle(from, dx, dy, t);
    if (d <= bestT) {
      bestT = d;
      best = t.id;
    }
  }
  const end = best ? bestT : wall;
  return { hit: best, at: { x: from.x + dx * end, y: from.y + dy * end }, blocked: !best && wall < range };
}

/** A melee swing hits the nearest target within reach and the arc, with nothing solid in between. */
export function swingHit(
  from: { x: number; y: number },
  angle: number,
  swing: { range: number; arc: number },
  targets: readonly Target[],
  blockers: readonly Box[],
): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const t of targets) {
    const d = Math.hypot(t.x - from.x, t.y - from.y);
    if (d - t.r > swing.range || d >= bestD) continue;
    const bearing = Math.atan2(t.y - from.y, t.x - from.x) - angle;
    const off = Math.abs(Math.atan2(Math.sin(bearing), Math.cos(bearing)));
    if (d > t.r && off > swing.arc) continue;
    const blocked = blockers.some((b) => rayBox(from, (t.x - from.x) / d, (t.y - from.y) / d, b) < d);
    if (blocked) continue;
    best = t.id;
    bestD = d;
  }
  return best;
}

/** Grenade blast (docs/07 "120 area, damages vehicles"): full damage at the centre falling linearly to the edge
 *  share at the blast radius. Targets may be people or cars. */
export function blast(
  at: { x: number; y: number },
  targets: readonly Target[],
): { id: string; damage: number }[] {
  const s = statsOf('grenade_launcher');
  const R = (s.blastRadius ?? 0) * TILE;
  const edge = s.blastEdgeShare ?? 0;
  const out: { id: string; damage: number }[] = [];
  for (const t of targets) {
    const d = Math.max(0, Math.hypot(t.x - at.x, t.y - at.y) - t.r);
    if (d > R) continue;
    out.push({ id: t.id, damage: Math.round(s.damage * (1 - (1 - edge) * (d / R))) });
  }
  return out;
}

// ------------------------------------------------------------------ getting weapons

export type GiveResult =
  | { ok: true; slot: number; replaced: OwnedWeapon | null; ammo: number }
  | { ok: false; why: 'owned' | 'full' };

/**
 * Put a weapon in the loadout. Owning the same weapon already: only its ammo is taken (`ammo` rounds). With every
 * slot of its kind full: `swap` replaces the drawn weapon of that kind (or the first), returning it to drop;
 * otherwise it fails.
 */
export function giveWeapon(
  c: CombatState,
  id: WeaponId,
  registered: boolean,
  rounds: number,
  swap: boolean,
): GiveResult {
  const def = WEAPONS[id];
  const owned = c.slots.findIndex((w) => w?.id === id);
  const kinds = slotKinds();
  const ammoIn = () => (def.ammo ? addAmmo(c, def.ammo, rounds) : 0);
  if (owned >= 0) {
    if (!swap) return { ok: false, why: 'owned' };
    return { ok: true, slot: owned, replaced: null, ammo: ammoIn() };
  }
  let slot = kinds.findIndex((k, i) => k === def.slot && !c.slots[i]);
  let replaced: OwnedWeapon | null = null;
  if (slot < 0) {
    if (!swap) return { ok: false, why: 'full' };
    slot = kinds[c.drawn] === def.slot ? c.drawn : kinds.indexOf(def.slot);
    replaced = c.slots[slot] ?? null;
  }
  const clip = def.ammo ? Math.min(statsOf(id).clip, Math.max(0, rounds)) : 0;
  c.slots[slot] = { id, registered, clip };
  const ammo = def.ammo ? clip + addAmmo(c, def.ammo, rounds - clip) : 0;
  return { ok: true, slot, replaced, ammo };
}

export type Shop = 'dealer' | 'gunstore';

export interface Purse {
  clean: number;
  dirty: number;
}

export type BuyResult = { ok: true; text: string } | { ok: false; text: string };

/** Dealers take dirty cash; the legal gun store takes clean cash (docs/07). */
function pay(money: Purse, shop: Shop, price: number): boolean {
  const key = shop === 'dealer' ? 'dirty' : 'clean';
  if (money[key] < price) return false;
  money[key] -= price;
  return true;
}

const cashWord = (shop: Shop) => (shop === 'dealer' ? 'DIRTY' : 'CLEAN');

/** Buy a weapon. It comes with one clip loaded (assumed). Gun-store weapons are registered. */
export function buyWeapon(c: CombatState, money: Purse, id: WeaponId, shop: Shop): BuyResult {
  const def = WEAPONS[id];
  if (shop === 'gunstore' && !GUN_STORE_STOCK.includes(id)) return { ok: false, text: 'NOT SOLD HERE' };
  if (c.slots.some((w) => w?.id === id)) return { ok: false, text: `YOU ALREADY HAVE A ${def.name}` };
  const kinds = slotKinds();
  if (!kinds.some((k, i) => k === def.slot && !c.slots[i]))
    return { ok: false, text: `NO FREE ${def.slot.toUpperCase()} SLOT` };
  const price = statsOf(id).price;
  if (!pay(money, shop, price)) return { ok: false, text: `NOT ENOUGH ${cashWord(shop)} CASH` };
  giveWeapon(c, id, shop === 'gunstore', statsOf(id).clip, false);
  return { ok: true, text: `BOUGHT ${def.name}` };
}

/** Buy one pack of ammo (docs/07 pack sizes). The gun store sells only 9mm and 12 gauge. */
export function buyAmmo(c: CombatState, money: Purse, ammo: AmmoId, shop: Shop): BuyResult {
  if (shop === 'gunstore' && !GUN_STORE_AMMO.includes(ammo)) return { ok: false, text: 'NOT SOLD HERE' };
  const A = B().ammo[ammo];
  if (reserveOf(c, ammo) >= A.max) return { ok: false, text: `CAN'T CARRY MORE ${AMMO_NAMES[ammo]}` };
  if (!pay(money, shop, A.price)) return { ok: false, text: `NOT ENOUGH ${cashWord(shop)} CASH` };
  const got = addAmmo(c, ammo, A.pack);
  return { ok: true, text: `BOUGHT ${got} ${AMMO_NAMES[ammo]}` };
}

/** Body armor from a dealer: dirty cash, a fresh vest that absorbs 50 (docs/07). */
export function buyArmor(v: Vitals, money: Purse): BuyResult {
  const A = B().armor;
  if (v.armor >= A.absorbs) return { ok: false, text: 'ARMOR IS ALREADY FULL' };
  if (!pay(money, 'dealer', A.price)) return { ok: false, text: 'NOT ENOUGH DIRTY CASH' };
  v.armor = A.absorbs;
  return { ok: true, text: 'BOUGHT BODY ARMOR' };
}

// ------------------------------------------------------------------ looting and the police

export interface Drop {
  weapon: WeaponId;
  /** Rounds that come with it. */
  rounds: number;
}

/** docs/07: police carry pistols at 1–2★, shotguns at 3★ and rifles at 4–5★. */
export function policeWeapon(stars: number): WeaponId {
  const t = B().police.weaponByStars;
  return t[Math.max(0, Math.min(stars, t.length) - 1)] as WeaponId;
}

/** docs/07: police only shoot at 2★ and above, or once the player has shot first. */
export function policeMayShoot(stars: number, playerShotFirst: boolean): boolean {
  return stars > 0 && (playerShotFirst || stars >= B().police.shootFromStars);
}

/** What a downed officer or enemy drops: their weapon plus some ammo (docs/07). */
export function rollDrop(weapon: WeaponId, rng: Rng): Drop {
  const clip = statsOf(weapon).clip;
  const [lo, hi] = B().dropClips;
  return { weapon, rounds: WEAPONS[weapon].ammo ? Math.max(1, Math.round(clip * rng.range(lo, hi))) : 0 };
}

/** Pick up a drop with E (docs/07). Looted weapons are unregistered. A full slot swaps out the weapon there,
 *  which is returned to leave on the ground. */
export function pickUp(c: CombatState, d: Drop): { text: string; dropped: OwnedWeapon | null } {
  const def = WEAPONS[d.weapon];
  const owned = c.slots.some((w) => w?.id === d.weapon);
  const r = giveWeapon(c, d.weapon, false, d.rounds, true);
  if (!r.ok) return { text: '', dropped: null };
  if (owned)
    return {
      text: def.ammo ? `+${r.ammo} ${AMMO_NAMES[def.ammo]}` : `YOU ALREADY HAVE A ${def.name}`,
      dropped: null,
    };
  return { text: `PICKED UP ${def.name}`, dropped: r.replaced };
}

/** Raise the stars to at least `floor` (shooting at police → 3★, killing an officer → 4★, docs/07). */
export function starsAtLeast(w: WantedState, floor: number, at: { x: number; y: number }): void {
  if (w.stars < floor) addStars(w, floor - w.stars, at);
  else addStars(w, 0, at);
}

export type CombatCrime = 'fight' | 'shootCivilian' | 'shootPolice' | 'killPolice';

/** A detected combat crime changes the wanted level (docs/05 table, docs/07 police rules). */
export function reportCombat(w: WantedState, crime: CombatCrime, at: { x: number; y: number }): void {
  const S = B().stars;
  if (crime === 'shootPolice') starsAtLeast(w, S.shootPoliceFloor, at);
  else if (crime === 'killPolice') starsAtLeast(w, S.killPoliceFloor, at);
  else addStars(w, crime === 'fight' ? S.fight : S.shootCivilian, at);
}

/** Jail on a repeat offense (docs/05, docs/07): unregistered weapons are seized; registered ones and ammo stay.
 *  Returns the seized weapons. */
export function seizeUnregistered(c: CombatState): WeaponId[] {
  const seized: WeaponId[] = [];
  c.slots = c.slots.map((w) => {
    if (w && !w.registered) {
      seized.push(w.id);
      return null;
    }
    return w;
  });
  if (!drawnWeapon(c)) selectSlot(c, -1);
  return seized;
}

/** docs/04 trunk loot "sometimes a gun": a weapon (with a clip's worth of ammo) or nothing. */
export function rollTrunkWeapon(rng: Rng): Drop | null {
  const T = B().trunkGun;
  if (!rng.chance(T.chance)) return null;
  const weapon = rng.pick(T.weapons);
  return { weapon, rounds: WEAPONS[weapon].ammo ? statsOf(weapon).clip : 0 };
}

// ------------------------------------------------------------------ HUD

/** The weapon panel's label and ammo text (docs/11): "CLIP/RESERVE" for guns, "-/-" for melee and fists. */
export function hudWeapon(c: CombatState): { label: string; ammo: string; type: string } {
  const w = drawnWeapon(c);
  if (!w) return { label: 'UNARMED', ammo: '-/-', type: 'MELEE' };
  const def = WEAPONS[w.id];
  if (!def.ammo) return { label: def.name, ammo: '-/-', type: 'MELEE' };
  return { label: def.name, ammo: `${w.clip}/${reserveOf(c, def.ammo)}`, type: AMMO_NAMES[def.ammo] };
}

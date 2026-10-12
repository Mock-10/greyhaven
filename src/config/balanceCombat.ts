// Combat numbers (docs/07, docs/05): weapons, ammo, health, armor, looting and the police rules. Kept apart from
// balance.ts so the combat logic could be built in parallel with Phase 2; it is part of the same "every number in
// config" rule (CLAUDE.md §2). Real seconds unless noted; distances in tiles. Values marked "assumed" are not in
// the docs (listed under Assumptions in the Phase 4 log).

import type { AmmoId, WeaponId } from '../data/weapons';

export interface WeaponStats {
  /** Dealer price in dirty dollars (docs/07); the legal gun store charges the same in clean cash. */
  price: number;
  /** Damage per hit; a shotgun's is per pellet (docs/07). */
  damage: number;
  /** Projectiles per shot: 1, or 8 for the shotgun (docs/07 "8 × 8 pellets"). */
  pellets: number;
  /** Reach of a swing or the hitscan range, in tiles (assumed). */
  range: number;
  /** Shots or swings per second (assumed). */
  rate: number;
  /** Rounds per clip, 0 for melee (assumed). */
  clip: number;
  /** Seconds to reload (assumed). */
  reload: number;
  /** Half-angle of the aim cone in degrees, from the hip and with the weapon raised (right-click, docs/07). For a
   *  shotgun it is the pellet spread. Assumed. */
  spreadHip: number;
  spreadRaised: number;
  /** Melee only: half-angle of the swing arc in degrees (assumed). */
  arc?: number;
  /** Grenades only: blast radius in tiles, and the share of the damage left at its edge (assumed). */
  blastRadius?: number;
  blastEdgeShare?: number;
}

export const BALANCE_COMBAT = {
  health: {
    /** docs/07: out of combat for 10 s, health regenerates slowly up to 50. */
    regenCap: 50,
    regenDelaySeconds: 10,
    /** "Slowly": 1 HP per second (assumed), so 0 → 50 takes 50 s. */
    regenPerSecond: 1,
  },

  /** docs/07: body armor costs $400 at dealers and absorbs 50 damage, then breaks. */
  armor: { price: 400, absorbs: 50 },

  /** Unarmed: fists, when nothing is drawn (assumed, for docs/05 "fighting"). */
  fists: {
    price: 0,
    damage: 10,
    pellets: 1,
    range: 0.9,
    rate: 2,
    clip: 0,
    reload: 0,
    spreadHip: 0,
    spreadRaised: 0,
    arc: 45,
  } satisfies WeaponStats,

  /** docs/07 table: price and damage; the rest assumed. */
  weapons: {
    bat: {
      price: 80,
      damage: 25,
      pellets: 1,
      range: 1.3,
      rate: 1.4,
      clip: 0,
      reload: 0,
      spreadHip: 0,
      spreadRaised: 0,
      arc: 60,
    },
    knife: {
      price: 120,
      damage: 35,
      pellets: 1,
      range: 1,
      rate: 1.8,
      clip: 0,
      reload: 0,
      spreadHip: 0,
      spreadRaised: 0,
      arc: 40,
    },
    pistol: {
      price: 600,
      damage: 20,
      pellets: 1,
      range: 12,
      rate: 3,
      clip: 12,
      reload: 1.2,
      spreadHip: 6,
      spreadRaised: 2,
    },
    revolver: {
      price: 1100,
      damage: 40,
      pellets: 1,
      range: 14,
      rate: 1.2,
      clip: 6,
      reload: 2.2,
      spreadHip: 5,
      spreadRaised: 1.5,
    },
    shotgun: {
      price: 1800,
      damage: 8,
      pellets: 8,
      range: 6,
      rate: 1,
      clip: 6,
      reload: 2.5,
      spreadHip: 16,
      spreadRaised: 12,
    },
    smg: {
      price: 2500,
      damage: 14,
      pellets: 1,
      range: 10,
      rate: 10,
      clip: 30,
      reload: 1.8,
      spreadHip: 12,
      spreadRaised: 7,
    },
    assault_rifle: {
      price: 6000,
      damage: 28,
      pellets: 1,
      range: 18,
      rate: 6,
      clip: 30,
      reload: 2,
      spreadHip: 7,
      spreadRaised: 2.5,
    },
    hunting_rifle: {
      price: 3500,
      damage: 70,
      pellets: 1,
      range: 28,
      rate: 0.8,
      clip: 5,
      reload: 2.8,
      spreadHip: 5,
      spreadRaised: 0.5,
    },
    lmg: {
      price: 18000,
      damage: 30,
      pellets: 1,
      range: 18,
      rate: 9,
      clip: 100,
      reload: 4,
      spreadHip: 10,
      spreadRaised: 6,
    },
    grenade_launcher: {
      price: 25000,
      damage: 120,
      pellets: 1,
      range: 16,
      rate: 0.8,
      clip: 1,
      reload: 1.5,
      spreadHip: 4,
      spreadRaised: 2,
      blastRadius: 2.5,
      blastEdgeShare: 0.25,
    },
  } satisfies Record<WeaponId, WeaponStats>,

  /** docs/07: ammo price per pack (dirty at dealers, clean at the gun store), and the most a player carries (assumed:
   *  about ten clips' worth). */
  ammo: {
    '9mm': { price: 30, pack: 24, max: 240 },
    '357': { price: 40, pack: 18, max: 90 },
    '12g': { price: 40, pack: 16, max: 80 },
    '556': { price: 70, pack: 60, max: 300 },
    '308': { price: 50, pack: 20, max: 60 },
    belt: { price: 300, pack: 100, max: 300 },
    grenade: { price: 400, pack: 1, max: 6 },
  } satisfies Record<AmmoId, { price: number; pack: number; max: number }>,

  /** docs/07: carry 1 melee weapon, 2 firearms and 1 heavy weapon. */
  loadout: { melee: 1, firearm: 2, heavy: 1 },

  /** docs/07: the LMG slows movement (by this factor, assumed). */
  lmgMoveFactor: 0.75,

  /** docs/07 looting: what downed police carry by star level (index 0 = 1★): pistols at 1–2★, shotguns at 3★,
   *  rifles at 4–5★. Their dropped ammo (assumed): a share of a clip plus up to one pack, in rounds. */
  police: {
    weaponByStars: ['pistol', 'pistol', 'shotgun', 'assault_rifle', 'assault_rifle'] as readonly WeaponId[],
    /** docs/07: police shoot only at 2★ and above, or once the player shoots first. */
    shootFromStars: 2,
    /** Police aim worse than a player with a raised weapon: their spread is the hip spread times this (assumed). */
    spreadFactor: 1.25,
  },

  /** Ammo in a dropped weapon, in clips (min, max) of that weapon (assumed). */
  dropClips: [0.5, 1.5] as readonly [number, number],

  /** docs/07 and docs/05: shooting at police raises the stars to at least 3; killing an officer to at least 4.
   *  docs/05 table: fighting 1★, shooting civilians 3★. */
  stars: { fight: 1, shootCivilian: 3, shootPoliceFloor: 3, killPoliceFloor: 4 },

  /** docs/04 trunk loot "sometimes a gun" (Phase 4): the chance a trunk holds one, and what it can be (assumed). */
  trunkGun: { chance: 0.06, weapons: ['bat', 'knife', 'pistol', 'revolver'] as readonly WeaponId[] },
};

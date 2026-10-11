// Every tunable number in the game lives here (CLAUDE.md §2: no magic numbers in systems).
// Phase 0 only needs the camera, the debug walker and the render settings.

export const BALANCE = {
  sim: {
    /** Fixed simulation rate (docs/14: fixed timestep, e.g. 30 Hz). */
    tickHz: 30,
    /** Longest frame the simulation will catch up on, in seconds (avoids a spiral after a stall). */
    maxFrameSeconds: 0.25,
  },

  camera: {
    /** The view may show this many art pixels of background past the map edge, no more. */
    boundsMarginPx: 48,
    /** Integer zoom levels the player can step through with Ctrl + wheel (docs/11). ?zoom=1 also works for debugging. */
    zoomLevels: [2, 3, 4] as readonly number[],
    /** Default zoom is the largest whole number that fits this many art pixels on screen. */
    fitWidth: 640,
    fitHeight: 360,
    /** Mouse pan reaches up to this many tiles from the player (docs/11). */
    panMaxTiles: 12,
    /** The camera springs back to the player after this many seconds without pan input (docs/11). */
    panIdleReturnSeconds: 3,
    /** Spring-back speed: fraction of the pan offset removed per second. */
    panReturnRate: 4,
    /** Edge scroll starts when the mouse is this close to the canvas edge, in CSS pixels. */
    edgeScrollMarginCss: 8,
    /** Edge scroll speed in art pixels per second (at any zoom). */
    edgeScrollSpeed: 360,
    /** Soft deadzone around the followed target, in art pixels. */
    deadzoneW: 48,
    deadzoneH: 32,
    /** Follow smoothing: fraction of the remaining distance closed per second. */
    followRate: 8,
  },

  clock: {
    /** Real minutes per in-game day (docs/01: setting 15, 20 or 30; default 20). */
    dayLengthMinutes: 20,
    dayLengthOptions: [15, 20, 30] as readonly number[],
    /** A new game starts on day 1 (Monday) at this in-game minute (07:00). */
    startMinute: 7 * 60,
    /** Darkness curve (in-game minutes): dawn brightens from 05:00 to 07:00, dusk darkens 18:00 to 21:30. */
    dawnStart: 5 * 60,
    dawnEnd: 7 * 60,
    duskStart: 18 * 60,
    duskEnd: 21 * 60 + 30,
    /** Street lamps and lit windows switch on above this darkness. */
    lightsOnDarkness: 0.35,
    /** ...and reach full strength this much darkness later (they were faint for most of dusk before). */
    lightsRampDarkness: 0.2,
    /** Lamp and window glow strength the moment they switch on. */
    lightsStartAlpha: 0.35,
  },

  economy: {
    /** Cash at the start of a new game (docs/02 is silent; assumption logged in CHANGELOG). */
    startClean: 250,
    startDirty: 0,
  },

  careers: {
    /** docs/03: clock in between 08:00 and 10:00; after 09:00 the shift pays 80%. Shifts run Monday–Friday. */
    clockInFrom: 8 * 60,
    lateAfter: 9 * 60,
    clockInUntil: 10 * 60,
    lateMultiplier: 0.8,
    workdays: [0, 1, 2, 3, 4] as readonly number[],
    /** Pay per shift (clean) by rank 1–5. */
    payByRank: [180, 260, 370, 510, 700] as readonly number[],
    /** XP needed to reach the next rank, from rank 1–4. */
    xpToNext: [40, 70, 110, 160] as readonly number[],
    /** One-time bonus on reaching rank 2–5. */
    promotionBonus: [250, 500, 900, 1500] as readonly number[],
    /** Shift XP by its typical grade: mostly poor / OK / good / excellent. */
    shiftXp: [6, 9, 11, 14] as readonly number[],
    /** Office rank that gets the building key card (docs/03 perk). */
    keyCardRank: 2,
  },

  minigames: {
    filing: { papers: 8, startFall: 18, fallAccel: 2.2, misfilePenalty: 1 },
    dataEntry: { rounds: 3, length: 5, seconds: 14 },
    /** docs/06 core skill check by tier: needle speed (rev/s), good and great zone widths (degrees), checks. */
    skillTiers: [
      { speed: 0.8, good: 60, great: 14, checks: 2 },
      { speed: 1.0, good: 48, great: 11, checks: 3 },
      { speed: 1.2, good: 38, great: 9, checks: 4 },
      { speed: 1.45, good: 30, great: 7, checks: 5 },
      { speed: 1.7, good: 24, great: 6, checks: 6 },
    ],
    /** Lockpick: misses allowed before the pick slips (fail), and progress lost per miss. */
    lockpick: { maxMisses: 3 },
    /** Hotwire (docs/06): 3–5 wire pairs before the timer runs out; a wrong pair sparks (noise). */
    hotwire: { pairs: 4, seconds: 12, maxSparks: 3 },
    /** Money count (docs/06): count bills into bundles of 10; miscounts cost a share of the wash. */
    moneyCount: { bills: 30, seconds: 16 },
  },

  player: {
    maxHealth: 100,
  },

  /** Driving (docs/08), in world units and seconds. The sedan's docs/08 stats (top speed 85, tank 40) are scaled
   *  to the map: top speed 85 → 240 units/s (7.5 tiles/s). */
  vehicles: {
    /** Stats per car type (docs/08), scaled to the map: the sedan's top speed 85 → 240 units/s, so 1 docs unit of
     *  speed ≈ 2.82 units/s. `value` is the docs/02 price, used for chop-shop pay (the taxi has no docs price:
     *  assumed a little under a sedan). */
    types: {
      sedan: {
        topSpeed: 240,
        reverseSpeed: 70,
        accel: 140,
        brake: 320,
        /** Rolling slowdown with no throttle. */
        drag: 70,
        /** Steering rate at speed (radians per second); tighter at low speed. */
        turnRate: 2.4,
        /** Half length and half width of the body for collision. */
        halfLength: 38,
        halfWidth: 15,
        /** Height of the body for its moving ground shadow. */
        shadowHeight: 22,
        health: 100,
        /** docs/08: a sedan tank holds 40 units, about 15 real minutes of full throttle. */
        tank: 40,
        fuelPerSecond: 40 / (15 * 60),
        value: 5000,
      },
      taxi: {
        topSpeed: 240,
        reverseSpeed: 70,
        accel: 140,
        brake: 320,
        drag: 70,
        turnRate: 2.4,
        halfLength: 38,
        halfWidth: 15,
        shadowHeight: 22,
        health: 100,
        tank: 40,
        fuelPerSecond: 40 / (15 * 60),
        value: 4500,
      },
      /** docs/08 van: top speed 70, low acceleration and grip, health 140, tank 60. */
      van: {
        topSpeed: 198,
        reverseSpeed: 60,
        accel: 105,
        brake: 260,
        drag: 70,
        turnRate: 2.0,
        halfLength: 42,
        halfWidth: 16,
        shadowHeight: 30,
        health: 140,
        tank: 60,
        fuelPerSecond: 60 / (15 * 60),
        value: 9000,
      },
    },
    /** Damage per unit of impact speed; below these healths the car smokes / loses 30% top speed (docs/08). */
    damagePerSpeed: 0.12,
    /** Bumps slower than this do no damage (parking, scraping a wall). */
    minImpactSpeed: 40,
    /** A blocked car slides along a wall when at least this share of its heading runs along it. */
    slideMinShare: 0.5,
    smokeBelow: 50,
    limpBelow: 25,
    limpFactor: 0.7,
    /** Bounce on impact: share of speed kept, reversed. */
    bounce: 0.25,
    /** How close (world units) you must stand to a car to use or enter it, or drive to a pump or Marlo. */
    reach: 40,
    pumpReach: 64,
    /** Marlo's dotted sale spot (decided 2026-10-11): the car's centre must be inside it, give or take this many
     *  units, and the car stopped (slower than saleMaxSpeed). Marlo walks out at walking pace. */
    spotSlack: 12,
    saleMaxSpeed: 6,
    marloWalkSpeed: 48,
    /** Fuel price (docs/02: $3 per unit) and a jerry can's contents (docs/08: 10 units). */
    fuelPrice: 3,
    canUnits: 10,
    /** Camera leads the car by up to this many tiles in its direction of travel (docs/11). */
    cameraLeadTiles: 3,
    /** How fast the look-ahead catches up (per second). */
    cameraLeadRate: 2,
    /** Getting out only below this speed (units per second). */
    exitMaxSpeed: 40,
    /** A crash this fast or harder gets a phone message when it wrecks the car. */
    crashToastSpeed: 30,
    /** Starting fuel of a parked car, as a share of the tank. */
    parkedFuel: 0.35,
  },

  /** Crime (docs/04): carjacking a parked car and the chop shop. */
  crime: {
    /** Chop shop pay (decided 2026-10-11): 15–30% of the car type's value (docs/08), scaled by condition. Below
     *  reputation tier `fullRateTier` Marlo pays only `earlyFactor` of that, capped at `earlyCap`, so an early car
     *  fetches about $250–600 (docs/04's $150–400 range, nudged up). */
    chop: { share: [0.15, 0.3] as readonly number[], earlyFactor: 0.35, earlyCap: 600, fullRateTier: 2 },
    /** Chance a failed lockpick sets off the car alarm (docs/05: 30%). */
    alarmChance: 0.3,
    /** A stolen car stays hot this many in-game minutes (docs/08: 2 days). */
    hotMinutes: 2 * 24 * 60,
  },

  /** Laundering with Dez (docs/02): cut, daily cap; a sloppy money count adds to the cut. */
  laundering: {
    cut: 0.35,
    dailyCap: 1500,
    /** Extra cut by money-count grade. */
    miscountCut: { excellent: 0, good: 0.02, ok: 0.05, poor: 0.1, fail: 0.15 },
  },

  /** Corner-store basics (docs/02 "Phase 1 shop"): price in clean dollars, health restored when eaten. */
  shop: {
    soda: { price: 3, heal: 5 },
    chips: { price: 6, heal: 10 },
    sandwich: { price: 12, heal: 25 },
    /** docs/08: a jerry can costs $40 and holds 10 fuel units. */
    fuel_can: { price: 40, heal: 0 },
  },

  /** Sleeping at home skips to this minute of the next day (docs/01: 06:00). */
  sleep: { wakeMinute: 6 * 60 },

  interiors: {
    /** Fade between the street and an interior (docs/18: about 0.3 s), in milliseconds. */
    fadeMs: 300,
    /** Sight is recomputed when the player has moved this far (docs/19: about 4 units). */
    sightMoveUnits: 4,
    /** Sight state changes fade over this long (docs/19: about 150 ms), in seconds. */
    sightFadeSeconds: 0.15,
    /** Remembered rooms dimmed with last-seen ghosts (docs/19). ON HOLD until Phase 8 (user, 2026-10-11):
     *  while false, rooms seen before are drawn like visible ones; only never-seen rooms get the lid. */
    rememberedDimming: false,
    /** Remembered rooms: floor dim overlay strength and the tint on static furniture (docs/19: about 50%, cooler). */
    rememberedDim: 0.5,
    rememberedTint: 0x8a82a8,
    /** Last-seen NPC ghosts: opacity (docs/19: about 40%). */
    ghostAlpha: 0.4,
    /** Indoor sight range in world units (docs/19: about 13 tiles). */
    sightRange: 420,
  },

  interact: {
    /** Objects within this range show the idle rim (docs/11: 1.5 tiles). */
    rangeTiles: 1.5,
    /** Among objects in range, prefer the one most in front of the player: weight of facing vs distance. */
    facingWeight: 0.6,
  },

  /** Input: keys pressed inside a minigame panel are ignored by the world this long after it closes. */
  ui: { keyGuardMs: 300 },

  hud: {
    /** Phone messages stay this long, then slide out (docs/11). */
    toastSeconds: 5,
    /** The street name shows for this long after entering a new street. */
    streetSeconds: 4,
    /** Radar radius in UI pixels and its world scale (docs/11: radius 38, about 0.13). */
    radarRadius: 38,
    radarScale: 0.13,
    radarHz: 15,
  },

  walker: {
    /** Walking speed in world units per second along a tile edge (1.5 tiles per second; raised from 32 after the
     *  milestone 1 playtest). Every key direction covers the same screen distance per second (systems/movement.ts). */
    walkSpeed: 48,
    /** Sprint multiplier (Shift): about 110 units/s, 3.4 tiles per second. */
    sprintMultiplier: 2.3,
    /** Walk-cycle frames per second for the 8-frame cycle (idle, step1, walk1, step1, idle, step2, walk2, step2).
     *  Kept in step with walkSpeed (12 fps at 32 units/s) so the feet don't slide. */
    walkFps: 18,
    /** The cycle runs faster while sprinting (longer strides, so less than the speed multiplier). */
    sprintFpsMultiplier: 1.8,
    /** Collision radius of a person, in world units. */
    radius: 6,
    /** Small decoration (bollards, hydrants, lamp posts, meters, bins): hit circle scale, and how much the
     *  walker's own radius shrinks against it, so brushing past one at a run doesn't stop you (2026-10-11). */
    smallPropScale: 0.6,
    smallPropSlack: 2,
    /** A prop counts as small when its footprint radius (or half width) is at most this, in world units. */
    smallPropMaxRadius: 9,
  },

  dayNight: {
    /** Full-night multiply tints (STYLE_GUIDE rainy dusk): objects, ground tiles, and usable objects (kept lighter). */
    objectTint: [0.66, 0.66, 0.8] as readonly number[],
    tileTint: [0.6, 0.62, 0.78] as readonly number[],
    cueTint: [0.86, 0.86, 0.94] as readonly number[],
    /** Street-lamp light pool strength at full night (0–1). */
    lampGlow: 0.65,
  },

  render: {
    /** Ground shadow strength (art/source/scene.py: shadow mask × 0.42). */
    shadowStrength: 0.42,
    /** Shadow mask values for box and blob shadows (scene.py polygon 150, ellipse 170). */
    shadowBoxValue: 150,
    shadowBlobValue: 170,
    /** A tall sprite in front of the player fades to this opacity (docs/11, docs/14). */
    occludedAlpha: 0.35,
    /** Sprites shorter than this (art px above their anchor) never fade. */
    occluderMinHeight: 56,
    /** Interactable idle shimmer frame rate (STYLE_GUIDE: about 6 fps). */
    shimmerFps: 6,
    /** Ground chunks are baked in blocks of this many tiles per side. */
    chunkTiles: 16,
    /** Most baked ground chunks kept in video memory at once. */
    maxChunks: 24,
    /** Vector-ground chunks are screen-aligned blocks of this many art pixels (a multiple of the swatch size). */
    vectorChunkW: 512,
    vectorChunkH: 256,
  },
} as const;

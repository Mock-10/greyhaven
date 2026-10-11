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
  },

  player: {
    maxHealth: 100,
  },

  interact: {
    /** Objects within this range show the idle rim (docs/11: 1.5 tiles). */
    rangeTiles: 1.5,
    /** Among objects in range, prefer the one most in front of the player: weight of facing vs distance. */
    facingWeight: 0.6,
  },

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
    /** Walking speed in world units per second (1.5 tiles per second; raised from 32 after the milestone 1 playtest). */
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
  },
} as const;
